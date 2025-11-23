# Stamp Init Command

Initialize LogicStamp in your project by setting up `.gitignore` patterns and other project configuration.

## Usage

```bash
stamp init [path] [options]
```

## Arguments

- `[path]` - Target directory to initialize (default: current directory)

## Options

- `--skip-gitignore` - Skip `.gitignore` setup
- `-h, --help` - Show help

## What It Does

The `stamp init` command sets up LogicStamp in your project by:

1. **Creating or updating `.gitignore`** with LogicStamp-specific patterns:
   - `context.json` - Context files generated per folder
   - `context_*.json` - Main index and other context variants
   - `*.uif.json` - UIF contract files
   - `logicstamp.manifest.json` - Dependency manifest files
   - `.logicstamp/` - Configuration directory

2. **Generating `LLM_CONTEXT.md`** in the project root (if it doesn't already exist) - A guide that helps AI assistants understand your project structure and how to work with LogicStamp context files

3. **Creating `.logicstamp/config.json`** to save your preferences so `stamp context` won't prompt again

## Examples

### Basic initialization

```bash
stamp init
```

Initializes LogicStamp in the current directory. Creates or updates `.gitignore` with the necessary patterns.

### Initialize a specific directory

```bash
stamp init ./my-project
```

Initializes LogicStamp in the specified directory.

### Skip .gitignore setup

```bash
stamp init --skip-gitignore
```

Initializes LogicStamp but skips modifying `.gitignore`. Useful if you want to manage `.gitignore` manually.

## Behavior

### When .gitignore doesn't exist

Creates a new `.gitignore` file with LogicStamp patterns:

```
✅ Created .gitignore with LogicStamp patterns

   The following patterns were added/verified:
   - context.json
   - context_*.json
   - *.uif.json
   - logicstamp.manifest.json
```

### When .gitignore exists but doesn't have LogicStamp patterns

Adds LogicStamp patterns to the existing `.gitignore`:

```
✅ Added LogicStamp patterns to existing .gitignore

   The following patterns were added/verified:
   - context.json
   - context_*.json
   - *.uif.json
   - logicstamp.manifest.json
```

### When .gitignore already has LogicStamp patterns

No changes are made:

```
ℹ️  .gitignore already contains LogicStamp patterns

   The following patterns were added/verified:
   - context.json
   - context_*.json
   - *.uif.json
   - logicstamp.manifest.json
```

### LLM_CONTEXT.md Generation

The `stamp init` command also generates `LLM_CONTEXT.md` in your project root:

```
✅ Created LLM_CONTEXT.md
```

**If `LLM_CONTEXT.md` already exists:**
```
ℹ️  LLM_CONTEXT.md already exists
```

This file provides guidance for AI assistants on how to understand and work with your LogicStamp context files. It's automatically generated from the package template and includes information about:
- Project structure and context file organization
- How to load and use context files
- Understanding bundle structure and metadata
- Interpreting missing dependencies

## Smart Detection in `stamp context`

The `stamp context` command includes smart setup management for both `.gitignore` and `LLM_CONTEXT.md` with the following behavior:

### First Time (No Config)

When you run `stamp context` for the first time in a project (in interactive mode), you'll be prompted for two things:

**1. `.gitignore` setup:**
```
💡 LogicStamp generates large context files that are usually not committed.

Add recommended patterns to .gitignore? [Y/n]
```

**If you choose "Y" (or just press Enter):**
- Patterns are added to `.gitignore`
- Preference saved as `"added"` in `.logicstamp/config.json`
- Future runs won't prompt - patterns will be maintained automatically

**If you choose "n":**
- `.gitignore` is not modified
- Preference saved as `"skipped"` in `.logicstamp/config.json`
- Future runs won't prompt - `.gitignore` will never be touched

**2. `LLM_CONTEXT.md` generation:**
```
💡 LogicStamp can generate LLM_CONTEXT.md to help AI assistants understand your project structure.

Generate LLM_CONTEXT.md in project root? [Y/n]
```

**If you choose "Y" (or just press Enter):**
- `LLM_CONTEXT.md` is created in the project root
- Preference saved as `"added"` in `.logicstamp/config.json`
- Future runs won't prompt - file will be maintained automatically

**If you choose "n":**
- `LLM_CONTEXT.md` is not created
- Preference saved as `"skipped"` in `.logicstamp/config.json`
- Future runs won't prompt - file will never be created

### Subsequent Runs

Once you've answered the prompt:
- Your choice is remembered in `.logicstamp/config.json`
- No more prompts
- `stamp context` respects your preference forever

### Non-Interactive Mode (CI)

In CI or non-TTY environments:
- Never prompts
- Never auto-adds patterns
- Use `stamp init` or `--skip-gitignore` flag to control behavior explicitly

### Override with Flags

You can always override the behavior per-run:

```bash
stamp context --skip-gitignore  # Never touch .gitignore this run
```

### When to Use `stamp init`

Use `stamp init` when you want to:
- Explicitly set up `.gitignore` before generating context
- Skip the interactive prompt (runs non-interactively)
- Set the "added" preference upfront so `stamp context` never prompts

## Safety

The `stamp init` command is:

- **Idempotent** - Safe to run multiple times without duplicating patterns
- **Non-destructive** - Preserves existing `.gitignore` content
- **Safe by default** - Only adds patterns, never removes anything

## When to Use

### Use `stamp init` when:

- Setting up LogicStamp in a new project
- You want explicit control over initialization
- You want to set up `.gitignore` before generating context files

### You don't need `stamp init` if:

- You're fine with automatic `.gitignore` setup when running `stamp context`
- Your `.gitignore` already has the necessary patterns
- You prefer to manually manage `.gitignore`

## Related Commands

- [`stamp context`](CONTEXT.md) - Generate context files (includes smart detection)
- [`stamp context validate`](VALIDATE.md) - Validate generated context files
- [`stamp context compare`](COMPARE_COMMAND.md) - Detect drift in context files
