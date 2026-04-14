/**
 * Graceful shutdown utilities for handling cleanup on process exit
 */

import { unlinkSync } from 'node:fs';

export type CleanupHandler = () => Promise<void> | void;

interface CleanupEntry {
  id: string;
  handler: CleanupHandler;
  priority: number; // Lower numbers run first
}

// Registry of cleanup handlers (async)
const cleanupHandlers: CleanupEntry[] = [];

// Registry of files to delete synchronously on exit (fallback for Windows)
const syncCleanupPaths: Set<string> = new Set();

// Track if shutdown is in progress to prevent re-entry
let isShuttingDown = false;

// Track if signal handlers have been registered
let signalHandlersRegistered = false;

// Track if exit handler has been registered
let exitHandlerRegistered = false;

/**
 * Register a cleanup handler to be called on graceful shutdown
 * @param id Unique identifier for the handler (used for unregistration)
 * @param handler Async function to run during cleanup
 * @param priority Lower numbers run first (default: 10)
 * @returns Unregister function
 */
export function registerCleanup(
  id: string,
  handler: CleanupHandler,
  priority = 10,
): () => void {
  // Remove any existing handler with the same id
  const existingIndex = cleanupHandlers.findIndex((h) => h.id === id);
  if (existingIndex !== -1) {
    cleanupHandlers.splice(existingIndex, 1);
  }

  cleanupHandlers.push({ id, handler, priority });

  // Sort by priority (lower first)
  cleanupHandlers.sort((a, b) => a.priority - b.priority);

  // Return unregister function
  return () => unregisterCleanup(id);
}

/**
 * Unregister a cleanup handler by id
 */
export function unregisterCleanup(id: string): boolean {
  const index = cleanupHandlers.findIndex((h) => h.id === id);
  if (index !== -1) {
    cleanupHandlers.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Run all cleanup handlers and exit the process
 * @param exitCode Exit code to use (default: 1)
 * @param message Optional message to display before cleanup
 */
export async function gracefulShutdown(
  exitCode = 1,
  message?: string,
): Promise<never> {
  // Prevent re-entry
  if (isShuttingDown) {
    process.exit(exitCode);
  }
  isShuttingDown = true;

  if (message) {
    console.error(message);
  }

  // Run all cleanup handlers
  if (cleanupHandlers.length > 0) {
    for (const entry of cleanupHandlers) {
      try {
        await entry.handler();
      } catch (error) {
        // Log but continue with other handlers
        console.error(`Cleanup error (${entry.id}):`, (error as Error).message);
      }
    }
  }

  process.exit(exitCode);
}

/**
 * Register process signal handlers for graceful shutdown
 * Call this once at application startup
 *
 * Note: Signal handlers must NOT be async functions because Node.js
 * doesn't wait for their returned promises. Instead, we call gracefulShutdown
 * (which is async) and let it run - it will call process.exit() when done.
 * The event loop stays alive because of pending promises in the main code.
 */
export function registerSignalHandlers(): void {
  if (signalHandlersRegistered) {
    return;
  }
  signalHandlersRegistered = true;

  // Handle Ctrl+C
  // Don't use async - gracefulShutdown will call process.exit when done
  process.on('SIGINT', () => {
    gracefulShutdown(130).catch((err) => {
      console.error('Cleanup error during SIGINT:', err);
      process.exit(130);
    }); // 128 + 2 (SIGINT signal number)
  });

  // Handle termination request
  process.on('SIGTERM', () => {
    gracefulShutdown(143).catch((err) => {
      console.error('Cleanup error during SIGTERM:', err);
      process.exit(143);
    }); // 128 + 15 (SIGTERM signal number)
  });

  // Handle terminal hangup (Unix only, no-op on Windows)
  process.on('SIGHUP', () => {
    gracefulShutdown(129).catch((err) => {
      console.error('Cleanup error during SIGHUP:', err);
      process.exit(129);
    }); // 128 + 1 (SIGHUP signal number)
  });

  // Handle Ctrl+Break on Windows (SIGBREAK)
  // This signal is Windows-specific and may be used instead of SIGINT
  if (process.platform === 'win32') {
    process.on('SIGBREAK', () => {
      gracefulShutdown(149).catch((err) => {
        console.error('Cleanup error during SIGBREAK:', err);
        process.exit(149);
      }); // 128 + 21 (SIGBREAK signal number on Windows)
    });
  }
}

/**
 * Check if shutdown is in progress
 */
export function isShutdownInProgress(): boolean {
  return isShuttingDown;
}

/**
 * Register a file path for synchronous cleanup on process exit.
 * This is a fallback for Windows where signal handlers may not fire.
 * The file will be deleted synchronously in the 'exit' event handler.
 * @param filePath Absolute path to the file to delete
 * @returns Unregister function
 */
export function registerSyncCleanupPath(filePath: string): () => void {
  syncCleanupPaths.add(filePath);
  registerExitHandler(); // Ensure exit handler is registered
  return () => unregisterSyncCleanupPath(filePath);
}

/**
 * Unregister a file path from synchronous cleanup
 */
export function unregisterSyncCleanupPath(filePath: string): void {
  syncCleanupPaths.delete(filePath);
}

/**
 * Register the process 'exit' handler for synchronous cleanup.
 * This is called automatically when registerSyncCleanupPath is used.
 * The 'exit' handler always fires on process termination, even on Windows.
 */
function registerExitHandler(): void {
  if (exitHandlerRegistered) {
    return;
  }
  exitHandlerRegistered = true;

  // The 'exit' event fires when the process is about to exit.
  // Handlers must be synchronous - async operations won't complete.
  process.on('exit', () => {
    // Synchronously delete all registered cleanup paths
    for (const filePath of syncCleanupPaths) {
      try {
        unlinkSync(filePath);
      } catch {
        // File doesn't exist or can't be deleted - ignore
      }
    }
  });
}

/**
 * Get the number of registered cleanup handlers (for testing)
 */
export function getCleanupHandlerCount(): number {
  return cleanupHandlers.length;
}

/**
 * Clear all cleanup handlers (for testing)
 */
export function clearAllCleanupHandlers(): void {
  cleanupHandlers.length = 0;
  isShuttingDown = false;
}
