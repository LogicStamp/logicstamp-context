# Security Scan

The `stamp security scan` command scans your project for secrets (API keys, passwords, tokens) and other sensitive information that should not be committed to version control.

**Runs 100% locally — nothing is uploaded or sent anywhere.**

## Overview

The security scan feature helps prevent accidental exposure of sensitive credentials by:

- Scanning TypeScript, JavaScript, and JSON files for common secret patterns
- Generating detailed reports of detected secrets
- Optionally adding files with secrets to `.stampignore` to exclude them from context generation
- Integrating with the `stamp init` command for automated security checks

## Usage

### Basic Scan

```bash
# Scan your project for secrets (API keys, passwords, tokens)
# Runs 100% locally — nothing is uploaded or sent anywhere
stamp security scan
```

Scans the current directory for secrets and generates a report.

### Scan Specific Directory

```bash
stamp security scan ./src
```

Scans a specific directory path.

### Auto-Apply to .stampignore

```bash
# Scan and automatically add detected secret files to .stampignore
# Prevents these files from ever reaching context.json
stamp security scan --apply
```

Automatically adds files containing secrets to `.stampignore` without prompting. This prevents these files from ever being included in context generation.

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
| `--apply` | | Automatically add files with secrets to `.stampignore` |
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

- **type**: Always `"LogicStampSecurityReport"` to identify the report format
- **schemaVersion**: Version of the report schema (`"0.1"`)
- **createdAt**: ISO 8601 timestamp of when the scan was performed
- **projectRoot**: Absolute path to the project root directory
- **filesScanned**: Total number of files scanned
- **secretsFound**: Total number of secret matches detected
- **matches**: Array of individual secret matches with details
- **filesWithSecrets**: Array of file paths that contain secrets (sorted)

### Match Object

Each match in the `matches` array contains:

- **file**: Path to the file containing the secret
- **line**: Line number where the secret was found (1-indexed)
- **column**: Column number where the secret starts (1-indexed)
- **type**: Type of secret detected (e.g., "API Key", "Password", "Token")
- **snippet**: Code snippet showing context around the secret (approximately 40 characters)
- **severity**: Severity level (`"high"`, `"medium"`, or `"low"`)

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

## .stampignore Integration

When secrets are detected, you can automatically add affected files to `.stampignore` to prevent them from being included in context generation.

### Manual Addition

After running a scan, you'll see a suggestion:

```
💡 To automatically add these files to .stampignore, run:
   stamp security scan --apply
```

### Automatic Addition

Use the `--apply` flag to automatically add files:

```bash
stamp security scan --apply
```

This will:
1. Add all files containing secrets to the ignore list (only files not already ignored)
2. Create `.stampignore` if it doesn't exist **and** secrets are detected **and** there are new files to add
3. Preserve existing entries in `.stampignore`
4. Avoid duplicate entries

**Note:** `.stampignore` is only created when secrets are actually found and there are new files to add to the ignore list. If no secrets are detected, or if all detected files are already in `.stampignore`, the file is not created.

### .stampignore Format

The `.stampignore` file uses JSON format:

```json
{
  "ignore": [
    "src/config.ts",
    "src/secrets.js",
    "lib/api-keys.ts"
  ]
}
```

Paths are relative to the project root and use forward slashes (`/`) regardless of the operating system.

## Hard Reset

The `stamp security --hard-reset` command deletes both `.stampignore` and the security report file, effectively resetting your security configuration.

### Usage

```bash
# With confirmation prompt
stamp security --hard-reset

# Without confirmation (force)
stamp security --hard-reset --force

# With custom report path
stamp security --hard-reset --out ./reports/security.json --force
```

### Options

| Option | Description |
|--------|-------------|
| `--force` | Skip confirmation prompt and delete immediately |
| `--out <file>` | Path to the security report file to delete |
| `--quiet` | Suppress output messages |

## Integration with Init

The security scan can be automatically run during project initialization using the `--secure` flag:

```bash
stamp init --secure
```

This command:
1. Runs `stamp init` with auto-yes (no prompts)
2. Automatically runs `stamp security scan --apply` after initialization to scan for secrets (API keys, passwords, tokens)
3. Adds any detected secret files to `.stampignore`, preventing these files from ever reaching `context.json`

**Runs 100% locally — nothing is uploaded or sent anywhere.**

This is useful for:
- Setting up new projects with security checks from the start
- CI/CD pipelines that need automated security validation
- Ensuring security best practices are followed from project initialization

## Exit Codes

The security scan command uses the following exit codes:

- **0**: No secrets found, scan completed successfully
- **1**: Secrets were detected in the codebase

This makes it suitable for use in CI/CD pipelines where you want builds to fail if secrets are detected.

## Examples

### Basic Usage

```bash
# Scan your project for secrets (API keys, passwords, tokens)
# Runs 100% locally — nothing is uploaded or sent anywhere
stamp security scan

# Scan specific directory
stamp security scan ./src

# Scan and automatically add detected secret files to .stampignore
# Prevents these files from ever reaching context.json
stamp security scan --apply
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
# Reset with confirmation
stamp security --hard-reset

# Reset without confirmation
stamp security --hard-reset --force
```

## Best Practices

1. **Run Regularly**: Include security scans in your development workflow and CI/CD pipelines
2. **Review Reports**: Don't just ignore findings—review and remediate actual secrets
3. **Use Environment Variables**: Store secrets in environment variables or secret management systems, not in code
4. **Update .stampignore Carefully**: Only add files to `.stampignore` if they legitimately contain secrets that should be excluded
5. **Version Control**: Consider committing `.stampignore` to version control so the team knows which files are excluded
6. **Don't Commit Reports**: Add `stamp_security_report.json` to `.gitignore` to avoid committing sensitive findings

## Limitations

- **Pattern-Based Detection**: The scanner uses pattern matching and may have false positives or miss some secret formats
- **File Type Coverage**: Only scans TypeScript, JavaScript, and JSON files
- **File Size Limit**: Files larger than 10MB are automatically skipped to prevent performance issues (you'll see a warning message)
- **No Encryption Detection**: Does not detect encrypted secrets or secrets stored in environment-specific files
- **Static Analysis Only**: Performs static analysis and cannot detect secrets passed at runtime

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

### .stampignore Not Working

If files are still being included after adding to `.stampignore`:
- Verify the paths in `.stampignore` are relative to the project root
- Check that paths use forward slashes (`/`) not backslashes
- Ensure the `.stampignore` file is valid JSON

## Related Commands

- [`stamp init`](./init.md) - Initialize LogicStamp with optional security scan
- [`stamp context`](./context.md) - Generate context (respects `.stampignore`)

## See Also

- [.stampignore Format](../stampignore.md) - Detailed documentation on `.stampignore` file format
- [Secret Detection Patterns](../security-patterns.md) - Complete list of detected secret patterns

