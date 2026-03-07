/**
 * Git utilities for baseline comparison
 * Handles worktree creation, ref validation, and cleanup
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { access, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { debugLog, debugError } from './debug.js';

const execAsync = promisify(exec);

/**
 * Result from creating a git worktree
 */
export interface GitWorktreeResult {
  /** Path to the created worktree */
  worktreePath: string;
  /** The resolved commit hash */
  commitHash: string;
  /** The original ref that was requested */
  ref: string;
}

/**
 * Options for git operations
 */
export interface GitOptions {
  /** Working directory for git commands (default: process.cwd()) */
  cwd?: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Execute a git command and return stdout
 * @throws Error if git command fails
 */
async function execGit(
  args: string[],
  options: GitOptions = {}
): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const timeout = options.timeout ?? 30000;
  const command = `git ${args.join(' ')}`;

  debugLog('git', `Executing: ${command}`, { cwd });

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large repos
    });

    if (stderr && !stderr.includes('Preparing worktree')) {
      // Some git commands output to stderr even on success
      debugLog('git', `stderr: ${stderr.trim()}`);
    }

    return stdout.trim();
  } catch (error) {
    const err = error as Error & { stderr?: string; code?: number };
    debugError('git', 'execGit', {
      command,
      cwd,
      message: err.message,
      stderr: err.stderr,
      code: err.code,
    });

    // Extract meaningful error message from stderr
    const errorMessage = err.stderr?.trim() || err.message;
    throw new Error(`Git command failed: ${errorMessage}`);
  }
}

/**
 * Check if a directory is inside a git repository
 */
export async function isGitRepo(options: GitOptions = {}): Promise<boolean> {
  try {
    await execGit(['rev-parse', '--git-dir'], options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the root directory of the git repository
 */
export async function getGitRoot(options: GitOptions = {}): Promise<string> {
  const root = await execGit(['rev-parse', '--show-toplevel'], options);
  return root;
}

/**
 * Check if git worktrees are supported (git >= 2.5)
 */
export async function supportsWorktrees(options: GitOptions = {}): Promise<boolean> {
  try {
    // Try to list worktrees - will fail if not supported
    await execGit(['worktree', 'list'], options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a git ref to its commit hash
 * Validates that the ref exists
 *
 * @param ref - Git ref (branch, tag, commit, HEAD, HEAD~1, etc.)
 * @returns The resolved commit hash
 * @throws Error if ref doesn't exist
 */
export async function resolveGitRef(
  ref: string,
  options: GitOptions = {}
): Promise<string> {
  try {
    const hash = await execGit(['rev-parse', '--verify', ref], options);
    return hash;
  } catch (error) {
    throw new Error(`Invalid git ref "${ref}": ref does not exist`);
  }
}

/**
 * Get a short description of a git ref (for display)
 * Returns branch name, tag name, or short commit hash
 */
export async function describeGitRef(
  ref: string,
  options: GitOptions = {}
): Promise<string> {
  try {
    // Try to get a symbolic name first
    const symbolic = await execGit(
      ['rev-parse', '--abbrev-ref', ref],
      options
    );
    if (symbolic && symbolic !== 'HEAD') {
      return symbolic;
    }
  } catch {
    // Ignore - fall through to short hash
  }

  try {
    // Fall back to short commit hash
    const shortHash = await execGit(['rev-parse', '--short', ref], options);
    return shortHash;
  } catch {
    return ref; // Return original if all else fails
  }
}

/**
 * Create a git worktree at a specific ref
 *
 * @param ref - Git ref to checkout (branch, tag, commit, etc.)
 * @param targetDir - Directory to create the worktree in (optional, will create temp if not provided)
 * @returns GitWorktreeResult with worktree path and commit info
 * @throws Error if worktree creation fails
 */
export async function createWorktree(
  ref: string,
  targetDir?: string,
  options: GitOptions = {}
): Promise<GitWorktreeResult> {
  // Validate we're in a git repo
  if (!(await isGitRepo(options))) {
    throw new Error('Not a git repository');
  }

  // Check worktree support
  if (!(await supportsWorktrees(options))) {
    throw new Error('Git worktrees not supported (requires git >= 2.5)');
  }

  // Resolve the ref to a commit hash
  const commitHash = await resolveGitRef(ref, options);

  // Generate worktree path if not provided
  const worktreePath = targetDir ?? join(
    tmpdir(),
    `logicstamp-worktree-${Date.now()}-${commitHash.substring(0, 8)}`
  );

  debugLog('git', `Creating worktree at ${worktreePath} for ref ${ref}`, {
    commitHash,
  });

  try {
    // Create parent directory if needed
    await mkdir(worktreePath, { recursive: true });

    // Remove the directory we just created (git worktree add needs it to not exist)
    await rm(worktreePath, { recursive: true, force: true });

    // Create the worktree in detached HEAD mode
    await execGit(
      ['worktree', 'add', '--detach', worktreePath, commitHash],
      options
    );

    debugLog('git', `Worktree created successfully at ${worktreePath}`);

    return {
      worktreePath,
      commitHash,
      ref,
    };
  } catch (error) {
    // Clean up on failure
    try {
      await rm(worktreePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    const err = error as Error;
    debugError('git', 'createWorktree', {
      ref,
      targetDir: worktreePath,
      message: err.message,
    });

    throw new Error(`Failed to create worktree for "${ref}": ${err.message}`);
  }
}

/**
 * Remove a git worktree and clean up its directory
 *
 * @param worktreePath - Path to the worktree to remove
 */
export async function removeWorktree(
  worktreePath: string,
  options: GitOptions = {}
): Promise<void> {
  debugLog('git', `Removing worktree at ${worktreePath}`);

  try {
    // First, try to remove via git worktree command
    await execGit(['worktree', 'remove', '--force', worktreePath], options);
  } catch (error) {
    // If git worktree remove fails, try manual cleanup
    debugLog('git', `git worktree remove failed, trying manual cleanup`);

    try {
      // Remove the directory
      await rm(worktreePath, { recursive: true, force: true });

      // Prune stale worktree entries
      await execGit(['worktree', 'prune'], options);
    } catch (cleanupError) {
      debugError('git', 'removeWorktree', {
        worktreePath,
        message: (cleanupError as Error).message,
      });
      // Don't throw - best effort cleanup
    }
  }

  debugLog('git', `Worktree removed: ${worktreePath}`);
}

/**
 * Check if there are uncommitted changes in the working directory
 */
export async function hasUncommittedChanges(options: GitOptions = {}): Promise<boolean> {
  try {
    const status = await execGit(['status', '--porcelain'], options);
    return status.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the current branch name (or "HEAD" if detached)
 */
export async function getCurrentBranch(options: GitOptions = {}): Promise<string> {
  try {
    const branch = await execGit(['rev-parse', '--abbrev-ref', 'HEAD'], options);
    return branch;
  } catch {
    return 'HEAD';
  }
}

/**
 * Parse a baseline string into ref and type
 *
 * @param baseline - Baseline string (e.g., "git:main", "git:HEAD", "git:v1.0.0")
 * @returns Parsed baseline info or null if not a git baseline
 */
export function parseGitBaseline(baseline: string): { ref: string } | null {
  if (!baseline.startsWith('git:')) {
    return null;
  }

  const ref = baseline.substring(4); // Remove "git:" prefix
  if (!ref) {
    return null;
  }

  return { ref };
}

/**
 * Directory paths used for git baseline comparison
 */
export interface GitBaselinePaths {
  /** Root temp directory for this comparison */
  tempRoot: string;
  /** Directory for baseline context (generated from git ref) */
  baselineDir: string;
  /** Directory for current context (generated from working tree) */
  currentDir: string;
  /** Directory for git worktree (source code at git ref) */
  worktreeDir: string;
}

/**
 * Create directory structure for git baseline comparison
 * Uses .logicstamp/compare/ for context files
 */
export async function createBaselinePaths(
  projectRoot: string,
  ref: string
): Promise<GitBaselinePaths> {
  const timestamp = Date.now();
  const safeRef = ref.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 20);

  // Context files go in .logicstamp/compare/
  const compareRoot = join(projectRoot, '.logicstamp', 'compare');
  const baselineDir = join(compareRoot, 'baseline');
  const currentDir = join(compareRoot, 'current');

  // Worktree goes in system temp (it's large)
  const worktreeDir = join(
    tmpdir(),
    `logicstamp-worktree-${safeRef}-${timestamp}`
  );

  // Create directories
  await mkdir(baselineDir, { recursive: true });
  await mkdir(currentDir, { recursive: true });

  return {
    tempRoot: compareRoot,
    baselineDir,
    currentDir,
    worktreeDir,
  };
}

/**
 * Clean up git baseline comparison directories
 */
export async function cleanupBaselinePaths(
  paths: GitBaselinePaths,
  options: GitOptions = {}
): Promise<void> {
  debugLog('git', 'Cleaning up baseline paths', { ...paths });

  // Remove worktree first (via git)
  try {
    await removeWorktree(paths.worktreeDir, options);
  } catch {
    // Best effort - worktree might already be removed
  }

  // Remove context directories
  try {
    await rm(paths.tempRoot, { recursive: true, force: true });
  } catch (error) {
    debugError('git', 'cleanupBaselinePaths', {
      tempRoot: paths.tempRoot,
      message: (error as Error).message,
    });
  }
}
