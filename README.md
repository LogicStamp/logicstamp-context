# LogicStamp Context

<div align="center">
  <img src="assets/logicstamp-fox.svg" alt="LogicStamp Fox Mascot" width="120" height="120">
</div>

![Version](https://img.shields.io/badge/version-0.2.2-blue.svg)
![Beta](https://img.shields.io/badge/status-beta-orange.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
[![CI](https://github.com/LogicStamp/logicstamp-context/workflows/CI/badge.svg)](https://github.com/LogicStamp/logicstamp-context/actions)

**A tiny CLI that compiles your React/TypeScript codebase into machine-readable context bundles for AI and CI. Fast, deterministic, zero-config.**

## Quick Start

```bash
npm install -g logicstamp-context
cd your-project
stamp context
```

That's it! LogicStamp Context will scan your project and generate `context.json` files organized by folder, plus a `context_main.json` index file. Share these files with AI assistants for instant codebase understanding.

![LogicStamp Context in action](assets/demo-screenshot.png)
*Terminal output showing `stamp context` execution and generated context.json structure*

> **Note:** This is a beta release (v0.2.2). We're actively improving the tool based on user feedback. If you encounter any issues or have suggestions, please [open an issue on GitHub](https://github.com/LogicStamp/logicstamp-context/issues).

## What is this?

**LogicStamp Context** is a lightweight tool that scans your React/TypeScript codebase and generates structured context bundles optimized for AI tools like Claude, ChatGPT, and other LLMs.

No setup, no configuration, no pre-compilation required. Just point it at your code and get instant, AI-ready documentation.

## Installation

```bash
npm install -g logicstamp-context
```

After installation, the `stamp` command will be available globally.

**Note**: "Global CLI" means the tool is installed globally on your system (via `npm install -g`), making the `stamp` command available from any directory in your terminal, not just within a specific project folder.
- **Local install**: `npm install logicstamp-context` → only available in that project
- **Global install**: `npm install -g logicstamp-context` → available everywhere via `stamp` command

## What's New in v0.2.2

🔧 **Documentation Fixes**
- **Fixed optional dependencies documentation** - Corrected all documentation to accurately reflect that `@dqbd/tiktoken` and `@anthropic-ai/tokenizer` are included as optional dependencies in package.json and are automatically installed by npm when installing `logicstamp-context`
- **Updated user-facing messages** - Console output and source code comments now correctly explain optional dependency installation behavior

## What's New in v0.2.1

🔧 **Bug Fixes**
- **Dynamic version loading** - Fixed hardcoded version string in generated context files to dynamically load from `package.json`, ensuring version consistency across all generated context files

### Changed
- Updated all version references in documentation to reflect 0.2.1 release

## What's New in v0.2.0

🎨 **Style Metadata Extraction**
- **New `stamp context style` command** - Generate design-aware context bundles with visual and layout information
- **`--include-style` flag** - Alternative syntax for enabling style metadata extraction
- **Comprehensive style detection** - Identifies Tailwind CSS, SCSS/CSS modules, inline styles, styled-components, and framer-motion
- **Layout pattern recognition** - Extracts flex/grid patterns, hero sections, feature cards, and responsive breakpoints
- **Visual design metadata** - Captures color palettes, spacing patterns, border radius, and typography classes
- **Animation detection** - Identifies framer-motion animations, CSS transitions, and viewport triggers
- **SCSS/CSS module parsing** - Analyzes imported style files to extract selectors, properties, and SCSS features

📊 **Enhanced Token Comparison**
- **Four-mode comparison** - `--compare-modes` now shows `none`, `header`, `header+style`, and `full` modes
- **Dual comparison tables** - Shows savings vs raw source and vs full context for better decision-making
- **Accurate style impact** - Automatically regenerates contracts with/without style metadata for precise token counts
- **Optional tokenizer support** - Includes `@dqbd/tiktoken` (GPT-4) and `@anthropic-ai/tokenizer` (Claude) as optional dependencies. npm automatically attempts to install them when installing `logicstamp-context`. If installation succeeds, the tool uses them for accurate token counts. If installation fails or is skipped, gracefully falls back to character-based estimation

🏗️ **Architectural Improvements**
- **Modular CLI structure** - Refactored into dedicated handlers for better maintainability and testability
- **Extracted AST parsing** - Modularized AST extraction into focused detector and extractor modules
- **Modularized style extraction** - Organized style extraction into dedicated modules (tailwind, scss, motion, layout, etc.)
- **Improved code organization** - Better separation of concerns and easier contribution

**Optional Tokenizers for Accurate Token Counts:**

LogicStamp Context includes `@dqbd/tiktoken` and `@anthropic-ai/tokenizer` as optional dependencies. npm will automatically attempt to install them when you install `logicstamp-context`, but installation may be skipped if there are build issues (this is normal for optional dependencies).

**If tokenizers are installed (automatic):**
- Token counts will be model-accurate for GPT-4 and Claude
- No additional setup required

**If tokenizers are not installed (installation failed or skipped):**
- LogicStamp Context automatically falls back to character-based estimation
- Estimates are typically within 10–15% of real token counts
- This is fine for most use cases

**To manually install tokenizers (optional):**

If the automatic installation failed and you want accurate token counts, you can install them manually:

```bash
# For local installs
npm install -D @dqbd/tiktoken @anthropic-ai/tokenizer

# For global installs
npm install -g @dqbd/tiktoken @anthropic-ai/tokenizer
```

**Important:**
- Tokenizers are installed as **optional dependencies** of `logicstamp-context` and will be installed automatically in most cases
- If automatic installation fails, LogicStamp Context gracefully falls back to character-based estimation
- You do **not** need to manually install tokenizers unless you specifically want accurate token counts and the automatic installation failed

## What's New in v0.1.1

🔧 **CI-Friendly Defaults**
- **`stamp context` no longer prompts** - Interactive prompts moved to `stamp init` for better CI/CD compatibility
- **Safe defaults** - `stamp context` now defaults to skipping both `.gitignore` and `LLM_CONTEXT.md` setup unless explicitly opted in via `stamp init`
- **Auto-config creation** - On first run, creates `.logicstamp/config.json` with safe defaults (`'skipped'` for both preferences)
- **New `--skip-gitignore` flag** - Allows skipping `.gitignore` setup on a per-run basis, useful for CI environments

🎯 **Improved Initialization**
- **`stamp init` now prompts interactively** - Prompts for both `.gitignore` patterns and `LLM_CONTEXT.md` generation (only in interactive/TTY mode)
- **Non-interactive defaults** - In CI/non-TTY environments, defaults to "yes" for both prompts
- **Better user control** - Users can explicitly set preferences via `stamp init` before running `stamp context`
- **Config-based behavior** - `stamp context` respects preferences saved in `.logicstamp/config.json` without prompting

**Migration Note:** If you were using `stamp context` interactively before, run `stamp init` once to set your preferences. Subsequent `stamp context` runs will respect your saved choices automatically.

## What's New in v0.1.0

🎉 **Token Cost Optimization**
- Automatic token estimates for GPT-4o-mini and Claude
- Mode comparison showing savings (none/header/full)
- `--compare-modes` flag for detailed token analysis

🔍 **Multi-File Context Drift Detection**
- New `compare` command with multi-file support
- Compares **all context files** using `context_main.json` as index
- Detects ADDED folders, ORPHANED folders, per-folder DRIFT, and PASS status
- Three-tier output: folder summary → component summary → detailed changes
- `--clean-orphaned` flag to automatically remove stale context files
- CI-friendly exit codes and per-folder token delta stats

⚛️ **Next.js App Router Support**
- Detects `'use client'` and `'use server'` directives
- Identifies files in Next.js App Router (`/app` directory)
- Adds metadata to contracts for framework-aware analysis

✅ **Enhanced Component Detection**
- Fixed React component detection for HTML-only JSX
- Improved dependency resolution (relative paths prioritized)
- Better handling of cross-directory component references

🛡️ **CI/CD Improvements**
- `--strict-missing` flag for dependency validation
- Enhanced `--stats` output with mode estimates
- JSON output optimized for CI parsing

## What does it generate?

LogicStamp Context analyzes your React components and outputs a structured JSON file containing:

- **Component structure**: variables, hooks, components, functions
- **Logic signatures**: props, events, state types
- **Dependency graph**: how components relate to each other
- **Code snippets**: headers or full source (configurable)
- **Semantic hashes**: for tracking changes
- **Next.js metadata**: App Router directives and file location (when applicable)

This output is designed to be easily understood by AI assistants, helping them provide better suggestions and understand your codebase architecture.

## Next.js App Router Support

LogicStamp Context automatically detects and annotates Next.js App Router components:

### Detected Features

- **`'use client'` directive** - Marks Client Components
- **`'use server'` directive** - Marks Server Actions
- **App Router location** - Identifies files in `/app` directory

### Example Contract Output

```json
{
  "type": "UIFContract",
  "kind": "react:component",
  "entryId": "app/dashboard/page.tsx",
  "nextjs": {
    "directive": "client",
    "isInAppDir": true
  }
}
```

### Benefits for AI Analysis

- **Framework-aware suggestions** - AI knows which APIs are available (client vs server)
- **Better refactoring** - AI understands boundaries between client/server code
- **Accurate recommendations** - AI won't suggest client-only hooks in Server Components

### Supported Scenarios

✅ Client Components with `'use client'`
✅ Server Actions with `'use server'`
✅ Server Components in `/app` directory (no directive)
✅ Regular components outside `/app` (no metadata)

**Note:** The `nextjs` field is only added when relevant, keeping contracts clean for non-Next.js projects.

## Usage

```bash
stamp --version                    # Show version number
stamp --help                       # Show help
stamp init [path] [options]
stamp context [path] [options]
stamp context style [path] [options]  # Generate context with style metadata
stamp context compare <old.json> <new.json> [options]
stamp context validate [file] [options]
stamp context clean [path] [options]
```

### Commands

- **`stamp init [path]`** - Initialize LogicStamp in a project by creating or updating `.gitignore` with patterns for context files (`context.json`, `context_*.json`, `.logicstamp/`, etc.), generating `LLM_CONTEXT.md` in the project root, and saving preferences to `.logicstamp/config.json`. Prompts interactively (in TTY mode) for both `.gitignore` setup and `LLM_CONTEXT.md` generation. In CI/non-TTY environments, defaults to "yes" for both. Use this command to set your preferences before running `stamp context` - subsequent `stamp context` runs will respect your saved choices automatically.

  See [docs/cli/INIT.md](docs/cli/INIT.md) for detailed documentation.

- **`stamp context [path]`** - Scans a directory and writes AI-ready context files organized by folder. Generates multiple `context.json` files (one per folder containing components) plus a `context_main.json` index file at the output root. Shows token estimates and mode comparison in output. Automatically validates the generated context before writing. **CI-friendly**: No interactive prompts - respects preferences saved in `.logicstamp/config.json` (created by `stamp init`). On first run without config, creates `.logicstamp/config.json` with safe defaults (skips both `.gitignore` and `LLM_CONTEXT.md` setup).

  See [docs/cli/CONTEXT.md](docs/cli/CONTEXT.md) for detailed documentation.

- **`stamp context style [path]`** - Generates context with style metadata included. Equivalent to `stamp context --include-style`. Extracts visual and layout information from components including Tailwind classes, SCSS/CSS modules, styled-components, framer-motion animations, layout patterns (flex/grid), color palettes, spacing, typography, and animation configurations. This makes context bundles design-aware, enabling AI assistants to understand both the logic and visual presentation of your components.

  See [docs/cli/STYLE.md](docs/cli/STYLE.md) for detailed documentation.

- **`stamp context compare [options]`** - Compares all context files (multi-file mode) or two specific files to detect drift. In multi-file mode, uses `context_main.json` as index to compare all folder context files and detect ADDED/ORPHANED folders, per-folder DRIFT, and unchanged files (PASS). Shows three-tier output: folder summary, component summary, and detailed changes. Supports `--approve` for auto-updates (Jest-style), `--clean-orphaned` to remove stale files, and `--stats` for per-folder token deltas. Exits with code 1 if drift is detected (CI-friendly).

  See [docs/cli/COMPARE.md](docs/cli/COMPARE.md) for detailed documentation.

- **`stamp context validate [file]`** - Checks an existing context file for schema and structural issues before sharing it with an AI or committing it to a repo. When no file is specified it looks for `context.json` in the current directory.

  See [docs/cli/VALIDATE.md](docs/cli/VALIDATE.md) for detailed documentation.

- **`stamp context clean [path]`** - Removes all generated context artifacts (`context_main.json`, all folder `context.json` files, and `.logicstamp/` directory if present). Safe by default (dry run), requires `--all --yes` to actually delete. Useful for resetting context files or cleaning before switching branches.

  See [docs/cli/CLEAN.md](docs/cli/CLEAN.md) for detailed documentation.

### Arguments & Options (`init` command)

- `[path]` - Target directory to initialize (default: current directory)
- `--skip-gitignore` - Skip `.gitignore` setup
- `--help`, `-h` - Show help message

See [docs/cli/INIT.md](docs/cli/INIT.md) for detailed documentation.

### Arguments (`context` command)

- `[path]` - Directory to scan (default: current directory)

### Options (`context` command)

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--depth <n>` | `-d` | Dependency traversal depth | `1` |
| `--include-code <mode>` | `-c` | Code inclusion: `none\|header\|full` | `header` |
| `--format <format>` | `-f` | Output format: `json\|pretty\|ndjson` | `json` |
| `--out <file>` | `-o` | Output directory or file path. If a `.json` file is specified, its directory is used as the output directory. Otherwise, the path is used as the output directory. | `context.json` (creates output directory) |
| `--max-nodes <n>` | `-m` | Maximum nodes per bundle | `100` |
| `--profile <profile>` | | Profile preset (see below) | `llm-chat` |
| `--strict` | `-s` | Fail on missing dependencies | `false` |
| `--strict-missing` | | Exit with error code 1 if any missing dependencies found (CI-friendly) | `false` |
| `--predict-behavior` | | Include experimental behavior predictions in contracts | `false` |
| `--dry-run` | | Skip writing output; show on-screen summary only | `false` |
| `--stats` | | Emit single-line JSON stats with token estimates (intended for CI) | `false` |
| `--compare-modes` | | Show detailed token comparison table across modes (none/header/full) | `false` |
| `--include-style` | | Extract style metadata (Tailwind, SCSS, animations, layout) | `false` |
| `--skip-gitignore` | | Skip `.gitignore` setup (never prompt or modify) | `false` |
| `--quiet` | `-q` | Suppress verbose output (show only errors) | `false` |
| `--help` | `-h` | Show help message | |

### Options (`compare` command)

| Option | Description | Default |
|--------|-------------|---------|
| `--stats` | Show token count statistics and delta | `false` |
| `--approve` | Auto-approve updates (non-interactive, CI-safe) | `false` |
| `--clean-orphaned` | Auto-delete orphaned files with `--approve` | `false` |
| `--quiet` | `-q` | Suppress verbose output (show only diffs) | `false` |
| `--help`, `-h` | Show help message | |

### Options (`validate` command)

- `[file]` – Optional path to a generated `context.json` file to validate. Defaults to `./context.json`. You can validate individual folder context files or the main index file.
- `--quiet` | `-q` – Suppress verbose output (show only errors)
- Exits with code `0` on success, `1` on invalid structure or read/parse errors.
- Prints bundle counts, node totals, and highlights schema mismatches.

### Profiles

Profiles are preset configurations optimized for different use cases:

#### `llm-chat` (default)
Balanced mode for AI chat interfaces
- Depth: 1
- Code: headers only
- Max nodes: 100
- Behavioral predictions: disabled by default (enable with `--predict-behavior`)

#### `llm-safe`
Conservative mode for token-limited contexts
- Depth: 1
- Code: headers only
- Max nodes: 30
- Behavioral predictions: disabled by default (enable with `--predict-behavior`)

#### `ci-strict`
Strict validation mode for CI/CD
- Code: none
- Strict dependencies enabled
- Behavioral predictions: not applicable (metadata-only mode)

### Behavioral Predictions

The `--predict-behavior` flag enables experimental behavioral analysis that adds predicted component behaviors to the contract output. These predictions include:

- Form validation patterns
- Side effect management (useEffect)
- Data fetching/mutation patterns
- Memoization usage
- Context consumption
- Ref usage for DOM access
- Loading/error state handling

**Note:** Behavioral predictions are **disabled by default** in all profiles to minimize token usage. Enable them explicitly when you need richer semantic information about component behavior.

**Example:**
```bash
# Enable predictions with the default profile
stamp context --predict-behavior

# Enable predictions with a specific profile
stamp context --profile llm-safe --predict-behavior
```

## Token Optimization

LogicStamp Context includes built-in token cost analysis and optimization features:

### Automatic Token Estimates

Every context generation shows token costs for both GPT-4o-mini and Claude:

```
📏 Token Estimates (header+style mode):
   GPT-4o-mini: 13,895 tokens
   Claude:      12,351 tokens

   Comparison:
     Raw source        | Header        | Header+style
         22,000        |     12,228     |     13,895

   Full context (code+style): ~39,141 GPT-4o-mini / ~34,792 Claude
```

This helps you:
- **Understand costs** at a glance
- **Choose the right mode** for your budget
- **See savings** compared to full context (code+style) mode

**Enhanced with `--compare-modes`:** The `--compare-modes` flag provides detailed comparisons across all modes (none/header/header+style/full) with accurate token counts. It automatically regenerates contracts with and without style metadata to show the true impact of including style information.

### Mode Comparison Table

Use `--compare-modes` for a detailed comparison across all modes:

```bash
stamp context --compare-modes
```

Output:
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

**When to use each mode:**
- **`none`** - API documentation, CI validation (no code snippets, no style)
- **`header`** - AI chat, code review (JSDoc headers + contracts, no style)
- **`header+style`** - Design-aware AI chat (headers + contracts + style metadata)
- **`full`** - Deep analysis, debugging (complete source code + contracts + style info)

**Note:** The `--compare-modes` flag automatically regenerates contracts with and without style metadata to provide accurate token counts for all modes. This ensures you see the true impact of including style information.

**Optional tokenizers for accurate counts:** LogicStamp Context includes `@dqbd/tiktoken` (GPT-4) and `@anthropic-ai/tokenizer` (Claude) as optional dependencies. npm will automatically attempt to install them when you install `logicstamp-context`. If installation succeeds, you get model-accurate token counts. If installation fails or is skipped (normal for optional dependencies), LogicStamp Context gracefully falls back to character-based estimation (typically within 10-15% accuracy). No manual installation is required unless you specifically want accurate counts and the automatic installation failed.

### Stats for CI/CD

Use `--stats` to get machine-readable token data:

```bash
stamp context --stats
```

Output JSON includes:
```json
{
  "tokensGPT4": 13895,
  "tokensClaude": 12351,
  "modeEstimates": {
    "none": {"gpt4": 8337, "claude": 7411},
    "header": {"gpt4": 13895, "claude": 12351},
    "full": {"gpt4": 39141, "claude": 34792}
  },
  "savingsGPT4": "65",
  "savingsClaude": "65"
}
```

## Context Drift Detection

The `compare` command helps you track changes between context versions:

### Basic Comparison

```bash
stamp context compare old.json new.json
```

Output:
```
✅ PASS

# or if changes detected:

⚠️  DRIFT

Added components: 2
  + src/components/NewButton.tsx
  + src/utils/helpers.ts

Removed components: 1
  - src/components/OldButton.tsx

Changed components: 3
  ~ src/components/Card.tsx
    Δ imports, hooks
  ~ src/App.tsx
    Δ hash
```

### With Token Stats

```bash
stamp context compare old.json new.json --stats
```

Shows token cost changes:
```
Token Stats:
  Old: 8,484 (GPT-4o-mini) | 7,542 (Claude)
  New: 9,125 (GPT-4o-mini) | 8,111 (Claude)
  Δ +641 (+7.56%)
```

### Exit Codes

- `0` - No drift (PASS)
- `1` - Drift detected or error

Perfect for CI/CD validation:
```bash
# In your CI pipeline
stamp context compare base.json pr.json || echo "Context drift detected!"
```

## Examples

### Basic usage

```bash
# Generate context for entire project
stamp context

# CLI output:
# 🔍 Scanning /path/to/project...
# ⚙️  Analyzing components...
# 🔗 Building dependency graph...
# 📦 Generating context...
# 🔍 Validating generated context...
# ✅ Validation passed
# 📝 Writing context files for 5 folders...
#    ✓ context.json (2 bundles)
#    ✓ src/context.json (3 bundles)
#    ✓ src/components/context.json (5 bundles)
#    ✓ src/utils/context.json (2 bundles)
#    ✓ app/context.json (3 bundles)
# 📝 Writing main context index...
#    ✓ context_main.json (index of 5 folders)
# ✅ 6 context files written successfully
#
# 📊 Summary:
#    Total components: 15
#    Root components: 3
#    ...
```

### Focused analysis

```bash
# Analyze only the src directory
stamp context ./src

# Analyze with custom output directory
stamp context --out ./output

# Or specify a .json file to use its directory
stamp context --out ./output/context.json  # Uses ./output as directory
```

### Deep traversal

```bash
# Include 2 levels of dependencies
stamp context --depth 2

# Include full source code
stamp context --include-code full
```

### Token cost analysis

```bash
# Show detailed mode comparison
stamp context --compare-modes

# Get JSON stats for CI
stamp context --stats

# See token costs for specific mode
stamp context --include-code none
stamp context --include-code full
```

### Context comparison

```bash
# Basic drift detection
stamp context compare old.json new.json

# With token delta stats
stamp context compare base.json pr.json --stats

# In CI pipeline
stamp context compare base.json pr.json || exit 1
```

### Clean context files

```bash
# Show what would be removed (dry run)
stamp context clean

# Actually delete all context artifacts
stamp context clean --all --yes

# Clean specific directory
stamp context clean ./output --all --yes

# Suppress verbose output (quiet mode)
stamp context --quiet
stamp context validate --quiet
stamp context compare --quiet
stamp context clean --all --yes --quiet

# Show version number
stamp --version
```

### CI/CD validation

```bash
# Use llm-safe profile for smaller output
stamp context --profile llm-safe --out safe-context.json

# Strict mode: fail if any dependencies missing
stamp context --strict-missing

# Generate stats for CI monitoring
stamp context --stats > stats.json

# Validate generated context
stamp context validate context.json
```

## Output Format

LogicStamp Context generates a **folder-organized, multi-file output structure** that maintains your project's directory hierarchy:

### File Structure

The tool writes multiple `context.json` files, one per folder containing components, plus a `context_main.json` index file at the output root:

```
output/
├── context_main.json          # Main index with folder metadata
├── context.json               # Root folder bundles (if any)
├── src/
│   └── context.json          # Bundles from src/ folder
├── src/components/
│   └── context.json          # Bundles from src/components/
└── src/utils/
    └── context.json          # Bundles from src/utils/
```

### Folder-Based Organization

Each folder's `context.json` contains bundles for components in that folder. This organization:
- **Matches your project structure** - Easy to locate context for specific directories
- **Enables incremental updates** - Only regenerate context for changed folders
- **Improves AI context loading** - Load only relevant folder contexts
- **Maintains relative paths** - Folder structure mirrors your project layout

### Main Index File (`context_main.json`)

The `context_main.json` file serves as a directory index with:

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
      "components": ["Button.tsx", "Card.tsx", "Modal.tsx"],
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
    "source": "logicstamp-context@0.1.0"
  }
}
```

**Key fields in folder entries:**
- `path` - Relative path from project root
- `contextFile` - Path to the folder's context.json file
- `bundles` - Number of bundles in this folder
- `components` - List of component files in this folder
- `isRoot` - Whether this folder is an application entry point
- `rootLabel` - Human-readable label for root folders (e.g., "Next.js App", "Project Root")
- `tokenEstimate` - Estimated token count for this folder's context

### Bundle Structure

Each folder's `context.json` contains an array of bundles (one bundle per entry point). Each bundle represents a root component plus its complete dependency graph, with all related components and their contracts included within that bundle. This per-root bundle design is optimized for how developers and LLMs work—when you need help with a specific page or feature, the root bundle contains everything related to that feature in one self-contained unit.

**📋 Full Schema Reference:** See [`schema/logicstamp.context.schema.json`](schema/logicstamp.context.schema.json) for the complete JSON Schema definition.

**Example: `src/components/context.json`**

```json
[
  {
    "$schema": "https://logicstamp.dev/schemas/context/v0.1.json",
    "position": "1/3",
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
              "variables": ["variant", "size"],
              "hooks": ["useState"],
              "components": [],
              "functions": ["handleClick"]
            },
            "logicSignature": {
              "props": {
                "onClick": { "type": "function", "signature": "() => void" },
                "variant": { "type": "literal-union", "literals": ["primary", "secondary"] }
              },
              "events": {},
              "state": {}
            },
            "nextjs": {
              "directive": "client",
              "isInAppDir": true
            }
          }
        }
      ],
      "edges": []
    },
    "meta": {
      "missing": [],
      "source": "logicstamp-context@0.1.0"
    }
  }
]
```

**📋 Full Schema Reference:** See [`schema/logicstamp.context.schema.json`](schema/logicstamp.context.schema.json) for the complete JSON Schema definition.

### Understanding the Meta Field

The `meta` section provides metadata about bundle generation and dependency resolution:

#### `missing` Array

Tracks dependencies that couldn't be resolved during analysis. An empty array `[]` means all dependencies were successfully found.

When dependencies are missing, each entry contains:
- `name` - The import specifier that couldn't be resolved (e.g., `"./MissingComponent"`)
- `reason` - Why it couldn't be found (e.g., `"file not found"`, `"external package"`)
- `referencedBy` - The component that tried to import it

**Example with missing dependencies:**
```json
{
  "meta": {
    "missing": [
      {
        "name": "./components/DeletedComponent",
        "reason": "file not found",
        "referencedBy": "src/App.tsx"
      },
      {
        "name": "@external/ui-lib",
        "reason": "external package",
        "referencedBy": "src/components/Button.tsx"
      }
    ],
    "source": "logicstamp-context@0.1.0"
  }
}
```

**Common reasons for missing dependencies:**
- `file not found` - Referenced file doesn't exist (deleted or moved)
- `external package` - Third-party npm package (intentionally excluded)
- `outside scan path` - File exists but outside the specified scan directory
- `circular dependency` - Circular import detected and skipped
- `max depth exceeded` - Dependency beyond `--depth` limit

**Using `--strict-missing` for CI/CD:**
```bash
# Exit with error code 1 if ANY missing dependencies found
stamp context --strict-missing

# Perfect for CI validation
stamp context --strict-missing || exit 1
```

#### `source` Field

Identifies the generator and version (e.g., `"logicstamp-context@0.1.0"`). Useful for:
- Debugging context generation issues
- Ensuring compatibility with consuming tools
- Tracking which version generated historical contexts

## Use Cases

### AI-Assisted Development

Share context with Claude or ChatGPT to get:
- Architecture suggestions
- Refactoring recommendations
- Bug fixes based on full component understanding

### Documentation

Generate up-to-date component documentation automatically:
- API contracts
- Dependency trees
- Component relationships

### Code Review

Quickly understand component structure and dependencies:
- Identify circular dependencies
- Find unused components
- Track component complexity

## Troubleshooting

### Handling Missing Dependencies

If your generated context shows missing dependencies in the `meta.missing` array:

#### 1. External Packages (Expected)
```json
{
  "name": "@mui/material",
  "reason": "external package"
}
```
**Solution:** This is normal. LogicStamp only analyzes your source code, not node_modules. External packages are intentionally excluded.

#### 2. File Not Found (Action Required)
```json
{
  "name": "./components/OldButton",
  "reason": "file not found",
  "referencedBy": "src/App.tsx"
}
```
**Solutions:**
- Check if the file was deleted or moved
- Update the import path in the referencing component
- Use `--strict-missing` in CI to catch these issues early

#### 3. Outside Scan Path
```json
{
  "name": "../../shared/utils",
  "reason": "outside scan path"
}
```
**Solutions:**
- Expand your scan path: `stamp context ../` (parent directory)
- Or scan from project root: `stamp context .` (from root)

#### 4. Max Depth Exceeded
```json
{
  "name": "./deeply/nested/component",
  "reason": "max depth exceeded"
}
```
**Solutions:**
- Increase depth: `stamp context --depth 2` or `--depth 3`
- Note: Higher depth = more tokens consumed

#### 5. Circular Dependencies
```json
{
  "name": "./ComponentA",
  "reason": "circular dependency"
}
```
**Solutions:**
- Refactor to break the circular import
- Extract shared logic to a separate module
- This is a code smell that should be addressed

### Common Issues

**Q: Why is my context.json huge?**
- Use `--include-code none` to exclude all source code (smallest)
- Use `--include-code header` (default) for balanced output
- Use `--profile llm-safe` for token-constrained scenarios
- Check `--compare-modes` to see token savings

**Q: Validation failed - what went wrong?**
```bash
stamp context validate context.json
# Or validate the main index
stamp context validate context_main.json
```
- Check for schema mismatches (outdated schema version)
- Verify JSON is well-formed (no trailing commas, proper escaping)
- Ensure all required fields are present
- Each folder's context.json should be a valid bundle array
- The context_main.json should have the LogicStampIndex structure

**Q: How do I ignore certain directories?**
- LogicStamp respects `.gitignore` automatically
- `node_modules/` and common build directories are excluded by default
- Scan specific directories: `stamp context ./src`

## How it Works

1. **Scan**: Finds all `.ts` and `.tsx` files in your project
2. **Analyze**: Parses React components using TypeScript AST
3. **Extract**: Builds component contracts with structure and signatures
4. **Graph**: Creates dependency graph showing relationships
5. **Bundle**: Packages context bundles optimized for AI consumption
6. **Organize**: Groups bundles by folder and writes `context.json` files maintaining directory structure
7. **Index**: Creates `context_main.json` index with folder metadata and summary statistics

All in one command, no pre-compilation needed!

## Planned Orchestrator (@logicstamp/cli)

`logicstamp-context` is the primary CLI available today. A higher-level orchestrator package `@logicstamp/cli` is planned as an optional wrapper.

| Feature | logicstamp-context | LogicStamp Orchestrator (planned) |
|---------|-------------------|----------------------------------|
| Standalone | ✅ Yes | ❌ No (wraps underlying tools) |
| Pre-compilation required | ❌ No | ✅ Yes (for verification) |
| Context generation | ✅ Yes | ✅ Yes |
| UIF contracts per file | ✅ Yes (embedded in bundles) | ✅ Yes (as `.uif.json` sidecar files) |
| Contract compilation | ✅ Built-in | ✅ Separate command |
| Contract verification | ❌ No | ✅ Yes (planned) |
| Size | Focused | Orchestrator |

**TL;DR**: Use `stamp context` (logicstamp-context) for AI context generation today. The future `@logicstamp/cli` orchestrator will provide optional higher-level workflows once it's released.

## Future Roadmap

### Next.js Enhancements (Planned)

The current Next.js support (v0.1) provides foundational directive and App Router detection. Future versions may include:

**App Router Advanced Features**
- `role` detection - Identify `page`, `layout`, `route`, `loading`, `error` files
- `segmentPath` extraction - Capture dynamic route segments (e.g., `[id]`, `[...slug]`)
- Route dependency graph - Map App Router file relationships
- Metadata exports - Detect `generateMetadata`, `generateStaticParams`

**Server Actions & RPC**
- Server Action signature extraction from `'use server'` blocks
- Form action detection and validation
- RPC call graph (client → server action relationships)

**Streaming & Suspense**
- Suspense boundary detection
- Streaming component identification
- Loading states and error boundaries

**Example Future Contract**
```json
{
  "nextjs": {
    "directive": "client",
    "isInAppDir": true,
    "role": "page",
    "segmentPath": "dashboard/[userId]",
    "hasMetadata": true
  }
}
```

**Note:** These features will be added incrementally based on community feedback and real-world usage patterns. The current implementation prioritizes the 80/20 rule - maximum value with minimal complexity.

### Other Planned Features

- **Vue.js Support** - Extend to Vue 3 Composition API components
- **Svelte Support** - Component analysis for Svelte files
- **Custom Contract Fields** - User-defined metadata via config
- **Performance Metrics** - Bundle size and render performance estimates

## Requirements

- Node.js >= 18.0.0
- TypeScript/React codebase

## License

MIT

## Contributing

Issues and PRs welcome! This is an open-source project.

**See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines**, including:
- Branching strategy (feature → `main`, no `develop` branch)
- Branch naming conventions (`feature/*`, `fix/*`, `docs/*`)
- Commit message format (Conventional Commits)
- Development workflow and best practices

## Links

- [LogicStamp Main Project](https://github.com/LogicStamp/logicstamp)
- [Report Issues](https://github.com/LogicStamp/logicstamp-context/issues)
