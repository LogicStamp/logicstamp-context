# Known Limitations

Things that don't work perfectly yet. We're working on improving these areas.

## Overview

LogicStamp Context is pretty accurate overall—around 90% of the time it gets things right. Component structure, props, state, hooks, and imports are usually detected correctly, but there are a few areas where things can be incomplete or a bit off.

- **~95%** - Component Contracts (Props, state, hooks detection)
- **~100%** - Imports Detection (Imports tracked correctly)
- **~85-90%** - Style Metadata (Static classes ~100%, dynamic classes Phase 1 complete ~70-80% of patterns, CSS-in-JS 7/9 major libraries supported)

---

# Fixed/Resolved Limitations

These items have been implemented and are no longer limitations.

## Hook Parameter Detection

**Status:** ✅ **Fixed in v0.3.6**

Hook parameter detection is now fully implemented! We can extract function signatures for custom React hooks and include their parameters in the contract.

**What Works:**
- ✅ Extracts parameters from exported hook function declarations
- ✅ Extracts parameters from exported arrow function hooks
- ✅ Extracts parameters from default exported hooks
- ✅ Captures parameter types (from type annotations, default values, or TypeScript type checker)
- ✅ Handles optional parameters (with `?` or default values)
- ✅ Stores parameters in `logic.props` field for hooks
- ✅ Works even when Props interfaces exist in the same file
- ✅ Props take priority on conflicts

**Example**

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

## Hook Classification

**Status:** ✅ **Fixed in v0.3.1**

Custom hooks are now correctly classified as `react:hook` instead of `react:component`. The detection logic checks if the main export (default or named) is a function starting with "use" and has no JSX elements.

**Example**

**Source Code:**
```typescript
function useTypewriter(text: string, speed = 30) {
  const [displayedText, setDisplayedText] = useState('')
  // ... hook implementation
  return displayedText
}
```

**Context Output (Correct):**
```json
{
  "kind": "react:hook"
}
```

## Emit Detection Accuracy

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

**Example**

**Source Code:**
```typescript
function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  
  return (
    <button onClick={() => setMenuOpen(!menuOpen)}>
      Toggle Menu
    </button>
  );
}
```

**Context Output (Correct):**
```json
{
  "logic": {
    "emits": {}
  }
}
```

**Source Code (with Props):**
```typescript
interface ButtonProps {
  onClick?: () => void;
}

function Button({ onClick }: ButtonProps) {
  return <button onClick={onClick}>Click</button>;
}
```

**Context Output (Correct):**
```json
{
  "logic": {
    "emits": {
      "onClick": {
        "type": "function",
        "signature": "() => void"
      }
    }
  }
}
```

---

# Active Limitations

These are current limitations that still need to be addressed.

## Dynamic Class Parsing

**Issue**

Style extraction works great for static Tailwind classes and template literals. Static segments within template literals are extracted (e.g., `` className={`base static-class`} `` will extract `"base"` and `"static-class"`). However, dynamic expressions within `${}` are partially resolved (Phase 1) or not resolved (Phase 2).

**Phase 1 Status:** ✅ **Complete (v0.3.9)**

**What Works (Phase 1):**
- ✅ Const/let declarations: `const base = 'px-4 py-2'` → extracts `px-4`, `py-2`
- ✅ Object property access: `variants.primary` → extracts classes from property value
- ✅ Conditional expressions: `${isActive ? 'bg-blue-500' : 'bg-gray-500'}` → extracts both branches

**What Doesn't Work (Phase 2 - Future):**
- ❌ Object lookups with variables: `variants[variant]` → index variable not resolved
- ❌ Cross-file references: `import { baseClasses } from './styles'` → imports not analyzed
- ❌ Function calls: `getClasses('primary')` → function bodies not analyzed

**Example (Phase 1 - Works):**

**Source Code:**
```typescript
function Button({ variant }: { variant: 'primary' | 'secondary' }) {
  const base = 'px-4 py-2 rounded-lg font-semibold'
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900'
  }
  const isActive = true;
  
  return (
    <button className={`${base} ${variants.primary} ${isActive ? 'ring-2' : ''}`}>
      Click me
    </button>
  )
}
```

**Context Output (After Phase 1):**
```json
{
  "style": {
    "styleSources": {
      "tailwind": {
        "categories": {
          "spacing": ["px-4", "py-2"],
          "borders": ["rounded-lg"],
          "typography": ["font-semibold"],
          "colors": ["bg-blue-600", "hover:bg-blue-700", "text-white"],
          "effects": ["ring-2"]
        }
      }
    }
  }
}
```

**Example (Phase 2 - Still Doesn't Work):**

**Source Code:**
```typescript
function Button({ variant }: { variant: 'primary' | 'secondary' }) {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900'
  }
  
  return (
    <button className={`${variants[variant]}`}>
      Click me
    </button>
  )
}
```

**Context Output (After Phase 1):**
```json
{
  "style": {
    "styleSources": {
      "tailwind": {
        "categories": {}
      }
    }
  }
}
```

**Impact:** Phase 1 addresses ~70-80% of common dynamic class patterns. Phase 2 will handle advanced edge cases like object lookups with variables and cross-file references. If you build classes from variables using object lookups or imports, the style metadata will still be incomplete until Phase 2.

## Next.js Framework Limitations

**Status:** 🟡 **Partially Complete**

Next.js support includes basic detection of App Router patterns, directives, and directory structure, but many Next.js-specific features are not yet extracted.

**What Works:**
- ✅ `'use client'` and `'use server'` directive detection
- ✅ App Router directory detection (`isInAppDir: true` for files in `/app/` directory)
- ✅ Next.js import tracking (`next/link`, `next/image`, `next/navigation`, etc.)
- ✅ Basic component detection (pages, layouts, API routes as React components)
- ✅ **Route role detection** - Automatically detects route roles (`page`, `layout`, `loading`, `error`, `not-found`, `template`, `default`, `route`) ✅ **v0.3.10**
- ✅ **Segment path extraction** - Extracts route paths from file structure (e.g., `/blog/[slug]`) ✅ **v0.3.10**
- ✅ **Metadata export extraction** - Extracts static metadata (`export const metadata = {...}`) and detects dynamic metadata (`export function generateMetadata()`) ✅ **v0.3.10**

**What Doesn't Work:**
- ❌ Layout hierarchy: Parent-child layout relationships not extracted
- ❌ Data fetching patterns: `getServerSideProps`, `getStaticProps`, `getStaticPaths` return types not fully extracted
- ❌ Route handlers: API route handlers (`GET`, `POST`, etc.) detected but request/response types not extracted
- ❌ Loading/error boundaries: `loading.tsx` and `error.tsx` files detected but boundary relationships not extracted
- ❌ Middleware: Middleware files detected but not fully analyzed
- ❌ Dynamic imports: `next/dynamic` imports tracked but component resolution not analyzed
- ❌ Route groups: `(group)` route groups not distinguished from regular routes
- ❌ Parallel routes: `@slot` parallel routes not detected

**Example:**

**Source Code:**
```typescript
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  return [{ slug: 'post-1' }, { slug: 'post-2' }];
}

export const metadata = {
  title: 'Blog Post',
  description: 'A blog post'
};

export default function BlogPost({ params }: { params: { slug: string } }) {
  return <div>Post: {params.slug}</div>;
}
```

**Context Output (v0.3.10):**
```json
{
  "kind": "react:component",
  "nextjs": {
    "isInAppDir": true,
    "directive": undefined,
    "routeRole": "page",
    "segmentPath": "/blog/[slug]",
    "metadata": {
      "static": {
        "title": "Blog Post",
        "description": "A blog post"
      }
    }
  }
}
```

**Missing:**
- `generateStaticParams` function not extracted
- Dynamic route parameter (`params.slug`) type not extracted from route structure

**Impact:** Next.js projects are detected and route roles, segment paths, and metadata exports are now extracted (v0.3.10). However, data fetching patterns, layout hierarchy, and some advanced routing features are not yet extracted. This limits understanding of some Next.js-specific architecture patterns.

**Priority:** Medium

**Related:** See [docs/frameworks/nextjs.md](../frameworks/nextjs.md) for complete Next.js documentation and current feature coverage.

## Summary of Active Limitations

**What works really well:**
- ✅ Component structure and props
- ✅ State variables and hooks (including hook parameters)
- ✅ Import tracking
- ✅ Static style metadata
- ✅ Dependency graphs
- ✅ Inline style extraction (property names and values)
- ✅ Styled JSX CSS extraction

**Active areas for improvement:**
- 🟡 Dynamic style extraction (Phase 1 complete in v0.3.9, Phase 2 planned for advanced patterns)
- ❌ TypeScript type extraction (generics, complex unions/intersections)
- ❌ CSS-in-JS completeness (Chakra UI, Ant Design missing)
- ⚠️ Third-party component prop types (package names and versions now included in v0.3.8)
- ❌ Project-level insights (cross-folder relationships)
- 🟡 Next.js framework features (route roles, segment paths, and metadata exports now supported in v0.3.10; data fetching patterns still missing)
- ✅ Backend framework support (Express.js, NestJS) - Complete in v0.4.0

**Bottom line:** We're hitting around 90% accuracy overall. Solid foundation, but there's definitely room to improve. These issues are on our roadmap.

---

# Feature Completeness & Coverage

This section documents what's currently captured in context files versus what's missing or incomplete. This is separate from accuracy issues above—here we're tracking feature coverage, not detection correctness.

## What's Captured

### 1. Component Contracts (UIFContract)

- **Component kind**: `react:component`, `react:hook`, `vue:component`, `vue:composable`, `ts:module`, `node:cli`, `node:api` ✅ **v0.4.0**
- **Props**: Types and signatures
- **State variables**: With types
- **Hooks used**: Listed in `version.hooks`
- **Functions**: Signatures captured
- **Imports and dependencies**: Tracked
- **Exports**: Default/named exports
- **Next.js metadata**: Client directive, app dir detection

### 2. Style Metadata (when `--style` flag is used)

- **Tailwind classes**: Categorized by:
  - Borders, colors, effects, spacing, sizing
  - Layout (flex/grid), typography, transitions
  - Breakpoints detected (sm, md, lg, xl)
  - Class counts per component
- **CSS modules**: File paths and selectors/properties
- **Inline styles**: Property names and literal values extracted ✅ **v0.3.5**
- **Styled JSX**: CSS content, selectors, properties, global attribute ✅ **v0.3.5**
- **Layout patterns**: Flex vs grid, column configs
- **Visual metadata**: Color palettes, spacing patterns, typography scales
- **Animation metadata**: Library type, animation types

### 3. Project Structure

- **Folder hierarchy**: With `isRoot` flags
- **Token estimates**: Per folder/component
- **Bundle counts**: And positions
- **Component lists**: Per folder

### 4. Versioning and Hashing

- **Semantic hashes**: `uif:` prefixes
- **File hashes**: For change detection
- **Bundle hashes**: `uifb:` prefixes
- **Schema versioning**: Tracked

### 5. Metadata

- **Created timestamps**: When context was generated
- **OS detection**: Platform info (e.g., `win32`)
- **Source tool version**: `logicstamp-context@0.4.1`
- **Missing dependencies**: Tracked in `missing` array

## What's Missing or Incomplete

### 1. Dynamic Class Parsing

**Status:** ✅ **Phase 1 Complete** (v0.3.9), 🟡 Phase 2 Planned

The `extractClassesFromExpression()` function in `src/extractors/styling/tailwind.ts` now resolves Phase 1 dynamic expressions (variables, object properties, conditionals) within template literals. Phase 2 (object lookups with variables, cross-file references, function calls) is planned for a future release.

**Location**: `src/extractors/styling/tailwind.ts` (lines 135-210)

**Impact**: Phase 1 handles ~70-80% of common dynamic class patterns. Phase 2 will handle advanced edge cases like object lookups with variables (`variants[variant]`), cross-file references, and function calls.

**Priority**: High (Phase 1 complete), Medium (Phase 2)

**Implementation Phases:**

**Phase 1 (v0.3.9 - ✅ Complete):**
- ✅ Resolve const/let declarations with string literals: `const base = 'px-4 py-2'` → extracts `px-4`, `py-2`
- ✅ Resolve object property access: `variants.primary` → extracts classes from object property value
- ✅ Handle conditional expressions in template literals: `${isActive ? 'bg-blue-500' : 'bg-gray-500'}` → extracts both branches
- **Coverage**: ~70-80% of common dynamic class patterns

**Phase 2 (Future Release):**
- ❌ Object lookups with variables: `variants[variant]` → requires resolving index variable first
- ❌ Cross-file references: `import { baseClasses } from './styles'` → requires import resolution
- ❌ Function calls returning class strings: `getClasses('primary')` → requires function body analysis
- **Coverage**: Additional ~15-20% of edge cases

**Current Limitations After Phase 1:**
- Object lookups with dynamic keys (`variants[variant]`) are not resolved
- Classes imported from other files are not resolved
- Function calls that return class strings are not analyzed
- Complex nested expressions may not be fully resolved

### 2. CSS-in-JS Partially Supported

**Supported**: 
- styled-components (component names, theme usage, css prop)
- Emotion (@emotion/styled)
- Material UI (@mui/material) - components, packages, features
- ShadCN/UI - components, variants, sizes
- Radix UI - primitives, patterns, accessibility
- Framer Motion - components, variants, animation features
- Styled JSX - CSS content extraction, selectors, properties, global attribute detection ✅ **v0.3.5**

**Missing/Incomplete**: 
- Chakra UI - not yet detected (no code found)
- Ant Design - not yet detected (no code found)

**Impact**: Most major CSS-in-JS libraries are supported. Remaining gaps are primarily for smaller/less common libraries.

**Priority**: Medium

### 3. Third-Party Components Minimal Info

**Status:** ⚠️ **Partially resolved - Phase 1 complete, Phase 2 pending**

**Issue**: Third-party components now include package names and versions (Phase 1 - ✅ Fixed in v0.3.8), but prop types are still missing (Phase 2 - ❌ Still unresolved).

**What Works (Phase 1 - v0.3.8):**
- ✅ Package name extraction from import specifiers (handles scoped packages, subpath imports)
- ✅ Version lookup from `package.json` (checks dependencies, devDependencies, peerDependencies)
- ✅ Package name and version fields added to missing dependency objects

**Example (After v0.3.8):**
```json
"missing": [
  {
    "name": "@mui/material",
    "reason": "external package",
    "referencedBy": "src/components/Dashboard.tsx",
    "packageName": "@mui/material",
    "version": "^5.15.0"
  }
]
```

**Still Missing (Phase 2):**
- ❌ Prop types for third-party components
- ❌ Component API signatures from third-party packages

**Impact**: Better understanding of external dependencies (package names and versions), but still limited API information for third-party components.

**Location**: 
- Phase 1 implementation: `src/core/pack/collector.ts` - Package name extraction and version lookup
- Phase 2 (pending): Prop type extraction from third-party packages

**Note on Missing Dependency Reasons**: The codebase uses two different reason strings for missing dependencies:
- `"No contract found (third-party or not scanned)"` - Used when a dependency cannot be resolved (third-party components, external packages, or dependencies outside the scan path)
- `"Component not found in manifest"` - Used when the entryId itself is not found in the manifest (typically for the root component being processed)

**Priority**: Medium (Phase 1 complete, Phase 2 pending)

### 4. TypeScript Types Incomplete

**Status:** ❌ **Partially resolved - still incomplete**

**Location**: `src/core/astParser/extractors/propTypeNormalizer.ts` (`normalizePropType()` function)

**Verified Implementation**:
- ✅ Captures prop types as strings (`"string"`, `"number"`)
- ✅ Captures literal unions via regex: `"primary" | "secondary"` → `{ type: 'literal-union', literals: ['primary', 'secondary'] }`
- ✅ Captures function types: `() => void` → `{ type: 'function', signature: '() => void' }`
- ❌ Does NOT handle generics (e.g., `ListProps<T>`)
- ❌ Does NOT handle complex unions/intersections (e.g., `A & B`, `A | B | C` where not string literals)
- ❌ Does NOT extract generic type parameters

**Code Evidence** (v0.3.6): `normalizePropType()` in `propTypeNormalizer.ts` only has regex for literal unions and function detection. No AST-based type analysis for generics or complex types.

**Impact**: Limited type information for complex types

**Priority**: Medium

### 5. Context main.json Limitations

**Status:** ❌ **Still unresolved**

**Location**: `src/cli/commands/context/fileWriter.ts` (lines 206-285)

**Missing**: Cross-folder relationships, project-wide statistics

**Only**: Folder index with token estimates

**Impact**: Limited project-level insights

**Priority**: Medium

### 6. Code Content Not Captured

**Missing**: Actual source code (by design for token efficiency)

**Only**: Contracts, JSDoc headers (in header mode)

**Impact**: Can't see implementation details without reading source

**Note**: This is intentional for token efficiency, but worth documenting.

**Priority**: Low

### 7. Route Extraction Edge Cases

**Status:** ⚠️ **Minor edge case**

Route extraction may miss routes in edge cases where JSX attribute values have unusual formatting that doesn't match standard patterns.

**Location**: `src/core/astParser/extractors/eventExtractor.ts` (`extractJsxRoutes()` function)

**Current Behavior**:
- ✅ Extracts routes from standard JSX attributes: `path="/home"`, `href="/about"`
- ✅ Extracts routes from JSX expressions: `path={"/home"}`
- ✅ Handles JSX-specific literal nodes that aren't standard StringLiteral
- ⚠️ May miss routes if `initializer.getText()` returns text with braces (e.g., `{"\/x"}`) that don't match the quoted string pattern

**Impact**: Edge case that may occur with unusual JSX attribute formatting or JSX-specific node types that differ across ts-morph versions. Most common route patterns are correctly extracted.

**Priority**: Low

**Note**: The route extractor intentionally avoids false positives by only matching quoted strings in JSX attributes. This means it won't extract routes from variables like `{route}` or function calls like `router.push("/x")`, which is the desired behavior for a low-noise extractor. The trade-off is that some edge cases with unusual formatting may be missed.

### 8. Comments/JSDoc Only in Header Mode

**Missing**: Regular comments, TODO notes

**Only**: JSDoc in header mode

**Impact**: Loses documentation context

**Priority**: Low

### 9. Test Files Excluded

**Issue**: Test files are completely excluded from context generation.

**Current behavior**: Test files (`.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`) are explicitly filtered out during file scanning and never analyzed.

**Missing**: Test structure, test cases, test coverage information, test utilities, and test helpers are not included in context bundles.

**Impact**: No test understanding - AI assistants cannot see test files, test patterns, or testing strategies used in the codebase.

**Priority**: Low

**Note**: This is intentional by design - test files are excluded to keep context bundles focused on production code. If test analysis is needed, it would require a separate feature or flag to include test files.

### 10. Next.js Framework Features

**Status:** 🟡 **Partially Complete**

**Current Behavior:**
- ✅ Basic Next.js detection (`'use client'`/`'use server'` directives, App Router directory detection)
- ✅ Next.js import tracking
- ✅ **Metadata exports** (`export const metadata = {...}`) extracted ✅ **v0.3.10**
- ✅ **Route paths, dynamic routes, route segments** extracted ✅ **v0.3.10**
- ✅ **Route role detection** (page, layout, loading, error, not-found, template, default, route) ✅ **v0.3.10**
- ❌ Layout hierarchy and relationships not extracted
- ❌ Data fetching patterns (`getServerSideProps`, `getStaticProps`, `getStaticPaths`) not fully extracted
- ❌ Route handlers (API routes) detected but request/response types not extracted
- ❌ Loading/error boundaries detected but relationships not extracted
- ❌ Middleware files detected but not fully analyzed
- ❌ Dynamic imports tracked but component resolution not analyzed

**Impact**: Next.js projects are detected and route roles, segment paths, and metadata exports are now extracted (v0.3.10). However, layout hierarchy, data fetching patterns, and some advanced App Router features are still not extracted. This limits understanding of some Next.js-specific architecture patterns.

**Location**: `src/core/astParser/detectors.ts` (`extractNextJsMetadata()` function)

**Priority**: Medium

**Related**: See [Next.js Framework Limitations](#nextjs-framework-limitations) above for detailed information and examples.

### 11. Backend Framework Features

**Status:** ✅ **Complete (v0.4.0)**

Backend framework support has been fully implemented for Express.js and NestJS.

**What Works (v0.4.0):**
- ✅ Express.js route extraction (`app.get()`, `router.post()`, etc.)
- ✅ NestJS controller extraction (`@Controller`, `@Get`, `@Post`, etc.)
- ✅ HTTP method detection (GET, POST, PUT, DELETE, PATCH, ALL)
- ✅ Route path extraction with parameter detection (`/users/:id` → `params: ['id']`)
- ✅ API signature extraction (request/response types, parameters)
- ✅ Framework-specific metadata (decorators, annotations, class names)
- ✅ Automatic framework detection (skips frontend extraction for backend files)

**What Doesn't Work:**
- ❌ Middleware/guard/interceptor detection (not yet extracted)
- ❌ Request validation schemas (not extracted from decorators like `@Body()`, `@Query()`)
- ❌ Response transformation logic (not analyzed)
- ❌ Other Node.js frameworks (Fastify, Koa, Hapi) not yet supported

**Impact**: Backend API routes and controllers are now fully extracted, enabling AI assistants to understand backend API structure and endpoints. Middleware and advanced framework features are not yet extracted.

**Priority**: Low (core features complete, advanced features pending)

### 12. Runtime Behavior

**Missing**: Runtime props, state changes, side effects

**Only**: Static analysis

**Impact**: No runtime insights

**Note**: This is expected for static analysis tools.

**Priority**: Low

### 13. Watch Mode

**Status:** ✅ **Complete (v0.4.1)**

Watch mode has been fully implemented for automatic context regeneration.

**What Works (v0.4.1):**
- ✅ `stamp context --watch` command
- ✅ File system watcher for `.ts`, `.tsx` files
- ✅ Style file watching (`.css`, `.scss`, `.module.css`, `.module.scss`) with `--include-style`
- ✅ Incremental rebuilds (only regenerates affected bundles)
- ✅ Debouncing (500ms) to batch rapid file changes
- ✅ Change detection showing what changed (props, hooks, state, events, components, functions)
- ✅ Debug mode (`--debug`) showing semantic/file/bundle hash changes
- ✅ Status files for tooling integration (`.logicstamp/context_watch-status.json`)
- ✅ Watch logs (`.logicstamp/context_watch-mode-logs.json`)
- ✅ Graceful shutdown on Ctrl+C
- ✅ `watch-fast` profile for lighter style extraction

**What Doesn't Work:**
- ❌ JavaScript files (`.js`, `.jsx`) are not watched
- ❌ Configurable watch patterns/exclusions (uses fixed defaults)
- ❌ Hot reload integration (manual browser refresh still needed)

**Impact**: Improves developer experience by automatically keeping context files in sync with code changes during development.

**Priority**: ~~Medium~~ Complete

---

# Fixed/Resolved Features

These items were previously limitations but have been fixed across all versions.

## v0.3.9 Fixes

### Dynamic Tailwind Class Parsing (Phase 1)

**Status:** ✅ **Fixed in v0.3.9** (Phase 1 - Same-file variable resolution)

Dynamic Tailwind class parsing Phase 1 is now complete! The extractor can resolve dynamic class expressions within template literals for same-file variables, object properties, and conditional expressions.

**What Works (Phase 1):**
- ✅ Resolves const/let declarations with string literals: `const base = 'px-4 py-2'` → extracts classes from variable
- ✅ Resolves object property access: `variants.primary` → extracts classes from object property value
- ✅ Handles conditional expressions in template literals: `${isActive ? 'bg-blue-500' : 'bg-gray-500'}` → extracts both branches
- ✅ Handles logical operators (`&&`, `||`, `??`) used for class toggling
- ✅ Enhanced variant support (focus-visible, group/peer variants, ARIA variants, container queries)
- ✅ Improved categorization patterns (flex/grid utilities, color vs typography distinction)
- ✅ Better template literal parsing (filters out template syntax artifacts)

**Coverage**: ~70-80% of common dynamic class patterns

**Impact:** This release significantly improves Tailwind CSS class extraction accuracy by resolving dynamic expressions that were previously ignored. Classes defined in variables, object properties, and conditional expressions are now properly extracted and categorized, providing more complete style metadata for AI context analysis. Phase 2 (planned) will add support for cross-file references, dynamic object lookups (`variants[variant]`), and function calls.

**Related:** See [Dynamic Class Parsing](#dynamic-class-parsing) in Active Limitations for Phase 2 details.

## v0.3.8 Fixes

### Enhanced Third-Party Component Info (Phase 1)

**Status:** ✅ **Fixed in v0.3.8** (Phase 1 - Package names and versions)

Missing dependencies now include package names and versions for third-party packages, providing better visibility into external dependencies.

**What Works:**
- ✅ Package name extraction from import specifiers:
  - Handles scoped packages (e.g., `@mui/material` from `@mui/material/Button`)
  - Handles subpath imports (e.g., `lodash` from `lodash/debounce`)
  - Distinguishes third-party packages from relative imports
- ✅ Version lookup from `package.json`:
  - Checks `dependencies`, `devDependencies`, and `peerDependencies`
  - Prioritizes `dependencies` over `devDependencies`
  - Caches `package.json` reads for efficiency
  - Gracefully handles missing `package.json` or packages
- ✅ Schema updates: Added optional `packageName` and `version` fields to `MissingDependency` type

**Example:**

**Before (v0.3.7):**
```json
{
  "name": "@mui/material",
  "reason": "external package",
  "referencedBy": "src/components/Dashboard.tsx"
}
```

**After (v0.3.8):**
```json
{
  "name": "@mui/material",
  "reason": "external package",
  "referencedBy": "src/components/Dashboard.tsx",
  "packageName": "@mui/material",
  "version": "^5.15.0"
}
```

**Impact:** This release provides better visibility into external dependencies by including package names and versions in missing dependency information. This helps AI assistants understand which versions of third-party packages are being used in the project. The implementation is backward compatible - existing context files remain valid, and the new fields are optional. Phase 2 (prop type extraction) is planned for a future release.

## v0.3.7 Fixes

### Emit Detection Accuracy

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

**Example:**

**Source Code:**
```typescript
function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  
  return (
    <button onClick={() => setMenuOpen(!menuOpen)}>
      Toggle Menu
    </button>
  );
}
```

**Context Output (Correct):**
```json
{
  "logic": {
    "emits": {}
  }
}
```

**Source Code (with Props):**
```typescript
interface ButtonProps {
  onClick?: () => void;
}

function Button({ onClick }: ButtonProps) {
  return <button onClick={onClick}>Click</button>;
}
```

**Context Output (Correct):**
```json
{
  "logic": {
    "emits": {
      "onClick": {
        "type": "function",
        "signature": "() => void"
      }
    }
  }
}
```

## v0.3.6 Fixes

### Hook Parameter Detection

**Status:** ✅ **Fixed in v0.3.6**

Hook parameter detection is now fully implemented! We can extract function signatures for custom React hooks and include their parameters in the contract.

**What Works:**
- ✅ Extracts parameters from exported hook function declarations
- ✅ Extracts parameters from exported arrow function hooks
- ✅ Extracts parameters from default exported hooks
- ✅ Captures parameter types (from type annotations, default values, or TypeScript type checker)
- ✅ Handles optional parameters (with `?` or default values)
- ✅ Stores parameters in `logic.props` field for hooks
- ✅ Works even when Props interfaces exist in the same file
- ✅ Props take priority on conflicts

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

## v0.3.5 Fixes

### Inline Style Objects Extraction

**Status:** ✅ **Fixed in v0.3.5** (Verified)

**Location**: `src/extractors/styling/styleExtractor.ts` (lines 88-191)

**Verified Implementation**: The `extractInlineStyles()` function extracts both properties AND values:
- ✅ Extracts property names from object literals
- ✅ Extracts literal values for strings, numbers, booleans, null, and template literals
- ✅ Returns `{ properties: string[], values?: Record<string, string> }`

**Code Evidence** (v0.3.5):
```typescript
// Lines 128-156: Extracts both property names and literal values
if (initializer) {
  const initKind = initializer.getKind();
  if (initKind === SyntaxKind.StringLiteral) {
    const value = (initializer as any).getLiteralText?.() ?? initializer.getText().slice(1, -1);
    values[propName] = value;  // ✅ Value extracted
  }
  else if (initKind === SyntaxKind.NumericLiteral) {
    values[propName] = initializer.getText();  // ✅ Value extracted
  }
  // ... handles booleans, null, template literals
}
// Returns: { properties: [...], values: {...} }  // ✅ Both included
```

**Example**:
```tsx
// Source code has:
style={{ animationDelay: '2s', color: 'blue', padding: '1rem' }}

// Context.json now shows:
"inlineStyles": {
  "properties": ["animationDelay", "color", "padding"],
  "values": {
    "animationDelay": "2s",
    "color": "blue",
    "padding": "1rem"
  }
}
```

**Note**: Dynamic values (variables, function calls) are detected as properties but their values are not extracted (static analysis limitation).

### Styled JSX CSS Extraction

**Status:** ✅ **Fixed in v0.3.5** (Verified)

**Location**: `src/extractors/styling/styledJsx.ts` (lines 59-230)

**Verified Implementation**: The `extractStyledJsx()` function fully extracts CSS content:
- ✅ Extracts CSS from `<style jsx>` template literals
- ✅ Parses CSS using css-tree AST for selectors and properties
- ✅ Detects `global` attribute
- ✅ Returns `{ css: string, global?: boolean, selectors?: string[], properties?: string[] }`

**Code Evidence** (v0.3.5):
```typescript
// Lines 99-112: Extracts CSS from JSX expressions
const css = extractCssFromExpr(expr);  // ✅ Extracts template literal content
if (css?.trim()) {
  cssBlocks.push(css);
}

// Lines 160-194: Parses CSS using css-tree AST
const ast = csstree.parse(cssBlock, {...});  // ✅ Full CSS parsing
csstree.walk(ast, (node: any) => {
  if (node.type === 'Rule' && node.prelude) {
    selectors.add(generate(node.prelude));  // ✅ Selectors extracted
  }
  if (node.type === 'Declaration') {
    properties.add(node.property);  // ✅ Properties extracted
  }
});
// Returns: { css, global, selectors, properties }  // ✅ All fields included
```

**Example**:
```tsx
// Source has:
<style jsx global>{`
  body {
    margin: 0;
    font-family: sans-serif;
  }
  .container {
    padding: 1rem;
    color: blue;
  }
`}</style>

// Context.json now shows:
"styledJsx": {
  "css": "body {\n  margin: 0;\n  font-family: sans-serif;\n}\n.container {\n  padding: 1rem;\n  color: blue;\n}",
  "global": true,
  "selectors": ["body", ".container"],
  "properties": ["color", "font-family", "margin", "padding"]
}
```

**Features**:
- Extracts full CSS content from template literals
- Parses CSS using AST (css-tree) for accurate selector/property extraction
- Detects `global` attribute (`<style jsx global>`)
- Handles complex selectors (`.a:hover > span`, `button[aria-expanded="true"]`, etc.)
- Per-block parsing for resilience (if one block has `${expr}` placeholders, others still work)

## v0.3.2 Fixes

### CSS/SCSS AST-Based Parsing

**Status:** ✅ **Fixed in v0.3.2**

CSS and SCSS file parsing migrated from regex-based extraction to deterministic AST walk using `css-tree`. This provides more robust and accurate parsing of CSS/SCSS files.

**What Works:**
- ✅ AST-based parsing using css-tree (replaces heuristic regex)
- ✅ Accurate CSS selector extraction (class, ID, and type selectors)
- ✅ Proper CSS property extraction with filtering of SCSS variables and at-rules
- ✅ SCSS feature detection (variables, nesting, mixins) as boolean flags
- ✅ Nested rules inside `@media`, `@supports`, `@container`, and other at-rules
- ✅ SCSS `//` comments automatically converted to `/* */` for css-tree compatibility
- ✅ Invalid selector filtering (file extensions, numeric values, keyframe percentages, color values, pixel values)
- ✅ Better error handling with graceful fallback on parse failures

**Impact:** More accurate and reliable CSS/SCSS parsing, consistent with the AST-based approach used for TypeScript/React files.

## v0.3.1 Fixes

### Hook Classification

**Status:** ✅ **Fixed in v0.3.1**

Custom hooks are now correctly classified as `react:hook` instead of `react:component`. The detection logic checks if the main export (default or named) is a function starting with "use" and has no JSX elements.

**Example:**

**Source Code:**
```typescript
function useTypewriter(text: string, speed = 30) {
  const [displayedText, setDisplayedText] = useState('')
  // ... hook implementation
  return displayedText
}
```

**Context Output (Correct):**
```json
{
  "kind": "react:hook"
}
```

## v0.2.6 Fixes

### Export Metadata Extraction

**Status:** ✅ **Fixed in v0.2.6**

Export metadata is now automatically extracted from source files, improving dependency tracking accuracy.

**What Works:**
- ✅ Detects default exports (`export default`)
- ✅ Detects named exports (`export { ... }`, `export function`, `export class`, `export const`)
- ✅ Extracts list of exported function names
- ✅ Stores export metadata in contracts as `exports` field (optional)
- ✅ Export metadata format: `'default'`, `'named'`, or `{ named: string[] }` for multiple named exports
- ✅ Used to improve dependency tracking accuracy

### Internal Component Filtering

**Status:** ✅ **Fixed in v0.2.6**

Dependency tracking improved by filtering out internal components, reducing false positives in missing dependency detection.

**What Works:**
- ✅ Internal components are function components defined in the same file (appear in both `version.functions` and `version.components`)
- ✅ Internal components are now excluded from dependency graphs and missing dependency lists
- ✅ Reduces false positives in missing dependency detection
- ✅ Improves accuracy of dependency analysis for multi-component files

**Impact:** Dependency graphs now only include external dependencies, excluding internal components defined in the same file. Missing dependency lists no longer include internal components, reducing noise in dependency diagnostics.

## v0.2.2 Fixes

### Documentation Accuracy (Tokenizer Dependencies)

**Status:** ✅ **Fixed in v0.2.2**

Fixed documentation to correctly state that `@dqbd/tiktoken` and `@anthropic-ai/tokenizer` are included as optional dependencies in package.json. npm automatically attempts to install them when installing `logicstamp-context`.

**Impact:** Users no longer need to manually install tokenizer packages - they are automatically installed as optional dependencies.

## v0.2.1 Fixes

### Dynamic Version Loading

**Status:** ✅ **Fixed in v0.2.1**

Fixed hardcoded version string in `fileWriter.ts` to dynamically load from `package.json`, ensuring version consistency across all generated context files.

**Impact:** Version information in generated context files now always matches the actual package version.

## Other Implemented Features

### Dependency Graph Edges

**Status:** ✅ **Implemented**

Dependency graph edges ARE built and populated. The `buildEdges()` function in `src/core/pack/builder.ts` creates edges between components based on their dependencies. Edges are included in bundle output.

**Note**: If edges appear empty in your output, this may be due to:
- Components having no dependencies
- Dependencies not being resolved (missing from manifest)
- Dependencies being filtered as internal components

---

## Roadmap

For the complete roadmap with priorities and implementation plans, see [ROADMAP.md](../../ROADMAP.md).

**Active High Priority Items:**
1. **Dynamic class parsing (Phase 2)** - Advanced patterns (object lookups with variables, cross-file references, function calls). Phase 1 complete in v0.3.9.

**Active Medium Priority Items:**
1. **CSS-in-JS support** - Complete support for remaining libraries (Chakra UI, Ant Design)
2. **Enhanced third-party info (Phase 2)** - Include prop types for third-party components (package names and versions completed in v0.3.8)
3. **TypeScript type extraction** - Capture full type definitions (generics, complex unions/intersections)
4. **Project-level insights** - Add cross-folder analysis to `context_main.json`

## Summary

**What's working well:**
- ✅ Component contracts are comprehensive (including hook parameters)
- ✅ Style metadata (when enabled) is detailed and well-structured
- ✅ Project structure indexing is solid
- ✅ Versioning/hashing system is robust
- ✅ Inline styles and Styled JSX fully supported
- ✅ Third-party package names and versions included in missing dependencies (v0.3.8)

**What needs improvement:**
- 🟡 Dynamic class resolution Phase 2 (Phase 1 complete in v0.3.9 - handles variables, object properties, conditionals)
- ❌ CSS-in-JS support completeness (remaining libraries like Chakra UI, Ant Design)
- ⚠️ Third-party component prop types (package names and versions now included in v0.3.8)
- ❌ TypeScript type extraction (generics, complex unions/intersections)
- ❌ Context main.json enhancements (cross-folder relationships, project-wide statistics)

