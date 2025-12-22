# `stamp context style` Command

Generate context bundles that include style metadata. This extracts visual and layout info from your React components so AI assistants can understand your design.

```bash
stamp context style [path] [options]
```

- `[path]` (optional) – Directory to scan. Defaults to the current working directory. Paths can be relative (`./src`) or absolute.

**Note:** The `stamp context style` command is equivalent to `stamp context --include-style`. Both syntaxes produce identical output.

**File Exclusion:** `stamp context style` respects `.stampignore`, just like `stamp context`. `.stampignore` is completely optional and independent of security scanning. See [stampignore.md](../stampignore.md) for details.

## Overview

`stamp context style` adds visual and layout info on top of the component logic and structure that `stamp context` extracts. This lets AI assistants:

- Understand the visual design of components
- Suggest visually consistent components
- Analyze layout patterns (flex, grid, responsive breakpoints)
- Track color palettes and spacing patterns
- Identify animation and motion usage

## What It Extracts

It extracts four types of metadata:

### 1. Style Sources

Identifies which styling approaches are used in each component:

- **Tailwind CSS** – Extracts and categorizes utility classes:
  - Layout (flex, grid, block, container)
  - Spacing (padding, margin, gap utilities)
  - Sizing (width, height, min/max constraints)
  - Typography (text size, font weight, line height)
  - Colors (background, text, border colors)
  - Borders (border styles, radius)
  - Effects (shadows, opacity, filters)
  - Transitions and animations
  - Responsive breakpoints (sm, md, lg, xl, 2xl)

- **SCSS/CSS Modules** – Detects module imports from TSX/TS files and parses the imported style files using AST-based parsing (css-tree):
  - CSS selectors used (class, ID, and type selectors)
  - CSS properties defined
  - SCSS feature detection (variables, nesting, mixins as boolean flags)
  - Nested rules inside `@media`, `@supports`, `@container`, and other at-rules
  - **Note**: Only CSS/SCSS files that are imported by component files are parsed. Standalone CSS/SCSS files that aren't imported won't be analyzed.

- **Inline Styles** – Detects `style={{...}}` usage

- **styled-components/Emotion** – Identifies (via AST-based extraction):
  - Styled component declarations (`styled.div`, `styled(Component)`, `styled('div')`)
  - Theme usage (`props.theme`, `useTheme()` hook)
  - CSS prop usage (Emotion)
  - Precise import verification (only matches styled-components/Emotion, not MUI styled)

- **framer-motion** – Detects:
  - Motion components (motion.div, motion.button, etc.)
  - Animation variants
  - Gesture handlers
  - Layout animations
  - Viewport-triggered animations

- **Material UI** – Detects:
  - Material UI components used (Button, TextField, Card, etc.)
  - Material UI packages imported (@mui/material, @material-ui/core, etc.)
  - Theme usage (useTheme, ThemeProvider, createTheme)
  - sx prop usage for styling
  - styled from @mui/material/styles
  - makeStyles (legacy styling)
  - System props on Box/Stack components

- **ShadCN/UI** – Detects:
  - ShadCN/UI components used (Button, Card, Dialog, Sheet, etc.)
  - Component imports from typical ShadCN paths (@/components/ui/*, ~/components/ui/*, etc.)
  - Variant prop usage (default, destructive, outline, secondary, etc.)
  - Size prop usage (sm, lg, icon, etc.)
  - Form integration (react-hook-form)
  - Theme usage (next-themes, dark mode)
  - Icon library usage (lucide-react, @radix-ui/react-icons, react-icons)
  - Component density (low, medium, high based on component count)

- **Radix UI** – Detects:
  - Radix UI primitives used (Dialog, Popover, DropdownMenu, etc.)
  - Package imports (@radix-ui/react-*)
  - Controlled vs uncontrolled component patterns
  - Portal usage for overlays
  - asChild composition pattern
  - Accessibility features (RTL/LTR support, focus management, keyboard navigation, modal dialogs)
  - Composition depth (simple, moderate, complex)

### 2. Layout Metadata

Extracts structural layout information using AST-based analysis. All layout extraction handles variant-prefixed classes (e.g., `md:flex`, `lg:grid`) and dynamic className expressions (e.g., `className={cn('flex')}`, `className={`grid ${cols}`}`).

- **Layout Type** – Identifies flex or grid layouts (grid takes precedence if both are present)
- **Grid Patterns** – Extracts column configurations (e.g., "2 3" from "grid-cols-2 md:grid-cols-3")
- **Hero Patterns** – Detects hero sections (large text + CTA buttons)
- **Feature Cards** – Identifies grid layouts with card-like elements

### 3. Visual Metadata

Captures visual design patterns using AST-based extraction. All visual extraction handles variant-prefixed classes (e.g., `md:bg-blue-500`, `dark:text-slate-50`, `lg:px-4`).

- **Color Palette** – Extracts color classes (bg-*, text-*, border-*)
- **Spacing Patterns** – Identifies padding and margin utilities. Supports all Tailwind formats: integers (`p-4`), fractions (`p-1.5`), named (`p-px`), arbitrary (`p-[2px]`), negative (`-mt-2`)
- **Border Radius** – Detects rounded corner patterns, stores token value (e.g., "lg" from "rounded-lg"). Valid values: "default", "sm", "md", "lg", "xl", "2xl", "3xl", "full"
- **Typography** – Extracts text size and font weight classes

### 4. Animation Metadata

Identifies animation and motion usage:

- **Animation Library** – framer-motion or CSS
- **Animation Type** – fade-in, slide, etc.
- **Trigger Type** – inView, hover, click, etc.

## Options

All options from `stamp context` are supported. The style command accepts the same flags:

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--depth <n>` | `-d` | `1` | Dependency traversal depth (`0` = entry only, `1` = direct deps, etc.). |
| `--include-code <mode>` | `-c` | `header` | Include `none`, `header`, or `full` source snippets. |
| `--format <fmt>` | `-f` | `json` | Output format: `json`, `pretty`, `ndjson`. |
| `--out <file>` | `-o` | `context.json` | Output directory or file path. |
| `--max-nodes <n>` | `-m` | `100` | Maximum graph nodes per bundle. |
| `--profile <name>` | | `llm-chat` | Preset configuration (`llm-chat`, `llm-safe`, `ci-strict`). |
| `--strict` | `-s` | `false` | Fail when dependencies are missing. |
| `--predict-behavior` | | `false` | Include experimental behavioral predictions. |
| `--dry-run` | | `false` | Skip writing the output; display summary only. |
| `--stats` | | `false` | Emit single-line JSON stats (ideal for CI). |
| `--strict-missing` | | `false` | Exit with error if any missing dependencies found. |
| `--skip-gitignore` | | `false` | Skip `.gitignore` setup (never prompt or modify). |
| `--quiet` | `-q` | `false` | Suppress verbose output (show only errors). |
| `--help` | `-h` | | Print usage help. |

## Example Workflows

```bash
# Generate context with style metadata for entire project
stamp context style

# Scan specific directory with style metadata
stamp context style ./src

# Use with conservative profile
stamp context style --profile llm-safe

# Include full source code with style metadata
stamp context style --include-code full

# Custom output directory
stamp context style --out ./output

# Equivalent syntax using flag
stamp context --include-style
```

## Output Format

Style metadata is included in the `style` field of each component's contract within the context bundle. The structure follows this schema:

```json
{
  "type": "UIFContract",
  "kind": "react:component",
  "entryId": "src/components/HeroSection.tsx",
  "style": {
    "styleSources": {
      "tailwind": {
        "categories": {
          "layout": ["flex", "flex-col", "items-center"],
          "spacing": ["py-16", "px-8", "gap-4"],
          "colors": ["bg-black", "text-white", "bg-purple-500"],
          "typography": ["text-4xl", "font-semibold", "leading-tight"],
          "borders": ["rounded-xl", "border-2"],
          "effects": ["shadow-lg", "opacity-90"]
        },
        "breakpoints": ["md", "lg"],
        "classCount": 15
      },
      "scssModule": "./HeroSection.module.scss",
      "scssDetails": {
        "selectors": [".hero", ".title", ".cta"],
        "properties": ["background", "padding", "margin"],
        "features": {
          "variables": true,
          "nesting": true
        }
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
        "packages": ["@mui/material", "@mui/icons-material"],
        "features": {
          "usesTheme": true,
          "usesSxProp": true,
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
      "hasFeatureCards": false
    },
    "visual": {
      "colors": ["bg-black", "text-white", "bg-purple-500"],
      "spacing": ["py-16", "px-8", "gap-4"],
      "radius": "xl",
      "typography": ["text-4xl", "font-semibold", "leading-tight"]
    },
    "animation": {
      "library": "framer-motion",
      "type": "fade-in",
      "trigger": "inView"
    }
  }
}
```

### Style Metadata Fields

#### `styleSources`

Object containing detected styling approaches:

- `tailwind` – Object with categorized classes, breakpoints, and class count
- `scssModule` / `cssModule` – Path to module file (if imported)
- `scssDetails` / `cssDetails` – Parsed details from style files
- `inlineStyles` – Boolean indicating inline style usage
- `styledComponents` – Object with component names and theme usage
- `motion` – Object with framer-motion components and features
- `materialUI` – Object with Material UI components, packages, and styling features
- `shadcnUI` – Object with ShadCN/UI components, variants, sizes, and features (form integration, theme, icons, component density)
- `radixUI` – Object with Radix UI primitives (organized by package), patterns (controlled/uncontrolled, portals, asChild), accessibility features, and composition depth

#### `layout`

Layout structure information (AST-based extraction):

- `type` – "flex" or "grid" (grid takes precedence if both are present)
- `cols` – Grid column numbers (e.g., "2 3" extracted from "grid-cols-2 md:grid-cols-3")
- `hasHeroPattern` – Boolean indicating hero section pattern (large text + CTA buttons)
- `hasFeatureCards` – Boolean indicating feature card grid pattern

Layout extraction uses AST analysis, so it handles dynamic className expressions (`cn()`, `clsx()`), variant-prefixed classes, and conditional expressions.

#### `visual`

Visual design patterns (AST-based extraction):

- `colors` – Array of color utility classes (sorted, limited to top 10)
- `spacing` – Array of spacing utility classes (sorted, limited to top 10). Supports all formats: `p-4`, `p-1.5`, `p-px`, `p-[2px]`, `-mt-2`
- `radius` – Most common border radius token (e.g., "lg" from "rounded-lg"). Valid values: "default", "sm", "md", "lg", "xl", "2xl", "3xl", "full"
- `typography` – Array of typography classes (sorted, limited to top 10)

Visual extraction uses AST analysis, so it handles dynamic className expressions (`cn()`, `clsx()`), variant-prefixed classes, and template literals (static segments extracted).

#### `animation`

Animation and motion information:

- `library` – "framer-motion" or "css"
- `type` – Animation type (e.g., "fade-in")
- `trigger` – Trigger type (e.g., "inView", "hover")

Style metadata is only included when style information is detected. Components without style usage won't have a `style` field.

## Use Cases

### Design System Analysis

Understand visual patterns across your codebase:

```bash
stamp context style --out design-analysis.json
```

Then analyze the output to:
- Track color palette usage across components
- Identify spacing pattern consistency
- Find components using similar layout patterns
- Detect animation usage patterns

### AI-Assisted Design

Enable AI assistants to suggest visually consistent components:

```bash
# Generate style-aware context
stamp context style

# Share with AI assistant
# AI can now suggest components that match your design system
```

### Layout Understanding

Help AI understand component structure:

```bash
stamp context style --include-code header
```

AI assistants can now:
- Understand flex vs grid layouts
- Recognize responsive breakpoint usage
- Identify hero sections and feature card grids
- Suggest layout improvements

### Animation Detection

Identify components with motion:

```bash
stamp context style
```

The output helps you:
- Find all components using framer-motion
- Track animation patterns across the codebase
- Identify viewport-triggered animations
- Understand gesture handler usage

### Style Consistency

Track design system adherence:

```bash
stamp context style --stats
```

Use the output to:
- Verify color palette consistency
- Check spacing pattern usage
- Ensure typography scale adherence
- Monitor border radius patterns

## Integration with Other Commands

### Validation

Style metadata is validated along with the rest of the context:

```bash
stamp context style
stamp context validate
```

### Comparison

Style metadata is included in drift detection:

```bash
stamp context style --out old/
# ... make changes ...
stamp context style --out new/
stamp context compare old/context_main.json new/context_main.json
```

The compare command will detect changes in:
- Style sources (added/removed Tailwind classes, etc.)
- Layout patterns
- Visual metadata
- Animation configurations

### Token Impact

Style metadata adds a small token overhead to context bundles. Use `stamp context --compare-modes` to see the token impact across different modes.

The `--compare-modes` flag automatically regenerates contracts with and without style metadata to provide accurate token counts. This shows you:

- **Exact token overhead** of including style metadata (header vs header+style)
- **Comparison across all modes** – none, header, header+style, and full
- **Savings percentages** compared to both raw source and full context

See [compare-modes.md](compare-modes.md) for a comprehensive guide to token cost analysis and mode comparison.

**Example output:**

```
📊 Mode Comparison

   Comparison:
     Mode         | Tokens GPT-4o | Tokens Claude | Savings vs Raw Source
     -------------|---------------|---------------|------------------------
     Raw source   |        22,000 |        19,556 | 0%
     Header       |        12,228 |        10,867 | 44%
     Header+style |        13,895 |        12,351 | 37%

   Mode breakdown:
     Mode         | Tokens GPT-4o | Tokens Claude | Savings vs Full Context
     -------------|---------------|---------------|--------------------------
     none         |         8,337 |         7,411 | 79%
     header       |        12,228 |        10,867 | 69%
     header+style |        13,895 |        12,351 | 65%
     full         |        39,141 |        34,792 | 0%
```

In this example, including style metadata adds approximately **1,667 GPT-4 tokens** (13,895 - 12,228) or about **13.6% overhead** compared to header-only mode.

## Tips

- **Start with default** – The default `header` code mode works well for most use cases
- **Use profiles** – Combine with `--profile llm-safe` for token-constrained scenarios
- **Incremental updates** – Style metadata is included in folder-based context files, enabling incremental regeneration
- **CI integration** – Use `--stats` to track style metadata size in CI pipelines
- **Design reviews** – Generate style context before design system reviews to understand current patterns

## Error Handling

The style extractor is designed to be robust and will never crash the CLI, even when encountering:

- **Missing files**: SCSS/CSS module files that don't exist are silently skipped
- **Malformed code**: Invalid JSX, TypeScript syntax errors, or parse failures are handled gracefully
- **Extractor failures**: If one style extractor fails (e.g., Material UI parsing), others continue to work and return partial results
- **AST traversal errors**: Complex or malformed code that causes AST parsing issues falls back gracefully
- **Invalid file paths**: Non-existent directories or invalid paths are handled without crashing

### Partial Results

The extractor is designed to return **partial results** rather than failing completely. This means:

- If Tailwind extraction fails, other extractors (styled-components, Material UI, etc.) still work
- If SCSS file parsing fails, other style sources are still extracted
- If layout metadata extraction fails, visual and animation metadata can still be extracted
- The main function returns `undefined` only when **no style information** is found (which is expected behavior)

### Debug Logging

All error handling is silent by default. To enable debug logging for troubleshooting, set the `LOGICSTAMP_DEBUG=1` environment variable:

```bash
LOGICSTAMP_DEBUG=1 stamp context style
```

This will output detailed error messages to help identify problematic files or expressions:

```
[LogicStamp][DEBUG] styleExtractor.extractStyleMetadata error: { filePath: '/path/to/file.tsx', error: 'ENOENT: no such file or directory' }
[LogicStamp][DEBUG] material.extractMaterialUI error: { filePath: '/path/to/file.tsx', error: 'Unexpected token' }
[LogicStamp][DEBUG] layout.extractLayoutMetadata error: { filePath: '/path/to/file.tsx', error: 'Cannot read property \'getText\' of undefined' }
```

### Best Practices

- **Don't worry about missing files**: If a component imports a style file that doesn't exist, the extractor will skip it and continue
- **Check debug logs when issues occur**: Enable `LOGICSTAMP_DEBUG=1` if you suspect extraction problems
- **Expect partial results**: Some extraction failures are normal (e.g., runtime-generated classes can't be statically analyzed)

## Limitations

- **Dynamic class values** – While AST extraction handles `cn()`, `clsx()`, and template literals, classes generated from runtime variables (e.g., `className={styles[someVar]}`) are not detected
- **CSS-in-JS** – Only styled-components and emotion are detected via AST-based extraction; Material UI styled is detected separately; other CSS-in-JS libraries may not be recognized
- **External stylesheets** – Global CSS files are not analyzed; only CSS/SCSS files imported by TSX/TS component files are parsed. Standalone CSS/SCSS files that aren't imported won't be scanned.
- **Runtime styles** – Styles applied via JavaScript at runtime are not detected
- **Template literal dynamic segments** – In `className={`flex ${variable}`}`, only the static "flex" segment is extracted; the dynamic variable value is not analyzed

## Examples

### Basic Usage

```bash
$ stamp context style

🔍 Scanning /path/to/project...
⚙️  Analyzing components...
🎨 Extracting style metadata...
🔗 Building dependency graph...
📦 Generating context...
✅ Context generated with style metadata

📊 Summary:
   Total components: 15
   Components with style: 12
   Style sources detected:
     - Tailwind: 10 components
     - SCSS modules: 3 components
     - framer-motion: 2 components
     - Material UI: 5 components
     - ShadCN/UI: 8 components
     - Radix UI: 4 components
```

### With Custom Options

```bash
$ stamp context style ./src --profile llm-safe --out ./style-context

🔍 Scanning ./src...
⚙️  Analyzing components...
🎨 Extracting style metadata...
...
✅ Context generated with style metadata
```


## Related Commands

- [`stamp context`](context.md) – Generate context without style metadata
- [`stamp context validate`](validate.md) – Validate generated context files
- [`stamp context compare`](compare.md) – Compare context files including style changes

