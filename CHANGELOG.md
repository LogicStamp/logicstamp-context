# Changelog

All notable changes to `logicstamp-context` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-25

### 🎉 Initial Release

First public release of LogicStamp Context - a fast, zero-config CLI tool that generates AI-friendly context bundles from React/TypeScript codebases.

### Added

#### Core Functionality
- **AST-based component analysis** - No pre-compilation required, works directly with source files
- **Multi-file context generation** - Per-folder `context.json` files plus root-level `context_main.json` index
- **Deterministic output** - Semantic hashing and bundle hashing for reproducible builds
- **Dependency graph traversal** - Configurable depth-based dependency analysis
- **Missing dependency tracking** - Diagnostics for unresolved imports with `--strict-missing` flag

#### CLI Commands
- `stamp context` - Generate context bundles from React/TypeScript codebase
- `stamp context compare` - Multi-file drift detection comparing all context files
- `stamp context validate` - Schema validation for generated context files
- `stamp context clean` - Remove all generated context artifacts
- `stamp init` - Interactive project initialization with `.gitignore` setup

#### Configuration & Profiles
- **Three preset profiles**: `llm-safe`, `llm-chat` (default), `ci-strict`
- **Code inclusion modes**: `none`, `header`, `full` for token optimization
- **Output formats**: `json`, `pretty`, `ndjson`
- **Zero configuration** - Works out of the box on any React/TypeScript project

#### Token Optimization
- **Automatic token estimates** - GPT-4o-mini and Claude token counts
- **Mode comparison** - `--compare-modes` flag for detailed token analysis
- **CI-friendly stats** - `--stats` flag outputs JSON with token estimates
- **Savings calculation** - Shows percentage savings compared to full code mode

#### Next.js Support
- **App Router detection** - Identifies files in `/app` directory
- **Directive detection** - `'use client'` and `'use server'` directive support
- **Framework metadata** - Next.js-specific annotations in contracts

#### Context Comparison
- **Multi-file drift detection** - Compares all context files using `context_main.json` as index
- **Three-tier output** - Folder summary → component summary → detailed changes
- **Auto-approve mode** - `--approve` flag for Jest-style snapshot updates
- **Orphaned file cleanup** - `--clean-orphaned` flag to remove stale context files
- **Token delta stats** - Per-folder token count changes with `--stats`

#### Programmatic API
- **Main entry point** - `dist/index.js` exports all core functions, types, and CLI commands
- **TypeScript types** - Full type definitions for all exports
- **Core modules** - AST parser, contract builder, manifest generator, pack utilities

#### Developer Experience
- **Interactive initialization** - First-run prompts for `.gitignore` and `LLM_CONTEXT.md` setup
- **Comprehensive help system** - Detailed help for all commands and options
- **Cross-platform support** - Works on Windows, macOS, and Linux
- **Fast performance** - ~3–5 seconds for typical 50–150 file projects
- **CI/CD integration** - Exit codes and JSON output for automation

#### Documentation
- Complete README with installation, usage, and examples
- Detailed CLI documentation for all commands
- JSON Schema definition for context files
- Example context outputs and use cases
- Troubleshooting guide for common issues

### Changed

- N/A (initial release)

### Fixed

- N/A (initial release)

### Security

- N/A (initial release)

---

## [Unreleased]

### Planned Features
- Custom profile configuration and overrides
- Incremental bundle caching
- Output size optimization
- Additional output formats
- Integration examples for popular AI assistants
- Vue.js and Svelte support
- Advanced Next.js App Router features (route roles, segment paths, metadata exports)

### Known Limitations
- No incremental caching (planned for future release)
- No custom profiles beyond the three presets (planned for future release)
