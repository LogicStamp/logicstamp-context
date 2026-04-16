import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';
import {
  parseGitBaseline,
  createBaselinePaths,
  cleanupBaselinePaths,
  isGitRepo,
  resolveGitRef,
  describeGitRef,
  hasUncommittedChanges,
  getCurrentBranch,
  isGitIgnored,
  filterGitIgnoredFiles,
} from '../../../src/utils/git.js';

// Mock child_process spawn
// Use vi.hoisted to declare mockSpawn and mockSpawnResult
const mockSpawn = vi.hoisted(() => vi.fn());
const mockSpawnResult = vi.hoisted(() => {
  return vi.fn(() => ({
    stdout: '',
    stderr: '',
    code: 0,
    error: null as Error | null,
  }));
});

vi.mock('node:child_process', () => ({
  spawn: (command: string, args: string[], options: any) => {
    // Store the call for assertions
    mockSpawn(command, args, options);

    const result = mockSpawnResult();

    // Create a mock ChildProcess-like object
    const mockChild = {
      stdout: {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'data' && result.stdout) {
            // Simulate stdout data asynchronously
            setImmediate(() => handler(Buffer.from(result.stdout)));
          }
        }),
      },
      stderr: {
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'data' && result.stderr) {
            // Simulate stderr data asynchronously
            setImmediate(() => handler(Buffer.from(result.stderr)));
          }
        }),
      },
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'error' && result.error) {
          // Simulate error asynchronously
          setImmediate(() => handler(result.error));
        } else if (event === 'close') {
          // Simulate close with exit code asynchronously
          const code = result.error ? 1 : result.code;
          setImmediate(() => handler(code));
        }
      }),
    };

    return mockChild;
  },
}));

// Mock fs/promises
const mockMkdir = vi.fn();
const mockRm = vi.fn();
vi.mock('node:fs/promises', () => ({
  mkdir: (...args: any[]) => mockMkdir(...args),
  rm: (...args: any[]) => mockRm(...args),
  access: vi.fn(),
}));

describe('git utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);
    // Reset spawn result to default success
    mockSpawnResult.mockReturnValue({
      stdout: '',
      stderr: '',
      code: 0,
      error: null,
    });
  });

  describe('parseGitBaseline', () => {
    it('should parse git:main baseline', () => {
      const result = parseGitBaseline('git:main');
      expect(result).toEqual({ ref: 'main' });
    });

    it('should parse git:HEAD baseline', () => {
      const result = parseGitBaseline('git:HEAD');
      expect(result).toEqual({ ref: 'HEAD' });
    });

    it('should parse git:v1.0.0 baseline', () => {
      const result = parseGitBaseline('git:v1.0.0');
      expect(result).toEqual({ ref: 'v1.0.0' });
    });

    it('should parse git:origin/main baseline', () => {
      const result = parseGitBaseline('git:origin/main');
      expect(result).toEqual({ ref: 'origin/main' });
    });

    it('should parse git:HEAD~1 baseline', () => {
      const result = parseGitBaseline('git:HEAD~1');
      expect(result).toEqual({ ref: 'HEAD~1' });
    });

    it('should parse git:abc123 commit hash baseline', () => {
      const result = parseGitBaseline('git:abc123');
      expect(result).toEqual({ ref: 'abc123' });
    });

    it('should return null for non-git baseline', () => {
      const result = parseGitBaseline('disk');
      expect(result).toBeNull();
    });

    it('should return null for empty git ref', () => {
      const result = parseGitBaseline('git:');
      expect(result).toBeNull();
    });

    it('should return null for invalid format', () => {
      const result = parseGitBaseline('snapshot:main');
      expect(result).toBeNull();
    });
  });

  describe('createBaselinePaths', () => {
    it('should create directory structure with correct paths', async () => {
      const result = await createBaselinePaths('/project', 'main');

      expect(result.tempRoot).toBe(join('/project', '.logicstamp', 'compare'));
      expect(result.baselineDir).toBe(
        join('/project', '.logicstamp', 'compare', 'baseline'),
      );
      expect(result.currentDir).toBe(
        join('/project', '.logicstamp', 'compare', 'current'),
      );
      expect(result.worktreeDir).toContain('logicstamp-worktree-main-');
    });

    it('should create directories', async () => {
      await createBaselinePaths('/project', 'main');

      expect(mockMkdir).toHaveBeenCalledWith(
        join('/project', '.logicstamp', 'compare', 'baseline'),
        { recursive: true },
      );
      expect(mockMkdir).toHaveBeenCalledWith(
        join('/project', '.logicstamp', 'compare', 'current'),
        { recursive: true },
      );
    });

    it('should sanitize special characters in ref for worktree path', async () => {
      const result = await createBaselinePaths('/project', 'feature/my-branch');

      // Special characters should be replaced with underscores
      expect(result.worktreeDir).toContain(
        'logicstamp-worktree-feature_my-branch-',
      );
    });

    it('should truncate long ref names', async () => {
      const longRef = 'a'.repeat(50);
      const result = await createBaselinePaths('/project', longRef);

      // Should be truncated to 20 characters
      expect(result.worktreeDir).toContain(
        'logicstamp-worktree-aaaaaaaaaaaaaaaaaaaa-',
      );
    });
  });

  describe('cleanupBaselinePaths', () => {
    it('should remove temp directories', async () => {
      const paths = {
        tempRoot: '/project/.logicstamp/compare',
        baselineDir: '/project/.logicstamp/compare/baseline',
        currentDir: '/project/.logicstamp/compare/current',
        worktreeDir: '/tmp/logicstamp-worktree-main-123',
      };

      // Mock successful worktree remove
      mockSpawnResult.mockReturnValue({
        stdout: '',
        stderr: '',
        code: 0,
        error: null,
      });

      await cleanupBaselinePaths(paths);

      expect(mockRm).toHaveBeenCalledWith(paths.tempRoot, {
        recursive: true,
        force: true,
      });
    });

    it('should handle cleanup errors gracefully', async () => {
      const paths = {
        tempRoot: '/project/.logicstamp/compare',
        baselineDir: '/project/.logicstamp/compare/baseline',
        currentDir: '/project/.logicstamp/compare/current',
        worktreeDir: '/tmp/logicstamp-worktree-main-123',
      };

      // Mock failed worktree remove
      mockSpawnResult.mockReturnValue({
        stdout: '',
        stderr: 'Worktree not found',
        code: 1,
        error: null,
      });
      mockRm.mockRejectedValueOnce(new Error('Directory not found'));

      // Should not throw
      await expect(cleanupBaselinePaths(paths)).resolves.not.toThrow();
    });
  });

  describe('isGitRepo', () => {
    it('should return true for git repository', async () => {
      mockSpawnResult.mockReturnValue({
        stdout: '.git',
        stderr: '',
        code: 0,
        error: null,
      });

      const result = await isGitRepo();
      expect(result).toBe(true);
    });

    it('should return false for non-git directory', async () => {
      mockSpawnResult.mockReturnValue({
        stdout: '',
        stderr: 'Not a git repository',
        code: 1,
        error: null,
      });

      const result = await isGitRepo();
      expect(result).toBe(false);
    });
  });

  describe('resolveGitRef', () => {
    it('should resolve ref to commit hash', async () => {
      mockSpawnResult.mockReturnValue({
        stdout: 'abc123def456',
        stderr: '',
        code: 0,
        error: null,
      });

      const result = await resolveGitRef('main');
      expect(result).toBe('abc123def456');
    });

    it('should trim whitespace from ref', async () => {
      mockSpawnResult.mockReturnValue({
        stdout: 'abc123def456',
        stderr: '',
        code: 0,
        error: null,
      });

      const result = await resolveGitRef('  main  ');
      expect(result).toBe('abc123def456');
      // Verify it was called with trimmed ref
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--verify', 'main'],
        expect.any(Object),
      );
    });

    it('should reject empty ref', async () => {
      await expect(resolveGitRef('')).rejects.toThrow(
        'Invalid baseline ref: ref is empty or exceeds 256 characters',
      );
    });

    it('should reject ref with only whitespace', async () => {
      await expect(resolveGitRef('   ')).rejects.toThrow(
        'Invalid baseline ref: ref is empty or exceeds 256 characters',
      );
    });

    it('should reject ref exceeding 256 characters', async () => {
      const longRef = 'a'.repeat(257);
      await expect(resolveGitRef(longRef)).rejects.toThrow(
        'Invalid baseline ref: ref is empty or exceeds 256 characters',
      );
    });

    it('should accept ref with exactly 256 characters', async () => {
      const ref256 = 'a'.repeat(256);
      mockSpawnResult.mockReturnValue({
        stdout: 'abc123def456',
        stderr: '',
        code: 0,
        error: null,
      });

      const result = await resolveGitRef(ref256);
      expect(result).toBe('abc123def456');
    });

    it('should throw for invalid ref', async () => {
      mockSpawnResult.mockReturnValue({
        stdout: '',
        stderr: 'fatal: bad revision',
        code: 1,
        error: null,
      });

      await expect(resolveGitRef('nonexistent')).rejects.toThrow(
        'Invalid git ref "nonexistent": ref does not exist',
      );
    });
  });

  describe('describeGitRef', () => {
    it('should return branch name for branch ref', async () => {
      mockSpawnResult.mockReturnValue({
        stdout: 'main',
        stderr: '',
        code: 0,
        error: null,
      });

      const result = await describeGitRef('main');
      expect(result).toBe('main');
    });

    it('should return short hash for detached HEAD', async () => {
      // First call returns HEAD (not a branch)
      mockSpawnResult.mockReturnValueOnce({
        stdout: 'HEAD',
        stderr: '',
        code: 0,
        error: null,
      });
      // Second call returns short hash
      mockSpawnResult.mockReturnValueOnce({
        stdout: 'abc123d',
        stderr: '',
        code: 0,
        error: null,
      });

      const result = await describeGitRef('abc123def456');
      expect(result).toBe('abc123d');
    });

    it('should return original ref if all lookups fail', async () => {
      mockSpawnResult.mockReturnValueOnce({
        stdout: '',
        stderr: 'Failed',
        code: 1,
        error: null,
      });
      mockSpawnResult.mockReturnValueOnce({
        stdout: '',
        stderr: 'Failed',
        code: 1,
        error: null,
      });

      const result = await describeGitRef('weird-ref');
      expect(result).toBe('weird-ref');
    });
  });

  describe('hasUncommittedChanges', () => {
    it('should return true when there are changes', async () => {
      mockSpawnResult.mockReturnValue({
        stdout: 'M file.ts',
        stderr: '',
        code: 0,
        error: null,
      });

      const result = await hasUncommittedChanges();
      expect(result).toBe(true);
    });

    it('should return false when working tree is clean', async () => {
      mockSpawnResult.mockReturnValue({
        stdout: '',
        stderr: '',
        code: 0,
        error: null,
      });

      const result = await hasUncommittedChanges();
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockSpawnResult.mockReturnValue({
        stdout: '',
        stderr: 'Not a git repo',
        code: 1,
        error: null,
      });

      const result = await hasUncommittedChanges();
      expect(result).toBe(false);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      mockSpawnResult.mockReturnValue({
        stdout: 'feature-branch',
        stderr: '',
        code: 0,
        error: null,
      });

      const result = await getCurrentBranch();
      expect(result).toBe('feature-branch');
    });

    it('should return HEAD when detached', async () => {
      mockSpawnResult.mockReturnValue({
        stdout: '',
        stderr: 'Not on a branch',
        code: 1,
        error: null,
      });

      const result = await getCurrentBranch();
      expect(result).toBe('HEAD');
    });
  });

  describe('isGitIgnored', () => {
    it('should return true for git-ignored file', async () => {
      // git check-ignore --quiet returns exit code 0 (success) if file is ignored
      mockSpawnResult.mockReturnValue({
        stdout: '',
        stderr: '',
        code: 0,
        error: null,
      });

      const result = await isGitIgnored('next-env.d.ts');
      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['check-ignore', '--quiet', 'next-env.d.ts'],
        expect.any(Object),
      );
    });

    it('should return false for non-ignored file', async () => {
      // git check-ignore --quiet returns exit code 1 (failure) if file is not ignored
      mockSpawnResult.mockReturnValue({
        stdout: '',
        stderr: '',
        code: 1,
        error: null,
      });

      const result = await isGitIgnored('src/components/Button.tsx');
      expect(result).toBe(false);
    });

    it('should use custom cwd option', async () => {
      mockSpawnResult.mockReturnValue({
        stdout: '',
        stderr: '',
        code: 0,
        error: null,
      });

      await isGitIgnored('file.ts', { cwd: '/custom/path' });

      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['check-ignore', '--quiet', 'file.ts'],
        expect.objectContaining({ cwd: '/custom/path' }),
      );
    });
  });

  describe('filterGitIgnoredFiles', () => {
    it('should filter out git-ignored files', async () => {
      const filePaths = [
        'src/components/Button.tsx',
        'next-env.d.ts',
        'src/utils/helper.ts',
      ];

      // Button.tsx is not ignored (check fails)
      mockSpawnResult.mockReturnValueOnce({
        stdout: '',
        stderr: '',
        code: 1,
        error: null,
      });
      // next-env.d.ts is ignored (check succeeds)
      mockSpawnResult.mockReturnValueOnce({
        stdout: '',
        stderr: '',
        code: 0,
        error: null,
      });
      // helper.ts is not ignored (check fails)
      mockSpawnResult.mockReturnValueOnce({
        stdout: '',
        stderr: '',
        code: 1,
        error: null,
      });

      const result = await filterGitIgnoredFiles(filePaths, '/project');

      expect(result).toEqual([
        'src/components/Button.tsx',
        'src/utils/helper.ts',
      ]);
      expect(result).not.toContain('next-env.d.ts');
    });

    it('should handle relative paths', async () => {
      const filePaths = ['next-env.d.ts', 'src/file.ts'];

      // next-env.d.ts is ignored (check succeeds)
      mockSpawnResult.mockReturnValueOnce({
        stdout: '',
        stderr: '',
        code: 0,
        error: null,
      });
      // src/file.ts is not ignored (check fails)
      mockSpawnResult.mockReturnValueOnce({
        stdout: '',
        stderr: '',
        code: 1,
        error: null,
      });

      const result = await filterGitIgnoredFiles(filePaths, '/project');

      expect(result).toEqual(['src/file.ts']);
    });

    it('should handle absolute paths', async () => {
      const filePaths = ['/project/next-env.d.ts', '/project/src/file.ts'];

      // next-env.d.ts is ignored (check succeeds)
      mockSpawnResult.mockReturnValueOnce({
        stdout: '',
        stderr: '',
        code: 0,
        error: null,
      });
      // file.ts is not ignored (check fails)
      mockSpawnResult.mockReturnValueOnce({
        stdout: '',
        stderr: '',
        code: 1,
        error: null,
      });

      const result = await filterGitIgnoredFiles(filePaths, '/project');

      expect(result).toEqual(['/project/src/file.ts']);
    });

    it('should return all files if none are ignored', async () => {
      const filePaths = ['src/file1.ts', 'src/file2.ts'];

      // Both files are not ignored (checks fail)
      mockSpawnResult.mockReturnValueOnce({
        stdout: '',
        stderr: '',
        code: 1,
        error: null,
      });
      mockSpawnResult.mockReturnValueOnce({
        stdout: '',
        stderr: '',
        code: 1,
        error: null,
      });

      const result = await filterGitIgnoredFiles(filePaths, '/project');

      expect(result).toEqual(filePaths);
    });

    it('should return empty array if all files are ignored', async () => {
      const filePaths = ['next-env.d.ts', '.env.local'];

      // Both files are ignored
      mockSpawnResult.mockReturnValueOnce({
        stdout: '',
        stderr: '',
        code: 0,
        error: null,
      });
      mockSpawnResult.mockReturnValueOnce({
        stdout: '',
        stderr: '',
        code: 0,
        error: null,
      });

      const result = await filterGitIgnoredFiles(filePaths, '/project');

      expect(result).toEqual([]);
    });

    it('should check basename patterns for normalized paths', async () => {
      const filePaths = ['next-env.d.ts']; // Normalized basename (no path)

      // Check basename directly - file is ignored (check succeeds)
      mockSpawnResult.mockReturnValue({
        stdout: '',
        stderr: '',
        code: 0,
        error: null,
      });
      // Pattern check should not be called if basename check succeeds

      const result = await filterGitIgnoredFiles(filePaths, '/project');

      expect(result).toEqual([]);
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['check-ignore', '--quiet', 'next-env.d.ts'],
        expect.any(Object),
      );
    });
  });
});
