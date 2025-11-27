/**
 * Clean command - Removes all generated context artifacts
 * Deletes context_main.json, all folder context.json files, and optionally .logicstamp/ cache
 */

import { glob } from 'glob';
import { unlink, rm, stat } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { fileExists } from '../../utils/fsx.js';

export interface CleanOptions {
  projectRoot?: string;
  all?: boolean;
  yes?: boolean;
  quiet?: boolean;
}

/**
 * Normalize path for display (convert backslashes to forward slashes)
 */
function displayPath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Find all context.json files in the project
 */
async function findContextFiles(projectRoot: string): Promise<string[]> {
  const contextFiles = await glob('**/context.json', {
    cwd: projectRoot,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
  });

  return contextFiles.sort();
}

/**
 * Find context_main.json in the project root
 */
async function findMainContextFile(projectRoot: string): Promise<string | null> {
  const mainContextPath = join(projectRoot, 'context_main.json');
  if (await fileExists(mainContextPath)) {
    return mainContextPath;
  }
  return null;
}

/**
 * Find .logicstamp directory
 */
async function findLogicStampDir(projectRoot: string): Promise<string | null> {
  const logicStampPath = join(projectRoot, '.logicstamp');
  try {
    const stats = await stat(logicStampPath);
    if (stats.isDirectory()) {
      return logicStampPath;
    }
  } catch {
    // Directory doesn't exist
  }
  return null;
}

/**
 * Clean command - removes all generated context artifacts
 */
export async function cleanCommand(options: CleanOptions): Promise<void> {
  const projectRoot = resolve(options.projectRoot || '.');

  // Find all files to remove
  const contextFiles = await findContextFiles(projectRoot);
  const mainContextFile = await findMainContextFile(projectRoot);
  const logicStampDir = await findLogicStampDir(projectRoot);

  // Collect all files to remove
  const filesToRemove: string[] = [];
  if (mainContextFile) {
    filesToRemove.push(mainContextFile);
  }
  filesToRemove.push(...contextFiles);

  // If no files found, exit early
  if (filesToRemove.length === 0 && !logicStampDir) {
    if (options.quiet) {
      process.stdout.write('✓\n');
    } else {
      console.log('✅ No context artifacts found to clean');
    }
    return;
  }

  // Display what will be removed
  if (!options.quiet) {
    console.log('\n🧹 This will remove:');
    if (mainContextFile) {
      const relPath = relative(projectRoot, mainContextFile);
      console.log(`  - ${displayPath(relPath === 'context_main.json' ? 'context_main.json' : relPath)}`);
    }
    for (const file of contextFiles) {
      const relPath = relative(projectRoot, file);
      console.log(`  - ${displayPath(relPath)}`);
    }
    if (logicStampDir) {
      const relPath = relative(projectRoot, logicStampDir);
      console.log(`  - ${displayPath(relPath)}/`);
    }
  }

  // If --all and --yes flags are provided, proceed with deletion
  if (options.all && options.yes) {
    if (!options.quiet) {
      console.log('\n🗑️  Removing files...\n');
    }

    // Delete all context.json files
    for (const file of filesToRemove) {
      try {
        await unlink(file);
        if (!options.quiet) {
          const relPath = relative(projectRoot, file);
          console.log(`   ✓ Removed ${displayPath(relPath)}`);
        }
      } catch (error) {
        // Always show errors
        const relPath = relative(projectRoot, file);
        console.error(`   ✗ Failed to remove ${displayPath(relPath)}: ${(error as Error).message}`);
      }
    }

    // Delete .logicstamp directory if it exists
    if (logicStampDir) {
      try {
        await rm(logicStampDir, { recursive: true, force: true });
        if (!options.quiet) {
          const relPath = relative(projectRoot, logicStampDir);
          console.log(`   ✓ Removed ${displayPath(relPath)}/`);
        }
      } catch (error) {
        // Always show errors
        const relPath = relative(projectRoot, logicStampDir);
        console.error(`   ✗ Failed to remove ${displayPath(relPath)}/: ${(error as Error).message}`);
      }
    }

    if (options.quiet) {
      process.stdout.write('✓\n');
    } else {
      console.log(`\n✅ Cleaned ${filesToRemove.length} file(s)${logicStampDir ? ' and 1 directory' : ''}`);
    }
  } else {
    // Dry run mode - just show what would be removed
    if (!options.quiet) {
      console.log('\n💡 Run with --all --yes to confirm and delete these files.');
    }
  }
}

