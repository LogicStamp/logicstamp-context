/**
 * Resolver module - Resolve component names and paths to manifest keys
 */

import { normalizeEntryId } from '../../utils/fsx.js';
import type { ProjectManifest, ComponentNode } from '../manifest.js';

/**
 * Resolve input (path or name) to a manifest key
 * This is the canonical resolution used by both pack and similar commands
 */
export function resolveKey(
  manifest: ProjectManifest,
  input: string
): string | null {
  const normalized = normalizeEntryId(input);

  // Try exact match first (normalized key match)
  if (manifest.components[normalized]) {
    return normalized;
  }

  // Try to find by normalized key match
  const entries = Object.entries(manifest.components);
  for (const [key, node] of entries) {
    if (normalizeEntryId(key) === normalized || normalizeEntryId(node.entryId) === normalized) {
      return key; // Return the manifest key, not the node's entryId
    }
  }

  // Look for name match (Button, LoginForm, etc.)
  // Build name → [keys] index for ambiguous cases
  const nameMatches: string[] = [];
  for (const [key] of entries) {
    const fileName = key.split(/[/\\]/).pop()?.replace(/\.(tsx?|jsx?)$/, '');
    if (fileName === input || fileName === input.replace(/\.(tsx?|jsx?)$/, '')) {
      nameMatches.push(key);
    }
  }

  if (nameMatches.length === 1) {
    return nameMatches[0];
  } else if (nameMatches.length > 1) {
    // Ambiguous - return first match but this should be handled by caller
    return nameMatches[0];
  }

  return null;
}

/**
 * Find a component node by name or path
 * Returns the component node and the manifest key it was found under
 */
export function findComponentByName(
  manifest: ProjectManifest,
  nameOrPath: string
): ComponentNode | null {
  const key = resolveKey(manifest, nameOrPath);
  return key ? manifest.components[key] : null;
}

/**
 * Resolve a dependency name to a manifest key
 * Uses the canonical resolveKey() function for consistent resolution
 * Prioritizes relative paths to avoid cross-directory conflicts
 */
export function resolveDependency(
  manifest: ProjectManifest,
  depName: string,
  parentId: string
): string | null {
  // parentId is a manifest key (canonical identifier)

  // First, try relative path resolution based on parent directory
  // This ensures we resolve to components in the same directory tree first
  // parentId is a manifest key (normalized path), extract directory
  const parentDir = parentId.substring(0, parentId.lastIndexOf('/'));
  const possiblePaths = [
    `${parentDir}/${depName}.tsx`,
    `${parentDir}/${depName}.ts`,
    `${parentDir}/${depName}/index.tsx`,
    `${parentDir}/${depName}/index.ts`,
  ];

  for (const path of possiblePaths) {
    const key = resolveKey(manifest, path);
    if (key) {
      return key; // Return manifest key (canonical identifier)
    }
  }

  // Only fall back to global name search if relative paths didn't work
  // This prevents cross-directory conflicts (e.g., tests/fixtures vs examples)
  const key = resolveKey(manifest, depName);
  if (key) {
    return key; // Return manifest key (canonical identifier)
  }

  return null;
}

