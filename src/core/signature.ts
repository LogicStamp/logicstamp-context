/**
 * @uif Contract 0.3
 *
 * Description: signature - Presentational component
 *
 * Version (Component Composition):
 *   variables: []
 *   hooks: []
 *   components: []
 *   functions: ["applyDisplayOnlyPreset","applyNavOnlyPreset","applySubmitOnlyPreset","buildLogicSignature","generateBehavioralPredictions","inferDescription"]
 *   imports: ["../types/UIFContract.js","./astParser.js"]
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
 *   semantic: uif:9a5a412d07f6985e03fda241 (informational)
 *   file: uif:64d7d3b1474878658358e5a8
 */

/**
 * Logic Signature Builder - Applies contract presets and generates predictions
 */

import type { AstExtract } from './astParser.js';
import type { ContractPreset, LogicSignature } from '../types/UIFContract.js';

export interface SignatureResult {
  signature: LogicSignature;
  prediction: string[];
  violations: string[];
}

/**
 * Build logic signature with preset validation
 */
export function buildLogicSignature(
  ast: AstExtract,
  preset: ContractPreset
): SignatureResult {
  const signature: LogicSignature = {
    props: ast.props,
    events: ast.events,
    state: Object.keys(ast.state).length > 0 ? ast.state : undefined,
  };

  const prediction: string[] = [];
  const violations: string[] = [];

  // Apply preset-specific rules
  switch (preset) {
    case 'submit-only':
      applySubmitOnlyPreset(ast, prediction, violations);
      break;
    case 'nav-only':
      applyNavOnlyPreset(ast, prediction, violations);
      break;
    case 'display-only':
      applyDisplayOnlyPreset(ast, prediction, violations);
      break;
    case 'none':
      // No preset constraints
      break;
  }

  return { signature, prediction, violations };
}

/**
 * Submit-only preset: only onSubmit event allowed
 */
function applySubmitOnlyPreset(
  ast: AstExtract,
  prediction: string[],
  violations: string[]
): void {
  prediction.push('Contract preset: submit-only');

  const allowedEvents = ['onSubmit'];
  const eventKeys = Object.keys(ast.events);
  const forbidden = eventKeys.filter((key) => !allowedEvents.includes(key));

  if (forbidden.length > 0) {
    violations.push(`Submit-only contract violated: remove events [${forbidden.join(', ')}]`);
  }

  if (eventKeys.includes('onSubmit')) {
    prediction.push('When loading=true, submit button should be disabled');
    prediction.push('onSubmit is the only permitted action handler');
  }

  // Check for loading/busy state
  if (ast.state.loading || ast.state.busy || ast.state.isLoading) {
    prediction.push('Loading state controls button disabled state');
  }
}

/**
 * Nav-only preset: only onClick navigation allowed
 */
function applyNavOnlyPreset(
  ast: AstExtract,
  prediction: string[],
  violations: string[]
): void {
  prediction.push('Contract preset: nav-only');

  const allowedEvents = ['onClick'];
  const eventKeys = Object.keys(ast.events);
  const forbidden = eventKeys.filter((key) => !allowedEvents.includes(key));

  if (forbidden.length > 0) {
    violations.push(`Nav-only contract violated: remove events [${forbidden.join(', ')}]`);
  }

  if (!eventKeys.includes('onClick')) {
    violations.push('Nav-only contract expects an onClick navigation handler');
  }

  prediction.push('Component handles navigation only, no form submission or data mutation');

  // Check for href prop (for link-like components)
  if ('href' in ast.props || 'to' in ast.props) {
    prediction.push('Navigation target specified via href/to prop');
  }
}

/**
 * Display-only preset: no events allowed
 */
function applyDisplayOnlyPreset(
  ast: AstExtract,
  prediction: string[],
  violations: string[]
): void {
  prediction.push('Contract preset: display-only');

  const eventKeys = Object.keys(ast.events);

  if (eventKeys.length > 0) {
    violations.push(
      `Display-only contract violated: no events permitted, found [${eventKeys.join(', ')}]`
    );
  }

  prediction.push('Component is purely presentational with no event handlers');
  prediction.push('All behavior driven by props only');

  // Check for derived state
  const stateKeys = Object.keys(ast.state);
  if (stateKeys.length > 0) {
    violations.push(
      `Display-only contract should minimize internal state, found [${stateKeys.join(', ')}]`
    );
  }
}

/**
 * Generate additional behavioral predictions based on common patterns
 */
export function generateBehavioralPredictions(ast: AstExtract): string[] {
  const predictions: string[] = [];

  // Form handling patterns
  if (ast.hooks.includes('useForm') || ast.functions.some((f) => f.includes('validate'))) {
    predictions.push('Includes form validation logic');
  }

  // Side effects
  if (ast.hooks.includes('useEffect')) {
    predictions.push('Has side effects managed by useEffect');
  }

  // Data fetching
  if (
    ast.hooks.some((h) => h.includes('Query') || h.includes('Mutation')) ||
    ast.functions.some((f) => f.includes('fetch') || f.includes('load'))
  ) {
    predictions.push('Fetches or mutates external data');
  }

  // Memoization
  if (ast.hooks.includes('useMemo') || ast.hooks.includes('useCallback')) {
    predictions.push('Uses memoization for performance optimization');
  }

  // Context usage
  if (ast.hooks.includes('useContext')) {
    predictions.push('Consumes React Context for shared state');
  }

  // Refs
  if (ast.hooks.includes('useRef')) {
    predictions.push('Uses refs for DOM access or mutable values');
  }

  // Loading states
  const stateKeys = Object.keys(ast.state);
  if (stateKeys.some((k) => k.includes('loading') || k.includes('pending'))) {
    predictions.push('Manages loading/pending UI states');
  }

  // Error states
  if (stateKeys.some((k) => k.includes('error'))) {
    predictions.push('Handles and displays error states');
  }

  return predictions;
}

/**
 * Infer component description from file name and structure
 */
export function inferDescription(filePath: string, ast: AstExtract): string {
  const fileName = filePath.split(/[/\\]/).pop()?.replace(/\.(tsx?|jsx?)$/, '') || 'Component';

  // Try to infer from common patterns
  if (fileName.toLowerCase().includes('button')) {
    return `${fileName} - Interactive button component`;
  }
  if (fileName.toLowerCase().includes('form')) {
    return `${fileName} - Form component with validation`;
  }
  if (fileName.toLowerCase().includes('modal') || fileName.toLowerCase().includes('dialog')) {
    return `${fileName} - Modal/dialog component`;
  }
  if (fileName.toLowerCase().includes('input') || fileName.toLowerCase().includes('field')) {
    return `${fileName} - Form input field`;
  }
  if (fileName.toLowerCase().includes('card')) {
    return `${fileName} - Card display component`;
  }
  if (fileName.toLowerCase().includes('nav') || fileName.toLowerCase().includes('menu')) {
    return `${fileName} - Navigation component`;
  }

  // Default description
  const hasState = Object.keys(ast.state).length > 0;
  const hasEvents = Object.keys(ast.events).length > 0;

  if (hasState && hasEvents) {
    return `${fileName} - Interactive component with internal state`;
  } else if (hasState) {
    return `${fileName} - Stateful component`;
  } else if (hasEvents) {
    return `${fileName} - Interactive component`;
  } else {
    return `${fileName} - Presentational component`;
  }
}
