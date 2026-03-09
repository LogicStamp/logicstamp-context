/**
 * Multi-file comparison logic
 */

import { dirname, join } from 'node:path';
import type { MultiFileCompareOptions, MultiFileCompareResult, FolderCompareResult, CompareResult } from './types.js';
import { loadIndex, findOrphanedFiles } from './utils.js';
import { compareFolderContext } from './singleFile.js';

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
        const { result, tokenDelta } = await compareFolderContext(oldPath, newPath, options.stats || false, options.quiet, options.gitBaseline ?? false);

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

  // Only orphaned folders and drift folders qualify as drift; added folders are growth, not drift
  const status = orphanedFolders > 0 || driftFolders > 0 ? 'DRIFT' : 'PASS';

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
