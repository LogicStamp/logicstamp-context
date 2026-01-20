/**
 * LogicStamp Context - Main entry point
 * 
 * This package provides tools for generating AI-friendly context bundles
 * from React/TypeScript codebases.
 * 
 * @example
 * ```typescript
 * // Core functions
 * import { extractFromFile, buildContract, pack } from 'logicstamp-context';
 * 
 * // Validation utilities
 * import { validateBundles, multiFileValidate } from 'logicstamp-context';
 * 
 * // Comparison utilities
 * import { multiFileCompare } from 'logicstamp-context';
 * 
 * // Types
 * import type { LogicStampBundle, LogicStampIndex, FolderInfo } from 'logicstamp-context';
 * ```
 */

// Core types
export type { UIFContract, NextJSMetadata, LogicSignature, ContractKind, PropType, EventType } from './types/UIFContract.js';
export type { LogicStampBundle, BundleNode, PackOptions, CodeInclusionMode, BundleFormat, MissingDependency, LogicStampIndex, FolderInfo } from './core/pack.js';
export type { ProjectManifest, ComponentNode } from './core/manifest.js';
export type { AstExtract } from './core/astParser.js';
export type { ContractBuildResult, ContractBuildParams } from './core/contractBuilder.js';
export type { SignatureResult } from './core/signature.js';

// Core functions
export { extractFromFile } from './core/astParser.js';
export { buildContract } from './core/contractBuilder.js';
export { pack, computeBundleHash, validateHashLock } from './core/pack.js';
export { buildLogicSignature } from './core/signature.js';

// CLI commands (for programmatic use)
export { contextCommand } from './cli/commands/context.js';
export type { ContextOptions } from './cli/commands/context.js';
export { compareCommand, multiFileCompare } from './cli/commands/compare.js';
export type { CompareOptions, CompareResult, FolderCompareResult, MultiFileCompareResult, MultiFileCompareOptions } from './cli/commands/compare.js';
export { validateCommand, validateBundles, multiFileValidate } from './cli/commands/validate.js';
export type { ValidationResult, FolderValidationResult, MultiFileValidationResult } from './cli/commands/validate.js';
export { init } from './cli/commands/init.js';
export { cleanCommand } from './cli/commands/clean.js';

// Watch mode status (for MCP server integration)
export { isWatchModeActive, readWatchStatus, getWatchStatusPath, readWatchLogs, appendWatchLog, clearWatchLogs, getWatchLogsPath } from './utils/config.js';
export type { WatchStatus, WatchLogEntry, WatchLogs } from './utils/config.js';
