/**
 * Utilities for managing LogicStamp configuration
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { debugError } from './debug.js';

/**
 * Ensure config directory exists with consistent error handling
 * @param configDir - Directory path to create
 * @param context - Context for debug logging (e.g., 'writeConfig', 'writeWatchStatus')
 * @throws Error if directory cannot be created
 */
async function ensureConfigDir(configDir: string, context: string): Promise<void> {
  try {
    await mkdir(configDir, { recursive: true });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('config', context, {
      configDir,
      operation: 'mkdir',
      message: err.message,
      code: err.code,
    });
    throw new Error(
      `Failed to create config directory "${configDir}": ${err.code === 'EACCES' ? 'Permission denied' : err.message}`
    );
  }
}

/**
 * Format a file write error into a user-friendly message
 * @param err - The error from writeFile
 * @param filePath - Path to the file that failed to write
 * @param fileType - Human-readable file type (e.g., 'config file', 'watch status file')
 * @returns User-friendly error message
 */
function formatWriteError(err: NodeJS.ErrnoException, filePath: string, fileType: string): string {
  switch (err.code) {
    case 'ENOENT':
      return `Parent directory not found for: "${filePath}"`;
    case 'EACCES':
      return `Permission denied writing to: "${filePath}"`;
    case 'ENOSPC':
      return `No space left on device. Cannot write: "${filePath}"`;
    default:
      return `Failed to write ${fileType} "${filePath}": ${err.message}`;
  }
}

export interface LogicStampConfig {
  /** User's preference for .gitignore management: "added" | "skipped" */
  gitignorePreference?: 'added' | 'skipped';
  /** User's preference for LLM_CONTEXT.md generation: "added" | "skipped" */
  llmContextPreference?: 'added' | 'skipped';
}

/**
 * Get the config directory path for a project
 */
export function getConfigDir(projectRoot: string): string {
  return join(projectRoot, '.logicstamp');
}

/**
 * Get the config file path for a project
 */
export function getConfigPath(projectRoot: string): string {
  return join(getConfigDir(projectRoot), 'config.json');
}

/**
 * Check if config file exists
 */
export async function configExists(projectRoot: string): Promise<boolean> {
  try {
    await access(getConfigPath(projectRoot));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read config from disk
 */
export async function readConfig(projectRoot: string): Promise<LogicStampConfig> {
  try {
    const configPath = getConfigPath(projectRoot);
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Write config to disk
 */
export async function writeConfig(projectRoot: string, config: LogicStampConfig): Promise<void> {
  const configDir = getConfigDir(projectRoot);
  const configPath = getConfigPath(projectRoot);

  await ensureConfigDir(configDir, 'writeConfig');

  try {
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('config', 'writeConfig', {
      configPath,
      operation: 'writeFile',
      message: err.message,
      code: err.code,
    });
    throw new Error(formatWriteError(err, configPath, 'config file'));
  }
}

/**
 * Update config with new values (merges with existing)
 */
export async function updateConfig(projectRoot: string, updates: Partial<LogicStampConfig>): Promise<void> {
  const existing = await readConfig(projectRoot);
  const merged = { ...existing, ...updates };
  await writeConfig(projectRoot, merged);
}

/**
 * Watch mode status information
 */
export interface WatchStatus {
  /** Whether watch mode is currently active */
  active: boolean;
  /** Project root path being watched */
  projectRoot: string;
  /** Process ID of the watch process */
  pid: number;
  /** Timestamp when watch mode started */
  startedAt: string;
  /** Output directory being watched */
  outputDir?: string;
}

/**
 * Get the watch status file path for a project
 */
export function getWatchStatusPath(projectRoot: string): string {
  return join(getConfigDir(projectRoot), 'context_watch-status.json');
}

/**
 * Check if watch mode is active for a project
 */
export async function isWatchModeActive(projectRoot: string): Promise<boolean> {
  try {
    const statusPath = getWatchStatusPath(projectRoot);
    await access(statusPath);
    
    // Read and validate the status file
    const content = await readFile(statusPath, 'utf-8');
    const status: WatchStatus = JSON.parse(content);
    
    // Check if process is still running
    try {
      // Try to send signal 0 to check if process exists
      // On Windows, this throws if process doesn't exist
      // On Unix, signal 0 checks if process exists without sending a signal
      process.kill(status.pid, 0);
    } catch {
      // Process doesn't exist - clean up stale status file
      await deleteWatchStatus(projectRoot);
      return false;
    }
    
    return status.active === true;
  } catch {
    return false;
  }
}

/**
 * Read watch status from disk
 */
export async function readWatchStatus(projectRoot: string): Promise<WatchStatus | null> {
  try {
    const statusPath = getWatchStatusPath(projectRoot);
    const content = await readFile(statusPath, 'utf-8');
    return JSON.parse(content) as WatchStatus;
  } catch {
    return null;
  }
}

/**
 * Write watch status to disk
 */
export async function writeWatchStatus(projectRoot: string, status: WatchStatus): Promise<void> {
  const configDir = getConfigDir(projectRoot);
  const statusPath = getWatchStatusPath(projectRoot);

  await ensureConfigDir(configDir, 'writeWatchStatus');

  try {
    await writeFile(statusPath, JSON.stringify(status, null, 2), 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('config', 'writeWatchStatus', {
      statusPath,
      operation: 'writeFile',
      message: err.message,
      code: err.code,
    });
    throw new Error(formatWriteError(err, statusPath, 'watch status file'));
  }
}

/**
 * Delete watch status file
 */
export async function deleteWatchStatus(projectRoot: string): Promise<void> {
  try {
    const statusPath = getWatchStatusPath(projectRoot);
    const { unlink } = await import('node:fs/promises');
    await unlink(statusPath);
  } catch {
    // File doesn't exist or can't be deleted - ignore
  }
}

/**
 * Watch mode log entry
 */
export interface WatchLogEntry {
  /** Timestamp of the regeneration */
  timestamp: string;
  /** Files that triggered the regeneration */
  changedFiles: string[];
  /** Modified contracts */
  modifiedContracts?: Array<{
    entryId: string;
    semanticHashChanged?: boolean;
    fileHashChanged?: boolean;
    semanticHash?: { old: string; new: string };
    fileHash?: { old: string; new: string };
  }>;
  /** Modified bundles */
  modifiedBundles?: Array<{
    entryId: string;
    bundleHash: { old: string; new: string };
  }>;
  /** Summary counts for quick reference */
  summary?: {
    modifiedContractsCount?: number;
    modifiedBundlesCount?: number;
    addedContractsCount?: number;
    removedContractsCount?: number;
  };
  /** Added contracts */
  addedContracts?: string[];
  /** Removed contracts */
  removedContracts?: string[];
  /** Error message if regeneration failed */
  error?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Number of files changed */
  fileCount: number;
}

/**
 * Watch mode logs structure
 */
export interface WatchLogs {
  /** Array of log entries (most recent first) */
  entries: WatchLogEntry[];
  /** Maximum number of entries to keep (default: 100) */
  maxEntries?: number;
}

/**
 * Get the watch logs file path for a project
 */
export function getWatchLogsPath(projectRoot: string): string {
  return join(getConfigDir(projectRoot), 'context_watch-mode-logs.json');
}

/**
 * Read watch logs from disk
 */
export async function readWatchLogs(projectRoot: string): Promise<WatchLogs> {
  try {
    const logsPath = getWatchLogsPath(projectRoot);
    const content = await readFile(logsPath, 'utf-8');
    const logs = JSON.parse(content) as WatchLogs;
    return logs;
  } catch {
    // Return empty logs if file doesn't exist
    return { entries: [], maxEntries: 100 };
  }
}

/**
 * Ensure config directory exists, logging errors but not throwing (non-fatal)
 * @param configDir - Directory path to create
 * @param context - Context for debug logging
 * @returns true if directory exists/created, false if failed
 */
async function ensureConfigDirSilent(configDir: string, context: string): Promise<boolean> {
  try {
    await mkdir(configDir, { recursive: true });
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('config', context, {
      configDir,
      operation: 'mkdir',
      message: err.message,
      code: err.code,
    });
    return false;
  }
}

/**
 * Append a log entry to watch logs
 */
export async function appendWatchLog(projectRoot: string, entry: WatchLogEntry): Promise<void> {
  const configDir = getConfigDir(projectRoot);
  const logsPath = getWatchLogsPath(projectRoot);

  // Non-fatal - continue even if directory can't be created
  if (!await ensureConfigDirSilent(configDir, 'appendWatchLog')) {
    return;
  }

  try {
    // Read existing logs
    const logs = await readWatchLogs(projectRoot);
    const maxEntries = logs.maxEntries || 100;

    // Add new entry at the beginning (most recent first)
    logs.entries.unshift(entry);

    // Trim to max entries
    if (logs.entries.length > maxEntries) {
      logs.entries = logs.entries.slice(0, maxEntries);
    }

    // Write back to disk
    await writeFile(logsPath, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('config', 'appendWatchLog', {
      logsPath,
      operation: 'writeFile',
      message: err.message,
      code: err.code,
    });
    // Non-fatal - continue even if log can't be written
  }
}

/**
 * Clear watch logs
 */
export async function clearWatchLogs(projectRoot: string): Promise<void> {
  try {
    const logsPath = getWatchLogsPath(projectRoot);
    const { unlink } = await import('node:fs/promises');
    await unlink(logsPath);
  } catch {
    // File doesn't exist or can't be deleted - ignore
  }
}

/**
 * Violation types for strict watch mode
 */
export type ViolationType =
  | 'missing_dependency'
  | 'breaking_change_prop_removed'
  | 'breaking_change_prop_type'
  | 'breaking_change_event_removed'
  | 'breaking_change_state_removed'
  | 'breaking_change_function_removed'
  | 'breaking_change_variable_removed'
  | 'contract_removed';

/**
 * Single violation entry
 */
export interface Violation {
  /** Type of violation */
  type: ViolationType;
  /** Severity level */
  severity: 'error' | 'warning';
  /** Entry ID of the affected contract */
  entryId: string;
  /** Human-readable message */
  message: string;
  /** Details about the violation */
  details?: {
    /** Name of the removed/changed item */
    name?: string;
    /** Old value (for type changes) */
    oldValue?: unknown;
    /** New value (for type changes) */
    newValue?: unknown;
    /** Missing dependency name */
    dependencyName?: string;
  };
}

/**
 * Violations summary for a watch regeneration cycle
 */
export interface ViolationsSummary {
  /** Timestamp of the check */
  timestamp: string;
  /** Total number of violations */
  totalViolations: number;
  /** Number of errors */
  errors: number;
  /** Number of warnings */
  warnings: number;
  /** Array of violations */
  violations: Violation[];
  /** Files that triggered this check */
  changedFiles: string[];
}

/**
 * Strict watch mode status with cumulative violations
 */
export interface StrictWatchStatus {
  /** Whether strict watch mode is active */
  active: boolean;
  /** Session start timestamp */
  startedAt: string;
  /** Cumulative violations count since session start */
  cumulativeViolations: number;
  /** Cumulative errors count */
  cumulativeErrors: number;
  /** Cumulative warnings count */
  cumulativeWarnings: number;
  /** Number of regeneration cycles */
  regenerationCount: number;
  /** Most recent violations summary */
  lastCheck?: ViolationsSummary;
}

/**
 * Get the strict watch violations report file path
 */
export function getStrictWatchReportPath(projectRoot: string): string {
  return join(getConfigDir(projectRoot), 'strict_watch_violations.json');
}

/**
 * Read strict watch status from disk
 */
export async function readStrictWatchStatus(projectRoot: string): Promise<StrictWatchStatus | null> {
  try {
    const reportPath = getStrictWatchReportPath(projectRoot);
    const content = await readFile(reportPath, 'utf-8');
    return JSON.parse(content) as StrictWatchStatus;
  } catch {
    return null;
  }
}

/**
 * Write strict watch status to disk
 */
export async function writeStrictWatchStatus(projectRoot: string, status: StrictWatchStatus): Promise<void> {
  const configDir = getConfigDir(projectRoot);
  const reportPath = getStrictWatchReportPath(projectRoot);

  // Non-fatal - continue even if directory can't be created
  if (!await ensureConfigDirSilent(configDir, 'writeStrictWatchStatus')) {
    return;
  }

  try {
    await writeFile(reportPath, JSON.stringify(status, null, 2), 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('config', 'writeStrictWatchStatus', {
      reportPath,
      operation: 'writeFile',
      message: err.message,
      code: err.code,
    });
    // Non-fatal - continue even if report can't be written
  }
}

/**
 * Delete strict watch status file
 */
export async function deleteStrictWatchStatus(projectRoot: string): Promise<void> {
  try {
    const reportPath = getStrictWatchReportPath(projectRoot);
    const { unlink } = await import('node:fs/promises');
    await unlink(reportPath);
  } catch {
    // File doesn't exist or can't be deleted - ignore
  }
}