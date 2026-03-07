/**
 * Unit tests for cleanup functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanOrphanedFiles } from '../../../../src/cli/commands/compare/cleanup.js';
import * as fs from 'node:fs/promises';

// Mock fs/promises
vi.mock('node:fs/promises');

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
