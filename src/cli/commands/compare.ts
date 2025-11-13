/**
 * Compare command - Diffs two context.json files
 * Detects added/removed components and changed signatures
 */

import { readFile } from 'node:fs/promises';
import type { LogicStampBundle } from '../../core/pack.js';
import { estimateGPT4Tokens, estimateClaudeTokens, formatTokenCount } from '../../utils/tokens.js';

interface LiteSig {
  semanticHash: string;
  imports: string[];
  hooks: string[];
  exportKind: 'default' | 'named' | 'none';
}

interface CompareResult {
  status: 'PASS' | 'DRIFT';
  added: string[];
  removed: string[];
  changed: Array<{ id: string; deltas: string[] }>;
}

export interface CompareOptions {
  oldFile: string;
  newFile: string;
  stats?: boolean;
}

/**
 * Index bundles into a map of entryId -> LiteSig
 */
function index(bundles: LogicStampBundle[]): Map<string, LiteSig> {
  const m = new Map<string, LiteSig>();
  for (const b of bundles) {
    for (const n of b.graph.nodes) {
      const c = n.contract;
      m.set(c.entryId.toLowerCase(), {
        semanticHash: c.semanticHash,
        imports: c.version?.imports ?? [],
        hooks: c.version?.hooks ?? [],
        exportKind: typeof c.exports === 'string' ? 'default'
                   : c.exports?.named?.length ? 'named' : 'none',
      });
    }
  }
  return m;
}

/**
 * Diff two indexed bundles
 */
function diff(oldIdx: Map<string, LiteSig>, newIdx: Map<string, LiteSig>): CompareResult {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: Array<{ id: string; deltas: string[] }> = [];

  // Find added components
  for (const id of newIdx.keys()) {
    if (!oldIdx.has(id)) {
      added.push(id);
    }
  }

  // Find removed components
  for (const id of oldIdx.keys()) {
    if (!newIdx.has(id)) {
      removed.push(id);
    }
  }

  // Find changed components
  for (const id of newIdx.keys()) {
    if (oldIdx.has(id)) {
      const a = oldIdx.get(id)!;
      const b = newIdx.get(id)!;
      const deltas: string[] = [];

      if (a.semanticHash !== b.semanticHash) deltas.push('hash');
      if (JSON.stringify(a.imports) !== JSON.stringify(b.imports)) deltas.push('imports');
      if (JSON.stringify(a.hooks) !== JSON.stringify(b.hooks)) deltas.push('hooks');
      if (a.exportKind !== b.exportKind) deltas.push('exports');

      if (deltas.length > 0) {
        changed.push({ id, deltas });
      }
    }
  }

  const status = added.length === 0 && removed.length === 0 && changed.length === 0
    ? 'PASS'
    : 'DRIFT';

  return { status, added, removed, changed };
}

/**
 * Calculate token count for bundles
 */
function calculateTokens(bundles: LogicStampBundle[]): { gpt4: number; claude: number } {
  const text = JSON.stringify(bundles);
  return {
    gpt4: estimateGPT4Tokens(text),
    claude: estimateClaudeTokens(text),
  };
}

/**
 * Main compare command
 */
export async function compareCommand(options: CompareOptions): Promise<void> {
  // Load both files
  const oldContent = await readFile(options.oldFile, 'utf8');
  const newContent = await readFile(options.newFile, 'utf8');

  const oldBundles: LogicStampBundle[] = JSON.parse(oldContent);
  const newBundles: LogicStampBundle[] = JSON.parse(newContent);

  // Index bundles
  const oldIdx = index(oldBundles);
  const newIdx = index(newBundles);

  // Compute diff
  const result = diff(oldIdx, newIdx);

  // Output result
  console.log(`\n${result.status === 'PASS' ? '✅' : '⚠️'}  ${result.status}\n`);

  if (result.status === 'DRIFT') {
    if (result.added.length > 0) {
      console.log(`Added components: ${result.added.length}`);
      result.added.forEach(id => console.log(`  + ${id}`));
      console.log();
    }

    if (result.removed.length > 0) {
      console.log(`Removed components: ${result.removed.length}`);
      result.removed.forEach(id => console.log(`  - ${id}`));
      console.log();
    }

    if (result.changed.length > 0) {
      console.log(`Changed components: ${result.changed.length}`);
      result.changed.forEach(({ id, deltas }) => {
        console.log(`  ~ ${id}`);
        console.log(`    Δ ${deltas.join(', ')}`);
      });
      console.log();
    }
  }

  // Show token stats if requested
  if (options.stats) {
    const oldTokens = calculateTokens(oldBundles);
    const newTokens = calculateTokens(newBundles);
    const deltaStat = newTokens.gpt4 - oldTokens.gpt4;
    const deltaPercent = ((deltaStat / oldTokens.gpt4) * 100).toFixed(2);

    console.log('Token Stats:');
    console.log(`  Old: ${formatTokenCount(oldTokens.gpt4)} (GPT-4o-mini) | ${formatTokenCount(oldTokens.claude)} (Claude)`);
    console.log(`  New: ${formatTokenCount(newTokens.gpt4)} (GPT-4o-mini) | ${formatTokenCount(newTokens.claude)} (Claude)`);
    console.log(`  Δ ${deltaStat > 0 ? '+' : ''}${formatTokenCount(deltaStat)} (${deltaPercent > '0' ? '+' : ''}${deltaPercent}%)\n`);
  }

  // Exit with error if drift detected
  if (result.status === 'DRIFT') {
    process.exit(1);
  }
}
