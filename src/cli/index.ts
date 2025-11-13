#!/usr/bin/env node

/**
 * LogicStamp Context CLI - Standalone context generator
 * Scans React/TypeScript files and generates AI-friendly context bundles
 */

import { contextCommand, type ContextOptions } from './commands/context.js';
import { compareCommand, type CompareOptions } from './commands/compare.js';

async function main() {
  const args = process.argv.slice(2);

  // Check for compare subcommand
  if (args[0] === 'compare') {
    // Handle compare command
    if (args.length < 3 || args[1] === '--help' || args[1] === '-h') {
      printCompareHelp();
      process.exit(args[1] === '--help' || args[1] === '-h' ? 0 : 1);
    }

    const compareOptions: CompareOptions = {
      oldFile: args[1],
      newFile: args[2],
      stats: args.includes('--stats'),
    };

    try {
      await compareCommand(compareOptions);
    } catch (error) {
      console.error('❌ Compare failed:', (error as Error).message);
      process.exit(1);
    }
    return;
  }

  // Parse arguments for context command
  const options: ContextOptions = {
    depth: 1,
    includeCode: 'header',
    format: 'json',
    out: 'context.json',
    hashLock: false, // No hash lock for standalone (no sidecars)
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

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

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
        case 'predict':
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
      }
    } else if (!arg.startsWith('-') && !options.entry) {
      options.entry = arg;
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

function printHelp() {
  console.log(`
╭─────────────────────────────────────────────────╮
│  LogicStamp Context - AI-Ready Documentation    │
│  Generate context bundles from React codebases  │
╰─────────────────────────────────────────────────╯

USAGE:
  logicstamp-context [path] [options]
  logicstamp-context compare <old.json> <new.json> [--stats]

ARGUMENTS:
  [path]               Directory to scan (default: current directory)

OPTIONS:
  -d, --depth <n>           Dependency depth (default: 1)
  -c, --include-code <mode> Code: none|header|full (default: header)
  -f, --format <format>     Format: json|pretty|ndjson (default: json)
  -o, --out <file>          Output file (default: context.json)
  -m, --max-nodes <n>       Max nodes per bundle (default: 100)
  --profile <profile>       Profile: llm-safe|llm-chat|ci-strict
  -s, --strict              Fail on missing dependencies
  --predict-behavior        Enable behavioral predictions
  --dry-run                 Show stats without writing file
  --stats                   Output one-line JSON stats for CI
  --strict-missing          Exit with error if missing dependencies found
  --compare-modes           Show detailed token comparison table
  -h, --help                Show this help

PROFILES:
  llm-safe    Conservative (depth=1, header, max 30 nodes)
  llm-chat    Balanced (depth=1, header, max 100 nodes) [default]
  ci-strict   Strict validation (no code, strict deps)

EXAMPLES:
  logicstamp-context
    Generate context for entire project

  logicstamp-context ./src
    Generate context for src directory

  logicstamp-context --profile llm-safe --out ai-context.json
    Use conservative profile with custom output

  logicstamp-context --depth 2 --include-code full
    Include full source code with deeper traversal

VALIDATION:
  Use logicstamp-validate to check generated bundles:
    logicstamp-validate context.json

NOTES:
  • Scans for .ts/.tsx files automatically
  • Generates context on-the-fly (no pre-compilation needed)
  • Output is ready for Claude, ChatGPT, or other AI tools
  `);
}

function printCompareHelp() {
  console.log(`
╭─────────────────────────────────────────────────╮
│  LogicStamp Context Compare                     │
│  Diff two context.json files                    │
╰─────────────────────────────────────────────────╯

USAGE:
  logicstamp-context compare <old.json> <new.json> [options]

ARGUMENTS:
  <old.json>           Path to old context file
  <new.json>           Path to new context file

OPTIONS:
  --stats              Show token count statistics
  -h, --help           Show this help

OUTPUT:
  PASS                 No changes detected
  DRIFT                Components added/removed/changed

EXIT CODES:
  0                    No drift (PASS)
  1                    Drift detected or error

EXAMPLES:
  logicstamp-context compare old.json new.json
    Compare two context files

  logicstamp-context compare old.json new.json --stats
    Compare with token statistics
  `);
}

main();
