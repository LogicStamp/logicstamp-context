# Known Limitations

Things that don't work perfectly yet. See [CHANGELOG.md](../../CHANGELOG.md) for release notes and completed fixes.

## ⚠️ Breaking Changes

**v0.7.0** — `stamp context style` default is now `--style-mode lean` instead of `full`. Use `--style-mode full` for previous behavior. [Details](../../CHANGELOG.md#070---2026-03-03)

## Overview

~90% accuracy overall. Component structure, props, state, hooks, and imports are usually correct.

- **~95%** — Component contracts (props, state, hooks)
- **~100%** — Imports
- **~90-95%** — Style metadata (static ~100%, dynamic Phase 1 ~70-80%, CSS-in-JS 9/9 libs ✅ v0.5.1)

### Performance benchmarks

**Already available:** `stamp context --compare-modes` measures **your project’s** context bundle tokens across modes (`none`, `header`, `header+style`, `full`) with accurate regeneration per mode; with `--stats` it can write `context_compare_modes.json`. That is **per-repo mode comparison** (token cost analysis), not a published reference result. See [compare-modes.md](../cli/compare-modes.md).

The accuracy and token ranges in the overview above reflect what we observe in development and everyday use. We are planning **published benchmarks** with a clear, repeatable methodology: **tool-side** (runtime, memory, watch overhead, scaling with repo size) and **LLM-side** — especially **assistants with LogicStamp context vs without** (same tasks and prompts; baseline = raw or minimal context; treatment = structured bundles), plus metrics that make the comparison fair and repeatable. Details: [ROADMAP.md](../../ROADMAP.md#performance--optimization).

---

## Fixed / Resolved

These are no longer limitations. See [CHANGELOG](../../CHANGELOG.md) for details.

| Fix | Version |
|-----|---------|
| Hook parameters | v0.3.6 |
| Hook classification (`react:hook`) | v0.3.1 |
| Emit detection (only prop-based handlers) | v0.3.7 |
| Dynamic class Phase 1 (variables, objects, conditionals) | v0.3.9 |
| Third-party package names & versions | v0.3.8 |
| CSS-in-JS (all major libs) | v0.5.1 |
| Backend (Express, NestJS) | v0.4.0 |
| Watch mode & strict watch | v0.4.1, v0.5.5 |
| Git baseline comparison | v0.7.2 |
| Schema validation, path traversal protection, Node.js >= 20 | v0.6.0 |

---

## Active Limitations

### TypeScript compiler (tsc)

**Works alongside `tsc`:** Extraction runs in a **separate** ts-morph project and does not apply your repo’s **`tsconfig`** the same way the compiler does, so it complements—rather than replaces—**`tsc --noEmit`** (or your build’s typecheck) for whole-program validation.

- Use **`tsc` / your usual CI typecheck** for “does this code type-check?”
- Use LogicStamp for **structured contracts**, **dependency graphs**, and optional **contract drift** / **breaking-change** checks (`compare --strict`, `--strict-watch`)
- **HTTP wire vs types (Express / NestJS):** Path and method strings are part of the extracted backend contract and feed **`semanticHash`**. A refactor can leave **`tsc` green** while **`compare`** still shows a contract change. What counts as a **strict violation** vs an informational delta for APIs is documented under [API signature handling](../cli/strict-modes.md#api-signature-handling).

Details: [TypeScript support](../frameworks/typescript.md).

### Dynamic Class Parsing
**Phase 1 ✅ (v0.3.9)** — Resolves `const`/`let`, object properties, conditionals (~70-80% of patterns).

**Phase 2 planned** — Object lookups (`variants[variant]`), cross-file refs, function calls. If you use these patterns, style metadata may be incomplete.

**Examples** — Phase 1 works: `` `${base} ${variants.primary} ${isActive ? 'ring-2' : ''}` `` (variables, object props, conditionals). Phase 2 doesn't: `` `${variants[variant]}` `` (object lookup with variable key). Location: `src/extractors/styling/tailwind.ts`.

### TypeScript Types
**Partial** — Basic types, literal unions, function types work. Missing: generics (`ListProps<T>`), complex unions/intersections. Location: `src/extractors/shared/propTypeNormalizer.ts`.

### Third-Party Components
**Phase 1 ✅** — Package names and versions from imports/package.json. Location: `src/core/pack/collector.ts`.

**Phase 2 pending** — Prop types from `.d.ts` in node_modules.

**Scope note** — `.d.ts` support here targets third-party prop extraction (Phase 2). More broadly, LogicStamp **extends** declaration-style information with semantic contracts, dependency graphs, and diffable hashes for change tracking.

### Next.js
**Partial** — Route roles, segment paths, metadata exports ✅ (v0.3.10). Missing: layout hierarchy, data fetching types, route handler request/response types, middleware analysis. See [frameworks/nextjs.md](../frameworks/nextjs.md).

### Project-Level Insights
**Missing** — No cross-folder relationships or project-wide stats in `context_main.json`. Only folder index with token estimates. Location: `src/cli/commands/context/fileWriter.ts`.

### Other Gaps
- **JavaScript files** — Only `.ts` and `.tsx` are analyzed; `.js` and `.jsx` are ignored.
- **Comments** — JSDoc only (header mode). No `//`, `/* */`, TODOs.
- **Test files** — Excluded by design. Optional flag if requested.
- **Runtime behavior** — Static analysis only (expected).
- **Route extraction** — May miss routes when JSX attribute values have unusual formatting (e.g., `{"\/x"}`). Location: `src/extractors/react/eventExtractor.ts` (`extractJsxRoutes`). Extractor only matches quoted strings to avoid false positives from variables.
- **Code content** — Not captured (by design for token efficiency).
- **Backend** — Middleware, guards, validation schemas not extracted. See [express.md](../frameworks/express.md) and framework docs.
- **Dependency graph edges** — Edges are built; empty `edges: []` can mean no dependencies, unresolved imports, or internal-only components. Default `--depth` is 2 (depth 1 = no nested edges). See [usage.md](../guides/usage.md#dependency-graph).
- **Strict watch** — Diffs and violations use a **baseline** snapshot loaded on the first rebuild in a session (and after a successful **recovery** from a failed incremental rebuild; see [watch.md](../cli/watch.md#errors-and-recovery)). Session totals (`totalErrorsDetected`, etc.) are not reset by recovery. New/empty projects show all changes as "added."

---

## Feature Coverage Summary

**Captured:** Component kinds (react/vue/node), props, state, hooks, imports, exports, Tailwind (categorized), CSS modules, inline styles, Styled JSX, Next.js metadata, folder hierarchy, token estimates, semantic hashes, missing dependencies.

**Not captured:** Source code, generics, third-party prop types, cross-folder relationships, test structure, runtime behavior.

---

## Git Baseline Comparison

✅ **v0.7.2** — `stamp context compare --baseline git:<ref>` compares current code against any git ref. Uses worktrees; hash-only changes filtered to avoid TypeScript resolution false positives. Prop/emit type changes only detected in direct file mode, not git baseline. See [compare.md](../cli/compare.md).

---

## Roadmap

See [ROADMAP.md](../../ROADMAP.md) for priorities and implementation plans.

**High:** Dynamic class Phase 2.

**Medium:** Third-party prop types, TypeScript generics, project-level insights, Next.js data fetching.
