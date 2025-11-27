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

## Interactive Prompts

The `stamp init` command prompts you interactively (in TTY mode) for both `.gitignore` and `LLM_CONTEXT.md` setup:

### .gitignore Setup Prompt

When `.gitignore` doesn't already have LogicStamp patterns, you'll see:

```
💡 LogicStamp generates large context files that are usually not committed.

   The following patterns will be added to .gitignore:
   - context.json
   - context_*.json
   - *.uif.json
   - logicstamp.manifest.json
   - .logicstamp/

Add recommended patterns to .gitignore? [Y/n]
```

**If you choose "Y" (or just press Enter):**
- Patterns are added to `.gitignore`
- Preference saved as `"added"` in `.logicstamp/config.json`
- `stamp context` will automatically maintain patterns in future runs

**If you choose "n":**
- `.gitignore` is not modified
- Preference saved as `"skipped"` in `.logicstamp/config.json`
- `stamp context` will never touch `.gitignore`

### LLM_CONTEXT.md Generation Prompt

When `LLM_CONTEXT.md` doesn't exist, you'll see:

```
💡 LogicStamp can generate LLM_CONTEXT.md to help AI assistants understand your project structure.

Generate LLM_CONTEXT.md in project root? [Y/n]
```

**If you choose "Y" (or just press Enter):**
- `LLM_CONTEXT.md` is created in the project root
- Preference saved as `"added"` in `.logicstamp/config.json`
- `stamp context` will automatically maintain the file in future runs

**If you choose "n":**
- `LLM_CONTEXT.md` is not created
- Preference saved as `"skipped"` in `.logicstamp/config.json`
- `stamp context` will never create this file

### Non-Interactive Mode (CI)

In CI or non-TTY environments:
- Prompts default to "yes" (non-interactive)
- Both operations will be performed automatically
- Preferences are still saved to config

### Behavior in `stamp context`

The `stamp context` command **never prompts** - it respects the preferences you set via `stamp init`:

- **If config has `"added"` preference**: Automatically performs the operation
- **If config has `"skipped"` preference**: Skips the operation
- **If no config exists**: Defaults to skipping (safe, CI-friendly behavior)

You can override per-run with the `--skip-gitignore` flag:

```bash
stamp context --skip-gitignore  # Never touch .gitignore this run
```

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

- Your `.gitignore` already has the necessary patterns
- You prefer to manually manage `.gitignore` and `LLM_CONTEXT.md`
- You're running `stamp context` in CI (it defaults to skipping both operations)

## Related Commands

- [`stamp context`](CONTEXT.md) - Generate context files (includes smart detection)
- [`stamp context validate`](VALIDATE.md) - Validate generated context files
- [`stamp context compare`](COMPARE_COMMAND.md) - Detect drift in context files
