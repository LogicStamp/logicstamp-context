/**
 * Utilities for managing .stampignore files
 * Similar to .gitignore, but for LogicStamp context generation
 */

import { readFile, writeFile, access, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { debugError } from './debug.js';
import { normalizeEntryId } from './fsx.js';

export interface StampIgnoreConfig {
  /**
   * Array of file paths or glob patterns to ignore
   * Paths are relative to the project root
   */
  ignore: string[];
}

/**
 * Default .stampignore filename
 */
export const STAMPIGNORE_FILENAME = '.stampignore';

/**
 * Check if .stampignore exists in the given directory
 */
export async function stampignoreExists(targetDir: string): Promise<boolean> {
  try {
    await access(join(targetDir, STAMPIGNORE_FILENAME));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read .stampignore content
 */
export async function readStampignore(targetDir: string): Promise<StampIgnoreConfig | null> {
  const stampignorePath = join(targetDir, STAMPIGNORE_FILENAME);
  try {
    const content = await readFile(stampignorePath, 'utf-8');
    const config = JSON.parse(content) as StampIgnoreConfig;
    
    // Validate structure
    if (!config || typeof config !== 'object') {
      debugError('stampignore', 'readStampignore', {
        stampignorePath,
        message: 'Invalid config structure',
      });
      return null;
    }
    
    if (!Array.isArray(config.ignore)) {
      debugError('stampignore', 'readStampignore', {
        stampignorePath,
        message: 'Config.ignore must be an array',
      });
      return null;
    }
    
    return config;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      // File doesn't exist - that's fine, return null
      return null;
    }
    
    debugError('stampignore', 'readStampignore', {
      stampignorePath,
      message: err.message,
      code: err.code,
    });
    return null;
  }
}

/**
 * Write .stampignore content
 */
export async function writeStampignore(
  targetDir: string,
  config: StampIgnoreConfig
): Promise<void> {
  const stampignorePath = join(targetDir, STAMPIGNORE_FILENAME);
  
  try {
    const content = JSON.stringify(config, null, 2);
    await writeFile(stampignorePath, content, 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('stampignore', 'writeStampignore', {
      stampignorePath,
      targetDir,
      message: err.message,
      code: err.code,
    });
    
    let userMessage: string;
    switch (err.code) {
      case 'ENOENT':
        userMessage = `Parent directory not found for: "${stampignorePath}"`;
        break;
      case 'EACCES':
        userMessage = `Permission denied writing to: "${stampignorePath}"`;
        break;
      case 'ENOSPC':
        userMessage = `No space left on device. Cannot write: "${stampignorePath}"`;
        break;
      default:
        userMessage = `Failed to write .stampignore file "${stampignorePath}": ${err.message}`;
    }
    throw new Error(userMessage);
  }
}

/**
 * Add paths to .stampignore
 * Creates the file if it doesn't exist
 */
export async function addToStampignore(
  targetDir: string,
  pathsToAdd: string[]
): Promise<{ added: boolean; created: boolean }> {
  const exists = await stampignoreExists(targetDir);
  const config = await readStampignore(targetDir);
  
  const currentIgnore = config?.ignore || [];
  const normalizedCurrent = currentIgnore.map(p => normalizeEntryId(p));
  
  // Normalize paths to add and filter out duplicates
  const normalizedToAdd = pathsToAdd
    .map(p => normalizeEntryId(p))
    .filter(p => !normalizedCurrent.includes(p));
  
  if (normalizedToAdd.length === 0) {
    return { added: false, created: false };
  }
  
  const newConfig: StampIgnoreConfig = {
    ignore: [...currentIgnore, ...normalizedToAdd],
  };
  
  await writeStampignore(targetDir, newConfig);
  
  return { added: true, created: !exists };
}

/**
 * Check if a file path matches any ignore pattern
 * Supports glob patterns and exact paths
 */
export function matchesIgnorePattern(
  filePath: string,
  patterns: string[],
  projectRoot: string
): boolean {
  const normalizedPath = normalizeEntryId(filePath);
  const normalizedRoot = normalizeEntryId(projectRoot);
  
  // Make path relative to project root for matching
  let relativePath = normalizedPath;
  if (normalizedPath.startsWith(normalizedRoot)) {
    relativePath = normalizedPath.slice(normalizedRoot.length).replace(/^\//, '');
  }
  
  for (const pattern of patterns) {
    const normalizedPattern = normalizeEntryId(pattern);
    
    // Exact match
    if (normalizedPattern === relativePath || normalizedPattern === normalizedPath) {
      return true;
    }
    
    // Glob pattern matching (simple implementation)
    // Convert glob to regex
    const regexPattern = normalizedPattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    
    // Check against relative path
    if (regex.test(relativePath)) {
      return true;
    }
    
    // Also check against full normalized path
    if (regex.test(normalizedPath)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Filter files based on .stampignore patterns
 */
export function filterIgnoredFiles(
  files: string[],
  patterns: string[],
  projectRoot: string
): string[] {
  if (patterns.length === 0) {
    return files;
  }
  
  return files.filter(file => !matchesIgnorePattern(file, patterns, projectRoot));
}

/**
 * Delete .stampignore file
 */
export async function deleteStampignore(targetDir: string): Promise<boolean> {
  const stampignorePath = join(targetDir, STAMPIGNORE_FILENAME);
  try {
    await unlink(stampignorePath);
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      // File doesn't exist - that's fine, return false
      return false;
    }
    
    debugError('stampignore', 'deleteStampignore', {
      stampignorePath,
      message: err.message,
      code: err.code,
    });
    throw new Error(`Failed to delete .stampignore: ${err.message}`);
  }
}

