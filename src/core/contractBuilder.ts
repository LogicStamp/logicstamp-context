/**
 * @uif Contract 0.3
 *
 * Description: contractBuilder - Presentational component
 *
 * Version (Component Composition):
 *   variables: []
 *   hooks: []
 *   components: []
 *   functions: ["buildContract","mergeContractUpdate"]
 *   imports: ["../types/UIFContract.js","../utils/fsx.js","../utils/hash.js","./astParser.js","./signature.js"]
 *
 * Logic Signature:
 *   props: {}
 *   emits: {}
 *   state: {}
 *
 * Predictions:
 *   (none)
 *
 * Hashes (informational only - authoritative values in .uif.json):
 *   semantic: uif:9e7343c07744633f5dfe4cd9 (informational)
 *   file: uif:6885bc3a8a6e6f3a4c0056fb
 */

/**
 * Contract Builder - Assembles UIFContract objects from AST data
 */

import type { UIFContract, ContractPreset, ExportMetadata } from '../types/UIFContract.js';
import type { AstExtract } from './astParser.js';
import {
  buildLogicSignature,
  generateBehavioralPredictions,
  inferDescription,
} from './signature.js';
import { semanticHashFromAst, fileHash } from '../utils/hash.js';
import { normalizeEntryId } from '../utils/fsx.js';

export interface ContractBuildParams {
  description?: string;
  preset: ContractPreset;
  sourceText: string;
  enablePredictions?: boolean;
  styleMetadata?: import('../types/UIFContract.js').StyleMetadata; // Pre-extracted style data
}

export interface ContractBuildResult {
  contract: UIFContract;
  violations: string[];
}

/**
 * Extract export metadata from AST
 * Uses the export metadata extracted directly from the source file
 */
function extractExportsMetadata(ast: AstExtract): ExportMetadata | undefined {
  // Use the export metadata extracted from the AST if available
  if (ast.exports !== undefined) {
    return ast.exports;
  }

  // Fallback: if no exports metadata but we have exported functions, infer from them
  if (ast.exportedFunctions && ast.exportedFunctions.length > 0) {
    if (ast.exportedFunctions.length === 1) {
      return 'named';
    }
    return { named: ast.exportedFunctions };
  }

  return undefined;
}

/**
 * Build a complete UIFContract from extracted AST data
 */
export function buildContract(
  entryId: string,
  ast: AstExtract,
  params: ContractBuildParams
): ContractBuildResult {
  // Build logic signature with preset validation
  const { signature, prediction: presetPredictions, violations } = buildLogicSignature(
    ast,
    params.preset
  );

  // Generate additional behavioral predictions (only if enabled)
  const behavioralPredictions = params.enablePredictions
    ? generateBehavioralPredictions(ast)
    : [];

  // Combine all predictions
  const allPredictions = [...presetPredictions, ...behavioralPredictions];

  // Extract exports
  const exports = extractExportsMetadata(ast);

  // Build the contract (usedIn omitted - computed at manifest time, not persisted)
  // Note: entryPathAbs and entryPathRel are omitted - entryId is already relative and normalized
  const contract: UIFContract = {
    type: 'UIFContract',
    schemaVersion: '0.3',
    kind: ast.kind,
    entryId: normalizeEntryId(entryId),
    description: params.description || inferDescription(entryId, ast),
    version: {
      variables: ast.variables,
      hooks: ast.hooks,
      components: ast.components,
      functions: ast.functions,
      imports: ast.imports,
      ...(ast.backend?.languageSpecific && { languageSpecific: ast.backend.languageSpecific }),
    },
    logicSignature: signature,
    exports,
    prediction: allPredictions.length > 0 ? allPredictions : undefined,
    metrics: undefined,
    links: undefined,
    nextjs: ast.nextjs,
    style: params.styleMetadata, // Attach pre-extracted style metadata
    semanticHash: semanticHashFromAst(ast, signature),
    fileHash: fileHash(params.sourceText),
  };

  return { contract, violations };
}

/**
 * Merge contract updates while preserving manual fields
 */
export function mergeContractUpdate(
  existing: UIFContract,
  updated: UIFContract
): UIFContract {
  return {
    ...updated,
    // kind should always use the updated value (auto-detected)
    kind: updated.kind,
    // Preserve manually set fields that shouldn't be auto-updated
    description: existing.description || updated.description,
    metrics: existing.metrics || updated.metrics,
    links: existing.links || updated.links,
    // nextjs metadata should be auto-updated with shallow merge for future extensibility
    nextjs: updated.nextjs ? {
      ...(existing.nextjs ?? {}),
      ...updated.nextjs
    } : existing.nextjs,
    // usedIn is never persisted (computed at manifest time)
    usedIn: undefined,
  };
}
