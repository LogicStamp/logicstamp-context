/**
 * Handler for context compare command
 */

import { contextCommand, type ContextOptions } from '../commands/context.js';
import {
  compareCommand,
  type CompareOptions,
  multiFileCompare,
  type MultiFileCompareOptions,
  displayMultiFileCompareResult,
  cleanOrphanedFiles,
} from '../commands/compare/index.js';
import { parseCompareArgs, getCompareHelp } from '../parser/index.js';
import { printFoxIcon } from './initHandler.js';
import { debugLog, debugError } from '../../utils/debug.js';
import {
  parseGitBaseline,
  isGitRepo,
  resolveGitRef,
  describeGitRef,
  createWorktree,
  removeWorktree,
  createBaselinePaths,
  cleanupBaselinePaths,
  type GitBaselinePaths,
} from '../../utils/git.js';

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
    return process.exit(0);
  }

  // Explicitly reject --compare-modes (only available in stamp context, not stamp context compare)
  if (args.includes('--compare-modes')) {
    console.error('❌ --compare-modes is not available for "stamp context compare". Use "stamp context --compare-modes" instead.');
    return process.exit(1);
  }

  const { stats, approve, cleanOrphaned, quiet, skipGitignore, baseline, positionalArgs } = parseCompareArgs(args);

  // Git baseline mode: --baseline git:<ref>
  if (baseline) {
    const gitBaseline = parseGitBaseline(baseline);
    if (!gitBaseline) {
      console.error(`❌ Invalid baseline format: "${baseline}". Expected format: git:<ref> (e.g., git:main, git:HEAD)`);
      return process.exit(1);
    }
    await handleGitBaselineCompare({
      ref: gitBaseline.ref,
      stats,
      approve,
      quiet,
      skipGitignore,
    });
    return;
  }

  // Auto-mode: no files specified - use multi-file comparison with context_main.json
  if (positionalArgs.length === 0) {
    await handleAutoCompareMode({ stats, approve, cleanOrphaned, quiet, skipGitignore });
    return;
  }

  // Manual mode: explicit files provided
  if (positionalArgs.length < 2) {
    printFoxIcon();
    console.log(getCompareHelp());
    return process.exit(1);
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
    console.error('❌ context_main.json not found. Run "stamp context" first to compile context files.');
    return process.exit(1);
  }

  if (!quiet) {
    console.log('Auto-compare mode');
  }

  // Create temp directory for new context compilation
  const tempDir = join(tmpdir(), `context-compare-${Date.now()}`);
  try {
    await mkdir(tempDir, { recursive: true });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('compareHandler', 'handleAutoCompareMode', {
      tempDir,
      operation: 'mkdir',
      message: err.message,
      code: err.code,
    });
    throw new Error(`Failed to create temp directory "${tempDir}": ${err.code === 'EACCES' ? 'Permission denied' : err.message}`);
  }

  if (!quiet) {
    console.log('🔄 Compiling fresh context...');
  }

  // Compile fresh context to temp directory
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
        let newIndexContent: string;
        const indexPath = join(tempDir, 'context_main.json');
        
        try {
          newIndexContent = await readFile(indexPath, 'utf8');
        } catch (error) {
          const err = error as NodeJS.ErrnoException;
          debugError('compareHandler', 'handleAutoCompareMode', {
            indexPath,
            operation: 'readFile',
            message: err.message,
            code: err.code,
          });
          throw new Error(`Failed to read index file "${indexPath}": ${err.code === 'ENOENT' ? 'File not found' : err.message}`);
        }
        
        let newIndex: any;
        try {
          newIndex = JSON.parse(newIndexContent);
        } catch (error) {
          const err = error as Error;
          debugError('compareHandler', 'handleAutoCompareMode', {
            indexPath,
            operation: 'JSON.parse',
            message: err.message,
          });
          throw new Error(`Failed to parse index file "${indexPath}": ${err.message}`);
        }

        let copiedFiles = 0;
        for (const folder of newIndex.folders) {
          const srcPath = join(tempDir, folder.contextFile);
          const destPath = folder.contextFile;

          // Create parent directory if needed
          try {
            await mkdir(dirname(destPath), { recursive: true });
          } catch (error) {
            const err = error as NodeJS.ErrnoException;
            debugError('compareHandler', 'handleAutoCompareMode', {
              destPath,
              operation: 'mkdir',
              message: err.message,
              code: err.code,
            });
            throw new Error(`Failed to create directory for "${destPath}": ${err.code === 'EACCES' ? 'Permission denied' : err.message}`);
          }
          
          try {
            await copyFile(srcPath, destPath);
          } catch (error) {
            const err = error as NodeJS.ErrnoException;
            debugError('compareHandler', 'handleAutoCompareMode', {
              srcPath,
              destPath,
              operation: 'copyFile',
              message: err.message,
              code: err.code,
            });
            throw new Error(`Failed to copy file from "${srcPath}" to "${destPath}": ${err.message}`);
          }
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
        return process.exit(0); // Success: drift approved and updated
      } else {
        // Clean up temp directory
        await rm(tempDir, { recursive: true, force: true });
        if (isTTY() && !approve) {
          console.log('❌ Update declined\n');
        }
        return process.exit(1); // Drift detected but not approved
      }
    } else {
      // No drift - clean up and exit success
      await rm(tempDir, { recursive: true, force: true });
      return process.exit(0);
    }
  } catch (error) {
    // Try to clean up temp directory even on error
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      // Log cleanup failures (non-fatal but useful for debugging)
      debugError('compareHandler', 'handleAutoCompareMode', {
        tempDir,
        operation: 'cleanup',
        message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }

    console.error('❌ Compare failed:', (error as Error).message);
    return process.exit(1);
  }
}

/**
 * Handle git baseline comparison mode
 * Compares current working tree against a git ref (branch, tag, commit)
 */
async function handleGitBaselineCompare(options: {
  ref: string;
  stats: boolean;
  approve: boolean;
  quiet: boolean;
  skipGitignore: boolean;
}): Promise<void> {
  const { ref, stats, approve, quiet, skipGitignore } = options;
  const { join } = await import('node:path');
  const { rm } = await import('node:fs/promises');

  // Validate git repository
  if (!(await isGitRepo())) {
    console.error('❌ Not a git repository. Git baseline comparison requires a git repository.');
    return process.exit(1);
  }

  // Resolve and describe the git ref
  let commitHash: string;
  let refDescription: string;
  try {
    commitHash = await resolveGitRef(ref);
    refDescription = await describeGitRef(ref);
  } catch (error) {
    console.error(`❌ ${(error as Error).message}`);
    return process.exit(1);
  }

  if (!quiet) {
    console.log(`Git baseline comparison`);
    console.log(`  Baseline: ${refDescription} (${commitHash.substring(0, 8)})`);
    console.log(`  Current:  working tree\n`);
  }

  // Create directory structure
  let paths: GitBaselinePaths;
  try {
    paths = await createBaselinePaths(process.cwd(), ref);
  } catch (error) {
    console.error(`❌ Failed to create comparison directories: ${(error as Error).message}`);
    return process.exit(1);
  }

  debugLog('compareHandler', 'Git baseline paths', { ...paths });

  try {
    // Step 1: Create git worktree at the baseline ref
    if (!quiet) {
      console.log(`🔄 Creating worktree at ${refDescription}...`);
    }

    const worktree = await createWorktree(ref, paths.worktreeDir);

    // Step 2: Generate context for baseline (from worktree)
    if (!quiet) {
      console.log(`🔄 Generating baseline context...`);
    }

    // Read .stampignore from working directory for symmetric comparison
    // Both baseline and current should use the same .stampignore source
    const workingDir = process.cwd();
    const baselineContextOptions: ContextOptions = {
      depth: 1,
      includeCode: 'header',
      format: 'json',
      out: paths.baselineDir,
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
      skipGitignore: true, // Always skip in worktree
      quiet: true, // Suppress output during generation
      suppressSuccessIndicator: true,
      entry: paths.worktreeDir, // Generate from worktree
      stampignorePath: workingDir, // Use working directory's .stampignore for symmetric comparison
    };

    await contextCommand(baselineContextOptions);

    // Step 3: Generate context for current working tree
    if (!quiet) {
      console.log(`🔄 Generating current context...`);
    }

    const currentContextOptions: ContextOptions = {
      depth: 1,
      includeCode: 'header',
      format: 'json',
      out: paths.currentDir,
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
      skipGitignore: true, // Always skip in git baseline mode for symmetric comparison
      quiet: true, // Suppress output during generation
      suppressSuccessIndicator: true,
      stampignorePath: workingDir, // Use working directory's .stampignore for symmetric comparison
    };

    await contextCommand(currentContextOptions);

    // Step 4: Compare baseline vs current
    if (!quiet) {
      console.log(`🔍 Comparing baseline vs current...\n`);
    }

    const multiCompareOptions: MultiFileCompareOptions = {
      oldIndexFile: join(paths.baselineDir, 'context_main.json'),
      newIndexFile: join(paths.currentDir, 'context_main.json'),
      stats,
      approve,
      autoCleanOrphaned: false, // Don't clean orphaned in git baseline mode
      quiet,
      gitBaseline: true, // Enable path normalization for git baseline comparisons
    };

    const result = await multiFileCompare(multiCompareOptions);
    displayMultiFileCompareResult(result, stats, quiet);

    // Step 5: Clean up
    await cleanupBaselinePaths(paths);

    // Git baseline mode is read-only - no approval/update workflow
    // Just report drift status
    if (result.status === 'DRIFT') {
      if (!quiet) {
        console.log(`\n📊 Summary: Changes detected compared to ${refDescription}`);
      }
      return process.exit(1); // Exit 1 for drift (useful for CI)
    } else {
      if (!quiet) {
        console.log(`\n✅ No changes detected compared to ${refDescription}`);
      }
      return process.exit(0);
    }
  } catch (error) {
    // Clean up on error
    try {
      await cleanupBaselinePaths(paths);
    } catch (cleanupError) {
      debugError('compareHandler', 'handleGitBaselineCompare', {
        operation: 'cleanup',
        message: (cleanupError as Error).message,
      });
    }

    console.error(`❌ Git baseline comparison failed: ${(error as Error).message}`);
    return process.exit(1);
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
        
        let newIndexContent: string;
        try {
          newIndexContent = await readFile(newFile, 'utf8');
        } catch (error) {
          const err = error as NodeJS.ErrnoException;
          debugError('compareHandler', 'handleMultiFileCompareMode', {
            newFile,
            operation: 'readFile',
            message: err.message,
            code: err.code,
          });
          throw new Error(`Failed to read index file "${newFile}": ${err.code === 'ENOENT' ? 'File not found' : err.message}`);
        }
        
        let newIndex: any;
        try {
          newIndex = JSON.parse(newIndexContent);
        } catch (error) {
          const err = error as Error;
          debugError('compareHandler', 'handleMultiFileCompareMode', {
            newFile,
            operation: 'JSON.parse',
            message: err.message,
          });
          throw new Error(`Failed to parse index file "${newFile}": ${err.message}`);
        }

        const baseDir = dirname(oldFile);
        let copiedFiles = 0;

        for (const folder of newIndex.folders) {
          const srcPath = join(dirname(newFile), folder.contextFile);
          const destPath = join(baseDir, folder.contextFile);

          // Create parent directory if needed
          try {
            await mkdir(dirname(destPath), { recursive: true });
          } catch (error) {
            const err = error as NodeJS.ErrnoException;
            debugError('compareHandler', 'handleMultiFileCompareMode', {
              destPath,
              operation: 'mkdir',
              message: err.message,
              code: err.code,
            });
            throw new Error(`Failed to create directory for "${destPath}": ${err.code === 'EACCES' ? 'Permission denied' : err.message}`);
          }
          
          try {
            await copyFile(srcPath, destPath);
          } catch (error) {
            const err = error as NodeJS.ErrnoException;
            debugError('compareHandler', 'handleMultiFileCompareMode', {
              srcPath,
              destPath,
              operation: 'copyFile',
              message: err.message,
              code: err.code,
            });
            throw new Error(`Failed to copy file from "${srcPath}" to "${destPath}": ${err.message}`);
          }
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
        return process.exit(0); // Success: drift approved and updated
      } else {
        if (isTTY() && !approve) {
          console.log('❌ Update declined\n');
        }
        return process.exit(1); // Drift detected but not approved
      }
    } else {
      // No drift
      return process.exit(0);
    }
  } catch (error) {
    console.error('❌ Compare failed:', (error as Error).message);
    return process.exit(1);
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
        return process.exit(0); // Success: drift approved and updated
      } else {
        if (isTTY() && !approve) {
          console.log('❌ Update declined\n');
        }
        return process.exit(1); // Drift detected but not approved
      }
    } else {
      // No drift
      return process.exit(0);
    }
  } catch (error) {
    console.error('❌ Compare failed:', (error as Error).message);
    return process.exit(1);
  }
}

