import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as handlers from '../../../src/cli/handlers/index.js';
import * as security from '../../../src/cli/commands/security.js';
import * as parser from '../../../src/cli/parser/index.js';
import * as fs from 'node:fs/promises';

// Mock all dependencies
vi.mock('../../../src/cli/handlers/index.js');
vi.mock('../../../src/cli/commands/security.js');
vi.mock('../../../src/cli/parser/index.js');
vi.mock('node:fs/promises');

/**
 * Note: Testing stamp.ts directly is complex because it executes immediately on import.
 * The actual routing logic is tested indirectly through:
 * 1. Handler tests (tests/unit/handlers/*.test.ts)
 * 2. E2E tests (tests/e2e/cli.*.test.ts)
 *
 * These tests focus on the routing paths that don't cause immediate process.exit().
 */
describe('stamp CLI routing', () => {
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

    // Default mock implementations
    vi.mocked(handlers.handleInit).mockResolvedValue();
    vi.mocked(handlers.handleIgnore).mockResolvedValue();
    vi.mocked(handlers.handleValidate).mockResolvedValue();
    vi.mocked(handlers.handleCompare).mockResolvedValue();
    vi.mocked(handlers.handleClean).mockResolvedValue();
    vi.mocked(handlers.handleStyle).mockResolvedValue();
    vi.mocked(handlers.handleGenerate).mockResolvedValue();
    vi.mocked(handlers.handleSecurityScan).mockResolvedValue();
    vi.mocked(handlers.printFoxIcon).mockImplementation(() => {});
    vi.mocked(parser.getMainHelp).mockReturnValue('Main help text');
    vi.mocked(parser.getSecurityHelp).mockReturnValue('Security help text');
    vi.mocked(security.securityHardResetCommand).mockResolvedValue();
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ version: '1.0.0' }),
    );

    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    process.argv = originalArgv;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    vi.restoreAllMocks();
  });

  // Helper to run the main function with specific args
  async function runMain(args: string[]) {
    process.argv = ['node', 'stamp', ...args];
    // Dynamic import to re-execute the module
    await import('../../../src/cli/stamp.js');
    // Allow async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Tests for commands that don't call process.exit immediately
  it('should route init command to handleInit', async () => {
    await runMain(['init']);

    expect(handlers.handleInit).toHaveBeenCalledWith([]);
  });

  it('should route ignore command to handleIgnore', async () => {
    await runMain(['ignore', 'src/secrets.ts']);

    expect(handlers.handleIgnore).toHaveBeenCalledWith(['src/secrets.ts']);
  });

  it('should route security scan to handleSecurityScan', async () => {
    await runMain(['security', 'scan']);

    expect(handlers.handleSecurityScan).toHaveBeenCalledWith([]);
  });

  it('should route security --hard-reset to securityHardResetCommand', async () => {
    await runMain(['security', '--hard-reset']);

    expect(security.securityHardResetCommand).toHaveBeenCalled();
  });

  it('should route context validate to handleValidate', async () => {
    await runMain(['context', 'validate']);

    expect(handlers.handleValidate).toHaveBeenCalledWith([]);
  });

  it('should route context compare to handleCompare', async () => {
    await runMain(['context', 'compare', 'old.json', 'new.json']);

    expect(handlers.handleCompare).toHaveBeenCalledWith([
      'old.json',
      'new.json',
    ]);
  });

  it('should route context clean to handleClean', async () => {
    await runMain(['context', 'clean']);

    expect(handlers.handleClean).toHaveBeenCalledWith([]);
  });

  it('should route context style to handleStyle', async () => {
    await runMain(['context', 'style']);

    expect(handlers.handleStyle).toHaveBeenCalledWith([]);
  });

  it('should route context generation to handleGenerate', async () => {
    await runMain(['context', './src']);

    expect(handlers.handleGenerate).toHaveBeenCalledWith(['./src']);
  });

  it('should show error for unknown command', async () => {
    await runMain(['unknown-command']);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Unknown command'),
    );
    expect(exitCode).toBe(1);
  });

  it('should show error for unknown security subcommand', async () => {
    await runMain(['security', 'unknown']);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Unknown security command'),
    );
    expect(exitCode).toBe(1);
  });

  it('should reject --hard-reset on security scan', async () => {
    await runMain(['security', 'scan', '--hard-reset']);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('--hard-reset is not available'),
    );
    expect(exitCode).toBe(1);
  });

  it('should show error when security command has no subcommand', async () => {
    await runMain(['security']);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('requires a subcommand'),
    );
    expect(exitCode).toBe(1);
  });

  it('should pass security hard reset options correctly', async () => {
    await runMain([
      'security',
      '--hard-reset',
      '--force',
      '--quiet',
      './custom/path',
      '--out',
      'report.json',
    ]);

    expect(security.securityHardResetCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        force: true,
        quiet: true,
      }),
    );
  });

  it('should handle init with arguments', async () => {
    await runMain(['init', '--no-secure', '--yes']);

    expect(handlers.handleInit).toHaveBeenCalledWith(['--no-secure', '--yes']);
  });

  it('should handle context with multiple flags', async () => {
    await runMain(['context', '--depth', '3', '--include-style', './src']);

    expect(handlers.handleGenerate).toHaveBeenCalledWith([
      '--depth',
      '3',
      '--include-style',
      './src',
    ]);
  });
});
