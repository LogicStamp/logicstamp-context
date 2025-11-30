/**
 * @uif Contract 0.3
 *
 * Description: manifest - Presentational component
 *
 * Version (Component Composition):
 *   variables: []
 *   hooks: []
 *   components: []
 *   functions: ["buildDependencyGraph","buildHashIndices","findComponentByName","generateStats","writeManifest"]
 *   imports: ["../types/UIFContract.js","../utils/hash.js","node:fs/promises","node:path"]
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
 *   semantic: uif:1ddfb5c70a09a2614d47690e (informational)
 *   file: uif:179d1c0bb533920680e6417f
 */

/**
 * Manifest builder - Creates dependency graph for the entire project
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { UIFContract } from '../types/UIFContract.js';
import { structureHash, signatureHash } from '../utils/hash.js';
import { debugError } from '../utils/debug.js';

export interface ComponentNode {
  entryId: string;
  description: string;
  dependencies: string[]; // Components this one uses
  usedBy: string[]; // Components that use this one
  imports: string[];
  routes: string[];
  semanticHash: string;
  structureHash?: string; // Optional: for similarity detection
  signatureHash?: string; // Optional: for similarity detection
}

export interface ProjectManifest {
  version: '0.3';
  generatedAt: string;
  totalComponents: number;
  components: Record<string, ComponentNode>;
  graph: {
    roots: string[]; // Components not used by any others (top-level)
    leaves: string[]; // Components that don't use any others (primitives)
  };
  hashIndex?: {
    structureHash: Record<string, string[]>; // hash -> entryIds[]
    signatureHash: Record<string, string[]>; // hash -> entryIds[]
  };
}

/**
 * Build dependency graph from contracts
 */
export function buildDependencyGraph(
  contracts: UIFContract[],
  options?: { includeHashIndices?: boolean }
): ProjectManifest {
  const components: Record<string, ComponentNode> = {};

  // First pass: create nodes
  for (const contract of contracts) {
    // Compute structure and signature hashes from contract data
    // These are computed on-demand rather than stored in contracts
    // Note: structureHash() and signatureHash() already return hashes with uif: prefix
    const structHash = structureHash(contract.version);
    const sigHash = signatureHash(contract.logicSignature);

    components[contract.entryId] = {
      entryId: contract.entryId,
      description: contract.description,
      dependencies: contract.version.components,
      usedBy: [],
      imports: contract.version.imports || [],
      routes: contract.usedIn || [],
      semanticHash: contract.semanticHash,
      structureHash: structHash,
      signatureHash: sigHash,
    };
  }

  // Second pass: build reverse relationships (usedBy)
  for (const contract of contracts) {
    const componentId = contract.entryId;

    // For each component this one uses
    for (const dependency of contract.version.components) {
      // Find the matching component in our graph
      const depNode = findComponentByName(components, dependency);

      if (depNode) {
        // Add this component to the dependency's usedBy list
        if (!depNode.usedBy.includes(componentId)) {
          depNode.usedBy.push(componentId);
        }
      }
    }
  }

  // Identify roots and leaves
  const roots: string[] = [];
  const leaves: string[] = [];

  for (const [id, node] of Object.entries(components)) {
    if (node.usedBy.length === 0) {
      roots.push(id);
    }
    if (node.dependencies.length === 0) {
      leaves.push(id);
    }
  }

  // Build hash indices if requested
  let hashIndex: { structureHash: Record<string, string[]>; signatureHash: Record<string, string[]> } | undefined;

  if (options?.includeHashIndices) {
    hashIndex = buildHashIndices(components);
  }

  return {
    version: '0.3',
    generatedAt: new Date().toISOString(),
    totalComponents: contracts.length,
    components,
    graph: {
      roots: roots.sort(),
      leaves: leaves.sort(),
    },
    hashIndex,
  };
}

/**
 * Build hash indices for similarity detection
 */
function buildHashIndices(components: Record<string, ComponentNode>): {
  structureHash: Record<string, string[]>;
  signatureHash: Record<string, string[]>;
} {
  const structureIndex: Record<string, string[]> = {};
  const signatureIndex: Record<string, string[]> = {};

  for (const [entryId, node] of Object.entries(components)) {
    // Index by structure hash
    if (node.structureHash) {
      if (!structureIndex[node.structureHash]) {
        structureIndex[node.structureHash] = [];
      }
      structureIndex[node.structureHash].push(entryId);
    }

    // Index by signature hash
    if (node.signatureHash) {
      if (!signatureIndex[node.signatureHash]) {
        signatureIndex[node.signatureHash] = [];
      }
      signatureIndex[node.signatureHash].push(entryId);
    }
  }

  return {
    structureHash: structureIndex,
    signatureHash: signatureIndex,
  };
}

/**
 * Find component by name (handles partial matches)
 */
function findComponentByName(
  components: Record<string, ComponentNode>,
  name: string
): ComponentNode | null {
  // First try exact match
  const exactMatch = Object.values(components).find((c) => c.entryId.endsWith(`/${name}.tsx`));
  if (exactMatch) return exactMatch;

  // Try with .ts extension
  const tsMatch = Object.values(components).find((c) => c.entryId.endsWith(`/${name}.ts`));
  if (tsMatch) return tsMatch;

  // Try partial match on component name
  const partialMatch = Object.values(components).find((c) => {
    const componentName = c.entryId.split('/').pop()?.replace(/\.(tsx?|jsx?)$/, '');
    return componentName === name;
  });

  return partialMatch || null;
}

/**
 * Write manifest to file
 */
export async function writeManifest(manifest: ProjectManifest, outPath: string): Promise<void> {
  const manifestPath = join(outPath, 'logicstamp.manifest.json');
  const json = JSON.stringify(manifest, null, 2);
  
  try {
    await writeFile(manifestPath, json, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('manifest', 'writeManifest', {
      manifestPath,
      outPath,
      message: err.message,
      code: err.code,
    });
    
    let userMessage: string;
    switch (err.code) {
      case 'ENOENT':
        userMessage = `Parent directory not found for: "${manifestPath}"`;
        break;
      case 'EACCES':
        userMessage = `Permission denied writing to: "${manifestPath}"`;
        break;
      case 'ENOSPC':
        userMessage = `No space left on device. Cannot write: "${manifestPath}"`;
        break;
      default:
        userMessage = `Failed to write manifest "${manifestPath}": ${err.message}`;
    }
    throw new Error(userMessage);
  }
}

/**
 * Generate component usage statistics
 */
export function generateStats(manifest: ProjectManifest): {
  mostUsed: Array<{ id: string; usageCount: number }>;
  mostComplex: Array<{ id: string; dependencyCount: number }>;
  isolated: string[];
} {
  const usageStats = Object.entries(manifest.components).map(([id, node]) => ({
    id,
    usageCount: node.usedBy.length,
  }));

  const complexityStats = Object.entries(manifest.components).map(([id, node]) => ({
    id,
    dependencyCount: node.dependencies.length,
  }));

  const isolated = Object.entries(manifest.components)
    .filter(([_, node]) => node.usedBy.length === 0 && node.dependencies.length === 0)
    .map(([id]) => id);

  return {
    mostUsed: usageStats.sort((a, b) => b.usageCount - a.usageCount).slice(0, 10),
    mostComplex: complexityStats.sort((a, b) => b.dependencyCount - a.dependencyCount).slice(0, 10),
    isolated,
  };
}
