import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleValidate } from '../../../src/cli/handlers/validateHandler.js';
import * as validateCommand from '../../../src/cli/commands/validate.js';
import * as parser from '../../../src/cli/parser/index.js';
import * as initHandler from '../../../src/cli/handlers/initHandler.js';

describe('handleValidate', () => {
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
    const getHelpSpy = vi.spyOn(parser, 'getValidateHelp').mockReturnValue('Validate help text');

    await handleValidate(['--help']);

    expect(printFoxSpy).toHaveBeenCalled();
    expect(getHelpSpy).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Validate help text');
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('should show help when -h flag is provided', async () => {
    const printFoxSpy = vi.spyOn(initHandler, 'printFoxIcon').mockImplementation(() => {});
    const getHelpSpy = vi.spyOn(parser, 'getValidateHelp').mockReturnValue('Validate help text');

    await handleValidate(['-h']);

    expect(printFoxSpy).toHaveBeenCalled();
    expect(getHelpSpy).toHaveBeenCalled();
    expect(process.exit).toHaveBeenCalledWith(0);
  });

  it('should call validateCommand with parsed options', async () => {
    const validateSpy = vi.spyOn(validateCommand, 'validateCommand').mockResolvedValue(undefined);
    const parseSpy = vi.spyOn(parser, 'parseValidateArgs').mockReturnValue({
      quiet: false,
      filePath: 'context.json',
    });

    await handleValidate(['context.json']);

    expect(parseSpy).toHaveBeenCalledWith(['context.json']);
    expect(validateSpy).toHaveBeenCalledWith('context.json', false);
  });

  it('should handle errors and exit with code 1', async () => {
    const error = new Error('Validation failed');
    vi.spyOn(validateCommand, 'validateCommand').mockRejectedValue(error);
    vi.spyOn(parser, 'parseValidateArgs').mockReturnValue({
      quiet: false,
      filePath: undefined,
    });

    await handleValidate([]);

    expect(console.error).toHaveBeenCalledWith('❌ Validation failed:', 'Validation failed');
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
