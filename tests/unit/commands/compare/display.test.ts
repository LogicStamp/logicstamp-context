/**
 * Unit tests for display formatting of compare results
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { displayMultiFileCompareResult } from '../../../../src/cli/commands/compare/display.js';
import type { MultiFileCompareResult } from '../../../../src/cli/commands/compare/types.js';

// Mock tokens module
vi.mock('../../../../src/utils/tokens.js', () => ({
  formatTokenCount: vi.fn((n: number) => `${n}`),
}));

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

  it('should display state delta details', () => {
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
                    type: 'state',
                    old: { count: 0, name: 'test' },
                    new: { count: 1, name: 'test', active: true },
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

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('state'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('+ active'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('~ count'));
  });

  it('should display props delta details', () => {
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
                id: 'src/Button.tsx',
                deltas: [
                  {
                    type: 'props',
                    old: { label: 'string', disabled: 'boolean' },
                    new: { label: 'string', disabled: 'boolean', variant: 'string' },
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

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('props'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('+ variant'));
  });

  it('should display emits delta details', () => {
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
                id: 'src/Button.tsx',
                deltas: [
                  {
                    type: 'emits',
                    old: { onClick: '() => void' },
                    new: { onClick: '() => void', onHover: '() => void' },
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

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('emits'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('+ onHover'));
  });

  it('should display apiSignature delta details', () => {
    const result: MultiFileCompareResult = {
      status: 'DRIFT',
      folders: [
        {
          folderPath: 'src/api',
          contextFile: 'src/api/context.json',
          status: 'DRIFT',
          componentResult: {
            status: 'DRIFT',
            added: [],
            removed: [],
            changed: [
              {
                id: 'src/api/users.ts',
                deltas: [
                  {
                    type: 'apiSignature',
                    old: {
                      parameters: { id: 'string' },
                      returnType: 'User',
                    },
                    new: {
                      parameters: { id: 'string', includeDeleted: 'boolean' },
                      returnType: 'User',
                    },
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

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('apiSignature'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('parameters.includeDeleted'));
  });

  it('should display apiSignature returnType changes', () => {
    const result: MultiFileCompareResult = {
      status: 'DRIFT',
      folders: [
        {
          folderPath: 'src/api',
          contextFile: 'src/api/context.json',
          status: 'DRIFT',
          componentResult: {
            status: 'DRIFT',
            added: [],
            removed: [],
            changed: [
              {
                id: 'src/api/users.ts',
                deltas: [
                  {
                    type: 'apiSignature',
                    old: {
                      parameters: { id: 'string' },
                      returnType: 'User',
                    },
                    new: {
                      parameters: { id: 'string' },
                      returnType: 'UserResponse',
                    },
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

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('apiSignature'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('returnType'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('User → UserResponse'));
  });

  it('should display apiSignature added', () => {
    const result: MultiFileCompareResult = {
      status: 'DRIFT',
      folders: [
        {
          folderPath: 'src/api',
          contextFile: 'src/api/context.json',
          status: 'DRIFT',
          componentResult: {
            status: 'DRIFT',
            added: [],
            removed: [],
            changed: [
              {
                id: 'src/api/users.ts',
                deltas: [
                  {
                    type: 'apiSignature',
                    old: null,
                    new: {
                      parameters: { id: 'string' },
                      returnType: 'User',
                    },
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

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('apiSignature'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Added API signature'));
  });

  it('should display variables delta details', () => {
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
                    type: 'variables',
                    old: ['const1', 'const2'],
                    new: ['const1', 'const2', 'const3'],
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

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('variables'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('+ const3'));
  });

  it('should display hooks delta details', () => {
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
                    type: 'hooks',
                    old: ['useState'],
                    new: ['useState', 'useEffect'],
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

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('hooks'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('+ useEffect'));
  });

  it('should display functions delta details', () => {
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
                    type: 'functions',
                    old: ['helper1'],
                    new: ['helper1', 'helper2'],
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

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('functions'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('+ helper2'));
  });

  it('should display components delta details', () => {
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
                    type: 'components',
                    old: ['Button'],
                    new: ['Button', 'Input'],
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

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('components'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('+ Input'));
  });

  it('should display removed items in deltas', () => {
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
                    new: ['react'],
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

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('- lodash'));
  });

  it('should display multiple deltas for same component', () => {
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
                  {
                    type: 'hooks',
                    old: ['useState'],
                    new: ['useState', 'useEffect'],
                  },
                  {
                    type: 'props',
                    old: ['title'],
                    new: ['title', 'subtitle'],
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
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('hooks'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('props'));
  });

  it('should handle empty folders array', () => {
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

    displayMultiFileCompareResult(result, false, false);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('PASS'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Total folders: 0'));
  });

  it('should display token delta with negative values', () => {
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
          tokenDelta: { gpt4: -50, claude: -75 },
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
});
