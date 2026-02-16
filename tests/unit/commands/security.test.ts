import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  securityScanCommand,
  securityHardResetCommand,
  type SecurityScanOptions,
  type SecurityHardResetOptions,
} from '../../../src/cli/commands/security.js';
import * as fs from 'node:fs/promises';
import * as fsx from '../../../src/utils/fsx.js';
import * as secretDetector from '../../../src/utils/secretDetector.js';
import * as gitignore from '../../../src/utils/gitignore.js';

// Mock dependencies
vi.mock('node:fs/promises');
vi.mock('../../../src/utils/fsx.js');
vi.mock('../../../src/utils/secretDetector.js');
vi.mock('../../../src/utils/gitignore.js');
vi.mock('node:readline', () => ({
  createInterface: vi.fn(() => ({
    question: vi.fn((_, callback) => callback('n')),
    close: vi.fn(),
  })),
}));

describe('securityScanCommand', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalConsoleWarn: typeof console.warn;
  let exitCode: number | undefined;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    exitCode = undefined;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      exitCode = code as number;
      return undefined as never;
    });

    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(fsx.globFiles).mockResolvedValue(['src/app.ts', 'src/config.ts']);
    vi.mocked(fsx.readFileWithText).mockResolvedValue({ text: 'const x = 1;', bom: false });
    vi.mocked(secretDetector.scanFileForSecrets).mockReturnValue([]);
    vi.mocked(secretDetector.filterFalsePositives).mockImplementation((matches) => matches);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue({ size: 100 } as any);
    vi.mocked(gitignore.ensureGitignorePatterns).mockResolvedValue({ added: false, created: false });
    vi.mocked(gitignore.ensurePatternInGitignore).mockResolvedValue({ added: false, created: false });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    vi.restoreAllMocks();
  });

  it('should scan files and return no secrets found', async () => {
    const result = await securityScanCommand({ noExit: true });

    expect(result).toEqual({
      secretsFound: false,
      report: expect.objectContaining({
        type: 'LogicStampSecurityReport',
        secretsFound: 0,
      }),
    });
  });

  it('should detect secrets and return them in report', async () => {
    vi.mocked(secretDetector.scanFileForSecrets).mockImplementation((file) => {
      if (file === 'src/config.ts') {
        return [
          {
            file: 'src/config.ts',
            line: 5,
            type: 'API Key',
            severity: 'high',
            snippet: 'const apiKey = "sk-1234..."',
          },
        ];
      }
      return [];
    });

    const result = await securityScanCommand({ noExit: true });

    expect(result?.secretsFound).toBe(true);
    expect(result?.report.secretsFound).toBe(1);
    expect(result?.report.filesWithSecrets).toContain('src/config.ts');
  });

  it('should exit with 1 when secrets found and noExit is false', async () => {
    vi.mocked(secretDetector.scanFileForSecrets).mockReturnValue([
      {
        file: 'src/config.ts',
        line: 5,
        type: 'API Key',
        severity: 'high',
        snippet: 'const apiKey = "sk-1234..."',
      },
    ]);

    await securityScanCommand({ noExit: false });

    expect(exitCode).toBe(1);
  });

  it('should write report to specified output path', async () => {
    await securityScanCommand({
      out: 'custom/report.json',
      noExit: true,
    });

    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('report.json'),
      expect.any(String),
      'utf8'
    );
  });

  it('should skip files larger than 10MB', async () => {
    vi.mocked(fs.stat).mockResolvedValue({ size: 15 * 1024 * 1024 } as any); // 15MB

    await securityScanCommand({ noExit: true });

    expect(fsx.readFileWithText).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('file too large')
    );
  });

  it('should handle empty file list', async () => {
    vi.mocked(fsx.globFiles).mockResolvedValue([]);

    const result = await securityScanCommand({ noExit: true });

    expect(result).toEqual({
      secretsFound: false,
      report: expect.objectContaining({
        filesScanned: 0,
        secretsFound: 0,
      }),
    });
  });

  it('should return undefined when no files and noExit is false', async () => {
    vi.mocked(fsx.globFiles).mockResolvedValue([]);

    const result = await securityScanCommand({ noExit: false });

    expect(result).toBeUndefined();
  });

  it('should skip unreadable files gracefully', async () => {
    vi.mocked(fsx.readFileWithText).mockRejectedValue(new Error('Binary file'));

    const result = await securityScanCommand({ noExit: true });

    // The warning is logged as a single string
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringMatching(/Skipped.*Binary file/)
    );
    expect(result?.secretsFound).toBe(false);
  });

  it('should update gitignore for default report path', async () => {
    await securityScanCommand({ noExit: true });

    expect(gitignore.ensureGitignorePatterns).toHaveBeenCalled();
  });

  it('should update gitignore for custom report path', async () => {
    await securityScanCommand({
      out: 'custom/my-report.json',
      noExit: true,
    });

    expect(gitignore.ensurePatternInGitignore).toHaveBeenCalled();
  });

  it('should handle gitignore update errors gracefully', async () => {
    vi.mocked(gitignore.ensureGitignorePatterns).mockRejectedValue(new Error('No permission'));

    const result = await securityScanCommand({ noExit: true });

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not update .gitignore')
    );
    // Should still complete successfully
    expect(result?.secretsFound).toBe(false);
  });

  it('should output JSON in quiet mode', async () => {
    await securityScanCommand({ quiet: true, noExit: true });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/^\{.*filesScanned.*\}$/)
    );
  });

  it('should display scan progress when not quiet', async () => {
    await securityScanCommand({ noExit: true });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Scanning for secrets')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Scanning')
    );
  });

  it('should throw error when report cannot be written', async () => {
    vi.mocked(fs.writeFile).mockRejectedValue(new Error('Disk full'));

    await expect(securityScanCommand({ noExit: true }))
      .rejects.toThrow('Failed to write security report');
  });

  it('should filter false positives from matches', async () => {
    vi.mocked(secretDetector.scanFileForSecrets).mockReturnValue([
      { file: 'test.ts', line: 1, type: 'test', severity: 'low', snippet: 'x' },
    ]);
    vi.mocked(secretDetector.filterFalsePositives).mockReturnValue([]);

    const result = await securityScanCommand({ noExit: true });

    expect(result?.report.secretsFound).toBe(0);
  });
});

describe('securityHardResetCommand', () => {
  let originalConsoleLog: typeof console.log;
  let exitCode: number | undefined;

  beforeEach(() => {
    originalConsoleLog = console.log;
    exitCode = undefined;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      exitCode = code as number;
      return undefined as never;
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    vi.restoreAllMocks();
  });

  it('should delete report file with force flag', async () => {
    vi.mocked(fs.unlink).mockResolvedValue(undefined);

    await securityHardResetCommand({ force: true });

    expect(fs.unlink).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Reset complete')
    );
  });

  it('should handle non-existent report file gracefully', async () => {
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(fs.unlink).mockRejectedValue(error);

    await securityHardResetCommand({ force: true });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("No report file to reset")
    );
  });

  it('should throw error for non-ENOENT delete errors', async () => {
    const error = new Error('Permission denied') as NodeJS.ErrnoException;
    error.code = 'EACCES';
    vi.mocked(fs.unlink).mockRejectedValue(error);

    await expect(securityHardResetCommand({ force: true }))
      .rejects.toThrow('Failed to delete report file');
  });

  it('should not delete when user declines prompt', async () => {
    // readline mock returns 'n' by default
    await securityHardResetCommand({});

    expect(fs.unlink).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Reset cancelled')
    );
    expect(exitCode).toBe(0);
  });

  it('should be quiet when quiet flag is set', async () => {
    vi.mocked(fs.unlink).mockResolvedValue(undefined);

    await securityHardResetCommand({ force: true, quiet: true });

    expect(console.log).not.toHaveBeenCalled();
  });

  it('should use custom output path', async () => {
    vi.mocked(fs.unlink).mockResolvedValue(undefined);

    await securityHardResetCommand({
      force: true,
      out: 'custom/report.json',
    });

    expect(fs.unlink).toHaveBeenCalledWith('custom/report.json');
  });
});
