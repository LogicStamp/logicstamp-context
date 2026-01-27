/**
 * Unit tests for incremental watch mode functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { UIFContract } from '../../../src/types/UIFContract.js';
import type { LogicStampBundle } from '../../../src/core/pack.js';
import type { ProjectManifest } from '../../../src/core/manifest.js';

// Mock dependencies before importing the module
vi.mock('../../../src/utils/fsx.js', () => ({
  normalizeEntryId: (id: string) => id.replace(/\\/g, '/'),
  readFileWithText: vi.fn(),
}));

vi.mock('../../../src/utils/hash.js', () => ({
  fileHash: vi.fn((content: string) => `hash-${content.length}`),
}));

vi.mock('../../../src/core/astParser.js', () => ({
  extractFromFile: vi.fn(),
}));

vi.mock('../../../src/core/contractBuilder.js', () => ({
  buildContract: vi.fn(),
}));

vi.mock('../../../src/extractors/styling/index.js', () => ({
  extractStyleMetadata: vi.fn(),
}));

vi.mock('../../../src/core/manifest.js', () => ({
  buildDependencyGraph: vi.fn(),
}));

vi.mock('../../../src/core/pack.js', () => ({
  pack: vi.fn(),
}));

vi.mock('ts-morph', () => ({
  Project: vi.fn().mockImplementation(() => ({
    addSourceFileAtPath: vi.fn(),
  })),
}));

// Import after mocks are set up
import {
  initializeWatchCache,
  incrementalRebuild,
  type WatchCache,
} from '../../../src/cli/commands/context/incrementalWatch.js';
import { buildDependencyGraph } from '../../../src/core/manifest.js';
import { pack } from '../../../src/core/pack.js';
import { readFileWithText } from '../../../src/utils/fsx.js';
import { fileHash } from '../../../src/utils/hash.js';
import { extractFromFile } from '../../../src/core/astParser.js';
import { buildContract } from '../../../src/core/contractBuilder.js';

describe('initializeWatchCache', () => {
  const createMockContract = (entryId: string, fileHashValue: string): UIFContract => ({
    type: 'UIFContract',
    schemaVersion: '0.4',
    kind: 'react:component',
    entryId,
    description: `Mock ${entryId}`,
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
    exports: { named: [entryId.split('/').pop()?.replace('.tsx', '') || ''] },
    semanticHash: `semantic-${entryId}`,
    fileHash: fileHashValue,
  });

  const createMockBundle = (entryId: string, nodeEntryIds: string[]): LogicStampBundle => ({
    type: 'LogicStampBundle',
    schemaVersion: '0.1',
    entryId,
    depth: 2,
    createdAt: new Date().toISOString(),
    bundleHash: `bundleHash-${entryId}`,
    graph: {
      nodes: nodeEntryIds.map(id => ({
        entryId: id,
        contract: createMockContract(id, `fileHash-${id}`),
      })),
      edges: [],
    },
    meta: {
      missing: [],
      source: 'test',
    },
  });

  const createMockManifest = (roots: string[]): ProjectManifest => ({
    version: '0.3',
    generatedAt: new Date().toISOString(),
    totalComponents: roots.length,
    components: {},
    graph: {
      roots,
      leaves: [],
    },
  });

  it('should initialize cache with empty inputs', async () => {
    const cache = await initializeWatchCache([], [], createMockManifest([]), [], '/project');

    expect(cache.contracts.size).toBe(0);
    expect(cache.astCache.size).toBe(0);
    expect(cache.styleCache.size).toBe(0);
    expect(cache.fileList.size).toBe(0);
    expect(cache.componentToBundles.size).toBe(0);
    expect(cache.allBundles.length).toBe(0);
  });

  it('should cache contracts by fileHash', async () => {
    const contracts = [
      createMockContract('src/App.tsx', 'fileHash-app'),
      createMockContract('src/components/Button.tsx', 'fileHash-button'),
    ];
    const bundles: LogicStampBundle[] = [];
    const manifest = createMockManifest(['src/App.tsx']);

    const cache = await initializeWatchCache(
      ['src/App.tsx', 'src/components/Button.tsx'],
      contracts,
      manifest,
      bundles,
      '/project'
    );

    expect(cache.contracts.size).toBe(2);
    expect(cache.contracts.has('fileHash-app')).toBe(true);
    expect(cache.contracts.has('fileHash-button')).toBe(true);
  });

  it('should track file list', async () => {
    const files = ['src/App.tsx', 'src/components/Button.tsx', 'src/utils/helpers.ts'];
    const cache = await initializeWatchCache(files, [], createMockManifest([]), [], '/project');

    expect(cache.fileList.size).toBe(3);
    expect(cache.fileList.has('src/App.tsx')).toBe(true);
    expect(cache.fileList.has('src/components/Button.tsx')).toBe(true);
    expect(cache.fileList.has('src/utils/helpers.ts')).toBe(true);
  });

  it('should build reverse index from bundles', async () => {
    const bundles = [
      createMockBundle('src/App.tsx', ['src/App.tsx', 'src/components/Button.tsx']),
      createMockBundle('src/components/Card.tsx', ['src/components/Card.tsx', 'src/components/Button.tsx']),
    ];
    const manifest = createMockManifest(['src/App.tsx', 'src/components/Card.tsx']);

    const cache = await initializeWatchCache([], [], manifest, bundles, '/project');

    // Button should be in both App and Card bundles
    const buttonBundles = cache.componentToBundles.get('src/components/Button.tsx');
    expect(buttonBundles).toBeDefined();
    expect(buttonBundles!.size).toBe(2);
    expect(buttonBundles!.has('src/App.tsx')).toBe(true);
    expect(buttonBundles!.has('src/components/Card.tsx')).toBe(true);

    // App should be in App bundle only
    const appBundles = cache.componentToBundles.get('src/App.tsx');
    expect(appBundles).toBeDefined();
    expect(appBundles!.size).toBe(1);
    expect(appBundles!.has('src/App.tsx')).toBe(true);
  });

  it('should store manifest and bundles', async () => {
    const manifest = createMockManifest(['src/App.tsx']);
    const bundles = [createMockBundle('src/App.tsx', ['src/App.tsx'])];

    const cache = await initializeWatchCache([], [], manifest, bundles, '/project');

    expect(cache.manifest).toBe(manifest);
    expect(cache.allBundles).toEqual(bundles);
  });
});

describe('incrementalRebuild', () => {
  const createMockContract = (entryId: string, fileHashValue: string, semanticHashValue?: string): UIFContract => ({
    type: 'UIFContract',
    schemaVersion: '0.4',
    kind: 'react:component',
    entryId,
    description: `Mock ${entryId}`,
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
    exports: { named: [entryId.split('/').pop()?.replace('.tsx', '') || ''] },
    semanticHash: semanticHashValue || `semantic-${entryId}`,
    fileHash: fileHashValue,
  });

  const createMockBundle = (entryId: string, bundleHashValue: string): LogicStampBundle => ({
    type: 'LogicStampBundle',
    schemaVersion: '0.1',
    entryId,
    depth: 2,
    createdAt: new Date().toISOString(),
    bundleHash: bundleHashValue,
    graph: {
      nodes: [{
        entryId,
        contract: createMockContract(entryId, `fileHash-${entryId}`),
      }],
      edges: [],
    },
    meta: {
      missing: [],
      source: 'test',
    },
  });

  let mockCache: WatchCache;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCache = {
      contracts: new Map(),
      astCache: new Map(),
      styleCache: new Map(),
      fileList: new Set(['src/App.tsx']),
      componentToBundles: new Map([
        ['src/App.tsx', new Set(['src/App.tsx'])],
      ]),
      manifest: {
        version: '0.3',
        generatedAt: new Date().toISOString(),
        totalComponents: 1,
        components: {
          'src/App.tsx': {
            entryId: 'src/App.tsx',
            description: 'App component',
            dependencies: [],
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'semantic-app',
          },
        },
        graph: {
          roots: ['src/App.tsx'],
          leaves: ['src/App.tsx'],
        },
      },
      allBundles: [createMockBundle('src/App.tsx', 'bundleHash-1')],
    };
  });

  it('should skip files with unchanged hash', async () => {
    const existingContract = createMockContract('src/App.tsx', 'hash-100');
    mockCache.contracts.set('hash-100', existingContract);

    // Mock readFileWithText to return content with length 100 (hash will be 'hash-100')
    vi.mocked(readFileWithText).mockResolvedValue({ text: 'x'.repeat(100), path: 'src/App.tsx' });
    vi.mocked(fileHash).mockReturnValue('hash-100');

    vi.mocked(buildDependencyGraph).mockReturnValue(mockCache.manifest!);

    const result = await incrementalRebuild(
      ['src/App.tsx'],
      mockCache,
      { out: '.', depth: 2 } as any,
      '/project'
    );

    // Should not rebuild any bundles since hash unchanged
    expect(result.updatedBundles.size).toBe(0);
    // extractFromFile should not be called since hash matched
    expect(extractFromFile).not.toHaveBeenCalled();
  });

  it('should rebuild contract when file hash changes', async () => {
    const existingContract = createMockContract('src/App.tsx', 'old-hash');
    mockCache.contracts.set('old-hash', existingContract);

    // Mock file read with new content
    vi.mocked(readFileWithText).mockResolvedValue({ text: 'new content', path: 'src/App.tsx' });
    vi.mocked(fileHash).mockReturnValue('new-hash');

    // Mock AST extraction
    vi.mocked(extractFromFile).mockResolvedValue({
      kind: 'react:component',
      exports: { named: ['App'] },
      components: [],
      functions: [],
      hooks: [],
      variables: [],
      imports: [],
      props: {},
      emits: {},
      state: {},
      jsxRoutes: [],
    });

    // Mock contract building
    const newContract = createMockContract('src/App.tsx', 'new-hash', 'new-semantic');
    vi.mocked(buildContract).mockReturnValue({ contract: newContract, violations: [] });

    // Mock manifest building
    vi.mocked(buildDependencyGraph).mockReturnValue({
      ...mockCache.manifest!,
      graph: { roots: ['src/App.tsx'], leaves: [] },
    });

    // Mock pack function
    const newBundle = createMockBundle('src/App.tsx', 'new-bundleHash');
    vi.mocked(pack).mockResolvedValue(newBundle);

    const result = await incrementalRebuild(
      ['src/App.tsx'],
      mockCache,
      { out: '.', depth: 2 } as any,
      '/project'
    );

    expect(result.updatedBundles.has('src/App.tsx')).toBe(true);
    expect(extractFromFile).toHaveBeenCalled();
    expect(buildContract).toHaveBeenCalled();
    expect(pack).toHaveBeenCalled();
  });

  it('should handle errors gracefully and continue', async () => {
    // Mock file read to throw error
    vi.mocked(readFileWithText).mockRejectedValue(new Error('File not found'));

    vi.mocked(buildDependencyGraph).mockReturnValue(mockCache.manifest!);

    const result = await incrementalRebuild(
      ['src/nonexistent.tsx'],
      mockCache,
      { out: '.', depth: 2 } as any,
      '/project'
    );

    // Should handle error and return empty updates
    expect(result.updatedBundles.size).toBe(0);
    expect(result.bundles).toEqual(mockCache.allBundles);
  });

  it('should update componentToBundles index after rebuild', async () => {
    vi.mocked(readFileWithText).mockResolvedValue({ text: 'new content', path: 'src/App.tsx' });
    vi.mocked(fileHash).mockReturnValue('new-hash');

    vi.mocked(extractFromFile).mockResolvedValue({
      kind: 'react:component',
      exports: { named: ['App'] },
      components: ['Button'], // Now depends on Button
      functions: [],
      hooks: [],
      variables: [],
      imports: [],
      props: {},
      emits: {},
      state: {},
      jsxRoutes: [],
    });

    const newContract = createMockContract('src/App.tsx', 'new-hash');
    vi.mocked(buildContract).mockReturnValue({ contract: newContract, violations: [] });

    vi.mocked(buildDependencyGraph).mockReturnValue({
      ...mockCache.manifest!,
      graph: { roots: ['src/App.tsx'], leaves: [] },
    });

    const newBundle: LogicStampBundle = {
      type: 'LogicStampBundle',
      schemaVersion: '0.1',
      entryId: 'src/App.tsx',
      depth: 2,
      createdAt: new Date().toISOString(),
      bundleHash: 'new-bundleHash',
      graph: {
        nodes: [
          { entryId: 'src/App.tsx', contract: newContract },
          { entryId: 'src/components/Button.tsx', contract: createMockContract('src/components/Button.tsx', 'hash-button') },
        ],
        edges: [['src/App.tsx', 'src/components/Button.tsx']],
      },
      meta: { missing: [], source: 'test' },
    };
    vi.mocked(pack).mockResolvedValue(newBundle);

    await incrementalRebuild(
      ['src/App.tsx'],
      mockCache,
      { out: '.', depth: 2 } as any,
      '/project'
    );

    // Button should now be in App's bundle
    const buttonBundles = mockCache.componentToBundles.get('src/components/Button.tsx');
    expect(buttonBundles).toBeDefined();
    expect(buttonBundles!.has('src/App.tsx')).toBe(true);
  });

  it('should detect new root components and create bundles for them', async () => {
    // Start with empty cache
    mockCache.contracts.clear();
    mockCache.componentToBundles.clear();
    mockCache.allBundles = [];
    mockCache.manifest = {
      version: '0.3',
      generatedAt: new Date().toISOString(),
      totalComponents: 0,
      components: {},
      graph: { roots: [], leaves: [] },
    };

    vi.mocked(readFileWithText).mockResolvedValue({ text: 'new component', path: 'src/NewComponent.tsx' });
    vi.mocked(fileHash).mockReturnValue('new-hash');

    vi.mocked(extractFromFile).mockResolvedValue({
      kind: 'react:component',
      exports: { named: ['NewComponent'] },
      components: [],
      functions: [],
      hooks: [],
      variables: [],
      imports: [],
      props: {},
      emits: {},
      state: {},
      jsxRoutes: [],
    });

    const newContract = createMockContract('src/NewComponent.tsx', 'new-hash');
    vi.mocked(buildContract).mockReturnValue({ contract: newContract, violations: [] });

    // New component becomes a root
    vi.mocked(buildDependencyGraph).mockReturnValue({
      version: '0.3',
      generatedAt: new Date().toISOString(),
      totalComponents: 1,
      components: {
        'src/NewComponent.tsx': {
          entryId: 'src/NewComponent.tsx',
          description: 'New component',
          dependencies: [],
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'semantic-new',
        },
      },
      graph: { roots: ['src/NewComponent.tsx'], leaves: ['src/NewComponent.tsx'] },
    });

    const newBundle = createMockBundle('src/NewComponent.tsx', 'bundleHash-new');
    vi.mocked(pack).mockResolvedValue(newBundle);

    const result = await incrementalRebuild(
      ['src/NewComponent.tsx'],
      mockCache,
      { out: '.', depth: 2 } as any,
      '/project'
    );

    // New root should have a bundle created
    expect(result.updatedBundles.has('src/NewComponent.tsx')).toBe(true);
    expect(pack).toHaveBeenCalledWith(
      'src/NewComponent.tsx',
      expect.any(Object),
      expect.any(Object),
      '/project'
    );
  });

  it('should sort bundles by entryId for deterministic output', async () => {
    // Set up cache with multiple bundles
    mockCache.allBundles = [
      createMockBundle('src/components/Zebra.tsx', 'hash-z'),
      createMockBundle('src/components/Apple.tsx', 'hash-a'),
      createMockBundle('src/App.tsx', 'hash-app'),
    ];
    mockCache.manifest = {
      version: '0.3',
      generatedAt: new Date().toISOString(),
      totalComponents: 3,
      components: {},
      graph: {
        roots: ['src/components/Zebra.tsx', 'src/components/Apple.tsx', 'src/App.tsx'],
        leaves: [],
      },
    };

    vi.mocked(buildDependencyGraph).mockReturnValue(mockCache.manifest);

    const result = await incrementalRebuild(
      [], // No changes, just verify sorting
      mockCache,
      { out: '.', depth: 2 } as any,
      '/project'
    );

    // Bundles should be sorted alphabetically
    expect(result.bundles[0].entryId).toBe('src/App.tsx');
    expect(result.bundles[1].entryId).toBe('src/components/Apple.tsx');
    expect(result.bundles[2].entryId).toBe('src/components/Zebra.tsx');
  });

  it('should deduplicate contracts by entryId', async () => {
    // Add duplicate contracts with different hashes
    // Note: deduplication keeps the contract with the alphabetically greater fileHash
    const contract1 = createMockContract('src/App.tsx', 'aaa-old-hash');
    const contract2 = createMockContract('src/App.tsx', 'zzz-new-hash');
    mockCache.contracts.set('aaa-old-hash', contract1);
    mockCache.contracts.set('zzz-new-hash', contract2);

    vi.mocked(buildDependencyGraph).mockReturnValue(mockCache.manifest!);

    await incrementalRebuild(
      [], // No changes, just verify deduplication
      mockCache,
      { out: '.', depth: 2 } as any,
      '/project'
    );

    // Should have only one contract per entryId (the one with greater hash alphabetically)
    const contractsForApp = Array.from(mockCache.contracts.values()).filter(
      c => c.entryId === 'src/App.tsx'
    );
    expect(contractsForApp.length).toBe(1);
    expect(contractsForApp[0].fileHash).toBe('zzz-new-hash');
  });
});
