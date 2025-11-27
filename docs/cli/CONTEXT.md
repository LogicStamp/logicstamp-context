# `stamp context` Command

Generate AI-ready bundles organized by folder that describe your React/TypeScript codebase.

```bash
stamp context [path] [options]
```

- `[path]` (optional) – Directory to scan. Defaults to the current working
  directory. Paths can be relative (`./src`) or absolute.

**Output Structure:** The command generates multiple `context.json` files (one per folder containing components) plus a `context_main.json` index file at the output root, maintaining your project's directory hierarchy.

**First Run:** On first run in interactive mode, `stamp context` will prompt you to:
- Add LogicStamp patterns to `.gitignore` (to exclude context files from version control)
- Generate `LLM_CONTEXT.md` in the project root (to help AI assistants understand your project structure)

Your preferences are saved in `.logicstamp/config.json` and respected on subsequent runs. See [`stamp init`](INIT.md) for explicit setup or to skip these prompts.

## Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--depth <n>` | `-d` | `1` | Dependency traversal depth (`0` = entry only, `1` = direct deps, etc.). |
| `--include-code <mode>` | `-c` | `header` | Include `none`, `header`, or `full` source snippets. |
| `--format <fmt>` | `-f` | `json` | Output format: `json`, `pretty`, `ndjson`. |
| `--out <file>` | `-o` | `context.json` | Output directory or file path. If a `.json` file is specified, its directory is used as the output directory. Otherwise, the path is used as the output directory. All context files will be written within this directory structure. |
| `--max-nodes <n>` | `-m` | `100` | Maximum graph nodes per bundle. |
| `--profile <name>` | | `llm-chat` | Preset configuration (`llm-chat`, `llm-safe`, `ci-strict`). |
| `--strict` | `-s` | `false` | Fail when dependencies are missing. |
| `--predict-behavior` | | `false` | Experimental behavioral prediction annotations. |
| `--dry-run` | | `false` | Skip writing the output; display summary only. |
| `--stats` | | `false` | Emit single-line JSON stats (ideal for CI). |
| `--quiet` | `-q` | `false` | Suppress verbose output (show only errors). |
| `--help` | `-h` | | Print usage help. |

## Profiles

- **llm-chat** *(default)* – Depth 1, header-only source, max 100 nodes. Balanced output for AI chat.
- **llm-safe** – Depth 1, header-only source, max 30 nodes, allows missing dependencies. Smaller footprint.
- **ci-strict** – No source code, strict dependency checks. Fails when contracts are missing.

## Example workflows

```bash
# Scan entire repo and write context files (defaults)
stamp context
# Creates: context_main.json + context.json files in each folder

# Generate context for ./src with pretty-printed output
stamp context ./src --format pretty

# Include full source for deep AI reviews (limit nodes for safety)
stamp context --include-code full --max-nodes 20

# Gather metrics without writing files (e.g., CI dashboards)
stamp context --stats >> .ci/context-stats.jsonl

# Dry run to confirm counts before generating files
stamp context ./packages/ui --dry-run

# Suppress verbose output (quiet mode)
stamp context --quiet

# Custom output directory
stamp context --out ./output
# Or specify a file to use its directory
stamp context --out ./output/context.json
```

## Output Structure

LogicStamp Context generates a **folder-organized, multi-file output**:

### File Organization

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

Each folder containing components gets its own `context.json` file with bundles for that folder's components. The directory structure mirrors your project layout.

### Main Index (`context_main.json`)

The `context_main.json` file provides a complete directory index:

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
    "source": "logicstamp-context@0.1.0"
  }
}
```

**Folder entry fields:**
- `path` - Relative path from project root
- `contextFile` - Path to this folder's context.json
- `bundles` - Number of bundles in this folder
- `components` - List of component file names
- `isRoot` - Whether this is an application entry point
- `rootLabel` - Label for root folders (e.g., "Next.js App", "Project Root")
- `tokenEstimate` - Token count for this folder's context

### Folder Context Files

Each folder's `context.json` contains an array of bundles following the `LogicStampBundle` schema (`schemaVersion: "0.1"`):
- Contracts embed `UIFContract` data (`schemaVersion: "0.3"`).
- A dependency graph lists `nodes` and `edges` for each bundle.
- `meta.missing` captures unresolved dependencies with detailed reasons:
  - `file not found` - Component was deleted or moved
  - `external package` - Third-party npm module (expected)
  - `outside scan path` - File exists but not in scanned directory
  - `max depth exceeded` - Dependency chain deeper than `--depth` setting
  - `circular dependency` - Circular import detected and broken

## Understanding meta.missing

An empty `missing` array (`[]`) confirms all dependencies were successfully resolved. Non-empty indicates:

**Expected missing deps:**
- External packages (React, lodash, etc.) - these are normal and safe to ignore

**Actionable missing deps:**
- "file not found" entries - indicate broken imports requiring fixes
- "outside scan path" - consider expanding scan directory
- "max depth exceeded" - increase `--depth` for fuller analysis

Use `--strict-missing` in CI to catch unexpected missing dependencies:
```bash
stamp context --strict-missing || exit 1
```

## Tips

- Combine `--profile` presets with manual flags for tailored runs (e.g.,
  `--profile llm-safe --format pretty`).
- Use `--max-nodes` to keep bundle size manageable before sharing with LLMs.
- Run `stamp context validate` after generation to catch schema drift early.
- Use `stamp context clean` to remove all context artifacts when resetting or switching branches.

