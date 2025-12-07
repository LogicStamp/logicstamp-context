/**
 * Ignore command - Add files or folders to .stampignore
 */

import { resolve, isAbsolute } from 'node:path';
import { addToStampignore, readStampignore } from '../../utils/stampignore.js';
import { normalizeEntryId, getRelativePath } from '../../utils/fsx.js';

export interface IgnoreOptions {
  /** Target directory (default: current directory) */
  targetDir?: string;
  /** Paths to add to .stampignore */
  paths: string[];
  /** Suppress verbose output */
  quiet?: boolean;
}

/**
 * Add files or folders to .stampignore
 */
export async function ignoreCommand(options: IgnoreOptions): Promise<void> {
  const targetDir = resolve(options.targetDir || process.cwd());

  if (options.paths.length === 0) {
    throw new Error('No paths provided. Usage: stamp ignore <path1> [path2] ...');
  }

  // Read current config to determine which paths are new (for better feedback)
  const currentConfig = await readStampignore(targetDir);
  const currentIgnore = currentConfig?.ignore || [];
  const normalizedCurrent = currentIgnore.map(p => normalizeEntryId(p));

  // Convert absolute paths to relative before processing
  const relativePaths = options.paths.map(p => {
    if (isAbsolute(p)) {
      return getRelativePath(targetDir, p);
    }
    return p;
  });

  // Normalize paths to add and filter out duplicates
  const normalizedToAdd = relativePaths
    .map(p => normalizeEntryId(p))
    .filter(p => !normalizedCurrent.includes(p));

  if (normalizedToAdd.length === 0) {
    if (!options.quiet) {
      console.log('ℹ️  All specified paths are already in .stampignore');
    }
    return;
  }

  const { added, created } = await addToStampignore(targetDir, relativePaths);

  if (!added) {
    // This shouldn't happen, but handle it anyway
    if (!options.quiet) {
      console.log('ℹ️  All specified paths are already in .stampignore');
    }
    return;
  }

  if (created) {
    if (!options.quiet) {
      console.log(`✅ Created .stampignore and added ${normalizedToAdd.length} path(s)`);
    }
  } else {
    if (!options.quiet) {
      console.log(`✅ Added ${normalizedToAdd.length} path(s) to .stampignore`);
    }
  }

  if (!options.quiet && normalizedToAdd.length > 0) {
    console.log(`   Added paths:`);
    normalizedToAdd.forEach(path => {
      console.log(`   - ${path}`);
    });
  }
}

