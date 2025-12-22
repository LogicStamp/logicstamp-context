# LogicStamp Context

<div align="center">
  <img src="./assets/logicstamp-fox.svg" alt="LogicStamp Fox Mascot" width="120" height="120">
</div>

![Version](https://img.shields.io/badge/version-0.3.2-blue.svg)
![Beta](https://img.shields.io/badge/status-beta-orange.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
[![CI](https://github.com/LogicStamp/logicstamp-context/workflows/CI/badge.svg)](https://github.com/LogicStamp/logicstamp-context/actions)

**A tiny CLI that compiles your React/TypeScript codebase into machine-readable context bundles for AI and CI. Fast, deterministic, zero-config.**

![LogicStamp Context in action](./assets/logicstamp-context-demo.gif)
*Sample stamp context output with generated bundles*

## 🚀 Quick Start

**Try it in 30 seconds (no install required):**
```bash
npx logicstamp-context context
```

⏱️ Scans your repo and writes `context.json` files + `context_main.json` for AI tools.

**What you'll get:**
- 📁 `context.json` files (one per folder with components)
- 📋 `context_main.json` index file with project overview

**For a complete setup (recommended):**
```bash
npm install -g logicstamp-context
stamp init        # security scan by default
stamp context
```

> **💡 First time?** Run `stamp init` to set up `.gitignore` patterns and scan for secrets.

> **ℹ️** If you see `"PRIVATE_DATA"` in output, see the **Security** section below.

> **Note:** This is a beta release (v0.3.2). We're actively improving the tool based on user feedback. If you encounter any issues or have suggestions, please [open an issue on GitHub](https://github.com/LogicStamp/logicstamp-context/issues).

## Why LogicStamp?

LLMs understand your project instantly - without scanning 10,000+ lines of code

- **~65–72% token savings** vs raw source
- **Deterministic, structured contracts** that help AI avoid hallucinations by only referencing the true architecture
- **🔒 Built-in security** - automatic secret detection and sanitization in generated context files
- **Perfect for Cursor/Claude/GitHub Copilot Chat** — share context files for instant codebase understanding
- **CI-friendly** - detect drift, validate bundles, track changes

## Features

- 🧠 **AI-ready bundles** - predictable, structured, deterministic
- ⚛️ **React/TypeScript awareness** - props, hooks, state, deps
- 🎨 **Style metadata** - (Tailwind, SCSS, MUI, shadcn)
- 🛣️ **Next.js App Router detection** - (client/server, layout/page/etc)
- 🔎 **Dependency graph** - (imports, cycles, missing deps)
- 📦 **Per-folder bundles** - organized by your project structure
- ⚙️ **CI validation** - (drift detection, schema validation)
- 🔢 **Accurate token estimates** - (GPT/Claude)
- 🔒 **Security-first** - automatic secret detection and sanitization
- 💨 **Fast, zero-config** - works out of the box
- 🤖 **MCP-ready** - AI agents can consume context bundles via a standardized MCP interface

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

**v0.3.2**
- **🔒 Security update** - Updated `glob` dependency to 11.1.0+ to address CVE-2025-64756
- **📁 Improved portability** - Context files now use relative paths instead of absolute paths, improving portability across different machines and environments. See [Migration Guide](docs/MIGRATION_0.3.2.md) for details.
- **🎨 CSS/SCSS parsing now uses AST parser** - Migrated from regex-based extraction to AST-based parsing using `css-tree` for more robust and accurate parsing. Properly handles CSS selectors, SCSS feature detection (variables, nesting, mixins as boolean flags), nested rules in at-rules, and includes better error handling with graceful fallback.

**v0.3.1**
- **🔧 Hook classification accuracy** - Custom React hooks are now correctly classified as `react:hook` instead of `react:component`. The detection logic now checks if the main export is a function starting with "use" and has no JSX elements, ensuring hook files are properly distinguished from component files in context bundles.
- **📝 Added `react:hook` to ContractKind type** - The `ContractKind` type now includes `'react:hook'` as a valid kind, allowing proper classification of hook files in the contract system.

**v0.3.0** 🔒 **Security Release**
- **🛡️ Security scan now runs by default** - `stamp init` automatically scans for secrets to protect sensitive data
- **🔐 Automatic secret sanitization** - Detected secrets are automatically replaced with `"PRIVATE_DATA"` in generated context files
- **⚡ Improved default security posture** - Better protection out of the box for new projects
- Removed `--secure` flag (security scanning is now default; use `--no-secure` to skip)
- **Important**: Credentials can only be included in bundles when using `--include-code full` mode. Other modes (`none`, `header`, `header+style`) only include metadata, not implementation code.

📋 **Full history → [CHANGELOG.md](https://github.com/LogicStamp/logicstamp-context/blob/main/CHANGELOG.md)**

## Security

**Automatic Secret Protection (v0.3.0+)**

LogicStamp Context automatically protects sensitive data in generated context files:

- **🔍 Security scanning by default** - `stamp init` automatically scans for secrets (API keys, passwords, tokens)
- **🛡️ Automatic sanitization** - Detected secrets are replaced with `"PRIVATE_DATA"` in generated context files (source files are never modified)
- **📋 Manual exclusions** - Use `stamp ignore <file>` to manually exclude files with secrets from context generation via `.stampignore`
- **🔐 Safe by default** - Only metadata is included in default modes; credentials only appear in `--include-code full` mode

> **⚠️ Seeing `"PRIVATE_DATA"` in your context files?** This means secrets were detected in your codebase during scanning. The security scan examines `.ts`, `.tsx`, `.js`, `.jsx`, and `.json` files for secret patterns. **Action required:**
> 1. Review `stamp_security_report.json` to see what was found
> 2. Remove hard-coded secrets from your source code
> 3. Use environment variables or secret management tools instead
> 4. Run `stamp ignore <file>` to exclude files with secrets from context generation
> 
> **Best practice:** Never commit secrets to version control. Use `.env` files (in `.gitignore`) or secret management services.

> **Important**: Always review generated context files before sharing. For complete security documentation, see [SECURITY.md](https://github.com/LogicStamp/logicstamp-context/blob/main/SECURITY.md).

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

For full Documentation see: https://logicstamp.dev/docs

- **[Usage Guide](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md)** — Complete usage documentation with examples
- **[Example Files](https://github.com/LogicStamp/logicstamp-context/blob/main/examples/README.md)** — Complete example files (context.json, .stampignore, security reports)
- **[Token Optimization](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md#token-cost-comparison)** — Understand token costs and savings
- **[Mode Comparison](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/compare-modes.md)** — Detailed comparison across all modes
- **[Output Format](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/schema.md)** — Complete schema documentation
- **[CI Integration](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md#cicd-integration)** — CI/CD workflows and validation
- **[Troubleshooting](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/usage.md#troubleshooting)** — Common issues and solutions
- **[UIF Contracts](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/uif_contracts.md)** — Understanding component contracts

## Known Limitations

LogicStamp Context is still in beta. A few edge cases are not fully supported yet.

See the full list here: [docs/limitations.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/limitations.md)

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

## Branding & Attribution

The LogicStamp Fox mascot and related brand assets are © 2025 Amit Levi.

These assets may not be used for third-party branding, logos, or commercial identity without permission. They are included in this repository for documentation and non-commercial use within the LogicStamp ecosystem only.

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
