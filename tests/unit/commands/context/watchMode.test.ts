/**
 * Unit tests for watchMode module - Core initialization and setup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

vi.mock('../../../../src/cli/commands/context/watchMode/watchDiff.js', () => ({
  getChanges: vi.fn(),
  showChanges: vi.fn(),
}));

vi.mock('../../../../src/cli/commands/context/index.js', () => ({
  buildContractsFromFiles: vi.fn(),
  writeContextFiles: vi.fn().mockResolvedValue({ filesWritten: 1, folderInfos: [], totalTokenEstimate: 500 }),
  writeMainIndex: vi.fn().mockResolvedValue(undefined),
  groupBundlesByFolder: vi.fn(() => new Map()),
  displayPath: vi.fn((p: string) => p),
  displayProjectRoot: vi.fn((p: string) => p),
  displayFilePath: vi.fn((p: string) => p),
  initializeWatchCache: vi.fn(),
  incrementalRebuild: vi.fn(),
}));

vi.mock('../../../../src/cli/commands/context.js', () => ({
  contextCommand: vi.fn().mockResolvedValue(undefined),
}));

// Import the module after mocks
import { startWatchMode } from '../../../../src/cli/commands/context/watchMode/watchMode.js';
import * as configModule from '../../../../src/utils/config.js';
import * as cleanupModule from '../../../../src/utils/cleanup.js';
import chokidar from 'chokidar';

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
    it('should trigger recompilation only for TypeScript files by default', async () => {
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

    it('should trigger recompilation for .stampignore file changes', async () => {
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
});
