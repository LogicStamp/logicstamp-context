# UIF Contracts

UIF (Unified Interface Format) contracts are machine-readable descriptions of your TypeScript components (React, Vue, Express, NestJS) that capture their structure, behavior, and API. LogicStamp extracts these contracts from your codebase to enable semantic change detection, AI context compilation, and contract verification.

## What is a UIF Contract?

A UIF contract is a structured representation of a component that includes:

- **Structural footprint** – Variables, hooks, components, and functions used
- **Logic signature** – Props, events, and state that define the component's API
- **Semantic hash** – Unique identifier based on the component's logic (not implementation details)
- **File hash** – Content-based hash for change detection

Contracts are extracted automatically from your TypeScript files and embedded in LogicStamp bundles.

## Contract Structure

Each UIF contract follows the `UIFContract` schema (version `0.4`):

```json
{
  "type": "UIFContract",
  "schemaVersion": "0.4",
  "kind": "react:component",
  "description": "Component description from JSDoc",
  "composition": {
    "variables": ["count", "isOpen"],
    "hooks": ["useState", "useEffect"],
    "components": ["Button", "Card"],
    "functions": ["handleClick", "validate"]
  },
  "interface": {
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
    "emits": {
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
Schema version string (currently `"0.4"`). Used for compatibility checking and validation.

### `kind`
Component type identifier:
- `"react:component"` – React functional component
- `"react:hook"` – Custom React hook
- `"vue:component"` – Vue component (Composition API)
- `"vue:composable"` – Vue composable (reusable composition function)
- `"ts:module"` – TypeScript module/utility
- `"node:cli"` – Node.js CLI script

### `description`
Human-readable description extracted from JSDoc comments or inferred from the component name.

### `composition`
Structural composition of the component:

| Field | Type | Description |
|-------|------|-------------|
| `variables` | `string[]` | Named variables declared in the component |
| `hooks` | `string[]` | React hooks used (useState, useEffect, etc.) |
| `components` | `string[]` | Child components imported and used |
| `functions` | `string[]` | Named functions defined in the component |

**Note:** This captures the structural footprint, not implementation details. Adding a new hook or function changes the composition.

### `interface`
The public API contract of the component:

#### `props`
Object mapping prop names to their type information:
- `type` – TypeScript type (e.g., `"string"`, `"number"`, `"function"`)
- `signature` – Function signature for function props (e.g., `"() => void"`)
- `optional` – Boolean indicating if the prop is optional

#### `emits`
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
Style metadata extracted from the component. This field is only present when style extraction is enabled (via `stamp context style` or `--include-style`). It can include library-specific `styleSources`, structural `layout` / `visual` hints, high-level `animation`, and a **`summary`** of what was detected. The JSON schema also allows **`pageLayout`**, but **`stamp context` does not populate it yet** (reserved for future extraction).

**Style mode (`--style-mode`):** Serialization is **`lean` by default** (compact: counts, flags, and category names; large arrays omitted). **`full`** keeps verbose arrays and lists. Extraction logic is the same in both modes; only the JSON shape changes. Use `stamp context style --style-mode full` (or `stamp context --include-style --style-mode full`) for the verbose shape. See [Style mode: lean vs full](../cli/style.md#style-mode-lean-vs-full).

The `style` object may contain:

#### `summary`
Present when style metadata is emitted for the component.

- `mode` – `"lean"` or `"full"` (matches the CLI flag used when generating)
- `sources` – List of detected style kinds (e.g. `tailwind`, `scss`, `material-ui`, `chakra`, `framer-motion`, `styled-components`, `shadcn`, `radix`, `antd`)

In **`lean`** mode, when applicable:

- `fullModeBytes` – Approximate serialized size (bytes) of the **full-mode** `styleSources` object for the same file (for comparing verbosity vs token cost)

#### `styleSources`
Identifies which styling approaches are used in the component. Fields below note **full** vs **lean** where they differ.

- **`tailwind`** – Tailwind CSS utility classes:
  - **Full:** `categories` – Object mapping category names (e.g. `"layout"`, `"spacing"`, `"colors"`) to sorted arrays of class names (capped per category in extraction)
  - **Lean:** `categoriesUsed` – Array of category keys that had classes (no per-class arrays)
  - `breakpoints` – Breakpoint names (both modes, when present)
  - `classCount` – Total distinct classes collected (both modes)

- **`scssModule`** – Path to imported SCSS module file (if any; both modes)
- **`scssDetails`** – Parsed SCSS module information:
  - **Full:** `selectors`, `properties`, and `features` (`variables`, `nesting`, `mixins`)
  - **Lean:** `features` only (same flags; no `selectors` / `properties` arrays)

- **`cssModule`** – Path to imported CSS module file (if any; both modes)
- **`cssDetails`** – **Full mode only:** `selectors`, `properties`. Omitted in **lean** (module path still appears on `cssModule`).

- **`inlineStyles`** – Inline `style={{...}}` usage. Can be `boolean` (legacy) or an object with `properties` and optional `values`. **Same shape in lean and full** (already compact).

- **`styledJsx`** – Styled JSX (`<style jsx>`) extraction:
  - **Full:** `css`, `global`, `selectors`, `properties`
  - **Lean:** `global`, `selectorCount`, `propertyCount` (no `css` string or selector/property arrays)

- **`styledComponents`** – Styled-components / Emotion:
  - **Full:** `components` (sorted, capped), `usesTheme`, `usesCssProp`
  - **Lean:** `componentCount`, `usesTheme`, `usesCssProp`

- **`motion`** – Framer Motion (`style.styleSources.motion`, distinct from high-level `style.animation`):
  - **Full:** `components`, `variants`, `features` (`gestures`, `layoutAnimations`, `viewportAnimations`)
  - **Lean:** `features` only

- **`materialUI`** – Material UI:
  - **Full:** `components`, `packages`, `features` (`usesTheme`, `usesSxProp`, `usesStyled`, `usesMakeStyles`, `usesSystemProps`)
  - **Lean:** `features` only

- **`antd`** – Ant Design:
  - **Full:** `components`, `packages`, `features` (`usesTheme`, `usesConfigProvider`, `usesForm`, `usesLocale`, `usesIcons`)
  - **Lean:** `features` only

- **`chakraUI`** – Chakra UI:
  - **Full:** `components`, `packages`, `features` (`usesTheme`, `usesColorMode`, `usesResponsiveProps`, `usesSystemProps`)
  - **Lean:** `features` only

- **`shadcnUI`** – ShadCN/UI:
  - **Full:** `components`, `variants`, `sizes`, `features` (`usesForm`, `usesTheme`, `usesIcons`, `componentDensity`)
  - **Lean:** `features` only

- **`radixUI`** – Radix UI:
  - **Full:** `primitives`, `patterns` (`controlled`, `uncontrolled`, `portals`, `asChild`), `accessibility`, `features` (`primitiveCount`, `compositionDepth`)
  - **Lean:** `accessibility` and `features` only (`primitives` / `patterns` omitted)

#### `layout`
Structural layout information:

- `type`, `cols`, `hasHeroPattern`, `hasFeatureCards` – Both modes when present
- **Full:** `sections` – Array of section identifiers
- **Lean:** `sectionCount` instead of `sections` when sections were detected

#### `visual`
Visual design patterns:

- `radius` – Both modes when present
- **Full:** `colors`, `spacing`, `typography` arrays (sorted, capped in extraction)
- **Lean:** `colorCount`, `spacingCount`, `typographyCount` instead of those arrays

#### `animation`
High-level animation hints (e.g. fade-in, library, trigger). **Not** trimmed by style mode in the same way as `styleSources.motion`; shape is unchanged between lean and full when present.

- `type` – Animation type (e.g., `"fade-in"`, `"slide"`)
- `library` – `"framer-motion"` or `"css"`
- `trigger` – e.g. `"inView"`, `"hover"`, `"click"`

#### `pageLayout` (optional, schema only today)
**Not emitted by the current CLI.** The field exists on `StyleMetadata` and in the JSON schema so validated documents may include it or future extractors can populate it without a breaking schema change. Intended shape when used:

- `pageRole` – Page role (e.g. landing, dashboard)
- `sections` – Page section identifiers
- `ctaCount` – Number of call-to-action elements

**Example (`--style-mode full`):** Combined illustration only; real contracts include a subset of keys.

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
      },
      "antd": {
        "components": ["Button", "Card", "Form", "Input", "Table"],
        "packages": ["antd", "@ant-design/icons"],
        "features": {
          "usesTheme": true,
          "usesConfigProvider": true,
          "usesForm": true,
          "usesLocale": true,
          "usesIcons": true
        }
      },
      "chakraUI": {
        "components": ["Button", "Card", "Box", "Stack", "Input"],
        "packages": ["@chakra-ui/react"],
        "features": {
          "usesTheme": true,
          "usesColorMode": true,
          "usesResponsiveProps": true,
          "usesSystemProps": true
        }
      },
      "shadcnUI": {
        "components": ["Button", "Card", "Dialog"],
        "variants": {
          "button": ["default", "outline"],
          "badge": ["secondary"]
        },
        "sizes": ["sm", "lg"],
        "features": {
          "usesForm": true,
          "usesTheme": true,
          "usesIcons": true,
          "componentDensity": "medium"
        }
      },
      "radixUI": {
        "primitives": {
          "react-dialog": ["Dialog", "DialogTrigger", "DialogContent"],
          "react-popover": ["Popover", "PopoverTrigger"]
        },
        "patterns": {
          "controlled": ["Dialog"],
          "uncontrolled": [],
          "portals": 2,
          "asChild": 1
        },
        "accessibility": {
          "usesFocusManagement": true,
          "usesModal": true
        },
        "features": {
          "primitiveCount": 5,
          "compositionDepth": "moderate"
        }
      }
    },
    "layout": {
      "type": "flex",
      "hasHeroPattern": true,
      "sections": ["hero", "features"]
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
    },
    "summary": {
      "mode": "full",
      "sources": ["tailwind", "framer-motion", "material-ui"]
    }
  }
}
```

**Example (`--style-mode lean`, default):** Same file would omit verbose arrays and include `summary.mode` / optional `fullModeBytes`:

```json
{
  "style": {
    "styleSources": {
      "tailwind": {
        "classCount": 15,
        "categoriesUsed": ["layout", "spacing", "colors", "typography"],
        "breakpoints": ["md", "lg"]
      },
      "motion": {
        "features": {
          "gestures": true,
          "viewportAnimations": true
        }
      },
      "materialUI": {
        "features": {
          "usesTheme": true,
          "usesSxProp": true,
          "usesSystemProps": true
        }
      }
    },
    "layout": {
      "type": "flex",
      "hasHeroPattern": true,
      "sectionCount": 2
    },
    "visual": {
      "colorCount": 2,
      "spacingCount": 2,
      "radius": "xl",
      "typographyCount": 2
    },
    "animation": {
      "library": "framer-motion",
      "type": "fade-in",
      "trigger": "inView"
    },
    "summary": {
      "mode": "lean",
      "sources": ["tailwind", "framer-motion", "material-ui"],
      "fullModeBytes": 1840
    }
  }
}
```

**Note:** Style metadata is only included when:

1. Style extraction is enabled (`stamp context style` or `--include-style`)
2. Style information is detected in the component
3. Components without any style usage will not have a `style` field

See [style.md](../cli/style.md) (especially [Style mode: lean vs full](../cli/style.md#style-mode-lean-vs-full)) for CLI flags and extraction behavior.

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
    "schemaVersion": "0.4",
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

LogicStamp automatically extracts contracts from TypeScript files by:

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
- Schema version is `0.4`
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
          "schemaVersion": "0.4",
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
- [usage.md](../guides/usage.md) – How to generate and use context files with contracts
- [validate.md](../cli/validate.md) – Contract validation guide

