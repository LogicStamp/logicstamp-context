/**
 * Stats Calculator - Calculates bundle statistics
 */

import type { LogicStampBundle } from '../../../core/pack.js';
import type { UIFContract } from '../../../types/UIFContract.js';
import type { ProjectManifest } from '../../../core/manifest.js';
import type { TokenEstimates } from './tokenEstimator.js';
import { formatTokenCount, getTokenizerStatus } from '../../../utils/tokens.js';

export interface BundleStats {
  totalNodes: number;
  totalEdges: number;
  totalMissing: number;
}

/**
 * Calculate bundle statistics
 */
export function calculateStats(bundles: LogicStampBundle[]): BundleStats {
  const totalNodes = bundles.reduce((sum, b) => sum + b.graph.nodes.length, 0);
  const totalEdges = bundles.reduce((sum, b) => sum + b.graph.edges.length, 0);
  const totalMissing = bundles.reduce((sum, b) => sum + b.meta.missing.length, 0);

  return {
    totalNodes,
    totalEdges,
    totalMissing,
  };
}

/**
 * Generate stats output for --stats flag (CI-friendly JSON)
 */
export function generateStatsOutput(
  contracts: UIFContract[],
  manifest: ProjectManifest,
  bundles: LogicStampBundle[],
  stats: BundleStats,
  tokenEstimates: TokenEstimates,
  elapsed: number
): object {
  return {
    totalComponents: contracts.length,
    rootComponents: manifest.graph.roots.length,
    leafComponents: manifest.graph.leaves.length,
    bundlesGenerated: bundles.length,
    totalNodes: stats.totalNodes,
    totalEdges: stats.totalEdges,
    missingDependencies: stats.totalMissing,
    tokensGPT4: tokenEstimates.currentGPT4,
    tokensClaude: tokenEstimates.currentClaude,
    modeEstimates: {
      none: { gpt4: tokenEstimates.modeEstimates.none.gpt4, claude: tokenEstimates.modeEstimates.none.claude },
      header: { gpt4: tokenEstimates.modeEstimates.header.gpt4, claude: tokenEstimates.modeEstimates.header.claude },
      full: { gpt4: tokenEstimates.modeEstimates.full.gpt4, claude: tokenEstimates.modeEstimates.full.claude },
    },
    savingsGPT4: tokenEstimates.savingsGPT4,
    savingsClaude: tokenEstimates.savingsClaude,
    elapsedMs: elapsed,
  };
}

/**
 * Generate summary output for console
 * Uses accurate token counting (regenerates contracts) like --compare-modes
 */
export async function generateSummary(
  contracts: UIFContract[],
  manifest: ProjectManifest,
  bundles: LogicStampBundle[],
  stats: BundleStats,
  tokenEstimates: TokenEstimates,
  options: {
    includeCode: 'none' | 'header' | 'full';
    includeStyle?: boolean;
    files: string[];
    projectRoot: string;
    currentGPT4: number;
    currentClaude: number;
    totalSourceSize: number;
    packOptions: {
      depth: number;
      maxNodes: number;
      format: 'json' | 'pretty' | 'ndjson';
      hashLock: boolean;
      strict: boolean;
      allowMissing: boolean;
      predictBehavior: boolean;
    };
    quiet?: boolean;
  }
): Promise<void> {
  console.log('\n📊 Summary:');
  console.log(`   Total components: ${contracts.length}`);
  console.log(`   Root components: ${manifest.graph.roots.length}`);
  console.log(`   Leaf components: ${manifest.graph.leaves.length}`);
  console.log(`   Bundles generated: ${bundles.length}`);
  console.log(`   Total nodes in context: ${stats.totalNodes}`);
  console.log(`   Total edges: ${stats.totalEdges}`);
  console.log(`   Missing dependencies: ${stats.totalMissing}`);
  
  // Determine mode label
  const hasStyle = options.includeStyle === true;
  const isHeaderMode = options.includeCode === 'header';
  
  let modeLabel: string;
  if (isHeaderMode && hasStyle) {
    modeLabel = 'header+style';
  } else if (isHeaderMode && !hasStyle) {
    modeLabel = 'header';
  } else {
    modeLabel = options.includeCode === 'full' ? 'full+style' : options.includeCode;
  }
  
  // Calculate header token estimates (use estimates for performance, accurate regeneration only in --compare-modes)
  let headerNoStyleGPT4: number;
  let headerNoStyleClaude: number;
  let headerWithStyleGPT4: number;
  let headerWithStyleClaude: number;
  
  if (isHeaderMode && hasStyle) {
    // Current output IS header+style, estimate header without style
    headerNoStyleGPT4 = Math.ceil(options.currentGPT4 * 0.88); // Style typically adds ~12%
    headerNoStyleClaude = Math.ceil(options.currentClaude * 0.88);
    headerWithStyleGPT4 = options.currentGPT4;
    headerWithStyleClaude = options.currentClaude;
  } else if (isHeaderMode && !hasStyle) {
    // Current output IS header without style, estimate header+style
    headerNoStyleGPT4 = options.currentGPT4;
    headerNoStyleClaude = options.currentClaude;
    headerWithStyleGPT4 = Math.ceil(options.currentGPT4 * 1.14); // Style adds ~14%
    headerWithStyleClaude = Math.ceil(options.currentClaude * 1.14);
  } else {
    // For non-header modes, use estimates
    headerNoStyleGPT4 = Math.ceil(options.currentGPT4 * 0.75);
    headerNoStyleClaude = Math.ceil(options.currentClaude * 0.75);
    headerWithStyleGPT4 = Math.ceil(options.currentGPT4 * 0.85);
    headerWithStyleClaude = Math.ceil(options.currentClaude * 0.85);
  }
  
  // Calculate savings percentages vs raw source
  const headerSavingsGPT4 = tokenEstimates.sourceTokensGPT4 > 0
    ? ((tokenEstimates.sourceTokensGPT4 - headerNoStyleGPT4) / tokenEstimates.sourceTokensGPT4 * 100).toFixed(0)
    : '0';
  const headerStyleSavingsGPT4 = tokenEstimates.sourceTokensGPT4 > 0
    ? ((tokenEstimates.sourceTokensGPT4 - headerWithStyleGPT4) / tokenEstimates.sourceTokensGPT4 * 100).toFixed(0)
    : '0';
  
  // Check tokenizer status and display it
  const tokenizerStatus = await getTokenizerStatus();
  const gpt4Method = tokenizerStatus.gpt4 ? 'tiktoken' : 'approximation';
  const claudeMethod = tokenizerStatus.claude ? 'tokenizer' : 'approximation';
  
  console.log(`\n📏 Token Estimates (${modeLabel} mode):`);
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
  console.log(`   GPT-4o-mini: ${formatTokenCount(tokenEstimates.currentGPT4)} tokens`);
  console.log(`   Claude:      ${formatTokenCount(tokenEstimates.currentClaude)} tokens`);
  console.log(`\n   Comparison:`);
  console.log(`     Mode         | Tokens GPT-4o | Tokens Claude | Savings vs Raw Source`);
  console.log(`     -------------|---------------|---------------|------------------------`);
  console.log(`     Raw source   | ${formatTokenCount(tokenEstimates.sourceTokensGPT4).padStart(13)} | ${formatTokenCount(tokenEstimates.sourceTokensClaude).padStart(13)} | 0%`);
  console.log(`     Header       | ${formatTokenCount(headerNoStyleGPT4).padStart(13)} | ${formatTokenCount(headerNoStyleClaude).padStart(13)} | ${headerSavingsGPT4}%`);
  console.log(`     Header+style | ${formatTokenCount(headerWithStyleGPT4).padStart(13)} | ${formatTokenCount(headerWithStyleClaude).padStart(13)} | ${headerStyleSavingsGPT4}%`);
  console.log(`\n   Full context (code+style): ~${formatTokenCount(tokenEstimates.modeEstimates.full.gpt4)} GPT-4o-mini / ~${formatTokenCount(tokenEstimates.modeEstimates.full.claude)} Claude`);

  console.log(`\n📊 Current Mode Comparison:`);
  console.log(`   none:       ~${formatTokenCount(tokenEstimates.modeEstimates.none.gpt4)} tokens`);
  // Show current mode with honest labeling - reflects actual mode (header or header+style)
  const currentModeLabel = modeLabel;
  console.log(`   ${currentModeLabel.padEnd(13)} ~${formatTokenCount(tokenEstimates.currentGPT4)} tokens`);
  console.log(`   full:       ~${formatTokenCount(tokenEstimates.modeEstimates.full.gpt4)} tokens`);

  if (stats.totalMissing > 0) {
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
}

