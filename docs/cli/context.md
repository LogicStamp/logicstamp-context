# `stamp context` Command

Generate bundles organized by folder that describe your React/TypeScript codebase.

```bash
stamp context [path] [options]
```

- `[path]` (optional) – Directory to scan. Defaults to the current working
  directory. Paths can be relative (`./src`) or absolute.

**Output Structure:** Generates multiple `context.json` files (one per folder containing components) plus a `context_main.json` index file at the output root, keeping your project's directory structure.

**Setup:** `stamp context` respects preferences saved in `.logicstamp/config.json` and never prompts. On first run (no config), it defaults to skipping both `.gitignore` and `LLM_CONTEXT.md` setup for CI-friendly behavior. Use [`stamp init`](init.md) to interactively configure these options.

**File Exclusion:** `stamp context` respects `.stampignore` and excludes those files from context generation. This keeps files with secrets or sensitive info out of your bundles. You'll see how many files were excluded (unless using `--quiet`). Run `stamp security scan --apply` to automatically add files to `.stampignore` when secrets are found. See [`stamp security scan`](security-scan.md) for details.

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
| `--stats` | | `false` | Emit single-line JSON stats (ideal for CI). When combined with `--compare-modes`, writes `context_compare_modes.json` for MCP integration. |
| `--compare-modes` | | `false` | Show detailed token comparison table across all modes (none/header/header+style/full) with accurate style metadata impact. When combined with `--stats`, writes `context_compare_modes.json` for MCP (Model Context Protocol) integration. See [compare-modes.md](compare-modes.md) for comprehensive guide. |
| `--include-style` | | `false` | Extract style metadata (Tailwind, SCSS, Material UI, animations, layout). |
| `--skip-gitignore` | | `false` | Skip `.gitignore` setup (never prompt or modify). |
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

# Generate context with style metadata
stamp context style
# Or use the flag (equivalent)
stamp context --include-style

# Compare token costs across all modes (including style)
stamp context --compare-modes
# See compare-modes.md for comprehensive guide

# Generate comparison data file for MCP integration
stamp context --compare-modes --stats
# Creates: context_compare_modes.json with structured comparison data

# Custom output directory
stamp context --out ./output
# Or specify a file to use its directory
stamp context --out ./output/context.json
```

## File Exclusion with .stampignore

Files in `.stampignore` are excluded from context generation (no flags needed). You'll see how many files were excluded (unless using `--quiet`). Supports glob patterns and exact file paths.

Example `.stampignore`:
```json
{
  "ignore": [
    "src/config/secrets.ts",
    "src/api/keys.ts",
    "**/*.secret.ts"
  ]
}
```

Use `stamp security scan --apply` to automatically detect files with secrets and add them to `.stampignore`. The file is only created when secrets are actually detected. See [`stamp security scan`](security-scan.md) for details.

## Output Structure

LogicStamp Context creates a **folder-organized, multi-file output**:

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
    "source": "logicstamp-context@0.2.7"
  }
}
```

Each folder entry includes: `path`, `contextFile`, `bundles`, `components`, `isRoot`, `rootLabel`, and `tokenEstimate`.

Each folder's `context.json` contains bundles with:
- Contracts (UIFContract schema v0.3)
- Dependency graph (`nodes` and `edges`)
- `meta.missing` for unresolved dependencies: `file not found`, `external package`, `outside scan path`, `max depth exceeded`, `circular dependency`

## Understanding meta.missing

An empty `missing` array means all dependencies were resolved. Non-empty means some couldn't be found.

**Expected (safe to ignore):** External packages (React, lodash, etc.)

**Actionable:** "file not found" (broken imports), "outside scan path" (expand scan directory), "max depth exceeded" (increase `--depth`)

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
- Use `stamp context style` or `--include-style` to extract visual and layout metadata for design-aware context bundles. See [style.md](style.md) for detailed documentation.
- Use `--compare-modes` to see accurate token estimates across all modes (none/header/header+style/full) and understand the cost impact of including style metadata.

## Token Estimation

Token counts are estimated using character-based approximations by default (~4 characters per token for GPT-4, ~4.5 for Claude). 

**Optional Tokenizers:** LogicStamp Context includes `@dqbd/tiktoken` (GPT-4) and `@anthropic-ai/tokenizer` (Claude) as optional dependencies. npm installs them automatically when you install `logicstamp-context`. If that works, you get model-accurate token counts. If it fails or is skipped (normal for optional dependencies), it falls back to character-based estimation.

If you need accurate token counts and the automatic installation failed, you can manually install them:

```bash
# For accurate GPT-4 token counts
npm install @dqbd/tiktoken

# For accurate Claude token counts
npm install @anthropic-ai/tokenizer
```

If these packages are installed, `--compare-modes` and token estimates throughout the tool will automatically use them for precise token counting.

## Error Handling

The parser handles errors gracefully—malformed code returns empty AST structures instead of crashing, so it keeps processing other files.

Error handling is silent by default. Enable debug logging:

```bash
LOGICSTAMP_DEBUG=1 stamp context
```

Debug logs show file paths, failed extraction steps (hooks, props, components, state, events), and error messages with module-specific prefixes.

Files with syntax errors return empty AST structures but won't crash the tool. Use `--strict-missing` in CI to catch missing dependencies early.

