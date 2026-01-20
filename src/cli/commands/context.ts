/**
 * Context command - Generates context bundles from React/TypeScript codebases
 */

import { resolve, dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { debugError } from '../../utils/debug.js';
import { globFiles } from '../../utils/fsx.js';
import { readStampignore, filterIgnoredFiles } from '../../utils/stampignore.js';
import { buildDependencyGraph } from '../../core/manifest.js';
import type { UIFContract } from '../../types/UIFContract.js';
import {
  pack,
  type PackOptions,
  type LogicStampBundle,
} from '../../core/pack.js';
import { estimateGPT4Tokens, estimateClaudeTokens } from '../../utils/tokens.js';
import { validateBundles } from './validate.js';
import {
  buildContractsFromFiles,
  formatBundles,
  calculateTokenEstimates,
  generateModeComparison,
  displayModeComparison,
  calculateStats,
  generateStatsOutput,
  generateSummary,
  writeContextFiles,
  writeMainIndex,
  groupBundlesByFolder,
  displayPath,
  ensureConfigExists,
  setupGitignore,
  setupLLMContext,
  initializeWatchCache,
  type WatchCache,
} from './context/index.js';
import { getAndResetSanitizeStats } from '../../core/pack/index.js';
import { startWatchMode } from './context/watchMode.js';

export interface ContextOptions {
  entry?: string;
  depth: number;
  includeCode: 'none' | 'header' | 'full';
  format: 'json' | 'pretty' | 'ndjson' | 'toon';
  out: string;
  hashLock: boolean;
  strict: boolean;
  allowMissing: boolean;
  maxNodes: number;
  profile: 'llm-safe' | 'llm-chat' | 'ci-strict' | 'watch-fast';
  predictBehavior: boolean;
  dryRun: boolean;
  stats: boolean;
  strictMissing: boolean;
  compareModes: boolean;
  skipGitignore?: boolean;
  quiet?: boolean;
  suppressSuccessIndicator?: boolean; // When true, don't output ✓ even in quiet mode (for internal calls)
  includeStyle?: boolean; // Extract style metadata (Tailwind, SCSS, animations, layout)
  watch?: boolean; // Watch for file changes and regenerate context automatically
  debug?: boolean; // Enable debug output (shows hashes in watch mode)
  logFile?: boolean; // Write watch mode logs to file (default: false)
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
  let files = await globFiles(projectRoot);

  // Step 1.5: Filter files based on .stampignore
  const stampignore = await readStampignore(projectRoot);
  if (stampignore && stampignore.ignore.length > 0) {
    const originalCount = files.length;
    files = filterIgnoredFiles(files, stampignore.ignore, projectRoot);
    if (!options.quiet && files.length < originalCount) {
      console.log(`   Excluded ${originalCount - files.length} file(s) via .stampignore`);
    }
  }

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
  const { contracts, analyzed, totalSourceSize } = await buildContractsFromFiles(files, projectRoot, {
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

  // Apply profile settings (only if user hasn't explicitly set the option)
  // Check if user explicitly set options by looking for flags in argv
  const userSetIncludeCode = process.argv.some((arg, i) => 
    (arg === '--include-code' || arg === '-c') && process.argv[i + 1]);
  const userSetDepth = process.argv.some((arg, i) => 
    (arg === '--depth' || arg === '-d') && process.argv[i + 1]);
  
  let depth = options.depth;
  let includeCode = options.includeCode;
  let hashLock = options.hashLock;
  let strict = options.strict;

  if (options.profile === 'llm-safe') {
    depth = userSetDepth ? options.depth : 2;
    includeCode = userSetIncludeCode ? options.includeCode : 'header';
    hashLock = false;
    options.maxNodes = 30;
    options.allowMissing = true;
    if (!options.quiet) {
      const codeMode = includeCode === 'full' ? 'full code' : includeCode === 'none' ? 'no code' : 'header only';
      console.log(`📋 Using profile: llm-safe (depth=${depth}, ${codeMode}, max 30 nodes)`);
    }
  } else if (options.profile === 'llm-chat') {
    depth = userSetDepth ? options.depth : 2;
    includeCode = userSetIncludeCode ? options.includeCode : 'header';
    hashLock = false;
    if (!options.quiet) {
      const codeMode = includeCode === 'full' ? 'full code' : includeCode === 'none' ? 'no code' : 'header only';
      console.log(`📋 Using profile: llm-chat (depth=${depth}, ${codeMode}, max 100 nodes)`);
    }
  } else if (options.profile === 'ci-strict') {
    includeCode = userSetIncludeCode ? options.includeCode : 'none';
    hashLock = false;
    strict = true;
    if (!options.quiet) {
      const codeMode = includeCode === 'full' ? 'full code' : includeCode === 'header' ? 'header only' : 'no code';
      console.log(`📋 Using profile: ci-strict (${codeMode}, strict dependencies)`);
    }
  } else if (options.profile === 'watch-fast') {
    depth = userSetDepth ? options.depth : 2;
    includeCode = userSetIncludeCode ? options.includeCode : 'header';
    hashLock = false;
    // For watch-fast, use lighter style extraction (will be handled in style extractor)
    if (!options.quiet) {
      const codeMode = includeCode === 'full' ? 'full code' : includeCode === 'none' ? 'no code' : 'header only';
      console.log(`📋 Using profile: watch-fast (depth=${depth}, ${codeMode}, lighter style extraction)`);
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
    
    // If --stats is also set, write comparison data to JSON file
    if (options.stats) {
      // Determine output directory from --out option
      const outPath = resolve(options.out);
      const outputDir = outPath.endsWith('.json') ? dirname(outPath) : outPath;
      
      // Create output directory if it doesn't exist
      try {
        await mkdir(outputDir, { recursive: true });
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        debugError('context', 'contextCommand', {
          outputDir,
          operation: 'mkdir',
          message: err.message,
          code: err.code,
        });
        throw new Error(`Failed to create output directory "${outputDir}": ${err.code === 'EACCES' ? 'Permission denied' : err.message}`);
      }
      
      // Write comparison data to JSON file
      const compareModesPath = join(outputDir, 'context_compare_modes.json');
      
      const compareModesData = {
        type: 'LogicStampCompareModes',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        elapsed,
        files: {
          total: files.length,
          ts: files.filter(f => f.endsWith('.ts') && !f.endsWith('.tsx')).length,
          tsx: files.filter(f => f.endsWith('.tsx')).length,
        },
        comparison,
      };
      
      try {
        await writeFile(compareModesPath, JSON.stringify(compareModesData, null, 2), 'utf8');
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        debugError('context', 'contextCommand', {
          compareModesPath,
          operation: 'writeFile',
          message: err.message,
          code: err.code,
        });
        
        let userMessage: string;
        switch (err.code) {
          case 'ENOENT':
            userMessage = `Parent directory not found for: "${compareModesPath}"`;
            break;
          case 'EACCES':
            userMessage = `Permission denied writing to: "${compareModesPath}"`;
            break;
          case 'ENOSPC':
            userMessage = `No space left on device. Cannot write: "${compareModesPath}"`;
            break;
          default:
            userMessage = `Failed to write comparison data "${compareModesPath}": ${err.message}`;
        }
        throw new Error(userMessage);
      }
      
      if (!options.quiet) {
        console.log(`\n📝 Written comparison data to ${displayPath(compareModesPath)}`);
      }
    } else {
      // Only display comparison if --stats is not set
      await displayModeComparison(comparison, files, elapsed);
    }
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

    // Display sanitization summary
    const sanitizeStats = getAndResetSanitizeStats();
    if (sanitizeStats.filesWithSecrets > 0) {
      console.log(`\n⚠️  Secret sanitization: Replaced ${sanitizeStats.totalSecretsReplaced} secret(s) in ${sanitizeStats.filesWithSecrets} file(s)`);
      console.log(`   Secrets were replaced with "PRIVATE_DATA" in generated JSON files`);
    } else {
      console.log(`\n✅ Generated context verified - no secret patterns detected`);
    }

    console.log(`\n⏱  Completed in ${elapsed}ms`);
  }

  // Exit with non-zero code if --strict-missing is enabled and there are missing dependencies
  // Skip exit in watch mode to allow continuous watching
  if (options.strictMissing && stats.totalMissing > 0 && !options.watch) {
    console.error(`\n❌ Strict missing mode: ${stats.totalMissing} missing dependencies found`);
    process.exit(1);
  }

  // If watch mode is enabled, start watching for file changes
  // Note: Watch mode is incompatible with --stats and --compare-modes (they return early)
  if (options.watch) {
    if (options.stats || options.compareModes) {
      console.error(`❌ Watch mode is incompatible with --stats and --compare-modes`);
      process.exit(1);
    }
    // Initialize watch cache BEFORE starting watch mode so first change can use incremental rebuild
    const watchCache = await initializeWatchCache(files, contracts, manifest, bundles, projectRoot);
    await startWatchMode(options, projectRoot, watchCache);
  }
}
