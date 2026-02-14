/**
 * Graceful shutdown utilities for handling cleanup on process exit
 */

export type CleanupHandler = () => Promise<void> | void;

interface CleanupEntry {
  id: string;
  handler: CleanupHandler;
  priority: number; // Lower numbers run first
}

// Registry of cleanup handlers
const cleanupHandlers: CleanupEntry[] = [];

// Track if shutdown is in progress to prevent re-entry
let isShuttingDown = false;

// Track if signal handlers have been registered
let signalHandlersRegistered = false;

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
  priority = 10
): () => void {
  // Remove any existing handler with the same id
  const existingIndex = cleanupHandlers.findIndex(h => h.id === id);
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
  const index = cleanupHandlers.findIndex(h => h.id === id);
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
  message?: string
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
 */
export function registerSignalHandlers(): void {
  if (signalHandlersRegistered) {
    return;
  }
  signalHandlersRegistered = true;

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    gracefulShutdown(130); // 128 + 2 (SIGINT signal number)
  });

  // Handle termination request
  process.on('SIGTERM', () => {
    gracefulShutdown(143); // 128 + 15 (SIGTERM signal number)
  });

  // Handle terminal hangup (Unix only, no-op on Windows)
  process.on('SIGHUP', () => {
    gracefulShutdown(129); // 128 + 1 (SIGHUP signal number)
  });
}

/**
 * Check if shutdown is in progress
 */
export function isShutdownInProgress(): boolean {
  return isShuttingDown;
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
