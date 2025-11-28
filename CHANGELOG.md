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
- **Savings calculation** - Shows percentage savings compared to full context (code+style) mode

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

## [0.1.1] - 2025-01-27

### Changed

#### CI-Friendly Defaults
- **`stamp context` no longer prompts** — All interactive prompts were moved to `stamp init` for better CI/CD compatibility.
- **Safe defaults** — `stamp context` now skips both `.gitignore` setup and `LLM_CONTEXT.md` generation unless these preferences are explicitly enabled via `stamp init`.
- **Auto-config creation** — On first run, `stamp context` creates `.logicstamp/config.json` with both preferences set to "skipped" for maximum CI safety and reproducibility.
- **`stamp context` no longer prompts** — All interactive prompts were moved to `stamp init` for better CI/CD compatibility.
- **Safe defaults** — `stamp context` now skips both `.gitignore` setup and `LLM_CONTEXT.md` generation unless these preferences are explicitly enabled via `stamp init`.
- **Auto-config creation** — On first run, `stamp context` creates `.logicstamp/config.json` with both preferences set to "skipped" for maximum CI safety and reproducibility.

#### Improved Initialization
- **`stamp init` now prompts interactively** — Prompts for `.gitignore` patterns and `LLM_CONTEXT.md` generation (only in interactive/TTY environments).
- **Non-interactive defaults** — In CI/non-TTY environments, `stamp init` defaults to "yes" for both prompts.
- **Better user control** — Users can establish `.gitignore` and `LLM_CONTEXT.md` preferences early via `stamp init` before running `stamp context`.

### Added

- **`--skip-gitignore` flag for `stamp context`** — Temporarily skips `.gitignore` setup on a per-run basis, regardless of saved preferences.
- **Config-based behavior** — `stamp context` now respects preferences saved in `.logicstamp/config.json` without prompting.

### Fixed

- N/A

### Security

- N/A

---

## [0.2.0] - 2025-11-28
- **`stamp init` now prompts interactively** — Prompts for `.gitignore` patterns and `LLM_CONTEXT.md` generation (only in interactive/TTY environments).
- **Non-interactive defaults** — In CI/non-TTY environments, `stamp init` defaults to "yes" for both prompts.
- **Better user control** — Users can establish `.gitignore` and `LLM_CONTEXT.md` preferences early via `stamp init` before running `stamp context`.

### Added

#### Style Metadata Extraction
- **`stamp context style` command** - New subcommand to generate context with style metadata included
- **`--include-style` flag** - Alternative syntax for enabling style metadata extraction
- **Style source detection** - Identifies Tailwind CSS, SCSS/CSS modules, inline styles, styled-components, and framer-motion usage
- **Layout metadata** - Extracts flex/grid patterns, hero sections, feature cards, and responsive breakpoints
- **Visual metadata** - Captures color palettes, spacing patterns, border radius, and typography classes
- **Animation metadata** - Detects framer-motion animations, CSS transitions, and viewport triggers
- **SCSS/CSS module parsing** - Analyzes imported style files to extract selectors, properties, and SCSS features

#### Enhanced Token Comparison
- **Four-mode comparison** - `--compare-modes` now shows `none`, `header`, `header+style`, and `full` modes
- **Dual comparison tables** - Shows savings vs raw source and vs full context
- **Accurate style impact** - Automatically regenerates contracts with/without style metadata for precise token counts
- **Style overhead visibility** - Clearly displays the token cost of including style metadata
- **Optional tokenizer support** - Includes `@dqbd/tiktoken` (GPT-4) and `@anthropic-ai/tokenizer` (Claude) as optional dependencies in package.json. npm automatically attempts to install them when installing `logicstamp-context`. If installation succeeds, the tool uses them for accurate token counts. If installation fails or is skipped (normal for optional dependencies), gracefully falls back to character-based estimation

#### Architectural Improvements
- **Modular CLI structure** - Refactored CLI into dedicated handlers for better maintainability
- **Extracted AST parsing** - Modularized AST extraction into dedicated detector and extractor modules
- **Modularized style extraction** - Organized style extraction into focused modules (tailwind, scss, motion, layout, etc.)
- **Modularized pack utilities** - Separated pack functionality into builder, collector, loader, and resolver modules
- **Improved code organization** - Better separation of concerns and testability

### Changed

- **`--compare-modes` output format** - Enhanced to include `header+style` mode and show two comparison tables
- **Token estimation** - Now accounts for style metadata in token calculations when `--include-style` is used
- **Token estimation API** - Token estimation functions are now async to support optional tokenizer libraries

### Documentation

- Added comprehensive `docs/cli/STYLE.md` documentation for the style command
- Added comprehensive `docs/cli/COMPARE-MODES.md` guide for token cost analysis
- Updated all command documentation to include style command and `--include-style` flag
- Enhanced token optimization documentation with `--compare-modes` examples
- Added style metadata examples and use cases throughout documentation
- Documented optional dependencies (`@dqbd/tiktoken` and `@anthropic-ai/tokenizer`) for accurate token counts - these are included in package.json as optionalDependencies and installed automatically by npm
- Updated schema documentation to include style metadata fields
- **`--skip-gitignore` flag for `stamp context`** — Temporarily skips `.gitignore` setup on a per-run basis, regardless of saved preferences.
- **Config-based behavior** — `stamp context` now respects preferences saved in `.logicstamp/config.json` without prompting.

### Fixed

- N/A

### Security

- N/A

---

## [0.2.1] - 2025-11-28

### Fixed

- **Dynamic version loading** - Fixed hardcoded version string in `fileWriter.ts` to dynamically load from `package.json`, ensuring version consistency across all generated context files

### Changed

- Updated all version references in documentation to reflect 0.2.1 release

---

## [0.2.2] - 2025-11-28

### Fixed

- **Documentation accuracy** - Fixed all documentation to correctly state that `@dqbd/tiktoken` and `@anthropic-ai/tokenizer` are included as optional dependencies in package.json. npm automatically attempts to install them when installing `logicstamp-context`. Previously, documentation incorrectly suggested users needed to manually install these packages.

### Changed

- Updated all documentation files (README.md, all docs/cli/*.md files, CHANGELOG.md) to clarify that tokenizers are optional dependencies installed automatically by npm
- Updated user-facing console messages to mention that tokenizers are optional dependencies
- Updated source code comments in `src/utils/tokens.ts` to reflect optional dependency installation

---

## [Unreleased]

### Planned Features
- Custom profile configuration and overrides
- Incremental bundle caching
- Output size optimization
- Additional output formats
- Integration examples for popular AI assistants
- Vue.js support
- Advanced Next.js App Router features (route roles, segment paths, metadata exports)

### Known Limitations
- No incremental caching (planned for future release)
- No custom profiles beyond the three presets (planned for future release)
