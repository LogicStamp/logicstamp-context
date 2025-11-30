/**
 * @uif Contract 0.3
 *
 * Description: fsx - Presentational component
 *
 * Version (Component Composition):
 *   variables: []
 *   hooks: []
 *   components: []
 *   functions: ["deleteSidecar","fileExists","findSidecarFiles","getRelativePath","getSidecarPath","globFiles","normalizeEntryId","readFileWithText","resolvePath"]
 *   imports: ["glob","node:fs/promises","node:path"]
 *
 * Logic Signature:
 *   props: {}
 *   events: {}
 *   state: {}
 *
 * Predictions:
 *   (none)
 *
 * Hashes (informational only - authoritative values in .uif.json):
 *   semantic: uif:80b91273520265259cc8e40e (informational)
 *   file: uif:f6ee3958ee861ee956f6b5c9
 */

/**
 * File system utilities for glob patterns and path operations
 */

import { glob } from 'glob';
import { readFile, unlink, stat } from 'node:fs/promises';
import { resolve, relative, join, normalize, isAbsolute } from 'node:path';
import { debugError } from './debug.js';

export interface FileWithText {
  path: string;
  text: string;
}

/**
 * Find files matching glob patterns
 */
export async function globFiles(
  searchPath: string,
  extensions: string = '.tsx,.ts'
): Promise<string[]> {
  const extArray = extensions.split(',').map((ext) => ext.trim());

  // Build glob pattern
  const patterns = extArray.map((ext) => {
    if (ext.startsWith('.')) {
      return `**/*${ext}`;
    }
    return `**/*.${ext}`;
  });

  const files: string[] = [];

  try {
  for (const pattern of patterns) {
      try {
    const matches = await glob(pattern, {
      cwd: searchPath,
      absolute: true,
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/coverage/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
      ],
    });

    files.push(...matches);
      } catch (error) {
        const err = error as Error;
        debugError('fsx', 'globFiles inner pattern', {
          pattern,
          searchPath,
          message: err.message,
        });
        throw new Error(
          `Failed to glob pattern "${pattern}" in "${searchPath}": ${err.message}`
        );
      }
  }

  // Remove duplicates and sort
  return [...new Set(files)].sort();
  } catch (error) {
    const err = error as Error;
    debugError('fsx', 'globFiles', {
      searchPath,
      extensions,
      message: err.message,
    });
    throw err;
  }
}

/**
 * Read file and return path + content
 */
export async function readFileWithText(filePath: string): Promise<FileWithText> {
  try {
  const text = await readFile(filePath, 'utf8');
  return { path: filePath, text };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('fsx', 'readFileWithText', {
      filePath,
      code: err.code,
      message: err.message,
    });
    
    // Provide user-friendly error messages based on errno
    let userMessage: string;
    switch (err.code) {
      case 'ENOENT':
        userMessage = `File not found: "${filePath}"`;
        break;
      case 'EACCES':
        userMessage = `Permission denied: "${filePath}"`;
        break;
      case 'EISDIR':
        userMessage = `Path is a directory, not a file: "${filePath}"`;
        break;
      case 'EMFILE':
        userMessage = `Too many open files. Cannot read: "${filePath}"`;
        break;
      case 'ENFILE':
        userMessage = `System limit reached. Cannot read: "${filePath}"`;
        break;
      default:
        userMessage = `Failed to read file "${filePath}": ${err.message}`;
    }
    
    throw new Error(userMessage);
  }
}

/**
 * Find all sidecar files (*.uif.json) in a directory
 * Returns empty array if glob fails (sidecars are optional)
 */
export async function findSidecarFiles(searchPath: string): Promise<string[]> {
  try {
    return await glob('**/*.uif.json', {
    cwd: searchPath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  });
  } catch (error) {
    const err = error as Error;
    debugError('fsx', 'findSidecarFiles', {
      searchPath,
      message: err.message,
    });
    // Sidecars are optional → safe fallback
    return [];
  }
}

/**
 * Delete a sidecar file
 */
export async function deleteSidecar(sidecarPath: string): Promise<void> {
  try {
    await unlink(sidecarPath);
  } catch (err) {
    // Ignore if file doesn't exist
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
}

/**
 * Get relative path from base directory
 */
export function getRelativePath(from: string, to: string): string {
  return relative(from, to).replace(/\\/g, '/');
}

/**
 * Resolve absolute path
 */
export function resolvePath(...paths: string[]): string {
  return resolve(...paths);
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    const err = error as Error;
    debugError('fsx', 'fileExists', {
      filePath,
      message: err.message,
    });
    return false;
  }
}

/**
 * Get sidecar path for a source file
 */
export function getSidecarPath(sourcePath: string, outRoot: string): string {
  // If sourcePath is absolute, place sidecar next to source file
  // This matches the behavior of writeSidecar()
  if (isAbsolute(sourcePath)) {
    return `${sourcePath}.uif.json`;
  }
  // Otherwise, resolve relative path from outRoot
  return join(outRoot, `${sourcePath}.uif.json`);
}

/**
 * Normalize a file path for cross-platform consistency
 * This is the canonical path normalization used throughout the codebase.
 * Rules:
 * - Convert backslashes to forward slashes (POSIX-style)
 * - Use Node's normalize() to resolve .. and . segments
 * - On Windows: preserve drive letter but normalize case
 * - Remove leading ./ if present
 * - Result should match manifest keys exactly
 * 
 * This function is the single source of truth for path normalization.
 * All entryId fields in contracts and manifest keys use this normalization.
 */
export function normalizeEntryId(entryId: string): string {
  const normalized = normalize(entryId).replace(/\\/g, '/');
  // On Windows, normalize drive letter to lowercase for consistency
  // This ensures manifest keys match across different input formats
  let result = normalized.replace(/^([A-Z]):/, (_, drive) => `${drive.toLowerCase()}:`);
  // Remove leading ./ if present
  result = result.replace(/^\.\//, '');
  return result;
}

/**
 * Get the folder path for a given file (parent directory)
 * Returns normalized folder path
 */
export function getFolderPath(filePath: string): string {
  const normalized = normalizeEntryId(filePath);
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) return '.';
  return normalized.substring(0, lastSlash);
}

/**
 * Group files by their containing folder
 * Returns a Map of folderPath -> array of file paths
 */
export function groupFilesByFolder(files: string[]): Map<string, string[]> {
  const folderMap = new Map<string, string[]>();

  for (const file of files) {
    const folderPath = getFolderPath(file);

    if (!folderMap.has(folderPath)) {
      folderMap.set(folderPath, []);
    }

    folderMap.get(folderPath)!.push(file);
  }

  return folderMap;
}
