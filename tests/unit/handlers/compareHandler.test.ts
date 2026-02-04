import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleCompare } from '../../../src/cli/handlers/compareHandler.js';
import * as compareCommand from '../../../src/cli/commands/compare.js';
import * as contextCommand from '../../../src/cli/commands/context.js';
import * as parser from '../../../src/cli/parser/index.js';
import * as initHandler from '../../../src/cli/handlers/initHandler.js';

describe('handleCompare', () => {
  let originalExit: typeof process.exit;
  let originalConsoleError: typeof console.error;
  let originalConsoleLog: typeof console.log;
  let originalIsTTY: typeof process.stdout.isTTY;

  beforeEach(() => {
    originalExit = process.exit;
    originalConsoleError = console.error;
    originalConsoleLog = console.log;
    originalIsTTY = process.stdout.isTTY;
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
    const compareSpy = vi.spyOn(compareCommand, 'compareCommand').mockResolvedValue({
      status: 'IDENTICAL',
    } as any);
    vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
      stats: false,
      approve: false,
      cleanOrphaned: false,
      quiet: false,
      skipGitignore: false,
      positionalArgs: ['old.json', 'new.json'],
    });

    await handleCompare(['old.json', 'new.json']);

    expect(compareSpy).toHaveBeenCalledWith({
      oldFile: 'old.json',
      newFile: 'new.json',
      stats: false,
      approve: false,
      quiet: false,
    });
  });

  it('should call multiFileCompare for context_main.json files', async () => {
    const multiFileSpy = vi.spyOn(compareCommand, 'multiFileCompare').mockResolvedValue({
      status: 'IDENTICAL',
    } as any);
    const displaySpy = vi.spyOn(compareCommand, 'displayMultiFileCompareResult').mockImplementation(() => {});
    vi.spyOn(parser, 'parseCompareArgs').mockReturnValue({
      stats: false,
      approve: false,
      cleanOrphaned: false,
      quiet: false,
      skipGitignore: false,
      positionalArgs: ['old/context_main.json', 'new/context_main.json'],
    });

    await handleCompare(['old/context_main.json', 'new/context_main.json']);

    expect(multiFileSpy).toHaveBeenCalled();
    expect(displaySpy).toHaveBeenCalled();
  });

  it('should handle errors and exit with code 1', async () => {
    const error = new Error('Compare failed');
    vi.spyOn(compareCommand, 'compareCommand').mockRejectedValue(error);
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
});
