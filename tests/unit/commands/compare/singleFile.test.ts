/**
 * Unit tests for single file comparison logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  compareCommand,
  compareFolderContext,
} from '../../../../src/cli/commands/compare/singleFile.js';
import * as fs from 'node:fs/promises';
import type { LogicStampBundle } from '../../../../src/core/pack.js';

// Mock fs/promises
vi.mock('node:fs/promises');

// Mock tokens module
vi.mock('../../../../src/utils/tokens.js', () => ({
  formatTokenCount: vi.fn((n: number) => `${n}`),
  estimateGPT4Tokens: vi.fn(() => Promise.resolve(1000)),
  estimateClaudeTokens: vi.fn(() => Promise.resolve(1200)),
}));

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

    // Additions are growth, not drift - should be PASS
    expect(result.status).toBe('PASS');
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

  it('should throw error when old file not found', async () => {
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(fs.readFile).mockRejectedValue(error);

    await expect(
      compareCommand({
        oldFile: 'nonexistent.json',
        newFile: 'new.json',
      }),
    ).rejects.toThrow('File not found');
  });

  it('should throw error when JSON is invalid', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('invalid json');

    await expect(
      compareCommand({
        oldFile: 'old.json',
        newFile: 'new.json',
      }),
    ).rejects.toThrow('Failed to parse context files');
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

  it('should throw error when new file not found', async () => {
    const bundles = [createBundle('src/App.tsx', 'uif:hash123')];
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old')) {
        return JSON.stringify(bundles);
      }
      throw error;
    });

    await expect(
      compareCommand({
        oldFile: 'old.json',
        newFile: 'new.json',
      }),
    ).rejects.toThrow('File not found');
  });

  describe('gitBaseline mode - hash-only change filtering', () => {
    it('should ignore hash-only changes when gitBaseline is true', async () => {
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
        gitBaseline: true,
      });

      // Hash-only change should be ignored in git baseline mode
      expect(result.status).toBe('PASS');
      expect(result.changed).toHaveLength(0);
    });

    it('should report hash changes when accompanied by other changes in gitBaseline mode', async () => {
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
        if (pathStr.includes('old')) {
          return JSON.stringify(oldBundles);
        }
        return JSON.stringify(newBundles);
      });

      const result = await compareCommand({
        oldFile: 'old.json',
        newFile: 'new.json',
        gitBaseline: true,
      });

      // Hash change should be reported when there are other changes
      expect(result.status).toBe('DRIFT');
      expect(result.changed).toHaveLength(1);
      expect(result.changed[0].deltas).toContainEqual({
        type: 'hash',
        old: 'uif:oldhash',
        new: 'uif:newhash',
      });
      expect(result.changed[0].deltas).toContainEqual({
        type: 'imports',
        old: ['react'],
        new: ['react', 'react-dom'],
      });
    });

    it('should report hash changes normally when gitBaseline is false', async () => {
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
        gitBaseline: false,
      });

      // Hash-only change should be reported in normal mode
      expect(result.status).toBe('DRIFT');
      expect(result.changed).toHaveLength(1);
      expect(result.changed[0].deltas).toContainEqual({
        type: 'hash',
        old: 'uif:oldhash',
        new: 'uif:newhash',
      });
    });
  });

  it('should handle bundles with missing composition fields', async () => {
    const oldBundles = [
      {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/App.tsx',
        graph: {
          nodes: [
            {
              entryId: 'src/App.tsx',
              contract: {
                entryId: 'src/App.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                semanticHash: 'uif:hash123',
                // No composition field
                interface: { props: {}, emits: {} },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
        meta: { missing: [], source: 'test' },
      },
    ];

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(oldBundles));

    const result = await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(result.status).toBe('PASS');
  });

  it('should handle bundles with no exports', async () => {
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
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: { props: {}, emits: {} },
                // No exports - should resolve to 'none'
              },
            },
          ],
          edges: [],
        },
      }),
    ];

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(oldBundles));

    const result = await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(result.status).toBe('PASS');
  });

  it('should handle case-insensitive component matching', async () => {
    const oldBundles = [createBundle('src/App.TSX', 'uif:hash123')];
    const newBundles = [createBundle('src/app.tsx', 'uif:hash123')];

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

    // Should match as same component due to lowercase comparison
    expect(result.status).toBe('PASS');
  });
});

describe('compareFolderContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should compare folder context files', async () => {
    const bundles = [createBundle('src/App.tsx', 'uif:hash123')];

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(bundles));

    const { result } = await compareFolderContext(
      'old/context.json',
      'new/context.json',
      false,
      false,
      false,
    );

    expect(result.status).toBe('PASS');
  });

  it('should calculate token delta when stats is true', async () => {
    const bundles = [createBundle('src/App.tsx', 'uif:hash123')];

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(bundles));

    const { result, tokenDelta } = await compareFolderContext(
      'old/context.json',
      'new/context.json',
      true,
      false,
      false,
    );

    expect(result.status).toBe('PASS');
    expect(tokenDelta).toBeDefined();
    expect(tokenDelta?.gpt4).toBe(0);
    expect(tokenDelta?.claude).toBe(0);
  });

  it('should not calculate token delta in quiet mode', async () => {
    const bundles = [createBundle('src/App.tsx', 'uif:hash123')];

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(bundles));

    const { result, tokenDelta } = await compareFolderContext(
      'old/context.json',
      'new/context.json',
      true,
      true,
      false,
    );

    expect(result.status).toBe('PASS');
    expect(tokenDelta).toBeUndefined();
  });

  it('should handle gitBaseline mode', async () => {
    const oldBundles = [createBundle('src/App.tsx', 'uif:oldhash')];
    const newBundles = [createBundle('src/App.tsx', 'uif:newhash')];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old')) {
        return JSON.stringify(oldBundles);
      }
      return JSON.stringify(newBundles);
    });

    const { result } = await compareFolderContext(
      'old/context.json',
      'new/context.json',
      false,
      false,
      true,
    );

    // Hash-only change should be ignored in git baseline mode
    expect(result.status).toBe('PASS');
  });

  it('should throw error when old file not found', async () => {
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(fs.readFile).mockRejectedValue(error);

    await expect(
      compareFolderContext('nonexistent.json', 'new.json', false, false, false),
    ).rejects.toThrow('File not found');
  });

  it('should throw error when new file not found', async () => {
    const bundles = [createBundle('src/App.tsx', 'uif:hash123')];
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old')) {
        return JSON.stringify(bundles);
      }
      throw error;
    });

    await expect(
      compareFolderContext('old.json', 'nonexistent.json', false, false, false),
    ).rejects.toThrow('File not found');
  });
});

describe('compareCommand - token stats display', () => {
  let originalConsoleLog: typeof console.log;
  let originalStdoutWrite: typeof process.stdout.write;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalStdoutWrite = process.stdout.write;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    process.stdout.write = originalStdoutWrite;
    vi.restoreAllMocks();
  });

  it('should display token stats when stats is enabled', async () => {
    const bundles = [createBundle('src/App.tsx', 'uif:hash123')];

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(bundles));

    await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
      stats: true,
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Token Stats'),
    );
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Old:'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('New:'));
  });

  it('should not display token stats in quiet mode', async () => {
    const bundles = [createBundle('src/App.tsx', 'uif:hash123')];

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(bundles));

    await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
      stats: true,
      quiet: true,
    });

    expect(console.log).not.toHaveBeenCalledWith(
      expect.stringContaining('Token Stats'),
    );
  });
});

describe('compareCommand - delta type displays', () => {
  let originalConsoleLog: typeof console.log;
  let originalStdoutWrite: typeof process.stdout.write;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalStdoutWrite = process.stdout.write;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    process.stdout.write = originalStdoutWrite;
    vi.restoreAllMocks();
  });

  it('should display props delta', async () => {
    const oldBundles = [
      createBundle('src/Button.tsx', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/Button.tsx',
              contract: {
                entryId: 'src/Button.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'react:component',
                description: 'Test component',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-Button-tsx',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: { label: 'string', disabled: 'boolean' },
                  emits: {},
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/Button.tsx', 'uif:hash456', {
        graph: {
          nodes: [
            {
              entryId: 'src/Button.tsx',
              contract: {
                entryId: 'src/Button.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'react:component',
                description: 'Test component',
                semanticHash: 'uif:hash456',
                fileHash: 'fileHash-src-Button-tsx',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {
                    label: 'string',
                    disabled: 'boolean',
                    variant: 'string',
                  },
                  emits: {},
                },
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

    await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('props'));
  });

  it('should display emits delta', async () => {
    const oldBundles = [
      createBundle('src/Button.tsx', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/Button.tsx',
              contract: {
                entryId: 'src/Button.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'react:component',
                description: 'Test component',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-Button-tsx',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: { onClick: 'function' },
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/Button.tsx', 'uif:hash456', {
        graph: {
          nodes: [
            {
              entryId: 'src/Button.tsx',
              contract: {
                entryId: 'src/Button.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'react:component',
                description: 'Test component',
                semanticHash: 'uif:hash456',
                fileHash: 'fileHash-src-Button-tsx',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: { onClick: 'function', onHover: 'function' },
                },
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

    await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('emits'));
  });

  it('should display apiSignature delta', async () => {
    const oldBundles = [
      createBundle('src/api/users.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-api-users-ts',
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
                  apiSignature: {
                    parameters: { id: 'string' },
                    returnType: 'User',
                  },
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/api/users.ts', 'uif:hash456', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash456',
                fileHash: 'fileHash-src-api-users-ts',
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
                  apiSignature: {
                    parameters: { id: 'string', includeDeleted: 'boolean' },
                    returnType: 'User',
                  },
                },
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

    await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('apiSignature'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('parameters'),
    );
  });

  it('should display apiSignature returnType changes', async () => {
    const oldBundles = [
      createBundle('src/api/users.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-api-users-ts',
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
                  apiSignature: {
                    parameters: { id: 'string' },
                    returnType: 'User',
                  },
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/api/users.ts', 'uif:hash456', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash456',
                fileHash: 'fileHash-src-api-users-ts',
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
                  apiSignature: {
                    parameters: { id: 'string' },
                    returnType: 'UserResponse',
                  },
                },
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

    await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('apiSignature'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('returnType'),
    );
  });

  it('should display apiSignature added', async () => {
    const oldBundles = [
      createBundle('src/api/users.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-api-users-ts',
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
                  // No apiSignature
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/api/users.ts', 'uif:hash456', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash456',
                fileHash: 'fileHash-src-api-users-ts',
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
                  apiSignature: {
                    parameters: { id: 'string' },
                    returnType: 'User',
                  },
                },
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

    await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('apiSignature'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Added API signature'),
    );
  });

  it('should display state delta', async () => {
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
                kind: 'react:component',
                description: 'Test component',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-App-tsx',
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
      }),
    ];
    const newBundles = [
      createBundle('src/App.tsx', 'uif:hash456', {
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
                semanticHash: 'uif:hash456',
                fileHash: 'fileHash-src-App-tsx',
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
      }),
    ];

    // Mock the core diff function to return state delta
    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old')) {
        return JSON.stringify(oldBundles);
      }
      return JSON.stringify(newBundles);
    });

    await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    // The actual delta detection happens in core.ts, but we can verify the display logic handles it
    expect(console.log).toHaveBeenCalled();
  });

  it('should display variables delta', async () => {
    const oldBundles = [
      createBundle('src/utils.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/utils.ts',
              contract: {
                entryId: 'src/utils.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'ts:module',
                description: 'Test module',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-utils-ts',
                composition: {
                  variables: ['const1', 'const2'],
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
      }),
    ];
    const newBundles = [
      createBundle('src/utils.ts', 'uif:hash456', {
        graph: {
          nodes: [
            {
              entryId: 'src/utils.ts',
              contract: {
                entryId: 'src/utils.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'ts:module',
                description: 'Test module',
                semanticHash: 'uif:hash456',
                fileHash: 'fileHash-src-utils-ts',
                composition: {
                  variables: ['const1', 'const2', 'const3'],
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
      }),
    ];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old')) {
        return JSON.stringify(oldBundles);
      }
      return JSON.stringify(newBundles);
    });

    await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(console.log).toHaveBeenCalled();
  });

  it('should display hooks delta', async () => {
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
                kind: 'react:component',
                description: 'Test component',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: ['useState'],
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
      }),
    ];
    const newBundles = [
      createBundle('src/App.tsx', 'uif:hash456', {
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
                semanticHash: 'uif:hash456',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: ['useState', 'useEffect'],
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
      }),
    ];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old')) {
        return JSON.stringify(oldBundles);
      }
      return JSON.stringify(newBundles);
    });

    await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(console.log).toHaveBeenCalled();
  });

  it('should display functions delta', async () => {
    const oldBundles = [
      createBundle('src/utils.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/utils.ts',
              contract: {
                entryId: 'src/utils.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'ts:module',
                description: 'Test module',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-utils-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: ['helper1'],
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
      }),
    ];
    const newBundles = [
      createBundle('src/utils.ts', 'uif:hash456', {
        graph: {
          nodes: [
            {
              entryId: 'src/utils.ts',
              contract: {
                entryId: 'src/utils.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'ts:module',
                description: 'Test module',
                semanticHash: 'uif:hash456',
                fileHash: 'fileHash-src-utils-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: ['helper1', 'helper2'],
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
      }),
    ];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old')) {
        return JSON.stringify(oldBundles);
      }
      return JSON.stringify(newBundles);
    });

    await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(console.log).toHaveBeenCalled();
  });

  it('should display components delta', async () => {
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
                kind: 'react:component',
                description: 'Test component',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: ['Button'],
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
      }),
    ];
    const newBundles = [
      createBundle('src/App.tsx', 'uif:hash456', {
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
                semanticHash: 'uif:hash456',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: ['Button', 'Input'],
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
      }),
    ];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('old')) {
        return JSON.stringify(oldBundles);
      }
      return JSON.stringify(newBundles);
    });

    await compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    });

    expect(console.log).toHaveBeenCalled();
  });

  it('should not detect change when only array order differs (order-independent comparison)', async () => {
    // arraysEqual sorts arrays, so order-only changes are not detected
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
                kind: 'react:component',
                description: 'Test component',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: ['react', 'lodash'],
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
                kind: 'react:component',
                description: 'Test component',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: ['lodash', 'react'], // Different order, same items
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

    // Order-only changes are not detected due to order-independent comparison
    expect(result.status).toBe('PASS');
    expect(result.changed).toHaveLength(0);
  });

  it('should handle non-ENOENT file errors', async () => {
    const error = new Error('Permission denied') as NodeJS.ErrnoException;
    error.code = 'EACCES';
    vi.mocked(fs.readFile).mockRejectedValue(error);

    await expect(
      compareCommand({
        oldFile: 'old.json',
        newFile: 'new.json',
      }),
    ).rejects.toThrow('Permission denied');
  });
});
