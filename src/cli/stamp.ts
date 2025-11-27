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
import { getMainHelp } from './parser/helpText.js';
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
