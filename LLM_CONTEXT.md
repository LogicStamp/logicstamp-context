# LogicStamp Context – LLM Guide

## Overview
- Generates AI-friendly context bundles from React/TypeScript projects without build steps.
- Ships as a global CLI (install with `npm install -g logicstamp-context`, then use `stamp context` command) that scans `.ts`/`.tsx`, extracts component contracts, and emits structured JSON.
- Optimizes output for consumption by assistants such as Claude or ChatGPT to improve code understanding and guidance.
- Works on Node.js ≥ 18 and requires access to the project's source tree.

**Note**: "Global CLI" means the tool is installed globally on your system (via `npm install -g`), making the `stamp` command available from any directory in your terminal, not just within a specific project folder.

## Core Workflow
- `src/cli/index.ts` orchestrates CLI execution: reads CLI flags, calls the analyzer pipeline, writes bundles to disk.
- `src/core/astParser.ts` uses `ts-morph` to parse source files, derive component metadata, and normalize type information.
- `src/core/contractBuilder.ts` converts raw AST findings into UIF contracts and merges incremental updates.
- `src/core/manifest.ts` and `src/core/pack.ts` assemble dependency graphs, compute bundle hashes, and format final output entries.
- `src/types/UIFContract.ts` defines the UIF contract schema; `src/utils/fsx.ts` and `src/utils/hash.ts` provide file and hashing utilities.

## CLI Usage Cheatsheet
- Install globally: `npm install -g logicstamp-context`.
- Default command `stamp context [target]` scans the current directory (or supplied path) and emits `context.json`.
- Key flags: `--depth` (dependency traversal), `--include-code none|header|full`, `--profile llm-chat|llm-safe|ci-strict`, `--out <file>`, `--max-nodes <n>`.
- Profiles tune defaults: `llm-chat` (balanced), `llm-safe` (token-conservative), `ci-strict` (validation-first).
- Supports pretty and NDJSON formats via `--format`.

## What `context.json` Contains
- Output is an array of LogicStamp bundles. Each bundle represents one entry point (component/module) plus its immediate dependency graph.
- **Design note**: LogicStamp Context uses per-root bundles (one bundle per entry point) rather than per-component files. This means each bundle contains the root component plus its complete dependency graph—all related components and their relationships in one self-contained unit. This design is optimized for AI consumption: when you need help with a specific page or feature, share that root bundle and the AI has complete context.
- Top-level fields: `position`, `type`, `schemaVersion`, `entryId`, `depth`, `createdAt`, `bundleHash`, `graph`, `meta`.
- `graph.nodes` holds UIF contracts describing functions, props, events, imports, and semantic/file hashes. Optional `codeHeader` stores contract headers or code snippets when requested.
- `graph.edges` lists dependency relationships between nodes (empty when analysis depth is 1).
- `meta` section contains two critical fields:
  - `missing`: Array of unresolved dependencies. Each entry includes `name` (import path), `reason` (why it failed), and `referencedBy` (source component). Empty array indicates complete dependency resolution.
  - `source`: Generator version string (e.g., `"logicstamp-context@0.1.0"`) for compatibility tracking.
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

## Suggestions for LLM Consumers
- Load `context.json` and filter by `entryId` to focus on relevant modules.
- Use `version.functions` and `logicSignature` to reason about available APIs without scanning full source.
- Combine multiple bundles when a task spans related modules; respect `max-nodes` constraints to stay within token budgets.
- For deeper understanding, rerun the CLI with `--include-code full` or higher `--depth` before querying the assistant.
- **Always inspect `meta.missing`** to understand analysis completeness before providing architectural guidance.


