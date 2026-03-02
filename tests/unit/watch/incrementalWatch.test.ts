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
  Project: class MockProject {
    addSourceFileAtPath = vi.fn().mockReturnValue({} as any); // Return mock SourceFile
  },
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
import { extractStyleMetadata } from '../../../src/extractors/styling/index.js';

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

  it('should revert to old bundle and restore contracts when pack fails', async () => {
    // Set up initial state with a contract that matches the bundle
    const oldContract = createMockContract('src/App.tsx', 'old-hash', 'old-semantic');
    mockCache.contracts.set('old-hash', oldContract);
    mockCache.allBundles = [{
      type: 'LogicStampBundle',
      schemaVersion: '0.1',
      entryId: 'src/App.tsx',
      depth: 2,
      createdAt: new Date().toISOString(),
      bundleHash: 'old-bundleHash',
      graph: {
        nodes: [{ entryId: 'src/App.tsx', contract: oldContract }],
        edges: [],
      },
      meta: { missing: [], source: 'test' },
    }];

    // Mock file read with new content (simulating file change)
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

    // Mock contract building - returns new contract
    const newContract = createMockContract('src/App.tsx', 'new-hash', 'new-semantic');
    vi.mocked(buildContract).mockReturnValue({ contract: newContract, violations: [] });

    // Mock manifest building
    vi.mocked(buildDependencyGraph).mockReturnValue({
      ...mockCache.manifest!,
      graph: { roots: ['src/App.tsx'], leaves: [] },
    });

    // Mock pack to FAIL - this is the key scenario
    vi.mocked(pack).mockRejectedValue(new Error('Pack failed'));

    const result = await incrementalRebuild(
      ['src/App.tsx'],
      mockCache,
      { out: '.', depth: 2 } as any,
      '/project'
    );

    // Should keep the old bundle
    expect(result.bundles.length).toBe(1);
    expect(result.bundles[0].bundleHash).toBe('old-bundleHash');

    // Cache contracts should be restored from old bundle (not the new contract)
    expect(mockCache.contracts.size).toBe(1);
    expect(mockCache.contracts.has('old-hash')).toBe(true);
    expect(mockCache.contracts.has('new-hash')).toBe(false);

    // The contract in cache should match the bundle's contract
    const cachedContract = mockCache.contracts.get('old-hash');
    expect(cachedContract?.semanticHash).toBe('old-semantic');

    // Reverse index should still have the old bundle mapping
    const appBundles = mockCache.componentToBundles.get('src/App.tsx');
    expect(appBundles).toBeDefined();
    expect(appBundles!.has('src/App.tsx')).toBe(true);
  });

  it('should maintain consistency when some packs succeed and others fail', async () => {
    // Set up cache with two bundles
    const appContract = createMockContract('src/App.tsx', 'app-hash', 'app-semantic');
    const cardContract = createMockContract('src/Card.tsx', 'card-hash', 'card-semantic');

    mockCache.contracts.set('app-hash', appContract);
    mockCache.contracts.set('card-hash', cardContract);
    mockCache.componentToBundles.set('src/App.tsx', new Set(['src/App.tsx']));
    mockCache.componentToBundles.set('src/Card.tsx', new Set(['src/Card.tsx']));

    mockCache.allBundles = [
      {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/App.tsx',
        depth: 2,
        createdAt: new Date().toISOString(),
        bundleHash: 'app-bundleHash',
        graph: {
          nodes: [{ entryId: 'src/App.tsx', contract: appContract }],
          edges: [],
        },
        meta: { missing: [], source: 'test' },
      },
      {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/Card.tsx',
        depth: 2,
        createdAt: new Date().toISOString(),
        bundleHash: 'card-bundleHash',
        graph: {
          nodes: [{ entryId: 'src/Card.tsx', contract: cardContract }],
          edges: [],
        },
        meta: { missing: [], source: 'test' },
      },
    ];

    mockCache.manifest = {
      version: '0.3',
      generatedAt: new Date().toISOString(),
      totalComponents: 2,
      components: {},
      graph: { roots: ['src/App.tsx', 'src/Card.tsx'], leaves: [] },
    };

    // Mock file reads for both files
    vi.mocked(readFileWithText).mockImplementation(async (path: string) => {
      return { text: 'new content', path };
    });
    vi.mocked(fileHash).mockReturnValue('new-hash');

    vi.mocked(extractFromFile).mockResolvedValue({
      kind: 'react:component',
      exports: { named: ['Component'] },
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

    // New contracts for both
    const newAppContract = createMockContract('src/App.tsx', 'new-app-hash', 'new-app-semantic');
    const newCardContract = createMockContract('src/Card.tsx', 'new-card-hash', 'new-card-semantic');

    vi.mocked(buildContract).mockImplementation((file: string) => {
      if (file.includes('App')) {
        return { contract: newAppContract, violations: [] };
      }
      return { contract: newCardContract, violations: [] };
    });

    vi.mocked(buildDependencyGraph).mockReturnValue({
      ...mockCache.manifest!,
      graph: { roots: ['src/App.tsx', 'src/Card.tsx'], leaves: [] },
    });

    // App succeeds, Card fails
    const newAppBundle = {
      type: 'LogicStampBundle' as const,
      schemaVersion: '0.1' as const,
      entryId: 'src/App.tsx',
      depth: 2,
      createdAt: new Date().toISOString(),
      bundleHash: 'new-app-bundleHash',
      graph: {
        nodes: [{ entryId: 'src/App.tsx', contract: newAppContract }],
        edges: [] as [string, string][],
      },
      meta: { missing: [] as any[], source: 'test' },
    };

    vi.mocked(pack).mockImplementation(async (bundleId: string) => {
      if (bundleId === 'src/App.tsx') {
        return newAppBundle;
      }
      throw new Error('Pack failed for Card');
    });

    const result = await incrementalRebuild(
      ['src/App.tsx', 'src/Card.tsx'],
      mockCache,
      { out: '.', depth: 2 } as any,
      '/project'
    );

    // Should have 2 bundles: new App, old Card
    expect(result.bundles.length).toBe(2);

    const appBundle = result.bundles.find(b => b.entryId === 'src/App.tsx');
    const cardBundle = result.bundles.find(b => b.entryId === 'src/Card.tsx');

    expect(appBundle?.bundleHash).toBe('new-app-bundleHash');
    expect(cardBundle?.bundleHash).toBe('card-bundleHash'); // Old bundle kept

    // Cache should have contracts from actual bundle contents
    // App has new contract, Card has old contract
    const appCachedContract = Array.from(mockCache.contracts.values()).find(
      c => c.entryId === 'src/App.tsx'
    );
    const cardCachedContract = Array.from(mockCache.contracts.values()).find(
      c => c.entryId === 'src/Card.tsx'
    );

    expect(appCachedContract?.fileHash).toBe('new-app-hash');
    expect(cardCachedContract?.fileHash).toBe('card-hash'); // Old hash preserved
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

  it('should sync contracts from bundle contents for consistency', async () => {
    // Add stale/duplicate contracts that don't match the bundle
    const contract1 = createMockContract('src/App.tsx', 'aaa-old-hash');
    const contract2 = createMockContract('src/App.tsx', 'zzz-new-hash');
    mockCache.contracts.set('aaa-old-hash', contract1);
    mockCache.contracts.set('zzz-new-hash', contract2);

    vi.mocked(buildDependencyGraph).mockReturnValue(mockCache.manifest!);

    await incrementalRebuild(
      [], // No changes
      mockCache,
      { out: '.', depth: 2 } as any,
      '/project'
    );

    // Contracts should be synced from actual bundle contents
    // The bundle has contract with 'fileHash-src/App.tsx' (from createMockBundle in beforeEach)
    const contractsForApp = Array.from(mockCache.contracts.values()).filter(
      c => c.entryId === 'src/App.tsx'
    );
    expect(contractsForApp.length).toBe(1);
    // Contract should match what's in the bundle, not the stale cache entries
    expect(contractsForApp[0].fileHash).toBe('fileHash-src/App.tsx');
  });

  describe('style cache handling', () => {
    it('should use cached style when available', async () => {
      const cachedStyle = {
        classes: ['btn', 'primary'],
        animations: [],
        colors: [],
        spacing: [],
      } as any;

      const existingContract = createMockContract('src/App.tsx', 'hash-100');
      mockCache.contracts.set('hash-100', existingContract);
      // Cache style for the NEW hash that will be used
      mockCache.styleCache.set('new-hash', cachedStyle);

      vi.mocked(readFileWithText).mockResolvedValue({ text: 'x'.repeat(100), path: 'src/App.tsx' });
      vi.mocked(fileHash).mockReturnValue('new-hash');

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

      const newContract = createMockContract('src/App.tsx', 'new-hash');
      vi.mocked(buildContract).mockReturnValue({ contract: newContract, violations: [] });

      vi.mocked(buildDependencyGraph).mockReturnValue(mockCache.manifest!);

      await incrementalRebuild(
        ['src/App.tsx'],
        mockCache,
        { out: '.', depth: 2, includeStyle: true } as any,
        '/project'
      );

      // Should use cached style, not call extractStyleMetadata
      expect(extractStyleMetadata).not.toHaveBeenCalled();
      // buildContract should be called with cached style
      expect(buildContract).toHaveBeenCalledWith(
        'src/App.tsx',
        expect.any(Object),
        expect.objectContaining({
          styleMetadata: cachedStyle,
        })
      );
    });

    it('should extract and cache style when not in cache', async () => {
      const existingContract = createMockContract('src/App.tsx', 'old-hash');
      mockCache.contracts.set('old-hash', existingContract);
      // No cached style

      vi.mocked(readFileWithText).mockResolvedValue({ text: 'new content', path: 'src/App.tsx' });
      vi.mocked(fileHash).mockReturnValue('new-hash');

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

      const extractedStyle = {
        classes: ['btn'],
        animations: [],
        colors: [],
        spacing: [],
      } as any;

      vi.mocked(extractStyleMetadata).mockResolvedValue(extractedStyle);

      const newContract = createMockContract('src/App.tsx', 'new-hash');
      vi.mocked(buildContract).mockReturnValue({ contract: newContract, violations: [] });

      vi.mocked(buildDependencyGraph).mockReturnValue(mockCache.manifest!);

      const newBundle = createMockBundle('src/App.tsx', 'new-bundleHash');
      vi.mocked(pack).mockResolvedValue(newBundle);

      await incrementalRebuild(
        ['src/App.tsx'],
        mockCache,
        { out: '.', depth: 2, includeStyle: true } as any,
        '/project'
      );

      // Should call extractStyleMetadata
      expect(extractStyleMetadata).toHaveBeenCalled();
      // Should cache the extracted style
      expect(mockCache.styleCache.get('new-hash')).toEqual(extractedStyle);
    });

    it('should handle style extraction errors gracefully', async () => {
      const existingContract = createMockContract('src/App.tsx', 'old-hash');
      mockCache.contracts.set('old-hash', existingContract);

      vi.mocked(readFileWithText).mockResolvedValue({ text: 'new content', path: 'src/App.tsx' });
      vi.mocked(fileHash).mockReturnValue('new-hash');

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

      vi.mocked(extractStyleMetadata).mockRejectedValue(new Error('Style extraction failed'));

      const newContract = createMockContract('src/App.tsx', 'new-hash');
      vi.mocked(buildContract).mockReturnValue({ contract: newContract, violations: [] });

      vi.mocked(buildDependencyGraph).mockReturnValue(mockCache.manifest!);

      const newBundle = createMockBundle('src/App.tsx', 'new-bundleHash');
      vi.mocked(pack).mockResolvedValue(newBundle);

      // Should not throw, should continue without style
      await expect(
        incrementalRebuild(
          ['src/App.tsx'],
          mockCache,
          { out: '.', depth: 2, includeStyle: true } as any,
          '/project'
        )
      ).resolves.not.toThrow();

      // Should call buildContract without styleMetadata
      expect(buildContract).toHaveBeenCalledWith(
        'src/App.tsx',
        expect.any(Object),
        expect.objectContaining({
          styleMetadata: undefined,
        })
      );
    });
  });

  describe('componentToBundles index handling', () => {
    it('should create new Set when entryId does not exist in componentToBundles', async () => {
      // Set up a scenario where pack fails and we need to restore reverse index
      const oldContract = createMockContract('src/App.tsx', 'old-hash', 'old-semantic');
      mockCache.contracts.set('old-hash', oldContract);
      mockCache.allBundles = [{
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/App.tsx',
        depth: 2,
        createdAt: new Date().toISOString(),
        bundleHash: 'old-bundleHash',
        graph: {
          nodes: [{ entryId: 'src/App.tsx', contract: oldContract }],
          edges: [],
        },
        meta: { missing: [], source: 'test' },
      }];

      // Ensure entryId does NOT exist in componentToBundles
      mockCache.componentToBundles.clear();

      vi.mocked(readFileWithText).mockResolvedValue({ text: 'new content', path: 'src/App.tsx' });
      vi.mocked(fileHash).mockReturnValue('new-hash');

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

      const newContract = createMockContract('src/App.tsx', 'new-hash', 'new-semantic');
      vi.mocked(buildContract).mockReturnValue({ contract: newContract, violations: [] });

      vi.mocked(buildDependencyGraph).mockReturnValue({
        ...mockCache.manifest!,
        graph: { roots: ['src/App.tsx'], leaves: [] },
      });

      // Mock pack to FAIL
      vi.mocked(pack).mockRejectedValue(new Error('Pack failed'));

      await incrementalRebuild(
        ['src/App.tsx'],
        mockCache,
        { out: '.', depth: 2 } as any,
        '/project'
      );

      // After pack failure, should restore reverse index
      // The entryId should now exist in componentToBundles (created if it didn't exist)
      const appBundles = mockCache.componentToBundles.get('src/App.tsx');
      expect(appBundles).toBeDefined();
      expect(appBundles).toBeInstanceOf(Set);
      expect(appBundles!.has('src/App.tsx')).toBe(true);
    });

    it('should add to existing Set when entryId already exists in componentToBundles', async () => {
      // Set up scenario where entryId already exists
      const oldContract = createMockContract('src/App.tsx', 'old-hash', 'old-semantic');
      mockCache.contracts.set('old-hash', oldContract);
      
      // EntryId already exists with one bundle
      const existingSet = new Set(['src/OtherBundle.tsx']);
      mockCache.componentToBundles.set('src/App.tsx', existingSet);

      mockCache.allBundles = [{
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/App.tsx',
        depth: 2,
        createdAt: new Date().toISOString(),
        bundleHash: 'old-bundleHash',
        graph: {
          nodes: [{ entryId: 'src/App.tsx', contract: oldContract }],
          edges: [],
        },
        meta: { missing: [], source: 'test' },
      }];

      vi.mocked(readFileWithText).mockResolvedValue({ text: 'new content', path: 'src/App.tsx' });
      vi.mocked(fileHash).mockReturnValue('new-hash');

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

      const newContract = createMockContract('src/App.tsx', 'new-hash', 'new-semantic');
      vi.mocked(buildContract).mockReturnValue({ contract: newContract, violations: [] });

      vi.mocked(buildDependencyGraph).mockReturnValue({
        ...mockCache.manifest!,
        graph: { roots: ['src/App.tsx'], leaves: [] },
      });

      // Mock pack to FAIL
      vi.mocked(pack).mockRejectedValue(new Error('Pack failed'));

      await incrementalRebuild(
        ['src/App.tsx'],
        mockCache,
        { out: '.', depth: 2 } as any,
        '/project'
      );

      // Should use existing Set, not create a new one
      const appBundles = mockCache.componentToBundles.get('src/App.tsx');
      expect(appBundles).toBe(existingSet); // Same Set instance
      expect(appBundles!.has('src/App.tsx')).toBe(true);
      expect(appBundles!.has('src/OtherBundle.tsx')).toBe(true);
    });
  });
});
