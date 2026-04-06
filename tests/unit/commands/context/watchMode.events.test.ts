/**
 * Unit tests for watchMode module - File events handling
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
  toForwardSlashes: (path: string) => path.replace(/\\/g, '/'),
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
import chokidar from 'chokidar';

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
