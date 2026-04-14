import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleInit,
  printFoxIcon,
} from '../../../src/cli/handlers/initHandler.js';
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
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🦊'));
    });
  });

  describe('handleInit', () => {
    it('should always print fox icon', async () => {
      const initSpy = vi
        .spyOn(initCommand, 'init')
        .mockResolvedValue(undefined);
      vi.spyOn(parser, 'parseInitArgs').mockReturnValue({} as any);

      await handleInit([]);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('🦊'));
    });

    it('should show help when --help flag is provided', async () => {
      const getHelpSpy = vi
        .spyOn(parser, 'getInitHelp')
        .mockReturnValue('Init help text');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Exit called with code ${code}`);
      });

      await expect(handleInit(['--help'])).rejects.toThrow(
        'Exit called with code 0',
      );

      expect(getHelpSpy).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Init help text');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should show help when -h flag is provided', async () => {
      const getHelpSpy = vi
        .spyOn(parser, 'getInitHelp')
        .mockReturnValue('Init help text');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Exit called with code ${code}`);
      });

      await expect(handleInit(['-h'])).rejects.toThrow(
        'Exit called with code 0',
      );

      expect(getHelpSpy).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Init help text');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should call init command with parsed options', async () => {
      const initSpy = vi
        .spyOn(initCommand, 'init')
        .mockResolvedValue(undefined);
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
        'Initialization failed',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    // ============================================================================
    // BRANCH COVERAGE TESTS - Testing conditional branches
    // ============================================================================

    it('should handle help flag check with --help first', async () => {
      const initSpy = vi
        .spyOn(initCommand, 'init')
        .mockResolvedValue(undefined);
      const getHelpSpy = vi
        .spyOn(parser, 'getInitHelp')
        .mockReturnValue('Init help text');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Exit called with code ${code}`);
      });

      await expect(handleInit(['--help', '--other'])).rejects.toThrow(
        'Exit called with code 0',
      );

      expect(getHelpSpy).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Init help text');
      expect(exitSpy).toHaveBeenCalledWith(0);
      // Should not call init when help is shown
      expect(initSpy).not.toHaveBeenCalled();
    });

    it('should handle help flag check with -h first', async () => {
      const getHelpSpy = vi
        .spyOn(parser, 'getInitHelp')
        .mockReturnValue('Init help text');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Exit called with code ${code}`);
      });

      await expect(handleInit(['-h', '--other'])).rejects.toThrow(
        'Exit called with code 0',
      );

      expect(getHelpSpy).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('Init help text');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle help flag in middle of args', async () => {
      const getHelpSpy = vi
        .spyOn(parser, 'getInitHelp')
        .mockReturnValue('Init help text');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Exit called with code ${code}`);
      });

      await expect(handleInit(['arg1', '--help', 'arg2'])).rejects.toThrow(
        'Exit called with code 0',
      );

      expect(getHelpSpy).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle help flag at end of args', async () => {
      const getHelpSpy = vi
        .spyOn(parser, 'getInitHelp')
        .mockReturnValue('Init help text');
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`Exit called with code ${code}`);
      });

      await expect(handleInit(['arg1', 'arg2', '--help'])).rejects.toThrow(
        'Exit called with code 0',
      );

      expect(getHelpSpy).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should not show help when help flags are not present', async () => {
      const initSpy = vi
        .spyOn(initCommand, 'init')
        .mockResolvedValue(undefined);
      const getHelpSpy = vi
        .spyOn(parser, 'getInitHelp')
        .mockReturnValue('Init help text');
      vi.spyOn(parser, 'parseInitArgs').mockReturnValue({} as any);

      await handleInit(['arg1', 'arg2']);

      expect(getHelpSpy).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalledWith('Init help text');
      expect(initSpy).toHaveBeenCalled();
    });

    it('should handle empty args array', async () => {
      const initSpy = vi
        .spyOn(initCommand, 'init')
        .mockResolvedValue(undefined);
      vi.spyOn(parser, 'parseInitArgs').mockReturnValue({} as any);

      await handleInit([]);

      expect(initSpy).toHaveBeenCalledWith({});
    });

    it('should handle error with non-Error object', async () => {
      const error = 'String error';
      vi.spyOn(initCommand, 'init').mockRejectedValue(error);
      vi.spyOn(parser, 'parseInitArgs').mockReturnValue({} as any);

      await handleInit([]);

      // Should handle gracefully - error.message would be undefined for string
      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should handle error with Error object that has message', async () => {
      const error = new Error('Custom error message');
      vi.spyOn(initCommand, 'init').mockRejectedValue(error);
      vi.spyOn(parser, 'parseInitArgs').mockReturnValue({} as any);

      await handleInit([]);

      expect(console.error).toHaveBeenCalledWith(
        '❌ Initialization failed:',
        'Custom error message',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should parse args correctly before calling init', async () => {
      const initSpy = vi
        .spyOn(initCommand, 'init')
        .mockResolvedValue(undefined);
      const parseSpy = vi.spyOn(parser, 'parseInitArgs').mockReturnValue({
        targetDir: '/custom',
        skipGitignore: true,
      } as any);

      await handleInit(['--skip-gitignore', '/custom']);

      expect(parseSpy).toHaveBeenCalledWith(['--skip-gitignore', '/custom']);
      expect(initSpy).toHaveBeenCalledWith({
        targetDir: '/custom',
        skipGitignore: true,
      });
    });
  });
});
