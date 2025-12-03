# Commands

LogicStamp Context provides a single CLI entry point, `stamp`, with
`context` subcommands and initialization utilities.

| Command | Summary | When to use | Key options |
|---------|---------|-------------|-------------|
| `stamp --version` | Show version number and exit. | Check installed version. | `-v` (alias) |
| `stamp init [path]` | Initialize LogicStamp in a project by setting up `.gitignore` patterns. | First-time project setup or explicit `.gitignore` configuration. | `--skip-gitignore`, `--yes`, `--secure` |
| `stamp security scan [path]` | Scan your project for secrets (API keys, passwords, tokens). Runs 100% locally — nothing is uploaded or sent anywhere. | Prevent accidental exposure of sensitive credentials, CI/CD security checks, project initialization. | `--out`, `--apply`, `--quiet` |
| `stamp security --hard-reset` | Delete `.stampignore` and security report file, resetting security configuration. | Reset security configuration, start fresh after remediation. | `--force`, `--out`, `--quiet` |
| `stamp context [path] [options]` | Generates context files organized by folder (one `context.json` per folder plus `context_main.json` index). CI-friendly: never prompts, respects preferences from `stamp init`. | Produce fresh context for AI workflows, documentation, or review. | `--depth`, `--include-code`, `--format`, `--profile`, `--max-nodes`, `--dry-run`, `--stats`, `--predict-behavior`, `--compare-modes`, `--include-style`, `--strict-missing`, `--skip-gitignore`, `--out`, `--quiet` |
| `stamp context style [path] [options]` | Generates context with style metadata included. Extracts visual and layout information (Tailwind, SCSS, Material UI, animations, layout patterns). Equivalent to `stamp context --include-style`. | Design system analysis, AI-assisted design suggestions, layout understanding, animation detection. | All `stamp context` options supported. |
| `stamp context validate [file]` | Validates context files. With no arguments, auto-detects and validates all context files using `context_main.json` (multi-file mode). With a file argument, validates that specific file (single-file mode). Falls back to `context.json` if `context_main.json` doesn't exist. | Gate CI pipelines, pre-commit checks, or manual QA before sharing context files. Ensures all folder context files are valid. | `[file]` (positional), `--quiet` |
| `stamp context compare [options]` | Compares all context files (multi-file mode) or two specific files to detect drift, ADDED/ORPHANED folders, and token cost changes. Auto-detects `context_main.json` for comprehensive project-wide comparison. | CI drift detection, Jest-style approval workflows, manual inspections, or detecting folder reorganizations. | `--approve`, `--clean-orphaned`, `--stats`, `--quiet` |
| `stamp context clean [path] [options]` | Removes all generated context artifacts (`context_main.json`, all folder `context.json` files, and `.logicstamp/` directory if present). Safe by default (dry run), requires `--all --yes` to actually delete. | Reset context files, clean before switching branches, or remove context artifacts from a project. | `--all`, `--yes`, `--quiet` |

## Command interactions

- `stamp init` sets up `.gitignore` patterns and `LLM_context.md` interactively before generating context files. `stamp context` respects these preferences and never prompts (CI-friendly). Use `stamp init --secure` to also run a security scan automatically.
- `stamp security scan` finds secrets (API keys, passwords, tokens) in your project. Runs 100% locally—nothing is uploaded or sent anywhere. Use `--apply` to automatically add detected secret files to `.stampignore`, so they won't be included in `context.json`. The scan can be integrated with `stamp init --secure` for automated security checks during project setup.
- `stamp context` generates multiple `context.json` files (one per folder) plus `context_main.json` index, or use `--out` for a custom output directory.
- `stamp context style` generates context with style metadata (Tailwind, SCSS, Material UI, animations, layout patterns). Equivalent to `stamp context --include-style`.
- `stamp context validate` validates **all context files** (multi-file mode using `context_main.json`) or a specific file. With no arguments, automatically validates all folder context files. Exit code is CI-friendly.
- `stamp context compare` detects drift across **all context files** (multi-file mode using `context_main.json`) or between two specific files. Automatically detects ADDED folders, ORPHANED folders, per-folder DRIFT, and unchanged files (PASS). Use `--clean-orphaned` to automatically remove stale context files.
- `stamp context clean` removes all context artifacts. Safe by default (shows what would be removed), requires `--all --yes` to delete files. Useful for resetting context files or cleaning before switching branches.

## Quick reference

```bash
# Show version number
stamp --version

# Initialize LogicStamp in your project (sets up .gitignore and LLM_context.md preferences)
stamp init

# Initialize with security scan (auto-yes + security scan with --apply)
stamp init --secure

# Initialize without prompts (CI-friendly)
stamp init --yes

# Generate context for your repository
stamp context

# Generate context with style metadata
stamp context style

# Or use the flag (equivalent)
stamp context --include-style

# Scan a subdirectory and use the llm-safe profile
stamp context ./src --profile llm-safe

# Validate all context files (multi-file mode)
stamp context validate       # uses context_main.json to validate all folders

# Or validate a specific file
stamp context validate src/context.json

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

# Compare token costs across all modes
stamp context --compare-modes

# Scan your project for secrets (API keys, passwords, tokens)
# Runs 100% locally — nothing is uploaded or sent anywhere
stamp security scan

# Scan and automatically add detected secret files to .stampignore
# So they won't be included in context.json
stamp security scan --apply

# Scan with custom output path
stamp security scan --out ./reports/security.json

# Reset security configuration (delete .stampignore and report)
stamp security --hard-reset --force
```

## See also

For detailed documentation on specific features and commands:

- [context.md](context.md) - Complete `stamp context` command reference
- [style.md](style.md) - Style metadata extraction guide
- [compare-modes.md](compare-modes.md) - Token cost analysis and mode comparison
- [compare.md](compare.md) - Context drift detection and comparison
- [init.md](init.md) - Project initialization guide
- [validate.md](validate.md) - Schema validation reference
- [security-scan.md](security-scan.md) - Security scanning and secret detection guide

