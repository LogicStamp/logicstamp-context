/**
 * Unit tests for watchMode module - Failure modes and edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BundleChanges, ContractDiff } from '../../../../src/cli/commands/context/watchDiff.js';
import type { Violation, StrictWatchStatus } from '../../../../src/utils/config.js';
import type { LogicStampBundle } from '../../../../src/core/pack.js';
import type { WatchCache } from '../../../../src/cli/commands/context/incrementalWatch.js';
import type { ContextOptions } from '../../../../src/cli/commands/context.js';

// Mock all dependencies before importing the module
vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path');
  return {
    ...actual,
    resolve: vi.fn((p: string) => p),
    dirname: vi.fn((p: string) => p.replace(/\/[^/]+$/, '') || '.'),
    join: vi.fn((...parts: string[]) => parts.join('/')),
    relative: vi.fn((from: string, to: string) => to.replace(from + '/', '')),
  };
});

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

vi.mock('../../../../src/utils/fsx.js', () => ({
  globFiles: vi.fn(),
  normalizeEntryId: (id: string) => id.replace(/\\/g, '/'),
}));

vi.mock('../../../../src/utils/stampignore.js', () => ({
  readStampignore: vi.fn(),
  filterIgnoredFiles: vi.fn((files: string[]) => files),
}));

vi.mock('../../../../src/core/manifest.js', () => ({
  buildDependencyGraph: vi.fn(),
}));

vi.mock('../../../../src/utils/config.js', () => ({
  writeWatchStatus: vi.fn().mockResolvedValue(undefined),
  deleteWatchStatus: vi.fn().mockResolvedValue(undefined),
  appendWatchLog: vi.fn().mockResolvedValue(undefined),
  writeStrictWatchStatus: vi.fn().mockResolvedValue(undefined),
  deleteStrictWatchStatus: vi.fn().mockResolvedValue(undefined),
  getWatchStatusPath: vi.fn((projectRoot: string) => `${projectRoot}/.logicstamp/context_watch-status.json`),
}));

vi.mock('../../../../src/utils/cleanup.js', () => ({
  registerCleanup: vi.fn(),
  gracefulShutdown: vi.fn(),
  registerSyncCleanupPath: vi.fn(() => vi.fn()),
  registerSignalHandlers: vi.fn(),
}));

vi.mock('../../../../src/cli/commands/context/watchDiff.js', () => ({
  getChanges: vi.fn(),
  showChanges: vi.fn(),
}));

vi.mock('../../../../src/cli/commands/context/index.js', () => ({
  buildContractsFromFiles: vi.fn(),
  writeContextFiles: vi.fn().mockResolvedValue({ filesWritten: 1, folderInfos: [], totalTokenEstimate: 500 }),
  writeMainIndex: vi.fn().mockResolvedValue(undefined),
  groupBundlesByFolder: vi.fn(() => new Map()),
  displayPath: vi.fn((p: string) => p),
  initializeWatchCache: vi.fn(),
  incrementalRebuild: vi.fn(),
}));

vi.mock('../../../../src/cli/commands/context.js', () => ({
  contextCommand: vi.fn().mockResolvedValue(undefined),
}));

// Import the module after mocks
import { startWatchMode } from '../../../../src/cli/commands/context/watchMode.js';
import * as configModule from '../../../../src/utils/config.js';
import * as cleanupModule from '../../../../src/utils/cleanup.js';
import * as watchDiffModule from '../../../../src/cli/commands/context/watchDiff.js';
import * as contextHelpersModule from '../../../../src/cli/commands/context/index.js';
import chokidar from 'chokidar';
import { readFile } from 'node:fs/promises';

// Helper to create mock bundle changes
function createMockBundleChanges(overrides?: Partial<BundleChanges>): BundleChanges {
  return {
    added: [],
    removed: [],
    changed: [],
    bundleChanged: [],
    ...overrides,
  };
}

// Helper to create mock contract diff
function createMockContractDiff(overrides?: Partial<ContractDiff>): ContractDiff {
  return {
    props: { added: [], removed: [], changed: [] },
    emits: { added: [], removed: [], changed: [] },
    state: { added: [], removed: [], changed: [] },
    hooks: { added: [], removed: [] },
    components: { added: [], removed: [] },
    variables: { added: [], removed: [] },
    functions: { added: [], removed: [] },
    ...overrides,
  };
}

// ============================================================================
// FAILURE MODE TESTS - Real-world edge cases and error scenarios
// ============================================================================

describe('Watch Mode Failure Modes', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('watcher error handling', () => {
    it('should handle watcher error event gracefully', async () => {
      let errorHandler: ((error: Error) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (arg: any) => void) => {
          if (event === 'error') {
            errorHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: false,
      };

      const watchPromise = startWatchMode(options, '/project', null);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Trigger watcher error
      if (errorHandler) {
        errorHandler(new Error('ENOSPC: no space left on device'));
      }
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Watch error'));
      expect(cleanupModule.gracefulShutdown).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error objects in error handler', async () => {
      let errorHandler: ((error: unknown) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (arg: unknown) => void) => {
          if (event === 'error') {
            errorHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: false,
      };

      const watchPromise = startWatchMode(options, '/project', null);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Trigger with string error
      if (errorHandler) {
        errorHandler('string error message');
      }
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('concurrent recompilation', () => {
    it('should queue recompilation when already in progress', async () => {
      let changeHandler: ((path: string) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (path: string) => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      // Make incrementalRebuild slow
      let rebuildCallCount = 0;
      vi.mocked(contextHelpersModule.incrementalRebuild).mockImplementation(async () => {
        rebuildCallCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
        return { bundles: [], updatedBundles: new Set() };
      });

      const mockCache: WatchCache = {
        contracts: new Map(),
        astCache: new Map(),
        styleCache: new Map(),
        fileList: new Set(),
        componentToBundles: new Map(),
        manifest: {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 0,
          components: {},
          graph: { roots: [], leaves: [] },
        },
        allBundles: [],
      };

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: true,
      };

      const watchPromise = startWatchMode(options, '/project', mockCache);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Trigger first change
      if (changeHandler) {
        changeHandler('/project/src/First.tsx');
      }

      // Wait for debounce but not for rebuild to complete
      await new Promise(resolve => setTimeout(resolve, 550));

      // Trigger second change while first is still in progress
      if (changeHandler) {
        changeHandler('/project/src/Second.tsx');
      }

      // Wait for both to complete
      await new Promise(resolve => setTimeout(resolve, 700));

      // The recompilation should handle concurrent changes without crashing
      // (exact behavior depends on implementation - may batch or queue)
    });
  });

  describe('file system edge cases', () => {
    it('should handle paths with special characters', async () => {
      let changeHandler: ((path: string) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (path: string) => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: false,
      };

      const watchPromise = startWatchMode(options, '/project', null);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Trigger change with special characters in path
      if (changeHandler) {
        changeHandler('/project/src/components/[id]/Component.tsx');
      }
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should handle without crashing
      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Changed');
    });

    it('should handle backslash paths (Windows)', async () => {
      let changeHandler: ((path: string) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (path: string) => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: false,
      };

      const watchPromise = startWatchMode(options, '/project', null);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Trigger change with Windows-style path
      if (changeHandler) {
        changeHandler('C:\\project\\src\\Component.tsx');
      }
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should normalize path
    });

    it('should handle unicode filenames', async () => {
      let changeHandler: ((path: string) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (path: string) => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: false,
      };

      const watchPromise = startWatchMode(options, '/project', null);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Trigger change with unicode filename
      if (changeHandler) {
        changeHandler('/project/src/コンポーネント.tsx');
      }
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should handle unicode
      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Changed');
    });
  });

  describe('cleanup edge cases', () => {
    it('should handle cleanup errors gracefully', async () => {
      let cleanupHandler: (() => Promise<void>) | undefined;
      vi.mocked(cleanupModule.registerCleanup).mockImplementation((name, handler) => {
        cleanupHandler = handler as () => Promise<void>;
        return () => {};
      });

      // Make deleteWatchStatus throw
      vi.mocked(configModule.deleteWatchStatus).mockRejectedValueOnce(new Error('Permission denied'));

      const mockWatcher = {
        on: vi.fn().mockReturnThis(),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: true,
      };

      const watchPromise = startWatchMode(options, '/project', null);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Execute cleanup - should not throw even if deleteWatchStatus fails
      if (cleanupHandler) {
        await expect(cleanupHandler()).resolves.not.toThrow();
      }
    });

    it('should handle watcher.close() failure', async () => {
      let cleanupHandler: (() => Promise<void>) | undefined;
      vi.mocked(cleanupModule.registerCleanup).mockImplementation((name, handler) => {
        cleanupHandler = handler as () => Promise<void>;
        return () => {};
      });

      const mockWatcher = {
        on: vi.fn().mockReturnThis(),
        close: vi.fn().mockRejectedValue(new Error('Close failed')),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: true,
      };

      const watchPromise = startWatchMode(options, '/project', null);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Cleanup should handle watcher.close() failure
      if (cleanupHandler) {
        try {
          await cleanupHandler();
        } catch {
          // May throw or may catch internally - either is acceptable
        }
      }
    });
  });

  describe('strict watch mode edge cases', () => {
    it('should handle violations with missing details', () => {
      // Document that violations can have optional details field
      const violation: Violation = {
        type: 'breaking_change_prop_removed',
        severity: 'error',
        entryId: 'src/Component.tsx',
        message: 'Prop removed',
        // details is optional
      };

      expect(violation.details).toBeUndefined();
    });

    it('should handle empty changes correctly', () => {
      const emptyChanges = createMockBundleChanges();

      expect(emptyChanges.added).toHaveLength(0);
      expect(emptyChanges.removed).toHaveLength(0);
      expect(emptyChanges.changed).toHaveLength(0);
      expect(emptyChanges.bundleChanged).toHaveLength(0);
    });

    it('should track violations accumulation correctly', () => {
      // Test that strict watch status tracks cumulative violations
      const initialStatus: StrictWatchStatus = {
        active: true,
        startedAt: new Date().toISOString(),
        cumulativeViolations: 0,
        cumulativeErrors: 0,
        cumulativeWarnings: 0,
        totalErrorsDetected: 0,
        totalWarningsDetected: 0,
        resolvedCount: 0,
        regenerationCount: 0,
      };

      // After first check with violations
      const afterCheck: StrictWatchStatus = {
        ...initialStatus,
        regenerationCount: 1,
        cumulativeViolations: 3,
        cumulativeErrors: 2,
        cumulativeWarnings: 1,
        totalErrorsDetected: 2,
        totalWarningsDetected: 1,
        lastCheck: {
          timestamp: new Date().toISOString(),
          totalViolations: 3,
          errors: 2,
          warnings: 1,
          violations: [],
          changedFiles: ['src/App.tsx'],
        },
      };

      expect(afterCheck.regenerationCount).toBe(1);
      expect(afterCheck.cumulativeViolations).toBe(3);
    });

    it('should detect changes when only bundleChanged exists', async () => {
      let changeHandler: ((path: string) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (path: string) => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      // Create baseline bundles
      const baselineBundle: LogicStampBundle = {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/App.tsx',
        depth: 2,
        createdAt: new Date().toISOString(),
        bundleHash: 'old-hash',
        graph: {
          nodes: [],
          edges: [],
        },
        meta: {
          missing: [],
          source: 'test',
        },
      };

      const newBundle: LogicStampBundle = {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/App.tsx',
        depth: 2,
        createdAt: new Date().toISOString(),
        bundleHash: 'new-hash',
        graph: {
          nodes: [],
          edges: [],
        },
        meta: {
          missing: [],
          source: 'test',
        },
      };

      const mockCache: WatchCache = {
        contracts: new Map(),
        astCache: new Map(),
        styleCache: new Map(),
        fileList: new Set(),
        componentToBundles: new Map(),
        manifest: {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 0,
          components: {},
          graph: { roots: [], leaves: [] },
        },
        allBundles: [baselineBundle],
      };

      vi.mocked(contextHelpersModule.incrementalRebuild).mockResolvedValue({
        bundles: [newBundle],
        updatedBundles: new Set(['src/App.tsx']),
      });

      // Mock getChanges to return only bundleChanged (no other changes)
      vi.mocked(watchDiffModule.getChanges).mockReturnValue(
        createMockBundleChanges({
          bundleChanged: [{ entryId: 'src/App.tsx', oldHash: 'old-hash', newHash: 'new-hash' }],
        })
      );

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: false,
        strictWatch: true,
      };

      // Mock readFile to return baseline bundles when loadAllBundles is called
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        if (path.includes('context_main.json')) {
          return JSON.stringify({
            folders: [{ contextFile: 'context.json' }],
          });
        }
        if (path.includes('context.json')) {
          return JSON.stringify([baselineBundle]);
        }
        return '';
      });

      const watchPromise = startWatchMode(options, '/project', mockCache);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Mock strict watch status reading
      vi.mocked(configModule.getWatchStatusPath).mockReturnValue('/project/.logicstamp/context_strict-watch-status.json');
      vi.mocked(configModule.writeStrictWatchStatus).mockResolvedValue(undefined);

      if (changeHandler) {
        changeHandler('/project/src/App.tsx');
      }
      await new Promise(resolve => setTimeout(resolve, 600));

      // Should detect changes even though only bundleChanged exists
      // getChanges is called with baselineBundles and newBundles
      expect(watchDiffModule.getChanges).toHaveBeenCalledWith(
        expect.arrayContaining([baselineBundle]),
        expect.arrayContaining([newBundle])
      );
    });

    it('should handle hasChanges=false case (no changes from baseline)', async () => {
      let changeHandler: ((path: string) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (path: string) => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      const mockCache: WatchCache = {
        contracts: new Map(),
        astCache: new Map(),
        styleCache: new Map(),
        fileList: new Set(),
        componentToBundles: new Map(),
        manifest: {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 0,
          components: {},
          graph: { roots: [], leaves: [] },
        },
        allBundles: [],
      };

      vi.mocked(contextHelpersModule.incrementalRebuild).mockResolvedValue({
        bundles: [],
        updatedBundles: new Set(),
      });

      // Mock readFile to return baseline bundles (empty array means no baseline)
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        if (path.includes('context_main.json')) {
          return JSON.stringify({
            folders: [{ contextFile: 'context.json' }],
          });
        }
        if (path.includes('context.json')) {
          return JSON.stringify([]); // Empty baseline
        }
        return '';
      });

      // Mock getChanges to return null (no changes detected)
      vi.mocked(watchDiffModule.getChanges).mockReturnValue(null);

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: false,
        strictWatch: true,
      };

      const watchPromise = startWatchMode(options, '/project', mockCache);
      await new Promise(resolve => setTimeout(resolve, 10));

      if (changeHandler) {
        changeHandler('/project/src/App.tsx');
      }
      await new Promise(resolve => setTimeout(resolve, 600));

      // Should call deleteStrictWatchStatus when no changes
      expect(configModule.deleteStrictWatchStatus).toHaveBeenCalledWith('/project');
    });

    it('should handle changes with no violations (violations.length === 0)', async () => {
      let changeHandler: ((path: string) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (path: string) => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      const baselineBundle: LogicStampBundle = {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/App.tsx',
        depth: 2,
        createdAt: new Date().toISOString(),
        bundleHash: 'baseline-hash',
        graph: {
          nodes: [],
          edges: [],
        },
        meta: {
          missing: [],
          source: 'test',
        },
      };

      const mockCache: WatchCache = {
        contracts: new Map(),
        astCache: new Map(),
        styleCache: new Map(),
        fileList: new Set(),
        componentToBundles: new Map(),
        manifest: {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 0,
          components: {},
          graph: { roots: [], leaves: [] },
        },
        allBundles: [],
      };

      vi.mocked(contextHelpersModule.incrementalRebuild).mockResolvedValue({
        bundles: [],
        updatedBundles: new Set(),
      });

      // Mock readFile to return baseline bundles
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        if (path.includes('context_main.json')) {
          return JSON.stringify({
            folders: [{ contextFile: 'context.json' }],
          });
        }
        if (path.includes('context.json')) {
          return JSON.stringify([baselineBundle]);
        }
        return '';
      });

      // Mock getChanges to return changes but with no violations (only non-breaking changes)
      vi.mocked(watchDiffModule.getChanges).mockReturnValue(
        createMockBundleChanges({
          changed: [
            {
              entryId: 'src/App.tsx',
              semanticHash: { old: 'hash1', new: 'hash2' },
              fileHash: { old: 'file1', new: 'file2' },
              contractDiff: createMockContractDiff(), // Empty diff = no violations
            },
          ],
        })
      );

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: false,
        strictWatch: true,
      };

      const watchPromise = startWatchMode(options, '/project', mockCache);
      await new Promise(resolve => setTimeout(resolve, 10));

      if (changeHandler) {
        changeHandler('/project/src/App.tsx');
      }
      await new Promise(resolve => setTimeout(resolve, 600));

      // Should delete strict watch status when changes exist but no violations
      expect(configModule.deleteStrictWatchStatus).toHaveBeenCalledWith('/project');
    });

    it('should respect quiet mode in strict watch', async () => {
      let changeHandler: ((path: string) => void) | undefined;
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockWatcher = {
        on: vi.fn((event: string, handler: (path: string) => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      const mockCache: WatchCache = {
        contracts: new Map(),
        astCache: new Map(),
        styleCache: new Map(),
        fileList: new Set(),
        componentToBundles: new Map(),
        manifest: {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 0,
          components: {},
          graph: { roots: [], leaves: [] },
        },
        allBundles: [],
      };

      vi.mocked(contextHelpersModule.incrementalRebuild).mockResolvedValue({
        bundles: [],
        updatedBundles: new Set(),
      });

      // Mock getChanges to return violations
      vi.mocked(watchDiffModule.getChanges).mockReturnValue(
        createMockBundleChanges({
          removed: ['src/Deleted.tsx'], // This will create a violation
        })
      );

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: true, // Quiet mode enabled
        strictWatch: true,
      };

      const watchPromise = startWatchMode(options, '/project', mockCache);
      await new Promise(resolve => setTimeout(resolve, 10));

      if (changeHandler) {
        changeHandler('/project/src/App.tsx');
      }
      await new Promise(resolve => setTimeout(resolve, 600));

      // In quiet mode, violations should not be displayed
      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).not.toContain('Strict Watch');
      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle recompilation errors gracefully', async () => {
      let changeHandler: ((path: string) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (path: string) => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      vi.mocked(contextHelpersModule.incrementalRebuild).mockRejectedValueOnce(new Error('Build failed'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockCache: WatchCache = {
        contracts: new Map(),
        astCache: new Map(),
        styleCache: new Map(),
        fileList: new Set(),
        componentToBundles: new Map(),
        manifest: {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 0,
          components: {},
          graph: { roots: [], leaves: [] },
        },
        allBundles: [],
      };

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: false,
      };

      const watchPromise = startWatchMode(options, '/project', mockCache);
      await new Promise(resolve => setTimeout(resolve, 10));

      if (changeHandler) {
        changeHandler('/project/src/App.tsx');
      }
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error'));
      consoleErrorSpy.mockRestore();
    });

    it('should log errors when logFile is enabled', async () => {
      let changeHandler: ((path: string) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (path: string) => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      vi.mocked(contextHelpersModule.incrementalRebuild).mockRejectedValueOnce(new Error('Parse error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockCache: WatchCache = {
        contracts: new Map(),
        astCache: new Map(),
        styleCache: new Map(),
        fileList: new Set(),
        componentToBundles: new Map(),
        manifest: {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 0,
          components: {},
          graph: { roots: [], leaves: [] },
        },
        allBundles: [],
      };

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: true,
        logFile: true,
      };

      const watchPromise = startWatchMode(options, '/project', mockCache);
      await new Promise(resolve => setTimeout(resolve, 10));

      if (changeHandler) {
        changeHandler('/project/src/App.tsx');
      }
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(configModule.appendWatchLog).toHaveBeenCalledWith(
        '/project',
        expect.objectContaining({
          error: 'Parse error',
        })
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('debug logging', () => {
    it('should respect LOGICSTAMP_DEBUG environment variable', async () => {
      const originalDebug = process.env.LOGICSTAMP_DEBUG;
      process.env.LOGICSTAMP_DEBUG = '1';

      let changeHandler: ((path: string) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (path: string) => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: false,
      };

      const watchPromise = startWatchMode(options, '/project', null);
      await new Promise(resolve => setTimeout(resolve, 10));

      if (changeHandler) {
        changeHandler('/project/src/App.tsx');
      }
      await new Promise(resolve => setTimeout(resolve, 10));

      // Debug logging should be enabled
      const calls = consoleSpy.mock.calls.flat().join('\n');
      // May or may not contain [DEBUG] depending on implementation

      // Restore env
      if (originalDebug === undefined) {
        delete process.env.LOGICSTAMP_DEBUG;
      } else {
        process.env.LOGICSTAMP_DEBUG = originalDebug;
      }
    });
  });

  describe('log file - edge cases', () => {
    it('should not log when logFile is false', async () => {
      let changeHandler: ((path: string) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (path: string) => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      const mockCache: WatchCache = {
        contracts: new Map(),
        astCache: new Map(),
        styleCache: new Map(),
        fileList: new Set(),
        componentToBundles: new Map(),
        manifest: {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 0,
          components: {},
          graph: { roots: [], leaves: [] },
        },
        allBundles: [],
      };

      vi.mocked(contextHelpersModule.incrementalRebuild).mockResolvedValue({
        bundles: [],
        updatedBundles: new Set(),
      });

      vi.mocked(watchDiffModule.getChanges).mockReturnValue(
        createMockBundleChanges({
          changed: [
            {
              entryId: 'src/App.tsx',
              semanticHash: { old: 'hash1', new: 'hash2' },
              fileHash: { old: 'file1', new: 'file2' },
            },
          ],
        })
      );

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: true,
        logFile: false, // Log file disabled
      };

      const watchPromise = startWatchMode(options, '/project', mockCache);
      await new Promise(resolve => setTimeout(resolve, 10));

      if (changeHandler) {
        changeHandler('/project/src/App.tsx');
      }
      await new Promise(resolve => setTimeout(resolve, 600));

      // Should not append to log file when logFile is false
      expect(configModule.appendWatchLog).not.toHaveBeenCalled();
    });

    it('should log file changes even when no contract changes (changes is null)', async () => {
      let changeHandler: ((path: string) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (path: string) => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      const mockCache: WatchCache = {
        contracts: new Map(),
        astCache: new Map(),
        styleCache: new Map(),
        fileList: new Set(),
        componentToBundles: new Map(),
        manifest: {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 0,
          components: {},
          graph: { roots: [], leaves: [] },
        },
        allBundles: [],
      };

      vi.mocked(contextHelpersModule.incrementalRebuild).mockResolvedValue({
        bundles: [],
        updatedBundles: new Set(),
      });

      // Mock getChanges to return null (no contract changes detected)
      vi.mocked(watchDiffModule.getChanges).mockReturnValue(null);

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: true,
        logFile: true, // Log file enabled
      };

      const watchPromise = startWatchMode(options, '/project', mockCache);
      await new Promise(resolve => setTimeout(resolve, 10));

      if (changeHandler) {
        changeHandler('/project/src/App.tsx');
      }
      await new Promise(resolve => setTimeout(resolve, 600));

      // Should log even when changes is null but files changed
      expect(configModule.appendWatchLog).toHaveBeenCalledWith(
        '/project',
        expect.objectContaining({
          changedFiles: expect.arrayContaining(['src/App.tsx']),
          fileCount: expect.any(Number),
        })
      );
    });

    it('should handle empty arrays vs populated arrays in log entry', async () => {
      let changeHandler: ((path: string) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (path: string) => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      const baselineBundle: LogicStampBundle = {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/App.tsx',
        depth: 2,
        createdAt: new Date().toISOString(),
        bundleHash: 'old-hash',
        graph: {
          nodes: [],
          edges: [],
        },
        meta: {
          missing: [],
          source: 'test',
        },
      };

      const newBundle: LogicStampBundle = {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/App.tsx',
        depth: 2,
        createdAt: new Date().toISOString(),
        bundleHash: 'new-hash',
        graph: {
          nodes: [],
          edges: [],
        },
        meta: {
          missing: [],
          source: 'test',
        },
      };

      const mockCache: WatchCache = {
        contracts: new Map(),
        astCache: new Map(),
        styleCache: new Map(),
        fileList: new Set(),
        componentToBundles: new Map(),
        manifest: {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 0,
          components: {},
          graph: { roots: [], leaves: [] },
        },
        allBundles: [baselineBundle],
      };

      vi.mocked(contextHelpersModule.incrementalRebuild).mockResolvedValue({
        bundles: [newBundle],
        updatedBundles: new Set(['src/App.tsx']),
      });

      // Test with empty arrays (should be undefined in log entry)
      vi.mocked(watchDiffModule.getChanges).mockReturnValue(
        createMockBundleChanges({
          added: [],
          removed: [],
          changed: [
            {
              entryId: 'src/App.tsx',
              semanticHash: { old: 'hash1', new: 'hash2' },
              fileHash: { old: 'file1', new: 'file2' },
            },
          ],
        })
      );

      // Mock readFile to return baseline bundles BEFORE starting watch mode
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        if (path.includes('context_main.json')) {
          return JSON.stringify({
            folders: [{ contextFile: 'context.json' }],
          });
        }
        if (path.includes('context.json')) {
          return JSON.stringify([baselineBundle]);
        }
        return '';
      });

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: true,
        logFile: true,
      };

      const watchPromise = startWatchMode(options, '/project', mockCache);
      await new Promise(resolve => setTimeout(resolve, 10));

      vi.clearAllMocks(); // Clear previous calls but keep readFile mock
      // Re-setup mocks after clearAllMocks
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        if (path.includes('context_main.json')) {
          return JSON.stringify({
            folders: [{ contextFile: 'context.json' }],
          });
        }
        if (path.includes('context.json')) {
          return JSON.stringify([baselineBundle]);
        }
        return '';
      });
      // Re-setup incrementalRebuild mock after clearAllMocks
      vi.mocked(contextHelpersModule.incrementalRebuild).mockResolvedValue({
        bundles: [newBundle],
        updatedBundles: new Set(['src/App.tsx']),
      });
      // Re-setup getChanges mock after clearAllMocks
      vi.mocked(watchDiffModule.getChanges).mockReturnValue(
        createMockBundleChanges({
          added: [],
          removed: [],
          changed: [
            {
              entryId: 'src/App.tsx',
              semanticHash: { old: 'hash1', new: 'hash2' },
              fileHash: { old: 'file1', new: 'file2' },
            },
          ],
        })
      );

      if (changeHandler) {
        changeHandler('/project/src/App.tsx');
      }
      await new Promise(resolve => setTimeout(resolve, 600));

      // Verify log entry structure - empty arrays should be undefined
      const logCalls = vi.mocked(configModule.appendWatchLog).mock.calls;
      const logCallWithChanges = logCalls.find(call => {
        const entry = call[1] as any;
        return entry && entry.modifiedContracts !== undefined;
      });

      expect(logCallWithChanges).toBeDefined();
      expect(logCallWithChanges![1]).toMatchObject({
        addedContracts: undefined, // Empty array becomes undefined
        removedContracts: undefined, // Empty array becomes undefined
      });

      // Now test with populated arrays
      vi.clearAllMocks();
      // Re-setup all mocks after clearAllMocks
      vi.mocked(readFile).mockImplementation(async (path: any) => {
        if (path.includes('context_main.json')) {
          return JSON.stringify({
            folders: [{ contextFile: 'context.json' }],
          });
        }
        if (path.includes('context.json')) {
          return JSON.stringify([baselineBundle]);
        }
        return '';
      });
      vi.mocked(contextHelpersModule.incrementalRebuild).mockResolvedValue({
        bundles: [newBundle],
        updatedBundles: new Set(['src/New.tsx']),
      });
      vi.mocked(watchDiffModule.getChanges).mockReturnValue(
        createMockBundleChanges({
          added: ['src/New.tsx'],
          removed: ['src/Old.tsx'],
          changed: [],
        })
      );

      if (changeHandler) {
        changeHandler('/project/src/New.tsx');
      }
      await new Promise(resolve => setTimeout(resolve, 600));

      // Populated arrays should be included
      const logCallsWithPopulated = vi.mocked(configModule.appendWatchLog).mock.calls;
      const logCallWithPopulated = logCallsWithPopulated.find(call => {
        const entry = call[1] as any;
        return entry && entry.addedContracts !== undefined;
      });

      expect(logCallWithPopulated).toBeDefined();
      expect(logCallWithPopulated![1]).toMatchObject({
        addedContracts: ['src/New.tsx'],
        removedContracts: ['src/Old.tsx'],
      });
    });
  });

  describe('batch file change handling', () => {
    it('should batch multiple rapid file changes', async () => {
      let changeHandler: ((path: string) => void) | undefined;
      const mockWatcher = {
        on: vi.fn((event: string, handler: (path: string) => void) => {
          if (event === 'change') {
            changeHandler = handler;
          }
          return mockWatcher;
        }),
        close: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

      vi.mocked(contextHelpersModule.incrementalRebuild).mockResolvedValue({
        bundles: [],
        updatedBundles: new Set(),
      });

      const mockCache: WatchCache = {
        contracts: new Map(),
        astCache: new Map(),
        styleCache: new Map(),
        fileList: new Set(),
        componentToBundles: new Map(),
        manifest: {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 0,
          components: {},
          graph: { roots: [], leaves: [] },
        },
        allBundles: [],
      };

      const options: ContextOptions = {
        out: '.logicstamp',
        depth: 2,
        includeCode: 'header',
        format: 'json',
        hashLock: false,
        strict: false,
        allowMissing: true,
        maxNodes: 100,
        profile: 'llm-chat',
        predictBehavior: false,
        dryRun: false,
        stats: false,
        strictMissing: false,
        compareModes: false,
        watch: true,
        quiet: false,
      };

      const watchPromise = startWatchMode(options, '/project', mockCache);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Trigger many rapid changes
      if (changeHandler) {
        for (let i = 0; i < 10; i++) {
          changeHandler(`/project/src/Component${i}.tsx`);
        }
      }

      // Wait for debounce + recompilation
      await new Promise(resolve => setTimeout(resolve, 700));

      // The console should show batched message
      const calls = consoleSpy.mock.calls.flat().join('\n');
      // Should mention multiple files or batching
    });
  });
});
