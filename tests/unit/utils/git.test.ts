import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
} from '../../../src/utils/git.js';

// Mock child_process and util.promisify
// Use vi.hoisted to declare mockExec so it's available to hoisted mocks
const mockExec = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  exec: (command: string, options: any, callback?: Function) => {
    if (callback) {
      mockExec(command, options, callback);
    } else {
      mockExec(command, options);
    }
    return { on: vi.fn() };
  },
}));

// Mock util.promisify - promisify takes a function and returns a promisified version
vi.mock('node:util', () => ({
  promisify: (fn: Function) => {
    // Return mockExec when promisify(exec) is called
    return mockExec;
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
      expect(result.baselineDir).toBe(join('/project', '.logicstamp', 'compare', 'baseline'));
      expect(result.currentDir).toBe(join('/project', '.logicstamp', 'compare', 'current'));
      expect(result.worktreeDir).toContain('logicstamp-worktree-main-');
    });

    it('should create directories', async () => {
      await createBaselinePaths('/project', 'main');

      expect(mockMkdir).toHaveBeenCalledWith(
        join('/project', '.logicstamp', 'compare', 'baseline'),
        { recursive: true }
      );
      expect(mockMkdir).toHaveBeenCalledWith(
        join('/project', '.logicstamp', 'compare', 'current'),
        { recursive: true }
      );
    });

    it('should sanitize special characters in ref for worktree path', async () => {
      const result = await createBaselinePaths('/project', 'feature/my-branch');

      // Special characters should be replaced with underscores
      expect(result.worktreeDir).toContain('logicstamp-worktree-feature_my-branch-');
    });

    it('should truncate long ref names', async () => {
      const longRef = 'a'.repeat(50);
      const result = await createBaselinePaths('/project', longRef);

      // Should be truncated to 20 characters
      expect(result.worktreeDir).toContain('logicstamp-worktree-aaaaaaaaaaaaaaaaaaaa-');
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
      mockExec.mockResolvedValueOnce({ stdout: '', stderr: '' });

      await cleanupBaselinePaths(paths);

      expect(mockRm).toHaveBeenCalledWith(paths.tempRoot, { recursive: true, force: true });
    });

    it('should handle cleanup errors gracefully', async () => {
      const paths = {
        tempRoot: '/project/.logicstamp/compare',
        baselineDir: '/project/.logicstamp/compare/baseline',
        currentDir: '/project/.logicstamp/compare/current',
        worktreeDir: '/tmp/logicstamp-worktree-main-123',
      };

      // Mock failed worktree remove
      mockExec.mockRejectedValueOnce(new Error('Worktree not found'));
      mockRm.mockRejectedValueOnce(new Error('Directory not found'));

      // Should not throw
      await expect(cleanupBaselinePaths(paths)).resolves.not.toThrow();
    });
  });

  describe('isGitRepo', () => {
    it('should return true for git repository', async () => {
      mockExec.mockResolvedValueOnce({ stdout: '.git', stderr: '' });

      const result = await isGitRepo();
      expect(result).toBe(true);
    });

    it('should return false for non-git directory', async () => {
      mockExec.mockRejectedValueOnce(new Error('Not a git repository'));

      const result = await isGitRepo();
      expect(result).toBe(false);
    });
  });

  describe('resolveGitRef', () => {
    it('should resolve ref to commit hash', async () => {
      mockExec.mockResolvedValueOnce({ stdout: 'abc123def456', stderr: '' });

      const result = await resolveGitRef('main');
      expect(result).toBe('abc123def456');
    });

    it('should throw for invalid ref', async () => {
      mockExec.mockRejectedValueOnce(new Error('fatal: bad revision'));

      await expect(resolveGitRef('nonexistent')).rejects.toThrow(
        'Invalid git ref "nonexistent": ref does not exist'
      );
    });
  });

  describe('describeGitRef', () => {
    it('should return branch name for branch ref', async () => {
      mockExec.mockResolvedValueOnce({ stdout: 'main', stderr: '' });

      const result = await describeGitRef('main');
      expect(result).toBe('main');
    });

    it('should return short hash for detached HEAD', async () => {
      // First call returns HEAD (not a branch)
      mockExec.mockResolvedValueOnce({ stdout: 'HEAD', stderr: '' });
      // Second call returns short hash
      mockExec.mockResolvedValueOnce({ stdout: 'abc123d', stderr: '' });

      const result = await describeGitRef('abc123def456');
      expect(result).toBe('abc123d');
    });

    it('should return original ref if all lookups fail', async () => {
      mockExec.mockRejectedValueOnce(new Error('Failed'));
      mockExec.mockRejectedValueOnce(new Error('Failed'));

      const result = await describeGitRef('weird-ref');
      expect(result).toBe('weird-ref');
    });
  });

  describe('hasUncommittedChanges', () => {
    it('should return true when there are changes', async () => {
      mockExec.mockResolvedValueOnce({ stdout: 'M file.ts', stderr: '' });

      const result = await hasUncommittedChanges();
      expect(result).toBe(true);
    });

    it('should return false when working tree is clean', async () => {
      mockExec.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await hasUncommittedChanges();
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockExec.mockRejectedValueOnce(new Error('Not a git repo'));

      const result = await hasUncommittedChanges();
      expect(result).toBe(false);
    });
  });

  describe('getCurrentBranch', () => {
    it('should return current branch name', async () => {
      mockExec.mockResolvedValueOnce({ stdout: 'feature-branch', stderr: '' });

      const result = await getCurrentBranch();
      expect(result).toBe('feature-branch');
    });

    it('should return HEAD when detached', async () => {
      mockExec.mockRejectedValueOnce(new Error('Not on a branch'));

      const result = await getCurrentBranch();
      expect(result).toBe('HEAD');
    });
  });
});
