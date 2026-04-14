/**
 * Unit tests for multi-file comparison logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { multiFileCompare } from '../../../../src/cli/commands/compare/multiFile.js';
import * as fs from 'node:fs/promises';
import type { LogicStampBundle } from '../../../../src/core/pack.js';

// Mock fs/promises
vi.mock('node:fs/promises');

// Mock debug module
vi.mock('../../../../src/utils/debug.js', () => ({
  debugError: vi.fn(),
}));

/**
 * Helper to create a minimal valid bundle for testing
 */
function createBundle(
  entryId: string,
  semanticHash: string,
  overrides: Record<string, any> = {},
): LogicStampBundle {
  return {
    type: 'LogicStampBundle',
    schemaVersion: '0.1',
    entryId,
    depth: 2,
    createdAt: new Date().toISOString(),
    bundleHash: `bundleHash-${entryId.replace(/[/\\]/g, '-')}`,
    graph: {
      nodes: [
        {
          entryId,
          contract: {
            entryId,
            type: 'UIFContract',
            schemaVersion: '0.4',
            kind: 'react:component',
            description: 'Test component',
            semanticHash,
            fileHash: `fileHash-${entryId.replace(/[/\\]/g, '-')}`,
            composition: {
              variables: [],
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
      folders: [{ path: 'src', contextFile: 'src/context.json', bundles: 1 }],
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
      folders: [{ path: 'src', contextFile: 'src/context.json', bundles: 1 }],
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

    // Additions are growth, not drift - should be PASS
    expect(result.status).toBe('PASS');
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
      folders: [{ path: 'src', contextFile: 'src/context.json', bundles: 1 }],
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
      folders: [{ path: 'src', contextFile: 'src/context.json', bundles: 1 }],
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

  it('should ignore hash-only changes in gitBaseline mode', async () => {
    const mockIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [{ path: 'src', contextFile: 'src/context.json', bundles: 1 }],
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
      gitBaseline: true,
    });

    // Hash-only change should be ignored in git baseline mode
    expect(result.status).toBe('PASS');
    expect(result.summary.driftFolders).toBe(0);
    expect(result.folders[0].status).toBe('PASS');
  });

  it('should report hash changes with other changes in gitBaseline mode', async () => {
    const mockIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [{ path: 'src', contextFile: 'src/context.json', bundles: 1 }],
    };

    const oldBundles = [
      createBundle('src/App.tsx', 'uif:oldhash', {
        graph: {
          nodes: [
            {
              entryId: 'src/App.tsx',
              contract: {
                entryId: 'src/App.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'react:component',
                description: 'Test component',
                semanticHash: 'uif:oldhash',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
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
      createBundle('src/App.tsx', 'uif:newhash', {
        graph: {
          nodes: [
            {
              entryId: 'src/App.tsx',
              contract: {
                entryId: 'src/App.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'react:component',
                description: 'Test component',
                semanticHash: 'uif:newhash',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: ['react', 'react-dom'], // Import changed
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
      gitBaseline: true,
    });

    // Hash change should be reported when there are other changes
    expect(result.status).toBe('DRIFT');
    expect(result.summary.driftFolders).toBe(1);
    expect(result.folders[0].status).toBe('DRIFT');
    expect(result.folders[0].componentResult?.changed[0].deltas).toContainEqual(
      {
        type: 'hash',
        old: 'uif:oldhash',
        new: 'uif:newhash',
      },
    );
  });

  it('should throw error for invalid index type', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        type: 'InvalidType',
      }),
    );

    await expect(
      multiFileCompare({
        oldIndexFile: '/old/context_main.json',
        newIndexFile: '/new/context_main.json',
      }),
    ).rejects.toThrow("Invalid index file: expected type 'LogicStampIndex'");
  });

  it('should warn about legacy schema version 0.1', async () => {
    const mockIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.1',
      folders: [],
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockIndex));

    await multiFileCompare({
      oldIndexFile: '/old/context_main.json',
      newIndexFile: '/new/context_main.json',
    });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('schema version 0.1'),
    );
  });

  it('should warn about unknown schema version', async () => {
    const mockIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '999.0',
      folders: [],
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockIndex));

    await multiFileCompare({
      oldIndexFile: '/old/context_main.json',
      newIndexFile: '/new/context_main.json',
    });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown schema version'),
    );
  });

  it('should throw error when index file not found', async () => {
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(fs.readFile).mockRejectedValue(error);

    await expect(
      multiFileCompare({
        oldIndexFile: '/old/context_main.json',
        newIndexFile: '/new/context_main.json',
      }),
    ).rejects.toThrow('File not found');
  });

  it('should handle comparison failure for individual folders gracefully', async () => {
    const mockIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [{ path: 'src', contextFile: 'src/context.json', bundles: 1 }],
    };

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('context_main.json')) {
        return JSON.stringify(mockIndex);
      }
      // Context file read fails
      throw new Error('Read error');
    });

    const result = await multiFileCompare({
      oldIndexFile: '/old/context_main.json',
      newIndexFile: '/new/context_main.json',
    });

    expect(result.status).toBe('DRIFT');
    expect(result.folders[0].status).toBe('DRIFT');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to compare'),
    );
  });

  it('should detect orphaned files on disk', async () => {
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
      folders: [{ path: 'src', contextFile: 'src/context.json', bundles: 1 }],
    };

    const mockBundles = [createBundle('src/App.tsx', 'uif:hash123')];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      // Normalize path separators for cross-platform matching
      const pathStr = String(path).replace(/\\/g, '/');
      if (pathStr.includes('old') && pathStr.includes('context_main.json')) {
        return JSON.stringify(oldIndex);
      }
      if (pathStr.includes('new') && pathStr.includes('context_main.json')) {
        return JSON.stringify(newIndex);
      }
      // lib/context.json exists on disk (orphaned file)
      return JSON.stringify(mockBundles);
    });

    const result = await multiFileCompare({
      oldIndexFile: '/old/context_main.json',
      newIndexFile: '/new/context_main.json',
    });

    expect(result.orphanedFiles).toContain('lib/context.json');
  });

  it('should not include already-deleted files as orphaned', async () => {
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
      folders: [{ path: 'src', contextFile: 'src/context.json', bundles: 1 }],
    };

    const mockBundles = [createBundle('src/App.tsx', 'uif:hash123')];
    const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
    enoentError.code = 'ENOENT';

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      // Normalize path separators for cross-platform matching
      const pathStr = String(path).replace(/\\/g, '/');
      if (pathStr.includes('old') && pathStr.includes('context_main.json')) {
        return JSON.stringify(oldIndex);
      }
      if (pathStr.includes('new') && pathStr.includes('context_main.json')) {
        return JSON.stringify(newIndex);
      }
      if (pathStr.includes('lib/context.json')) {
        // File already deleted
        throw enoentError;
      }
      return JSON.stringify(mockBundles);
    });

    const result = await multiFileCompare({
      oldIndexFile: '/old/context_main.json',
      newIndexFile: '/new/context_main.json',
    });

    // Should not include lib/context.json since it doesn't exist
    expect(result.orphanedFiles).toBeUndefined();
  });

  it('should sort folder results by path', async () => {
    const mockIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [
        { path: 'zoo', contextFile: 'zoo/context.json', bundles: 1 },
        { path: 'alpha', contextFile: 'alpha/context.json', bundles: 1 },
        { path: 'beta', contextFile: 'beta/context.json', bundles: 1 },
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

    expect(result.folders[0].folderPath).toBe('alpha');
    expect(result.folders[1].folderPath).toBe('beta');
    expect(result.folders[2].folderPath).toBe('zoo');
  });

  it('should count components correctly for added folders', async () => {
    const oldIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [],
    };

    const newIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [{ path: 'src', contextFile: 'src/context.json', bundles: 5 }],
    };

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old') && pathStr.includes('context_main.json')) {
        return JSON.stringify(oldIndex);
      }
      if (pathStr.includes('new') && pathStr.includes('context_main.json')) {
        return JSON.stringify(newIndex);
      }
      return JSON.stringify([]);
    });

    const result = await multiFileCompare({
      oldIndexFile: '/old/context_main.json',
      newIndexFile: '/new/context_main.json',
    });

    expect(result.summary.totalComponentsAdded).toBe(5);
  });

  it('should count components correctly for orphaned folders', async () => {
    const oldIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [{ path: 'src', contextFile: 'src/context.json', bundles: 3 }],
    };

    const newIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [],
    };

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old') && pathStr.includes('context_main.json')) {
        return JSON.stringify(oldIndex);
      }
      if (pathStr.includes('new') && pathStr.includes('context_main.json')) {
        return JSON.stringify(newIndex);
      }
      return JSON.stringify([]);
    });

    const result = await multiFileCompare({
      oldIndexFile: '/old/context_main.json',
      newIndexFile: '/new/context_main.json',
    });

    expect(result.summary.totalComponentsRemoved).toBe(3);
  });
});
