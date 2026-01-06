/**
 * Handler for clean command
 */

import { cleanCommand, type CleanOptions } from '../commands/clean.js';
import { parseCleanArgs } from '../parser/argumentParser.js';
import { getCleanHelp } from '../parser/helpText.js';
import { printFoxIcon } from './initHandler.js';

export async function handleClean(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    printFoxIcon();
    console.log(getCleanHelp());
    process.exit(0);
  }

  // Explicitly reject --compare-modes (only available in stamp context, not stamp context clean)
  if (args.includes('--compare-modes')) {
    console.error('❌ --compare-modes is not available for "stamp context clean". Use "stamp context --compare-modes" instead.');
    process.exit(1);
  }

  const options = parseCleanArgs(args);

  try {
    await cleanCommand(options);
    // cleanCommand doesn't call process.exit() internally, but this ensures we exit
    // even if there's an unexpected code path that doesn't return normally
    process.exit(0);
  } catch (error) {
    console.error('❌ Clean failed:', (error as Error).message);
    process.exit(1);
  }
}

