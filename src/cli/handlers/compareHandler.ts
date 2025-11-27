/**
 * Handler for compare command
 */

import { contextCommand, type ContextOptions } from '../commands/context.js';
import {
  compareCommand,
  type CompareOptions,
  multiFileCompare,
  type MultiFileCompareOptions,
  displayMultiFileCompareResult,
  cleanOrphanedFiles,
} from '../commands/compare.js';
import { parseCompareArgs } from '../parser/argumentParser.js';
import { getCompareHelp } from '../parser/helpText.js';
import { printFoxIcon } from './initHandler.js';

/**
 * Prompt user for Y/N input (only in TTY mode)
 */
async function promptYesNo(question: string): Promise<boolean> {
  const { createInterface } = await import('node:readline');
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    readline.question(question, (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Check if running in interactive TTY
 */
function isTTY(): boolean {
  return process.stdout.isTTY === true && process.stdin.isTTY === true;
}

export async function handleCompare(args: string[]): Promise<void> {
  if (args[0] === '--help' || args[0] === '-h') {
    printFoxIcon();
    console.log(getCompareHelp());
    process.exit(0);
  }

  // Explicitly reject --compare-modes (only available in stamp context, not stamp context compare)
  if (args.includes('--compare-modes')) {
    console.error('❌ --compare-modes is not available for "stamp context compare". Use "stamp context --compare-modes" instead.');
    process.exit(1);
  }

  const { stats, approve, cleanOrphaned, quiet, skipGitignore, positionalArgs } = parseCompareArgs(args);

  // Auto-mode: no files specified - use multi-file comparison with context_main.json
  if (positionalArgs.length === 0) {
    await handleAutoCompareMode({ stats, approve, cleanOrphaned, quiet, skipGitignore });
    return;
  }

  // Manual mode: explicit files provided
  if (positionalArgs.length < 2) {
    printFoxIcon();
    console.log(getCompareHelp());
    process.exit(1);
  }

  const oldFile = positionalArgs[0];
  const newFile = positionalArgs[1];

  // Detect if we're comparing context_main.json files (multi-file mode)
  const isMultiFileMode = oldFile.endsWith('context_main.json') || newFile.endsWith('context_main.json');

  if (isMultiFileMode) {
    await handleMultiFileCompareMode({ oldFile, newFile, stats, approve, cleanOrphaned, quiet });
  } else {
    await handleSingleFileCompareMode({ oldFile, newFile, stats, approve, quiet });
  }
}

async function handleAutoCompareMode(options: {
  stats: boolean;
  approve: boolean;
  cleanOrphaned: boolean;
  quiet: boolean;
  skipGitignore: boolean;
}): Promise<void> {
  const { stats, approve, cleanOrphaned, quiet, skipGitignore } = options;
  const { tmpdir } = await import('node:os');
  const { join, dirname } = await import('node:path');
  const { copyFile, rm, mkdir } = await import('node:fs/promises');
  const { existsSync } = await import('node:fs');

  // Check if context_main.json exists
  if (!existsSync('context_main.json')) {
    console.error('❌ context_main.json not found. Run "stamp context" first to generate context files.');
    process.exit(1);
  }

  if (!quiet) {
    console.log('Auto-compare mode');
  }

  // Create temp directory for new context generation
  const tempDir = join(tmpdir(), `context-compare-${Date.now()}`);
  await mkdir(tempDir, { recursive: true });

  if (!quiet) {
    console.log('🔄 Generating fresh context...');
  }

  // Generate fresh context to temp directory
  const contextOptions: ContextOptions = {
    depth: 1,
    includeCode: 'header',
    format: 'json',
    out: tempDir,
    hashLock: false,
    strict: false,
    allowMissing: true,
    maxNodes: 100,
    profile: 'llm-chat',
    predictBehavior: false,
    dryRun: false,
    stats: false,
    strictMissing: false,
    compareModes: false,
    skipGitignore,
    quiet,
    suppressSuccessIndicator: true, // Suppress ✓ when called internally from compare
  };

  try {
    await contextCommand(contextOptions);

    // Multi-file compare using context_main.json indices
    if (!quiet) {
      console.log('🔍 Comparing all context files...\n');
    }
    const multiCompareOptions: MultiFileCompareOptions = {
      oldIndexFile: 'context_main.json',
      newIndexFile: join(tempDir, 'context_main.json'),
      stats,
      approve,
      autoCleanOrphaned: cleanOrphaned,
      quiet,
    };

    const result = await multiFileCompare(multiCompareOptions);
    displayMultiFileCompareResult(result, stats, quiet);

    // Handle drift approval
    if (result.status === 'DRIFT') {
      let shouldUpdate = false;

      if (approve) {
        // --approve flag: non-interactive, deterministic
        shouldUpdate = true;
        console.log('🔄 --approve flag set, updating all context files...');
      } else if (isTTY()) {
        // Interactive prompt (local dev convenience)
        shouldUpdate = await promptYesNo('Update all context files? (y/N) ');
      }

      if (shouldUpdate) {
        // Copy all new context files to current directory
        const { readFile } = await import('node:fs/promises');
        const newIndexContent = await readFile(join(tempDir, 'context_main.json'), 'utf8');
        const newIndex = JSON.parse(newIndexContent);

        let copiedFiles = 0;
        for (const folder of newIndex.folders) {
          const srcPath = join(tempDir, folder.contextFile);
          const destPath = folder.contextFile;

          // Create parent directory if needed
          await mkdir(dirname(destPath), { recursive: true });
          await copyFile(srcPath, destPath);
          copiedFiles++;
          if (!quiet) {
            console.log(`   ✓ Updated ${destPath}`);
          }
        }

        // Copy context_main.json
        await copyFile(join(tempDir, 'context_main.json'), 'context_main.json');
        if (!quiet) {
          console.log(`   ✓ Updated context_main.json`);
        }

        // Clean up orphaned files if requested
        if (cleanOrphaned && result.orphanedFiles && result.orphanedFiles.length > 0) {
          if (!quiet) {
            console.log('\n🗑️  Cleaning up orphaned files...');
          }
          const deletedCount = await cleanOrphanedFiles(result.orphanedFiles, '.', quiet);
          if (!quiet) {
            console.log(`   ✓ Deleted ${deletedCount} orphaned file(s)`);
          }
        }

        if (!quiet) {
          console.log(`\n✅ ${copiedFiles + 1} context files updated successfully`);
        }

        // Clean up temp directory
        await rm(tempDir, { recursive: true, force: true });
        process.exit(0); // Success: drift approved and updated
      } else {
        // Clean up temp directory
        await rm(tempDir, { recursive: true, force: true });
        if (isTTY() && !approve) {
          console.log('❌ Update declined\n');
        }
        process.exit(1); // Drift detected but not approved
      }
    } else {
      // No drift - clean up and exit success
      await rm(tempDir, { recursive: true, force: true });
      process.exit(0);
    }
  } catch (error) {
    // Try to clean up temp directory even on error
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {}

    console.error('❌ Compare failed:', (error as Error).message);
    process.exit(1);
  }
}

async function handleMultiFileCompareMode(options: {
  oldFile: string;
  newFile: string;
  stats: boolean;
  approve: boolean;
  cleanOrphaned: boolean;
  quiet: boolean;
}): Promise<void> {
  const { oldFile, newFile, stats, approve, cleanOrphaned, quiet } = options;

  // Multi-file comparison mode
  const multiCompareOptions: MultiFileCompareOptions = {
    oldIndexFile: oldFile,
    newIndexFile: newFile,
    stats,
    approve,
    autoCleanOrphaned: cleanOrphaned,
    quiet,
  };

  try {
    const result = await multiFileCompare(multiCompareOptions);
    displayMultiFileCompareResult(result, stats, quiet);

    // Handle drift approval in manual mode
    if (result.status === 'DRIFT') {
      let shouldUpdate = false;

      if (approve) {
        // --approve flag: non-interactive, deterministic
        shouldUpdate = true;
        if (!quiet) {
          console.log('🔄 --approve flag set, updating all context files...');
        }
      } else if (isTTY()) {
        // Interactive prompt (local dev convenience)
        shouldUpdate = await promptYesNo('Update all context files? (y/N) ');
      }

      if (shouldUpdate) {
        // Copy all new context files
        const { readFile, copyFile, mkdir } = await import('node:fs/promises');
        const { dirname, join } = await import('node:path');
        const newIndexContent = await readFile(newFile, 'utf8');
        const newIndex = JSON.parse(newIndexContent);

        const baseDir = dirname(oldFile);
        let copiedFiles = 0;

        for (const folder of newIndex.folders) {
          const srcPath = join(dirname(newFile), folder.contextFile);
          const destPath = join(baseDir, folder.contextFile);

          // Create parent directory if needed
          await mkdir(dirname(destPath), { recursive: true });
          await copyFile(srcPath, destPath);
          copiedFiles++;
          if (!quiet) {
            console.log(`   ✓ Updated ${folder.contextFile}`);
          }
        }

        // Copy context_main.json
        await copyFile(newFile, oldFile);
        if (!quiet) {
          console.log(`   ✓ Updated ${oldFile}`);
        }

        // Clean up orphaned files if requested
        if (cleanOrphaned && result.orphanedFiles && result.orphanedFiles.length > 0) {
          if (!quiet) {
            console.log('\n🗑️  Cleaning up orphaned files...');
          }
          const deletedCount = await cleanOrphanedFiles(result.orphanedFiles, baseDir, quiet);
          if (!quiet) {
            console.log(`   ✓ Deleted ${deletedCount} orphaned file(s)`);
          }
        }

        if (!quiet) {
          console.log(`\n✅ ${copiedFiles + 1} context files updated successfully`);
        }
        process.exit(0); // Success: drift approved and updated
      } else {
        if (isTTY() && !approve) {
          console.log('❌ Update declined\n');
        }
        process.exit(1); // Drift detected but not approved
      }
    } else {
      // No drift
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Compare failed:', (error as Error).message);
    process.exit(1);
  }
}

async function handleSingleFileCompareMode(options: {
  oldFile: string;
  newFile: string;
  stats: boolean;
  approve: boolean;
  quiet: boolean;
}): Promise<void> {
  const { oldFile, newFile, stats, approve, quiet } = options;

  // Single-file comparison mode (backward compatible)
  const compareOptions: CompareOptions = {
    oldFile,
    newFile,
    stats,
    approve,
    quiet,
  };

  try {
    const result = await compareCommand(compareOptions);

    // Handle drift approval in manual mode
    if (result.status === 'DRIFT') {
      let shouldUpdate = false;

      if (approve) {
        // --approve flag: non-interactive, deterministic
        shouldUpdate = true;
        if (!quiet) {
          console.log(`🔄 --approve flag set, updating ${oldFile}...`);
        }
      } else if (isTTY()) {
        // Interactive prompt (local dev convenience)
        shouldUpdate = await promptYesNo(`Update ${oldFile} with ${newFile}? (y/N) `);
      }

      if (shouldUpdate) {
        const { copyFile } = await import('node:fs/promises');
        await copyFile(newFile, oldFile);
        if (!quiet) {
          console.log(`✅ ${oldFile} updated successfully\n`);
        }
        process.exit(0); // Success: drift approved and updated
      } else {
        if (isTTY() && !approve) {
          console.log('❌ Update declined\n');
        }
        process.exit(1); // Drift detected but not approved
      }
    } else {
      // No drift
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Compare failed:', (error as Error).message);
    process.exit(1);
  }
}

