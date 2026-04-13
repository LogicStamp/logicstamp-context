# Roadmap

Planned features, improvements, and known limitations. See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Current Status

**Version:** v0.8.6 (Beta)

Recent milestones:
- **Runtime caches, NodeNext/ESM alignment, dependency refresh (v0.8.6)** - Encapsulated tokenizer and package.json caches behind runtime/loader helpers. Switched TypeScript `module` and `moduleResolution` to `NodeNext`, added conditional `exports` (`types` + `import`), normalized `bin` paths, and updated dependencies to current compatible versions
- **Watch lock, file lock, secrets, compare fixes (v0.8.5)** - Watch: synchronous `isRegenerating` flag and queued change processing instead of a promise-based lock race. File lock: exclusive write helper with cleanup on failed write/close; Windows PID liveness via `tasklist` (with safe fallbacks) instead of `process.kill(pid, 0)`. Secret scanner: case-insensitive AWS/GitHub/PEM patterns. skip invalid match indices before snippets. Compare: `exportKind` treats `exports.named` as named only when it is a non-empty array
- **CLI packaging, paths, and token summary (v0.8.4)** - `logicstamp-context` registered as npm bin (fixes `npx logicstamp-context`). centralized `normalizeEntryId` / `toForwardSlashes` across CLI, watch, pack loader, and AST; `stamp context` summary shows the current mode’s exact token count vs raw source with savings % (use `--compare-modes` for full breakdown). tag-based npm publish via GitHub Actions and updated contributing/release docs
- **Secret scanner & watch reliability (v0.8.3)** - Long-line skip and regex optimizations in secret detection. watch logging, full rebuild fallback after incremental errors, async/error hardening
- **Documentation layout, watch perf, path boundaries (v0.8.2)** - Core docs under `docs/guides/` and `docs/reference/` with link updates; style/framework docs aligned with CLI; watch mode avoids `Array.from` on the contract map (direct `Map` iteration per change); centralized `isPathWithinRoot` for pack loader and hash-lock
- **CLI argument validation and robustness fixes (v0.8.1)** - Numeric arg validation for `--depth`/`--max-nodes`, safe compare normalization, token savings bounds
- **`--strict` flag for compare (v0.8.0)** - Exit code 1 on breaking changes
- **Git baseline comparison (v0.7.2)** - `--baseline git:<ref>` for drift detection
- **Full contract comparison (v0.7.2)** - State, variables, API signatures, prop/emit types
- **Strict watch enhancements (v0.7.1)** - Session tracking, `--strict-watch`, `--verbose`
- **Watch mode (v0.4.1)** - Incremental rebuilds, change detection
- **Backend support (v0.4.0)** - Express.js, NestJS

---

## Bug Fixes & Accuracy

### High Priority

| Item | Status | Notes |
|------|--------|-------|
| **Emit Detection** | ✅ v0.3.7 | Only extracts prop-based handlers. See [limitations.md](docs/reference/limitations.md#fixed--resolved) |
| **Dynamic Class Parsing** | ✅ Phase 1 (v0.3.9), 🟡 Phase 2 planned | ~70-80% coverage. Phase 2: object lookups, cross-file refs. See [limitations.md](docs/reference/limitations.md#dynamic-class-parsing) |

### Medium Priority

| Item | Status | Notes |
|------|--------|-------|
| **CSS-in-JS** | ✅ v0.5.1 | All major libs: styled-components, Emotion, MUI, ShadCN, Radix, Framer, Chakra, Ant Design |
| **Third-Party Info** | 🟡 Phase 1 done | Package names + versions. Phase 2: prop types from `.d.ts` |
| **TypeScript Types** | 🟡 Partial | Missing: generics, complex unions/intersections. See [limitations.md](docs/reference/limitations.md#typescript-types) |
| **Project-Level Insights** | 🔴 Not started | Cross-folder relationships, project-wide stats in `context_main.json` |

### Low Priority

| Item | Status | Notes |
|------|--------|-------|
| **Test File Analysis** | 🔴 Not started | Excluded by design. Optional flag if requested. |
| **Comment Extraction** | 🟡 Partial | JSDoc only. Missing: `//`, `/* */`, TODOs |
| **Runtime Behavior Hints** | 🔴 Not started | Expected limitation (static analysis) |

---

## Framework Expansion

### Near-Term

| Item | Status | Notes |
|------|--------|-------|
| **Backend Support** | ✅ v0.4.0 | Express, NestJS. Routes, HTTP methods, API signatures. Future: Fastify, Koa, Hapi. |
| **JavaScript & JSX** | 🔴 Not started | Add `.js`/`.jsx`. JSDoc type inference. **High priority** |
| **Watch Mode** | ✅ v0.4.1 | Incremental rebuilds, debouncing, status file, `--strict-watch`. See [watch.md](docs/cli/watch.md) |

### Future

| Item | Status | Notes |
|------|--------|-------|
| **Vue SFC** | 🟡 Partial | Vue 3 TS/TSX done. Missing: `.vue` file parsing. **High** |
| **Svelte** | 🔴 Not started | `.svelte` files. **Medium** |
| **Python** | 🔴 Planned | Depends on conditional schema. FastAPI, Django, Flask. **Medium** |
| **Java** | 🔴 Planned | Depends on conditional schema. Spring Boot. **Medium** |

---

## Future Enhancements

### Comparison & Drift Detection

**Git Baseline** ✅ v0.7.2 — Compare against any git ref: `stamp context compare --baseline git:main`. Uses worktrees; generates context at baseline + current, then compares. Hash-only changes filtered in git mode (TS resolution differences). Works with branches, tags, commits. Limitations: local refs only, no caching. See [compare.md](docs/cli/compare.md) for hash behavior, use cases, and full details.

**Enhanced Compare** ✅ v0.7.2 — Full contract comparison: state, variables, API signatures, prop/emit type changes. Matches watch mode behavior.

**Compare export classification** ✅ v0.8.5 — `exportKind` classifies `named` exports only when `exports.named` is a non-empty array; malformed shapes map to `none` instead of a false `named` match.

### Schema & Architecture

**Conditional Schema by Language** 🔴 Planned — Make `UIFContract` schema conditional on `kind` (e.g., `style` only for frontend, `apiSignature` required for backend). Prerequisite for Python/Java. Depends on JS/JSX support first. **High priority**.

- **Tokenizer/package cache encapsulation** ✅ v0.8.6 — Replaced module-level tokenizer and `package.json` caches with `TokenizerRuntime` and `PackageJsonLoader`, plus `create*` / `clear*` helpers re-exported from the package root.

### Performance & Optimization

- **Context summary token display** ✅ v0.8.4 — Summary uses the current mode’s measured token count only (no blended heuristics), compares to raw source with savings %, and points to [`--compare-modes`](docs/cli/compare-modes.md) for per-mode detail.

- **Formal benchmarks** 🔴 Planned — **Today:** [`stamp context --compare-modes`](docs/cli/compare-modes.md) already compares bundle token costs across modes on **your** repo (optional `context_compare_modes.json` with `--stats`). **Planned** work adds **published** baselines and methodology: fixed reference corpora, reproducible tables, CI or scheduled runs, and assistant-side task evals. Two tracks where possible:
  - **Tool / runtime** — Cold/warm `stamp context`, watch incremental cost, memory, scaling with repo size.
  - **LLM / workflow (with vs without LogicStamp)** — The main question: **do models do better when given LogicStamp bundles than when they only see raw source (or minimal repo context)?** Planned evals hold tasks and prompts fixed, vary only the context channel (bundles vs baseline), and report metrics such as task success, prop/API factual accuracy, tokens to a correct answer, and hallucination rate. Complements per-repo token comparison from `--compare-modes`; extends the docs with **published** numbers others can reproduce on reference corpora.

- **Incremental watch optimization** ✅ v0.8.2  
  - Avoid unnecessary array allocations during incremental rebuilds  
  - Direct `Map` iteration for contract lookups reduces per-change overhead  
  - Improves performance for large codebases in watch mode

### Security & Reliability

- **Path traversal protection hardening** ✅ v0.8.2  
  - Centralized `isPathWithinRoot` for consistent project boundary enforcement  
  - Prevents file access outside project root in pack loader and hash-lock flows  
  - Aligns validation across `loadContract`, `readSourceCode`, and related fs operations

- **Path normalization consistency** ✅ v0.8.4  
  - Standardizes `normalizeEntryId` and `toForwardSlashes` across CLI, watch mode, pack loader, and AST handling  
  - `displayPath()` delegates to `toForwardSlashes()` (bundle diff still uses `normalizeName()` where appropriate)

- **Secret detection performance & safety** ✅ v0.8.3  
  - Skips very long lines (1000+ characters) to avoid pathological regex cost  
  - Fewer per-line `RegExp` allocations; simplified overlapping patterns (`api[_-]?key`, etc.)

- **Secret detection consistency** ✅ v0.8.5  
  - Case-insensitive matching for AWS-style keys, GitHub token prefixes, and PEM private-key headers (aligned with other patterns)  
  - Skip recording a match when `match.index` or full match text is invalid before building snippets

- **Watch mode error handling** ✅ v0.8.3  
  - Clearer logging for context load/read failures (respects `--quiet`)  
  - Full rebuild fallback after incremental errors to restore consistent state  
  - Hardened async/error paths to avoid masked failures and unhandled rejections

- **Watch mode regeneration lock** ✅ v0.8.5  
  - Synchronous `isRegenerating` flag replaces promise-based lock to avoid races when multiple callers process the same file changes  
  - `while` loop drains changes that arrive during regeneration

- **File lock robustness** ✅ v0.8.5  
  - `writeLockFileExclusive()` removes empty or partial `.lock` files if write or close fails after exclusive create  
  - Windows: use `tasklist` to detect whether the lock PID still exists; treat current process as alive; indeterminate `tasklist` output does not drop valid locks (fixes lost updates under heavy concurrent waiters, e.g. `appendWatchLog`)

- ✅ Incremental bundle caching (watch mode)
- **Style verbosity reduction** 🔴 — Less verbose style for nested components with `depth=2`; planned `--full-style` flag for full extraction (distinct from `--style-mode full`). ~30-40% token reduction.
- **Output size optimization** — Further token reduction

### Configuration & DX

- **NodeNext / ESM package alignment** ✅ v0.8.6 — `tsconfig.json` now uses `NodeNext` for both `module` and `moduleResolution`; package `exports` include `types` and `import`; `bin` paths normalized for cleaner ESM-aware publishing and consumption.
- ✅ Normalized paths, `--verbose` (v0.7.1)
- **npm CLI entry (`npx`)** ✅ v0.8.4 — `package.json` `bin` maps `logicstamp-context` to the same CLI as `stamp`, so `npx logicstamp-context` works reliably.
- **Release & publish workflow** ✅ v0.8.4 — Tag-based npm publishing in GitHub Actions; contributing guidelines aligned with the new release process.
- **Custom profiles** — User-defined beyond presets
- **Integration examples** — Cursor, Claude, Copilot
- **Debugging tools** — Better diagnostics

---

## Known Limitations

See [docs/reference/limitations.md](docs/reference/limitations.md) for full details with code evidence.

**Summary:** Dynamic classes Phase 1 done (~70-80%); TypeScript generics/complex unions missing; third-party prop types missing (names/versions done); no project-level insights; JSDoc only for comments; test files excluded by design.

**Coverage:** ~95% component contracts, ~100% imports, ~90-95% style metadata.

---

## Contributing

1. See [CONTRIBUTING.md](CONTRIBUTING.md)
2. Open an issue to discuss
3. Submit a PR

**Priority areas:** Dynamic class Phase 2, JS/JSX support, third-party prop types, Vue SFC parsing.

---

## Feedback

- **Issues:** https://github.com/LogicStamp/logicstamp-context/issues
- **Roadmap:** https://logicstamp.dev/roadmap
