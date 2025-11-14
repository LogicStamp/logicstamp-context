# LogicStamp Context

**A tiny CLI that compiles your React/TypeScript codebase into machine-readable context bundles for AI and CI. Fast, deterministic, zero-config.**

## What is this?

**LogicStamp Context** is a lightweight tool that scans your React/TypeScript codebase and generates structured context bundles optimized for AI tools like Claude, ChatGPT, and other LLMs.

No setup, no configuration, no pre-compilation required. Just point it at your code and get instant, AI-ready documentation.

## Installation

```bash
npm install -g logicstamp-context
```

After installation, the `stamp` command will be available globally.

## What's New in v0.1.0

🎉 **Token Cost Optimization**
- Automatic token estimates for GPT-4o-mini and Claude
- Mode comparison showing savings (none/header/full)
- `--compare-modes` flag for detailed token analysis

🔍 **Context Drift Detection**
- New `compare` command for tracking changes
- Detects added/removed/changed components
- CI-friendly exit codes and token delta stats

✅ **Enhanced Component Detection**
- Fixed React component detection for HTML-only JSX
- Improved dependency resolution (relative paths prioritized)
- Better handling of cross-directory component references

🛡️ **CI/CD Improvements**
- `--strict-missing` flag for dependency validation
- Enhanced `--stats` output with mode estimates
- JSON output optimized for CI parsing

## Quick Start

```bash
# Install globally
npm i -g logicstamp-context

# Generate context.json (llm-chat profile)
stamp context

# Preview stats without writing files
stamp context --dry-run --stats

# Compare token costs across modes
stamp context --compare-modes

# Generate minimal API documentation
stamp context --include-code none --format pretty --out docs/api.json

# Compare two context files for drift detection
stamp context compare old.json new.json --stats

# Validate generated context
stamp context validate context.json
```

**Why?** Generate AI-ready context from your React/TS codebase in seconds with built-in token cost optimization.

## What does it generate?

LogicStamp Context analyzes your React components and outputs a structured JSON file containing:

- **Component structure**: variables, hooks, components, functions
- **Logic signatures**: props, events, state types
- **Dependency graph**: how components relate to each other
- **Code snippets**: headers or full source (configurable)
- **Semantic hashes**: for tracking changes

This output is designed to be easily understood by AI assistants, helping them provide better suggestions and understand your codebase architecture.

## Usage

```bash
stamp context [path] [options]
stamp context compare <old.json> <new.json> [options]
stamp context validate [file]
```

### Commands

- **`stamp context [path]`** - Scans a directory and writes an AI-ready context file containing a collection of bundles (one bundle per entry point). Shows token estimates and mode comparison in output. Automatically validates the generated context before writing.

- **`stamp context compare <old.json> <new.json>`** - Compares two context files and reports drift. Detects added/removed components, changed imports, hooks, exports, and semantic hashes. Exits with code 1 if drift is detected (CI-friendly).

- **`stamp context validate [file]`** - Checks an existing context file for schema and structural issues before sharing it with an AI or committing it to a repo. When no file is specified it looks for `context.json` in the current directory.

### Arguments (`context` command)

- `[path]` - Directory to scan (default: current directory)

### Options (`context` command)

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--depth <n>` | `-d` | Dependency traversal depth | `1` |
| `--include-code <mode>` | `-c` | Code inclusion: `none\|header\|full` | `header` |
| `--format <format>` | `-f` | Output format: `json\|pretty\|ndjson` | `json` |
| `--out <file>` | `-o` | Output file | `context.json` |
| `--max-nodes <n>` | `-m` | Maximum nodes per bundle | `100` |
| `--profile <profile>` | | Profile preset (see below) | `llm-chat` |
| `--strict` | `-s` | Fail on missing dependencies | `false` |
| `--strict-missing` | | Exit with error code 1 if any missing dependencies found (CI-friendly) | `false` |
| `--predict-behavior` | | Include experimental behavior predictions in contracts | `false` |
| `--dry-run` | | Skip writing output; show on-screen summary only | `false` |
| `--stats` | | Emit single-line JSON stats with token estimates (intended for CI) | `false` |
| `--compare-modes` | | Show detailed token comparison table across modes (none/header/full) | `false` |
| `--help` | `-h` | Show help message | |

### Options (`compare` command)

| Option | Description | Default |
|--------|-------------|---------|
| `--stats` | Show token count statistics and delta | `false` |
| `--help`, `-h` | Show help message | |

### Options (`validate` command)

- `[file]` – Optional path to the generated `context.json` (or alternative output) to validate. Defaults to `./context.json`.
- Exits with code `0` on success, `1` on invalid structure or read/parse errors.
- Prints bundle counts, node totals, and highlights schema mismatches.

### Profiles

Profiles are preset configurations optimized for different use cases:

#### `llm-chat` (default)
Balanced mode for AI chat interfaces
- Depth: 1
- Code: headers only
- Max nodes: 100
- Behavioral predictions: disabled by default (enable with `--predict-behavior`)

#### `llm-safe`
Conservative mode for token-limited contexts
- Depth: 1
- Code: headers only
- Max nodes: 30
- Behavioral predictions: disabled by default (enable with `--predict-behavior`)

#### `ci-strict`
Strict validation mode for CI/CD
- Code: none
- Strict dependencies enabled
- Behavioral predictions: not applicable (metadata-only mode)

### Behavioral Predictions

The `--predict-behavior` flag enables experimental behavioral analysis that adds predicted component behaviors to the contract output. These predictions include:

- Form validation patterns
- Side effect management (useEffect)
- Data fetching/mutation patterns
- Memoization usage
- Context consumption
- Ref usage for DOM access
- Loading/error state handling

**Note:** Behavioral predictions are **disabled by default** in all profiles to minimize token usage. Enable them explicitly when you need richer semantic information about component behavior.

**Example:**
```bash
# Enable predictions with the default profile
stamp context --predict-behavior

# Enable predictions with a specific profile
stamp context --profile llm-safe --predict-behavior
```

## Token Optimization

LogicStamp Context includes built-in token cost analysis and optimization features:

### Automatic Token Estimates

Every context generation shows token costs for both GPT-4o-mini and Claude:

```
📏 Token Estimates (header mode):
   GPT-4o-mini: 13,895 | Full code: ~39,141 (~65% savings)
   Claude:      12,351 | Full code: ~34,792 (~65% savings)

📊 Mode Comparison:
   none:       ~8,337 tokens
   header:     ~13,895 tokens
   full:       ~39,141 tokens
```

This helps you:
- **Understand costs** at a glance
- **Choose the right mode** for your budget
- **See savings** compared to including full source code

### Mode Comparison Table

Use `--compare-modes` for a detailed comparison:

```bash
stamp context --compare-modes
```

Output:
```
📊 Mode Comparison

Mode     | Tokens GPT-4o | Tokens Claude | Savings vs Full
---------|---------------|---------------|------------------
none     |         8,337 |         7,411 | 79%
header   |        13,895 |        12,351 | 65%
full     |        39,141 |        34,792 | 0%
```

**When to use each mode:**
- **`none`** - API documentation, CI validation (no code snippets)
- **`header`** - AI chat, code review (JSDoc headers + contracts)
- **`full`** - Deep analysis, debugging (complete source code)

### Stats for CI/CD

Use `--stats` to get machine-readable token data:

```bash
stamp context --stats
```

Output JSON includes:
```json
{
  "tokensGPT4": 13895,
  "tokensClaude": 12351,
  "modeEstimates": {
    "none": {"gpt4": 8337, "claude": 7411},
    "header": {"gpt4": 13895, "claude": 12351},
    "full": {"gpt4": 39141, "claude": 34792}
  },
  "savingsGPT4": "65",
  "savingsClaude": "65"
}
```

## Context Drift Detection

The `compare` command helps you track changes between context versions:

### Basic Comparison

```bash
stamp context compare old.json new.json
```

Output:
```
✅ PASS

# or if changes detected:

⚠️  DRIFT

Added components: 2
  + src/components/NewButton.tsx
  + src/utils/helpers.ts

Removed components: 1
  - src/components/OldButton.tsx

Changed components: 3
  ~ src/components/Card.tsx
    Δ imports, hooks
  ~ src/App.tsx
    Δ hash
```

### With Token Stats

```bash
stamp context compare old.json new.json --stats
```

Shows token cost changes:
```
Token Stats:
  Old: 8,484 (GPT-4o-mini) | 7,542 (Claude)
  New: 9,125 (GPT-4o-mini) | 8,111 (Claude)
  Δ +641 (+7.56%)
```

### Exit Codes

- `0` - No drift (PASS)
- `1` - Drift detected or error

Perfect for CI/CD validation:
```bash
# In your CI pipeline
stamp context compare base.json pr.json || echo "Context drift detected!"
```

## Examples

### Basic usage

```bash
# Generate context for entire project
stamp context

# CLI output:
# 🔍 Scanning /path/to/project...
# ⚙️  Analyzing components...
# 🔗 Building dependency graph...
# 📦 Generating context...
# 🔍 Validating generated context...
# ✅ Validation passed
# 📝 Writing to: /path/to/project/context.json
# ✅ Context written successfully
#
# 📊 Summary:
#    Total components: 15
#    Root components: 3
#    ...
```

### Focused analysis

```bash
# Analyze only the src directory
stamp context ./src

# Analyze with custom output file
stamp context --out my-context.json
```

### Deep traversal

```bash
# Include 2 levels of dependencies
stamp context --depth 2

# Include full source code
stamp context --include-code full
```

### Token cost analysis

```bash
# Show detailed mode comparison
stamp context --compare-modes

# Get JSON stats for CI
stamp context --stats

# See token costs for specific mode
stamp context --include-code none
stamp context --include-code full
```

### Context comparison

```bash
# Basic drift detection
stamp context compare old.json new.json

# With token delta stats
stamp context compare base.json pr.json --stats

# In CI pipeline
stamp context compare base.json pr.json || exit 1
```

### CI/CD validation

```bash
# Use llm-safe profile for smaller output
stamp context --profile llm-safe --out safe-context.json

# Strict mode: fail if any dependencies missing
stamp context --strict-missing

# Generate stats for CI monitoring
stamp context --stats > stats.json

# Validate generated context
stamp context validate context.json
```

## Output Format

The generated `context.json` contains an array of bundles (one bundle per entry point).

**📋 Full Schema Reference:** See [`schema/logicstamp.context.schema.json`](schema/logicstamp.context.schema.json) for the complete JSON Schema definition.

```json
[
  {
    "$schema": "https://logicstamp.dev/schemas/context/v0.1.json",
    "position": "1/5",
    "type": "LogicStampBundle",
    "schemaVersion": "0.1",
    "entryId": "src/components/Button.tsx",
    "depth": 1,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "bundleHash": "uifb:abc123...",
    "graph": {
      "nodes": [
        {
          "entryId": "src/components/Button.tsx",
          "contract": {
            "type": "UIFContract",
            "schemaVersion": "0.3",
            "kind": "react:component",
            "description": "Button - Interactive component",
            "version": {
              "variables": ["variant", "size"],
              "hooks": ["useState"],
              "components": [],
              "functions": ["handleClick"]
            },
            "logicSignature": {
              "props": {
                "onClick": { "type": "function", "signature": "() => void" },
                "variant": { "type": "literal-union", "literals": ["primary", "secondary"] }
              },
              "events": {},
              "state": {}
            }
          }
        }
      ],
      "edges": []
    },
    "meta": {
      "missing": [],
      "source": "logicstamp-context@0.1.0"
    }
  }
]
```

### Understanding the Meta Field

The `meta` section provides metadata about bundle generation and dependency resolution:

#### `missing` Array

Tracks dependencies that couldn't be resolved during analysis. An empty array `[]` means all dependencies were successfully found.

When dependencies are missing, each entry contains:
- `name` - The import specifier that couldn't be resolved (e.g., `"./MissingComponent"`)
- `reason` - Why it couldn't be found (e.g., `"file not found"`, `"external package"`)
- `referencedBy` - The component that tried to import it

**Example with missing dependencies:**
```json
{
  "meta": {
    "missing": [
      {
        "name": "./components/DeletedComponent",
        "reason": "file not found",
        "referencedBy": "src/App.tsx"
      },
      {
        "name": "@external/ui-lib",
        "reason": "external package",
        "referencedBy": "src/components/Button.tsx"
      }
    ],
    "source": "logicstamp-context@0.1.0"
  }
}
```

**Common reasons for missing dependencies:**
- `file not found` - Referenced file doesn't exist (deleted or moved)
- `external package` - Third-party npm package (intentionally excluded)
- `outside scan path` - File exists but outside the specified scan directory
- `circular dependency` - Circular import detected and skipped
- `max depth exceeded` - Dependency beyond `--depth` limit

**Using `--strict-missing` for CI/CD:**
```bash
# Exit with error code 1 if ANY missing dependencies found
stamp context --strict-missing

# Perfect for CI validation
stamp context --strict-missing || exit 1
```

#### `source` Field

Identifies the generator and version (e.g., `"logicstamp-context@0.1.0"`). Useful for:
- Debugging context generation issues
- Ensuring compatibility with consuming tools
- Tracking which version generated historical contexts

## Use Cases

### AI-Assisted Development

Share context with Claude or ChatGPT to get:
- Architecture suggestions
- Refactoring recommendations
- Bug fixes based on full component understanding

### Documentation

Generate up-to-date component documentation automatically:
- API contracts
- Dependency trees
- Component relationships

### Code Review

Quickly understand component structure and dependencies:
- Identify circular dependencies
- Find unused components
- Track component complexity

## Troubleshooting

### Handling Missing Dependencies

If your generated context shows missing dependencies in the `meta.missing` array:

#### 1. External Packages (Expected)
```json
{
  "name": "@mui/material",
  "reason": "external package"
}
```
**Solution:** This is normal. LogicStamp only analyzes your source code, not node_modules. External packages are intentionally excluded.

#### 2. File Not Found (Action Required)
```json
{
  "name": "./components/OldButton",
  "reason": "file not found",
  "referencedBy": "src/App.tsx"
}
```
**Solutions:**
- Check if the file was deleted or moved
- Update the import path in the referencing component
- Use `--strict-missing` in CI to catch these issues early

#### 3. Outside Scan Path
```json
{
  "name": "../../shared/utils",
  "reason": "outside scan path"
}
```
**Solutions:**
- Expand your scan path: `stamp context ../` (parent directory)
- Or scan from project root: `stamp context .` (from root)

#### 4. Max Depth Exceeded
```json
{
  "name": "./deeply/nested/component",
  "reason": "max depth exceeded"
}
```
**Solutions:**
- Increase depth: `stamp context --depth 2` or `--depth 3`
- Note: Higher depth = more tokens consumed

#### 5. Circular Dependencies
```json
{
  "name": "./ComponentA",
  "reason": "circular dependency"
}
```
**Solutions:**
- Refactor to break the circular import
- Extract shared logic to a separate module
- This is a code smell that should be addressed

### Common Issues

**Q: Why is my context.json huge?**
- Use `--include-code none` to exclude all source code (smallest)
- Use `--include-code header` (default) for balanced output
- Use `--profile llm-safe` for token-constrained scenarios
- Check `--compare-modes` to see token savings

**Q: Validation failed - what went wrong?**
```bash
stamp context validate context.json
```
- Check for schema mismatches (outdated schema version)
- Verify JSON is well-formed (no trailing commas, proper escaping)
- Ensure all required fields are present

**Q: How do I ignore certain directories?**
- LogicStamp respects `.gitignore` automatically
- `node_modules/` and common build directories are excluded by default
- Scan specific directories: `stamp context ./src`

## How it Works

1. **Scan**: Finds all `.ts` and `.tsx` files in your project
2. **Analyze**: Parses React components using TypeScript AST
3. **Extract**: Builds component contracts with structure and signatures
4. **Graph**: Creates dependency graph showing relationships
5. **Bundle**: Packages context bundles optimized for AI consumption

All in one command, no pre-compilation needed!

## Comparison with LogicStamp CLI

| Feature | logicstamp-context | @logicstamp/cli |
|---------|-------------------|-----------------|
| Standalone | ✅ Yes | ❌ No |
| Pre-compilation required | ❌ No | ✅ Yes |
| Context generation | ✅ Yes | ✅ Yes |
| Contract compilation | ✅ Built-in | ✅ Separate command |
| Contract verification | ❌ No | ✅ Yes |
| Watch mode | ❌ No | ✅ Yes |
| Size | 🪶 Light | 📦 Full-featured |

**TL;DR**: Use `stamp context` for quick AI context generation. Use `@logicstamp/cli` for full contract management and verification.

## Requirements

- Node.js >= 18.0.0
- TypeScript/React codebase

## License

MIT

## Contributing

Issues and PRs welcome! This is an open-source project.

## Links

- [LogicStamp Main Project](https://github.com/yourusername/logicstamp)
- [Report Issues](https://github.com/yourusername/logicstamp-context/issues)
