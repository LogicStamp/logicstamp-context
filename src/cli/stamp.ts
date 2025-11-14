#!/usr/bin/env node

/**
 * Stamp CLI - Main entry point for LogicStamp Context tools
 * Routes to context operations: generate, validate, compare
 */

import { contextCommand, type ContextOptions } from './commands/context.js';
import { compareCommand, type CompareOptions } from './commands/compare.js';
import { validateCommand } from './commands/validate.js';

async function main() {
  const args = process.argv.slice(2);

  // Check for help - only if no args or first arg is help
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printMainHelp();
    process.exit(0);
  }

  // First argument should be the subcommand
  const subcommand = args[0];

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

  // Default: generate context
  await handleGenerate(contextArgs);
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

  // Filter out flag arguments to get positional args
  const positionalArgs = args.filter(arg => !arg.startsWith('--'));

  // Auto-mode: no files specified - compare existing context.json with fresh generation
  if (positionalArgs.length === 0) {
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { unlink, copyFile } = await import('node:fs/promises');

    const tempFile = join(tmpdir(), `context-${Date.now()}.json`);

    console.log('🔄 Auto-compare mode: generating fresh context...\n');

    // Generate fresh context to temp file
    const contextOptions: ContextOptions = {
      depth: 1,
      includeCode: 'header',
      format: 'json',
      out: tempFile,
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

      // Compare existing context.json with fresh temp file
      console.log('\n🔍 Comparing with existing context.json...\n');
      const compareOptions: CompareOptions = {
        oldFile: 'context.json',
        newFile: tempFile,
        stats,
        approve,
      };

      const result = await compareCommand(compareOptions);

      // Handle drift approval
      if (result.status === 'DRIFT') {
        let shouldUpdate = false;

        if (approve) {
          // --approve flag: non-interactive, deterministic
          shouldUpdate = true;
          console.log('🔄 --approve flag set, updating context.json...');
        } else if (isTTY()) {
          // Interactive prompt (local dev convenience)
          shouldUpdate = await promptYesNo('Update context.json? (y/N) ');
        }

        if (shouldUpdate) {
          await copyFile(tempFile, 'context.json');
          console.log('✅ context.json updated successfully\n');
          // Clean up temp file
          await unlink(tempFile);
          process.exit(0); // Success: drift approved and updated
        } else {
          // Clean up temp file
          await unlink(tempFile);
          if (isTTY() && !approve) {
            console.log('❌ Update declined\n');
          }
          process.exit(1); // Drift detected but not approved
        }
      } else {
        // No drift - clean up and exit success
        await unlink(tempFile);
        process.exit(0);
      }
    } catch (error) {
      // Try to clean up temp file even on error
      try {
        await unlink(tempFile);
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

  const compareOptions: CompareOptions = {
    oldFile: positionalArgs[0],
    newFile: positionalArgs[1],
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
        console.log(`🔄 --approve flag set, updating ${positionalArgs[0]}...`);
      } else if (isTTY()) {
        // Interactive prompt (local dev convenience)
        shouldUpdate = await promptYesNo(`Update ${positionalArgs[0]} with ${positionalArgs[1]}? (y/N) `);
      }

      if (shouldUpdate) {
        const { copyFile } = await import('node:fs/promises');
        await copyFile(positionalArgs[1], positionalArgs[0]);
        console.log(`✅ ${positionalArgs[0]} updated successfully\n`);
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
  stamp context [path] [options]       Generate context
  stamp context validate [file]        Validate context file
  stamp context compare [options]      Detect drift (auto-generates fresh context)

OPTIONS:
  -h, --help                          Show this help

EXAMPLES:
  stamp context
    Generate context.json for current directory

  stamp context validate
    Validate context.json in current directory

  stamp context compare
    Auto-detect drift by comparing with fresh context

For detailed help on a specific command, run:
  stamp context --help
  stamp context validate --help
  stamp context compare --help
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
  stamp context compare [options]                 Auto-compare with fresh context
  stamp context compare <old.json> <new.json>     Compare two specific files

ARGUMENTS:
  <old.json>                          Path to old context file
  <new.json>                          Path to new context file

OPTIONS:
  --approve                           Auto-approve updates (non-interactive, CI-safe)
  --stats                             Show token count statistics
  -h, --help                          Show this help

EXAMPLES:
  stamp context compare
    Auto-mode: generate fresh context, compare with context.json
    → Interactive: prompts Y/N to update if drift detected
    → CI: exits with code 1 if drift detected (no prompt)

  stamp context compare --approve
    Auto-approve and update context.json if drift detected (like jest -u)

  stamp context compare --stats
    Show token count delta

  stamp context compare old.json new.json
    Compare two specific files (prompts Y/N to update old.json if drift)

  stamp context compare || exit 1
    CI validation: fail build if drift detected

EXIT CODES:
  0                                   PASS - No drift OR drift approved and updated
  1                                   DRIFT - Changes detected but not approved

BEHAVIOR:
  • --approve: Non-interactive, deterministic, updates immediately if drift
  • Interactive (TTY): Prompts "Update context.json? (y/N)" if drift
  • CI (non-TTY): Never prompts, exits 1 if drift detected
  • Validation runs during generation (fresh context always valid)

NOTES:
  This matches Jest snapshot workflow:
    jest          → prompts to update snapshots locally
    jest -u       → updates snapshots without prompt
    CI            → fails if snapshots don't match
  `);
}

main();
