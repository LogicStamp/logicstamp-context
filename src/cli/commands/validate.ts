/**
 * Validate command - Validates context.json files
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { LogicStampBundle } from '../../core/pack.js';

/**
 * Normalize path for display (convert backslashes to forward slashes)
 */
function displayPath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Validate a context.json file for basic structural validity
 */
export async function validateCommand(filePath?: string): Promise<void> {
  // Default to context.json in current directory
  const targetFile = filePath || 'context.json';

  try {
    const path = resolve(targetFile);
    console.log(`🔍 Validating "${displayPath(path)}"...`);

    const content = await readFile(path, 'utf8');
    const bundles = JSON.parse(content) as LogicStampBundle[];

    // Basic validation
    if (!Array.isArray(bundles)) {
      console.error('❌ Invalid format: expected array of bundles');
      process.exit(1);
    }

    let errors = 0;
    let warnings = 0;

    for (let i = 0; i < bundles.length; i++) {
      const bundle = bundles[i];
      const bundleLabel = `Bundle ${i + 1}`;

      // Check required fields
      if (bundle.type !== 'LogicStampBundle') {
        console.error(`❌ ${bundleLabel}: Invalid type (expected 'LogicStampBundle', got '${bundle.type}')`);
        errors++;
      }

      if (bundle.schemaVersion !== '0.1') {
        console.error(`❌ ${bundleLabel}: Invalid schemaVersion (expected '0.1', got '${bundle.schemaVersion}')`);
        errors++;
      }

      if (!bundle.entryId) {
        console.error(`❌ ${bundleLabel}: Missing entryId`);
        errors++;
      }

      if (!bundle.graph || !Array.isArray(bundle.graph.nodes) || !Array.isArray(bundle.graph.edges)) {
        console.error(`❌ ${bundleLabel}: Invalid graph structure`);
        errors++;
      }

      if (!bundle.meta || !Array.isArray(bundle.meta.missing)) {
        console.error(`❌ ${bundleLabel}: Invalid meta structure`);
        errors++;
      }

      // Validate contracts
      if (bundle.graph && bundle.graph.nodes) {
        for (const node of bundle.graph.nodes) {
          const contract = node.contract;
          if (contract?.type !== 'UIFContract') {
            console.error(`❌ ${bundleLabel}: Node ${node.entryId} has invalid contract type`);
            errors++;
          }
          if (contract?.schemaVersion !== '0.3') {
            console.warn(`⚠️  ${bundleLabel}: Node ${node.entryId} has unexpected contract version ${contract?.schemaVersion}`);
            warnings++;
          }
        }
      }

      // Check hash format (bundle hashes use uifb: prefix)
      if (bundle.bundleHash && !bundle.bundleHash.match(/^uifb:[a-f0-9]{24}$/)) {
        console.warn(`⚠️  ${bundleLabel}: bundleHash has unexpected format`);
        warnings++;
      }
    }

    if (errors === 0 && warnings === 0) {
      console.log(`✅ Valid context file with ${bundles.length} bundle(s)`);
      console.log(`   Total nodes: ${bundles.reduce((sum, b) => sum + (b.graph?.nodes?.length || 0), 0)}`);
      console.log(`   Total edges: ${bundles.reduce((sum, b) => sum + (b.graph?.edges?.length || 0), 0)}`);
      process.exit(0);
    } else if (errors === 0) {
      console.log(`✅ Valid with ${warnings} warning(s)`);
      process.exit(0);
    } else {
      console.error(`\n❌ Validation failed: ${errors} error(s), ${warnings} warning(s)`);
      process.exit(1);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`❌ File not found: ${targetFile}`);
      if (!filePath) {
        console.error('   Tip: Specify a file path or ensure context.json exists in the current directory');
      }
    } else if (error instanceof SyntaxError) {
      console.error(`❌ Invalid JSON: ${error.message}`);
    } else {
      console.error(`❌ Validation failed: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}
