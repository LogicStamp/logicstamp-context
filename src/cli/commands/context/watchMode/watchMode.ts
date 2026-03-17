/**
 * Watch Mode - Monitors file changes and recompiles context automatically
 */

import { resolve, dirname, join, relative } from 'node:path';
import { readFile } from 'node:fs/promises';
import chokidar from 'chokidar';
import { globFiles } from '../../../../utils/fsx.js';
import { readStampignore, filterIgnoredFiles } from '../../../../utils/stampignore.js';
import { buildDependencyGraph } from '../../../../core/manifest.js';
import type { LogicStampBundle } from '../../../../core/pack.js';
import { normalizeEntryId } from '../../../../utils/fsx.js';
import {
  writeWatchStatus,
  deleteWatchStatus,
  appendWatchLog,
  writeStrictWatchStatus,
  deleteStrictWatchStatus,
  getWatchStatusPath,
} from '../../../../utils/config.js';
import { registerCleanup, gracefulShutdown, registerSyncCleanupPath, registerSignalHandlers } from '../../../../utils/cleanup.js';
import type {
  WatchLogEntry,
  StrictWatchStatus,
} from '../../../../utils/config.js';
import { detectViolations, displayViolations } from '../../../../core/violations.js';
import { getChanges, showChanges, type BundleChanges, type ContractDiff } from './watchDiff.js';
import {
  initializeWatchCache,
  incrementalRebuild,
  type WatchCache,
} from './index.js';
import {
  buildContractsFromFiles,
  writeContextFiles,
  writeMainIndex,
  groupBundlesByFolder,
  displayPath,
  displayProjectRoot,
} from '../index.js';
import { contextCommand, type ContextOptions } from '../../context.js';

/**
 * Display session status block
 */
function displaySessionStatus(status: StrictWatchStatus, options: { quiet?: boolean } = {}): void {
  if (options.quiet) return;

  const activeErrors = status.lastCheck?.errors ?? 0;
  const activeWarnings = status.lastCheck?.warnings ?? 0;

  console.log(`\n📊 Session status:`);
  console.log(`   ❌ Errors detected:   ${status.totalErrorsDetected}`);
  console.log(`   ⚠️  Warnings detected: ${status.totalWarningsDetected}`);
  console.log(`   🔧 Resolved:          ${status.resolvedCount}`);
  console.log(`   📌 Active:            ${activeErrors + activeWarnings}`);
}

/**
 * Start watch mode - monitors file changes and recompiles context
 */
export async function startWatchMode(options: ContextOptions, projectRoot: string, initialCache: WatchCache | null = null): Promise<void> {
  // Register signal handlers so Ctrl+C goes through gracefulShutdown
  registerSignalHandlers();

  if (!options.quiet) {
    console.log(`\n👀 Watch mode enabled. Watching for file changes...`);
    if (options.strictWatch) {
      console.log(`   🔒 Strict mode: tracking breaking changes and violations`);
    }
    console.log(`   Press Ctrl+C to stop\n`);
  }

  // Determine output directory
  const outPath = resolve(options.out);
  const outputDir = outPath.endsWith('.json') ? dirname(outPath) : outPath;

  // Write watch status file so MCP server can detect watch mode
  const watchStatusPath = resolve(getWatchStatusPath(projectRoot));
  try {
    await writeWatchStatus(projectRoot, {
      active: true,
      projectRoot,
      pid: process.pid,
      startedAt: new Date().toISOString(),
      outputDir,
      strictWatch: options.strictWatch ?? false,
    });
    // Register for synchronous cleanup on exit (fallback for Windows where signals may not fire)
    registerSyncCleanupPath(watchStatusPath);
  } catch (error) {
    // Non-fatal - continue even if status file can't be written
    if (!options.quiet) {
      console.warn(`   ⚠️  Warning: Could not write watch status file: ${(error as Error).message}`);
    }
  }

  let debounceTimer: NodeJS.Timeout | null = null;
  let regenerationPromise: Promise<void> | null = null; // Promise-based lock to prevent race conditions
  let changedFiles: Set<string> = new Set();
  let baselineBundles: LogicStampBundle[] | null = null; // Initial state - never changes (like git HEAD)
  let previousBundles: LogicStampBundle[] | null = null; // Last state - for incremental tracking
  let watchCache: WatchCache | null = initialCache;
  let isFirstRun = false; // Set to false since cache is already initialized

  // Strict watch mode state
  let strictWatchStatus: StrictWatchStatus | null = options.strictWatch ? {
    active: true,
    startedAt: new Date().toISOString(),
    cumulativeViolations: 0,
    cumulativeErrors: 0,
    cumulativeWarnings: 0,
    totalErrorsDetected: 0,
    totalWarningsDetected: 0,
    resolvedCount: 0,
    regenerationCount: 0,
  } : null;

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
    // Use Promise-based lock to prevent race conditions
    // If already regenerating, wait for it to complete then check if more changes came in
    if (regenerationPromise) {
      await regenerationPromise;
      // After waiting, if no new changes accumulated, skip
      if (changedFiles.size === 0) {
        return;
      }
      // Otherwise, fall through to process new changes
    }

    const changedFileList = Array.from(changedFiles);
    changedFiles.clear(); // Clear for next batch
    const startTime = Date.now();

    // Create a promise for this regeneration cycle (used for lock)
    const doRegenerate = async () => {
      try {
        // Determine output directory
      const outPath = resolve(options.out);
      const outputDir = outPath.endsWith('.json') ? dirname(outPath) : outPath;

      // Load baseline bundles for state-based comparison (like git diff)
      // Baseline is set once and never changes - represents the starting state
      if (!baselineBundles) {
        baselineBundles = await loadAllBundles(outputDir);
        previousBundles = baselineBundles;
      }

      if (!options.quiet) {
        const fileList = changedFileList.length > 3 
          ? `${changedFileList.slice(0, 3).join(', ')}, ... (+${changedFileList.length - 3} more)`
          : changedFileList.join(', ');
        console.log(`\n🔄 Recompiling (${changedFileList.length} file${changedFileList.length > 1 ? 's' : ''} changed)...`);
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
            styleMode: options.styleMode,
            predictBehavior: options.predictBehavior,
            quiet: true,
          });
          const manifest = buildDependencyGraph(contracts);
          watchCache = await initializeWatchCache(filteredFiles, contracts, manifest, newBundles, projectRoot);
        }
      }
      
      const durationMs = Date.now() - startTime;
      // Compare against BASELINE (starting state), not previous state
      // This gives us cumulative diff like `git diff` - if changes are reverted, diff is empty
      const changes = baselineBundles && baselineBundles.length > 0
        ? getChanges(baselineBundles, newBundles)
        : null;

      if (!options.quiet) {
        if (changes && (changes.changed.length > 0 || changes.added.length > 0 || changes.removed.length > 0 || changes.bundleChanged.length > 0)) {
          showChanges(baselineBundles!, newBundles, changedFileList[0] || 'unknown', { debug: options.debug });
        }
        console.log(`\n✅ Recompiled\n`);
      }

      // Update previousBundles for incremental tracking (still useful for other operations)
      previousBundles = newBundles;

      // Strict watch mode: detect and report violations (state-based, like git diff)
      // Violations are calculated from current state vs baseline, not accumulated
      if (options.strictWatch && strictWatchStatus) {
        const hasChanges = changes && (
          changes.changed.length > 0 ||
          changes.added.length > 0 ||
          changes.removed.length > 0 ||
          changes.bundleChanged.length > 0
        );

        // Track previous state to detect new violations and resolution
        const previousActiveErrors = strictWatchStatus.lastCheck?.errors ?? 0;
        const previousActiveWarnings = strictWatchStatus.lastCheck?.warnings ?? 0;
        const hadActiveViolations = previousActiveErrors > 0 || previousActiveWarnings > 0;

        if (hasChanges) {
          const violations = detectViolations({ type: 'watch', changes });
          const errors = violations.filter(v => v.severity === 'error');
          const warnings = violations.filter(v => v.severity === 'warning');

          strictWatchStatus.regenerationCount++;

          if (violations.length > 0) {
            // Only increment totals if these are NEW violations (first time seeing violations, or count increased)
            const isNewViolation = !hadActiveViolations;
            const violationCountIncreased = errors.length > previousActiveErrors || warnings.length > previousActiveWarnings;
            
            if (isNewViolation || violationCountIncreased) {
              // Calculate new violations (only count increases, not existing ones)
              if (isNewViolation) {
                // First time violations appear - count all of them
                strictWatchStatus.totalErrorsDetected += errors.length;
                strictWatchStatus.totalWarningsDetected += warnings.length;
              } else {
                // Violations increased - only count the new ones
                const newErrors = Math.max(0, errors.length - previousActiveErrors);
                const newWarnings = Math.max(0, warnings.length - previousActiveWarnings);
                strictWatchStatus.totalErrorsDetected += newErrors;
                strictWatchStatus.totalWarningsDetected += newWarnings;
              }
            }

            // Update state-based counts (current state, not cumulative)
            strictWatchStatus.cumulativeViolations = violations.length;
            strictWatchStatus.cumulativeErrors = errors.length;
            strictWatchStatus.cumulativeWarnings = warnings.length;

            // Store current violations
            strictWatchStatus.lastCheck = {
              timestamp: new Date().toISOString(),
              totalViolations: violations.length,
              errors: errors.length,
              warnings: warnings.length,
              violations,
              changedFiles: changedFileList,
            };

            // Display violations to console (only if status changed)
            if (!options.quiet) {
              const statusChanged = errors.length !== previousActiveErrors || warnings.length !== previousActiveWarnings;
              if (statusChanged) {
                if (isNewViolation || violationCountIncreased) {
                  // Show appropriate emoji based on severity: ❌ for errors, ⚠️ for warnings only
                  if (errors.length > 0) {
                    console.log(`\n❌ Breaking change detected`);
                  } else if (warnings.length > 0) {
                    console.log(`\n⚠️  Warning detected`);
                  }
                }
                displayViolations(violations, { quiet: options.quiet });
                displaySessionStatus(strictWatchStatus, { quiet: options.quiet });
              }
            }

            // Write current violations state to disk
            await writeStrictWatchStatus(projectRoot, strictWatchStatus);
          } else {
            // Changes exist but no violations - violations were resolved
            if (hadActiveViolations) {
              strictWatchStatus.resolvedCount++;
            }

            strictWatchStatus.cumulativeViolations = 0;
            strictWatchStatus.cumulativeErrors = 0;
            strictWatchStatus.cumulativeWarnings = 0;
            strictWatchStatus.lastCheck = undefined;

            // Display resolution message and status
            if (!options.quiet && hadActiveViolations) {
              console.log(`\n✅ Violation resolved`);
              displaySessionStatus(strictWatchStatus, { quiet: options.quiet });
            }

            await deleteStrictWatchStatus(projectRoot);
          }
        } else {
          // No changes from baseline - clear violations (state reverted)
          if (hadActiveViolations) {
            strictWatchStatus.resolvedCount++;
          }

          strictWatchStatus.cumulativeViolations = 0;
          strictWatchStatus.cumulativeErrors = 0;
          strictWatchStatus.cumulativeWarnings = 0;
          strictWatchStatus.lastCheck = undefined;

          // Display resolution message and status
          if (!options.quiet && hadActiveViolations) {
            console.log(`\n✅ Violation resolved`);
            displaySessionStatus(strictWatchStatus, { quiet: options.quiet });
          }

          await deleteStrictWatchStatus(projectRoot);
        }
      }

      // Log structured data for MCP server (only if --log-file flag is set)
      // Appends each event to the log file for event history
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
    }
    };

    // Execute and track the regeneration promise
    regenerationPromise = doRegenerate().finally(() => {
      regenerationPromise = null;
    });
    await regenerationPromise;
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
      console.log(`   Watching: ${displayProjectRoot(projectRoot)}`);
      if (normalizedOutputDir !== projectRoot) {
        console.log(`   Ignoring output directory: ${displayProjectRoot(normalizedOutputDir)}`);
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
        // Ignore compiled context files
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
    watcher.on('error', async (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Watch error: ${errorMessage}`);
      await gracefulShutdown(1);
    });

    // Handle watcher ready (only show once)
    let readyShown = false;
    watcher.on('ready', () => {
      if (!options.quiet && !readyShown) {
        readyShown = true;
        console.log(`✅ Watch mode active. Waiting for file changes...\n`);
      }
    });

    // Register cleanup handler with the central cleanup registry
    // This ensures cleanup runs on any exit (SIGINT, SIGTERM, errors, etc.)
    registerCleanup('watch-mode', async () => {
      // Close the file watcher
      await watcher.close();

      // Clean up watch status file
      try {
        await deleteWatchStatus(projectRoot);
      } catch {
        // Ignore errors during cleanup
      }

      // Show final summary and clean up strict watch status
      if (!options.quiet) {
        console.log(`\n👋 Watch mode stopped`);

        if (options.strictWatch && strictWatchStatus) {
          const activeErrors = strictWatchStatus.lastCheck?.errors ?? 0;
          const activeWarnings = strictWatchStatus.lastCheck?.warnings ?? 0;
          const activeTotal = activeErrors + activeWarnings;

          // Helper for pluralization
          const pluralize = (count: number, singular: string, plural: string) => 
            count === 1 ? singular : plural;

          // Determine emoji and message based on errors/warnings
          let emoji: string;
          let message: string;
          
          if (activeErrors === 0 && activeWarnings === 0) {
            emoji = '✅';
            message = 'Strict Watch session complete - no violations detected';
          } else if (activeErrors === 0 && activeWarnings > 0) {
            emoji = '⚠️';
            message = `Strict Watch session complete - ${activeWarnings} ${pluralize(activeWarnings, 'warning', 'warnings')} detected`;
          } else {
            emoji = '❌';
            const parts: string[] = [];
            if (activeErrors > 0) {
              parts.push(`${activeErrors} ${pluralize(activeErrors, 'error', 'errors')}`);
            }
            if (activeWarnings > 0) {
              parts.push(`${activeWarnings} ${pluralize(activeWarnings, 'warning', 'warnings')}`);
            }
            message = `Strict Watch session complete - ${parts.join(', ')} detected`;
          }

          console.log(`\n${emoji} ${message}`);

          console.log(`\n📊 Session summary:`);
          console.log(`   ❌ Errors detected:   ${strictWatchStatus.totalErrorsDetected}`);
          console.log(`   ⚠️  Warnings detected: ${strictWatchStatus.totalWarningsDetected}`);
          console.log(`   🔧 Resolved:          ${strictWatchStatus.resolvedCount}`);
          console.log(`   📌 Active:            ${activeTotal}`);

          if (activeTotal > 0) {
            console.log(`\n   Report saved to: .logicstamp/strict_watch_violations.json`);
          }
        }
      }

      // Clean up strict watch status file if no violations
      if (!options.strictWatch || !strictWatchStatus || strictWatchStatus.cumulativeViolations === 0) {
        try {
          await deleteStrictWatchStatus(projectRoot);
        } catch {
          // Ignore errors during cleanup
        }
      }
    }, 1); // Priority 1 - run early since other cleanup might depend on watch being stopped

    // Keep process alive indefinitely
    await new Promise(() => {}); // Never resolves, keeps process running
  } catch (error) {
    console.error(`❌ Failed to start watch mode: ${(error as Error).message}`);
    await gracefulShutdown(1);
  }
}
