/**
 * Single file comparison logic
 */

import { readFile } from 'node:fs/promises';
import type { LogicStampBundle } from '../../../core/pack.js';
import { debugError } from '../../../utils/debug.js';
import { formatTokenCount } from '../../../utils/tokens.js';
import { index, diff } from './core.js';
import { calculateTokens } from './utils.js';
import type { CompareOptions, CompareResult } from './types.js';

/**
 * Compare a single folder's context file
 */
export async function compareFolderContext(
  oldContextPath: string,
  newContextPath: string,
  stats: boolean,
  quiet?: boolean,
  gitBaseline = false
): Promise<{ result: CompareResult; tokenDelta?: { gpt4: number; claude: number } }> {
  // Load both files
  let oldContent: string;
  let newContent: string;
  
  try {
    oldContent = await readFile(oldContextPath, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('compare', 'compareFolderContext', {
      oldContextPath,
      message: err.message,
      code: err.code,
    });
    throw new Error(`Failed to read old context file "${oldContextPath}": ${err.code === 'ENOENT' ? 'File not found' : err.message}`);
  }
  
  try {
    newContent = await readFile(newContextPath, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('compare', 'compareFolderContext', {
      newContextPath,
      message: err.message,
      code: err.code,
    });
    throw new Error(`Failed to read new context file "${newContextPath}": ${err.code === 'ENOENT' ? 'File not found' : err.message}`);
  }

  let oldBundles: LogicStampBundle[];
  let newBundles: LogicStampBundle[];

  try {
    oldBundles = JSON.parse(oldContent) as LogicStampBundle[];
    newBundles = JSON.parse(newContent) as LogicStampBundle[];
  } catch (error) {
    const err = error as Error;
    debugError('compare', 'compareFolderContext', {
      oldContextPath,
      newContextPath,
      message: err.message,
    });
    throw new Error(`Failed to parse context files for folder: ${err.message}`);
  }

  // Index bundles (with normalization for git baseline mode)
  const normalize = gitBaseline;
  const ignoreHashOnly = gitBaseline; // Ignore hash-only changes in git baseline mode
  const oldIdx = index(oldBundles, normalize);
  const newIdx = index(newBundles, normalize);

  // Compute diff
  const result = diff(oldIdx, newIdx, normalize, ignoreHashOnly);

  // Calculate token delta if stats requested and not in quiet mode
  let tokenDelta: { gpt4: number; claude: number } | undefined;
  if (stats && !quiet) {
    const oldTokens = await calculateTokens(oldBundles);
    const newTokens = await calculateTokens(newBundles);
    tokenDelta = {
      gpt4: newTokens.gpt4 - oldTokens.gpt4,
      claude: newTokens.claude - oldTokens.claude,
    };
  }

  return { result, tokenDelta };
}

/**
 * Main compare command
 * Returns the comparison result instead of exiting, allowing caller to handle approval logic
 */
export async function compareCommand(options: CompareOptions): Promise<CompareResult> {
  // Load both files
  let oldContent: string;
  let newContent: string;
  
  try {
    oldContent = await readFile(options.oldFile, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('compare', 'compareCommand', {
      file: options.oldFile,
      message: err.message,
      code: err.code,
    });
    throw new Error(`Failed to read old file "${options.oldFile}": ${err.code === 'ENOENT' ? 'File not found' : err.message}`);
  }
  
  try {
    newContent = await readFile(options.newFile, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('compare', 'compareCommand', {
      file: options.newFile,
      message: err.message,
      code: err.code,
    });
    throw new Error(`Failed to read new file "${options.newFile}": ${err.code === 'ENOENT' ? 'File not found' : err.message}`);
  }

  let oldBundles: LogicStampBundle[];
  let newBundles: LogicStampBundle[];

  try {
    oldBundles = JSON.parse(oldContent) as LogicStampBundle[];
    newBundles = JSON.parse(newContent) as LogicStampBundle[];
  } catch (error) {
    const err = error as Error;
    debugError('compare', 'compareCommand', {
      oldFile: options.oldFile,
      newFile: options.newFile,
      message: err.message,
    });
    throw new Error(`Failed to parse context files: ${err.message}`);
  }

  // Index bundles (with normalization for git baseline mode)
  const normalize = options.gitBaseline ?? false;
  const ignoreHashOnly = options.gitBaseline ?? false; // Ignore hash-only changes in git baseline mode
  const oldIdx = index(oldBundles, normalize);
  const newIdx = index(newBundles, normalize);

  // Compute diff
  const result = diff(oldIdx, newIdx, normalize, ignoreHashOnly);

  // Output result (skip PASS status in quiet mode)
  if (options.quiet && result.status === 'PASS') {
    // Minimal output in quiet mode for PASS
    process.stdout.write('✓\n');
  } else if (!options.quiet || result.status === 'DRIFT') {
    console.log(`\n${result.status === 'PASS' ? '✅' : '⚠️'}  ${result.status}\n`);
  }

  if (result.status === 'DRIFT') {
    if (result.added.length > 0) {
      if (!options.quiet) {
        console.log(`Added components: ${result.added.length}`);
      }
      result.added.forEach(id => console.log(`  + ${id}`));
      if (!options.quiet) {
        console.log();
      }
    }

    if (result.removed.length > 0) {
      if (!options.quiet) {
        console.log(`Removed components: ${result.removed.length}`);
      }
      result.removed.forEach(id => console.log(`  - ${id}`));
      if (!options.quiet) {
        console.log();
      }
    }

    if (result.changed.length > 0) {
      if (!options.quiet) {
        console.log(`Changed components: ${result.changed.length}`);
      }
      result.changed.forEach(({ id, deltas }) => {
        console.log(`  ~ ${id}`);
        deltas.forEach(delta => {
          console.log(`    Δ ${delta.type}`);

          if (delta.type === 'hash') {
            console.log(`      old: ${delta.old}`);
            console.log(`      new: ${delta.new}`);
          } else if (delta.type === 'imports' || delta.type === 'hooks' || delta.type === 'functions' ||
                     delta.type === 'components' || delta.type === 'variables') {
            const oldSet = new Set(delta.old);
            const newSet = new Set(delta.new);

            // Find removed items
            const removed = delta.old.filter((item: string) => !newSet.has(item));
            // Find added items
            const added = delta.new.filter((item: string) => !oldSet.has(item));

            if (removed.length > 0) {
              removed.forEach((item: string) => console.log(`      - ${item}`));
            }
            if (added.length > 0) {
              added.forEach((item: string) => console.log(`      + ${item}`));
            }
            if (removed.length === 0 && added.length === 0) {
              // Order changed but items are the same
              console.log(`      (order changed)`);
            }
          } else if (delta.type === 'props' || delta.type === 'emits') {
            // Props and emits should be arrays of strings (prop/emit names)
            // Handle both arrays and objects (defensive coding for edge cases)
            // If objects are passed, extract keys; if arrays, use directly
            let oldArray: string[];
            let newArray: string[];
            
            if (Array.isArray(delta.old)) {
              oldArray = delta.old;
            } else if (delta.old && typeof delta.old === 'object') {
              // If it's an object, extract the keys
              oldArray = Object.keys(delta.old);
            } else {
              // Fallback: treat as empty array
              oldArray = [];
            }
            
            if (Array.isArray(delta.new)) {
              newArray = delta.new;
            } else if (delta.new && typeof delta.new === 'object') {
              // If it's an object, extract the keys
              newArray = Object.keys(delta.new);
            } else {
              // Fallback: treat as empty array
              newArray = [];
            }
            
            const oldSet = new Set(oldArray);
            const newSet = new Set(newArray);

            // Find removed items
            const removed = oldArray.filter((item: string) => !newSet.has(item));
            // Find added items
            const added = newArray.filter((item: string) => !oldSet.has(item));

            if (removed.length > 0) {
              removed.forEach((item: string) => console.log(`      - ${item}`));
            }
            if (added.length > 0) {
              added.forEach((item: string) => console.log(`      + ${item}`));
            }
            if (removed.length === 0 && added.length === 0 && oldArray.length > 0) {
              // Only show "order changed" if arrays are non-empty and identical
              console.log(`      (order changed)`);
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
              removed.forEach((key: string) => console.log(`      - ${key}`));
            }
            if (added.length > 0) {
              added.forEach((key: string) => console.log(`      + ${key}`));
            }
            if (changed.length > 0) {
              changed.forEach((key: string) => {
                console.log(`      ~ ${key}: ${JSON.stringify(oldState[key])} → ${JSON.stringify(newState[key])}`);
              });
            }
          } else if (delta.type === 'exports') {
            console.log(`      ${delta.old} → ${delta.new}`);
          } else if (delta.type === 'apiSignature') {
            const oldSig = delta.old as Record<string, any> | null;
            const newSig = delta.new as Record<string, any> | null;
            
            // Handle null/undefined cases
            if (!oldSig && newSig) {
              console.log(`      + Added API signature`);
              if (newSig.parameters) console.log(`        parameters: ${JSON.stringify(newSig.parameters)}`);
              if (newSig.returnType) console.log(`        returnType: ${newSig.returnType}`);
              if (newSig.requestType) console.log(`        requestType: ${newSig.requestType}`);
              if (newSig.responseType) console.log(`        responseType: ${newSig.responseType}`);
            } else if (oldSig && !newSig) {
              console.log(`      - Removed API signature`);
            } else if (oldSig && newSig) {
              // Compare individual fields
              const oldParams = oldSig.parameters ?? {};
              const newParams = newSig.parameters ?? {};
              const oldKeys = Object.keys(oldParams);
              const newKeys = Object.keys(newParams);
              const paramRemoved = oldKeys.filter(k => !(k in newParams));
              const paramAdded = newKeys.filter(k => !(k in oldParams));
              const paramChanged = oldKeys.filter(k => k in newParams && oldParams[k] !== newParams[k]);
              
              if (paramRemoved.length > 0) {
                paramRemoved.forEach(k => console.log(`      - parameters.${k}: ${oldParams[k]}`));
              }
              if (paramAdded.length > 0) {
                paramAdded.forEach(k => console.log(`      + parameters.${k}: ${newParams[k]}`));
              }
              if (paramChanged.length > 0) {
                paramChanged.forEach(k => console.log(`      ~ parameters.${k}: ${oldParams[k]} → ${newParams[k]}`));
              }
              
              if (oldSig.returnType !== newSig.returnType) {
                console.log(`      ~ returnType: ${oldSig.returnType ?? '(none)'} → ${newSig.returnType ?? '(none)'}`);
              }
              if (oldSig.requestType !== newSig.requestType) {
                console.log(`      ~ requestType: ${oldSig.requestType ?? '(none)'} → ${newSig.requestType ?? '(none)'}`);
              }
              if (oldSig.responseType !== newSig.responseType) {
                console.log(`      ~ responseType: ${oldSig.responseType ?? '(none)'} → ${newSig.responseType ?? '(none)'}`);
              }
            }
          }
        });
      });
      if (!options.quiet) {
        console.log();
      }
    }
  }

  // Show token stats if requested (skip in quiet mode)
  if (options.stats && !options.quiet) {
    const oldTokens = await calculateTokens(oldBundles);
    const newTokens = await calculateTokens(newBundles);
    const deltaStat = newTokens.gpt4 - oldTokens.gpt4;
    
    let deltaPercentStr = '0.00';
    let deltaPercentNum = 0;
    
    if (oldTokens.gpt4 > 0) {
      deltaPercentNum = (deltaStat / oldTokens.gpt4) * 100;
      deltaPercentStr = deltaPercentNum.toFixed(2);
    }
    
    const sign = deltaStat > 0 ? '+' : '';
    const percentSign = deltaPercentNum > 0 ? '+' : deltaPercentNum < 0 ? '' : '';

    console.log('Token Stats:');
    console.log(`  ⚠️  Current mode = tokenizer-based.`);
    console.log(`      Other modes / raw source = heuristic.`);
    console.log(`      For precise per-mode breakdown, use "stamp context --compare-modes".`);
    console.log(`  Old: ${formatTokenCount(oldTokens.gpt4)} (GPT-4o-mini) | ${formatTokenCount(oldTokens.claude)} (Claude)`);
    console.log(`  New: ${formatTokenCount(newTokens.gpt4)} (GPT-4o-mini) | ${formatTokenCount(newTokens.claude)} (Claude)`);
    console.log(`  Δ ${sign}${formatTokenCount(deltaStat)} (${percentSign}${deltaPercentStr}%)\n`);
  }

  return result;
}
