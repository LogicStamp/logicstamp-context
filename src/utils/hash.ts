/**
 * @uif Contract 0.3
 *
 * Description: hash - Presentational component
 *
 * Version (Component Composition):
 *   variables: ["SCHEMA_VERSION"]
 *   hooks: []
 *   components: []
 *   functions: ["bundleHash","fileHash","hashesEqual","isValidHash","semanticHashFromAst","sha256Hex","signatureHash","sortObject","stableStringify","structureHash"]
 *   imports: ["../core/astParser.js","../types/UIFContract.js","node:crypto"]
 *
 * Logic Signature:
 *   props: {}
 *   events: {}
 *   state: {}
 *
 * Predictions:
 *   (none)
 *
 * Hashes (informational only - authoritative values in .uif.json):
 *   semantic: uif:9c632ee89c97f0b44ce6ae5c (informational)
 *   file: uif:1f0fa0e2c8958d7fc1696036
 */

/**
 * Hash utilities for content and semantic hashing
 */

import { createHash } from 'node:crypto';
import type { AstExtract } from '../core/astParser.js';
import type { LogicSignature, ComponentVersion } from '../types/UIFContract.js';

const SCHEMA_VERSION = '0.3';

/**
 * Generate a hash from raw file content
 * Strips the @uif header block before hashing to prevent self-referential churn
 */
export function fileHash(content: string): string {
  // Strip @uif header block to prevent self-referential changes
  const stripped = content.replace(/\/\*\*[\s\S]*?@uif[\s\S]*?\*\/\n*/m, '');

  // Normalize line endings for cross-platform consistency
  const normalized = stripped.replace(/\r\n/g, '\n');

  const hash = createHash('sha256').update(normalized, 'utf8').digest('hex');
  return `uif:${hash.slice(0, 24)}`;
}

/**
 * Generate a hash from component structure (variables, hooks, components, functions)
 * This changes only when structural composition changes
 */
export function structureHash(ast: AstExtract): string;
export function structureHash(version: ComponentVersion): string;
export function structureHash(astOrVersion: AstExtract | ComponentVersion): string {
  const payload = {
    variables: [...(astOrVersion.variables || [])].sort(),
    hooks: [...(astOrVersion.hooks || [])].sort(),
    components: [...(astOrVersion.components || [])].sort(),
    functions: [...(astOrVersion.functions || [])].sort(),
  };

  return sha256Hex(stableStringify(payload));
}

/**
 * Generate a hash from logic signature (props, events, state)
 * This changes only when the component's API contract changes
 */
export function signatureHash(signature: LogicSignature): string {
  const payload = {
    props: sortObject(signature.props),
    events: sortObject(signature.events),
    state: signature.state ? sortObject(signature.state) : undefined,
  };

  return sha256Hex(stableStringify(payload));
}

/**
 * Generate a semantic hash from AST structure and logic signature
 * This hash only changes when the component's structural logic changes,
 * not when comments, formatting, or implementation details change.
 *
 * semanticHash = hash(structureHash + signatureHash + schemaVersion)
 */
export function semanticHashFromAst(ast: AstExtract, signature: LogicSignature): string {
  // Combine structure and signature hashes with schema version
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    structure: {
      variables: [...ast.variables].sort(),
      hooks: [...ast.hooks].sort(),
      components: [...ast.components].sort(),
      functions: [...ast.functions].sort(),
    },
    signature: {
      props: sortObject(signature.props),
      events: sortObject(signature.events),
      state: signature.state ? sortObject(signature.state) : undefined,
    },
  };

  return sha256Hex(stableStringify(payload));
}

/**
 * Compute bundle hash from nodes
 * Input: ordered array of {entryId, semanticHash} plus depth and schemaVersion
 * This provides a stable cache key for LLM context bundles
 */
export function bundleHash(
  nodes: Array<{ entryId: string; semanticHash: string }>,
  depth: number,
  schemaVersion = '0.1'
): string {
  // Sort nodes by entryId for determinism
  const ordered = [...nodes].sort((a, b) => a.entryId.localeCompare(b.entryId));

  const payload = {
    schemaVersion,
    depth,
    nodes: ordered.map(n => ({ entryId: n.entryId, semanticHash: n.semanticHash })),
  };

  const hash = createHash('sha256')
    .update(stableStringify(payload), 'utf8')
    .digest('hex');

  return `uifb:${hash.slice(0, 24)}`;
}

/**
 * Stable stringify with sorted keys and arrays
 * Ensures deterministic JSON output for hashing
 */
export function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, (k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      // Sort object keys
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce((o, key) => {
          o[key] = (v as Record<string, unknown>)[key];
          return o;
        }, {} as Record<string, unknown>);
    }
    if (Array.isArray(v)) {
      // Sort arrays for stability
      return [...v].sort();
    }
    return v;
  });
}

/**
 * Sort object keys for stable hashing
 */
function sortObject<T extends Record<string, unknown>>(obj: T): T {
  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {} as Record<string, unknown>);

  return sorted as T;
}

/**
 * Generate SHA256 hash with uif: prefix
 */
function sha256Hex(input: string): string {
  const hash = createHash('sha256').update(input, 'utf8').digest('hex');
  return `uif:${hash.slice(0, 24)}`;
}

/**
 * Verify if a hash matches the expected format
 */
export function isValidHash(hash: string): boolean {
  return /^uif:[a-f0-9]{24}$/.test(hash);
}

/**
 * Compare two hashes for equality
 */
export function hashesEqual(hash1: string, hash2: string): boolean {
  return hash1 === hash2;
}
