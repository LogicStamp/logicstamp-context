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
 *   emits: {}
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
  emits: Record<string, EventType>;
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

export interface NextJSMetadata {
  isInAppDir?: boolean;
  directive?: 'client' | 'server';
}

export type ExportMetadata =
  | 'default'
  | 'named'
  | { named: string[] };

/**
 * Style metadata extracted from component
 */
export interface StyleSources {
  // Tailwind with detailed class categorization
  tailwind?: {
    categories: Record<string, string[]>; // layout, spacing, colors, etc.
    breakpoints?: string[]; // sm, md, lg, xl, 2xl
    classCount: number;
  };

  // SCSS module with parsed details
  scssModule?: string;
  scssDetails?: {
    selectors: string[]; // CSS selectors found in the SCSS file
    properties: string[]; // CSS properties used
    features: {
      variables?: boolean; // Uses SCSS variables
      nesting?: boolean; // Uses SCSS nesting
      mixins?: boolean; // Uses SCSS mixins
    };
  };

  // CSS module with parsed details
  cssModule?: string;
  cssDetails?: {
    selectors: string[];
    properties: string[];
  };

  // Inline styles
  inlineStyles?: boolean;

  // Styled-components/Emotion with component analysis
  styledComponents?: {
    components?: string[]; // Styled component names (e.g., ['div', 'Button'])
    usesTheme?: boolean; // Uses theme
    usesCssProp?: boolean; // Uses css prop
  };

  // Framer Motion with animation details
  motion?: {
    components?: string[]; // motion.div, motion.button, etc.
    variants?: string[]; // Variant names used
    features: {
      gestures?: boolean; // whileHover, whileTap, etc.
      layoutAnimations?: boolean; // layout prop
      viewportAnimations?: boolean; // useInView, viewport
    };
  };

  // Material UI with component and feature analysis
  materialUI?: {
    components?: string[]; // Button, TextField, Card, etc.
    packages?: string[]; // @mui/material, @mui/icons-material, etc.
    features: {
      usesTheme?: boolean; // useTheme, ThemeProvider, createTheme
      usesSxProp?: boolean; // sx prop for styling
      usesStyled?: boolean; // styled from @mui/material/styles
      usesMakeStyles?: boolean; // makeStyles (legacy)
      usesSystemProps?: boolean; // System props on Box/Stack
    };
  };
}

export interface LayoutMetadata {
  type?: 'flex' | 'grid' | 'relative' | 'absolute';
  cols?: string;
  hasHeroPattern?: boolean;
  hasFeatureCards?: boolean;
  sections?: string[];
}

export interface VisualMetadata {
  colors?: string[];
  spacing?: string[];
  radius?: string;
  typography?: string[];
}

export interface AnimationMetadata {
  type?: string;
  library?: string;
  trigger?: string;
}

export interface PageLayoutMetadata {
  pageRole?: string;
  sections?: string[];
  ctaCount?: number;
}

export interface StyleMetadata {
  styleSources?: StyleSources;
  layout?: LayoutMetadata;
  visual?: VisualMetadata;
  animation?: AnimationMetadata;
  pageLayout?: PageLayoutMetadata;
}

export interface UIFContract {
  type: 'UIFContract';
  schemaVersion: '0.3';
  kind: ContractKind;
  entryId: string;
  entryPathAbs?: string;  // Absolute native path (e.g., C:\\Users\\...\\App.tsx)
  entryPathRel?: string;  // Relative POSIX path (e.g., src/App.tsx)
  os?: 'win32' | 'posix';  // OS where contract was generated
  description: string;
  usedIn?: string[];  // Optional: only persisted when non-empty
  version: ComponentVersion;
  logicSignature: LogicSignature;
  exports?: ExportMetadata;  // Export type: default, named, or list of named exports
  prediction?: string[];
  metrics?: ContractMetrics;
  links?: ContractLinks;
  nextjs?: NextJSMetadata;  // Next.js App Router metadata
  style?: StyleMetadata;  // Optional style metadata
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
