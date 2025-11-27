/**
 * Help text for CLI commands
 */

export function getMainHelp(): string {
  return `
╭─────────────────────────────────────────────────╮
│  Stamp - LogicStamp Context CLI                 │
│  AI-ready context generation for React/TS       │
╰─────────────────────────────────────────────────╯

USAGE:
  stamp init [path]                    Initialize LogicStamp in a project
  stamp context [path] [options]       Generate context
  stamp context style [path] [options] Generate context with style metadata
  stamp context validate [file]        Validate context file
  stamp context compare [options]      Detect drift (auto-generates fresh context)
  stamp context clean [path] [options] Remove all generated context artifacts

OPTIONS:
  -v, --version                       Show version number
  -h, --help                          Show this help

EXAMPLES:
  stamp init
    Set up LogicStamp in current directory (creates/updates .gitignore)

  stamp context
    Generate context.json for current directory

  stamp context style
    Generate context with style metadata (Tailwind, SCSS, animations, layout)

  stamp context --include-style
    Same as 'stamp context style' (alternative syntax)

  stamp context validate
    Validate context.json in current directory

  stamp context compare
    Auto-detect drift by comparing with fresh context

  stamp context clean
    Show what would be removed (dry run)

  stamp context clean --all --yes
    Actually delete all context artifacts

For detailed help on a specific command, run:
  stamp init --help
  stamp context --help
  stamp context style --help
  stamp context validate --help
  stamp context compare --help
  stamp context clean --help
  `;
}

export function getStyleHelp(): string {
  return `
╭─────────────────────────────────────────────────╮
│  Stamp Context Style - Generate with Style      │
│  Extract Tailwind, SCSS, animations & layout    │
╰─────────────────────────────────────────────────╯

USAGE:
  stamp context style [path] [options]

ARGUMENTS:
  [path]                              Directory to scan (default: current)

OPTIONS:
  --depth, -d <n>                     Dependency depth (default: 1)
  --include-code, -c <mode>           Code inclusion: none|header|full (default: header)
  --format, -f <format>                Output format: json|pretty|ndjson (default: json)
  --out, -o <file>                    Output file (default: context.json)
  --max-nodes, -m <n>                 Max nodes per bundle (default: 100)
  --profile <profile>                 Preset profile: llm-safe|llm-chat|ci-strict
  --strict, -s                        Fail on missing dependencies
  --strict-missing                    Exit with error if any missing dependencies
  --predict-behavior                  Include behavior predictions
  --dry-run                           Skip writing output
  --stats                             Emit JSON stats
  --skip-gitignore                    Skip .gitignore setup (never prompt or modify)
  --quiet, -q                         Suppress verbose output (show only errors)
  -h, --help                          Show this help

STYLE METADATA EXTRACTED:
  • Styling Sources: Tailwind, SCSS modules, CSS modules, inline styles, styled-components
  • Layout: Flex/grid patterns, hero sections, feature cards
  • Visual: Colors, spacing, typography, border radius
  • Animation: Framer Motion, CSS animations, scroll triggers

EXAMPLES:
  stamp context style
    Generate context with style metadata for current directory

  stamp context style ./src
    Generate with style metadata for src directory

  stamp context style --profile llm-safe
    Use conservative profile with style metadata

NOTES:
  • This is equivalent to: stamp context --include-style
  • Style extraction is optional and won't fail the build if errors occur
  • Style metadata is added to the 'style' field in UIFContract
  `;
}

export function getGenerateHelp(): string {
  return `
╭─────────────────────────────────────────────────╮
│  Stamp Context - Generate AI Context            │
│  Scan and analyze React/TS codebase             │
╰─────────────────────────────────────────────────╯

USAGE:
  stamp context [path] [options]

ARGUMENTS:
  [path]                              Directory to scan (default: current)

OPTIONS:
  --depth, -d <n>                     Dependency depth (default: 1)
  --include-code, -c <mode>           Code inclusion: none|header|full (default: header)
  --include-style                     Extract style metadata (Tailwind, SCSS, animations, layout)
  --format, -f <format>               Output format: json|pretty|ndjson (default: json)
  --out, -o <file>                    Output file (default: context.json)
  --max-nodes, -m <n>                 Max nodes per bundle (default: 100)
  --profile <profile>                 Preset profile: llm-safe|llm-chat|ci-strict
  --strict, -s                        Fail on missing dependencies
  --strict-missing                    Exit with error if any missing dependencies
  --predict-behavior                  Include behavior predictions
  --dry-run                           Skip writing output
  --stats                             Emit JSON stats
  --compare-modes                     Show detailed mode comparison table
  --skip-gitignore                    Skip .gitignore setup (never prompt or modify)
  --quiet, -q                         Suppress verbose output (show only errors)
  -h, --help                          Show this help

EXAMPLES:
  stamp context
    Generate context for current directory

  stamp context style
    Generate context with style metadata (Tailwind, SCSS, animations, layout)

  stamp context --include-style
    Alternative syntax for including style metadata

  stamp context ./src --depth 2
    Deep scan of src directory

  stamp context --include-code none --out api.json
    Generate API documentation only

  stamp context --compare-modes
    Show token cost comparison across modes

  stamp context --quiet
    Suppress verbose output (show only errors)
  `;
}

export function getValidateHelp(): string {
  return `
╭─────────────────────────────────────────────────╮
│  Stamp Context Validate - Bundle Validator      │
│  Validate context.json structure and schema     │
╰─────────────────────────────────────────────────╯

USAGE:
  stamp context validate [file]

ARGUMENTS:
  [file]                              Path to context.json (default: context.json)

OPTIONS:
  --quiet                             Show only errors (suppress summaries and valid folders)
  -h, --help                          Show this help

EXAMPLES:
  stamp context validate
    Validate context.json in current directory

  stamp context validate docs/api-context.json
    Validate a specific context file

  stamp context validate --quiet
    Show only validation errors

NOTES:
  • Validates bundle structure and schema compliance
  • Checks for required fields and hash formats
  • Exits with code 0 on success, 1 on failure
  `;
}

export function getCompareHelp(): string {
  return `
╭─────────────────────────────────────────────────╮
│  Stamp Context Compare - Drift Detection        │
│  Compare context files for changes              │
╰─────────────────────────────────────────────────╯

USAGE:
  stamp context compare [options]                     Auto-compare all context files
  stamp context compare <old.json> <new.json>         Compare two specific files
  stamp context compare <old_main.json> <new_main.json>  Compare multi-file indices

ARGUMENTS:
  <old.json>                          Path to old context file or context_main.json
  <new.json>                          Path to new context file or context_main.json

OPTIONS:
  --approve                           Auto-approve updates (non-interactive, CI-safe)
  --clean-orphaned                    Auto-delete orphaned files with --approve
  --quiet                             Show only diffs (suppress summaries, PASS folders, and token analysis)
  -h, --help                          Show this help

COMPARISON MODES:
  Auto-Mode (Multi-File):
    Compares ALL context files using context_main.json as index
    → Detects ADDED, ORPHANED, DRIFT, and PASS status per folder
    → Shows three-tier output: folder summary, component summary, details

  Single-File Mode:
    Compares two individual context.json files
    → Detects added/removed/changed components

  Multi-File Manual Mode:
    Auto-detects when comparing context_main.json files
    → Compares all referenced context files

EXAMPLES:
  stamp context compare
    Auto-mode: generate fresh context, compare ALL files
    → Shows folder-level and component-level changes
    → Interactive: prompts Y/N to update if drift detected
    → CI: exits with code 1 if drift detected (no prompt)

  stamp context compare --approve
    Auto-approve and update ALL context files if drift (like jest -u)

  stamp context compare --approve --clean-orphaned
    Auto-approve updates and delete orphaned context files

  stamp context compare --stats
    Show per-folder token count deltas

  stamp context compare --quiet
    Show only diffs (suppress summaries, PASS folders, and status headers)

  stamp context compare old.json new.json
    Compare two specific context files

  stamp context compare old/context_main.json new/context_main.json
    Compare all context files between two directories

  stamp context compare || exit 1
    CI validation: fail build if drift detected

EXIT CODES:
  0                                   PASS - No drift OR drift approved and updated
  1                                   DRIFT - Changes detected but not approved

BEHAVIOR:
  • --approve: Non-interactive, deterministic, updates immediately if drift
  • Interactive (TTY): Prompts "Update all context files? (y/N)" if drift
  • CI (non-TTY): Never prompts, exits 1 if drift detected
  • --clean-orphaned: Requires --approve, deletes orphaned files automatically
  • --quiet: Shows only diffs - suppresses status headers (PASS), summaries, PASS folders, and token analysis

DRIFT INDICATORS:
  ➕ ADDED FILE         New folder with context file
  🗑️  ORPHANED FILE     Folder removed (context file still exists)
  ⚠️  DRIFT             Folder has component changes
  ✅ PASS               Folder unchanged

NOTES:
  This matches Jest snapshot workflow:
    jest          → prompts to update snapshots locally
    jest -u       → updates snapshots without prompt
    CI            → fails if snapshots don't match
  `;
}

export function getCleanHelp(): string {
  return `
╭─────────────────────────────────────────────────╮
│  Stamp Context Clean - Remove Artifacts        │
│  Delete all generated context files            │
╰─────────────────────────────────────────────────╯

USAGE:
  stamp context clean [path] [options]

ARGUMENTS:
  [path]                              Directory to clean (default: current)

OPTIONS:
  --all                               Include all context files
  --yes                               Confirm deletion (required with --all)
  --quiet, -q                         Suppress verbose output (show only errors)
  -h, --help                          Show this help

BEHAVIOR:
  • Default (dry run): Shows what would be removed
  • --all --yes: Actually deletes the files
  • Automatically includes .logicstamp/ directory if it exists
  • --quiet: Shows only ✓ on success, errors otherwise

FILES REMOVED:
  • context_main.json                 Main index file
  • **/context.json                   All folder context files
  • .logicstamp/                      Cache directory (if present)

EXAMPLES:
  stamp context clean
    Show what would be removed (dry run)

  stamp context clean --all --yes
    Actually delete all context artifacts (includes .logicstamp/ if present)

  stamp context clean --all --yes --quiet
    Delete files silently (show only ✓)

  stamp context clean ./src --all --yes
    Clean context files in specific directory

NOTES:
  • Safe by default - requires --all --yes to actually delete
  • Ignores node_modules, dist, build, .next directories
  • Exits with code 0 on success
  `;
}

export function getInitHelp(): string {
  return `
╭─────────────────────────────────────────────────╮
│  Stamp Init - Initialize LogicStamp            │
│  Set up LogicStamp in your project              │
╰─────────────────────────────────────────────────╯

USAGE:
  stamp init [path] [options]

ARGUMENTS:
  [path]                              Target directory (default: current)

OPTIONS:
  --skip-gitignore                    Skip .gitignore setup
  -h, --help                          Show this help

EXAMPLES:
  stamp init
    Set up LogicStamp in current directory

  stamp init ./my-project
    Set up LogicStamp in a specific directory

  stamp init --skip-gitignore
    Initialize without modifying .gitignore

WHAT IT DOES:
  • Creates or updates .gitignore with LogicStamp patterns:
    - context.json
    - context_*.json
    - *.uif.json
    - logicstamp.manifest.json
    - .logicstamp/

NOTES:
  • Safe to run multiple times (idempotent)
  • Won't duplicate patterns if they already exist
  • Creates .gitignore if it doesn't exist
  `;
}

