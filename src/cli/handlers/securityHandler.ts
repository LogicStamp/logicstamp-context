/**
 * Handler for security scan command
 */

import { securityScanCommand, type SecurityScanOptions } from '../commands/security.js';
import { getSecurityScanHelp } from '../parser/index.js';
import { printFoxIcon } from './initHandler.js';

export async function handleSecurityScan(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    printFoxIcon();
    console.log(getSecurityScanHelp());
    process.exit(0);
  }

  const options: SecurityScanOptions = {
    entry: undefined,
    out: undefined,
    quiet: args.includes('--quiet') || args.includes('-q'),
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--quiet' || arg === '-q') {
      options.quiet = true;
    } else if (arg === '--out' || arg === '-o') {
      options.out = args[i + 1];
      i++;
    } else if (!arg.startsWith('-') && !options.entry) {
      options.entry = arg;
    }
  }

  try {
    await securityScanCommand(options);
  } catch (error) {
    console.error('❌ Security scan failed:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

