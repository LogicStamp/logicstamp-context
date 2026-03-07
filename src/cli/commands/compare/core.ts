/**
 * Core comparison logic - indexing and diffing bundles
 */

import type { LogicStampBundle } from '../../../core/pack.js';
import type { LiteSig, CompareResult } from './types.js';

/**
 * Normalize a component/hook/function name for comparison
 * Strips relative paths and normalizes casing
 */
export function normalizeName(name: string): string {
  // Strip relative path prefixes (./, ../, ../../, etc.)
  let stripped = name;
  while (stripped.startsWith('./') || stripped.startsWith('../')) {
    stripped = stripped.replace(/^\.\.?\//, '');
  }
  // Extract just the basename (last part after /)
  const basename = stripped.includes('/') ? stripped.split('/').pop()! : stripped;
  // Normalize to lowercase for case-insensitive comparison
  return basename.toLowerCase();
}

/**
 * Normalize an array of names for comparison
 */
export function normalizeNames(names: string[]): string[] {
  return [...names].map(normalizeName).sort();
}

/**
 * Index bundles into a map of entryId -> LiteSig
 */
export function index(bundles: LogicStampBundle[], normalize = false): Map<string, LiteSig> {
  const m = new Map<string, LiteSig>();
  for (const b of bundles) {
    for (const n of b.graph.nodes) {
      const c = n.contract;
      const sig: LiteSig = {
        semanticHash: c.semanticHash,
        imports: normalize ? normalizeNames(c.composition?.imports ?? []) : (c.composition?.imports ?? []),
        hooks: normalize ? normalizeNames(c.composition?.hooks ?? []) : (c.composition?.hooks ?? []),
        functions: normalize ? normalizeNames(c.composition?.functions ?? []) : (c.composition?.functions ?? []),
        components: normalize ? normalizeNames(c.composition?.components ?? []) : (c.composition?.components ?? []),
        props: Object.keys(c.interface?.props ?? {}),
        emits: Object.keys(c.interface?.emits ?? {}),
        variables: normalize ? normalizeNames(c.composition?.variables ?? []) : (c.composition?.variables ?? []),
        state: c.interface?.state ?? {},
        exportKind: typeof c.exports === 'string' ? 'default'
                   : c.exports?.named?.length ? 'named' : 'none',
      };
      m.set(c.entryId.toLowerCase(), sig);
    }
  }
  return m;
}

/**
 * Compare two arrays with optional normalization
 * Always sorts arrays for order-independence
 */
export function arraysEqual(a: string[], b: string[], normalize = false): boolean {
  if (normalize) {
    const aNorm = normalizeNames(a);
    const bNorm = normalizeNames(b);
    return JSON.stringify(aNorm) === JSON.stringify(bNorm);
  }
  // Sort both arrays for order-independence
  const aSorted = [...a].sort();
  const bSorted = [...b].sort();
  return JSON.stringify(aSorted) === JSON.stringify(bSorted);
}

/**
 * Diff two indexed bundles with detailed change information
 * @param ignoreHashOnly - If true, ignore hash-only changes (useful for git baseline comparisons where hash may differ due to TypeScript project resolution differences between worktree and working directory contexts)
 */
export function diff(oldIdx: Map<string, LiteSig>, newIdx: Map<string, LiteSig>, normalize = false, ignoreHashOnly = false): CompareResult {
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

      // Check for non-hash changes first
      const hasNonHashChanges = 
        !arraysEqual(a.imports, b.imports, normalize) ||
        !arraysEqual(a.hooks, b.hooks, normalize) ||
        !arraysEqual(a.functions, b.functions, normalize) ||
        !arraysEqual(a.components, b.components, normalize) ||
        !arraysEqual(a.variables, b.variables, normalize) ||
        JSON.stringify(a.props) !== JSON.stringify(b.props) ||
        JSON.stringify(a.emits) !== JSON.stringify(b.emits) ||
        JSON.stringify(a.state) !== JSON.stringify(b.state) ||
        a.exportKind !== b.exportKind;

      // Only include hash change if there are other changes, or if ignoreHashOnly is false
      if (a.semanticHash !== b.semanticHash && (!ignoreHashOnly || hasNonHashChanges)) {
        deltas.push({ type: 'hash', old: a.semanticHash, new: b.semanticHash });
      }

      if (!arraysEqual(a.imports, b.imports, normalize)) {
        deltas.push({ type: 'imports', old: a.imports, new: b.imports });
      }

      if (!arraysEqual(a.hooks, b.hooks, normalize)) {
        deltas.push({ type: 'hooks', old: a.hooks, new: b.hooks });
      }

      if (!arraysEqual(a.functions, b.functions, normalize)) {
        deltas.push({ type: 'functions', old: a.functions, new: b.functions });
      }

      if (!arraysEqual(a.components, b.components, normalize)) {
        deltas.push({ type: 'components', old: a.components, new: b.components });
      }

      if (JSON.stringify(a.props) !== JSON.stringify(b.props)) {
        deltas.push({ type: 'props', old: a.props, new: b.props });
      }

      if (JSON.stringify(a.emits) !== JSON.stringify(b.emits)) {
        deltas.push({ type: 'emits', old: a.emits, new: b.emits });
      }

      if (!arraysEqual(a.variables, b.variables, normalize)) {
        deltas.push({ type: 'variables', old: a.variables, new: b.variables });
      }

      if (JSON.stringify(a.state) !== JSON.stringify(b.state)) {
        deltas.push({ type: 'state', old: a.state, new: b.state });
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
