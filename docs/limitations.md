# Known Limitations

Things that don't work perfectly yet. We're working on improving these areas.

## Overview

LogicStamp Context is pretty accurate overall—around 90% of the time it gets things right. Component structure, props, state, hooks, and imports are usually detected correctly, but there are a few areas where things can be incomplete or a bit off.

- **~95%** - Component Contracts (Props, state, hooks detection)
- **~100%** - Imports Detection (Imports tracked correctly)
- **~90%** - Style Metadata (Static classes work well)

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

---

# Active Limitations

These are current limitations that still need to be addressed.

## Emit Detection Accuracy

**Issue**

Sometimes we get confused about what's an internal handler vs. a real component emit. If you have an `onClick` that just updates internal state, it might still show up in the `emits` object even though it's not part of the component's public API.

**Example**

**Source Code:**
```typescript
function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  
  return (
    <button onClick={() => setMenuOpen(!menuOpen)}>
      Toggle Menu
    </button>
  )
}
```

**Context Output (Incorrect):**
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

**Impact:** You might see internal handlers listed as emits, which can be confusing when trying to figure out what events the component actually exposes.

## Dynamic Class Parsing

**Issue**

Style extraction works great for static Tailwind classes and template literals. Static segments within template literals are extracted (e.g., `` className={`base static-class`} `` will extract `"base"` and `"static-class"`). However, dynamic expressions within `${}` are not resolved. If you're storing classes in variables or building them from variables, those dynamic parts won't show up in the style metadata.

**Example**

**Source Code:**
```typescript
function Button({ variant }: { variant: 'primary' | 'secondary' }) {
  const base = 'px-4 py-2 rounded-lg font-semibold'
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900'
  }
  
  return (
    <button className={`${base} ${variants[variant]}`}>
      Click me
    </button>
  )
}
```

**Context Output:**
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

**Impact:** Static parts of template literals are extracted, but dynamic expressions (variables, function calls, etc.) within `${}` are not resolved. If you build classes from variables, the style metadata will be incomplete.

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
- ❌ Emit detection accuracy (internal handlers vs. actual emits)
- ❌ Dynamic style extraction (variable-based classes within template literals)
- ❌ TypeScript type extraction (generics, complex unions/intersections)
- ❌ CSS-in-JS completeness (Chakra UI, Ant Design missing)
- ❌ Third-party component info (package names, versions, prop types)
- ❌ Project-level insights (cross-folder relationships)

**Bottom line:** We're hitting around 90% accuracy overall. Solid foundation, but there's definitely room to improve. These issues are on our roadmap.

---

# Feature Completeness & Coverage

This section documents what's currently captured in context files versus what's missing or incomplete. This is separate from accuracy issues above—here we're tracking feature coverage, not detection correctness.

## What's Captured

### 1. Component Contracts (UIFContract)

- **Component kind**: `react:component`, `react:hook`, `vue:component`, `vue:composable`, `ts:module`, `node:cli`
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
- **Source tool version**: `logicstamp-context@0.3.x`
- **Missing dependencies**: Tracked in `missing` array

## What's Missing or Incomplete

### 1. Emit Detection Accuracy

**Status:** ❌ **Still unresolved**

**Location**: `src/core/astParser/extractors/eventExtractor.ts` (lines 12-74)

**Verified Implementation**: The `extractEvents()` function extracts ALL `onXxx` handlers without any filtering:
- ✅ Matches pattern `/^on[A-Z]/` to find event handlers
- ✅ Extracts function signatures from handlers
- ❌ **No distinction between props (public API) and internal handlers**
- ❌ **No analysis of whether handler is passed as prop vs defined internally**
- ❌ **All `onXxx` attributes are treated as emits**

**Code Evidence** (v0.3.6):
```typescript
// Lines 17-55: Extracts all onXxx without filtering
source.getDescendantsOfKind(SyntaxKind.JsxAttribute).forEach((attr) => {
  const name = attr.getNameNode().getText();
  if (/^on[A-Z]/.test(name)) {  // Matches ALL onXxx
    // No check if this is a prop vs internal handler
    events[name] = { type: 'function', signature };
  }
});
// No analysis of whether onClick is from props or defined in component
```

**Impact**: You might see internal handlers listed as emits, which can be confusing when trying to figure out what events the component actually exposes.

**Priority**: High

### 2. Dynamic Class Parsing

**Status:** ❌ **Still unresolved**

The `extractClassesFromExpression()` function in `src/core/styleExtractor/tailwind.ts` only extracts static segments from template literals. Dynamic expressions within `${}` (variables, function calls, etc.) are not resolved.

**Location**: `src/core/styleExtractor/tailwind.ts` (lines 135-210)

**Impact**: Static parts of template literals are extracted, but dynamic expressions (variables, function calls, etc.) within `${}` are not resolved. If you build classes from variables, the style metadata will be incomplete.

**Priority**: High

### 3. CSS-in-JS Partially Supported

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

### 4. Third-Party Components Minimal Info

**Status:** ❌ **Still unresolved**

**Issue**: Third-party components only show basic "missing" info without details.

**Example**:
```json
"missing": [
  {
    "name": "ChevronRight",
    "reason": "No contract found (third-party or not scanned)"
  }
]
```

**Missing**: Package names, versions, prop types for third-party components

**Impact**: Limited understanding of external dependencies

**Location**: `src/core/pack/collector.ts` - Missing dependency tracking only includes basic info

**Note on Missing Dependency Reasons**: The codebase uses two different reason strings for missing dependencies:
- `"No contract found (third-party or not scanned)"` - Used when a dependency cannot be resolved (third-party components, external packages, or dependencies outside the scan path)
- `"Component not found in manifest"` - Used when the entryId itself is not found in the manifest (typically for the root component being processed)

The example above shows the third-party case, which is the most common scenario for this limitation.

**Priority**: Medium

### 5. Code Content Not Captured

**Missing**: Actual source code (by design for token efficiency)

**Only**: Contracts, JSDoc headers (in header mode)

**Impact**: Can't see implementation details without reading source

**Note**: This is intentional for token efficiency, but worth documenting.

**Priority**: Low

### 6. TypeScript Types Incomplete

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

### 7. Comments/JSDoc Only in Header Mode

**Missing**: Regular comments, TODO notes

**Only**: JSDoc in header mode

**Impact**: Loses documentation context

**Priority**: Low

### 8. Test Files Excluded

**Issue**: Test files are completely excluded from context generation.

**Current behavior**: Test files (`.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`) are explicitly filtered out during file scanning and never analyzed.

**Missing**: Test structure, test cases, test coverage information, test utilities, and test helpers are not included in context bundles.

**Impact**: No test understanding - AI assistants cannot see test files, test patterns, or testing strategies used in the codebase.

**Priority**: Low

**Note**: This is intentional by design - test files are excluded to keep context bundles focused on production code. If test analysis is needed, it would require a separate feature or flag to include test files.

### 9. Runtime Behavior

**Missing**: Runtime props, state changes, side effects

**Only**: Static analysis

**Impact**: No runtime insights

**Note**: This is expected for static analysis tools.

**Priority**: Low

### 10. Context main.json Limitations

**Status:** ❌ **Still unresolved**

**Location**: `src/cli/commands/context/fileWriter.ts` (lines 206-285)

**Missing**: Cross-folder relationships, project-wide statistics

**Only**: Folder index with token estimates

**Impact**: Limited project-level insights

**Priority**: Medium

---

# Fixed/Resolved Features

These items were previously limitations but have been fixed.

## Inline Style Objects Extraction

**Status:** ✅ **Fixed in v0.3.5** (Verified)

**Location**: `src/core/styleExtractor/styleExtractor.ts` (lines 88-191)

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

## Styled JSX CSS Extraction

**Status:** ✅ **Fixed in v0.3.5** (Verified)

**Location**: `src/core/styleExtractor/styledJsx.ts` (lines 59-230)

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

## Dependency Graph Edges

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
1. **Emit detection accuracy** - Distinguish internal handlers from public API emits
2. **Dynamic class parsing** - Resolve variable-based classes within template literals

**Active Medium Priority Items:**
1. **CSS-in-JS support** - Complete support for remaining libraries (Chakra UI, Ant Design)
2. **Enhanced third-party info** - Include package names, versions, prop types
3. **TypeScript type extraction** - Capture full type definitions (generics, complex unions/intersections)
4. **Project-level insights** - Add cross-folder analysis to `context_main.json`

## Summary

**What's working well:**
- ✅ Component contracts are comprehensive (including hook parameters)
- ✅ Style metadata (when enabled) is detailed and well-structured
- ✅ Project structure indexing is solid
- ✅ Versioning/hashing system is robust
- ✅ Inline styles and Styled JSX fully supported

**What needs improvement:**
- ❌ Emit detection accuracy (internal handlers vs. actual emits)
- ❌ Dynamic class resolution (variable-based classes within template literals)
- ❌ CSS-in-JS support completeness (remaining libraries like Chakra UI, Ant Design)
- ❌ Third-party component info (package names, versions, prop types)
- ❌ TypeScript type extraction (generics, complex unions/intersections)
- ❌ Context main.json enhancements (cross-folder relationships, project-wide statistics)

