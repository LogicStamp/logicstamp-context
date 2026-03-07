/**
 * Display formatting for compare command results
 */

import type { MultiFileCompareResult } from './types.js';
import { formatTokenCount } from '../../../utils/tokens.js';


/**
 * Format and display multi-file comparison results
 */
export function displayMultiFileCompareResult(result: MultiFileCompareResult, stats: boolean, quiet?: boolean): void {
  // Skip status header in quiet mode unless there's drift
  if (quiet && result.status === 'PASS') {
    // Minimal output in quiet mode for PASS
    process.stdout.write('✓\n');
  } else if (!quiet || result.status === 'DRIFT') {
    console.log(`\n${result.status === 'PASS' ? '✅' : '⚠️'}  ${result.status}\n`);
  }

  // Skip summaries in quiet mode
  if (!quiet) {
    // Display folder-level summary
    console.log('📁 Folder Summary:');
    console.log(`   Total folders: ${result.summary.totalFolders}`);
    if (result.summary.addedFolders > 0) {
      console.log(`   ➕ Added folders: ${result.summary.addedFolders}`);
    }
    if (result.summary.orphanedFolders > 0) {
      console.log(`   🗑️  Orphaned folders: ${result.summary.orphanedFolders}`);
    }
    if (result.summary.driftFolders > 0) {
      console.log(`   ~  Changed folders: ${result.summary.driftFolders}`);
    }
    if (result.summary.passFolders > 0) {
      console.log(`   ✓  Unchanged folders: ${result.summary.passFolders}`);
    }
    console.log();

    // Display component-level summary
    if (result.status === 'DRIFT') {
      console.log('📦 Component Summary:');
      if (result.summary.totalComponentsAdded > 0) {
        console.log(`   + Added: ${result.summary.totalComponentsAdded}`);
      }
      if (result.summary.totalComponentsRemoved > 0) {
        console.log(`   - Removed: ${result.summary.totalComponentsRemoved}`);
      }
      if (result.summary.totalComponentsChanged > 0) {
        console.log(`   ~ Changed: ${result.summary.totalComponentsChanged}`);
      }
      console.log();
    }

    // Display detailed folder results
    console.log('📂 Folder Details:');
    if (stats) {
      console.log('   ⚠️  Current mode = tokenizer-based.');
      console.log('      Other modes / raw source = heuristic.');
      console.log('      For precise per-mode breakdown, use "stamp context --compare-modes".');
    }
    console.log();
  }

  for (const folder of result.folders) {
    if (folder.status === 'ADDED') {
      console.log(`   ➕ ADDED FILE: ${folder.contextFile}`);
      console.log(`      Path: ${folder.folderPath}`);
      console.log();
    } else if (folder.status === 'ORPHANED') {
      console.log(`   🗑️  ORPHANED FILE: ${folder.contextFile}`);
      console.log(`      Path: ${folder.folderPath}`);
      console.log();
    } else if (folder.status === 'DRIFT') {
      console.log(`   ⚠️  DRIFT: ${folder.contextFile}`);
      console.log(`      Path: ${folder.folderPath}`);

      if (folder.componentResult) {
        const cr = folder.componentResult;
        if (cr.added.length > 0) {
          console.log(`      + Added components (${cr.added.length}):`);
          cr.added.forEach(id => console.log(`        + ${id}`));
        }
        if (cr.removed.length > 0) {
          console.log(`      - Removed components (${cr.removed.length}):`);
          cr.removed.forEach(id => console.log(`        - ${id}`));
        }
        if (cr.changed.length > 0) {
          console.log(`      ~ Changed components (${cr.changed.length}):`);
          cr.changed.forEach(({ id, deltas }) => {
            console.log(`        ~ ${id}`);
            deltas.forEach(delta => {
              console.log(`          Δ ${delta.type}`);

              if (delta.type === 'hash') {
                console.log(`            old: ${delta.old}`);
                console.log(`            new: ${delta.new}`);
              } else if (delta.type === 'imports' || delta.type === 'hooks' || delta.type === 'functions' ||
                         delta.type === 'components' || delta.type === 'variables') {
                const oldSet = new Set(delta.old);
                const newSet = new Set(delta.new);
                const removed = delta.old.filter((item: string) => !newSet.has(item));
                const added = delta.new.filter((item: string) => !oldSet.has(item));

                if (removed.length > 0) {
                  removed.forEach((item: string) => console.log(`            - ${item}`));
                }
                if (added.length > 0) {
                  added.forEach((item: string) => console.log(`            + ${item}`));
                }
                if (removed.length === 0 && added.length === 0) {
                  console.log(`            (order changed)`);
                }
              } else if (delta.type === 'props' || delta.type === 'emits') {
                const oldSet = new Set(delta.old);
                const newSet = new Set(delta.new);
                const removed = delta.old.filter((item: string) => !newSet.has(item));
                const added = delta.new.filter((item: string) => !oldSet.has(item));

                if (removed.length > 0) {
                  removed.forEach((item: string) => console.log(`            - ${item}`));
                }
                if (added.length > 0) {
                  added.forEach((item: string) => console.log(`            + ${item}`));
                }
                if (removed.length === 0 && added.length === 0) {
                  console.log(`            (order changed)`);
                }
              } else if (delta.type === 'state') {
                const oldState = delta.old as Record<string, any>;
                const newState = delta.new as Record<string, any>;
                const oldKeys = Object.keys(oldState);
                const newKeys = Object.keys(newState);
                const oldSet = new Set(oldKeys);
                const newSet = new Set(newKeys);

                // Find removed state variables
                const removed = oldKeys.filter((key: string) => !newSet.has(key));
                // Find added state variables
                const added = newKeys.filter((key: string) => !oldSet.has(key));
                // Find changed state variables (type changed)
                const changed = oldKeys.filter((key: string) => {
                  if (newSet.has(key)) {
                    return JSON.stringify(oldState[key]) !== JSON.stringify(newState[key]);
                  }
                  return false;
                });

                if (removed.length > 0) {
                  removed.forEach((key: string) => console.log(`            - ${key}`));
                }
                if (added.length > 0) {
                  added.forEach((key: string) => console.log(`            + ${key}`));
                }
                if (changed.length > 0) {
                  changed.forEach((key: string) => {
                    console.log(`            ~ ${key}: ${JSON.stringify(oldState[key])} → ${JSON.stringify(newState[key])}`);
                  });
                }
              } else if (delta.type === 'exports') {
                console.log(`            ${delta.old} → ${delta.new}`);
              }
            });
          });
        }
      }

      if (stats && !quiet && folder.tokenDelta) {
        const sign = folder.tokenDelta.gpt4 > 0 ? '+' : '';
        console.log(`      Token Δ: ${sign}${formatTokenCount(folder.tokenDelta.gpt4)} (GPT-4) | ${sign}${formatTokenCount(folder.tokenDelta.claude)} (Claude)`);
      }

      console.log();
    } else if (folder.status === 'PASS') {
      // Skip PASS folders in quiet mode
      if (!quiet) {
        console.log(`   ✅ PASS: ${folder.contextFile}`);
        console.log(`      Path: ${folder.folderPath}`);
        console.log();
      }
    }
  }

  // Display orphaned files on disk (only if not in quiet mode, or show as diff)
  if (result.orphanedFiles && result.orphanedFiles.length > 0) {
    if (!quiet) {
      console.log('🗑️  Orphaned Files on Disk:');
      console.log('   (These files exist on disk but are not in the new index)\n');
    }
    result.orphanedFiles.forEach(file => {
      console.log(`   🗑️  ${file}`);
    });
    if (!quiet) {
      console.log();
    }
  }
}
