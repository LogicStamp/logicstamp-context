# LogicStamp Context – LLM Guide

## Overview
- Generates AI-friendly context bundles from React/Next.js/Vue/TypeScript projects and backend frameworks (Express.js, NestJS) without build steps.
- Ships as a global CLI (install with `npm install -g logicstamp-context`, then use `stamp context` command) that scans `.ts`/`.tsx` files, extracts component contracts, and emits structured JSON.
- Optimizes output for consumption by assistants such as Claude or ChatGPT to improve code understanding and guidance.
- Works on Node.js ≥ 18.18.0 and requires access to the project's source tree.
- **Framework support**: React, Next.js, Vue 3 (Composition API), TypeScript, Express.js, and NestJS. Vue support works with `.ts`/`.tsx` files only (JSX/TSX components, composables); Single File Components (`.vue` files) are not currently supported. Backend frameworks (Express.js, NestJS) are automatically detected and their routes, controllers, and API signatures are extracted.

**Note**: "Global CLI" means the tool is installed globally on your system (via `npm install -g`), making the `stamp` command available from any directory in your terminal, not just within a specific project folder.

## Core Workflow
- `src/cli/index.ts` and `src/cli/stamp.ts` orchestrate CLI execution: read CLI flags via `src/cli/parser/argumentParser.ts`, route to handlers in `src/cli/handlers/`, and coordinate command execution.
- `src/cli/commands/compare.ts` implements drift detection for single-file and multi-file comparison modes, including ADDED/ORPHANED/DRIFT/PASS detection.
- `src/core/astParser.ts` orchestrates AST parsing modules (`astParser/extractors/` and `astParser/detectors.ts`) that use `ts-morph` to parse source files, derive component metadata, and normalize type information. Supports React, Next.js, Vue 3 (Composition API) component detection, and backend framework detection (Express.js, NestJS) for API route and controller extraction.
- `src/core/contractBuilder.ts` converts raw AST findings into UIF contracts and merges incremental updates.
- `src/core/manifest.ts` and `src/core/pack.ts` (with modules in `pack/`) assemble dependency graphs, compute bundle hashes, and format final output entries.
- `src/extractors/styling/` extracts style metadata from components:
  - **CSS frameworks**: Tailwind CSS (with categorization and breakpoint detection), SCSS/CSS modules (AST-based parsing)
  - **CSS-in-JS**: styled-components/Emotion, Styled JSX (CSS content, selectors, properties extraction)
  - **UI libraries**: Material UI, ShadCN/UI, Radix UI
  - **Animation**: framer-motion (components, variants, gestures, layout animations)
  - **Inline styles**: Enhanced extraction of property names and literal values
  - **Layout & visual**: Layout patterns (flex, grid), visual metadata (colors, spacing, typography, border radius)
- `src/types/UIFContract.ts` defines the UIF contract schema; `src/utils/fsx.ts` and `src/utils/hash.ts` provide file and hashing utilities.

## CLI Usage Cheatsheet
- Install globally: `npm install -g logicstamp-context`.
- Show version: `stamp --version` or `stamp -v` displays the version number.
- Default command `stamp context [target]` scans the current directory (or supplied path) and emits multiple `context.json` files (one per folder containing components) plus a `context_main.json` index file at the output root.
- Key flags: `--depth` (dependency traversal), `--include-code none|header|full`, `--profile llm-chat|llm-safe|ci-strict`, `--out <file>` (output directory or file path), `--max-nodes <n>`, `--quiet` or `-q` (suppress verbose output, show only errors).
- Profiles tune defaults: `llm-chat` (balanced), `llm-safe` (token-conservative), `ci-strict` (validation-first).
- Supports pretty and NDJSON formats via `--format`.
- Compare command: `stamp context compare` compares all context files (multi-file mode) to detect drift, ADDED/ORPHANED folders, and component changes. Supports `--approve` for auto-updates, `--clean-orphaned` for cleanup, `--stats` for per-folder token deltas, and `--quiet` or `-q` to show only diffs.
- Validate command: `stamp context validate [file]` checks context files for schema compliance. Supports `--quiet` or `-q` to show only errors.
- Clean command: `stamp context clean [path]` removes context artifacts. Supports `--quiet` or `-q` to suppress verbose output.
- Output structure: Context files are organized by folder, maintaining project directory hierarchy. Each folder gets its own `context.json` with bundles for that folder's components. The `context_main.json` index file provides metadata about all folders.

## Output Structure

LogicStamp Context generates **folder-organized, multi-file output**:

### File Organization
- Multiple `context.json` files, one per folder containing components
- Directory structure mirrors your project layout
- `context_main.json` index file at the output root with folder metadata

**Example structure:**
```
output/
├── context_main.json          # Main index with folder metadata
├── context.json               # Root folder bundles (if any)
├── src/
│   └── context.json          # Bundles from src/ folder
├── src/components/
│   └── context.json          # Bundles from src/components/
└── src/utils/
    └── context.json          # Bundles from src/utils/
```

### Main Index (`context_main.json`)

The `context_main.json` file serves as a directory index:

```json
{
  "type": "LogicStampIndex",
  "schemaVersion": "0.2",
  "projectRoot": ".",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "summary": {
    "totalComponents": 42,
    "totalBundles": 15,
    "totalFolders": 5,
    "totalTokenEstimate": 13895
  },
  "folders": [
    {
      "path": "src/components",
      "contextFile": "src/components/context.json",
      "bundles": 3,
      "components": ["Button.tsx", "Card.tsx"],
      "isRoot": false,
      "tokenEstimate": 5234
    },
    {
      "path": ".",
      "contextFile": "context.json",
      "bundles": 2,
      "components": ["App.tsx"],
      "isRoot": true,
      "rootLabel": "Project Root",
      "tokenEstimate": 2134
    }
  ],
  "meta": {
      "source": "logicstamp-context@0.4.1"
  }
}
```

**Folder entry fields:**
- `path` - Relative path from project root
- `contextFile` - Path to this folder's context.json
- `bundles` - Number of bundles in this folder
- `components` - List of component file names
- `isRoot` - Whether this is an application entry point
- `rootLabel` - Label for root folders (e.g., "Next.js App", "Project Root")
- `tokenEstimate` - Token count for this folder's context

### Folder Context Files (`context.json`)

Each folder's `context.json` contains an array of LogicStamp bundles. Each bundle represents one entry point (component/module) plus its immediate dependency graph.
- **Design note**: LogicStamp Context uses per-root bundles (one bundle per entry point) rather than per-component files. This means each bundle contains the root component plus its complete dependency graph—all related components and their relationships in one self-contained unit. This design is optimized for AI consumption: when you need help with a specific page or feature, share that root bundle and the AI has complete context.
- Top-level fields: `position`, `type`, `schemaVersion`, `entryId`, `depth`, `createdAt`, `bundleHash`, `graph`, `meta`.
- `graph.nodes` holds UIF contracts describing functions, props, events, imports, and semantic/file hashes. Optional `codeHeader` stores contract headers or code snippets when requested.
- `graph.edges` lists dependency relationships between nodes (empty when analysis depth is 1).
- `meta` section contains two critical fields:
  - `missing`: Array of unresolved dependencies. Each entry includes `name` (import path), `reason` (why it failed), and `referencedBy` (source component). Empty array indicates complete dependency resolution.
  - `source`: Generator version string (e.g., `"logicstamp-context@0.4.1"`) for compatibility tracking.
- Example bundle skeleton:

```
```1:58:context.json
[
  {
    "position": "1/9",
    "type": "LogicStampBundle",
    "schemaVersion": "0.1",
    "entryId": ".../src/cli/index.ts",
    "graph": {
      "nodes": [
        {
          "contract": {
            "kind": "node:cli",
            "version": {
              "functions": ["generateContext", "main", "printHelp"],
              "imports": ["../core/astParser.js", "..."]
            }
```

- Bundles may include behavioral `prediction` hints when heuristics detect notable logic (e.g., form handling, data access).

### Component Kinds

LogicStamp Context detects and categorizes components into different kinds:

- **`react:component`** - React functional components (with hooks, JSX, or React imports)
- **`react:hook`** - Custom React hooks (functions starting with "use" and no JSX)
- **`vue:component`** - Vue 3 components (detected via Vue imports and JSX/TSX syntax)
- **`vue:composable`** - Vue 3 composables (functions using Vue Composition API like `ref`, `reactive`, `computed`, `watch`)
- **`ts:module`** - TypeScript modules/utilities (non-React/Vue code)
- **`node:cli`** - Node.js CLI scripts (files in `/cli/` directory or using `process.argv`)
- **`node:api`** - Backend API routes/handlers (Express.js routes, NestJS controllers) with API signatures, route metadata, and framework-specific information

**Vue.js Support (v0.3.4+):**
- Detects Vue components and composables in `.ts`/`.tsx` files
- Extracts Vue reactive state (`ref`, `reactive`, `computed`, `shallowRef`, `shallowReactive`)
- Extracts Vue props from `defineProps` (supports both type-based and runtime props)
- Extracts Vue emits from `defineEmits` (supports both type-based and runtime emits)
- Detects Vue lifecycle hooks (`onMounted`, `onUnmounted`, `onUpdated`, etc.)
- Framework detection priority: Vue takes priority over React when both are imported
- **Note**: Works with Vue code in `.ts`/`.tsx` files (JSX/TSX components, extracted composables). Single File Components (`.vue` files) are not currently supported.

## Interpreting Missing Dependencies
When `meta.missing` is non-empty, it signals incomplete dependency resolution:

**Common scenarios:**
1. **External packages** (`reason: "external package"`) - Expected. LogicStamp only analyzes project source, not node_modules.
2. **File not found** (`reason: "file not found"`) - Component references a deleted/moved file. May indicate refactoring in progress or broken imports.
3. **Outside scan path** (`reason: "outside scan path"`) - Dependency exists but wasn't included in the scan directory. Consider widening scan scope.
4. **Max depth exceeded** (`reason: "max depth exceeded"`) - Dependency chain deeper than `--depth` setting. Increase depth for fuller analysis.
5. **Circular dependency** (`reason: "circular dependency"`) - Import cycle detected. LogicStamp breaks the cycle to prevent infinite loops.

**Best practices for LLMs:**
- Check `meta.missing` before making assumptions about complete component coverage
- When missing deps exist, inform the user that analysis may be partial
- Suggest running with `--depth 2` or higher if many "max depth exceeded" entries appear
- Flag "file not found" entries as potential bugs in the codebase

## Why Structured Data Is Better Than Raw Source

LogicStamp generates **structured context bundles** rather than raw source files. This approach provides significant advantages for AI consumption:

### Semantic Density

Raw code requires parsing and inference. Structured data is already parsed and categorized.

**Raw code:**
```tsx
className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white"
```

**Structured:**
```json
{
  "layout": { "type": "flex", "alignment": "items-center" },
  "spacing": ["gap-2", "px-4", "py-2"],
  "colors": ["bg-blue-500", "text-white"],
  "borders": ["rounded-lg"]
}
```

The structured form groups related concepts together. You can immediately answer "what colors are used?" without scanning strings. You can reason about spacing patterns without parsing className concatenations.

### Pre-Processed Relationships

**Raw source approach:**
- Scan imports to infer dependencies
- Parse JSX to understand component hierarchy
- Infer prop flows from usage patterns
- Manually trace data flow

**Structured approach:**
- `graph.edges` explicitly shows `[ComponentA, ComponentB]` relationships
- `logicSignature.props` lists all inputs with types
- `logicSignature.state` shows reactive state
- Dependency graph is pre-computed and traversable

This eliminates inference work. You don't need to "figure out" relationships—they're already documented.

### Categorized Information

Raw code scatters information across files. Structured data groups it by semantic meaning.

**Example: Design System Analysis**

To answer "What design patterns does the Hero component use?":

**Raw Source Approach:**
- Read 200+ lines of JSX
- Parse className strings manually
- Identify patterns through repeated scanning
- Infer relationships from context

**Structured Approach:**
- Read `style.layout.type: "flex"`
- Read `style.layout.hasHeroPattern: true`
- Read `style.visual.colors: [...]`
- Read `style.animation.type: "pulse"`
- Answer in seconds

The information is **already categorized**. Colors are in `visual.colors`, spacing in `visual.spacing`, layout patterns in `layout.type`. No scanning required.

### Contract-Based Understanding

Raw code requires inferring component APIs from implementation. Structured data provides explicit contracts.

**Raw:**
```tsx
function Button({ onClick, children, variant }) {
  // ... 50 lines of implementation
}
```

**Structured:**
```json
{
  "logicSignature": {
    "props": [
      { "name": "onClick", "type": "() => void", "required": true },
      { "name": "children", "type": "ReactNode", "required": true },
      { "name": "variant", "type": "'primary' | 'secondary'", "required": false }
    ],
    "emits": ["click"],
    "state": []
  }
}
```

The contract is explicit. No need to read implementation to understand the API. You know exactly what inputs are expected, what outputs are produced, and what state is managed.

### Reduced Noise

Raw code includes implementation details, comments, variable names, and boilerplate. Structured data focuses on **structure, relationships, and patterns**.

**What's filtered out:**
- Implementation details (how it works)
- Comments and documentation (already processed)
- Variable names (less relevant than types)
- Boilerplate (repetitive patterns)

**What's preserved:**
- Component APIs (what it does)
- Dependencies (what it uses)
- Style patterns (how it looks)
- Behavioral contracts (how it behaves)

This reduces cognitive overhead. You can focus on **what matters** without parsing through implementation noise.

### Real-World Query Examples

**Query: "What components use the same color palette?"**
- **Raw source:** Scan all className strings, extract color utilities, group manually, compare across files
- **Structured:** Read `visual.colors` arrays from each component contract, compare directly. Answer in one pass.

**Query: "Which components depend on framer-motion?"**
- **Raw source:** Search for `framer-motion` imports, check usage patterns, infer dependencies
- **Structured:** Filter `style.styleSources.motion` objects, read `graph.edges` to see motion-dependent components. Immediate answer.

**Query: "What's the spacing pattern across hero sections?"**
- **Raw source:** Find hero components (pattern matching), extract spacing classes, analyze manually
- **Structured:** Filter `layout.hasHeroPattern: true`, read `visual.spacing` arrays, compare patterns. Done.

### The Efficiency Multiplier

Structured data provides:
- **Faster parsing** (pre-processed, no AST traversal needed)
- **Higher semantic density** (more meaning per token)
- **Explicit relationships** (no inference required)
- **Categorized information** (easier queries)
- **Reduced noise** (focus on what matters)

Even when token counts are similar, structured data is **significantly faster to process** because information is pre-categorized, relationships are explicit, contracts are clear, and patterns are extracted.

## Suggestions for LLM Consumers

### Loading Context Files

1. **Start with the index**: Load `context_main.json` to understand the project structure and locate relevant folders.
2. **Load folder contexts**: Based on the index, load specific folder `context.json` files for the modules you need to analyze.
3. **Filter by `entryId`**: Within a folder's context file, filter bundles by `entryId` to focus on relevant modules.
4. **Combine multiple folders**: When a task spans multiple folders, load the relevant folder context files and combine their bundles.

### Working with the Index

- Use `context_main.json` to:
  - Get an overview of all folders and their component counts
  - Identify root folders (application entry points) via `isRoot` and `rootLabel`
  - Estimate token costs per folder via `tokenEstimate`
  - Locate context files for specific directories via `contextFile` paths

### Bundle Analysis

- Use `version.functions` and `logicSignature` to reason about available APIs without scanning full source.
- Combine multiple bundles when a task spans related modules; respect `max-nodes` constraints to stay within token budgets.
- For deeper understanding, rerun the CLI with `--include-code full` or higher `--depth` before querying the assistant.
- **Always inspect `meta.missing`** in each bundle to understand analysis completeness before providing architectural guidance.

### Style Metadata (Optional)

When using `stamp context style` or `stamp context --include-style`, bundles include a `style` field with visual and layout information:

**Style Sources (`style.styleSources`):**
- **Tailwind CSS**: Categorized utility classes (layout, spacing, colors, typography, borders, effects) with breakpoint information
- **SCSS/CSS Modules**: File paths and parsed details (selectors, properties, SCSS features like variables, nesting, mixins)
- **Styled JSX** (v0.3.5+): Full CSS content extraction from `<style jsx>` blocks, including CSS selectors and properties. Detects `global` attribute.
- **styled-components/Emotion**: Component names, theme usage, CSS prop detection
- **framer-motion**: Motion components, variants, gesture handlers, layout animations, viewport animations
- **Material UI**: Components, packages, theme usage, sx prop, styled API, makeStyles, system props
- **ShadCN/UI**: Components, variants, sizes, form integration, theme usage, icon libraries, component density
- **Radix UI**: Primitives (organized by package), patterns (controlled/uncontrolled, portals, asChild), accessibility features
- **Inline Styles** (v0.3.5+): Enhanced extraction with both property names and literal values (e.g., `{ properties: ['color', 'padding'], values: { color: 'blue', padding: '1rem' } }`)

**Layout Metadata (`style.layout`):**
- Layout type (flex, grid, relative, absolute)
- Grid column patterns
- Hero section and feature card patterns
- Page sections

**Visual Metadata (`style.visual`):**
- Color palettes (top 10 color utility classes)
- Spacing patterns (top 10 spacing utilities)
- Border radius tokens
- Typography classes (top 10)

**Animation Metadata (`style.animation`):**
- Animation library type
- Animation types and triggers

### Folder-Based Organization Benefits

- **Targeted loading**: Load only the folder context files you need, reducing token usage
- **Project structure alignment**: Folder structure mirrors your codebase, making it easier to navigate
- **Incremental updates**: When code changes, only affected folder context files need regeneration
- **Root detection**: Use `isRoot` and `rootLabel` to identify application entry points and framework-specific folders

## Context Drift Detection

LogicStamp Context includes a `compare` command for detecting drift across all context files in a project:

### Multi-File Comparison Mode

The compare command operates in multi-file mode when comparing `context_main.json` indices:

```bash
stamp context compare                                    # Auto-mode: compares all files
stamp context compare old/context_main.json new/context_main.json  # Manual mode
```

**What it detects:**
- **ADDED FILE** - New folders with context files (new features/modules added)
- **ORPHANED FILE** - Folders removed from project (but context files still exist on disk)
- **DRIFT** - Changed files with detailed component-level changes
- **PASS** - Unchanged files

**Three-tier output:**
1. **Folder-level summary** - Shows added/orphaned/changed/unchanged folder counts
2. **Component-level summary** - Total components added/removed/changed across all folders
3. **Detailed per-folder changes** - Component-by-component diffs for each folder with changes

### Use Cases for LLMs

1. **Change impact analysis**: When analyzing a codebase update, run `stamp context compare` to see exactly which folders and components changed
2. **Architectural drift**: Identify when new modules are added (`ADDED FILE`) or old ones removed (`ORPHANED FILE`)
3. **Per-folder token impact**: Use `--stats` to see token delta per folder, helping prioritize which changes to review
4. **Breaking change detection**: Check if component signatures (props, exports, hooks) changed, indicating potential breaking changes

### Key Features

- **Jest-style workflow**: Use `--approve` to auto-update all context files (like `jest -u` for snapshots)
- **Orphaned file cleanup**: Use `--clean-orphaned` with `--approve` to automatically delete stale context files
- **CI integration**: Exit code 1 if drift detected, making it CI-friendly for validation
- **Token statistics**: `--stats` shows per-folder token deltas to understand context size impact

### Example Output

```bash
$ stamp context compare

⚠️  DRIFT

📁 Folder Summary:
   Total folders: 14
   ➕ Added folders: 1
   ~  Changed folders: 2
   ✓  Unchanged folders: 11

📦 Component Summary:
   + Added: 3
   ~ Changed: 2

📂 Folder Details:

   ➕ ADDED FILE: src/new-feature/context.json
      Path: src/new-feature

   ⚠️  DRIFT: src/cli/commands/context.json
      Path: src/cli/commands
      ~ Changed components (1):
        ~ compare.ts
          Δ hash
            old: uif:abc123...
            new: uif:def456...
```

### Implementation Details

- **Truth from bundles**: Comparison is based on actual bundle content, not metadata (summary counts)
- **Bundle→folder mapping**: Verifies folder structure from `context_main.json`
- **Orphaned detection**: Checks disk for files that exist but aren't in the new index
- **Metadata ignored**: `totalComponents`, `totalBundles` counts are derived stats, not compared for drift

## Watch Mode Integration

Watch mode (`stamp context --watch`) monitors file changes and automatically regenerates context. This section explains how to integrate with watch mode from MCP servers or other tools.

### Detecting Watch Mode

Check if watch mode is active by reading `.logicstamp/context_watch-status.json`:

```json
{
  "active": true,
  "projectRoot": "/path/to/project",
  "pid": 12345,
  "startedAt": "2025-01-19T10:30:00.000Z",
  "outputDir": "/path/to/project"
}
```

**Fields:**
- `active` - Always `true` when file exists (file is deleted on exit)
- `projectRoot` - Absolute path to the watched project
- `pid` - Process ID of the watch process (use to verify process is still running)
- `startedAt` - ISO timestamp when watch mode started
- `outputDir` - Directory where context files are written

**Important**: The status file is deleted when watch mode exits. If the file exists but the process crashed, validate using the `pid` field:

```typescript
// Pseudo-code for validating watch mode is truly active
const status = JSON.parse(readFile('.logicstamp/context_watch-status.json'));
try {
  process.kill(status.pid, 0); // Signal 0 checks if process exists
  // Watch mode is running
} catch {
  // Process doesn't exist - stale status file
}
```

### MCP Server Integration Patterns

**Pattern 1: Direct Context Reading (Recommended)**

When watch mode is active, `context_main.json` and folder `context.json` files are always up-to-date. Simply read them directly:

```typescript
// 1. Check if watch mode is active
const isWatching = await checkWatchStatus(projectRoot);

// 2. Read context (always fresh when watch mode is running)
const index = JSON.parse(readFile('context_main.json'));
const bundles = JSON.parse(readFile(index.folders[0].contextFile));
```

This is the simplest approach - no need to track changes, just read the latest context.

**Pattern 2: Change-Aware Integration (with `--log-file`)**

For MCP servers that need to know *what* changed (not just read fresh context), use the `--log-file` flag:

```bash
stamp context --watch --log-file
```

This writes structured change logs to `.logicstamp/context_watch-mode-logs.json`:

```json
{
  "entries": [
    {
      "timestamp": "2025-01-19T10:30:05.000Z",
      "changedFiles": ["src/components/Button.tsx"],
      "fileCount": 1,
      "durationMs": 234,
      "modifiedContracts": [
        {
          "entryId": "src/components/Button.tsx",
          "semanticHashChanged": true,
          "fileHashChanged": true,
          "semanticHash": { "old": "uif:abc...", "new": "uif:def..." }
        }
      ],
      "modifiedBundles": [
        {
          "entryId": "src/components/Button.tsx",
          "bundleHash": { "old": "hash1...", "new": "hash2..." }
        }
      ],
      "addedContracts": [],
      "removedContracts": [],
      "summary": {
        "modifiedContractsCount": 1,
        "modifiedBundlesCount": 1,
        "addedContractsCount": 0,
        "removedContractsCount": 0
      }
    }
  ]
}
```

**Log entry fields:**
- `timestamp` - When regeneration completed
- `changedFiles` - Source files that triggered regeneration
- `fileCount` - Number of changed files
- `durationMs` - Regeneration time in milliseconds
- `modifiedContracts` - Contracts with changed hashes (API or content changes)
- `modifiedBundles` - Bundles with changed dependency graphs
- `addedContracts` - New components added
- `removedContracts` - Components removed
- `summary` - Quick counts for each change type
- `error` - Error message if regeneration failed

**When to use `--log-file`:**
- MCP server needs to notify users about specific changes
- Building a UI that shows "what changed" information
- Debugging or auditing context regeneration
- Integration tests that verify specific changes

**When NOT to use `--log-file`:**
- Just need fresh context (Pattern 1 is simpler)
- Concerned about disk I/O overhead
- Log file maintenance is a concern

### Hash Types in Change Logs

When `--log-file` is enabled, change logs include hash information:

| Hash Type | What It Detects | When It Changes |
|-----------|-----------------|-----------------|
| `semanticHash` | API/logic changes | Props, events, state, hooks, components, functions change |
| `fileHash` | Any content change | Any file modification (including comments, formatting) |
| `bundleHash` | Dependency graph changes | Components added/removed from bundle, edges change |

**Interpreting changes:**
- `semanticHash` changed → API breaking change likely, consumers may need updates
- `fileHash` changed but not `semanticHash` → Cosmetic change (comments, formatting)
- `bundleHash` changed → Dependency structure changed, may affect bundle consumers

### File Locations Summary

| File | Location | Purpose |
|------|----------|---------|
| Watch status | `.logicstamp/context_watch-status.json` | Detect if watch mode is running |
| Watch logs | `.logicstamp/context_watch-mode-logs.json` | Change history (requires `--log-file`) |
| Main index | `context_main.json` | Project structure and folder index |
| Folder context | `<folder>/context.json` | Component bundles per folder |

### CLI Reference

```bash
# Start watch mode (no log file)
stamp context --watch

# Start watch mode with change logging
stamp context --watch --log-file

# Watch with style metadata
stamp context --watch --include-style

# Watch with debug output (shows hash details in console)
stamp context --watch --debug

# Watch specific directory
stamp context ./src/components --watch
```

