/**
 * Incremental Watch Mode - Fast rebuilds with caching
 * Only rebuilds affected bundles instead of full regeneration
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
  // Style cache: fileHash -> style metadata
  styleCache: Map<string, any>;
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
 * Incrementally rebuild only affected bundles
 */
export async function incrementalRebuild(
  changedFiles: string[],
  cache: WatchCache,
  options: ContextOptions,
  projectRoot: string
): Promise<{ bundles: LogicStampBundle[]; updatedBundles: Set<string> }> {
  const updatedBundles = new Set<string>();
  const affectedComponents = new Set<string>();
  const contractsToRebuild = new Map<string, UIFContract>();

  // Step 1: Rebuild contracts for changed files
  for (const file of changedFiles) {
    const absoluteFilePath = isAbsolute(file) ? file : join(projectRoot, file);
    
    try {
      // Read file content
      const { text } = await readFileWithText(absoluteFilePath);
      const currentFileHash = fileHash(text);

      // Check if file actually changed (compare hash)
      const existingContract = Array.from(cache.contracts.values()).find(
        c => normalizeEntryId(c.entryId) === normalizeEntryId(file)
      );

      if (existingContract && existingContract.fileHash === currentFileHash) {
        // File hash unchanged - skip (might be a false positive from watcher)
        continue;
      }

      // Rebuild contract for this file
      const ast = await extractFromFile(absoluteFilePath);
      
      // Extract style if needed (with caching)
      let styleMetadata;
      if (options.includeStyle) {
        // Check cache first
        const cachedStyle = cache.styleCache.get(currentFileHash);
        if (cachedStyle) {
          styleMetadata = cachedStyle;
        } else {
          try {
            const styleProject = new Project({
              skipAddingFilesFromTsConfig: true,
              compilerOptions: { jsx: 1, target: 99 },
            });
            const sourceFile = styleProject.addSourceFileAtPath(absoluteFilePath);
            styleMetadata = await extractStyleMetadata(sourceFile, absoluteFilePath);
            // Cache style extraction result
            if (styleMetadata) {
              cache.styleCache.set(currentFileHash, styleMetadata);
            }
          } catch {
            // Style extraction failed - continue without it
          }
        }
      }

      const result = buildContract(file, ast, {
        preset: 'none',
        sourceText: text,
        enablePredictions: options.predictBehavior,
        styleMetadata,
      });

      if (result.contract) {
        // Remove old contract with different hash but same entryId to prevent duplicates
        const normalizedEntryId = normalizeEntryId(file);
        for (const [hash, contract] of cache.contracts.entries()) {
          if (normalizeEntryId(contract.entryId) === normalizedEntryId && hash !== result.contract.fileHash) {
            cache.contracts.delete(hash);
            break;
          }
        }
        
        // Update cache with new contract
        cache.contracts.set(result.contract.fileHash, result.contract);
        contractsToRebuild.set(file, result.contract);
        affectedComponents.add(normalizedEntryId);

        // Find all bundles that include this component
        const bundlesForComponent = cache.componentToBundles.get(normalizedEntryId) || new Set();
        for (const bundleId of bundlesForComponent) {
          updatedBundles.add(bundleId);
        }
      }
    } catch (error) {
      // Skip files that can't be analyzed
      continue;
    }
  }

  // Step 2: Update manifest with new contracts
  // Deduplicate contracts by entryId to prevent duplicates from hash changes
  const contractsByEntryId = new Map<string, UIFContract>();
  for (const contract of cache.contracts.values()) {
    const normalizedId = normalizeEntryId(contract.entryId);
    // Keep the most recent contract (by fileHash) for each entryId
    const existing = contractsByEntryId.get(normalizedId);
    if (!existing || contract.fileHash > existing.fileHash) {
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
      // If bundle rebuild fails, keep the old one
      const oldBundle = cache.allBundles.find(b => b.entryId === bundleId);
      if (oldBundle) {
        rebuiltBundles.push(oldBundle);
      }
    }
  }

  // Sort bundles by entryId for deterministic output
  rebuiltBundles.sort((a, b) => a.entryId.localeCompare(b.entryId));

  // Update cache
  cache.allBundles = rebuiltBundles;
  cache.manifest = updatedManifest;

  return { bundles: rebuiltBundles, updatedBundles };
}
