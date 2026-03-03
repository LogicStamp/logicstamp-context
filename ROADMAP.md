# LogicStamp Context Roadmap

This roadmap outlines the planned features, improvements, and known limitations for LogicStamp Context. It's organized into bug fixes, framework expansion, and future enhancements.

## Current Status

**Current Version:** v0.7.0 (Beta)

For detailed release notes and completed features, see [CHANGELOG.md](CHANGELOG.md).

Recent major milestones include:
- ✅ Lean style mode default (v0.7.0)
- ✅ Runtime schema validation and security hardening (v0.6.0)
- ✅ Strict watch mode for breaking change detection (v0.5.0)
- ✅ Watch mode with incremental rebuilds (v0.4.1)
- ✅ Backend framework support (Express.js, NestJS) (v0.4.0)
- ✅ Complete CSS-in-JS library support (v0.5.1)

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
**Status:** ✅ **Complete in v0.5.1**

Complete support for all major CSS-in-JS libraries.

**Currently Supported:**
- ✅ styled-components
- ✅ Emotion (@emotion/styled)
- ✅ Material UI (@mui/material)
- ✅ ShadCN/UI
- ✅ Radix UI
- ✅ Framer Motion
- ✅ Styled JSX
- ✅ Chakra UI ✅ **v0.5.1**
- ✅ Ant Design ✅ **v0.5.1**

**Impact:** All major CSS-in-JS libraries are now supported. Complete coverage for popular component libraries.

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
- ✅ Test files explicitly excluded from context compilation
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

### Near-Term

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
**Status:** ✅ **Complete (v0.4.1)**

Automatic context regeneration when source files change.

**What Works (v0.4.1):**
- `stamp context --watch` command
- File system watcher for `.ts`, `.tsx` files (and `.css`, `.scss` with `--include-style`)
- Incremental updates (only regenerates affected bundles)
- Debouncing (500ms) to batch multiple file changes
- Change detection showing what changed (props, hooks, state, events, components, functions)
- Debug mode (`--debug`) showing hash changes
- Status file (`.logicstamp/context_watch-status.json`) for tooling integration (always enabled)
- Log file (`--log-file`) for structured change logs (`.logicstamp/context_watch-mode-logs.json`) - opt-in for change notifications
- `watch-fast` profile for lighter style extraction

**Impact:** Improves developer experience by automatically keeping context files in sync with code changes.

**Priority:** ~~Medium~~ Complete

---

### Future

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
**Status:** 🔴 Planned for v0.9.x

Add support for Python codebases (experimental).

**Prerequisites:**
- ✅ Conditional schema by language (v0.8.x development, v0.9.x stabilization)
- ✅ JS/JSX support (for multi-language feedback)

**Planned Implementation:**
- Parse Python AST using `ast` module
- Extract function signatures, classes, and modules
- Extract type hints and docstrings
- Support popular frameworks (FastAPI, Django, Flask)
- Generate Python-specific contracts with `python:function` or `python:class` kind
- Use `languageSpecific.decorators` for framework decorators (e.g., `@app.get`, `@app.post`)

**Impact:** Expands LogicStamp Context beyond JavaScript/TypeScript ecosystems.

**Priority:** Medium (Targeted for v0.9.x release candidate, depends on conditional schema stabilization)

---

#### 7. Java Support
**Status:** 🔴 Planned for v0.9.x

Add support for Java codebases (experimental).

**Prerequisites:**
- ✅ Conditional schema by language (v0.8.x development, v0.9.x stabilization)
- ✅ JS/JSX support (for multi-language feedback)

**Planned Implementation:**
- Parse Java source files
- Extract class definitions, methods, and interfaces
- Extract annotations and Javadoc
- Support Spring Boot and other popular frameworks
- Generate Java-specific contracts with `java:class` kind
- Use `languageSpecific.annotations` for framework annotations (e.g., `@RestController`, `@GetMapping`)
- Use `languageSpecific.classes` and `languageSpecific.methods` for class/method extraction

**Impact:** Expands LogicStamp Context to enterprise Java codebases.

**Priority:** Medium (Targeted for v0.9.x release candidate, depends on conditional schema stabilization)

---

## Future Enhancements

These are longer-term features and improvements planned for future releases.

### Comparison & Drift Detection

#### Git Baseline for Compare
**Status:** 🔴 Not Started

Add git-based baseline support for context comparison, enabling meaningful drift detection against known reference points.

**Current Behavior:**
- ✅ Watch mode compares against previous state (rolling baseline)
- ✅ `stamp context compare` compares disk files vs freshly generated
- ❌ No git baseline support

**Why This Is Non-Trivial:**
Context files are gitignored by design - they don't exist in git history. So git baseline can't simply "checkout context files from a ref". Instead, it must:
1. Generate context from source code at the current state
2. Generate context from source code at the baseline git ref
3. Compare the two generated contexts

**Planned Implementation:**
- `--baseline git:HEAD` - Compare against last commit
- `--baseline git:main` - Compare against main branch
- `--baseline git:<ref>` - Compare against any git ref (branch, tag, commit)

**Under the hood:**
```
stamp context compare --baseline git:main

1. Generate context for current working tree → temp/current/
2. Create git worktree at ref (or stash + checkout)
3. Generate context for baseline ref → temp/baseline/
4. Restore working directory
5. Compare temp/baseline/ vs temp/current/
6. Report drift/violations
7. Cleanup temp directories
```

**Implementation Considerations:**
- Use `git worktree` for clean isolation (avoids disrupting working directory)
- Fallback to stash/checkout if worktrees unavailable
- Cache baseline context if ref hasn't changed (optimization)
- Handle uncommitted changes gracefully

**Use Cases:**
- PR review: "What changed in this branch vs main?"
- CI integration: "Did this PR introduce breaking changes?"
- Pre-commit: "Am I about to push breaking changes?"
- Release validation: "What changed since last release tag?"

**Enables:**
- `--fail-on-breaking` flag for `stamp context compare` (exit non-zero on breaking changes)

**Note:** Can't use `--strict` as it already exists for missing dependency checking. No need for a `--no-fail` flag - without `--fail-on-breaking`, compare just shows drift without breaking change detection.
- Meaningful CI integration for contract drift detection

**Impact:** Enables meaningful drift detection against stable reference points. This is the prerequisite for CI-friendly strict mode.

**Priority:** High

---

### Schema & Architecture

#### Conditional Schema by Language
**Status:** 🔴 Planned for v0.8.x

Make the UIFContract schema conditional based on the `kind` field, ensuring that language-specific fields are only present when relevant and properly validated.

**Current Behavior:**
- ✅ Flat schema with all fields optional or empty by default
- ✅ Works for all languages (React, Vue, Backend) but allows invalid combinations
- ⚠️ No validation that `style` shouldn't exist on backend contracts
- ⚠️ No validation that `hooks` should be empty for backend contracts
- ⚠️ No validation that `apiSignature` is required for backend contracts

**Why This Matters:**
The current schema is language-agnostic but allows invalid field combinations. For example, a `node:api` contract could theoretically have `style` metadata or `hooks`, which doesn't make sense. While the tool doesn't generate these invalid combinations, the schema doesn't enforce correctness.

**Planned Implementation (v0.8.x):**

**1. TypeScript Discriminated Unions:**
```typescript
// React-specific contract
type ReactUIFContract = BaseUIFContract & {
  kind: 'react:component' | 'react:hook';
  composition: {
    hooks: string[];  // Required for React
    components: string[];  // Required for React
    // ...
  };
  interface: {
    props: Record<string, PropType>;  // Required for React
    emits: Record<string, EventType>;  // Required for React
    // ...
  };
  style?: StyleMetadata;  // Only for frontend
  nextjs?: NextJSMetadata;  // Only for Next.js
};

// Backend API contract
type BackendUIFContract = BaseUIFContract & {
  kind: 'node:api' | 'python:function' | 'java:class';
  composition: {
    hooks: [];  // Must be empty for backend
    components: [];  // Must be empty for backend
    languageSpecific?: LanguageSpecificVersion;  // Required for Python/Java
    // ...
  };
  interface: {
    props: {};  // Must be empty for backend
    emits: {};  // Must be empty for backend
    apiSignature: ApiSignature;  // Required for backend
  };
  // No style, no nextjs
};

// Union type
export type UIFContract = ReactUIFContract | BackendUIFContract | VueUIFContract | ...;
```

**2. JSON Schema Conditional Validation:**
- Use `if/then/else` or `oneOf` patterns based on `kind` pattern matching
- Enforce that `style` only exists for frontend contracts (`react:*`, `vue:*`)
- Enforce that `nextjs` only exists for React contracts
- Enforce that `apiSignature` is required for backend contracts (`node:*`, `python:*`, `java:*`)
- Enforce that `hooks` and `components` are empty arrays for backend contracts
- Enforce that `props` and `emits` are empty objects for backend contracts

**3. Runtime Validation:**
- Update validation logic to check field combinations based on `kind`
- Provide clear error messages for invalid combinations
- Add warnings during contract building for invalid field usage

**4. Backward Compatibility:**
- Provide migration guide for existing contracts
- Support reading old flat schema format (with warnings)
- Auto-migrate contracts when possible (add defaults, remove invalid fields)

**Why v0.8.x:**
- **Breaking change** - Schema structure changes require migration, better to do in minor version series
- **Prerequisite for Python/Java** - Conditional schema must be in place before adding Python and Java support in v1.0.0
- **Better timing** - After gathering feedback from multi-language usage (JS/JSX support)
- **Iterative development** - v0.8.x allows for multiple releases to refine and stabilize the schema
- **Migration support** - Can provide proper migration tooling and documentation across v0.8.x releases

**Dependencies:**
- Must be completed before Python/Java support (v1.0.0)
- JS/JSX support should be completed first to gather multi-language feedback

**Implementation Timeline:**
- **v0.8.x:** Conditional schema development, testing, and refinement with migration support
- **v0.9.x:** Schema stabilization and finalization + Python/Java support (release candidate phase)
- **v1.0.0:** Stable release with multi-language support fully tested and validated

**Impact:**
- **Type Safety:** Better TypeScript type checking prevents invalid contracts at compile time
- **Validation:** JSON Schema validation catches invalid field combinations
- **Clarity:** Clearer contract structure makes it obvious what fields are valid for each language
- **Future-proofing:** Easier to add new languages with their own field requirements
- **Enables Python/Java:** Required foundation for adding Python and Java support

**Priority:** High (Planned for v0.8.x, prerequisite for Python/Java support in v0.9.x)

**Note:** Conditional schema is planned for v0.8.x development series, with stabilization in v0.9.x release candidate phase. Python and Java support will be added in v0.9.x to allow testing alongside the schema before the stable v1.0.0 release.

---

### Performance & Optimization
- ✅ **Incremental bundle caching** - Only regenerate changed bundles (implemented in watch mode v0.4.1)
- **Output size optimization** - Further reduce token counts while maintaining accuracy
- **Style metadata verbosity reduction** - Reduce style extraction verbosity for nested components (depth >= 1) when using `depth=2`:
  - **Default behavior (less verbose)**: For nested components, reduce Tailwind classes (15 → 5 per category), component library lists (20-30 → 5-10), remove SCSS/CSS details (selectors/properties), simplify layout/visual metadata
  - **Full extraction preserved**: Entry components (depth 0) always get full extraction; use `--full-style` flag to restore current behavior (full extraction for all components)
  - **Impact**: ~30-40% reduction in style metadata tokens with depth=2, while maintaining full detail for entry components
  - **Backward compatible**: Existing context files remain valid; old behavior available via `--full-style` flag
  - **Status**: 🔴 Planned

### Configuration & Extensibility
- **Custom profile configuration and overrides** - User-defined profiles beyond preset options
- **Additional output formats** - More format options for different AI workflow patterns

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
- ⚠️ Third-party component prop types missing (package names and versions included in v0.3.8)
- ❌ Project-level insights missing (cross-folder relationships, project-wide statistics)
- ⚠️ Comments only in header mode (JSDoc only)
- ⚠️ Test files excluded (by design)

**Overall Assessment:**
- **~95%** - Component Contracts (Props, state, hooks detection) ✅ Hook parameters now included
- **~100%** - Imports Detection (Imports tracked correctly)
- **~90-95%** - Style Metadata (Static classes ~100%, dynamic classes Phase 1 complete ~70-80% of patterns, CSS-in-JS 9/9 major libraries supported ✅ v0.5.1)

---

## Contributing

We welcome contributions! If you'd like to work on any of these roadmap items:

1. Check [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines
2. Open an issue to discuss your approach
3. Submit a pull request with your implementation

**Priority Areas for Contributors:**

**Bug Fixes:**
- Dynamic class parsing - Phase 1 complete (v0.3.9), Phase 2 planned for advanced patterns
- ✅ CSS-in-JS library support - Chakra UI and Ant Design support added (v0.5.1)
- Enhanced third-party component info (Phase 2) - Include prop types (package names and versions completed in v0.3.8)

**Framework Expansion:**
- ✅ Backend framework support - Extract API routes, HTTP methods, and framework metadata (Express, NestJS) (v0.4.0)
- JavaScript & JSX support - Add `.js`/`.jsx` file analysis
- Complete Vue.js support - Add `.vue` SFC file parsing
- ✅ Watch mode - Automatic context regeneration on file changes (v0.4.1)

---

## Feedback

Have suggestions for the roadmap? We'd love to hear from you:

- **Open an issue** → https://github.com/LogicStamp/logicstamp-context/issues
- **Join our roadmap** → https://logicstamp.dev/roadmap

