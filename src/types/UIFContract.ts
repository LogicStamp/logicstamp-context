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
 * Schema version 0.4
 */

export type ContractPreset = 'submit-only' | 'nav-only' | 'display-only' | 'none';

/**
 * Component kind identifier in format 'language:type'
 * Examples: 'react:component', 'python:function', 'java:class', 'node:api'
 * Extensible to support any language and type combination
 */
export type ContractKind = 
  | 'react:component' 
  | 'react:hook' 
  | 'vue:component' 
  | 'vue:composable' 
  | 'ts:module' 
  | 'node:cli'
  | 'node:api'        // Backend API routes/handlers
  | string;            // Allow any string matching pattern 'language:type' for extensibility

export interface LanguageSpecificVersion {
  /** Python decorators (e.g., ['@app.get', '@app.post']) */
  decorators?: string[];
  /** Java annotations (e.g., ['@RestController', '@GetMapping']) */
  annotations?: string[];
  /** Python/Java classes (e.g., ['UserController', 'UserService']) */
  classes?: string[];
  /** Java methods (if different from functions, e.g., ['getUser', 'createUser']) */
  methods?: string[];
}

export interface ComponentVersion {
  variables: string[];
  hooks: string[];        // React hooks (empty [] for non-React files)
  components: string[];   // React/Vue components (empty [] for non-React/Vue files)
  functions: string[];
  imports?: string[];
  /** Language-specific extensions (e.g., decorators for Python, annotations for Java) */
  languageSpecific?: LanguageSpecificVersion;
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

export interface ApiSignature {
  /** Function/method parameters with types (e.g., { user_id: 'int', name: 'str' }) */
  parameters?: Record<string, string>;
  /** Return type (e.g., 'User', 'List[User]', 'void') */
  returnType?: string;
  /** Request body type for POST/PUT requests (e.g., 'CreateUserRequest') */
  requestType?: string;
  /** Response type (e.g., 'UserResponse', 'List[UserResponse]') */
  responseType?: string;
}

export interface LogicSignature {
  props: Record<string, PropType>;     // Component props (empty {} for backend files)
  emits: Record<string, EventType>;    // Component events (empty {} for backend files)
  state?: Record<string, string>;      // Component state (empty {} for backend files)
  /** API signature for backend functions/methods (parameters, return types, etc.) */
  apiSignature?: ApiSignature;
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
  routeRole?: 'page' | 'layout' | 'loading' | 'error' | 'not-found' | 'template' | 'default' | 'route';
  segmentPath?: string; // Route path derived from file structure (e.g., '/blog/[slug]', '/api/users')
  metadata?: {
    static?: Record<string, unknown>; // From `export const metadata = {...}`
    dynamic?: boolean; // True if `export function generateMetadata()` exists
  };
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
  inlineStyles?: boolean | {
    properties?: string[]; // CSS property names (e.g., ['animationDelay', 'transformOrigin', 'color'])
    values?: Record<string, string>; // Property-value pairs (e.g., { animationDelay: '2s', color: 'blue' })
  };

  // Styled JSX with CSS content extraction
  styledJsx?: {
    css?: string; // Extracted CSS content from <style jsx> blocks
    global?: boolean; // Whether the style block has global attribute
    selectors?: string[]; // CSS selectors found in the extracted CSS
    properties?: string[]; // CSS properties found in the extracted CSS
  };

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

  // ShadCN/UI with component and variant analysis
  shadcnUI?: {
    components?: string[]; // Button, Card, Dialog, Sheet, etc.
    variants?: Record<string, string[]>; // Variant usage per component type
    sizes?: string[]; // Size prop values used (sm, lg, icon, etc.)
    features: {
      usesForm?: boolean; // react-hook-form integration
      usesTheme?: boolean; // next-themes or dark mode
      usesIcons?: boolean; // lucide-react or radix icons
      componentDensity?: 'low' | 'medium' | 'high'; // Number of ShadCN components
    };
  };

  // Radix UI with primitive and pattern analysis
  radixUI?: {
    primitives?: Record<string, string[]>; // Package -> components (e.g., 'react-dialog' -> ['Dialog', 'DialogContent'])
    patterns?: {
      controlled?: string[]; // Components using controlled pattern
      uncontrolled?: string[]; // Components using uncontrolled pattern
      portals?: number; // Portal usage count
      asChild?: number; // asChild composition pattern count
    };
    accessibility?: {
      usesDirection?: boolean; // RTL/LTR support
      usesFocusManagement?: boolean; // Focus trapping, etc.
      usesKeyboardNav?: boolean; // Loop, orientation, etc.
      usesModal?: boolean; // Modal dialogs
    };
    features?: {
      primitiveCount?: number; // Total unique primitives used
      compositionDepth?: 'simple' | 'moderate' | 'complex'; // Composition complexity
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
  /**
   * Border radius token (e.g., "default", "sm", "md", "lg", "xl", "2xl", "3xl", "full")
   * Stores just the token, not the full class name (e.g., "lg" not "rounded-lg")
   */
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
  schemaVersion: '0.4';
  kind: ContractKind;
  entryId: string;  // Relative normalized path (e.g., src/App.tsx) - always uses forward slashes
  description: string;
  usedIn?: string[];  // Optional: only persisted when non-empty
  composition: ComponentVersion;
  interface: LogicSignature;
  exports?: ExportMetadata;  // Export type: default, named, or list of named exports
  prediction?: string[];
  metrics?: ContractMetrics;
  links?: ContractLinks;
  nextjs?: NextJSMetadata;  // Next.js App Router metadata
  style?: StyleMetadata;  // Optional style metadata
  semanticHash: string;
  fileHash: string;
  /** @deprecated No longer generated as of v0.3.2. Use `entryId` instead (contains relative normalized path). Kept for backward compatibility with old contracts. */
  entryPathAbs?: string;
  /** @deprecated No longer generated as of v0.3.2. Use `entryId` instead (contains relative normalized path). Kept for backward compatibility with old contracts. */
  entryPathRel?: string;
  /** @deprecated No longer generated as of v0.3.2. Relative paths are OS-agnostic. Kept for backward compatibility with old contracts. */
  os?: 'win32' | 'posix';
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
    obj.schemaVersion === '0.4'
  );
}
