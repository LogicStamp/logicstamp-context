# LogicStamp Context - Usage Guide

## Quick Start

```bash
# Install globally
npm install -g logicstamp-context

# Generate context for your project
stamp context

# Output: Multiple context.json files (one per folder) plus context_main.json index
```

**Note**: "Global CLI" means the tool is installed globally on your system (via `npm install -g`), making the `stamp` command available from any directory in your terminal, not just within a specific project folder.
- **Local install**: `npm install logicstamp-context` → only available in that project
- **Global install**: `npm install -g logicstamp-context` → available everywhere via `stamp` command

## Command Syntax

```bash
stamp --version                    # Show version number
stamp --help                       # Show help
stamp init [path] [options]        # Initialize LogicStamp in project
stamp ignore <path> [path2] ...     # Add files/folders to .stampignore
stamp context [path] [options]
stamp context style [path] [options]  # Generate context with style metadata
stamp context validate [file]
stamp context compare [oldFile] [newFile] [options]  # Auto-mode (default): omit files to compare all context files
stamp context clean [path] [options]
stamp security scan [path] [options]  # Scan for secrets and generate report
stamp security --hard-reset [options]  # Reset security configuration
```

## Global Options

These options are available at the top level (before any subcommand):

| Option | Alias | Description |
|--------|-------|-------------|
| `--version` | `-v` | Show version number and exit |
| `--help` | `-h` | Show help message and exit |

**Examples:**
```bash
stamp --version    # Shows: fox mascot + "Version: 0.3.8"
stamp -v           # Same as --version
stamp --help       # Shows main help
stamp -h           # Same as --help
```

## Commands

### `stamp init`

Initialize LogicStamp in your project by setting up `.gitignore` patterns and project configuration.

```bash
# Basic initialization (non-interactive, runs security scan by default)
stamp init

# Initialize without prompts (redundant - already non-interactive by default)
stamp init --yes

# Initialize with interactive prompts (skips security scan)
stamp init --no-secure

# Initialize specific directory
stamp init ./my-project
```

**What it does**

1. **Sets up `.gitignore`** - Adds patterns for LogicStamp-generated files:
   - `context.json` - Per-folder context bundles (large, regenerable)
   - `context_*.json` - Main index and context variants
   - `context.toon` - Per-folder context bundles in toon format
   - `context_*.toon` - Main index and context variants in toon format
   - `*.uif.json` - UIF contract sidecar files
   - `logicstamp.manifest.json` - Dependency manifest files
   - `.logicstamp/` - Configuration directory (user preferences)
   - `stamp_security_report.json` - 🔒 Security scan reports (contains sensitive findings - **never commit**)

   These patterns prevent large generated files and sensitive reports from being committed. See [init.md](cli/init.md) for detailed explanations of each pattern.

2. **Generates `LLM_context.md`** - Creates a guide for AI assistants to understand your project structure
3. **Creates `.logicstamp/config.json`** - Saves preferences so `stamp context` never prompts (CI-friendly)

**Key options**

| Option | Description |
|--------|-------------|
| `--skip-gitignore` | Skip `.gitignore` setup |
| `--yes`, `-y` | Skip all prompts (non-interactive mode) |
| `--no-secure` | Skip security scan (security scan runs by default) |

**Security scan (default behavior)**

By default, `stamp init` automatically runs a security scan after initialization. This:

1. Sets up `.gitignore` patterns
2. Generates `LLM_context.md` (if prompted and accepted)
3. Runs `stamp security scan` to scan for secrets (API keys, passwords, tokens)

**Runs 100% locally — nothing is uploaded or sent anywhere.**

```bash
# Default: Security scan runs automatically
stamp init

# Skip security scan if needed
stamp init --no-secure
```

**Behavior**

- `stamp init` is **idempotent** - safe to run multiple times
- Preferences are saved to `.logicstamp/config.json`
- `stamp context` respects these preferences and **never prompts** (CI-friendly)
- In CI/non-TTY environments, defaults to skipping both operations

**See also:** [init.md](cli/init.md) for comprehensive documentation.

### `stamp ignore`

Add files or folders to `.stampignore` to exclude them from context generation. This is useful for excluding files with secrets, large generated files, or other files that shouldn't be included in context bundles.

**Arguments**

- `<path1> [path2] ...` - One or more file or folder paths to ignore (relative to project root). Supports glob patterns.

**Key options**

| Option | Alias | Description |
|--------|-------|-------------|
| `--quiet` | `-q` | Suppress verbose output (show only errors) |

**Examples**

```bash
# Add a single file to .stampignore
stamp ignore src/secrets.ts

# Add multiple files/folders
stamp ignore src/config/credentials.ts src/secrets/

# Add glob patterns
stamp ignore "**/secrets.ts" "**/*.key"

# Quiet mode
stamp ignore src/secrets.ts --quiet
```

**What it does**

- Creates `.stampignore` if it doesn't exist
- Adds specified paths to `.stampignore`
- Prevents duplicate entries
- Normalizes paths automatically
- Shows feedback about what was added (unless `--quiet` is used)

**Integration with other commands**

- Files in `.stampignore` are automatically excluded when running `stamp context`
- Use `stamp ignore <file>` to add files with detected secrets to `.stampignore` after reviewing the security report

**See also:** [ignore.md](cli/ignore.md) for comprehensive documentation.

### `stamp context`

Generates LogicStamp bundles from a directory.

**Arguments**

- `[path]` – Directory to scan (defaults to current working directory)

**Secret Sanitization**

If a security report (`stamp_security_report.json`) exists, `stamp context` automatically replaces detected secrets with `"PRIVATE_DATA"` in the generated JSON files. **Your source code files are never modified** - only the generated context files contain sanitized values. This happens automatically when a security report exists. See [security-scan.md](cli/security-scan.md) for details.

**Key options**

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--depth <n>` | `-d` | `2` | Dependency traversal depth (0=self only, 1=direct deps, 2=nested components, etc.). See [Depth Parameter](#depth-parameter) section below. |
| `--include-code <mode>` | `-c` | `header` | Code inclusion: `none`, `header`, or `full` |
| `--format <fmt>` | `-f` | `json` | Output format: `json`, `pretty`, `ndjson`, or `toon` |
| `--out <file>` | `-o` | `context.json` | Output directory or file path. If a `.json` file is specified, its directory is used as the output directory. Otherwise, the path is used as the output directory. Context files will be written maintaining folder structure within this directory. |
| `--max-nodes <n>` | `-m` | `100` | Maximum nodes to include (prevents huge bundles) |
| `--profile <name>` | | `llm-chat` | Apply preset profile (see below) |
| `--strict` | `-s` | `false` | Fail if any dependency is missing |
| `--predict-behavior` | | `false` | Include experimental behavioral predictions |
| `--dry-run` | | `false` | Skip writing the output file; prints summary instead |
| `--stats` | | `false` | Emit one-line JSON stats (helpful for CI pipelines). When combined with `--compare-modes`, writes `context_compare_modes.json` for MCP integration. |
| `--compare-modes` | | `false` | Show detailed token comparison table across all modes (none/header/header+style/full) with accurate style metadata impact. When combined with `--stats`, writes `context_compare_modes.json` for MCP integration. |
| `--include-style` | | `false` | Extract style metadata (Tailwind, SCSS, Material UI, animations, layout). |
| `--strict-missing` | | `false` | Exit with error if any missing dependencies found |
| `--skip-gitignore` | | `false` | Skip `.gitignore` setup (never prompt or modify). Default behavior is CI-friendly (skips unless config preference is 'added'). |
| `--quiet` | `-q` | `false` | Suppress verbose output (show only errors) |

**CI / automation tips**

- Context files are generated fresh in CI (not committed) - they're gitignored as regenerable artifacts
- Use `--dry-run` to inspect totals without producing files
- Use `--stats` to emit machine-readable summary lines (combine with shell redirection)
- Use `--skip-gitignore` to prevent any `.gitignore` modifications in CI environments
- Use `--quiet` to suppress verbose output in CI pipelines (show only errors)

### `stamp context style`

Generates context with style metadata included. This command extracts visual and layout information from your React components, making context bundles design-aware for AI assistants.

**Arguments**

- `[path]` – Directory to scan (defaults to current working directory)

**Secret Sanitization**

Like `stamp context`, the style command also automatically sanitizes secrets in generated JSON files if a security report exists. **Your source code files are never modified.**

**Key options**

All options from `stamp context` are supported. The style command is equivalent to `stamp context --include-style`.

**What it extracts**

The style command analyzes components and extracts:

1. **Style Sources**
   - Tailwind CSS classes (categorized by type: layout, spacing, colors, typography, etc.)
   - SCSS/CSS module imports and their details (selectors, properties, feature detection flags for variables/nesting/mixins)
   - Inline styles detection
   - styled-components/emotion usage
   - framer-motion animation components
   - Material UI components, packages, and styling features (theme, sx prop, styled, makeStyles, system props)

2. **Layout Metadata** (AST-based)
   - Layout type (flex, grid) - grid takes precedence if both present
   - Grid column patterns (e.g., "2 3" extracted from "grid-cols-2 md:grid-cols-3")
   - Hero pattern detection (large text + CTA buttons)
   - Feature card patterns (grid with card-like elements)
   - Handles variant-prefixed classes: `md:flex`, `lg:grid`
   - Supports dynamic className expressions: `cn()`, `clsx()`, template literals

3. **Visual Metadata** (AST-based)
   - Color palette (bg-*, text-*, border-* classes)
     - Handles variant prefixes: `md:bg-blue-500`, `dark:text-slate-50`
   - Spacing patterns (padding, margin utilities)
     - Supports all formats: integers, fractions (`p-1.5`), arbitrary (`p-[2px]`), negative (`-mt-2`)
     - Handles variant prefixes: `lg:px-4`, `sm:m-2`, `md:-mt-2`
   - Border radius patterns (stores token: "lg" from "rounded-lg")
     - Handles variant prefixes: `md:rounded-xl`
   - Typography classes (text-*, font-*)
     - Handles variant prefixes: `sm:text-lg`

4. **Animation Metadata**
   - framer-motion library usage
   - Animation types (fade-in, etc.)
   - Viewport triggers (useInView)
   - CSS transitions/animations

**Examples**

```bash
# Generate context with style metadata
stamp context style

# Scan specific directory with style metadata
stamp context style ./src

# Use with other options
stamp context style --profile llm-safe --out ./output

# Equivalent to using the flag
stamp context --include-style
```

**Output**

Style metadata is included in the `style` field of each component's contract:

```json
{
  "type": "UIFContract",
  "kind": "react:component",
  "entryId": "src/components/HeroSection.tsx",
  "style": {
    "styleSources": {
      "tailwind": {
        "categories": {
          "layout": ["flex", "flex-col"],
          "spacing": ["py-16", "px-8"],
          "colors": ["bg-black", "text-white"],
          "typography": ["text-4xl", "font-semibold"]
        },
        "breakpoints": ["md", "lg"],
        "classCount": 15
      },
      "motion": {
        "components": ["div"],
        "variants": ["fadeIn"],
        "features": {
          "viewportAnimations": true
        }
      },
      "materialUI": {
        "components": ["Button", "TextField"],
        "packages": ["@mui/material"],
        "features": {
          "usesTheme": true,
          "usesSxProp": true
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

**Use cases**

- **Design system analysis** – Understand visual patterns across components
- **AI-assisted design** – Help AI assistants suggest visually consistent components
- **Layout understanding** – Enable AI to understand flex/grid structures
- **Animation detection** – Identify components with motion/animations
- **Style consistency** – Track color palettes and spacing patterns

**Note:** Style extraction adds a small token overhead to context bundles. Use `stamp context --compare-modes` to see the token impact.

For detailed documentation on the style command, see [docs/cli/style.md](cli/style.md).

### `stamp context validate`

Checks that a generated bundle file matches the expected schema and structure.

```bash
stamp context validate             # validates ./context.json by default
stamp context validate review.json # validate a custom bundle
```

**What it checks**

- File exists (defaults to `./context.json`) and parses as JSON.
- For folder context files: Top-level shape matches `LogicStampBundle[]`.
- For main index: Structure matches `LogicStampIndex` with folder metadata.
- Each bundle has the correct types, graph metadata, and contract versions.
- Warns on unexpected schema versions or hash formats.

**Options**

- `--quiet` | `-q` – Suppress verbose output (show only errors)

**Exit codes**

- `0` – File is valid (warnings may still print).
- `1` – Critical issues (missing fields, invalid JSON, file not found).

### `stamp context compare`

Compares context files to detect drift and changes across your project. Supports both single-file and multi-file comparison modes.

```bash
# Auto-mode: Compare all context files (multi-file mode)
stamp context compare

# Single-file: Compare two specific files
stamp context compare old.json new.json

# Multi-file: Compare two indices
stamp context compare old/context_main.json new/context_main.json

# Auto-approve updates (like jest -u)
stamp context compare --approve

# Show per-folder token statistics
stamp context compare --stats

# Clean up orphaned files automatically
stamp context compare --approve --clean-orphaned
```

**What it does**

The compare command has **two modes**:

1. **Multi-File Mode** (Auto or Manual with `context_main.json`):
   - Compares **all context files** across your project
   - Uses `context_main.json` as the root index
   - Detects:
     - **ADDED FILE** – New folders with context files
     - **ORPHANED FILE** – Folders removed from project
     - **DRIFT** – Changed files with component-level details
     - **PASS** – Unchanged files
   - Shows three-tier output:
     - Folder-level summary
     - Component-level summary
     - Detailed per-folder changes

2. **Single-File Mode**:
   - Compares two specific `context.json` files
   - Detects added/removed/changed components
   - Shows detailed component-level diffs

**Key options**

| Option | Description |
|--------|-------------|
| `--approve` | Auto-approve updates (non-interactive, CI-safe) |
| `--clean-orphaned` | Auto-delete orphaned files with `--approve` |
| `--stats` | Show token count statistics per folder |
| `--skip-gitignore` | Skip `.gitignore` setup when generating fresh context (auto-mode only) |
| `--quiet` | `-q` | Suppress verbose output (show only diffs) |
| `--help` | Show help message |

**Exit codes**

- `0` – PASS (no drift) OR drift approved and updated
- `1` – DRIFT detected but not approved

**Example output (Multi-File Mode)**

```bash
$ stamp context compare

✅  PASS

📁 Folder Summary:
   Total folders: 14
   ✓  Unchanged folders: 14

📂 Folder Details:

   ✅ PASS: src/cli/context.json
      Path: src/cli

   ✅ PASS: src/core/context.json
      Path: src/core
```

**Example with drift**

```bash
$ stamp context compare

⚠️  DRIFT

📁 Folder Summary:
   Total folders: 14
   ➕ Added folders: 1
   ~  Changed folders: 2
   ✓  Unchanged folders: 11

📦 Component Summary:
   + Added: 3
   ~ Changed: 2

📂 Folder Details:

   ➕ ADDED FILE: src/new-feature/context.json
      Path: src/new-feature

   ⚠️  DRIFT: src/cli/commands/context.json
      Path: src/cli/commands
      ~ Changed components (1):
        ~ compare.ts
          Δ hash
            old: uif:abc123...
            new: uif:def456...

Update all context files? (y/N)
```

**CI Integration**

```bash
# Fail build if drift detected
stamp context compare || exit 1

# Auto-approve in CI (like jest -u)
stamp context compare --approve

# Show token impact
stamp context compare --stats
```

**See also:** [compare.md](./compare.md) for comprehensive documentation.

### `stamp context clean`

Removes all generated context artifacts from your project. Safe by default (dry run), requires `--all --yes` to actually delete files.

```bash
# Show what would be removed (dry run)
stamp context clean

# Actually delete all context artifacts
stamp context clean --all --yes

# Clean specific directory
stamp context clean ./src --all --yes
```

**What it removes**

- `context_main.json` – Main index file
- `**/context.json` – All folder context files (recursively)
- `.logicstamp/` – Cache directory (if present, automatically included)

**Key options**

| Option | Description |
|--------|-------------|
| `--all` | Include all context files in the deletion operation |
| `--yes` | Confirm deletion (required with `--all`) |
| `--quiet` | `-q` | Suppress verbose output (show only errors) |
| `--help` | Show help message |

**Safety features**

- **Dry run by default** – Shows what would be removed without deleting
- **Requires both flags** – Both `--all` and `--yes` must be specified to delete
- **Ignores build directories** – Automatically skips `node_modules/`, `dist/`, `build/`, `.next/`

**Use cases**

- Reset context files before regenerating
- Clean before switching git branches
- Remove context artifacts from a project

**See also:** [clean.md](./clean.md) for comprehensive documentation.

## Depth Parameter

The `--depth` option controls how many levels deep the dependency graph includes. **The default is `2`** to ensure proper signature extraction for React/TypeScript projects.

### Why Depth 2 is the Default

**Problem with Depth 1:**
- Only includes direct dependencies (components directly imported/used)
- **Missing nested component signatures**: If `App` uses `Hero`, and `Hero` uses `Button`, depth=1 only includes `Hero` in the bundle—`Button`'s contract and signatures are missing
- This leads to incomplete signature extraction, making it harder for AI assistants to understand component APIs

**Why Depth 2 Works Better:**
- Includes nested components (components used by components)
- **Complete signature extraction**: With depth=2, `App` → `Hero` → `Button` all appear in the bundle with their full contracts
- Better for React projects with component hierarchies
- Still efficient: header mode saves ~70% vs raw source even with depth=2

**Example:**

```typescript
// App.tsx
import { Hero } from './Hero'

export function App() {
  return <Hero />
}

// Hero.tsx  
import { Button } from './Button'

export function Hero() {
  return <Button>Click me</Button>
}

// Button.tsx
export function Button({ onClick, children }: ButtonProps) {
  return <button onClick={onClick}>{children}</button>
}
```

- **Depth 1**: Bundle includes `App` and `Hero`, but `Button` is missing → no `Button` props/signatures
- **Depth 2**: Bundle includes `App`, `Hero`, and `Button` → complete component tree with all signatures ✅

### When to Adjust Depth

**Reduce to depth=1 if:**
- You only need direct dependencies
- Bundle size is a concern and you're hitting `max-nodes` limits
- You're analyzing simple projects without component hierarchies

**Increase to depth=3+ if:**
- You have deeply nested component trees
- You need to see dependencies 3+ levels deep
- You're doing comprehensive architecture analysis

**Note:** The `max-nodes` limit (default 100) prevents bundles from growing too large. If you hit this limit with depth=2, consider reducing depth or increasing `max-nodes`.

## Profiles

Profiles apply preset combinations for common use cases:

### `llm-chat` (Default)
Balanced mode optimized for AI chat:
- Depth: 2 (includes nested components)
- Code: headers only
- Max nodes: 100

```bash
stamp context --profile llm-chat
```

### `llm-safe`
Conservative mode for token-limited contexts:
- Depth: 2 (includes nested components)
- Code: headers only
- Max nodes: 30

```bash
stamp context --profile llm-safe
```

### `ci-strict`
Strict validation mode for CI/CD:
- Code: none (contracts only)
- Strict dependencies enabled
- Fails on missing deps

```bash
stamp context --profile ci-strict
```

## Code Inclusion Modes

### `none` - Minimal
Only contract metadata. Smallest size, fastest to process.

```bash
stamp context --include-code none
```

**Use when:** You only need structure, props, and logic signatures.

### `header` - Recommended
Includes JSDoc `@uif` header blocks. Good balance of context and size.

```bash
stamp context --include-code header
```

**Use when:** You want contract reference without full implementation.

### `full` - Complete
Includes entire source files. Largest bundles but complete context.

```bash
stamp context --include-code full --max-nodes 20
```

**Use when:** AI needs to see or modify implementation details.

### Understanding Structured Context

LogicStamp generates **structured context bundles** rather than raw source files. This approach transforms how AI processes code:

**Raw Source Approach:**
- Parse code line-by-line
- Infer relationships from imports and usage
- Extract patterns manually
- Reason about structure through implementation

**Structured Approach:**
- Read pre-categorized metadata (`layout.type`, `visual.colors`, `logicSignature.props`)
- Traverse explicit dependency graphs (`graph.edges`)
- Query organized information directly
- Reason about contracts without reading implementation

**Example:** To find "components using the same color palette":
- **Raw source:** Scan all className strings, extract colors, group manually
- **Structured:** Read `visual.colors` arrays from contracts, compare directly

The structured format makes queries faster and more accurate because information is pre-processed, categorized, and relationships are explicit. See [LLM_CONTEXT.md](../LLM_CONTEXT.md#why-structured-data-is-better-than-raw-source) for a detailed explanation.

### Token Cost Comparison

Use `--compare-modes` to see token estimates across all modes:

```bash
stamp context --compare-modes
stamp context --compare-modes --stats  # Creates context_compare_modes.json for MCP
```

Shows two comparison tables: savings vs raw source, and mode breakdown vs full context. Automatically regenerates contracts with/without style for accurate comparisons. Optional tokenizers (`@dqbd/tiktoken`, `@anthropic-ai/tokenizer`) provide exact counts if installed; otherwise uses approximations.

**Note:** Token counts vary by technology (Tailwind is already efficient; regular CSS shows larger gains). The real value is in structured processing—faster parsing, explicit relationships, and categorized information make AI assistants more effective.

## Output Formats

### `json` - Compact
One-line JSON, ideal for programmatic use.

```bash
stamp context --format json
```

### `pretty` - Human-Readable
Formatted JSON with indentation.

```bash
stamp context --format pretty
```

### `ndjson` - Streaming
Newline-delimited JSON (one bundle per line).

```bash
stamp context --format ndjson
```

## Examples

### Basic Usage

```bash
# Scan current directory
stamp context

# Scan specific directory
stamp context ./src

# Custom output directory
stamp context --out ./output

# Or specify a file to use its directory
stamp context --out ./output/context.json

# Skip file write, but review summary locally
stamp context ./src --dry-run
```

### AI-Optimized Contexts

```bash
# For Claude/ChatGPT (balanced)
stamp context --profile llm-chat

# For token-limited models (conservative)
stamp context --profile llm-safe --out safe-context.json

# Include full source for deep analysis
stamp context --include-code full --max-nodes 10
```

### Deep Dependency Analysis

```bash
# Two levels of dependencies
stamp context --depth 2

# Three levels with full code
stamp context --depth 3 --include-code full --max-nodes 50
```

### CI/CD Integration

**Typical CI/CD workflow:**
- Context files are **generated fresh** during CI runs (not committed to git)
- They're gitignored because they're regenerable artifacts (like build outputs)
- CI generates them, uses them for validation/comparison, then discards them
- **If you want to commit context files** (uncommon), skip gitignore setup: `stamp init --skip-gitignore`

**Default behavior is CI-friendly:**
- `stamp context` **does not modify `.gitignore` by default** - it respects config preferences or skips if no config exists
- Use `--skip-gitignore` to explicitly prevent any `.gitignore` modifications

```bash
# Generate context files fresh in CI (typical workflow)
stamp context --skip-gitignore --quiet

# Strict mode - fails on missing dependencies
stamp context --profile ci-strict --skip-gitignore

# Validate generated context files
stamp context validate

# Compare context files to detect drift
stamp context compare --approve

# Generate stats for monitoring
stamp context --stats --quiet
```

**Example CI pipeline:**
```bash
# Install LogicStamp
npm install -g logicstamp-context

# Generate context files (fresh, not committed)
stamp context --skip-gitignore --quiet

# Validate or compare as needed
stamp context validate || exit 1
```

### Validation & QA

```bash
# Validate a generated bundle before committing
stamp context validate       # defaults to ./context.json

# Validate the main index
stamp context validate context_main.json

# Validate a specific folder's context
stamp context validate src/components/context.json

# Capture stats for monitoring without writing a file
stamp context --stats >> .ci/context-stats.jsonl
```

### Stats Output Format

The `--stats` flag outputs a single line of JSON with the following structure (stable contract for CI parsing):

```json
{
  "totalComponents": 42,
  "rootComponents": 5,
  "leafComponents": 8,
  "bundlesGenerated": 5,
  "totalNodes": 37,
  "totalEdges": 32,
  "missingDependencies": 15,
  "elapsedMs": 234
}
```

**Field descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `totalComponents` | number | Total .ts/.tsx files successfully analyzed |
| `rootComponents` | number | Components with no dependencies (entry points) |
| `leafComponents` | number | Components that are only dependencies (no imports) |
| `bundlesGenerated` | number | Number of bundles created (one per root) |
| `totalNodes` | number | Sum of all nodes across all bundles |
| `totalEdges` | number | Sum of all edges across all bundles |
| `missingDependencies` | number | Count of unresolved dependencies (third-party/external) |
| `elapsedMs` | number | Time taken in milliseconds |

**Example CI usage:**

```bash
# Generate stats and parse in CI
STATS=$(stamp context --stats)
COMPONENTS=$(echo $STATS | jq '.totalComponents')
echo "Analyzed $COMPONENTS components"

# Append to monitoring log
stamp context --stats | jq -c '. + {timestamp: now}' >> .ci/stats.jsonl
```

## Output Structure

LogicStamp Context generates **folder-organized, multi-file output**:

### File Organization

```
output/
├── context_main.json          # Main index with folder metadata
├── context.json               # Root folder bundles (if any)
├── src/
│   └── context.json          # Bundles from src/ folder
└── src/components/
    └── context.json          # Bundles from src/components/
```

Each folder containing components gets its own `context.json` file. The directory structure mirrors your project layout.

### Main Index (`context_main.json`)

The `context_main.json` file serves as a directory index with:
- Summary statistics (total components, bundles, folders, tokens)
- List of all folders with their context file paths
- Folder metadata including component lists, root detection, and token estimates

### Folder Context Files

Each folder's `context.json` contains an array of bundles (one bundle per root component/entry point). Each bundle represents a complete dependency graph, with all related components and their contracts included within that bundle.

### Design: Per-Root Bundles

LogicStamp generates per-root component bundles (not individual files per component). This matches how developers work—you think in features/pages/screens, not individual atoms. When asking an LLM about "DashboardPage", you get the root bundle with DashboardPage + its full dependency graph in one shot.

Each bundle is self-contained with the complete dependency graph, so the AI sees all related components together. This structure also supports a future `--split` mode without breaking changes.

Per-component files would be useful for advanced use cases (granular Git diffs, component analytics, platform indexing), but those are future platform features, not v1 "context generation for AI chat" use cases.

**Example: `src/components/context.json`**

```json
[
  {
    "$schema": "https://logicstamp.dev/schemas/context/v0.1.json",
    "position": "1/5",
    "type": "LogicStampBundle",
    "schemaVersion": "0.1",
    "entryId": "src/components/Button.tsx",
    "depth": 1,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "bundleHash": "uifb:abc123...",
    "graph": {
      "nodes": [
        {
          "entryId": "src/components/Button.tsx",
          "contract": {
            "type": "UIFContract",
            "schemaVersion": "0.3",
            "kind": "react:component",
            "description": "Button - Interactive component",
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
            "semanticHash": "uif:...",
            "fileHash": "uif:..."
          },
          "codeHeader": "/** @uif Contract ... */"
        }
      ],
      "edges": []
    },
    "meta": {
      "missing": [],
      "source": "logicstamp-context@0.3.x"
    }
  }
]
```

**Example: `context_main.json` (Main Index)**

```json
{
  "type": "LogicStampIndex",
  "schemaVersion": "0.2",
  "projectRoot": ".",
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
    }
  ],
  "meta": {
            "source": "logicstamp-context@0.3.x"
  }
}
```

## Understanding the Output

### Contract Structure
Each component contract includes:
- **version**: Structural composition (hooks, components, functions)
- **logicSignature**: API contract (props, events, state)
- **semanticHash**: Unique hash based on logic (detects changes)
- **fileHash**: Content hash (tracks modifications)

### Dependency Graph
- **nodes**: Array of components in the bundle
- **edges**: Dependencies between components `["Parent", "Child"]`

### Missing Dependencies

The `meta.missing` array tracks dependencies that couldn't be resolved. Empty array means all dependencies were resolved. Each missing dependency has `name`, `reason`, and `referencedBy` fields.

**Common reasons and what they mean:**

| Reason | Meaning | Action Required |
|--------|---------|-----------------|
| `external package` | Third-party npm module (React, lodash, etc.) | ✅ Normal - safe to ignore |
| `file not found` | Referenced file doesn't exist | ⚠️ Fix broken import or remove reference |
| `outside scan path` | File exists but not in scanned directory | 💡 Expand scan path or ignore |
| `max depth exceeded` | Dependency beyond `--depth` limit | 💡 Increase depth if needed |
| `circular dependency` | Circular import detected | ⚠️ Refactor to break the cycle |

**Using `--strict-missing` for CI validation:**
```bash
# Exit with error if ANY missing dependencies found
stamp context --strict-missing

# In CI pipeline
stamp context --strict-missing || exit 1
```

**Best practices:**
- ✅ External packages in `missing` are expected and normal
- ⚠️ "file not found" entries indicate real issues that need fixing
- 💡 Review missing deps before sharing context with AI
- 🔍 Use `--strict-missing` in CI to catch regressions

## Integration with AI Tools

### Claude / ChatGPT

```bash
# Generate context
stamp context --profile llm-chat

# Share with AI
# "Here's my codebase context: [paste context.json]"
# "Please review the LoginForm component for best practices"
```

### Cursor / GitHub Copilot

Add to workspace context:

```json
{
  "context": {
    "codebase": "./context.json"
  }
}
```

### VS Code / IDEs

Generate context and reference in prompts:

```bash
# Generate fresh context
stamp context --out .vscode/context.json

# Reference in AI prompts
```

## Common Workflows

### 1. Project Overview for AI

```bash
# Generate comprehensive context
stamp context --depth 1 --include-code header

# Result: context.json with all components and dependencies
```

Share with AI:
> "I've provided context.json with my React component structure. Can you suggest architectural improvements?"

### 2. Component-Specific Analysis

```bash
# Focus on src directory only
stamp context ./src/components --out components-context.json

# Deep dive with full source
stamp context ./src/components --depth 2 --include-code full
```

### 3. Documentation Generation

```bash
# Generate minimal context for docs
stamp context --include-code none --format pretty --out docs/api.json
```

Use the output to auto-generate API documentation.

### 4. Code Review Context

```bash
# Balanced context for review
stamp context --profile llm-chat --out review-context.json
```

Share with reviewer or AI:
> "Please review this codebase using the provided context"

## Performance

Typical performance metrics:

| Project Size | Components | Time | Output Size |
|--------------|------------|------|-------------|
| Small | 10-20 | <1s | ~50KB |
| Medium | 50-100 | 2-5s | ~200KB |
| Large | 200+ | 5-10s | ~500KB |

**Tips for large projects:**
- Use `--max-nodes` to limit bundle size
- Focus on specific directories
- Use `--include-code none` for minimal size
- Use `--profile llm-safe` for token efficiency

## Troubleshooting

### "No components found to analyze"
- Ensure directory contains `.ts` or `.tsx` files
- Check that files contain React components or TypeScript modules
- Try specifying a different directory: `stamp context ./src`

### Bundle too large
- Reduce `--depth` (try `--depth 0` or `--depth 1`)
- Use `--include-code none` to exclude source
- Set `--max-nodes` lower (e.g., `--max-nodes 30`)
- Focus on specific subdirectories

### Missing dependencies
Missing dependencies appear in `meta.missing` and usually fall into two categories:

**Expected (safe to ignore):**
- External packages: `@mui/material`, `react`, `lodash`
- Node modules that LogicStamp doesn't analyze

**Unexpected (need attention):**
- `file not found` - Broken imports, component was deleted/moved
- Fix: Update import paths or remove references
- CI Tip: Use `--strict-missing` to catch these automatically

**Diagnosis:**
```bash
# Check what's missing
cat context.json | jq '.[] | .meta.missing'

# Run with strict validation
stamp context --strict-missing
```

### Slow analysis
- Large projects take longer to analyze
- Focus on specific directories to speed up
- Use `--max-nodes` to limit bundle generation

### Debug logging for parsing issues
If you encounter parsing errors or unexpected behavior, enable debug logging:

```bash
LOGICSTAMP_DEBUG=1 stamp context
```

This will output detailed error messages with the format:
```
[LogicStamp][DEBUG] moduleName.functionName error: { filePath: '...', error: '...', ... }
```

Debug logs help identify:
- Which files are causing parsing issues
- Which extraction steps are failing (hooks, props, state, etc.)
- File paths and error details for troubleshooting

**Note:** Debug logging is silent by default. Only enable it when troubleshooting specific issues.

## Best Practices

1. **Start with defaults**: The default `llm-chat` profile works for most cases
2. **Use headers for reviews**: Full code is rarely needed for logic analysis
3. **Set max-nodes**: Prevents overwhelming AI with too much context
4. **Focus scans**: Scan specific directories for faster results
5. **Regenerate regularly**: Run before each AI session for fresh context
6. **Version context**: Include timestamp or bundle hash in prompts

## Comparison with Full LogicStamp CLI

| Feature | logicstamp-context | @logicstamp/cli |
|---------|-------------------|-----------------|
| Installation | npm install -g logicstamp-context | npm install @logicstamp/cli |
| Usage | Standalone, instant | Requires project setup |
| Context generation | ✅ Built-in | ✅ Via context command |
| Pre-compilation | ❌ Not needed | ✅ Required (compile first) |
| Contract verification | ❌ No | ✅ Yes (verify command) |
| File output | ❌ No sidecars | ✅ Generates .uif.json |
| Use case | Quick AI context | Full contract management |

**When to use logicstamp-context:**
- Quick AI context generation
- One-off codebase analysis
- Lightweight tool
- No project configuration

**When to use @logicstamp/cli:**
- Contract management
- Continuous verification
- Full feature set

## See Also

- [README.md](../README.md) - Main documentation
- [examples/context.example.json](../examples/context.example.json) - Example output
- [LogicStamp Main Project](https://github.com/LogicStamp/logicstamp) - Orchestrator package (@logicstamp/cli)
