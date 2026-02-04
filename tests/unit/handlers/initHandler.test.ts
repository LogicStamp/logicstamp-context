import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleInit, printFoxIcon } from '../../../src/cli/handlers/initHandler.js';
import * as initCommand from '../../../src/cli/commands/init.js';
import * as parser from '../../../src/cli/parser/index.js';

describe('initHandler', () => {
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

  describe('printFoxIcon', () => {
    it('should print fox icon', () => {
      printFoxIcon();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('🦊')
      );
    });
  });

  describe('handleInit', () => {
    it('should always print fox icon', async () => {
      const initSpy = vi.spyOn(initCommand, 'init').mockResolvedValue(undefined);
      vi.spyOn(parser, 'parseInitArgs').mockReturnValue({} as any);

      await handleInit([]);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('🦊')
      );
    });

    it('should show help when --help flag is provided', async () => {
      const getHelpSpy = vi.spyOn(parser, 'getInitHelp').mockReturnValue('Init help text');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Exit called with code ${code}`);
      });

      await expect(handleInit(['--help'])).rejects.toThrow('Exit called with code 0');

      expect(getHelpSpy).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Init help text');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should show help when -h flag is provided', async () => {
      const getHelpSpy = vi.spyOn(parser, 'getInitHelp').mockReturnValue('Init help text');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Exit called with code ${code}`);
      });

      await expect(handleInit(['-h'])).rejects.toThrow('Exit called with code 0');

      expect(getHelpSpy).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Init help text');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should call init command with parsed options', async () => {
      const initSpy = vi.spyOn(initCommand, 'init').mockResolvedValue(undefined);
      const parseSpy = vi.spyOn(parser, 'parseInitArgs').mockReturnValue({
        targetDir: './my-project',
        yes: true,
      } as any);

      await handleInit(['./my-project', '--yes']);

      expect(parseSpy).toHaveBeenCalledWith(['./my-project', '--yes']);
      expect(initSpy).toHaveBeenCalledWith({
        targetDir: './my-project',
        yes: true,
      });
    });

    it('should handle errors and exit with code 1', async () => {
      const error = new Error('Initialization failed');
      vi.spyOn(initCommand, 'init').mockRejectedValue(error);
      vi.spyOn(parser, 'parseInitArgs').mockReturnValue({} as any);

      await handleInit([]);

      expect(console.error).toHaveBeenCalledWith(
        '❌ Initialization failed:',
        'Initialization failed'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
