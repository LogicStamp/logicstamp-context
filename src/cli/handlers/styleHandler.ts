/**
 * Handler for style command
 */

import { styleCommand, type StyleOptions } from '../commands/style.js';
import { parseStyleArgs, getStyleHelp } from '../parser/index.js';
import { printFoxIcon } from './initHandler.js';

export async function handleStyle(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    printFoxIcon();
    console.log(getStyleHelp());
    process.exit(0);
  }

  // Explicitly reject --compare-modes (only available in stamp context, not stamp context style)
  if (args.includes('--compare-modes')) {
    console.error('❌ --compare-modes is not available for "stamp context style". Use "stamp context --compare-modes" instead.');
    process.exit(1);
  }

  const options = parseStyleArgs(args);
  // Note: styleCommand internally sets includeStyle: true

  try {
    await styleCommand(options);
  } catch (error) {
    console.error('❌ Style context generation failed:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

