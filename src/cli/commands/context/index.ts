/**
 * Context command helpers - Main entry point
 *
 * Public API exports for the context command module.
 * These utilities are used by the main context command and can be
 * imported by external consumers for building custom tooling.
 *
 * @module context
 *
 * Core modules:
 * - bundleFormatter: Format bundles for different output formats (json, pretty, ndjson, toon)
 * - configManager: Manage LogicStamp configuration and setup
 * - contractBuilder: Build UIFContracts from TypeScript source files
 * - fileWriter: Write context files and main index to disk
 * - statsCalculator: Calculate and display bundle statistics
 * - tokenEstimator: Estimate token counts and compare modes
 *
 * Watch mode modules:
 * - incrementalWatch: Incremental rebuild cache and utilities
 * - watchMode: File watching and automatic recompilation
 * - watchDiff: Contract and bundle comparison utilities
 */

// Core modules
export * from './bundleFormatter.js';
export * from './configManager.js';
export * from './contractBuilder.js';
export * from './fileWriter.js';
export * from './statsCalculator.js';
export * from './tokenEstimator.js';

// Watch mode modules
export * from './incrementalWatch.js';
export * from './watchDiff.js';
export * from './watchMode.js';
