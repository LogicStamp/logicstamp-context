# `stamp context validate` Command

Verify that a generated LogicStamp context file matches the expected schema and
structure. Can validate both folder `context.json` files and the `context_main.json` index file.

```bash
stamp context validate [file]
```

- `[file]` – Optional path to a context file created by the `stamp context` command.
  Defaults to `context.json` in the current working directory. Can be a folder context file or the main index file.

## What it checks

### For Folder Context Files (`context.json`)

- File exists and parses as JSON.
- Top-level value is an array of `LogicStampBundle` objects.
- Each bundle has the required fields (`type`, `schemaVersion`, `entryId`,
  `graph`, `meta`, etc.).
- Contracts stored within nodes are `UIFContract` with schema version `0.3`.
- Warns when bundle hashes or schema versions diverge from expected values.

### For Main Index File (`context_main.json`)

- File exists and parses as JSON.
- Structure matches `LogicStampIndex` schema.
- Contains required fields: `type`, `schemaVersion`, `projectRoot`, `summary`, `folders`, `meta`.
- Each folder entry has valid structure with `path`, `contextFile`, `bundles`, `components`, etc.
- Warns when schema versions diverge from expected values.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | File is structurally valid (warnings may be present). |
| `1` | Validation failed (schema errors, unreadable file, or invalid JSON). |
| `1` | Usage error (missing `<file>` argument). |

## Example

```bash
# Validate the default context.json in the current directory (folder context)
stamp context validate

# Validate a specific folder's context file
stamp context validate src/components/context.json

# Validate the main index file
stamp context validate context_main.json

# Validate custom named bundle
stamp context validate artifacts/review-context.json
```

Sample successful run:

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

## CI/CD usage

- Pair with the `stamp context` command to block merges when context files become invalid.
- Validate both folder context files and the main index to ensure consistency.
- Combine with `npm run` scripts or Git hooks for automated checks.
- Use the exit code to fail pipelines and prompt regeneration of context files.

**Example CI validation:**
```bash
# Validate all context files
stamp context validate context_main.json && \
stamp context validate context.json && \
stamp context validate src/components/context.json
```

