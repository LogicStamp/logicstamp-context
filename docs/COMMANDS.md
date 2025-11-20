# Commands

LogicStamp Context ships a single CLI entry point, `stamp`, with
`context` subcommands and initialization utilities.

| Command | Summary | When to use | Key options |
|---------|---------|-------------|-------------|
| `stamp init [path]` | Initialize LogicStamp in a project by setting up `.gitignore` patterns. | First-time project setup or explicit `.gitignore` configuration. | `--skip-gitignore` |
| `stamp context [path] [options]` | Generates AI-ready context files organized by folder (one `context.json` per folder plus `context_main.json` index). Includes smart detection to auto-add `.gitignore` patterns. | Produce fresh context for AI workflows, documentation, or review. | `--depth`, `--include-code`, `--format`, `--profile`, `--max-nodes`, `--dry-run`, `--stats`, `--predict-behavior`, `--compare-modes`, `--strict-missing`, `--out` |
| `stamp context validate [file]` | Validates a previously generated context file (defaults to `./context.json` when no file is supplied). Can validate folder context files or the main index. | Gate CI pipelines, pre-commit checks, or manual QA before sharing context files. | (positional) `[file]` |
| `stamp context compare [options]` | Compares all context files (multi-file mode) or two specific files to detect drift, ADDED/ORPHANED folders, and token cost changes. Auto-detects `context_main.json` for comprehensive project-wide comparison. | CI drift detection, Jest-style approval workflows, manual inspections, or detecting folder reorganizations. | `--approve`, `--clean-orphaned`, `--stats` |
| `stamp context clean [path] [options]` | Removes all generated context artifacts (`context_main.json`, all folder `context.json` files, and `.logicstamp/` directory if present). Safe by default (dry run), requires `--all --yes` to actually delete. | Reset context files, clean before switching branches, or remove context artifacts from a project. | `--all`, `--yes` |

## Command interactions

- Run `stamp init` (optional) to set up `.gitignore` patterns before generating context files. Alternatively, `stamp context` will auto-add patterns on first run.
- Run `stamp context` to generate multiple `context.json` files (one per folder) plus `context_main.json` index, or use `--out` for a custom output directory.
- Use `stamp context validate` on any context file (folder contexts or main index) to confirm it matches the expected schema; the exit code is CI-friendly.
- Use `stamp context compare` to detect drift across **all context files** (multi-file mode using `context_main.json`) or between two specific files. Automatically detects ADDED folders, ORPHANED folders, per-folder DRIFT, and unchanged files (PASS). Use `--clean-orphaned` to automatically remove stale context files.
- Use `stamp context clean` to remove all context artifacts. Safe by default (shows what would be removed), requires `--all --yes` to actually delete files. Useful for resetting context files or cleaning before switching branches.

## Quick reference

```bash
# Initialize LogicStamp in your project (optional - context command does this automatically)
stamp init

# Generate context for your repository
stamp context

# Scan a subdirectory and use the llm-safe profile
stamp context ./src --profile llm-safe

# Validate the generated bundle before committing
stamp context validate       # defaults to ./context.json

# Or validate the main index
stamp context validate context_main.json

# Compare all context files for drift (multi-file mode)
stamp context compare        # uses context_main.json as index

# Auto-approve and update all drifted files (like jest -u)
stamp context compare --approve

# Compare with stats and clean up orphaned files
stamp context compare --approve --clean-orphaned --stats

# Compare two specific context files
stamp context compare old.json new.json

# Clean all context artifacts (dry run - shows what would be removed)
stamp context clean

# Actually delete all context files
stamp context clean --all --yes
```

