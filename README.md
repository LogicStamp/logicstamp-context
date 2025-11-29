# LogicStamp Context

<div align="center">
  <img src="assets/logicstamp-fox.svg" alt="LogicStamp Fox Mascot" width="120" height="120">
</div>

![Version](https://img.shields.io/badge/version-0.2.3-blue.svg)
![Beta](https://img.shields.io/badge/status-beta-orange.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
[![CI](https://github.com/LogicStamp/logicstamp-context/workflows/CI/badge.svg)](https://github.com/LogicStamp/logicstamp-context/actions)

**A tiny CLI that compiles your React/TypeScript codebase into machine-readable context bundles for AI and CI. Fast, deterministic, zero-config.**

## Quick Start

```bash
npm install -g logicstamp-context
cd your-project
stamp context
```

That's it! LogicStamp Context will scan your project and generate `context.json` files organized by folder, plus a `context_main.json` index file. Share these files with AI assistants for instant codebase understanding.

![LogicStamp Context in action](assets/demo-screenshot.png)
*Terminal output showing `stamp context` execution and generated context.json structure*

> **Note:** This is a beta release (v0.2.3). We're actively improving the tool based on user feedback. If you encounter any issues or have suggestions, please [open an issue on GitHub](https://github.com/LogicStamp/logicstamp-context/issues).

## What is this?

**LogicStamp Context** is a lightweight tool that scans your React/TypeScript codebase and generates structured context bundles optimized for AI tools like Claude, ChatGPT, and other LLMs.

No setup, no configuration, no pre-compilation required. Just point it at your code and get instant, AI-ready documentation.

## Installation

```bash
npm install -g logicstamp-context
```

After installation, the `stamp` command will be available globally.

**Note**: "Global CLI" means the tool is installed globally on your system (via `npm install -g`), making the `stamp` command available from any directory in your terminal, not just within a specific project folder.
- **Local install**: `npm install logicstamp-context` → only available in that project
- **Global install**: `npm install -g logicstamp-context` → available everywhere via `stamp` command

## Recent Updates

**v0.2.3** - README streamlined, improved token estimation accuracy, UIF Contracts documentation  
**v0.2.2** - Documentation fixes for optional tokenizer dependencies  
**v0.2.1** - Dynamic version loading from package.json  
**v0.2.0** - Style metadata extraction, enhanced token comparison, modular architecture  
**v0.1.1** - CI-friendly defaults, improved initialization workflow  
**v0.1.0** - Initial release with token optimization, drift detection, and Next.js support

📋 **See [CHANGELOG.md](CHANGELOG.md) for complete version history**

### Optional Tokenizers

LogicStamp Context includes `@dqbd/tiktoken` (GPT-4) and `@anthropic-ai/tokenizer` (Claude) as **optional dependencies**. npm automatically attempts to install them when you install `logicstamp-context`.

- **If installed**: Token counts are model-accurate for GPT-4 and Claude
- **If not installed**: Falls back to character-based estimation (typically within 10–15% accuracy)

You do **not** need to manually install tokenizers unless automatic installation failed and you specifically need accurate counts.

## What does it generate?

LogicStamp Context analyzes your React components and outputs a structured JSON file containing:

- **Component structure**: variables, hooks, components, functions
- **Logic signatures**: props, events, state types
- **Dependency graph**: how components relate to each other
- **Code snippets**: headers or full source (configurable)
- **Semantic hashes**: for tracking changes
- **Next.js metadata**: App Router directives and file location (when applicable)

This output is designed to be easily understood by AI assistants, helping them provide better suggestions and understand your codebase architecture.

## Next.js App Router Support

LogicStamp Context automatically detects and annotates Next.js App Router components:

### Detected Features

- **`'use client'` directive** - Marks Client Components
- **`'use server'` directive** - Marks Server Actions
- **App Router location** - Identifies files in `/app` directory

### Example Contract Output

```json
{
  "type": "UIFContract",
  "kind": "react:component",
  "entryId": "app/dashboard/page.tsx",
  "nextjs": {
    "directive": "client",
    "isInAppDir": true
  }
}
```

### Benefits for AI Analysis

- **Framework-aware suggestions** - AI knows which APIs are available (client vs server)
- **Better refactoring** - AI understands boundaries between client/server code
- **Accurate recommendations** - AI won't suggest client-only hooks in Server Components

### Supported Scenarios

✅ Client Components with `'use client'`
✅ Server Actions with `'use server'`
✅ Server Components in `/app` directory (no directive)
✅ Regular components outside `/app` (no metadata)

**Note:** The `nextjs` field is only added when relevant, keeping contracts clean for non-Next.js projects.

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
| `stamp init` | Initialize project (`.gitignore`, `LLM_CONTEXT.md`, config) | [INIT.md](docs/cli/INIT.md) |
| `stamp context` | Generate AI-ready context bundles organized by folder | [CONTEXT.md](docs/cli/CONTEXT.md) |
| `stamp context style` | Generate context with style metadata (Tailwind, SCSS, etc.) | [STYLE.md](docs/cli/STYLE.md) |
| `stamp context compare` | Compare context files to detect changes (CI-friendly) | [COMPARE.md](docs/cli/COMPARE.md) |
| `stamp context validate` | Validate context file schema and structure | [VALIDATE.md](docs/cli/VALIDATE.md) |
| `stamp context clean` | Remove all generated context artifacts | [CLEAN.md](docs/cli/CLEAN.md) |

### Common Options

**`stamp context` options:**
- `--depth <n>` / `-d` - Dependency traversal depth (default: `1`)
- `--include-code <mode>` / `-c` - Code inclusion: `none|header|full` (default: `header`)
- `--include-style` - Extract style metadata (Tailwind, SCSS, animations, layout)
- `--profile <profile>` - Preset: `llm-chat` (default), `llm-safe`, `ci-strict`
- `--compare-modes` - Show detailed token comparison across all modes
- `--stats` - Emit JSON stats with token estimates (CI-friendly)
- `--strict-missing` - Exit with error if missing dependencies found
- `--out <path>` / `-o` - Output directory or file path
- `--quiet` / `-q` - Suppress verbose output

**Other commands:**
- `stamp context compare` - `--stats`, `--approve`, `--clean-orphaned`
- `stamp context validate` - Validates schema and structure (exits 0/1)
- `stamp init` - `--skip-gitignore`

📋 **See [docs/cli/COMMANDS.md](docs/cli/COMMANDS.md) for complete option reference**

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
📏 Token Estimates (header+style mode):
   GPT-4o-mini: 13,895 tokens
   Claude:      12,351 tokens

   Comparison:
     Raw source        | Header        | Header+style
         22,000        |     12,228     |     13,895

   Full context (code+style): ~39,141 GPT-4o-mini / ~34,792 Claude
```

This helps you:
- **Understand costs** at a glance
- **Choose the right mode** for your budget
- **See savings** compared to full context (code+style) mode

**Enhanced with `--compare-modes`:** The `--compare-modes` flag provides detailed comparisons across all modes (none/header/header+style/full) with accurate token counts. It automatically regenerates contracts with and without style metadata to show the true impact of including style information.

### Mode Comparison Table

Use `--compare-modes` for a detailed comparison across all modes:

```bash
stamp context --compare-modes
```

Output:
```
📊 Mode Comparison

   Comparison:
     Mode         | Tokens GPT-4o | Tokens Claude | Savings vs Raw Source
     -------------|---------------|---------------|------------------------
     Raw source   |        22,000 |        19,556 | 0%
     Header       |        12,228 |        10,867 | 44%
     Header+style |        13,895 |        12,351 | 37%

   Mode breakdown:
     Mode         | Tokens GPT-4o | Tokens Claude | Savings vs Full Context
     -------------|---------------|---------------|--------------------------
     none         |         8,337 |         7,411 | 79%
     header       |        12,228 |        10,867 | 69%
     header+style |        13,895 |        12,351 | 65%
     full         |        39,141 |        34,792 | 0%
```

**When to use each mode:**
- **`none`** - API documentation, CI validation (no code snippets, no style)
- **`header`** - AI chat, code review (JSDoc headers + contracts, no style)
- **`header+style`** - Design-aware AI chat (headers + contracts + style metadata)
- **`full`** - Deep analysis, debugging (complete source code + contracts + style info)

**Note:** The `--compare-modes` flag automatically regenerates contracts with and without style metadata to provide accurate token counts for all modes. This ensures you see the true impact of including style information.

**Optional tokenizers for accurate counts:** LogicStamp Context includes `@dqbd/tiktoken` (GPT-4) and `@anthropic-ai/tokenizer` (Claude) as optional dependencies. npm will automatically attempt to install them when you install `logicstamp-context`. If installation succeeds, you get model-accurate token counts. If installation fails or is skipped (normal for optional dependencies), LogicStamp Context gracefully falls back to character-based estimation (typically within 10-15% accuracy). No manual installation is required unless you specifically want accurate counts and the automatic installation failed.

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
# 📝 Writing context files for 5 folders...
#    ✓ context.json (2 bundles)
#    ✓ src/context.json (3 bundles)
#    ✓ src/components/context.json (5 bundles)
#    ✓ src/utils/context.json (2 bundles)
#    ✓ app/context.json (3 bundles)
# 📝 Writing main context index...
#    ✓ context_main.json (index of 5 folders)
# ✅ 6 context files written successfully
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

# Analyze with custom output directory
stamp context --out ./output

# Or specify a .json file to use its directory
stamp context --out ./output/context.json  # Uses ./output as directory
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

### Clean context files

```bash
# Show what would be removed (dry run)
stamp context clean

# Actually delete all context artifacts
stamp context clean --all --yes

# Clean specific directory
stamp context clean ./output --all --yes

# Suppress verbose output (quiet mode)
stamp context --quiet
stamp context validate --quiet
stamp context compare --quiet
stamp context clean --all --yes --quiet

# Show version number
stamp --version
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

LogicStamp Context generates a **folder-organized, multi-file output structure** that maintains your project's directory hierarchy:

```
output/
├── context_main.json          # Main index with folder metadata
├── context.json               # Root folder bundles (if any)
├── src/
│   └── context.json          # Bundles from src/ folder
└── src/components/
    └── context.json          # Bundles from src/components/
```

### Structure Overview

- **Folder-based organization** - Each folder containing components gets its own `context.json`
- **Main index** - `context_main.json` indexes all folders with metadata (components, bundles, token estimates)
- **Per-root bundles** - Each bundle contains a root component plus its complete dependency graph
- **Self-contained units** - Each bundle includes all related components and contracts for that feature/page

### Key Fields

**`context_main.json` index:**
- `folders[]` - Array of folder metadata (path, bundles, components, token estimates)
- `summary` - Total components, bundles, folders, token estimates

**Bundle structure (`context.json`):**
- `entryId` - Root component file path
- `graph.nodes[]` - Component contracts with structure, props, hooks, state
- `graph.edges[]` - Dependency relationships
- `meta.missing[]` - Unresolved dependencies (if any)
- `meta.source` - Generator version

**Missing dependencies:**
- `file not found` - Deleted or moved file
- `external package` - Third-party npm package (intentionally excluded)
- `outside scan path` - File exists but outside scan directory
- `circular dependency` - Circular import detected
- `max depth exceeded` - Beyond `--depth` limit

📋 **See [`schema/logicstamp.context.schema.json`](schema/logicstamp.context.schema.json) for complete JSON Schema**  
📋 **See [`docs/SCHEMA.md`](docs/SCHEMA.md) for detailed field documentation**

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
# Or validate the main index
stamp context validate context_main.json
```
- Check for schema mismatches (outdated schema version)
- Verify JSON is well-formed (no trailing commas, proper escaping)
- Ensure all required fields are present
- Each folder's context.json should be a valid bundle array
- The context_main.json should have the LogicStampIndex structure

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
6. **Organize**: Groups bundles by folder and writes `context.json` files maintaining directory structure
7. **Index**: Creates `context_main.json` index with folder metadata and summary statistics

All in one command, no pre-compilation needed!

## Planned Orchestrator (@logicstamp/cli)

`logicstamp-context` is the primary CLI available today. A higher-level orchestrator package `@logicstamp/cli` is planned as an optional wrapper.

| Feature | logicstamp-context | LogicStamp Orchestrator (planned) |
|---------|-------------------|----------------------------------|
| Standalone | ✅ Yes | ❌ No (wraps underlying tools) |
| Pre-compilation required | ❌ No | ✅ Yes (for verification) |
| Context generation | ✅ Yes | ✅ Yes |
| UIF contracts per file | ✅ Yes (embedded in bundles) | ✅ Yes (as `.uif.json` sidecar files) |
| Contract compilation | ✅ Built-in | ✅ Separate command |
| Contract verification | ❌ No | ✅ Yes (planned) |
| Size | Focused | Orchestrator |

**TL;DR**: Use `stamp context` (logicstamp-context) for AI context generation today. The future `@logicstamp/cli` orchestrator will provide optional higher-level workflows once it's released.

## Future Roadmap

### Planned Features

**Next.js Enhancements:**
- App Router role detection (`page`, `layout`, `route`, `loading`, `error`)
- Dynamic route segment extraction (`[id]`, `[...slug]`)
- Server Action signature extraction and RPC call graphs
- Suspense boundary and streaming component detection

**Framework Support:**
- Vue.js 3 Composition API components
- Svelte component analysis

**Other:**
- Custom contract fields via config
- Performance metrics (bundle size, render estimates)
- Incremental bundle caching

**Note:** Features are added incrementally based on community feedback. Current implementation prioritizes maximum value with minimal complexity.

## Requirements

- Node.js >= 18.0.0
- TypeScript/React codebase

## License

MIT

## Contributing

Issues and PRs welcome! This is an open-source project.

**See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines**, including:
- Branching strategy (feature → `main`, no `develop` branch)
- Branch naming conventions (`feature/*`, `fix/*`, `docs/*`)
- Commit message format (Conventional Commits)
- Development workflow and best practices

## Links

- [LogicStamp Main Project](https://github.com/LogicStamp/logicstamp)
- [Report Issues](https://github.com/LogicStamp/logicstamp-context/issues)
