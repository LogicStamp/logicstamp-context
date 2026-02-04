import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  readPackageLLMContext,
  llmContextExists,
  writeLLMContext,
  smartLLMContextSetup,
} from '../../../src/utils/llmContext.js';
import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import * as config from '../../../src/utils/config.js';

// Mock fs/promises
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
    readFile: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
  };
});

vi.mock('../../../src/utils/config.js', () => ({
  readConfig: vi.fn(),
}));

describe('llmContext utils', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'logicstamp-test-'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('readPackageLLMContext', () => {
    it('should return null when file does not exist', async () => {
      vi.mocked(access).mockRejectedValue(new Error('File not found'));

      const result = await readPackageLLMContext();

      expect(result).toBeNull();
    });

    it('should read file from first possible path', async () => {
      const mockContent = '# LLM Context\nTest content';
      vi.mocked(access).mockResolvedValueOnce(undefined);
      vi.mocked(readFile).mockResolvedValueOnce(mockContent);

      const result = await readPackageLLMContext();

      expect(result).toBe(mockContent);
      expect(readFile).toHaveBeenCalled();
    });

    it('should try multiple paths', async () => {
      vi.mocked(access)
        .mockRejectedValueOnce(new Error('Not found'))
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(undefined);
      vi.mocked(readFile).mockResolvedValueOnce('Found content');

      const result = await readPackageLLMContext();

      expect(result).toBe('Found content');
      expect(access).toHaveBeenCalledTimes(3);
    });
  });

  describe('llmContextExists', () => {
    it('should return false when file does not exist', async () => {
      vi.mocked(access).mockRejectedValue(new Error('File not found'));

      const exists = await llmContextExists(testDir);

      expect(exists).toBe(false);
    });

    it('should return true when file exists', async () => {
      vi.mocked(access).mockResolvedValue(undefined);

      const exists = await llmContextExists(testDir);

      expect(exists).toBe(true);
    });
  });

  describe('writeLLMContext', () => {
    it('should write content to file', async () => {
      const content = '# LLM Context\nTest content';

      await writeLLMContext(testDir, content);

      expect(writeFile).toHaveBeenCalledWith(
        join(testDir, 'LLM_CONTEXT.md'),
        content,
        'utf-8'
      );
    });
  });

  describe('smartLLMContextSetup', () => {
    it('should return skipped when file already exists', async () => {
      vi.mocked(access).mockResolvedValue(undefined); // File exists

      const result = await smartLLMContextSetup(testDir);

      expect(result).toEqual({ added: false, prompted: false, skipped: false });
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('should create file when config preference is "added"', async () => {
      const packageContent = 'Package LLM context content';
      // Mock access: 
      // - First call: llmContextExists check (should fail - file doesn't exist in testDir)
      // - Next 3 calls: readPackageLLMContext tries 3 paths, last one succeeds
      vi.mocked(access)
        .mockRejectedValueOnce(new Error('File not found')) // llmContextExists check
        .mockRejectedValueOnce(new Error('Not found')) // readPackageLLMContext path 1
        .mockRejectedValueOnce(new Error('Not found')) // readPackageLLMContext path 2
        .mockResolvedValueOnce(undefined); // readPackageLLMContext path 3 succeeds
      vi.mocked(config.readConfig).mockResolvedValue({
        llmContextPreference: 'added',
      });
      vi.mocked(readFile).mockResolvedValue(packageContent);

      const result = await smartLLMContextSetup(testDir);

      expect(result).toEqual({ added: true, prompted: false, skipped: false });
      expect(writeFile).toHaveBeenCalledWith(
        join(testDir, 'LLM_CONTEXT.md'),
        packageContent,
        'utf-8'
      );
    });

    it('should skip when config preference is "skipped"', async () => {
      vi.mocked(access).mockRejectedValue(new Error('File not found'));
      vi.mocked(config.readConfig).mockResolvedValue({
        llmContextPreference: 'skipped',
      });

      const result = await smartLLMContextSetup(testDir);

      expect(result).toEqual({ added: false, prompted: false, skipped: true });
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('should skip when no config exists (default behavior)', async () => {
      vi.mocked(access).mockRejectedValue(new Error('File not found'));
      vi.mocked(config.readConfig).mockResolvedValue({});

      const result = await smartLLMContextSetup(testDir);

      expect(result).toEqual({ added: false, prompted: false, skipped: true });
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('should skip when package LLM context cannot be read', async () => {
      vi.mocked(access).mockRejectedValue(new Error('File not found'));
      vi.mocked(config.readConfig).mockResolvedValue({
        llmContextPreference: 'added',
      });
      vi.mocked(readFile).mockRejectedValue(new Error('Package file not found'));

      const result = await smartLLMContextSetup(testDir);

      expect(result).toEqual({ added: false, prompted: false, skipped: true });
      expect(writeFile).not.toHaveBeenCalled();
    });
  });
});
