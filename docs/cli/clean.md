# `stamp context clean` Command

Remove all generated context artifacts from your project. Use this to reset your context files and start fresh.

```bash
stamp context clean [path] [options]
```

- `[path]` (optional) – Directory to clean. Defaults to the current working directory. Paths can be relative (`./src`) or absolute.

## Behavior

**Default (dry run):** Shows what would be removed without actually deleting anything. Safe way to preview the cleanup.

**With `--all --yes`:** Deletes all context artifacts. Both flags are required to prevent accidental deletions.

## Options

| Option | Description |
|--------|-------------|
| `--all` | Include all context files in the deletion operation |
| `--yes` | Confirm deletion (required with `--all`) |
| `--quiet` | `-q` | Suppress verbose output (show only errors) |
| `--help`, `-h` | Show help message |

## Files Removed

Removes:

- **`context_main.json`** – Main index file with folder metadata
- **`**/context.json`** – All folder context files (recursively, JSON format)
- **`**/context.toon`** – All folder TOON format bundles
- **`**/context_*.toon`** – TOON format variants (e.g. `context_main.toon`)
- **`.logicstamp/`** – Cache directory (if present, automatically included)

Automatically detects and includes the `.logicstamp/` directory if it exists. No separate flag needed.

## Examples

### Preview what would be removed (dry run)

```bash
# Show what would be removed without deleting
stamp context clean
```

Output:
```
🧹 This will remove:
  - context_main.json
  - src/components/context.json
  - src/hooks/context.json
  - src/ui/context.json
  - .logicstamp/

💡 Run with --all --yes to confirm and delete these files.
```

### Actually delete all context artifacts

```bash
# Delete all context files
stamp context clean --all --yes
```

Output:
```
🧹 This will remove:
  - context_main.json
  - src/components/context.json
  - src/hooks/context.json
  - src/ui/context.json
  - .logicstamp/

🗑️  Removing files...

   ✓ Removed context_main.json
   ✓ Removed src/components/context.json
   ✓ Removed src/hooks/context.json
   ✓ Removed src/ui/context.json
   ✓ Removed .logicstamp/

✅ Cleaned 4 file(s) and 1 directory
```

### Clean specific directory

```bash
# Clean context files in a specific directory
stamp context clean ./src --all --yes

# Suppress verbose output (quiet mode)
stamp context clean --all --yes --quiet
```

### Clean when no files exist

```bash
# When no context artifacts are found
stamp context clean
```

Output:
```
✅ No context artifacts found to clean
```

## Safety Features

- **Dry run by default** – Shows what would be removed without deleting anything unless both `--all` and `--yes` flags are provided
- **Requires both flags** – Both `--all` and `--yes` must be specified to delete files, preventing accidental deletions
- **Ignores build directories** – Automatically ignores `node_modules/`, `dist/`, `build/`, and `.next/` when searching for context files

## Use Cases

### Reset and regenerate

```bash
# Clean all context files
stamp context clean --all --yes

# Generate fresh context
stamp context
```

### Clean before switching branches

```bash
# Remove context files that might conflict
stamp context clean --all --yes

# Switch branch and regenerate
git checkout feature-branch
stamp context
```

### Clean specific output directory

```bash
# Generate context to custom output directory
stamp context --out ./output

# Later, clean that directory
stamp context clean ./output --all --yes
```

## Integration with Other Commands

The clean command works well with other LogicStamp commands:

```bash
# Clean → Generate → Validate workflow
stamp context clean --all --yes
stamp context
stamp context validate
```

```bash
# Clean → Generate → Compare workflow
stamp context clean --all --yes
stamp context
stamp context compare
```

## Notes

- **Safe by default** – Requires explicit confirmation (`--all --yes`) to delete files
- Files are searched recursively but build directories (`node_modules`, `dist`, `build`, `.next`) are automatically ignored
- The `.logicstamp/` directory is automatically included if it exists (no separate flag needed)
- Exit code is `0` on success (whether files were found or not)

## Related Commands

- [`stamp context`](context.md) – Generate context files
- [`stamp context compare`](compare.md) – Detect drift in context files
- [`stamp context validate`](validate.md) – Validate context files

