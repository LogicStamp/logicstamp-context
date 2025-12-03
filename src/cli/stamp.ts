#!/usr/bin/env node

/**
 * Stamp CLI - Main entry point for LogicStamp Context tools
 * Routes to context operations: generate, validate, compare
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleInit } from './handlers/initHandler.js';
import { handleValidate } from './handlers/validateHandler.js';
import { handleCompare } from './handlers/compareHandler.js';
import { handleClean } from './handlers/cleanHandler.js';
import { handleStyle } from './handlers/styleHandler.js';
import { handleGenerate } from './handlers/contextHandler.js';
import { handleSecurityScan } from './handlers/securityHandler.js';
import { securityHardResetCommand, type SecurityHardResetOptions } from './commands/security.js';
import { getMainHelp, getSecurityHelp } from './parser/helpText.js';
import { printFoxIcon } from './handlers/initHandler.js';

async function main() {
  const args = process.argv.slice(2);

  // Check for version
  if (args[0] === '--version' || args[0] === '-v') {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const packageJsonPath = join(__dirname, '../../package.json');
      const packageJsonContent = await readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonContent);
      printFoxIcon();
      console.log(`Version: ${packageJson.version}`);
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to read version:', (error as Error).message);
      process.exit(1);
    }
  }

  // Check for help - only if no args or first arg is help
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printFoxIcon();
    console.log(getMainHelp());
    process.exit(0);
  }

  // First argument should be the subcommand
  const subcommand = args[0];

  // Handle init command
  if (subcommand === 'init') {
    await handleInit(args.slice(1));
    return;
  }

  // Handle security command
  if (subcommand === 'security') {
    // Check for help
    if (args.includes('--help') || args.includes('-h')) {
      printFoxIcon();
      console.log(getSecurityHelp());
      process.exit(0);
    }
    
    // Handle security scan subcommand
    if (args[1] === 'scan') {
      // Check if --hard-reset was passed to scan (should be rejected)
      const scanArgs = args.slice(2);
      if (scanArgs.includes('--hard-reset')) {
        console.error(`❌ Error: --hard-reset is not available for "stamp security scan"`);
        console.error(`   Use "stamp security --hard-reset" instead`);
        process.exit(1);
      }
      await handleSecurityScan(scanArgs);
      return;
    }
    
    // Check for --hard-reset at top level (only if no subcommand)
    if (args.includes('--hard-reset')) {
      const hardResetOptions: SecurityHardResetOptions = {
        entry: undefined,
        out: undefined,
        force: args.includes('--force'),
        quiet: args.includes('--quiet') || args.includes('-q'),
      };
      
      // Parse entry and out options
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--out' || arg === '-o') {
          hardResetOptions.out = args[i + 1];
          i++;
        } else if (!arg.startsWith('-') && !hardResetOptions.entry && arg !== 'scan') {
          hardResetOptions.entry = arg;
        }
      }
      
      await securityHardResetCommand(hardResetOptions);
      return;
    }
    
    // If no subcommand and no --hard-reset, show error
    if (!args[1] || args[1].startsWith('--')) {
      console.error(`❌ Security command requires a subcommand or --hard-reset`);
      console.error('Run "stamp security scan --help" for usage information');
      process.exit(1);
    }
    
    console.error(`❌ Unknown security command: ${args[1]}`);
    console.error('Run "stamp security scan --help" for usage information');
    process.exit(1);
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

  // Check for 'style' subcommand (stamp context style)
  if (contextArgs[0] === 'style') {
    await handleStyle(contextArgs.slice(1));
    return;
  }

  // Default: generate context
  await handleGenerate(contextArgs);
}

main();
