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
import { getChanges, showChanges } from './watchDiff.js';
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
        ? getChanges(previousBundles, newBundles)
        : null;

      if (!options.quiet) {
        if (changes) {
          showChanges(previousBundles!, newBundles, changedFileList[0] || 'unknown', { debug: options.debug });
        }
        console.log(`\n✅ Regenerated\n`);
      }

      // Log structured data for MCP server (only if --log-file flag is set)
      if (options.logFile) {
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
      }

      previousBundles = newBundles; // Update for next comparison
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = (error as Error).message;
      
      if (!options.quiet) {
        console.error(`   ❌ Error: ${errorMessage}\n`);
      }

      // Log error to watch logs (only if --log-file flag is set)
      if (options.logFile) {
        const logEntry: WatchLogEntry = {
          timestamp: new Date().toISOString(),
          changedFiles: changedFileList,
          fileCount: changedFileList.length,
          durationMs,
          error: errorMessage,
        };
        await appendWatchLog(projectRoot, logEntry);
      }

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
