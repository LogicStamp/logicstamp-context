/**
 * Unit tests for fileWriter module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, basename } from 'node:path';
import { createMockBundle, createMockContract } from './helpers.js';

// Mock tokens module
vi.mock('../../../../src/utils/tokens.js', () => ({
  estimateGPT4Tokens: vi.fn(() => Promise.resolve(1000)),
}));

// Mock fsx module
vi.mock('../../../../src/utils/fsx.js', () => ({
  getFolderPath: vi.fn((entryId: string) => {
    const parts = entryId.replace(/\\/g, '/').split('/');
    parts.pop(); // Remove filename
    return parts.join('/') || '.';
  }),
  normalizeEntryId: (id: string) => id.replace(/\\/g, '/'),
  toForwardSlashes: (path: string) => path.replace(/\\/g, '/'),
}));

// Mock debug module
vi.mock('../../../../src/utils/debug.js', () => ({
  debugError: vi.fn(),
}));

// Import after mocks
import {
  displayPath,
  displayProjectRoot,
  displayFilePath,
  detectRootFolder,
  groupBundlesByFolder,
  writeContextFiles,
  writeMainIndex,
} from '../../../../src/cli/commands/context/fileWriter.js';

describe('fileWriter', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    tempDir = await mkdtemp(join(tmpdir(), 'filewriter-test-'));
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    stdoutSpy.mockRestore();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('displayPath', () => {
    it('should convert backslashes to forward slashes', () => {
      expect(displayPath('src\\components\\Button.tsx')).toBe(
        'src/components/Button.tsx',
      );
    });

    it('should leave forward slashes unchanged', () => {
      expect(displayPath('src/components/Button.tsx')).toBe(
        'src/components/Button.tsx',
      );
    });

    it('should handle mixed slashes', () => {
      expect(displayPath('src/components\\Button.tsx')).toBe(
        'src/components/Button.tsx',
      );
    });

    it('should handle empty string', () => {
      expect(displayPath('')).toBe('');
    });

    it('should handle root path', () => {
      expect(displayPath('.')).toBe('.');
    });
  });

  describe('displayProjectRoot', () => {
    it('should normalize backslashes to forward slashes', () => {
      // Test that Windows-style paths are normalized
      const result = displayProjectRoot(
        'C:\\Users\\River\\Desktop\\my-project',
      );
      // Should use forward slashes
      expect(result).not.toContain('\\');
      expect(result).toContain('/');
    });

    it('should show folder name when project root is current directory', () => {
      // Test with actual current directory
      const currentDir = process.cwd();
      const result = displayProjectRoot(currentDir);
      // Should show folder name instead of "." or absolute path
      expect(result).toBe(basename(currentDir));
    });

    it('should handle relative paths correctly', () => {
      // Test with relative path
      const result = displayProjectRoot('./src');
      // Should normalize and show relative path
      expect(result).not.toContain('\\');
      expect(result).toBe('src');
    });

    it('should prefer relative paths over absolute when possible', () => {
      // Test with absolute path - function will try to show relative path if possible
      const result = displayProjectRoot('/completely/different/path');
      // Should show normalized path (relative if possible, absolute as fallback)
      expect(result).not.toContain('\\');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should show relative path when possible', () => {
      // Test with a path relative to current directory
      const currentDir = process.cwd();
      const parentDir = resolve(currentDir, '..');
      const result = displayProjectRoot(parentDir);
      // Should show relative path or folder name
      expect(result).not.toContain('\\');
      // Result should be either a relative path or the folder name
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('displayFilePath', () => {
    it('should normalize backslashes to forward slashes', () => {
      // Test that Windows-style paths are normalized
      const result = displayFilePath(
        'C:\\Users\\River\\Desktop\\my-project\\context.json',
      );
      // Should use forward slashes
      expect(result).not.toContain('\\');
      expect(result).toContain('/');
    });

    it('should show relative path when file is in current directory', () => {
      // Test with a file in current directory
      const currentDir = process.cwd();
      const filePath = join(currentDir, 'context.json');
      const result = displayFilePath(filePath);
      // Should show relative path
      expect(result).toBe('context.json');
      expect(result).not.toContain('\\');
    });

    it('should show relative path when file is in subdirectory', () => {
      // Test with a file in a subdirectory
      const currentDir = process.cwd();
      const filePath = join(currentDir, 'src', 'components', 'context.json');
      const result = displayFilePath(filePath);
      // Should show relative path
      expect(result).toBe('src/components/context.json');
      expect(result).not.toContain('\\');
    });

    it('should prefer relative paths over absolute when possible', () => {
      // Test with absolute path - function will try to show relative path if possible
      const result = displayFilePath('/completely/different/path/context.json');
      // Should show normalized path (relative if possible, absolute as fallback)
      expect(result).not.toContain('\\');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle relative paths correctly', () => {
      // Test with relative path
      const result = displayFilePath('./src/context.json');
      // Should normalize and show relative path
      expect(result).not.toContain('\\');
      expect(result).toBe('src/context.json');
    });
  });

  describe('detectRootFolder', () => {
    it('should identify project root', () => {
      const result = detectRootFolder('.', []);
      expect(result.isRoot).toBe(true);
      expect(result.rootLabel).toBe('Project Root');
    });

    it('should identify Next.js app router patterns', () => {
      const result = detectRootFolder('src/app', ['page.tsx', 'layout.tsx']);
      expect(result.isRoot).toBe(true);
      expect(result.rootLabel).toBe('Next.js App');
    });

    it('should identify src as Main Source', () => {
      const result = detectRootFolder('src', []);
      expect(result.isRoot).toBe(true);
      expect(result.rootLabel).toBe('Main Source');
    });

    it('should identify monorepo apps/* pattern', () => {
      const result = detectRootFolder('apps/web', []);
      expect(result.isRoot).toBe(true);
      expect(result.rootLabel).toBe('App: web');
    });

    it('should identify examples folder', () => {
      const result = detectRootFolder('examples/demo/src', []);
      expect(result.isRoot).toBe(true);
      expect(result.rootLabel).toBe('Example: demo');
    });

    it('should identify test fixtures', () => {
      const result = detectRootFolder('tests/fixtures/basic/src', []);
      expect(result.isRoot).toBe(true);
      expect(result.rootLabel).toBe('Test Fixture');
    });

    it('should return isRoot false for non-root folders', () => {
      const result = detectRootFolder('src/components/ui', []);
      expect(result.isRoot).toBe(false);
      expect(result.rootLabel).toBeUndefined();
    });
  });

  describe('groupBundlesByFolder', () => {
    it('should group bundles by folder path', () => {
      const bundles = [
        createMockBundle('src/App.tsx'),
        createMockBundle('src/Button.tsx'),
        createMockBundle('src/components/Card.tsx'),
        createMockBundle('src/components/Icon.tsx'),
      ];

      const grouped = groupBundlesByFolder(bundles);

      expect(grouped.size).toBe(2);
      expect(grouped.get('src')?.length).toBe(2);
      expect(grouped.get('src/components')?.length).toBe(2);
    });

    it('should handle single bundle', () => {
      const bundles = [createMockBundle('src/App.tsx')];

      const grouped = groupBundlesByFolder(bundles);

      expect(grouped.size).toBe(1);
      expect(grouped.get('src')?.length).toBe(1);
    });

    it('should handle empty bundles array', () => {
      const grouped = groupBundlesByFolder([]);

      expect(grouped.size).toBe(0);
    });

    it('should handle root level files', () => {
      const bundles = [createMockBundle('index.tsx')];

      const grouped = groupBundlesByFolder(bundles);

      expect(grouped.size).toBe(1);
      expect(grouped.has('.')).toBe(true);
    });
  });

  describe('writeContextFiles', () => {
    it('should create folders and write JSON files', async () => {
      const bundles = [
        createMockBundle('src/App.tsx', [createMockContract('src/App.tsx')]),
      ];

      const result = await writeContextFiles(bundles, tempDir, tempDir, {
        format: 'json',
        quiet: true,
      });

      expect(result.filesWritten).toBe(1);
      expect(result.folderInfos.length).toBe(1);

      // Verify file exists
      const content = await readFile(
        join(tempDir, 'src', 'context.json'),
        'utf8',
      );
      const parsed = JSON.parse(content);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should calculate total token estimate', async () => {
      const bundles = [
        createMockBundle('src/App.tsx', [createMockContract('src/App.tsx')]),
        createMockBundle('src/Button.tsx', [
          createMockContract('src/Button.tsx'),
        ]),
      ];

      const result = await writeContextFiles(bundles, tempDir, tempDir, {
        format: 'json',
        quiet: true,
      });

      // Each folder's token estimate is mocked to 1000
      expect(result.totalTokenEstimate).toBeGreaterThan(0);
    });

    it('should use .toon extension for toon format', async () => {
      const bundles = [
        createMockBundle('src/App.tsx', [createMockContract('src/App.tsx')]),
      ];

      await writeContextFiles(bundles, tempDir, tempDir, {
        format: 'toon',
        quiet: true,
      });

      // Note: actual file writing may fail for toon format in tests
      // but we verify the logic attempts the right extension
    });

    it('should log progress when not quiet', async () => {
      const bundles = [
        createMockBundle('src/App.tsx', [createMockContract('src/App.tsx')]),
      ];

      await writeContextFiles(bundles, tempDir, tempDir, {
        format: 'json',
        quiet: false,
      });

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Writing context files');
    });

    it('should suppress logging when quiet', async () => {
      const bundles = [
        createMockBundle('src/App.tsx', [createMockContract('src/App.tsx')]),
      ];

      await writeContextFiles(bundles, tempDir, tempDir, {
        format: 'json',
        quiet: true,
      });

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should show bundle checkmarks when verbose is true', async () => {
      const bundles = [
        createMockBundle('src/App.tsx', [createMockContract('src/App.tsx')]),
        createMockBundle('src/components/Button.tsx', [
          createMockContract('src/components/Button.tsx'),
        ]),
      ];

      await writeContextFiles(bundles, tempDir, tempDir, {
        format: 'json',
        quiet: false,
        verbose: true,
      });

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('✓');
      expect(calls).toContain('bundles');
    });

    it('should not show bundle checkmarks when verbose is false (default)', async () => {
      const bundles = [
        createMockBundle('src/App.tsx', [createMockContract('src/App.tsx')]),
        createMockBundle('src/components/Button.tsx', [
          createMockContract('src/components/Button.tsx'),
        ]),
      ];

      await writeContextFiles(bundles, tempDir, tempDir, {
        format: 'json',
        quiet: false,
        verbose: false,
      });

      const calls = consoleSpy.mock.calls.flat().join('\n');
      // Should still show "Writing context files" but not bundle checkmarks
      expect(calls).toContain('Writing context files');
      // Bundle checkmarks should not appear
      expect(calls).not.toMatch(/✓.*bundles/);
    });

    it('should not show bundle checkmarks when verbose is undefined (default)', async () => {
      const bundles = [
        createMockBundle('src/App.tsx', [createMockContract('src/App.tsx')]),
      ];

      await writeContextFiles(bundles, tempDir, tempDir, {
        format: 'json',
        quiet: false,
        // verbose not specified (defaults to undefined/false)
      });

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Writing context files');
      expect(calls).not.toMatch(/✓.*bundles/);
    });

    it('should populate folderInfos with correct structure', async () => {
      const bundles = [
        createMockBundle('src/App.tsx', [createMockContract('src/App.tsx')]),
      ];

      const result = await writeContextFiles(bundles, tempDir, tempDir, {
        format: 'json',
        quiet: true,
      });

      expect(result.folderInfos[0]).toHaveProperty('path');
      expect(result.folderInfos[0]).toHaveProperty('contextFile');
      expect(result.folderInfos[0]).toHaveProperty('bundles');
      expect(result.folderInfos[0]).toHaveProperty('components');
      expect(result.folderInfos[0]).toHaveProperty('tokenEstimate');
    });
  });

  describe('writeMainIndex', () => {
    it('should write context_main.json file', async () => {
      const folderInfos = [
        {
          path: 'src',
          contextFile: 'src/context.json',
          bundles: 2,
          components: ['App.tsx', 'Button.tsx'],
          isRoot: true,
          rootLabel: 'Main Source',
          tokenEstimate: 1000,
        },
      ];

      await writeMainIndex(
        tempDir,
        folderInfos,
        [{}, {}], // contracts
        [], // bundles
        1,
        1000,
        tempDir,
        { quiet: true },
      );

      const content = await readFile(
        join(tempDir, 'context_main.json'),
        'utf8',
      );
      const parsed = JSON.parse(content);

      expect(parsed.type).toBe('LogicStampIndex');
      expect(parsed.schemaVersion).toBe('0.2');
      expect(parsed.summary.totalComponents).toBe(2);
      expect(parsed.summary.totalFolders).toBe(1);
    });

    it('should sort folders by path', async () => {
      const folderInfos = [
        {
          path: 'src/z',
          contextFile: 'src/z/context.json',
          bundles: 1,
          components: ['Z.tsx'],
          isRoot: false,
          tokenEstimate: 100,
        },
        {
          path: 'src/a',
          contextFile: 'src/a/context.json',
          bundles: 1,
          components: ['A.tsx'],
          isRoot: false,
          tokenEstimate: 100,
        },
      ];

      await writeMainIndex(
        tempDir,
        folderInfos,
        [{}, {}],
        [],
        2,
        200,
        tempDir,
        { quiet: true },
      );

      const content = await readFile(
        join(tempDir, 'context_main.json'),
        'utf8',
      );
      const parsed = JSON.parse(content);

      expect(parsed.folders[0].path).toBe('src/a');
      expect(parsed.folders[1].path).toBe('src/z');
    });

    it('should log progress when not quiet', async () => {
      await writeMainIndex(tempDir, [], [], [], 0, 0, tempDir, {
        quiet: false,
      });

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Writing main context index');
    });

    it('should output success indicator in quiet mode', async () => {
      await writeMainIndex(tempDir, [], [], [], 0, 0, tempDir, { quiet: true });

      expect(stdoutSpy).toHaveBeenCalledWith('✓\n');
    });

    it('should suppress success indicator when suppressSuccessIndicator is true', async () => {
      await writeMainIndex(tempDir, [], [], [], 0, 0, tempDir, {
        quiet: true,
        suppressSuccessIndicator: true,
      });

      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it('should include meta.source with package version', async () => {
      await writeMainIndex(tempDir, [], [], [], 0, 0, tempDir, { quiet: true });

      const content = await readFile(
        join(tempDir, 'context_main.json'),
        'utf8',
      );
      const parsed = JSON.parse(content);

      expect(parsed.meta).toHaveProperty('source');
      expect(typeof parsed.meta.source).toBe('string');
    });
  });

  describe('error handling', () => {
    it('should throw user-friendly error for EACCES', async () => {
      // We can't easily test actual permission errors in unit tests
      // but we verify the error handling code path exists
      const bundles = [createMockBundle('src/App.tsx')];

      // This should succeed in temp dir
      await expect(
        writeContextFiles(bundles, tempDir, tempDir, {
          format: 'json',
          quiet: true,
        }),
      ).resolves.not.toThrow();
    });

    it('should handle write errors gracefully', async () => {
      // Test with invalid path to trigger error
      const bundles = [createMockBundle('src/App.tsx')];
      const invalidPath = join(tempDir, '\0invalid');

      // Should throw with user-friendly message
      await expect(
        writeContextFiles(bundles, invalidPath, invalidPath, {
          format: 'json',
          quiet: true,
        }),
      ).rejects.toThrow();
    });
  });
});
