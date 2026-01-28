# Changelog

All notable changes to `logicstamp-context` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.5.0] - 2026-01-28

### Added

- **Strict watch mode** (`--strict-watch`) - Track breaking changes and violations during watch mode:
  - **Violation detection** - Automatically detects breaking changes when files are modified:
    - Removed props, events, state, functions, or variables (errors)
    - Changed prop types (warnings)
    - Removed contracts (errors)
    - Missing dependencies (warnings)
  - **Real-time reporting** - Displays violations immediately after each regeneration
  - **Cumulative tracking** - Tracks violations across the entire watch session with running totals
  - **Session summary** - Shows final violation count when exiting watch mode
  - **Violations report** - Writes structured JSON report to `.logicstamp/strict_watch_violations.json`
  - **CI-friendly exit codes** - Exits with code 1 if errors detected during session (on Ctrl+C)
  - **New violation types**: `missing_dependency`, `breaking_change_prop_removed`, `breaking_change_prop_type`, `breaking_change_event_removed`, `breaking_change_state_removed`, `breaking_change_function_removed`, `breaking_change_variable_removed`, `contract_removed`

### Changed

- **BREAKING: `MissingDependency.version` → `packageVersion`** - Renamed field in `MissingDependency` for clarity:
  - Old: `{ name, reason, packageName, version }`
  - New: `{ name, reason, packageName, packageVersion }`
  - Rationale: Avoids confusion with `UIFContract.version` (component composition). Now pairs naturally with `packageName`.
  - Migration: Update any code parsing `meta.missing[].version` to use `meta.missing[].packageVersion`

- **BREAKING: `UIFContract.version` → `composition`** - Renamed to accurately describe the field's purpose:
  - Old: `version: { variables, hooks, components, functions }`
  - New: `composition: { variables, hooks, components, functions }`
  - Rationale: This field describes structural composition (what a component is built from), not a version number. The old name was consistently confusing.
  - Migration: Update any code accessing `contract.version` to use `contract.composition`

- **BREAKING: `UIFContract.logicSignature` → `interface`** - Renamed for clarity:
  - Old: `logicSignature: { props, emits, state, apiSignature }`
  - New: `interface: { props, emits, state, apiSignature }`
  - Rationale: "interface" is a well-understood concept describing the external API/contract. Pairs naturally with `composition` (internal structure vs external interface).
  - Migration: Update any code accessing `contract.logicSignature` to use `contract.interface`

### Fixed

- **Documentation: `events` → `emits`** - Fixed inconsistency in `docs/schema.md` and `docs/uif_contracts.md` where examples showed `events` but the actual schema uses `emits`. Documentation now matches the schema and implementation.

- **Watch mode race condition** - Fixed potential race condition where concurrent file changes could trigger overlapping regenerations. Now uses Promise-based locking to ensure only one regeneration runs at a time, with queued changes processed after completion.

- **Silent error swallowing in compare handler** - Empty `catch {}` block in `compareHandler.ts` now properly logs cleanup errors using `debugError()` instead of silently ignoring them.

### Improved

- **O(1) dependency collection lookups** - Replaced O(n) linear search through manifest components with O(1) Map-based index lookup. Significantly improves performance for large projects during context generation.

- **O(1) missing dependency tracking** - Replaced O(n) array search for duplicate detection with O(1) Set-based lookup in `collectDependencies()`.

**⚠️ Breaking changes in this release:**
- `MissingDependency.version` → `packageVersion` - Field renamed ✅
- `UIFContract.version` → `composition` - Field renamed ✅
- `UIFContract.logicSignature` → `interface` - Field renamed ✅

**Migration required:** Any code parsing context bundles that accesses these fields must be updated. Schema version bumped to reflect breaking changes.

**Non-breaking additions:**
- `--strict-watch` is a new optional flag - existing watch mode behavior unchanged
- Race condition fix is internal - external behavior improves but API unchanged
- Performance optimizations are internal - same output, faster execution
- New types (`Violation`, `ViolationType`, `StrictWatchStatus`) are additive exports

### Roadmap (not yet implemented)

For a comprehensive roadmap with detailed status, priorities, and implementation plans, see [ROADMAP.md](ROADMAP.md).

**Next up (0.6.0):**

- **Git baseline for compare** - Compare current context against a git ref (`git:HEAD`, `git:main`, etc.):
  - Generates context from source at both current state and baseline ref (context files are gitignored, so must generate at both points)
  - Uses git worktree for clean isolation
  - Enables meaningful drift detection against known reference points
  - Use cases: PR reviews, CI integration, pre-commit checks, release validation

- **Breaking change detection for compare** (`--fail-on-breaking`) - Fail on breaking changes (requires git baseline):
  - Detect breaking changes: removed props, removed events, removed contracts
  - Exit with non-zero code when violations detected
  - Designed for CI pipelines

**Other planned features:**
- CSS-in-JS support - Complete support for remaining libraries (Chakra UI, Ant Design)
- Enhanced third-party component info (Phase 2) - Include prop types for third-party components (package names and versions completed in v0.3.8)
- TypeScript type extraction - Capture full type definitions (generics, unions, intersections)
- Project-level insights - Add cross-folder relationships and project-wide statistics to `context_main.json`
- Vue Single File Component (`.vue`) support - Parse and analyze `.vue` SFC files
- Custom profile configuration and overrides
- Incremental bundle caching
- Output size optimization
- Additional output formats
- Integration examples for popular AI assistants
### Known Limitations

See [docs/limitations.md](docs/limitations.md) for complete details and code evidence.

- Dynamic class expressions partially resolved (Phase 1 complete in v0.3.9, Phase 2 planned for advanced patterns)
- TypeScript types incomplete (generics, complex unions/intersections)

---

## [0.4.1] - 2026-01-20

### Added

- **Watch mode** (`--watch`, `-w`) - Monitor your codebase for file changes and automatically regenerate context bundles:
  - **Incremental rebuilds** - Only rebuilds affected bundles, not the entire project
  - **Change detection** - Shows what changed (props, hooks, state, events, components, functions)
  - **Debouncing** - Waits 500ms after the last change before regenerating (batches rapid changes)
  - **Style file watching** - When using `--include-style`, also watches `.css`, `.scss`, `.module.css`, `.module.scss` files
  - **Debug mode** (`--debug`) - Shows detailed hash information (semantic, file, bundle hashes)
  - **Status file** - Writes `.logicstamp/context_watch-status.json` for tooling integration (always enabled)
  - **Log file** (`--log-file`) - Opt-in structured change logs to `.logicstamp/context_watch-mode-logs.json` (for change notifications, not required for basic tooling)
  - **Graceful shutdown** - Clean cleanup on Ctrl+C (closes watcher, deletes status file)
- **New `watch-fast` profile** - Lighter style extraction optimized for faster watch mode rebuilds
- **New programmatic API exports** for library consumers:
  - `validateBundles`, `multiFileValidate` - Validation utilities
  - `multiFileCompare` - Comparison utilities
  - `LogicStampIndex`, `FolderInfo` types - Index file types
  - `isWatchModeActive`, `readWatchStatus`, `readWatchLogs` - Watch mode status utilities

### Changed

- Refactored internal modules to use barrel exports (`pack/index.js`, `context/index.js`, etc.)
- Extracted watch mode diffing logic to `watchDiff.ts` (~490 lines) for better maintainability

### Fixed

- **Framework detection priority order** - Corrected detection priority to Backend > Vue > React > TypeScript module (#65)
  - Backend frameworks (Express/NestJS) are now correctly detected before Vue/React patterns
  - Fixed issue where files with mixed patterns could be incorrectly classified
  - Clarified that `ts:module` is the actual fallback (not React)

**Non-breaking change:** All changes are backward compatible:
- Watch mode is a new feature - existing CLI commands and workflows are unaffected
- The `--log-file` flag is opt-in - log files are only created when explicitly requested
- Framework detection fix corrects a bug - existing React/Vue/TypeScript projects continue to work unchanged
- All new CLI options (`--watch`, `--debug`, `--log-file`) are optional and additive
- No schema changes, no API changes, no configuration changes required

---

## [0.4.0] - 2026-01-18

### Added

- **Backend framework support** - Added comprehensive support for backend Node.js frameworks:
  - **Express.js support** - Extracts Express.js routes and API metadata:
    - Route extraction from `app.get()`, `app.post()`, `router.get()`, etc. patterns
    - HTTP method detection (GET, POST, PUT, DELETE, PATCH, ALL)
    - Route path extraction with parameter detection (e.g., `/users/:id` → `params: ['id']`)
    - Handler function name extraction (named functions and anonymous handlers)
    - API signature extraction (function parameters and return types)
  - **NestJS support** - Extracts NestJS controllers and API metadata:
    - Controller class detection via `@Controller()` decorator
    - Base path extraction from `@Controller('/path')` decorator arguments
    - Route method extraction from `@Get()`, `@Post()`, `@Put()`, `@Delete()`, `@Patch()` decorators
    - Route path extraction from decorator arguments
    - Method parameter and return type extraction
    - Decorator/annotation extraction for language-specific metadata
  - **Backend framework detection** - Automatically detects backend frameworks from imports and code patterns:
    - Express.js detection: checks for `express` imports and `app.get()`/`router.post()` patterns
    - NestJS detection: checks for `@nestjs` imports and `@Controller()`/`@Get()` decorator patterns
    - Framework detection runs early in extraction pipeline to skip frontend extraction for backend files
  - **Language-specific metadata** - Added support for language-specific extensions:
    - `LanguageSpecificVersion` interface for extensible language metadata
    - Decorator extraction (e.g., `['@app.get', '@app.post']` for Express patterns)
    - Annotation extraction (e.g., `['@Controller', '@Get', '@Post']` for NestJS)
    - Class name extraction (e.g., `['UserController', 'UserService']`)
    - Method extraction for languages where methods differ from functions
    - Stored in `version.languageSpecific` field in contracts
  - **API signature extraction** - New `ApiSignature` interface for backend API contracts:
    - `parameters`: Function/method parameters with types (e.g., `{ user_id: 'int', name: 'str' }`)
    - `returnType`: Return type extraction (e.g., `'User'`, `'List[User]'`, `'void'`)
    - `requestType`: Request body type for POST/PUT requests (e.g., `'CreateUserRequest'`)
    - `responseType`: Response type (e.g., `'UserResponse'`, `'List[UserResponse]'`)
    - Stored in `logicSignature.apiSignature` field in contracts
  - **New contract kind: `node:api`** - Backend API routes/handlers are classified as `node:api` kind
  - **Extensible contract kind pattern** - `ContractKind` now supports extensible `language:type` pattern (e.g., `'python:function'`, `'java:class'`, `'node:api'`) for future language support
  - **E2E tests for backend frameworks** - Added comprehensive end-to-end tests for Express.js and NestJS:
    - Express.js E2E tests (`tests/e2e/express.test.ts`) - Tests AST extraction, contract building, and dependency graphs for Express routes and controllers
    - NestJS E2E tests (`tests/e2e/nest.test.ts`) - Tests AST extraction, contract building, and dependency graphs for NestJS controllers and services
    - Express.js fixtures (`tests/fixtures/express-app/`) - Realistic Express app structure with routes, controllers, middleware, and types
    - NestJS fixtures (`tests/fixtures/nest-app/`) - Realistic NestJS app structure with controllers, services, modules, DTOs, guards, and decorators
    - Test coverage for route extraction, API signature extraction, framework detection, and dependency graph building
    - Tests follow the same pattern as existing Vue/React E2E tests for consistency

### Changed

- **Extractor architecture reorganization** - Reorganized extractors into framework-specific directories for better code organization:
  - **Style extractors** - Moved from `src/core/styleExtractor/` to `src/extractors/styling/`:
    - All 11 style extractor modules (Tailwind, Material UI, Radix UI, ShadCN, Styled Components, SCSS, etc.) moved to new location
    - Maintained backward compatibility via re-export in `src/core/styleExtractor.ts` (deprecated but still functional)
    - Updated CLI command imports to use new location
    - Improved tree-shaking support - import directly from `extractors/styling/` for better bundle optimization
  - **Public extractors** - New `src/extractors/` directory structure:
    - `extractors/react/` - React-specific extractors
    - `extractors/vue/` - Vue-specific extractors
    - `extractors/express/` - Express.js extractors
    - `extractors/nest/` - NestJS extractors
    - `extractors/styling/` - Style extractors
    - `extractors/shared/` - Shared utilities
  - Improved code organization and maintainability for multi-framework support
- **Conditional extraction logic** - Enhanced AST extraction to conditionally extract based on detected framework:
  - Backend files skip React/Vue extraction (hooks, components, props, state, emits remain empty)
  - Frontend files skip backend extraction (routes, controllers remain undefined)
  - Framework detection runs early to optimize extraction pipeline
- **Schema updates** - Enhanced context schema with backend support:
  - `ContractKind` changed from enum to pattern-based string (`^[a-z]+:[a-z-]+$`) for extensibility
  - Added `LanguageSpecificVersion` definition with decorators, annotations, classes, and methods fields
  - Added `ApiSignature` definition with parameters, returnType, requestType, and responseType fields
  - Updated field descriptions to clarify empty arrays/objects for non-frontend files (e.g., `hooks: []` for backend files, `props: {}` for backend files)
- **Function signature updates** - Updated `detectKind()` function signature:
  - Parameter order changed: `detectKind(hooks, components, imports, source, filePath, backendFramework?)`
  - Added optional `backendFramework` parameter for backend detection
  - Backend detection runs before Vue/React detection for priority

### Fixed

- **Hash calculation for backend files** - Fixed issue where backend API changes were not detected in semantic and signature hashes:
  - **Semantic hash** - Now includes backend metadata (routes, framework, controller, language-specific data) in hash calculation
  - **Signature hash** - Now includes `apiSignature` field in hash calculation
  - Backend route changes, API signature changes, and controller modifications now properly trigger hash updates
  - Ensures accurate change detection for backend files in context comparison and drift detection
  - Hash format unchanged (`uif:...` prefix) - only hash values change for backend files when regenerated

### Improved

- **Enhanced API signature extraction** - Significantly improved API signature extraction for backend files:
  - **Multi-route aggregation** - Now aggregates API signatures from all routes in a file instead of only using the first route
  - **Actual type extraction** - Extracts actual parameter types, return types, request types, and response types from handler functions instead of defaulting to `'string'`
  - **Per-route signature extraction** - Each route handler now has its API signature extracted during backend metadata extraction:
    - Express: Extracts types from named handler functions (skips anonymous handlers)
    - NestJS: Extracts types from controller method signatures
  - **Intelligent type aggregation** - When aggregating multiple routes:
    - Prefers extracted types over `'string'` defaults
    - Collects return types, request types (for POST/PUT/PATCH), and response types from all routes
    - Uses the most common type when all routes share the same type, otherwise uses the first
  - **Better accuracy** - API signatures are now much more accurate for multi-route files, providing complete parameter and type information for AI context analysis

- **Test coverage** - Updated test suite to reflect new function signatures and backend support:
  - Updated all `detectKind()` calls to match new parameter order
  - Tests now properly handle backend framework detection
- **Documentation** - Updated limitations documentation to reflect backend support capabilities

**Impact:** This release significantly expands LogicStamp Context beyond frontend frameworks to support backend Node.js frameworks (Express.js and NestJS). Backend API routes, controllers, and signatures are now extracted and included in context bundles, enabling AI assistants to understand full-stack codebases. The extensible contract kind pattern (`language:type`) and language-specific metadata support pave the way for future language support (Python, Java, etc.). Backend files are automatically detected and skip frontend extraction, optimizing performance and accuracy.

**Non-breaking change:** All changes are backward compatible and additive:
- New `node:api` contract kind is added - existing React/Vue/TypeScript files continue to work unchanged
- Backend extraction only runs when backend frameworks are detected - frontend-only projects are unaffected
- Schema changes are additive - new optional fields (`languageSpecific`, `apiSignature`) only appear when relevant
- Existing context files remain valid - all new fields are optional
- Contract kind pattern change maintains backward compatibility - existing enum values (`react:component`, `vue:component`, etc.) still work
- Extractor reorganization is internal - no API changes for consumers
- Hash calculation fixes only affect hash values (not format) - existing context files remain valid, regenerated files will have updated hashes for backend files

---

## [0.3.10] - 2026-01-17

### Added

- **Advanced Next.js App Router features** - Enhanced Next.js metadata extraction with route roles, segment paths, and metadata exports:
  - **Route role detection** - Automatically detects Next.js route roles based on special filenames:
    - `page.tsx` → `routeRole: 'page'`
    - `layout.tsx` → `routeRole: 'layout'`
    - `loading.tsx` → `routeRole: 'loading'`
    - `error.tsx` → `routeRole: 'error'`
    - `not-found.tsx` → `routeRole: 'not-found'`
    - `template.tsx` → `routeRole: 'template'`
    - `default.tsx` → `routeRole: 'default'`
    - `route.ts` → `routeRole: 'route'` (API route handlers)
  - **Segment path extraction** - Extracts route paths from file structure:
    - Converts file paths to route segments (e.g., `app/blog/[slug]/page.tsx` → `/blog/[slug]`)
    - Automatically removes route groups (parentheses) from paths
    - Supports both `app/` and `src/app/` directory structures
    - Handles root routes, nested routes, dynamic segments, and API routes
  - **Metadata export extraction** - Extracts Next.js metadata exports:
    - **Static metadata** - Parses `export const metadata = {...}` object literals:
      - Extracts property names and values (strings, numbers, booleans, null)
      - Supports basic value types from object literals
    - **Dynamic metadata** - Detects `export function generateMetadata() {...}` functions
    - Supports both static and dynamic metadata in the same file

### Changed

- **NextJSMetadata interface** - Extended `NextJSMetadata` type with new optional fields:
  - `routeRole?: 'page' | 'layout' | 'loading' | 'error' | 'not-found' | 'template' | 'default' | 'route'`
  - `segmentPath?: string` - Route path derived from file structure
  - `metadata?: { static?: Record<string, unknown>, dynamic?: boolean }` - Metadata exports

### Improved

- **Next.js documentation** - Updated `docs/frameworks/nextjs.md` with comprehensive examples:
  - Route roles table with all supported roles
  - Segment path examples for various route patterns
  - Metadata extraction examples (static, dynamic, combined)
  - Updated component examples to show new metadata fields

**Impact:** This release significantly enhances Next.js App Router support by extracting route roles, segment paths, and metadata exports. AI assistants can now better understand Next.js routing structure, identify route types, and access metadata information for improved code analysis and generation.

**Non-breaking change:** All changes are backward compatible and additive:
- New fields in `NextJSMetadata` are optional - existing code continues to work unchanged
- Only files in the `app/` directory (or `src/app/`) receive the new metadata fields
- Existing Next.js detection (directives, `isInAppDir`) remains unchanged

---

## [0.3.9] - 2026-01-17

### Added

- **Phase 1: Dynamic Tailwind class parsing** - Enhanced Tailwind CSS extractor to resolve dynamic class expressions within template literals:
  - **Variable resolution** - Resolves `const` and `let` variable declarations containing Tailwind classes:
    - Extracts classes from variables referenced in template literals: `` className={`${base} bg-blue-500`} ``
    - Handles nested variable references and scope shadowing (inner scope takes precedence)
    - Uses efficient caching to avoid repeated AST traversals
  - **Object property access** - Resolves object property access patterns:
    - Extracts classes from object properties: `` className={`px-4 ${variants.primary}`} ``
    - Handles nested object structures and property assignments
  - **Conditional expressions** - Resolves ternary and logical operator expressions:
    - Extracts classes from both branches of ternary expressions: `` className={`${isActive ? 'bg-blue-500' : 'bg-gray-500'}`} ``
    - Handles logical operators (`&&`, `||`, `??`) used for class toggling
    - Extracts from both sides of logical expressions for complete coverage
  - **Enhanced variant support** - Added support for additional Tailwind variants:
    - Focus variants: `focus-visible:`, `focus-within:`
    - Group/peer variants: `group-focus-visible:`, `peer-checked:`, `peer-disabled:`
    - ARIA variants: `aria-expanded:`, `aria-pressed:`, `aria-selected:`, `aria-hidden:`, `aria-disabled:`
    - Arbitrary selector variants: `[&>p]:`, `[&_span]:`, `supports-[...]:`, `has-[...]:`
    - Container query variants: `@sm:`, `@md:`, `@lg:`, `@custom:` (Tailwind v4+)
  - **Improved categorization patterns** - Enhanced Tailwind class categorization:
    - Expanded layout category to include flex/grid utilities: `flex-`, `grid-cols-`, `grid-rows-`, `col-`, `col-span-`, `row-`, `row-span-`, `items-`, `justify-`, `content-`, `self-`, `place-`, `order-`, `grow`, `shrink`, `basis-`
    - Improved color detection to distinguish color classes (`text-red-500`) from typography classes (`text-sm`, `text-left`)
    - Added support for `rounded` without dash (e.g., `rounded` and `rounded-lg`)
    - Enhanced border category to include `ring-offset-` utilities
  - **Better template literal parsing** - Improved handling of template literals:
    - More robust extraction of literal segments after `${}` expressions
    - Filters out template syntax artifacts (`${`, `}`) from extracted classes
    - Handles edge cases with nested template expressions

### Changed

- **Tailwind extractor architecture** - Refactored `extractClassesFromExpression()` to support recursive variable resolution:
  - Function now accepts optional `sourceFile` parameter for variable resolution
  - Added `resolveVariableDeclaration()` helper with scope-aware variable lookup
  - Uses WeakMap caching for variable declarations to improve performance
  - Improved error handling and fallback behavior
- **Breakpoint extraction** - Enhanced breakpoint pattern matching to include container query variants (`@sm:`, `@md:`, etc.)

### Fixed

- **Dynamic expression handling** - Fixed issue where classes in dynamic template literal expressions were not extracted. Now correctly extracts classes from variables, object properties, and conditional expressions within template literals
- **Color vs typography classification** - Fixed incorrect categorization where color classes like `text-red-500` were being classified as typography. Now correctly distinguishes color classes from typography utilities
- **Logical operator extraction** - Fixed issue where only the right side of logical expressions (`&&`, `||`, `??`) was extracted. Now extracts from both sides for complete coverage
- **Template literal artifacts** - Fixed issue where template syntax artifacts (`${`, `}`) were sometimes included in extracted class lists

### Improved

- **Test coverage** - Added comprehensive test suite for Phase 1 dynamic class parsing:
  - Tests for variable resolution (const/let, nested variables, scope shadowing)
  - Tests for object property access and nested structures
  - Tests for conditional expressions (ternary, logical operators)
  - Tests for edge cases (! important prefix, arbitrary selectors, container queries)
  - Tests for improved categorization patterns (flex/grid utilities, rounded without dash)
  - Smoke tests for critical scenarios

**Impact:** This release significantly improves Tailwind CSS class extraction accuracy by resolving dynamic expressions that were previously ignored. Classes defined in variables, object properties, and conditional expressions are now properly extracted and categorized, providing more complete style metadata for AI context analysis. Phase 1 handles same-file variable resolution; Phase 2 (planned) will add support for cross-file references, dynamic object lookups (`variants[variant]`), and function calls.

**Non-breaking change:** All changes are backward compatible and additive:
- The `sourceFile` parameter in `extractClassesFromExpression()` is optional - existing code without it continues to work unchanged
- Falls back to regex-based extraction when AST is unavailable (maintains compatibility with string inputs)
- Enhanced extraction only adds more classes to the output - no existing classes are removed or changed
- Improved categorization fixes incorrect classifications but doesn't break existing category structures
- All API signatures remain compatible - no breaking changes to function parameters or return types
- Existing context files remain valid - schema changes are additive only

---

## [0.3.8] - 2026-01-15

### Added

- **LogicStamp woodmark** - Added LogicStamp woodmark asset (`logicstamp-woodmark.png`) to the project assets and integrated it into the README header
- **Enhanced third-party component info (Phase 1)** - Missing dependencies now include package names and versions for third-party packages:
  - **Package name extraction** - Automatically extracts package names from import specifiers:
    - Handles scoped packages (e.g., `@mui/material` from `@mui/material/Button`)
    - Handles subpath imports (e.g., `lodash` from `lodash/debounce`)
    - Distinguishes third-party packages from relative imports
  - **Version lookup** - Reads versions from `package.json`:
    - Checks `dependencies`, `devDependencies`, and `peerDependencies`
    - Prioritizes `dependencies` over `devDependencies`
    - Caches `package.json` reads for efficiency
    - Gracefully handles missing `package.json` or packages
  - **Schema updates** - Added optional `packageName` and `version` fields to `MissingDependency` type in context schema

**Example:**

**Before:**
```json
{
  "name": "@mui/material",
  "reason": "external package",
  "referencedBy": "src/components/Dashboard.tsx"
}
```

**After:**
```json
{
  "name": "@mui/material",
  "reason": "external package",
  "referencedBy": "src/components/Dashboard.tsx",
  "packageName": "@mui/material",
  "version": "^5.15.0"
}
```

### Changed

- **`collectDependencies()` function** - Made async to support version lookups from `package.json`. Now accepts optional `projectRoot` parameter for package version resolution
- **Missing dependency tracking** - Enhanced to automatically populate `packageName` and `version` fields for third-party packages when `projectRoot` is provided

### Improved

- **Package detection** - Improved third-party package detection to handle edge cases (empty strings, invalid scoped packages, absolute paths)
- **Error handling** - Enhanced error handling for missing or invalid `package.json` files
- **Performance** - Added caching mechanism to avoid repeated `package.json` file reads

**Impact:** This release provides better visibility into external dependencies by including package names and versions in missing dependency information. This helps AI assistants understand which versions of third-party packages are being used in the project. The implementation is backward compatible - existing context files remain valid, and the new fields are optional. Phase 2 (prop type extraction) is planned for a future release.

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

## [0.1.1] - 2025-11-27

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

## [0.1.0] - 2025-11-27

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
[Unreleased]: https://github.com/LogicStamp/logicstamp-context/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.5.0
[0.4.1]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.4.1
[0.4.0]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.4.0
[0.3.10]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.3.10
[0.3.9]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.3.9
[0.3.8]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.3.8
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