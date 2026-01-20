/**
 * Handler for ignore command
 */

import { ignoreCommand, type IgnoreOptions } from '../commands/ignore.js';
import { parseIgnoreArgs, getIgnoreHelp } from '../parser/index.js';
import { printFoxIcon } from './initHandler.js';

export async function handleIgnore(args: string[]): Promise<void> {
  printFoxIcon();

  if (args.includes('--help') || args.includes('-h')) {
    console.log(getIgnoreHelp());
    process.exit(0);
  }

  const options = parseIgnoreArgs(args);

  try {
    await ignoreCommand(options);
  } catch (error) {
    console.error('❌ Failed to add paths to .stampignore:', (error as Error).message);
    process.exit(1);
  }
}

