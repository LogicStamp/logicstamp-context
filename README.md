# LogicStamp Context

Generate AI-friendly context bundles from React codebases in seconds.

## What is this?

**LogicStamp Context** is a lightweight tool that scans your React/TypeScript codebase and generates structured context bundles optimized for AI tools like Claude, ChatGPT, and other LLMs.

No setup, no configuration, no pre-compilation required. Just point it at your code and get instant, AI-ready documentation.

## Installation

```bash
npm install -g logicstamp-context
```

## Quick Start

```bash
# Generate context for your entire project
logicstamp-context

# Generate context for a specific directory
logicstamp-context ./src

# Use a conservative profile optimized for AI safety
logicstamp-context --profile llm-safe

# Include full source code (not just headers)
logicstamp-context --include-code full --out full-context.json
```

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
logicstamp-context [path] [options]
logicstamp-validate [file]
```

### Commands

- `logicstamp-context` scans a directory and writes an AI-ready bundle file.
- `logicstamp-validate [file]` checks an existing bundle for schema and structural issues before sharing it with an AI or committing it to a repo. When no file is specified it looks for `context.json` in the current directory.

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
| `--predict-behavior` | | Include experimental behavior predictions in contracts | `false` |
| `--dry-run` | | Skip writing output; show on-screen summary only | `false` |
| `--stats` | | Emit single-line JSON stats (intended for CI) | `false` |
| `--help` | `-h` | Show help message | |

### Options (`logicstamp-validate`)

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

#### `llm-safe`
Conservative mode for token-limited contexts
- Depth: 1
- Code: headers only
- Max nodes: 30

#### `ci-strict`
Strict validation mode for CI/CD
- Code: none
- Strict dependencies enabled

## Examples

### Basic usage

```bash
# Generate context for entire project
logicstamp-context

# Output: context.json created with dependency graph and component structure
```

### Focused analysis

```bash
# Analyze only the src directory
logicstamp-context ./src

# Analyze with custom output file
logicstamp-context --out my-context.json
```

### Deep traversal

```bash
# Include 2 levels of dependencies
logicstamp-context --depth 2

# Include full source code
logicstamp-context --include-code full
```

### Conservative mode

```bash
# Use llm-safe profile for smaller output
logicstamp-context --profile llm-safe --out safe-context.json

# Dry-run context generation and capture stats in CI
logicstamp-context ./src --stats > stats.jsonl

# Validate the default context.json in the current directory
logicstamp-validate

# Validate a custom-named bundle
logicstamp-validate context-review.json
```

## Output Format

The generated `context.json` contains an array of bundles:

```json
[
  {
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
            "description": "Button - Presentational component",
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
      "source": "logicstamp.manifest.json"
    }
  }
]
```

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

**TL;DR**: Use `logicstamp-context` for quick AI context generation. Use `@logicstamp/cli` for full contract management and verification.

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
