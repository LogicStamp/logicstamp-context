import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  compareCommand,
  multiFileCompare,
  displayMultiFileCompareResult,
  cleanOrphanedFiles,
  type CompareResult,
  type MultiFileCompareResult,
} from '../../../src/cli/commands/compare/index.js';
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
                  semanticHash: 'uif:oldhash',
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
        createBundle('src/App.tsx', 'uif:newhash', {
          graph: {
            nodes: [
              {
                entryId: 'src/App.tsx',
                contract: {
                  entryId: 'src/App.tsx',
                  type: 'UIFContract',
                  schemaVersion: '0.4',
                  semanticHash: 'uif:newhash',
                  composition: {
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

    await expect(compareCommand({
      oldFile: 'old.json',
      newFile: 'new.json',
    })).rejects.toThrow('File not found');
  });

  it('should detect hook changes', async () => {
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
                  imports: [],
                  hooks: ['useState'],
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
                  imports: [],
                  hooks: ['useState', 'useEffect'],
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
      type: 'hooks',
      old: ['useState'],
      new: ['useState', 'useEffect'],
    });
  });

  it('should detect function changes', async () => {
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
                semanticHash: 'uif:hash123',
                composition: {
                  imports: [],
                  hooks: [],
                  functions: ['formatDate'],
                  components: [],
                },
                interface: { props: {}, emits: {} },
                exports: 'named',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/utils.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/utils.ts',
              contract: {
                entryId: 'src/utils.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                semanticHash: 'uif:hash123',
                composition: {
                  imports: [],
                  hooks: [],
                  functions: ['formatDate', 'parseDate'],
                  components: [],
                },
                interface: { props: {}, emits: {} },
                exports: 'named',
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
      type: 'functions',
      old: ['formatDate'],
      new: ['formatDate', 'parseDate'],
    });
  });

  it('should detect component composition changes', async () => {
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
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: ['Header'],
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
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: ['Header', 'Footer'],
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
      type: 'components',
      old: ['Header'],
      new: ['Header', 'Footer'],
    });
  });

  it('should detect props changes', async () => {
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
                semanticHash: 'uif:hash123',
                composition: {
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: { label: { type: 'string' } },
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
      createBundle('src/Button.tsx', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/Button.tsx',
              contract: {
                entryId: 'src/Button.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                semanticHash: 'uif:hash123',
                composition: {
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: { label: { type: 'string' }, disabled: { type: 'boolean' } },
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

    expect(result.status).toBe('DRIFT');
    expect(result.changed[0].deltas).toContainEqual({
      type: 'props',
      old: ['label'],
      new: ['label', 'disabled'],
    });
  });

  it('should detect emits changes', async () => {
    const oldBundles = [
      createBundle('src/Form.tsx', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/Form.tsx',
              contract: {
                entryId: 'src/Form.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                semanticHash: 'uif:hash123',
                composition: {
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: { onSubmit: { type: 'function' } },
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
      createBundle('src/Form.tsx', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/Form.tsx',
              contract: {
                entryId: 'src/Form.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                semanticHash: 'uif:hash123',
                composition: {
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: { onSubmit: { type: 'function' }, onCancel: { type: 'function' } },
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

    expect(result.status).toBe('DRIFT');
    expect(result.changed[0].deltas).toContainEqual({
      type: 'emits',
      old: ['onSubmit'],
      new: ['onSubmit', 'onCancel'],
    });
  });

  it('should detect variables changes', async () => {
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
                semanticHash: 'uif:hash123',
                composition: {
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                  variables: ['count'],
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
      createBundle('src/utils.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/utils.ts',
              contract: {
                entryId: 'src/utils.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                semanticHash: 'uif:hash123',
                composition: {
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                  variables: ['count', 'isOpen'],
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
      type: 'variables',
      old: ['count'],
      new: ['count', 'isOpen'],
    });
  });

  it('should detect state changes', async () => {
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
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  state: { count: 'number' },
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
                semanticHash: 'uif:hash123',
                composition: {
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  state: { count: 'number', isOpen: 'boolean' },
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

    expect(result.status).toBe('DRIFT');
    expect(result.changed[0].deltas).toContainEqual({
      type: 'state',
      old: { count: 'number' },
      new: { count: 'number', isOpen: 'boolean' },
    });
  });

  it('should detect state type changes', async () => {
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
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  state: { count: 'number' },
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
                semanticHash: 'uif:hash123',
                composition: {
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  state: { count: 'string' },
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

    expect(result.status).toBe('DRIFT');
    const stateDelta = result.changed[0].deltas.find(d => d.type === 'state');
    expect(stateDelta).toBeDefined();
    expect(stateDelta?.old).toEqual({ count: 'number' });
    expect(stateDelta?.new).toEqual({ count: 'string' });
  });

  it('should detect export kind changes', async () => {
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
                semanticHash: 'uif:hash123',
                composition: {
                  imports: [],
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
      createBundle('src/utils.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/utils.ts',
              contract: {
                entryId: 'src/utils.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                semanticHash: 'uif:hash123',
                composition: {
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: { props: {}, emits: {} },
                exports: { named: ['foo', 'bar'] },
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
      type: 'exports',
      old: 'default',
      new: 'named',
    });
  });

  it('should detect multiple delta types in one component', async () => {
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
                semanticHash: 'uif:oldhash',
                composition: {
                  imports: ['react'],
                  hooks: ['useState'],
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
                semanticHash: 'uif:newhash',
                composition: {
                  imports: ['react', 'lodash'],
                  hooks: ['useState', 'useEffect'],
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
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].deltas).toHaveLength(3); // hash, imports, hooks
    expect(result.changed[0].deltas.map(d => d.type)).toContain('hash');
    expect(result.changed[0].deltas.map(d => d.type)).toContain('imports');
    expect(result.changed[0].deltas.map(d => d.type)).toContain('hooks');
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
                composition: { imports: [], hooks: [], functions: [], components: [] },
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

  it('should ignore hash-only changes in gitBaseline mode', async () => {
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
      folders: [
        { path: 'src', contextFile: 'src/context.json', bundles: 1 },
      ],
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
                semanticHash: 'uif:oldhash',
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
      createBundle('src/App.tsx', 'uif:newhash', {
        graph: {
          nodes: [
            {
              entryId: 'src/App.tsx',
              contract: {
                entryId: 'src/App.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                semanticHash: 'uif:newhash',
                composition: {
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
    expect(result.folders[0].componentResult?.changed[0].deltas).toContainEqual({
      type: 'hash',
      old: 'uif:oldhash',
      new: 'uif:newhash',
    });
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
      expect.stringContaining('schema version 0.1')
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
      expect.stringContaining('Unknown schema version')
    );
  });

  it('should throw error when index file not found', async () => {
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(fs.readFile).mockRejectedValue(error);

    await expect(multiFileCompare({
      oldIndexFile: '/old/context_main.json',
      newIndexFile: '/new/context_main.json',
    })).rejects.toThrow('File not found');
  });

  it('should handle comparison failure for individual folders gracefully', async () => {
    const mockIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [
        { path: 'src', contextFile: 'src/context.json', bundles: 1 },
      ],
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
      expect.stringContaining('Failed to compare')
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
      folders: [
        { path: 'src', contextFile: 'src/context.json', bundles: 1 },
      ],
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
      folders: [
        { path: 'src', contextFile: 'src/context.json', bundles: 1 },
      ],
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
      folders: [
        { path: 'src', contextFile: 'src/context.json', bundles: 5 },
      ],
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
      folders: [
        { path: 'src', contextFile: 'src/context.json', bundles: 3 },
      ],
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

  it('should display orphaned folder details', () => {
    const result: MultiFileCompareResult = {
      status: 'DRIFT',
      folders: [
        {
          folderPath: 'lib',
          contextFile: 'lib/context.json',
          status: 'ORPHANED',
        },
      ],
      summary: {
        totalFolders: 1,
        addedFolders: 0,
        orphanedFolders: 1,
        driftFolders: 0,
        passFolders: 0,
        totalComponentsAdded: 0,
        totalComponentsRemoved: 1,
        totalComponentsChanged: 0,
      },
    };

    displayMultiFileCompareResult(result, false, false);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('ORPHANED FILE'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('lib/context.json'));
  });

  it('should display drift folder with component changes', () => {
    const result: MultiFileCompareResult = {
      status: 'DRIFT',
      folders: [
        {
          folderPath: 'src',
          contextFile: 'src/context.json',
          status: 'DRIFT',
          componentResult: {
            status: 'DRIFT',
            added: ['src/New.tsx'],
            removed: ['src/Old.tsx'],
            changed: [
              {
                id: 'src/App.tsx',
                deltas: [
                  { type: 'hash', old: 'old-hash', new: 'new-hash' },
                ],
              },
            ],
          },
        },
      ],
      summary: {
        totalFolders: 1,
        addedFolders: 0,
        orphanedFolders: 0,
        driftFolders: 1,
        passFolders: 0,
        totalComponentsAdded: 1,
        totalComponentsRemoved: 1,
        totalComponentsChanged: 1,
      },
    };

    displayMultiFileCompareResult(result, false, false);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('DRIFT'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Added components'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Removed components'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Changed components'));
  });

  it('should display orphaned files on disk', () => {
    const result: MultiFileCompareResult = {
      status: 'DRIFT',
      folders: [],
      summary: {
        totalFolders: 0,
        addedFolders: 0,
        orphanedFolders: 0,
        driftFolders: 0,
        passFolders: 0,
        totalComponentsAdded: 0,
        totalComponentsRemoved: 0,
        totalComponentsChanged: 0,
      },
      orphanedFiles: ['old/context.json', 'deprecated/context.json'],
    };

    displayMultiFileCompareResult(result, false, false);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Orphaned Files on Disk'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('old/context.json'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('deprecated/context.json'));
  });

  it('should display stats warning when stats enabled', () => {
    const result: MultiFileCompareResult = {
      status: 'PASS',
      folders: [],
      summary: {
        totalFolders: 0,
        addedFolders: 0,
        orphanedFolders: 0,
        driftFolders: 0,
        passFolders: 0,
        totalComponentsAdded: 0,
        totalComponentsRemoved: 0,
        totalComponentsChanged: 0,
      },
    };

    displayMultiFileCompareResult(result, true, false);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('tokenizer-based'));
  });

  it('should display token delta for drift folders when stats enabled', () => {
    const result: MultiFileCompareResult = {
      status: 'DRIFT',
      folders: [
        {
          folderPath: 'src',
          contextFile: 'src/context.json',
          status: 'DRIFT',
          componentResult: {
            status: 'DRIFT',
            added: [],
            removed: [],
            changed: [{ id: 'src/App.tsx', deltas: [{ type: 'hash', old: 'a', new: 'b' }] }],
          },
          tokenDelta: { gpt4: 150, claude: 200 },
        },
      ],
      summary: {
        totalFolders: 1,
        addedFolders: 0,
        orphanedFolders: 0,
        driftFolders: 1,
        passFolders: 0,
        totalComponentsAdded: 0,
        totalComponentsRemoved: 0,
        totalComponentsChanged: 1,
      },
    };

    displayMultiFileCompareResult(result, true, false);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Token'));
  });

  it('should skip PASS folders in quiet mode', () => {
    const result: MultiFileCompareResult = {
      status: 'DRIFT',
      folders: [
        {
          folderPath: 'src',
          contextFile: 'src/context.json',
          status: 'PASS',
        },
        {
          folderPath: 'lib',
          contextFile: 'lib/context.json',
          status: 'ADDED',
        },
      ],
      summary: {
        totalFolders: 2,
        addedFolders: 1,
        orphanedFolders: 0,
        driftFolders: 0,
        passFolders: 1,
        totalComponentsAdded: 1,
        totalComponentsRemoved: 0,
        totalComponentsChanged: 0,
      },
    };

    displayMultiFileCompareResult(result, false, true);

    // Should show ADDED but not PASS folder details
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('ADDED FILE'));
    // PASS folder should not show individual output in quiet mode
    const passCalls = (console.log as any).mock.calls.filter(
      (call: any[]) => call[0]?.includes?.('PASS: src/context.json')
    );
    expect(passCalls).toHaveLength(0);
  });

  it('should display import delta details', () => {
    const result: MultiFileCompareResult = {
      status: 'DRIFT',
      folders: [
        {
          folderPath: 'src',
          contextFile: 'src/context.json',
          status: 'DRIFT',
          componentResult: {
            status: 'DRIFT',
            added: [],
            removed: [],
            changed: [
              {
                id: 'src/App.tsx',
                deltas: [
                  {
                    type: 'imports',
                    old: ['react'],
                    new: ['react', 'lodash'],
                  },
                ],
              },
            ],
          },
        },
      ],
      summary: {
        totalFolders: 1,
        addedFolders: 0,
        orphanedFolders: 0,
        driftFolders: 1,
        passFolders: 0,
        totalComponentsAdded: 0,
        totalComponentsRemoved: 0,
        totalComponentsChanged: 1,
      },
    };

    displayMultiFileCompareResult(result, false, false);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('imports'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('+ lodash'));
  });

  it('should display export kind changes', () => {
    const result: MultiFileCompareResult = {
      status: 'DRIFT',
      folders: [
        {
          folderPath: 'src',
          contextFile: 'src/context.json',
          status: 'DRIFT',
          componentResult: {
            status: 'DRIFT',
            added: [],
            removed: [],
            changed: [
              {
                id: 'src/utils.ts',
                deltas: [
                  {
                    type: 'exports',
                    old: 'default',
                    new: 'named',
                  },
                ],
              },
            ],
          },
        },
      ],
      summary: {
        totalFolders: 1,
        addedFolders: 0,
        orphanedFolders: 0,
        driftFolders: 1,
        passFolders: 0,
        totalComponentsAdded: 0,
        totalComponentsRemoved: 0,
        totalComponentsChanged: 1,
      },
    };

    displayMultiFileCompareResult(result, false, false);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('exports'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('default → named'));
  });

  it('should display order changed indicator when items same but order differs', () => {
    const result: MultiFileCompareResult = {
      status: 'DRIFT',
      folders: [
        {
          folderPath: 'src',
          contextFile: 'src/context.json',
          status: 'DRIFT',
          componentResult: {
            status: 'DRIFT',
            added: [],
            removed: [],
            changed: [
              {
                id: 'src/App.tsx',
                deltas: [
                  {
                    type: 'imports',
                    old: ['react', 'lodash'],
                    new: ['lodash', 'react'],
                  },
                ],
              },
            ],
          },
        },
      ],
      summary: {
        totalFolders: 1,
        addedFolders: 0,
        orphanedFolders: 0,
        driftFolders: 1,
        passFolders: 0,
        totalComponentsAdded: 0,
        totalComponentsRemoved: 0,
        totalComponentsChanged: 1,
      },
    };

    displayMultiFileCompareResult(result, false, false);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('order changed'));
  });

  it('should display folder summary counts', () => {
    const result: MultiFileCompareResult = {
      status: 'DRIFT',
      folders: [],
      summary: {
        totalFolders: 10,
        addedFolders: 2,
        orphanedFolders: 1,
        driftFolders: 3,
        passFolders: 4,
        totalComponentsAdded: 5,
        totalComponentsRemoved: 2,
        totalComponentsChanged: 3,
      },
    };

    displayMultiFileCompareResult(result, false, false);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Total folders: 10'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Added folders: 2'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Orphaned folders: 1'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Changed folders: 3'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Unchanged folders: 4'));
  });

  it('should display component summary counts when drift', () => {
    const result: MultiFileCompareResult = {
      status: 'DRIFT',
      folders: [],
      summary: {
        totalFolders: 1,
        addedFolders: 0,
        orphanedFolders: 0,
        driftFolders: 1,
        passFolders: 0,
        totalComponentsAdded: 5,
        totalComponentsRemoved: 2,
        totalComponentsChanged: 3,
      },
    };

    displayMultiFileCompareResult(result, false, false);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Component Summary'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Added: 5'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Removed: 2'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Changed: 3'));
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
