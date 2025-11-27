/**
 * Context command - Generates context bundles from React/TypeScript codebases
 */

import { resolve, dirname } from 'node:path';
import { globFiles } from '../../utils/fsx.js';
import { buildDependencyGraph } from '../../core/manifest.js';
import type { UIFContract } from '../../types/UIFContract.js';
import {
  pack,
  type PackOptions,
  type LogicStampBundle,
} from '../../core/pack.js';
import { estimateGPT4Tokens, estimateClaudeTokens } from '../../utils/tokens.js';
import { validateBundles } from './validate.js';
import { buildContractsFromFiles } from './context/contractBuilder.js';
import { formatBundles } from './context/bundleFormatter.js';
import { calculateTokenEstimates, generateModeComparison, displayModeComparison } from './context/tokenEstimator.js';
import { calculateStats, generateStatsOutput, generateSummary } from './context/statsCalculator.js';
import { writeContextFiles, writeMainIndex, groupBundlesByFolder, displayPath } from './context/fileWriter.js';
import { ensureConfigExists, setupGitignore, setupLLMContext } from './context/configManager.js';

export interface ContextOptions {
  entry?: string;
  depth: number;
  includeCode: 'none' | 'header' | 'full';
  format: 'json' | 'pretty' | 'ndjson';
  out: string;
  hashLock: boolean;
  strict: boolean;
  allowMissing: boolean;
  maxNodes: number;
  profile: 'llm-safe' | 'llm-chat' | 'ci-strict';
  predictBehavior: boolean;
  dryRun: boolean;
  stats: boolean;
  strictMissing: boolean;
  compareModes: boolean;
  skipGitignore?: boolean;
  quiet?: boolean;
  suppressSuccessIndicator?: boolean; // When true, don't output ✓ even in quiet mode (for internal calls)
  includeStyle?: boolean; // Extract style metadata (Tailwind, SCSS, animations, layout)
}

export async function contextCommand(options: ContextOptions): Promise<void> {
  const startTime = Date.now();

  // Determine the target directory
  const targetPath = options.entry || '.';
  const projectRoot = resolve(targetPath);

  if (!options.quiet) {
    console.log(`🔍 Scanning ${displayPath(projectRoot)}...`);
  }

  // Step 1: Find all React/TS files
  const files = await globFiles(projectRoot);

  if (files.length === 0) {
    console.error(`❌ No React/TypeScript modules found under ${displayPath(projectRoot)}`);
    console.error(`   Try: logicstamp-context ./src or --depth 0 to scan all directories`);
    process.exit(1);
  }

  if (!options.quiet) {
    console.log(`   Found ${files.length} files`);
  }

  // Step 2: Build contracts for all files
  if (!options.quiet) {
    console.log(`🔨 Analyzing components...`);
  }
  const { contracts, analyzed, totalSourceSize } = await buildContractsFromFiles(files, {
    includeStyle: options.includeStyle,
    predictBehavior: options.predictBehavior,
    quiet: options.quiet,
  });

  if (!options.quiet) {
    console.log(`   Analyzed ${analyzed} components`);
  }

  if (contracts.length === 0) {
    console.error('❌ No components found to analyze');
    console.error(`   Files were found but could not be analyzed as React/TypeScript components`);
    console.error(`   Ensure your files contain valid React components or TypeScript modules`);
    process.exit(1);
  }

  // Step 3: Build dependency graph (manifest)
  if (!options.quiet) {
    console.log(`📊 Building dependency graph...`);
  }
  const manifest = buildDependencyGraph(contracts);

  // Step 3.5: Create contracts map for pack function
  const contractsMap = new Map<string, UIFContract>();
  for (const contract of contracts) {
    contractsMap.set(contract.entryId, contract);
  }

  // Apply profile settings
  let depth = options.depth;
  let includeCode = options.includeCode;
  let hashLock = options.hashLock;
  let strict = options.strict;

  if (options.profile === 'llm-safe') {
    depth = 1;
    includeCode = 'header';
    hashLock = false;
    options.maxNodes = 30;
    options.allowMissing = true;
    if (!options.quiet) {
      console.log('📋 Using profile: llm-safe (depth=1, header only, max 30 nodes)');
    }
  } else if (options.profile === 'llm-chat') {
    depth = 1;
    includeCode = 'header';
    hashLock = false;
    if (!options.quiet) {
      console.log('📋 Using profile: llm-chat (depth=1, header only, max 100 nodes)');
    }
  } else if (options.profile === 'ci-strict') {
    includeCode = 'none';
    hashLock = false;
    strict = true;
    if (!options.quiet) {
      console.log('📋 Using profile: ci-strict (no code, strict dependencies)');
    }
  }

  // Step 4: Pack context bundles
  const packOptions: PackOptions = {
    depth,
    includeCode,
    format: options.format,
    hashLock,
    strict,
    allowMissing: options.allowMissing,
    maxNodes: options.maxNodes,
    contractsMap, // Pass in-memory contracts
  };

  // Generate context for all root components
  if (!options.quiet) {
    console.log(`📦 Generating context for ${manifest.graph.roots.length} root components (depth=${depth})...`);
  }

  const bundles: LogicStampBundle[] = [];
  for (const rootId of manifest.graph.roots) {
    try {
      const bundle = await pack(rootId, manifest, packOptions, projectRoot);
      bundles.push(bundle);
    } catch (error) {
      if (!options.quiet) {
        console.warn(`   ⚠️  Failed to pack ${rootId}: ${(error as Error).message}`);
      }
    }
  }

  if (bundles.length === 0) {
    console.error('❌ No bundles could be generated');
    process.exit(1);
  }

  // Sort bundles by entryId for deterministic output
  bundles.sort((a, b) => a.entryId.localeCompare(b.entryId));

  // Combine all bundles into output
  const output = formatBundles(bundles, options.format);

  const elapsed = Date.now() - startTime;

  // Calculate stats
  const stats = calculateStats(bundles);

  // Calculate token counts for actual output (current mode)
  const currentGPT4 = await estimateGPT4Tokens(output);
  const currentClaude = await estimateClaudeTokens(output);

  // Calculate token estimates
  const tokenEstimates = await calculateTokenEstimates(output, totalSourceSize, currentGPT4, currentClaude);

  // If --compare-modes flag is set, output detailed mode comparison and exit
  if (options.compareModes) {
    const comparison = await generateModeComparison(
      files,
      manifest,
      projectRoot,
      currentGPT4,
      currentClaude,
      totalSourceSize,
      {
        includeCode: options.includeCode,
        includeStyle: options.includeStyle,
        depth: options.depth,
        maxNodes: options.maxNodes,
        format: options.format,
        hashLock: options.hashLock,
        strict: options.strict,
        allowMissing: options.allowMissing,
        predictBehavior: options.predictBehavior,
        quiet: options.quiet,
      }
    );
    
    await displayModeComparison(comparison, elapsed);
    return;
  }

  // If --stats flag is set, output one-line JSON and exit
  if (options.stats) {
    const statsOutput = generateStatsOutput(
      contracts,
      manifest,
      bundles,
      stats,
      tokenEstimates,
      elapsed
    );
    console.log(JSON.stringify(statsOutput));
    return;
  }

  // Validate bundles before writing
  if (!options.quiet) {
    console.log(`🔍 Validating generated context...`);
  }
  const bundlesWithSchema = bundles.map((b, idx) => ({
    $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
    position: `${idx + 1}/${bundles.length}`,
    ...b,
  }));
  const validation = validateBundles(bundlesWithSchema as LogicStampBundle[]);

  if (!validation.valid) {
    console.error(`\n❌ Validation failed: ${validation.errors} error(s)`);
    validation.messages.forEach(msg => console.error(`   ${msg}`));
    process.exit(1);
  }

  if (!options.quiet) {
    if (validation.warnings > 0) {
      console.log(`⚠️  ${validation.warnings} warning(s) during validation`);
      validation.messages.filter(msg => !msg.includes('error')).forEach(msg => console.log(`   ${msg}`));
    } else {
      console.log(`✅ Validation passed`);
    }
  }

  // Write output unless --dry-run
  if (!options.dryRun) {
    // Determine output directory from --out option
    // If --out points to a .json file, use its directory; otherwise use it as the directory
    const outPath = resolve(options.out);
    const outputDir = outPath.endsWith('.json') ? dirname(outPath) : outPath;

    // Write context files
    const { filesWritten, folderInfos, totalTokenEstimate } = await writeContextFiles(
      bundles,
      outputDir,
      projectRoot,
      {
        format: options.format,
        quiet: options.quiet,
      }
    );

    // Write main index
    await writeMainIndex(
      outputDir,
      folderInfos,
      contracts,
      bundles,
      groupBundlesByFolder(bundles).size,
      totalTokenEstimate,
      projectRoot,
      {
        quiet: options.quiet,
        suppressSuccessIndicator: options.suppressSuccessIndicator,
      }
    );

    if (!options.quiet) {
      console.log(`✅ ${filesWritten + 1} context files written successfully`);
    }

    // Auto-create config with safe defaults if it doesn't exist (first run)
    await ensureConfigExists(projectRoot, { quiet: options.quiet });

    // Smart .gitignore setup (no prompting - only init prompts)
    await setupGitignore(projectRoot, {
      skipGitignore: options.skipGitignore,
      quiet: options.quiet,
    });

    // Smart LLM_CONTEXT.md setup (no prompting - only init prompts)
    await setupLLMContext(projectRoot, { quiet: options.quiet });
  } else {
    if (!options.quiet) {
      console.log('🔍 Dry run - no file written');
    }
  }

  // Print summary (skip in quiet mode)
  if (!options.quiet) {
    await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
      includeCode: options.includeCode,
      includeStyle: options.includeStyle,
      files,
      projectRoot,
      currentGPT4,
      currentClaude,
      totalSourceSize,
      packOptions: {
        depth,
        maxNodes: options.maxNodes,
        format: options.format,
        hashLock,
        strict,
        allowMissing: options.allowMissing,
        predictBehavior: options.predictBehavior,
      },
      quiet: options.quiet,
    });

    console.log(`\n⏱  Completed in ${elapsed}ms`);
  }

  // Exit with non-zero code if --strict-missing is enabled and there are missing dependencies
  if (options.strictMissing && stats.totalMissing > 0) {
    console.error(`\n❌ Strict missing mode: ${stats.totalMissing} missing dependencies found`);
    process.exit(1);
  }
}
