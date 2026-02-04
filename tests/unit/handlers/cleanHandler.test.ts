import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleClean } from '../../../src/cli/handlers/cleanHandler.js';
import * as cleanCommand from '../../../src/cli/commands/clean.js';
import * as parser from '../../../src/cli/parser/index.js';
import * as initHandler from '../../../src/cli/handlers/initHandler.js';

describe('handleClean', () => {
  let originalExit: typeof process.exit;
  let originalConsoleError: typeof console.error;
  let originalConsoleLog: typeof console.log;

  beforeEach(() => {
    originalExit = process.exit;
    originalConsoleError = console.error;
    originalConsoleLog = console.log;
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exit = originalExit;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  it('should show help when --help flag is provided', async () => {
    const printFoxSpy = vi.spyOn(initHandler, 'printFoxIcon').mockImplementation(() => {});
    const getHelpSpy = vi.spyOn(parser, 'getCleanHelp').mockReturnValue('Clean help text');

    await handleClean(['--help']);

    expect(printFoxSpy).toHaveBeenCalled();
    expect(getHelpSpy).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Clean help text');
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('should show help when -h flag is provided', async () => {
    const printFoxSpy = vi.spyOn(initHandler, 'printFoxIcon').mockImplementation(() => {});
    const getHelpSpy = vi.spyOn(parser, 'getCleanHelp').mockReturnValue('Clean help text');

    await handleClean(['-h']);

    expect(printFoxSpy).toHaveBeenCalled();
    expect(getHelpSpy).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('should reject --compare-modes flag', async () => {
    await handleClean(['--compare-modes']);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('--compare-modes is not available')
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should call cleanCommand with parsed options', async () => {
    const cleanSpy = vi.spyOn(cleanCommand, 'cleanCommand').mockResolvedValue(undefined);
    const parseSpy = vi.spyOn(parser, 'parseCleanArgs').mockReturnValue({
      all: false,
      yes: false,
      quiet: false,
    } as any);

    await handleClean(['--all']);

    expect(parseSpy).toHaveBeenCalledWith(['--all']);
    expect(cleanSpy).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('should handle errors and exit with code 1', async () => {
    const error = new Error('Clean failed');
    vi.spyOn(cleanCommand, 'cleanCommand').mockRejectedValue(error);
    vi.spyOn(parser, 'parseCleanArgs').mockReturnValue({
      all: false,
      yes: false,
      quiet: false,
    } as any);

    await handleClean([]);

    expect(console.error).toHaveBeenCalledWith('❌ Clean failed:', 'Clean failed');
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
