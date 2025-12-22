# Changelog

All notable changes to `logicstamp-context` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

---

## [0.3.2] - 2025-12-21

### Security

- **Updated `glob` dependency to 11.1.0+** - Updated `glob` package from `^10.3.10` to `^11.1.0` to address CVE-2025-64756 (command injection vulnerability in the `-c/--cmd` option). This vulnerability affected versions 10.3.7 through 11.0.3. The update patches the security issue. Note: LogicStamp Context uses the `glob` API (not the CLI), so it was not directly affected by this vulnerability, but the update ensures the latest security patches are in place.

### Changed

- **Output files now use relative paths** - Generated context files (`context_main.json` and folder `context.json` files) now use relative paths instead of absolute paths. The `projectRoot` field in `context_main.json` is now `"."` (relative) instead of an absolute path, and all `contextFile` paths in folder entries are relative to the project root. Output change: `projectRootResolved` is no longer emitted in generated context files (kept as optional in types for backward compatibility). The `LogicStampIndex` schema version has been bumped from `0.1` to `0.2` to reflect this output change. This improves portability of context files across different machines and environments. **Note:** This is a breaking change if you have tools or scripts that expect absolute paths in the generated JSON files or rely on the `projectRootResolved` field. Most consumers should continue to work as-is since relative paths can be resolved from the project root. See [Migration Guide](docs/MIGRATION_0.3.2.md) for details.

- **CSS/SCSS parsing now uses AST-based parsing** - Migrated CSS and SCSS file parsing from regex-based extraction to a deterministic AST walk using `css-tree`. This replaces heuristic regex-based parsing with a deterministic AST walk, improving correctness and future extensibility. The parser provides more robust and accurate parsing of CSS/SCSS files, consistent with the AST-based approach used for TypeScript/React files with `ts-morph`, and properly handles:
  - CSS selectors (class, ID, and type selectors) with accurate extraction
  - CSS properties with proper filtering of SCSS variables and at-rules
  - SCSS feature detection (variables, nesting, mixins) - detects presence as boolean flags
  - Nested rules inside `@media`, `@supports`, `@container`, and other at-rules
  - SCSS `//` comments (automatically converted to `/* */` for css-tree compatibility)
  - Invalid selector filtering (file extensions, numeric values, keyframe percentages, color values, pixel values)
  - Better error handling with graceful fallback on parse failures


---

## [0.3.1] - 2025-12-15

### Fixed

- **Hook classification accuracy** - Custom React hooks are now correctly classified as `react:hook` instead of `react:component`. The detection logic now checks if the main export (default or named) is a function starting with "use" and has no JSX elements, ensuring hook files are properly distinguished from component files in context bundles. This improves accuracy when analyzing codebases with custom hooks.

### Changed

- **Added `react:hook` to ContractKind type** - The `ContractKind` type now includes `'react:hook'` as a valid kind, allowing proper classification of hook files in the contract system.

---

## [0.3.0] - 2025-12-07

### Changed

- **Security scan now runs by default in `stamp init`** - `stamp init` now automatically runs a security scan after initialization by default. This improves security posture for new projects by ensuring secrets are detected during setup. Use the `--no-secure` flag to skip the security scan if needed.

- **Removed `--secure` flag from `stamp init`** - The `--secure` flag has been removed since security scanning is now the default behavior. If you have scripts or CI/CD pipelines that used `--secure`, they will continue to work (security scan now runs by default), or you can use `--no-secure` to skip it.

- **Updated initialization command documentation** - All documentation has been updated to reflect that security scanning runs by default. The `--no-secure` flag is documented as the way to opt out of security scanning during initialization.

### Added

- **`--no-secure` flag for `stamp init`** - New flag to skip the security scan during initialization when security scanning is not desired.

### Fixed

- N/A

### Security

- **Improved default security posture** - By running security scans by default during initialization, projects are now more likely to catch secrets and sensitive information before they're committed to version control.

- **Automatic secret sanitization in context files** - When generating context JSON files with `stamp context`, any secrets **detected by the security scanner** are automatically replaced with `"PRIVATE_DATA"` in the generated files. This ensures that secrets never appear in context files that might be shared with AI assistants or committed to version control. Source files are never modified - only the generated JSON files contain sanitized values. **Important security note**: Credentials can only be included in generated bundles when using `--include-code full` mode. The other modes (`none`, `header`, `header+style`) only include metadata and contracts (with secrets sanitized), not actual implementation code where credentials would typically be found.

---

## [0.2.7] - 2025-12-03

### Added

- **Security scanning command** - New `stamp security scan` command to detect secrets in your codebase:
  - Scans TypeScript, JavaScript, and JSON files for common secret patterns (API keys, passwords, tokens, etc.)
  - Generates detailed security reports with file locations and severity levels
  - Runs 100% locally — nothing is uploaded or sent anywhere
  - Review the security report and use `stamp ignore <file>` to manually add files with secrets to `.stampignore` to exclude them from context generation

- **Security reset command** - New `stamp security --hard-reset` command to reset security configuration:
  - Deletes the security report file
  - Useful for starting fresh after remediation or resetting security configuration

- **Enhanced initialization** - Improved `stamp init` command with new options:
  - `--yes` / `-y` flag for non-interactive mode (CI-friendly)
  - `--secure` flag to initialize with auto-yes and automatically run security scan (removed in v0.3.0, security scan now runs by default)
  - Better integration with security scanning workflow

- **`stamp ignore` command** - New command to add files or folders to `.stampignore`:
  - `stamp ignore <path> [path2] ...` to add files/folders to `.stampignore`
  - Automatically creates `.stampignore` if it doesn't exist
  - Prevents duplicates and normalizes paths
  - Supports glob patterns (e.g., `**/*.key`, `**/secrets.ts`)
  - `--quiet` flag to suppress verbose output
  - Recommended way to manage file exclusions (alternative to manually editing `.stampignore`)

- **File exclusion with .stampignore** - Enhanced `stamp context` with automatic file exclusion:
  - Automatically excludes files listed in `.stampignore` from context generation
  - Prevents files containing secrets or sensitive information from being included in context files
  - Supports glob patterns and exact file paths
  - Files are filtered before processing, with optional exclusion count messages

### Changed

- **CLI documentation enhancements** - Enhanced CLI documentation to include:
  - New security commands and options (`stamp security scan`, `stamp security --hard-reset`)
  - New `stamp ignore` command for managing `.stampignore` file
  - Details on file exclusion behavior with `.stampignore` for context generation
  - Improved initialization command documentation with non-interactive mode and security scan integration
  - Updated all command references and examples for consistency

- **security documentation improvements** - Added comprehensive `docs/cli/security-scan.md` documentation covering:
  - Security scanning command usage and options
  - Secret detection patterns and severity levels
  - `.stampignore` integration for excluding files with secrets
  - Security report format and structure
  - CI/CD integration examples

- **Enhanced gitignore pattern documentation** - Improved documentation across all files to better explain what each `.gitignore` pattern does and why it's being ignored:
  - Added detailed explanations in `docs/cli/init.md` for each pattern (context.json, context_*.json, *.uif.json, logicstamp.manifest.json, .logicstamp/, stamp_security_report.json)
  - Enhanced `docs/USAGE.md` with brief pattern explanations and reference to detailed docs
  - Improved `docs/cli/security-scan.md` to clarify why security reports are automatically protected
  - Updated `SECURITY.md` with comprehensive explanations of each pattern and security implications
  - All documentation now consistently explains what each pattern matches, why it's ignored, and when it's generated

### Fixed

- N/A

### Security

- N/A

---

## [0.2.6] - 2025-12-01

### Added

- **Export metadata extraction** - Added automatic extraction of export information from source files:
  - Detects default exports (`export default`)
  - Detects named exports (`export { ... }`, `export function`, `export class`, `export const`)
  - Extracts list of exported function names
  - Stores export metadata in contracts as `exports` field (optional)
  - Export metadata format: `'default'`, `'named'`, or `{ named: string[] }` for multiple named exports
  - Used to improve dependency tracking accuracy

- **Internal component filtering** - Improved dependency tracking by filtering out internal components:
  - Internal components are function components defined in the same file (appear in both `version.functions` and `version.components`)
  - Internal components are now excluded from dependency graphs and missing dependency lists
  - Reduces false positives in missing dependency detection
  - Improves accuracy of dependency analysis for multi-component files

### Changed

- **Dependency graph accuracy** - Dependency graphs now only include external dependencies, excluding internal components defined in the same file
- **Missing dependency reporting** - Missing dependency lists no longer include internal components, reducing noise in dependency diagnostics
- **Documentation updates** - Updated SECURITY.md to include 0.2.x in supported versions, updated example files to reflect version 0.2.6

### Fixed

- N/A

### Security

- N/A

---

## [0.2.5] - 2025-11-30

### Added

#### Style Metadata Extraction
- **ShadCN/UI style extraction** - Added ShadCN/UI component library detection and extraction:
  - Detects ShadCN components imported from `@/components/ui/*`, `~/components/ui/*`, or relative `components/ui/*` paths
  - Identifies ShadCN component usage (Button, Card, Dialog, Form components, etc.)
  - Extracts ShadCN variant and size prop values
  - Recognizes compound component patterns (e.g., Dialog with DialogTrigger, DialogContent)
  - Detects form integration with React Hook Form
  - Identifies theme integration patterns (useTheme, ThemeProvider)
  - Tracks icon usage (lucide-react, @radix-ui/react-icons)
  - Calculates component density based on ShadCN component usage
  - Integrated into style metadata extraction when using `--include-style` or `stamp context style`

- **Radix UI style extraction** - Added Radix UI primitive library detection and extraction:
  - Detects Radix UI primitives imported from `@radix-ui/*` packages
  - Identifies Radix primitive components (Dialog, DropdownMenu, Popover, Tooltip, Accordion, Select, etc.)
  - Extracts Radix package usage and component relationships
  - Detects controlled/uncontrolled state patterns
  - Identifies portal usage patterns
  - Recognizes `asChild` prop usage
  - Extracts accessibility features and ARIA patterns
  - Integrated into style metadata extraction when using `--include-style` or `stamp context style`

- **Enhanced debug logging** - Improved debug logging and error handling across core modules for better troubleshooting and diagnostics

### Changed

- **Model name corrections** - Updated all documentation references from "GPT-4o-mini" to "GPT-4o" for accurate token estimation model naming
- **Documentation consistency** - Improved consistency and clarity across all documentation files

### Fixed

- N/A

### Security

- N/A

---

## [0.2.4] - 2025-11-29

### Added

- **Material UI style extraction** - Added Material UI component library detection and extraction:
  - Detects Material UI components used (Button, TextField, Card, etc.)
  - Identifies Material UI packages imported (@mui/material, @material-ui/core, etc.)
  - Extracts Material UI styling features: theme usage, sx prop, styled components, makeStyles, and system props
  - Integrated into style metadata extraction when using `--include-style` or `stamp context style`

### Fixed

- **README clarification** - Fixed and clarified the "Global CLI" installation note to better explain the difference between local and global npm installations

### Changed

- **README.md significantly streamlined and optimized** - Reduced from 718 lines to 199 lines (72% reduction) while maintaining all essential information:
  - Moved detailed documentation sections to `docs/` folder (Token Optimization, Mode Comparison, Behavioral Predictions, CI usage, Troubleshooting, Output Format schema, Next.js examples)
  - Added "Why LogicStamp?" section highlighting token savings and key benefits
  - Added concise "Core Features" list with bullet points
  - Added minimal "Example Output" section with realistic JSON sample
  - Shortened "Recent Updates" to show only 2 recent versions with link to full CHANGELOG
  - Added "Getting Help" section with links to GitHub issues and roadmap
  - Updated Quick Start to show both global and local installation methods
  - Fixed npm link compatibility - converted all relative links to absolute GitHub URLs for proper rendering on npmjs.com
  - Improved structure following best practices from top-tier dev tools (Astro, Vite, ESLint) - README focuses on marketing/onboarding, detailed docs in `/docs`
- Updated all version references in documentation to reflect 0.2.4 release

---

## [0.2.3] - 2025-11-29

### Added

- **UIF Contracts documentation** - Added comprehensive `docs/uif_contracts.md` guide explaining contract structure, semantic hashing, and contract-based change detection
- **Enhanced test documentation** - Improved `tests/README.md` with better structure, test categories, and usage examples

### Changed

- **README.md significantly streamlined** - Reduced from 1,015 to 700 lines while preserving all essential information. Removed verbose "What's New" sections in favor of brief summaries with CHANGELOG links, condensed command documentation to quick reference tables, and streamlined output format section with links to detailed schema docs
- **Improved token estimation accuracy** - Enhanced raw source token estimation formulas in regular output (not `--compare-modes`). When in header mode, now uses more accurate formulas to estimate raw source tokens: raw source = header / 0.30 (header is 30% of raw source), and style adds 105% overhead (header+style = header × 2.05). When in header+style mode, first estimates header without style (header = header+style / 2.05), then derives raw source from that estimate. Note: "Raw source" refers to the original source files concatenated, which is always estimated using these formulas (never actually generated). The actual context bundles (header, header+style, etc.) use tokenizers when available for accurate token counts. The `--compare-modes` flag regenerates contracts to provide accurate token counts for all modes
- **Updated compare-modes.md documentation** - Refined examples and explanations with more accurate token savings percentages and clearer interpretation guidelines

### Fixed

- N/A

### Security

- N/A

---

## [0.2.2] - 2025-11-28

### Fixed

- **Documentation accuracy** - Fixed all documentation to correctly state that `@dqbd/tiktoken` and `@anthropic-ai/tokenizer` are included as optional dependencies in package.json. npm automatically attempts to install them when installing `logicstamp-context`. Previously, documentation incorrectly suggested users needed to manually install these packages.

### Changed

- Updated all documentation files (README.md, all docs/cli/*.md files, CHANGELOG.md) to clarify that tokenizers are optional dependencies installed automatically by npm
- Updated user-facing console messages to mention that tokenizers are optional dependencies
- Updated source code comments in `src/utils/tokens.ts` to reflect optional dependency installation

---

## [0.2.1] - 2025-11-28

### Fixed

- **Dynamic version loading** - Fixed hardcoded version string in `fileWriter.ts` to dynamically load from `package.json`, ensuring version consistency across all generated context files

### Changed

- Updated all version references in documentation to reflect 0.2.1 release

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
- **SCSS/CSS module parsing** - Analyzes imported style files to extract selectors, properties, and SCSS feature detection (variables, nesting, mixins as boolean flags)

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

- Added comprehensive `docs/cli/style.md` documentation for the style command
- Added comprehensive `docs/cli/compare-modes.md` guide for token cost analysis
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

## [0.1.1] - 2025-01-27

### Changed

#### CI-Friendly Defaults
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

## Version links

- [Unreleased](https://github.com/LogicStamp/logicstamp-context/compare/v0.3.2...HEAD)
- [0.3.2](https://github.com/LogicStamp/logicstamp-context/compare/v0.3.1...v0.3.2)
- [0.3.1](https://github.com/LogicStamp/logicstamp-context/compare/v0.3.0...v0.3.1)
- [0.3.0](https://github.com/LogicStamp/logicstamp-context/compare/v0.2.7...v0.3.0)
- [0.2.7](https://github.com/LogicStamp/logicstamp-context/compare/v0.2.6...v0.2.7)
- [0.2.6](https://github.com/LogicStamp/logicstamp-context/compare/v0.2.5...v0.2.6)
- [0.2.5](https://github.com/LogicStamp/logicstamp-context/compare/v0.2.4...v0.2.5)
- [0.2.4](https://github.com/LogicStamp/logicstamp-context/compare/v0.2.3...v0.2.4)
- [0.2.3](https://github.com/LogicStamp/logicstamp-context/compare/v0.2.2...v0.2.3)
- [0.2.2](https://github.com/LogicStamp/logicstamp-context/compare/v0.2.1...v0.2.2)
- [0.2.1](https://github.com/LogicStamp/logicstamp-context/compare/v0.2.0...v0.2.1)
- [0.2.0](https://github.com/LogicStamp/logicstamp-context/compare/v0.1.1...v0.2.0)
- [0.1.1](https://github.com/LogicStamp/logicstamp-context/compare/v0.1.0...v0.1.1)
- [0.1.0](https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.1.0)