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

import { readFile } from 'node:fs/promises';
import { join, resolve, isAbsolute } from 'node:path';
import { normalizeEntryId } from '../utils/fsx.js';
import type { UIFContract } from '../types/UIFContract.js';
import type { ProjectManifest, ComponentNode } from './manifest.js';
import { bundleHash as computeBundleHashStable } from '../utils/hash.js';
import { createRequire } from 'node:module';

// Load package.json to get version
const require = createRequire(import.meta.url);
const pkg = require('../../package.json');
const PACKAGE_VERSION = `${pkg.name}@${pkg.version}`;

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
export interface BundleNode {
  entryId: string;
  contract: UIFContract;
  codeHeader?: string | null;
  code?: string | null;
}

/**
 * Missing dependency information
 */
export interface MissingDependency {
  name: string;
  reason: string;
  referencedBy?: string;
}

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
 * Load manifest from file
 */
export async function loadManifest(basePath: string): Promise<ProjectManifest> {
  const manifestPath = join(basePath, 'logicstamp.manifest.json');
  try {
    const content = await readFile(manifestPath, 'utf8');
    return JSON.parse(content) as ProjectManifest;
  } catch (error) {
    throw new Error(
      `Failed to load manifest at ${manifestPath}: ${(error as Error).message}`
    );
  }
}

/**
 * Load a sidecar contract file
 * Sidecar path is computed from the manifest key (project-relative): resolved from projectRoot + key + '.uif.json'
 */
export async function loadContract(entryId: string, projectRoot: string): Promise<UIFContract | null> {
  // Resolve relative path from project root
  const absolutePath = isAbsolute(entryId) ? entryId : resolve(projectRoot, entryId);
  const sidecarPath = `${absolutePath}.uif.json`;

  try {
    const content = await readFile(sidecarPath, 'utf8');
    return JSON.parse(content) as UIFContract;
  } catch (error) {
    // Sidecar file doesn't exist or can't be read
    return null;
  }
}

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
 */
export function resolveDependency(
  manifest: ProjectManifest,
  depName: string,
  parentId: string
): string | null {
  // parentId is a manifest key (canonical identifier)
  // Try to find component by name first using canonical resolution
  const key = resolveKey(manifest, depName);
  if (key) {
    return key; // Return manifest key (canonical identifier)
  }

  // Try relative path resolution based on parent
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
      return key; // Return manifest key
    }
  }

  return null;
}

/**
 * Perform BFS traversal to collect dependencies
 */
export function collectDependencies(
  entryId: string,
  manifest: ProjectManifest,
  depth: number,
  maxNodes: number
): { visited: Set<string>; missing: MissingDependency[] } {
  const visited = new Set<string>();
  const missing: MissingDependency[] = [];
  const queue: Array<{ id: string; level: number }> = [{ id: entryId, level: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Normalize the ID for lookup
    const normalizedId = normalizeEntryId(current.id);
    
    // Try to find component by normalized ID
    let node = manifest.components[normalizedId];
    let componentKey = normalizedId;
    
    // If not found, try to find by matching normalized entryIds
    if (!node) {
      for (const [key, comp] of Object.entries(manifest.components)) {
        if (normalizeEntryId(key) === normalizedId || normalizeEntryId(comp.entryId) === normalizedId) {
          node = comp;
          componentKey = key;
          break;
        }
      }
    }

    // Skip if already visited or exceeded depth
    if (visited.has(componentKey) || current.level > depth) {
      continue;
    }

    // Check max nodes limit
    if (visited.size >= maxNodes) {
      break;
    }
    
    if (!node) {
      missing.push({
        name: current.id,
        reason: 'Component not found in manifest',
      });
      continue;
    }

    visited.add(componentKey);

    // Only traverse deeper if we haven't reached depth limit
    if (current.level < depth) {
      // Add dependencies to queue
      for (const dep of node.dependencies) {
        const resolvedId = resolveDependency(manifest, dep, componentKey);

        if (resolvedId) {
          if (!visited.has(resolvedId)) {
            queue.push({ id: resolvedId, level: current.level + 1 });
          }
        } else {
          // Track missing dependency
          if (!missing.some((m) => m.name === dep)) {
            missing.push({
              name: dep,
              reason: 'No contract found (third-party or not scanned)',
              referencedBy: componentKey, // Use manifest key, not current.id
            });
          }
        }
      }
    }
  }

  return { visited, missing };
}

/**
 * Extract code header (JSDoc @uif block) from source file
 */
export async function extractCodeHeader(entryId: string, projectRoot: string): Promise<string | null> {
  try {
    const absolutePath = isAbsolute(entryId) ? entryId : resolve(projectRoot, entryId);
    const content = await readFile(absolutePath, 'utf8');

    // Look for @uif JSDoc block
    const headerMatch = content.match(/\/\*\*[\s\S]*?@uif[\s\S]*?\*\//);
    if (headerMatch) {
      return headerMatch[0];
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Read full source code
 */
export async function readSourceCode(entryId: string, projectRoot: string): Promise<string | null> {
  try {
    const absolutePath = isAbsolute(entryId) ? entryId : resolve(projectRoot, entryId);
    return await readFile(absolutePath, 'utf8');
  } catch (error) {
    return null;
  }
}

/**
 * Build edges from nodes based on dependencies
 */
export function buildEdges(nodes: BundleNode[], manifest: ProjectManifest): [string, string][] {
  const edges: [string, string][] = [];
  const nodeIds = new Set(nodes.map((n) => n.entryId));

  for (const node of nodes) {
    const componentNode = manifest.components[node.entryId];
    if (!componentNode) continue;

    for (const dep of componentNode.dependencies) {
      const resolvedId = resolveDependency(manifest, dep, node.entryId);

      // Only add edge if both nodes are in the bundle
      if (resolvedId && nodeIds.has(resolvedId)) {
        edges.push([node.entryId, resolvedId]);
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
    const { fileHash: computedFileHash } = await import('../utils/hash.js');
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
      missing,
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
