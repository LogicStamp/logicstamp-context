# LogicStamp Context Roadmap

This roadmap outlines the planned features, improvements, and known limitations for LogicStamp Context. It's organized into bug fixes, framework expansion, and future enhancements.

## Recent Achievements

### v0.3.6 (January 2026)
- ✅ **Hook parameter detection** - Comprehensive support for extracting function signatures from custom React hooks, including parameter types, default values, and optional parameters. Works even when Props interfaces exist in the same file.
- ✅ **Default depth changed from 1 to 2** - Default `--depth` parameter now set to `2` to ensure proper signature extraction for React/TypeScript projects, including nested component signatures in dependency graphs.

### v0.3.5 (January 2026)
- ✅ **Styled JSX support** - Full CSS extraction from `<style jsx>` blocks with selector and property parsing
- ✅ **Enhanced inline style extraction** - Now extracts both property names and literal values from `style={{ ... }}` objects

### v0.3.4 (January 2026)
- ✅ **Vue.js TypeScript/TSX support** - Comprehensive Vue 3 Composition API support (components, composables, props, emits)

### v0.3.3 (December 2025)
- ✅ **TOON output format** - New `--format toon` option for alternative AI consumption format

### v0.3.2 (December 2025)
- ✅ **CSS/SCSS AST-based parsing** - Migrated from regex to deterministic AST walk using `css-tree`
- ✅ **Relative paths in output** - Improved portability with relative paths instead of absolute paths

### v0.3.1 (December 2025)
- ✅ **Hook classification accuracy** - Custom hooks now correctly classified as `react:hook` instead of `react:component`

### v0.3.0 (December 2025)
- ✅ **Security scanning by default** - Automatic secret detection during `stamp init`
- ✅ **Automatic secret sanitization** - Secrets replaced with `"PRIVATE_DATA"` in generated context files

### v0.2.x Series
- ✅ **Style metadata extraction** - Tailwind, SCSS, Material UI, ShadCN, Radix UI, Framer Motion support
- ✅ **Security scanning** - Secret detection and `.stampignore` file exclusion
- ✅ **Export metadata extraction** - Default and named export detection
- ✅ **Internal component filtering** - Improved dependency graph accuracy

---

## Bug Fixes & Accuracy Improvements

These items address core accuracy and completeness issues that impact the reliability of generated context files.

### High Priority

#### 1. Emit Detection Accuracy
**Status:** 🔴 Not Started

Distinguish internal handlers from public API emits. Currently, all `onXxx` handlers are treated as emits, even internal ones.

**Current Behavior:**
- ✅ Extracts all `onXxx` handlers
- ❌ No distinction between props (public API) and internal handlers
- ❌ All handlers treated as emits

**Planned Implementation:**
- Analyze whether handler is passed as prop vs defined internally
- Only include props in `emits` object
- Filter out internal state handlers

**Impact:** Internal handlers incorrectly listed as emits, causing confusion about component public API.

**Related:** See [docs/limitations.md](docs/limitations.md#emit-detection-accuracy) for detailed code evidence.

---

#### 2. Dynamic Class Parsing
**Status:** 🔴 Not Started

Resolve variable-based classes within template literals. Currently, only static segments are extracted.

**Current Behavior:**
- ✅ Extracts static Tailwind classes
- ✅ Extracts static segments from template literals
- ❌ Does not resolve dynamic expressions within `${}`

**Planned Implementation:**
- Resolve variable references to class strings
- Extract classes from object lookups (e.g., `variants[variant]`)
- Support function calls that return class strings

**Impact:** Dynamic class construction from variables results in incomplete style metadata.

**Related:** See [docs/limitations.md](docs/limitations.md#dynamic-class-parsing) for detailed code evidence.

---

### Medium Priority

#### 3. CSS-in-JS Support Completeness
**Status:** 🟡 Partially Complete

Complete support for remaining CSS-in-JS libraries.

**Currently Supported:**
- ✅ styled-components
- ✅ Emotion (@emotion/styled)
- ✅ Material UI (@mui/material)
- ✅ ShadCN/UI
- ✅ Radix UI
- ✅ Framer Motion
- ✅ Styled JSX

**Missing:**
- ❌ Chakra UI
- ❌ Ant Design

**Impact:** Most major libraries are supported. Remaining gaps are primarily for smaller/less common libraries.

---

#### 4. Enhanced Third-Party Component Info
**Status:** 🔴 Not Started

Include package names, versions, and prop types for third-party components.

**Current Behavior:**
- ✅ Basic "missing" info for unresolved dependencies
- ❌ No package names or versions
- ❌ No prop type information

**Planned Implementation:**
- Extract package names from import statements
- Include version info from `package.json` (if available)
- Attempt to extract prop types from type definitions

**Impact:** Limited understanding of external dependencies in context files.

---

#### 5. TypeScript Type Extraction
**Status:** 🟡 Partially Complete

Capture full type definitions including generics and complex unions/intersections.

**Currently Supported:**
- ✅ Basic types (`string`, `number`, `boolean`)
- ✅ Literal unions (`"primary" | "secondary"`)
- ✅ Function types (`() => void`)

**Missing:**
- ❌ Generics (e.g., `ListProps<T>`)
- ❌ Complex unions/intersections (e.g., `A & B`, `A | B | C` where not string literals)
- ❌ Generic type parameters

**Impact:** Limited type information for complex types in contracts.

**Related:** See [docs/limitations.md](docs/limitations.md#typescript-types-incomplete) for detailed code evidence.

---

#### 6. Project-Level Insights
**Status:** 🔴 Not Started

Add cross-folder relationships and project-wide statistics to `context_main.json`.

**Current Behavior:**
- ✅ Folder index with token estimates
- ✅ Component lists per folder
- ❌ No cross-folder relationships
- ❌ No project-wide statistics

**Planned Implementation:**
- Cross-folder dependency analysis
- Project-wide component counts
- Aggregate style metadata statistics
- Architecture pattern detection

**Impact:** Limited project-level insights in main index file.

---

### Low Priority

#### 7. Test File Analysis
**Status:** 🔴 Not Started

Extract test structure, test cases, and testing patterns.

**Current Behavior:**
- ✅ Test files explicitly excluded from context generation
- ❌ No test analysis at all

**Note:** This is intentional by design - test files are excluded to keep context bundles focused on production code.

**Planned Implementation (if requested):**
- Optional flag to include test files
- Test structure extraction
- Test case and utility detection
- Testing strategy patterns

**Impact:** No test understanding in context files (by design).

---

#### 8. Comment Extraction
**Status:** 🟡 Partial

Include regular comments (not just JSDoc).

**Currently Supported:**
- ✅ JSDoc comments (in header mode)

**Missing:**
- ❌ Regular comments (`//`, `/* */`)
- ❌ TODO notes

**Impact:** Loses some documentation context from comments.

---

#### 9. Runtime Behavior Hints
**Status:** 🔴 Not Started

Add static analysis hints about runtime behavior.

**Note:** This is expected limitation for static analysis tools - we can't execute code.

**Potential Implementation:**
- Side effect detection
- State mutation patterns
- Effect dependency analysis

**Impact:** No runtime insights (expected for static analysis).

---

## Framework Expansion

These items expand LogicStamp Context to support additional languages, frameworks, and development workflows.

### Near-Term (v0.4.x)

#### 1. JavaScript & JSX Support
**Status:** 🔴 Not Started

Add support for JavaScript (`.js`) and JSX (`.jsx`) files in addition to TypeScript.

**Current Behavior:**
- ✅ Only TypeScript files (`.ts`, `.tsx`) are analyzed
- ❌ JavaScript files (`.js`, `.jsx`) are ignored

**Planned Implementation:**
- Extend AST parser to handle JavaScript syntax
- Support JSDoc type annotations for type inference
- Handle JavaScript-specific patterns (CommonJS, ES modules)
- Maintain same contract structure for JS/JSX files

**Impact:** Enables LogicStamp Context to work with JavaScript codebases that haven't migrated to TypeScript yet.

**Priority:** High

---

#### 2. Complete Vue.js Support
**Status:** 🟡 Partially Complete

Add full support for Vue Single File Components (`.vue` files).

**Current Behavior:**
- ✅ Vue 3 Composition API support for `.ts`/`.tsx` files
- ✅ Vue components and composables detection
- ✅ Props and emits extraction from JSX/TSX
- ❌ Vue Single File Components (`.vue` files) not supported

**Planned Implementation:**
- Parse `.vue` SFC files (template, script, style blocks)
- Extract template syntax (directives, bindings, slots)
- Extract script setup and composition API usage
- Extract scoped styles and CSS modules from style blocks
- Support both Options API and Composition API

**Impact:** Enables full Vue.js codebase analysis, including projects using `.vue` SFC files.

**Priority:** High

---

#### 3. Watch Mode
**Status:** 🔴 Not Started

Add a watch mode that automatically regenerates context files when source files change.

**Planned Implementation:**
- `stamp context --watch` command
- File system watcher for `.ts`, `.tsx`, `.js`, `.jsx` files
- Incremental updates (only regenerate affected bundles)
- Debouncing to batch multiple file changes
- Configurable watch patterns and exclusions

**Impact:** Improves developer experience by automatically keeping context files in sync with code changes.

**Priority:** Medium

---

### Future (v0.5.x+)

#### 4. Svelte Support
**Status:** 🔴 Not Started

Add support for Svelte components (`.svelte` files).

**Planned Implementation:**
- Parse Svelte component files
- Extract props, reactive statements, and stores
- Extract template syntax and bindings
- Extract scoped styles
- Support SvelteKit routing and layouts

**Impact:** Expands framework support to include Svelte-based projects.

**Priority:** Medium

---

#### 5. Python Support
**Status:** 🔴 Not Started

Add support for Python codebases (experimental).

**Planned Implementation:**
- Parse Python AST using `ast` module
- Extract function signatures, classes, and modules
- Extract type hints and docstrings
- Support popular frameworks (FastAPI, Django, Flask)
- Generate Python-specific contracts

**Impact:** Expands LogicStamp Context beyond JavaScript/TypeScript ecosystems.

**Priority:** Low (Future consideration)

---

#### 6. Java Support
**Status:** 🔴 Not Started

Add support for Java codebases (experimental).

**Planned Implementation:**
- Parse Java source files
- Extract class definitions, methods, and interfaces
- Extract annotations and Javadoc
- Support Spring Boot and other popular frameworks
- Generate Java-specific contracts

**Impact:** Expands LogicStamp Context to enterprise Java codebases.

**Priority:** Low (Future consideration)

---

## Future Enhancements

These are longer-term features and improvements planned for future releases.

### Performance & Optimization
- **Incremental bundle caching** - Only regenerate changed bundles
- **Output size optimization** - Further reduce token counts while maintaining accuracy

### Configuration & Extensibility
- **Custom profile configuration and overrides** - User-defined profiles beyond preset options
- **Additional output formats** - More format options for different AI consumption patterns
- **Advanced Next.js App Router features** - Route roles, segment paths, metadata exports

### Developer Experience
- **Integration examples** - Examples for popular AI assistants (Cursor, Claude Desktop, GitHub Copilot Chat)
- **Advanced debugging tools** - Better diagnostics and troubleshooting capabilities

---

## Known Limitations

For a complete list of current limitations with code evidence and detailed explanations, see [docs/limitations.md](docs/limitations.md).

### Summary of Current Limitations

**Active Accuracy Issues:**
- ❌ Emit detection accuracy - internal handlers vs public API not distinguished
- ❌ Dynamic class expressions not resolved (variables in template literals)

**Active Coverage Gaps:**
- ❌ TypeScript types incomplete (generics, complex unions/intersections)
- ❌ CSS-in-JS support incomplete (Chakra UI, Ant Design missing)
- ❌ Third-party component info minimal (no package names, versions, prop types)
- ❌ Project-level insights missing (cross-folder relationships, project-wide statistics)
- ⚠️ Comments only in header mode (JSDoc only)
- ⚠️ Test files excluded (by design)

**Overall Assessment:**
- **~95%** - Component Contracts (Props, state, hooks detection) ✅ Hook parameters now included
- **~100%** - Imports Detection (Imports tracked correctly)
- **~90%** - Style Metadata (Static classes work well, dynamic classes not resolved)

---

## Contributing

We welcome contributions! If you'd like to work on any of these roadmap items:

1. Check [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines
2. Open an issue to discuss your approach
3. Submit a pull request with your implementation

**Priority Areas for Contributors:**

**Bug Fixes:**
- Emit detection accuracy - Distinguish internal handlers from public API emits
- Dynamic class parsing - Resolve variable-based classes in template literals
- CSS-in-JS library support - Add Chakra UI and Ant Design support
- Enhanced third-party component info - Include package names, versions, prop types

**Framework Expansion:**
- JavaScript & JSX support - Add `.js`/`.jsx` file analysis
- Complete Vue.js support - Add `.vue` SFC file parsing
- Watch mode - Automatic context regeneration on file changes

---

## Version History

For detailed release notes and changes, see [CHANGELOG.md](CHANGELOG.md).

**Current Version:** v0.3.6 (Beta)

**Status:** Actively developed - we're working on improving accuracy and expanding feature coverage based on user feedback.

---

## Feedback

Have suggestions for the roadmap? We'd love to hear from you:

- **Open an issue** → https://github.com/LogicStamp/logicstamp-context/issues
- **Join our roadmap** → https://logicstamp.dev

