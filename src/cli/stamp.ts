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

  // Check for help
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
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

async function handleCompare(args: string[]) {
  if (args.length < 2 || args[0] === '--help' || args[0] === '-h') {
    printCompareHelp();
    process.exit(args[0] === '--help' || args[0] === '-h' ? 0 : 1);
  }

  const compareOptions: CompareOptions = {
    oldFile: args[0],
    newFile: args[1],
    stats: args.includes('--stats'),
  };

  try {
    await compareCommand(compareOptions);
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
  stamp context compare <old> <new>    Compare two context files

OPTIONS:
  -h, --help                          Show this help

EXAMPLES:
  stamp context
    Generate context.json for current directory

  stamp context validate
    Validate context.json in current directory

  stamp context compare old.json new.json
    Compare two context files for drift

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
│  Compare two context.json files                 │
╰─────────────────────────────────────────────────╯

USAGE:
  stamp context compare <old.json> <new.json> [options]

ARGUMENTS:
  <old.json>                          Path to old context file
  <new.json>                          Path to new context file

OPTIONS:
  --stats                             Show token count statistics
  -h, --help                          Show this help

EXAMPLES:
  stamp context compare old.json new.json
    Basic drift detection

  stamp context compare base.json pr.json --stats
    Compare with token delta

  stamp context compare old.json new.json || exit 1
    CI validation (fails on drift)

EXIT CODES:
  0                                   PASS - No drift detected
  1                                   DRIFT - Changes detected or error
  `);
}

main();
