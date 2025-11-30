# LogicStamp Context

<div align="center">
  <img src="https://raw.githubusercontent.com/LogicStamp/logicstamp-context/main/assets/logicstamp-fox.svg" alt="LogicStamp Fox Mascot" width="120" height="120">
</div>

![Version](https://img.shields.io/badge/version-0.2.6-blue.svg)
![Beta](https://img.shields.io/badge/status-beta-orange.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
[![CI](https://github.com/LogicStamp/logicstamp-context/workflows/CI/badge.svg)](https://github.com/LogicStamp/logicstamp-context/actions)

**A tiny CLI that compiles your React/TypeScript codebase into machine-readable context bundles for AI and CI. Fast, deterministic, zero-config.**

## Quick Start

**Global CLI (recommended):**
```bash
npm install -g logicstamp-context
cd your-project
stamp context
```

**OR local:**
```bash
npm install -D logicstamp-context
npx stamp context
```

That's it! LogicStamp Context will scan your project and generate `context.json` files organized by folder, plus a `context_main.json` index file. Share these files with AI assistants for instant codebase understanding.

![LogicStamp Context in action](https://raw.githubusercontent.com/LogicStamp/logicstamp-context/main/assets/demo-screenshot.png)
*Sample stamp context output with generated bundles*

> **Note:** This is a beta release (v0.2.6). We're actively improving the tool based on user feedback. If you encounter any issues or have suggestions, please [open an issue on GitHub](https://github.com/LogicStamp/logicstamp-context/issues).

## Why LogicStamp?

LLMs understand your project instantly - without scanning 10,000+ lines of code

- **~65–72% token savings** vs raw source
- **Deterministic, structured contracts** that help AI avoid hallucinations by only referencing the true architecture
- **Perfect for Cursor/Claude/GitHub Copilot Chat** — share context files for instant codebase understanding
- **CI-friendly** — detect drift, validate bundles, track changes

This gives newcomers the "aha moment" in seconds.

## Features

- 🧠 **AI-ready bundles** - predictable, structured, deterministic
- ⚛️ **React/TypeScript awareness** - props, hooks, state, deps
- 🎨 **Style metadata** - (Tailwind, SCSS, MUI, shadcn)
- 🛣️ **Next.js App Router detection** - (client/server, layout/page/etc)
- 🔎 **Dependency graph** - (imports, cycles, missing deps)
- 📦 **Per-folder bundles** - organized by your project structure
- ⚙️ **CI validation** - (drift detection, schema validation)
- 🔢 **Accurate token estimates** - (GPT/Claude)
- 💨 **Fast, zero-config** - works out of the box
- 🤖 **MCP-ready (coming soon)** - AI agents can consume context bundles via a standardized MCP interface

## Example Output

LogicStamp Context generates structured JSON contracts for each component:

```json
{
  "entryId": "src/components/Button.tsx",
  "kind": "react:component",
  "props": {
    "variant": { "type": "literal-union", "literals": ["primary", "secondary"] },
    "onClick": { "type": "function", "signature": "() => void" }
  },
  "hooks": ["useState"],
  "nextjs": { "directive": "client" },
  "style": {
    "styleSources": {
      "tailwind": { "categories": { "layout": ["flex"], "colors": ["bg-blue-500"] } }
    }
  },
  "edges": ["./Icon"]
}
```

📋 **See [docs/schema.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/schema.md) for complete output format documentation**

## Installation

```bash
npm install -g logicstamp-context
```

After installation, the `stamp` command will be available globally.

**Note**: "Global CLI" means the tool is installed globally on your system (via `npm install -g`), making the `stamp` command available from any directory in your terminal, not just within a specific project folder.
- **Local install**: `npm install logicstamp-context` → only available in that project
- **Global install**: `npm install -g logicstamp-context` → available everywhere via `stamp` command

## Recent Updates

**v0.2.6**
- Export metadata extraction (default/named exports detection)
- Internal component filtering (improved dependency tracking accuracy)
- Enhanced dependency graph accuracy

**v0.2.5**
- ShadCN/UI and Radix UI style extraction
- Enhanced debug logging and error handling
- Model name corrections (GPT-4o-mini → GPT-4o)
- Documentation consistency improvements

**v0.2.4**
- Material UI style extraction
- Improved global CLI installation docs
- Refined README and docs structure
- Streamlined README
- Improved token estimation
- UIF Contracts documentation

📋 **Full history → [CHANGELOG.md](https://github.com/LogicStamp/logicstamp-context/blob/main/CHANGELOG.md)**

## Usage

```bash
stamp --version                    # Show version number
stamp --help                       # Show help
stamp init [path] [options]        # Initialize project preferences
stamp context [path] [options]     # Generate context bundles
stamp context style [path] [options]  # Generate with style metadata
stamp context compare [options]    # Detect context drift
stamp context validate [file]      # Validate context files
stamp context clean [path] [options]  # Remove generated files
```

### Quick Command Reference

| Command | Description | Docs |
|---------|-------------|------|
| `stamp init` | Initialize project (`.gitignore`, `LLM_CONTEXT.md`, config) | [init.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/init.md) |
| `stamp context` | Generate AI-ready context bundles organized by folder | [context.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/context.md) |
| `stamp context style` | Generate context with style metadata (Tailwind, SCSS, etc.) | [style.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/style.md) |
| `stamp context compare` | Compare context files to detect changes (CI-friendly) | [compare.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/compare.md) |
| `stamp context validate` | Validate context file schema and structure | [validate.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/validate.md) |
| `stamp context clean` | Remove all generated context artifacts | [clean.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/clean.md) |

### Common Options

**`stamp context` options:**
- `--depth <n>` / `-d` - Dependency traversal depth (default: `1`)
- `--include-code <mode>` / `-c` - Code inclusion: `none|header|full` (default: `header`)
- `--include-style` - Extract style metadata (Tailwind, SCSS, animations, layout)
- `--format <fmt>` / `-f` - Output format: `json|pretty|ndjson` (default: `json`)
- `--max-nodes <n>` / `-m` - Maximum nodes per bundle (default: `100`)
- `--profile <profile>` - Preset: `llm-chat` (default), `llm-safe`, `ci-strict`
- `--stats` - Emit JSON stats with token estimates (CI-friendly)
- `--out <path>` / `-o` - Output directory or file path
- `--quiet` / `-q` - Suppress verbose output

📋 **See [docs/cli/commands.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/commands.md) for complete option reference**

## Documentation

- **[Usage Guide](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md)** — Complete usage documentation with examples
- **[Token Optimization](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md#token-cost-comparison)** — Understand token costs and savings
- **[Mode Comparison](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/compare-modes.md)** — Detailed comparison across all modes
- **[Output Format](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/schema.md)** — Complete schema documentation
- **[CI Integration](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md#cicd-integration)** — CI/CD workflows and validation
- **[Troubleshooting](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md#troubleshooting)** — Common issues and solutions
- **[UIF Contracts](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/uif_contracts.md)** — Understanding component contracts

## Need Help?

- **Open an issue** → https://github.com/LogicStamp/logicstamp-context/issues
- **Join our roadmap** → https://logicstamp.dev

## What is this?

**LogicStamp Context** is a lightweight tool that scans your React/TypeScript codebase and generates structured context bundles optimized for AI tools like Claude, ChatGPT, and other LLMs.

No setup, no configuration, no pre-compilation required. Just point it at your code and get instant, AI-ready documentation.

## How it Works

1. **Scan**: Finds all `.ts` and `.tsx` files in your project
2. **Analyze**: Parses React components using TypeScript AST
3. **Extract**: Builds component contracts with structure and signatures
4. **Graph**: Creates dependency graph showing relationships
5. **Bundle**: Packages context bundles optimized for AI consumption
6. **Organize**: Groups bundles by folder and writes `context.json` files maintaining directory structure
7. **Index**: Creates `context_main.json` index with folder metadata and summary statistics

All in one command, no pre-compilation needed!

## Requirements

- Node.js >= 18.0.0
- TypeScript/React codebase

## License

MIT

## Contributing

Issues and PRs welcome! This is an open-source project.

**See [CONTRIBUTING.md](https://github.com/LogicStamp/logicstamp-context/blob/main/CONTRIBUTING.md) for detailed guidelines**, including:
- Branching strategy (feature → `main`, no `develop` branch)
- Branch naming conventions (`feature/*`, `fix/*`, `docs/*`)
- Commit message format (Conventional Commits)
- Development workflow and best practices

## Links

- [LogicStamp Main Project](https://logicstamp.dev)
- [GitHub Repository](https://github.com/LogicStamp/logicstamp-context)
- [Report Issues](https://github.com/LogicStamp/logicstamp-context/issues)
