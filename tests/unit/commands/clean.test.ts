import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanCommand, type CleanOptions } from '../../../src/cli/commands/clean.js';
import * as fsx from '../../../src/utils/fsx.js';
import { unlink, rm, stat } from 'node:fs/promises';
import { glob } from 'glob';
import { relative } from 'node:path';

// Mock dependencies
vi.mock('../../../src/utils/fsx.js', () => ({
  fileExists: vi.fn(),
  normalizeEntryId: vi.fn((path: string) => {
    if (!path) return '';
    return String(path).replace(/\\/g, '/');
  }),
}));
vi.mock('node:fs/promises');
vi.mock('glob');

describe('cleanCommand', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalStdoutWrite: typeof process.stdout.write;
  let mockStdoutWrite: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalStdoutWrite = process.stdout.write;
    mockStdoutWrite = vi.fn();
    process.stdout.write = mockStdoutWrite as typeof process.stdout.write;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();

    // Default mock implementations - normalizeEntryId should always return a string
    vi.mocked(fsx.normalizeEntryId).mockImplementation((path: string) => {
      if (!path) return '';
      // Simulate the actual normalizeEntryId behavior: normalize and replace backslashes
      return String(path).replace(/\\/g, '/');
    });
    vi.mocked(fsx.fileExists).mockResolvedValue(false);
    vi.mocked(glob).mockResolvedValue([]);
    vi.mocked(stat).mockRejectedValue(new Error('Not found'));
    vi.mocked(unlink).mockResolvedValue(undefined);
    vi.mocked(rm).mockResolvedValue(undefined);
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.stdout.write = originalStdoutWrite;
    vi.restoreAllMocks();
  });

  describe('Error handling', () => {
    it('should handle unlink errors gracefully and show error message', async () => {
      const projectRoot = '/test/project';
      const testFile = 'context_main.json';

      vi.mocked(glob).mockResolvedValue([]);
      vi.mocked(fsx.fileExists).mockResolvedValue(true);
      vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));
      vi.mocked(unlink).mockRejectedValue(new Error('Permission denied'));

      await cleanCommand({
        projectRoot,
        all: true,
        yes: true,
      });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to remove')
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied')
      );
    });

    it('should handle rm errors gracefully and show error message', async () => {
      const projectRoot = '/test/project';
      const logicStampPath = '/test/project/.logicstamp';

      vi.mocked(glob).mockResolvedValue([]);
      vi.mocked(fsx.fileExists).mockResolvedValue(false);
      vi.mocked(stat).mockResolvedValue({
        isDirectory: () => true,
      } as Awaited<ReturnType<typeof stat>>);
      vi.mocked(rm).mockRejectedValue(new Error('Directory locked'));

      await cleanCommand({
        projectRoot,
        all: true,
        yes: true,
      });

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to remove')
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Directory locked')
      );
    });

    it('should continue deleting other files even if one fails', async () => {
      const projectRoot = '/test/project';
      const files = ['context_main.json', 'src/context.json'];

      vi.mocked(glob).mockResolvedValue(['src/context.json']);
      vi.mocked(fsx.fileExists).mockResolvedValue(true);
      vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));
      
      // First unlink succeeds, second fails
      vi.mocked(unlink)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('File not found'));

      await cleanCommand({
        projectRoot,
        all: true,
        yes: true,
      });

      expect(unlink).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to remove')
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle .logicstamp as file (not directory)', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue([]);
      vi.mocked(fsx.fileExists).mockResolvedValue(false);
      // stat succeeds but isDirectory returns false (it's a file, not a directory)
      vi.mocked(stat).mockResolvedValue({
        isDirectory: () => false,
      } as Awaited<ReturnType<typeof stat>>);

      await cleanCommand({
        projectRoot,
        all: true,
        yes: true,
      });

      // Should not try to delete .logicstamp since it's not a directory
      expect(rm).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No context artifacts found')
      );
    });

    it('should show correct message when only .logicstamp exists (no context files)', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue([]);
      vi.mocked(fsx.fileExists).mockResolvedValue(false);
      vi.mocked(stat).mockResolvedValue({
        isDirectory: () => true,
      } as Awaited<ReturnType<typeof stat>>);

      await cleanCommand({
        projectRoot,
      });

      // Should show .logicstamp/ in the list
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('🧹 This will remove:')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('.logicstamp/')
      );
    });

    it('should show correct message when only context files exist (no .logicstamp)', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue(['src/context.json']);
      vi.mocked(fsx.fileExists).mockResolvedValue(true);
      vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));

      await cleanCommand({
        projectRoot,
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('🧹 This will remove:')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('context_main.json')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('src/context.json')
      );
      // Should not show .logicstamp/
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('.logicstamp/')
      );
    });

    it('should handle case when mainContextFile is null in display section', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue(['src/context.json']);
      vi.mocked(fsx.fileExists).mockResolvedValue(false); // mainContextFile doesn't exist
      vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));

      await cleanCommand({
        projectRoot,
      });

      // Should not show context_main.json in the list
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('context_main.json')
      );
      // Should still show context.json files
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('src/context.json')
      );
    });

    it('should handle case when logicStampDir is null in display section', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue(['src/context.json']);
      vi.mocked(fsx.fileExists).mockResolvedValue(true);
      vi.mocked(stat).mockRejectedValue(new Error('Directory not found')); // .logicstamp doesn't exist

      await cleanCommand({
        projectRoot,
      });

      // Should not show .logicstamp/ in the list
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('.logicstamp/')
      );
    });
  });

  describe('Quiet mode', () => {
    it('should suppress verbose output in quiet mode during deletion', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue(['src/context.json']);
      vi.mocked(fsx.fileExists).mockResolvedValue(true);
      vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));
      vi.mocked(unlink).mockResolvedValue(undefined);

      await cleanCommand({
        projectRoot,
        all: true,
        yes: true,
        quiet: true,
      });

      // Should not show verbose messages
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('🧹 This will remove:')
      );
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('🗑️  Removing files')
      );
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Removed')
      );
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Cleaned')
      );
      
      // Should output just ✓
      expect(mockStdoutWrite).toHaveBeenCalledWith('✓\n');
    });

    it('should output ✓ when no files found in quiet mode', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue([]);
      vi.mocked(fsx.fileExists).mockResolvedValue(false);
      vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));

      await cleanCommand({
        projectRoot,
        quiet: true,
      });

      expect(mockStdoutWrite).toHaveBeenCalledWith('✓\n');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should still show errors in quiet mode', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue(['src/context.json']);
      vi.mocked(fsx.fileExists).mockResolvedValue(true);
      vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));
      vi.mocked(unlink).mockRejectedValue(new Error('Permission denied'));

      await cleanCommand({
        projectRoot,
        all: true,
        yes: true,
        quiet: true,
      });

      // Errors should still be shown even in quiet mode
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to remove')
      );
    });
  });

  describe('Success messages', () => {
    it('should show correct message when files and directory are cleaned', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue(['src/context.json']);
      vi.mocked(fsx.fileExists).mockResolvedValue(true);
      vi.mocked(stat).mockResolvedValue({
        isDirectory: () => true,
      } as Awaited<ReturnType<typeof stat>>);
      vi.mocked(unlink).mockResolvedValue(undefined);
      vi.mocked(rm).mockResolvedValue(undefined);

      await cleanCommand({
        projectRoot,
        all: true,
        yes: true,
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned 2 file(s) and 1 directory')
      );
    });

    it('should show correct message when only files are cleaned (no directory)', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue(['src/context.json']);
      vi.mocked(fsx.fileExists).mockResolvedValue(true);
      vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));
      vi.mocked(unlink).mockResolvedValue(undefined);

      await cleanCommand({
        projectRoot,
        all: true,
        yes: true,
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned 2 file(s)')
      );
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('and 1 directory')
      );
    });
  });

  describe('Dry run mode', () => {
    it('should not delete files without --all --yes flags', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue(['src/context.json']);
      vi.mocked(fsx.fileExists).mockResolvedValue(true);
      vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));

      await cleanCommand({
        projectRoot,
        // No all or yes flags
      });

      expect(unlink).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Run with --all --yes')
      );
    });

    it('should not delete files with only --all flag (missing --yes)', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue(['src/context.json']);
      vi.mocked(fsx.fileExists).mockResolvedValue(true);
      vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));

      await cleanCommand({
        projectRoot,
        all: true,
        // Missing yes flag
      });

      expect(unlink).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Run with --all --yes')
      );
    });

    it('should not delete files with only --yes flag (missing --all)', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue(['src/context.json']);
      vi.mocked(fsx.fileExists).mockResolvedValue(true);
      vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));

      await cleanCommand({
        projectRoot,
        yes: true,
        // Missing all flag
      });

      expect(unlink).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Run with --all --yes')
      );
    });

    it('should suppress dry run message in quiet mode', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue(['src/context.json']);
      vi.mocked(fsx.fileExists).mockResolvedValue(true);
      vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));

      await cleanCommand({
        projectRoot,
        quiet: true,
      });

      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Run with --all --yes')
      );
    });
  });

  describe('Path display', () => {
    it('should normalize paths for display (backslashes to forward slashes)', async () => {
      const projectRoot = 'C:\\test\\project';

      vi.mocked(glob).mockResolvedValue(['src\\components\\context.json']);
      vi.mocked(fsx.fileExists).mockResolvedValue(true);
      vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));

      await cleanCommand({
        projectRoot,
      });

      // Should display paths with forward slashes
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('src/components/context.json')
      );
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('src\\components\\context.json')
      );
    });
  });

  describe('Early exit when no files', () => {
    it('should exit early when no files and no .logicstamp directory', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue([]);
      vi.mocked(fsx.fileExists).mockResolvedValue(false);
      vi.mocked(stat).mockRejectedValue(new Error('Directory not found'));

      await cleanCommand({
        projectRoot,
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No context artifacts found')
      );
      expect(unlink).not.toHaveBeenCalled();
      expect(rm).not.toHaveBeenCalled();
    });

    it('should not exit early when .logicstamp exists even if no files', async () => {
      const projectRoot = '/test/project';

      vi.mocked(glob).mockResolvedValue([]);
      vi.mocked(fsx.fileExists).mockResolvedValue(false);
      vi.mocked(stat).mockResolvedValue({
        isDirectory: () => true,
      } as Awaited<ReturnType<typeof stat>>);

      await cleanCommand({
        projectRoot,
        all: true,
        yes: true,
      });

      // Should proceed to delete .logicstamp
      expect(rm).toHaveBeenCalled();
    });
  });
});
