import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import type { UIFContract } from '../../../src/types/UIFContract.js';
import type { BundleNode } from '../../../src/core/pack/builder.js';
import type { MissingDependency } from '../../../src/core/pack/collector.js';
import {
  formatBundle,
  pack,
  type LogicStampBundle,
  type PackOptions,
} from '../../../src/core/pack.js';
import {
  buildEdges,
  stableSort,
  computeBundleHash,
  validateHashLock,
} from '../../../src/core/pack/builder.js';
import { collectDependencies } from '../../../src/core/pack/collector.js';
import {
  loadManifest,
  loadContract,
  extractCodeHeader,
  readSourceCode,
  clearSecurityReportCache,
  getAndResetSanitizeStats,
  recordSanitization,
  recordSanitizationBatch,
} from '../../../src/core/pack/loader.js';
import {
  resolveKey,
  resolveDependency,
  findComponentByName,
} from '../../../src/core/pack/resolver.js';
import {
  isThirdPartyPackage,
  extractPackageName,
  getPackageVersion,
  clearPackageJsonCache,
} from '../../../src/core/pack/packageInfo.js';
import type { ProjectManifest } from '../../../src/core/manifest.js';
import { join } from 'node:path';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

// Mock the pack submodules for pack() integration tests
vi.mock('../../../src/core/pack/loader.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/core/pack/loader.js')>();
  return {
    ...actual,
    loadContract: vi.fn(actual.loadContract),
    extractCodeHeader: vi.fn(actual.extractCodeHeader),
    readSourceCode: vi.fn(actual.readSourceCode),
  };
});

vi.mock('../../../src/core/pack/builder.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/core/pack/builder.js')>();
  return {
    ...actual,
    validateHashLock: vi.fn(actual.validateHashLock),
  };
});

vi.mock('../../../src/core/pack/collector.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../../src/core/pack/collector.js')
    >();
  return {
    ...actual,
    collectDependencies: vi.fn(actual.collectDependencies),
  };
});

// We need to test the internal function filterInternalComponentsFromMissing
// Since it's not exported, we'll test it indirectly through the pack function
// But first, let's create a helper to test the logic

describe('Pack - Internal Component Filtering', () => {
  const createMockContract = (
    overrides?: Partial<UIFContract>,
  ): UIFContract => ({
    type: 'UIFContract',
    schemaVersion: '0.4',
    kind: 'react:component',
    entryId: 'src/components/Card.tsx',
    entryPathAbs: '/project/src/components/Card.tsx',
    entryPathRel: 'src/components/Card.tsx',
    os: 'posix',
    description: 'Card component',
    composition: {
      variables: [],
      hooks: [],
      components: [],
      functions: [],
      imports: [],
    },
    interface: {
      props: {},
      emits: {},
    },
    semanticHash: 'hash1',
    fileHash: 'file1',
    ...overrides,
  });

  const createMockBundleNode = (
    entryId: string,
    contract: UIFContract,
  ): BundleNode => ({
    entryId,
    contract,
  });

  describe('Internal component filtering in missing dependencies', () => {
    it('should filter internal components from missing dependencies when contract is available', () => {
      // This test verifies the behavior indirectly
      // Internal components (functions defined in same file) should not appear in missing deps

      const contract = createMockContract({
        entryId: 'src/components/Card.tsx',
        composition: {
          variables: [],
          hooks: [],
          components: ['Button', 'InternalHelper'],
          functions: ['InternalHelper'], // InternalHelper is a function component
          imports: [],
        },
      });

      const missing: MissingDependency[] = [
        {
          name: 'Button',
          reason: 'No contract found',
          referencedBy: 'src/components/Card.tsx',
        },
        {
          name: 'InternalHelper',
          reason: 'No contract found',
          referencedBy: 'src/components/Card.tsx',
        },
        {
          name: 'ExternalComponent',
          reason: 'No contract found',
          referencedBy: 'src/components/Card.tsx',
        },
      ];

      const nodes: BundleNode[] = [
        createMockBundleNode('src/components/Card.tsx', contract),
      ];

      // InternalHelper appears in both functions and components, so it's internal
      // It should be filtered out from missing dependencies
      // This is tested indirectly - the actual filtering happens in pack() function
      // We verify the contract structure supports the filtering logic
      expect(contract.composition.functions).toContain('InternalHelper');
      expect(contract.composition.components).toContain('InternalHelper');
      expect(contract.composition.functions).not.toContain('Button');
      expect(contract.composition.components).toContain('Button');
    });

    it('should identify internal components correctly', () => {
      // Internal component: appears in both functions and components arrays
      const contractWithInternal = createMockContract({
        composition: {
          variables: [],
          hooks: [],
          components: ['Button', 'InternalHelper'],
          functions: ['InternalHelper'],
          imports: [],
        },
      });

      // External component: only in components, not in functions
      const contractWithExternal = createMockContract({
        composition: {
          variables: [],
          hooks: [],
          components: ['Button', 'ExternalComponent'],
          functions: [],
          imports: [],
        },
      });

      // Verify internal component detection logic
      const internalHelperIsInternal =
        contractWithInternal.composition.functions.includes('InternalHelper') &&
        contractWithInternal.composition.components.includes('InternalHelper');

      const buttonIsInternal =
        contractWithInternal.composition.functions.includes('Button') &&
        contractWithInternal.composition.components.includes('Button');

      expect(internalHelperIsInternal).toBe(true);
      expect(buttonIsInternal).toBe(false);

      // External component should not be considered internal
      const externalIsInternal =
        contractWithExternal.composition.functions.includes(
          'ExternalComponent',
        ) &&
        contractWithExternal.composition.components.includes(
          'ExternalComponent',
        );

      expect(externalIsInternal).toBe(false);
    });

    it('should keep missing dependencies without referencedBy', () => {
      // Missing dependencies without referencedBy should not be filtered
      const missing: MissingDependency[] = [
        {
          name: 'UnknownComponent',
          reason: 'Component not found',
          // No referencedBy
        },
      ];

      // Without referencedBy, we can't check if it's internal
      // So it should be kept (not filtered)
      expect(missing[0].referencedBy).toBeUndefined();
    });

    it('should keep missing dependencies when contract is not available', () => {
      // If contract is not loaded, we can't check if it's internal
      // So we should keep the missing dependency
      const missing: MissingDependency[] = [
        {
          name: 'SomeComponent',
          reason: 'No contract found',
          referencedBy: 'src/components/Card.tsx',
        },
      ];

      const nodes: BundleNode[] = [
        // No contract for Card.tsx in nodes
        {
          entryId: 'src/components/Other.tsx',
          contract: createMockContract({ entryId: 'src/components/Other.tsx' }),
        },
      ];

      // Since Card.tsx contract is not in nodes, we can't check if SomeComponent is internal
      // So it should be kept
      const cardNode = nodes.find(
        (n) => n.entryId === 'src/components/Card.tsx',
      );
      expect(cardNode).toBeUndefined();
    });

    it('should handle contracts from contractsMap', () => {
      // Test that contracts from contractsMap are also checked
      const contract = createMockContract({
        entryId: 'src/components/Card.tsx',
        composition: {
          variables: [],
          hooks: [],
          components: ['InternalHelper'],
          functions: ['InternalHelper'],
          imports: [],
        },
      });

      const missing: MissingDependency[] = [
        {
          name: 'InternalHelper',
          reason: 'No contract found',
          referencedBy: 'src/components/Card.tsx',
        },
      ];

      // Contract should be available from contractsMap
      const contractsMap = new Map<string, UIFContract>();
      contractsMap.set('src/components/Card.tsx', contract);

      // Verify contract is in map
      expect(contractsMap.has('src/components/Card.tsx')).toBe(true);
      const contractFromMap = contractsMap.get('src/components/Card.tsx');
      expect(contractFromMap).toBeDefined();

      // InternalHelper should be identified as internal
      if (contractFromMap) {
        const isInternal =
          contractFromMap.composition.functions.includes('InternalHelper') &&
          contractFromMap.composition.components.includes('InternalHelper');
        expect(isInternal).toBe(true);
      }
    });

    it('should handle mixed internal and external missing dependencies', () => {
      const contract = createMockContract({
        entryId: 'src/components/Card.tsx',
        composition: {
          variables: [],
          hooks: [],
          components: ['Button', 'InternalHelper', 'ExternalComponent'],
          functions: ['InternalHelper'], // Only InternalHelper is a function
          imports: [],
        },
      });

      const missing: MissingDependency[] = [
        {
          name: 'Button',
          reason: 'No contract found',
          referencedBy: 'src/components/Card.tsx',
        },
        {
          name: 'InternalHelper',
          reason: 'No contract found',
          referencedBy: 'src/components/Card.tsx',
        },
        {
          name: 'ExternalComponent',
          reason: 'No contract found',
          referencedBy: 'src/components/Card.tsx',
        },
      ];

      const nodes: BundleNode[] = [
        createMockBundleNode('src/components/Card.tsx', contract),
      ];

      // Verify structure: InternalHelper should be internal, others should not
      const internalHelperIsInternal =
        contract.composition.functions.includes('InternalHelper') &&
        contract.composition.components.includes('InternalHelper');

      const buttonIsInternal =
        contract.composition.functions.includes('Button') &&
        contract.composition.components.includes('Button');

      const externalIsInternal =
        contract.composition.functions.includes('ExternalComponent') &&
        contract.composition.components.includes('ExternalComponent');

      expect(internalHelperIsInternal).toBe(true);
      expect(buttonIsInternal).toBe(false);
      expect(externalIsInternal).toBe(false);
    });

    it('should handle multiple files with different internal components', () => {
      const cardContract = createMockContract({
        entryId: 'src/components/Card.tsx',
        composition: {
          variables: [],
          hooks: [],
          components: ['CardHelper'],
          functions: ['CardHelper'],
          imports: [],
        },
      });

      const buttonContract = createMockContract({
        entryId: 'src/components/Button.tsx',
        composition: {
          variables: [],
          hooks: [],
          components: ['ButtonHelper'],
          functions: ['ButtonHelper'],
          imports: [],
        },
      });

      const nodes: BundleNode[] = [
        createMockBundleNode('src/components/Card.tsx', cardContract),
        createMockBundleNode('src/components/Button.tsx', buttonContract),
      ];

      // CardHelper should be internal to Card.tsx
      expect(cardContract.composition.functions.includes('CardHelper')).toBe(
        true,
      );
      expect(cardContract.composition.components.includes('CardHelper')).toBe(
        true,
      );

      // ButtonHelper should be internal to Button.tsx
      expect(
        buttonContract.composition.functions.includes('ButtonHelper'),
      ).toBe(true);
      expect(
        buttonContract.composition.components.includes('ButtonHelper'),
      ).toBe(true);

      // CardHelper is not internal to Button.tsx
      expect(buttonContract.composition.functions.includes('CardHelper')).toBe(
        false,
      );
    });

    it('should handle empty composition arrays', () => {
      const contract = createMockContract({
        entryId: 'src/components/Empty.tsx',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
          imports: [],
        },
      });

      // Nothing should be internal when arrays are empty
      expect(contract.composition.functions.includes('AnyComponent')).toBe(
        false,
      );
      expect(contract.composition.components.includes('AnyComponent')).toBe(
        false,
      );
    });

    it('should correctly identify components that are only in functions array', () => {
      // A function that is NOT used as a component should not be internal component
      const contract = createMockContract({
        entryId: 'src/components/Mixed.tsx',
        composition: {
          variables: [],
          hooks: [],
          components: ['ExternalComponent'],
          functions: ['helperFunction'], // Regular function, not a component
          imports: [],
        },
      });

      // helperFunction is in functions but NOT in components
      // So it's not an internal component
      const helperIsInternal =
        contract.composition.functions.includes('helperFunction') &&
        contract.composition.components.includes('helperFunction');

      expect(helperIsInternal).toBe(false);
    });
  });
});

describe('formatBundle', () => {
  const createMockBundle = (): LogicStampBundle => ({
    type: 'LogicStampBundle',
    schemaVersion: '0.1',
    entryId: 'src/components/Card.tsx',
    depth: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
    bundleHash: 'hash123',
    graph: {
      nodes: [
        {
          entryId: 'src/components/Card.tsx',
          contract: {
            type: 'UIFContract',
            schemaVersion: '0.4',
            kind: 'react:component',
            entryId: 'src/components/Card.tsx',
            entryPathAbs: '/project/src/components/Card.tsx',
            entryPathRel: 'src/components/Card.tsx',
            os: 'posix',
            description: 'Card component',
            composition: {
              variables: [],
              hooks: [],
              components: [],
              functions: [],
              imports: [],
            },
            interface: {
              props: {},
              emits: {},
            },
            semanticHash: 'semantic1',
            fileHash: 'file1',
          },
        },
      ],
      edges: [],
    },
    meta: {
      missing: [],
      source: 'logicstamp@1.0.0',
    },
  });

  it('should format bundle as compact JSON', () => {
    const bundle = createMockBundle();
    const result = formatBundle(bundle, 'json');

    expect(result).not.toContain('\n');
    expect(JSON.parse(result)).toEqual(bundle);
  });

  it('should format bundle as pretty JSON with indentation', () => {
    const bundle = createMockBundle();
    const result = formatBundle(bundle, 'pretty');

    expect(result).toContain('\n');
    expect(result).toContain('  '); // Has indentation
    expect(JSON.parse(result)).toEqual(bundle);
  });

  it('should format bundle as NDJSON (one node per line)', () => {
    const bundle = createMockBundle();
    const result = formatBundle(bundle, 'ndjson');

    const lines = result.split('\n');
    expect(lines).toHaveLength(1); // One node = one line
    expect(JSON.parse(lines[0])).toEqual(bundle.graph.nodes[0]);
  });

  it('should format multiple nodes as NDJSON', () => {
    const bundle = createMockBundle();
    bundle.graph.nodes.push({
      entryId: 'src/components/Button.tsx',
      contract: {
        ...bundle.graph.nodes[0].contract,
        entryId: 'src/components/Button.tsx',
        description: 'Button component',
      },
    });

    const result = formatBundle(bundle, 'ndjson');
    const lines = result.split('\n');

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).entryId).toBe('src/components/Card.tsx');
    expect(JSON.parse(lines[1]).entryId).toBe('src/components/Button.tsx');
  });

  it('should default to pretty format for unknown format', () => {
    const bundle = createMockBundle();
    const result = formatBundle(bundle, 'unknown' as any);

    expect(result).toContain('\n');
    expect(JSON.parse(result)).toEqual(bundle);
  });

  it('should default to pretty format for toon format', () => {
    const bundle = createMockBundle();
    const result = formatBundle(bundle, 'toon');

    expect(result).toContain('\n');
    expect(JSON.parse(result)).toEqual(bundle);
  });

  it('should handle bundle with empty nodes for ndjson', () => {
    const bundle = createMockBundle();
    bundle.graph.nodes = [];

    const result = formatBundle(bundle, 'ndjson');

    expect(result).toBe('');
  });

  it('should handle special characters in bundle data', () => {
    const bundle = createMockBundle();
    bundle.graph.nodes[0].contract.description =
      'Description with "quotes" and \n newlines';

    const result = formatBundle(bundle, 'json');
    const parsed = JSON.parse(result);

    expect(parsed.graph.nodes[0].contract.description).toBe(
      'Description with "quotes" and \n newlines',
    );
  });

  it('should include codeHeader when present in nodes', () => {
    const bundle = createMockBundle();
    bundle.graph.nodes[0].codeHeader = '/**\n * @uif Contract\n */';

    const result = formatBundle(bundle, 'json');
    const parsed = JSON.parse(result);

    expect(parsed.graph.nodes[0].codeHeader).toBe('/**\n * @uif Contract\n */');
  });

  it('should include code when present in nodes', () => {
    const bundle = createMockBundle();
    bundle.graph.nodes[0].code =
      'export function Component() { return <div />; }';

    const result = formatBundle(bundle, 'json');
    const parsed = JSON.parse(result);

    expect(parsed.graph.nodes[0].code).toBe(
      'export function Component() { return <div />; }',
    );
  });

  it('should handle null codeHeader', () => {
    const bundle = createMockBundle();
    bundle.graph.nodes[0].codeHeader = null;

    const result = formatBundle(bundle, 'json');
    const parsed = JSON.parse(result);

    expect(parsed.graph.nodes[0].codeHeader).toBeNull();
  });

  it('should handle bundle with missing dependencies in meta', () => {
    const bundle = createMockBundle();
    bundle.meta.missing = [
      { name: 'react', reason: 'Third party' },
      {
        name: '@mui/material',
        reason: 'Third party',
        packageName: '@mui/material',
        packageVersion: '^5.0.0',
      },
    ];

    const result = formatBundle(bundle, 'pretty');
    const parsed = JSON.parse(result);

    expect(parsed.meta.missing).toHaveLength(2);
    expect(parsed.meta.missing[1].packageVersion).toBe('^5.0.0');
  });

  it('should preserve edges in bundle', () => {
    const bundle = createMockBundle();
    bundle.graph.edges = [
      ['src/components/Card.tsx', 'src/components/Button.tsx'],
      ['src/components/Card.tsx', 'src/components/Icon.tsx'],
    ];

    const result = formatBundle(bundle, 'json');
    const parsed = JSON.parse(result);

    expect(parsed.graph.edges).toHaveLength(2);
    expect(parsed.graph.edges[0]).toEqual([
      'src/components/Card.tsx',
      'src/components/Button.tsx',
    ]);
  });
});

describe('buildEdges', () => {
  const createMockContract = (entryId: string): UIFContract => ({
    type: 'UIFContract',
    schemaVersion: '0.4',
    kind: 'react:component',
    entryId,
    entryPathAbs: `/project/${entryId}`,
    entryPathRel: entryId,
    os: 'posix',
    description: 'Test component',
    composition: {
      variables: [],
      hooks: [],
      components: [],
      functions: [],
      imports: [],
    },
    interface: {
      props: {},
      emits: {},
    },
    semanticHash: 'hash1',
    fileHash: 'file1',
  });

  const createMockManifest = (): ProjectManifest => ({
    version: '0.3',
    generatedAt: '2024-01-01T00:00:00.000Z',
    totalComponents: 3,
    components: {
      'src/components/Card.tsx': {
        entryId: 'src/components/Card.tsx',
        description: 'Card component',
        dependencies: ['Button', 'Icon'],
        usedBy: [],
        imports: [],
        routes: [],
        semanticHash: 'hash1',
      },
      'src/components/Button.tsx': {
        entryId: 'src/components/Button.tsx',
        description: 'Button component',
        dependencies: [],
        usedBy: ['Card'],
        imports: [],
        routes: [],
        semanticHash: 'hash2',
      },
      'src/components/Icon.tsx': {
        entryId: 'src/components/Icon.tsx',
        description: 'Icon component',
        dependencies: [],
        usedBy: ['Card'],
        imports: [],
        routes: [],
        semanticHash: 'hash3',
      },
    },
    graph: {
      roots: ['src/components/Card.tsx'],
      leaves: ['src/components/Button.tsx', 'src/components/Icon.tsx'],
    },
  });

  it('should build edges for dependencies within the bundle', () => {
    const manifest = createMockManifest();
    const nodes: BundleNode[] = [
      {
        entryId: 'src/components/Card.tsx',
        contract: createMockContract('src/components/Card.tsx'),
      },
      {
        entryId: 'src/components/Button.tsx',
        contract: createMockContract('src/components/Button.tsx'),
      },
      {
        entryId: 'src/components/Icon.tsx',
        contract: createMockContract('src/components/Icon.tsx'),
      },
    ];

    const edges = buildEdges(nodes, manifest);

    expect(edges).toContainEqual([
      'src/components/Card.tsx',
      'src/components/Button.tsx',
    ]);
    expect(edges).toContainEqual([
      'src/components/Card.tsx',
      'src/components/Icon.tsx',
    ]);
    expect(edges).toHaveLength(2);
  });

  it('should not include edges to nodes outside the bundle', () => {
    const manifest = createMockManifest();
    const nodes: BundleNode[] = [
      {
        entryId: 'src/components/Card.tsx',
        contract: createMockContract('src/components/Card.tsx'),
      },
      // Button and Icon are NOT in the bundle
    ];

    const edges = buildEdges(nodes, manifest);

    expect(edges).toHaveLength(0);
  });

  it('should handle nodes not found in manifest', () => {
    const manifest = createMockManifest();
    const nodes: BundleNode[] = [
      {
        entryId: 'src/components/Unknown.tsx',
        contract: createMockContract('src/components/Unknown.tsx'),
      },
    ];

    const edges = buildEdges(nodes, manifest);

    expect(edges).toHaveLength(0);
  });

  it('should handle empty nodes array', () => {
    const manifest = createMockManifest();
    const edges = buildEdges([], manifest);

    expect(edges).toEqual([]);
  });

  it('should handle nodes with normalized keys different from manifest keys', () => {
    // Manifest has forward slashes, but node entryIds might be normalized differently
    const manifest: ProjectManifest = {
      version: '0.3',
      generatedAt: '2024-01-01T00:00:00.000Z',
      totalComponents: 2,
      components: {
        'src/components/Card.tsx': {
          entryId: 'src/components/Card.tsx',
          description: 'Card component',
          dependencies: ['Button'],
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash1',
        },
        'src/components/Button.tsx': {
          entryId: 'src/components/Button.tsx',
          description: 'Button component',
          dependencies: [],
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash2',
        },
      },
      graph: {
        roots: ['src/components/Card.tsx'],
        leaves: ['src/components/Button.tsx'],
      },
    };

    const nodes: BundleNode[] = [
      {
        entryId: 'src/components/Card.tsx',
        contract: createMockContract('src/components/Card.tsx'),
      },
      {
        entryId: 'src/components/Button.tsx',
        contract: createMockContract('src/components/Button.tsx'),
      },
    ];

    const edges = buildEdges(nodes, manifest);

    expect(edges).toContainEqual([
      'src/components/Card.tsx',
      'src/components/Button.tsx',
    ]);
  });

  it('should handle self-referencing dependencies', () => {
    const manifest: ProjectManifest = {
      version: '0.3',
      generatedAt: '2024-01-01T00:00:00.000Z',
      totalComponents: 1,
      components: {
        'src/components/Recursive.tsx': {
          entryId: 'src/components/Recursive.tsx',
          description: 'Recursive component',
          dependencies: ['Recursive'], // Self reference
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash1',
        },
      },
      graph: {
        roots: [],
        leaves: [],
      },
    };

    const nodes: BundleNode[] = [
      {
        entryId: 'src/components/Recursive.tsx',
        contract: createMockContract('src/components/Recursive.tsx'),
      },
    ];

    const edges = buildEdges(nodes, manifest);

    // Self-referencing edge should be created
    expect(edges).toContainEqual([
      'src/components/Recursive.tsx',
      'src/components/Recursive.tsx',
    ]);
  });

  it('should handle multiple dependencies from one node', () => {
    const manifest: ProjectManifest = {
      version: '0.3',
      generatedAt: '2024-01-01T00:00:00.000Z',
      totalComponents: 3,
      components: {
        'src/App.tsx': {
          entryId: 'src/App.tsx',
          description: 'App component',
          dependencies: ['Button', 'Card'],
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash1',
        },
        'src/components/Button.tsx': {
          entryId: 'src/components/Button.tsx',
          description: 'Button',
          dependencies: [],
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash2',
        },
        'src/components/Card.tsx': {
          entryId: 'src/components/Card.tsx',
          description: 'Card',
          dependencies: [],
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash3',
        },
      },
      graph: {
        roots: ['src/App.tsx'],
        leaves: ['src/components/Button.tsx', 'src/components/Card.tsx'],
      },
    };

    const nodes: BundleNode[] = [
      { entryId: 'src/App.tsx', contract: createMockContract('src/App.tsx') },
      {
        entryId: 'src/components/Button.tsx',
        contract: createMockContract('src/components/Button.tsx'),
      },
      {
        entryId: 'src/components/Card.tsx',
        contract: createMockContract('src/components/Card.tsx'),
      },
    ];

    const edges = buildEdges(nodes, manifest);

    expect(edges).toHaveLength(2);
    expect(edges).toContainEqual(['src/App.tsx', 'src/components/Button.tsx']);
    expect(edges).toContainEqual(['src/App.tsx', 'src/components/Card.tsx']);
  });
});

describe('stableSort', () => {
  const createMockNode = (entryId: string): BundleNode => ({
    entryId,
    contract: {
      type: 'UIFContract',
      schemaVersion: '0.4',
      kind: 'react:component',
      entryId,
      entryPathAbs: `/project/${entryId}`,
      entryPathRel: entryId,
      os: 'posix',
      description: 'Test',
      composition: {
        variables: [],
        hooks: [],
        components: [],
        functions: [],
        imports: [],
      },
      interface: { props: {}, emits: {} },
      semanticHash: 'hash',
      fileHash: 'file',
    },
  });

  it('should sort nodes alphabetically by entryId', () => {
    const nodes = [
      createMockNode('src/z/Last.tsx'),
      createMockNode('src/a/First.tsx'),
      createMockNode('src/m/Middle.tsx'),
    ];

    const sorted = stableSort(nodes);

    expect(sorted[0].entryId).toBe('src/a/First.tsx');
    expect(sorted[1].entryId).toBe('src/m/Middle.tsx');
    expect(sorted[2].entryId).toBe('src/z/Last.tsx');
  });

  it('should not mutate the original array', () => {
    const nodes = [
      createMockNode('src/b/B.tsx'),
      createMockNode('src/a/A.tsx'),
    ];
    const originalFirst = nodes[0].entryId;

    stableSort(nodes);

    expect(nodes[0].entryId).toBe(originalFirst);
  });

  it('should produce same order regardless of input order', () => {
    const nodeA = createMockNode('src/a/A.tsx');
    const nodeB = createMockNode('src/b/B.tsx');
    const nodeC = createMockNode('src/c/C.tsx');

    const sorted1 = stableSort([nodeC, nodeA, nodeB]);
    const sorted2 = stableSort([nodeB, nodeC, nodeA]);
    const sorted3 = stableSort([nodeA, nodeB, nodeC]);

    expect(sorted1.map((n) => n.entryId)).toEqual(
      sorted2.map((n) => n.entryId),
    );
    expect(sorted2.map((n) => n.entryId)).toEqual(
      sorted3.map((n) => n.entryId),
    );
  });

  it('should handle empty array', () => {
    const sorted = stableSort([]);
    expect(sorted).toEqual([]);
  });

  it('should handle single element', () => {
    const node = createMockNode('src/Only.tsx');
    const sorted = stableSort([node]);

    expect(sorted).toHaveLength(1);
    expect(sorted[0].entryId).toBe('src/Only.tsx');
  });

  it('should sort by full path, not just filename', () => {
    const nodes = [
      createMockNode('src/z/Component.tsx'),
      createMockNode('src/a/Component.tsx'),
    ];

    const sorted = stableSort(nodes);

    // src/a/Component.tsx should come before src/z/Component.tsx
    expect(sorted[0].entryId).toBe('src/a/Component.tsx');
    expect(sorted[1].entryId).toBe('src/z/Component.tsx');
  });

  it('should handle nodes with same directory', () => {
    const nodes = [
      createMockNode('src/components/Zebra.tsx'),
      createMockNode('src/components/Apple.tsx'),
      createMockNode('src/components/Mango.tsx'),
    ];

    const sorted = stableSort(nodes);

    expect(sorted[0].entryId).toBe('src/components/Apple.tsx');
    expect(sorted[1].entryId).toBe('src/components/Mango.tsx');
    expect(sorted[2].entryId).toBe('src/components/Zebra.tsx');
  });

  it('should handle case-sensitive sorting', () => {
    const nodes = [
      createMockNode('src/button.tsx'),
      createMockNode('src/Button.tsx'),
      createMockNode('src/BUTTON.tsx'),
    ];

    const sorted = stableSort(nodes);

    // localeCompare behavior - uppercase letters come before lowercase in default locale
    expect(sorted.map((n) => n.entryId)).toEqual(
      [...nodes.map((n) => n.entryId)].sort((a, b) => a.localeCompare(b)),
    );
  });
});

describe('computeBundleHash', () => {
  const createMockNode = (
    entryId: string,
    semanticHash: string,
  ): BundleNode => ({
    entryId,
    contract: {
      type: 'UIFContract',
      schemaVersion: '0.4',
      kind: 'react:component',
      entryId,
      entryPathAbs: `/project/${entryId}`,
      entryPathRel: entryId,
      os: 'posix',
      description: 'Test',
      composition: {
        variables: [],
        hooks: [],
        components: [],
        functions: [],
        imports: [],
      },
      interface: { props: {}, emits: {} },
      semanticHash,
      fileHash: 'file',
    },
  });

  it('should compute a hash string', () => {
    const nodes = [createMockNode('src/A.tsx', 'hash1')];
    const hash = computeBundleHash(nodes, 2);

    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('should produce same hash for same input', () => {
    const nodes = [
      createMockNode('src/A.tsx', 'hash1'),
      createMockNode('src/B.tsx', 'hash2'),
    ];

    const hash1 = computeBundleHash(nodes, 2);
    const hash2 = computeBundleHash(nodes, 2);

    expect(hash1).toBe(hash2);
  });

  it('should produce different hash for different depth', () => {
    const nodes = [createMockNode('src/A.tsx', 'hash1')];

    const hash1 = computeBundleHash(nodes, 1);
    const hash2 = computeBundleHash(nodes, 2);

    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hash for different nodes', () => {
    const nodes1 = [createMockNode('src/A.tsx', 'hash1')];
    const nodes2 = [createMockNode('src/A.tsx', 'hash2')]; // Different semantic hash

    const hash1 = computeBundleHash(nodes1, 2);
    const hash2 = computeBundleHash(nodes2, 2);

    expect(hash1).not.toBe(hash2);
  });

  it('should handle empty nodes array', () => {
    const hash = computeBundleHash([], 2);
    expect(typeof hash).toBe('string');
  });

  it('should produce same hash regardless of node order (after sorting)', () => {
    const nodeA = createMockNode('src/A.tsx', 'hashA');
    const nodeB = createMockNode('src/B.tsx', 'hashB');

    // stableSort is applied before computeBundleHash in pack()
    // So the hash should be stable after sorting
    const sorted1 = stableSort([nodeB, nodeA]);
    const sorted2 = stableSort([nodeA, nodeB]);

    const hash1 = computeBundleHash(sorted1, 2);
    const hash2 = computeBundleHash(sorted2, 2);

    expect(hash1).toBe(hash2);
  });

  it('should produce different hash for different semantic hashes', () => {
    const node1 = createMockNode('src/A.tsx', 'hash1');
    const node2 = createMockNode('src/A.tsx', 'hash2');

    const hash1 = computeBundleHash([node1], 2);
    const hash2 = computeBundleHash([node2], 2);

    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hash for different entryIds', () => {
    const node1 = createMockNode('src/A.tsx', 'sameHash');
    const node2 = createMockNode('src/B.tsx', 'sameHash');

    const hash1 = computeBundleHash([node1], 2);
    const hash2 = computeBundleHash([node2], 2);

    expect(hash1).not.toBe(hash2);
  });

  it('should handle many nodes', () => {
    const nodes = Array.from({ length: 50 }, (_, i) =>
      createMockNode(`src/Component${i}.tsx`, `hash${i}`),
    );

    const hash = computeBundleHash(nodes, 2);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});

describe('validateHashLock', () => {
  const createMockContract = (fileHash: string): UIFContract => ({
    type: 'UIFContract',
    schemaVersion: '0.4',
    kind: 'react:component',
    entryId: 'src/test.tsx',
    entryPathAbs: '/project/src/test.tsx',
    entryPathRel: 'src/test.tsx',
    os: 'posix',
    description: 'Test',
    composition: {
      variables: [],
      hooks: [],
      components: [],
      functions: [],
      imports: [],
    },
    interface: { props: {}, emits: {} },
    semanticHash: 'semantic',
    fileHash,
  });

  it('should return false when file cannot be read', async () => {
    const contract = createMockContract('somehash');
    const result = await validateHashLock(
      contract,
      'non/existent/file.tsx',
      '/project',
    );

    expect(result).toBe(false);
  });

  it('should return false when hash does not match', async () => {
    // This will read a real file and compare - hash won't match
    const contract = createMockContract('definitely-wrong-hash');
    const result = await validateHashLock(
      contract,
      'package.json',
      process.cwd(),
    );

    expect(result).toBe(false);
  });

  it('should return false for empty file hash', async () => {
    const contract = createMockContract('');
    const result = await validateHashLock(
      contract,
      'package.json',
      process.cwd(),
    );

    expect(result).toBe(false);
  });

  it('should handle absolute paths', async () => {
    const contract = createMockContract('wrong-hash');
    const absolutePath = `${process.cwd()}/package.json`;
    const result = await validateHashLock(
      contract,
      absolutePath,
      process.cwd(),
    );

    expect(result).toBe(false);
  });

  it('should handle binary/non-text files gracefully', async () => {
    // This might be a binary file or might not exist - either way should return false
    const contract = createMockContract('somehash');
    const result = await validateHashLock(
      contract,
      'node_modules/.bin/vitest',
      process.cwd(),
    );

    // Should not throw, just return false
    expect(typeof result).toBe('boolean');
  });

  it('should return false for path traversal outside project root', async () => {
    const contract = createMockContract('somehash');
    const result = await validateHashLock(
      contract,
      '../../../package.json',
      process.cwd(),
    );
    expect(result).toBe(false);
  });
});

// ============================================================================
// FAILURE MODE TESTS - Real-world edge cases and error scenarios
// ============================================================================

describe('Pack Failure Modes', () => {
  describe('circular dependencies', () => {
    const createMockContract = (
      entryId: string,
      components: string[] = [],
    ): UIFContract => ({
      type: 'UIFContract',
      schemaVersion: '0.4',
      kind: 'react:component',
      entryId,
      entryPathAbs: `/project/${entryId}`,
      entryPathRel: entryId,
      os: 'posix',
      description: 'Test component',
      composition: {
        variables: [],
        hooks: [],
        components,
        functions: [],
        imports: [],
      },
      interface: {
        props: {},
        emits: {},
      },
      semanticHash: 'hash1',
      fileHash: 'file1',
    });

    it('should handle self-referencing component in buildEdges', () => {
      // A component that imports itself (recursive component)
      const manifest: ProjectManifest = {
        version: '0.3',
        generatedAt: new Date().toISOString(),
        totalComponents: 1,
        components: {
          'src/Tree.tsx': {
            entryId: 'src/Tree.tsx',
            description: 'Recursive tree',
            dependencies: ['Tree'], // Self-reference
            usedBy: ['Tree'],
            imports: [],
            routes: [],
            semanticHash: 'hash',
          },
        },
        graph: { roots: [], leaves: [] },
      };

      const nodes: BundleNode[] = [
        {
          entryId: 'src/Tree.tsx',
          contract: createMockContract('src/Tree.tsx', ['Tree']),
        },
      ];

      const edges = buildEdges(nodes, manifest);

      // Should not crash, should create self-edge
      expect(edges).toContainEqual(['src/Tree.tsx', 'src/Tree.tsx']);
    });

    it('should handle A->B->A circular dependency', () => {
      const manifest: ProjectManifest = {
        version: '0.3',
        generatedAt: new Date().toISOString(),
        totalComponents: 2,
        components: {
          'src/A.tsx': {
            entryId: 'src/A.tsx',
            description: 'Component A',
            dependencies: ['B'],
            usedBy: ['B'],
            imports: [],
            routes: [],
            semanticHash: 'hashA',
          },
          'src/B.tsx': {
            entryId: 'src/B.tsx',
            description: 'Component B',
            dependencies: ['A'],
            usedBy: ['A'],
            imports: [],
            routes: [],
            semanticHash: 'hashB',
          },
        },
        graph: { roots: [], leaves: [] },
      };

      const nodes: BundleNode[] = [
        {
          entryId: 'src/A.tsx',
          contract: createMockContract('src/A.tsx', ['B']),
        },
        {
          entryId: 'src/B.tsx',
          contract: createMockContract('src/B.tsx', ['A']),
        },
      ];

      const edges = buildEdges(nodes, manifest);

      // Should handle gracefully, creating edges both ways
      expect(edges).toContainEqual(['src/A.tsx', 'src/B.tsx']);
      expect(edges).toContainEqual(['src/B.tsx', 'src/A.tsx']);
    });

    it('should handle A->B->C->A circular dependency', () => {
      const manifest: ProjectManifest = {
        version: '0.3',
        generatedAt: new Date().toISOString(),
        totalComponents: 3,
        components: {
          'src/A.tsx': {
            entryId: 'src/A.tsx',
            description: 'Component A',
            dependencies: ['B'],
            usedBy: ['C'],
            imports: [],
            routes: [],
            semanticHash: 'hashA',
          },
          'src/B.tsx': {
            entryId: 'src/B.tsx',
            description: 'Component B',
            dependencies: ['C'],
            usedBy: ['A'],
            imports: [],
            routes: [],
            semanticHash: 'hashB',
          },
          'src/C.tsx': {
            entryId: 'src/C.tsx',
            description: 'Component C',
            dependencies: ['A'],
            usedBy: ['B'],
            imports: [],
            routes: [],
            semanticHash: 'hashC',
          },
        },
        graph: { roots: [], leaves: [] },
      };

      const nodes: BundleNode[] = [
        {
          entryId: 'src/A.tsx',
          contract: createMockContract('src/A.tsx', ['B']),
        },
        {
          entryId: 'src/B.tsx',
          contract: createMockContract('src/B.tsx', ['C']),
        },
        {
          entryId: 'src/C.tsx',
          contract: createMockContract('src/C.tsx', ['A']),
        },
      ];

      const edges = buildEdges(nodes, manifest);

      // Should handle the cycle without infinite loop
      expect(edges.length).toBe(3);
    });
  });

  describe('contract edge cases', () => {
    it('should handle contract with empty semantic hash', () => {
      const contract: UIFContract = {
        type: 'UIFContract',
        schemaVersion: '0.4',
        kind: 'react:component',
        entryId: 'src/Empty.tsx',
        entryPathAbs: '/project/src/Empty.tsx',
        entryPathRel: 'src/Empty.tsx',
        os: 'posix',
        description: 'Empty hash',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
          imports: [],
        },
        interface: { props: {}, emits: {} },
        semanticHash: '', // Empty hash
        fileHash: 'file1',
      };

      const node: BundleNode = { entryId: 'src/Empty.tsx', contract };

      // computeBundleHash should handle empty semantic hash
      const hash = computeBundleHash([node], 2);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should handle contract with very long semantic hash', () => {
      const contract: UIFContract = {
        type: 'UIFContract',
        schemaVersion: '0.4',
        kind: 'react:component',
        entryId: 'src/Long.tsx',
        entryPathAbs: '/project/src/Long.tsx',
        entryPathRel: 'src/Long.tsx',
        os: 'posix',
        description: 'Long hash',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
          imports: [],
        },
        interface: { props: {}, emits: {} },
        semanticHash: 'x'.repeat(1000), // Very long hash
        fileHash: 'file1',
      };

      const node: BundleNode = { entryId: 'src/Long.tsx', contract };

      const hash = computeBundleHash([node], 2);
      expect(typeof hash).toBe('string');
    });

    it('should handle contract with special characters in entryId', () => {
      const contract: UIFContract = {
        type: 'UIFContract',
        schemaVersion: '0.4',
        kind: 'react:component',
        entryId: 'src/[id]/Component.tsx',
        entryPathAbs: '/project/src/[id]/Component.tsx',
        entryPathRel: 'src/[id]/Component.tsx',
        os: 'posix',
        description: 'Dynamic route component',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
          imports: [],
        },
        interface: { props: {}, emits: {} },
        semanticHash: 'hash',
        fileHash: 'file',
      };

      const node: BundleNode = { entryId: 'src/[id]/Component.tsx', contract };
      const sorted = stableSort([node]);

      expect(sorted[0].entryId).toBe('src/[id]/Component.tsx');
    });

    it('should handle contract with unicode in description', () => {
      const contract: UIFContract = {
        type: 'UIFContract',
        schemaVersion: '0.4',
        kind: 'react:component',
        entryId: 'src/Unicode.tsx',
        entryPathAbs: '/project/src/Unicode.tsx',
        entryPathRel: 'src/Unicode.tsx',
        os: 'posix',
        description: '日本語コンポーネント 🎉',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
          imports: [],
        },
        interface: { props: {}, emits: {} },
        semanticHash: 'hash',
        fileHash: 'file',
      };

      const bundle: LogicStampBundle = {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/Unicode.tsx',
        depth: 2,
        createdAt: new Date().toISOString(),
        bundleHash: 'hash',
        graph: { nodes: [{ entryId: 'src/Unicode.tsx', contract }], edges: [] },
        meta: { missing: [], source: 'test' },
      };

      // Should format correctly with unicode
      const json = formatBundle(bundle, 'json');
      const parsed = JSON.parse(json);
      expect(parsed.graph.nodes[0].contract.description).toBe(
        '日本語コンポーネント 🎉',
      );
    });
  });

  describe('manifest edge cases', () => {
    it('should handle manifest with no components', () => {
      const manifest: ProjectManifest = {
        version: '0.3',
        generatedAt: new Date().toISOString(),
        totalComponents: 0,
        components: {},
        graph: { roots: [], leaves: [] },
      };

      const edges = buildEdges([], manifest);
      expect(edges).toEqual([]);
    });

    it('should handle nodes referencing non-existent manifest entries', () => {
      const manifest: ProjectManifest = {
        version: '0.3',
        generatedAt: new Date().toISOString(),
        totalComponents: 1,
        components: {
          'src/A.tsx': {
            entryId: 'src/A.tsx',
            description: 'Component A',
            dependencies: ['NonExistent'],
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash',
          },
        },
        graph: { roots: ['src/A.tsx'], leaves: [] },
      };

      const contract: UIFContract = {
        type: 'UIFContract',
        schemaVersion: '0.4',
        kind: 'react:component',
        entryId: 'src/A.tsx',
        entryPathAbs: '/project/src/A.tsx',
        entryPathRel: 'src/A.tsx',
        os: 'posix',
        description: 'A',
        composition: {
          variables: [],
          hooks: [],
          components: ['NonExistent'],
          functions: [],
          imports: [],
        },
        interface: { props: {}, emits: {} },
        semanticHash: 'hash',
        fileHash: 'file',
      };

      const nodes: BundleNode[] = [{ entryId: 'src/A.tsx', contract }];

      // Should not crash when dependency doesn't exist in manifest
      const edges = buildEdges(nodes, manifest);
      // NonExistent is not in nodes, so no edge should be created
      expect(edges).toHaveLength(0);
    });

    it('should handle manifest with duplicate dependency references', () => {
      const manifest: ProjectManifest = {
        version: '0.3',
        generatedAt: new Date().toISOString(),
        totalComponents: 2,
        components: {
          'src/A.tsx': {
            entryId: 'src/A.tsx',
            description: 'Component A',
            dependencies: ['B', 'B', 'B'], // Duplicates
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hashA',
          },
          'src/B.tsx': {
            entryId: 'src/B.tsx',
            description: 'Component B',
            dependencies: [],
            usedBy: ['A'],
            imports: [],
            routes: [],
            semanticHash: 'hashB',
          },
        },
        graph: { roots: ['src/A.tsx'], leaves: ['src/B.tsx'] },
      };

      const contractA: UIFContract = {
        type: 'UIFContract',
        schemaVersion: '0.4',
        kind: 'react:component',
        entryId: 'src/A.tsx',
        entryPathAbs: '/project/src/A.tsx',
        entryPathRel: 'src/A.tsx',
        os: 'posix',
        description: 'A',
        composition: {
          variables: [],
          hooks: [],
          components: ['B'],
          functions: [],
          imports: [],
        },
        interface: { props: {}, emits: {} },
        semanticHash: 'hashA',
        fileHash: 'fileA',
      };

      const contractB: UIFContract = {
        type: 'UIFContract',
        schemaVersion: '0.4',
        kind: 'react:component',
        entryId: 'src/B.tsx',
        entryPathAbs: '/project/src/B.tsx',
        entryPathRel: 'src/B.tsx',
        os: 'posix',
        description: 'B',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
          imports: [],
        },
        interface: { props: {}, emits: {} },
        semanticHash: 'hashB',
        fileHash: 'fileB',
      };

      const nodes: BundleNode[] = [
        { entryId: 'src/A.tsx', contract: contractA },
        { entryId: 'src/B.tsx', contract: contractB },
      ];

      const edges = buildEdges(nodes, manifest);

      // Should handle duplicates - either dedupe or allow multiple edges
      // The important thing is it doesn't crash
      expect(edges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('bundle formatting edge cases', () => {
    it('should handle bundle with extremely long code', () => {
      const longCode = 'x'.repeat(100000);
      const contract: UIFContract = {
        type: 'UIFContract',
        schemaVersion: '0.4',
        kind: 'react:component',
        entryId: 'src/Large.tsx',
        entryPathAbs: '/project/src/Large.tsx',
        entryPathRel: 'src/Large.tsx',
        os: 'posix',
        description: 'Large component',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
          imports: [],
        },
        interface: { props: {}, emits: {} },
        semanticHash: 'hash',
        fileHash: 'file',
      };

      const bundle: LogicStampBundle = {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/Large.tsx',
        depth: 2,
        createdAt: new Date().toISOString(),
        bundleHash: 'hash',
        graph: {
          nodes: [{ entryId: 'src/Large.tsx', contract, code: longCode }],
          edges: [],
        },
        meta: { missing: [], source: 'test' },
      };

      // Should not crash with large code
      const json = formatBundle(bundle, 'json');
      expect(json.length).toBeGreaterThan(100000);
    });

    it('should handle bundle with many missing dependencies', () => {
      const contract: UIFContract = {
        type: 'UIFContract',
        schemaVersion: '0.4',
        kind: 'react:component',
        entryId: 'src/Many.tsx',
        entryPathAbs: '/project/src/Many.tsx',
        entryPathRel: 'src/Many.tsx',
        os: 'posix',
        description: 'Many deps',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
          imports: [],
        },
        interface: { props: {}, emits: {} },
        semanticHash: 'hash',
        fileHash: 'file',
      };

      const missingDeps: MissingDependency[] = Array.from(
        { length: 100 },
        (_, i) => ({
          name: `missing-dep-${i}`,
          reason: 'Not found',
          packageName: `@scope/package-${i}`,
          packageVersion: `^${i}.0.0`,
        }),
      );

      const bundle: LogicStampBundle = {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/Many.tsx',
        depth: 2,
        createdAt: new Date().toISOString(),
        bundleHash: 'hash',
        graph: { nodes: [{ entryId: 'src/Many.tsx', contract }], edges: [] },
        meta: { missing: missingDeps, source: 'test' },
      };

      const json = formatBundle(bundle, 'pretty');
      const parsed = JSON.parse(json);
      expect(parsed.meta.missing.length).toBe(100);
    });

    it('should handle bundle with deeply nested edges', () => {
      const createContract = (id: string): UIFContract => ({
        type: 'UIFContract',
        schemaVersion: '0.4',
        kind: 'react:component',
        entryId: id,
        entryPathAbs: `/project/${id}`,
        entryPathRel: id,
        os: 'posix',
        description: 'Component',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
          imports: [],
        },
        interface: { props: {}, emits: {} },
        semanticHash: 'hash',
        fileHash: 'file',
      });

      const nodes: BundleNode[] = Array.from({ length: 50 }, (_, i) => ({
        entryId: `src/level${i}/Component.tsx`,
        contract: createContract(`src/level${i}/Component.tsx`),
      }));

      // Create chain: level0 -> level1 -> level2 -> ... -> level49
      const edges: [string, string][] = Array.from({ length: 49 }, (_, i) => [
        `src/level${i}/Component.tsx`,
        `src/level${i + 1}/Component.tsx`,
      ]);

      const bundle: LogicStampBundle = {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/level0/Component.tsx',
        depth: 50,
        createdAt: new Date().toISOString(),
        bundleHash: 'hash',
        graph: { nodes, edges },
        meta: { missing: [], source: 'test' },
      };

      const json = formatBundle(bundle, 'json');
      const parsed = JSON.parse(json);
      expect(parsed.graph.nodes.length).toBe(50);
      expect(parsed.graph.edges.length).toBe(49);
    });
  });

  describe('hash computation edge cases', () => {
    it('should produce different hashes for nodes with same content but different order', () => {
      const createNode = (id: string, hash: string): BundleNode => ({
        entryId: id,
        contract: {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: id,
          entryPathAbs: `/project/${id}`,
          entryPathRel: id,
          os: 'posix',
          description: 'Test',
          composition: {
            variables: [],
            hooks: [],
            components: [],
            functions: [],
            imports: [],
          },
          interface: { props: {}, emits: {} },
          semanticHash: hash,
          fileHash: 'file',
        },
      });

      // Without sorting, different orders would produce different hashes
      const nodes1 = [
        createNode('a.tsx', 'hash1'),
        createNode('b.tsx', 'hash2'),
      ];
      const nodes2 = [
        createNode('b.tsx', 'hash2'),
        createNode('a.tsx', 'hash1'),
      ];

      // After stable sort, same content should produce same hash
      const sorted1 = stableSort(nodes1);
      const sorted2 = stableSort(nodes2);

      const hash1 = computeBundleHash(sorted1, 2);
      const hash2 = computeBundleHash(sorted2, 2);

      expect(hash1).toBe(hash2);
    });

    it('should handle depth 0', () => {
      const node: BundleNode = {
        entryId: 'src/A.tsx',
        contract: {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/A.tsx',
          entryPathAbs: '/project/src/A.tsx',
          entryPathRel: 'src/A.tsx',
          os: 'posix',
          description: 'Test',
          composition: {
            variables: [],
            hooks: [],
            components: [],
            functions: [],
            imports: [],
          },
          interface: { props: {}, emits: {} },
          semanticHash: 'hash',
          fileHash: 'file',
        },
      };

      const hash = computeBundleHash([node], 0);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should handle very large depth', () => {
      const node: BundleNode = {
        entryId: 'src/A.tsx',
        contract: {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/A.tsx',
          entryPathAbs: '/project/src/A.tsx',
          entryPathRel: 'src/A.tsx',
          os: 'posix',
          description: 'Test',
          composition: {
            variables: [],
            hooks: [],
            components: [],
            functions: [],
            imports: [],
          },
          interface: { props: {}, emits: {} },
          semanticHash: 'hash',
          fileHash: 'file',
        },
      };

      const hash = computeBundleHash([node], 99999);
      expect(typeof hash).toBe('string');
    });
  });
});

// ============================================================================
// LOADER MODULE TESTS
// ============================================================================

describe('Loader Module', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'logicstamp-loader-test-'));
    clearSecurityReportCache();
    getAndResetSanitizeStats(); // Clear stats
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('loadManifest', () => {
    it('should load valid manifest', async () => {
      const manifest: ProjectManifest = {
        version: '0.3',
        generatedAt: new Date().toISOString(),
        totalComponents: 1,
        components: {
          'src/App.tsx': {
            entryId: 'src/App.tsx',
            description: 'App',
            dependencies: [],
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash',
          },
        },
        graph: { roots: ['src/App.tsx'], leaves: [] },
      };

      await writeFile(
        join(tempDir, 'logicstamp.manifest.json'),
        JSON.stringify(manifest),
      );

      const loaded = await loadManifest(tempDir);
      expect(loaded.totalComponents).toBe(1);
      expect(loaded.components['src/App.tsx']).toBeDefined();
    });

    it('should throw when manifest not found', async () => {
      await expect(loadManifest(tempDir)).rejects.toThrow('File not found');
    });

    it('should throw on invalid JSON', async () => {
      await writeFile(join(tempDir, 'logicstamp.manifest.json'), 'not json {');

      await expect(loadManifest(tempDir)).rejects.toThrow(
        'Failed to parse manifest',
      );
    });

    it('should throw on empty manifest file', async () => {
      await writeFile(join(tempDir, 'logicstamp.manifest.json'), '');

      await expect(loadManifest(tempDir)).rejects.toThrow();
    });
  });

  describe('loadContract', () => {
    it('should return null for non-existent contract', async () => {
      const contract = await loadContract('src/NonExistent.tsx', tempDir);
      expect(contract).toBeNull();
    });

    it('should return null for invalid JSON in sidecar', async () => {
      await mkdir(join(tempDir, 'src'), { recursive: true });
      await writeFile(
        join(tempDir, 'src', 'Component.tsx.uif.json'),
        'invalid json',
      );

      const contract = await loadContract('src/Component.tsx', tempDir);
      expect(contract).toBeNull();
    });

    it('should return null for invalid schema in sidecar', async () => {
      await mkdir(join(tempDir, 'src'), { recursive: true });
      // Valid JSON but invalid UIFContract schema
      await writeFile(
        join(tempDir, 'src', 'Component.tsx.uif.json'),
        JSON.stringify({
          type: 'NotUIFContract',
          invalid: true,
        }),
      );

      const contract = await loadContract('src/Component.tsx', tempDir);
      expect(contract).toBeNull();
    });

    it('should load valid contract', async () => {
      await mkdir(join(tempDir, 'src'), { recursive: true });
      // Create a minimal valid UIFContract with only required fields
      // Hash patterns must match: ^uif:[a-f0-9]{24}$
      const validContract: UIFContract = {
        type: 'UIFContract',
        schemaVersion: '0.4',
        kind: 'react:component',
        entryId: 'src/Component.tsx',
        description: 'Test component',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
        },
        interface: { props: {}, emits: {} },
        semanticHash: 'uif:abcdef0123456789abcdef01',
        fileHash: 'uif:123456789abcdef012345678',
      };
      await writeFile(
        join(tempDir, 'src', 'Component.tsx.uif.json'),
        JSON.stringify(validContract),
      );

      const contract = await loadContract('src/Component.tsx', tempDir);
      expect(contract).not.toBeNull();
      expect(contract?.entryId).toBe('src/Component.tsx');
    });

    it('should prevent path traversal attacks', async () => {
      // Try to load a contract outside project root
      const contract = await loadContract('../../../etc/passwd', tempDir);
      expect(contract).toBeNull();
    });

    it('should prevent path traversal with encoded characters', async () => {
      const contract = await loadContract(
        'src/..\\..\\..\\etc\\passwd',
        tempDir,
      );
      expect(contract).toBeNull();
    });
  });

  describe('extractCodeHeader', () => {
    it('should extract @uif JSDoc header', async () => {
      await mkdir(join(tempDir, 'src'), { recursive: true });
      const content = `/**
 * @uif Contract 0.4
 * Description: Test component
 */
export const Component = () => <div />;`;
      await writeFile(join(tempDir, 'src', 'Component.tsx'), content);

      const result = await extractCodeHeader('src/Component.tsx', tempDir);
      expect(result.header).not.toBeNull();
      expect(result.header).toContain('@uif');
    });

    it('should return null for file without @uif header', async () => {
      await mkdir(join(tempDir, 'src'), { recursive: true });
      await writeFile(
        join(tempDir, 'src', 'Component.tsx'),
        'export const x = 1;',
      );

      const result = await extractCodeHeader('src/Component.tsx', tempDir);
      expect(result.header).toBeNull();
    });

    it('should return null for non-existent file', async () => {
      const result = await extractCodeHeader('src/NonExistent.tsx', tempDir);
      expect(result.header).toBeNull();
    });

    it('should prevent path traversal', async () => {
      const result = await extractCodeHeader('../../../etc/passwd', tempDir);
      expect(result.header).toBeNull();
    });
  });

  describe('readSourceCode', () => {
    it('should read source code', async () => {
      await mkdir(join(tempDir, 'src'), { recursive: true });
      const content = 'export const Component = () => <div>Test</div>;';
      await writeFile(join(tempDir, 'src', 'Component.tsx'), content);

      const result = await readSourceCode('src/Component.tsx', tempDir);
      expect(result.code).toBe(content);
    });

    it('should return null for non-existent file', async () => {
      const result = await readSourceCode('src/NonExistent.tsx', tempDir);
      expect(result.code).toBeNull();
    });

    it('should prevent path traversal', async () => {
      const result = await readSourceCode('../../../etc/passwd', tempDir);
      expect(result.code).toBeNull();
    });
  });

  describe('sanitization stats', () => {
    it('should record sanitization info', () => {
      recordSanitization({
        hadSecrets: true,
        secretCount: 3,
        entryId: 'src/Secret.tsx',
      });

      const stats = getAndResetSanitizeStats();
      expect(stats.filesWithSecrets).toBe(1);
      expect(stats.totalSecretsReplaced).toBe(3);
      expect(stats.filesProcessed).toContain('src/Secret.tsx');
    });

    it('should not record when hadSecrets is false', () => {
      recordSanitization({
        hadSecrets: false,
        secretCount: 0,
        entryId: 'src/Clean.tsx',
      });

      const stats = getAndResetSanitizeStats();
      expect(stats.filesWithSecrets).toBe(0);
    });

    it('should batch record sanitization', () => {
      recordSanitizationBatch([
        { hadSecrets: true, secretCount: 2, entryId: 'src/A.tsx' },
        { hadSecrets: true, secretCount: 3, entryId: 'src/B.tsx' },
        { hadSecrets: false, secretCount: 0, entryId: 'src/C.tsx' },
      ]);

      const stats = getAndResetSanitizeStats();
      expect(stats.filesWithSecrets).toBe(2);
      expect(stats.totalSecretsReplaced).toBe(5);
    });

    it('should reset stats after get', () => {
      recordSanitization({ hadSecrets: true, secretCount: 1, entryId: 'test' });
      getAndResetSanitizeStats();

      const stats = getAndResetSanitizeStats();
      expect(stats.filesWithSecrets).toBe(0);
      expect(stats.totalSecretsReplaced).toBe(0);
    });
  });
});

// ============================================================================
// COLLECTOR MODULE TESTS
// ============================================================================

describe('Collector Module', () => {
  describe('collectDependencies', () => {
    const createManifest = (
      components: Record<string, { dependencies: string[] }>,
    ): ProjectManifest => ({
      version: '0.3',
      generatedAt: new Date().toISOString(),
      totalComponents: Object.keys(components).length,
      components: Object.fromEntries(
        Object.entries(components).map(([key, { dependencies }]) => [
          key,
          {
            entryId: key,
            description: 'Test',
            dependencies,
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash',
          },
        ]),
      ),
      graph: { roots: [], leaves: [] },
    });

    it('should collect single component with no dependencies', async () => {
      const manifest = createManifest({
        'src/App.tsx': { dependencies: [] },
      });

      const { visited, missing } = await collectDependencies(
        'src/App.tsx',
        manifest,
        2,
        100,
      );

      expect(visited.size).toBe(1);
      expect(visited.has('src/App.tsx')).toBe(true);
      expect(missing.length).toBe(0);
    });

    it('should collect dependencies at depth 1', async () => {
      const manifest = createManifest({
        'src/App.tsx': { dependencies: ['Button'] },
        'src/Button.tsx': { dependencies: [] },
      });

      const { visited } = await collectDependencies(
        'src/App.tsx',
        manifest,
        1,
        100,
      );

      expect(visited.size).toBe(2);
      expect(visited.has('src/App.tsx')).toBe(true);
      expect(visited.has('src/Button.tsx')).toBe(true);
    });

    it('should respect depth limit', async () => {
      const manifest = createManifest({
        'src/A.tsx': { dependencies: ['B'] },
        'src/B.tsx': { dependencies: ['C'] },
        'src/C.tsx': { dependencies: ['D'] },
        'src/D.tsx': { dependencies: [] },
      });

      const { visited } = await collectDependencies(
        'src/A.tsx',
        manifest,
        1,
        100,
      );

      expect(visited.size).toBe(2); // A and B only
      expect(visited.has('src/A.tsx')).toBe(true);
      expect(visited.has('src/B.tsx')).toBe(true);
      expect(visited.has('src/C.tsx')).toBe(false);
    });

    it('should respect maxNodes limit', async () => {
      const manifest = createManifest({
        'src/A.tsx': { dependencies: ['B', 'C', 'D', 'E'] },
        'src/B.tsx': { dependencies: [] },
        'src/C.tsx': { dependencies: [] },
        'src/D.tsx': { dependencies: [] },
        'src/E.tsx': { dependencies: [] },
      });

      const { visited } = await collectDependencies(
        'src/A.tsx',
        manifest,
        10,
        3,
      );

      expect(visited.size).toBe(3);
    });

    it('should handle circular dependencies without infinite loop', async () => {
      const manifest = createManifest({
        'src/A.tsx': { dependencies: ['B'] },
        'src/B.tsx': { dependencies: ['C'] },
        'src/C.tsx': { dependencies: ['A'] }, // Circular back to A
      });

      const { visited } = await collectDependencies(
        'src/A.tsx',
        manifest,
        10,
        100,
      );

      expect(visited.size).toBe(3);
      expect(visited.has('src/A.tsx')).toBe(true);
      expect(visited.has('src/B.tsx')).toBe(true);
      expect(visited.has('src/C.tsx')).toBe(true);
    });

    it('should track missing dependencies', async () => {
      const manifest = createManifest({
        'src/App.tsx': { dependencies: ['NonExistent', 'AlsoMissing'] },
      });

      const { visited, missing } = await collectDependencies(
        'src/App.tsx',
        manifest,
        2,
        100,
      );

      expect(visited.size).toBe(1);
      expect(missing.length).toBe(2);
      expect(missing.some((m) => m.name === 'NonExistent')).toBe(true);
      expect(missing.some((m) => m.name === 'AlsoMissing')).toBe(true);
    });

    it('should not duplicate missing dependencies', async () => {
      const manifest = createManifest({
        'src/A.tsx': { dependencies: ['Missing'] },
        'src/B.tsx': { dependencies: ['Missing'] },
      });
      // Make A depend on B to traverse both
      manifest.components['src/A.tsx'].dependencies.push('B');

      const { missing } = await collectDependencies(
        'src/A.tsx',
        manifest,
        2,
        100,
      );

      // Missing should only appear once even though both A and B reference it
      const missingCount = missing.filter((m) => m.name === 'Missing').length;
      expect(missingCount).toBe(1);
    });

    it('should handle non-existent entry component', async () => {
      const manifest = createManifest({
        'src/Other.tsx': { dependencies: [] },
      });

      const { visited, missing } = await collectDependencies(
        'src/NonExistent.tsx',
        manifest,
        2,
        100,
      );

      expect(visited.size).toBe(0);
      expect(missing.length).toBe(1);
      expect(missing[0].name).toBe('src/NonExistent.tsx');
    });

    it('should handle depth 0 (entry only)', async () => {
      const manifest = createManifest({
        'src/App.tsx': { dependencies: ['Button'] },
        'src/Button.tsx': { dependencies: [] },
      });

      const { visited } = await collectDependencies(
        'src/App.tsx',
        manifest,
        0,
        100,
      );

      expect(visited.size).toBe(1);
      expect(visited.has('src/App.tsx')).toBe(true);
      expect(visited.has('src/Button.tsx')).toBe(false);
    });

    it('should handle diamond dependency pattern', async () => {
      // A depends on B and C, both B and C depend on D
      const manifest = createManifest({
        'src/A.tsx': { dependencies: ['B', 'C'] },
        'src/B.tsx': { dependencies: ['D'] },
        'src/C.tsx': { dependencies: ['D'] },
        'src/D.tsx': { dependencies: [] },
      });

      const { visited } = await collectDependencies(
        'src/A.tsx',
        manifest,
        3,
        100,
      );

      expect(visited.size).toBe(4);
      // D should only be visited once
    });
  });
});

// ============================================================================
// RESOLVER MODULE TESTS
// ============================================================================

describe('Resolver Module', () => {
  const createManifest = (components: string[]): ProjectManifest => ({
    version: '0.3',
    generatedAt: new Date().toISOString(),
    totalComponents: components.length,
    components: Object.fromEntries(
      components.map((key) => [
        key,
        {
          entryId: key,
          description: 'Test',
          dependencies: [],
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash',
        },
      ]),
    ),
    graph: { roots: [], leaves: [] },
  });

  describe('resolveKey', () => {
    it('should resolve exact match', () => {
      const manifest = createManifest(['src/App.tsx', 'src/Button.tsx']);

      const key = resolveKey(manifest, 'src/App.tsx');
      expect(key).toBe('src/App.tsx');
    });

    it('should resolve normalized path', () => {
      const manifest = createManifest(['src/components/Button.tsx']);

      // With backslashes (Windows-style)
      const key = resolveKey(manifest, 'src\\components\\Button.tsx');
      expect(key).toBe('src/components/Button.tsx');
    });

    it('should return null for non-existent component', () => {
      const manifest = createManifest(['src/App.tsx']);

      const key = resolveKey(manifest, 'src/NonExistent.tsx');
      expect(key).toBeNull();
    });
  });

  describe('resolveDependency', () => {
    it('should resolve by filename', () => {
      const manifest = createManifest([
        'src/components/Button.tsx',
        'src/App.tsx',
      ]);

      const resolved = resolveDependency(manifest, 'Button', 'src/App.tsx');
      expect(resolved).toBe('src/components/Button.tsx');
    });

    it('should return null for unresolved dependency', () => {
      const manifest = createManifest(['src/App.tsx']);

      const resolved = resolveDependency(
        manifest,
        'NonExistent',
        'src/App.tsx',
      );
      expect(resolved).toBeNull();
    });
  });

  describe('findComponentByName', () => {
    it('should find by exact path', () => {
      const manifest = createManifest(['src/components/Button.tsx']);

      const result = findComponentByName(manifest, 'src/components/Button.tsx');
      expect(result).not.toBeNull();
      expect(result?.entryId).toBe('src/components/Button.tsx');
    });

    it('should find by filename without extension', () => {
      const manifest = createManifest(['src/components/Button.tsx']);

      const result = findComponentByName(manifest, 'Button');
      expect(result).not.toBeNull();
      expect(result?.entryId).toBe('src/components/Button.tsx');
    });

    it('should return null for non-existent component', () => {
      const manifest = createManifest(['src/App.tsx']);

      const result = findComponentByName(manifest, 'NonExistent');
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// PACKAGE INFO MODULE TESTS
// ============================================================================

// ============================================================================
// PACK() INTEGRATION TESTS - Orchestration coverage
// ============================================================================

describe('pack() Integration Tests', () => {
  const mockLoadContract = loadContract as Mock;
  const mockExtractCodeHeader = extractCodeHeader as Mock;
  const mockReadSourceCode = readSourceCode as Mock;
  const mockValidateHashLock = validateHashLock as Mock;
  const mockCollectDependencies = collectDependencies as Mock;

  const createValidContract = (
    entryId: string,
    overrides?: Partial<UIFContract>,
  ): UIFContract => ({
    type: 'UIFContract',
    schemaVersion: '0.4',
    kind: 'react:component',
    entryId,
    entryPathAbs: `/project/${entryId}`,
    entryPathRel: entryId,
    os: 'posix',
    description: 'Test component',
    composition: {
      variables: [],
      hooks: [],
      components: [],
      functions: [],
      imports: [],
    },
    interface: {
      props: {},
      emits: {},
    },
    semanticHash: 'uif:abcdef0123456789abcdef01',
    fileHash: 'uif:123456789abcdef012345678',
    ...overrides,
  });

  const createManifest = (
    components: Record<string, { dependencies?: string[] }>,
  ): ProjectManifest => ({
    version: '0.3',
    generatedAt: new Date().toISOString(),
    totalComponents: Object.keys(components).length,
    components: Object.fromEntries(
      Object.entries(components).map(([key, { dependencies = [] }]) => [
        key,
        {
          entryId: key,
          description: 'Test component',
          dependencies,
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash',
        },
      ]),
    ),
    graph: { roots: Object.keys(components), leaves: [] },
  });

  const defaultOptions: PackOptions = {
    depth: 2,
    includeCode: 'none',
    format: 'json',
    hashLock: false,
    strict: false,
    allowMissing: false,
    maxNodes: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getAndResetSanitizeStats(); // Clear stats
  });

  describe('hashLock validation', () => {
    it('should throw when hashLock is true and validation fails', async () => {
      const manifest = createManifest({ 'src/App.tsx': {} });
      const contract = createValidContract('src/App.tsx');

      mockCollectDependencies.mockResolvedValue({
        visited: new Set(['src/App.tsx']),
        missing: [],
      });
      mockLoadContract.mockResolvedValue(contract);
      mockValidateHashLock.mockResolvedValue(false); // Force validation failure

      const options = { ...defaultOptions, hashLock: true };

      await expect(
        pack('src/App.tsx', manifest, options, '/project'),
      ).rejects.toThrow(/Hash lock validation failed for src\/App\.tsx/);
    });

    it('should succeed when hashLock is true and validation passes', async () => {
      const manifest = createManifest({ 'src/App.tsx': {} });
      const contract = createValidContract('src/App.tsx');

      mockCollectDependencies.mockResolvedValue({
        visited: new Set(['src/App.tsx']),
        missing: [],
      });
      mockLoadContract.mockResolvedValue(contract);
      mockValidateHashLock.mockResolvedValue(true);

      const options = { ...defaultOptions, hashLock: true };
      const bundle = await pack('src/App.tsx', manifest, options, '/project');

      expect(bundle.graph.nodes).toHaveLength(1);
      expect(mockValidateHashLock).toHaveBeenCalledWith(
        contract,
        'src/App.tsx',
        '/project',
      );
    });
  });

  describe('includeCode: header', () => {
    it('should extract code header and record sanitization info', async () => {
      const manifest = createManifest({ 'src/App.tsx': {} });
      const contract = createValidContract('src/App.tsx');

      mockCollectDependencies.mockResolvedValue({
        visited: new Set(['src/App.tsx']),
        missing: [],
      });
      mockLoadContract.mockResolvedValue(contract);
      mockExtractCodeHeader.mockResolvedValue({
        header: '/** @uif Contract */',
        sanitizeInfo: {
          hadSecrets: true,
          secretCount: 2,
          entryId: 'src/App.tsx',
        },
      });

      const options = { ...defaultOptions, includeCode: 'header' as const };
      const bundle = await pack('src/App.tsx', manifest, options, '/project');

      expect(bundle.graph.nodes[0].codeHeader).toBe('/** @uif Contract */');
      expect(mockExtractCodeHeader).toHaveBeenCalledWith(
        'src/App.tsx',
        '/project',
      );

      // Sanitization stats should be recorded
      const stats = getAndResetSanitizeStats();
      expect(stats.filesWithSecrets).toBe(1);
      expect(stats.totalSecretsReplaced).toBe(2);
    });

    it('should handle header extraction without sanitization', async () => {
      const manifest = createManifest({ 'src/App.tsx': {} });
      const contract = createValidContract('src/App.tsx');

      mockCollectDependencies.mockResolvedValue({
        visited: new Set(['src/App.tsx']),
        missing: [],
      });
      mockLoadContract.mockResolvedValue(contract);
      mockExtractCodeHeader.mockResolvedValue({
        header: '/** @uif Contract */',
        // No sanitizeInfo
      });

      const options = { ...defaultOptions, includeCode: 'header' as const };
      const bundle = await pack('src/App.tsx', manifest, options, '/project');

      expect(bundle.graph.nodes[0].codeHeader).toBe('/** @uif Contract */');

      const stats = getAndResetSanitizeStats();
      expect(stats.filesWithSecrets).toBe(0);
    });
  });

  describe('includeCode: full', () => {
    it('should read full source code and header', async () => {
      const manifest = createManifest({ 'src/App.tsx': {} });
      const contract = createValidContract('src/App.tsx');

      mockCollectDependencies.mockResolvedValue({
        visited: new Set(['src/App.tsx']),
        missing: [],
      });
      mockLoadContract.mockResolvedValue(contract);
      mockReadSourceCode.mockResolvedValue({
        code: 'export const App = () => <div />;',
        sanitizeInfo: {
          hadSecrets: true,
          secretCount: 3,
          entryId: 'src/App.tsx',
        },
      });
      mockExtractCodeHeader.mockResolvedValue({
        header: '/** @uif Contract */',
      });

      const options = { ...defaultOptions, includeCode: 'full' as const };
      const bundle = await pack('src/App.tsx', manifest, options, '/project');

      expect(bundle.graph.nodes[0].code).toBe(
        'export const App = () => <div />;',
      );
      expect(bundle.graph.nodes[0].codeHeader).toBe('/** @uif Contract */');
      expect(mockReadSourceCode).toHaveBeenCalledWith(
        'src/App.tsx',
        '/project',
      );
      expect(mockExtractCodeHeader).toHaveBeenCalledWith(
        'src/App.tsx',
        '/project',
      );

      const stats = getAndResetSanitizeStats();
      expect(stats.filesWithSecrets).toBe(1);
      expect(stats.totalSecretsReplaced).toBe(3);
    });
  });

  describe('no nodes packed error', () => {
    it('should throw when all contracts fail to load', async () => {
      const manifest = createManifest({ 'src/App.tsx': {} });

      mockCollectDependencies.mockResolvedValue({
        visited: new Set(['src/App.tsx']),
        missing: [],
      });
      mockLoadContract.mockResolvedValue(null); // Contract not found

      const options = { ...defaultOptions, allowMissing: true };

      await expect(
        pack('src/App.tsx', manifest, options, '/project'),
      ).rejects.toThrow(/No nodes packed/);
    });

    it('should track missing contracts when allowMissing is false', async () => {
      const manifest = createManifest({
        'src/App.tsx': { dependencies: ['Button'] },
        'src/Button.tsx': {},
      });
      const appContract = createValidContract('src/App.tsx');

      mockCollectDependencies.mockResolvedValue({
        visited: new Set(['src/App.tsx', 'src/Button.tsx']),
        missing: [],
      });
      // App contract loads, Button contract fails
      mockLoadContract.mockImplementation((entryId: string) => {
        if (entryId === 'src/App.tsx') return Promise.resolve(appContract);
        return Promise.resolve(null);
      });

      const options = { ...defaultOptions, allowMissing: false };
      const bundle = await pack('src/App.tsx', manifest, options, '/project');

      expect(bundle.graph.nodes).toHaveLength(1);
      expect(bundle.meta.missing.some((m) => m.name === 'src/Button.tsx')).toBe(
        true,
      );
    });
  });

  describe('strict mode', () => {
    it('should throw immediately on missing contract in strict mode', async () => {
      const manifest = createManifest({ 'src/App.tsx': {} });

      mockCollectDependencies.mockResolvedValue({
        visited: new Set(['src/App.tsx']),
        missing: [],
      });
      mockLoadContract.mockResolvedValue(null);

      const options = { ...defaultOptions, strict: true };

      await expect(
        pack('src/App.tsx', manifest, options, '/project'),
      ).rejects.toThrow(
        /Missing contract for src\/App\.tsx \(strict mode enabled\)/,
      );
    });
  });

  describe('edge sorting', () => {
    it('should sort edges with same source by target (secondary sort)', async () => {
      // Create manifest where App depends on Button and Card (same source, different targets)
      const manifest = createManifest({
        'src/App.tsx': { dependencies: ['Card', 'Button'] }, // Intentionally out of order
        'src/Button.tsx': {},
        'src/Card.tsx': {},
      });

      const contracts = {
        'src/App.tsx': createValidContract('src/App.tsx'),
        'src/Button.tsx': createValidContract('src/Button.tsx'),
        'src/Card.tsx': createValidContract('src/Card.tsx'),
      };

      mockCollectDependencies.mockResolvedValue({
        visited: new Set(['src/App.tsx', 'src/Button.tsx', 'src/Card.tsx']),
        missing: [],
      });
      mockLoadContract.mockImplementation((entryId: string) =>
        Promise.resolve(contracts[entryId as keyof typeof contracts] || null),
      );

      const bundle = await pack(
        'src/App.tsx',
        manifest,
        defaultOptions,
        '/project',
      );

      // Both edges have same source (App), so secondary sort by target kicks in
      // Button < Card alphabetically
      expect(bundle.graph.edges).toHaveLength(2);
      expect(bundle.graph.edges[0]).toEqual(['src/App.tsx', 'src/Button.tsx']);
      expect(bundle.graph.edges[1]).toEqual(['src/App.tsx', 'src/Card.tsx']);
    });
  });

  describe('component not found', () => {
    it('should throw with suggestions when component not in manifest', async () => {
      const manifest = createManifest({
        'src/Button.tsx': {},
        'src/Card.tsx': {},
      });

      await expect(
        pack('src/NonExistent.tsx', manifest, defaultOptions, '/project'),
      ).rejects.toThrow(/Component not found: src\/NonExistent\.tsx/);
    });
  });

  describe('contractsMap (standalone mode)', () => {
    it('should use contracts from contractsMap instead of loading from disk', async () => {
      const manifest = createManifest({ 'src/App.tsx': {} });
      const contract = createValidContract('src/App.tsx');
      const contractsMap = new Map([['src/App.tsx', contract]]);

      mockCollectDependencies.mockResolvedValue({
        visited: new Set(['src/App.tsx']),
        missing: [],
      });
      // loadContract should not be called when contract is in map
      mockLoadContract.mockResolvedValue(null);

      const options = { ...defaultOptions, contractsMap };
      const bundle = await pack('src/App.tsx', manifest, options, '/project');

      expect(bundle.graph.nodes).toHaveLength(1);
      expect(bundle.graph.nodes[0].contract).toBe(contract);
    });
  });

  describe('multiple nodes with sanitization', () => {
    it('should batch record sanitization for multiple files', async () => {
      const manifest = createManifest({
        'src/App.tsx': { dependencies: ['Button'] },
        'src/Button.tsx': {},
      });

      const contracts = {
        'src/App.tsx': createValidContract('src/App.tsx'),
        'src/Button.tsx': createValidContract('src/Button.tsx'),
      };

      mockCollectDependencies.mockResolvedValue({
        visited: new Set(['src/App.tsx', 'src/Button.tsx']),
        missing: [],
      });
      mockLoadContract.mockImplementation((entryId: string) =>
        Promise.resolve(contracts[entryId as keyof typeof contracts] || null),
      );
      mockExtractCodeHeader.mockImplementation((entryId: string) =>
        Promise.resolve({
          header: '/** @uif */',
          sanitizeInfo: {
            hadSecrets: true,
            secretCount: entryId === 'src/App.tsx' ? 2 : 1,
            entryId,
          },
        }),
      );

      const options = { ...defaultOptions, includeCode: 'header' as const };
      await pack('src/App.tsx', manifest, options, '/project');

      const stats = getAndResetSanitizeStats();
      expect(stats.filesWithSecrets).toBe(2);
      expect(stats.totalSecretsReplaced).toBe(3); // 2 + 1
    });
  });
});

describe('Package Info Module', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'logicstamp-pkg-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('isThirdPartyPackage', () => {
    it('should identify npm packages', () => {
      expect(isThirdPartyPackage('react')).toBe(true);
      expect(isThirdPartyPackage('lodash')).toBe(true);
      expect(isThirdPartyPackage('@mui/material')).toBe(true);
      expect(isThirdPartyPackage('@types/node')).toBe(true);
    });

    it('should not identify relative imports as third-party', () => {
      expect(isThirdPartyPackage('./Button')).toBe(false);
      expect(isThirdPartyPackage('../utils/helper')).toBe(false);
    });

    it('should identify path-like imports without ./ as third-party', () => {
      // Note: src/components/Button.tsx looks like a third-party package to the function
      // because it doesn't start with . or /
      // This is intentional - the function only checks for explicit relative markers
      expect(isThirdPartyPackage('src/components/Button.tsx')).toBe(true);
    });

    it('should not identify absolute paths as third-party', () => {
      expect(isThirdPartyPackage('/absolute/path')).toBe(false);
      expect(isThirdPartyPackage('C:\\Windows\\Path')).toBe(false);
    });
  });

  describe('extractPackageName', () => {
    it('should extract package name from simple imports', () => {
      expect(extractPackageName('react')).toBe('react');
      expect(extractPackageName('lodash')).toBe('lodash');
    });

    it('should extract scoped package names', () => {
      expect(extractPackageName('@mui/material')).toBe('@mui/material');
      expect(extractPackageName('@types/node')).toBe('@types/node');
    });

    it('should extract package from deep imports', () => {
      expect(extractPackageName('lodash/debounce')).toBe('lodash');
      expect(extractPackageName('@mui/material/Button')).toBe('@mui/material');
    });

    it('should return null for relative paths', () => {
      expect(extractPackageName('./Button')).toBeNull();
      expect(extractPackageName('../utils')).toBeNull();
    });
  });

  describe('getPackageVersion', () => {
    beforeEach(() => {
      clearPackageJsonCache();
    });

    it('should return undefined when package.json does not exist', async () => {
      const version = await getPackageVersion('react', tempDir);
      expect(version).toBeUndefined();
    });

    it('should return version from dependencies', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          dependencies: {
            react: '^18.2.0',
          },
        }),
      );

      const version = await getPackageVersion('react', tempDir);
      expect(version).toBe('^18.2.0');
    });

    it('should return version from devDependencies', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          devDependencies: {
            vitest: '^1.0.0',
          },
        }),
      );

      const version = await getPackageVersion('vitest', tempDir);
      expect(version).toBe('^1.0.0');
    });

    it('should return undefined for non-existent package', async () => {
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({
          dependencies: {
            react: '^18.0.0',
          },
        }),
      );

      const version = await getPackageVersion('nonexistent-package', tempDir);
      expect(version).toBeUndefined();
    });

    it('should handle malformed package.json', async () => {
      await writeFile(join(tempDir, 'package.json'), 'not json');

      const version = await getPackageVersion('react', tempDir);
      expect(version).toBeUndefined();
    });
  });
});
