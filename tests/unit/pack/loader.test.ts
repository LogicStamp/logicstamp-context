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
  loadContract,
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

  describe('loadContract Schema Validation', () => {
    const testDir = join(process.cwd(), 'tests', 'fixtures', 'loader-contract-temp');
    const testFile = join(testDir, 'Button.tsx');
    const sidecarFile = join(testDir, 'Button.tsx.uif.json');

    beforeEach(async () => {
      await mkdir(testDir, { recursive: true });
      // Create a dummy source file
      await writeFile(testFile, 'export function Button() { return <button />; }', 'utf8');
    });

    afterEach(async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should load valid contract from sidecar file', async () => {
      const validContract = {
        type: 'UIFContract',
        schemaVersion: '0.4',
        kind: 'react:component',
        entryId: 'Button.tsx',
        description: 'A button component',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: ['Button'],
        },
        interface: {
          props: {},
          emits: {},
        },
        semanticHash: 'uif:abcdef123456789012345678',
        fileHash: 'uif:123456789abcdef012345678',
      };
      await writeFile(sidecarFile, JSON.stringify(validContract), 'utf8');

      const result = await loadContract('Button.tsx', testDir);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('UIFContract');
      expect(result?.kind).toBe('react:component');
      expect(result?.entryId).toBe('Button.tsx');
    });

    it('should return null for invalid contract (wrong schemaVersion)', async () => {
      const invalidContract = {
        type: 'UIFContract',
        schemaVersion: '0.3', // Wrong version
        kind: 'react:component',
        entryId: 'Button.tsx',
        description: 'A button component',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
        },
        interface: {
          props: {},
          emits: {},
        },
        semanticHash: 'uif:abcdef123456789012345678',
        fileHash: 'uif:123456789abcdef012345678',
      };
      await writeFile(sidecarFile, JSON.stringify(invalidContract), 'utf8');

      const result = await loadContract('Button.tsx', testDir);

      expect(result).toBeNull();
    });

    it('should return null for invalid contract (missing required fields)', async () => {
      const invalidContract = {
        type: 'UIFContract',
        schemaVersion: '0.4',
        // Missing: kind, entryId, description, composition, interface, semanticHash, fileHash
      };
      await writeFile(sidecarFile, JSON.stringify(invalidContract), 'utf8');

      const result = await loadContract('Button.tsx', testDir);

      expect(result).toBeNull();
    });

    it('should return null for invalid contract (wrong type)', async () => {
      const invalidContract = {
        type: 'WrongType', // Wrong type
        schemaVersion: '0.4',
        kind: 'react:component',
        entryId: 'Button.tsx',
        description: 'A button component',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
        },
        interface: {
          props: {},
          emits: {},
        },
        semanticHash: 'uif:abcdef123456789012345678',
        fileHash: 'uif:123456789abcdef012345678',
      };
      await writeFile(sidecarFile, JSON.stringify(invalidContract), 'utf8');

      const result = await loadContract('Button.tsx', testDir);

      expect(result).toBeNull();
    });

    it('should return null for invalid contract (extra properties)', async () => {
      const invalidContract = {
        type: 'UIFContract',
        schemaVersion: '0.4',
        kind: 'react:component',
        entryId: 'Button.tsx',
        description: 'A button component',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
        },
        interface: {
          props: {},
          emits: {},
        },
        semanticHash: 'uif:abcdef123456789012345678',
        fileHash: 'uif:123456789abcdef012345678',
        unknownExtraField: 'should cause validation failure',
      };
      await writeFile(sidecarFile, JSON.stringify(invalidContract), 'utf8');

      const result = await loadContract('Button.tsx', testDir);

      expect(result).toBeNull();
    });

    it('should return null for malformed JSON', async () => {
      await writeFile(sidecarFile, '{ invalid json }', 'utf8');

      const result = await loadContract('Button.tsx', testDir);

      expect(result).toBeNull();
    });

    it('should return null when sidecar file does not exist', async () => {
      const result = await loadContract('NonExistent.tsx', testDir);

      expect(result).toBeNull();
    });
  });

  describe('Path Traversal Protection', () => {
    const testDir = join(process.cwd(), 'tests', 'fixtures', 'loader-test-temp');
    const subDir = join(testDir, 'subdir');
    const testFile = join(subDir, 'test-file.ts');

    beforeEach(async () => {
      await mkdir(subDir, { recursive: true });
      await writeFile(testFile, 'export const x = 1;', 'utf8');
    });

    afterEach(async () => {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('loadContract', () => {
      it('should reject paths with ../ traversal', async () => {
        const result = await loadContract('../../../etc/passwd', testDir);
        expect(result).toBeNull();
      });

      it('should reject paths with multiple ../ sequences', async () => {
        const result = await loadContract('subdir/../../outside/file.ts', testDir);
        expect(result).toBeNull();
      });

      it('should allow valid relative paths within project', async () => {
        // This will return null because the .uif.json file doesn't exist,
        // but it should not be rejected by path validation
        const result = await loadContract('subdir/test-file.ts', testDir);
        // Returns null because .uif.json doesn't exist, not because of path validation
        expect(result).toBeNull();
      });
    });

    describe('extractCodeHeader', () => {
      it('should reject paths with ../ traversal', async () => {
        const result = await extractCodeHeader('../../../etc/passwd', testDir);
        expect(result.header).toBeNull();
      });

      it('should reject paths that escape project root', async () => {
        const result = await extractCodeHeader('subdir/../../../outside.ts', testDir);
        expect(result.header).toBeNull();
      });

      it('should allow valid paths within project', async () => {
        // Create a file with @uif header
        const fileWithHeader = join(subDir, 'with-header.ts');
        await writeFile(fileWithHeader, '/**\n * @uif Test\n */\nexport const x = 1;', 'utf8');

        const result = await extractCodeHeader('subdir/with-header.ts', testDir);
        expect(result.header).toContain('@uif');
      });
    });

    describe('readSourceCode', () => {
      it('should reject paths with ../ traversal', async () => {
        const result = await readSourceCode('../../../etc/passwd', testDir);
        expect(result.code).toBeNull();
      });

      it('should reject paths that escape project root', async () => {
        const result = await readSourceCode('foo/../../bar/../../../outside.ts', testDir);
        expect(result.code).toBeNull();
      });

      it('should allow valid paths within project', async () => {
        const result = await readSourceCode('subdir/test-file.ts', testDir);
        expect(result.code).toBe('export const x = 1;');
      });

      it('should allow paths with ../ that stay within project', async () => {
        // subdir/../subdir/test-file.ts resolves to subdir/test-file.ts which is valid
        const result = await readSourceCode('subdir/../subdir/test-file.ts', testDir);
        expect(result.code).toBe('export const x = 1;');
      });
    });
  });
});
