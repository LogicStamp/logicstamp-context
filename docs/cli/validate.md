# `stamp context validate` Command

Check that generated LogicStamp context files match the expected schema and structure. Supports both multi-file validation (all folders) and single-file validation.

```bash
stamp context validate [file]
```

- `[file]` – Optional path to a context file created by `stamp context`.
  - **No arguments:** Validates all context files using `context_main.json` (multi-file mode). Falls back to `context.json` if `context_main.json` doesn't exist.
  - **With a file argument:** Validates that specific file (single-file mode). Can be a folder context file or the main index file.

## What it checks

### Multi-File Mode (default with no arguments)

When `context_main.json` exists, validates **all** context files in your project:
- Reads `context_main.json` to find all folder context files
- Validates each folder's `context.json` file
- Reports a summary across all folders:
  - Total valid/invalid folders
  - Total errors and warnings across all files
  - Total nodes and edges across all files
- Shows detailed validation results for each folder
- Exit code shows overall validation status (fails if any folder is invalid)

### Single-File Mode (with file argument)

Validates a specific context file:

#### For Folder Context Files (`context.json`)
- File exists and parses as JSON
- Top-level value is an array of `LogicStampBundle` objects
- Each bundle has the required fields (`type`, `schemaVersion`, `entryId`,
  `graph`, `meta`, etc.)
- Contracts stored within nodes are `UIFContract` with schema version `0.3`
- Warns when bundle hashes or schema versions diverge from expected values

#### For Main Index File (`context_main.json`)
- File exists and parses as JSON
- Structure matches `LogicStampIndex` schema
- Contains required fields: `type`, `schemaVersion`, `projectRoot`, `summary`, `folders`, `meta`
- Each folder entry has valid structure with `path`, `contextFile`, `bundles`, `components`, etc.

**Note:** Validating only `context_main.json` (single-file mode) doesn't validate the folder context files themselves. Use multi-file mode (no arguments) to validate all files.

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--quiet` | `-q` | Suppress verbose output (show only errors) |
| `--help` | `-h` | Show help message |

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | All files are structurally valid (warnings may be present). |
| `1` | Validation failed (schema errors, unreadable file, invalid JSON, or any folder is invalid in multi-file mode). |

## Examples

### Multi-File Mode (validates all context files)

```bash
# Validate all context files using context_main.json
stamp context validate
```

Sample successful multi-file run:

```
🔍 Validating all context files using "context_main.json"...

✅ All context files are valid

📁 Validation Summary:
   Total folders: 3
   ✅ Valid: 3
   Total errors: 0
   Total warnings: 0
   Total nodes: 87
   Total edges: 102

📂 Folder Details:

   ✅ VALID: context.json
      Path: .
      Bundles: 2, Nodes: 15, Edges: 18

   ✅ VALID: src/context.json
      Path: src
      Bundles: 5, Nodes: 42, Edges: 51

   ✅ VALID: src/components/context.json
      Path: src/components
      Bundles: 3, Nodes: 30, Edges: 33
```

Multi-file run with errors:

```
🔍 Validating all context files using "context_main.json"...

❌ Validation failed

📁 Validation Summary:
   Total folders: 3
   ✅ Valid: 2
   ❌ Invalid: 1
   Total errors: 1
   Total warnings: 0
   Total nodes: 57
   Total edges: 69

📂 Folder Details:

   ✅ VALID: context.json
      Path: .
      Bundles: 2, Nodes: 15, Edges: 18

   ❌ INVALID: src/context.json
      Path: src
      Errors: 1
        ❌ Bundle 1: Invalid type (expected 'LogicStampBundle', got 'Invalid')

   ✅ VALID: src/components/context.json
      Path: src/components
      Bundles: 3, Nodes: 42, Edges: 51
```

### Single-File Mode (validates a specific file)

```bash
# Validate a specific folder's context file
stamp context validate src/components/context.json

# Validate the main index file only (doesn't validate folder files)
stamp context validate context_main.json

# Validate custom named bundle
stamp context validate artifacts/review-context.json

# Suppress verbose output (show only errors)
stamp context validate --quiet
```

Sample successful single-file run:

```
🔍 Validating "context.json"...
✅ Valid context file with 4 bundle(s)
   Total nodes: 37
   Total edges: 42
```

Warnings example (still exits 0):

```
🔍 Validating "context.json"...
⚠️  Bundle 2: Node src/components/Card.tsx has unexpected contract version 0.2
✅ Valid with 1 warning(s)
```

## CI/CD Usage

- Use with `stamp context` to block merges when context files become invalid
- Use multi-file mode (no arguments) to validate **all** context files in one command
- Combine with `npm run` scripts or Git hooks for automated checks
- Use the exit code to fail pipelines and prompt regeneration of context files
- Multi-file mode validates everything across the entire project

**Example CI validation:**
```bash
# Validate all context files in one command (recommended)
stamp context validate

# This automatically validates:
# - context_main.json structure
# - All folder context.json files referenced in the index
# - Reports comprehensive summary across all files
# - Fails if ANY file is invalid
```

**Legacy single-file approach (not recommended):**
```bash
# Manual validation of individual files (old approach)
stamp context validate context_main.json && \
stamp context validate context.json && \
stamp context validate src/components/context.json
```

Multi-file mode is preferred because it:
- Finds all context files from the index automatically
- Validates everything in one command
- Provides a summary across all files
- Detects if any folder context files are missing or corrupted

