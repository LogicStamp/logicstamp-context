import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { acquireLock, withLock } from '../../../src/utils/fileLock.js';
import { writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

describe('fileLock utils', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'logicstamp-lock-test-'));
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('acquireLock', () => {
    it('should acquire lock and create lock file', async () => {
      const filePath = join(testDir, 'test.json');
      await writeFile(filePath, '{}');

      const lock = await acquireLock(filePath);
      expect(lock).not.toBeNull();

      // Lock file should exist
      const lockPath = `${filePath}.lock`;
      const lockExists = await access(lockPath)
        .then(() => true)
        .catch(() => false);
      expect(lockExists).toBe(true);

      // Lock file should contain PID
      const lockContent = JSON.parse(await readFile(lockPath, 'utf-8'));
      expect(lockContent.pid).toBe(process.pid);
      expect(lockContent.timestamp).toBeDefined();

      await lock?.release();
    });

    it('should remove lock file on release', async () => {
      const filePath = join(testDir, 'test.json');
      await writeFile(filePath, '{}');

      const lock = await acquireLock(filePath);
      await lock?.release();

      const lockPath = `${filePath}.lock`;
      const lockExists = await access(lockPath)
        .then(() => true)
        .catch(() => false);
      expect(lockExists).toBe(false);
    });

    it('should handle multiple release calls gracefully', async () => {
      const filePath = join(testDir, 'test.json');
      await writeFile(filePath, '{}');

      const lock = await acquireLock(filePath);
      await lock?.release();
      await lock?.release(); // Should not throw
    });

    it('should detect stale lock from dead process', async () => {
      const filePath = join(testDir, 'test.json');
      await writeFile(filePath, '{}');

      // Create a stale lock file with non-existent PID
      // Use a PID that's valid but very unlikely to exist (high but within 32-bit range)
      // This should fail consistently on both Windows and Unix
      const lockPath = `${filePath}.lock`;
      await writeFile(
        lockPath,
        JSON.stringify({
          pid: 4000000, // High but valid PID, very unlikely to exist
          timestamp: Date.now(),
        }),
      );

      // Should be able to acquire lock (stale lock is removed)
      // Use longer timeout to allow for stale detection, removal, and retry (especially on Windows)
      const lock = await acquireLock(filePath, {
        timeout: 2000,
        retryInterval: 50,
      });
      expect(lock).not.toBeNull();

      await lock?.release();
    });

    it('should detect stale lock by age', async () => {
      const filePath = join(testDir, 'test.json');
      await writeFile(filePath, '{}');

      // Create a lock file with old timestamp but current PID
      // On Windows, process.kill(pid, 0) may return EPERM for the current process,
      // which triggers the 5x stale threshold. Use 180 seconds to exceed 5x30s=150s.
      const lockPath = `${filePath}.lock`;
      await writeFile(
        lockPath,
        JSON.stringify({
          pid: process.pid, // Current PID (process is alive)
          timestamp: Date.now() - 180000, // 180 seconds ago (exceeds 5x threshold on Windows)
        }),
      );

      // Should be able to acquire lock (lock is too old)
      // Use longer timeout to allow for stale detection, removal, and retry (especially on Windows)
      const lock = await acquireLock(filePath, {
        timeout: 2000,
        retryInterval: 50,
        staleThreshold: 30000, // 30 seconds (5x = 150 seconds for 'unknown' alive status)
      });
      expect(lock).not.toBeNull();

      await lock?.release();
    });

    it('should wait for active lock to be released', async () => {
      const filePath = join(testDir, 'test.json');
      await writeFile(filePath, '{}');

      // Acquire first lock
      const lock1 = await acquireLock(filePath);
      expect(lock1).not.toBeNull();

      // Start acquiring second lock (will wait for lock1 to be released)
      // Use generous timeout to avoid flakiness on slow systems and when running in parallel
      const startTime = Date.now();
      const lock2Promise = acquireLock(filePath, {
        timeout: 5000,
        retryInterval: 50,
      });

      // Give lock2Promise a moment to start and enter the retry loop
      // This ensures it's actively checking before we release lock1
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Release first lock after 100ms total, ensuring release completes
      // Use a Promise to properly handle the async release and filesystem delay
      const releasePromise = (async () => {
        await new Promise((resolve) => setTimeout(resolve, 80)); // Wait until ~100ms total
        await lock1?.release();
        // Additional delay to let filesystem catch up (especially important on Windows)
        // Windows file deletion can be asynchronous, so we need to ensure
        // the deletion is fully visible before lock2's next check
        await new Promise((r) => setTimeout(r, 30));
      })();

      // Don't await releasePromise - let it run in parallel with lock2Promise
      // lock2Promise will succeed once the lock is released and filesystem updates
      const lock2 = await lock2Promise;
      const elapsed = Date.now() - startTime;

      // Ensure release completed (should be done by now, but verify for cleanup)
      await releasePromise;

      expect(lock2).not.toBeNull();
      expect(elapsed).toBeGreaterThanOrEqual(90); // Should have waited
      expect(elapsed).toBeLessThan(5000); // Should not have timed out (increased for parallel test runs)

      await lock2?.release();
    });

    it('should return null on timeout', async () => {
      const filePath = join(testDir, 'test.json');
      await writeFile(filePath, '{}');

      // Acquire and hold lock
      const lock1 = await acquireLock(filePath);
      expect(lock1).not.toBeNull();

      // Try to acquire second lock with short timeout
      const lock2 = await acquireLock(filePath, { timeout: 100 });
      expect(lock2).toBeNull();

      await lock1?.release();
    });
  });

  describe('withLock', () => {
    it('should execute function while holding lock', async () => {
      const filePath = join(testDir, 'test.json');
      await writeFile(filePath, '{}');

      let executed = false;
      await withLock(filePath, async () => {
        // Lock file should exist while function runs
        const lockPath = `${filePath}.lock`;
        const lockExists = await access(lockPath)
          .then(() => true)
          .catch(() => false);
        expect(lockExists).toBe(true);

        executed = true;
      });

      expect(executed).toBe(true);

      // Lock should be released after function completes
      const lockPath = `${filePath}.lock`;
      const lockExists = await access(lockPath)
        .then(() => true)
        .catch(() => false);
      expect(lockExists).toBe(false);
    });

    it('should return function result', async () => {
      const filePath = join(testDir, 'test.json');
      await writeFile(filePath, '{}');

      const result = await withLock(filePath, async () => {
        return 'test-result';
      });

      expect(result).toBe('test-result');
    });

    it('should release lock even if function throws', async () => {
      const filePath = join(testDir, 'test.json');
      await writeFile(filePath, '{}');

      await expect(
        withLock(filePath, async () => {
          throw new Error('Test error');
        }),
      ).rejects.toThrow('Test error');

      // Lock should be released
      const lockPath = `${filePath}.lock`;
      const lockExists = await access(lockPath)
        .then(() => true)
        .catch(() => false);
      expect(lockExists).toBe(false);
    });

    it('should throw if lock cannot be acquired', async () => {
      const filePath = join(testDir, 'test.json');
      await writeFile(filePath, '{}');

      // Acquire and hold lock
      const lock1 = await acquireLock(filePath);

      await expect(
        withLock(filePath, async () => {}, { timeout: 100 }),
      ).rejects.toThrow('Could not acquire lock');

      await lock1?.release();
    });

    it('should serialize concurrent access', async () => {
      const filePath = join(testDir, 'counter.json');
      await writeFile(filePath, JSON.stringify({ count: 0 }));

      // Run 5 concurrent increments (reduced from 10 for reliability on slow filesystems)
      // Use generous timeout since all must run sequentially (each waits for previous)
      const increments = Array.from({ length: 5 }, () =>
        withLock(
          filePath,
          async () => {
            const content = JSON.parse(await readFile(filePath, 'utf-8'));
            content.count += 1;
            await writeFile(filePath, JSON.stringify(content));
          },
          { timeout: 60000, retryInterval: 100 },
        ),
      );

      await Promise.all(increments);

      // All increments should have been serialized
      const finalContent = JSON.parse(await readFile(filePath, 'utf-8'));
      expect(finalContent.count).toBe(5);
    }, 90000); // Extended test timeout for slow CI/Windows filesystems
  });
});
