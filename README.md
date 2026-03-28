<div align="center">
  <a href="https://logicstamp.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/logicstamp-woodmark-dark.png">
      <source media="(prefers-color-scheme: light)" srcset="assets/logicstamp-woodmark-light.png">
      <img src="assets/logicstamp-woodmark-light.png" alt="LogicStamp" width="400" height="auto">
    </picture>
  </a>

## The Context Compiler for TypeScript.

<em>Supports: React · Next.js · Vue (TS/TSX) · Express · NestJS</em>

<br/>
</div>

LogicStamp Context is a CLI that compiles TypeScript codebases into deterministic, diffable architectural contracts and dependency graphs - a compact, structured source of truth for AI coding workflows.

Includes watch mode, strict, auditable diffs, and real-time breaking change detection.
Use with [logicstamp-mcp](https://github.com/LogicStamp/logicstamp-mcp) to feed structured context into **Claude**, **Cursor**, and other MCP-compatible assistants.

<div align="center">

  <br/>
  <a href="https://github.com/LogicStamp">
    <img src="./assets/logicstamp-fox.svg" alt="LogicStamp Fox Mascot" width="100" style="min-width: 80px;">
  </a>

  [![Version](https://img.shields.io/npm/v/logicstamp-context?color=8b5cf6&label=version)](https://www.npmjs.com/package/logicstamp-context)
  ![Beta](https://img.shields.io/badge/status-beta-orange.svg)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
  ![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)
  [![CI](https://github.com/LogicStamp/logicstamp-context/workflows/CI/badge.svg)](https://github.com/LogicStamp/logicstamp-context/actions)

</div>
<br/>

<details>
<summary><strong>📑 Table of Contents</strong></summary>

- [The Problem](#the-problem)
- [Quick Start](#quick-start)
- [What LogicStamp does](#what-logicstamp-does)
- [Why Structured Context?](#why-structured-context)
- [Features](#-features)
- [Watch Mode](#watch-mode)
- [How it Works](#how-it-works)
- [MCP Server](#mcp-server)
- [Example Output](#example-output)
- [Installation](#installation)
- [Security](#security)
- [Usage](#usage)
- [Framework Support](#framework-support)
- [Documentation](#documentation)
- [Known Limitations](#known-limitations)
- [Benchmarks](#benchmarks)
- [Requirements](#requirements)
- [Need Help?](#need-help)
- [License](#license)
</details>

## The Problem

AI coding assistants read your source code - but they don’t understand its structure.  
They hallucinate props, miss dependencies, and can’t detect when a breaking change impacts consumers.

Example: your `Button` accepts `variant` and `disabled`, but the AI suggests `isLoading` because it saw that pattern elsewhere. Without a structured contract, there is no reliable source of truth.

**LogicStamp Context** compiles TypeScript into deterministic architectural contracts and dependency graphs - a machine-readable representation of your system that AI tools can consume instead of parsing raw implementation code.

These contracts:

- Stay in sync with your code (watch mode auto-regenerates)
- Expose interfaces (props, hooks, APIs) without implementation noise
- Are deterministic, diffable, and auditable
- Enable early detection of architectural drift and breaking changes

![LogicStamp MCP Workflow](./assets/logicstamp-workflow.gif)
*Example workflow: `stamp context --strict-watch` generates context bundles that MCP-powered assistants use to explain component architecture (ThemeContext shown here).*

**Same code ⇒ same context output.** Contracts are diffable, so you can detect drift and breaking changes.

```
TypeScript Code  →  Compilation  →  Deterministic Contracts  →  AI Assistant
   (.ts/.tsx)        (ts-morph)       (context.json bundles)     (Claude, Cursor)
```

---

## Quick Start

**Try it in 30 seconds (no install required):**
```bash
npx logicstamp-context context
```

Scans your repo and writes `context.json` files + `context_main.json` for AI tools.

**What you get:**
- 📁 `context.json` files - one per folder with components, preserving your directory structure
- 📋 `context_main.json` - index file with project overview and folder metadata

**For a complete setup (recommended):**
```bash
npm install -g logicstamp-context
stamp init        # sets up .gitignore, scans for secrets
stamp context
```

> **ℹ️ Note:** With `npx`, run `npx logicstamp-context context`. After global install, use `stamp context`.

📋 **For detailed setup instructions, see the [Getting Started Guide](https://logicstamp.dev/docs/getting-started).**

## What LogicStamp does

- **Context compiler** - Compiles TypeScript codebases into deterministic, diffable architectural contracts using the TypeScript compiler API (via ts-morph).
- **Deterministic & diffable** - Same code → same output. Contracts are auditable, comparable, and stable across runs.
- **Framework-aware** - Understands React, Next.js, Vue, Express, and NestJS patterns and extracts structured metadata.
- **LLM-oriented** - Produces structured contracts and dependency graphs (not raw code) with token estimates and modes for AI workflows.
- **Analysis-only** - Describes your system without modifying code or enforcing patterns.

### How it fits your stack

- **Works alongside `tsc`** - Focuses on contract structure and change detection, not type-checking. Use `tsc --noEmit` for compiler errors. `compare --strict` and `--strict-watch` flag **contract-level** breaking changes.
- **Beyond `.d.ts`** - Adds semantic contracts, dependency graphs, and diffable hashes (`semanticHash`, `bundleHash`) alongside declaration surfaces.
- **Context, not control** - Feeds structured context to assistants. decisions stay with you.

📋 **For detailed behavior, CLI options, and workflows, see the [Usage guide](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/guides/usage.md).**

## Why Structured Context?

| Without LogicStamp Context | With LogicStamp Context |
|-------------------|-----------------|
| AI parses 200 lines of implementation to infer a component's interface | AI reads a 20-line interface contract |
| Props/hooks inferred (often wrong) | Props/hooks explicit and verified |
| No way to know if context is stale | Watch mode catches changes in real-time |
| Different prompts = different understanding | Deterministic: same code = same contract |
| Manual context gathering: "Here's my Button component..." | Structured contracts: AI understands architecture automatically |

**The key insight:** AI assistants don't need your implementation - they need your *interfaces*. LogicStamp Context extracts what matters and discards the noise.

### What "Structured" Means

Instead of shipping raw source code to AI:

```typescript
// Raw: AI must parse and infer
export const Button = ({ variant = 'primary', disabled, onClick, children }) => {
  const [isHovered, setIsHovered] = useState(false);
  // ... 150 more lines of implementation
}
```

LogicStamp Context generates:

```json
{
  "kind": "react:component",
  "interface": {
    "props": {
      "variant": { "type": "literal-union", "literals": ["primary", "secondary"] },
      "disabled": { "type": "boolean" },
      "onClick": { "type": "function", "signature": "() => void" }
    }
  },
  "composition": { "hooks": ["useState"], "components": ["./Icon"] }
}
```

Pre-parsed. Categorized. Stable. The AI reads contracts, not implementations.

## ⚡ Features

**Core:**
- **Deterministic contracts** - Same input = same output, auditable in version control
- **Watch mode** - Auto-regenerate on file changes with incremental rebuilds
- **Breaking change detection** - Strict watch mode catches removed props, events, functions in real-time
- **MCP-ready** - AI agents consume context via standardized MCP interface

**Analysis:**
- React/Next.js/Vue component extraction (props, hooks, state, deps)
- Backend API extraction (Express.js, NestJS routes and controllers)
- Dependency graphs (handles circular dependencies)
- Style metadata extraction (Tailwind, SCSS, MUI, shadcn)
- Next.js App Router detection (client/server, layouts, pages)

**Developer experience:**
- Per-folder bundles matching your project structure
- Accurate token estimates (GPT/Claude)
- Security-first: automatic secret detection and sanitization
- Zero config required - sensible defaults, works out of the box

## Watch Mode

<p align="center">
  <img src="./assets/logicstamp-strict-watch.gif" width="820" />
</p>

*Strict watch mode in action: detecting violations and clearing them when resolved.*

For development, run watch mode to keep context fresh as you code:

```bash
stamp context --watch                  # regenerate on changes
stamp context --strict-watch           # also detect breaking changes (implies --watch)
```
Strict watch catches breaking changes that affect consumers:

| Violation | Example |
|-----------|---------|
| `breaking_change_prop_removed` | Removed `disabled` prop from Button |
| `breaking_change_event_removed` | Removed `onSubmit` callback |
| `breaking_change_function_removed` | Deleted exported `formatDate()` |
| `contract_removed` | Deleted entire component |

**Errors vs Warnings:** Violations are classified by severity:

**❌ Errors** indicate breaking changes that will affect consumers (removed props, events, functions, or entire contracts).

**⚠️ Warnings** indicate less severe changes (type signature changes, removed internal state). Violations are tracked in real-time and automatically cleared when resolved.

**Session Status Tracking:** Strict watch mode displays a session status block showing cumulative statistics:
- **Errors/Warnings detected**: Total violations detected during the session
- **Resolved**: Number of times all violations were completely resolved
- **Active**: Current number of active violations

The status block only appears when violations change (not on every file change), keeping terminal output clean.

![Strict Watch Mode Terminal Output](./assets/logicstamp-strict-watch-output.png)

*Example terminal output showing violations and session status.*

> ℹ️ **Note:** Strict Watch currently detects breaking changes at the source. Next step: a symbol-level import/export reverse index to trace which consumer files will break. See [docs/cli/watch.md](docs/cli/watch.md) for complete documentation.

### One-time Comparison

Compare regenerated context against existing files:

```bash
stamp context compare            # detect changes
stamp context compare --approve  # update (like jest -u)
```

Useful for reviewing changes before committing or validating context is up-to-date.

**Git baseline comparison** *(v0.7.2)*: Compare against any git ref:
```bash
stamp context compare --baseline git:main      # Compare against main branch
stamp context compare --baseline git:HEAD      # Compare against HEAD
stamp context compare --baseline git:v1.0.0    # Compare against a tag
```

> **ℹ️ Note:** Context files are gitignored by default. Git baseline comparison uses git worktrees to generate context for both the baseline ref and the current working tree, then performs a structural contract comparison. See [docs/cli/compare.md](docs/cli/compare.md) for complete documentation.

## How it Works

The compilation pipeline:

1. **Scan** - Discovers all `.ts` and `.tsx` source files
2. **Parse** - Builds AST (Abstract Syntax Tree) via `ts-morph` using the TypeScript compiler API
3. **Extract** - Compiles contracts with props, hooks, state, signatures
4. **Graph** - Resolves dependency relationships
5. **Emit** - Outputs `context.json` bundles per folder
6. **Index** - Generates `context_main.json` with metadata and statistics

**Why AST-based compilation matters:** LogicStamp leverages the full TypeScript compiler (via ts-morph) for deterministic, type-aware contract extraction. Prop types, hooks, and composition patterns are resolved structurally - not inferred from text or retrieval.

One command. No build step required.

> **💡Tip:** Use `stamp context` for basic contracts. Use `stamp context style` when you need style metadata (Tailwind classes, SCSS selectors, layout patterns). Use `--style-mode lean` (default) for compact output or `--style-mode full` for detailed arrays.

## MCP Server

For AI assistants with MCP support (Claude Desktop, Cursor, etc.):

```bash
npm install -g logicstamp-mcp
```

Then configure your AI assistant to use the LogicStamp MCP Server.

🔗 **See [LogicStamp MCP Server Repository](https://github.com/LogicStamp/logicstamp-mcp)**

📋 **See [MCP Getting Started Guide](https://logicstamp.dev/docs/mcp/getting-started)** for setup instructions.

## Example Output

LogicStamp Context generates structured JSON bundles organized by folder:

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

📋 **See [docs/reference/schema.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/reference/schema.md)** for complete format documentation.

## Installation

```bash
npm install -g logicstamp-context
```

After installation, the `stamp` command is available globally.

## Security

**Automatic Secret Protection**

LogicStamp Context protects sensitive data in generated context:

- **Security scanning by default** - `stamp init` scans source files (`.ts`, `.tsx`, `.js`, `.jsx`) and `.json` files for hard-coded secrets before context compilation
- **Automatic sanitization** - Detected secrets replaced with `"PRIVATE_DATA"` in output
- **Manual exclusions** - Use `stamp ignore <file>` to exclude files via `.stampignore`
- **Safe by default** - Only metadata included. Credentials only appear in `--include-code full` mode

> **⚠️ Seeing `"PRIVATE_DATA"` in output?** Review `stamp_security_report.json`, remove hardcoded secrets from source, use environment variables instead.

🔒 **See [SECURITY.md](https://github.com/LogicStamp/logicstamp-context/blob/main/SECURITY.md)** for complete security documentation.

## Usage

<details>
<summary><strong>💻 CLI Usage Reference</strong></summary>

```bash
stamp --version                    # Show version
stamp --help                       # Show help
stamp init [path]                  # Initialize project (security scan by default)
stamp ignore <path>                # Add to .stampignore
stamp context [path]               # Generate context bundles
stamp context style [path]         # Generate with style metadata (lean mode by default)
stamp context style --style-mode full  # Generate with full style details (verbose)
stamp context --watch              # Watch mode
stamp context --strict-watch       # Watch with breaking change detection (--watch optional)
stamp context compare              # Detect changes vs existing context
stamp context validate [file]      # Validate context files
stamp context clean [path]         # Remove generated files
```

### Common Options

| Option | Description |
|--------|-------------|
| `--depth <n>` | Dependency traversal depth (default: 2) |
| `--include-code <mode>` | Code inclusion: `none\|header\|full` (default: header) |
| `--include-style` | Extract style metadata (Tailwind, SCSS, animations) |
| `--format <fmt>` | Output format: `json\|pretty\|ndjson\|toon` (default: json) |
| `--max-nodes <n>` | Maximum nodes per bundle (default: 100) |
| `--profile <p>` | Preset: `llm-chat`, `llm-safe`, `ci-strict`, `watch-fast` |
| `--compare-modes` | Show token cost comparison across all modes |
| `--stats` | Emit JSON stats with token estimates |
| `--out <path>` | Output directory |
| `--quiet` | Suppress verbose output |
| `--strict-missing` | Exit with error if any missing dependencies found (CI-friendly) |
| `--debug` | Show detailed hash info (watch mode) |
| `--log-file` | Write change logs to `.logicstamp/` (watch mode) |

</details>

📋 **See [docs/cli/commands.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/commands.md)** for complete reference.

## Framework Support

| Framework | Support Level | What's Extracted |
|-----------|--------------|------------------|
| **React** | Full | Components, hooks, props, styles |
| **Next.js** | Full | App Router roles, segment paths, metadata |
| **Vue 3** | Partial | Composition API (TS/TSX only, not .vue SFC) |
| **Express.js** | Full | Routes, API signatures (middleware not extracted. see [limitations](docs/reference/limitations.md)) |
| **NestJS** | Full | Controllers, decorators, API signatures |
| **UI Libraries** | Full | Material UI, ShadCN, Radix, Tailwind, Styled Components, SCSS, Chakra UI, Ant Design (component usage, props, composition. not raw CSS) |

> **ℹ️ Note:** LogicStamp Context analyzes `.ts` and `.tsx` files only. JavaScript files are not analyzed.

## Documentation

**Full documentation at [logicstamp.dev/docs](https://logicstamp.dev/docs)**

- [Getting Started Guide](https://logicstamp.dev/docs/getting-started)
- [Usage Guide](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/guides/usage.md)
- [Monorepo Support](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/guides/monorepo.md)
- [Output Schema](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/reference/schema.md)
- [UIF Contracts](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/reference/uif-contracts.md)
- [Watch Mode](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/watch.md)
- [Troubleshooting](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/guides/usage.md#troubleshooting)

## Known Limitations

LogicStamp Context is in beta. Some edge cases are not fully supported.

📋 **See [docs/reference/limitations.md](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/reference/limitations.md)** for the full list.

## Benchmarks

You can compare bundle token costs across modes on your repo with `stamp context --compare-modes` (see [compare modes](https://github.com/LogicStamp/logicstamp-context/blob/main/docs/cli/compare-modes.md)).

**Formal benchmarks** are on the [roadmap](https://github.com/LogicStamp/logicstamp-context/blob/main/ROADMAP.md#performance--optimization):
- CLI/runtime baselines
- LLM evaluations (with vs without LogicStamp context)

## Requirements

- Node.js >= 20
- TypeScript codebase (React, Next.js, Vue (TS/TSX), Express, or NestJS)

## Need Help?

- **Issues** - [github.com/LogicStamp/logicstamp-context/issues](https://github.com/LogicStamp/logicstamp-context/issues)
- **Roadmap** - [logicstamp.dev/roadmap](https://logicstamp.dev/roadmap)

## License

[MIT](LICENSE)

---

<details>
<summary>Branding & Attribution</summary>

The LogicStamp Fox mascot and related brand assets are © 2025 Amit Levi. These assets may not be used for third-party branding without permission.
</details>

<details>
<summary>Contributing</summary>

Issues and PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md).
</details>

**Links:** [Website](https://logicstamp.dev) · [GitHub](https://github.com/LogicStamp/logicstamp-context) · [MCP Server](https://github.com/LogicStamp/logicstamp-mcp) · [Changelog](https://github.com/LogicStamp/logicstamp-context/blob/main/CHANGELOG.md)