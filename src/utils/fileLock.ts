/**
 * Lightweight file locking utility for preventing TOCTOU race conditions
 * Uses exclusive file creation with PID tracking for stale lock detection
 */

import { open, unlink, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

export interface LockOptions {
  /** Maximum time to wait for lock acquisition in ms (default: 5000) */
  timeout?: number;
  /** Time between retry attempts in ms (default: 50) */
  retryInterval?: number;
  /** Maximum age of a lock file before considering it stale in ms (default: 30000) */
  staleThreshold?: number;
}

export interface LockRelease {
  /** Release the lock */
  release: () => Promise<void>;
}

interface LockFileContent {
  pid: number;
  timestamp: number;
}

/**
 * Check if a process is still running
 * Returns: true = alive, false = dead, 'unknown' = can't determine (e.g., permission denied)
 */
function isProcessAlive(pid: number): boolean | 'unknown' {
  // PIDs must be positive integers and within reasonable bounds
  // Windows max PID is around 4 million, Unix typically higher but still bounded
  if (!Number.isInteger(pid) || pid <= 0 || pid > 4194304) {
    return false;
  }

  try {
    // Signal 0 doesn't send a signal, just checks if process exists
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    // ESRCH = no such process (definitely dead)
    // EPERM = process exists but we don't have permission to signal it (still alive!)
    if (err.code === 'EPERM') {
      return 'unknown'; // Process exists but we can't signal it - don't assume stale
    }
    return false; // ESRCH or other error - process is dead
  }
}

/**
 * Check if lock file is stale (process dead or too old)
 */
async function isLockStale(lockPath: string, staleThreshold: number): Promise<boolean> {
  try {
    const content = await readFile(lockPath, 'utf-8');

    // If file is empty, another process just created it and is writing - not stale
    if (!content.trim()) {
      return false;
    }

    let lockData: LockFileContent;
    try {
      lockData = JSON.parse(content);
    } catch {
      // Can't parse JSON - likely another process is mid-write, not stale
      return false;
    }

    // Check if the process that created the lock is still alive
    const alive = isProcessAlive(lockData.pid);
    if (alive === 'unknown') {
      // Can't determine if process is alive (permission denied) - be conservative, don't delete
      // Only consider stale if lock is VERY old (5x threshold)
      const age = Date.now() - lockData.timestamp;
      return age > staleThreshold * 5;
    }
    if (alive === false) {
      return true; // Process is definitely dead
    }

    // Process is alive - check if the lock is too old (safety net for hung processes)
    const age = Date.now() - lockData.timestamp;
    if (age > staleThreshold) {
      return true;
    }

    return false;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    // File doesn't exist - either never created or already removed
    if (err.code === 'ENOENT') {
      return true;
    }
    // Other read errors - be conservative, assume not stale
    return false;
  }
}

/**
 * Remove a stale lock file
 */
async function removeStale(lockPath: string): Promise<void> {
  try {
    await unlink(lockPath);
  } catch {
    // Ignore errors - another process may have removed it
  }
}

/**
 * Acquire an exclusive lock on a file
 *
 * @param filePath - Path to the file to lock (lock file will be filePath + '.lock')
 * @param options - Lock options
 * @returns Lock release function, or null if lock could not be acquired
 *
 * @example
 * ```typescript
 * const lock = await acquireLock('/path/to/config.json');
 * if (!lock) {
 *   throw new Error('Could not acquire lock');
 * }
 * try {
 *   // Do read-modify-write operations
 * } finally {
 *   await lock.release();
 * }
 * ```
 */
export async function acquireLock(
  filePath: string,
  options: LockOptions = {}
): Promise<LockRelease | null> {
  const {
    timeout = 5000,
    retryInterval = 50,
    staleThreshold = 30000,
  } = options;

  const lockPath = `${filePath}.lock`;
  const startTime = Date.now();
  let released = false;

  const lockContent: LockFileContent = {
    pid: process.pid,
    timestamp: Date.now(),
  };

  while (Date.now() - startTime < timeout) {
    try {
      // Try to create lock file exclusively (fails if exists)
      const handle = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
      await handle.writeFile(JSON.stringify(lockContent));
      await handle.close();

      // Lock acquired
      return {
        release: async () => {
          if (released) return;
          released = true;
          try {
            await unlink(lockPath);
          } catch {
            // Ignore errors during release
          }
        },
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;

      if (err.code === 'EEXIST') {
        // Lock file exists - check if it's stale
        if (await isLockStale(lockPath, staleThreshold)) {
          await removeStale(lockPath);
          // Small delay after removing stale lock to let filesystem catch up
          // Especially important on Windows where file deletion can be asynchronous
          await new Promise(resolve => setTimeout(resolve, 10));
          // Retry immediately after removing stale lock
          continue;
        }

        // Lock is held by another active process - wait and retry
        await new Promise(resolve => setTimeout(resolve, retryInterval));
        continue;
      }

      // Other error (e.g., permission denied, directory doesn't exist)
      // Don't retry for these errors
      return null;
    }
  }

  // Timeout reached
  return null;
}

/**
 * Execute a function while holding an exclusive lock
 *
 * @param filePath - Path to the file to lock
 * @param fn - Function to execute while holding the lock
 * @param options - Lock options
 * @returns Result of the function, or throws if lock could not be acquired
 *
 * @example
 * ```typescript
 * await withLock('/path/to/config.json', async () => {
 *   const config = await readConfig();
 *   config.value = 'new';
 *   await writeConfig(config);
 * });
 * ```
 */
export async function withLock<T>(
  filePath: string,
  fn: () => Promise<T>,
  options: LockOptions = {}
): Promise<T> {
  const lock = await acquireLock(filePath, options);

  if (!lock) {
    throw new Error(`Could not acquire lock for "${filePath}" within timeout`);
  }

  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
