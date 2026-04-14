/**
 * Git utilities for baseline comparison
 * Handles worktree creation, ref validation, and cleanup
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { access, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { debugLog, debugError } from './debug.js';
import { toForwardSlashes } from './fsx.js';

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
  /** Timeout in milliseconds (default: 30000 for regular operations) */
  timeout?: number;
}

/**
 * Default timeout for regular git operations (30 seconds)
 */
const DEFAULT_GIT_TIMEOUT = 30000;

/**
 * Timeout for git ref resolution operations (15 seconds)
 * git rev-parse is lightweight and should complete quickly
 */
export const GIT_REF_RESOLVE_TIMEOUT = 15000;

/**
 * Timeout for git ref description operations (15 seconds)
 * git rev-parse --abbrev-ref and --short are lightweight and should complete quickly
 */
export const GIT_REF_DESCRIBE_TIMEOUT = 15000;

/**
 * Timeout for git worktree creation (60 seconds)
 * Worktree creation can be slow on large repos due to file checkout operations
 */
export const GIT_WORKTREE_TIMEOUT = 60000;

/**
 * Execute a git command and return stdout
 * Uses spawn instead of exec for better security (no shell interpretation)
 * @throws Error if git command fails
 */
async function execGit(
  args: string[],
  options: GitOptions = {},
): Promise<string> {
  const cwd = options.cwd ?? process.cwd();
  const timeout = options.timeout ?? DEFAULT_GIT_TIMEOUT;
  const command = `git ${args.join(' ')}`;

  debugLog('git', `Executing: ${command}`, { cwd });

  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    // TypeScript needs explicit type assertion for stdio pipes
    if (child.stdout) {
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
    }

    child.on('error', (error: Error) => {
      debugError('git', 'execGit spawn error', {
        command,
        cwd,
        message: error.message,
      });
      reject(new Error(`Git command failed: ${error.message}`));
    });

    child.on('close', (code: number | null) => {
      if (code === 0) {
        if (stderr && !stderr.includes('Preparing worktree')) {
          // Some git commands output to stderr even on success
          debugLog('git', `stderr: ${stderr.trim()}`);
        }
        resolve(stdout.trim());
      } else {
        debugError('git', 'execGit', {
          command,
          cwd,
          code,
          stderr: stderr.trim(),
        });
        const errorMessage =
          stderr.trim() || `Command failed with exit code ${code}`;
        reject(new Error(`Git command failed: ${errorMessage}`));
      }
    });
  });
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
export async function supportsWorktrees(
  options: GitOptions = {},
): Promise<boolean> {
  try {
    // Try to list worktrees - will fail if not supported
    await execGit(['worktree', 'list'], options);
    return true;
  } catch {
    return false;
  }
}

/**
 * Maximum length for git refs (256 characters)
 * This is a defense-in-depth measure - Git itself will validate refs
 */
const MAX_REF_LENGTH = 256;

/**
 * Validate git ref input (lightweight validation)
 * Trims whitespace and checks length, but lets Git be the source of truth for semantic validity
 *
 * @param ref - Git ref to validate
 * @throws Error if ref is empty or exceeds length limit
 */
function validateGitRef(ref: string): void {
  const trimmed = ref.trim();
  if (trimmed.length === 0) {
    throw new Error(
      'Invalid baseline ref: ref is empty or exceeds 256 characters',
    );
  }
  if (trimmed.length > MAX_REF_LENGTH) {
    throw new Error(
      'Invalid baseline ref: ref is empty or exceeds 256 characters',
    );
  }
}

/**
 * Resolve a git ref to its commit hash
 * Validates that the ref exists
 *
 * @param ref - Git ref (branch, tag, commit, HEAD, HEAD~1, etc.)
 * @returns The resolved commit hash
 * @throws Error if ref doesn't exist or is invalid
 */
export async function resolveGitRef(
  ref: string,
  options: GitOptions = {},
): Promise<string> {
  // Lightweight validation: trim whitespace and check length
  // Let Git be the source of truth for semantic validity
  validateGitRef(ref);

  const trimmedRef = ref.trim();

  try {
    const hash = await execGit(['rev-parse', '--verify', trimmedRef], options);
    return hash;
  } catch (error) {
    throw new Error(`Invalid git ref "${trimmedRef}": ref does not exist`);
  }
}

/**
 * Get a short description of a git ref (for display)
 * Returns branch name, tag name, or short commit hash
 */
export async function describeGitRef(
  ref: string,
  options: GitOptions = {},
): Promise<string> {
  // Use trimmed ref for consistency with resolveGitRef
  const trimmedRef = ref.trim();
  try {
    // Try to get a symbolic name first
    const symbolic = await execGit(
      ['rev-parse', '--abbrev-ref', trimmedRef],
      options,
    );
    if (symbolic && symbolic !== 'HEAD') {
      return symbolic;
    }
  } catch {
    // Ignore - fall through to short hash
  }

  try {
    // Fall back to short commit hash
    const shortHash = await execGit(
      ['rev-parse', '--short', trimmedRef],
      options,
    );
    return shortHash;
  } catch {
    return trimmedRef; // Return trimmed ref if all else fails
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
  options: GitOptions = {},
): Promise<GitWorktreeResult> {
  // Use trimmed ref for consistency
  const trimmedRef = ref.trim();

  // Validate we're in a git repo
  if (!(await isGitRepo(options))) {
    throw new Error('Not a git repository');
  }

  // Check worktree support
  if (!(await supportsWorktrees(options))) {
    throw new Error('Git worktrees not supported (requires git >= 2.5)');
  }

  // Resolve the ref to a commit hash (this will also validate the ref)
  const commitHash = await resolveGitRef(trimmedRef, options);

  // Generate worktree path if not provided
  const worktreePath =
    targetDir ??
    join(
      tmpdir(),
      `logicstamp-worktree-${Date.now()}-${commitHash.substring(0, 8)}`,
    );

  debugLog(
    'git',
    `Creating worktree at ${worktreePath} for ref ${trimmedRef}`,
    {
      commitHash,
    },
  );

  try {
    // Create parent directory if needed
    await mkdir(worktreePath, { recursive: true });

    // Remove the directory we just created (git worktree add needs it to not exist)
    await rm(worktreePath, { recursive: true, force: true });

    // Create the worktree in detached HEAD mode
    await execGit(
      ['worktree', 'add', '--detach', worktreePath, commitHash],
      options,
    );

    debugLog('git', `Worktree created successfully at ${worktreePath}`);

    return {
      worktreePath,
      commitHash,
      ref: trimmedRef,
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
      ref: trimmedRef,
      targetDir: worktreePath,
      message: err.message,
    });

    throw new Error(
      `Failed to create worktree for "${trimmedRef}": ${err.message}`,
    );
  }
}

/**
 * Remove a git worktree and clean up its directory
 *
 * @param worktreePath - Path to the worktree to remove
 */
export async function removeWorktree(
  worktreePath: string,
  options: GitOptions = {},
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
export async function hasUncommittedChanges(
  options: GitOptions = {},
): Promise<boolean> {
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
export async function getCurrentBranch(
  options: GitOptions = {},
): Promise<string> {
  try {
    const branch = await execGit(
      ['rev-parse', '--abbrev-ref', 'HEAD'],
      options,
    );
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
  ref: string,
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
    `logicstamp-worktree-${safeRef}-${timestamp}`,
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
 * Check if a file is git-ignored
 * @param filePath - File path relative to git root or absolute path
 * @param options - Git options
 * @returns true if the file is git-ignored, false otherwise
 */
export async function isGitIgnored(
  filePath: string,
  options: GitOptions = {},
): Promise<boolean> {
  try {
    // git check-ignore --quiet returns exit code 0 if file is ignored, 1 if not ignored
    // execGit throws on non-zero exit codes, so if it succeeds, file is ignored
    await execGit(['check-ignore', '--quiet', filePath], options);
    return true; // Command succeeded, file is ignored
  } catch {
    // Command failed (exit code 1), file is not ignored
    return false;
  }
}

/**
 * Filter out git-ignored files from an array of file paths
 * @param filePaths - Array of file paths to filter (may be normalized basenames in git baseline mode)
 * @param projectRoot - Project root directory (for resolving relative paths)
 * @param options - Git options
 * @returns Array of file paths that are NOT git-ignored
 */
export async function filterGitIgnoredFiles(
  filePaths: string[],
  projectRoot: string,
  options: GitOptions = {},
): Promise<string[]> {
  const { relative } = await import('node:path');

  const filtered: string[] = [];

  for (const filePath of filePaths) {
    let isIgnored = false;

    // If the path contains a slash, it's a full relative path
    if (filePath.includes('/')) {
      // Convert to relative path from project root if needed
      let relativePath: string;
      if (filePath.startsWith('/') || filePath.match(/^[A-Z]:/)) {
        // Absolute path - convert to relative
        relativePath = toForwardSlashes(relative(projectRoot, filePath));
      } else {
        relativePath = filePath;
      }

      // Check if file is git-ignored
      isIgnored = await isGitIgnored(relativePath, {
        ...options,
        cwd: projectRoot,
      });
    } else {
      // It's just a basename (normalized in git baseline mode)
      // Check if the basename itself is git-ignored (works for root-level files like next-env.d.ts)
      isIgnored = await isGitIgnored(filePath, {
        ...options,
        cwd: projectRoot,
      });

      // Also check common patterns that might match this basename
      if (!isIgnored) {
        // Check common git-ignore patterns that might match
        const patternsToCheck = [`**/${filePath}`, `*/${filePath}`];

        for (const pattern of patternsToCheck) {
          if (await isGitIgnored(pattern, { ...options, cwd: projectRoot })) {
            isIgnored = true;
            break;
          }
        }
      }
    }

    if (!isIgnored) {
      filtered.push(filePath);
    }
  }

  return filtered;
}

/**
 * Clean up git baseline comparison directories
 */
export async function cleanupBaselinePaths(
  paths: GitBaselinePaths,
  options: GitOptions = {},
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
