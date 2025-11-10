# `logicstamp-validate` Command

Verify that a generated LogicStamp context file matches the expected schema and
structure.

```bash
logicstamp-validate [file]
```

- `[file]` – Optional path to the bundle file created by the `context` command.
  Defaults to `context.json` in the current working directory.

## What it checks

- File exists and parses as JSON.
- Top-level value is an array of `LogicStampBundle` objects.
- Each bundle has the required fields (`type`, `schemaVersion`, `entryId`,
  `graph`, `meta`, etc.).
- Contracts stored within nodes are `UIFContract` with schema version `0.3`.
- Warns when bundle hashes or schema versions diverge from expected values.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | File is structurally valid (warnings may be present). |
| `1` | Validation failed (schema errors, unreadable file, or invalid JSON). |
| `1` | Usage error (missing `<file>` argument). |

## Example

```bash
# Validate the default output file in the current directory
logicstamp-validate

# Validate custom named bundle
logicstamp-validate artifacts/review-context.json
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

- Pair with the `context` command to block merges when bundles become invalid.
- Combine with `npm run` scripts or Git hooks for automated checks.
- Use the exit code to fail pipelines and prompt regeneration of context files.

