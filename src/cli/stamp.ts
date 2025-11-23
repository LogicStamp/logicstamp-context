#!/usr/bin/env node

/**
 * Stamp CLI - Main entry point for LogicStamp Context tools
 * Routes to context operations: generate, validate, compare
 */

import { contextCommand, type ContextOptions } from './commands/context.js';
import {
  compareCommand,
  type CompareOptions,
  multiFileCompare,
  type MultiFileCompareOptions,
  displayMultiFileCompareResult,
  cleanOrphanedFiles,
} from './commands/compare.js';
import { validateCommand } from './commands/validate.js';
import { init, type InitOptions } from './commands/init.js';
import { cleanCommand, type CleanOptions } from './commands/clean.js';

function printFoxIcon() {
  console.log(`
    /\\_/\\
   ( o.o )
    > ^ <
🦊 Meet the Logic Fox
`);
}

async function main() {
  const args = process.argv.slice(2);

  // Check for help - only if no args or first arg is help
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printFoxIcon();
    printMainHelp();
    process.exit(0);
  }

  // First argument should be the subcommand
  const subcommand = args[0];

  // Handle init command
  if (subcommand === 'init') {
    printFoxIcon();
    await handleInit(args.slice(1));
    return;
  }

  if (subcommand !== 'context') {
    console.error(`❌ Unknown command: ${subcommand}`);
    console.error('Run "stamp --help" for usage information');
    process.exit(1);
  }

  // Remove 'context' from args
  const contextArgs = args.slice(1);

  // Check for context operations
  if (contextArgs[0] === 'validate') {
    await handleValidate(contextArgs.slice(1));
    return;
  }

  if (contextArgs[0] === 'compare') {
    await handleCompare(contextArgs.slice(1));
    return;
  }

  if (contextArgs[0] === 'clean') {
    await handleClean(contextArgs.slice(1));
    return;
  }

  // Default: generate context
  await handleGenerate(contextArgs);
}

async function handleInit(args: string[]) {
  if (args.includes('--help') || args.includes('-h')) {
    printFoxIcon();
    printInitHelp();
    process.exit(0);
  }

  const options: InitOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '');

      switch (key) {
        case 'skip-gitignore':
          options.skipGitignore = true;
          break;
        default:
          console.error(`❌ Unknown option: ${arg}`);
          process.exit(1);
      }
    } else {
      // First non-option argument is the target directory
      if (!options.targetDir) {
        options.targetDir = arg;
      }
    }
  }

  try {
    await init(options);
  } catch (error) {
    console.error('❌ Initialization failed:', (error as Error).message);
    process.exit(1);
  }
}

async function handleValidate(args: string[]) {
  if (args.includes('--help') || args.includes('-h')) {
    printValidateHelp();
    process.exit(0);
  }

  const filePath = args[0];

  try {
    await validateCommand(filePath);
  } catch (error) {
    console.error('❌ Validation failed:', (error as Error).message);
    process.exit(1);
  }
}

async function handleClean(args: string[]) {
  if (args.includes('--help') || args.includes('-h')) {
    printCleanHelp();
    process.exit(0);
  }

  const options: CleanOptions = {
    all: args.includes('--all'),
    yes: args.includes('--yes'),
  };

  // First non-option argument is the target directory
  for (const arg of args) {
    if (!arg.startsWith('--') && !options.projectRoot) {
      options.projectRoot = arg;
      break;
    }
  }

  try {
    await cleanCommand(options);
  } catch (error) {
    console.error('❌ Clean failed:', (error as Error).message);
    process.exit(1);
  }
}

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

async function handleCompare(args: string[]) {
  if (args[0] === '--help' || args[0] === '-h') {
    printCompareHelp();
    process.exit(0);
  }

  const stats = args.includes('--stats');
  const approve = args.includes('--approve');
  const cleanOrphaned = args.includes('--clean-orphaned');

  // Filter out flag arguments to get positional args
  const positionalArgs = args.filter(arg => !arg.startsWith('--'));

  // Auto-mode: no files specified - use multi-file comparison with context_main.json
  if (positionalArgs.length === 0) {
    const { tmpdir } = await import('node:os');
    const { join, dirname } = await import('node:path');
    const { unlink, copyFile, rm, mkdir } = await import('node:fs/promises');
    const { existsSync } = await import('node:fs');

    // Check if context_main.json exists
    if (!existsSync('context_main.json')) {
      console.error('❌ context_main.json not found. Run "stamp context" first to generate context files.');
      process.exit(1);
    }

    // Create temp directory for new context generation
    const tempDir = join(tmpdir(), `context-compare-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    console.log('🔄 Auto-compare mode: generating fresh context to temp directory...\n');

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
    };

    try {
      await contextCommand(contextOptions);

      // Multi-file compare using context_main.json indices
      console.log('\n🔍 Comparing all context files...\n');
      const multiCompareOptions: MultiFileCompareOptions = {
        oldIndexFile: 'context_main.json',
        newIndexFile: join(tempDir, 'context_main.json'),
        stats,
        approve,
        autoCleanOrphaned: cleanOrphaned,
      };

      const result = await multiFileCompare(multiCompareOptions);
      displayMultiFileCompareResult(result, stats);

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
            console.log(`   ✓ Updated ${destPath}`);
          }

          // Copy context_main.json
          await copyFile(join(tempDir, 'context_main.json'), 'context_main.json');
          console.log(`   ✓ Updated context_main.json`);

          // Clean up orphaned files if requested
          if (cleanOrphaned && result.orphanedFiles && result.orphanedFiles.length > 0) {
            console.log('\n🗑️  Cleaning up orphaned files...');
            const deletedCount = await cleanOrphanedFiles(result.orphanedFiles, '.');
            console.log(`   ✓ Deleted ${deletedCount} orphaned file(s)`);
          }

          console.log(`\n✅ ${copiedFiles + 1} context files updated successfully`);

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
    return;
  }

  // Manual mode: explicit files provided
  if (positionalArgs.length < 2) {
    printCompareHelp();
    process.exit(1);
  }

  const oldFile = positionalArgs[0];
  const newFile = positionalArgs[1];

  // Detect if we're comparing context_main.json files (multi-file mode)
  const isMultiFileMode = oldFile.endsWith('context_main.json') || oldFile.endsWith('context_main.json');

  if (isMultiFileMode) {
    // Multi-file comparison mode
    const multiCompareOptions: MultiFileCompareOptions = {
      oldIndexFile: oldFile,
      newIndexFile: newFile,
      stats,
      approve,
      autoCleanOrphaned: cleanOrphaned,
    };

    try {
      const result = await multiFileCompare(multiCompareOptions);
      displayMultiFileCompareResult(result, stats);

      // Handle drift approval in manual mode
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
          // Copy all new context files
          const { readFile, copyFile, mkdir } = await import('node:fs/promises');
          const { dirname } = await import('node:path');
          const newIndexContent = await readFile(newFile, 'utf8');
          const newIndex = JSON.parse(newIndexContent);

          const baseDir = dirname(oldFile);
          let copiedFiles = 0;

          for (const folder of newIndex.folders) {
            const { join } = await import('node:path');
            const srcPath = join(dirname(newFile), folder.contextFile);
            const destPath = join(baseDir, folder.contextFile);

            // Create parent directory if needed
            await mkdir(dirname(destPath), { recursive: true });
            await copyFile(srcPath, destPath);
            copiedFiles++;
            console.log(`   ✓ Updated ${folder.contextFile}`);
          }

          // Copy context_main.json
          await copyFile(newFile, oldFile);
          console.log(`   ✓ Updated ${oldFile}`);

          // Clean up orphaned files if requested
          if (cleanOrphaned && result.orphanedFiles && result.orphanedFiles.length > 0) {
            console.log('\n🗑️  Cleaning up orphaned files...');
            const deletedCount = await cleanOrphanedFiles(result.orphanedFiles, baseDir);
            console.log(`   ✓ Deleted ${deletedCount} orphaned file(s)`);
          }

          console.log(`\n✅ ${copiedFiles + 1} context files updated successfully`);
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
  } else {
    // Single-file comparison mode (backward compatible)
    const compareOptions: CompareOptions = {
      oldFile,
      newFile,
      stats,
      approve,
    };

    try {
      const result = await compareCommand(compareOptions);

      // Handle drift approval in manual mode
      if (result.status === 'DRIFT') {
        let shouldUpdate = false;

        if (approve) {
          // --approve flag: non-interactive, deterministic
          shouldUpdate = true;
          console.log(`🔄 --approve flag set, updating ${oldFile}...`);
        } else if (isTTY()) {
          // Interactive prompt (local dev convenience)
          shouldUpdate = await promptYesNo(`Update ${oldFile} with ${newFile}? (y/N) `);
        }

        if (shouldUpdate) {
          const { copyFile } = await import('node:fs/promises');
          await copyFile(newFile, oldFile);
          console.log(`✅ ${oldFile} updated successfully\n`);
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
}

async function handleGenerate(args: string[]) {
  if (args.includes('--help') || args.includes('-h')) {
    printGenerateHelp();
    process.exit(0);
  }

  const options: ContextOptions = {
    depth: 1,
    includeCode: 'header',
    format: 'json',
    out: 'context.json',
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
    skipGitignore: false,
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--') || arg.startsWith('-')) {
      const key = arg.replace(/^--?/, '');
      const value = args[i + 1];

      switch (key) {
        case 'depth':
        case 'd':
          options.depth = parseInt(value, 10);
          i++;
          break;
        case 'include-code':
        case 'c':
          options.includeCode = value as 'none' | 'header' | 'full';
          i++;
          break;
        case 'format':
        case 'f':
          options.format = value as 'json' | 'pretty' | 'ndjson';
          i++;
          break;
        case 'out':
        case 'o':
          options.out = value;
          i++;
          break;
        case 'max-nodes':
        case 'm':
          options.maxNodes = parseInt(value, 10);
          i++;
          break;
        case 'profile':
          options.profile = value as 'llm-safe' | 'llm-chat' | 'ci-strict';
          i++;
          break;
        case 'strict':
        case 's':
          options.strict = true;
          break;
        case 'predict-behavior':
          options.predictBehavior = true;
          break;
        case 'dry-run':
          options.dryRun = true;
          break;
        case 'stats':
          options.stats = true;
          break;
        case 'strict-missing':
          options.strictMissing = true;
          break;
        case 'compare-modes':
          options.compareModes = true;
          break;
        case 'skip-gitignore':
          options.skipGitignore = true;
          break;
        default:
          console.error(`❌ Unknown option: ${arg}`);
          process.exit(1);
      }
    } else {
      // First non-option argument is the entry path
      if (!options.entry) {
        options.entry = arg;
      }
    }
  }

  try {
    await contextCommand(options);
  } catch (error) {
    console.error('❌ Context generation failed:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

function printMainHelp() {
  console.log(`
╭─────────────────────────────────────────────────╮
│  Stamp - LogicStamp Context CLI                 │
│  AI-ready context generation for React/TS       │
╰─────────────────────────────────────────────────╯

USAGE:
  stamp init [path]                    Initialize LogicStamp in a project
  stamp context [path] [options]       Generate context
  stamp context validate [file]        Validate context file
  stamp context compare [options]      Detect drift (auto-generates fresh context)
  stamp context clean [path] [options] Remove all generated context artifacts

OPTIONS:
  -h, --help                          Show this help

EXAMPLES:
  stamp init
    Set up LogicStamp in current directory (creates/updates .gitignore)

  stamp context
    Generate context.json for current directory

  stamp context validate
    Validate context.json in current directory

  stamp context compare
    Auto-detect drift by comparing with fresh context

  stamp context clean
    Show what would be removed (dry run)

  stamp context clean --all --yes
    Actually delete all context artifacts

For detailed help on a specific command, run:
  stamp init --help
  stamp context --help
  stamp context validate --help
  stamp context compare --help
  stamp context clean --help
  `);
}

function printGenerateHelp() {
  console.log(`
╭─────────────────────────────────────────────────╮
│  Stamp Context - Generate AI Context            │
│  Scan and analyze React/TS codebase             │
╰─────────────────────────────────────────────────╯

USAGE:
  stamp context [path] [options]

ARGUMENTS:
  [path]                              Directory to scan (default: current)

OPTIONS:
  --depth, -d <n>                     Dependency depth (default: 1)
  --include-code, -c <mode>           Code inclusion: none|header|full (default: header)
  --format, -f <format>               Output format: json|pretty|ndjson (default: json)
  --out, -o <file>                    Output file (default: context.json)
  --max-nodes, -m <n>                 Max nodes per bundle (default: 100)
  --profile <profile>                 Preset profile: llm-safe|llm-chat|ci-strict
  --strict, -s                        Fail on missing dependencies
  --strict-missing                    Exit with error if any missing dependencies
  --predict-behavior                  Include behavior predictions
  --dry-run                           Skip writing output
  --stats                             Emit JSON stats
  --compare-modes                     Show detailed mode comparison table
  --skip-gitignore                    Skip .gitignore setup (never prompt or modify)
  -h, --help                          Show this help

EXAMPLES:
  stamp context
    Generate context for current directory

  stamp context ./src --depth 2
    Deep scan of src directory

  stamp context --include-code none --out api.json
    Generate API documentation only

  stamp context --compare-modes
    Show token cost comparison across modes
  `);
}

function printValidateHelp() {
  console.log(`
╭─────────────────────────────────────────────────╮
│  Stamp Context Validate - Bundle Validator      │
│  Validate context.json structure and schema     │
╰─────────────────────────────────────────────────╯

USAGE:
  stamp context validate [file]

ARGUMENTS:
  [file]                              Path to context.json (default: context.json)

OPTIONS:
  -h, --help                          Show this help

EXAMPLES:
  stamp context validate
    Validate context.json in current directory

  stamp context validate docs/api-context.json
    Validate a specific context file

NOTES:
  • Validates bundle structure and schema compliance
  • Checks for required fields and hash formats
  • Exits with code 0 on success, 1 on failure
  `);
}

function printCompareHelp() {
  console.log(`
╭─────────────────────────────────────────────────╮
│  Stamp Context Compare - Drift Detection        │
│  Compare context files for changes              │
╰─────────────────────────────────────────────────╯

USAGE:
  stamp context compare [options]                     Auto-compare all context files
  stamp context compare <old.json> <new.json>         Compare two specific files
  stamp context compare <old_main.json> <new_main.json>  Compare multi-file indices

ARGUMENTS:
  <old.json>                          Path to old context file or context_main.json
  <new.json>                          Path to new context file or context_main.json

OPTIONS:
  --approve                           Auto-approve updates (non-interactive, CI-safe)
  --clean-orphaned                    Auto-delete orphaned files with --approve
  --stats                             Show token count statistics per folder
  -h, --help                          Show this help

COMPARISON MODES:
  Auto-Mode (Multi-File):
    Compares ALL context files using context_main.json as index
    → Detects ADDED, ORPHANED, DRIFT, and PASS status per folder
    → Shows three-tier output: folder summary, component summary, details

  Single-File Mode:
    Compares two individual context.json files
    → Detects added/removed/changed components

  Multi-File Manual Mode:
    Auto-detects when comparing context_main.json files
    → Compares all referenced context files

EXAMPLES:
  stamp context compare
    Auto-mode: generate fresh context, compare ALL files
    → Shows folder-level and component-level changes
    → Interactive: prompts Y/N to update if drift detected
    → CI: exits with code 1 if drift detected (no prompt)

  stamp context compare --approve
    Auto-approve and update ALL context files if drift (like jest -u)

  stamp context compare --approve --clean-orphaned
    Auto-approve updates and delete orphaned context files

  stamp context compare --stats
    Show per-folder token count deltas

  stamp context compare old.json new.json
    Compare two specific context files

  stamp context compare old/context_main.json new/context_main.json
    Compare all context files between two directories

  stamp context compare || exit 1
    CI validation: fail build if drift detected

EXIT CODES:
  0                                   PASS - No drift OR drift approved and updated
  1                                   DRIFT - Changes detected but not approved

BEHAVIOR:
  • --approve: Non-interactive, deterministic, updates immediately if drift
  • Interactive (TTY): Prompts "Update all context files? (y/N)" if drift
  • CI (non-TTY): Never prompts, exits 1 if drift detected
  • --clean-orphaned: Requires --approve, deletes orphaned files automatically

DRIFT INDICATORS:
  ➕ ADDED FILE         New folder with context file
  🗑️  ORPHANED FILE     Folder removed (context file still exists)
  ⚠️  DRIFT             Folder has component changes
  ✅ PASS               Folder unchanged

NOTES:
  This matches Jest snapshot workflow:
    jest          → prompts to update snapshots locally
    jest -u       → updates snapshots without prompt
    CI            → fails if snapshots don't match
  `);
}

function printCleanHelp() {
  console.log(`
╭─────────────────────────────────────────────────╮
│  Stamp Context Clean - Remove Artifacts        │
│  Delete all generated context files            │
╰─────────────────────────────────────────────────╯

USAGE:
  stamp context clean [path] [options]

ARGUMENTS:
  [path]                              Directory to clean (default: current)

OPTIONS:
  --all                               Include all context files
  --yes                               Confirm deletion (required with --all)
  -h, --help                          Show this help

BEHAVIOR:
  • Default (dry run): Shows what would be removed
  • --all --yes: Actually deletes the files
  • Automatically includes .logicstamp/ directory if it exists

FILES REMOVED:
  • context_main.json                 Main index file
  • **/context.json                   All folder context files
  • .logicstamp/                      Cache directory (if present)

EXAMPLES:
  stamp context clean
    Show what would be removed (dry run)

  stamp context clean --all --yes
    Actually delete all context artifacts (includes .logicstamp/ if present)

  stamp context clean ./src --all --yes
    Clean context files in specific directory

NOTES:
  • Safe by default - requires --all --yes to actually delete
  • Ignores node_modules, dist, build, .next directories
  • Exits with code 0 on success
  `);
}

function printInitHelp() {
  console.log(`
╭─────────────────────────────────────────────────╮
│  Stamp Init - Initialize LogicStamp            │
│  Set up LogicStamp in your project              │
╰─────────────────────────────────────────────────╯

USAGE:
  stamp init [path] [options]

ARGUMENTS:
  [path]                              Target directory (default: current)

OPTIONS:
  --skip-gitignore                    Skip .gitignore setup
  -h, --help                          Show this help

EXAMPLES:
  stamp init
    Set up LogicStamp in current directory

  stamp init ./my-project
    Set up LogicStamp in a specific directory

  stamp init --skip-gitignore
    Initialize without modifying .gitignore

WHAT IT DOES:
  • Creates or updates .gitignore with LogicStamp patterns:
    - context.json
    - context_*.json
    - *.uif.json
    - logicstamp.manifest.json
    - .logicstamp/

NOTES:
  • Safe to run multiple times (idempotent)
  • Won't duplicate patterns if they already exist
  • Creates .gitignore if it doesn't exist
  `);
}

main();
