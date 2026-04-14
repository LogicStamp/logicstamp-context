/**
 * Handler for context/compile command
 */

import { contextCommand, type ContextOptions } from '../commands/context.js';
import { parseContextArgs, getGenerateHelp } from '../parser/index.js';
import { printFoxIcon } from './initHandler.js';
import {
  gracefulShutdown,
  registerSignalHandlers,
} from '../../utils/cleanup.js';

export async function handleGenerate(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    printFoxIcon();
    console.log(getGenerateHelp());
    process.exit(0);
  }

  // Register signal handlers for graceful shutdown
  registerSignalHandlers();

  const options = parseContextArgs(args);

  try {
    await contextCommand(options);
  } catch (error) {
    const err = error as Error;
    console.error('❌ Context compilation failed:', err.message);
    console.error(err.stack);
    await gracefulShutdown(1);
  }
}
