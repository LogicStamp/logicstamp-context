import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the validate command before importing
vi.mock('../../../src/cli/commands/validate.js', () => ({
  validateCommand: vi.fn().mockResolvedValue(undefined),
}));

import * as validate from '../../../src/cli/commands/validate.js';

describe('validate-index CLI', () => {
  let originalArgv: string[];
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let exitCode: number | undefined;

  beforeEach(() => {
    originalArgv = process.argv;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    exitCode = undefined;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      exitCode = code as number;
      return undefined as never;
    });

    // Reset mock state before each test
    vi.mocked(validate.validateCommand).mockClear();
    vi.mocked(validate.validateCommand).mockResolvedValue();

    vi.resetModules();
  });

  afterEach(() => {
    process.argv = originalArgv;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  // Helper to run the CLI with specific args
  async function runCli(args: string[]) {
    process.argv = ['node', 'logicstamp-validate', ...args];
    // Clear mocks right before running to avoid leakage
    vi.mocked(validate.validateCommand).mockClear();
    // Dynamic import to re-execute the module
    await import('../../../src/cli/validate-index.js');
    // Allow async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  describe('--help flag', () => {
    it('should show help with --help flag', async () => {
      await runCli(['--help']);

      expect(console.log).toHaveBeenCalled();
      const logCalls = vi.mocked(console.log).mock.calls;
      const helpOutput = logCalls.map((call) => call[0]).join('\n');

      expect(helpOutput).toContain('LogicStamp Validate');
      expect(helpOutput).toContain('USAGE:');
      expect(helpOutput).toContain('logicstamp-validate');
      expect(exitCode).toBe(0);
    });

    it('should show help with -h flag', async () => {
      await runCli(['-h']);

      expect(console.log).toHaveBeenCalled();
      const logCalls = vi.mocked(console.log).mock.calls;
      const helpOutput = logCalls.map((call) => call[0]).join('\n');

      expect(helpOutput).toContain('LogicStamp Validate');
      expect(exitCode).toBe(0);
    });

    // Note: We can't test that validateCommand is NOT called when help is requested
    // because process.exit() is mocked and doesn't actually stop execution.
    // In real execution, process.exit(0) stops the program before validateCommand runs.
  });

  describe('file path argument', () => {
    it('should pass file path to validateCommand', async () => {
      await runCli(['docs/context.json']);

      expect(validate.validateCommand).toHaveBeenCalledWith(
        'docs/context.json',
      );
    });

    it('should pass undefined when no file path provided', async () => {
      await runCli([]);

      expect(validate.validateCommand).toHaveBeenCalledWith(undefined);
    });
  });

  describe('error handling', () => {
    it('should exit with code 1 when validateCommand throws', async () => {
      const error = new Error('Validation failed');
      vi.mocked(validate.validateCommand).mockRejectedValue(error);

      await runCli(['invalid.json']);

      expect(exitCode).toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed'),
        'Validation failed',
      );
    });

    it('should print stack trace when error occurs', async () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.ts:1:1';
      vi.mocked(validate.validateCommand).mockRejectedValue(error);

      await runCli(['test.json']);

      // Stack is printed in a separate console.error call
      const errorCalls = vi.mocked(console.error).mock.calls;
      const hasStackCall = errorCalls.some((call) =>
        call.some(
          (arg) => typeof arg === 'string' && arg.includes('at test.ts'),
        ),
      );
      expect(hasStackCall).toBe(true);
    });
  });

  describe('help content', () => {
    it('should display examples in help', async () => {
      await runCli(['--help']);

      const logCalls = vi.mocked(console.log).mock.calls;
      const helpOutput = logCalls.map((call) => call[0]).join('\n');

      expect(helpOutput).toContain('EXAMPLES:');
      expect(helpOutput).toContain('logicstamp-validate');
      expect(helpOutput).toContain('docs/ai-context.json');
    });

    it('should display notes in help', async () => {
      await runCli(['--help']);

      const logCalls = vi.mocked(console.log).mock.calls;
      const helpOutput = logCalls.map((call) => call[0]).join('\n');

      expect(helpOutput).toContain('NOTES:');
      expect(helpOutput).toContain('bundle structure');
      expect(helpOutput).toContain('schema compliance');
    });

    it('should display options in help', async () => {
      await runCli(['--help']);

      const logCalls = vi.mocked(console.log).mock.calls;
      const helpOutput = logCalls.map((call) => call[0]).join('\n');

      expect(helpOutput).toContain('OPTIONS:');
      expect(helpOutput).toContain('-h, --help');
    });
  });
});
