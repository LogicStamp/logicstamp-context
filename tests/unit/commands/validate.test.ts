import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateBundles,
  validateCommand,
  multiFileValidate,
} from '../../../src/cli/commands/validate.js';
import type { LogicStampBundle } from '../../../src/core/pack.js';
import * as fs from 'node:fs/promises';

// Mock fs/promises
vi.mock('node:fs/promises');

/**
 * Helper to create a minimal valid bundle for testing.
 * The validation logic only checks certain fields, so we use 'as any' for test data.
 */
function createValidBundle(overrides: Record<string, any> = {}): any {
  return {
    type: 'LogicStampBundle',
    schemaVersion: '0.1',
    entryId: 'src/App.tsx',
    bundleHash: 'uifb:abcdef123456789012345678',
    graph: {
      nodes: [
        {
          entryId: 'src/App.tsx',
          contract: {
            type: 'UIFContract',
            schemaVersion: '0.4',
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

describe('validateBundles', () => {
  it('should return valid result for correct bundles', () => {
    const bundles = [createValidBundle()];

    const result = validateBundles(bundles as LogicStampBundle[]);

    expect(result.valid).toBe(true);
    expect(result.errors).toBe(0);
    expect(result.warnings).toBe(0);
    expect(result.bundles).toBe(1);
    expect(result.nodes).toBe(1);
    expect(result.edges).toBe(0);
  });

  it('should return invalid result when input is not an array', () => {
    const result = validateBundles('not an array' as any);

    expect(result.valid).toBe(false);
    expect(result.errors).toBe(1);
    expect(result.messages).toContain(
      'Invalid format: expected array of bundles',
    );
  });

  it('should detect invalid bundle type', () => {
    const bundles = [
      {
        type: 'InvalidType',
        schemaVersion: '0.1',
        entryId: 'test',
        graph: { nodes: [], edges: [] },
        meta: { missing: [] },
      },
    ] as any;

    const result = validateBundles(bundles);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeGreaterThan(0);
    expect(result.messages.some((m) => m.includes('Invalid type'))).toBe(true);
  });

  it('should detect invalid schemaVersion', () => {
    const bundles = [
      {
        type: 'LogicStampBundle',
        schemaVersion: '0.2', // Wrong version
        entryId: 'test',
        graph: { nodes: [], edges: [] },
        meta: { missing: [] },
      },
    ] as any;

    const result = validateBundles(bundles);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeGreaterThan(0);
    expect(
      result.messages.some((m) => m.includes('Invalid schemaVersion')),
    ).toBe(true);
  });

  it('should detect missing entryId', () => {
    const bundles = [
      {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        // missing entryId
        graph: { nodes: [], edges: [] },
        meta: { missing: [] },
      },
    ] as any;

    const result = validateBundles(bundles);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeGreaterThan(0);
    expect(result.messages.some((m) => m.includes('Missing entryId'))).toBe(
      true,
    );
  });

  it('should detect invalid graph structure', () => {
    const bundles = [
      {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'test',
        graph: null, // Invalid
        meta: { missing: [] },
      },
    ] as any;

    const result = validateBundles(bundles);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeGreaterThan(0);
    expect(
      result.messages.some((m) => m.includes('Invalid graph structure')),
    ).toBe(true);
  });

  it('should detect invalid meta structure', () => {
    const bundles = [
      {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'test',
        graph: { nodes: [], edges: [] },
        meta: null, // Invalid
      },
    ] as any;

    const result = validateBundles(bundles);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeGreaterThan(0);
    expect(
      result.messages.some((m) => m.includes('Invalid meta structure')),
    ).toBe(true);
  });

  it('should detect invalid contract type in nodes', () => {
    const bundles = [
      {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'test',
        graph: {
          nodes: [
            {
              entryId: 'test',
              contract: {
                type: 'InvalidContract',
                schemaVersion: '0.4',
              },
            },
          ],
          edges: [],
        },
        meta: { missing: [] },
      },
    ] as any;

    const result = validateBundles(bundles);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeGreaterThan(0);
    expect(
      result.messages.some((m) => m.includes('invalid contract type')),
    ).toBe(true);
  });

  it('should warn about unexpected contract version', () => {
    const bundles = [
      {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'test',
        graph: {
          nodes: [
            {
              entryId: 'test',
              contract: {
                type: 'UIFContract',
                schemaVersion: '0.3', // Unexpected version
              },
            },
          ],
          edges: [],
        },
        meta: { missing: [] },
      },
    ] as any;

    const result = validateBundles(bundles);

    expect(result.warnings).toBeGreaterThan(0);
    expect(
      result.messages.some((m) => m.includes('unexpected contract version')),
    ).toBe(true);
  });

  it('should warn about unexpected bundleHash format', () => {
    const bundles = [
      {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'test',
        bundleHash: 'invalid-hash-format',
        graph: { nodes: [], edges: [] },
        meta: { missing: [] },
      },
    ] as any;

    const result = validateBundles(bundles);

    expect(result.warnings).toBeGreaterThan(0);
    expect(
      result.messages.some((m) =>
        m.includes('bundleHash has unexpected format'),
      ),
    ).toBe(true);
  });

  it('should count nodes and edges correctly', () => {
    const bundles = [
      createValidBundle({
        entryId: 'test1',
        graph: {
          nodes: [
            {
              entryId: 'a',
              contract: { type: 'UIFContract', schemaVersion: '0.4' },
            },
            {
              entryId: 'b',
              contract: { type: 'UIFContract', schemaVersion: '0.4' },
            },
          ],
          edges: [['a', 'b']],
        },
      }),
      createValidBundle({
        entryId: 'test2',
        graph: {
          nodes: [
            {
              entryId: 'c',
              contract: { type: 'UIFContract', schemaVersion: '0.4' },
            },
          ],
          edges: [],
        },
      }),
    ];

    const result = validateBundles(bundles as LogicStampBundle[]);

    expect(result.nodes).toBe(3);
    expect(result.edges).toBe(1);
    expect(result.bundles).toBe(2);
  });
});

describe('multiFileValidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should validate all context files from index', async () => {
    const mockIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [{ path: 'src', contextFile: 'src/context.json', bundles: 1 }],
    };

    const mockBundles = [createValidBundle({ entryId: 'src/App.tsx' })];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('context_main.json')) {
        return JSON.stringify(mockIndex);
      }
      if (pathStr.includes('context.json')) {
        return JSON.stringify(mockBundles);
      }
      throw new Error('File not found');
    });

    const result = await multiFileValidate('/project/context_main.json');

    expect(result.valid).toBe(true);
    expect(result.totalFolders).toBe(1);
    expect(result.validFolders).toBe(1);
    expect(result.invalidFolders).toBe(0);
  });

  it('should handle invalid index file type', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        type: 'WrongType',
        schemaVersion: '0.2',
        folders: [],
      }),
    );

    await expect(
      multiFileValidate('/project/context_main.json'),
    ).rejects.toThrow("Invalid index file: expected type 'LogicStampIndex'");
  });

  it('should handle file not found', async () => {
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(fs.readFile).mockRejectedValue(error);

    await expect(
      multiFileValidate('/project/context_main.json'),
    ).rejects.toThrow('File not found');
  });

  it('should mark folders as invalid when context file fails', async () => {
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
      throw new Error('Read error');
    });

    const result = await multiFileValidate('/project/context_main.json');

    expect(result.valid).toBe(false);
    expect(result.invalidFolders).toBe(1);
    expect(result.totalErrors).toBe(1);
  });

  it('should warn about legacy schema version 0.1', async () => {
    const mockIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.1', // Legacy version
      folders: [],
    };

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockIndex));

    await multiFileValidate('/project/context_main.json');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('schema version 0.1'),
    );
  });

  it('should warn about unknown schema version', async () => {
    const mockIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.9', // Unknown version
      folders: [],
    };

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockIndex));

    await multiFileValidate('/project/context_main.json');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown schema version'),
    );
  });
});

describe('validateCommand', () => {
  let exitCode: number | undefined;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalConsoleWarn: typeof console.warn;
  let originalStdoutWrite: typeof process.stdout.write;

  beforeEach(() => {
    exitCode = undefined;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    originalStdoutWrite = process.stdout.write;

    // Mock process.exit to record the code but not throw
    // This allows the function to complete normally
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      exitCode = code as number;
      return undefined as never;
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    process.stdout.write = originalStdoutWrite;
    vi.restoreAllMocks();
  });

  it('should validate a single valid file', async () => {
    const validBundles = [createValidBundle()];

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validBundles));

    await validateCommand('test.json');

    expect(exitCode).toBe(0);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Valid context file'),
    );
  });

  it('should exit with 1 for invalid bundles', async () => {
    const invalidBundles = [
      {
        type: 'InvalidType',
        schemaVersion: '0.1',
        entryId: 'test',
        graph: { nodes: [], edges: [] },
        meta: { missing: [], source: 'test' },
      },
    ];

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(invalidBundles));

    await validateCommand('test.json');

    expect(exitCode).toBe(1);
  });

  it('should handle file not found error', async () => {
    const error = new Error('File not found') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(fs.readFile).mockRejectedValue(error);

    await validateCommand('nonexistent.json');

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('File not found'),
    );
  });

  it('should handle invalid JSON', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('not valid json');

    await validateCommand('invalid.json');

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid JSON'),
    );
  });

  it('should handle non-array content', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ not: 'array' }));

    await validateCommand('test.json');

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('expected array of bundles'),
    );
  });

  it('should output minimal in quiet mode for valid file', async () => {
    const validBundles = [createValidBundle()];

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(validBundles));

    await validateCommand('test.json', true);

    expect(exitCode).toBe(0);
    expect(process.stdout.write).toHaveBeenCalledWith('✓\n');
  });

  it('should fall back to context.json when no file specified and no context_main.json', async () => {
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';

    const validBundles = [createValidBundle()];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('context_main.json')) {
        throw error;
      }
      return JSON.stringify(validBundles);
    });

    await validateCommand(undefined);

    expect(exitCode).toBe(0);
  });

  it('should use multi-file mode when context_main.json exists', async () => {
    const mockIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [{ path: 'src', contextFile: 'src/context.json', bundles: 1 }],
    };

    const mockBundles = [createValidBundle({ entryId: 'src/App.tsx' })];

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path);
      if (pathStr.includes('context_main.json')) {
        return JSON.stringify(mockIndex);
      }
      if (pathStr.includes('context.json')) {
        return JSON.stringify(mockBundles);
      }
      throw new Error(`Unexpected file read: ${pathStr}`);
    });

    await validateCommand(undefined);

    expect(exitCode).toBe(0);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Validating all context files'),
    );
  });
});
