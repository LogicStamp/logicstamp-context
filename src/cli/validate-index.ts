#!/usr/bin/env node

/**
 * LogicStamp Validate CLI - Standalone validation tool
 * Validates context.json bundle files for structural correctness
 */

import { validateCommand } from './commands/validate.js';

async function main() {
  const args = process.argv.slice(2);

  // Show help if requested
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  // First argument is the file path
  const filePath = args[0];

  try {
    await validateCommand(filePath);
  } catch (error) {
    console.error('❌ Validation failed:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
╭─────────────────────────────────────────────────╮
│  LogicStamp Validate - Bundle Validator         │
│  Validate context.json bundle files             │
╰─────────────────────────────────────────────────╯

USAGE:
  logicstamp-validate [file]

ARGUMENTS:
  [file]               Path to context.json file (default: context.json)

OPTIONS:
  -h, --help           Show this help

EXAMPLES:
  logicstamp-validate
    Validate context.json in current directory

  logicstamp-validate docs/ai-context.json
    Validate a context file in a subdirectory

NOTES:
  • Validates bundle structure and schema compliance
  • Checks for required fields and proper hash formats
  • Does NOT validate source code drift (use full CLI for that)
  `);
}

main();
