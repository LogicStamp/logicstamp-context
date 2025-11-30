# UIF Contracts

UIF (Unified Interface Format) contracts are machine-readable descriptions of your React/TypeScript components that capture their structure, behavior, and API. LogicStamp extracts these contracts from your codebase to enable semantic change detection, AI context generation, and contract verification.

## What is a UIF Contract?

A UIF contract is a structured representation of a component that includes:

- **Structural footprint** – Variables, hooks, components, and functions used
- **Logic signature** – Props, events, and state that define the component's API
- **Semantic hash** – Unique identifier based on the component's logic (not implementation details)
- **File hash** – Content-based hash for change detection

Contracts are extracted automatically from your TypeScript/React files and embedded in LogicStamp bundles.

## Contract Structure

Each UIF contract follows the `UIFContract` schema (version `0.3`):

```json
{
  "type": "UIFContract",
  "schemaVersion": "0.3",
  "kind": "react:component",
  "description": "Component description from JSDoc",
  "version": {
    "variables": ["count", "isOpen"],
    "hooks": ["useState", "useEffect"],
    "components": ["Button", "Card"],
    "functions": ["handleClick", "validate"]
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
    "events": {
      "onSubmit": {
        "type": "function",
        "signature": "(data: FormData) => void"
      }
    },
    "state": {
      "isLoading": {
        "type": "boolean"
      }
    }
  },
  "exports": { "named": ["Button", "ButtonProps"] },
  "semanticHash": "uif:1a27d0944bbaaf561ee05a01",
  "fileHash": "uif:1f0fa0e2c8958d7fc1696036"
}
```

## Contract Fields

### `type`
Always `"UIFContract"` to identify the contract type.

### `schemaVersion`
Schema version string (currently `"0.3"`). Used for compatibility checking and validation.

### `kind`
Component type identifier:
- `"react:component"` – React functional component
- `"react:hook"` – Custom React hook
- `"typescript:module"` – TypeScript module/utility

### `description`
Human-readable description extracted from JSDoc comments or inferred from the component name.

### `version`
Structural composition of the component:

| Field | Type | Description |
|-------|------|-------------|
| `variables` | `string[]` | Named variables declared in the component |
| `hooks` | `string[]` | React hooks used (useState, useEffect, etc.) |
| `components` | `string[]` | Child components imported and used |
| `functions` | `string[]` | Named functions defined in the component |

**Note:** This captures the structural footprint, not implementation details. Adding a new hook or function changes the version.

### `logicSignature`
The public API contract of the component:

#### `props`
Object mapping prop names to their type information:
- `type` – TypeScript type (e.g., `"string"`, `"number"`, `"function"`)
- `signature` – Function signature for function props (e.g., `"() => void"`)
- `optional` – Boolean indicating if the prop is optional

#### `events`
Object mapping event names to their signatures. For React components, these are typically callback props that represent events.

#### `state`
Object mapping state variable names to their types. Represents the component's internal state structure.

### `exports` (optional)
Export metadata indicating how the component/module is exported from the file:

- `"default"` – File has a default export
- `"named"` – File has a single named export
- `{ named: string[] }` – File has multiple named exports (array contains all exported names)

This metadata is used to improve dependency tracking accuracy by distinguishing between internal components (defined in the same file) and external dependencies.

**Example:**
```json
{
  "exports": { "named": ["Button", "ButtonProps", "useButton"] }
}
```

### `style` (optional)
Style metadata extracted from the component. This field is only present when style extraction is enabled (via `stamp context style` or `--include-style` flag). Contains visual, layout, and animation information to enable design-aware AI context generation.

The `style` field contains four categories of metadata:

#### `styleSources`
Identifies which styling approaches are used in the component:

- **`tailwind`** – Tailwind CSS utility classes:
  - `categories` – Object mapping category names (e.g., "layout", "spacing", "colors", "typography") to arrays of class names
  - `breakpoints` – Array of responsive breakpoints used (e.g., `["sm", "md", "lg"]`)
  - `classCount` – Total number of Tailwind classes detected

- **`scssModule`** – Path to imported SCSS module file (if any)
- **`scssDetails`** – Parsed SCSS module information:
  - `selectors` – Array of CSS selectors found in the SCSS file
  - `properties` – Array of CSS properties used
  - `features` – Object indicating SCSS features used:
    - `variables` – Boolean if SCSS variables are used
    - `nesting` – Boolean if SCSS nesting is used
    - `mixins` – Boolean if SCSS mixins are used

- **`cssModule`** – Path to imported CSS module file (if any)
- **`cssDetails`** – Parsed CSS module information:
  - `selectors` – Array of CSS selectors
  - `properties` – Array of CSS properties

- **`inlineStyles`** – Boolean indicating if inline styles (`style={{...}}`) are used

- **`styledComponents`** – Styled-components/Emotion information:
  - `components` – Array of styled component names (e.g., `["div", "Button"]`)
  - `usesTheme` – Boolean if theme is used
  - `usesCssProp` – Boolean if CSS prop is used

- **`motion`** – Framer Motion animation information:
  - `components` – Array of motion component names (e.g., `["div", "button"]`)
  - `variants` – Array of variant names used
  - `features` – Object indicating motion features:
    - `gestures` – Boolean if gesture handlers are used (whileHover, whileTap, etc.)
    - `layoutAnimations` – Boolean if layout animations are used
    - `viewportAnimations` – Boolean if viewport-triggered animations are used

- **`materialUI`** – Material UI component library information:
  - `components` – Array of Material UI component names used (e.g., `["Button", "TextField", "Card"]`)
  - `packages` – Array of Material UI packages imported (e.g., `["@mui/material", "@mui/icons-material"]`)
  - `features` – Object indicating Material UI styling features:
    - `usesTheme` – Boolean if theme is used (useTheme, ThemeProvider, createTheme)
    - `usesSxProp` – Boolean if sx prop is used for styling
    - `usesStyled` – Boolean if styled from @mui/material/styles is used
    - `usesMakeStyles` – Boolean if makeStyles (legacy) is used
    - `usesSystemProps` – Boolean if system props are used on Box/Stack components

#### `layout`
Structural layout information:
- `type` – Layout type: `"flex"`, `"grid"`, `"relative"`, or `"absolute"`
- `cols` – Grid column pattern (e.g., `"grid-cols-2 md:grid-cols-3"`)
- `hasHeroPattern` – Boolean indicating hero section pattern
- `hasFeatureCards` – Boolean indicating feature card grid pattern
- `sections` – Array of section identifiers (if applicable)

#### `visual`
Visual design patterns:
- `colors` – Array of color utility classes (sorted, limited to top 10)
- `spacing` – Array of spacing utility classes (sorted, limited to top 10)
- `radius` – Most common border radius pattern
- `typography` – Array of typography classes (sorted, limited to top 10)

#### `animation`
Animation and motion information:
- `type` – Animation type (e.g., `"fade-in"`, `"slide"`)
- `library` – Animation library: `"framer-motion"` or `"css"`
- `trigger` – Trigger type: `"inView"`, `"hover"`, `"click"`, etc.

#### `pageLayout` (optional)
Page-level layout metadata:
- `pageRole` – Page role identifier (if applicable)
- `sections` – Array of page section identifiers
- `ctaCount` – Number of call-to-action elements

**Example style metadata:**

```json
{
  "style": {
    "styleSources": {
      "tailwind": {
        "categories": {
          "layout": ["flex", "flex-col", "items-center"],
          "spacing": ["py-16", "px-8", "gap-4"],
          "colors": ["bg-black", "text-white"],
          "typography": ["text-4xl", "font-semibold"]
        },
        "breakpoints": ["md", "lg"],
        "classCount": 15
      },
      "motion": {
        "components": ["div"],
        "variants": ["fadeIn", "slideUp"],
        "features": {
          "gestures": true,
          "viewportAnimations": true
        }
      },
      "materialUI": {
        "components": ["Button", "TextField", "Card"],
        "packages": ["@mui/material"],
        "features": {
          "usesTheme": true,
          "usesSxProp": true,
          "usesSystemProps": true
        }
      }
    },
    "layout": {
      "type": "flex",
      "hasHeroPattern": true
    },
    "visual": {
      "colors": ["bg-black", "text-white"],
      "spacing": ["py-16", "px-8"],
      "radius": "xl",
      "typography": ["text-4xl", "font-semibold"]
    },
    "animation": {
      "library": "framer-motion",
      "type": "fade-in",
      "trigger": "inView"
    }
  }
}
```

**Note:** Style metadata is only included when:
1. Style extraction is enabled (`stamp context style` or `--include-style`)
2. Style information is detected in the component
3. Components without any style usage will not have a `style` field

See [style.md](./cli/style.md) for detailed documentation on style extraction.

### `semanticHash`
Unique hash based on the component's logic and contract. Changes when:
- Props are added/removed/renamed
- Events change
- State structure changes
- Structural footprint changes (hooks, components, functions)

Does **not** change for:
- Comments
- Whitespace/formatting
- Implementation details that don't affect the contract

See [hashes.md](./hashes.md) for detailed information about semantic hashes.

### `fileHash`
Content-based hash of the raw file. Changes for any file modification. Used to validate that a stored contract still matches the actual file.

See [hashes.md](./hashes.md) for detailed information about file hashes.

## @uif Header Blocks

LogicStamp can extract contracts from JSDoc `@uif` header blocks in your source files. This allows you to provide explicit contract information or override automatic extraction.

### Basic Format

```typescript
/**
 * @uif Contract
 * @description Button component for user interactions
 * @kind react:component
 */
export function Button({ onClick, label }: ButtonProps) {
  // ...
}
```

### Including Contract Headers in Context

When generating context with `--include-code header`, LogicStamp includes the `@uif` header block in the bundle:

```json
{
  "entryId": "src/components/Button.tsx",
  "contract": {
    "type": "UIFContract",
    "schemaVersion": "0.3",
    "kind": "react:component",
    "description": "Button component for user interactions",
    // ... rest of contract
  },
  "codeHeader": "/**\n * @uif Contract\n * @description Button component for user interactions\n * @kind react:component\n */"
}
```

**Use cases:**
- Provide explicit contract documentation
- Override automatic contract extraction
- Include contract metadata in AI context without full source

## Contract Extraction

LogicStamp automatically extracts contracts from TypeScript/React files by:

1. **Parsing the AST** – Analyzes the abstract syntax tree to understand structure
2. **Extracting types** – Reads TypeScript type information for props, state, and events
3. **Identifying dependencies** – Detects hooks, components, and functions used
4. **Computing hashes** – Generates semantic and file hashes

### Automatic Detection

Contracts are extracted automatically for:
- React functional components (`.tsx` files)
- Custom React hooks (files with `use` prefix)
- TypeScript modules (`.ts` files)

### Manual Override

Use `@uif` header blocks to provide explicit contract information or override automatic extraction.

## What Changes a Contract?

### Changes `semanticHash` (meaningful changes)

- Adding/removing/renaming props
- Changing prop types
- Adding/removing events
- Changing state structure
- Adding/removing hooks
- Adding/removing child components
- Adding/removing named functions

### Does Not Change `semanticHash` (cosmetic changes)

- Comments
- Whitespace/formatting
- Implementation details inside functions
- Variable names (unless they're part of the public API)
- Internal logic refactors that don't affect props/events/state

### Always Changes `fileHash`

- Any file content modification
- Including cosmetic changes

## Contract Verification

Use `stamp context validate` to verify that contracts in your context files match the expected schema:

```bash
# Validate all context files
stamp context validate

# Validate a specific file
stamp context validate src/components/context.json
```

The validator checks:
- Contract structure matches `UIFContract` schema
- Schema version is `0.3`
- Required fields are present
- Hash formats are correct

## Contract Comparison

Use `stamp context compare` to detect contract changes across your project:

```bash
# Compare all context files
stamp context compare

# Compare two specific files
stamp context compare old.json new.json
```

The compare command detects:
- **Changed contracts** – Components with modified semantic hashes
- **Added contracts** – New components
- **Removed contracts** – Deleted components

## Integration with Bundles

Contracts are embedded within LogicStamp bundles:

```json
{
  "type": "LogicStampBundle",
  "schemaVersion": "0.1",
  "entryId": "src/components/Button.tsx",
  "graph": {
    "nodes": [
      {
        "entryId": "src/components/Button.tsx",
        "contract": {
          "type": "UIFContract",
          "schemaVersion": "0.3",
          // ... contract data
        }
      }
    ],
    "edges": []
  }
}
```

Each node in a bundle's dependency graph contains a contract for that component.

## Best Practices

1. **Keep contracts stable** – Avoid unnecessary changes to props, events, or state structure
2. **Use semantic hashes** – Rely on `semanticHash` to detect meaningful changes, not `fileHash`
3. **Document with @uif** – Use `@uif` header blocks for explicit contract documentation
4. **Validate regularly** – Run `stamp context validate` to catch schema drift
5. **Compare before commits** – Use `stamp context compare` to review contract changes

## See Also

- [hashes.md](./hashes.md) – Detailed information about semantic and file hashes
- [schema.md](./schema.md) – Complete schema reference for all LogicStamp types
- [usage.md](./usage.md) – How to generate and use context files with contracts
- [validate.md](./cli/validate.md) – Contract validation guide

