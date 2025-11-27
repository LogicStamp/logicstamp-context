/**
 * LogicStamp Context - Main entry point
 * 
 * This package provides tools for generating AI-friendly context bundles
 * from React/TypeScript codebases.
 * 
 * @example
 * ```typescript
 * import { extractFromFile, buildContract, pack } from 'logicstamp-context';
 * ```
 */

// Core types
export type { UIFContract, NextJSMetadata, LogicSignature, ContractKind, PropType, EventType } from './types/UIFContract.js';
export type { LogicStampBundle, BundleNode, PackOptions, CodeInclusionMode, BundleFormat, MissingDependency } from './core/pack.js';
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
export { contextCommand, type ContextOptions } from './cli/commands/context.js';
export { compareCommand, type CompareOptions } from './cli/commands/compare.js';
export { validateCommand } from './cli/commands/validate.js';
export { init } from './cli/commands/init.js';
export { cleanCommand } from './cli/commands/clean.js';

