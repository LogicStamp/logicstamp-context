/**
 * Compare command - Main entry point
 *
 * Public API exports for the compare command module.
 * These utilities are used by the main compare command and can be
 * imported by external consumers for building custom tooling.
 *
 * @module compare
 *
 * Core modules:
 * - types: Type definitions and interfaces
 * - core: Core comparison logic (indexing, diffing, normalization)
 * - utils: Utility functions (token calculation, index loading, orphaned file detection)
 * - singleFile: Single file comparison logic
 * - multiFile: Multi-file comparison logic
 * - display: Display formatting for comparison results
 * - cleanup: Cleanup functions for orphaned files
 */

// Types
export * from './types.js';

// Core comparison logic
export * from './core.js';

// Utility functions
export * from './utils.js';

// Single file comparison
export * from './singleFile.js';

// Multi-file comparison
export * from './multiFile.js';

// Display formatting
export * from './display.js';

// Cleanup functions
export * from './cleanup.js';
