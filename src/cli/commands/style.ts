/**
 * Style command - Thin wrapper for context generation with style metadata
 */

import { contextCommand, type ContextOptions } from './context.js';

export type StyleOptions = Omit<ContextOptions, 'includeStyle'>;

/**
 * Generate context with style metadata
 * This is a thin wrapper around contextCommand with includeStyle: true
 */
export async function styleCommand(options: StyleOptions): Promise<void> {
  await contextCommand({
    ...options,
    includeStyle: true,
  });
}
