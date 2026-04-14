import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleStyle } from '../../../src/cli/handlers/styleHandler.js';
import * as styleCommand from '../../../src/cli/commands/style.js';
import * as parser from '../../../src/cli/parser/index.js';
import * as initHandler from '../../../src/cli/handlers/initHandler.js';

describe('handleStyle', () => {
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
    const printFoxSpy = vi
      .spyOn(initHandler, 'printFoxIcon')
      .mockImplementation(() => {});
    const getHelpSpy = vi
      .spyOn(parser, 'getStyleHelp')
      .mockReturnValue('Style help text');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Exit called with code ${code}`);
    });

    await expect(handleStyle(['--help'])).rejects.toThrow(
      'Exit called with code 0',
    );

    expect(printFoxSpy).toHaveBeenCalled();
    expect(getHelpSpy).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Style help text');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should show help when -h flag is provided', async () => {
    const printFoxSpy = vi
      .spyOn(initHandler, 'printFoxIcon')
      .mockImplementation(() => {});
    const getHelpSpy = vi
      .spyOn(parser, 'getStyleHelp')
      .mockReturnValue('Style help text');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Exit called with code ${code}`);
    });

    await expect(handleStyle(['-h'])).rejects.toThrow(
      'Exit called with code 0',
    );

    expect(printFoxSpy).toHaveBeenCalled();
    expect(getHelpSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should reject --compare-modes flag', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Exit called with code ${code}`);
    });

    await expect(handleStyle(['--compare-modes'])).rejects.toThrow(
      'Exit called with code 1',
    );

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('--compare-modes is not available'),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should call styleCommand with parsed options', async () => {
    const styleSpy = vi
      .spyOn(styleCommand, 'styleCommand')
      .mockResolvedValue(undefined);
    const parseSpy = vi.spyOn(parser, 'parseStyleArgs').mockReturnValue({
      depth: 2,
      includeCode: 'header',
      format: 'json',
      out: 'context.json',
      hashLock: false,
      strict: false,
      allowMissing: true,
      maxNodes: 100,
      profile: 'llm-chat',
      predictBehavior: false,
      dryRun: false,
      stats: false,
      strictMissing: false,
      compareModes: false,
      skipGitignore: false,
      quiet: false,
      watch: false,
      debug: false,
      logFile: false,
      strictWatch: false,
    } as any);

    await handleStyle(['--depth', '3']);

    expect(parseSpy).toHaveBeenCalledWith(['--depth', '3']);
    expect(styleSpy).toHaveBeenCalled();
  });

  it('should handle errors and exit with code 1', async () => {
    const error = new Error('Style compilation failed');
    error.stack = 'Error stack trace';
    vi.spyOn(styleCommand, 'styleCommand').mockRejectedValue(error);
    vi.spyOn(parser, 'parseStyleArgs').mockReturnValue({
      depth: 2,
      includeCode: 'header',
      format: 'json',
      out: 'context.json',
      hashLock: false,
      strict: false,
      allowMissing: true,
      maxNodes: 100,
      profile: 'llm-chat',
      predictBehavior: false,
      dryRun: false,
      stats: false,
      strictMissing: false,
      compareModes: false,
      skipGitignore: false,
      quiet: false,
      watch: false,
      debug: false,
      logFile: false,
      strictWatch: false,
    } as any);

    await handleStyle([]);

    expect(console.error).toHaveBeenCalledWith(
      '❌ Style context compilation failed:',
      'Style compilation failed',
    );
    expect(console.error).toHaveBeenCalledWith('Error stack trace');
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
