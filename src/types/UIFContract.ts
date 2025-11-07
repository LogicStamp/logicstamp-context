/**
 * @uif Contract 0.3
 *
 * Description: UIFContract - Presentational component
 *
 * Version (Component Composition):
 *   variables: []
 *   hooks: []
 *   components: []
 *   functions: ["isUIFContract"]
 *   imports: []
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
 *   semantic: uif:84f4985dd25893f9bb7e43f6 (informational)
 *   file: uif:f1297e88a770031270331b9b
 */

/**
 * Core type definition for UI Forge Contract
 * Schema version 0.3
 */

export type ContractPreset = 'submit-only' | 'nav-only' | 'display-only' | 'none';

export type ContractKind = 'react:component' | 'ts:module' | 'node:cli';

export interface ComponentVersion {
  variables: string[];
  hooks: string[];
  components: string[];
  functions: string[];
  imports?: string[];
}

/**
 * Prop type descriptors
 */
export type PropType =
  | string  // Simple types: "boolean", "string", "number", etc.
  | string[]  // Legacy literal union format: ["\"primary\"", "\"secondary\""]
  | {  // Rich type descriptor
      type: 'literal-union' | 'function' | 'object' | 'array' | string;
      optional?: boolean;
      literals?: string[];  // For literal-union
      signature?: string;   // For function types
    };

/**
 * Event type descriptors
 */
export type EventType =
  | string  // Legacy: "function", "arrow function"
  | {  // Normalized event descriptor
      type: 'function';
      signature: string;  // e.g., "() => void"
      optional?: boolean;
    };

export interface LogicSignature {
  props: Record<string, PropType>;
  events: Record<string, EventType>;
  state?: Record<string, string>;
}

export interface A11yMetrics {
  contrastMin?: number;
  role?: string;
}

export interface LatencyMetrics {
  clientP95Ms?: number;
}

export interface CoverageMetrics {
  lines?: number;
  branches?: number;
}

export interface ContractMetrics {
  a11y?: A11yMetrics;
  latency?: LatencyMetrics;
  coverage?: CoverageMetrics;
}

export interface ContractLinks {
  tokens?: string;
  figma?: string;
  spec?: string;
}

export interface UIFContract {
  type: 'UIFContract';
  schemaVersion: '0.3';
  kind: ContractKind;
  entryId: string;
  description: string;
  usedIn?: string[];  // Optional: only persisted when non-empty
  version: ComponentVersion;
  logicSignature: LogicSignature;
  prediction?: string[];
  metrics?: ContractMetrics;
  links?: ContractLinks;
  semanticHash: string;
  fileHash: string;
}

/**
 * Utility type guards
 */
export function isUIFContract(obj: unknown): obj is UIFContract {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    obj.type === 'UIFContract' &&
    'schemaVersion' in obj &&
    obj.schemaVersion === '0.3'
  );
}
