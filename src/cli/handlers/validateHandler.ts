/**
 * Handler for validate command
 */

import { validateCommand } from '../commands/validate.js';
import { parseValidateArgs } from '../parser/argumentParser.js';
import { getValidateHelp } from '../parser/helpText.js';
import { printFoxIcon } from './initHandler.js';

export async function handleValidate(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    printFoxIcon();
    console.log(getValidateHelp());
    process.exit(0);
  }

  const { quiet, filePath } = parseValidateArgs(args);

  try {
    await validateCommand(filePath, quiet);
  } catch (error) {
    console.error('❌ Validation failed:', (error as Error).message);
    process.exit(1);
  }
}

