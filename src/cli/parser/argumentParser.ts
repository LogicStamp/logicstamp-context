/**
 * Argument parsing utilities for CLI commands
 */

import type { ContextOptions } from '../commands/context.js';
import type { InitOptions } from '../commands/init.js';
import type { CleanOptions } from '../commands/clean.js';
import type { StyleOptions } from '../commands/style.js';

export interface CompareArgs {
  stats: boolean;
  approve: boolean;
  cleanOrphaned: boolean;
  quiet: boolean;
  skipGitignore: boolean;
  positionalArgs: string[];
}

export interface ValidateArgs {
  quiet: boolean;
  filePath?: string;
}

/**
 * Parse context command arguments (for generate command)
 */
export function parseContextArgs(args: string[]): ContextOptions {
  const options: ContextOptions = {
    depth: 1,
    includeCode: 'header',
    format: 'json',
    out: 'context.json',
    hashLock: false,
    strict: false,
    allowMissing: true,
    maxNodes: 100,
    profile: 'llm-chat',
    predictBehavior: false,
    dryRun: false,
    stats: false,
    strictMissing: false,
    compareModes: false,
    skipGitignore: false,
    quiet: false,
    includeStyle: false, // Default to false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--') || arg.startsWith('-')) {
      const key = arg.replace(/^--?/, '');
      const value = args[i + 1];

      switch (key) {
        case 'depth':
        case 'd':
          options.depth = parseInt(value, 10);
          i++;
          break;
        case 'include-code':
        case 'c':
          options.includeCode = value as 'none' | 'header' | 'full';
          i++;
          break;
        case 'format':
        case 'f':
          options.format = value as 'json' | 'pretty' | 'ndjson';
          i++;
          break;
        case 'out':
        case 'o':
          options.out = value;
          i++;
          break;
        case 'max-nodes':
        case 'm':
          options.maxNodes = parseInt(value, 10);
          i++;
          break;
        case 'profile':
          options.profile = value as 'llm-safe' | 'llm-chat' | 'ci-strict';
          i++;
          break;
        case 'strict':
        case 's':
          options.strict = true;
          break;
        case 'predict-behavior':
          options.predictBehavior = true;
          break;
        case 'dry-run':
          options.dryRun = true;
          break;
        case 'stats':
          options.stats = true;
          break;
        case 'strict-missing':
          options.strictMissing = true;
          break;
        case 'compare-modes':
          options.compareModes = true;
          break;
        case 'skip-gitignore':
          options.skipGitignore = true;
          break;
        case 'quiet':
        case 'q':
          options.quiet = true;
          break;
        case 'include-style':
          options.includeStyle = true;
          break;
        default:
          console.error(`❌ Unknown option: ${arg}`);
          process.exit(1);
      }
    } else {
      // First non-option argument is the entry path
      if (!options.entry) {
        options.entry = arg;
      }
    }
  }

  return options;
}

/**
 * Parse compare command arguments
 */
export function parseCompareArgs(args: string[]): CompareArgs {
  const stats = args.includes('--stats');
  const approve = args.includes('--approve');
  const cleanOrphaned = args.includes('--clean-orphaned');
  const quiet = args.includes('--quiet') || args.includes('-q');
  const skipGitignore = args.includes('--skip-gitignore');

  // Filter out flag arguments to get positional args (including -q)
  const positionalArgs = args.filter(arg => !arg.startsWith('--') && arg !== '-q');

  return {
    stats,
    approve,
    cleanOrphaned,
    quiet,
    skipGitignore,
    positionalArgs,
  };
}

/**
 * Parse validate command arguments
 */
export function parseValidateArgs(args: string[]): ValidateArgs {
  const quiet = args.includes('--quiet') || args.includes('-q');
  const filePath = args.filter(arg => arg !== '--quiet' && arg !== '-q')[0];

  return {
    quiet,
    filePath,
  };
}

/**
 * Parse init command arguments
 */
export function parseInitArgs(args: string[]): InitOptions {
  const options: InitOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '');

      switch (key) {
        case 'skip-gitignore':
          options.skipGitignore = true;
          break;
        case 'yes':
          options.yes = true;
          break;
        case 'secure':
          options.secure = true;
          // --secure implies --yes
          options.yes = true;
          break;
        case 'quiet':
          // Ignore --quiet for init (quiet mode not supported)
          break;
        default:
          console.error(`❌ Unknown option: ${arg}`);
          process.exit(1);
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      // Single-dash flags like -y, -q
      const flag = arg[1];
      switch (flag) {
        case 'y':
          options.yes = true;
          break;
        case 'q':
          // Ignore -q for init (quiet mode not supported)
          break;
        default:
          console.error(`❌ Unknown option: ${arg}`);
          process.exit(1);
      }
    } else if (arg !== '-q') {
      // First non-option argument is the target directory (ignore -q)
      if (!options.targetDir) {
        options.targetDir = arg;
      }
    }
  }

  return options;
}

/**
 * Parse clean command arguments
 */
export function parseCleanArgs(args: string[]): CleanOptions {
  const options: CleanOptions = {
    all: args.includes('--all'),
    yes: args.includes('--yes'),
    quiet: args.includes('--quiet') || args.includes('-q'),
  };

  // First non-option argument is the target directory
  for (const arg of args) {
    if (!arg.startsWith('--') && !options.projectRoot) {
      options.projectRoot = arg;
      break;
    }
  }

  return options;
}

/**
 * Parse style command arguments (same as context args but exclude includeStyle)
 */
export function parseStyleArgs(args: string[]): StyleOptions {
  // Style command uses same parsing as context, but StyleOptions omits includeStyle
  const contextOptions = parseContextArgs(args);
  
  // Remove includeStyle since StyleOptions is Omit<ContextOptions, 'includeStyle'>
  const { includeStyle, ...styleOptions } = contextOptions;
  
  return styleOptions as StyleOptions;
}

