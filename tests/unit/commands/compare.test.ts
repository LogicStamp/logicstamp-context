import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  compareCommand,
  multiFileCompare,
  displayMultiFileCompareResult,
  cleanOrphanedFiles,
  type CompareResult,
  type MultiFileCompareResult,
} from '../../../src/cli/commands/compare.js';
import * as fs from 'node:fs/promises';

// Mock fs/promises
vi.mock('node:fs/promises');

/**
 * Helper to create a minimal valid bundle for testing
 */
function createBundle(entryId: string, semanticHash: string, overrides: Record<string, any> = {}): any {
  return {
    type: 'LogicStampBundle',
    schemaVersion: '0.1',
    entryId,
    graph: {
      nodes: [
        {
          entryId,
          contract: {
            entryId,
            type: 'UIFContract',
            schemaVersion: '0.4',
            semanticHash,
            composition: {
              imports: [],
              hooks: [],
              functions: [],
              components: [],
            },
            interface: {
              props: {},
              emits: {},
            },
            exports: 'default',
          },
        },
      ],
      edges: [],
    },
    meta: {
      missing: [],
      source: 'test',
    },
    ...overrides,
  };
}

describe('compareCommand', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalStdoutWrite: typeof process.stdout.write;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalStdoutWrite = process.stdout.write;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.stdout.write = originalStdoutWrite;
    vi.restoreAllMocks();
  });

  it('should return PASS when files are identical', async () => {
    const bundles = [createBundle('src/App.tsx', 'uif:hash123')];

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(bundles));

    const result = await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(result.status).toBe('PASS');
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.changed).toHaveLength(0);
  });

  it('should detect added components', async () => {
    const oldBundles = [createBundle('src/App.tsx', 'uif:hash123')];
    const newBundles = [
      createBundle('src/App.tsx', 'uif:hash123'),
      createBundle('src/Button.tsx', 'uif:hash456'),
    ];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old')) {
        return JSON.stringify(oldBundles);
      }
      return JSON.stringify(newBundles);
    });

    const result = await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(result.status).toBe('DRIFT');
    expect(result.added).toContain('src/button.tsx'); // Note: lowercased
  });

  it('should detect removed components', async () => {
    const oldBundles = [
      createBundle('src/App.tsx', 'uif:hash123'),
      createBundle('src/Button.tsx', 'uif:hash456'),
    ];
    const newBundles = [createBundle('src/App.tsx', 'uif:hash123')];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old')) {
        return JSON.stringify(oldBundles);
      }
      return JSON.stringify(newBundles);
    });

    const result = await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(result.status).toBe('DRIFT');
    expect(result.removed).toContain('src/button.tsx'); // Note: lowercased
  });

  it('should detect changed components', async () => {
    const oldBundles = [createBundle('src/App.tsx', 'uif:oldhash')];
    const newBundles = [createBundle('src/App.tsx', 'uif:newhash')];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old')) {
        return JSON.stringify(oldBundles);
      }
      return JSON.stringify(newBundles);
    });

    const result = await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(result.status).toBe('DRIFT');
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].id).toBe('src/app.tsx');
    expect(result.changed[0].deltas).toContainEqual({
      type: 'hash',
      old: 'uif:oldhash',
      new: 'uif:newhash',
    });
  });

  it('should detect import changes', async () => {
    const oldBundles = [
      createBundle('src/App.tsx', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/App.tsx',
              contract: {
                entryId: 'src/App.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                semanticHash: 'uif:hash123',
                composition: {
                  imports: ['react'],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: { props: {}, emits: {} },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/App.tsx', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/App.tsx',
              contract: {
                entryId: 'src/App.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                semanticHash: 'uif:hash123',
                composition: {
                  imports: ['react', 'react-dom'],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: { props: {}, emits: {} },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old')) {
        return JSON.stringify(oldBundles);
      }
      return JSON.stringify(newBundles);
    });

    const result = await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(result.status).toBe('DRIFT');
    expect(result.changed[0].deltas).toContainEqual({
      type: 'imports',
      old: ['react'],
      new: ['react', 'react-dom'],
    });
  });

  it('should throw error when old file not found', async () => {
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(fs.readFile).mockRejectedValue(error);

    await expect(compareCommand({
      oldFile: 'nonexistent.json',
      newFile: 'new.json',
    })).rejects.toThrow('File not found');
  });

  it('should throw error when JSON is invalid', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('invalid json');

    await expect(compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    })).rejects.toThrow('Failed to parse context files');
  });

  it('should output minimal in quiet mode for PASS', async () => {
    const bundles = [createBundle('src/App.tsx', 'uif:hash123')];

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(bundles));

    await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
      quiet: true,
    });

    expect(process.stdout.write).toHaveBeenCalledWith('✓\n');
  });
});

describe('multiFileCompare', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalConsoleWarn: typeof console.warn;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    vi.restoreAllMocks();
  });

  it('should return PASS when all folders are identical', async () => {
    const mockIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [
        { path: 'src', contextFile: 'src/context.json', bundles: 1 },
      ],
    };

    const mockBundles = [createBundle('src/App.tsx', 'uif:hash123')];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('context_main.json')) {
        return JSON.stringify(mockIndex);
      }
      return JSON.stringify(mockBundles);
    });

    const result = await multiFileCompare({
      oldIndexFile: '/old/context_main.json',
      newIndexFile: '/new/context_main.json',
    });

    expect(result.status).toBe('PASS');
    expect(result.summary.passFolders).toBe(1);
    expect(result.summary.driftFolders).toBe(0);
  });

  it('should detect added folders', async () => {
    const oldIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [
        { path: 'src', contextFile: 'src/context.json', bundles: 1 },
      ],
    };

    const newIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [
        { path: 'src', contextFile: 'src/context.json', bundles: 1 },
        { path: 'lib', contextFile: 'lib/context.json', bundles: 1 },
      ],
    };

    const mockBundles = [createBundle('src/App.tsx', 'uif:hash123')];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old') && pathStr.includes('context_main.json')) {
        return JSON.stringify(oldIndex);
      }
      if (pathStr.includes('new') && pathStr.includes('context_main.json')) {
        return JSON.stringify(newIndex);
      }
      return JSON.stringify(mockBundles);
    });

    const result = await multiFileCompare({
      oldIndexFile: '/old/context_main.json',
      newIndexFile: '/new/context_main.json',
    });

    expect(result.status).toBe('DRIFT');
    expect(result.summary.addedFolders).toBe(1);
  });

  it('should detect orphaned folders', async () => {
    const oldIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [
        { path: 'src', contextFile: 'src/context.json', bundles: 1 },
        { path: 'lib', contextFile: 'lib/context.json', bundles: 1 },
      ],
    };

    const newIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [
        { path: 'src', contextFile: 'src/context.json', bundles: 1 },
      ],
    };

    const mockBundles = [createBundle('src/App.tsx', 'uif:hash123')];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old') && pathStr.includes('context_main.json')) {
        return JSON.stringify(oldIndex);
      }
      if (pathStr.includes('new') && pathStr.includes('context_main.json')) {
        return JSON.stringify(newIndex);
      }
      return JSON.stringify(mockBundles);
    });

    const result = await multiFileCompare({
      oldIndexFile: '/old/context_main.json',
      newIndexFile: '/new/context_main.json',
    });

    expect(result.status).toBe('DRIFT');
    expect(result.summary.orphanedFolders).toBe(1);
  });

  it('should detect drift in folder contents', async () => {
    const mockIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [
        { path: 'src', contextFile: 'src/context.json', bundles: 1 },
      ],
    };

    const oldBundles = [createBundle('src/App.tsx', 'uif:oldhash')];
    const newBundles = [createBundle('src/App.tsx', 'uif:newhash')];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('context_main.json')) {
        return JSON.stringify(mockIndex);
      }
      if (pathStr.includes('old')) {
        return JSON.stringify(oldBundles);
      }
      return JSON.stringify(newBundles);
    });

    const result = await multiFileCompare({
      oldIndexFile: '/old/context_main.json',
      newIndexFile: '/new/context_main.json',
    });

    expect(result.status).toBe('DRIFT');
    expect(result.summary.driftFolders).toBe(1);
  });

  it('should throw error for invalid index type', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      type: 'InvalidType',
    }));

    await expect(multiFileCompare({
      oldIndexFile: '/old/context_main.json',
      newIndexFile: '/new/context_main.json',
    })).rejects.toThrow("Invalid index file: expected type 'LogicStampIndex'");
  });
});

describe('displayMultiFileCompareResult', () => {
  let originalConsoleLog: typeof console.log;
  let originalStdoutWrite: typeof process.stdout.write;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalStdoutWrite = process.stdout.write;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    process.stdout.write = originalStdoutWrite;
    vi.restoreAllMocks();
  });

  it('should output checkmark in quiet mode for PASS', () => {
    const result: MultiFileCompareResult = {
      status: 'PASS',
      folders: [],
      summary: {
        totalFolders: 1,
        addedFolders: 0,
        orphanedFolders: 0,
        driftFolders: 0,
        passFolders: 1,
        totalComponentsAdded: 0,
        totalComponentsRemoved: 0,
        totalComponentsChanged: 0,
      },
    };

    displayMultiFileCompareResult(result, false, true);

    expect(process.stdout.write).toHaveBeenCalledWith('✓\n');
  });

  it('should show detailed output when not quiet', () => {
    const result: MultiFileCompareResult = {
      status: 'DRIFT',
      folders: [
        {
          folderPath: 'src',
          contextFile: 'src/context.json',
          status: 'ADDED',
        },
      ],
      summary: {
        totalFolders: 1,
        addedFolders: 1,
        orphanedFolders: 0,
        driftFolders: 0,
        passFolders: 0,
        totalComponentsAdded: 1,
        totalComponentsRemoved: 0,
        totalComponentsChanged: 0,
      },
    };

    displayMultiFileCompareResult(result, false, false);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('DRIFT'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('ADDED FILE'));
  });
});

describe('cleanOrphanedFiles', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  it('should delete orphaned files', async () => {
    vi.mocked(fs.unlink).mockResolvedValue(undefined);

    const count = await cleanOrphanedFiles(
      ['src/old.json', 'lib/old.json'],
      '/project'
    );

    expect(count).toBe(2);
    expect(fs.unlink).toHaveBeenCalledTimes(2);
  });

  it('should handle delete errors gracefully', async () => {
    vi.mocked(fs.unlink).mockRejectedValue(new Error('Permission denied'));

    const count = await cleanOrphanedFiles(
      ['src/old.json'],
      '/project'
    );

    expect(count).toBe(0);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to delete')
    );
  });

  it('should not log when quiet mode enabled', async () => {
    vi.mocked(fs.unlink).mockResolvedValue(undefined);

    await cleanOrphanedFiles(['src/old.json'], '/project', true);

    expect(console.log).not.toHaveBeenCalled();
  });
});
