# Commands

LogicStamp Context ships a single CLI entry point, `stamp`, with
`context` subcommands.

| Command | Summary | When to use | Key options |
|---------|---------|-------------|-------------|
| `stamp context [path] [options]` | Generates AI-ready context bundles for your project. | Produce fresh context for AI workflows, documentation, or review. | `--depth`, `--include-code`, `--format`, `--profile`, `--max-nodes`, `--dry-run`, `--stats`, `--predict-behavior`, `--compare-modes`, `--strict-missing` |
| `stamp context validate [file]` | Validates a previously generated bundle file (defaults to `./context.json` when no file is supplied). | Gate CI pipelines, pre-commit checks, or manual QA before sharing context files. | (positional) `[file]` |
| `stamp context compare [options]` | Compares context files to detect drift and token cost changes. | CI drift detection, Jest-style approval workflows, or manual inspections. | `--approve`, `--stats` |

## Command interactions

- Run `stamp context` first to generate `context.json` or a custom-named
  output.
- Use `stamp context validate` on that output to confirm it matches the expected
  schema; the exit code is CI-friendly.
- Use `stamp context compare` to detect drift between existing and freshly
  generated context, or between two explicit files.

## Quick reference

```bash
# Generate context for your repository
stamp context

# Scan a subdirectory and use the llm-safe profile
stamp context ./src --profile llm-safe

# Validate the generated bundle before committing
stamp context validate       # defaults to ./context.json
```

