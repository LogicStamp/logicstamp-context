/**
 * Handler for validate command
 */

import { validateCommand } from '../commands/validate.js';
import { parseValidateArgs, getValidateHelp } from '../parser/index.js';
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
    // validateCommand calls process.exit() internally on all code paths,
    // so this line should never be reached. If it is, something unexpected happened.
    // We don't call process.exit() here to avoid race conditions in tests.
  } catch (error) {
    console.error('❌ Validation failed:', (error as Error).message);
    process.exit(1);
  }
}

