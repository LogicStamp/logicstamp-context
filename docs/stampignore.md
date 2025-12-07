# .stampignore File Format

The `.stampignore` file tells LogicStamp Context which files to exclude from context generation. You can use it to exclude any files you don't want included in your context bundles.

## Overview

When you run `stamp context` or `stamp context style` (equivalent to `stamp context --include-style`), LogicStamp automatically reads `.stampignore` and excludes any files listed in it. This happens before processing, so excluded files are never analyzed or included in context bundles.

**All context generation commands respect `.stampignore`:**
- `stamp context` - Standard context generation
- `stamp context style` - Context generation with style metadata (equivalent to `stamp context --include-style`)
- `stamp context --include-style` - Alternative syntax for style metadata extraction

**Use cases:**
- Exclude large files that aren't needed for context
- Skip test fixtures or mock data files
- Ignore generated or temporary files
- Exclude any files you don't want in context bundles

## File Format

`.stampignore` uses JSON format and must be placed in your project root directory.

### Basic Structure

```json
{
  "ignore": [
    "path/to/file.ts",
    "another/file.js"
  ]
}
```

### Example

```json
{
  "ignore": [
    "src/config/secrets.ts",
    "src/api/keys.ts",
    "lib/credentials.js",
    "**/*.secret.ts",
    "**/secrets/**"
  ]
}
```

## Path Rules

### Relative Paths

All paths in `.stampignore` must be **relative to the project root**:

- ✅ **Project-relative paths**: `src/config/secrets.ts`, `lib/keys.js`
- ❌ **Absolute paths not supported**: `/home/user/project/src/config.ts`, `C:\Users\...\src\config.ts`
- ❌ **User-specific paths not included**: No home directory paths, no absolute paths outside project

```json
{
  "ignore": [
    "src/config.ts",        // ✅ Correct - relative to project root
    "/src/config.ts",       // ❌ Wrong - absolute paths not supported
    "./src/config.ts"       // ✅ Correct - ./ is normalized and works
  ]
}
```

### Forward Slashes

Always use **forward slashes** (`/`) even on Windows:

```json
{
  "ignore": [
    "src/config.ts",       // ✅ Correct
    "src\\config.ts"       // ❌ Wrong - backslashes not supported
  ]
}
```

### Glob Patterns

`.stampignore` supports glob patterns for matching multiple files:

```json
{
  "ignore": [
    "**/*.secret.ts",      // All .secret.ts files in any directory
    "**/secrets/**",        // All files in any secrets/ directory
    "src/**/*.key.*",       // All files with .key. in src/ and subdirectories
    "config/*.json"         // All JSON files in config/ directory
  ]
}
```

**Supported glob patterns:**
- `*` - Matches any characters except `/`
- `**` - Matches any characters including `/` (recursive)
- `?` - Matches a single character
- `[abc]` - Matches any character in the set
- `{a,b}` - Matches any of the patterns

## Creating .stampignore

### Using `stamp ignore` Command (Recommended)

The easiest way to add files to `.stampignore` is using the `stamp ignore` command:

```bash
# Add a single file
stamp ignore src/config/secrets.ts

# Add multiple files/folders
stamp ignore src/config/credentials.ts src/secrets/

# Add glob patterns
stamp ignore "**/secrets.ts" "**/*.key"
```

The `stamp ignore` command:
- Creates `.stampignore` if it doesn't exist
- Adds paths to the file automatically
- Prevents duplicate entries
- Normalizes paths correctly

**See [ignore.md](cli/ignore.md) for complete documentation on the `stamp ignore` command.**

### Manual Creation

You can also create `.stampignore` manually in your project root:

```bash
# Create the file
touch .stampignore

# Add content
cat > .stampignore << 'EOF'
{
  "ignore": [
    "src/config/secrets.ts"
  ]
}
EOF
```

### Integration with Other Commands

- **`stamp ignore <file>`** - Add files or folders to `.stampignore` (recommended way to manage exclusions)
- **`stamp init`** - The init command runs a security scan by default, but `.stampignore` is completely optional and independent of security scanning

## How It Works

### Context Generation

When you run `stamp context` or `stamp context style` (equivalent to `stamp context --include-style`), LogicStamp:

1. Reads `.stampignore` from the project root
2. Filters out all files matching patterns in the ignore list
3. Processes only the remaining files
4. Shows how many files were excluded (unless using `--quiet`)

**Note:** Both `stamp context` and `stamp context style` respect `.stampignore` in exactly the same way. The style command is internally equivalent to `stamp context --include-style`, and file exclusion happens before any processing, including style extraction. `.stampignore` is completely optional - if it doesn't exist, all files will be processed normally.

**Example output:**
```
📦 Generated 5 bundles from 42 components
ℹ️  Excluded 3 files via .stampignore
```

### File Matching

Files are matched against `.stampignore` patterns using glob matching:

- Exact paths match exactly
- Glob patterns match according to their rules
- Matching happens before file processing
- Excluded files are never read or analyzed

## Relationship with .gitignore

`.stampignore` and `.gitignore` serve different purposes:

- **`.gitignore`**: Prevents files from being committed to version control
- **`.stampignore`**: Prevents files from being included in LogicStamp context bundles

**Note**: `.stampignore` is independent of security scanning. The security report file (`stamp_security_report.json`) is automatically added to `.gitignore` by `stamp security scan`, but this is separate from `.stampignore`, which only affects context generation.

**Use cases:**
- Files in `.gitignore` are excluded from Git commits
- Files in `.stampignore` are excluded from context generation (but may still be committed)
- Files can be in both (like secret files that shouldn't be committed OR included in context)

## Best Practices

### 1. Commit to Version Control

Consider committing `.stampignore` to version control so your team knows which files are excluded:

```bash
git add .stampignore
git commit -m "Add .stampignore for security"
```

This helps team members understand what's excluded and why.

### 2. Use Specific Paths

Prefer specific file paths over broad glob patterns when possible:

```json
{
  "ignore": [
    "src/config/secrets.ts",     // ✅ Specific
    "**/*.ts"                     // ❌ Too broad - excludes everything
  ]
}
```

### 3. Keep It Updated

Regularly review and update `.stampignore`:

- Remove files that are no longer needed
- Add new files that should be excluded
- Clean up patterns that are no longer needed

### 4. Don't Ignore Everything

Only exclude files that legitimately contain secrets or sensitive information. Don't use `.stampignore` as a general file exclusion mechanism—that's what `.gitignore` is for.

## Troubleshooting

### Files Still Being Included

If files are still being included after adding to `.stampignore`:

1. **Check path format:**
   - Ensure paths are relative to project root
   - Use forward slashes (`/`) not backslashes (`\`)
   - Don't use absolute paths

2. **Verify JSON syntax:**
   ```bash
   # Validate JSON
   cat .stampignore | jq .
   ```

3. **Check glob patterns:**
   - Test patterns match the files you expect
   - Use `**` for recursive matching
   - Escape special characters if needed

4. **Verify file location:**
   - `.stampignore` must be in project root
   - Check the file is named exactly `.stampignore` (not `.stampignore.json`)

### Reset .stampignore

To start fresh with `.stampignore`, simply delete the file:

```bash
# Delete .stampignore manually
rm .stampignore
```

Or edit it to remove entries you no longer need.

## Examples

### Excluding Specific Files

```json
{
  "ignore": [
    "src/config/api-keys.ts",
    "src/config/secrets.ts",
    "lib/credentials.js"
  ]
}
```

### Excluding Test Fixtures

```json
{
  "ignore": [
    "tests/fixtures/secrets.ts",
    "**/__mocks__/secrets/**"
  ]
}
```

### Excluding Multiple Patterns

```json
{
  "ignore": [
    "src/config/secrets.ts",
    "**/*.secret.ts",
    "**/secrets/**",
    "lib/**/keys.*"
  ]
}
```

## Related Commands

- [`stamp ignore`](cli/ignore.md) - Add files/folders to `.stampignore` (recommended way to manage exclusions)
- [`stamp context`](cli/context.md) - Generate context (respects `.stampignore`)
- [`stamp context style`](cli/style.md) - Generate context with style metadata (respects `.stampignore`, equivalent to `stamp context --include-style`)
- [`stamp security scan`](cli/security-scan.md) - Scan for secrets in your codebase

## See Also

- [Context Generation](cli/context.md) - How context generation works with file exclusion
- [Init Command](cli/init.md) - Project initialization

