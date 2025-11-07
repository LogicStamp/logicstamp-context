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
 *   events: {}
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

import type { UIFContract, ContractPreset } from '../types/UIFContract.js';
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
}

export interface ContractBuildResult {
  contract: UIFContract;
  violations: string[];
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

  // Generate additional behavioral predictions
  const behavioralPredictions = generateBehavioralPredictions(ast);

  // Combine all predictions
  const allPredictions = [...presetPredictions, ...behavioralPredictions];

  // Build the contract (usedIn omitted - computed at manifest time, not persisted)
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
    },
    logicSignature: signature,
    prediction: allPredictions.length > 0 ? allPredictions : undefined,
    metrics: undefined,
    links: undefined,
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
    // usedIn is never persisted (computed at manifest time)
    usedIn: undefined,
  };
}
