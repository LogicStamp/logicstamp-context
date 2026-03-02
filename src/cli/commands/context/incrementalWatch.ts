/**
 * Incremental Watch Mode - Fast rebuilds with caching
 * Only rebuilds affected bundles instead of full recompilation
 */

import { resolve, dirname, join, relative, isAbsolute } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { UIFContract } from '../../../types/UIFContract.js';
import type { LogicStampBundle } from '../../../core/pack.js';
import type { ProjectManifest } from '../../../core/manifest.js';
import { buildDependencyGraph } from '../../../core/manifest.js';
import { pack, type PackOptions } from '../../../core/pack.js';
import { extractFromFile } from '../../../core/astParser.js';
import { buildContract } from '../../../core/contractBuilder.js';
import { extractStyleMetadata } from '../../../extractors/styling/index.js';
import { readFileWithText, normalizeEntryId } from '../../../utils/fsx.js';
import { fileHash } from '../../../utils/hash.js';
import { debugError } from '../../../utils/debug.js';
import { Project } from 'ts-morph';
import { buildContractsFromFiles } from './contractBuilder.js';
import { writeContextFiles, writeMainIndex, groupBundlesByFolder, displayPath } from './fileWriter.js';
import { formatBundles } from './bundleFormatter.js';
import { calculateStats } from './statsCalculator.js';
import { validateBundles } from '../validate.js';
import type { ContextOptions } from '../context.js';

/**
 * Cache entries for contracts, AST, and style extraction
 */
export interface WatchCache {
  // Contract cache: fileHash -> contract
  contracts: Map<string, UIFContract>;
  // AST cache: fileHash -> AST extract
  astCache: Map<string, any>;
  // Style cache: fileHash -> style metadata (null sentinel indicates failed extraction)
  styleCache: Map<string, any | null>;
  // File list cache: tracks all files in project
  fileList: Set<string>;
  // Reverse index: component entryId -> bundles that include it
  componentToBundles: Map<string, Set<string>>;
  // Manifest cache
  manifest: ProjectManifest | null;
  // All bundles cache
  allBundles: LogicStampBundle[];
}

/**
 * Initialize watch cache from initial build
 */
export async function initializeWatchCache(
  files: string[],
  contracts: UIFContract[],
  manifest: ProjectManifest,
  bundles: LogicStampBundle[],
  projectRoot: string
): Promise<WatchCache> {
  const cache: WatchCache = {
    contracts: new Map(),
    astCache: new Map(),
    styleCache: new Map(),
    fileList: new Set(files),
    componentToBundles: new Map(),
    manifest,
    allBundles: bundles,
  };

  // Build reverse index: component -> bundles that include it
  for (const bundle of bundles) {
    for (const node of bundle.graph.nodes) {
      const entryId = normalizeEntryId(node.contract.entryId);
      if (!cache.componentToBundles.has(entryId)) {
        cache.componentToBundles.set(entryId, new Set());
      }
      cache.componentToBundles.get(entryId)!.add(bundle.entryId);
    }
  }

  // Cache contracts by fileHash
  for (const contract of contracts) {
    cache.contracts.set(contract.fileHash, contract);
  }

  return cache;
}

/**
 * Generate cache key for style metadata (includes content hash and style mode)
 */
function styleCacheKey(contentHash: string, options: ContextOptions): string {
  return `${contentHash}:${options.styleMode ?? 'lean'}`;
}

/**
 * Check if style metadata is already cached for a given content hash
 */
function hasStyleCached(contentHash: string, cache: WatchCache, options: ContextOptions): boolean {
  if (!options.includeStyle) return true;
  return cache.styleCache.has(styleCacheKey(contentHash, options));
}

/**
 * Extract and cache style metadata for a file
 * Returns the style metadata (or undefined if extraction failed/not needed)
 */
async function extractAndCacheStyle(
  absoluteFilePath: string,
  contentHash: string,
  cache: WatchCache,
  options: ContextOptions
): Promise<any> {
  if (!options.includeStyle) {
    return undefined;
  }

  const key = styleCacheKey(contentHash, options);

  // Check cache first - use key to look up cached style
  // Use .has() to distinguish between undefined and falsy values
  if (cache.styleCache.has(key)) {
    const cached = cache.styleCache.get(key);
    // Convert null sentinel back to undefined (null means "tried and got nothing")
    return cached === null ? undefined : cached;
  }

  // Extract and cache style metadata
  try {
    const styleProject = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { jsx: 1, target: 99 },
    });
    const sourceFile = styleProject.addSourceFileAtPath(absoluteFilePath);
    const styleMetadata = await extractStyleMetadata(sourceFile, absoluteFilePath, options.styleMode ?? 'lean');
    // Cache style extraction result (use null as sentinel for undefined to avoid retrying failures)
    cache.styleCache.set(key, styleMetadata ?? null);
    return styleMetadata;
  } catch (error) {
    // Style extraction failed - log error and cache null to avoid retrying on every rebuild
    debugError('incrementalWatch', 'extractAndCacheStyle', {
      filePath: absoluteFilePath,
      error: error instanceof Error ? error.message : String(error),
      context: 'Style extraction failed, continuing without style metadata',
    });
    cache.styleCache.set(key, null);
    return undefined;
  }
}

/**
 * Incrementally rebuild only affected bundles
 */
export async function incrementalRebuild(
  changedFiles: string[],
  cache: WatchCache,
  options: ContextOptions,
  projectRoot: string
): Promise<{ bundles: LogicStampBundle[]; updatedBundles: Set<string> }> {
  const updatedBundles = new Set<string>();

  // Step 1: Rebuild contracts for changed files
  for (const file of changedFiles) {
    const absoluteFilePath = isAbsolute(file) ? file : join(projectRoot, file);
    
    try {
      // Read file content
      const { text } = await readFileWithText(absoluteFilePath);
      const currentFileHash = fileHash(text);
      const normalizedEntryId = normalizeEntryId(file);

      // Check if file actually changed (compare hash)
      const existingContract = Array.from(cache.contracts.values()).find(
        c => normalizeEntryId(c.entryId) === normalizedEntryId
      );

      if (existingContract && existingContract.fileHash === currentFileHash) {
        // File hash unchanged - check if we need to backfill styles
        if (hasStyleCached(currentFileHash, cache, options)) {
          // File hash unchanged and styles already cached (or not needed) - skip
          // (might be a false positive from watcher)
          continue;
        }

        // Fast path: only backfill styles, skip AST/contract rebuild
        await extractAndCacheStyle(absoluteFilePath, currentFileHash, cache, options);
        continue;
      }

      // Rebuild contract for this file
      const ast = await extractFromFile(absoluteFilePath);
      
      // Extract style if needed (with caching)
      const styleMetadata = await extractAndCacheStyle(absoluteFilePath, currentFileHash, cache, options);

      const result = buildContract(file, ast, {
        preset: 'none',
        sourceText: text,
        enablePredictions: options.predictBehavior,
        styleMetadata,
      });

      if (result.contract) {
        // Remove old contract with different hash but same entryId to prevent duplicates
        // normalizedEntryId already computed above
        
        // Capture old hashes BEFORE deleting contracts (so we can clean up style cache)
        const oldHashes: string[] = [];
        for (const [hash, contract] of cache.contracts.entries()) {
          if (normalizeEntryId(contract.entryId) === normalizedEntryId && hash !== result.contract.fileHash) {
            oldHashes.push(hash);
          }
        }
        
        // Remove old contracts
        for (const h of oldHashes) {
          cache.contracts.delete(h);
        }
        
        // Clean up old style cache entries for the same entryId (different hash)
        // This prevents cache growth when files change repeatedly
        // Delete all style mode variants for each old hash
        if (options.includeStyle) {
          for (const oldHash of oldHashes) {
            for (const key of cache.styleCache.keys()) {
              if (key.startsWith(`${oldHash}:`)) {
                cache.styleCache.delete(key);
              }
            }
          }
        }
        
        // Update cache with new contract
        cache.contracts.set(result.contract.fileHash, result.contract);

        // Find all bundles that include this component
        const bundlesForComponent = cache.componentToBundles.get(normalizedEntryId) || new Set();
        for (const bundleId of bundlesForComponent) {
          updatedBundles.add(bundleId);
        }
        
        // Also check if this component has its own bundle (root component)
        // This handles cases where componentToBundles doesn't include the component's own bundle
        const existingBundle = cache.allBundles.find(
          b => normalizeEntryId(b.entryId) === normalizedEntryId
        );
        // bundlesForComponent contains unnormalized bundle IDs, so check with unnormalized ID
        // but ensure we normalize for comparison consistency
        if (existingBundle && !bundlesForComponent.has(existingBundle.entryId)) {
          updatedBundles.add(existingBundle.entryId);
        }
      }
    } catch (error) {
      // Skip files that can't be analyzed
      continue;
    }
  }

  // Step 2: Update manifest with new contracts
  // Deduplicate contracts by entryId to prevent duplicates from hash changes
  // Note: We already removed duplicates above when processing changed files,
  // so this is mainly defensive. Use "first one wins" since fileHash string
  // comparison doesn't indicate "newer" (hashes are not ordered).
  const contractsByEntryId = new Map<string, UIFContract>();
  for (const contract of cache.contracts.values()) {
    const normalizedId = normalizeEntryId(contract.entryId);
    // Keep first contract encountered for each entryId
    // Duplicates should have been removed earlier, but this is defensive
    if (!contractsByEntryId.has(normalizedId)) {
      contractsByEntryId.set(normalizedId, contract);
    }
  }
  const allContracts = Array.from(contractsByEntryId.values());
  
  // Update contracts cache to only contain deduplicated contracts
  cache.contracts.clear();
  for (const contract of allContracts) {
    cache.contracts.set(contract.fileHash, contract);
  }
  
  const updatedManifest = buildDependencyGraph(allContracts);
  
  // Check for new root components that need bundles
  const oldRoots = cache.manifest ? new Set(cache.manifest.graph.roots.map(r => normalizeEntryId(r))) : new Set();
  const newRoots = new Set(updatedManifest.graph.roots.map(r => normalizeEntryId(r)));
  for (const rootId of newRoots) {
    if (!oldRoots.has(rootId)) {
      // New root component - needs a bundle
      updatedBundles.add(rootId);
    }
  }
  
  // Update manifest cache
  cache.manifest = updatedManifest;

  // Step 3: Rebuild affected bundles
  const packOptions: PackOptions = {
    depth: options.depth,
    includeCode: options.includeCode,
    format: options.format,
    hashLock: options.hashLock,
    strict: options.strict,
    allowMissing: options.allowMissing,
    maxNodes: options.maxNodes,
    contractsMap: new Map(allContracts.map(c => [c.entryId, c])),
  };

  const rebuiltBundles: LogicStampBundle[] = [];
  const newRootSet = new Set(updatedManifest.graph.roots.map(r => normalizeEntryId(r)));

  // Keep existing bundles that weren't affected AND are still roots
  // (Remove bundles for components that are no longer roots)
  for (const bundle of cache.allBundles) {
    const normalizedEntryId = normalizeEntryId(bundle.entryId);
    if (!updatedBundles.has(bundle.entryId) && newRootSet.has(normalizedEntryId)) {
      rebuiltBundles.push(bundle);
    }
  }

  // Rebuild affected bundles
  for (const bundleId of updatedBundles) {
    try {
      const bundle = await pack(bundleId, updatedManifest, packOptions, projectRoot);
      rebuiltBundles.push(bundle);
      
      // Update reverse index - remove old entries first
      for (const [entryId, bundles] of cache.componentToBundles.entries()) {
        bundles.delete(bundleId);
      }
      
      // Add new entries
      for (const node of bundle.graph.nodes) {
        const entryId = normalizeEntryId(node.contract.entryId);
        if (!cache.componentToBundles.has(entryId)) {
          cache.componentToBundles.set(entryId, new Set());
        }
        cache.componentToBundles.get(entryId)!.add(bundleId);
      }
    } catch (error) {
      // If bundle rebuild fails, keep the old one and restore its contracts
      const oldBundle = cache.allBundles.find(b => b.entryId === bundleId);
      if (oldBundle) {
        rebuiltBundles.push(oldBundle);
        // Restore contracts from old bundle to maintain cache consistency
        for (const node of oldBundle.graph.nodes) {
          cache.contracts.set(node.contract.fileHash, node.contract);
        }
        // Restore reverse index entries for the old bundle
        for (const node of oldBundle.graph.nodes) {
          const entryId = normalizeEntryId(node.contract.entryId);
          if (!cache.componentToBundles.has(entryId)) {
            cache.componentToBundles.set(entryId, new Set());
          }
          cache.componentToBundles.get(entryId)!.add(bundleId);
        }
      }
    }
  }

  // Sort bundles by entryId for deterministic output
  rebuiltBundles.sort((a, b) => a.entryId.localeCompare(b.entryId));

  // Rebuild contracts map from actual bundle contents to ensure consistency
  // This handles cases where some bundles were reverted after pack() failures
  const finalContracts = new Map<string, UIFContract>();
  for (const bundle of rebuiltBundles) {
    for (const node of bundle.graph.nodes) {
      finalContracts.set(node.contract.fileHash, node.contract);
    }
  }
  cache.contracts = finalContracts;

  // Rebuild manifest from final contracts to ensure consistency
  const consistentManifest = buildDependencyGraph(Array.from(finalContracts.values()));

  // Update cache
  cache.allBundles = rebuiltBundles;
  cache.manifest = consistentManifest;

  return { bundles: rebuiltBundles, updatedBundles };
}
