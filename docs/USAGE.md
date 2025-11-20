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
stamp context [path] [options]
stamp context validate [file]
stamp context compare [oldFile] [newFile] [options]
stamp context clean [path] [options]
```

## Commands

### `stamp context`

Generates LogicStamp bundles from a directory.

**Arguments**

- `[path]` – Directory to scan (defaults to current working directory)

**Key options**

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--depth <n>` | `-d` | `1` | Dependency traversal depth (0=self only, 1=direct deps, etc.) |
| `--include-code <mode>` | `-c` | `header` | Code inclusion: `none`, `header`, or `full` |
| `--format <fmt>` | `-f` | `json` | Output format: `json`, `pretty`, or `ndjson` |
| `--out <file>` | `-o` | `context.json` | Output directory or file path. If a `.json` file is specified, its directory is used as the output directory. Otherwise, the path is used as the output directory. Context files will be written maintaining folder structure within this directory. |
| `--max-nodes <n>` | `-m` | `100` | Maximum nodes to include (prevents huge bundles) |
| `--profile <name>` | | `llm-chat` | Apply preset profile (see below) |
| `--strict` | `-s` | `false` | Fail if any dependency is missing |
| `--predict-behavior` | | `false` | Include experimental behavioral predictions |
| `--dry-run` | | `false` | Skip writing the output file; prints summary instead |
| `--stats` | | `false` | Emit one-line JSON stats (helpful for CI pipelines) |
| `--help` | `-h` | | Show help message |

**CI / automation tips**

- Use `--dry-run` to inspect totals without producing files.
- Use `--stats` to emit machine-readable summary lines (combine with shell redirection).

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

**See also:** [COMPARE_COMMAND.md](./COMPARE_COMMAND.md) for comprehensive documentation.

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
| `--help` | Show help message |

**Safety features**

- **Dry run by default** – Shows what would be removed without deleting
- **Requires both flags** – Both `--all` and `--yes` must be specified to delete
- **Ignores build directories** – Automatically skips `node_modules/`, `dist/`, `build/`, `.next/`

**Use cases**

- Reset context files before regenerating
- Clean before switching git branches
- Remove context artifacts from a project

**See also:** [CLEAN.md](./CLEAN.md) for comprehensive documentation.

## Profiles

Profiles apply preset combinations for common use cases:

### `llm-chat` (Default)
Balanced mode optimized for AI chat:
- Depth: 1 (direct dependencies)
- Code: headers only
- Max nodes: 100

```bash
stamp context --profile llm-chat
```

### `llm-safe`
Conservative mode for token-limited contexts:
- Depth: 1
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

```bash
# Strict mode - fails on missing dependencies
stamp context --profile ci-strict

# Custom strict configuration
stamp context --strict --include-code none
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

### Design: Per-Root Bundles vs Per-Component Files

LogicStamp Context generates **per-root component bundles** rather than individual files per component. This design choice is intentional and optimized for how developers and LLMs actually work:

**✅ Why per-root bundles?**
- **Developer workflow**: Developers think in features/pages/screens (root components), not individual atoms. When asking an LLM for help with "DashboardPage", you want the root bundle containing DashboardPage + its full dependency graph in one shot.
- **Dependency context**: Having the full dependency graph inside each root bundle means the AI sees all related components and their relationships together, improving understanding and suggestions.
- **Self-contained units**: Each bundle is completely self-contained—you can share a single bundle with an LLM and it has everything needed to understand that feature.
- **Future-proof for splitting**: The current structure naturally supports a future `--split` mode that would write each root bundle to its own file (`/logicstamp/bundles/<entryId>.json`) plus an index, without any breaking changes.

**❓ Why not per-component files?**
True per-component splitting (where each component is its own file) would be useful for advanced use cases like:
- Super granular Git diff/cache behavior per component
- Component-level analytics across repositories  
- Platform-level component indexing/search

These are advanced concerns for future LogicStamp platform features, not v1 "context generation for AI chat" use cases.

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
      "source": "logicstamp-context@0.1.0"
    }
  }
]
```

**Example: `context_main.json` (Main Index)**

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
    }
  ],
  "meta": {
    "source": "logicstamp-context@0.1.0"
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

The `meta.missing` array tracks dependencies that couldn't be resolved. An empty array `[]` means complete dependency resolution.

**Structure of each missing dependency:**
```json
{
  "name": "import specifier",
  "reason": "why it failed",
  "referencedBy": "component that imports it"
}
```

**Complete example with multiple missing types:**
```json
{
  "meta": {
    "missing": [
      {
        "name": "@mui/material",
        "reason": "external package",
        "referencedBy": "src/components/Button.tsx"
      },
      {
        "name": "./DeletedComponent",
        "reason": "file not found",
        "referencedBy": "src/App.tsx"
      },
      {
        "name": "../../shared/utils",
        "reason": "outside scan path",
        "referencedBy": "src/helpers.ts"
      }
    ],
    "source": "logicstamp-context@0.1.0"
  }
}
```

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
| Watch mode | ❌ No | ✅ Yes (observe command) |
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
- Watch mode for changes
- Full feature set

## See Also

- [README.md](../README.md) - Main documentation
- [examples/context.example.json](../examples/context.example.json) - Example output
- [LogicStamp Main Project](https://github.com/yourusername/logicstamp) - Full CLI
