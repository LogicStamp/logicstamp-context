# Commands

LogicStamp Context ships with two CLI entry points installed as separate
executables.

| Command | Summary | When to use | Key options |
|---------|---------|-------------|-------------|
| `logicstamp-context [path] [options]` | Generates AI-ready context bundles for your project. | Produce fresh context for AI workflows, documentation, or review. | `--depth`, `--include-code`, `--format`, `--profile`, `--max-nodes`, `--dry-run`, `--stats`, `--predict-behavior` |
| `logicstamp-validate [file]` | Validates a previously generated bundle file (defaults to `./context.json` when no file is supplied). | Gate CI pipelines, pre-commit checks, or manual QA before sharing context files. | (positional) `[file]` |

## Command interactions

- Run `logicstamp-context` first to generate `context.json` or a custom-named
  output.
- Use `logicstamp-validate` on that output to confirm it matches the expected
  schema; the exit code is CI-friendly.
- Both binaries can be aliased independently (e.g., `alias lsc="logicstamp-context"`).

## Quick reference

```bash
# Generate context for your repository
logicstamp-context

# Scan a subdirectory and use the llm-safe profile
logicstamp-context ./src --profile llm-safe

# Validate the generated bundle before committing
logicstamp-validate          # defaults to ./context.json
```

