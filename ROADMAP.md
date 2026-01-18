# LogicStamp Context Roadmap

This roadmap outlines the planned features, improvements, and known limitations for LogicStamp Context. It's organized into bug fixes, framework expansion, and future enhancements.

## Recent Achievements

### v0.4.0 (January 2026)
- ✅ **Backend framework support** - Comprehensive support for Node.js backend frameworks (Express.js, NestJS). Extracts API routes, HTTP methods, route parameters, request/response types, and framework-specific metadata. Automatically detects backend frameworks and skips frontend extraction for backend files. Introduces new `node:api` contract kind and extensible `language:type` pattern for future language support.

### v0.3.10 (January 2026)
- ✅ **Advanced Next.js App Router features** - Enhanced Next.js metadata extraction with route roles, segment paths, and metadata exports. Automatically detects route roles (`page`, `layout`, `loading`, `error`, `not-found`, `template`, `default`, `route`), extracts segment paths from file structure, and parses both static and dynamic metadata exports.

### v0.3.9 (January 2026)
- ✅ **Dynamic Tailwind class parsing (Phase 1)** - Enhanced Tailwind CSS extractor to resolve dynamic class expressions within template literals. Resolves const/let variables, object properties, and conditional expressions. Handles ~70-80% of common dynamic class patterns.

### v0.3.8 (January 2026)
- ✅ **Enhanced third-party component info (Phase 1)** - Missing dependencies now include package names and versions for third-party packages. Package name extraction handles scoped packages and subpath imports. Version lookup reads from `package.json` with caching for efficiency.

### v0.3.7 (January 2026)
- ✅ **Emit detection accuracy** - Fixed issue where internal event handlers were incorrectly listed as component emits. Now only includes handlers that are part of the component's public API (props). Uses prop type signatures when available for accurate event signatures.

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
**Status:** ✅ **Fixed in v0.3.7**

Emit detection now correctly distinguishes between internal handlers and component public API emits. Only handlers that are part of the component's Props interface/type are included in the `emits` object.

**What Works:**
- ✅ Only extracts event handlers that exist in Props interfaces/types
- ✅ Filters out internal handlers (e.g., `onClick={() => setMenuOpen(!menuOpen)}`)
- ✅ Filters out inline handlers that are not props
- ✅ Uses prop type signatures when available for accurate event signatures
- ✅ Falls back to AST-based arrow function parsing only when prop signature is unavailable
- ✅ Uses `hasOwnProperty` check to avoid inherited prototype properties
- ✅ Always includes prop-based handlers even if no initializer or signature available (uses default)

**Impact:** Internal handlers are no longer incorrectly listed as emits, making it easier for AI assistants to understand what events a component actually exposes.

**Related:** See [docs/limitations.md](docs/limitations.md#fixedresolved-features) for detailed information.

---

#### 2. Dynamic Class Parsing
**Status:** ✅ Phase 1 Complete (v0.3.9), 🟡 Phase 2 Planned

Resolve variable-based classes within template literals. Phase 1 is complete, handling same-file variable resolution.

**Current Behavior:**
- ✅ Extracts static Tailwind classes
- ✅ Extracts static segments from template literals
- ✅ Phase 1: Resolves const/let variables, object properties, and conditional expressions
- ❌ Phase 2: Does not resolve object lookups with variables, cross-file references, or function calls

**Phase 1 Implementation (v0.3.9 - ✅ Complete):**
- ✅ Resolve const/let declarations with string literals: `const base = 'px-4 py-2'` → extracts classes from variable
- ✅ Resolve object property access: `variants.primary` → extracts classes from object property value
- ✅ Handle conditional expressions in template literals: `${isActive ? 'bg-blue-500' : 'bg-gray-500'}` → extracts both branches
- **Coverage**: ~70-80% of common dynamic class patterns

**Phase 2 Implementation (Future Release):**
- Resolve object lookups with variables: `variants[variant]` → requires resolving index variable first
- Cross-file references: `import { baseClasses } from './styles'` → requires import resolution and cross-file analysis
- Function calls returning class strings: `getClasses('primary')` → requires function body analysis
- **Coverage**: Additional ~15-20% of edge cases
- **Estimated Effort**: 8+ hours

**Impact:** Dynamic class construction from variables results in incomplete style metadata. Phase 1 addresses the most common patterns, Phase 2 will handle advanced edge cases.

**Related:** See [docs/limitations.md](docs/limitations.md#dynamic-class-parsing) for detailed code evidence and implementation phases.

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
**Status:** 🟡 Phase 1 Complete, Phase 2 Pending

Include package names, versions, and prop types for third-party components.

**Current Behavior:**
- ✅ Basic "missing" info for unresolved dependencies
- ✅ Package names extracted from import statements (Phase 1)
- ✅ Version info from `package.json` (Phase 1)
- ❌ No prop type information (Phase 2)

**Phase 1 Implementation (Complete):**
- ✅ Extract package names from import statements (handles scoped packages, subpath imports)
- ✅ Include version info from `package.json` (checks dependencies, devDependencies, peerDependencies)
- ✅ Caching for efficient package.json reads
- ✅ Graceful handling of missing package.json or packages

**Phase 2 Implementation (Planned):**
- Extract prop types from TypeScript declaration files (`.d.ts`) in `node_modules`
- Handle different package structures and re-exports
- Support generic types and type aliases
- Fallback gracefully when type definitions are missing or incomplete

**Impact:** Phase 1 provides immediate value with package names and versions. Phase 2 will add prop type information for better understanding of external component APIs.

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

#### 1. Backend Framework Support
**Status:** ✅ **Complete in v0.4.0**

Backend framework support has been fully implemented! LogicStamp Context now extracts API routes, HTTP methods, request/response types, and framework-specific metadata for Node.js backend frameworks.

**What Works (v0.4.0):**
- ✅ Framework detection (Express.js, NestJS)
- ✅ Route path extraction (`/api/users`, `/users/:id`)
- ✅ HTTP method detection (GET, POST, PUT, DELETE, PATCH, ALL)
- ✅ Framework-specific metadata (Express routes, NestJS controllers)
- ✅ API signature extraction (request/response types, parameters)
- ✅ Route parameter detection (e.g., `/users/:id` → `params: ['id']`)
- ✅ Controller class detection and base path extraction (NestJS)
- ✅ Language-specific metadata (decorators, annotations, class names)
- ✅ New contract kind: `node:api` for backend API routes/handlers

**Supported Frameworks:**
- **Express.js** - Route extraction from `app.get()`, `router.post()`, etc.
- **NestJS** - Controller extraction with decorators (`@Controller`, `@Get`, `@Post`, etc.)

**Future Frameworks:**
- Fastify, Koa, Hapi (Phase 2+)

**Impact:** AI assistants can now understand backend API structure, endpoints, and request/response contracts. Backend files are automatically detected and skip frontend extraction, optimizing performance and accuracy.

---

#### 2. JavaScript & JSX Support
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

#### 4. Complete Vue.js Support
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

#### 5. Svelte Support
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

#### 6. Python Support
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

#### 7. Java Support
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

### Developer Experience
- **Integration examples** - Examples for popular AI assistants (Cursor, Claude Desktop, GitHub Copilot Chat)
- **Advanced debugging tools** - Better diagnostics and troubleshooting capabilities

---

## Known Limitations

For a complete list of current limitations with code evidence and detailed explanations, see [docs/limitations.md](docs/limitations.md).

### Summary of Current Limitations

**Active Accuracy Issues:**
- 🟡 Dynamic class expressions partially resolved (Phase 1 complete in v0.3.9, Phase 2 planned for advanced patterns)

**Active Coverage Gaps:**
- ❌ TypeScript types incomplete (generics, complex unions/intersections)
- ❌ CSS-in-JS support incomplete (Chakra UI, Ant Design missing)
- ⚠️ Third-party component prop types missing (package names and versions included in v0.3.8)
- ❌ Project-level insights missing (cross-folder relationships, project-wide statistics)
- ⚠️ Comments only in header mode (JSDoc only)
- ⚠️ Test files excluded (by design)

**Overall Assessment:**
- **~95%** - Component Contracts (Props, state, hooks detection) ✅ Hook parameters now included
- **~100%** - Imports Detection (Imports tracked correctly)
- **~85-90%** - Style Metadata (Static classes ~100%, dynamic classes Phase 1 complete ~70-80% of patterns, CSS-in-JS 7/9 major libraries supported)

---

## Contributing

We welcome contributions! If you'd like to work on any of these roadmap items:

1. Check [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines
2. Open an issue to discuss your approach
3. Submit a pull request with your implementation

**Priority Areas for Contributors:**

**Bug Fixes:**
- Dynamic class parsing - Phase 1 complete (v0.3.9), Phase 2 planned for advanced patterns
- CSS-in-JS library support - Add Chakra UI and Ant Design support
- Enhanced third-party component info (Phase 2) - Include prop types (package names and versions completed in v0.3.8)

**Framework Expansion:**
- ✅ Backend framework support - Extract API routes, HTTP methods, and framework metadata (Express, NestJS) (v0.4.0)
- JavaScript & JSX support - Add `.js`/`.jsx` file analysis
- Complete Vue.js support - Add `.vue` SFC file parsing
- Watch mode - Automatic context regeneration on file changes

---

## Version History

For detailed release notes and changes, see [CHANGELOG.md](CHANGELOG.md).

**Current Version:** v0.4.0 (Beta)

**Status:** Actively developed - we're working on improving accuracy and expanding feature coverage based on user feedback.

---

## Feedback

Have suggestions for the roadmap? We'd love to hear from you:

- **Open an issue** → https://github.com/LogicStamp/logicstamp-context/issues
- **Join our roadmap** → https://logicstamp.dev

