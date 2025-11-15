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
  functions: string[];
  components: string[];
  props: string[];
  emits: string[];
}

export interface CompareResult {
  status: 'PASS' | 'DRIFT';
  added: string[];
  removed: string[];
  changed: Array<{
    id: string;
    deltas: Array<{
      type: 'hash' | 'imports' | 'hooks' | 'exports' | 'functions' | 'components' | 'props' | 'emits';
      old: any;
      new: any;
    }>;
  }>;
}

export interface CompareOptions {
  oldFile: string;
  newFile: string;
  stats?: boolean;
  approve?: boolean;
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
        functions: c.version?.functions ?? [],
        components: c.version?.components ?? [],
        props: Object.keys(c.logicSignature?.props ?? {}),
        emits: Object.keys(c.logicSignature?.emits ?? {}),
        exportKind: typeof c.exports === 'string' ? 'default'
                   : c.exports?.named?.length ? 'named' : 'none',
      });
    }
  }
  return m;
}

/**
 * Diff two indexed bundles with detailed change information
 */
function diff(oldIdx: Map<string, LiteSig>, newIdx: Map<string, LiteSig>): CompareResult {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: CompareResult['changed'] = [];

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

  // Find changed components with detailed deltas
  for (const id of newIdx.keys()) {
    if (oldIdx.has(id)) {
      const a = oldIdx.get(id)!;
      const b = newIdx.get(id)!;
      const deltas: CompareResult['changed'][number]['deltas'] = [];

      if (a.semanticHash !== b.semanticHash) {
        deltas.push({ type: 'hash', old: a.semanticHash, new: b.semanticHash });
      }

      if (JSON.stringify(a.imports) !== JSON.stringify(b.imports)) {
        deltas.push({ type: 'imports', old: a.imports, new: b.imports });
      }

      if (JSON.stringify(a.hooks) !== JSON.stringify(b.hooks)) {
        deltas.push({ type: 'hooks', old: a.hooks, new: b.hooks });
      }

      if (JSON.stringify(a.functions) !== JSON.stringify(b.functions)) {
        deltas.push({ type: 'functions', old: a.functions, new: b.functions });
      }

      if (JSON.stringify(a.components) !== JSON.stringify(b.components)) {
        deltas.push({ type: 'components', old: a.components, new: b.components });
      }

      if (JSON.stringify(a.props) !== JSON.stringify(b.props)) {
        deltas.push({ type: 'props', old: a.props, new: b.props });
      }

      if (JSON.stringify(a.emits) !== JSON.stringify(b.emits)) {
        deltas.push({ type: 'emits', old: a.emits, new: b.emits });
      }

      if (a.exportKind !== b.exportKind) {
        deltas.push({ type: 'exports', old: a.exportKind, new: b.exportKind });
      }

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
 * Returns the comparison result instead of exiting, allowing caller to handle approval logic
 */
export async function compareCommand(options: CompareOptions): Promise<CompareResult> {
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
        deltas.forEach(delta => {
          console.log(`    Δ ${delta.type}`);

          if (delta.type === 'hash') {
            console.log(`      old: ${delta.old}`);
            console.log(`      new: ${delta.new}`);
          } else if (delta.type === 'imports' || delta.type === 'hooks' || delta.type === 'functions' ||
                     delta.type === 'components' || delta.type === 'props' || delta.type === 'emits') {
            const oldSet = new Set(delta.old);
            const newSet = new Set(delta.new);

            // Find removed items
            const removed = delta.old.filter((item: string) => !newSet.has(item));
            // Find added items
            const added = delta.new.filter((item: string) => !oldSet.has(item));

            if (removed.length > 0) {
              removed.forEach((item: string) => console.log(`      - ${item}`));
            }
            if (added.length > 0) {
              added.forEach((item: string) => console.log(`      + ${item}`));
            }
            if (removed.length === 0 && added.length === 0) {
              // Order changed but items are the same
              console.log(`      (order changed)`);
            }
          } else if (delta.type === 'exports') {
            console.log(`      ${delta.old} → ${delta.new}`);
          }
        });
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

  return result;
}
