# Known Limitations

Things that don't work perfectly yet. We're working on improving these areas.

## Overview

LogicStamp Context is pretty accurate overall—around 90% of the time it gets things right. Component structure, props, state, hooks, and imports are usually detected correctly, but there are a few areas where things can be incomplete or a bit off.

- **~95%** - Component Contracts (Props, state, hooks detection)
- **~100%** - Imports Detection (Imports tracked correctly)
- **~90%** - Style Metadata (Static classes work well)

## Hook Parameter Detection

**Issue**

We can detect custom React hooks and list them in the `version.hooks` array, but we don't capture what parameters they take. The contract will show `props: {}` even if the hook actually accepts parameters.

**Example**

**Source Code:**
```typescript
function useTypewriter(text: string, speed = 30, pause = 800) {
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
    "props": {}
  }
}
```

**Impact:** You'll need to check the source code to see what parameters a hook takes—the context file won't tell you.

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

## Summary

**What works really well:**
- Component structure and props
- State variables and hooks
- Import tracking
- Static style metadata
- Dependency graphs

**Areas for improvement:**
- Hook function signatures (parameters not captured)
- Emit detection accuracy (internal handlers vs. actual emits)
- Dynamic style extraction (variable-based classes within template literals)

**Bottom line:** We're hitting around 90% accuracy overall. Solid foundation, but there's definitely room to improve. These issues are on our roadmap.

---

# Feature Completeness & Coverage

This section documents what's currently captured in context files versus what's missing or incomplete. This is separate from accuracy issues above—here we're tracking feature coverage, not detection correctness.

## What's Captured

### 1. Component Contracts (UIFContract)

- **Component kind**: `react:component`, `ts:module`
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
- **Inline styles**: Detected (`inlineStyles: true`)
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
- **Source tool version**: `logicstamp-context@0.3.3`
- **Missing dependencies**: Tracked in `missing` array

## What's Missing or Incomplete


### 2. Inline Style Objects Not Fully Extracted

**Issue**: Inline style objects are detected (`inlineStyles: true`) but actual property values are not captured.

**Example**:
```tsx
// Source code has:
style={{ animationDelay: '2s' }}
style={{ transformOrigin: 'center' }}

// Context.json only shows:
"inlineStyles": true  // But not the actual values!
```

**Missing**: Actual inline style values/properties

**Impact**: Can't analyze specific inline styles

**Priority**: High

### 2. CSS-in-JS Partially Supported

**Supported**: 
- styled-components (component names, theme usage, css prop)
- Emotion (@emotion/styled)
- Material UI (@mui/material) - components, packages, features
- ShadCN/UI - components, variants, sizes
- Radix UI - primitives, patterns, accessibility
- Framer Motion - components, variants, animation features

**Missing/Incomplete**: 
- Chakra UI - not yet detected
- Ant Design - not yet detected
- Styled JSX - CSS content from `<style jsx>` blocks not extracted (only detected)
- Inline style object values - detected but property values not extracted

**Impact**: Most major CSS-in-JS libraries are supported, but some smaller libraries and inline style values are not fully extracted.

**Priority**: Medium

### 3. Edge Relationships (Status: Implemented)

**Status**: Dependency graph edges ARE built and populated.

**Implementation**: The `buildEdges()` function in `src/core/pack/builder.ts` creates edges between components based on their dependencies. Edges are included in bundle output.

**Note**: If edges appear empty in your output, this may be due to:
- Components having no dependencies
- Dependencies not being resolved (missing from manifest)
- Dependencies being filtered as internal components

**Priority**: ~~High~~ Resolved (remove from limitations if edges are working correctly in practice)

### 4. Third-Party Components Minimal Info

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

**Priority**: Medium

### 5. Code Content Not Captured

**Missing**: Actual source code (by design for token efficiency)

**Only**: Contracts, JSDoc headers (in header mode)

**Impact**: Can't see implementation details without reading source

**Note**: This is intentional for token efficiency, but worth documenting.

**Priority**: Low

### 6. TypeScript Types Incomplete

**Captured**: Prop types as strings (`"string"`, `"number"`)

**Missing**: Full TypeScript type definitions, generics, unions, intersections

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

### 10. Styled JSX Not Fully Parsed

**Issue**: Styled JSX blocks are detected but CSS content is not extracted.

**Example**:
```tsx
// Source has:
<style jsx>{`
  @keyframes border-spin { ... }
`}</style>

// Context shows:
"inlineStyles": true  // But not the actual CSS!
```

**Missing**: Actual CSS content from `<style jsx>` blocks

**Impact**: Can't analyze styled-jsx styles

**Priority**: High

### 11. Context main.json Limitations

**Missing**: Cross-folder relationships, project-wide statistics

**Only**: Folder index with token estimates

**Impact**: Limited project-level insights

**Priority**: Medium

## Recommendations

### High Priority

1. **Extract inline style values**: Parse `style={{ ... }}` objects and include properties
2. **Parse styled-jsx**: Extract CSS from `<style jsx>` blocks
3. **Populate edges**: Build actual dependency graph edges (if not working correctly in practice)

### Medium Priority

1. **CSS-in-JS support**: Complete support for remaining libraries (Chakra UI, Ant Design), extract styled-jsx CSS content
2. **Enhanced third-party info**: Include package names, versions, prop types
3. **TypeScript type extraction**: Capture full type definitions
4. **Project-level insights**: Add cross-folder analysis to `context_main.json`

### Low Priority

1. **Test file analysis**: Extract test structure and cases
2. **Comment extraction**: Include regular comments (not just JSDoc)
3. **Runtime hints**: Add static analysis hints about runtime behavior

## Overall Assessment

**What's working well:**
- Component contracts are comprehensive
- Style metadata (when enabled) is detailed and well-structured
- Project structure indexing is solid
- Versioning/hashing system is robust

**What needs improvement:**
- Style metadata extraction completeness (inline style values, styled-jsx CSS content)
- Dynamic class resolution (variable-based classes within template literals)
- CSS-in-JS support completeness (remaining libraries like Chakra UI, Ant Design)

