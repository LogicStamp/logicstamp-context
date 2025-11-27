# Refactoring Plan for LogicStamp Context

## Overview
This document outlines the refactoring strategy for large files in the codebase.

## Priority Files

### 1. `src/cli/commands/context.ts` (967 lines) - **HIGHEST PRIORITY**

**Current Issues:**
- Single massive function (`contextCommand`) handling everything
- Mixed concerns: file scanning, contract building, token estimation, output formatting, file writing
- Complex mode comparison logic (200+ lines) embedded in main function
- Duplicate bundle formatting code
- Hard to test individual pieces

**Refactoring Strategy:**

#### Extract to separate modules:

1. **`src/cli/commands/context/tokenEstimator.ts`**
   - `calculateTokenEstimates()` - Main token calculation
   - `calculateModeEstimates()` - Mode comparison logic
   - `generateModeComparison()` - Full comparison table generation

2. **`src/cli/commands/context/bundleFormatter.ts`**
   - `formatBundles()` - Format bundles for output
   - `formatBundlesByFolder()` - Group and format by folder
   - `createBundleWithSchema()` - Add schema/position metadata

3. **`src/cli/commands/context/fileWriter.ts`**
   - `writeContextFiles()` - Write context.json files
   - `writeMainIndex()` - Write context_main.json
   - `groupBundlesByFolder()` - Organize bundles by folder

4. **`src/cli/commands/context/contractBuilder.ts`**
   - `buildContractsFromFiles()` - Extract contract building loop
   - `buildContractsWithStyle()` - Style-aware contract building
   - `buildContractsWithoutStyle()` - No-style contract building

5. **`src/cli/commands/context/statsCalculator.ts`**
   - `calculateStats()` - Bundle statistics
   - `generateSummary()` - Summary output

6. **`src/cli/commands/context/configManager.ts`**
   - `ensureConfigExists()` - Auto-create config
   - `setupGitignore()` - Gitignore setup
   - `setupLLMContext()` - LLM_CONTEXT.md setup

**Result:** Main `contextCommand` becomes ~200 lines, orchestrating smaller focused functions.

---

### 2. `src/cli/stamp.ts` (1158 lines) - **HIGH PRIORITY**

**Current Issues:**
- Massive argument parsing logic
- Duplicate help text
- All command handlers in one file

**Refactoring Strategy:**

#### Extract to separate modules:

1. **`src/cli/parser/argumentParser.ts`**
   - `parseContextArgs()` - Parse context command args
   - `parseCompareArgs()` - Parse compare args
   - `parseValidateArgs()` - Parse validate args
   - `parseInitArgs()` - Parse init args

2. **`src/cli/parser/helpText.ts`**
   - `getMainHelp()` - Main help text
   - `getContextHelp()` - Context help text
   - `getCompareHelp()` - Compare help text
   - etc.

3. **`src/cli/handlers/`** (directory)
   - `contextHandler.ts` - Handle context command
   - `compareHandler.ts` - Handle compare command
   - `validateHandler.ts` - Handle validate command
   - `initHandler.ts` - Handle init command
   - `cleanHandler.ts` - Handle clean command
   - `styleHandler.ts` - Handle style command

**Result:** Main `stamp.ts` becomes ~100 lines routing to handlers.

---

### 3. `src/core/pack.ts` (632 lines) - **MEDIUM PRIORITY**

**Current Issues:**
- Multiple responsibilities: loading, resolving, collecting, building
- Complex dependency resolution logic

**Refactoring Strategy:**

#### Extract to separate modules:

1. **`src/core/pack/resolver.ts`**
   - `resolveKey()` - Resolve manifest key
   - `resolveDependency()` - Resolve dependency name
   - `findComponentByName()` - Find component by name

2. **`src/core/pack/collector.ts`**
   - `collectDependencies()` - BFS dependency collection
   - `buildDependencySet()` - Build visited set

3. **`src/core/pack/loader.ts`**
   - `loadContract()` - Load sidecar contract
   - `loadManifest()` - Load manifest file
   - `readSourceCode()` - Read source file
   - `extractCodeHeader()` - Extract JSDoc header

4. **`src/core/pack/builder.ts`**
   - `buildBundle()` - Main bundle building
   - `buildEdges()` - Build dependency edges
   - `computeBundleHash()` - Calculate bundle hash

**Result:** Each module ~100-150 lines with single responsibility.

---

### 4. `src/core/styleExtractor.ts` (520 lines) - **MEDIUM PRIORITY**

**Current Issues:**
- Multiple extraction functions in one file
- Could be split by style source type

**Refactoring Strategy:**

#### Extract to separate modules:

1. **`src/core/styleExtractor/tailwind.ts`**
   - `extractTailwindClasses()` - Extract Tailwind classes
   - `categorizeTailwindClasses()` - Categorize utilities
   - `extractBreakpoints()` - Extract responsive breakpoints

2. **`src/core/styleExtractor/scss.ts`**
   - `parseStyleFile()` - Parse SCSS/CSS files
   - `extractScssMetadata()` - Extract SCSS details

3. **`src/core/styleExtractor/styled.ts`**
   - `extractStyledComponents()` - Extract styled-components
   - `extractEmotion()` - Extract Emotion styles

4. **`src/core/styleExtractor/motion.ts`**
   - `extractMotionConfig()` - Extract Framer Motion
   - `extractAnimationMetadata()` - Extract animations

5. **`src/core/styleExtractor/layout.ts`**
   - `extractLayoutMetadata()` - Extract layout info
   - `extractVisualMetadata()` - Extract visual styles

**Result:** Each extractor ~100-150 lines, easier to maintain.

---

### 5. `src/core/astParser.ts` (510 lines) - **MEDIUM PRIORITY**

**Current Issues:**
- Many extraction functions in one file
- Could be grouped by extraction type

**Refactoring Strategy:**

#### Extract to separate modules:

1. **`src/core/astParser/extractors/componentExtractor.ts`**
   - `extractComponents()` - Extract JSX components
   - `extractHooks()` - Extract React hooks

2. **`src/core/astParser/extractors/propExtractor.ts`**
   - `extractProps()` - Extract component props
   - `normalizePropType()` - Normalize prop types

3. **`src/core/astParser/extractors/stateExtractor.ts`**
   - `extractState()` - Extract useState calls
   - `extractVariables()` - Extract variable declarations

4. **`src/core/astParser/extractors/eventExtractor.ts`**
   - `extractEvents()` - Extract event handlers
   - `extractJsxRoutes()` - Extract route patterns

5. **`src/core/astParser/detectors.ts`**
   - `detectKind()` - Detect component kind
   - `detectNextJsDirective()` - Detect Next.js directives
   - `isInNextAppDir()` - Check if in App Router

**Result:** Each extractor ~50-100 lines, clearer organization.

---

## Implementation Order

1. **Phase 1: Context Command** (Highest impact)
   - Extract token estimation
   - Extract bundle formatting
   - Extract file writing
   - Extract contract building
   - Refactor main function

2. **Phase 2: CLI Entry Point**
   - Extract argument parsing
   - Extract help text
   - Extract command handlers
   - Refactor main routing

3. **Phase 3: Core Modules**
   - Refactor pack.ts
   - Refactor styleExtractor.ts
   - Refactor astParser.ts

## Benefits

- **Maintainability**: Smaller, focused files easier to understand
- **Testability**: Individual functions easier to unit test
- **Reusability**: Extracted functions can be reused
- **Readability**: Clear separation of concerns
- **Performance**: No performance impact, just organization

## Testing Strategy

- Write unit tests for each extracted function
- Integration tests for main command flows
- Ensure no behavior changes (refactor only)

## Migration Notes

- Keep existing exports for backward compatibility
- Use barrel exports (`index.ts`) for new modules
- Update imports gradually
- Maintain same public API

