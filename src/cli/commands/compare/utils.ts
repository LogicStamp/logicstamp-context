/**
 * Utility functions for compare command
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LogicStampBundle, LogicStampIndex } from '../../../core/pack.js';
import {
  estimateGPT4Tokens,
  estimateClaudeTokens,
} from '../../../utils/tokens.js';
import { debugError } from '../../../utils/debug.js';

/**
 * Calculate token count for bundles
 */
export async function calculateTokens(
  bundles: LogicStampBundle[],
): Promise<{ gpt4: number; claude: number }> {
  const text = JSON.stringify(bundles);
  return {
    gpt4: await estimateGPT4Tokens(text),
    claude: await estimateClaudeTokens(text),
  };
}

/**
 * Load LogicStampIndex from file
 */
export async function loadIndex(indexPath: string): Promise<LogicStampIndex> {
  let content: string;

  try {
    content = await readFile(indexPath, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('compare', 'loadIndex', {
      indexPath,
      message: err.message,
      code: err.code,
    });
    throw new Error(
      `Failed to load index from ${indexPath}: ${err.code === 'ENOENT' ? 'File not found' : err.message}`,
    );
  }

  try {
    const index = JSON.parse(content) as LogicStampIndex;

    if (index.type !== 'LogicStampIndex') {
      throw new Error(
        `Invalid index file: expected type 'LogicStampIndex', got '${index.type}'`,
      );
    }

    // Backward compatibility: warn about old schema version
    if (index.schemaVersion === '0.1') {
      console.warn(
        `⚠️  Warning: context_main.json uses schema version 0.1 (legacy format).`,
      );
      console.warn(``);
      console.warn(
        `   Consider recompiling with "stamp context" to upgrade to version 0.2 (relative paths).`,
      );
      console.warn(``);
      console.warn(`   Optional cleanup: "stamp context clean --all --yes".`);
      console.warn(``);
      console.warn(`   See docs/MIGRATION_0.3.2.md for details.\n`);
    } else if (index.schemaVersion !== '0.2') {
      console.warn(
        `⚠️  Warning: Unknown schema version "${index.schemaVersion}". Expected '0.1' or '0.2'.`,
      );
    }

    return index;
  } catch (error) {
    const err = error as Error;
    debugError('compare', 'loadIndex', {
      indexPath,
      message: err.message,
    });
    throw new Error(`Failed to load index from ${indexPath}: ${err.message}`);
  }
}

/**
 * Discover orphaned context files on disk that are not in the new index
 */
export async function findOrphanedFiles(
  oldIndex: LogicStampIndex,
  newIndex: LogicStampIndex,
  baseDir: string,
): Promise<string[]> {
  const orphaned: string[] = [];
  const newContextFiles = new Set(newIndex.folders.map((f) => f.contextFile));

  // Check each old folder's context file
  for (const folder of oldIndex.folders) {
    if (!newContextFiles.has(folder.contextFile)) {
      // Check if file still exists on disk
      const contextPath = join(baseDir, folder.contextFile);
      try {
        await readFile(contextPath, 'utf8');
        orphaned.push(folder.contextFile);
      } catch (error) {
        // File doesn't exist, not orphaned (already deleted)
        const err = error as NodeJS.ErrnoException;
        if (err.code !== 'ENOENT') {
          debugError('compare', 'findOrphanedFiles', {
            contextPath,
            message: err.message,
            code: err.code,
          });
        }
      }
    }
  }

  return orphaned;
}
