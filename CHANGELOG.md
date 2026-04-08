# Changelog

All notable changes to `logicstamp-context` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Older releases (0.1.0–0.4.1) are archived in [docs/changelog/0.1.0-0.4.1.md](docs/changelog/0.1.0-0.4.1.md).

---

## [Unreleased]

### Roadmap

For a comprehensive roadmap with detailed status, priorities, and implementation plans, see [ROADMAP.md](ROADMAP.md).

### Known Limitations
See [docs/reference/limitations.md](docs/reference/limitations.md).

---

## [0.8.5] - 2026-04-08

### Fixed

- **Watch mode: fix promise-based lock race condition** ([#182](https://github.com/LogicStamp/logicstamp-context/pull/182))
  - Replace `regenerationPromise` lock with synchronous `isRegenerating` flag
  - Use `while` loop to process changes that arrive during regeneration
  - Prevents multiple callers from racing to process the same file changes

- **File lock: cleanup when write or close fails after exclusive create** ([#183](https://github.com/LogicStamp/logicstamp-context/pull/183))
  - Add `writeLockFileExclusive()` so a failed `writeFile`/`close` no longer leaves an empty or partial `.lock` file blocking acquisition

- **File lock: reliable process liveness on Windows** ([#184](https://github.com/LogicStamp/logicstamp-context/pull/184))
  - Use `tasklist` to detect whether the lock PID still exists instead of relying on `process.kill(pid, 0)` signal semantics
  - Treat the current process as always alive for lock checks; treat empty or unparseable `tasklist` output as indeterminate so valid locks are not dropped (fixes lost updates when many in-process waiters contend, e.g. concurrent `appendWatchLog`)

- **Secret scanner: consistent case handling and safer match indexing** ([#185](https://github.com/LogicStamp/logicstamp-context/pull/185))
  - Use case-insensitive matching for AWS-style keys, GitHub token prefixes, and PEM private-key headers (aligned with other patterns)
  - Skip recording a match when `match.index` or full match text is invalid before building snippets

- **`stamp compare`: correct `exportKind` when `exports.named` is malformed** ([#186](https://github.com/LogicStamp/logicstamp-context/pull/186))
  - Classify `named` exports only when `named` is a non-empty array (`Array.isArray`), so invalid shapes (e.g. string or object) map to `none` instead of a false `named` match

---

## [0.8.4] - 2026-04-07

### Fixed

- Register `logicstamp-context` as a CLI binary (same as `stamp`) ([#177](https://github.com/LogicStamp/logicstamp-context/pull/177)), fixing `npx logicstamp-context` failures caused by a missing `bin` mapping.

### Changed

- **Centralize path normalization** ([#178](https://github.com/LogicStamp/logicstamp-context/pull/178))
  - Standardize `normalizeEntryId` and `toForwardSlashes` usage across CLI, watch mode, pack loader, and AST handling
  - `displayPath()` now delegates to `toForwardSlashes()`
  - `normalizeName()` unchanged (bundle diff only, not filesystem paths)

- **Simplify token output in `stamp context` summary** ([#176](https://github.com/LogicStamp/logicstamp-context/pull/176))
  - Show only current mode’s exact token count (no heuristics)
  - Compare against raw source with savings %
  - Use `--compare-modes` for detailed breakdown

### Chore

- **Update contributing guidelines and release workflow** ([#179](https://github.com/LogicStamp/logicstamp-context/pull/179))
  - Move npm publishing to GitHub Actions (tag-based releases)
  - Clarify version bump and tagging process for `main`
  - Add automated npm publish workflow
  - Simplify CI by removing redundant dependency checks

---

## [0.8.3] - 2026-03-29

### Fixed

- **Secret detector: performance and safety improvements** ([#172](https://github.com/LogicStamp/logicstamp-context/pull/172))
  - Skip very long lines (`MAX_LINE_LENGTH = 1000`) to avoid slow regex evaluation
  - Remove per-line `RegExp` allocations (~10k fewer per 1000-line file)
  - Simplify overlapping patterns to reduce backtracking (`api[_-]?key` unifies variants)

- **Watch mode: error handling and recovery improvements** ([#171](https://github.com/LogicStamp/logicstamp-context/pull/171))
  - Improve logging for context load/read failures (respects `--quiet`)
  - Add full rebuild fallback after incremental errors to restore consistent state
  - Harden async/error handling to prevent masked errors and unhandled rejections

---

## [0.8.2] - 2026-03-26

### Changed

- **Documentation updates and alignment** ([#162](https://github.com/LogicStamp/logicstamp-context/pull/162), [#163](https://github.com/LogicStamp/logicstamp-context/pull/163), [#164](https://github.com/LogicStamp/logicstamp-context/pull/164))
  - Moved core docs to `docs/guides/` and `docs/reference/` and updated internal links
  - Aligned style docs with lean/full modes and CLI output
  - Synced framework docs (Next.js, TypeScript) with implementation details and limitations

- **Incremental watch: avoid `Array.from` on contract map** ([#165](https://github.com/LogicStamp/logicstamp-context/pull/165))
  - Looks up existing contracts by iterating `Map` values directly instead of allocating an array each changed file

### Fixed

- **Harden path traversal protection for pack loader and hash-lock** ([#166](https://github.com/LogicStamp/logicstamp-context/pull/166))
  - Centralized `isPathWithinRoot` in `fsx` for consistent path boundary enforcement across `loadContract`, `extractCodeHeader`, and `readSourceCode`
  - Updated `validateHashLock` to enforce the same check, preventing `--hash-lock` from accessing files outside the project root when using `contractsMap` (watch / standalone paths)

---

## [0.8.1] - 2026-03-23

### Fixed

- **Validate numeric CLI arguments** ([#154](https://github.com/LogicStamp/logicstamp-context/pull/154))
  - Added validation for `--depth` and `--max-nodes` CLI arguments
  - Invalid values (NaN, negative numbers) now show clear error messages and exit
  - Prevents potential infinite loops from invalid input

- **Fix unsafe array access in compare normalization** ([#155](https://github.com/LogicStamp/logicstamp-context/pull/155))
  - Replaced unsafe `pop()!` with safe array index access in `normalizeName()`
  - Prevents potential crashes on edge cases with malformed path strings

- **Add bounds check for token savings calculation** ([#156](https://github.com/LogicStamp/logicstamp-context/pull/156))
  - Added `calculateSavings()` helper with proper bounds checking
  - Clamps percentage to valid range [0, 100] to handle edge cases
  - Prevents Infinity/NaN in stats output when estimates are invalid

---

## [0.8.0] - 2026-03-18

### Added

- **Shared violation detection + `--strict` for compare** ([#147](https://github.com/LogicStamp/logicstamp-context/pull/147))
  - New `src/core/violations.ts` used by both compare and watch modes
  - `--strict-watch` refactored to use shared logic
  - New `--strict` flag for `stamp context compare` (exit code 1 on errors)
  - Detects removed props/events/functions/contracts (errors) and type/state changes (warnings)
  - Works across all compare modes (auto, git baseline, multi-file, single-file)

- **Clean removes TOON files** ([#148](https://github.com/LogicStamp/logicstamp-context/pull/148))
  - Removes `**/context.toon` and `**/context_*.toon`
  - Aligns with `.gitignore` and TOON support

### Changed

- **Standardized compare delta format** ([#147](https://github.com/LogicStamp/logicstamp-context/pull/147))
  - `props` / `emits` now use `{ old, new }` objects
  - Removed `propsChanged` / `emitsChanged`
  - Aligns with existing delta structure
  - ⚠️ **Breaking for programmatic consumers** (CLI output unchanged)

- **Improve TypeScript consumer experience** (`types` field in package.json) ([#151](https://github.com/LogicStamp/logicstamp-context/pull/151))

### Fixed

- **Windows file lock race condition** ([#146](https://github.com/LogicStamp/logicstamp-context/pull/146))
  - Fixed stale lock detection timing issues
  - Added retry with exponential backoff
  - Improved lock checks + test stability

---

## [0.7.2] - 2026-03-11

### Added

- **Git baseline comparison** ([#135](https://github.com/LogicStamp/logicstamp-context/pull/135))  
  - New `--baseline git:<ref>` option to compare the current project against any git ref (branch, tag, commit)  
  - Uses temporary git worktrees to generate baseline context safely 
  - Useful for CI validation, PR reviews, and release checks

- **Backend API signature comparison** ([#140](https://github.com/LogicStamp/logicstamp-context/pull/140))  
  - Detects changes in API parameters, request/response types, and return types  
  - Displays detailed parameter-level diffs

- **State and module variable comparison** ([#136](https://github.com/LogicStamp/logicstamp-context/pull/136))  
  - Detects added, removed, and changed state variables with type information  
  - Tracks module-level variables similar to imports and hooks

- **Prop and emit type change detection** ([#142](https://github.com/LogicStamp/logicstamp-context/pull/142))  
  - Detects type changes in component props and emits  
  - Example: `~ propName: "string" → "number"`  
  - Aligns compare command behavior with watch mode

- **Expanded test coverage for compare command** ([#138](https://github.com/LogicStamp/logicstamp-context/pull/138))

### Fixed

- **False drift detection in git baseline comparisons** ([#135](https://github.com/LogicStamp/logicstamp-context/pull/135), [#137](https://github.com/LogicStamp/logicstamp-context/pull/137))  
  - Resolved issues caused by `.gitignore`, `.stampignore`, and git-ignored files  
  - Prevents hash-only drift and incorrect “added component” detection

- **Deterministic hashing issues** ([#141](https://github.com/LogicStamp/logicstamp-context/pull/141))  
  - Fixed null handling and normalized object ordering to prevent hash churn

### Changed

- **Additions no longer count as drift** ([#141](https://github.com/LogicStamp/logicstamp-context/pull/141))  
  - Newly added components and folders are treated as growth rather than drift  
  - Only removals and modifications trigger `DRIFT`

- **Improved robustness of prop, state, and API comparisons** ([#141](https://github.com/LogicStamp/logicstamp-context/pull/141))  
  - Normalizes contract structures and filters invalid identifiers

### Security

- **Safer git command execution** ([#137](https://github.com/LogicStamp/logicstamp-context/pull/137))  
  - Replaced `exec` with `spawn` to prevent command injection risks

- **Improved git ref validation and timeout handling** ([#139](https://github.com/LogicStamp/logicstamp-context/pull/139))

### Refactor

- **Modularized compare command implementation** ([#136](https://github.com/LogicStamp/logicstamp-context/pull/136))  
  - Split the large `compare.ts` file into smaller modules for maintainability

### Tests

- **Stabilized file lock tests** ([#134](https://github.com/LogicStamp/logicstamp-context/pull/134))  
  - Fixed race condition causing intermittent failures

- **Added E2E coverage for git baseline comparison** ([#143](https://github.com/LogicStamp/logicstamp-context/pull/143))  
  - Covers branches, tags, commit hashes, cleanup behavior, and error scenarios

---

## [0.7.1] - 2026-03-05

### Improved

- **Session status tracking for strict watch mode** ([#124](https://github.com/LogicStamp/logicstamp-context/pull/124))  
  - Added session-level statistics for errors, warnings, and resolved violations  
  - Status block now shows cumulative session metrics and active violations  
  - Output only updates when violations change to keep watch mode clean  
  - Added backward compatibility for existing status files and test coverage

- **Enhanced strict watch session summary** ([#126](https://github.com/LogicStamp/logicstamp-context/pull/126))  
  - Session completion message now reflects detected violations with contextual emoji (✅ none, ⚠️ warnings, ❌ errors)  
  - Displays properly pluralized error/warning counts  
  - Updated watch mode messaging and docs with examples of all status outcomes

- **Normalized path display across all commands** ([#127](https://github.com/LogicStamp/logicstamp-context/pull/127))  
  - Added `displayProjectRoot()` and `displayFilePath()` utilities for consistent path formatting  
  - Paths now display as relative when possible (e.g., `src/context.json`) instead of long absolute paths  
  - Updated `stamp context`, validation output, and watch mode to use the shared utilities  
  - Removed duplicated path formatting logic in `watchMode.ts`  
  - Added unit tests and updated watch mode test mocks for the new utilities

- **Added `--verbose` flag for detailed bundle output** ([#128](https://github.com/LogicStamp/logicstamp-context/pull/128))  
  - Bundle checkmarks (e.g., `✓ src/app/context.json (2 bundles)`) now only appear when `--verbose` is used  
  - Default output shows only summary messages: "📝 Writing main context index..." and "✅ XX context files written successfully"  
  - Use `stamp context --verbose` or `stamp context style --verbose` to see detailed per-file output  
  - Updated documentation, added unit tests for flag parsing, and e2e tests for output behavior

- **`--strict-watch` now automatically enables watch mode** ([#129](https://github.com/LogicStamp/logicstamp-context/pull/129))  
  - `stamp context --strict-watch` now works standalone without requiring `--watch` flag  
  - Both `stamp context --strict-watch` and `stamp context --watch --strict-watch` are equivalent and fully supported for backward compatibility  
  - Updated help text and documentation to reflect the simplified usage  
  - Added unit tests to verify the automatic watch mode enablement

### Refactor

- **Organized watch mode files into dedicated folder** ([#130](https://github.com/LogicStamp/logicstamp-context/pull/130))  
  - Moved `incrementalWatch.ts`, `watchDiff.ts`, and `watchMode.ts` into `src/cli/commands/context/watchMode/` folder  
  - Created `watchMode/index.ts` barrel export for cleaner module organization  
  - Updated all imports across codebase and test files to use new paths  
  - Improved module structure and maintainability without changing functionality


---

## [0.7.0] - 2026-03-03

### ⚠️ Breaking Changes

- **Default `stamp context style` output is now `--style-mode lean`** ([#109](https://github.com/LogicStamp/logicstamp-context/pull/109))  
  - `stamp context style` previously emitted full style metadata by default. It now defaults to lean output for smaller, faster bundles.  
  - Use `--style-mode full` to restore the previous behavior.

### Improved

- **Context module barrel exports** ([#100](https://github.com/LogicStamp/logicstamp-context/pull/100))  
  Added missing `watchMode` and `watchDiff` exports to `src/cli/commands/context/index.ts`. All context command modules are now explicitly exported via the barrel file with documented public API sections.

- **Refactored propExtractor structure** ([#101](https://github.com/LogicStamp/logicstamp-context/pull/101))  
  Flattened deeply nested try-catch blocks in `propExtractor.ts` using a `safeExtract()` helper pattern. Extracted focused helper functions for improved readability, maintainability, and clearer error boundaries.

- **Expanded failure-mode coverage** ([#102](https://github.com/LogicStamp/logicstamp-context/pull/102))  
  Added tests covering AST parser edge cases, watch mode error handling paths, and circular dependency pack scenarios.

- **Security report awareness in `stamp context`** ([#106](https://github.com/LogicStamp/logicstamp-context/pull/106))  
  Added `securityReportLoaded` to `SanitizeStats` and updated `stamp context` / `stamp context style` messaging to warn when no security report is found (prompting `stamp init` / `stamp security` for secret detection).

- **Enhanced extraction and error-path test coverage** ([#104](https://github.com/LogicStamp/logicstamp-context/pull/104))  
  - Added sanitization tests across multiple secret-pattern scenarios  
  - Expanded manifest handling tests (missing imports, duplicate deps, hash indices)  
  - Improved component/event extraction edge-case coverage  
  - Updated coverage documentation with revised per-module metrics

- **Incremental watch style cache optimization** ([#111](https://github.com/LogicStamp/logicstamp-context/pull/111))  
  - `incrementalRebuild` now reuses cached style metadata when available, reducing redundant extraction work during watch mode.  
  - Automatically extracts and caches style metadata when missing, ensuring consistent style output across rebuilds.  
  - Added defensive error handling for style extraction failures so incremental rebuilds continue without style metadata instead of failing.  
  - Style cache now uses a null sentinel for failed extractions, preventing unnecessary retries on subsequent rebuilds.  
  - Implemented cache key generation and checking functions to support style mode variants (`lean`/`full`) in cache lookups.  
  - Enhanced cache cleanup to remove old style cache entries when file hashes change, optimizing memory usage during watch mode.  
  - Expanded unit tests to validate style cache hit/miss, failure scenarios, cache cleanup, and null sentinel behavior.

- **Error logging for style extraction failures** ([#112](https://github.com/LogicStamp/logicstamp-context/pull/112))  
  - Style extraction failures in watch mode now log errors via `debugError()` when `LOGICSTAMP_DEBUG=1` is set, improving debuggability while maintaining resilient rebuild behavior.  
  - Errors include file path and error message context, making it easier to diagnose style extraction issues during development.

- **Watch status file includes strictWatch field** ([#117](https://github.com/LogicStamp/logicstamp-context/pull/117))  
  - Added `strictWatch` boolean field to `WatchStatus` interface and watch status file (`.logicstamp/context_watch-status.json`) to indicate whether strict watch mode is enabled.  
  - MCP servers and other tools can now detect if watch mode is running with `--strict-watch` by reading the status file.  
  - Updated documentation and added unit tests for the new field.

### Fixed

- **Schema validation for lean style mode** ([#116](https://github.com/LogicStamp/logicstamp-context/pull/116))  
  - Updated JSON schema to support both `lean` and `full` style mode variants. The schema was missing lean mode fields (`categoriesUsed`, `selectorCount`, `propertyCount`, `componentCount`, `sectionCount`, `colorCount`, `spacingCount`, `typographyCount`, `summary`), which would cause validation failures for lean mode output.  
  - Added comprehensive tests for lean mode style metadata validation to prevent future schema drift.  
  - Updated schema validation documentation to emphasize testing both style mode variants.

- **Stale lock removal consistency in `fileLock`** ([#110](https://github.com/LogicStamp/logicstamp-context/pull/110))  
  - Added a delay after stale lock removal to improve filesystem consistency and Windows reliability.

### Chore

- **CI and Vitest configuration refinement** ([#103](https://github.com/LogicStamp/logicstamp-context/pull/103))  
  - Excluded barrel (`index.ts`) files from coverage reporting  
  - Optimized CI matrix and enabled sharded test execution

### Tests

- **Windows stale-lock handling in `fileLock` tests** ([#106](https://github.com/LogicStamp/logicstamp-context/pull/106))  
  - Updated lockfile timestamps to exceed the Windows stale threshold and clarified `process.kill` behavior assumptions to keep lock acquisition tests reliable.

- **Vue Extractor Coverage Expansion** ([#113](https://github.com/LogicStamp/logicstamp-context/pull/113)) 
  - Expanded test suite to cover component extraction from variable declarations, composable deduplication, and various state initializer edge cases to ensure extraction determinism for the context compiler.

- **Watch mode test suite refactor** ([#114](https://github.com/LogicStamp/logicstamp-context/pull/114))  
  - Split monolithic watch mode tests into focused modules (events, failure paths, rebuild logic, strict mode) to improve maintainability and clarity.

- **Coverage Expansion & Metrics Visibility** ([#115](https://github.com/LogicStamp/logicstamp-context/pull/115))  
  - Increased overall test coverage (Statements: 88%, Branches: 77.21%, Functions: 93.9%, Lines: 88.19%).  
  - Added module-level coverage reporting section to `tests/README.md` for clearer visibility into per-module coverage health.  
  - Expanded `clean` command tests with additional error-handling and edge-case scenarios.  
  - Extended `init` command tests to cover TTY mode branches and `autoYes` logic paths.  
  - Improved `statsCalculator` and `tokenEstimator` coverage with additional edge-case scenarios.

### Documentation

- **Reframe LogicStamp as the "Context Compiler for TypeScript"** ([#105](https://github.com/LogicStamp/logicstamp-context/pull/105))
  - Updated README positioning and terminology
  - Clarified compilation stages and structural guarantees
  - Added strict watch mode screenshot
  - Updated `PULL_REQUEST_TEMPLATE.md`
  - No runtime behavior changes

- **Complete documentation terminology sync** ([#108](https://github.com/LogicStamp/logicstamp-context/pull/108)) - Updated all remaining markdown files (14 files, 29 replacements) to use "context compilation" terminology consistently. Files updated: `CONTRIBUTING.md`, `README.md`, `SECURITY.md`, `ROADMAP.md`, `docs/cli/context.md`, `docs/cli/ignore.md`, `docs/cli/commands.md`, `docs/cli/compare-modes.md`, `docs/cli/getting-started.md`, `docs/stampignore.md`, `docs/usage.md`, `docs/uif_contracts.md`, `docs/limitations.md`, `examples/README.md`.

- **Document `--style-mode` behavior and defaults** ([#109](https://github.com/LogicStamp/logicstamp-context/pull/109))
  - Updated CLI documentation and help text to reflect `lean` as the default style output mode.
  - Added usage examples for `--style-mode full`.

### Refactor

- **Adopt "Context Compiler" terminology across CLI and documentation** ([#107](https://github.com/LogicStamp/logicstamp-context/pull/107))
  - Replaced "context generation" with "context compilation" across the codebase.
  - Updated CLI help output and documentation to align with the "Context Compiler for TypeScript" positioning.

---

## [0.6.0] - 2026-02-20

### ⚠️ Breaking Changes

- **Node.js requirement bumped to >=20** ([#97](https://github.com/LogicStamp/logicstamp-context/pull/97)) - Required by dependency and security updates.

### Changed

- **Updated `ts-morph` to 27.0.2** ([#97](https://github.com/LogicStamp/logicstamp-context/pull/97)) - Major update from 21.0.1 with improved TypeScript 5.x support.

### Added

- **Schema validation for UIFContract files during contract loading** ([#96](https://github.com/LogicStamp/logicstamp-context/pull/96)) - `.uif.json` sidecar files are validated via AJV during load. Invalid or outdated contracts are rejected with detailed errors.

### Fixed

- **Reject contracts when schema unavailable** ([#97](https://github.com/LogicStamp/logicstamp-context/pull/97)) - Prevents silent validation bypass if the schema fails to load.

- **Improved schema validator reliability and API consistency** ([#96](https://github.com/LogicStamp/logicstamp-context/pull/96)) - Ensures consistent `err.data` reporting and correct `valid` / `errors` return values.

- **Corrected validation type reporting** ([#96](https://github.com/LogicStamp/logicstamp-context/pull/96)) - Properly reports `null` and `array` instead of generic `object`.

- **Improved contract loader error handling** ([#96](https://github.com/LogicStamp/logicstamp-context/pull/96)) - Clearly distinguishes file-not-found, read errors, JSON parse errors, and schema validation errors. Validation errors capped at 20.

- **Fix file lock race condition during concurrent access** ([#94](https://github.com/LogicStamp/logicstamp-context/pull/94)) - Prevents concurrent processes from acquiring locks mid-write.

### Documentation

- Updated `SECURITY.md` to document runtime schema validation and contract integrity guarantees - ([#97](https://github.com/LogicStamp/logicstamp-context/pull/97)).
- Updated `schema.md` to reflect enforced runtime schema validation behavior - ([#97](https://github.com/LogicStamp/logicstamp-context/pull/97)).

### Tests

- **Added root-boundary traversal tests** ([#94](https://github.com/LogicStamp/logicstamp-context/pull/94)) - Covers nested traversal attempts and in-root validation.

- **Expanded extraction and related test coverage** ([#95](https://github.com/LogicStamp/logicstamp-context/pull/95)) - Improved event and route extraction coverage across modules.

### Security

- **Prevent path traversal in file loading utilities** ([#94](https://github.com/LogicStamp/logicstamp-context/pull/94)) - Enforces strict project-root boundaries across internal file utilities.

- **Updated `glob` to 13.0.6 to address minimatch ReDoS vulnerability** ([#97](https://github.com/LogicStamp/logicstamp-context/pull/97)) - Includes patched minimatch version. Required Node.js >=20.

---

## [0.5.5] - 2026-02-17

### Changed

- **Strict watch mode now uses state-based diffing** ([#92](https://github.com/LogicStamp/logicstamp-context/pull/92)) - Strict watch violations now show the cumulative diff from the baseline (starting state), not cumulative history:
  - Violations show current state vs baseline, not accumulated over time
  - When breaking changes are reverted to baseline, violations file is deleted (no violations = no file)
  - `--log-file` remains append-based for event history (unchanged)

- **Removed missing dependencies from strict watch violations** ([#92](https://github.com/LogicStamp/logicstamp-context/pull/92)) - Missing dependencies (third-party packages) are no longer reported as violations in strict watch mode. They are expected and not breaking changes.

### Fixed

- **Watch mode cleanup on exit** ([#92](https://github.com/LogicStamp/logicstamp-context/pull/92)) - Fixed issue where `watch_status.json` file was not deleted when exiting watch mode on Windows/Cursor:
  - Signal handlers are now registered at watch mode startup (calls `registerSignalHandlers()`)
  - Watch status path is now resolved to absolute path for reliable cleanup
  - Added synchronous cleanup fallback via `process.on('exit')` handler
  - MCP tools now clean up stale status files when PID validation fails

- **Watch mode revert correctness** ([#92](https://github.com/LogicStamp/logicstamp-context/pull/92)) - When `pack()` fails during incremental rebuild, the cache is now kept consistent:
  - Contracts are restored from the old bundle when reverting
  - Reverse index entries are preserved for reverted bundles
  - Final contracts and manifest are rebuilt from actual bundle contents
  - Prevents cache inconsistency between contracts/manifest and bundles

- **Resilient glob pattern failure handling** ([#90](https://github.com/LogicStamp/logicstamp-context/pull/90)) - Improved `globFiles()` to continue processing remaining patterns when one fails:
  - Previously, if pattern #2 failed, patterns #3+ never executed and partial results from pattern #1 were lost
  - Now collects results from all successful patterns and errors from failed patterns
  - Only throws an aggregate error if ALL patterns fail
  - Logs warnings via `debugError()` for partial failures (e.g., "2/3 patterns succeeded")
  - Returns partial results when some patterns succeed, improving robustness for edge cases

- **Config read/write race condition (TOCTOU)** ([#89](https://github.com/LogicStamp/logicstamp-context/pull/89))- Fixed potential data loss when multiple processes update config simultaneously:
  - Added lightweight file locking utility (`src/utils/fileLock.ts`) using exclusive file creation with PID tracking
  - `updateConfig()` now acquires an exclusive lock before read-modify-write operations
  - `appendWatchLog()` now acquires an exclusive lock to prevent log entry corruption
  - Lock files automatically detect and clean up stale locks from dead processes
  - Conservative stale detection: distinguishes ESRCH (process dead) from EPERM (permission denied) to avoid deleting valid locks
  - Configurable timeout, retry interval, and stale threshold for lock acquisition
  - No new dependencies - uses Node.js built-in `fs` with `O_CREAT | O_EXCL` flags

- **Atomic file writes to prevent corruption on crash** ([#89](https://github.com/LogicStamp/logicstamp-context/pull/89)) - Config and status files now use temp file + rename pattern:
  - `writeConfig()`, `writeWatchStatus()`, `writeStrictWatchStatus()`, and `appendWatchLog()` all use atomic writes
  - Writes to a temp file first, then atomically renames to the target path
  - Prevents partial/corrupted files if the process crashes mid-write
  - Temp files are cleaned up on error

- **Control flow fix in compare handler** ([#91](https://github.com/LogicStamp/logicstamp-context/pull/91)) - Added explicit `return` before `process.exit()` calls in `compareHandler.ts` to ensure proper control flow termination and prevent potential code execution after exit

### Tests

- Added comprehensive unit tests for cleanup utilities (`tests/unit/utils/cleanup.test.ts`):
  - Handler registration, unregistration, and priority ordering
  - Duplicate id replacement
  - Error handling (handlers continue even when one throws)
  - Sync cleanup path management with real temp file deletion
  - Exit handler invocation verification
  - `process.exit` called with correct exit code

- Added comprehensive unit tests for file locking utility (`tests/unit/utils/fileLock.test.ts`) ([#89](https://github.com/LogicStamp/logicstamp-context/pull/89)):
  - Lock acquisition and release
  - Stale lock detection (dead process, age-based)
  - Concurrent access serialization
  - Timeout behavior
  - Error handling and cleanup

- Added comprehensive unit tests for CLI commands and handlers ([#91](https://github.com/LogicStamp/logicstamp-context/pull/91)):
  - CLI routing tests (`tests/unit/cli/stamp.test.ts`) - Tests command routing to handlers
  - CLI entry point tests (`tests/unit/cli/validate-index.test.ts`) - Tests validate-index CLI
  - Command tests (`tests/unit/commands/`) - Tests for `compare`, `init`, `context`, `security`, and `validate` commands
  - Watch mode tests (`tests/unit/commands/context/watchMode.test.ts`) - Tests watch mode initialization, file change handling, cleanup, and strict mode
  - Handler tests (`tests/unit/handlers/compareHandler.test.ts`) - Tests for auto-compare, multi-file, and single-file compare modes
  - Enhanced `fsx.test.ts` with tests for resilient glob pattern failure handling

---

## [0.5.4] - 2026-02-15

### Fixed

- **Graceful shutdown on process exit** ([#84](https://github.com/LogicStamp/logicstamp-context/pull/84))
  - Added centralized cleanup registry (`src/utils/cleanup.ts`) for consistent resource cleanup
  - Watch mode file watchers and status files are now cleaned up on any exit (errors, SIGINT, SIGTERM)
  - Replaced direct `process.exit()` paths with `gracefulShutdown()` so resources aren’t left orphaned
  - `registerCleanup()` supports async cleanup handlers with priority ordering
  - Signal handlers (SIGINT, SIGTERM, SIGHUP) now route through `gracefulShutdown()`

- **Token comparison now fails loudly when all bundle generations fail** ([#84](https://github.com/LogicStamp/logicstamp-context/pull/84))
  - Added `checkBundleResults()` helper to detect and report complete failure across `Promise.allSettled`
  - Throws a descriptive error when all bundles fail, and logs warnings for partial failures
  - Affects `--compare-modes` in `stamp context`

- **Debug logging for unresolved dependencies in manifest** ([#85](https://github.com/LogicStamp/logicstamp-context/pull/85))
  - Added `debugLog()` helper to `debug.ts` (complements `debugError()`)
  - Manifest building now logs unresolved dependencies when `LOGICSTAMP_DEBUG=1`
  - Missing dependencies during `usedBy` relationship building are no longer silently ignored

### Improved

- **Reduced duplicate error handling in config.ts** ([#86](https://github.com/LogicStamp/logicstamp-context/pull/86))
  - Extracted `ensureConfigDir()` for mkdir with consistent error handling
  - Extracted `ensureConfigDirSilent()` for non-fatal mkdir operations (used by logging functions)
  - Extracted `formatWriteError()` for consistent write error messages
  - Removes ~80 lines of duplicated error handling across `writeConfig`, `writeWatchStatus`, `appendWatchLog`, and `writeStrictWatchStatus`

### Tests

- **Add unit tests for context command modules** ([#87](https://github.com/LogicStamp/logicstamp-context/pull/87)) (`bundleFormatter`, `configManager`, `contractBuilder`,
  `fileWriter`, `statsCalculator`, `tokenEstimator`, `watchDiff`) 

---

## [0.5.3] - 2026-02-14

### Fixed

- **JSON Schema validation**
  - Removed `required: ["gestures", "layoutAnimations", "viewportAnimations"]` from `motion.features` - these fields are conditionally included only when `true`, so an empty `features: {}` object is valid
  - Removed `required: ["css"]` from `styledJsx` - the `css` field is optional in the TypeScript types and implementation

- **Race condition in sanitization stats**
  - Eliminated potential corruption of `sanitizeStats` during concurrent file processing
  - `extractCodeHeader` and `readSourceCode` now return sanitization info instead of mutating global state
  - Callers aggregate results locally and record them in a single batch operation
  - Improves reliability in watch mode and future concurrent scenarios

- **Memory leak in global caches**
  - Security report cache now has automatic expiration (5-minute TTL)
  - Added `clearSecurityReportCache()` for explicit cache clearing when switching projects
  - Added `clearTokenizerCache()` to free tokenizer memory in long-running processes (tokenizers reload on next use)

- **Windows path separator bug in dependency resolution**
  - `resolveDependency()` in `resolver.ts` now uses `getFolderPath()` which properly normalizes path separators
  - Previously, hardcoded `/` separator caused `lastIndexOf('/')` to return -1 on Windows when paths contained backslashes
  - This could cause silent failures in dependency resolution on Windows systems
  - Added test case for Windows-style backslash paths in `resolver.test.ts`

### Improved

- **O(n²) to O(n) performance in dependency collection**
  - Replaced `array.shift()` (O(n) per call) with index-based iteration (O(1) per call) in `collectDependencies()`
  - For large projects with 1000+ components and deep dependency trees, this eliminates quadratic performance degradation
  - Also removes the non-null assertion (`!`) on `shift()` result, improving code clarity

- **Eliminated redundant file reads in token estimation**
  - File contents are now cached on first read in `generateModeComparison()`
  - Subsequent contract rebuilding loops use cached content instead of re-reading from disk
  - For large codebases (500+ files), this halves I/O operations during `--compare-modes`

### Changed

- **Sanitization API (internal)**
  - `extractCodeHeader` now returns `CodeHeaderResult`
  - `readSourceCode` now returns `SourceCodeResult`
  - Added `recordSanitization()` and `recordSanitizationBatch()` helpers
  - `getAndResetSanitizeStats()` continues to work for consumers
  - No breaking changes for CLI users

- **Cache management**
  - Security report cache now uses structured entries with timestamp-based TTL validation
  - `isCacheValid()` validates both project match and expiration time

- **Type safety improvements**
  - Replaced unsafe `as any` casts with proper ts-morph type guards across multiple extractors:
    - `astParser.ts`
    - `propExtractor.ts`
    - `detectors.ts`
    - Styling extractors (`styleExtractor.ts`, `chakra.ts`, `motion.ts`, `shadcn.ts`, `tailwind.ts`)
    - `expressExtractor.ts`
    - `componentExtractor.ts`, `hookParameterExtractor.ts`

- **Terminology**
  - Replaced "react/typescript" with "typescript" in help texts and documentation:
    - `helpText.ts`
    - `astParser.ts`
    - `context.ts`
    - `src/index.ts`
    - `src/cli/index.ts`

---

## [0.5.2] - 2026-02-09

### Fixed

- **JSON Schema completeness** - Fixed missing fields in JSON schema that were causing validation errors:
  - Added `nextjs` field and `NextJSMetadata` definition to schema
  - Added missing style metadata fields (`antd`, `chakraUI`, `shadcnUI`, `radixUI`) to `StyleSources` definition
  - These fields were already being generated in context files but were missing from the schema, causing IDE validation errors
- **Documentation** - Fixed missing `nextjs` field documentation in schema reference
- **Documentation** - Fixed missing `BundleNode.code` field documentation

### Changed

- Schema validation now correctly validates all generated fields.

---

## [0.5.1] - 2026-02-06

### Added

- **Chakra UI support** - Added comprehensive support for Chakra UI component library:
  - Component detection (Box, Button, Input, FormControl, etc.)
  - Package tracking (@chakra-ui/react, @chakra-ui/icons, etc.)
  - Feature detection: theme usage, color mode (dark/light), responsive props, system props
  - Extracts up to 20 most frequently used components ranked by usage frequency
  - Integrated into style metadata extraction when using `--include-style` or `stamp context style`

- **Ant Design support** - Added comprehensive support for Ant Design component library:
  - Component detection (Button, Input, Form, Table, etc.)
  - Package tracking (antd, @ant-design/icons, etc.)
  - Feature detection: theme customization, ConfigProvider usage, Form component, locale/internationalization, icons
  - Handles both default imports and subpath imports (e.g., `antd/es/button`)
  - Extracts up to 20 most frequently used components ranked by usage frequency
  - Integrated into style metadata extraction when using `--include-style` or `stamp context style`

### Fixed

- **`fileExists` function** - Fixed issue where `fileExists()` incorrectly returned `true` for directories. Now correctly checks `stats.isFile()` to ensure the path is actually a file, not a directory.
- **Vitest configuration** - Fixed typo in `vitest.config.ts`: changed `reporter` to `reporters` (correct Vitest API). This ensures test reporters are properly configured.

### Changed

- **CSS-in-JS support completeness** - CSS-in-JS library support is now complete with the addition of Chakra UI and Ant Design. All major CSS-in-JS libraries are now supported:
  - styled-components, Emotion, Material UI, ShadCN/UI, Radix UI, Framer Motion, Styled JSX, Chakra UI, Ant Design

### Tests

- **Comprehensive unit test coverage** - Added extensive unit tests for previously untested modules:
  - **CLI commands** - Unit tests for `ignore` and `style` commands
  - **CLI handlers** - Unit tests for all command handlers (`cleanHandler`, `compareHandler`, `contextHandler`, `ignoreHandler`, `initHandler`, `securityHandler`, `styleHandler`, `validateHandler`)
  - **CLI parser** - Unit tests for argument parsing and help text generation
  - **Core utilities** - Unit tests for `fsx`, `config`, and `llmContext` utilities
  - **CLI entry points** - E2E tests for CLI entry point behavior (`stamp.ts` and `index.ts`)

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



[Unreleased]: https://github.com/LogicStamp/logicstamp-context/compare/v0.8.5...HEAD

[0.8.5]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.8.5

[0.8.4]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.8.4

[0.8.3]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.8.3

[0.8.2]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.8.2

[0.8.1]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.8.1

[0.8.0]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.8.0

[0.7.2]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.7.2

[0.7.1]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.7.1

[0.7.0]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.7.0

[0.6.0]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.6.0

[0.5.5]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.5.5

[0.5.4]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.5.4

[0.5.3]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.5.3

[0.5.2]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.5.2

[0.5.1]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.5.1

[0.5.0]: https://github.com/LogicStamp/logicstamp-context/releases/tag/v0.5.0