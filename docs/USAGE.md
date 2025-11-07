# LogicStamp Context - Usage Guide

## Quick Start

```bash
# Install globally
npm install -g logicstamp-context

# Generate context for your project
logicstamp-context

# Output: context.json with full component analysis
```

## Command Syntax

```bash
logicstamp-context [path] [options]
```

## Arguments

- `[path]` - Directory to scan (default: current directory)
  - Can be a specific directory: `./src`
  - Or a full path: `/Users/you/project/src`

## Options

### Core Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--depth <n>` | `-d` | `1` | Dependency traversal depth (0=self only, 1=direct deps, etc.) |
| `--include-code <mode>` | `-c` | `header` | Code inclusion: `none`, `header`, or `full` |
| `--format <fmt>` | `-f` | `json` | Output format: `json`, `pretty`, or `ndjson` |
| `--out <file>` | `-o` | `context.json` | Output file path |
| `--max-nodes <n>` | `-m` | `100` | Maximum nodes to include (prevents huge bundles) |
| `--profile <name>` | | `llm-chat` | Apply preset profile (see below) |
| `--strict` | `-s` | `false` | Fail if any dependency is missing |
| `--help` | `-h` | | Show help message |

## Profiles

Profiles apply preset combinations for common use cases:

### `llm-chat` (Default)
Balanced mode optimized for AI chat:
- Depth: 1 (direct dependencies)
- Code: headers only
- Max nodes: 100

```bash
logicstamp-context --profile llm-chat
```

### `llm-safe`
Conservative mode for token-limited contexts:
- Depth: 1
- Code: headers only
- Max nodes: 30

```bash
logicstamp-context --profile llm-safe
```

### `ci-strict`
Strict validation mode for CI/CD:
- Code: none (contracts only)
- Strict dependencies enabled
- Fails on missing deps

```bash
logicstamp-context --profile ci-strict
```

## Code Inclusion Modes

### `none` - Minimal
Only contract metadata. Smallest size, fastest to process.

```bash
logicstamp-context --include-code none
```

**Use when:** You only need structure, props, and logic signatures.

### `header` - Recommended
Includes JSDoc `@uif` header blocks. Good balance of context and size.

```bash
logicstamp-context --include-code header
```

**Use when:** You want contract reference without full implementation.

### `full` - Complete
Includes entire source files. Largest bundles but complete context.

```bash
logicstamp-context --include-code full --max-nodes 20
```

**Use when:** AI needs to see or modify implementation details.

## Output Formats

### `json` - Compact
One-line JSON, ideal for programmatic use.

```bash
logicstamp-context --format json
```

### `pretty` - Human-Readable
Formatted JSON with indentation.

```bash
logicstamp-context --format pretty
```

### `ndjson` - Streaming
Newline-delimited JSON (one bundle per line).

```bash
logicstamp-context --format ndjson
```

## Examples

### Basic Usage

```bash
# Scan current directory
logicstamp-context

# Scan specific directory
logicstamp-context ./src

# Custom output file
logicstamp-context --out my-context.json
```

### AI-Optimized Contexts

```bash
# For Claude/ChatGPT (balanced)
logicstamp-context --profile llm-chat

# For token-limited models (conservative)
logicstamp-context --profile llm-safe --out safe-context.json

# Include full source for deep analysis
logicstamp-context --include-code full --max-nodes 10
```

### Deep Dependency Analysis

```bash
# Two levels of dependencies
logicstamp-context --depth 2

# Three levels with full code
logicstamp-context --depth 3 --include-code full --max-nodes 50
```

### CI/CD Integration

```bash
# Strict mode - fails on missing dependencies
logicstamp-context --profile ci-strict

# Custom strict configuration
logicstamp-context --strict --include-code none
```

## Bundle Structure

The generated context.json contains an array of bundles:

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
            "description": "Button - Interactive component",
            "version": {
              "variables": [],
              "hooks": ["useState"],
              "components": [],
              "functions": ["Button"]
            },
            "logicSignature": {
              "props": {
                "onClick": {
                  "type": "function",
                  "signature": "() => void"
                }
              },
              "events": {},
              "state": {}
            },
            "semanticHash": "uif:...",
            "fileHash": "uif:..."
          },
          "codeHeader": "/** @uif Contract ... */"
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

## Understanding the Output

### Contract Structure
Each component contract includes:
- **version**: Structural composition (hooks, components, functions)
- **logicSignature**: API contract (props, events, state)
- **semanticHash**: Unique hash based on logic (detects changes)
- **fileHash**: Content hash (tracks modifications)

### Dependency Graph
- **nodes**: Array of components in the bundle
- **edges**: Dependencies between components `["Parent", "Child"]`

### Missing Dependencies
External or third-party dependencies that couldn't be analyzed:

```json
{
  "meta": {
    "missing": [
      {
        "name": "Input",
        "reason": "No contract found (third-party or not scanned)",
        "referencedBy": "src/components/LoginForm.tsx"
      }
    ]
  }
}
```

Common reasons:
- Third-party libraries (React, Material-UI, etc.)
- Node modules
- Files outside scan directory

## Integration with AI Tools

### Claude / ChatGPT

```bash
# Generate context
logicstamp-context --profile llm-chat

# Share with AI
# "Here's my codebase context: [paste context.json]"
# "Please review the LoginForm component for best practices"
```

### Cursor / GitHub Copilot

Add to workspace context:

```json
{
  "context": {
    "codebase": "./context.json"
  }
}
```

### VS Code / IDEs

Generate context and reference in prompts:

```bash
# Generate fresh context
logicstamp-context --out .vscode/context.json

# Reference in AI prompts
```

## Common Workflows

### 1. Project Overview for AI

```bash
# Generate comprehensive context
logicstamp-context --depth 1 --include-code header

# Result: context.json with all components and dependencies
```

Share with AI:
> "I've provided context.json with my React component structure. Can you suggest architectural improvements?"

### 2. Component-Specific Analysis

```bash
# Focus on src directory only
logicstamp-context ./src/components --out components-context.json

# Deep dive with full source
logicstamp-context ./src/components --depth 2 --include-code full
```

### 3. Documentation Generation

```bash
# Generate minimal context for docs
logicstamp-context --include-code none --format pretty --out docs/api.json
```

Use the output to auto-generate API documentation.

### 4. Code Review Context

```bash
# Balanced context for review
logicstamp-context --profile llm-chat --out review-context.json
```

Share with reviewer or AI:
> "Please review this codebase using the provided context"

## Performance

Typical performance metrics:

| Project Size | Components | Time | Output Size |
|--------------|------------|------|-------------|
| Small | 10-20 | <1s | ~50KB |
| Medium | 50-100 | 2-5s | ~200KB |
| Large | 200+ | 5-10s | ~500KB |

**Tips for large projects:**
- Use `--max-nodes` to limit bundle size
- Focus on specific directories
- Use `--include-code none` for minimal size
- Use `--profile llm-safe` for token efficiency

## Troubleshooting

### "No components found to analyze"
- Ensure directory contains `.ts` or `.tsx` files
- Check that files contain React components or TypeScript modules
- Try specifying a different directory: `logicstamp-context ./src`

### Bundle too large
- Reduce `--depth` (try `--depth 0` or `--depth 1`)
- Use `--include-code none` to exclude source
- Set `--max-nodes` lower (e.g., `--max-nodes 30`)
- Focus on specific subdirectories

### Missing dependencies
- These are usually external libraries (React, Material-UI, etc.)
- They're tracked in `meta.missing` but don't cause errors
- Use `--strict` to fail on missing deps if needed

### Slow analysis
- Large projects take longer to analyze
- Focus on specific directories to speed up
- Use `--max-nodes` to limit bundle generation

## Best Practices

1. **Start with defaults**: The default `llm-chat` profile works for most cases
2. **Use headers for reviews**: Full code is rarely needed for logic analysis
3. **Set max-nodes**: Prevents overwhelming AI with too much context
4. **Focus scans**: Scan specific directories for faster results
5. **Regenerate regularly**: Run before each AI session for fresh context
6. **Version context**: Include timestamp or bundle hash in prompts

## Comparison with Full LogicStamp CLI

| Feature | logicstamp-context | @logicstamp/cli |
|---------|-------------------|-----------------|
| Installation | npm install -g logicstamp-context | npm install @logicstamp/cli |
| Usage | Standalone, instant | Requires project setup |
| Context generation | ✅ Built-in | ✅ Via context command |
| Pre-compilation | ❌ Not needed | ✅ Required (compile first) |
| Contract verification | ❌ No | ✅ Yes (verify command) |
| Watch mode | ❌ No | ✅ Yes (observe command) |
| File output | ❌ No sidecars | ✅ Generates .uif.json |
| Use case | Quick AI context | Full contract management |

**When to use logicstamp-context:**
- Quick AI context generation
- One-off codebase analysis
- Lightweight tool
- No project configuration

**When to use @logicstamp/cli:**
- Contract management
- Continuous verification
- Watch mode for changes
- Full feature set

## See Also

- [README.md](../README.md) - Main documentation
- [examples/context.example.json](../examples/context.example.json) - Example output
- [LogicStamp Main Project](https://github.com/yourusername/logicstamp) - Full CLI
