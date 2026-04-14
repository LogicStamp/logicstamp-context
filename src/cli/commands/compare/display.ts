/**
 * Display formatting for compare command results
 */

import type { MultiFileCompareResult } from './types.js';
import { formatTokenCount } from '../../../utils/tokens.js';

/**
 * Format and display multi-file comparison results
 */
export function displayMultiFileCompareResult(
  result: MultiFileCompareResult,
  stats: boolean,
  quiet?: boolean,
): void {
  // Skip status header in quiet mode unless there's drift
  if (quiet && result.status === 'PASS') {
    // Minimal output in quiet mode for PASS
    process.stdout.write('✓\n');
  } else if (!quiet || result.status === 'DRIFT') {
    console.log(
      `\n${result.status === 'PASS' ? '✅' : '⚠️'}  ${result.status}\n`,
    );
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
      console.log(
        '      For precise per-mode breakdown, use "stamp context --compare-modes".',
      );
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
          cr.added.forEach((id) => console.log(`        + ${id}`));
        }
        if (cr.removed.length > 0) {
          console.log(`      - Removed components (${cr.removed.length}):`);
          cr.removed.forEach((id) => console.log(`        - ${id}`));
        }
        if (cr.changed.length > 0) {
          console.log(`      ~ Changed components (${cr.changed.length}):`);
          cr.changed.forEach(({ id, deltas }) => {
            console.log(`        ~ ${id}`);
            deltas.forEach((delta) => {
              console.log(`          Δ ${delta.type}`);

              if (delta.type === 'hash') {
                console.log(`            old: ${delta.old}`);
                console.log(`            new: ${delta.new}`);
              } else if (delta.type === 'props' || delta.type === 'emits') {
                // props/emits are now full objects - compute diff on display
                const oldObj =
                  delta.old && typeof delta.old === 'object'
                    ? (delta.old as Record<string, any>)
                    : {};
                const newObj =
                  delta.new && typeof delta.new === 'object'
                    ? (delta.new as Record<string, any>)
                    : {};
                const oldKeys = Object.keys(oldObj);
                const newKeys = Object.keys(newObj);
                const oldSet = new Set(oldKeys);
                const newSet = new Set(newKeys);

                const removed = oldKeys.filter(
                  (key: string) => !newSet.has(key),
                );
                const added = newKeys.filter((key: string) => !oldSet.has(key));
                const changed = oldKeys.filter((key: string) => {
                  if (newSet.has(key)) {
                    return (
                      JSON.stringify(oldObj[key]) !==
                      JSON.stringify(newObj[key])
                    );
                  }
                  return false;
                });

                if (removed.length > 0) {
                  removed.forEach((key: string) =>
                    console.log(`            - ${key}`),
                  );
                }
                if (added.length > 0) {
                  added.forEach((key: string) =>
                    console.log(`            + ${key}`),
                  );
                }
                if (changed.length > 0) {
                  changed.forEach((key: string) => {
                    const oldStr =
                      typeof oldObj[key] === 'string'
                        ? oldObj[key]
                        : JSON.stringify(oldObj[key]);
                    const newStr =
                      typeof newObj[key] === 'string'
                        ? newObj[key]
                        : JSON.stringify(newObj[key]);
                    console.log(`            ~ ${key}: ${oldStr} → ${newStr}`);
                  });
                }
              } else if (
                delta.type === 'imports' ||
                delta.type === 'hooks' ||
                delta.type === 'functions' ||
                delta.type === 'components' ||
                delta.type === 'variables'
              ) {
                const oldSet = new Set(delta.old);
                const newSet = new Set(delta.new);
                const removed = delta.old.filter(
                  (item: string) => !newSet.has(item),
                );
                const added = delta.new.filter(
                  (item: string) => !oldSet.has(item),
                );

                if (removed.length > 0) {
                  removed.forEach((item: string) =>
                    console.log(`            - ${item}`),
                  );
                }
                if (added.length > 0) {
                  added.forEach((item: string) =>
                    console.log(`            + ${item}`),
                  );
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
                const removed = oldKeys.filter(
                  (key: string) => !newSet.has(key),
                );
                // Find added state variables
                const added = newKeys.filter((key: string) => !oldSet.has(key));
                // Find changed state variables (type changed)
                const changed = oldKeys.filter((key: string) => {
                  if (newSet.has(key)) {
                    return (
                      JSON.stringify(oldState[key]) !==
                      JSON.stringify(newState[key])
                    );
                  }
                  return false;
                });

                if (removed.length > 0) {
                  removed.forEach((key: string) =>
                    console.log(`            - ${key}`),
                  );
                }
                if (added.length > 0) {
                  added.forEach((key: string) =>
                    console.log(`            + ${key}`),
                  );
                }
                if (changed.length > 0) {
                  changed.forEach((key: string) => {
                    console.log(
                      `            ~ ${key}: ${JSON.stringify(oldState[key])} → ${JSON.stringify(newState[key])}`,
                    );
                  });
                }
              } else if (delta.type === 'exports') {
                console.log(`            ${delta.old} → ${delta.new}`);
              } else if (delta.type === 'apiSignature') {
                const oldSig = delta.old as Record<string, any> | null;
                const newSig = delta.new as Record<string, any> | null;

                // Handle null/undefined cases
                if (!oldSig && newSig) {
                  console.log(`            + Added API signature`);
                  if (newSig.parameters)
                    console.log(
                      `              parameters: ${JSON.stringify(newSig.parameters)}`,
                    );
                  if (newSig.returnType)
                    console.log(
                      `              returnType: ${newSig.returnType}`,
                    );
                  if (newSig.requestType)
                    console.log(
                      `              requestType: ${newSig.requestType}`,
                    );
                  if (newSig.responseType)
                    console.log(
                      `              responseType: ${newSig.responseType}`,
                    );
                } else if (oldSig && !newSig) {
                  console.log(`            - Removed API signature`);
                } else if (oldSig && newSig) {
                  // Compare individual fields
                  const oldParams = oldSig.parameters ?? {};
                  const newParams = newSig.parameters ?? {};
                  const oldKeys = Object.keys(oldParams);
                  const newKeys = Object.keys(newParams);
                  const paramRemoved = oldKeys.filter((k) => !(k in newParams));
                  const paramAdded = newKeys.filter((k) => !(k in oldParams));
                  const paramChanged = oldKeys.filter(
                    (k) => k in newParams && oldParams[k] !== newParams[k],
                  );

                  if (paramRemoved.length > 0) {
                    paramRemoved.forEach((k) =>
                      console.log(
                        `            - parameters.${k}: ${oldParams[k]}`,
                      ),
                    );
                  }
                  if (paramAdded.length > 0) {
                    paramAdded.forEach((k) =>
                      console.log(
                        `            + parameters.${k}: ${newParams[k]}`,
                      ),
                    );
                  }
                  if (paramChanged.length > 0) {
                    paramChanged.forEach((k) =>
                      console.log(
                        `            ~ parameters.${k}: ${oldParams[k]} → ${newParams[k]}`,
                      ),
                    );
                  }

                  if (oldSig.returnType !== newSig.returnType) {
                    console.log(
                      `            ~ returnType: ${oldSig.returnType ?? '(none)'} → ${newSig.returnType ?? '(none)'}`,
                    );
                  }
                  if (oldSig.requestType !== newSig.requestType) {
                    console.log(
                      `            ~ requestType: ${oldSig.requestType ?? '(none)'} → ${newSig.requestType ?? '(none)'}`,
                    );
                  }
                  if (oldSig.responseType !== newSig.responseType) {
                    console.log(
                      `            ~ responseType: ${oldSig.responseType ?? '(none)'} → ${newSig.responseType ?? '(none)'}`,
                    );
                  }
                }
              }
            });
          });
        }
      }

      if (stats && !quiet && folder.tokenDelta) {
        const sign = folder.tokenDelta.gpt4 > 0 ? '+' : '';
        console.log(
          `      Token Δ: ${sign}${formatTokenCount(folder.tokenDelta.gpt4)} (GPT-4) | ${sign}${formatTokenCount(folder.tokenDelta.claude)} (Claude)`,
        );
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
      console.log(
        '   (These files exist on disk but are not in the new index)\n',
      );
    }
    result.orphanedFiles.forEach((file) => {
      console.log(`   🗑️  ${file}`);
    });
    if (!quiet) {
      console.log();
    }
  }
}
