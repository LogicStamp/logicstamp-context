/**
 * Handler for context/generate command
 */

import { contextCommand, type ContextOptions } from '../commands/context.js';
import { parseContextArgs } from '../parser/argumentParser.js';
import { getGenerateHelp } from '../parser/helpText.js';
import { printFoxIcon } from './initHandler.js';

export async function handleGenerate(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    printFoxIcon();
    console.log(getGenerateHelp());
    process.exit(0);
  }

  const options = parseContextArgs(args);

  try {
    await contextCommand(options);
  } catch (error) {
    console.error('❌ Context generation failed:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

