import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join, isAbsolute, resolve } from 'node:path';
import { tmpdir, platform } from 'node:os';
import type { GlobOptions } from 'glob';

// Capture the real glob before mocking (vi.hoisted runs before vi.mock)
const { realGlob, mockGlobBehavior } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { glob } = require('glob') as { glob: typeof import('glob').glob };
  return {
    realGlob: glob,
    mockGlobBehavior: { current: null as ((pattern: string, options: GlobOptions) => Promise<string[]>) | null },
  };
});

vi.mock('glob', () => ({
  glob: vi.fn(async (pattern: string, options: GlobOptions) => {
    if (mockGlobBehavior.current) {
      return mockGlobBehavior.current(pattern, options);
    }
    return realGlob(pattern, options) as Promise<string[]>;
  }),
}));

import {
  globFiles,
  normalizeEntryId,
  isPathWithinRoot,
  getRelativePath,
  fileExists,
  readFileWithText,
  resolvePath,
  findSidecarFiles,
  deleteSidecar,
  getSidecarPath,
  getFolderPath,
  groupFilesByFolder,
} from '../../../src/utils/fsx.js';


describe('fsx utilities', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'fsx-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('normalizeEntryId', () => {
    it('should normalize Windows paths to forward slashes', () => {
      const normalized = normalizeEntryId('src\\components\\Button.tsx');
      expect(normalized).toBe('src/components/Button.tsx');
    });

    it('should leave Unix paths unchanged', () => {
      const normalized = normalizeEntryId('src/components/Button.tsx');
      expect(normalized).toBe('src/components/Button.tsx');
    });

    it('should handle mixed slashes', () => {
      const normalized = normalizeEntryId('src\\components/Button.tsx');
      expect(normalized).toBe('src/components/Button.tsx');
    });

    it('should normalize Windows drive letter to lowercase', () => {
      const normalized = normalizeEntryId('C:\\project\\file.ts');
      expect(normalized).toBe('c:/project/file.ts');
    });

    it('should remove leading ./', () => {
      const normalized = normalizeEntryId('./src/file.ts');
      expect(normalized).toBe('src/file.ts');
    });

    it('should handle paths with .. segments', () => {
      const normalized = normalizeEntryId('src/../components/file.ts');
      expect(normalized).toBe('components/file.ts');
    });
  });

  describe('isPathWithinRoot', () => {
    it('should allow nested paths under root', () => {
      expect(isPathWithinRoot('src/components/App.tsx', testDir)).toBe(true);
    });

    it('should allow a file at project root', () => {
      expect(isPathWithinRoot('package.json', testDir)).toBe(true);
    });

    it('should reject traversal outside root', () => {
      expect(isPathWithinRoot('../../../etc/passwd', testDir)).toBe(false);
    });

    it('should reject pure parent hops', () => {
      expect(isPathWithinRoot('..', testDir)).toBe(false);
    });
  });

  describe('getRelativePath', () => {
    it('should return relative path from base directory', () => {
      const base = '/project';
      const target = '/project/src/App.tsx';
      const relative = getRelativePath(base, target);
      expect(relative).toBe('src/App.tsx');
    });

    it('should handle same directory', () => {
      const base = '/project';
      const target = '/project/file.ts';
      const relative = getRelativePath(base, target);
      expect(relative).toBe('file.ts');
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      const filePath = join(testDir, 'test.txt');
      await writeFile(filePath, 'content');

      const exists = await fileExists(filePath);
      expect(exists).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      const filePath = join(testDir, 'nonexistent.txt');

      const exists = await fileExists(filePath);
      expect(exists).toBe(false);
    });

    it('should return false when path is a directory', async () => {
      const dirPath = join(testDir, 'subdir');
      await mkdir(dirPath);

      const exists = await fileExists(dirPath);
      expect(exists).toBe(false);
    });
  });

  describe('readFileWithText', () => {
    it('should read file and return path and text', async () => {
      const filePath = join(testDir, 'test.txt');
      const content = 'Hello, World!';
      await writeFile(filePath, content);

      const result = await readFileWithText(filePath);

      expect(result.path).toBe(filePath);
      expect(result.text).toBe(content);
    });

    it('should throw error when file does not exist', async () => {
      const filePath = join(testDir, 'nonexistent.txt');

      await expect(readFileWithText(filePath)).rejects.toThrow();
    });
  });

  describe('resolvePath', () => {
    it('should resolve relative path from base directory', () => {
      const base = '/project';
      const relative = 'src/App.tsx';
      const resolved = resolvePath(base, relative);

      expect(resolved).toContain('src');
      expect(resolved).toContain('App.tsx');
    });

    it('should return absolute path unchanged', () => {
      const base = '/project';
      // Use platform-appropriate absolute path
      const absolute = platform() === 'win32' 
        ? resolve('C:\\absolute\\path\\file.ts')
        : '/absolute/path/file.ts';
      const resolved = resolvePath(base, absolute);

      // On Windows, resolve() normalizes the path, so we check that it's still absolute
      // and contains the expected components
      expect(isAbsolute(resolved)).toBe(true);
      expect(resolved).toContain('absolute');
      expect(resolved).toContain('path');
      expect(resolved).toContain('file.ts');
    });
  });

  describe('globFiles', () => {
    it('should find TypeScript files', async () => {
      await writeFile(join(testDir, 'file1.ts'), 'content');
      await writeFile(join(testDir, 'file2.tsx'), 'content');
      await mkdir(join(testDir, 'subdir'));
      await writeFile(join(testDir, 'subdir', 'file3.ts'), 'content');

      const files = await globFiles(testDir, '.ts,.tsx');

      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.includes('file1.ts'))).toBe(true);
      expect(files.some(f => f.includes('file2.tsx'))).toBe(true);
    });

    it('should exclude test files by default', async () => {
      await writeFile(join(testDir, 'file.ts'), 'content');
      await writeFile(join(testDir, 'file.test.ts'), 'content');
      await writeFile(join(testDir, 'file.spec.ts'), 'content');

      const files = await globFiles(testDir, '.ts');

      expect(files.some(f => f.includes('file.test.ts'))).toBe(false);
      expect(files.some(f => f.includes('file.spec.ts'))).toBe(false);
      expect(files.some(f => f.includes('file.ts'))).toBe(true);
    });

    it('should exclude node_modules', async () => {
      await writeFile(join(testDir, 'file.ts'), 'content');
      await mkdir(join(testDir, 'node_modules'));
      await writeFile(join(testDir, 'node_modules', 'dep.ts'), 'content');

      const files = await globFiles(testDir, '.ts');

      expect(files.some(f => f.includes('node_modules'))).toBe(false);
    });

    it('should handle custom extensions', async () => {
      await writeFile(join(testDir, 'file.js'), 'content');
      await writeFile(join(testDir, 'file.jsx'), 'content');

      const files = await globFiles(testDir, '.js,.jsx');

      expect(files.length).toBeGreaterThan(0);
    });

    it('should handle extensions without leading dot', async () => {
      await writeFile(join(testDir, 'file.js'), 'content');

      const files = await globFiles(testDir, 'js');

      expect(files.length).toBeGreaterThan(0);
      expect(files.some(f => f.includes('file.js'))).toBe(true);
    });

    it('should remove duplicates and sort results', async () => {
      await writeFile(join(testDir, 'file.ts'), 'content');

      const files = await globFiles(testDir, '.ts');

      // Should be sorted
      const sorted = [...files].sort();
      expect(files).toEqual(sorted);
    });

    describe('resilient failure handling', () => {
      afterEach(() => {
        // Reset mock behavior to default (use real glob)
        mockGlobBehavior.current = null;
      });

      it('should throw aggregate error when all patterns fail', async () => {
        // Configure mock to throw for all patterns
        mockGlobBehavior.current = async () => {
          throw new Error('EACCES: permission denied');
        };

        await expect(globFiles(testDir, '.ts,.tsx')).rejects.toThrow(
          /All glob patterns failed/
        );
      });

      it('should return partial results when some patterns succeed and others fail', async () => {
        // Create test file for successful pattern
        await writeFile(join(testDir, 'file.ts'), 'content');

        let callCount = 0;
        mockGlobBehavior.current = async (pattern: string, options: GlobOptions) => {
          callCount++;
          if (pattern === '**/*.tsx') {
            throw new Error('EACCES: permission denied');
          }
          // Use real glob for other patterns
          return realGlob(pattern, options) as Promise<string[]>;
        };

        const files = await globFiles(testDir, '.ts,.tsx');

        // Should have results from successful .ts pattern only
        expect(files.length).toBe(1);
        expect(files.some(f => f.includes('file.ts'))).toBe(true);
        expect(callCount).toBe(2);
      });

      it('should continue processing remaining patterns after one fails', async () => {
        // Create files for patterns that will succeed
        await writeFile(join(testDir, 'a.ts'), 'content');
        await writeFile(join(testDir, 'c.js'), 'content');

        const patternsAttempted: string[] = [];
        mockGlobBehavior.current = async (pattern: string, options: GlobOptions) => {
          patternsAttempted.push(pattern);
          if (pattern === '**/*.tsx') {
            throw new Error('EACCES: permission denied');
          }
          return realGlob(pattern, options) as Promise<string[]>;
        };

        const files = await globFiles(testDir, '.ts,.tsx,.js');

        expect(files.length).toBe(2);
        expect(files.some(f => f.endsWith('a.ts'))).toBe(true);
        expect(files.some(f => f.endsWith('c.js'))).toBe(true);
        // Verify all three patterns were attempted
        expect(patternsAttempted).toEqual(['**/*.ts', '**/*.tsx', '**/*.js']);
      });
    });
  });

  describe('findSidecarFiles', () => {
    it('should find sidecar files', async () => {
      await writeFile(join(testDir, 'component.tsx'), 'content');
      await writeFile(join(testDir, 'component.tsx.uif.json'), '{}');
      await writeFile(join(testDir, 'other.tsx'), 'content');

      const sidecars = await findSidecarFiles(testDir);

      expect(sidecars.length).toBeGreaterThan(0);
      expect(sidecars.some(f => f.includes('component.tsx.uif.json'))).toBe(true);
    });

    it('should exclude node_modules', async () => {
      await mkdir(join(testDir, 'node_modules'));
      await writeFile(join(testDir, 'node_modules', 'dep.tsx.uif.json'), '{}');

      const sidecars = await findSidecarFiles(testDir);

      expect(sidecars.some(f => f.includes('node_modules'))).toBe(false);
    });

    it('should return empty array when no sidecars exist', async () => {
      await writeFile(join(testDir, 'file.ts'), 'content');

      const sidecars = await findSidecarFiles(testDir);

      expect(sidecars).toEqual([]);
    });

    it('should return empty array on error (sidecars are optional)', async () => {
      const sidecars = await findSidecarFiles('/nonexistent/path');

      expect(sidecars).toEqual([]);
    });
  });

  describe('deleteSidecar', () => {
    it('should delete sidecar file', async () => {
      const sidecarPath = join(testDir, 'file.tsx.uif.json');
      await writeFile(sidecarPath, '{}');

      await deleteSidecar(sidecarPath);

      const exists = await fileExists(sidecarPath);
      expect(exists).toBe(false);
    });

    it('should not throw when file does not exist', async () => {
      const sidecarPath = join(testDir, 'nonexistent.uif.json');

      await expect(deleteSidecar(sidecarPath)).resolves.not.toThrow();
    });
  });

  describe('getSidecarPath', () => {
    it('should return sidecar path for absolute source path', () => {
      const sourcePath = '/absolute/path/file.tsx';
      const sidecarPath = getSidecarPath(sourcePath, '/output');

      expect(sidecarPath).toBe('/absolute/path/file.tsx.uif.json');
    });

    it('should return sidecar path relative to outRoot for relative source path', () => {
      const sourcePath = 'src/components/Button.tsx';
      const outRoot = '/output';
      const sidecarPath = getSidecarPath(sourcePath, outRoot);

      expect(sidecarPath).toContain('output');
      expect(sidecarPath).toContain('Button.tsx.uif.json');
    });
  });

  describe('getFolderPath', () => {
    it('should return folder path for file', () => {
      const folderPath = getFolderPath('src/components/Button.tsx');
      expect(folderPath).toBe('src/components');
    });

    it('should return . for file in root', () => {
      const folderPath = getFolderPath('file.ts');
      expect(folderPath).toBe('.');
    });

    it('should handle nested paths', () => {
      const folderPath = getFolderPath('src/components/ui/Button.tsx');
      expect(folderPath).toBe('src/components/ui');
    });

    it('should normalize paths', () => {
      const folderPath = getFolderPath('src\\components\\Button.tsx');
      expect(folderPath).toBe('src/components');
    });
  });

  describe('groupFilesByFolder', () => {
    it('should group files by folder', () => {
      const files = [
        'src/components/Button.tsx',
        'src/components/Card.tsx',
        'src/utils/helpers.ts',
        'src/utils/constants.ts',
      ];

      const grouped = groupFilesByFolder(files);

      expect(grouped.size).toBe(2);
      expect(grouped.get('src/components')).toEqual([
        'src/components/Button.tsx',
        'src/components/Card.tsx',
      ]);
      expect(grouped.get('src/utils')).toEqual([
        'src/utils/helpers.ts',
        'src/utils/constants.ts',
      ]);
    });

    it('should handle files in root', () => {
      const files = ['file1.ts', 'file2.ts', 'src/components/Button.tsx'];

      const grouped = groupFilesByFolder(files);

      expect(grouped.get('.')).toEqual(['file1.ts', 'file2.ts']);
      expect(grouped.get('src/components')).toEqual(['src/components/Button.tsx']);
    });

    it('should handle empty array', () => {
      const grouped = groupFilesByFolder([]);

      expect(grouped.size).toBe(0);
    });
  });
});
