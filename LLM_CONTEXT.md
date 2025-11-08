# LogicStamp Context – LLM Guide

## Overview
- Generates AI-friendly context bundles from React/TypeScript projects without build steps.
- Ships as a global CLI (`logicstamp-context`) that scans `.ts`/`.tsx`, extracts component contracts, and emits structured JSON.
- Optimizes output for consumption by assistants such as Claude or ChatGPT to improve code understanding and guidance.
- Works on Node.js ≥ 18 and requires access to the project's source tree.

## Core Workflow
- `src/cli/index.ts` orchestrates CLI execution: reads CLI flags, calls the analyzer pipeline, writes bundles to disk.
- `src/core/astParser.ts` uses `ts-morph` to parse source files, derive component metadata, and normalize type information.
- `src/core/contractBuilder.ts` converts raw AST findings into UIF contracts and merges incremental updates.
- `src/core/manifest.ts` and `src/core/pack.ts` assemble dependency graphs, compute bundle hashes, and format final output entries.
- `src/types/UIFContract.ts` defines the UIF contract schema; `src/utils/fsx.ts` and `src/utils/hash.ts` provide file and hashing utilities.

## CLI Usage Cheatsheet
- Install globally: `npm install -g logicstamp-context`.
- Default command `logicstamp-context [target]` scans the current directory (or supplied path) and emits `context.json`.
- Key flags: `--depth` (dependency traversal), `--include-code none|header|full`, `--profile llm-chat|llm-safe|ci-strict`, `--out <file>`, `--max-nodes <n>`.
- Profiles tune defaults: `llm-chat` (balanced), `llm-safe` (token-conservative), `ci-strict` (validation-first).
- Supports pretty and NDJSON formats via `--format`.

## What `context.json` Contains
- Output is an array of LogicStamp bundles. Each bundle represents one entry point (component/module) plus its immediate dependency graph.
- Top-level fields: `position`, `type`, `schemaVersion`, `entryId`, `depth`, `createdAt`, `bundleHash`, `graph`, `meta`.
- `graph.nodes` holds UIF contracts describing functions, props, events, imports, and semantic/file hashes. Optional `codeHeader` stores contract headers or code snippets when requested.
- `graph.edges` lists dependency relationships between nodes (empty when analysis depth is 1).
- `meta` tracks missing references and manifest provenance.
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

## Suggestions for LLM Consumers
- Load `context.json` and filter by `entryId` to focus on relevant modules.
- Use `version.functions` and `logicSignature` to reason about available APIs without scanning full source.
- Combine multiple bundles when a task spans related modules; respect `max-nodes` constraints to stay within token budgets.
- For deeper understanding, rerun the CLI with `--include-code full` or higher `--depth` before querying the assistant.


