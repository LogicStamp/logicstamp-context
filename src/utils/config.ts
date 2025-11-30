/**
 * Utilities for managing LogicStamp configuration
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { debugError } from './debug.js';

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

  // Ensure config directory exists
  try {
    await mkdir(configDir, { recursive: true });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('config', 'writeConfig', {
      configDir,
      operation: 'mkdir',
      message: err.message,
      code: err.code,
    });
    throw new Error(`Failed to create config directory "${configDir}": ${err.code === 'EACCES' ? 'Permission denied' : err.message}`);
  }

  // Write config file
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
    
    let userMessage: string;
    switch (err.code) {
      case 'ENOENT':
        userMessage = `Parent directory not found for: "${configPath}"`;
        break;
      case 'EACCES':
        userMessage = `Permission denied writing to: "${configPath}"`;
        break;
      case 'ENOSPC':
        userMessage = `No space left on device. Cannot write: "${configPath}"`;
        break;
      default:
        userMessage = `Failed to write config file "${configPath}": ${err.message}`;
    }
    throw new Error(userMessage);
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
