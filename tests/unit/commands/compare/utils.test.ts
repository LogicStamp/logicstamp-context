/**
 * Unit tests for compare utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateTokens,
  loadIndex,
  findOrphanedFiles,
} from '../../../../src/cli/commands/compare/utils.js';
import * as fs from 'node:fs/promises';
import type { LogicStampBundle } from '../../../../src/core/pack.js';

// Mock fs/promises
vi.mock('node:fs/promises');

// Mock tokens module
vi.mock('../../../../src/utils/tokens.js', () => ({
  estimateGPT4Tokens: vi.fn((text: string) => Promise.resolve(text.length)),
  estimateClaudeTokens: vi.fn((text: string) => Promise.resolve(Math.ceil(text.length * 1.2))),
}));

// Mock debug module
vi.mock('../../../../src/utils/debug.js', () => ({
  debugError: vi.fn(),
}));

/**
 * Helper to create a minimal valid bundle for testing
 */
function createBundle(entryId: string, semanticHash: string, overrides: Record<string, any> = {}): LogicStampBundle {
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

describe('calculateTokens', () => {
  it('should return token counts for bundles', async () => {
    const { estimateGPT4Tokens, estimateClaudeTokens } = await import('../../../../src/utils/tokens.js');
    vi.mocked(estimateGPT4Tokens).mockResolvedValue(1000);
    vi.mocked(estimateClaudeTokens).mockResolvedValue(1200);

    const bundles = [createBundle('src/App.tsx', 'uif:hash123')];
    const result = await calculateTokens(bundles);

    expect(result).toEqual({ gpt4: 1000, claude: 1200 });
    expect(estimateGPT4Tokens).toHaveBeenCalledWith(JSON.stringify(bundles));
    expect(estimateClaudeTokens).toHaveBeenCalledWith(JSON.stringify(bundles));
  });

  it('should handle empty bundles', async () => {
    const { estimateGPT4Tokens, estimateClaudeTokens } = await import('../../../../src/utils/tokens.js');
    vi.mocked(estimateGPT4Tokens).mockResolvedValue(0);
    vi.mocked(estimateClaudeTokens).mockResolvedValue(0);

    const result = await calculateTokens([]);

    expect(result).toEqual({ gpt4: 0, claude: 0 });
    expect(estimateGPT4Tokens).toHaveBeenCalledWith('[]');
  });
});

describe('loadIndex', () => {
  let originalConsoleWarn: typeof console.warn;

  beforeEach(() => {
    originalConsoleWarn = console.warn;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.warn = originalConsoleWarn;
    vi.restoreAllMocks();
  });

  it('should load valid LogicStampIndex from file', async () => {
    const mockIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.2',
      folders: [
        { path: 'src', contextFile: 'src/context.json', bundles: 1 },
      ],
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockIndex));

    const result = await loadIndex('/path/to/context_main.json');

    expect(result).toEqual(mockIndex);
    expect(result.type).toBe('LogicStampIndex');
    expect(result.folders).toHaveLength(1);
  });

  it('should throw when file not found', async () => {
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(fs.readFile).mockRejectedValue(error);

    await expect(loadIndex('/nonexistent/context_main.json')).rejects.toThrow('File not found');
  });

  it('should throw when index type is invalid', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      type: 'InvalidType',
      schemaVersion: '0.2',
      folders: [],
    }));

    await expect(loadIndex('/path/to/context_main.json')).rejects.toThrow(
      "Invalid index file: expected type 'LogicStampIndex'"
    );
  });

  it('should throw when JSON is invalid', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('invalid json');

    await expect(loadIndex('/path/to/context_main.json')).rejects.toThrow('Failed to load index');
  });

  it('should warn about legacy schema version 0.1', async () => {
    const mockIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.1',
      folders: [],
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockIndex));

    await loadIndex('/path/to/context_main.json');

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

    await loadIndex('/path/to/context_main.json');

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown schema version')
    );
  });
});

describe('findOrphanedFiles', () => {
  it('should return orphaned context files that exist on disk', async () => {
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

    const mockContent = JSON.stringify([{ type: 'LogicStampBundle' }]);

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path).replace(/\\/g, '/');
      if (pathStr.includes('lib/context.json')) {
        return mockContent;
      }
      throw new Error('ENOENT');
    });

    const result = await findOrphanedFiles(
      oldIndex as any,
      newIndex as any,
      '/project'
    );

    expect(result).toContain('lib/context.json');
  });

  it('should not include files that no longer exist on disk', async () => {
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

    const enoentError = new Error('ENOENT') as NodeJS.ErrnoException;
    enoentError.code = 'ENOENT';

    vi.mocked(fs.readFile).mockImplementation(async (path) => {
      const pathStr = String(path).replace(/\\/g, '/');
      if (pathStr.includes('lib/context.json')) {
        throw enoentError;
      }
      return JSON.stringify([]);
    });

    const result = await findOrphanedFiles(
      oldIndex as any,
      newIndex as any,
      '/project'
    );

    expect(result).not.toContain('lib/context.json');
    expect(result).toHaveLength(0);
  });

  it('should return empty array when no orphaned files', async () => {
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
      ],
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify([]));

    const result = await findOrphanedFiles(
      oldIndex as any,
      newIndex as any,
      '/project'
    );

    expect(result).toHaveLength(0);
  });
});
