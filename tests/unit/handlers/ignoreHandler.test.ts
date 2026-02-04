import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleIgnore } from '../../../src/cli/handlers/ignoreHandler.js';
import * as ignoreCommand from '../../../src/cli/commands/ignore.js';
import * as parser from '../../../src/cli/parser/index.js';
import * as initHandler from '../../../src/cli/handlers/initHandler.js';

describe('handleIgnore', () => {
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

  it('should always print fox icon', async () => {
    const printFoxSpy = vi.spyOn(initHandler, 'printFoxIcon').mockImplementation(() => {});
    vi.spyOn(ignoreCommand, 'ignoreCommand').mockResolvedValue(undefined);
    vi.spyOn(parser, 'parseIgnoreArgs').mockReturnValue({
      paths: [],
      quiet: false,
    });

    await handleIgnore([]);

    expect(printFoxSpy).toHaveBeenCalled();
  });

  it('should show help when --help flag is provided', async () => {
    const printFoxSpy = vi.spyOn(initHandler, 'printFoxIcon').mockImplementation(() => {});
    const getHelpSpy = vi.spyOn(parser, 'getIgnoreHelp').mockReturnValue('Ignore help text');

    await handleIgnore(['--help']);

    expect(printFoxSpy).toHaveBeenCalled();
    expect(getHelpSpy).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Ignore help text');
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('should show help when -h flag is provided', async () => {
    const printFoxSpy = vi.spyOn(initHandler, 'printFoxIcon').mockImplementation(() => {});
    const getHelpSpy = vi.spyOn(parser, 'getIgnoreHelp').mockReturnValue('Ignore help text');

    await handleIgnore(['-h']);

    expect(printFoxSpy).toHaveBeenCalled();
    expect(getHelpSpy).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('should call ignoreCommand with parsed options', async () => {
    const ignoreSpy = vi.spyOn(ignoreCommand, 'ignoreCommand').mockResolvedValue(undefined);
    const parseSpy = vi.spyOn(parser, 'parseIgnoreArgs').mockReturnValue({
      paths: ['src/test.ts', 'src/test2.ts'],
      quiet: false,
    });

    await handleIgnore(['src/test.ts', 'src/test2.ts']);

    expect(parseSpy).toHaveBeenCalledWith(['src/test.ts', 'src/test2.ts']);
    expect(ignoreSpy).toHaveBeenCalled();
  });

  it('should handle errors and exit with code 1', async () => {
    const error = new Error('Failed to add paths');
    vi.spyOn(ignoreCommand, 'ignoreCommand').mockRejectedValue(error);
    vi.spyOn(parser, 'parseIgnoreArgs').mockReturnValue({
      paths: ['src/test.ts'],
      quiet: false,
    });

    await handleIgnore(['src/test.ts']);

    expect(console.error).toHaveBeenCalledWith(
      '❌ Failed to add paths to .stampignore:',
      'Failed to add paths'
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
