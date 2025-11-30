# `stamp context` Command

Generate AI-ready bundles organized by folder that describe your React/TypeScript codebase.

```bash
stamp context [path] [options]
```

- `[path]` (optional) – Directory to scan. Defaults to the current working
  directory. Paths can be relative (`./src`) or absolute.

**Output Structure:** The command generates multiple `context.json` files (one per folder containing components) plus a `context_main.json` index file at the output root, maintaining your project's directory hierarchy.

**Setup:** `stamp context` respects preferences saved in `.logicstamp/config.json` and never prompts. On first run (no config), it defaults to skipping both `.gitignore` and `LLM_CONTEXT.md` setup for CI-friendly behavior. Use [`stamp init`](init.md) to interactively configure these options.

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
    "source": "logicstamp-context@0.2.6"
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
- Use `stamp context style` or `--include-style` to extract visual and layout metadata for design-aware context bundles. See [style.md](style.md) for detailed documentation.
- Use `--compare-modes` to see accurate token estimates across all modes (none/header/header+style/full) and understand the cost impact of including style metadata.

## Token Estimation

Token counts are estimated using character-based approximations by default (~4 characters per token for GPT-4, ~4.5 for Claude). 

**Optional Tokenizers:** LogicStamp Context includes `@dqbd/tiktoken` (GPT-4) and `@anthropic-ai/tokenizer` (Claude) as optional dependencies. npm will automatically attempt to install them when you install `logicstamp-context`. If installation succeeds, you get model-accurate token counts. If installation fails or is skipped (normal for optional dependencies), the tool gracefully falls back to character-based estimation.

If you need accurate token counts and the automatic installation failed, you can manually install them:

```bash
# For accurate GPT-4 token counts
npm install @dqbd/tiktoken

# For accurate Claude token counts
npm install @anthropic-ai/tokenizer
```

If these packages are installed, `--compare-modes` and token estimates throughout the tool will automatically use them for precise token counting.

## Error Handling

The AST parser handles errors gracefully by default. When parsing fails or encounters malformed code, it returns an empty AST structure instead of crashing, allowing the tool to continue processing other files.

**Behavior:**
- Invalid file paths return empty AST structures
- Malformed TypeScript/React syntax is handled gracefully
- Individual extraction failures (hooks, props, components, state, events, etc.) don't stop the entire process
- Each extractor function (componentExtractor, propExtractor, stateExtractor, eventExtractor) has its own error handling
- The tool continues processing other files even when some fail

**Debug Logging:**

All error handling is silent by default. To enable debug logging for troubleshooting, set the `LOGICSTAMP_DEBUG=1` environment variable:

```bash
LOGICSTAMP_DEBUG=1 stamp context
```

When enabled, error logs include:
- The file path where the error occurred
- The specific extraction step that failed (hooks, props, components, state, events, etc.)
- The error message
- Module-specific prefixes for easier filtering

Example debug output:
```
[LogicStamp][DEBUG] astParser.safeExtract error: { filePath: '/path/to/file.tsx', error: 'Cannot read property \'name\' of undefined', context: 'hooks' }
[LogicStamp][DEBUG] astParser.extractFromFile error: { filePath: '/path/to/file.tsx', message: 'Unexpected token' }
[LogicStamp][DEBUG] componentExtractor.extractHooks error: { filePath: '/path/to/file.tsx', error: 'Invalid AST node' }
[LogicStamp][DEBUG] propExtractor.extractProps error: { filePath: '/path/to/file.tsx', error: 'Type resolution failed' }
[LogicStamp][DEBUG] stateExtractor.extractState error: { filePath: '/path/to/file.tsx', error: 'Pattern match error' }
[LogicStamp][DEBUG] eventExtractor.extractEvents error: { filePath: '/path/to/file.tsx', error: 'Signature parsing failed' }
[LogicStamp][DEBUG] detector.detectNextJsDirective error: { filePath: '/path/to/file.tsx', error: 'Failed to read file text' }
[LogicStamp][DEBUG] detector.detectKind error: { filePath: '/path/to/file.tsx', error: 'AST traversal error' }
```

**Error Handling Architecture:**
- **Main parser** (`extractFromFile`): Catches top-level errors and returns empty AST
- **Extractor functions**: Each extractor (hooks, components, props, state, events, routes) has try-catch blocks around risky operations
- **Detector functions**: Next.js directive detection and component kind detection have error handling with graceful fallbacks
- **Graceful fallbacks**: All extractors return empty arrays/objects on errors; detectors return `undefined` or default values (`ts:module` for kind detection)
- **Debug logging**: Each module logs errors with its own prefix when `LOGICSTAMP_DEBUG=1` is set

**Troubleshooting Tips:**
- Enable `LOGICSTAMP_DEBUG=1` if you suspect parsing issues
- Check debug logs to identify which files and extraction steps are causing problems
- Files with syntax errors will return empty AST structures but won't crash the tool
- Individual extractor failures are logged separately for easier debugging
- Use `--strict-missing` in CI to catch missing dependencies early

