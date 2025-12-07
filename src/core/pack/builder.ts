/**
 * Builder module - Build bundle structures, edges, and hashes
 */

import { readFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import type { UIFContract } from '../../types/UIFContract.js';
import type { ProjectManifest } from '../manifest.js';
import { bundleHash as computeBundleHashStable } from '../../utils/hash.js';
import { resolveDependency } from './resolver.js';
import { normalizeEntryId } from '../../utils/fsx.js';

/**
 * A node in the bundle graph
 */
export interface BundleNode {
  entryId: string;
  contract: UIFContract;
  codeHeader?: string | null;
  code?: string | null;
}

/**
 * Build edges from nodes based on dependencies
 */
export function buildEdges(nodes: BundleNode[], manifest: ProjectManifest): [string, string][] {
  const edges: [string, string][] = [];
  // Node entryIds are normalized relative paths
  const nodeIds = new Set(nodes.map((n) => n.entryId));

  for (const node of nodes) {
    // Find component node - node.entryId is normalized, so normalize manifest keys for lookup
    let componentNode = manifest.components[node.entryId];
    let manifestKeyForNode = node.entryId;
    
    if (!componentNode) {
      // Try to find by normalizing manifest keys
      for (const [key, comp] of Object.entries(manifest.components)) {
        const normalizedKey = normalizeEntryId(key);
        if (normalizedKey === node.entryId) {
          componentNode = comp;
          manifestKeyForNode = key; // Keep original key for resolveDependency
          break;
        }
      }
    }
    
    if (!componentNode) continue;

    for (const dep of componentNode.dependencies) {
      // Use original manifest key format for resolveDependency
      const resolvedId = resolveDependency(manifest, dep, manifestKeyForNode);

      // Normalize resolvedId before comparing with nodeIds (which are normalized)
      if (resolvedId) {
        const normalizedResolvedId = normalizeEntryId(resolvedId);
        // Only add edge if both nodes are in the bundle
        if (nodeIds.has(normalizedResolvedId)) {
          edges.push([node.entryId, normalizedResolvedId]);
        }
      }
    }
  }

  return edges;
}

/**
 * Sort nodes deterministically for stable bundle hashes
 */
export function stableSort(nodes: BundleNode[]): BundleNode[] {
  return [...nodes].sort((a, b) => {
    // Sort by entryId for determinism
    return a.entryId.localeCompare(b.entryId);
  });
}

/**
 * Compute bundle hash from nodes using stable hashing
 */
export function computeBundleHash(nodes: BundleNode[], depth: number): string {
  // Use the stable bundleHash function from utils/hash
  const nodeData = nodes.map(n => ({
    entryId: n.entryId,
    semanticHash: n.contract.semanticHash,
  }));

  return computeBundleHashStable(nodeData, depth, '0.1');
}

/**
 * Validate hash-lock: ensure contract hashes match current state
 *
 * Recomputes file hash from source and compares to contract.fileHash from sidecar
 * (authoritative, not from header). fileHash() automatically strips @uif header block
 * before hashing, so header updates won't cause hash churn.
 */
export async function validateHashLock(contract: UIFContract, entryId: string, projectRoot: string): Promise<boolean> {
  try {
    // Read the actual source file
    const absolutePath = isAbsolute(entryId) ? entryId : resolve(projectRoot, entryId);
    const sourceContent = await readFile(absolutePath, 'utf8');

    // Recompute file hash (strips @uif header block automatically)
    const { fileHash: computedFileHash } = await import('../../utils/hash.js');
    const actualFileHash = computedFileHash(sourceContent);

    // Compare to sidecar contract.fileHash (authoritative, not header)
    if (actualFileHash !== contract.fileHash) {
      return false;
    }

    // Semantic hash should match (derived from structure + signature)
    // If fileHash matches, semantic hash should also match since it's derived from the AST
    return true;
  } catch (error) {
    // If we can't read/parse the file, fail validation
    return false;
  }
}

