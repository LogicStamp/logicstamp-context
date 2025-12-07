# `stamp ignore` Command

Add files or folders to `.stampignore` to exclude them from context generation.

```bash
stamp ignore <path1> [path2] ... [options]
```

## Usage

```bash
# Add a single file to .stampignore
stamp ignore src/secrets.ts

# Add multiple files/folders
stamp ignore src/config/credentials.ts src/secrets/

# Add glob patterns
stamp ignore "**/secrets.ts" "**/*.key"

# Quiet mode (suppress verbose output)
stamp ignore src/secrets.ts --quiet
```

## Arguments

- `<path1> [path2] ...` - One or more file or folder paths to ignore (relative to project root). Supports glob patterns.

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--quiet` | `-q` | Suppress verbose output (show only errors) |
| `--help` | `-h` | Show help message |

## What It Does

`stamp ignore` adds file or folder paths to `.stampignore`, which tells LogicStamp Context to exclude those files from context generation. This is useful for:

- **Excluding files with secrets** - Files that contain sensitive information (API keys, passwords, tokens) that shouldn't be included in context bundles
- **Excluding large generated files** - Files that are too large or not useful for AI context
- **Excluding test files** - Test files that aren't needed for understanding the codebase structure
- **Excluding temporary files** - Temporary or build artifacts

**Key features:**

- **Creates `.stampignore` if it doesn't exist** - The file is automatically created in your project root
- **Prevents duplicates** - Won't add the same path twice
- **Normalizes paths** - Automatically normalizes paths (removes `./` prefix, converts backslashes to forward slashes)
- **Supports glob patterns** - Can use glob patterns like `**/*.key` or `**/secrets.ts`
- **Shows feedback** - Displays which paths were added (unless using `--quiet`)

## How It Works

1. **Reads existing `.stampignore`** (if it exists) to check for duplicates
2. **Normalizes all paths** to ensure consistent formatting
3. **Filters out duplicates** - Only adds paths that aren't already in `.stampignore`
4. **Writes updated `.stampignore`** with the new paths added
5. **Shows feedback** about what was added (unless `--quiet` is used)

## Examples

### Basic Usage

```bash
# Add a single file
stamp ignore src/secrets.ts

# Output:
# ✅ Created .stampignore and added 1 path(s)
#    Added paths:
#    - src/secrets.ts
```

### Multiple Paths

```bash
# Add multiple files and folders
stamp ignore src/config/credentials.ts src/secrets/ config/api-keys.json

# Output:
# ✅ Created .stampignore and added 3 path(s)
#    Added paths:
#    - src/config/credentials.ts
#    - src/secrets/
#    - config/api-keys.json
```

### Glob Patterns

```bash
# Add glob patterns to ignore all files matching a pattern
stamp ignore "**/secrets.ts" "**/*.key" "**/*.pem"

# Output:
# ✅ Created .stampignore and added 3 path(s)
#    Added paths:
#    - **/secrets.ts
#    - **/*.key
#    - **/*.pem
```

### Adding to Existing `.stampignore`

```bash
# If .stampignore already exists, new paths are appended
stamp ignore src/new-secrets.ts

# Output:
# ✅ Added 1 path(s) to .stampignore
#    Added paths:
#    - src/new-secrets.ts
```

### Duplicate Handling

```bash
# Trying to add a path that already exists
stamp ignore src/secrets.ts

# Output (if already in .stampignore):
# ℹ️  All specified paths are already in .stampignore
```

### Quiet Mode

```bash
# Suppress verbose output
stamp ignore src/secrets.ts --quiet

# No output (unless there's an error)
# .stampignore is still created/updated
```

## Integration with Other Commands

### `stamp context`

Files listed in `.stampignore` are automatically excluded when running `stamp context`:

```bash
# Files in .stampignore are automatically excluded
stamp context

# Output will show:
# ℹ️  Excluded 3 file(s) via .stampignore
```

## File Format

`.stampignore` uses JSON format:

```json
{
  "ignore": [
    "src/secrets.ts",
    "config/api-keys.json",
    "**/*.key"
  ]
}
```

All paths are relative to the project root. The file is automatically created and managed by `stamp ignore` - you typically don't need to edit it manually.

## Path Normalization

Paths are automatically normalized:

- `./src/secrets.ts` → `src/secrets.ts` (removes `./` prefix)
- `src\config\keys.json` → `src/config/keys.json` (converts backslashes to forward slashes)
- `src//secrets.ts` → `src/secrets.ts` (removes duplicate slashes)

This ensures consistent formatting regardless of how you specify paths.

## Glob Patterns

`.stampignore` supports glob patterns for matching multiple files:

- `**/*.key` - Matches all `.key` files in any directory
- `**/secrets.ts` - Matches all `secrets.ts` files in any directory
- `src/**/*.test.ts` - Matches all `.test.ts` files under `src/`
- `config/*.json` - Matches all `.json` files directly in `config/`

See [stampignore.md](../stampignore.md) for more details on glob pattern syntax.

## Best Practices

1. **Use for secrets and sensitive files** - The primary use case is excluding files that contain secrets or sensitive information
2. **Commit `.stampignore` to version control** - This helps your team know which files are excluded
3. **Use `stamp ignore` after security scans** - After running `stamp security scan`, review the report and use `stamp ignore <file>` to exclude files with detected secrets
4. **Review periodically** - Regularly review `.stampignore` to ensure it's still accurate
5. **Use glob patterns wisely** - Glob patterns are powerful but can exclude more than intended if not careful

## See Also

- [stampignore.md](../stampignore.md) - Complete `.stampignore` file format and usage guide
- [context.md](context.md) - How `.stampignore` affects context generation
- [security-scan.md](security-scan.md) - Security scanning to detect secrets in your codebase

