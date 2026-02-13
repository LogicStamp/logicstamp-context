import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join, resolve } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import {
  clearSecurityReportCache,
  getAndResetSanitizeStats,
  recordSanitization,
  recordSanitizationBatch,
  extractCodeHeader,
  readSourceCode,
  type SanitizeInfo,
  type SanitizeStats,
} from '../../../src/core/pack/loader.js';

describe('Loader Module', () => {
  describe('Security Report Cache', () => {
    it('should clear security report cache without throwing', () => {
      expect(() => clearSecurityReportCache()).not.toThrow();
    });

    it('should be safe to call multiple times', () => {
      expect(() => {
        clearSecurityReportCache();
        clearSecurityReportCache();
        clearSecurityReportCache();
      }).not.toThrow();
    });
  });

  describe('Sanitization Stats', () => {
    beforeEach(() => {
      // Reset stats before each test
      getAndResetSanitizeStats();
    });

    describe('getAndResetSanitizeStats', () => {
      it('should return empty stats initially', () => {
        const stats = getAndResetSanitizeStats();
        expect(stats).toEqual({
          filesWithSecrets: 0,
          totalSecretsReplaced: 0,
          filesProcessed: [],
        });
      });

      it('should reset stats after getting', () => {
        // Record some stats
        recordSanitization({
          hadSecrets: true,
          secretCount: 3,
          entryId: 'test/file.ts',
        });

        // First get should have stats
        const stats1 = getAndResetSanitizeStats();
        expect(stats1.filesWithSecrets).toBe(1);
        expect(stats1.totalSecretsReplaced).toBe(3);

        // Second get should be empty (reset happened)
        const stats2 = getAndResetSanitizeStats();
        expect(stats2.filesWithSecrets).toBe(0);
        expect(stats2.totalSecretsReplaced).toBe(0);
      });
    });

    describe('recordSanitization', () => {
      it('should record sanitization info when hadSecrets is true', () => {
        recordSanitization({
          hadSecrets: true,
          secretCount: 5,
          entryId: 'src/components/Secret.tsx',
        });

        const stats = getAndResetSanitizeStats();
        expect(stats.filesWithSecrets).toBe(1);
        expect(stats.totalSecretsReplaced).toBe(5);
        expect(stats.filesProcessed).toContain('src/components/Secret.tsx');
      });

      it('should not record when hadSecrets is false', () => {
        recordSanitization({
          hadSecrets: false,
          secretCount: 0,
          entryId: 'src/components/Clean.tsx',
        });

        const stats = getAndResetSanitizeStats();
        expect(stats.filesWithSecrets).toBe(0);
        expect(stats.totalSecretsReplaced).toBe(0);
        expect(stats.filesProcessed).toHaveLength(0);
      });

      it('should accumulate multiple records', () => {
        recordSanitization({
          hadSecrets: true,
          secretCount: 2,
          entryId: 'file1.ts',
        });
        recordSanitization({
          hadSecrets: true,
          secretCount: 3,
          entryId: 'file2.ts',
        });
        recordSanitization({
          hadSecrets: false,
          secretCount: 0,
          entryId: 'file3.ts',
        });

        const stats = getAndResetSanitizeStats();
        expect(stats.filesWithSecrets).toBe(2);
        expect(stats.totalSecretsReplaced).toBe(5);
        expect(stats.filesProcessed).toEqual(['file1.ts', 'file2.ts']);
      });
    });

    describe('recordSanitizationBatch', () => {
      it('should record multiple sanitization infos at once', () => {
        const batch: SanitizeInfo[] = [
          { hadSecrets: true, secretCount: 2, entryId: 'file1.ts' },
          { hadSecrets: true, secretCount: 3, entryId: 'file2.ts' },
          { hadSecrets: false, secretCount: 0, entryId: 'file3.ts' },
        ];

        recordSanitizationBatch(batch);

        const stats = getAndResetSanitizeStats();
        expect(stats.filesWithSecrets).toBe(2);
        expect(stats.totalSecretsReplaced).toBe(5);
        expect(stats.filesProcessed).toEqual(['file1.ts', 'file2.ts']);
      });

      it('should handle empty batch', () => {
        recordSanitizationBatch([]);

        const stats = getAndResetSanitizeStats();
        expect(stats.filesWithSecrets).toBe(0);
        expect(stats.totalSecretsReplaced).toBe(0);
      });

      it('should handle batch with all false hadSecrets', () => {
        const batch: SanitizeInfo[] = [
          { hadSecrets: false, secretCount: 0, entryId: 'file1.ts' },
          { hadSecrets: false, secretCount: 0, entryId: 'file2.ts' },
        ];

        recordSanitizationBatch(batch);

        const stats = getAndResetSanitizeStats();
        expect(stats.filesWithSecrets).toBe(0);
        expect(stats.totalSecretsReplaced).toBe(0);
        expect(stats.filesProcessed).toHaveLength(0);
      });
    });
  });

  describe('extractCodeHeader', () => {
    const testDir = join(process.cwd(), 'tests', 'fixtures', 'loader-test-temp');
    const testFile = join(testDir, 'test-file.ts');

    beforeEach(async () => {
      // Create temp directory and test file
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      // Clean up
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
      clearSecurityReportCache();
      getAndResetSanitizeStats();
    });

    it('should return CodeHeaderResult with header when @uif block exists', async () => {
      const content = `/**
 * @uif Contract 0.3
 * Description: Test component
 */
export function TestComponent() {
  return <div>Test</div>;
}`;
      await writeFile(testFile, content, 'utf8');

      const result = await extractCodeHeader(testFile, testDir);

      expect(result).toHaveProperty('header');
      expect(result.header).toContain('@uif');
      expect(result.header).toContain('Contract 0.3');
    });

    it('should return null header when no @uif block exists', async () => {
      const content = `export function TestComponent() {
  return <div>Test</div>;
}`;
      await writeFile(testFile, content, 'utf8');

      const result = await extractCodeHeader(testFile, testDir);

      expect(result).toHaveProperty('header');
      expect(result.header).toBeNull();
    });

    it('should return CodeHeaderResult structure even on error', async () => {
      // Non-existent file
      const result = await extractCodeHeader('non-existent-file.ts', testDir);

      expect(result).toHaveProperty('header');
      expect(result.header).toBeNull();
    });
  });

  describe('readSourceCode', () => {
    const testDir = join(process.cwd(), 'tests', 'fixtures', 'loader-test-temp');
    const testFile = join(testDir, 'test-file.ts');

    beforeEach(async () => {
      await mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
      clearSecurityReportCache();
      getAndResetSanitizeStats();
    });

    it('should return SourceCodeResult with code', async () => {
      const content = `export function TestComponent() {
  return <div>Test</div>;
}`;
      await writeFile(testFile, content, 'utf8');

      const result = await readSourceCode(testFile, testDir);

      expect(result).toHaveProperty('code');
      expect(result.code).toBe(content);
    });

    it('should return null code for non-existent file', async () => {
      const result = await readSourceCode('non-existent-file.ts', testDir);

      expect(result).toHaveProperty('code');
      expect(result.code).toBeNull();
    });

    it('should return SourceCodeResult structure', async () => {
      const content = 'const x = 1;';
      await writeFile(testFile, content, 'utf8');

      const result = await readSourceCode(testFile, testDir);

      // Result should have the expected structure
      expect(typeof result).toBe('object');
      expect('code' in result).toBe(true);
      // sanitizeInfo is optional
      expect(result.sanitizeInfo === undefined || typeof result.sanitizeInfo === 'object').toBe(true);
    });
  });
});
