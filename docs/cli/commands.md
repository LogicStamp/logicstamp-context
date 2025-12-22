# Commands

LogicStamp Context provides a single CLI entry point, `stamp`, with
`context` subcommands and initialization utilities.

| Command | Summary | When to use | Key options |
|---------|---------|-------------|-------------|
| `stamp --version` | Show version number and exit. | Check installed version. | `-v` (alias) |
| `stamp init [path]` | Initialize LogicStamp in a project by setting up `.gitignore` patterns. | First-time project setup or explicit `.gitignore` configuration. | `--skip-gitignore`, `--yes`, `--no-secure` |
| `stamp ignore <path> [path2] ...` | Add files or folders to `.stampignore` to exclude them from context generation. Creates `.stampignore` if it doesn't exist. | Exclude files with secrets, large generated files, or other files that shouldn't be in context bundles. | `--quiet` |
| `stamp security scan [path]` | Scan your project for secrets (API keys, passwords, tokens). Runs 100% locally — nothing is uploaded or sent anywhere. | Prevent accidental exposure of sensitive credentials, CI/CD security checks, project initialization. | `--out`, `--quiet` |
| `stamp security --hard-reset` | Delete security report file. | Reset security configuration, start fresh after remediation. | `--force`, `--out`, `--quiet` |
| `stamp context [path] [options]` | Generates context files organized by folder (one `context.json` per folder plus `context_main.json` index). CI-friendly: never prompts, respects preferences from `stamp init`. | Produce fresh context for AI workflows, documentation, or review. | `--depth`, `--include-code`, `--format`, `--profile`, `--max-nodes`, `--dry-run`, `--stats`, `--predict-behavior`, `--compare-modes`, `--include-style`, `--strict-missing`, `--skip-gitignore`, `--out`, `--quiet` |
| `stamp context style [path] [options]` | Generates context with style metadata included. Extracts visual and layout information (Tailwind, SCSS, Material UI, animations, layout patterns). Equivalent to `stamp context --include-style`. | Design system analysis, AI-assisted design suggestions, layout understanding, animation detection. | All `stamp context` options supported. |
| `stamp context validate [file]` | Validates context files. With no arguments, auto-detects and validates all context files using `context_main.json` (multi-file mode). With a file argument, validates that specific file (single-file mode). Falls back to `context.json` if `context_main.json` doesn't exist. | Gate CI pipelines, pre-commit checks, or manual QA before sharing context files. Ensures all folder context files are valid. | `[file]` (positional), `--quiet` |
| `stamp context compare [options]` | Compares all context files (multi-file mode) or two specific files to detect drift, ADDED/ORPHANED folders, and token cost changes. Auto-detects `context_main.json` for comprehensive project-wide comparison. | CI drift detection, Jest-style approval workflows, manual inspections, or detecting folder reorganizations. | `--approve`, `--clean-orphaned`, `--stats`, `--skip-gitignore`, `--quiet` |
| `stamp context clean [path] [options]` | Removes all generated context artifacts (`context_main.json`, all folder `context.json` files, and `.logicstamp/` directory if present). Safe by default (dry run), requires `--all --yes` to actually delete. | Reset context files, clean before switching branches, or remove context artifacts from a project. | `--all`, `--yes`, `--quiet` |

## Command interactions

- `stamp init` sets up `.gitignore` patterns and `LLM_context.md` non-interactively (by default) before generating context files. `stamp context` respects these preferences and never prompts (CI-friendly). By default, `stamp init` automatically runs a security scan, which makes it non-interactive. Use `--no-secure` to skip the security scan and enable interactive prompts (in TTY mode).
- `stamp ignore` adds files or folders to `.stampignore` to exclude them from context generation. Useful for excluding files with secrets or other sensitive information. After running `stamp security scan`, review the report and use `stamp ignore <file>` to exclude files with detected secrets.
- `stamp security scan` finds secrets (API keys, passwords, tokens) in your project. Runs 100% locally—nothing is uploaded or sent anywhere. The scan runs automatically during `stamp init` by default. Review the security report and use `stamp ignore <file>` to exclude files with secrets from context generation.
- `stamp context` generates multiple `context.json` files (one per folder) plus `context_main.json` index, or use `--out` for a custom output directory. Automatically excludes files listed in `.stampignore`.
- `stamp context style` generates context with style metadata (Tailwind, SCSS, Material UI, animations, layout patterns). Equivalent to `stamp context --include-style`.
- `stamp context validate` validates **all context files** (multi-file mode using `context_main.json`) or a specific file. With no arguments, automatically validates all folder context files. Exit code is CI-friendly.
- `stamp context compare` detects drift across **all context files** (multi-file mode using `context_main.json`) or between two specific files. Automatically detects ADDED folders, ORPHANED folders, per-folder DRIFT, and unchanged files (PASS). Use `--clean-orphaned` to automatically remove stale context files.
- `stamp context clean` removes all context artifacts. Safe by default (shows what would be removed), requires `--all --yes` to delete files. Useful for resetting context files or cleaning before switching branches.

## Quick reference

```bash
# Show version number
stamp --version

# Initialize LogicStamp in your project (sets up .gitignore and LLM_context.md preferences)
# Non-interactive by default, security scan runs automatically
stamp init

# Explicitly skip prompts (redundant - already non-interactive by default)
stamp init --yes

# Initialize without security scan (enables interactive prompts in TTY mode)
stamp init --no-secure

# Add files to .stampignore to exclude from context generation
stamp ignore src/secrets.ts

# Add multiple files or use glob patterns
stamp ignore src/config/credentials.ts "**/*.key"

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

# Scan with custom output path
stamp security scan --out ./reports/security.json

# Reset security configuration (delete security report)
stamp security --hard-reset --force
```

## See also

For detailed documentation on specific features and commands:

- [context.md](context.md) - Complete `stamp context` command reference
- [style.md](style.md) - Style metadata extraction guide
- [compare-modes.md](compare-modes.md) - Token cost analysis and mode comparison
- [compare.md](compare.md) - Context drift detection and comparison
- [init.md](init.md) - Project initialization guide
- [ignore.md](ignore.md) - Adding files to `.stampignore` for exclusion
- [validate.md](validate.md) - Schema validation reference
- [security-scan.md](security-scan.md) - Security scanning and secret detection guide

