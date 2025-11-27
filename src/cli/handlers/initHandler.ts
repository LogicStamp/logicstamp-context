/**
 * Handler for init command
 */

import { init, type InitOptions } from '../commands/init.js';
import { parseInitArgs } from '../parser/argumentParser.js';
import { getInitHelp } from '../parser/helpText.js';

export function printFoxIcon() {
  console.log(`
    /\\_/\\
   ( o.o )
    > ^ <
🦊 Meet the Logic Fox
`);
}

export async function handleInit(args: string[]): Promise<void> {
  printFoxIcon();
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(getInitHelp());
    process.exit(0);
  }

  const options = parseInitArgs(args);

  try {
    await init(options);
  } catch (error) {
    console.error('❌ Initialization failed:', (error as Error).message);
    process.exit(1);
  }
}

