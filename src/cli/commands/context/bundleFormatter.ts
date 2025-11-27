/**
 * Bundle Formatter - Formats bundles for output
 */

import type { LogicStampBundle } from '../../../core/pack.js';

/**
 * Format bundles for output based on format type
 */
export function formatBundles(
  bundles: LogicStampBundle[],
  format: 'json' | 'pretty' | 'ndjson'
): string {
  if (format === 'ndjson') {
    return bundles.map((b, idx) => {
      const bundleWithSchema = {
        $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
        position: `${idx + 1}/${bundles.length}`,
        ...b,
      };
      return JSON.stringify(bundleWithSchema);
    }).join('\n');
  } else if (format === 'json') {
    const bundlesWithPosition = bundles.map((b, idx) => ({
      $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
      position: `${idx + 1}/${bundles.length}`,
      ...b,
    }));
    return JSON.stringify(bundlesWithPosition, null, 2);
  } else {
    // pretty format
    return bundles.map((b, idx) => {
      const bundleWithSchema = {
        $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
        position: `${idx + 1}/${bundles.length}`,
        ...b,
      };
      const header = `\n# Bundle ${idx + 1}/${bundles.length}: ${b.entryId}`;
      return header + '\n' + JSON.stringify(bundleWithSchema, null, 2);
    }).join('\n\n');
  }
}

/**
 * Create bundle with schema metadata
 */
export function createBundleWithSchema(
  bundle: LogicStampBundle,
  index: number,
  total: number
): LogicStampBundle & { $schema: string; position: string } {
  return {
    $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
    position: `${index + 1}/${total}`,
    ...bundle,
  };
}

/**
 * Format bundles for a specific folder
 */
export function formatBundlesForFolder(
  folderBundles: LogicStampBundle[],
  format: 'json' | 'pretty' | 'ndjson'
): string {
  return formatBundles(folderBundles, format);
}

