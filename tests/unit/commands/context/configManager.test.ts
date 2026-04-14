/**
 * Unit tests for configManager module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../../../src/utils/config.js', () => ({
  readConfig: vi.fn(),
  configExists: vi.fn(),
  writeConfig: vi.fn(),
}));

vi.mock('../../../../src/utils/gitignore.js', () => ({
  smartGitignoreSetup: vi.fn(),
}));

vi.mock('../../../../src/utils/llmContext.js', () => ({
  smartLLMContextSetup: vi.fn(),
}));

// Import after mocks
import {
  ensureConfigExists,
  setupGitignore,
  setupLLMContext,
} from '../../../../src/cli/commands/context/configManager.js';
import {
  configExists,
  writeConfig,
  readConfig,
} from '../../../../src/utils/config.js';
import { smartGitignoreSetup } from '../../../../src/utils/gitignore.js';
import { smartLLMContextSetup } from '../../../../src/utils/llmContext.js';

describe('configManager', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('ensureConfigExists', () => {
    it('should create config with defaults when missing', async () => {
      vi.mocked(configExists).mockResolvedValue(false);
      vi.mocked(writeConfig).mockResolvedValue(undefined);

      await ensureConfigExists('/project', { quiet: false });

      expect(writeConfig).toHaveBeenCalledWith('/project', {
        gitignorePreference: 'skipped',
        llmContextPreference: 'skipped',
      });
    });

    it('should skip creation when config exists', async () => {
      vi.mocked(configExists).mockResolvedValue(true);

      await ensureConfigExists('/project', { quiet: false });

      expect(writeConfig).not.toHaveBeenCalled();
    });

    it('should suppress logging when quiet flag is true', async () => {
      vi.mocked(configExists).mockResolvedValue(false);
      vi.mocked(writeConfig).mockResolvedValue(undefined);

      await ensureConfigExists('/project', { quiet: true });

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should log hint message when not quiet', async () => {
      vi.mocked(configExists).mockResolvedValue(false);
      vi.mocked(writeConfig).mockResolvedValue(undefined);

      await ensureConfigExists('/project', { quiet: false });

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('No LogicStamp config found');
      expect(calls).toContain('stamp init');
    });

    it('should swallow errors silently', async () => {
      vi.mocked(configExists).mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      await expect(ensureConfigExists('/project', {})).resolves.not.toThrow();
    });

    it('should swallow writeConfig errors silently', async () => {
      vi.mocked(configExists).mockResolvedValue(false);
      vi.mocked(writeConfig).mockRejectedValue(new Error('Write failed'));

      // Should not throw
      await expect(ensureConfigExists('/project', {})).resolves.not.toThrow();
    });
  });

  describe('setupGitignore', () => {
    it('should skip gitignore when skipGitignore option is true', async () => {
      vi.mocked(readConfig).mockResolvedValue({
        gitignorePreference: 'added',
        llmContextPreference: 'skipped',
      });
      vi.mocked(smartGitignoreSetup).mockResolvedValue({
        added: false,
        created: false,
      });

      await setupGitignore('/project', { skipGitignore: true });

      expect(smartGitignoreSetup).toHaveBeenCalledWith('/project', {
        skipGitignore: true,
      });
    });

    it('should skip gitignore when config preference is skipped', async () => {
      vi.mocked(readConfig).mockResolvedValue({
        gitignorePreference: 'skipped',
        llmContextPreference: 'skipped',
      });
      vi.mocked(smartGitignoreSetup).mockResolvedValue({
        added: false,
        created: false,
      });

      await setupGitignore('/project', {});

      expect(smartGitignoreSetup).toHaveBeenCalledWith('/project', {
        skipGitignore: true,
      });
    });

    it('should skip gitignore when no preference is set (default to skip)', async () => {
      vi.mocked(readConfig).mockResolvedValue({
        llmContextPreference: 'skipped',
      });
      vi.mocked(smartGitignoreSetup).mockResolvedValue({
        added: false,
        created: false,
      });

      await setupGitignore('/project', {});

      expect(smartGitignoreSetup).toHaveBeenCalledWith('/project', {
        skipGitignore: true,
      });
    });

    it('should log when patterns are added and not quiet', async () => {
      vi.mocked(readConfig).mockResolvedValue({
        gitignorePreference: 'added',
        llmContextPreference: 'skipped',
      });
      vi.mocked(smartGitignoreSetup).mockResolvedValue({
        added: true,
        created: false,
      });

      await setupGitignore('/project', { quiet: false });

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Added LogicStamp patterns to .gitignore');
    });

    it('should log when gitignore is created and not quiet', async () => {
      vi.mocked(readConfig).mockResolvedValue({
        gitignorePreference: 'added',
        llmContextPreference: 'skipped',
      });
      vi.mocked(smartGitignoreSetup).mockResolvedValue({
        added: true,
        created: true,
      });

      await setupGitignore('/project', { quiet: false });

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Created .gitignore with LogicStamp patterns');
    });

    it('should suppress logging when quiet flag is true', async () => {
      vi.mocked(readConfig).mockResolvedValue({
        gitignorePreference: 'added',
        llmContextPreference: 'skipped',
      });
      vi.mocked(smartGitignoreSetup).mockResolvedValue({
        added: true,
        created: true,
      });

      await setupGitignore('/project', { quiet: true });

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should swallow errors silently', async () => {
      vi.mocked(readConfig).mockRejectedValue(new Error('Config read error'));

      // Should not throw
      await expect(setupGitignore('/project', {})).resolves.not.toThrow();
    });
  });

  describe('setupLLMContext', () => {
    it('should log when LLM_CONTEXT.md is created and not quiet', async () => {
      vi.mocked(smartLLMContextSetup).mockResolvedValue({ added: true });

      await setupLLMContext('/project', { quiet: false });

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Created LLM_CONTEXT.md');
    });

    it('should not log when file was not added', async () => {
      vi.mocked(smartLLMContextSetup).mockResolvedValue({ added: false });

      await setupLLMContext('/project', { quiet: false });

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should suppress logging when quiet flag is true', async () => {
      vi.mocked(smartLLMContextSetup).mockResolvedValue({ added: true });

      await setupLLMContext('/project', { quiet: true });

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should swallow errors silently', async () => {
      vi.mocked(smartLLMContextSetup).mockRejectedValue(
        new Error('Setup error'),
      );

      // Should not throw
      await expect(setupLLMContext('/project', {})).resolves.not.toThrow();
    });
  });
});
