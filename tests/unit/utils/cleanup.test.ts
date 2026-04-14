/**
 * Unit tests for cleanup utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  registerCleanup,
  unregisterCleanup,
  gracefulShutdown,
  isShutdownInProgress,
  registerSyncCleanupPath,
  unregisterSyncCleanupPath,
  getCleanupHandlerCount,
  clearAllCleanupHandlers,
} from '../../../src/utils/cleanup.js';

describe('cleanup utilities', () => {
  beforeEach(() => {
    // Clear all handlers before each test
    clearAllCleanupHandlers();
  });

  afterEach(() => {
    // Restore all mocks
    vi.restoreAllMocks();
  });

  describe('registerCleanup', () => {
    it('should add a cleanup handler', () => {
      const handler = vi.fn();
      registerCleanup('test-handler', handler);

      expect(getCleanupHandlerCount()).toBe(1);
    });

    it('should return an unregister function', () => {
      const handler = vi.fn();
      const unregister = registerCleanup('test-handler', handler);

      expect(getCleanupHandlerCount()).toBe(1);
      unregister();
      expect(getCleanupHandlerCount()).toBe(0);
    });

    it('should replace existing handler with same id', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      registerCleanup('same-id', handler1);
      expect(getCleanupHandlerCount()).toBe(1);

      registerCleanup('same-id', handler2);
      expect(getCleanupHandlerCount()).toBe(1);
    });

    it('should sort handlers by priority (lower first)', async () => {
      const executionOrder: number[] = [];

      registerCleanup(
        'high-priority',
        () => {
          executionOrder.push(1);
        },
        1,
      );
      registerCleanup(
        'low-priority',
        () => {
          executionOrder.push(3);
        },
        30,
      );
      registerCleanup(
        'medium-priority',
        () => {
          executionOrder.push(2);
        },
        10,
      );

      // Verify handlers are registered
      expect(getCleanupHandlerCount()).toBe(3);

      // Mock process.exit to prevent actual exit and verify execution order
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('EXIT_CALLED');
      });

      try {
        await gracefulShutdown(0);
      } catch (e) {
        // Expected - we throw to prevent actual exit
      }

      expect(executionOrder).toEqual([1, 2, 3]);
      mockExit.mockRestore();
    });

    it('should use default priority of 10', () => {
      const executionOrder: number[] = [];

      registerCleanup('default-priority', () => {
        executionOrder.push(2);
      }); // default 10
      registerCleanup(
        'high-priority',
        () => {
          executionOrder.push(1);
        },
        5,
      );
      registerCleanup(
        'low-priority',
        () => {
          executionOrder.push(3);
        },
        15,
      );

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('EXIT_CALLED');
      });

      gracefulShutdown(0).catch(() => {});

      // Wait a tick for async handlers
      return new Promise<void>((resolve) => {
        setImmediate(() => {
          expect(executionOrder).toEqual([1, 2, 3]);
          mockExit.mockRestore();
          resolve();
        });
      });
    });
  });

  describe('unregisterCleanup', () => {
    it('should remove handler by id and return true', () => {
      registerCleanup('to-remove', vi.fn());
      expect(getCleanupHandlerCount()).toBe(1);

      const result = unregisterCleanup('to-remove');
      expect(result).toBe(true);
      expect(getCleanupHandlerCount()).toBe(0);
    });

    it('should return false for non-existent id', () => {
      const result = unregisterCleanup('does-not-exist');
      expect(result).toBe(false);
    });

    it('should only remove the specified handler', () => {
      registerCleanup('handler-1', vi.fn());
      registerCleanup('handler-2', vi.fn());
      registerCleanup('handler-3', vi.fn());

      expect(getCleanupHandlerCount()).toBe(3);

      unregisterCleanup('handler-2');
      expect(getCleanupHandlerCount()).toBe(2);
    });
  });

  describe('gracefulShutdown', () => {
    it('should run all handlers before exiting', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      registerCleanup('handler-1', handler1);
      registerCleanup('handler-2', handler2);

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('EXIT_CALLED');
      });

      try {
        await gracefulShutdown(0);
      } catch (e) {
        // Expected
      }

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(mockExit).toHaveBeenCalledWith(0);

      mockExit.mockRestore();
    });

    it('should continue running handlers even if one throws', async () => {
      const executionOrder: string[] = [];

      registerCleanup(
        'handler-1',
        () => {
          executionOrder.push('handler-1');
        },
        1,
      );

      registerCleanup(
        'handler-2-throws',
        () => {
          executionOrder.push('handler-2-throws');
          throw new Error('Handler 2 failed!');
        },
        2,
      );

      registerCleanup(
        'handler-3',
        () => {
          executionOrder.push('handler-3');
        },
        3,
      );

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('EXIT_CALLED');
      });
      const mockConsoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        await gracefulShutdown(1);
      } catch (e) {
        // Expected
      }

      // All handlers should have been called despite handler-2 throwing
      expect(executionOrder).toEqual([
        'handler-1',
        'handler-2-throws',
        'handler-3',
      ]);
      expect(mockConsoleError).toHaveBeenCalledWith(
        'Cleanup error (handler-2-throws):',
        'Handler 2 failed!',
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should call process.exit with the specified exit code', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('EXIT_CALLED');
      });

      try {
        await gracefulShutdown(42);
      } catch (e) {
        // Expected
      }

      expect(mockExit).toHaveBeenCalledWith(42);
      mockExit.mockRestore();
    });

    it('should log message if provided', async () => {
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('EXIT_CALLED');
      });
      const mockConsoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        await gracefulShutdown(1, 'Shutting down...');
      } catch (e) {
        // Expected
      }

      expect(mockConsoleError).toHaveBeenCalledWith('Shutting down...');

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should handle async handlers', async () => {
      const executionOrder: number[] = [];

      registerCleanup(
        'async-handler-1',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          executionOrder.push(1);
        },
        1,
      );

      registerCleanup(
        'async-handler-2',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          executionOrder.push(2);
        },
        2,
      );

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('EXIT_CALLED');
      });

      try {
        await gracefulShutdown(0);
      } catch (e) {
        // Expected
      }

      // Handlers should run sequentially, not in parallel
      expect(executionOrder).toEqual([1, 2]);
      mockExit.mockRestore();
    });
  });

  describe('isShutdownInProgress', () => {
    it('should return false initially', () => {
      // Note: This test may be affected by previous tests if clearAllCleanupHandlers
      // doesn't reset the shutdown flag. Currently it does.
      expect(isShutdownInProgress()).toBe(false);
    });
  });

  describe('registerSyncCleanupPath / unregisterSyncCleanupPath', () => {
    let testDir: string;
    let exitHandler: (() => void) | null = null;
    let cleanupModule: typeof import('../../../src/utils/cleanup.js');

    beforeEach(async () => {
      // Create a temp directory for test files
      testDir = join(
        tmpdir(),
        `cleanup-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      );
      mkdirSync(testDir, { recursive: true });

      // Reset modules to get fresh state
      vi.resetModules();

      // Capture the exit handler when it's registered
      exitHandler = null;
      vi.spyOn(process, 'on').mockImplementation(
        (event: string | symbol, handler: (...args: unknown[]) => void) => {
          if (event === 'exit') {
            exitHandler = handler as () => void;
          }
          return process;
        },
      );

      // Import fresh module after mocking
      cleanupModule = await import('../../../src/utils/cleanup.js');
    });

    afterEach(() => {
      // Clean up test directory
      try {
        rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
      vi.restoreAllMocks();
    });

    it('should delete registered files when exit handler is invoked', () => {
      const testFile1 = join(testDir, 'file1.json');
      const testFile2 = join(testDir, 'file2.json');

      writeFileSync(testFile1, '{"test": 1}');
      writeFileSync(testFile2, '{"test": 2}');

      expect(existsSync(testFile1)).toBe(true);
      expect(existsSync(testFile2)).toBe(true);

      cleanupModule.registerSyncCleanupPath(testFile1);
      cleanupModule.registerSyncCleanupPath(testFile2);

      // Manually invoke the exit handler (simulating process exit)
      expect(exitHandler).not.toBeNull();
      if (exitHandler) {
        exitHandler();
      }

      // Both files should be deleted
      expect(existsSync(testFile1)).toBe(false);
      expect(existsSync(testFile2)).toBe(false);
    });

    it('should not delete files that were unregistered', () => {
      const toDelete = join(testDir, 'to-delete.json');
      const toKeep = join(testDir, 'to-keep.json');

      writeFileSync(toDelete, '{}');
      writeFileSync(toKeep, '{}');

      cleanupModule.registerSyncCleanupPath(toDelete);
      const unregisterKeep = cleanupModule.registerSyncCleanupPath(toKeep);

      // Unregister the second file
      unregisterKeep();

      // Invoke exit handler
      expect(exitHandler).not.toBeNull();
      if (exitHandler) {
        exitHandler();
      }

      expect(existsSync(toDelete)).toBe(false);
      expect(existsSync(toKeep)).toBe(true);
    });

    it('should handle non-existent files gracefully', () => {
      const nonExistentFile = join(testDir, 'does-not-exist.json');

      cleanupModule.registerSyncCleanupPath(nonExistentFile);

      // Should not throw when exit handler tries to delete non-existent file
      expect(exitHandler).not.toBeNull();
      expect(() => {
        if (exitHandler) {
          exitHandler();
        }
      }).not.toThrow();
    });

    it('should handle duplicate path registrations', () => {
      const testFile = join(testDir, 'duplicate.json');
      writeFileSync(testFile, '{}');

      // Register same path twice
      cleanupModule.registerSyncCleanupPath(testFile);
      cleanupModule.registerSyncCleanupPath(testFile);

      // Should still work (Set deduplicates)
      expect(exitHandler).not.toBeNull();
      if (exitHandler) {
        exitHandler();
      }

      expect(existsSync(testFile)).toBe(false);
    });

    it('should return an unregister function', () => {
      const unregister = cleanupModule.registerSyncCleanupPath('/some/path');
      expect(typeof unregister).toBe('function');
    });
  });

  describe('clearAllCleanupHandlers', () => {
    it('should remove all registered handlers', () => {
      registerCleanup('handler-1', vi.fn());
      registerCleanup('handler-2', vi.fn());
      registerCleanup('handler-3', vi.fn());

      expect(getCleanupHandlerCount()).toBe(3);

      clearAllCleanupHandlers();

      expect(getCleanupHandlerCount()).toBe(0);
    });

    it('should reset shutdown state', () => {
      // This is implicitly tested by the fact that gracefulShutdown
      // can be called multiple times across tests (with clearAllCleanupHandlers between)
      clearAllCleanupHandlers();
      expect(isShutdownInProgress()).toBe(false);
    });
  });

  describe('getCleanupHandlerCount', () => {
    it('should return 0 when no handlers registered', () => {
      expect(getCleanupHandlerCount()).toBe(0);
    });

    it('should return correct count after registrations', () => {
      registerCleanup('h1', vi.fn());
      expect(getCleanupHandlerCount()).toBe(1);

      registerCleanup('h2', vi.fn());
      expect(getCleanupHandlerCount()).toBe(2);

      unregisterCleanup('h1');
      expect(getCleanupHandlerCount()).toBe(1);
    });
  });
});
