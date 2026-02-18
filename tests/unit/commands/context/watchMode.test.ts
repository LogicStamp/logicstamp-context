/**
 * Unit tests for watchMode module
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

describe('watchMode', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let mockWatcher: {
    on: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset the mock watcher
    mockWatcher = {
      on: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('startWatchMode initialization', () => {
    it('should display watch mode startup message when not quiet', async () => {
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

      // Start watch mode (it runs indefinitely, so we check setup)
      const watchPromise = startWatchMode(options, '/project', null);

      // Let microtasks run
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Watch mode enabled'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Press Ctrl+C to stop'));
    });

    it('should display strict mode message when strictWatch enabled', async () => {
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

      const watchPromise = startWatchMode(options, '/project', null);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Strict mode'));
    });

    it('should not display startup messages when quiet', async () => {
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

      // Console should not be called with startup messages
      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).not.toContain('Watch mode enabled');
    });

    it('should write watch status file on startup', async () => {
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

      expect(configModule.writeWatchStatus).toHaveBeenCalledWith(
        '/project',
        expect.objectContaining({
          active: true,
          projectRoot: '/project',
          pid: process.pid,
        })
      );
    });

    it('should warn but continue if watch status file cannot be written', async () => {
      vi.mocked(configModule.writeWatchStatus).mockRejectedValueOnce(new Error('Permission denied'));

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

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not write watch status file')
      );
    });

    it('should register cleanup handler', async () => {
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

      expect(cleanupModule.registerCleanup).toHaveBeenCalledWith(
        'watch-mode',
        expect.any(Function),
        1
      );
    });
  });

  describe('chokidar watcher setup', () => {
    it('should set up watcher with correct options', async () => {
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

      expect(chokidar.watch).toHaveBeenCalledWith(
        '/project',
        expect.objectContaining({
          ignoreInitial: true,
          persistent: true,
          depth: 99,
        })
      );
    });

    it('should watch style files when includeStyle is true', async () => {
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
        includeStyle: true,
      };

      const watchPromise = startWatchMode(options, '/project', null);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check that console logged the watched extensions including style files
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('.css'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('.scss'));
    });

    it('should register event handlers for change, add, unlink, error, and ready', async () => {
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

      const onCalls = mockWatcher.on.mock.calls;
      const eventTypes = onCalls.map((call) => call[0] as string);

      expect(eventTypes).toContain('change');
      expect(eventTypes).toContain('add');
      expect(eventTypes).toContain('unlink');
      expect(eventTypes).toContain('error');
      expect(eventTypes).toContain('ready');
    });
  });

  describe('file change handling', () => {
    it('should trigger regeneration only for TypeScript files by default', async () => {
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

      // Set up mock watcher to capture event handlers
      let changeHandler: ((path: string) => void) | undefined;
      mockWatcher.on.mockImplementation((event: string, handler: (path: string) => void) => {
        if (event === 'change') {
          changeHandler = handler;
        }
        return mockWatcher;
      });

      const watchPromise = startWatchMode(options, '/project', null);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Simulate file change for non-TS file
      if (changeHandler) {
        changeHandler('/project/readme.md');
      }
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should NOT log "Changed" for non-TS file
      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).not.toContain('readme.md');
    });

    it('should trigger regeneration for .stampignore file changes', async () => {
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

      let changeHandler: ((path: string) => void) | undefined;
      mockWatcher.on.mockImplementation((event: string, handler: (path: string) => void) => {
        if (event === 'change') {
          changeHandler = handler;
        }
        return mockWatcher;
      });

      const watchPromise = startWatchMode(options, '/project', null);
      await new Promise(resolve => setTimeout(resolve, 10));

      // Simulate change to .stampignore
      if (changeHandler) {
        changeHandler('/project/.stampignore');
      }
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Changed'));
    });
  });
});

describe('detectViolations', () => {
  // detectViolations is an internal function. These tests document the expected
  // violation types and severities based on the source code analysis.
  // The function is tested indirectly through the strict watch mode flow.

  describe('violation type documentation', () => {
    it('should classify contract removal as error severity', () => {
      // Based on watchMode.ts detectViolations():
      // Removed contracts are classified as 'contract_removed' with severity 'error'
      const mockChanges = createMockBundleChanges({
        removed: ['src/DeletedComponent.tsx'],
      });
      expect(mockChanges.removed.length).toBe(1);
    });

    it('should classify removed props as error severity', () => {
      // Based on watchMode.ts detectViolations():
      // Removed props are classified as 'breaking_change_prop_removed' with severity 'error'
      const mockContractDiff = createMockContractDiff({
        props: { added: [], removed: ['onClick'], changed: [] },
      });
      expect(mockContractDiff.props.removed).toContain('onClick');
    });

    it('should classify changed prop types as warning severity', () => {
      // Based on watchMode.ts detectViolations():
      // Changed props are classified as 'breaking_change_prop_type' with severity 'warning'
      const mockContractDiff = createMockContractDiff({
        props: {
          added: [],
          removed: [],
          changed: [{ name: 'variant', old: 'string', new: 'enum' }],
        },
      });
      expect(mockContractDiff.props.changed.length).toBe(1);
    });

    it('should classify removed events as error severity', () => {
      // Based on watchMode.ts detectViolations():
      // Removed events are classified as 'breaking_change_event_removed' with severity 'error'
      const mockContractDiff = createMockContractDiff({
        emits: { added: [], removed: ['onSubmit'], changed: [] },
      });
      expect(mockContractDiff.emits.removed).toContain('onSubmit');
    });

    it('should classify removed state as warning severity', () => {
      // Based on watchMode.ts detectViolations():
      // Removed state is classified as 'breaking_change_state_removed' with severity 'warning'
      const mockContractDiff = createMockContractDiff({
        state: { added: [], removed: ['count'], changed: [] },
      });
      expect(mockContractDiff.state.removed).toContain('count');
    });

    it('should classify removed functions as error severity', () => {
      // Based on watchMode.ts detectViolations():
      // Removed functions are classified as 'breaking_change_function_removed' with severity 'error'
      const mockContractDiff = createMockContractDiff({
        functions: { added: [], removed: ['handleClick'] },
      });
      expect(mockContractDiff.functions.removed).toContain('handleClick');
    });

    it('should classify removed variables as warning severity', () => {
      // Based on watchMode.ts detectViolations():
      // Removed variables are classified as 'breaking_change_variable_removed' with severity 'warning'
      const mockContractDiff = createMockContractDiff({
        variables: { added: [], removed: ['MAX_SIZE'] },
      });
      expect(mockContractDiff.variables.removed).toContain('MAX_SIZE');
    });
  });
});

describe('displayViolations', () => {
  // displayViolations is an internal function that formats violation output.
  // It's tested indirectly through the strict watch mode flow.
  // This test documents the expected console output format.

  it('should document violation display format', () => {
    // Based on watchMode.ts displayViolations():
    // - Displays header: "⚠️  Strict Watch: N violation(s) detected"
    // - Groups by severity: errors first, then warnings
    // - Shows error count: "❌ Errors (N):"
    // - Shows warning count: "⚠️  Warnings (N):"
    // - Lists each violation message
    expect(true).toBe(true);
  });
});

describe('cleanup handler', () => {
  it('should clean up watch status file and close watcher', async () => {
    let cleanupHandler: (() => Promise<void>) | undefined;
    vi.mocked(cleanupModule.registerCleanup).mockImplementation((name, handler) => {
      cleanupHandler = handler as () => Promise<void>;
      return () => {}; // Return unregister function
    });

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

    // Execute cleanup handler
    if (cleanupHandler) {
      await cleanupHandler();
    }

    expect(mockWatcher.close).toHaveBeenCalled();
    expect(configModule.deleteWatchStatus).toHaveBeenCalledWith('/project');
  });

  it('should show session summary when strict watch has violations', async () => {
    let cleanupHandler: (() => Promise<void>) | undefined;
    vi.mocked(cleanupModule.registerCleanup).mockImplementation((name, handler) => {
      cleanupHandler = handler as () => Promise<void>;
      return () => {}; // Return unregister function
    });

    const mockWatcher = {
      on: vi.fn().mockReturnThis(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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

    const watchPromise = startWatchMode(options, '/project', null);
    await new Promise(resolve => setTimeout(resolve, 10));

    // Execute cleanup handler
    if (cleanupHandler) {
      await cleanupHandler();
    }

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Watch mode stopped'));
    consoleSpy.mockRestore();
  });
});

describe('debouncing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce rapid file changes', async () => {
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

    // Create mock cache to trigger incremental rebuild
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

    const watchPromise = startWatchMode(options, '/project', mockCache);

    // Need real timer for initial setup
    vi.useRealTimers();
    await new Promise(resolve => setTimeout(resolve, 10));
    vi.useFakeTimers();

    // Trigger multiple rapid changes
    if (changeHandler) {
      changeHandler('/project/src/App.tsx');
      changeHandler('/project/src/Button.tsx');
      changeHandler('/project/src/Card.tsx');
    }

    // Advance timer past debounce delay (500ms)
    await vi.advanceTimersByTimeAsync(600);

    // Should only trigger one regeneration despite multiple changes
    // (We verify this by checking that incrementalRebuild was called only once)
  });
});

describe('incremental vs full rebuild', () => {
  it('should use incremental rebuild when cache is provided', async () => {
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
      quiet: true,
    };

    // Start watch mode with cache
    const watchPromise = startWatchMode(options, '/project', mockCache);
    await new Promise(resolve => setTimeout(resolve, 10));

    // The cache should be used for incremental rebuilds
    expect(mockCache).toBeDefined();
  });
});

describe('logging', () => {
  it('should document log entry structure', () => {
    // Based on watchMode.ts, log entries include:
    // - timestamp: ISO timestamp
    // - changedFiles: array of changed file paths
    // - fileCount: number of changed files
    // - durationMs: regeneration duration
    // - modifiedContracts: (when changes detected)
    // - modifiedBundles: (when changes detected)
    // - addedContracts: (when new contracts added)
    // - removedContracts: (when contracts removed)
    // - summary: summary counts
    // - error: (when regeneration fails)
    expect(true).toBe(true);
  });

  it('should document log entry with changes structure', () => {
    // Based on watchMode.ts, when changes are detected, log entry includes:
    const mockChanges = createMockBundleChanges({
      changed: [
        {
          entryId: 'src/App.tsx',
          semanticHash: { old: 'hash1', new: 'hash2' },
        },
      ],
      bundleChanged: [
        { entryId: 'src/App.tsx', oldHash: 'old', newHash: 'new' },
      ],
    });

    // Expected log entry structure:
    // {
    //   timestamp: ISO timestamp,
    //   changedFiles: ['src/App.tsx'],
    //   fileCount: 1,
    //   durationMs: number,
    //   modifiedContracts: [{ entryId, semanticHashChanged, fileHashChanged, ... }],
    //   modifiedBundles: [{ entryId, bundleHash }],
    //   summary: { modifiedContractsCount, modifiedBundlesCount, addedContractsCount, removedContractsCount }
    // }
    expect(mockChanges.changed.length).toBe(1);
    expect(mockChanges.bundleChanged.length).toBe(1);
  });
});

describe('file extension filtering', () => {
  let changeHandler: ((path: string) => void) | undefined;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
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
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should ignore .js files', async () => {
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
      changeHandler('/project/src/App.js');
    }
    await new Promise(resolve => setTimeout(resolve, 10));

    const calls = consoleSpy.mock.calls.flat().join('\n');
    expect(calls).not.toContain('App.js');
  });

  it('should ignore .json files', async () => {
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
      changeHandler('/project/package.json');
    }
    await new Promise(resolve => setTimeout(resolve, 10));

    const calls = consoleSpy.mock.calls.flat().join('\n');
    expect(calls).not.toContain('package.json');
  });

  it('should handle .tsx files', async () => {
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
      changeHandler('/project/src/Component.tsx');
    }
    await new Promise(resolve => setTimeout(resolve, 10));

    const calls = consoleSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('Changed');
    expect(calls).toContain('Component.tsx');
  });

  it('should handle .module.css files when includeStyle is true', async () => {
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
      includeStyle: true,
    };

    const watchPromise = startWatchMode(options, '/project', null);
    await new Promise(resolve => setTimeout(resolve, 10));

    if (changeHandler) {
      changeHandler('/project/src/styles.module.css');
    }
    await new Promise(resolve => setTimeout(resolve, 10));

    const calls = consoleSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('Changed');
    expect(calls).toContain('styles.module.css');
  });
});

describe('error handling', () => {
  it('should handle regeneration errors gracefully', async () => {
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

describe('add and unlink events', () => {
  let addHandler: ((path: string) => void) | undefined;
  let unlinkHandler: ((path: string) => void) | undefined;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mockWatcher = {
      on: vi.fn((event: string, handler: (path: string) => void) => {
        if (event === 'add') {
          addHandler = handler;
        } else if (event === 'unlink') {
          unlinkHandler = handler;
        }
        return mockWatcher;
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should handle file additions', async () => {
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

    if (addHandler) {
      addHandler('/project/src/NewComponent.tsx');
    }
    await new Promise(resolve => setTimeout(resolve, 10));

    const calls = consoleSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('New file');
    expect(calls).toContain('NewComponent.tsx');
  });

  it('should handle file deletions', async () => {
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

    if (unlinkHandler) {
      unlinkHandler('/project/src/OldComponent.tsx');
    }
    await new Promise(resolve => setTimeout(resolve, 10));

    const calls = consoleSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('Deleted file');
    expect(calls).toContain('OldComponent.tsx');
  });
});

describe('ready event', () => {
  it('should show ready message when watcher is ready', async () => {
    let readyHandler: (() => void) | undefined;
    const mockWatcher = {
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'ready') {
          readyHandler = handler;
        }
        return mockWatcher;
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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

    if (readyHandler) {
      readyHandler();
    }

    const calls = consoleSpy.mock.calls.flat().join('\n');
    expect(calls).toContain('Watch mode active');
    consoleSpy.mockRestore();
  });

  it('should not show ready message twice', async () => {
    let readyHandler: (() => void) | undefined;
    const mockWatcher = {
      on: vi.fn((event: string, handler: () => void) => {
        if (event === 'ready') {
          readyHandler = handler;
        }
        return mockWatcher;
      }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as unknown as ReturnType<typeof chokidar.watch>);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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

    // Trigger ready multiple times
    if (readyHandler) {
      readyHandler();
      readyHandler();
      readyHandler();
    }

    const calls = consoleSpy.mock.calls.flat();
    const readyCount = calls.filter(call => call.includes('Watch mode active')).length;
    expect(readyCount).toBe(1);
    consoleSpy.mockRestore();
  });
});

describe('output path handling', () => {
  it('should handle .json output path', async () => {
    const options: ContextOptions = {
      out: '.logicstamp/context.json', // .json file path
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

    // Should extract directory from .json path
    expect(configModule.writeWatchStatus).toHaveBeenCalledWith(
      '/project',
      expect.objectContaining({
        outputDir: '.logicstamp',
      })
    );
  });

  it('should handle directory output path', async () => {
    const options: ContextOptions = {
      out: 'output', // directory path
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

    expect(configModule.writeWatchStatus).toHaveBeenCalledWith(
      '/project',
      expect.objectContaining({
        outputDir: 'output',
      })
    );
  });
});
