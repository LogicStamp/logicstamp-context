/**
 * Token Estimator - Calculates token counts and mode comparisons
 */

import { estimateGPT4Tokens, estimateClaudeTokens, formatTokenCount, getTokenizerStatus } from '../../../utils/tokens.js';
import type { LogicStampBundle } from '../../../core/pack.js';
import type { UIFContract } from '../../../types/UIFContract.js';
import type { ProjectManifest } from '../../../core/manifest.js';
import type { PackOptions } from '../../../core/pack.js';
import { pack } from '../../../core/pack.js';
import { buildContract } from '../../../core/contractBuilder.js';
import { extractFromFile } from '../../../core/astParser.js';
import { extractStyleMetadata } from '../../../core/styleExtractor.js';
import { readFileWithText } from '../../../utils/fsx.js';
import { Project } from 'ts-morph';
import { formatBundles } from './bundleFormatter.js';

export interface TokenEstimates {
  currentGPT4: number;
  currentClaude: number;
  sourceTokensGPT4: number;
  sourceTokensClaude: number;
  modeEstimates: {
    none: { gpt4: number; claude: number };
    header: { gpt4: number; claude: number };
    full: { gpt4: number; claude: number };
  };
  savingsGPT4: string;
  savingsClaude: string;
}

export interface ModeComparisonResult {
  headerNoStyleGPT4: number;
  headerNoStyleClaude: number;
  headerWithStyleGPT4: number;
  headerWithStyleClaude: number;
  sourceTokensGPT4: number;
  sourceTokensClaude: number;
  modeEstimates: {
    none: { gpt4: number; claude: number };
    header: { gpt4: number; claude: number };
    headerStyle: { gpt4: number; claude: number };
    full: { gpt4: number; claude: number };
  };
}

/**
 * Calculate token estimates for current output
 */
export async function calculateTokenEstimates(
  output: string,
  totalSourceSize: number,
  currentGPT4: number,
  currentClaude: number
): Promise<TokenEstimates> {
  // Estimate tokens for all three modes
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

  return {
    currentGPT4,
    currentClaude,
    sourceTokensGPT4,
    sourceTokensClaude,
    modeEstimates,
    savingsGPT4,
    savingsClaude,
  };
}

/**
 * Generate mode comparison by rebuilding contracts with/without style
 */
export async function generateModeComparison(
  files: string[],
  manifest: ProjectManifest,
  projectRoot: string,
  currentGPT4: number,
  currentClaude: number,
  totalSourceSize: number,
  options: {
    includeCode: 'none' | 'header' | 'full';
    includeStyle?: boolean;
    depth: number;
    maxNodes: number;
    format: 'json' | 'pretty' | 'ndjson';
    hashLock: boolean;
    strict: boolean;
    allowMissing: boolean;
    predictBehavior: boolean;
    quiet?: boolean;
  }
): Promise<ModeComparisonResult> {
  const hasStyle = options.includeStyle === true;
  const isHeaderMode = options.includeCode === 'header';
  
  // Calculate actual source size tokens using tokenizers when available
  // Read all source files and concatenate to get accurate token counts
  let actualSourceTokensGPT4: number;
  let actualSourceTokensClaude: number;
  
  try {
    // Read all source files and concatenate
    const sourceTexts: string[] = [];
    for (const file of files) {
      try {
        const { text } = await readFileWithText(file);
        sourceTexts.push(text);
      } catch (error) {
        // Skip files that can't be read
      }
    }
    const concatenatedSource = sourceTexts.join('\n\n');
    
    // Use actual tokenizers if available, otherwise fall back to approximation
    actualSourceTokensGPT4 = await estimateGPT4Tokens(concatenatedSource);
    actualSourceTokensClaude = await estimateClaudeTokens(concatenatedSource);
  } catch (error) {
    // Fallback to character-based approximation if tokenization fails
    actualSourceTokensGPT4 = Math.ceil(totalSourceSize / 4);
    actualSourceTokensClaude = Math.ceil(totalSourceSize / 4.5);
  }
  
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
    const noStyleBundles = await Promise.allSettled(
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
    // Filter out failed bundles, keep only successful ones
    const successfulNoStyleBundles = noStyleBundles
      .filter((result): result is PromiseFulfilledResult<LogicStampBundle> => result.status === 'fulfilled')
      .map(result => result.value);
    
    // Format no-style bundles to get token count
    const noStyleOutput = formatBundles(successfulNoStyleBundles, options.format);
    
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
    const styleBundles = await Promise.allSettled(
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
    // Filter out failed bundles, keep only successful ones
    const successfulStyleBundles = styleBundles
      .filter((result): result is PromiseFulfilledResult<LogicStampBundle> => result.status === 'fulfilled')
      .map(result => result.value);
    
    // Format style bundles to get token count
    const styleOutput = formatBundles(successfulStyleBundles, options.format);
    
    headerWithStyleGPT4 = await estimateGPT4Tokens(styleOutput);
    headerWithStyleClaude = await estimateClaudeTokens(styleOutput);
  } else {
    // Estimate for non-header modes
    headerNoStyleGPT4 = Math.ceil(currentGPT4 * 0.75);
    headerNoStyleClaude = Math.ceil(currentClaude * 0.75);
    headerWithStyleGPT4 = Math.ceil(currentGPT4 * 0.85);
    headerWithStyleClaude = Math.ceil(currentClaude * 0.85);
  }
  
  // Calculate mode estimates
  const modeEstimates = {
    none: {
      gpt4: Math.ceil(headerNoStyleGPT4 * 0.6),
      claude: Math.ceil(headerNoStyleClaude * 0.6),
    },
    header: {
      gpt4: headerNoStyleGPT4,
      claude: headerNoStyleClaude,
    },
    headerStyle: {
      gpt4: headerWithStyleGPT4,
      claude: headerWithStyleClaude,
    },
    full: {
      gpt4: headerNoStyleGPT4 + actualSourceTokensGPT4,
      claude: headerNoStyleClaude + actualSourceTokensClaude,
    },
  };
  
  return {
    headerNoStyleGPT4,
    headerNoStyleClaude,
    headerWithStyleGPT4,
    headerWithStyleClaude,
    sourceTokensGPT4: actualSourceTokensGPT4,
    sourceTokensClaude: actualSourceTokensClaude,
    modeEstimates,
  };
}

/**
 * Display mode comparison table
 */
export async function displayModeComparison(
  comparison: ModeComparisonResult,
  files: string[],
  elapsed: number
): Promise<void> {
  const { headerNoStyleGPT4, headerNoStyleClaude, headerWithStyleGPT4, headerWithStyleClaude, sourceTokensGPT4, sourceTokensClaude, modeEstimates } = comparison;
  
  // Calculate file statistics (check .tsx first to avoid double-counting)
  const tsxFiles = files.filter(f => f.endsWith('.tsx')).length;
  const tsFiles = files.filter(f => f.endsWith('.ts') && !f.endsWith('.tsx')).length;
  const totalFiles = files.length;
  
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
  console.log(`   Files analyzed: ${totalFiles} total (${tsFiles} .ts, ${tsxFiles} .tsx)`);
  console.log(`   Scope: TypeScript/React source files only (test files excluded)`);
  if (!tokenizerStatus.gpt4 || !tokenizerStatus.claude) {
    const missing: string[] = [];
    if (!tokenizerStatus.gpt4) {
      missing.push('@dqbd/tiktoken (GPT-4)');
    }
    if (!tokenizerStatus.claude) {
      missing.push('@anthropic-ai/tokenizer (Claude)');
    }
    console.log(`   💡 Tip: Tokenizers are included as optional dependencies. If installation failed, manually install ${missing.join(' and/or ')} for accurate token counts`);
  }
  console.log('\n   Comparison vs Raw Source:');
  console.log('');
  console.log('     (Raw source = all .ts/.tsx files concatenated, excluding tests)');
  console.log('');
  console.log('     Mode         | Tokens GPT-4o | Tokens Claude | Savings vs Raw Source');
  console.log('     -------------|---------------|---------------|------------------------');
  console.log(`     Raw source   | ${formatTokenCount(sourceTokensGPT4).padStart(13)} | ${formatTokenCount(sourceTokensClaude).padStart(13)} | 0%`);
  console.log(`     Header       | ${formatTokenCount(headerNoStyleGPT4).padStart(13)} | ${formatTokenCount(headerNoStyleClaude).padStart(13)} | ${headerSavingsGPT4}%`);
  console.log(`     Header+style | ${formatTokenCount(headerWithStyleGPT4).padStart(13)} | ${formatTokenCount(headerWithStyleClaude).padStart(13)} | ${headerStyleSavingsGPT4}%`);
  console.log('\n   Mode breakdown:');
  console.log('');
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
}

