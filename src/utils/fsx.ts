/**
 * @uif Contract 0.3
 *
 * Description: fsx - Presentational component
 *
 * Version (Component Composition):
 *   variables: []
 *   hooks: []
 *   components: []
 *   functions: ["deleteSidecar","fileExists","findSidecarFiles","getRelativePath","getSidecarPath","globFiles","isPathWithinRoot","normalizeEntryId","readFileWithText","resolvePath"]
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

import { readFile, stat, unlink } from 'node:fs/promises';
import { isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { glob } from 'glob';
import { debugError } from './debug.js';

export interface FileWithText {
  path: string;
  text: string;
}

/**
 * Find files matching glob patterns
 *
 * Resilient behavior:
 * - Processes all patterns even if some fail
 * - Returns partial results from successful patterns
 * - Only throws if ALL patterns fail
 * - Logs warnings for partial failures (via debugError)
 */
export async function globFiles(
  searchPath: string,
  extensions: string = '.tsx,.ts',
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
  const errors: { pattern: string; message: string }[] = [];

  for (const pattern of patterns) {
    try {
      const matches = await glob(pattern, {
        cwd: searchPath,
        absolute: false,
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

      // Convert to relative paths (normalize for consistency)
      const relativeMatches = matches.map((match) => normalizeEntryId(match));
      files.push(...relativeMatches);
    } catch (error) {
      const err = error as Error;
      errors.push({ pattern, message: err.message });
      debugError('fsx', 'globFiles pattern failed', {
        pattern,
        searchPath,
        message: err.message,
      });
      // Continue with remaining patterns instead of throwing immediately
    }
  }

  // If ALL patterns failed, throw an aggregate error
  if (errors.length === patterns.length) {
    const errorMessages = errors.map(
      (e) => `Pattern "${e.pattern}": ${e.message}`,
    );
    const aggregateMessage = `All glob patterns failed in "${searchPath}":\n  - ${errorMessages.join('\n  - ')}`;
    debugError('fsx', 'globFiles all patterns failed', {
      searchPath,
      extensions,
      patternCount: patterns.length,
      errors,
    });
    throw new Error(aggregateMessage);
  }

  // If some patterns failed but others succeeded, log a warning
  if (errors.length > 0) {
    debugError('fsx', 'globFiles partial failure', {
      searchPath,
      extensions,
      successCount: patterns.length - errors.length,
      failCount: errors.length,
      failedPatterns: errors.map((e) => e.pattern),
    });
    // Continue with partial results - this is intentional resilient behavior
  }

  // Remove duplicates and sort
  return [...new Set(files)].sort();
}

/**
 * Read file and return path + content
 */
export async function readFileWithText(
  filePath: string,
): Promise<FileWithText> {
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
    const matches = await glob('**/*.uif.json', {
      cwd: searchPath,
      absolute: false,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    });
    // Convert to relative paths (normalize for consistency)
    return matches.map((match) => normalizeEntryId(match));
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
 * Convert backslashes to forward slashes for cross-platform path display.
 * Use this for simple display purposes. For entryId normalization, use normalizeEntryId.
 */
export function toForwardSlashes(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Get relative path from base directory
 */
export function getRelativePath(from: string, to: string): string {
  return toForwardSlashes(relative(from, to));
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
    const stats = await stat(filePath);
    return stats.isFile();
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
  const normalized = toForwardSlashes(normalize(entryId));
  // On Windows, normalize drive letter to lowercase for consistency
  // This ensures manifest keys match across different input formats
  let result = normalized.replace(
    /^([A-Z]):/,
    (_, drive) => `${drive.toLowerCase()}:`,
  );
  // Remove leading ./ if present
  result = result.replace(/^\.\//, '');
  return result;
}

/**
 * True if filePath resolves under rootPath (blocks `../` escapes from project-relative entryIds).
 */
export function isPathWithinRoot(filePath: string, rootPath: string): boolean {
  const resolvedPath = resolve(rootPath, filePath);
  const rel = relative(rootPath, resolvedPath);
  return !rel.startsWith('..') && !isAbsolute(rel);
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

    let filesInFolder = folderMap.get(folderPath);
    if (!filesInFolder) {
      filesInFolder = [];
      folderMap.set(folderPath, filesInFolder);
    }

    filesInFolder.push(file);
  }

  return folderMap;
}
