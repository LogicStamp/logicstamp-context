/**
 * Shared Violation Detection Module
 *
 * Provides consistent breaking change detection across watch and compare commands.
 * Uses adapters to normalize different input formats to a common internal representation.
 */

import type { Violation, ViolationsSummary } from '../utils/config.js';
import type { BundleChanges, ContractDiff } from '../cli/commands/context/watchMode/watchDiff.js';
import type { CompareResult } from '../cli/commands/compare/types.js';

// Re-export types for convenience
export type { Violation, ViolationsSummary } from '../utils/config.js';

/**
 * Input types for violation detection
 */
export type ViolationDetectionInput =
  | { type: 'watch'; changes: BundleChanges }
  | { type: 'compare'; result: CompareResult; gitBaseline?: boolean };

/**
 * Normalized change representation for internal use
 * Adapts both BundleChanges and CompareResult to a common format
 */
interface NormalizedChange {
  entryId: string;
  removed?: boolean;
  gitBaseline?: boolean; // Flag to skip type changes in git baseline mode
  props?: { added: string[]; removed: string[]; changed: Array<{ name: string; old: unknown; new: unknown }> };
  emits?: { added: string[]; removed: string[]; changed: Array<{ name: string; old: unknown; new: unknown }> };
  state?: { added: string[]; removed: string[]; changed: Array<{ name: string; old: unknown; new: unknown }> };
  functions?: { added: string[]; removed: string[] };
  variables?: { added: string[]; removed: string[] };
}

/**
 * Normalize BundleChanges (watch mode) to NormalizedChange array
 */
function normalizeFromWatch(changes: BundleChanges): NormalizedChange[] {
  const normalized: NormalizedChange[] = [];

  // Handle removed contracts
  for (const entryId of changes.removed) {
    normalized.push({
      entryId,
      removed: true,
    });
  }

  // Handle changed contracts
  for (const change of changes.changed) {
    const { entryId, contractDiff } = change;
    if (!contractDiff) continue;

    normalized.push({
      entryId,
      props: contractDiff.props,
      emits: contractDiff.emits,
      state: contractDiff.state,
      functions: contractDiff.functions,
      variables: contractDiff.variables,
    });
  }

  return normalized;
}

/**
 * Helper to compute diff between two objects (used for props, emits, state)
 */
function diffObjects(oldObj: Record<string, unknown>, newObj: Record<string, unknown>): {
  added: string[];
  removed: string[];
  changed: Array<{ name: string; old: unknown; new: unknown }>;
} {
  const oldKeys = new Set(Object.keys(oldObj));
  const newKeys = new Set(Object.keys(newObj));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: Array<{ name: string; old: unknown; new: unknown }> = [];

  for (const key of newKeys) {
    if (!oldKeys.has(key)) {
      added.push(key);
    } else if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      changed.push({ name: key, old: oldObj[key], new: newObj[key] });
    }
  }
  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      removed.push(key);
    }
  }

  return { added, removed, changed };
}

/**
 * Helper to compute diff between two arrays
 */
function diffArrays(oldArr: string[], newArr: string[]): { added: string[]; removed: string[] } {
  const oldSet = new Set(oldArr);
  const newSet = new Set(newArr);
  const added: string[] = [];
  const removed: string[] = [];

  for (const item of newSet) {
    if (!oldSet.has(item)) added.push(item);
  }
  for (const item of oldSet) {
    if (!newSet.has(item)) removed.push(item);
  }

  return { added, removed };
}

/**
 * Normalize CompareResult (compare mode) to NormalizedChange array
 *
 * All delta formats now use full old/new values:
 * - props: { old: Record<string, any>, new: Record<string, any> }
 * - emits: { old: Record<string, any>, new: Record<string, any> }
 * - functions: { old: string[], new: string[] }
 * - variables: { old: string[], new: string[] }
 * - state: { old: Record<string, any>, new: Record<string, any> }
 */
function normalizeFromCompare(result: CompareResult, gitBaseline?: boolean): NormalizedChange[] {
  const normalized: NormalizedChange[] = [];

  // Handle removed components
  for (const id of result.removed) {
    normalized.push({
      entryId: id,
      removed: true,
      gitBaseline,
    });
  }

  // Handle changed components
  for (const change of result.changed) {
    const { id, deltas } = change;
    const normalizedChange: NormalizedChange = { entryId: id, gitBaseline };

    for (const delta of deltas) {
      switch (delta.type) {
        case 'props': {
          const oldObj = (delta.old && typeof delta.old === 'object' && !Array.isArray(delta.old))
            ? delta.old as Record<string, unknown> : {};
          const newObj = (delta.new && typeof delta.new === 'object' && !Array.isArray(delta.new))
            ? delta.new as Record<string, unknown> : {};
          normalizedChange.props = diffObjects(oldObj, newObj);
          break;
        }
        case 'emits': {
          const oldObj = (delta.old && typeof delta.old === 'object' && !Array.isArray(delta.old))
            ? delta.old as Record<string, unknown> : {};
          const newObj = (delta.new && typeof delta.new === 'object' && !Array.isArray(delta.new))
            ? delta.new as Record<string, unknown> : {};
          normalizedChange.emits = diffObjects(oldObj, newObj);
          break;
        }
        case 'functions': {
          const oldArr = Array.isArray(delta.old) ? delta.old : [];
          const newArr = Array.isArray(delta.new) ? delta.new : [];
          normalizedChange.functions = diffArrays(oldArr, newArr);
          break;
        }
        case 'variables': {
          const oldArr = Array.isArray(delta.old) ? delta.old : [];
          const newArr = Array.isArray(delta.new) ? delta.new : [];
          normalizedChange.variables = diffArrays(oldArr, newArr);
          break;
        }
        case 'state': {
          const oldObj = (delta.old && typeof delta.old === 'object' && !Array.isArray(delta.old))
            ? delta.old as Record<string, unknown> : {};
          const newObj = (delta.new && typeof delta.new === 'object' && !Array.isArray(delta.new))
            ? delta.new as Record<string, unknown> : {};
          normalizedChange.state = diffObjects(oldObj, newObj);
          break;
        }
        // Other delta types (hash, imports, hooks, exports, components, apiSignature)
        // are not breaking changes for violation detection
      }
    }

    // Only add if there are actual changes to detect
    if (normalizedChange.props || normalizedChange.emits || normalizedChange.state ||
        normalizedChange.functions || normalizedChange.variables) {
      normalized.push(normalizedChange);
    }
  }

  return normalized;
}

/**
 * Core detection logic - operates on normalized changes
 * Breaking changes are treated as errors, type changes as warnings
 * Note: Missing dependencies are not tracked as violations (they're expected for third-party packages)
 */
function detectFromNormalized(changes: NormalizedChange[]): Violation[] {
  const violations: Violation[] = [];

  for (const change of changes) {
    const { entryId } = change;

    // Contract removed is a breaking change
    if (change.removed) {
      violations.push({
        type: 'contract_removed',
        severity: 'error',
        entryId,
        message: `Contract removed: ${entryId}`,
      });
      continue;
    }

    // Removed props are breaking changes
    if (change.props?.removed) {
      for (const propName of change.props.removed) {
        violations.push({
          type: 'breaking_change_prop_removed',
          severity: 'error',
          entryId,
          message: `Breaking change: prop '${propName}' removed from ${entryId}`,
          details: { name: propName },
        });
      }
    }

    // Changed prop types are breaking changes (warning severity)
    // Skip type changes in git baseline mode to avoid false positives from path differences
    if (change.props?.changed && !change.gitBaseline) {
      for (const prop of change.props.changed) {
        violations.push({
          type: 'breaking_change_prop_type',
          severity: 'warning',
          entryId,
          message: `Prop '${prop.name}' type changed in ${entryId}`,
          details: { name: prop.name, oldValue: prop.old, newValue: prop.new },
        });
      }
    }

    // Removed events are breaking changes
    if (change.emits?.removed) {
      for (const eventName of change.emits.removed) {
        violations.push({
          type: 'breaking_change_event_removed',
          severity: 'error',
          entryId,
          message: `Breaking change: event '${eventName}' removed from ${entryId}`,
          details: { name: eventName },
        });
      }
    }

    // Removed state is a breaking change (warning severity)
    if (change.state?.removed) {
      for (const stateName of change.state.removed) {
        violations.push({
          type: 'breaking_change_state_removed',
          severity: 'warning',
          entryId,
          message: `State '${stateName}' removed from ${entryId}`,
          details: { name: stateName },
        });
      }
    }

    // Removed functions are breaking changes
    if (change.functions?.removed) {
      for (const funcName of change.functions.removed) {
        violations.push({
          type: 'breaking_change_function_removed',
          severity: 'error',
          entryId,
          message: `Breaking change: function '${funcName}' removed from ${entryId}`,
          details: { name: funcName },
        });
      }
    }

    // Removed variables are breaking changes (warning severity)
    if (change.variables?.removed) {
      for (const varName of change.variables.removed) {
        violations.push({
          type: 'breaking_change_variable_removed',
          severity: 'warning',
          entryId,
          message: `Variable '${varName}' removed from ${entryId}`,
          details: { name: varName },
        });
      }
    }
  }

  return violations;
}

/**
 * Detect violations from either watch mode or compare mode input
 */
export function detectViolations(input: ViolationDetectionInput): Violation[] {
  const normalized = input.type === 'watch'
    ? normalizeFromWatch(input.changes)
    : normalizeFromCompare(input.result, input.gitBaseline);

  return detectFromNormalized(normalized);
}

/**
 * Create a summary of violations
 */
export function summarizeViolations(violations: Violation[]): ViolationsSummary {
  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  return {
    timestamp: new Date().toISOString(),
    totalViolations: violations.length,
    errors: errors.length,
    warnings: warnings.length,
    violations,
    changedFiles: [], // Caller should populate this if needed
  };
}

/**
 * Display violations to console
 */
export function displayViolations(violations: Violation[], options: { quiet?: boolean } = {}): void {
  if (violations.length === 0) return;

  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  console.log(`\n   ⚠️  Strict Mode: ${violations.length} violation(s) detected`);

  if (errors.length > 0) {
    console.log(`\n   ❌ Errors (${errors.length}):`);
    errors.forEach(v => {
      console.log(`      ${v.message}`);
    });
  }

  if (warnings.length > 0) {
    console.log(`\n   ⚠️  Warnings (${warnings.length}):`);
    warnings.forEach(v => {
      console.log(`      ${v.message}`);
    });
  }
}
