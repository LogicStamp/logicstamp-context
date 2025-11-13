# Changelog

All notable changes to logicstamp-context will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2025-01-13

### 🚨 Breaking Changes

**New CLI structure** - Unified command interface for better usability:

#### Old Commands (Deprecated)
```bash
logicstamp-context [path]              # Generate context
logicstamp-validate [file]             # Validate context
logicstamp-context compare old new     # Compare contexts
```

#### New Commands
```bash
stamp context [path]                   # Generate context
stamp context validate [file]          # Validate context
stamp context compare old new          # Compare contexts
```

**Migration:** Simply replace `logicstamp-context` with `stamp context` and `logicstamp-validate` with `stamp context validate`.

### Added
- **Automatic validation** on context generation - Every generated context is now validated before writing to ensure schema compliance
- **Unified CLI** - Single `stamp` binary with `context` subcommand structure
- **Better help system** - Improved help messages for all commands

### Changed
- Package now installs as `stamp` command instead of `logicstamp-context` and `logicstamp-validate`
- Context generation now includes validation step (visible in CLI output)
- All command references updated in documentation

### Technical Details

#### Files Modified
- `package.json` - Changed bin from `logicstamp-context` and `logicstamp-validate` to single `stamp` entry
- `src/cli/stamp.ts` - **New file** - Main CLI entry point with subcommand routing
- `src/cli/commands/context.ts` - Added automatic validation before writing
- `src/cli/commands/validate.ts` - Added `validateBundles()` function for in-memory validation

#### Example Output (New)
```
🔍 Scanning /path/to/project...
⚙️  Analyzing components...
🔗 Building dependency graph...
📦 Generating context...
🔍 Validating generated context...
✅ Validation passed
📝 Writing to: context.json
✅ Context written successfully
```

**Why this change?**
- Prepares for future full CLI package (`@logicstamp/cli`) with broader functionality
- Cleaner command structure: `stamp context`, `stamp validate`, `stamp compare`, etc.
- Single binary is easier to manage and extends better
- Matches modern CLI patterns (like `docker`, `git`, `npm`)

## [0.1.1] - 2025-01-13

### Added

#### 🎉 Token Cost Optimization
- **Automatic token estimates**: Every context generation now displays estimated token counts for both GPT-4o-mini and Claude models
- **Savings calculation**: Shows percentage saved compared to full source code inclusion
- **Mode comparison block**: Quick glance at token costs across all three modes (none/header/full) in default output
- **`--compare-modes` flag**: Detailed comparison table showing tokens and savings for each mode
- **Enhanced `--stats` JSON**: Now includes `modeEstimates` object with token counts for all modes
- **Token estimation utilities** (`src/utils/tokens.ts`): Character-based approximation (~4 chars/token GPT, ~4.5 chars/token Claude)

#### 🔍 Context Drift Detection
- **`compare` command**: New subcommand for comparing two context.json files
  - Detects added/removed/changed components
  - Reports specific deltas: imports, hooks, exports, semantic hash
  - CI-friendly: exits with code 1 on drift, 0 on pass
- **`--stats` flag for compare**: Shows token count delta between contexts
- **LiteSig indexing**: Fast comparison using lightweight signature index

#### ✅ Enhanced Component Detection
- **HTML JSX detection**: Components using only HTML elements (like `<button>`) now correctly detected as `react:component` instead of `ts:module`
- **React import detection**: Checks for React imports, JSX elements, `React.createElement`, and React type annotations (React.FC, JSX.Element)
- **JSX Fragment support**: Detects components using React fragments (`<>...</>`)
- **Comprehensive kind detection**: Enhanced `detectKind()` in astParser.ts

#### 🛡️ CI/CD Features
- **`--strict-missing` flag**: Exit with error code 1 if any missing dependencies are detected
- **Perfect for CI validation**: Ensures all dependencies are resolvable before merging

### Fixed
- **Button.tsx kind detection**: Components with only HTML JSX elements now correctly tagged as `react:component` (#fixed)
- **Mixed paths in bundles**: Fixed dependency resolution prioritizing relative paths over global name search, preventing cross-directory conflicts (tests/fixtures vs examples)
- **Path normalization**: Consistent lowercase and forward-slash normalization across all entry IDs

### Changed
- **Dependency resolution**: Now prioritizes relative paths before falling back to global name search (prevents cross-directory component conflicts)
- **Stats output**: Enhanced with mode estimates for programmatic cost analysis

### Technical Details

#### Files Modified
- `src/cli/index.ts` - Compare subcommand, `--strict-missing`, `--compare-modes` flags
- `src/cli/commands/context.ts` - Token estimation, mode comparison, strict-missing validation
- `src/cli/commands/compare.ts` - **New file** for drift detection
- `src/core/astParser.ts` - Enhanced `detectKind()` for better React component detection
- `src/core/pack.ts` - `resolveDependency()` now prioritizes relative paths
- `src/utils/tokens.ts` - **New file** for token estimation utilities
- `README.md` - Comprehensive documentation updates with new sections

#### Example Output

**Context Generation with Token Stats:**
```
📏 Token Estimates (header mode):
   GPT-4o-mini: 13,895 | Full code: ~39,141 (~65% savings)
   Claude:      12,351 | Full code: ~34,792 (~65% savings)

📊 Mode Comparison:
   none:       ~8,337 tokens
   header:     ~13,895 tokens
   full:       ~39,141 tokens
```

**Mode Comparison Table (`--compare-modes`):**
```
📊 Mode Comparison

Mode     | Tokens GPT-4o | Tokens Claude | Savings vs Full
---------|---------------|---------------|------------------
none     |         8,337 |         7,411 | 79%
header   |        13,895 |        12,351 | 65%
full     |        39,141 |        34,792 | 0%
```

**Context Drift Detection:**
```
⚠️  DRIFT

Added components: 2
  + src/components/NewButton.tsx
  + src/utils/tokens.ts

Changed components: 2
  ~ src/cli/commands/context.ts
    Δ imports
  ~ src/cli/index.ts
    Δ hash, imports

Token Stats:
  Old: 8,484 (GPT-4o-mini) | 7,542 (Claude)
  New: 9,125 (GPT-4o-mini) | 8,111 (Claude)
  Δ +641 (+7.56%)
```

## [0.1.0] - 2025-01-15

### Added
- Initial release of standalone LogicStamp Context tool
- Scan React/TypeScript codebases and generate AI-friendly context
- AST-based component analysis (no pre-compilation required)
- Three preset profiles: `llm-safe`, `llm-chat`, `ci-strict`
- Code inclusion modes: `none`, `header`, `full`
- Output formats: `json`, `pretty`, `ndjson`
- Depth-based dependency traversal
- Bundle hash generation for cache keys
- Missing dependency tracking
- Comprehensive CLI with help system
- Cross-platform path normalization
- In-memory contract generation
- Deterministic bundle hashing

### Documentation
- Complete README with usage examples
- Detailed USAGE guide with all options
- Example context.json output
- License (MIT)

### Features
- Standalone operation (no LogicStamp CLI required)
- Works on any React/TypeScript project
- Outputs ready for Claude, ChatGPT, and other AI tools
- Performance: ~3-5s for typical projects
- Zero configuration needed

## [Unreleased]

### Planned
- Watch mode for continuous generation
- Custom profile configuration
- Bundle caching
- Output size optimization
- More output format options
- Integration examples for popular AI tools
