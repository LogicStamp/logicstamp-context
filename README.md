<div align="center">
  <a href="https://logicstamp.dev">
    <img src="assets/logicstamp-woodmark.png" alt="LogicStamp" width="420" height="auto">
  </a>

  <br/>
  <br/>

  ![Version](https://img.shields.io/badge/version-0.3.8-8b5cf6.svg)
  ![Beta](https://img.shields.io/badge/status-beta-orange.svg)
  ![License](https://img.shields.io/badge/license-MIT-green.svg)
  ![Node](https://img.shields.io/badge/node-%3E%3D18.18.0-brightgreen.svg)
  [![CI](https://github.com/LogicStamp/logicstamp-context/workflows/CI/badge.svg)](https://github.com/LogicStamp/logicstamp-context/actions)

  <br/>

  <table>
    <tr>
      <td align="center">
        <a href="https://github.com/LogicStamp">
          <img src="./assets/logicstamp-fox.svg" alt="LogicStamp Fox" width="80" style="min-width: 72px;">
        </a>
      </td>
      <td align="left">
        <strong>AI-ready context bundles for React & TypeScript.</strong><br/>
        Fast. Deterministic. One-time setup.
      </td>
    </tr>
  </table>

   <br/>
</div>

![LogicStamp Context in action](./assets/logicstamp-context-demo.gif)
*Sample stamp context output with generated bundles*

<br/>

<details>
<summary><strong>📑 Table of Contents</strong></summary>

- [Quick Start](#quick-start)
- [Why LogicStamp?](#why-logicstamp)
- [Features](#-features)
- [How it Works](#how-it-works)
- [MCP Server](#mcp-server)
- [Example Output](#example-output)
- [Installation](#installation)
- [Security](#security)
- [Usage](#usage)
- [Documentation](#documentation)
- [Known Limitations](#known-limitations)
- [Requirements](#requirements)
- [Need Help?](#need-help)
</details>

## Quick Start

**Try it in 30 seconds (no install required):**
```bash
npx logicstamp-context context
```

Scans your repo and writes `context.json` files + `context_main.json` for AI tools.

> **Note:** With `npx`, run `npx logicstamp-context context`. After global install, use `stamp context`.

**What you'll get:**
- 📁 `context.json` files (one per folder with components, preserving your directory structure)
- 📋 `context_main.json` index file with project overview and folder metadata
- All files written to current directory (or use `--out <path>` to specify a different location)

**For a complete setup (recommended):**
```bash
npm install -g logicstamp-context
stamp init        # security scan by default
stamp context
```

> **💡 First time?** Run `stamp init` to set up `.gitignore` patterns and scan for secrets. You can skip this step, but it's recommended to prevent committing generated files and detect secrets.

> **ℹ️** If you see `"PRIVATE_DATA"` in output, see the **Security** section below.

> **Note:** This is a beta release (v0.3.8). We're actively improving the tool based on user feedback. If you encounter any issues or have suggestions, please [open an issue on GitHub](https://github.com/LogicStamp/logicstamp-context/issues).

📋 **For a detailed step-by-step getting started guide with integration examples, see [Getting Started Guide](https://logicstamp.dev/docs/getting-started).**

## Why LogicStamp?

LLMs can reason about your project structure without scanning raw source files.

### Structured Data vs Raw Source

Instead of parsing raw source code line-by-line, LogicStamp provides **pre-processed, categorized information** that's immediately actionable:

- **Semantic density** - Information is grouped by meaning (layout, colors, spacing) rather than scattered in code
- **Pre-processed relationships** - Dependency graphs are explicit (`graph.edges`) rather than requiring inference
- **Contract-based APIs** - Component interfaces (`logicSignature.props`) are explicit, no need to read implementation
- **Categorized metadata** - Style patterns, dependencies, and structure are organized for direct querying

**Example:** To answer "What design patterns does the Hero component use?":
- **Raw source**: Read 200+ lines, parse className strings, identify patterns manually
- **Structured**: Read `style.layout.hasHeroPattern: true`, `style.visual.colors: [...]` - answer in seconds

This transforms code analysis from "parse and infer" to "read and reason" - making AI assistants faster and more accurate.

### Additional Benefits

- **Token efficient** - Structured context replaces the need to ship raw source (varies by technology)
  - When including style metadata (`--include-style`), token savings differ by framework:
    - **CSS / SCSS / CSS Modules / styled-components**: typically ~40-70% fewer tokens than raw styles
    - **Tailwind CSS**: typically ~5-10% fewer tokens (utility classes are already compact)
  - *Observed during beta testing; actual results vary by project structure and usage*
  
  > Token savings are a side effect - the primary gain is deterministic, inspectable context.
- **Deterministic, structured contracts** - Help AI avoid hallucinations by only referencing the true architecture
- **🔒 Built-in security** - Automatic secret detection and sanitization in generated context files
- **Perfect for Cursor/Claude/GitHub Copilot Chat** - Share context files for instant codebase understanding
- **CI-friendly** - Detect drift, validate bundles, track changes

### Framework Support

- **React** - full support (components, hooks, props, styles)
- **Next.js** - partial support (App / Pages Router analysis)
- **Vue 3** - partial support (Composition API in TS/TSX files)
- **UI frameworks** - Material UI, ShadCN/UI, Radix UI, Tailwind CSS, Styled Components, SCSS/CSS Modules

> **Note:** LogicStamp currently analyzes `.ts` and `.tsx` files only. JavaScript files (`.js`, `.jsx`) are not analyzed for context generation. Vue 3 support works with `.ts`/`.tsx` files only, not `.vue` SFC files. CSS and SCSS files imported by your TypeScript/TSX files are also parsed when using `--include-style` (standalone CSS/SCSS files that aren't imported won't be analyzed).

## ⚡ Features

- **AI-ready bundles** - predictable, structured, deterministic
- **React/Next.js/Vue/TypeScript awareness** - props, hooks/composables, state, deps
- **Style metadata** - (Tailwind, SCSS, MUI, shadcn)
- **Next.js App Router detection** - (client/server, layout/page/etc)
- **Vue 3 Composition API** - (ref, reactive, computed, composables)
- **Dependency graph** - (imports, cycles, missing deps)
- **Per-folder bundles** - organized by your project structure
- **CI validation** - (drift detection, schema validation)
- **Accurate token estimates** - (GPT/Claude)
- **Security-first** - automatic secret detection and sanitization
- **Fast, one-time setup** - works out of the box (no config files needed, sensible defaults)
- **MCP-ready** - AI agents can consume context bundles via a standardized MCP interface

## How it Works

1. **Scan**: Finds all `.ts` and `.tsx` files in your project
2. **Analyze**: Parses React/Next.js/Vue components using TypeScript AST
3. **Extract**: Builds component contracts with structure and signatures
4. **Graph**: Creates dependency graph showing relationships
5. **Bundle**: Packages context bundles optimized for AI consumption
6. **Organize**: Groups bundles by folder and writes `context.json` files maintaining directory structure
7. **Index**: Creates `context_main.json` index with folder metadata and summary statistics

All in one command, no pre-compilation needed!

> **💡 Tip:** Use `stamp context` for basic context generation (component contracts, dependencies, props). Use `stamp context style` (equivalent to `stamp context --include-style`) when you need style metadata extracted (Tailwind classes, SCSS selectors, CSS-in-JS patterns, layout information). Style extraction adds more tokens but provides richer design system context for AI assistants.

## MCP Server

For AI assistants with MCP support (Claude Desktop, Cursor, etc.):

```bash
npm install -g logicstamp-mcp
```

Then configure your AI assistant to use the LogicStamp MCP Server to analyze your project.

![LogicStamp MCP Workflow](./assets/logicstamp-workflow.gif)
*MCP server calling the CLI to generate and consume context bundles*

📋 **See [MCP Getting Started Guide](https://logicstamp.dev/docs/mcp/getting-started) for detailed installation instructions for Claude Code, Claude Desktop, Cursor, and other MCP clients.**

## Example Output

LogicStamp Context generates structured JSON bundles organized by folder. Each bundle contains a dependency graph with component contracts:

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
          "logicSignature": {
            "props": {
              "variant": { "type": "literal-union", "literals": ["primary", "secondary"] },
              "onClick": { "type": "function", "signature": "() => void" }
            }
          },
          "version": {
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

📋 **See [docs/schema.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/schema.md) for complete output format documentation**

## Installation

```bash
npm install -g logicstamp-context
```

After installation, the `stamp` command will be available globally.

**Note**: "Global CLI" means the tool is installed globally on your system (via `npm install -g`), making the `stamp` command available from any directory in your terminal, not just within a specific project folder.
- **Local install**: `npm install logicstamp-context` → only available in that project
- **Global install**: `npm install -g logicstamp-context` → available everywhere via `stamp` command

## Security

**Automatic Secret Protection (v0.3.0+)**

LogicStamp Context automatically protects sensitive data in generated context files:

- **Security scanning by default** - `stamp init` automatically scans for secrets (API keys, passwords, tokens)
- **Automatic sanitization** - Detected secrets are replaced with `"PRIVATE_DATA"` in generated context files (source files are never modified)
- **Manual exclusions** - Use `stamp ignore <file>` to manually exclude files with secrets from context generation via `.stampignore`
- **Safe by default** - Only metadata is included in default modes; credentials only appear in `--include-code full` mode

> **⚠️ Seeing `"PRIVATE_DATA"` in your context files?** This means secrets were detected in your codebase during scanning. The security scan examines `.ts`, `.tsx`, `.js`, `.jsx`, and `.json` files for secret patterns. **Action required:**
> 1. Review `stamp_security_report.json` to see what was found
> 2. Remove hard-coded secrets from your source code
> 3. Use environment variables or secret management tools instead
> 4. Run `stamp ignore <file>` to exclude files with secrets from context generation
> 
> **Best practice:** Never commit secrets to version control. Use `.env` files (in `.gitignore`) or secret management services.

> **ℹ️ Important**: Always review generated context files before sharing. For complete security documentation, see [SECURITY.md](https://github.com/LogicStamp/logicstamp-context/blob/main/SECURITY.md).

## Usage

```bash
stamp --version                    # Show version number
stamp --help                       # Show help
stamp init [path] [options]        # Initialize project preferences (security scan runs by default)
stamp init --no-secure             # Initialize without security scan
stamp ignore <path> [path2] ...    # Add files/folders to .stampignore
stamp security scan [path] [options]  # Scan for secrets (API keys, passwords, tokens)
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
| `stamp ignore` | Add files/folders to `.stampignore` to exclude from context | [ignore.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/ignore.md) |
| `stamp security scan` | Scan for secrets (API keys, passwords, tokens) | [security-scan.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/security-scan.md) |
| `stamp security --hard-reset` | Reset security configuration (delete security report) | [security-scan.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/security-scan.md) |
| `stamp context` | Generate AI-ready context bundles organized by folder | [context.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/context.md) |
| `stamp context style` | Generate context with style metadata (Tailwind, SCSS, etc.) | [style.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/style.md) |
| `stamp context compare` | Compare context files to detect changes (CI-friendly) | [compare.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/compare.md) |
| `stamp context validate` | Validate context file schema and structure | [validate.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/validate.md) |
| `stamp context clean` | Remove all generated context artifacts | [clean.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/clean.md) |

### Common Options

**`stamp context` options:**
- `--depth <n>` / `-d` - Dependency traversal depth (default: `2`)
- `--include-code <mode>` / `-c` - Code inclusion: `none|header|full` (default: `header`)
- `--include-style` - Extract style metadata (Tailwind, SCSS, animations, layout)
- `--format <fmt>` / `-f` - Output format: `json|pretty|ndjson|toon` (default: `json`)
- `--max-nodes <n>` / `-m` - Maximum nodes per bundle (default: `100`)
- `--profile <profile>` - Preset: `llm-chat` (default), `llm-safe`, `ci-strict`
- `--compare-modes` - Compare token costs across all modes (none/header/header+style/full)
- `--stats` - Emit JSON stats with token estimates (CI-friendly)
- `--out <path>` / `-o` - Output directory (default: current directory)
- `--quiet` / `-q` - Suppress verbose output

📋 **See [docs/cli/commands.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/commands.md) for complete option reference**

## Documentation

For full Documentation see: https://logicstamp.dev/docs

- **[Getting Started Guide](https://logicstamp.dev/docs/getting-started)** - Step-by-step installation and quick start guide
- **[Usage Guide](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md)** - Complete usage documentation with examples
- **[Example Files](https://github.com/LogicStamp/logicstamp-context/blob/main/examples/README.md)** - Complete example files (context.json, .stampignore, security reports)
- **[Token Optimization](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md#token-cost-comparison)** - Understand token costs and savings
- **[Mode Comparison](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/compare-modes.md)** - Detailed comparison across all modes
- **[Output Format](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/schema.md)** - Complete schema documentation
- **[CI Integration](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md#cicd-integration)** - CI/CD workflows and validation
- **[Troubleshooting](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md#troubleshooting)** - Common issues and solutions
- **[UIF Contracts](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/uif_contracts.md)** - Understanding component contracts
- **[Roadmap](https://github.com/LogicStamp/logicstamp-context/blob/main/ROADMAP.md)** - Planned features, improvements, and future enhancements

## Known Limitations

LogicStamp Context is still in beta. A few edge cases are not fully supported yet.

See the full list here: [docs/limitations.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/limitations.md)

## Need Help?

- **Open an issue** → https://github.com/LogicStamp/logicstamp-context/issues
- **Join our roadmap** → https://logicstamp.dev/roadmap

## Requirements

- Node.js >= 18.18.0 (**Node 20+ recommended**)
- TypeScript codebase (React or Next.js)

## License

MIT

## Branding & Attribution

The LogicStamp Fox mascot and related brand assets are © 2025 Amit Levi.

These assets may not be used for third-party branding, logos, or commercial identity without permission. They are included in this repository for documentation and non-commercial use within the LogicStamp ecosystem only.

## Contributing

Issues and PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Community

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.


## Links

- [LogicStamp Main Project](https://logicstamp.dev)
- [GitHub Repository](https://github.com/LogicStamp/logicstamp-context)
- [MCP Server Repository](https://github.com/LogicStamp/logicstamp-mcp)
- [Changelog](https://github.com/LogicStamp/logicstamp-context/blob/main/CHANGELOG.md)
- [Report Issues](https://github.com/LogicStamp/logicstamp-context/issues)