/**
 * @uif Contract 0.3
 *
 * Description: pack - Presentational component
 *
 * Version (Component Composition):
 *   variables: []
 *   hooks: []
 *   components: []
 *   functions: ["buildEdges","collectDependencies","computeBundleHash","extractCodeHeader","findComponentByName","formatBundle","loadContract","loadManifest","pack","readSourceCode","resolveDependency","resolveKey","stableSort","validateHashLock"]
 *   imports: ["../types/UIFContract.js","../utils/fsx.js","../utils/hash.js","./manifest.js","node:fs/promises","node:path"]
 *
 * Logic Signature:
 *   props: {}
 *   events: {}
 *   state: {}
 *
 * Predictions:
 *   Includes form validation logic, Fetches or mutates external data
 *
 * Hashes (informational only - authoritative values in .uif.json):
 *   semantic: uif:70da3ed90cc7516abcbbf13b (informational)
 *   file: uif:a70a7b698f5520bf49d74a91
 */

/**
 * Pack module - Generate LLM-ready context bundles for components
 * Creates compact, hash-locked bundles with dependency graphs
 */

import { resolve, isAbsolute } from 'node:path';
import { normalizeEntryId } from '../utils/fsx.js';
import type { UIFContract } from '../types/UIFContract.js';
import type { ProjectManifest, ComponentNode } from './manifest.js';
import { createRequire } from 'node:module';

// Import from extracted modules
import { resolveKey, resolveDependency, findComponentByName } from './pack/resolver.js';
import { collectDependencies } from './pack/collector.js';
import type { MissingDependency } from './pack/collector.js';
import { loadManifest, loadContract, readSourceCode, extractCodeHeader } from './pack/loader.js';
import { buildEdges, computeBundleHash, stableSort, validateHashLock } from './pack/builder.js';
import type { BundleNode } from './pack/builder.js';

// Load package.json to get version
const require = createRequire(import.meta.url);
const pkg = require('../../package.json');
const PACKAGE_VERSION = `${pkg.name}@${pkg.version}`;

/**
 * Check if a component name is an internal component (function defined in the same file)
 * Internal components appear in both version.functions and version.components of a contract
 */
function isInternalComponent(contract: UIFContract, componentName: string): boolean {
  const functionsSet = new Set(contract.version.functions);
  const componentsSet = new Set(contract.version.components);
  
  // A component is internal if it appears in both functions and components arrays
  // This means it's a function component defined in the same file
  return functionsSet.has(componentName) && componentsSet.has(componentName);
}

/**
 * Filter out internal components from missing dependencies
 * Internal components should not appear in meta.missing since they're defined in the same file
 * Only checks contracts that are already loaded to avoid I/O overhead
 */
function filterInternalComponentsFromMissing(
  missing: MissingDependency[],
  nodes: BundleNode[],
  contractsMap: Map<string, UIFContract> | undefined
): MissingDependency[] {
  // Build a map of entryId -> contract for quick lookup
  // Only use contracts we already have (no I/O to avoid timeouts)
  const contractMap = new Map<string, UIFContract>();
  
  // Add contracts from nodes (already loaded)
  for (const node of nodes) {
    if (node.contract) {
      contractMap.set(node.entryId, node.contract);
    }
  }
  
  // Add contracts from contractsMap (in-memory)
  if (contractsMap) {
    for (const [key, contract] of contractsMap.entries()) {
      contractMap.set(key, contract);
    }
  }
  
  // Filter missing dependencies
  const filtered: MissingDependency[] = [];
  
  for (const dep of missing) {
    // If referencedBy is not set, we can't check if it's internal - keep it
    if (!dep.referencedBy) {
      filtered.push(dep);
      continue;
    }
    
    // Only check contracts we already have loaded (no I/O)
    const contract = contractMap.get(dep.referencedBy);
    
    // If we have the contract, check if the dependency is an internal component
    if (contract && isInternalComponent(contract, dep.name)) {
      // This is an internal component - skip it (don't add to filtered)
      continue;
    }
    
    // Not an internal component (or contract not available) - keep it
    filtered.push(dep);
  }
  
  return filtered;
}

/**
 * Code inclusion mode for bundles
 */
export type CodeInclusionMode = 'none' | 'header' | 'full';

/**
 * Output format for bundles
 */
export type BundleFormat = 'json' | 'pretty' | 'ndjson';

/**
 * Options for packing a component
 */
export interface PackOptions {
  depth: number;
  includeCode: CodeInclusionMode;
  format: BundleFormat;
  hashLock: boolean;
  strict: boolean;
  allowMissing: boolean;
  maxNodes: number;
  contractsMap?: Map<string, UIFContract>; // Optional in-memory contracts (for standalone mode)
}

/**
 * A node in the bundle graph
 */
export type { BundleNode } from './pack/builder.js';

/**
 * Missing dependency information
 */
export type { MissingDependency } from './pack/collector.js';

/**
 * Complete bundle structure
 */
export interface LogicStampBundle {
  type: 'LogicStampBundle';
  schemaVersion: '0.1';
  entryId: string;
  depth: number;
  createdAt: string;
  bundleHash: string;
  graph: {
    nodes: BundleNode[];
    edges: [string, string][];
  };
  meta: {
    missing: MissingDependency[];
    source: string;
  };
}

/**
 * Folder information in the index
 */
export interface FolderInfo {
  path: string;
  contextFile: string;
  bundles: number;
  components: string[];
  isRoot: boolean;
  rootLabel?: string;
  tokenEstimate: number;
}

/**
 * Main index structure - serves as a directory to all context files
 */
export interface LogicStampIndex {
  type: 'LogicStampIndex';
  schemaVersion: '0.1';
  projectRoot: string;
  projectRootResolved?: string;
  createdAt: string;
  summary: {
    totalComponents: number;
    totalBundles: number;
    totalFolders: number;
    totalTokenEstimate: number;
  };
  folders: FolderInfo[];
  meta: {
    source: string;
  };
}

/**
 * Load manifest from file
 */
export { loadManifest } from './pack/loader.js';

/**
 * Load a sidecar contract file
 * Sidecar path is computed from the manifest key (project-relative): resolved from projectRoot + key + '.uif.json'
 */
export { loadContract } from './pack/loader.js';

/**
 * Normalize a file path for cross-platform consistency
 * Re-exports the canonical normalizeEntryId from utils/fsx
 * This ensures all path normalization uses the same function
 */
export { normalizeEntryId } from '../utils/fsx.js';

/**
 * Resolve input (path or name) to a manifest key
 * This is the canonical resolution used by both pack and similar commands
 */
export { resolveKey } from './pack/resolver.js';

/**
 * Find a component node by name or path
 * Returns the component node and the manifest key it was found under
 */
export { findComponentByName } from './pack/resolver.js';

/**
 * Resolve a dependency name to a manifest key
 * Uses the canonical resolveKey() function for consistent resolution
 * Prioritizes relative paths to avoid cross-directory conflicts
 */
export { resolveDependency } from './pack/resolver.js';

/**
 * Perform BFS traversal to collect dependencies
 */
export { collectDependencies } from './pack/collector.js';

/**
 * Extract code header (JSDoc @uif block) from source file
 */
export { extractCodeHeader } from './pack/loader.js';

/**
 * Read full source code
 */
export { readSourceCode } from './pack/loader.js';

/**
 * Build edges from nodes based on dependencies
 */
export { buildEdges } from './pack/builder.js';

/**
 * Sort nodes deterministically for stable bundle hashes
 */
export { stableSort } from './pack/builder.js';

/**
 * Compute bundle hash from nodes using stable hashing
 */
export { computeBundleHash } from './pack/builder.js';

/**
 * Validate hash-lock: ensure contract hashes match current state
 *
 * Recomputes file hash from source and compares to contract.fileHash from sidecar
 * (authoritative, not from header). fileHash() automatically strips @uif header block
 * before hashing, so header updates won't cause hash churn.
 */
export { validateHashLock } from './pack/builder.js';

/**
 * Main pack function - generates a bundle for a component
 */
export async function pack(
  entryId: string,
  manifest: ProjectManifest,
  options: PackOptions,
  projectRoot: string
): Promise<LogicStampBundle> {
  // Normalize entry ID
  const normalizedEntry = normalizeEntryId(entryId);

  // Find the entry component using canonical resolution
  const manifestKey = resolveKey(manifest, normalizedEntry);
  if (!manifestKey) {
    const componentKeys = Object.keys(manifest.components).slice(0, 5);
    const suggestions = componentKeys.length > 0
      ? `\nAvailable components:\n${componentKeys.map(k => `  - ${k}`).join('\n')}${componentKeys.length < manifest.totalComponents ? `\n  ... and ${manifest.totalComponents - componentKeys.length} more` : ''}`
      : '';
    throw new Error(
      `Component not found: ${entryId} (normalized: ${normalizedEntry}).` +
      suggestions
    );
  }

  // Use manifest key as the canonical identifier (not entryComponent.entryId)
  const actualEntryId = manifestKey;

  // Collect dependencies via BFS
  const { visited, missing } = collectDependencies(
    actualEntryId,
    manifest,
    options.depth,
    options.maxNodes
  );

  // Load contracts for all visited nodes
  // visited contains manifest keys (canonical identifiers, now project-relative)
  const nodes: BundleNode[] = [];

  for (const manifestKey of Array.from(visited)) {
    // Try to get contract from in-memory map first (standalone mode), then from sidecar file
    const contract = options.contractsMap?.get(manifestKey) || await loadContract(manifestKey, projectRoot);

    if (!contract) {
      const absolutePath = isAbsolute(manifestKey) ? manifestKey : resolve(projectRoot, manifestKey);
      const sidecarPath = `${absolutePath}.uif.json`;
      if (options.strict) {
        throw new Error(
          `Missing contract for ${manifestKey} (strict mode enabled). ` +
          `Expected sidecar at: ${sidecarPath}`
        );
      }

      if (!options.allowMissing) {
        missing.push({
          name: manifestKey,
          reason: `Contract file not found at ${sidecarPath}`,
        });
        continue;
      }
    }

    // Validate hash lock if enabled
    if (options.hashLock && contract) {
      const isValid = await validateHashLock(contract, manifestKey, projectRoot);
      if (!isValid) {
        throw new Error(
          `Hash lock validation failed for ${manifestKey}. ` +
          `The file has been modified since the contract was generated. ` +
          `Run 'logicstamp compile' to regenerate contracts.`
        );
      }
    }

    // Get code/header based on options
    // Use manifestKey with projectRoot for file operations
    let codeHeader: string | null | undefined = undefined;
    let code: string | null | undefined = undefined;

    if (options.includeCode === 'header') {
      codeHeader = await extractCodeHeader(manifestKey, projectRoot);
    } else if (options.includeCode === 'full') {
      code = await readSourceCode(manifestKey, projectRoot);
      codeHeader = await extractCodeHeader(manifestKey, projectRoot);
    }

    if (contract) {
      nodes.push({
        entryId: manifestKey, // Use manifest key as the canonical identifier
        contract,
        ...(codeHeader !== undefined && { codeHeader }),
        ...(code !== undefined && { code }),
      });
    }
  }

  // DX & guardrails: If no nodes were packed, provide helpful error
  if (nodes.length === 0) {
    throw new Error(
      `No nodes packed. ` +
      `Entry component '${actualEntryId}' was found in manifest, but no contracts could be loaded. ` +
      `Run 'logicstamp compile' to generate sidecar files, or check that path/name matches manifest keys.`
    );
  }

  // Filter out internal components from missing dependencies
  // Internal components are functions defined in the same file that are used as components
  // Only uses contracts already loaded to avoid I/O overhead
  const filteredMissing = filterInternalComponentsFromMissing(
    missing,
    nodes,
    options.contractsMap
  );

  // Build edges
  const edges = buildEdges(nodes, manifest);

  // Sort nodes for deterministic output
  const sortedNodes = stableSort(nodes);

  // Sort edges for deterministic output
  const sortedEdges = edges.sort((a, b) => {
    const fromCompare = a[0].localeCompare(b[0]);
    return fromCompare !== 0 ? fromCompare : a[1].localeCompare(b[1]);
  });

  // Compute bundle hash
  const bundleHash = computeBundleHash(sortedNodes, options.depth);

  // Create bundle
  const bundle: LogicStampBundle = {
    type: 'LogicStampBundle',
    schemaVersion: '0.1',
    entryId: actualEntryId,
    depth: options.depth,
    createdAt: new Date().toISOString(),
    bundleHash,
    graph: {
      nodes: sortedNodes,
      edges: sortedEdges,
    },
    meta: {
      missing: filteredMissing,
      source: PACKAGE_VERSION,
    },
  };

  // Final check: bundle should have at least the entry node
  if (bundle.graph.nodes.length === 0) {
    throw new Error(
      `No nodes packed. ` +
      `Run 'logicstamp compile' to generate contracts, or check path/name against manifest keys.`
    );
  }

  return bundle;
}

/**
 * Format bundle for output
 */
export function formatBundle(bundle: LogicStampBundle, format: BundleFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(bundle);
    case 'pretty':
      return JSON.stringify(bundle, null, 2);
    case 'ndjson':
      // Each node as a separate line
      return bundle.graph.nodes.map((node) => JSON.stringify(node)).join('\n');
    default:
      return JSON.stringify(bundle, null, 2);
  }
}
