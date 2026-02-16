import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { init, type InitOptions } from '../../../src/cli/commands/init.js';
import * as gitignore from '../../../src/utils/gitignore.js';
import * as config from '../../../src/utils/config.js';
import * as llmContext from '../../../src/utils/llmContext.js';
import * as security from '../../../src/cli/commands/security.js';

// Mock dependencies
vi.mock('../../../src/utils/gitignore.js');
vi.mock('../../../src/utils/config.js');
vi.mock('../../../src/utils/llmContext.js');
vi.mock('../../../src/cli/commands/security.js');

describe('init', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalStdoutIsTTY: boolean | undefined;
  let originalStdinIsTTY: boolean | undefined;
  let exitCode: number | undefined;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalStdoutIsTTY = process.stdout.isTTY;
    originalStdinIsTTY = process.stdin.isTTY;
    exitCode = undefined;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      exitCode = code as number;
      return undefined as never;
    });

    // Default to non-TTY mode (non-interactive)
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true });

    // Reset all mocks
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(gitignore.readGitignore).mockResolvedValue('');
    vi.mocked(gitignore.hasLogicStampPatterns).mockReturnValue(false);
    vi.mocked(gitignore.ensureGitignorePatterns).mockResolvedValue({ added: true, created: false });
    vi.mocked(config.updateConfig).mockResolvedValue();
    vi.mocked(llmContext.llmContextExists).mockResolvedValue(false);
    vi.mocked(llmContext.readPackageLLMContext).mockResolvedValue('# LLM Context');
    vi.mocked(llmContext.writeLLMContext).mockResolvedValue();
    vi.mocked(security.securityScanCommand).mockResolvedValue({
      secretsFound: false,
      report: {
        type: 'LogicStampSecurityReport',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        projectRoot: '/project',
        filesScanned: 10,
        secretsFound: 0,
        matches: [],
        filesWithSecrets: [],
      },
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    Object.defineProperty(process.stdout, 'isTTY', { value: originalStdoutIsTTY, writable: true });
    Object.defineProperty(process.stdin, 'isTTY', { value: originalStdinIsTTY, writable: true });
    vi.restoreAllMocks();
  });

  it('should initialize with default options', async () => {
    await init();

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Initializing LogicStamp'));
    expect(gitignore.ensureGitignorePatterns).toHaveBeenCalled();
    expect(llmContext.writeLLMContext).toHaveBeenCalled();
    expect(security.securityScanCommand).toHaveBeenCalled();
  });

  it('should skip gitignore setup when skipGitignore is true', async () => {
    await init({ skipGitignore: true });

    expect(gitignore.ensureGitignorePatterns).not.toHaveBeenCalled();
    expect(config.updateConfig).toHaveBeenCalledWith(
      expect.any(String),
      { gitignorePreference: 'skipped' }
    );
  });

  it('should skip security scan when noSecure is true', async () => {
    await init({ noSecure: true });

    expect(security.securityScanCommand).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('initialization complete'));
  });

  it('should handle existing gitignore patterns', async () => {
    vi.mocked(gitignore.hasLogicStampPatterns).mockReturnValue(true);
    vi.mocked(gitignore.ensureGitignorePatterns).mockResolvedValue({ added: false, created: false });

    await init();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('already contains all LogicStamp patterns')
    );
  });

  it('should handle existing LLM_CONTEXT.md', async () => {
    vi.mocked(llmContext.llmContextExists).mockResolvedValue(true);

    await init();

    expect(llmContext.writeLLMContext).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('LLM_CONTEXT.md already exists')
    );
  });

  it('should create gitignore when it does not exist', async () => {
    vi.mocked(gitignore.ensureGitignorePatterns).mockResolvedValue({ added: true, created: true });

    await init();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Created .gitignore')
    );
  });

  it('should add patterns to existing gitignore', async () => {
    vi.mocked(gitignore.ensureGitignorePatterns).mockResolvedValue({ added: true, created: false });

    await init();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Added LogicStamp patterns')
    );
  });

  it('should use default LLM context template when package template not found', async () => {
    vi.mocked(llmContext.readPackageLLMContext).mockResolvedValue(null);

    await init();

    expect(llmContext.writeLLMContext).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('# LLM Context')
    );
  });

  it('should handle gitignore setup errors gracefully', async () => {
    vi.mocked(gitignore.ensureGitignorePatterns).mockRejectedValue(new Error('Permission denied'));

    await init();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to update .gitignore'),
      expect.any(String)
    );
    // Should continue with the rest of init
    expect(llmContext.writeLLMContext).toHaveBeenCalled();
  });

  it('should handle LLM context creation errors gracefully', async () => {
    vi.mocked(llmContext.writeLLMContext).mockRejectedValue(new Error('Write failed'));

    await init();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create LLM_CONTEXT.md'),
      expect.any(String)
    );
  });

  it('should handle security scan errors gracefully', async () => {
    vi.mocked(security.securityScanCommand).mockRejectedValue(new Error('Scan failed'));

    await init();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Security scan failed'),
      expect.any(String)
    );
  });

  it('should exit with 1 when secrets are found', async () => {
    vi.mocked(security.securityScanCommand).mockResolvedValue({
      secretsFound: true,
      report: {
        type: 'LogicStampSecurityReport',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        projectRoot: '/project',
        filesScanned: 10,
        secretsFound: 3,
        matches: [],
        filesWithSecrets: ['src/config.ts'],
      },
    });

    await init();

    expect(exitCode).toBe(1);
  });

  it('should update config with preferences', async () => {
    await init();

    expect(config.updateConfig).toHaveBeenCalledWith(
      expect.any(String),
      { gitignorePreference: 'added' }
    );
    expect(config.updateConfig).toHaveBeenCalledWith(
      expect.any(String),
      { llmContextPreference: 'added' }
    );
  });

  it('should use target directory when provided', async () => {
    await init({ targetDir: '/custom/path' });

    expect(gitignore.ensureGitignorePatterns).toHaveBeenCalledWith(
      expect.stringContaining('custom')
    );
  });

  it('should show next steps when noSecure is true', async () => {
    await init({ noSecure: true });

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Next steps'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('stamp context'));
  });

  it('should pass noExit option to security scan', async () => {
    await init();

    expect(security.securityScanCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        noExit: true,
      })
    );
  });

  it('should update existing gitignore section with missing patterns', async () => {
    vi.mocked(gitignore.hasLogicStampPatterns).mockReturnValue(true);
    vi.mocked(gitignore.ensureGitignorePatterns).mockResolvedValue({ added: true, created: false });

    await init();

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Updated existing LogicStamp section')
    );
  });
});
