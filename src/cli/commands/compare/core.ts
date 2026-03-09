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
 * Normalize an object by sorting its keys for stable comparison
 * This ensures objects with the same content but different key order compare as equal
 */
function normalizeObject(obj: Record<string, any>): Record<string, any> {
  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {} as Record<string, any>);
  return sorted;
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
      // Extract and sort props/emits keys for deterministic comparison
      // Object.keys() order depends on insertion order, so we sort to ensure consistency
      // BUG FIX: Filter out any non-prop-name strings (like stringified prop objects)
      // Only keep valid prop names (simple identifiers, no newlines, no braces)
      const allPropsKeys = Object.keys(c.interface?.props ?? {});
      const propsKeys = allPropsKeys
        .filter(key => {
          // Filter out stringified prop objects - they contain newlines or braces
          return typeof key === 'string' && 
                 key.length > 0 && 
                 !key.includes('\n') && 
                 !key.includes('\r') && 
                 !key.includes('{') && 
                 !key.includes('}') &&
                 /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key); // Valid identifier
        })
        .sort();
      
      const allEmitsKeys = Object.keys(c.interface?.emits ?? {});
      const emitsKeys = allEmitsKeys
        .filter(key => {
          // Filter out stringified emit objects - they contain newlines or braces
          return typeof key === 'string' && 
                 key.length > 0 && 
                 !key.includes('\n') && 
                 !key.includes('\r') && 
                 !key.includes('{') && 
                 !key.includes('}') &&
                 /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key); // Valid identifier
        })
        .sort();
      
      const sig: LiteSig = {
        semanticHash: c.semanticHash,
        imports: normalize ? normalizeNames(c.composition?.imports ?? []) : (c.composition?.imports ?? []),
        hooks: normalize ? normalizeNames(c.composition?.hooks ?? []) : (c.composition?.hooks ?? []),
        functions: normalize ? normalizeNames(c.composition?.functions ?? []) : (c.composition?.functions ?? []),
        components: normalize ? normalizeNames(c.composition?.components ?? []) : (c.composition?.components ?? []),
        props: normalize ? normalizeNames(propsKeys) : propsKeys,
        emits: normalize ? normalizeNames(emitsKeys) : emitsKeys,
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

      // Ensure props and emits are arrays before comparison
      // CRITICAL: a.props and b.props should ALWAYS be arrays from the index function
      // But defensively handle the case where they might be objects
      let aPropsArray: string[];
      let bPropsArray: string[];
      let aEmitsArray: string[];
      let bEmitsArray: string[];
      
      // CRITICAL: Always ensure props are arrays of prop names (strings), never objects
      // BUG FIX: Filter out stringified prop objects that somehow got into the array
      // These contain newlines/braces and are not valid prop names
      if (Array.isArray(a.props)) {
        // Filter out invalid prop names (stringified objects with newlines/braces)
        aPropsArray = a.props.filter((p): p is string => 
          typeof p === 'string' && 
          p.length > 0 && 
          !p.includes('\n') && 
          !p.includes('\r') && 
          !p.includes('{') && 
          !p.includes('}') &&
          /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p) // Valid identifier
        );
      } else if (a.props && typeof a.props === 'object' && a.props !== null) {
        // If it's an object, extract keys (prop names) and filter invalid ones
        aPropsArray = Object.keys(a.props)
          .filter(key => 
            typeof key === 'string' && 
            key.length > 0 && 
            !key.includes('\n') && 
            !key.includes('\r') && 
            !key.includes('{') && 
            !key.includes('}') &&
            /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
          )
          .sort();
      } else {
        aPropsArray = [];
      }
      
      if (Array.isArray(b.props)) {
        // Filter out invalid prop names (stringified objects with newlines/braces)
        bPropsArray = b.props.filter((p): p is string => 
          typeof p === 'string' && 
          p.length > 0 && 
          !p.includes('\n') && 
          !p.includes('\r') && 
          !p.includes('{') && 
          !p.includes('}') &&
          /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(p) // Valid identifier
        );
      } else if (b.props && typeof b.props === 'object' && b.props !== null) {
        // If it's an object, extract keys (prop names) and filter invalid ones
        bPropsArray = Object.keys(b.props)
          .filter(key => 
            typeof key === 'string' && 
            key.length > 0 && 
            !key.includes('\n') && 
            !key.includes('\r') && 
            !key.includes('{') && 
            !key.includes('}') &&
            /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
          )
          .sort();
      } else {
        bPropsArray = [];
      }
      
      // CRITICAL: Ensure both are arrays of valid prop name strings
      if (!Array.isArray(aPropsArray)) {
        aPropsArray = [];
      }
      if (!Array.isArray(bPropsArray)) {
        bPropsArray = [];
      }
      
      // CRITICAL: Always ensure emits are arrays, never objects
      // Defensively handle both arrays and objects (runtime type checking)
      if (Array.isArray(a.emits)) {
        aEmitsArray = a.emits;
      } else if (a.emits && typeof a.emits === 'object' && a.emits !== null && !Array.isArray(a.emits)) {
        // If it's an object (not array), extract keys and sort for consistency
        aEmitsArray = Object.keys(a.emits).sort();
      } else {
        aEmitsArray = [];
      }
      
      if (Array.isArray(b.emits)) {
        bEmitsArray = b.emits;
      } else if (b.emits && typeof b.emits === 'object' && b.emits !== null && !Array.isArray(b.emits)) {
        // If it's an object (not array), extract keys and sort for consistency
        bEmitsArray = Object.keys(b.emits).sort();
      } else {
        bEmitsArray = [];
      }
      
      // CRITICAL: Ensure both are arrays before proceeding
      // If somehow they're still not arrays, force convert to empty arrays
      if (!Array.isArray(aEmitsArray)) {
        aEmitsArray = [];
      }
      if (!Array.isArray(bEmitsArray)) {
        bEmitsArray = [];
      }
      
      // Check for non-hash changes first
      // Note: props and emits are string arrays (prop/emit names), state and apiSignature are objects
      // CRITICAL: Use the extracted arrays (aPropsArray, bPropsArray) for comparison, not a.props/b.props directly
      // Normalize props/emits arrays for comparison to ensure consistent comparison
      const oldPropsNormalized = normalize ? normalizeNames(aPropsArray) : [...aPropsArray].sort();
      const newPropsNormalized = normalize ? normalizeNames(bPropsArray) : [...bPropsArray].sort();
      const propsEqual = JSON.stringify(oldPropsNormalized) === JSON.stringify(newPropsNormalized);
      
      const oldEmitsNormalized = normalize ? normalizeNames(aEmitsArray) : [...aEmitsArray].sort();
      const newEmitsNormalized = normalize ? normalizeNames(bEmitsArray) : [...bEmitsArray].sort();
      const emitsEqual = JSON.stringify(oldEmitsNormalized) === JSON.stringify(newEmitsNormalized);
      
      const hasNonHashChanges = 
        !arraysEqual(a.imports, b.imports, normalize) ||
        !arraysEqual(a.hooks, b.hooks, normalize) ||
        !arraysEqual(a.functions, b.functions, normalize) ||
        !arraysEqual(a.components, b.components, normalize) ||
        !arraysEqual(a.variables, b.variables, normalize) ||
        !propsEqual ||
        !emitsEqual ||
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

      // Only add props delta if they're actually different (reuse propsEqual computed above)
      if (!propsEqual) {
        // CRITICAL: Ensure we're ALWAYS storing arrays of strings (prop names), never objects
        // aPropsArray and bPropsArray are already filtered to valid prop names only
        const oldPropsFinal = [...aPropsArray].sort();
        const newPropsFinal = [...bPropsArray].sort();
        deltas.push({ type: 'props', old: oldPropsFinal, new: newPropsFinal });
      }

      // Only add emits delta if they're actually different (reuse emitsEqual computed above)
      if (!emitsEqual) {
        // CRITICAL: Ensure we're ALWAYS storing arrays of strings (emit names), never objects
        // aEmitsArray and bEmitsArray should already be arrays, but defensively ensure they are
        let oldEmitsFinal: string[];
        let newEmitsFinal: string[];
        
        if (Array.isArray(aEmitsArray)) {
          oldEmitsFinal = [...aEmitsArray].sort();
        } else if (aEmitsArray && typeof aEmitsArray === 'object') {
          oldEmitsFinal = Object.keys(aEmitsArray).sort();
        } else {
          oldEmitsFinal = [];
        }
        
        if (Array.isArray(bEmitsArray)) {
          newEmitsFinal = [...bEmitsArray].sort();
        } else if (bEmitsArray && typeof bEmitsArray === 'object') {
          newEmitsFinal = Object.keys(bEmitsArray).sort();
        } else {
          newEmitsFinal = [];
        }
        
        // Final safety check: ensure we're storing arrays, not objects
        if (Array.isArray(oldEmitsFinal) && Array.isArray(newEmitsFinal)) {
          deltas.push({ type: 'emits', old: oldEmitsFinal, new: newEmitsFinal });
        }
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
