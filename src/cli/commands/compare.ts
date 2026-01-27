/**
 * Compare command - Diffs two context.json files
 * Detects added/removed components and changed signatures
 */

import { readFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { LogicStampBundle, LogicStampIndex } from '../../core/pack.js';
import { estimateGPT4Tokens, estimateClaudeTokens, formatTokenCount } from '../../utils/tokens.js';
import { debugError } from '../../utils/debug.js';

interface LiteSig {
  semanticHash: string;
  imports: string[];
  hooks: string[];
  exportKind: 'default' | 'named' | 'none';
  functions: string[];
  components: string[];
  props: string[];
  emits: string[];
}

export interface CompareResult {
  status: 'PASS' | 'DRIFT';
  added: string[];
  removed: string[];
  changed: Array<{
    id: string;
    deltas: Array<{
      type: 'hash' | 'imports' | 'hooks' | 'exports' | 'functions' | 'components' | 'props' | 'emits';
      old: any;
      new: any;
    }>;
  }>;
}

/**
 * Result for a single folder's context file comparison
 */
export interface FolderCompareResult {
  folderPath: string;
  contextFile: string;
  status: 'PASS' | 'DRIFT' | 'ADDED' | 'ORPHANED';
  componentResult?: CompareResult; // undefined for ADDED/ORPHANED
  tokenDelta?: { gpt4: number; claude: number };
}

/**
 * Result for multi-file comparison (compares all context files)
 */
export interface MultiFileCompareResult {
  status: 'PASS' | 'DRIFT';
  folders: FolderCompareResult[];
  summary: {
    totalFolders: number;
    addedFolders: number;
    orphanedFolders: number;
    driftFolders: number;
    passFolders: number;
    totalComponentsAdded: number;
    totalComponentsRemoved: number;
    totalComponentsChanged: number;
  };
  orphanedFiles?: string[]; // Files on disk but not in new index
}

export interface CompareOptions {
  oldFile: string;
  newFile: string;
  stats?: boolean;
  approve?: boolean;
  quiet?: boolean;
}

export interface MultiFileCompareOptions {
  oldIndexFile: string;  // Path to old context_main.json
  newIndexFile: string;  // Path to new context_main.json
  stats?: boolean;
  approve?: boolean;
  autoCleanOrphaned?: boolean; // Auto-delete orphaned files with --approve
  quiet?: boolean;
}

/**
 * Index bundles into a map of entryId -> LiteSig
 */
function index(bundles: LogicStampBundle[]): Map<string, LiteSig> {
  const m = new Map<string, LiteSig>();
  for (const b of bundles) {
    for (const n of b.graph.nodes) {
      const c = n.contract;
      m.set(c.entryId.toLowerCase(), {
        semanticHash: c.semanticHash,
        imports: c.composition?.imports ?? [],
        hooks: c.composition?.hooks ?? [],
        functions: c.composition?.functions ?? [],
        components: c.composition?.components ?? [],
        props: Object.keys(c.interface?.props ?? {}),
        emits: Object.keys(c.interface?.emits ?? {}),
        exportKind: typeof c.exports === 'string' ? 'default'
                   : c.exports?.named?.length ? 'named' : 'none',
      });
    }
  }
  return m;
}

/**
 * Diff two indexed bundles with detailed change information
 */
function diff(oldIdx: Map<string, LiteSig>, newIdx: Map<string, LiteSig>): CompareResult {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: CompareResult['changed'] = [];

  // Find added components
  for (const id of newIdx.keys()) {
    if (!oldIdx.has(id)) {
      added.push(id);
    }
  }

  // Find removed components
  for (const id of oldIdx.keys()) {
    if (!newIdx.has(id)) {
      removed.push(id);
    }
  }

  // Find changed components with detailed deltas
  for (const id of newIdx.keys()) {
    if (oldIdx.has(id)) {
      const a = oldIdx.get(id)!;
      const b = newIdx.get(id)!;
      const deltas: CompareResult['changed'][number]['deltas'] = [];

      if (a.semanticHash !== b.semanticHash) {
        deltas.push({ type: 'hash', old: a.semanticHash, new: b.semanticHash });
      }

      if (JSON.stringify(a.imports) !== JSON.stringify(b.imports)) {
        deltas.push({ type: 'imports', old: a.imports, new: b.imports });
      }

      if (JSON.stringify(a.hooks) !== JSON.stringify(b.hooks)) {
        deltas.push({ type: 'hooks', old: a.hooks, new: b.hooks });
      }

      if (JSON.stringify(a.functions) !== JSON.stringify(b.functions)) {
        deltas.push({ type: 'functions', old: a.functions, new: b.functions });
      }

      if (JSON.stringify(a.components) !== JSON.stringify(b.components)) {
        deltas.push({ type: 'components', old: a.components, new: b.components });
      }

      if (JSON.stringify(a.props) !== JSON.stringify(b.props)) {
        deltas.push({ type: 'props', old: a.props, new: b.props });
      }

      if (JSON.stringify(a.emits) !== JSON.stringify(b.emits)) {
        deltas.push({ type: 'emits', old: a.emits, new: b.emits });
      }

      if (a.exportKind !== b.exportKind) {
        deltas.push({ type: 'exports', old: a.exportKind, new: b.exportKind });
      }

      if (deltas.length > 0) {
        changed.push({ id, deltas });
      }
    }
  }

  const status = added.length === 0 && removed.length === 0 && changed.length === 0
    ? 'PASS'
    : 'DRIFT';

  return { status, added, removed, changed };
}

/**
 * Calculate token count for bundles
 */
async function calculateTokens(bundles: LogicStampBundle[]): Promise<{ gpt4: number; claude: number }> {
  const text = JSON.stringify(bundles);
  return {
    gpt4: await estimateGPT4Tokens(text),
    claude: await estimateClaudeTokens(text),
  };
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

  // Index bundles
  const oldIdx = index(oldBundles);
  const newIdx = index(newBundles);

  // Compute diff
  const result = diff(oldIdx, newIdx);

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
                     delta.type === 'components' || delta.type === 'props' || delta.type === 'emits') {
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
          } else if (delta.type === 'exports') {
            console.log(`      ${delta.old} → ${delta.new}`);
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

/**
 * Load LogicStampIndex from file
 */
async function loadIndex(indexPath: string): Promise<LogicStampIndex> {
  let content: string;
  
  try {
    content = await readFile(indexPath, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('compare', 'loadIndex', {
      indexPath,
      message: err.message,
      code: err.code,
    });
    throw new Error(`Failed to load index from ${indexPath}: ${err.code === 'ENOENT' ? 'File not found' : err.message}`);
  }
  
  try {
    const index = JSON.parse(content) as LogicStampIndex;

    if (index.type !== 'LogicStampIndex') {
      throw new Error(`Invalid index file: expected type 'LogicStampIndex', got '${index.type}'`);
    }

    // Backward compatibility: warn about old schema version
    if (index.schemaVersion === '0.1') {
      console.warn(`⚠️  Warning: context_main.json uses schema version 0.1 (legacy format).`);
      console.warn(``);
      console.warn(`   Consider regenerating with "stamp context" to upgrade to version 0.2 (relative paths).`);
      console.warn(``);
      console.warn(`   Optional cleanup: "stamp context clean --all --yes".`);
      console.warn(``);
      console.warn(`   See docs/MIGRATION_0.3.2.md for details.\n`);
    } else if (index.schemaVersion !== '0.2') {
      console.warn(`⚠️  Warning: Unknown schema version "${index.schemaVersion}". Expected '0.1' or '0.2'.`);
    }

    return index;
  } catch (error) {
    const err = error as Error;
    debugError('compare', 'loadIndex', {
      indexPath,
      message: err.message,
    });
    throw new Error(`Failed to load index from ${indexPath}: ${err.message}`);
  }
}

/**
 * Discover orphaned context files on disk that are not in the new index
 */
async function findOrphanedFiles(
  oldIndex: LogicStampIndex,
  newIndex: LogicStampIndex,
  baseDir: string
): Promise<string[]> {
  const orphaned: string[] = [];
  const newContextFiles = new Set(newIndex.folders.map(f => f.contextFile));

  // Check each old folder's context file
  for (const folder of oldIndex.folders) {
    if (!newContextFiles.has(folder.contextFile)) {
      // Check if file still exists on disk
      const contextPath = join(baseDir, folder.contextFile);
      try {
        await readFile(contextPath, 'utf8');
        orphaned.push(folder.contextFile);
      } catch (error) {
        // File doesn't exist, not orphaned (already deleted)
        const err = error as NodeJS.ErrnoException;
        if (err.code !== 'ENOENT') {
          debugError('compare', 'findOrphanedFiles', {
            contextPath,
            message: err.message,
            code: err.code,
          });
        }
      }
    }
  }

  return orphaned;
}

/**
 * Compare a single folder's context file
 */
async function compareFolderContext(
  oldContextPath: string,
  newContextPath: string,
  stats: boolean,
  quiet?: boolean
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

  // Index bundles
  const oldIdx = index(oldBundles);
  const newIdx = index(newBundles);

  // Compute diff
  const result = diff(oldIdx, newIdx);

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
 * Multi-file comparison - compares all context files using context_main.json indices
 * This is the comprehensive comparison that handles:
 * 1. context_main.json as root index
 * 2. All folder context.json files
 * 3. ADDED FILE detection (new folders)
 * 4. ORPHANED FILE detection (deleted folders)
 * 5. DRIFT detection (changed files)
 * 6. PASS detection (unchanged files)
 */
export async function multiFileCompare(options: MultiFileCompareOptions): Promise<MultiFileCompareResult> {
  const oldBaseDir = dirname(options.oldIndexFile);
  const newBaseDir = dirname(options.newIndexFile);

  // Load both index files
  const oldIndex = await loadIndex(options.oldIndexFile);
  const newIndex = await loadIndex(options.newIndexFile);

  // Create maps for quick lookup
  const oldFolderMap = new Map(oldIndex.folders.map(f => [f.contextFile, f]));
  const newFolderMap = new Map(newIndex.folders.map(f => [f.contextFile, f]));

  const folderResults: FolderCompareResult[] = [];
  let totalComponentsAdded = 0;
  let totalComponentsRemoved = 0;
  let totalComponentsChanged = 0;

  // Compare folders that exist in both old and new
  const allContextFiles = new Set([
    ...oldIndex.folders.map(f => f.contextFile),
    ...newIndex.folders.map(f => f.contextFile),
  ]);

  for (const contextFile of allContextFiles) {
    const oldFolder = oldFolderMap.get(contextFile);
    const newFolder = newFolderMap.get(contextFile);

    if (oldFolder && newFolder) {
      // Folder exists in both - compare context files
      const oldPath = join(oldBaseDir, oldFolder.contextFile);
      const newPath = join(newBaseDir, newFolder.contextFile);

      try {
        const { result, tokenDelta } = await compareFolderContext(oldPath, newPath, options.stats || false, options.quiet);

        folderResults.push({
          folderPath: newFolder.path,
          contextFile: newFolder.contextFile,
          status: result.status,
          componentResult: result,
          tokenDelta,
        });

        if (result.status === 'DRIFT') {
          totalComponentsAdded += result.added.length;
          totalComponentsRemoved += result.removed.length;
          totalComponentsChanged += result.changed.length;
        }
      } catch (error) {
        // If comparison fails, treat as drift
        console.error(`⚠️  Failed to compare ${contextFile}: ${(error as Error).message}`);
        folderResults.push({
          folderPath: newFolder.path,
          contextFile: newFolder.contextFile,
          status: 'DRIFT',
        });
      }
    } else if (!oldFolder && newFolder) {
      // New folder - ADDED FILE
      folderResults.push({
        folderPath: newFolder.path,
        contextFile: newFolder.contextFile,
        status: 'ADDED',
      });
      totalComponentsAdded += newFolder.bundles;
    } else if (oldFolder && !newFolder) {
      // Removed folder - ORPHANED FILE
      folderResults.push({
        folderPath: oldFolder.path,
        contextFile: oldFolder.contextFile,
        status: 'ORPHANED',
      });
      totalComponentsRemoved += oldFolder.bundles;
    }
  }

  // Find orphaned files on disk
  const orphanedFiles = await findOrphanedFiles(oldIndex, newIndex, oldBaseDir);

  // Calculate summary
  const addedFolders = folderResults.filter(f => f.status === 'ADDED').length;
  const orphanedFolders = folderResults.filter(f => f.status === 'ORPHANED').length;
  const driftFolders = folderResults.filter(f => f.status === 'DRIFT').length;
  const passFolders = folderResults.filter(f => f.status === 'PASS').length;

  const status = addedFolders > 0 || orphanedFolders > 0 || driftFolders > 0 ? 'DRIFT' : 'PASS';

  // Sort folder results by path for consistent output
  folderResults.sort((a, b) => a.folderPath.localeCompare(b.folderPath));

  return {
    status,
    folders: folderResults,
    summary: {
      totalFolders: folderResults.length,
      addedFolders,
      orphanedFolders,
      driftFolders,
      passFolders,
      totalComponentsAdded,
      totalComponentsRemoved,
      totalComponentsChanged,
    },
    orphanedFiles: orphanedFiles.length > 0 ? orphanedFiles : undefined,
  };
}

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
                         delta.type === 'components' || delta.type === 'props' || delta.type === 'emits') {
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

/**
 * Clean up orphaned files
 */
export async function cleanOrphanedFiles(orphanedFiles: string[], baseDir: string, quiet?: boolean): Promise<number> {
  let deletedCount = 0;

  for (const file of orphanedFiles) {
    const filePath = join(baseDir, file);
    try {
      await unlink(filePath);
      if (!quiet) {
        console.log(`   🗑️  Deleted: ${file}`);
      }
      deletedCount++;
    } catch (error) {
      // Always show errors even in quiet mode
      console.error(`   ⚠️  Failed to delete ${file}: ${(error as Error).message}`);
    }
  }

  return deletedCount;
}
