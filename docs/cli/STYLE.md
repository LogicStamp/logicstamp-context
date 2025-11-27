# `stamp context style` Command

Generate AI-ready context bundles with style metadata included. This command extracts visual and layout information from your React components, making context bundles design-aware for AI assistants.

```bash
stamp context style [path] [options]
```

- `[path]` (optional) – Directory to scan. Defaults to the current working directory. Paths can be relative (`./src`) or absolute.

**Note:** The `stamp context style` command is equivalent to `stamp context --include-style`. Both syntaxes produce identical output.

## Overview

While `stamp context` focuses on component logic and structure, `stamp context style` adds visual and layout understanding. This enables AI assistants to:

- Understand the visual design of components
- Suggest visually consistent components
- Analyze layout patterns (flex, grid, responsive breakpoints)
- Track color palettes and spacing patterns
- Identify animation and motion usage

## What It Extracts

The style command analyzes components and extracts four categories of metadata:

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

- **SCSS/CSS Modules** – Detects module imports and parses:
  - CSS selectors used
  - CSS properties defined
  - SCSS features (variables, nesting, mixins)

- **Inline Styles** – Detects `style={{...}}` usage

- **styled-components/Emotion** – Identifies:
  - Styled component declarations
  - Theme usage
  - CSS prop usage

- **framer-motion** – Detects:
  - Motion components (motion.div, motion.button, etc.)
  - Animation variants
  - Gesture handlers
  - Layout animations
  - Viewport-triggered animations

### 2. Layout Metadata

Extracts structural layout information:

- **Layout Type** – Identifies flex or grid layouts
- **Grid Patterns** – Extracts column configurations (e.g., "grid-cols-2 md:grid-cols-3")
- **Hero Patterns** – Detects hero sections (large text + CTA buttons)
- **Feature Cards** – Identifies grid layouts with card-like elements
- **Responsive Breakpoints** – Lists all breakpoints used (sm, md, lg, etc.)

### 3. Visual Metadata

Captures visual design patterns:

- **Color Palette** – Extracts color classes (bg-*, text-*, border-*)
- **Spacing Patterns** – Identifies padding and margin utilities used
- **Border Radius** – Detects rounded corner patterns
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
| `--dry-run` | | `false` | Skip writing the output; display summary only. |
| `--stats` | | `false` | Emit single-line JSON stats (ideal for CI). |
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

#### `layout`

Layout structure information:

- `type` – "flex" or "grid"
- `cols` – Grid column pattern (e.g., "grid-cols-2 md:grid-cols-3")
- `hasHeroPattern` – Boolean indicating hero section pattern
- `hasFeatureCards` – Boolean indicating feature card grid pattern

#### `visual`

Visual design patterns:

- `colors` – Array of color utility classes (sorted, limited to top 10)
- `spacing` – Array of spacing utility classes (sorted, limited to top 10)
- `radius` – Most common border radius pattern
- `typography` – Array of typography classes (sorted, limited to top 10)

#### `animation`

Animation and motion information:

- `library` – "framer-motion" or "css"
- `type` – Animation type (e.g., "fade-in")
- `trigger` – Trigger type (e.g., "inView", "hover")

**Note:** Style metadata is only included when style information is detected. Components without style usage will not have a `style` field.

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

See [COMPARE-MODES.md](COMPARE-MODES.md) for a comprehensive guide to token cost analysis and mode comparison.

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

## Limitations

- **Dynamic classes** – Classes generated dynamically (e.g., `className={clsx(...)}`) may not be fully detected
- **CSS-in-JS** – Only styled-components and emotion are detected; other CSS-in-JS libraries may not be recognized
- **External stylesheets** – Global CSS files are not analyzed; only module imports are parsed
- **Runtime styles** – Styles applied via JavaScript at runtime are not detected

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

- [`stamp context`](CONTEXT.md) – Generate context without style metadata
- [`stamp context validate`](VALIDATE.md) – Validate generated context files
- [`stamp context compare`](COMPARE.md) – Compare context files including style changes

