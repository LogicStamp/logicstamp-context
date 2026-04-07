# CLI Getting Started Guide

This guide will walk you through using LogicStamp Context via the command-line interface (CLI). You'll learn how to install, initialize, and generate context files for your TypeScript codebase.

## Installation

### Global Installation (Recommended)

Install LogicStamp Context globally to use the `stamp` command from anywhere:

```bash
npm install -g logicstamp-context
```

After installation, verify it works:

```bash
stamp --version
```

You should see the LogicStamp fox mascot and version number.

### Local Installation

Alternatively, install it locally in your project:

```bash
npm install logicstamp-context
```

Then use it via `npx`:

```bash
npx stamp context
```

### Try Without Installing

You can also try LogicStamp Context without installing:

```bash
npx -y logicstamp-context@latest context
```

### Troubleshooting: `npx` vs global `stamp`

If `npx` misbehaves but `stamp` works (or the opposite), an outdated or conflicting global install may be involved. Remove it and stick to one workflow:

```bash
npm uninstall -g logicstamp-context
```

Then either reinstall globally (`npm install -g logicstamp-context`) or run via `npx` only (for example `npx -y logicstamp-context@latest context`).

## Step 1: Initialize Your Project (Recommended)

**Note:** `stamp init` is **recommended** for a complete setup. You can run `stamp context` without initialization—it will use safe defaults (skips `.gitignore` setup and `LLM_CONTEXT.md` generation for CI-friendly behavior). However, running `stamp init` provides several benefits:

```bash
stamp init
```

**What `stamp init` does:**

1. **Sets up `.gitignore`** - Adds patterns to prevent committing generated files:
   - `context.json` - Per-folder context bundles
   - `context_*.json` - Main index and variants
   - `context.toon` - TOON format bundles
   - `*.uif.json` - UIF contract files
   - `.logicstamp/` - Configuration directory
   - `stamp_security_report.json` - Security scan reports

2. **Runs security scan** - Automatically scans for secrets (API keys, passwords, tokens) in your codebase

3. **Generates `LLM_CONTEXT.md`** - Creates a guide for AI assistants to understand your project structure

4. **Creates `.logicstamp/config.json`** - Saves preferences so `stamp context` never prompts (CI-friendly)

**Options:**

```bash
# Skip security scan (enables interactive prompts)
stamp init --no-secure

# Skip .gitignore setup
stamp init --skip-gitignore

# Initialize specific directory
stamp init ./my-project
```

> **💡 Tip:** If you skip `stamp init`, you can still run `stamp context` directly. It will work with safe defaults, but you'll miss out on automatic `.gitignore` setup, security scanning, and `LLM_CONTEXT.md` generation. You can always run `stamp init` later to configure these options.

📋 **See [Init Documentation](init.md)** for complete details.

## Step 2: Generate Context

Now generate context files for your project:

```bash
stamp context
```

> **Stack fit:** LogicStamp runs **alongside** `tsc` and your build—it compiles AI-oriented contracts and graphs, not a full-program typecheck. See [Relationship to TypeScript](../getting-started.md#relationship-to-typescript-tsc).

**What you get:**

- 📁 **`context.json` files** - One per folder containing components, preserving your directory structure
- 📋 **`context_main.json`** - Main index file with project overview and folder metadata

**Output structure:**

```
your-project/
├── context_main.json          # Main index
├── context.json               # Root folder bundles (if any)
├── src/
│   └── context.json          # Bundles from src/ folder
├── src/components/
│   └── context.json          # Bundles from src/components/
└── src/utils/
    └── context.json          # Bundles from src/utils/
```

## Step 3: Understand the Output

### Main Index (`context_main.json`)

The main index provides a complete directory overview:

```json
{
  "type": "LogicStampIndex",
  "schemaVersion": "0.2",
  "projectRoot": ".",
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
      "tokenEstimate": 5234
    }
  ]
}
```

### Folder Bundles (`context.json`)

Each folder's `context.json` contains component contracts:

```json
{
  "type": "LogicStampBundle",
  "entryId": "src/components/Button.tsx",
  "graph": {
    "nodes": [
      {
        "entryId": "src/components/Button.tsx",
        "contract": {
          "kind": "react:component",
          "interface": {
            "props": {
              "variant": { "type": "literal-union", "literals": ["primary", "secondary"] },
              "onClick": { "type": "function", "signature": "() => void" }
            }
          },
          "composition": {
            "hooks": ["useState"],
            "components": ["./Icon"]
          }
        }
      }
    ],
    "edges": [["src/components/Button.tsx", "./Icon"]]
  }
}
```

📋 **See [Schema Documentation](../reference/schema.md)** for complete format details.

## Common Options

### Generate Context for Specific Directory

```bash
stamp context ./src
```

### Include Style Metadata

Extract visual and layout information (Tailwind, SCSS, Material UI, etc.):

```bash
stamp context style
# Or use the flag
stamp context --include-style
```

📋 **See [Style Documentation](style.md)** for details.

### Custom Output Directory

```bash
stamp context --out ./output
```

### Use Different Profiles

```bash
# Balanced output (default)
stamp context --profile llm-chat

# Smaller footprint
stamp context --profile llm-safe

# Contracts only, strict checks
stamp context --profile ci-strict
```

### Adjust Dependency Depth

```bash
# Include nested components (default: depth=2)
stamp context --depth 2

# Only direct dependencies
stamp context --depth 1

# Deeper nesting
stamp context --depth 3
```

📋 **See [Context Documentation](context.md)** for all options.

## Watch Mode (Recommended for Development)

Keep context fresh automatically as you code:

```bash
# Basic watch mode
stamp context --watch

# Watch with style metadata
stamp context style --watch

# Strict watch mode (detects breaking changes)
# (--strict-watch automatically enables watch mode)
stamp context --strict-watch
```

**Features:**
- ✅ **Incremental rebuilds** - Only rebuilds affected bundles
- ✅ **Change detection** - Shows what changed (props, hooks, etc.)
- ✅ **Debouncing** - Batches rapid changes (500ms delay)
- ✅ **Breaking change detection** - Use `--strict-watch` to catch removed props/events and track violations

**Strict Watch Mode** (`--strict-watch`) goes beyond regular watch mode by:
- Classifying changes as breaking (removed props, events, functions)
- Tracking violations during your coding session
- Reporting violations summary on exit

📋 **See [Watch Mode Documentation](watch.md)** for complete details, including strict watch mode.

## Excluding Files

If you need to exclude files from context compilation:

```bash
# Add files to .stampignore
stamp ignore src/secrets.ts
stamp ignore src/config/credentials.ts

# Add multiple files
stamp ignore src/secrets.ts src/config/keys.ts

# Add glob patterns
stamp ignore "**/secrets.ts" "**/*.key"
```

Files in `.stampignore` are automatically excluded when running `stamp context`.

📋 **See [Ignore Documentation](ignore.md)** for details.

## Validating Context Files

Validate generated context files:

```bash
stamp context validate
```

Or validate a specific file:

```bash
stamp context validate context_main.json
```

📋 **See [Validate Documentation](validate.md)** for details.

## Comparing Context (Drift Detection)

Detect changes in your codebase by comparing context files:

```bash
# Compare all context files
stamp context compare

# Approve changes (update context files)
stamp context compare --approve
```

This shows:
- Added/removed components
- Changed props, hooks, dependencies
- Breaking changes

📋 **See [Compare Documentation](compare.md)** for details.

## Security Scanning

LogicStamp Context includes automatic secret protection:

### Run Security Scan

```bash
stamp security scan
```

This scans your codebase for secrets (API keys, passwords, tokens) and generates `stamp_security_report.json`.

### Automatic Sanitization

If a security report exists, `stamp context` automatically replaces detected secrets with `"PRIVATE_DATA"` in generated JSON files. **Your source code files are never modified.**

📋 **See [Security Scan Documentation](security-scan.md)** for details.

## Common Workflows

### Development Workflow

```bash
# 1. Initialize project (one-time)
stamp init

# 2. Start watch mode (keeps context fresh)
stamp context --watch
# Or strict watch: breaking changes + violations (implies watch)
stamp context --strict-watch

# 3. Code normally - context regenerates automatically
```

### CI/CD Workflow

```bash
# Generate context in CI
stamp context --profile ci-strict --strict-missing

# Validate context files
stamp context validate

# Compare for drift detection
stamp context compare
```

### Style-Aware Workflow

```bash
# Generate context with style metadata
stamp context style

# Watch with style metadata
stamp context style --watch
```

### Token Cost Analysis

Compare token costs across different modes:

```bash
stamp context --compare-modes
```

This shows token estimates for:
- `none` - Contracts only (~79% savings)
- `header` - Contracts + JSDoc (~65% savings, recommended)
- `header+style` - Header + style metadata (~52% savings)
- `full` - Complete source code (no savings)

📋 **See [Compare Modes Documentation](compare-modes.md)** for details.

## Troubleshooting

### Context files not generating

- **Check Node.js version**: Requires Node.js >= 20
- **Verify TypeScript files exist**: LogicStamp only analyzes `.ts` and `.tsx` files
- **Check for errors**: Run with `LOGICSTAMP_DEBUG=1 stamp context` for detailed logs

### Missing dependencies

If you see `meta.missing` entries in context files:

- **External packages** (React, lodash, etc.) - Expected, safe to ignore
- **"file not found"** - Check import paths
- **"outside scan path"** - Expand scan directory or adjust paths
- **"max depth exceeded"** - Increase `--depth` parameter

Use `--strict-missing` in CI to catch unexpected missing dependencies:

```bash
stamp context --strict-missing || exit 1
```

### Large bundle sizes

- **Reduce depth**: Use `--depth 1` for direct dependencies only
- **Lower max-nodes**: Use `--max-nodes 30` to limit bundle size
- **Use profiles**: `--profile llm-safe` limits to 30 nodes
- **Exclude files**: Use `.stampignore` to exclude large files

### Watch mode not detecting changes

- **Check file types**: Watch mode monitors `.ts`, `.tsx`, and style files (with `--include-style`)
- **Verify file paths**: Ensure files are within the scanned directory
- **Check permissions**: Ensure LogicStamp can read your files
- **Use debug mode**: `stamp context --watch --debug` shows detailed hash information

## Next Steps

- **[Usage Guide](../guides/usage.md)** - Comprehensive command reference
- **[Watch Mode](watch.md)** - Auto-regenerate context as you code
- **[Schema Documentation](../reference/schema.md)** - Understanding output format
- **[Framework Guides](../frameworks/)** - Framework-specific documentation
- **[Troubleshooting](../guides/usage.md#troubleshooting)** - Common issues and solutions

## Quick Reference

```bash
# Installation
npm install -g logicstamp-context

# Initialize
stamp init

# Generate context
stamp context

# Watch mode
stamp context --watch

# Watch + breaking-change detection (implies --watch)
stamp context --strict-watch

# With style metadata
stamp context style

# Validate
stamp context validate

# Compare
stamp context compare

# Security scan
stamp security scan

# Exclude files
stamp ignore <file>
```

---

**Ready to dive deeper?** Check out the [Usage Guide](../guides/usage.md) for comprehensive documentation on all commands and options.