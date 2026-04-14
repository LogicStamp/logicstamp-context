import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleSecurityScan } from '../../../src/cli/handlers/securityHandler.js';
import * as securityCommand from '../../../src/cli/commands/security.js';
import * as parser from '../../../src/cli/parser/index.js';
import * as initHandler from '../../../src/cli/handlers/initHandler.js';

describe('handleSecurityScan', () => {
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
      .spyOn(parser, 'getSecurityScanHelp')
      .mockReturnValue('Security help text');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Exit called with code ${code}`);
    });

    await expect(handleSecurityScan(['--help'])).rejects.toThrow(
      'Exit called with code 0',
    );

    expect(printFoxSpy).toHaveBeenCalled();
    expect(getHelpSpy).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith('Security help text');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should show help when -h flag is provided', async () => {
    const printFoxSpy = vi
      .spyOn(initHandler, 'printFoxIcon')
      .mockImplementation(() => {});
    const getHelpSpy = vi
      .spyOn(parser, 'getSecurityScanHelp')
      .mockReturnValue('Security help text');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`Exit called with code ${code}`);
    });

    await expect(handleSecurityScan(['-h'])).rejects.toThrow(
      'Exit called with code 0',
    );

    expect(printFoxSpy).toHaveBeenCalled();
    expect(getHelpSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should parse quiet flag', async () => {
    const securitySpy = vi
      .spyOn(securityCommand, 'securityScanCommand')
      .mockResolvedValue(undefined);

    await handleSecurityScan(['--quiet']);

    expect(securitySpy).toHaveBeenCalledWith({
      entry: undefined,
      out: undefined,
      quiet: true,
    });
  });

  it('should parse quiet short flag', async () => {
    const securitySpy = vi
      .spyOn(securityCommand, 'securityScanCommand')
      .mockResolvedValue(undefined);

    await handleSecurityScan(['-q']);

    expect(securitySpy).toHaveBeenCalledWith({
      entry: undefined,
      out: undefined,
      quiet: true,
    });
  });

  it('should parse entry path', async () => {
    const securitySpy = vi
      .spyOn(securityCommand, 'securityScanCommand')
      .mockResolvedValue(undefined);

    await handleSecurityScan(['src/App.tsx']);

    expect(securitySpy).toHaveBeenCalledWith({
      entry: 'src/App.tsx',
      out: undefined,
      quiet: false,
    });
  });

  it('should parse out flag', async () => {
    const securitySpy = vi
      .spyOn(securityCommand, 'securityScanCommand')
      .mockResolvedValue(undefined);

    await handleSecurityScan(['--out', 'report.json']);

    expect(securitySpy).toHaveBeenCalledWith({
      entry: undefined,
      out: 'report.json',
      quiet: false,
    });
  });

  it('should parse out short flag', async () => {
    const securitySpy = vi
      .spyOn(securityCommand, 'securityScanCommand')
      .mockResolvedValue(undefined);

    await handleSecurityScan(['-o', 'report.json']);

    expect(securitySpy).toHaveBeenCalledWith({
      entry: undefined,
      out: 'report.json',
      quiet: false,
    });
  });

  it('should parse all options together', async () => {
    const securitySpy = vi
      .spyOn(securityCommand, 'securityScanCommand')
      .mockResolvedValue(undefined);

    await handleSecurityScan([
      'src/App.tsx',
      '--out',
      'report.json',
      '--quiet',
    ]);

    expect(securitySpy).toHaveBeenCalledWith({
      entry: 'src/App.tsx',
      out: 'report.json',
      quiet: true,
    });
  });

  it('should handle errors and exit with code 1', async () => {
    const error = new Error('Security scan failed');
    error.stack = 'Error stack trace';
    vi.spyOn(securityCommand, 'securityScanCommand').mockRejectedValue(error);

    await handleSecurityScan([]);

    expect(console.error).toHaveBeenCalledWith(
      '❌ Security scan failed:',
      'Security scan failed',
    );
    expect(console.error).toHaveBeenCalledWith('Error stack trace');
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
