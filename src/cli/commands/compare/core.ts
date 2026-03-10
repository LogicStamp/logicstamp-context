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
 * Normalize an object by sorting its keys recursively for stable comparison
 * This ensures objects with the same content but different key order compare as equal
 */
function normalizeObject(obj: Record<string, any>): Record<string, any> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeObject(item));
  }
  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = normalizeObject(obj[key]);
      return acc;
    }, {} as Record<string, any>);
  return sorted;
}

/**
 * Compare two values (primitives or objects) for equality with normalized key order
 */
function valuesEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  return JSON.stringify(normalizeObject(a)) === JSON.stringify(normalizeObject(b));
}

/**
 * Compare two objects with normalized key order
 * Ensures objects with same content but different key order compare as equal
 */
function objectsEqual(a: Record<string, any>, b: Record<string, any>): boolean {
  const aNorm = normalizeObject(a);
  const bNorm = normalizeObject(b);
  return JSON.stringify(aNorm) === JSON.stringify(bNorm);
}

/**
 * Index bundles into a map of entryId -> LiteSig
 */
export function index(bundles: LogicStampBundle[], normalize = false): Map<string, LiteSig> {
  const m = new Map<string, LiteSig>();
  for (const b of bundles) {
    for (const n of b.graph.nodes) {
      const c = n.contract;
      // Extract full props/emits objects with types for comparison
      // Filter out any invalid prop/emit names (like stringified objects)
      const rawProps = c.interface?.props ?? {};
      const rawEmits = c.interface?.emits ?? {};

      // Filter and build props object with valid keys only
      const propsObj: Record<string, any> = {};
      for (const key of Object.keys(rawProps)) {
        if (typeof key === 'string' &&
            key.length > 0 &&
            !key.includes('\n') &&
            !key.includes('\r') &&
            !key.includes('{') &&
            !key.includes('}') &&
            /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
          propsObj[key] = rawProps[key];
        }
      }

      // Filter and build emits object with valid keys only
      const emitsObj: Record<string, any> = {};
      for (const key of Object.keys(rawEmits)) {
        if (typeof key === 'string' &&
            key.length > 0 &&
            !key.includes('\n') &&
            !key.includes('\r') &&
            !key.includes('{') &&
            !key.includes('}') &&
            /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
          emitsObj[key] = rawEmits[key];
        }
      }

      const sig: LiteSig = {
        semanticHash: c.semanticHash,
        imports: normalize ? normalizeNames(c.composition?.imports ?? []) : (c.composition?.imports ?? []),
        hooks: normalize ? normalizeNames(c.composition?.hooks ?? []) : (c.composition?.hooks ?? []),
        functions: normalize ? normalizeNames(c.composition?.functions ?? []) : (c.composition?.functions ?? []),
        components: normalize ? normalizeNames(c.composition?.components ?? []) : (c.composition?.components ?? []),
        props: propsObj,
        emits: emitsObj,
        variables: normalize ? normalizeNames(c.composition?.variables ?? []) : (c.composition?.variables ?? []),
        state: c.interface?.state ?? {},
        exportKind: typeof c.exports === 'string' ? 'default'
                   : c.exports?.named?.length ? 'named' : 'none',
        apiSignature: c.interface?.apiSignature,
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

      // Props and emits are now Record<string, any> objects
      // We need to detect: added keys, removed keys, and changed types
      const oldProps = a.props ?? {};
      const newProps = b.props ?? {};
      const oldEmits = a.emits ?? {};
      const newEmits = b.emits ?? {};

      // Compare props - detect added, removed, and type changes
      // Note: Type changes are only detected when ignoreHashOnly=false (non-git-baseline mode)
      // because prop values can differ between worktree and working tree due to TS resolution differences
      const propsAdded: string[] = [];
      const propsRemoved: string[] = [];
      const propsChanged: Array<{name: string; old: any; new: any}> = [];

      for (const key of Object.keys(newProps)) {
        if (!(key in oldProps)) {
          propsAdded.push(key);
        } else if (!ignoreHashOnly && !valuesEqual(oldProps[key], newProps[key])) {
          // Only detect type changes in non-git-baseline mode
          propsChanged.push({ name: key, old: oldProps[key], new: newProps[key] });
        }
      }
      for (const key of Object.keys(oldProps)) {
        if (!(key in newProps)) {
          propsRemoved.push(key);
        }
      }

      // Compare emits - detect added, removed, and type changes
      const emitsAdded: string[] = [];
      const emitsRemoved: string[] = [];
      const emitsChanged: Array<{name: string; old: any; new: any}> = [];

      for (const key of Object.keys(newEmits)) {
        if (!(key in oldEmits)) {
          emitsAdded.push(key);
        } else if (!ignoreHashOnly && !valuesEqual(oldEmits[key], newEmits[key])) {
          // Only detect type changes in non-git-baseline mode
          emitsChanged.push({ name: key, old: oldEmits[key], new: newEmits[key] });
        }
      }
      for (const key of Object.keys(oldEmits)) {
        if (!(key in newEmits)) {
          emitsRemoved.push(key);
        }
      }

      // Determine if props/emits have any changes
      const propsHaveChanges = propsAdded.length > 0 || propsRemoved.length > 0 || propsChanged.length > 0;
      const emitsHaveChanges = emitsAdded.length > 0 || emitsRemoved.length > 0 || emitsChanged.length > 0;
      
      const hasNonHashChanges =
        !arraysEqual(a.imports, b.imports, normalize) ||
        !arraysEqual(a.hooks, b.hooks, normalize) ||
        !arraysEqual(a.functions, b.functions, normalize) ||
        !arraysEqual(a.components, b.components, normalize) ||
        !arraysEqual(a.variables, b.variables, normalize) ||
        propsHaveChanges ||
        emitsHaveChanges ||
        !objectsEqual(a.state, b.state) ||
        a.exportKind !== b.exportKind ||
        !objectsEqual(a.apiSignature ?? {}, b.apiSignature ?? {});

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

      // Add props deltas for added/removed props
      if (propsAdded.length > 0 || propsRemoved.length > 0) {
        deltas.push({
          type: 'props',
          old: propsRemoved.sort(),
          new: propsAdded.sort()
        });
      }

      // Add propsChanged delta for type changes
      if (propsChanged.length > 0) {
        deltas.push({
          type: 'propsChanged',
          old: null,
          new: propsChanged.sort((x, y) => x.name.localeCompare(y.name))
        });
      }

      // Add emits deltas for added/removed emits
      if (emitsAdded.length > 0 || emitsRemoved.length > 0) {
        deltas.push({
          type: 'emits',
          old: emitsRemoved.sort(),
          new: emitsAdded.sort()
        });
      }

      // Add emitsChanged delta for type changes
      if (emitsChanged.length > 0) {
        deltas.push({
          type: 'emitsChanged',
          old: null,
          new: emitsChanged.sort((x, y) => x.name.localeCompare(y.name))
        });
      }

      if (!arraysEqual(a.variables, b.variables, normalize)) {
        deltas.push({ type: 'variables', old: a.variables, new: b.variables });
      }

      if (!objectsEqual(a.state, b.state)) {
        deltas.push({ type: 'state', old: a.state, new: b.state });
      }

      if (a.exportKind !== b.exportKind) {
        deltas.push({ type: 'exports', old: a.exportKind, new: b.exportKind });
      }

      if (!objectsEqual(a.apiSignature ?? {}, b.apiSignature ?? {})) {
        deltas.push({ type: 'apiSignature', old: a.apiSignature ?? null, new: b.apiSignature ?? null });
      }

      if (deltas.length > 0) {
        changed.push({ id, deltas });
      }
    }
  }

  // Only removals and changes qualify as drift; additions are growth, not drift
  const status = removed.length === 0 && changed.length === 0
    ? 'PASS'
    : 'DRIFT';

  return { status, added, removed, changed };
}
