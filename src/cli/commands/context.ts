/**
 * Context command - Generates context bundles from React/TypeScript codebases
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { globFiles, readFileWithText, getFolderPath, normalizeEntryId } from '../../utils/fsx.js';
import { buildContract } from '../../core/contractBuilder.js';
import { extractFromFile } from '../../core/astParser.js';
import { extractStyleMetadata } from '../../core/styleExtractor.js';
import { buildDependencyGraph } from '../../core/manifest.js';
import type { UIFContract } from '../../types/UIFContract.js';
import {
  pack,
  type PackOptions,
  type LogicStampBundle,
  type LogicStampIndex,
  type FolderInfo,
} from '../../core/pack.js';
import { estimateGPT4Tokens, estimateClaudeTokens, formatTokenCount, getTokenizerStatus } from '../../utils/tokens.js';
import { validateBundles } from './validate.js';
import { smartGitignoreSetup } from '../../utils/gitignore.js';
import { readConfig, configExists, writeConfig } from '../../utils/config.js';
import { smartLLMContextSetup } from '../../utils/llmContext.js';
import { Project } from 'ts-morph';

/**
 * Normalize path for display (convert backslashes to forward slashes)
 */
function displayPath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Detect if a folder is a root (application entry point) and assign a label
 */
function detectRootFolder(relativePath: string, components: string[]): { isRoot: boolean; rootLabel?: string } {
  // Project root is always a root
  if (relativePath === '.') {
    return { isRoot: true, rootLabel: 'Project Root' };
  }

  // Detect common application entry points
  const pathLower = relativePath.toLowerCase();

  // Next.js app router
  if (pathLower.includes('/app') && components.some(c => c === 'page.tsx' || c === 'layout.tsx')) {
    return { isRoot: true, rootLabel: 'Next.js App' };
  }

  // Examples folder
  if (pathLower.startsWith('examples/') && pathLower.endsWith('/src')) {
    const exampleName = relativePath.split('/')[1];
    return { isRoot: true, rootLabel: `Example: ${exampleName}` };
  }

  // Test fixtures
  if (pathLower.includes('tests/fixtures/') && pathLower.endsWith('/src')) {
    return { isRoot: true, rootLabel: 'Test Fixture' };
  }

  // Root src folder
  if (relativePath === 'src') {
    return { isRoot: true, rootLabel: 'Main Source' };
  }

  // Apps folder (monorepo pattern)
  if (pathLower.startsWith('apps/')) {
    const appName = relativePath.split('/')[1];
    return { isRoot: true, rootLabel: `App: ${appName}` };
  }

  // Default: not a root
  return { isRoot: false };
}

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
  const contracts: UIFContract[] = [];
  let analyzed = 0;
  let totalSourceSize = 0; // Track total source code size for savings calculation

  // Create ts-morph project for style extraction if needed
  let styleProject: Project | undefined;
  if (options.includeStyle) {
    styleProject = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        jsx: 1, // React JSX
        target: 99, // ESNext
      },
    });
  }

  for (const file of files) {
    try {
      // Extract AST from file
      const ast = await extractFromFile(file);

      // Build contract from AST
      const { text } = await readFileWithText(file);
      totalSourceSize += text.length; // Accumulate source size

      // Extract style metadata if requested (separate layer)
      let styleMetadata;
      if (options.includeStyle && styleProject) {
        try {
          const sourceFile = styleProject.addSourceFileAtPath(file);
          styleMetadata = await extractStyleMetadata(sourceFile, file);
        } catch (styleError) {
          // Style extraction is optional - don't fail if it errors
          if (!options.quiet) {
            console.warn(`   ⚠️  Style extraction failed for ${file}`);
          }
        }
      }

      const result = buildContract(file, ast, {
        preset: 'none',
        sourceText: text,
        enablePredictions: options.predictBehavior,
        styleMetadata,
      });

      if (result.contract) {
        contracts.push(result.contract);
        analyzed++;
      }
      } catch (error) {
      // Skip files that can't be analyzed
      if (!options.quiet) {
        console.warn(`   ⚠️  Skipped ${file}: ${(error as Error).message}`);
      }
    }
  }

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

  let bundles: LogicStampBundle[];
  let output: string;

  // Generate context for all root components
  if (!options.quiet) {
    console.log(`📦 Generating context for ${manifest.graph.roots.length} root components (depth=${depth})...`);
  }

  bundles = [];
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
  if (options.format === 'ndjson') {
    output = bundles.map((b, idx) => {
      const bundleWithSchema = {
        $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
        position: `${idx + 1}/${bundles.length}`,
        ...b,
      };
      return JSON.stringify(bundleWithSchema);
    }).join('\n');
  } else if (options.format === 'json') {
    const bundlesWithPosition = bundles.map((b, idx) => ({
      $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
      position: `${idx + 1}/${bundles.length}`,
      ...b,
    }));
    output = JSON.stringify(bundlesWithPosition, null, 2);
  } else {
    // pretty format
    output = bundles.map((b, idx) => {
      const bundleWithSchema = {
        $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
        position: `${idx + 1}/${bundles.length}`,
        ...b,
      };
      const header = `\n# Bundle ${idx + 1}/${bundles.length}: ${b.entryId}`;
      return header + '\n' + JSON.stringify(bundleWithSchema, null, 2);
    }).join('\n\n');
  }

  const elapsed = Date.now() - startTime;

  // Calculate stats
  const totalNodes = bundles.reduce((sum, b) => sum + b.graph.nodes.length, 0);
  const totalEdges = bundles.reduce((sum, b) => sum + b.graph.edges.length, 0);
  const totalMissing = bundles.reduce((sum, b) => sum + b.meta.missing.length, 0);

  // Calculate token counts for actual output (current mode)
  const currentGPT4 = await estimateGPT4Tokens(output);
  const currentClaude = await estimateClaudeTokens(output);

  // Estimate tokens for all three modes
  // Mode comparison helps users understand cost tradeoffs
  const sourceTokensGPT4 = Math.ceil(totalSourceSize / 4);
  const sourceTokensClaude = Math.ceil(totalSourceSize / 4.5);

  // Estimate based on typical ratios observed in practice:
  // - none mode: ~60% of header mode (contracts only, no code snippets)
  // - header mode: baseline (contracts + JSDoc headers)
  // - full mode: header mode + all source code
  const modeEstimates = {
    none: {
      gpt4: Math.ceil(currentGPT4 * 0.6),
      claude: Math.ceil(currentClaude * 0.6),
    },
    header: {
      gpt4: currentGPT4,
      claude: currentClaude,
    },
    full: {
      gpt4: currentGPT4 + sourceTokensGPT4,
      claude: currentClaude + sourceTokensClaude,
    },
  };

  // Calculate savings percentage for current mode vs full
  const savingsGPT4 = modeEstimates.full.gpt4 > 0
    ? ((modeEstimates.full.gpt4 - currentGPT4) / modeEstimates.full.gpt4 * 100).toFixed(0)
    : '0';
  const savingsClaude = modeEstimates.full.claude > 0
    ? ((modeEstimates.full.claude - currentClaude) / modeEstimates.full.claude * 100).toFixed(0)
    : '0';

  // If --compare-modes flag is set, output detailed mode comparison and exit
  if (options.compareModes) {
    const hasStyle = options.includeStyle === true;
    const isHeaderMode = options.includeCode === 'header';
    
    // Calculate header and header+style for comparison
    let headerNoStyleGPT4: number;
    let headerNoStyleClaude: number;
    let headerWithStyleGPT4: number;
    let headerWithStyleClaude: number;
    
    if (isHeaderMode && hasStyle) {
      // Current is header+style - regenerate contracts without style to get accurate count
      headerWithStyleGPT4 = currentGPT4;
      headerWithStyleClaude = currentClaude;
      
      // Rebuild contracts without style metadata to get accurate header token count
      if (!options.quiet) {
        console.log('   Generating without style metadata for accurate comparison...');
      }
      
      const noStyleContracts: UIFContract[] = [];
      for (const file of files) {
        try {
          const ast = await extractFromFile(file);
          const { text } = await readFileWithText(file);
          
          const result = buildContract(file, ast, {
            preset: 'none',
            sourceText: text,
            enablePredictions: options.predictBehavior,
            styleMetadata: undefined, // Explicitly no style
          });
          
          if (result.contract) {
            noStyleContracts.push(result.contract);
          }
        } catch (error) {
          // Skip files that can't be analyzed
        }
      }
      
      // Generate bundles with no-style contracts
      const noStyleContractsMap = new Map(noStyleContracts.map(c => [c.entryId, c]));
      const noStyleBundles = await Promise.all(
        manifest.graph.roots.map(rootId =>
          pack(rootId, manifest, {
            depth: options.depth,
            includeCode: options.includeCode,
            maxNodes: options.maxNodes,
            contractsMap: noStyleContractsMap,
            format: options.format,
            hashLock: options.hashLock || false,
            strict: options.strict || false,
            allowMissing: options.allowMissing !== false,
          }, projectRoot)
        )
      );
      
      // Format no-style bundles to get token count
      let noStyleOutput = '';
      if (options.format === 'ndjson') {
        noStyleOutput = noStyleBundles.map((b, idx) => {
          const bundleWithSchema = {
            $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
            position: `${idx + 1}/${noStyleBundles.length}`,
            ...b,
          };
          return JSON.stringify(bundleWithSchema);
        }).join('\n');
      } else if (options.format === 'json') {
        const bundlesWithPosition = noStyleBundles.map((b, idx) => ({
          $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
          position: `${idx + 1}/${noStyleBundles.length}`,
          ...b,
        }));
        noStyleOutput = JSON.stringify(bundlesWithPosition, null, 2);
      } else {
        noStyleOutput = noStyleBundles.map((b, idx) => {
          const bundleWithSchema = {
            $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
            position: `${idx + 1}/${noStyleBundles.length}`,
            ...b,
          };
          const header = `\n# Bundle ${idx + 1}/${noStyleBundles.length}: ${b.entryId}`;
          return header + '\n' + JSON.stringify(bundleWithSchema, null, 2);
        }).join('\n\n');
      }
      
      headerNoStyleGPT4 = await estimateGPT4Tokens(noStyleOutput);
      headerNoStyleClaude = await estimateClaudeTokens(noStyleOutput);
    } else if (isHeaderMode && !hasStyle) {
      // Current is header without style - regenerate contracts with style to get accurate count
      headerNoStyleGPT4 = currentGPT4;
      headerNoStyleClaude = currentClaude;
      
      // Rebuild contracts with style metadata to get accurate header+style token count
      if (!options.quiet) {
        console.log('   Generating with style metadata for accurate comparison...');
      }
      
      const styleProject = new Project({
        skipAddingFilesFromTsConfig: true,
        compilerOptions: {
          jsx: 1,
          target: 99,
        },
      });
      
      const styleContracts: UIFContract[] = [];
      for (const file of files) {
        try {
          const ast = await extractFromFile(file);
          const { text } = await readFileWithText(file);
          
          let styleMetadata;
          try {
            const sourceFile = styleProject.addSourceFileAtPath(file);
            styleMetadata = await extractStyleMetadata(sourceFile, file);
          } catch (styleError) {
            // Style extraction is optional
          }
          
          const result = buildContract(file, ast, {
            preset: 'none',
            sourceText: text,
            enablePredictions: options.predictBehavior,
            styleMetadata,
          });
          
          if (result.contract) {
            styleContracts.push(result.contract);
          }
        } catch (error) {
          // Skip files that can't be analyzed
        }
      }
      
      // Generate bundles with style-enabled contracts
      const styleContractsMap = new Map(styleContracts.map(c => [c.entryId, c]));
      const styleBundles = await Promise.all(
        manifest.graph.roots.map(rootId =>
          pack(rootId, manifest, {
            depth: options.depth,
            includeCode: options.includeCode,
            maxNodes: options.maxNodes,
            contractsMap: styleContractsMap,
            format: options.format,
            hashLock: options.hashLock || false,
            strict: options.strict || false,
            allowMissing: options.allowMissing !== false,
          }, projectRoot)
        )
      );
      
      // Format style bundles to get token count
      let styleOutput = '';
      if (options.format === 'ndjson') {
        styleOutput = styleBundles.map((b, idx) => {
          const bundleWithSchema = {
            $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
            position: `${idx + 1}/${styleBundles.length}`,
            ...b,
          };
          return JSON.stringify(bundleWithSchema);
        }).join('\n');
      } else if (options.format === 'json') {
        const bundlesWithPosition = styleBundles.map((b, idx) => ({
          $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
          position: `${idx + 1}/${styleBundles.length}`,
          ...b,
        }));
        styleOutput = JSON.stringify(bundlesWithPosition, null, 2);
      } else {
        styleOutput = styleBundles.map((b, idx) => {
          const bundleWithSchema = {
            $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
            position: `${idx + 1}/${styleBundles.length}`,
            ...b,
          };
          const header = `\n# Bundle ${idx + 1}/${styleBundles.length}: ${b.entryId}`;
          return header + '\n' + JSON.stringify(bundleWithSchema, null, 2);
        }).join('\n\n');
      }
      
      headerWithStyleGPT4 = await estimateGPT4Tokens(styleOutput);
      headerWithStyleClaude = await estimateClaudeTokens(styleOutput);
    } else {
      // Estimate for non-header modes
      headerNoStyleGPT4 = Math.ceil(currentGPT4 * 0.75);
      headerNoStyleClaude = Math.ceil(currentClaude * 0.75);
      headerWithStyleGPT4 = Math.ceil(currentGPT4 * 0.85);
      headerWithStyleClaude = Math.ceil(currentClaude * 0.85);
    }
    
    // Calculate savings percentages vs raw source
    const headerSavingsGPT4 = sourceTokensGPT4 > 0
      ? ((sourceTokensGPT4 - headerNoStyleGPT4) / sourceTokensGPT4 * 100).toFixed(0)
      : '0';
    const headerStyleSavingsGPT4 = sourceTokensGPT4 > 0
      ? ((sourceTokensGPT4 - headerWithStyleGPT4) / sourceTokensGPT4 * 100).toFixed(0)
      : '0';
    
    // Check tokenizer status
    const tokenizerStatus = await getTokenizerStatus();
    const gpt4Method = tokenizerStatus.gpt4 ? 'tiktoken' : 'approximation';
    const claudeMethod = tokenizerStatus.claude ? 'tokenizer' : 'approximation';
    
    console.log('\n📊 Mode Comparison\n');
    console.log(`   Token estimation: GPT-4o (${gpt4Method}) | Claude (${claudeMethod})`);
    if (!tokenizerStatus.gpt4 || !tokenizerStatus.claude) {
      const missing: string[] = [];
      if (!tokenizerStatus.gpt4) {
        missing.push('@dqbd/tiktoken (GPT-4)');
      }
      if (!tokenizerStatus.claude) {
        missing.push('@anthropic-ai/tokenizer (Claude)');
      }
      console.log(`   💡 Tip: Install ${missing.join(' and/or ')} for accurate token counts`);
    }
    console.log('\n   Comparison:');
    console.log('     Mode         | Tokens GPT-4o | Tokens Claude | Savings vs Raw Source');
    console.log('     -------------|---------------|---------------|------------------------');
    console.log(`     Raw source   | ${formatTokenCount(sourceTokensGPT4).padStart(13)} | ${formatTokenCount(sourceTokensClaude).padStart(13)} | 0%`);
    console.log(`     Header       | ${formatTokenCount(headerNoStyleGPT4).padStart(13)} | ${formatTokenCount(headerNoStyleClaude).padStart(13)} | ${headerSavingsGPT4}%`);
    console.log(`     Header+style | ${formatTokenCount(headerWithStyleGPT4).padStart(13)} | ${formatTokenCount(headerWithStyleClaude).padStart(13)} | ${headerStyleSavingsGPT4}%`);
    console.log('\n   Mode breakdown:');
    console.log('     Mode         | Tokens GPT-4o | Tokens Claude | Savings vs Full Context');
    console.log('     -------------|---------------|---------------|--------------------------');

    const modes: Array<{ name: string; gpt4: number; claude: number }> = [
      { name: 'none', gpt4: modeEstimates.none.gpt4, claude: modeEstimates.none.claude },
      { name: 'header', gpt4: headerNoStyleGPT4, claude: headerNoStyleClaude },
      { name: 'header+style', gpt4: headerWithStyleGPT4, claude: headerWithStyleClaude },
      { name: 'full', gpt4: modeEstimates.full.gpt4, claude: modeEstimates.full.claude },
    ];

    modes.forEach(mode => {
      const savings = modeEstimates.full.gpt4 > 0
        ? ((modeEstimates.full.gpt4 - mode.gpt4) / modeEstimates.full.gpt4 * 100).toFixed(0)
        : '0';

      console.log(
        `     ${mode.name.padEnd(13)} | ${formatTokenCount(mode.gpt4).padStart(13)} | ${formatTokenCount(mode.claude).padStart(13)} | ${savings}%`
      );
    });

    console.log(`\n⏱  Completed in ${elapsed}ms`);
    return;
  }

  // If --stats flag is set, output one-line JSON and exit
  // Stats Output Contract (for CI parsing):
  // {
  //   totalComponents: number,      // Total .ts/.tsx files analyzed
  //   rootComponents: number,        // Components with no dependencies (entry points)
  //   leafComponents: number,        // Components that are only dependencies (no imports)
  //   bundlesGenerated: number,      // Number of bundles created (one per root)
  //   totalNodes: number,            // Sum of all nodes across all bundles
  //   totalEdges: number,            // Sum of all edges across all bundles
  //   missingDependencies: number,   // Count of unresolved dependencies (third-party/external)
  //   tokensGPT4: number,            // Estimated GPT-4 tokens (current mode)
  //   tokensClaude: number,          // Estimated Claude tokens (current mode)
  //   modeEstimates: object,         // Token estimates for all modes (none/header/full)
  //   savingsGPT4: string,           // Savings percentage for GPT-4 (current vs full)
  //   savingsClaude: string,         // Savings percentage for Claude (current vs full)
  //   elapsedMs: number              // Time taken in milliseconds
  // }
  if (options.stats) {
    const stats = {
      totalComponents: contracts.length,
      rootComponents: manifest.graph.roots.length,
      leafComponents: manifest.graph.leaves.length,
      bundlesGenerated: bundles.length,
      totalNodes,
      totalEdges,
      missingDependencies: totalMissing,
      tokensGPT4: currentGPT4,
      tokensClaude: currentClaude,
      modeEstimates: {
        none: { gpt4: modeEstimates.none.gpt4, claude: modeEstimates.none.claude },
        header: { gpt4: modeEstimates.header.gpt4, claude: modeEstimates.header.claude },
        full: { gpt4: modeEstimates.full.gpt4, claude: modeEstimates.full.claude },
      },
      savingsGPT4,
      savingsClaude,
      elapsedMs: elapsed,
    };
    console.log(JSON.stringify(stats));
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

    // Group bundles by folder
    const bundlesByFolder = new Map<string, LogicStampBundle[]>();

    for (const bundle of bundles) {
      const folderPath = getFolderPath(bundle.entryId);

      if (!bundlesByFolder.has(folderPath)) {
        bundlesByFolder.set(folderPath, []);
      }

      bundlesByFolder.get(folderPath)!.push(bundle);
    }

    // Prepare folder metadata and write files
    if (!options.quiet) {
      console.log(`📝 Writing context files for ${bundlesByFolder.size} folders...`);
    }
    let filesWritten = 0;
    const normalizedRoot = normalizeEntryId(projectRoot);
    const folderInfos: FolderInfo[] = [];
    let totalTokenEstimate = 0;

    for (const [folderPath, folderBundles] of bundlesByFolder) {
      // Sort bundles for deterministic output
      folderBundles.sort((a, b) => a.entryId.localeCompare(b.entryId));

      // Calculate relative path from project root
      let relativePath: string;
      if (folderPath === normalizedRoot) {
        relativePath = '.';
      } else if (folderPath.startsWith(normalizedRoot + '/')) {
        relativePath = folderPath.substring(normalizedRoot.length + 1);
      } else {
        relativePath = folderPath;
      }

      // Extract component file names from bundle entryIds
      const components = folderBundles.map(b => {
        const normalized = normalizeEntryId(b.entryId);
        const lastSlash = normalized.lastIndexOf('/');
        return lastSlash !== -1 ? normalized.substring(lastSlash + 1) : normalized;
      });

      // Detect if this is a root folder
      const { isRoot, rootLabel } = detectRootFolder(relativePath, components);

      // Format bundles for this folder
      let folderOutput: string;
      if (options.format === 'ndjson') {
        folderOutput = folderBundles.map((b, idx) => {
          const bundleWithSchema = {
            $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
            position: `${idx + 1}/${folderBundles.length}`,
            ...b,
          };
          return JSON.stringify(bundleWithSchema);
        }).join('\n');
      } else if (options.format === 'json') {
        const bundlesWithPosition = folderBundles.map((b, idx) => ({
          $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
          position: `${idx + 1}/${folderBundles.length}`,
          ...b,
        }));
        folderOutput = JSON.stringify(bundlesWithPosition, null, 2);
      } else {
        // pretty format
        folderOutput = folderBundles.map((b, idx) => {
          const bundleWithSchema = {
            $schema: 'https://logicstamp.dev/schemas/context/v0.1.json',
            position: `${idx + 1}/${folderBundles.length}`,
            ...b,
          };
          const header = `\n# Bundle ${idx + 1}/${folderBundles.length}: ${b.entryId}`;
          return header + '\n' + JSON.stringify(bundleWithSchema, null, 2);
        }).join('\n\n');
      }

      // Estimate tokens for this folder's context file
      const folderTokenEstimate = await estimateGPT4Tokens(folderOutput);
      totalTokenEstimate += folderTokenEstimate;

      // Write folder's context.json to output directory maintaining relative structure
      const contextFileName = relativePath === '.' ? 'context.json' : join(relativePath, 'context.json');
      const contextFilePath = relativePath === '.' ? 'context.json' : `${relativePath}/context.json`;
      const folderContextPath = join(outputDir, contextFileName);
      await mkdir(dirname(folderContextPath), { recursive: true });
      await writeFile(folderContextPath, folderOutput, 'utf8');
      filesWritten++;
      if (!options.quiet) {
        console.log(`   ✓ ${displayPath(folderContextPath)} (${folderBundles.length} bundles)`);
      }

      // Add to folder info array
      folderInfos.push({
        path: relativePath === '.' ? '.' : relativePath,
        contextFile: contextFilePath,
        bundles: folderBundles.length,
        components: components.sort(),
        isRoot,
        rootLabel,
        tokenEstimate: folderTokenEstimate,
      });
    }

    // Write context_main.json as metadata index
    const mainContextPath = join(outputDir, 'context_main.json');
    if (!options.quiet) {
      console.log(`📝 Writing main context index...`);
    }

    // Sort folders by path for deterministic output
    folderInfos.sort((a, b) => a.path.localeCompare(b.path));

    // Create index structure
    const index: LogicStampIndex = {
      type: 'LogicStampIndex',
      schemaVersion: '0.1',
      projectRoot: '.',
      projectRootResolved: normalizedRoot,
      createdAt: new Date().toISOString(),
      summary: {
        totalComponents: contracts.length,
        totalBundles: bundles.length,
        totalFolders: bundlesByFolder.size,
        totalTokenEstimate,
      },
      folders: folderInfos,
      meta: {
        source: 'logicstamp-context@0.1.1',
      },
    };

    const indexOutput = JSON.stringify(index, null, 2);
    await writeFile(mainContextPath, indexOutput, 'utf8');
    if (options.quiet && !options.suppressSuccessIndicator) {
      // Minimal output in quiet mode (unless suppressed for internal calls)
      process.stdout.write('✓\n');
    } else if (!options.quiet) {
      console.log(`   ✓ ${displayPath(mainContextPath)} (index of ${bundlesByFolder.size} folders)`);
      console.log(`✅ ${filesWritten + 1} context files written successfully`);
    }

    // Auto-create config with safe defaults if it doesn't exist (first run)
    let configCreated = false;
    try {
      if (!await configExists(projectRoot)) {
        await writeConfig(projectRoot, {
          gitignorePreference: 'skipped',
          llmContextPreference: 'skipped',
        });
        configCreated = true;
        if (!options.quiet) {
          console.log('\n💡 No LogicStamp config found – created .logicstamp/config.json with safe defaults (no .gitignore changes).');
          console.log('   Run `stamp init` to customize behavior.\n');
        }
      }
    } catch (error) {
      // Ignore config creation errors - not critical
    }

    // Determine skipGitignore: CLI flag OR config says skip OR no config (default to skip)
    const config = await readConfig(projectRoot);
    const shouldSkipGitignore = 
      options.skipGitignore || 
      config.gitignorePreference === 'skipped' ||
      !config.gitignorePreference; // default to skip if no preference

    // Smart .gitignore setup (no prompting - only init prompts)
    try {
      const { added, created, skipped } = await smartGitignoreSetup(projectRoot, {
        skipGitignore: shouldSkipGitignore,
      });

      // Only show output if patterns were actually added (config preference was 'added')
      if (added && !options.quiet) {
        if (created) {
          console.log('\n📝 Created .gitignore with LogicStamp patterns');
        } else {
          console.log('\n📝 Added LogicStamp patterns to .gitignore');
        }
      }
    } catch (error) {
      // Silently ignore gitignore errors - not critical to context generation
      // Users can run `stamp init` manually if needed
    }

    // Smart LLM_CONTEXT.md setup (no prompting - only init prompts)
    try {
      const { added } = await smartLLMContextSetup(projectRoot);

      // Only show output if file was actually created (config preference was 'added')
      if (added && !options.quiet) {
        console.log('\n📝 Created LLM_CONTEXT.md');
      }
    } catch (error) {
      // Silently ignore LLM_CONTEXT.md errors - not critical to context generation
    }
  } else {
    if (!options.quiet) {
      console.log('🔍 Dry run - no file written');
    }
  }

  // Print summary (skip in quiet mode)
  if (!options.quiet) {
    console.log('\n📊 Summary:');
    console.log(`   Total components: ${contracts.length}`);
    console.log(`   Root components: ${manifest.graph.roots.length}`);
    console.log(`   Leaf components: ${manifest.graph.leaves.length}`);
    console.log(`   Bundles generated: ${bundles.length}`);
    console.log(`   Total nodes in context: ${totalNodes}`);
    console.log(`   Total edges: ${totalEdges}`);
    console.log(`   Missing dependencies: ${totalMissing}`);
    // Determine mode label and calculate header comparisons
    const hasStyle = options.includeStyle === true;
    const isHeaderMode = options.includeCode === 'header';
    
    let modeLabel: string;
    let headerNoStyleGPT4: number;
    let headerNoStyleClaude: number;
    let headerWithStyleGPT4: number;
    let headerWithStyleClaude: number;
    
    if (isHeaderMode && hasStyle) {
      modeLabel = 'header+style';
      // Current output IS header+style, estimate header without style
      headerNoStyleGPT4 = Math.ceil(currentGPT4 * 0.88); // Style typically adds ~12%
      headerNoStyleClaude = Math.ceil(currentClaude * 0.88);
      headerWithStyleGPT4 = currentGPT4;
      headerWithStyleClaude = currentClaude;
    } else if (isHeaderMode && !hasStyle) {
      modeLabel = 'header';
      // Current output IS header without style, estimate header+style
      headerNoStyleGPT4 = currentGPT4;
      headerNoStyleClaude = currentClaude;
      headerWithStyleGPT4 = Math.ceil(currentGPT4 * 1.14); // Style adds ~14%
      headerWithStyleClaude = Math.ceil(currentClaude * 1.14);
    } else {
      modeLabel = options.includeCode === 'full' ? 'full+style' : options.includeCode;
      // For non-header modes, estimate header values for comparison
      headerNoStyleGPT4 = Math.ceil(currentGPT4 * 0.75); // Rough estimate
      headerNoStyleClaude = Math.ceil(currentClaude * 0.75);
      headerWithStyleGPT4 = Math.ceil(currentGPT4 * 0.85); // Rough estimate
      headerWithStyleClaude = Math.ceil(currentClaude * 0.85);
    }
    
    // Calculate savings percentages vs raw source
    const headerSavingsGPT4 = sourceTokensGPT4 > 0
      ? ((sourceTokensGPT4 - headerNoStyleGPT4) / sourceTokensGPT4 * 100).toFixed(0)
      : '0';
    const headerStyleSavingsGPT4 = sourceTokensGPT4 > 0
      ? ((sourceTokensGPT4 - headerWithStyleGPT4) / sourceTokensGPT4 * 100).toFixed(0)
      : '0';
    
    console.log(`\n📏 Token Estimates (${modeLabel} mode):`);
    console.log(`   GPT-4o-mini: ${formatTokenCount(currentGPT4)} tokens`);
    console.log(`   Claude:      ${formatTokenCount(currentClaude)} tokens`);
    console.log(`\n   Comparison:`);
    console.log(`     Mode         | Tokens GPT-4o | Tokens Claude | Savings vs Raw Source`);
    console.log(`     -------------|---------------|---------------|------------------------`);
    console.log(`     Raw source   | ${formatTokenCount(sourceTokensGPT4).padStart(13)} | ${formatTokenCount(sourceTokensClaude).padStart(13)} | 0%`);
    console.log(`     Header       | ${formatTokenCount(headerNoStyleGPT4).padStart(13)} | ${formatTokenCount(headerNoStyleClaude).padStart(13)} | ${headerSavingsGPT4}%`);
    console.log(`     Header+style | ${formatTokenCount(headerWithStyleGPT4).padStart(13)} | ${formatTokenCount(headerWithStyleClaude).padStart(13)} | ${headerStyleSavingsGPT4}%`);
    console.log(`\n   Full context (code+style): ~${formatTokenCount(modeEstimates.full.gpt4)} GPT-4o-mini / ~${formatTokenCount(modeEstimates.full.claude)} Claude`);

    console.log(`\n📊 Mode Comparison:`);
    console.log(`   none:       ~${formatTokenCount(modeEstimates.none.gpt4)} tokens`);
    console.log(`   header:     ~${formatTokenCount(modeEstimates.header.gpt4)} tokens`);
    console.log(`   full:       ~${formatTokenCount(modeEstimates.full.gpt4)} tokens`);

    if (totalMissing > 0) {
      console.log('\n⚠️  Missing dependencies (external/third-party):');
      const allMissing = new Set<string>();
      bundles.forEach(b => {
        b.meta.missing.forEach(dep => allMissing.add(dep.name));
      });
      Array.from(allMissing).slice(0, 10).forEach(name => console.log(`   - ${name}`));
      if (allMissing.size > 10) {
        console.log(`   ... and ${allMissing.size - 10} more`);
      }
    }

    console.log(`\n⏱  Completed in ${elapsed}ms`);
  }

  // Exit with non-zero code if --strict-missing is enabled and there are missing dependencies
  if (options.strictMissing && totalMissing > 0) {
    console.error(`\n❌ Strict missing mode: ${totalMissing} missing dependencies found`);
    process.exit(1);
  }
}
