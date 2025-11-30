# Schema Reference

Complete schema reference for all LogicStamp data structures. All schemas are versioned and validated to ensure compatibility.

## Schema Versions

LogicStamp uses semantic versioning for schemas:

| Schema | Current Version | Purpose |
|--------|----------------|---------|
| `UIFContract` | `0.3` | Component contract structure |
| `LogicStampBundle` | `0.1` | LLM context bundle format |
| `LogicStampIndex` | `0.1` | Main index for multi-file context |

## UIFContract Schema

Component contract structure embedded in bundles.

### Schema Version: `0.3`

```typescript
interface UIFContract {
  type: "UIFContract";
  schemaVersion: "0.3";
  kind: "react:component" | "react:hook" | "typescript:module";
  description?: string;
  version: {
    variables: string[];
    hooks: string[];
    components: string[];
    functions: string[];
  };
  logicSignature: {
    props: Record<string, PropSignature>;
    events: Record<string, EventSignature>;
    state: Record<string, StateSignature>;
  };
  exports?: "default" | "named" | { named: string[] };  // Optional export metadata
  style?: StyleMetadata;  // Optional style metadata (when --include-style is used)
  semanticHash: string; // Format: "uif:..." (24 hex chars)
  fileHash: string;     // Format: "uif:..." (24 hex chars)
}

interface PropSignature {
  type: string;
  signature?: string;  // For function props
  optional?: boolean;
}

interface EventSignature {
  type: string;
  signature?: string;  // Function signature
}

interface StateSignature {
  type: string;
}

interface StyleMetadata {
  styleSources?: StyleSources;
  layout?: LayoutMetadata;
  visual?: VisualMetadata;
  animation?: AnimationMetadata;
  pageLayout?: PageLayoutMetadata;
}

interface StyleSources {
  tailwind?: {
    categories: Record<string, string[]>; // layout, spacing, colors, typography, borders, effects
    breakpoints?: string[]; // sm, md, lg, xl, 2xl
    classCount: number;
  };
  scssModule?: string; // Path to SCSS module file
  scssDetails?: {
    selectors: string[];
    properties: string[];
    features: {
      variables?: boolean;
      nesting?: boolean;
      mixins?: boolean;
    };
  };
  cssModule?: string; // Path to CSS module file
  cssDetails?: {
    selectors: string[];
    properties: string[];
  };
  inlineStyles?: boolean;
  styledComponents?: {
    components?: string[];
    usesTheme?: boolean;
    usesCssProp?: boolean;
  };
  motion?: {
    components?: string[];
    variants?: string[];
    features: {
      gestures?: boolean;
      layoutAnimations?: boolean;
      viewportAnimations?: boolean;
    };
  };
  materialUI?: {
    components?: string[];
    packages?: string[];
    features: {
      usesTheme?: boolean;
      usesSxProp?: boolean;
      usesStyled?: boolean;
      usesMakeStyles?: boolean;
      usesSystemProps?: boolean;
    };
  };
}

interface LayoutMetadata {
  type?: "flex" | "grid" | "relative" | "absolute";
  cols?: string; // Grid column pattern (e.g., "grid-cols-2 md:grid-cols-3")
  hasHeroPattern?: boolean;
  hasFeatureCards?: boolean;
  sections?: string[];
}

interface VisualMetadata {
  colors?: string[]; // Color utility classes (limited to top 10)
  spacing?: string[]; // Spacing utility classes (limited to top 10)
  radius?: string; // Most common border radius pattern
  typography?: string[]; // Typography classes (limited to top 10)
}

interface AnimationMetadata {
  type?: string; // Animation type (e.g., "fade-in", "slide")
  library?: string; // "framer-motion" or "css"
  trigger?: string; // Trigger type (e.g., "inView", "hover")
}

interface PageLayoutMetadata {
  pageRole?: string;
  sections?: string[];
  ctaCount?: number;
}
```

### Example

```json
{
  "type": "UIFContract",
  "schemaVersion": "0.3",
  "kind": "react:component",
  "description": "Button component for user interactions",
  "version": {
    "variables": ["count"],
    "hooks": ["useState"],
    "components": ["Icon"],
    "functions": ["handleClick"]
  },
  "logicSignature": {
    "props": {
      "onClick": {
        "type": "function",
        "signature": "() => void"
      },
      "label": {
        "type": "string",
        "optional": false
      }
    },
    "events": {},
    "state": {
      "isLoading": {
        "type": "boolean"
      }
    }
  },
  "semanticHash": "uif:1a27d0944bbaaf561ee05a01",
  "fileHash": "uif:1f0fa0e2c8958d7fc1696036"
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"UIFContract"` | ✅ | Contract type identifier |
| `schemaVersion` | `"0.3"` | ✅ | Schema version for compatibility |
| `kind` | `string` | ✅ | Component type (react:component, react:hook, etc.) |
| `description` | `string` | ❌ | Human-readable description |
| `version` | `object` | ✅ | Structural composition |
| `version.variables` | `string[]` | ✅ | Named variables in component |
| `version.hooks` | `string[]` | ✅ | React hooks used |
| `version.components` | `string[]` | ✅ | Child components used |
| `version.functions` | `string[]` | ✅ | Named functions defined |
| `logicSignature` | `object` | ✅ | Public API contract |
| `logicSignature.props` | `object` | ✅ | Component props |
| `logicSignature.events` | `object` | ✅ | Component events |
| `logicSignature.state` | `object` | ✅ | Component state |
| `exports` | `string \| object` | ❌ | Export metadata: `"default"`, `"named"`, or `{ named: string[] }` |
| `style` | `StyleMetadata` | ❌ | Style metadata (only when `--include-style` is used) |
| `semanticHash` | `string` | ✅ | Logic-based hash (uif:...) |
| `fileHash` | `string` | ✅ | Content-based hash (uif:...) |

### Style Metadata (Optional)

The `style` field is only included when using `stamp context style` or `stamp context --include-style`. It provides visual and layout information extracted from components.

#### Style Sources (`style.styleSources`)

Identifies which styling approaches are used:

- **`tailwind`** - Tailwind CSS utility classes, categorized by type (layout, spacing, colors, typography, borders, effects) with breakpoint information
- **`scssModule`** / **`cssModule`** - Path to imported SCSS/CSS module file
- **`scssDetails`** / **`cssDetails`** - Parsed details from style files (selectors, properties, SCSS features)
- **`inlineStyles`** - Boolean indicating `style={{...}}` usage
- **`styledComponents`** - Styled-components/Emotion usage with component names and theme information
- **`motion`** - Framer Motion usage with components, variants, and feature flags
- **`materialUI`** - Material UI usage with components, packages, and styling features (theme, sx prop, styled, makeStyles, system props)

#### Layout Metadata (`style.layout`)

Structural layout information:

- **`type`** - Layout type: "flex", "grid", "relative", or "absolute"
- **`cols`** - Grid column pattern (e.g., "grid-cols-2 md:grid-cols-3")
- **`hasHeroPattern`** - Boolean indicating hero section pattern (large text + CTA buttons)
- **`hasFeatureCards`** - Boolean indicating feature card grid pattern
- **`sections`** - Array of identified page sections

#### Visual Metadata (`style.visual`)

Visual design patterns:

- **`colors`** - Array of color utility classes (sorted, limited to top 10)
- **`spacing`** - Array of spacing utility classes (sorted, limited to top 10)
- **`radius`** - Most common border radius pattern
- **`typography`** - Array of typography classes (sorted, limited to top 10)

#### Animation Metadata (`style.animation`)

Animation and motion information:

- **`library`** - Animation library: "framer-motion" or "css"
- **`type`** - Animation type (e.g., "fade-in", "slide")
- **`trigger`** - Trigger type (e.g., "inView", "hover", "click")

#### Page Layout Metadata (`style.pageLayout`)

Page-level layout information:

- **`pageRole`** - Page role (e.g., "landing", "dashboard")
- **`sections`** - Array of page sections
- **`ctaCount`** - Number of call-to-action elements

**Note:** Style metadata is only included when style information is detected. Components without style usage will not have a `style` field.

See [style.md](./cli/style.md) for comprehensive documentation on style metadata extraction.

## LogicStampBundle Schema

LLM context bundle containing a dependency graph and contracts.

### Schema Version: `0.1`

```typescript
interface LogicStampBundle {
  $schema?: string;  // Optional JSON Schema reference
  position?: string; // Human-readable position (e.g., "1/5")
  type: "LogicStampBundle";
  schemaVersion: "0.1";
  entryId: string;   // Path to root component
  depth: number;    // Dependency traversal depth
  createdAt: string; // ISO 8601 timestamp
  bundleHash: string; // Format: "uifb:..." (24 hex chars)
  graph: {
    nodes: BundleNode[];
    edges: BundleEdge[];
  };
  meta: {
    missing: MissingDependency[];
    source: string;  // Tool version (e.g., "logicstamp-context@0.2.6")
  };
}

interface BundleNode {
  entryId: string;
  contract: UIFContract;
  codeHeader?: string; // @uif header block (if --include-code header)
}

interface BundleEdge {
  [0]: string; // Source entryId
  [1]: string; // Target entryId
}

interface MissingDependency {
  name: string;
  reason: "external package" | "file not found" | "outside scan path" | "max depth exceeded" | "circular dependency";
  referencedBy: string; // Component that imports it
}
```

### Example

```json
{
  "$schema": "https://logicstamp.dev/schemas/context/v0.1.json",
  "position": "1/5",
  "type": "LogicStampBundle",
  "schemaVersion": "0.1",
  "entryId": "src/components/Button.tsx",
  "depth": 1,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "bundleHash": "uifb:abc123e4f99aa01deef02bb1",
  "graph": {
    "nodes": [
      {
        "entryId": "src/components/Button.tsx",
        "contract": {
          "type": "UIFContract",
          "schemaVersion": "0.3",
          "kind": "react:component",
          "description": "Button component",
          "version": {
            "variables": [],
            "hooks": ["useState"],
            "components": [],
            "functions": ["Button"]
          },
          "logicSignature": {
            "props": {
              "onClick": {
                "type": "function",
                "signature": "() => void"
              }
            },
            "events": {},
            "state": {}
          },
          "exports": "default",
          "semanticHash": "uif:1a27d0944bbaaf561ee05a01",
          "fileHash": "uif:1f0fa0e2c8958d7fc1696036",
          "style": {
            "styleSources": {
              "tailwind": {
                "categories": {
                  "layout": ["flex", "flex-col", "items-center"],
                  "spacing": ["py-4", "px-6", "gap-2"],
                  "colors": ["bg-blue-500", "text-white"],
                  "typography": ["text-lg", "font-semibold"]
                },
                "breakpoints": ["md", "lg"],
                "classCount": 8
              },
              "materialUI": {
                "components": ["Button"],
                "packages": ["@mui/material"],
                "features": {
                  "usesSxProp": true
                }
              }
            },
            "layout": {
              "type": "flex",
              "hasHeroPattern": false
            },
            "visual": {
              "colors": ["bg-blue-500", "text-white"],
              "spacing": ["py-4", "px-6"],
              "radius": "md"
            }
          }
        },
        "codeHeader": "/** @uif Contract ... */"
      }
    ],
    "edges": []
  },
  "meta": {
    "missing": [
      {
        "name": "@mui/material",
        "reason": "external package",
        "referencedBy": "src/components/Button.tsx"
      }
    ],
    "source": "logicstamp-context@0.2.6"
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$schema` | `string` | ❌ | JSON Schema reference URL |
| `position` | `string` | ❌ | Human-readable position (e.g., "1/5") |
| `type` | `"LogicStampBundle"` | ✅ | Bundle type identifier |
| `schemaVersion` | `"0.1"` | ✅ | Schema version |
| `entryId` | `string` | ✅ | Path to root component |
| `depth` | `number` | ✅ | Dependency traversal depth used |
| `createdAt` | `string` | ✅ | ISO 8601 timestamp |
| `bundleHash` | `string` | ✅ | Bundle-level hash (uifb:...) |
| `graph` | `object` | ✅ | Dependency graph |
| `graph.nodes` | `BundleNode[]` | ✅ | Components in bundle |
| `graph.edges` | `BundleEdge[]` | ✅ | Dependencies between components |
| `meta` | `object` | ✅ | Bundle metadata |
| `meta.missing` | `MissingDependency[]` | ✅ | Unresolved dependencies |
| `meta.source` | `string` | ✅ | Tool version string |

## LogicStampIndex Schema

Main index file for multi-file context organization.

### Schema Version: `0.1`

```typescript
interface LogicStampIndex {
  type: "LogicStampIndex";
  schemaVersion: "0.1";
  projectRoot: string;              // Relative path (usually ".")
  projectRootResolved: string;      // Absolute path
  createdAt: string;                // ISO 8601 timestamp
  summary: {
    totalComponents: number;
    totalBundles: number;
    totalFolders: number;
    totalTokenEstimate: number;
  };
  folders: FolderEntry[];
  meta: {
    source: string;  // Tool version
  };
}

interface FolderEntry {
  path: string;                    // Relative path from project root
  contextFile: string;             // Path to this folder's context.json
  bundles: number;                 // Number of bundles in this folder
  components: string[];           // Component file names
  isRoot: boolean;                // Whether this is an entry point
  rootLabel?: string;             // Label for root folders
  tokenEstimate: number;          // Estimated token count
}
```

### Example

```json
{
  "type": "LogicStampIndex",
  "schemaVersion": "0.1",
  "projectRoot": ".",
  "projectRootResolved": "/absolute/path/to/project",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "summary": {
    "totalComponents": 42,
    "totalBundles": 15,
    "totalFolders": 5,
    "totalTokenEstimate": 13895
  },
  "folders": [
    {
      "path": "src/components",
      "contextFile": "src/components/context.json",
      "bundles": 3,
      "components": ["Button.tsx", "Card.tsx"],
      "isRoot": false,
      "tokenEstimate": 5234
    },
    {
      "path": ".",
      "contextFile": "context.json",
      "bundles": 2,
      "components": ["App.tsx"],
      "isRoot": true,
      "rootLabel": "Project Root",
      "tokenEstimate": 2134
    }
  ],
  "meta": {
    "source": "logicstamp-context@0.2.6"
  }
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"LogicStampIndex"` | ✅ | Index type identifier |
| `schemaVersion` | `"0.1"` | ✅ | Schema version |
| `projectRoot` | `string` | ✅ | Relative project root path |
| `projectRootResolved` | `string` | ✅ | Absolute project root path |
| `createdAt` | `string` | ✅ | ISO 8601 timestamp |
| `summary` | `object` | ✅ | Project-wide statistics |
| `summary.totalComponents` | `number` | ✅ | Total components analyzed |
| `summary.totalBundles` | `number` | ✅ | Total bundles generated |
| `summary.totalFolders` | `number` | ✅ | Total folders with context files |
| `summary.totalTokenEstimate` | `number` | ✅ | Estimated total tokens |
| `folders` | `FolderEntry[]` | ✅ | Folder metadata entries |
| `folders[].path` | `string` | ✅ | Relative folder path |
| `folders[].contextFile` | `string` | ✅ | Path to folder's context.json |
| `folders[].bundles` | `number` | ✅ | Number of bundles in folder |
| `folders[].components` | `string[]` | ✅ | Component file names |
| `folders[].isRoot` | `boolean` | ✅ | Whether folder is entry point |
| `folders[].rootLabel` | `string` | ❌ | Label for root folders |
| `folders[].tokenEstimate` | `number` | ✅ | Estimated tokens for folder |
| `meta` | `object` | ✅ | Index metadata |
| `meta.source` | `string` | ✅ | Tool version string |

## Hash Formats

All hashes in LogicStamp follow consistent formats:

### Semantic Hash (`semanticHash`)
- **Format:** `uif:` + 24 hex characters
- **Example:** `uif:1a27d0944bbaaf561ee05a01`
- **Based on:** Component logic and contract structure
- **Changes when:** Props, events, state, or structural footprint changes

### File Hash (`fileHash`)
- **Format:** `uif:` + 24 hex characters
- **Example:** `uif:1f0fa0e2c8958d7fc1696036`
- **Based on:** Raw file content (excluding @uif headers)
- **Changes when:** Any file content modification

### Bundle Hash (`bundleHash`)
- **Format:** `uifb:` + 24 hex characters
- **Example:** `uifb:abc123e4f99aa01deef02bb1`
- **Based on:** Bundle structure (nodes, depth, schema version)
- **Changes when:** Any component's semantic hash changes, or bundle structure changes

See [hashes.md](./hashes.md) for detailed information about hash computation.

## Validation

All schemas can be validated using `stamp context validate`:

```bash
# Validate all context files (multi-file mode)
stamp context validate

# Validate a specific file
stamp context validate src/components/context.json
```

The validator checks:
- Required fields are present
- Field types match schema
- Schema versions are correct
- Hash formats are valid
- Structure matches expected shape

## Schema Evolution

Schemas are versioned to support evolution:

- **Major version changes** – Breaking changes requiring migration
- **Minor version changes** – New optional fields, backward compatible
- **Patch version changes** – Bug fixes, fully backward compatible

When schema versions change:
- Old versions remain supported for reading
- New versions are generated for writing
- Validation warns on unexpected versions

## JSON Schema References

LogicStamp bundles can include `$schema` references for IDE validation:

```json
{
  "$schema": "https://logicstamp.dev/schemas/context/v0.1.json",
  "type": "LogicStampBundle",
  // ...
}
```

This enables:
- IDE autocomplete and validation
- JSON Schema validation tools
- Type checking in editors

## See Also

- [uif_contracts.md](./uif_contracts.md) – Detailed UIF contract documentation
- [hashes.md](./hashes.md) – Hash computation and formats
- [validate.md](./cli/validate.md) – Schema validation guide
- [usage.md](./usage.md) – How to generate context files

