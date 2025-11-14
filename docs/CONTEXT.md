# `context` Command

Generate AI-ready bundles that describe your React/TypeScript codebase.

```bash
logicstamp-context [path] [options]
```

- `[path]` (optional) – Directory to scan. Defaults to the current working
  directory. Paths can be relative (`./src`) or absolute.

## Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--depth <n>` | `-d` | `1` | Dependency traversal depth (`0` = entry only, `1` = direct deps, etc.). |
| `--include-code <mode>` | `-c` | `header` | Include `none`, `header`, or `full` source snippets. |
| `--format <fmt>` | `-f` | `json` | Output format: `json`, `pretty`, `ndjson`. |
| `--out <file>` | `-o` | `context.json` | Output file path. |
| `--max-nodes <n>` | `-m` | `100` | Maximum graph nodes per bundle. |
| `--profile <name>` | | `llm-chat` | Preset configuration (`llm-chat`, `llm-safe`, `ci-strict`). |
| `--strict` | `-s` | `false` | Fail when dependencies are missing. |
| `--predict-behavior` | | `false` | Experimental behavioral prediction annotations. |
| `--dry-run` | | `false` | Skip writing the output; display summary only. |
| `--stats` | | `false` | Emit single-line JSON stats (ideal for CI). |
| `--help` | `-h` | | Print usage help. |

## Profiles

- **llm-chat** *(default)* – Depth 1, header-only source, max 100 nodes. Balanced output for AI chat.
- **llm-safe** – Depth 1, header-only source, max 30 nodes, allows missing dependencies. Smaller footprint.
- **ci-strict** – No source code, strict dependency checks. Fails when contracts are missing.

## Example workflows

```bash
# Scan entire repo and write context.json (defaults)
logicstamp-context

# Generate context for ./src with pretty-printed output
logicstamp-context ./src --format pretty

# Include full source for deep AI reviews (limit nodes for safety)
logicstamp-context --include-code full --max-nodes 20

# Gather metrics without writing a file (e.g., CI dashboards)
logicstamp-context --stats >> .ci/context-stats.jsonl

# Dry run to confirm counts before overwriting an existing file
logicstamp-context ./packages/ui --dry-run
```

## Output highlights

- Bundles follow the `LogicStampBundle` schema (`schemaVersion: "0.1"`).
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
logicstamp-context --strict-missing || exit 1
```

## Tips

- Combine `--profile` presets with manual flags for tailored runs (e.g.,
  `--profile llm-safe --format pretty`).
- Use `--max-nodes` to keep bundle size manageable before sharing with LLMs.
- Run `logicstamp-validate` after generation to catch schema drift early.

