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
    bundlesCompiled: bundles.length,
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
 * Determines the display label for the current mode combination
 */
function getModeLabel(includeCode: 'none' | 'header' | 'full', hasStyle: boolean): string {
  if (includeCode === 'header') {
    return hasStyle ? 'header+style' : 'header';
  }
  if (includeCode === 'full') {
    return hasStyle ? 'full+style' : 'full';
  }
  return includeCode;
}

/**
 * Generate summary output for console.
 * Shows accurate token counts for the current mode only.
 * For detailed mode comparisons, use `stamp context --compare-modes`.
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
      format: 'json' | 'pretty' | 'ndjson' | 'toon';
      hashLock: boolean;
      strict: boolean;
      allowMissing: boolean;
      predictBehavior: boolean;
    };
    quiet?: boolean;
  }
): Promise<void> {
  const modeLabel = getModeLabel(options.includeCode, options.includeStyle === true);

  // Print component summary
  console.log('\n📊 Summary:');
  console.log(`   Total components: ${contracts.length}`);
  console.log(`   Root components: ${manifest.graph.roots.length}`);
  console.log(`   Leaf components: ${manifest.graph.leaves.length}`);
  console.log(`   Bundles compiled: ${bundles.length}`);
  console.log(`   Total nodes in context: ${stats.totalNodes}`);
  console.log(`   Total edges: ${stats.totalEdges}`);
  console.log(`   Missing dependencies: ${stats.totalMissing}`);

  // Print token counts for current mode
  const tokenizerStatus = await getTokenizerStatus();
  const gpt4Method = tokenizerStatus.gpt4 ? 'tiktoken' : 'approximation';
  const claudeMethod = tokenizerStatus.claude ? 'tokenizer' : 'approximation';

  // Calculate savings vs raw source
  const rawGPT4 = tokenEstimates.sourceTokensGPT4;
  const rawClaude = tokenEstimates.sourceTokensClaude;
  const savingsGPT4 = rawGPT4 > 0
    ? Math.round(((rawGPT4 - tokenEstimates.currentGPT4) / rawGPT4) * 100)
    : 0;
  const savingsClaude = rawClaude > 0
    ? Math.round(((rawClaude - tokenEstimates.currentClaude) / rawClaude) * 100)
    : 0;

  console.log(`\n📏 Token Count (${modeLabel} mode):`);
  console.log(`   Raw source:  ${formatTokenCount(rawGPT4)} GPT-4o / ${formatTokenCount(rawClaude)} Claude`);
  console.log(`   ${modeLabel.padEnd(12)} ${formatTokenCount(tokenEstimates.currentGPT4)} GPT-4o / ${formatTokenCount(tokenEstimates.currentClaude)} Claude`);
  console.log(`   Savings:     ~${savingsGPT4}% GPT-4o / ~${savingsClaude}% Claude`);
  console.log(`   Method: GPT-4o (${gpt4Method}) | Claude (${claudeMethod})`);

  // Show tip for missing tokenizers
  if (!tokenizerStatus.gpt4 || !tokenizerStatus.claude) {
    const missing: string[] = [];
    if (!tokenizerStatus.gpt4) missing.push('@dqbd/tiktoken');
    if (!tokenizerStatus.claude) missing.push('@anthropic-ai/tokenizer');
    console.log(`   💡 Install ${missing.join(' and ')} for accurate counts`);
  }

  // Point to --compare-modes for detailed breakdown
  console.log(`\n   For detailed mode comparison, run: stamp context --compare-modes`);

  // Print missing dependencies if any
  if (stats.totalMissing > 0) {
    console.log('\n⚠️  Missing dependencies (external/third-party):');
    const allMissing = new Set<string>();
    bundles.forEach(b => {
      b.meta.missing.forEach(dep => allMissing.add(dep.name));
    });

    const MAX_DISPLAY = 10;
    Array.from(allMissing).slice(0, MAX_DISPLAY).forEach(name => console.log(`   - ${name}`));

    if (allMissing.size > MAX_DISPLAY) {
      console.log(`   ... and ${allMissing.size - MAX_DISPLAY} more`);
    }
  }
}
