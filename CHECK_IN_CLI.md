/**
 * @uif Contract 0.3
 *
 * Description: check - Presentational component
 *
 * Version (Component Composition):
 *   variables: ["builder","command","describe","handler"]
 *   hooks: []
 *   components: []
 *   functions: ["builder","handler"]
 *   imports: ["../../core/astParser.js","../../core/contractBuilder.js","../../core/validate.js","../../utils/fsx.js","../../utils/hash.js","yargs"]
 *
 * Logic Signature:
 *   props: {}
 *   events: {}
 *   state: {}
 *
 * Predictions:
 *   (none)
 *
 * Hashes (informational only - authoritative values in .uif.json):
 *   semantic: uif:92a5ee7fb7c5811cfcb52a59 (informational)
 *   file: uif:275cb6f73266af0a08cf9775
 */

/**
 * Check command - Validate contracts and detect drift
 */

import type { Arguments, CommandBuilder } from 'yargs';
import { extractFromFile } from '../../core/astParser.js';
import { buildContract } from '../../core/contractBuilder.js';
import { loadAndValidateContract, validateContract } from '../../core/validate.js';
import { globFiles, readFileWithText, getSidecarPath, fileExists } from '../../utils/fsx.js';
import { hashesEqual } from '../../utils/hash.js';

interface CheckOptions {
  path: string;
  out: string;
  failOnDrift: boolean;
  quiet: boolean;
}

export const command = 'check [path]';
export const describe = 'Validate contracts and detect drift';

// eslint-disable-next-line @typescript-eslint/ban-types
export const builder: CommandBuilder<{}, CheckOptions> = (yargs) =>
  yargs
    .positional('path', {
      type: 'string',
      default: 'src',
      describe: 'Directory or file to check',
    })
    .option('out', {
      type: 'string',
      default: '.',
      describe: 'Sidecar output root',
    })
    .option('failOnDrift', {
      type: 'boolean',
      default: false,
      describe: 'Exit with error code if drift detected',
      alias: 'fail-on-drift',
    })
    .option('quiet', {
      type: 'boolean',
      default: false,
      describe: 'Minimal output',
    });

export const handler = async (argv: Arguments<CheckOptions>): Promise<void> => {
  try {
    if (!argv.quiet) {
      console.log(`🔍 Checking contracts in ${argv.path}...\n`);
    }

    const files = await globFiles(argv.path);

    if (files.length === 0) {
      console.log(`⚠️  No files found in ${argv.path}`);
      process.exit(0);
    }

    let validCount = 0;
    let driftCount = 0;
    let missingCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        const sidecarPath = getSidecarPath(file, argv.out);
        const sidecarExists = await fileExists(sidecarPath);

        if (!sidecarExists) {
          missingCount++;
          console.log(`⚠️  ${file}: No sidecar found`);
          continue;
        }

        // Load existing contract from sidecar (authoritative source of truth)
        const existingContract = await loadAndValidateContract(sidecarPath);

        // Validate schema
        const validation = await validateContract(existingContract);
        if (!validation.valid) {
          errorCount++;
          console.log(`✗ ${file}: Invalid contract schema`);
          validation.errors?.forEach((e) => console.log(`   - ${e}`));
          continue;
        }

        // Re-compute contract from source AST (current code state)
        const { text } = await readFileWithText(file);
        const ast = await extractFromFile(file);
        const { contract: recomputed } = buildContract(file, ast, {
          preset: 'none',
          sourceText: text,
        });

        // Compare recomputed semantic hash to sidecar (authoritative source)
        // This ensures we detect drift even if headers are manually edited
        const hasDrift = !hashesEqual(existingContract.semanticHash, recomputed.semanticHash);

        if (hasDrift) {
          driftCount++;
          console.log(`⚠️  ${file}: Semantic drift detected`);
          console.log(`   Sidecar hash: ${existingContract.semanticHash}`);
          console.log(`   Current hash: ${recomputed.semanticHash}`);
        } else {
          validCount++;
          if (!argv.quiet) {
            console.log(`✓ ${file}: Valid`);
          }
        }
      } catch (error) {
        errorCount++;
        console.error(`✗ ${file}: ${(error as Error).message}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`✓ Valid: ${validCount}`);
    if (driftCount > 0) {
      console.log(`⚠️  Drift detected: ${driftCount}`);
    }
    if (missingCount > 0) {
      console.log(`⚠️  Missing contracts: ${missingCount}`);
    }
    if (errorCount > 0) {
      console.log(`✗ Errors: ${errorCount}`);
    }
    console.log('='.repeat(50));

    // Exit code logic (parallel to verify command):
    // 0: Success, no drift
    // 2: Drift detected (when --fail-on-drift is set)
    // 1: Other errors
    if (argv.failOnDrift) {
      if (driftCount > 0) {
        process.exit(2); // Drift detected
      } else if (errorCount > 0) {
        process.exit(1); // Other errors
      }
    }
    process.exit(0); // Success
  } catch (error) {
    console.error('Fatal error:', (error as Error).message);
    process.exit(1);
  }
};
