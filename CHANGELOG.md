# Changelog

All notable changes to `logicstamp-context` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Roadmap (not yet implemented)

For a comprehensive roadmap with detailed status, priorities, and implementation plans, see [ROADMAP.md](ROADMAP.md).

**Highlights:**
- Dynamic class parsing - Resolve variable-based classes within template literals
- CSS-in-JS support - Complete support for remaining libraries (Chakra UI, Ant Design)
- Enhanced third-party component info - Include package names, versions, prop types
- TypeScript type extraction - Capture full type definitions (generics, unions, intersections)
- Project-level insights - Add cross-folder relationships and project-wide statistics to `context_main.json`
- Vue Single File Component (`.vue`) support - Parse and analyze `.vue` SFC files
- Custom profile configuration and overrides
- Incremental bundle caching
- Output size optimization
- Additional output formats
- Integration examples for popular AI assistants
- Advanced Next.js App Router features (route roles, segment paths, metadata exports)

### Known Limitations

See [docs/limitations.md](docs/limitations.md) for complete details and code evidence.

- Dynamic class expressions not resolved (variables in template literals)
- TypeScript types incomplete (generics, complex unions/intersections)

---

## [0.3.7] - 2026-01-14

### Fixed

- **Emit detection accuracy** - Fixed issue where internal event handlers were incorrectly listed as component emits. Now only includes handlers that are part of the component's public API (props):
  - Only extracts event handlers that exist in Props interfaces/types
  - Filters out internal handlers (e.g., `onClick={() => setMenuOpen(!menuOpen)}`)
  - Filters out inline handlers that are not props
  - Uses prop type signatures when available for accurate event signatures
  - Falls back to AST-based arrow function parsing only when prop signature is unavailable
  - Uses `hasOwnProperty` check to avoid inherited prototype properties
  - Always includes prop-based handlers even if no initializer or signature available (uses default)

**Example:**

**Before (Incorrect):**
```typescript
function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  return <button onClick={() => setMenuOpen(!menuOpen)}>Toggle</button>;
}
// Result: { emits: { onClick: { type: 'function', signature: '() => void' } } }
```

**After (Correct):**
```typescript
function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  return <button onClick={() => setMenuOpen(!menuOpen)}>Toggle</button>;
}
// Result: { emits: {} } ✅ (no emits - internal handler)

interface ButtonProps {
  onClick?: () => void;
}
function Button({ onClick }: ButtonProps) {
  return <button onClick={onClick}>Click</button>;
}
// Result: { emits: { onClick: { type: 'function', signature: '() => void' } } } ✅
```

### Added

- **Code of Conduct** - Added Contributor Covenant Code of Conduct (version 2.1) to establish community standards and guidelines for participation in the project. Includes enforcement guidelines and reporting procedures. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for details.

### Changed

- **Event signature extraction** - Improved signature extraction to prioritize prop type signatures over JSX parsing. Prop signatures are now always used when available, preventing incorrect signatures from wrapper functions like `onClick={(e) => onClick?.(e)}`
- **Route extraction** - Enhanced route extraction to only extract routes from JSX attribute values (`path`, `to`, `href`, `as`, `route`, `src`), reducing false positives from config/constants. Added support for JSX-specific literal nodes that aren't standard StringLiteral
- **AST-based parsing** - Migrated from regex-based arrow function parsing to AST-based parsing using `Node.isArrowFunction()` for more robust and accurate parameter extraction
- **Security documentation clarity** - Clarified non-execution guarantees, `.gitignore` behavior, and `LLM_CONTEXT.md` generation semantics in `SECURITY.md` to better reflect default and `--no-secure` workflows

### Improved

- **Code quality** - Improved type safety by using `Node.isJsxExpression()` and `Node.isStringLiteral()` type guards instead of `as any` casts
- **Code clarity** - Simplified arrow function signature extraction logic for better readability and maintainability
- **Version compatibility** - Enhanced compatibility across ts-morph versions by using type guards and fallback handling for JSX attribute values

**Impact:** This release significantly improves the accuracy of component public API contracts. Internal handlers are no longer incorrectly listed as emits, making it easier for AI assistants to understand what events a component actually exposes. The prop signature prioritization ensures accurate event signatures even when wrapper functions are used. Route extraction is now more precise, reducing noise from unrelated string literals. All changes are backward compatible - existing context files remain valid, and the improvements are additive.

---

## [0.3.6] - 2026-01-11

### Added

- **Hook parameter detection** - Added comprehensive support for extracting function signatures from custom React hooks. Enables accurate parameter extraction for hook contracts:
  - Extracts function parameters from exported hook definitions (default or named export)
  - Includes parameter types from type annotations, default values, or TypeScript type checker inference
  - Handles optional parameters (with `?` modifier or default values)
  - Works with function declarations, arrow functions, and default exports
  - Extracts parameters even when Props interfaces/type aliases exist in the same file
  - Props take priority on conflicts (Props values override hook parameters when both exist)
  - Stores parameters in contract `logic.props` field for hooks
  - Performance optimized with early-exit checks
  - Comprehensive test coverage included

**Example:**

**Source Code:**
```typescript
export function useTypewriter(text: string, speed = 30, pause = 800) {
  const [displayedText, setDisplayedText] = useState('')
  // ... implementation
  return displayedText
}
```

**Context Output:**
```json
{
  "version": {
    "hooks": ["useTypewriter"]
  },
  "logic": {
    "props": {
      "text": "string",
      "speed": { "type": "number", "optional": true },
      "pause": { "type": "number", "optional": true }
    }
  }
}
```

### Changed

- **Hook contract accuracy** - Hook files now include complete parameter signatures in their contracts, improving AI understanding of hook APIs
- **Props extraction logic** - Enhanced prop extraction to handle hook parameters separately from component Props interfaces, ensuring both are captured correctly
- **Default depth changed from 1 to 2** - The default `--depth` parameter is now `2` instead of `1` to ensure proper signature extraction for React/TypeScript projects. This change addresses issues where depth=1 missed nested component signatures (e.g., `App` → `Hero` → `Button` where `Button`'s contract was missing). Depth=2 includes nested components in dependency graphs, providing complete component tree signatures. Users can still override with `--depth 1` if needed. All profiles (`llm-chat`, `llm-safe`) now default to depth=2. See [context.md](docs/cli/context.md#depth-parameter) for detailed explanation.

### Fixed

- **Hook parameter extraction** - Fixed issue where hook parameters were not extracted when Props interfaces existed in the same file. Hook parameters are now extracted independently and Props values take precedence on conflicts.

**Impact:** This release significantly improves hook contract completeness. Hook parameters are now captured for all hook files, regardless of whether Props interfaces exist. This enables better AI understanding of custom hook APIs and their usage patterns. The default depth change from 1 to 2 ensures more complete component tree signatures by including nested components in dependency graphs, addressing cases where depth=1 missed nested component contracts. All changes are backward compatible - existing context files remain valid, the new parameter extraction is additive, and users can still override depth with `--depth 1` if needed.

---

## [0.3.5] - 2026-01-06

### Added

- **Styled JSX support** - Added comprehensive support for Styled JSX. Enables accurate style context extraction for Next.js and React codebases using `<style jsx>` blocks:
  - CSS content extraction from `<style jsx>` blocks
  - Selector extraction from extracted CSS content
  - CSS property extraction from extracted CSS content
  - Global attribute detection (`<style jsx global>`)
  - Support for template literals, string literals, and tagged template expressions
  - Full integration with style metadata extraction when using `--include-style` or `stamp context style`
  - Integrated into `UIFContract.style.styledJsx` field in generated context files

- **Enhanced inline style extraction** - Improved inline style object extraction. Provides more complete style metadata by extracting both property names and their literal values:
  - Now extracts both CSS property names and their literal values
  - `inlineStyles` field structure enhanced to include:
    - `properties`: Array of CSS property names (e.g., `['animationDelay', 'color', 'padding']`)
    - `values`: Record of property-value pairs for literal values (e.g., `{ animationDelay: '2s', color: 'blue' }`)
  - Dynamic values (variables, function calls) are detected as properties but their values are not extracted (static analysis limitation)
  - Provides more complete style metadata for AI context analysis

### Changed

- **Style extractor architecture** - Added new `styledJsx.ts` module for Styled JSX extraction, following the modular style extractor pattern
- **UIFContract schema** - Added `styledJsx` field to style metadata structure in contract types
- **Schema version** - Updated context schema to include Styled JSX metadata fields

### Fixed

- **Inline style values** - Fixed issue where inline style objects only extracted property names without values. Now extracts both properties and literal values for better style metadata completeness.

**Impact:** This release is additive and non-breaking. All changes are backward compatible:
- **Styled JSX support** - New optional field `styledJsx` in style metadata. Only appears when `<style jsx>` blocks are detected. Existing codebases without Styled JSX are unaffected.
- **Enhanced inline styles** - The `inlineStyles` field structure is extended with an optional `values` field. Existing code accessing `inlineStyles.properties` continues to work unchanged. The `values` field is only added when literal values are extracted, maintaining backward compatibility with previous `inlineStyles` format (boolean or object with `properties` only).
- **Schema compatibility** - All additions are optional. No existing fields were removed or modified in a breaking way. Context files generated with previous versions remain valid.
- **CLI/API stability** - No CLI command changes, no breaking API changes.

---

## [0.3.4] - 2026-01-04

### Added

- **Vue.js TypeScript / TSX Support** - Added comprehensive support for Vue 3 Composition API:
  - Vue component and composable detection (`vue:component`, `vue:composable` kinds)
  - Vue composables extraction (ref, reactive, computed, watch, lifecycle hooks, etc.)
  - Vue component extraction from JSX and component registration
  - Vue reactive state extraction (ref, reactive, computed, shallowRef, shallowReactive)
  - Vue props extraction from `defineProps` (supports both type-based and runtime props)
  - Vue emits extraction from `defineEmits` (supports both type-based and runtime emits)
  - Full integration with contract building and signature generation
  - Framework detection priority: Vue takes priority over React when both are imported
  - JSX parsing: Uses React JSX mode (Vue JSX is compatible, but Vue templates are not parsed)
  - **Note:** Works with Vue code in `.ts`/`.tsx` files (JSX/TSX components, extracted composables). Single File Components (`.vue` files) are not currently supported. See [Vue.js documentation](docs/frameworks/vue.md) for complete documentation and limitations.

  **Impact:** This release is additive and non-breaking. Existing React/Next.js/TypeScript workflows are unaffected. Vue support is automatically detected when Vue imports are present in your codebase.

---

## [0.3.3] - 2025-12-22

### Added

- **TOON output format support** - Added new `--format toon` option to generate context bundles in TOON format. This provides an alternative output format for AI consumption, expanding format options beyond JSON, pretty, and NDJSON. See PR #41 for details.
- **TOON format documentation** - Added comprehensive `docs/cli/toon.md` documentation covering TOON format usage, decoding, and integration.
- **TOON format gitignore support** - Added `context.toon` and `context_*.toon` patterns to `.gitignore` setup, ensuring generated TOON files are properly excluded from version control.

### Changed

- **Updated `glob` dependency to 10.5.0** - Adjusted `glob` to a Node 18–compatible version while retaining the latest security fixes.
- **Updated Node.js engine requirement** - Clarified minimum supported Node.js version to >= 18.18.0. Node 20+ is now recommended for best performance and features.
- **Updated dev dependencies** - Updated development dependencies to latest patch versions:
  - `@types/node`: `^20.11.5` → `^20.19.27`
  - `vitest`: `^4.0.8` → `^4.0.16`
  - `@vitest/coverage-v8`: `^4.0.8` → `^4.0.16`
  - `@vitest/ui`: `^4.0.8` → `^4.0.16`
- **Documentation improvements** - Enhanced README formatting and clarity for better readability and user experience (PR #45)
- **Documentation consistency** - Improved formatting consistency across all documentation files for a more cohesive documentation experience (PR #44)
- **Framework documentation clarity** - Clarified the distinction between what is detected vs extracted across framework documentation, improving understanding of component analysis capabilities (PR #43)
- **TOON format tests** - Added comprehensive test coverage for TOON format gitignore patterns and initialization behavior.

---

## [0.3.2] - 2025-12-21

### Breaking

- **Output files now use relative paths** - Generated context files (`context_main.json` and folder `context.json` files) now use relative paths instead of absolute paths. The `projectRoot` field in `context_main.json` is now `"."` (relative) instead of an absolute path, and all `contextFile` paths in folder entries are relative to the project root. Output change: `projectRootResolved` is no longer emitted in generated context files (kept as optional in types for backward compatibility). The `LogicStampIndex` schema version has been bumped from `0.1` to `0.2` to reflect this output change. This improves portability of context files across different machines and environments. **Note:** This is a breaking change if you have tools or scripts that expect absolute paths in the generated JSON files or rely on the `projectRootResolved` field. Most consumers should continue to work as-is since relative paths can be resolved from the project root. See [Migration Guide](docs/MIGRATION_0.3.2.md) for details.

### Security

- **Updated `glob` dependency to 11.1.0+** - Updated `glob` package from `^10.3.10` to `^11.1.0` to address CVE-2025-64756 (command injection vulnerability in the `-c/--cmd` option). This vulnerability affected versions 10.3.7 through 11.0.3. The update patches the security issue. Note: LogicStamp Context uses the `glob` API (not the CLI), so it was not directly affected by this vulnerability, but the update ensures the latest security patches are in place.

### Changed

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
[Unreleased]: https://github.com/LogicStamp/logicstamp-context/compare/v0.3.7...HEAD
[0.3.7]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.3.7
[0.3.6]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.3.6
[0.3.5]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.3.5
[0.3.4]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.3.4
[0.3.3]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.3.3
[0.3.2]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.3.2
[0.3.1]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.3.1
[0.3.0]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.3.0
[0.2.7]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.2.7
[0.2.6]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.2.6
[0.2.5]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.2.5
[0.2.4]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.2.4
[0.2.3]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.2.3
[0.2.2]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.2.2
[0.2.1]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.2.1
[0.2.0]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.2.0
[0.1.1]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.1.1
[0.1.0]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.1.0