# Commands

LogicStamp Context ships a single CLI entry point, `stamp`, with
`context` subcommands and initialization utilities.

| Command | Summary | When to use | Key options |
|---------|---------|-------------|-------------|
| `stamp init [path]` | Initialize LogicStamp in a project by setting up `.gitignore` patterns. | First-time project setup or explicit `.gitignore` configuration. | `--skip-gitignore` |
| `stamp context [path] [options]` | Generates AI-ready context files organized by folder (one `context.json` per folder plus `context_main.json` index). Includes smart detection to auto-add `.gitignore` patterns. | Produce fresh context for AI workflows, documentation, or review. | `--depth`, `--include-code`, `--format`, `--profile`, `--max-nodes`, `--dry-run`, `--stats`, `--predict-behavior`, `--compare-modes`, `--strict-missing`, `--out` |
| `stamp context validate [file]` | Validates a previously generated context file (defaults to `./context.json` when no file is supplied). Can validate folder context files or the main index. | Gate CI pipelines, pre-commit checks, or manual QA before sharing context files. | (positional) `[file]` |
| `stamp context compare [options]` | Compares context files to detect drift and token cost changes. | CI drift detection, Jest-style approval workflows, or manual inspections. | `--approve`, `--stats` |

## Command interactions

- Run `stamp init` (optional) to set up `.gitignore` patterns before generating context files. Alternatively, `stamp context` will auto-add patterns on first run.
- Run `stamp context` to generate multiple `context.json` files (one per folder) plus `context_main.json` index, or use `--out` for a custom output directory.
- Use `stamp context validate` on any context file (folder contexts or main index) to confirm it matches the expected schema; the exit code is CI-friendly.
- Use `stamp context compare` to detect drift between existing and freshly generated context files, or between two explicit files.

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
```

