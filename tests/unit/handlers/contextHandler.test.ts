import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleGenerate } from '../../../src/cli/handlers/contextHandler.js';
import * as contextCommand from '../../../src/cli/commands/context.js';
import * as parser from '../../../src/cli/parser/index.js';
import * as initHandler from '../../../src/cli/handlers/initHandler.js';

describe('handleGenerate', () => {
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
    const getHelpSpy = vi.spyOn(parser, 'getGenerateHelp').mockReturnValue('Help text');
    // Make process.exit actually stop execution
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Exit called with code ${code}`);
    });

    await expect(handleGenerate(['--help'])).rejects.toThrow('Exit called with code 0');

    expect(printFoxSpy).toHaveBeenCalled();
    expect(getHelpSpy).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Help text');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should show help when -h flag is provided', async () => {
    const printFoxSpy = vi.spyOn(initHandler, 'printFoxIcon').mockImplementation(() => {});
    const getHelpSpy = vi.spyOn(parser, 'getGenerateHelp').mockReturnValue('Help text');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Exit called with code ${code}`);
    });

    await expect(handleGenerate(['-h'])).rejects.toThrow('Exit called with code 0');

    expect(printFoxSpy).toHaveBeenCalled();
    expect(getHelpSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should call contextCommand with parsed options', async () => {
    const contextSpy = vi.spyOn(contextCommand, 'contextCommand').mockResolvedValue(undefined);
    const parseSpy = vi.spyOn(parser, 'parseContextArgs').mockReturnValue({
      depth: 3,
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
      includeStyle: false,
      watch: false,
      debug: false,
      logFile: false,
      strictWatch: false,
    } as any);

    await handleGenerate(['--depth', '3']);

    expect(parseSpy).toHaveBeenCalledWith(['--depth', '3']);
    expect(contextSpy).toHaveBeenCalled();
  });

  it('should handle errors and exit with code 1', async () => {
    const error = new Error('Test error');
    vi.spyOn(contextCommand, 'contextCommand').mockRejectedValue(error);
    const parseSpy = vi.spyOn(parser, 'parseContextArgs').mockReturnValue({
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
      includeStyle: false,
      watch: false,
      debug: false,
      logFile: false,
      strictWatch: false,
    } as any);

    await handleGenerate([]);

    expect(console.error).toHaveBeenCalledWith(
      '❌ Context compilation failed:',
      'Test error'
    );
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should log stack trace on error', async () => {
    const error = new Error('Test error');
    error.stack = 'Error stack trace';
    vi.spyOn(contextCommand, 'contextCommand').mockRejectedValue(error);
    vi.spyOn(parser, 'parseContextArgs').mockReturnValue({
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
      includeStyle: false,
      watch: false,
      debug: false,
      logFile: false,
      strictWatch: false,
    } as any);

    await handleGenerate([]);

    expect(console.error).toHaveBeenCalledWith('Error stack trace');
  });
});
