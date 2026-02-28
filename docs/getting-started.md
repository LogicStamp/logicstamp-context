# Getting Started with LogicStamp Context

Welcome to LogicStamp Context - the context compiler for TypeScript. This guide will help you compile your codebase into deterministic architectural contracts for AI workflows.

## What is LogicStamp Context?

LogicStamp Context compiles TypeScript codebases into **deterministic architectural contracts** and dependency graphs. Instead of AI assistants parsing raw source code, they consume a structured, machine-consumable representation that explicitly describes:

- Component props and their types
- Hooks and state management
- Dependencies and relationships
- API signatures (for backend code)
- Style metadata (optional)

**Key benefits:**
- ✅ **Deterministic** - Same code always produces the same contracts
- ✅ **Structured** - Pre-parsed contracts, not raw source code
- ✅ **Framework-aware** - Understands React, Next.js, Vue, Express, NestJS
- ✅ **Watch mode** - Auto-regenerates as you code
- ✅ **MCP-ready** - Works seamlessly with AI assistants via MCP protocol

## Choose Your Path

LogicStamp Context can be used in two ways:

### 🖥️ **CLI Usage** - For Developers
Use the command-line interface to generate context files that you can share with AI assistants or use in your workflows.

**Best for:**
- Generating context files manually
- CI/CD pipelines
- Sharing context with team members
- Custom automation scripts

👉 **[Start with CLI →](cli/getting-started.md)**

### 🤖 **MCP Server** - For AI Assistants
Install the MCP server to give AI assistants (Claude Desktop, Cursor) direct access to your codebase context.

**Best for:**
- Using Claude Desktop or Cursor AI
- Real-time context access for AI assistants
- Automatic context updates via watch mode
- Seamless AI workflow integration

👉 **[Start with MCP →](https://logicstamp.dev/docs/mcp/getting-started)** (MCP server documentation)

## Quick Start (30 seconds)

Want to try it right now? No installation required:

```bash
npx logicstamp-context context
```

This will:
1. Scan your TypeScript codebase
2. Generate `context.json` files (one per folder)
3. Create `context_main.json` index file

**What you get:**
- 📁 `context.json` files - Component contracts organized by folder
- 📋 `context_main.json` - Project overview and folder metadata

## How It Works

```
TypeScript Code  →  AST Parsing  →  Deterministic Contracts  →  AI Assistant
   (.ts/.tsx)        (ts-morph)      (context.json bundles)      (Claude, Cursor)
```

1. **Scan** - Finds all `.ts` and `.tsx` files in your project
2. **Analyze** - Parses components and APIs using TypeScript AST (via `ts-morph`)
3. **Extract** - Builds contracts with props, hooks, state, signatures
4. **Graph** - Creates dependency graph showing relationships
5. **Bundle** - Packages context optimized for AI workflows
6. **Organize** - Groups by folder, writes `context.json` files
7. **Index** - Creates `context_main.json` with metadata and statistics

## Example Output

LogicStamp Context generates structured JSON bundles:

```json
{
  "type": "LogicStampBundle",
  "entryId": "src/components/Button.tsx",
  "graph": {
    "nodes": [
      {
        "entryId": "src/components/Button.tsx",
        "contract": {
          "kind": "react:component",
          "interface": {
            "props": {
              "variant": { "type": "literal-union", "literals": ["primary", "secondary"] },
              "onClick": { "type": "function", "signature": "() => void" }
            }
          },
          "composition": {
            "hooks": ["useState"],
            "components": ["./Icon"]
          }
        }
      }
    ],
    "edges": [["src/components/Button.tsx", "./Icon"]]
  }
}
```

📋 **See [Schema Documentation](schema.md)** for complete format details.

## Requirements

- **Node.js** >= 18.18.0 (Node 20+ recommended)
- **TypeScript codebase** (React, Next.js, Vue, Express, or NestJS)

## Framework Support

| Framework | Support Level | What's Extracted |
|-----------|--------------|------------------|
| **React** | Full | Components, hooks, props, styles |
| **Next.js** | Full | App Router roles, segment paths, metadata |
| **Vue 3** | Partial | Composition API (TS/TSX only, not .vue SFC) |
| **Express.js** | Full | Routes, middleware, API signatures |
| **NestJS** | Full | Controllers, decorators, API signatures |
| **UI Libraries** | Full | Material UI, ShadCN, Radix, Tailwind, Styled Components, SCSS, Chakra UI, Ant Design |

> **ℹ️ Note:** LogicStamp Context analyzes `.ts` and `.tsx` files only. JavaScript files are not analyzed.

## Next Steps

### For CLI Users
1. **[CLI Getting Started Guide](cli/getting-started.md)** - Complete CLI setup and usage
2. **[Usage Guide](usage.md)** - Comprehensive command reference
3. **[Watch Mode](cli/watch.md)** - Auto-regenerate context as you code
4. **[Schema Documentation](schema.md)** - Understanding output format

### For MCP Users
1. **[MCP Getting Started Guide](mcp/getting-started.md)** - MCP server setup
2. **[CLI Getting Started Guide](cli/getting-started.md)** - Understanding the underlying CLI
3. **[Watch Mode](cli/watch.md)** - Keep context fresh automatically

## Common Workflows

### Development Workflow
```bash
# Initialize project
stamp init

# Start watch mode (auto-regenerates on changes)
stamp context --watch

# Generate with style metadata
stamp context style
```

### CI/CD Workflow
```bash
# Generate context in CI
stamp context --profile ci-strict --strict-missing

# Validate context files
stamp context validate

# Compare for drift detection
stamp context compare
```

### AI Assistant Workflow
```bash
# Generate context for AI
stamp context --profile llm-chat

# Or use MCP server for automatic access
# (See MCP Getting Started Guide)
```

## Security

LogicStamp Context includes **automatic secret protection**:

- **Security scanning** - `stamp init` scans for secrets (API keys, passwords, tokens)
- **Automatic sanitization** - Detected secrets replaced with `"PRIVATE_DATA"` in output
- **Safe by default** - Only metadata included. Credentials only appear in `--include-code full` mode

🔒 **See [Security Documentation](../SECURITY.md)** for complete security details.

## Need Help?

- **Issues** - [GitHub Issues](https://github.com/LogicStamp/logicstamp-context/issues)
- **Documentation** - [Full Documentation Index](https://logicstamp.dev/docs)
- **Roadmap** - [logicstamp.dev/roadmap](https://logicstamp.dev/roadmap)

## What's Next?

- **New to LogicStamp?** → Start with [CLI Getting Started](cli/getting-started.md)
- **Using AI Assistants?** → Check out [MCP Getting Started](https://logicstamp.dev/docs/mcp/getting-started)
- **Want to understand output?** → Read [Schema Documentation](schema.md)
- **Need command reference?** → See [Usage Guide](usage.md)

---

**Ready to get started?** Choose your path above or jump to the [Quick Start](#quick-start-30-seconds) section!
