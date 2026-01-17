# Security Scan

The `stamp security scan` command finds secrets (API keys, passwords, tokens) and other sensitive data in your project before they get committed.

**Runs 100% locally — nothing is uploaded or sent anywhere.**

## Overview

The security scan helps prevent accidentally exposing sensitive credentials by:

- Scanning TypeScript, JavaScript, and JSON files for common secret patterns
- Generating detailed reports of detected secrets
- Integrating with the `stamp init` command for automated security checks

## Usage

### Basic Scan

```bash
stamp security scan
```

Scans the current directory for secrets and generates a report.

### Scan Specific Directory

```bash
stamp security scan ./src
```

Scans a specific directory path.


### Custom Output Path

```bash
stamp security scan --out ./reports/security.json
```

Specifies a custom path for the security report file.

### Quiet Mode

```bash
stamp security scan --quiet
```

Outputs only JSON statistics (useful for CI/CD pipelines).

## Command Options

| Option | Short | Description |
|--------|-------|-------------|
| `--out <file>` | `-o` | Output file path for the security report (default: `stamp_security_report.json`) |
| `--quiet` | `-q` | Output only JSON statistics, suppress other messages |
| `--help` | `-h` | Show help information |

## Security Report Format

The security scan generates a JSON report with the following structure:

```json
{
  "type": "LogicStampSecurityReport",
  "schemaVersion": "0.1",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "projectRoot": "/path/to/project",
  "filesScanned": 42,
  "secretsFound": 3,
  "matches": [
    {
      "file": "src/config.ts",
      "line": 15,
      "column": 12,
      "type": "API Key",
      "snippet": "const apiKey = 'FAKE_SECRET_KEY_1234567890abcdefghijklmnop'",
      "severity": "high"
    }
  ],
  "filesWithSecrets": [
    "src/config.ts",
    "src/secrets.js"
  ]
}
```

### Report Fields

The report includes these fields:

- **type**: `"LogicStampSecurityReport"` (report format identifier)
- **schemaVersion**: `"0.1"` (schema version)
- **createdAt**: ISO 8601 timestamp
- **projectRoot**: Absolute path to project root
- **filesScanned**: Total files scanned
- **secretsFound**: Total secret matches detected
- **matches**: Array of individual secret matches
- **filesWithSecrets**: Array of file paths containing secrets (sorted)

Each match shows the file path, line and column numbers, secret type, a code snippet (about 40 characters), and severity level (high, medium, or low).

**Note:** If no secrets are detected, the report contains no sensitive data and is safe to inspect locally.

## Detected Secret Types

The scanner detects the following types of secrets:

### High Severity

- **API Keys**: Patterns like `apiKey`, `api_key`, `apikey` with values ≥20 characters
- **AWS Access Keys**: AWS access key IDs (format: starts with specific prefix followed by 16 alphanumeric characters, e.g., `FAKE_AWS_ACCESS_KEY_ID_000000`)
- **GitHub Tokens**: GitHub personal access tokens and fine-grained tokens (various token types followed by 36 alphanumeric characters, e.g., `FAKE_GITHUB_TOKEN_00000000000000000000000000000000`)
- **Private Keys**: RSA or other private key blocks (`-----BEGIN PRIVATE KEY-----`)
- **Passwords**: Patterns like `password`, `passwd`, `pwd` with values ≥8 characters
- **Tokens**: Authentication tokens and bearer tokens ≥20 characters
- **OAuth Secrets**: OAuth client secrets and similar patterns ≥16 characters
- **Database URLs**: Connection strings with embedded credentials (PostgreSQL, MySQL, MongoDB)
- **JWT Secrets**: JWT signing keys and secrets ≥16 characters

### Medium Severity

- **Generic Secrets**: Patterns like `secret`, `secret_key` with values ≥16 characters

## False Positive Filtering

The scanner includes built-in false positive filtering to reduce noise:

- **Example/Test Patterns**: Skips matches containing "example", "test", or "sample"
- **Comments**: Skips secrets found in comments (unless they appear to be actual assignments)
- **Short Matches**: Filters out very short generic secret matches (<20 characters)

## File Types Scanned

The security scan examines the following file types:

- TypeScript files (`.ts`, `.tsx`)
- JavaScript files (`.js`, `.jsx`)
- JSON files (`.json`)

**Note**: Files larger than 10MB are automatically skipped to prevent performance issues. You'll see a warning message if any files are skipped due to size.

### Excluded Files

The following files are automatically excluded from scanning:

- The security report file itself (`stamp_security_report.json`)
- The `.stampignore` file (which may contain file paths that reference secrets)
- Files larger than 10MB (skipped with a warning message)

## Automatic .gitignore Protection

🔒 **SECURITY CRITICAL**: **Security reports only contain sensitive information if secrets are actually detected** (locations of detected secrets, line numbers, code snippets). If no secrets are found, the report will have `secretsFound: 0` and an empty `matches: []` array. **Note**: Secrets should not normally be present in TypeScript (`.ts`, `.tsx`), JavaScript (`.js`, `.jsx`), or JSON (`.json`) source files—they should be stored in `.env` files or environment variables. The security scan checks for secrets that may have been accidentally committed to source files. `stamp security scan` automatically ensures the report file is added to `.gitignore` to prevent accidental commits. This behavior is intentional and enforced to prevent accidental leakage of sensitive information into version control.

- For the default report file (`stamp_security_report.json`): Automatically ensures all LogicStamp patterns are in `.gitignore` (including `context.json`, `context_*.json`, etc.)
- For custom report paths: Automatically adds the specific report file path to `.gitignore`

**Why ignore the report?** If secrets are detected, the security report contains:
- File paths where secrets were detected
- Line and column numbers pointing to secret locations
- Code snippets showing the context around secrets
- Severity levels and secret types

Even if no secrets are found, the report structure itself reveals which files were scanned, which could be sensitive information in some contexts.

This happens automatically after the report is written, regardless of whether secrets were found. If the report file cannot be added to `.gitignore` (e.g., permission issues), a warning is shown but the scan continues.

**If no secrets are detected, the report contains no sensitive data and is safe to inspect locally.**


## Hard Reset

Delete the security report file:

```bash
stamp security --hard-reset              # with confirmation
stamp security --hard-reset --force      # without confirmation
stamp security --hard-reset --out ./reports/security.json --force
```

Options: `--force` (skip confirmation), `--out <file>` (custom report path), `--quiet` (suppress output)

## Integration with Init

The security scan is automatically run during project initialization by default:

```bash
stamp init
```

This command:
1. Runs `stamp init` (with auto-yes when security scan runs)
2. Automatically runs `stamp security scan` after initialization to scan for secrets (API keys, passwords, tokens)

To skip the security scan during initialization:

```bash
stamp init --no-secure
```

Useful for:
- Setting up new projects with security checks from the start
- CI/CD pipelines that need automated security validation
- Ensuring security best practices are followed from project initialization

## Automatic Secret Sanitization in Context Generation

When you run `stamp context` or `stamp context style`, LogicStamp automatically sanitizes secrets in the generated JSON files if a security report exists.

**How it works:**

1. If `stamp_security_report.json` exists in your project root, it's automatically loaded
2. When generating context JSON files, any secrets detected in the security report are replaced with `"PRIVATE_DATA"` in the generated files
3. **Your source code files are never modified** - only the generated JSON files contain sanitized values

**Example:**

If your source code contains:
```typescript
const apiKey = 'sk_live_1234567890abcdef';
```

The generated `context.json` will contain:
```json
{
  "code": "const apiKey = 'PRIVATE_DATA';"
}
```

**Important notes:**

- ✅ **Source files are never modified** - your actual code remains unchanged
- ✅ **Automatic** - happens automatically when a security report exists
- ✅ **Safe** - secrets are replaced only in generated JSON files, never in source code
- ✅ **Works with all code inclusion modes** - applies to both `--include-code header` and `--include-code full`

**Code inclusion modes and credentials:**

- **`none` mode**: No code is included, so credentials cannot appear in bundles
- **`header` mode**: Only JSDoc `@uif` metadata blocks are included (not implementation code), so credentials in your source code will not appear in bundles
- **`header+style` mode**: Same as `header` mode (only metadata), plus style information in contracts (not code), so credentials will not appear in bundles
- **`full` mode**: Full source code is included, so credentials could appear unless sanitized. Sanitization automatically replaces detected secrets with `"PRIVATE_DATA"` when a security report exists

**Even if credentials exist in your source files (which they shouldn't), they can only be included in generated bundles when using `--include-code full` mode. The other modes (`none`, `header`, `header+style`) only include metadata and contracts, not actual implementation code where credentials would typically be found.**

**When sanitization happens:**

- `stamp context` - Secrets are sanitized in generated context files
- `stamp context style` - Secrets are sanitized in generated context files (same behavior)
- If no security report exists, code is included as-is (no sanitization)

This ensures that sensitive credentials never appear in your context JSON files, even if they exist in your source code.

## Exit Codes

- **0**: No secrets found
- **1**: Secrets detected

Use in CI/CD pipelines to fail builds when secrets are detected.

## Examples

### Basic Usage

```bash
stamp security scan

# Scan specific directory
stamp security scan ./src

```

### CI/CD Integration

```bash
# In your CI pipeline
stamp security scan --quiet --out ./reports/security.json

# Check exit code
if [ $? -eq 1 ]; then
  echo "Secrets detected! Check security report."
  exit 1
fi
```

### Custom Report Location

```bash
# Save report to custom location
stamp security scan --out ./reports/security-scan.json

# Save to directory (creates stamp_security_report.json inside)
stamp security scan --out ./reports/
```

### Reset Security Configuration

```bash
# Delete security report with confirmation
stamp security --hard-reset

# Delete security report without confirmation
stamp security --hard-reset --force
```

## Best Practices

1. **Run Regularly**: Include security scans in your development workflow and CI/CD pipelines
2. **Review Reports**: Don't just ignore findings—review and remediate actual secrets
3. **Use Environment Variables**: Store secrets in environment variables or secret management systems, not in code
4. **Report Files Are Automatically Protected**: The security report file is automatically added to `.gitignore` to prevent accidental commits of sensitive findings

## Limitations

- Pattern-based detection (may have false positives or miss some formats)
- Only scans TypeScript, JavaScript, and JSON files
- Files larger than 10MB are skipped (you'll see a warning)
- Doesn't detect encrypted secrets or secrets in environment-specific files
- Static analysis only (can't detect secrets passed at runtime)

## Troubleshooting

### Too Many False Positives

If you're seeing too many false positives:
- Review the detected patterns and adjust your code to avoid matching secret patterns in non-secret contexts
- The scanner already filters common false positives, but you may need to adjust your code patterns

### Secrets Not Detected

If legitimate secrets aren't being detected:
- Verify the secret matches one of the supported patterns
- Check that the file type is supported (`.ts`, `.tsx`, `.js`, `.jsx`, `.json`)
- Ensure the secret format matches the expected pattern (e.g., API keys should be ≥20 characters)


## Related Commands

- [`stamp init`](./init.md) - Initialize LogicStamp with optional security scan
- [`stamp context`](./context.md) - Generate context

## See Also

- [Security Policy](../../SECURITY.md) - Complete security policy, best practices, and handling of sensitive information
- [.stampignore Format](../stampignore.md) - Documentation on `.stampignore` file format (optional, independent of security scan)
- [`stamp context`](./context.md) - Generate context

