/**
 * Watch Mode Diffing - Contract and bundle comparison utilities
 */

import type { LogicStampBundle } from '../../../core/pack.js';
import type { UIFContract } from '../../../types/UIFContract.js';
import { normalizeEntryId } from '../../../utils/fsx.js';

/**
 * Contract comparison result with detailed changes
 */
export interface ContractDiff {
  props: { added: string[]; removed: string[]; changed: Array<{ name: string; old: unknown; new: unknown }> };
  emits: { added: string[]; removed: string[]; changed: Array<{ name: string; old: unknown; new: unknown }> };
  state: { added: string[]; removed: string[]; changed: Array<{ name: string; old: unknown; new: unknown }> };
  hooks: { added: string[]; removed: string[] };
  components: { added: string[]; removed: string[] };
  variables: { added: string[]; removed: string[] };
  functions: { added: string[]; removed: string[] };
}

/**
 * Bundle changes result
 */
export interface BundleChanges {
  changed: Array<{
    entryId: string;
    semanticHash?: { old: string; new: string };
    fileHash?: { old: string; new: string };
    contractDiff?: ContractDiff;
  }>;
  added: string[];
  removed: string[];
  bundleChanged: Array<{ entryId: string; oldHash: string; newHash: string }>;
}

/**
 * Get contract from bundles by entryId
 */
export function getContractFromBundles(bundles: LogicStampBundle[], entryId: string): UIFContract | null {
  const normalizedId = normalizeEntryId(entryId).toLowerCase();
  for (const bundle of bundles) {
    for (const node of bundle.graph.nodes) {
      if (normalizeEntryId(node.contract.entryId).toLowerCase() === normalizedId) {
        return node.contract;
      }
    }
  }
  return null;
}

/**
 * Compare two contracts and return detailed diff
 */
export function compareContracts(oldContract: UIFContract, newContract: UIFContract): ContractDiff {
  const diff: ContractDiff = {
    props: { added: [], removed: [], changed: [] },
    emits: { added: [], removed: [], changed: [] },
    state: { added: [], removed: [], changed: [] },
    hooks: { added: [], removed: [] },
    components: { added: [], removed: [] },
    variables: { added: [], removed: [] },
    functions: { added: [], removed: [] },
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
}

/**
 * Index contracts from bundles for comparison
 */
function indexContracts(bundles: LogicStampBundle[]): Map<string, {
  semanticHash: string;
  fileHash: string;
  entryId: string;
}> {
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
}

/**
 * Index bundles by entryId for comparison
 */
function indexBundles(bundles: LogicStampBundle[]): Map<string, { bundleHash: string; entryId: string }> {
  const m = new Map<string, { bundleHash: string; entryId: string }>();
  for (const b of bundles) {
    const normalizedId = normalizeEntryId(b.entryId).toLowerCase();
    m.set(normalizedId, {
      bundleHash: b.bundleHash,
      entryId: b.entryId,
    });
  }
  return m;
}

/**
 * Compare bundles and return structured change data
 */
export function getChanges(oldBundles: LogicStampBundle[], newBundles: LogicStampBundle[]): BundleChanges | null {
  const oldContractIdx = indexContracts(oldBundles);
  const newContractIdx = indexContracts(newBundles);
  const oldBundleIdx = indexBundles(oldBundles);
  const newBundleIdx = indexBundles(newBundles);

  const changed: BundleChanges['changed'] = [];
  const added: string[] = [];
  const removed: string[] = [];
  const bundleChanged: Array<{ entryId: string; oldHash: string; newHash: string }> = [];

  // Find changed contracts
  for (const [id, newContract] of newContractIdx.entries()) {
    const oldContract = oldContractIdx.get(id);
    if (oldContract) {
      const changes: { semanticHash?: { old: string; new: string }; fileHash?: { old: string; new: string }; contractDiff?: ContractDiff } = {};

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
}

/**
 * Options for showChanges
 */
export interface ShowChangesOptions {
  debug?: boolean;
  quiet?: boolean;
}

/**
 * Show changes to console
 */
export function showChanges(
  oldBundles: LogicStampBundle[],
  newBundles: LogicStampBundle[],
  changedFile: string,
  options: ShowChangesOptions = {}
): void {
  const changes = getChanges(oldBundles, newBundles);
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
}
