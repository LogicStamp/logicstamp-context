import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleCompare } from '../../../src/cli/handlers/compareHandler.js';
import * as parser from '../../../src/cli/parser/index.js';
import * as initHandler from '../../../src/cli/handlers/initHandler.js';

// Use vi.hoisted to create mocks that are available when vi.mock is hoisted
const {
  mockExistsSync,
  mockMkdir,
  mockRm,
  mockCopyFile,
  mockReadFile,
  mockWriteFile,
  mockContextCommand,
  mockCompareCommand,
  mockMultiFileCompare,
  mockDisplayMultiFileCompareResult,
  mockCleanOrphanedFiles,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockMkdir: vi.fn(),
  mockRm: vi.fn(),
  mockCopyFile: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockContextCommand: vi.fn(),
  mockCompareCommand: vi.fn(),
  mockMultiFileCompare: vi.fn(),
  mockDisplayMultiFileCompareResult: vi.fn(),
  mockCleanOrphanedFiles: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
}));

vi.mock('node:fs/promises', () => ({
  mkdir: mockMkdir,
  rm: mockRm,
  copyFile: mockCopyFile,
  readFile: mockReadFile,
  writeFile: mockWriteFile,
}));

vi.mock('../../../src/cli/commands/context.js', () => ({
  contextCommand: mockContextCommand,
}));

vi.mock('../../../src/cli/commands/compare.js', () => ({
  compareCommand: mockCompareCommand,
  multiFileCompare: mockMultiFileCompare,
  displayMultiFileCompareResult: mockDisplayMultiFileCompareResult,
  cleanOrphanedFiles: mockCleanOrphanedFiles,
}));

describe('handleCompare', () => {
  let originalExit: typeof process.exit;
  let originalConsoleError: typeof console.error;
  let originalConsoleLog: typeof console.log;
  let originalIsTTY: typeof process.stdout.isTTY;
  let originalStdinIsTTY: typeof process.stdin.isTTY;

  beforeEach(() => {
    originalExit = process.exit;
    originalConsoleError = console.error;
    originalConsoleLog = console.log;
    originalIsTTY = process.stdout.isTTY;
    originalStdinIsTTY = process.stdin.isTTY;

    // Reset all mocks (clears implementations AND call history)
    mockExistsSync.mockReset();
    mockMkdir.mockReset();
    mockRm.mockReset();
    mockCopyFile.mockReset();
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
    mockContextCommand.mockReset();
    mockCompareCommand.mockReset();
    mockMultiFileCompare.mockReset();
    mockDisplayMultiFileCompareResult.mockReset();
    mockCleanOrphanedFiles.mockReset();

    // Set default mock implementations
    mockExistsSync.mockReturnValue(true);
    mockMkdir.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);
    mockCopyFile.mockResolvedValue(undefined);
    mockReadFile.mockResolvedValue(JSON.stringify({ folders: [] }));
    mockWriteFile.mockResolvedValue(undefined);
    mockContextCommand.mockResolvedValue(undefined);
    mockCompareCommand.mockResolvedValue({ status: 'IDENTICAL' });
    mockMultiFileCompare.mockResolvedValue({ status: 'IDENTICAL', folderResults: [] });
    mockDisplayMultiFileCompareResult.mockImplementation(() => {});
    mockCleanOrphanedFiles.mockResolvedValue(0);

    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock TTY to false for non-interactive tests
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exit = originalExit;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, writable: true });
  });

  it('should show help when --help flag is provided', async () => {
    const printFoxSpy = vi.spyOn(initHandler, 'printFoxIcon').mockImplementation(() => {});
    const getHelpSpy = vi.spyOn(parser, 'getCompareHelp').mockReturnValue('Compare help text');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Exit called with code ${code}`);
    });

    await expect(handleCompare(['--help'])).rejects.toThrow('Exit called with code 0');

    expect(printFoxSpy).toHaveBeenCalled();
    expect(getHelpSpy).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Compare help text');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should show help when -h flag is provided', async () => {
    const printFoxSpy = vi.spyOn(initHandler, 'printFoxIcon').mockImplementation(() => {});
    const getHelpSpy = vi.spyOn(parser, 'getCompareHelp').mockReturnValue('Compare help text');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Exit called with code ${code}`);
    });

    await expect(handleCompare(['-h'])).rejects.toThrow('Exit called with code 0');

    expect(printFoxSpy).toHaveBeenCalled();
    expect(getHelpSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should reject --compare-modes flag', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Exit called with code ${code}`);
    });

    await expect(handleCompare(['--compare-modes'])).rejects.toThrow('Exit called with code 1');

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('--compare-modes is not available')
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should show help when less than 2 files provided', async () => {
    const printFoxSpy = vi.spyOn(initHandler, 'printFoxIcon').mockImplementation(() => {});
    const getHelpSpy = vi.spyOn(parser, 'getCompareHelp').mockReturnValue('Compare help text');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Exit called with code ${code}`);
    });
    vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
      stats: false,
      approve: false,
      cleanOrphaned: false,
      quiet: false,
      skipGitignore: false,
      positionalArgs: ['old.json'], // Only one file
    });

    await expect(handleCompare(['old.json'])).rejects.toThrow('Exit called with code 1');

    expect(printFoxSpy).toHaveBeenCalled();
    expect(getHelpSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should call compareCommand for single file comparison', async () => {
    mockCompareCommand.mockResolvedValue({ status: 'IDENTICAL' });
    vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
      stats: false,
      approve: false,
      cleanOrphaned: false,
      quiet: false,
      skipGitignore: false,
      positionalArgs: ['old.json', 'new.json'],
    });

    await handleCompare(['old.json', 'new.json']);

    expect(mockCompareCommand).toHaveBeenCalledWith({
      oldFile: 'old.json',
      newFile: 'new.json',
      stats: false,
      approve: false,
      quiet: false,
    });
  });

  it('should call multiFileCompare for context_main.json files', async () => {
    mockMultiFileCompare.mockResolvedValue({ status: 'IDENTICAL' });
    vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
      stats: false,
      approve: false,
      cleanOrphaned: false,
      quiet: false,
      skipGitignore: false,
      positionalArgs: ['old/context_main.json', 'new/context_main.json'],
    });

    await handleCompare(['old/context_main.json', 'new/context_main.json']);

    expect(mockMultiFileCompare).toHaveBeenCalled();
    expect(mockDisplayMultiFileCompareResult).toHaveBeenCalled();
  });

  it('should handle errors and exit with code 1', async () => {
    const error = new Error('Compare failed');
    mockCompareCommand.mockRejectedValue(error);
    vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
      stats: false,
      approve: false,
      cleanOrphaned: false,
      quiet: false,
      skipGitignore: false,
      positionalArgs: ['old.json', 'new.json'],
    });

    await handleCompare(['old.json', 'new.json']);

    expect(console.error).toHaveBeenCalledWith('❌ Compare failed:', 'Compare failed');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  describe('auto-compare mode (no positional args)', () => {
    it('should error when context_main.json does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: false,
        cleanOrphaned: false,
        quiet: false,
        skipGitignore: false,
        positionalArgs: [],
      });

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Exit called with code ${code}`);
      });

      await expect(handleCompare([])).rejects.toThrow('Exit called with code 1');

      expect(console.error).toHaveBeenCalledWith(
        '❌ context_main.json not found. Run "stamp context" first to generate context files.'
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should run auto-compare and exit 0 when no drift', async () => {
      mockExistsSync.mockReturnValue(true);
      mockMkdir.mockResolvedValue(undefined);
      mockRm.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify({ folders: [] }));
      mockContextCommand.mockResolvedValue(undefined);
      mockMultiFileCompare.mockResolvedValue({ status: 'IDENTICAL', folderResults: [] });

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: false,
        cleanOrphaned: false,
        quiet: false,
        skipGitignore: false,
        positionalArgs: [],
      });

      await handleCompare([]);

      expect(mockContextCommand).toHaveBeenCalled();
      expect(mockMultiFileCompare).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle drift with --approve flag and update files', async () => {
      mockExistsSync.mockReturnValue(true);
      mockMkdir.mockResolvedValue(undefined);
      mockRm.mockResolvedValue(undefined);
      mockCopyFile.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify({
        folders: [{ contextFile: 'src/context.json' }]
      }));
      mockContextCommand.mockResolvedValue(undefined);
      mockMultiFileCompare.mockResolvedValue({ status: 'DRIFT', folderResults: [] });

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: true,
        cleanOrphaned: false,
        quiet: false,
        skipGitignore: false,
        positionalArgs: [],
      });

      await handleCompare(['--approve']);

      expect(mockCopyFile).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('🔄 --approve flag set, updating all context files...');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should exit 1 when drift detected but not approved (non-TTY)', async () => {
      mockExistsSync.mockReturnValue(true);
      mockMkdir.mockResolvedValue(undefined);
      mockRm.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify({ folders: [] }));
      mockContextCommand.mockResolvedValue(undefined);
      mockMultiFileCompare.mockResolvedValue({ status: 'DRIFT', folderResults: [] });

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: false,
        cleanOrphaned: false,
        quiet: false,
        skipGitignore: false,
        positionalArgs: [],
      });

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Exit called with code ${code}`);
      });

      await expect(handleCompare([])).rejects.toThrow('Exit called with code 1');

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should clean orphaned files when --clean-orphaned and --approve are set', async () => {
      mockExistsSync.mockReturnValue(true);
      mockMkdir.mockResolvedValue(undefined);
      mockRm.mockResolvedValue(undefined);
      mockCopyFile.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify({ folders: [] }));
      mockContextCommand.mockResolvedValue(undefined);
      mockMultiFileCompare.mockResolvedValue({
        status: 'DRIFT',
        folderResults: [],
        orphanedFiles: ['old/context.json'],
      });
      mockCleanOrphanedFiles.mockResolvedValue(1);

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: true,
        cleanOrphaned: true,
        quiet: false,
        skipGitignore: false,
        positionalArgs: [],
      });

      await handleCompare(['--approve', '--clean-orphaned']);

      expect(mockCleanOrphanedFiles).toHaveBeenCalledWith(['old/context.json'], '.', false);
      expect(console.log).toHaveBeenCalledWith('\n🗑️  Cleaning up orphaned files...');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle error during context generation', async () => {
      mockExistsSync.mockReturnValue(true);
      mockMkdir.mockResolvedValue(undefined);
      mockRm.mockResolvedValue(undefined);
      mockContextCommand.mockRejectedValue(new Error('Context generation failed'));

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: false,
        cleanOrphaned: false,
        quiet: false,
        skipGitignore: false,
        positionalArgs: [],
      });

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Exit called with code ${code}`);
      });

      await expect(handleCompare([])).rejects.toThrow('Exit called with code 1');

      expect(console.error).toHaveBeenCalledWith('❌ Compare failed:', 'Context generation failed');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle mkdir failure with proper error message', async () => {
      mockExistsSync.mockReturnValue(true);
      const mkdirError = new Error('Permission denied') as NodeJS.ErrnoException;
      mkdirError.code = 'EACCES';
      mockMkdir.mockRejectedValue(mkdirError);
      mockRm.mockResolvedValue(undefined);

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: false,
        cleanOrphaned: false,
        quiet: false,
        skipGitignore: false,
        positionalArgs: [],
      });

      // mkdir failure throws error before the main try-catch, so it propagates up
      await expect(handleCompare([])).rejects.toThrow('Permission denied');
    });

    it('should suppress output in quiet mode', async () => {
      mockExistsSync.mockReturnValue(true);
      mockMkdir.mockResolvedValue(undefined);
      mockRm.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify({ folders: [] }));
      mockContextCommand.mockResolvedValue(undefined);
      mockMultiFileCompare.mockResolvedValue({ status: 'IDENTICAL', folderResults: [] });

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: false,
        cleanOrphaned: false,
        quiet: true,
        skipGitignore: false,
        positionalArgs: [],
      });

      await handleCompare(['--quiet']);

      // In quiet mode, should not log 'Auto-compare mode'
      expect(console.log).not.toHaveBeenCalledWith('Auto-compare mode');
      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });

  describe('multi-file compare mode', () => {
    it('should handle drift with --approve flag', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockCopyFile.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify({
        folders: [{ contextFile: 'src/context.json' }]
      }));
      mockMultiFileCompare.mockResolvedValue({ status: 'DRIFT', folderResults: [] });

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: true,
        cleanOrphaned: false,
        quiet: false,
        skipGitignore: false,
        positionalArgs: ['old/context_main.json', 'new/context_main.json'],
      });

      await handleCompare(['old/context_main.json', 'new/context_main.json', '--approve']);

      expect(mockCopyFile).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should exit 1 when drift not approved (non-TTY)', async () => {
      mockMultiFileCompare.mockResolvedValue({ status: 'DRIFT', folderResults: [] });

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: false,
        cleanOrphaned: false,
        quiet: false,
        skipGitignore: false,
        positionalArgs: ['old/context_main.json', 'new/context_main.json'],
      });

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Exit called with code ${code}`);
      });

      await expect(handleCompare(['old/context_main.json', 'new/context_main.json'])).rejects.toThrow('Exit called with code 1');

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should pass stats option to multiFileCompare', async () => {
      mockMultiFileCompare.mockResolvedValue({ status: 'IDENTICAL', folderResults: [] });

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: true,
        approve: false,
        cleanOrphaned: false,
        quiet: false,
        skipGitignore: false,
        positionalArgs: ['old/context_main.json', 'new/context_main.json'],
      });

      await handleCompare(['old/context_main.json', 'new/context_main.json', '--stats']);

      expect(mockMultiFileCompare).toHaveBeenCalledWith(expect.objectContaining({
        stats: true,
      }));
    });

    it('should clean orphaned files when requested', async () => {
      mockMkdir.mockResolvedValue(undefined);
      mockCopyFile.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify({ folders: [] }));
      mockMultiFileCompare.mockResolvedValue({
        status: 'DRIFT',
        folderResults: [],
        orphanedFiles: ['old/obsolete/context.json'],
      });
      mockCleanOrphanedFiles.mockResolvedValue(1);

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: true,
        cleanOrphaned: true,
        quiet: false,
        skipGitignore: false,
        positionalArgs: ['old/context_main.json', 'new/context_main.json'],
      });

      await handleCompare(['old/context_main.json', 'new/context_main.json', '--approve', '--clean-orphaned']);

      expect(mockCleanOrphanedFiles).toHaveBeenCalledWith(['old/obsolete/context.json'], 'old', false);
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should handle multiFileCompare errors', async () => {
      mockMultiFileCompare.mockRejectedValue(new Error('Multi-file compare failed'));

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: false,
        cleanOrphaned: false,
        quiet: false,
        skipGitignore: false,
        positionalArgs: ['old/context_main.json', 'new/context_main.json'],
      });

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Exit called with code ${code}`);
      });

      await expect(handleCompare(['old/context_main.json', 'new/context_main.json'])).rejects.toThrow('Exit called with code 1');

      expect(console.error).toHaveBeenCalledWith('❌ Compare failed:', 'Multi-file compare failed');
    });
  });

  describe('single file compare mode', () => {
    it('should handle drift with --approve flag', async () => {
      mockCopyFile.mockResolvedValue(undefined);
      mockCompareCommand.mockResolvedValue({ status: 'DRIFT' });

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: true,
        cleanOrphaned: false,
        quiet: false,
        skipGitignore: false,
        positionalArgs: ['old.json', 'new.json'],
      });

      await handleCompare(['old.json', 'new.json', '--approve']);

      expect(mockCopyFile).toHaveBeenCalledWith('new.json', 'old.json');
      expect(console.log).toHaveBeenCalledWith('🔄 --approve flag set, updating old.json...');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('should exit 1 when drift not approved (non-TTY)', async () => {
      mockCompareCommand.mockResolvedValue({ status: 'DRIFT' });

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: false,
        cleanOrphaned: false,
        quiet: false,
        skipGitignore: false,
        positionalArgs: ['old.json', 'new.json'],
      });

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Exit called with code ${code}`);
      });

      await expect(handleCompare(['old.json', 'new.json'])).rejects.toThrow('Exit called with code 1');

      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should pass stats option to compareCommand', async () => {
      mockCompareCommand.mockResolvedValue({ status: 'IDENTICAL' });

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: true,
        approve: false,
        cleanOrphaned: false,
        quiet: false,
        skipGitignore: false,
        positionalArgs: ['old.json', 'new.json'],
      });

      await handleCompare(['old.json', 'new.json', '--stats']);

      expect(mockCompareCommand).toHaveBeenCalledWith(expect.objectContaining({
        stats: true,
      }));
    });

    it('should pass quiet option to compareCommand', async () => {
      mockCompareCommand.mockResolvedValue({ status: 'IDENTICAL' });

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: false,
        cleanOrphaned: false,
        quiet: true,
        skipGitignore: false,
        positionalArgs: ['old.json', 'new.json'],
      });

      await handleCompare(['old.json', 'new.json', '--quiet']);

      expect(mockCompareCommand).toHaveBeenCalledWith(expect.objectContaining({
        quiet: true,
      }));
    });

    it('should exit 0 when files are identical', async () => {
      mockCompareCommand.mockResolvedValue({ status: 'IDENTICAL' });

      vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
        stats: false,
        approve: false,
        cleanOrphaned: false,
        quiet: false,
        skipGitignore: false,
        positionalArgs: ['old.json', 'new.json'],
      });

      await handleCompare(['old.json', 'new.json']);

      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });
});
