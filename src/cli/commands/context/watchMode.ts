/**
 * Watch Mode - Monitors file changes and regenerates context automatically
 */

import { resolve, dirname, join, relative } from 'node:path';
import { readFile } from 'node:fs/promises';
import chokidar from 'chokidar';
import { globFiles } from '../../../utils/fsx.js';
import { readStampignore, filterIgnoredFiles } from '../../../utils/stampignore.js';
import { buildDependencyGraph } from '../../../core/manifest.js';
import type { LogicStampBundle } from '../../../core/pack.js';
import { normalizeEntryId } from '../../../utils/fsx.js';
import { writeWatchStatus, deleteWatchStatus, appendWatchLog } from '../../../utils/config.js';
import type { WatchLogEntry } from '../../../utils/config.js';
import type { UIFContract } from '../../../types/UIFContract.js';
import {
  buildContractsFromFiles,
  writeContextFiles,
  writeMainIndex,
  groupBundlesByFolder,
  displayPath,
  initializeWatchCache,
  incrementalRebuild,
  type WatchCache,
} from './index.js';
import { contextCommand, type ContextOptions } from '../context.js';

/**
 * Start watch mode - monitors file changes and regenerates context
 */
export async function startWatchMode(options: ContextOptions, projectRoot: string, initialCache: WatchCache | null = null): Promise<void> {
  if (!options.quiet) {
    console.log(`\n👀 Watch mode enabled. Watching for file changes...`);
    console.log(`   Press Ctrl+C to stop\n`);
  }

  // Determine output directory
  const outPath = resolve(options.out);
  const outputDir = outPath.endsWith('.json') ? dirname(outPath) : outPath;

  // Write watch status file so MCP server can detect watch mode
  try {
    await writeWatchStatus(projectRoot, {
      active: true,
      projectRoot,
      pid: process.pid,
      startedAt: new Date().toISOString(),
      outputDir,
    });
  } catch (error) {
    // Non-fatal - continue even if status file can't be written
    if (!options.quiet) {
      console.warn(`   ⚠️  Warning: Could not write watch status file: ${(error as Error).message}`);
    }
  }

  let debounceTimer: NodeJS.Timeout | null = null;
  let isRegenerating = false;
  let changedFiles: Set<string> = new Set();
  let previousBundles: LogicStampBundle[] | null = null;
  let watchCache: WatchCache | null = initialCache;
  let isFirstRun = false; // Set to false since cache is already initialized

  // Debounce delay in milliseconds (wait 500ms after last change before regenerating)
  const DEBOUNCE_DELAY = 500;

  // Helper to load all bundles from context files
  const loadAllBundles = async (outputDir: string): Promise<LogicStampBundle[]> => {
    try {
      const mainIndexPath = join(outputDir, 'context_main.json');
      const mainIndexContent = await readFile(mainIndexPath, 'utf8');
      const mainIndex = JSON.parse(mainIndexContent) as { folders?: Array<{ contextFile?: string }> };
      
      const allBundles: LogicStampBundle[] = [];
      
      if (mainIndex.folders) {
        for (const folder of mainIndex.folders) {
          if (folder.contextFile) {
            const contextPath = join(outputDir, folder.contextFile);
            try {
              const contextContent = await readFile(contextPath, 'utf8');
              const bundles = JSON.parse(contextContent) as LogicStampBundle[];
              allBundles.push(...bundles);
            } catch {
              // Skip if file doesn't exist or can't be read
            }
          }
        }
      }
      
      return allBundles;
    } catch {
      return [];
    }
  };

  // Helper to get contract from bundles by entryId
  const getContractFromBundles = (bundles: LogicStampBundle[], entryId: string): UIFContract | null => {
    const normalizedId = normalizeEntryId(entryId).toLowerCase();
    for (const bundle of bundles) {
      for (const node of bundle.graph.nodes) {
        if (normalizeEntryId(node.contract.entryId).toLowerCase() === normalizedId) {
          return node.contract;
        }
      }
    }
    return null;
  };

  // Helper to compare two contracts and return detailed diff
  const compareContracts = (oldContract: UIFContract, newContract: UIFContract): {
    props: { added: string[]; removed: string[]; changed: Array<{ name: string; old: any; new: any }> };
    emits: { added: string[]; removed: string[]; changed: Array<{ name: string; old: any; new: any }> };
    state: { added: string[]; removed: string[]; changed: Array<{ name: string; old: any; new: any }> };
    hooks: { added: string[]; removed: string[] };
    components: { added: string[]; removed: string[] };
    variables: { added: string[]; removed: string[] };
    functions: { added: string[]; removed: string[] };
  } => {
    const diff = {
      props: { added: [] as string[], removed: [] as string[], changed: [] as Array<{ name: string; old: any; new: any }> },
      emits: { added: [] as string[], removed: [] as string[], changed: [] as Array<{ name: string; old: any; new: any }> },
      state: { added: [] as string[], removed: [] as string[], changed: [] as Array<{ name: string; old: any; new: any }> },
      hooks: { added: [] as string[], removed: [] as string[] },
      components: { added: [] as string[], removed: [] as string[] },
      variables: { added: [] as string[], removed: [] as string[] },
      functions: { added: [] as string[], removed: [] as string[] },
    };

    // Compare props
    const oldProps = oldContract.logicSignature.props || {};
    const newProps = newContract.logicSignature.props || {};
    for (const [key, value] of Object.entries(newProps)) {
      if (!(key in oldProps)) {
        diff.props.added.push(key);
      } else if (JSON.stringify(oldProps[key]) !== JSON.stringify(value)) {
        diff.props.changed.push({ name: key, old: oldProps[key], new: value });
      }
    }
    for (const key of Object.keys(oldProps)) {
      if (!(key in newProps)) {
        diff.props.removed.push(key);
      }
    }

    // Compare emits
    const oldEmits = oldContract.logicSignature.emits || {};
    const newEmits = newContract.logicSignature.emits || {};
    for (const [key, value] of Object.entries(newEmits)) {
      if (!(key in oldEmits)) {
        diff.emits.added.push(key);
      } else if (JSON.stringify(oldEmits[key]) !== JSON.stringify(value)) {
        diff.emits.changed.push({ name: key, old: oldEmits[key], new: value });
      }
    }
    for (const key of Object.keys(oldEmits)) {
      if (!(key in newEmits)) {
        diff.emits.removed.push(key);
      }
    }

    // Compare state
    const oldState = oldContract.logicSignature.state || {};
    const newState = newContract.logicSignature.state || {};
    for (const [key, value] of Object.entries(newState)) {
      if (!(key in oldState)) {
        diff.state.added.push(key);
      } else if (JSON.stringify(oldState[key]) !== JSON.stringify(value)) {
        diff.state.changed.push({ name: key, old: oldState[key], new: value });
      }
    }
    for (const key of Object.keys(oldState)) {
      if (!(key in newState)) {
        diff.state.removed.push(key);
      }
    }

    // Compare version arrays
    const compareArrays = (oldArr: string[], newArr: string[], diffObj: { added: string[]; removed: string[] }) => {
      const oldSet = new Set(oldArr);
      const newSet = new Set(newArr);
      for (const item of newSet) {
        if (!oldSet.has(item)) {
          diffObj.added.push(item);
        }
      }
      for (const item of oldSet) {
        if (!newSet.has(item)) {
          diffObj.removed.push(item);
        }
      }
    };

    compareArrays(oldContract.version.hooks || [], newContract.version.hooks || [], diff.hooks);
    compareArrays(oldContract.version.components || [], newContract.version.components || [], diff.components);
    compareArrays(oldContract.version.variables || [], newContract.version.variables || [], diff.variables);
    compareArrays(oldContract.version.functions || [], newContract.version.functions || [], diff.functions);

    return diff;
  };

  // Helper to compare bundles and return structured change data
  const getChanges = (oldBundles: LogicStampBundle[], newBundles: LogicStampBundle[], changedFile: string): {
    changed: Array<{ 
      entryId: string; 
      semanticHash?: { old: string; new: string }; 
      fileHash?: { old: string; new: string };
      contractDiff?: ReturnType<typeof compareContracts>;
    }>;
    added: string[];
    removed: string[];
    bundleChanged: Array<{ entryId: string; oldHash: string; newHash: string }>;
  } | null => {
    // Index contracts with all hash types
    const indexContracts = (bundles: LogicStampBundle[]): Map<string, { 
      semanticHash: string; 
      fileHash: string;
      entryId: string;
    }> => {
      const m = new Map<string, { semanticHash: string; fileHash: string; entryId: string }>();
      for (const b of bundles) {
        for (const n of b.graph.nodes) {
          const normalizedId = normalizeEntryId(n.contract.entryId).toLowerCase();
          m.set(normalizedId, {
            semanticHash: n.contract.semanticHash,
            fileHash: n.contract.fileHash,
            entryId: n.contract.entryId,
          });
        }
      }
      return m;
    };

    // Index bundles by entryId to track bundleHash changes
    const indexBundles = (bundles: LogicStampBundle[]): Map<string, { bundleHash: string; entryId: string }> => {
      const m = new Map<string, { bundleHash: string; entryId: string }>();
      for (const b of bundles) {
        const normalizedId = normalizeEntryId(b.entryId).toLowerCase();
        m.set(normalizedId, {
          bundleHash: b.bundleHash,
          entryId: b.entryId,
        });
      }
      return m;
    };

    const oldContractIdx = indexContracts(oldBundles);
    const newContractIdx = indexContracts(newBundles);
    const oldBundleIdx = indexBundles(oldBundles);
    const newBundleIdx = indexBundles(newBundles);

    const changed: Array<{ 
      entryId: string; 
      semanticHash?: { old: string; new: string };
      fileHash?: { old: string; new: string };
      contractDiff?: ReturnType<typeof compareContracts>;
    }> = [];
    const added: string[] = [];
    const removed: string[] = [];
    const bundleChanged: Array<{ entryId: string; oldHash: string; newHash: string }> = [];

    // Find changed contracts
    for (const [id, newContract] of newContractIdx.entries()) {
      const oldContract = oldContractIdx.get(id);
      if (oldContract) {
        const changes: { semanticHash?: { old: string; new: string }; fileHash?: { old: string; new: string }; contractDiff?: ReturnType<typeof compareContracts> } = {};
        
        if (oldContract.semanticHash !== newContract.semanticHash) {
          changes.semanticHash = { old: oldContract.semanticHash, new: newContract.semanticHash };
          
          // Get full contracts for detailed diff
          const oldContractFull = getContractFromBundles(oldBundles, newContract.entryId);
          const newContractFull = getContractFromBundles(newBundles, newContract.entryId);
          if (oldContractFull && newContractFull) {
            changes.contractDiff = compareContracts(oldContractFull, newContractFull);
          }
        }
        
        if (oldContract.fileHash !== newContract.fileHash) {
          changes.fileHash = { old: oldContract.fileHash, new: newContract.fileHash };
        }
        
        if (Object.keys(changes).length > 0) {
          changed.push({ entryId: newContract.entryId, ...changes });
        }
      } else {
        added.push(newContract.entryId);
      }
    }

    // Find removed contracts
    for (const [id, oldContract] of oldContractIdx.entries()) {
      if (!newContractIdx.has(id)) {
        removed.push(oldContract.entryId);
      }
    }

    // Find changed bundles
    for (const [id, newBundle] of newBundleIdx.entries()) {
      const oldBundle = oldBundleIdx.get(id);
      if (oldBundle && oldBundle.bundleHash !== newBundle.bundleHash) {
        bundleChanged.push({
          entryId: newBundle.entryId,
          oldHash: oldBundle.bundleHash,
          newHash: newBundle.bundleHash,
        });
      }
    }

    // Return null if no changes
    if (changed.length === 0 && added.length === 0 && removed.length === 0 && bundleChanged.length === 0) {
      return null;
    }

    return { changed, added, removed, bundleChanged };
  };

  // Helper to show changes to console
  const showChanges = (oldBundles: LogicStampBundle[], newBundles: LogicStampBundle[], changedFile: string) => {
    const changes = getChanges(oldBundles, newBundles, changedFile);
    if (!changes) {
      return;
    }

    const { changed, added, removed, bundleChanged } = changes;
    const isDebug = options.debug || false;

    // Always show clean summary first (both regular and debug mode)
    if (changed.length > 0) {
      console.log(`\n✏️  Modified contract:`);
      changed.forEach(({ entryId, semanticHash, fileHash, contractDiff }) => {
        console.log(`  ${entryId}`);
        
        if (contractDiff) {
          const details: string[] = [];
          
          // Props changes
          if (contractDiff.props.added.length > 0) {
            details.push(`Added props: ${contractDiff.props.added.map(p => `\`${p}\``).join(', ')}`);
          }
          if (contractDiff.props.removed.length > 0) {
            details.push(`Removed props: ${contractDiff.props.removed.map(p => `\`${p}\``).join(', ')}`);
          }
          if (contractDiff.props.changed.length > 0) {
            details.push(`Changed props: ${contractDiff.props.changed.map(p => `\`${p.name}\``).join(', ')}`);
          }
          
          // Emits changes
          if (contractDiff.emits.added.length > 0) {
            details.push(`Added events: ${contractDiff.emits.added.map(e => `\`${e}\``).join(', ')}`);
          }
          if (contractDiff.emits.removed.length > 0) {
            details.push(`Removed events: ${contractDiff.emits.removed.map(e => `\`${e}\``).join(', ')}`);
          }
          if (contractDiff.emits.changed.length > 0) {
            details.push(`Changed events: ${contractDiff.emits.changed.map(e => `\`${e.name}\``).join(', ')}`);
          }
          
          // State changes
          if (contractDiff.state.added.length > 0) {
            details.push(`Added state: ${contractDiff.state.added.map(s => `\`${s}\``).join(', ')}`);
          }
          if (contractDiff.state.removed.length > 0) {
            details.push(`Removed state: ${contractDiff.state.removed.map(s => `\`${s}\``).join(', ')}`);
          }
          if (contractDiff.state.changed.length > 0) {
            details.push(`Changed state: ${contractDiff.state.changed.map(s => `\`${s.name}\``).join(', ')}`);
          }
          
          // Hooks changes
          if (contractDiff.hooks.added.length > 0) {
            details.push(`Added hooks: ${contractDiff.hooks.added.map(h => `\`${h}\``).join(', ')}`);
          }
          if (contractDiff.hooks.removed.length > 0) {
            details.push(`Removed hooks: ${contractDiff.hooks.removed.map(h => `\`${h}\``).join(', ')}`);
          }
          
          // Components changes
          if (contractDiff.components.added.length > 0) {
            details.push(`Added components: ${contractDiff.components.added.map(c => `\`${c}\``).join(', ')}`);
          }
          if (contractDiff.components.removed.length > 0) {
            details.push(`Removed components: ${contractDiff.components.removed.map(c => `\`${c}\``).join(', ')}`);
          }
          
          // Variables changes
          if (contractDiff.variables.added.length > 0) {
            details.push(`Added variables: ${contractDiff.variables.added.map(v => `\`${v}\``).join(', ')}`);
          }
          if (contractDiff.variables.removed.length > 0) {
            details.push(`Removed variables: ${contractDiff.variables.removed.map(v => `\`${v}\``).join(', ')}`);
          }
          
          // Functions changes
          if (contractDiff.functions.added.length > 0) {
            details.push(`Added functions: ${contractDiff.functions.added.map(f => `\`${f}\``).join(', ')}`);
          }
          if (contractDiff.functions.removed.length > 0) {
            details.push(`Removed functions: ${contractDiff.functions.removed.map(f => `\`${f}\``).join(', ')}`);
          }
          
          if (details.length > 0) {
            details.forEach(detail => console.log(`   • ${detail}`));
          } else {
            console.log(`   • API changed (semantic hash changed)`);
          }
        } else if (semanticHash) {
          console.log(`   • API changed (semantic hash changed)`);
        } else if (fileHash) {
          console.log(`   • Content changed (file hash changed)`);
        }
      });
    }
    
    if (bundleChanged.length > 0) {
      if (bundleChanged.length === 1) {
        console.log(`\n📦 Modified bundle:`);
        console.log(`  ${bundleChanged[0].entryId}`);
        console.log(`   • Dependency graph updated`);
      } else if (bundleChanged.length <= 3) {
        console.log(`\n📦 Modified bundles (${bundleChanged.length}):`);
        bundleChanged.forEach(({ entryId }) => {
          console.log(`  ${entryId}`);
        });
      } else {
        console.log(`\n📦 Modified bundles (${bundleChanged.length}):`);
        bundleChanged.slice(0, 2).forEach(({ entryId }) => {
          console.log(`  ${entryId}`);
        });
        console.log(`  ... and ${bundleChanged.length - 2} more`);
      }
    }
    
    if (added.length > 0) {
      console.log(`\n➕ Added contract:`);
      added.forEach(id => {
        console.log(`  ${id}`);
      });
    }
    
    if (removed.length > 0) {
      console.log(`\n❌ Removed contract:`);
      removed.forEach(id => {
        console.log(`  ${id}`);
      });
    }

    // Debug mode: show detailed hash information in addition to clean summary
    if (isDebug) {
      console.log(`\n[DEBUG] Changed file: ${changedFile}`);
    
      // Recreate indices for debug mode
      const indexContracts = (bundles: LogicStampBundle[]): Map<string, { 
        semanticHash: string; 
        fileHash: string;
        entryId: string;
      }> => {
        const m = new Map<string, { semanticHash: string; fileHash: string; entryId: string }>();
        for (const b of bundles) {
          for (const n of b.graph.nodes) {
            const normalizedId = normalizeEntryId(n.contract.entryId).toLowerCase();
            m.set(normalizedId, {
              semanticHash: n.contract.semanticHash,
              fileHash: n.contract.fileHash,
              entryId: n.contract.entryId,
            });
          }
        }
        return m;
      };

      const newContractIdx = indexContracts(newBundles);
      const oldContractIdx = indexContracts(oldBundles);
    
      if (changed.length > 0) {
        console.log(`[DEBUG] Modified contracts (${changed.length}):`);
        changed.forEach(({ entryId, semanticHash, fileHash, contractDiff }) => {
          console.log(`  ~ ${entryId}`);
          
          if (semanticHash) {
            console.log(`    semanticHash (API/logic): ${semanticHash.old.substring(0, 12)}... → ${semanticHash.new.substring(0, 12)}...`);
            console.log(`      ↳ Detects: props, events, state, hooks, components, functions`);
            
            // Show detailed diff in debug mode
            if (contractDiff) {
              const hasChanges = 
                contractDiff.props.added.length > 0 || contractDiff.props.removed.length > 0 || contractDiff.props.changed.length > 0 ||
                contractDiff.emits.added.length > 0 || contractDiff.emits.removed.length > 0 || contractDiff.emits.changed.length > 0 ||
                contractDiff.state.added.length > 0 || contractDiff.state.removed.length > 0 || contractDiff.state.changed.length > 0 ||
                contractDiff.hooks.added.length > 0 || contractDiff.hooks.removed.length > 0 ||
                contractDiff.components.added.length > 0 || contractDiff.components.removed.length > 0 ||
                contractDiff.variables.added.length > 0 || contractDiff.variables.removed.length > 0 ||
                contractDiff.functions.added.length > 0 || contractDiff.functions.removed.length > 0;
              
              if (hasChanges) {
                console.log(`    Detailed changes:`);
                if (contractDiff.props.added.length > 0) {
                  console.log(`      + Props: ${contractDiff.props.added.join(', ')}`);
                }
                if (contractDiff.props.removed.length > 0) {
                  console.log(`      - Props: ${contractDiff.props.removed.join(', ')}`);
                }
                if (contractDiff.props.changed.length > 0) {
                  console.log(`      ~ Props: ${contractDiff.props.changed.map(p => p.name).join(', ')}`);
                }
                if (contractDiff.emits.added.length > 0) {
                  console.log(`      + Events: ${contractDiff.emits.added.join(', ')}`);
                }
                if (contractDiff.emits.removed.length > 0) {
                  console.log(`      - Events: ${contractDiff.emits.removed.join(', ')}`);
                }
                if (contractDiff.state.added.length > 0) {
                  console.log(`      + State: ${contractDiff.state.added.join(', ')}`);
                }
                if (contractDiff.state.removed.length > 0) {
                  console.log(`      - State: ${contractDiff.state.removed.join(', ')}`);
                }
                if (contractDiff.hooks.added.length > 0) {
                  console.log(`      + Hooks: ${contractDiff.hooks.added.join(', ')}`);
                }
                if (contractDiff.hooks.removed.length > 0) {
                  console.log(`      - Hooks: ${contractDiff.hooks.removed.join(', ')}`);
                }
                if (contractDiff.components.added.length > 0) {
                  console.log(`      + Components: ${contractDiff.components.added.join(', ')}`);
                }
                if (contractDiff.components.removed.length > 0) {
                  console.log(`      - Components: ${contractDiff.components.removed.join(', ')}`);
                }
                if (contractDiff.variables.added.length > 0) {
                  console.log(`      + Variables: ${contractDiff.variables.added.join(', ')}`);
                }
                if (contractDiff.variables.removed.length > 0) {
                  console.log(`      - Variables: ${contractDiff.variables.removed.join(', ')}`);
                }
                if (contractDiff.functions.added.length > 0) {
                  console.log(`      + Functions: ${contractDiff.functions.added.join(', ')}`);
                }
                if (contractDiff.functions.removed.length > 0) {
                  console.log(`      - Functions: ${contractDiff.functions.removed.join(', ')}`);
                }
              }
            }
          }
          
          if (fileHash) {
            console.log(`    fileHash (content): ${fileHash.old.substring(0, 12)}... → ${fileHash.new.substring(0, 12)}...`);
            console.log(`      ↳ Detects: any file content modification`);
          }
          
          // If only fileHash changed but not semanticHash, it's a cosmetic change
          if (fileHash && !semanticHash) {
            console.log(`      ⚠️  Cosmetic change only (comments/formatting)`);
          }
        });
      }
      
      if (bundleChanged.length > 0) {
        console.log(`[DEBUG] Modified bundles (${bundleChanged.length}):`);
        bundleChanged.forEach(({ entryId, oldHash, newHash }) => {
          console.log(`  ~ ${entryId}`);
          console.log(`    bundleHash (bundle): ${oldHash.substring(0, 12)}... → ${newHash.substring(0, 12)}...`);
          console.log(`      ↳ Detects: bundle structure changes (components added/removed, dependency graph)`);
        });
      }
      
      if (added.length > 0) {
        console.log(`[DEBUG] New contracts (${added.length}):`);
        added.forEach(id => {
          const contract = newContractIdx.get(normalizeEntryId(id).toLowerCase());
          const hash = contract ? contract.semanticHash.substring(0, 12) + '...' : 'unknown';
          console.log(`  + ${id} (semanticHash: ${hash})`);
        });
      }
      
      if (removed.length > 0) {
        console.log(`[DEBUG] Removed contracts (${removed.length}):`);
        removed.forEach(id => {
          const contract = oldContractIdx.get(normalizeEntryId(id).toLowerCase());
          const hash = contract ? contract.semanticHash.substring(0, 12) + '...' : 'unknown';
          console.log(`  - ${id} (semanticHash: ${hash})`);
        });
      }
    }
  };

  const regenerate = async () => {
    if (isRegenerating) {
      return; // Skip if already regenerating
    }

    isRegenerating = true;
    const changedFileList = Array.from(changedFiles);
    changedFiles.clear(); // Clear for next batch
    const startTime = Date.now();

    try {
      // Determine output directory
      const outPath = resolve(options.out);
      const outputDir = outPath.endsWith('.json') ? dirname(outPath) : outPath;

      // Load previous bundles for comparison
      if (!previousBundles) {
        previousBundles = await loadAllBundles(outputDir);
      }

      if (!options.quiet) {
        const fileList = changedFileList.length > 3 
          ? `${changedFileList.slice(0, 3).join(', ')}, ... (+${changedFileList.length - 3} more)`
          : changedFileList.join(', ');
        console.log(`\n🔄 Regenerating (${changedFileList.length} file${changedFileList.length > 1 ? 's' : ''} changed)...`);
      }

      let newBundles: LogicStampBundle[];

      // Use incremental rebuild if cache exists, otherwise do full rebuild (fallback)
      if (watchCache) {
        // Incremental rebuild - only rebuild affected bundles
        const result = await incrementalRebuild(changedFileList, watchCache, options, projectRoot);
        newBundles = result.bundles;

        // Write only changed context files
        const bundlesByFolder = groupBundlesByFolder(newBundles);
        const changedFolders = new Set<string>();
        for (const bundleId of result.updatedBundles) {
          const bundle = newBundles.find(b => b.entryId === bundleId);
          if (bundle) {
            const folderPath = bundle.entryId.substring(0, bundle.entryId.lastIndexOf('/') || bundle.entryId.length);
            changedFolders.add(folderPath);
          }
        }

        // Write context files for changed folders only
        // (This is a simplified version - full implementation would write individual files)
        // For now, we'll write all files but this can be optimized further
        const { folderInfos, totalTokenEstimate } = await writeContextFiles(newBundles, outputDir, projectRoot, {
          format: options.format,
          quiet: true,
        });
        
        // Get contracts for main index (from cache if available)
        const allContracts = watchCache ? Array.from(watchCache.contracts.values()) : [];
        await writeMainIndex(outputDir, folderInfos, allContracts, newBundles, bundlesByFolder.size, totalTokenEstimate, projectRoot, {
          quiet: true,
          suppressSuccessIndicator: true,
        });
      } else {
        // Fallback: Full rebuild if cache not available (shouldn't happen normally)
        const regenerateOptions: ContextOptions = {
          ...options,
          watch: false,
          strictMissing: false,
          quiet: true,
          suppressSuccessIndicator: true,
        };

        await contextCommand(regenerateOptions);

        // Load bundles and initialize cache
        newBundles = await loadAllBundles(outputDir);
        
        // Initialize cache for next incremental rebuild
        if (newBundles.length > 0) {
          // We need contracts and manifest - reload them from the build
          const files = await globFiles(projectRoot);
          const stampignore = await readStampignore(projectRoot);
          const filteredFiles = stampignore ? filterIgnoredFiles(files, stampignore.ignore, projectRoot) : files;
          const { contracts } = await buildContractsFromFiles(filteredFiles, projectRoot, {
            includeStyle: options.includeStyle,
            predictBehavior: options.predictBehavior,
            quiet: true,
          });
          const manifest = buildDependencyGraph(contracts);
          watchCache = await initializeWatchCache(filteredFiles, contracts, manifest, newBundles, projectRoot);
        }
      }
      
      const durationMs = Date.now() - startTime;
      const changes = previousBundles && previousBundles.length > 0 
        ? getChanges(previousBundles, newBundles, changedFileList[0] || 'unknown')
        : null;

      if (!options.quiet) {
        if (changes) {
          showChanges(previousBundles!, newBundles, changedFileList[0] || 'unknown');
        }
        console.log(`\n✅ Regenerated\n`);
      }

      // Log structured data for MCP server
      if (changes) {
        const logEntry: WatchLogEntry = {
          timestamp: new Date().toISOString(),
          changedFiles: changedFileList,
          fileCount: changedFileList.length,
          durationMs,
          modifiedContracts: changes.changed.map(c => ({
            entryId: c.entryId,
            semanticHashChanged: !!c.semanticHash,
            fileHashChanged: !!c.fileHash,
            semanticHash: c.semanticHash,
            fileHash: c.fileHash,
          })),
          modifiedBundles: changes.bundleChanged.map(b => ({
            entryId: b.entryId,
            bundleHash: { old: b.oldHash, new: b.newHash },
          })),
          addedContracts: changes.added.length > 0 ? changes.added : undefined,
          removedContracts: changes.removed.length > 0 ? changes.removed : undefined,
          summary: {
            modifiedContractsCount: changes.changed.length,
            modifiedBundlesCount: changes.bundleChanged.length,
            addedContractsCount: changes.added.length,
            removedContractsCount: changes.removed.length,
          },
        };
        await appendWatchLog(projectRoot, logEntry);
      } else if (changedFileList.length > 0) {
        // Log even if no changes detected (file changed but no contract changes)
        const logEntry: WatchLogEntry = {
          timestamp: new Date().toISOString(),
          changedFiles: changedFileList,
          fileCount: changedFileList.length,
          durationMs,
        };
        await appendWatchLog(projectRoot, logEntry);
      }

      previousBundles = newBundles; // Update for next comparison
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      
      if (!options.quiet) {
        console.error(`   ❌ Error: ${errorMessage}\n`);
      }

      // Log error to watch logs
      const logEntry: WatchLogEntry = {
        timestamp: new Date().toISOString(),
        changedFiles: changedFileList,
        fileCount: changedFileList.length,
        durationMs,
        error: errorMessage,
      };
      await appendWatchLog(projectRoot, logEntry);

      // Fall back to full rebuild on error
      watchCache = null;
      isFirstRun = true;
    } finally {
      isRegenerating = false;
    }
  };

  const debouncedRegenerate = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      regenerate();
    }, DEBOUNCE_DELAY);
  };

  try {
    // Determine output directory to exclude from watching
    const outPath = resolve(options.out);
    const outputDir = outPath.endsWith('.json') ? dirname(outPath) : outPath;
    const normalizedOutputDir = resolve(outputDir);

    if (!options.quiet) {
      console.log(`   Watching: ${displayPath(projectRoot)}`);
      if (normalizedOutputDir !== projectRoot) {
        console.log(`   Ignoring output directory: ${displayPath(normalizedOutputDir)}`);
      }
      console.log(`   Ignoring: context.json files, node_modules, dist, build, etc.\n`);
    }

    // Build file extensions to watch
    const watchedExtensions = options.includeStyle 
      ? ['.ts', '.tsx', '.css', '.scss', '.module.css', '.module.scss']
      : ['.ts', '.tsx'];

    if (!options.quiet) {
      console.log(`   Watching extensions: ${watchedExtensions.join(', ')}`);
    }

    // Use chokidar to watch the entire directory tree
    // Watch all files and filter by extension in the event handlers
    const watcher = chokidar.watch(projectRoot, {
      ignored: [
        // Ignore generated context files
        /context\.json$/,
        /context_main\.json$/,
        /context_compare_modes\.json$/,
        // Ignore output directory if different from project root
        ...(outputDir !== projectRoot ? [new RegExp('^' + relative(projectRoot, normalizedOutputDir).replace(/\\/g, '/'))] : []),
        // Ignore common build/dependency directories
        /node_modules/,
        /dist/,
        /build/,
        /\.next/,
        /coverage/,
      ],
      ignoreInitial: true, // Don't trigger on initial scan
      awaitWriteFinish: {
        stabilityThreshold: 200, // Wait 200ms after file write finishes
        pollInterval: 100, // Poll every 100ms to check if write is done
      },
      persistent: true,
      depth: 99, // Watch deeply
    });

    // Helper to check if a file should trigger regeneration
    const shouldTrigger = (filePath: string): boolean => {
      // Normalize path separators
      const normalizedPath = filePath.replace(/\\/g, '/');
      
      // Debug logging (can be enabled with LOGICSTAMP_DEBUG=1)
      if (process.env.LOGICSTAMP_DEBUG === '1' && !options.quiet) {
        console.log(`[DEBUG] Watch event for: ${normalizedPath}`);
      }

      // Check if it's a .stampignore file
      if (normalizedPath.endsWith('.stampignore') || normalizedPath.includes('/.stampignore')) {
        return true;
      }

      // Check if it matches watched extensions
      const matches = watchedExtensions.some(ext => normalizedPath.endsWith(ext));
      
      if (process.env.LOGICSTAMP_DEBUG === '1' && !options.quiet && matches) {
        console.log(`[DEBUG] Matched extension for: ${normalizedPath}`);
      }
      
      return matches;
    };

    // Helper to track file change and trigger regeneration
    const trackAndRegenerate = (path: string, eventType: 'change' | 'add' | 'unlink') => {
      if (shouldTrigger(path)) {
        // Normalize path relative to project root
        const normalizedPath = normalizeEntryId(relative(projectRoot, path));
        changedFiles.add(normalizedPath);
        
        if (!options.quiet && changedFiles.size === 1) {
          // Only show first change, debounce will handle batching
          console.log(`📝 ${eventType === 'add' ? 'New file' : eventType === 'unlink' ? 'Deleted file' : 'Changed'}: ${normalizedPath}`);
        }
        
        debouncedRegenerate();
      }
    };

    // Handle file changes
    watcher.on('change', (path: string) => {
      trackAndRegenerate(path, 'change');
    });

    // Handle file additions
    watcher.on('add', (path: string) => {
      trackAndRegenerate(path, 'add');
    });

    // Handle file deletions
    watcher.on('unlink', (path: string) => {
      trackAndRegenerate(path, 'unlink');
    });

    // Handle watcher errors
    watcher.on('error', (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Watch error: ${errorMessage}`);
      process.exit(1);
    });

    // Handle watcher ready (only show once)
    let readyShown = false;
    watcher.on('ready', () => {
      if (!options.quiet && !readyShown) {
        readyShown = true;
        console.log(`✅ Watch mode active. Waiting for file changes...\n`);
      }
    });

    // Keep the process alive
    process.on('SIGINT', async () => {
      await watcher.close();
      // Clean up watch status file
      try {
        await deleteWatchStatus(projectRoot);
      } catch {
        // Ignore errors during cleanup
      }
      if (!options.quiet) {
        console.log(`\n👋 Watch mode stopped`);
      }
      process.exit(0);
    });

    // Also clean up on other termination signals
    const cleanup = async () => {
      try {
        await watcher.close();
        await deleteWatchStatus(projectRoot);
      } catch {
        // Ignore errors during cleanup
      }
    };
    process.on('SIGTERM', cleanup);
    process.on('SIGHUP', cleanup);

    // Keep process alive indefinitely
    await new Promise(() => {}); // Never resolves, keeps process running
  } catch (error) {
    // Clean up watch status file on error
    try {
      await deleteWatchStatus(projectRoot);
    } catch {
      // Ignore errors during cleanup
    }
    console.error(`❌ Failed to start watch mode: ${(error as Error).message}`);
    process.exit(1);
  }
}
