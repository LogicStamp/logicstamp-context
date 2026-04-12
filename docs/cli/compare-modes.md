# Mode Comparison Guide

Compare token costs across context modes.

```bash
stamp context --compare-modes
```

## Overview

Four modes balance detail vs tokens:

- **none** - Contracts only (props, state, hooks, dependencies), no source
- **header** - Contracts plus JSDoc headers and signatures
- **header+style** - Header plus style metadata (Tailwind, SCSS, MUI, layout, motion)
- **full** - Contracts plus complete embedded source

## Output Format

**1. Token estimation** — Which tokenizers ran, or character fallback.

**2. Comparison vs raw source** — See [baselines](#what-the-two-baselines-mean). Negative % means summed header bundles exceed one copy of all source files, but a **single** root’s bundle is often still far smaller than raw because the row totals **every** root, not the one bundle you attach in chat.

**3. Mode breakdown** — Each mode vs **full** (same bundle set): how much smaller than maximum.

Example tables:

```
   Comparison:
     Mode         | Tokens GPT-4o | Tokens Claude | Savings vs Raw Source
     -------------|---------------|---------------|------------------------
     Raw source   |       273,006 |       289,573 | 0%
     Header       |        82,917 |        90,131 | 70%
     Header+style |       170,466 |       184,864 | 38%
```

```
   Mode breakdown:
     Mode         | Tokens GPT-4o | Tokens Claude | Savings vs Full Context
     -------------|---------------|---------------|--------------------------
     none         |        49,751 |        54,079 | 86%
     header       |        82,917 |        90,131 | 77%
     header+style |       170,466 |       184,864 | 52%
     full         |       355,923 |       379,704 | 0%
```

## Token Estimation

Defaults use ~4 chars/token (GPT-4o) and ~4.5 (Claude). Optional `@dqbd/tiktoken` gives GPT-4o-aligned counts when it loads. **`@anthropic-ai/tokenizer`** is documented by Anthropic as for older models; for Claude 3+ treat its counts as a rough guide only (API `usage` is authoritative for billing).

```bash
npm install @dqbd/tiktoken @anthropic-ai/tokenizer
```

## What the two baselines mean

**Raw source** — Every project `.ts` / `.tsx` (tests excluded), each file **once**, joined. No JSON bundles.

**Header / header+style (first table)** — Tokens for **all root bundles**, formatted and concatenated. Anything imported by many roots is repeated; bundle JSON adds overhead. So the table can show header **above** raw on large multi-root graphs, even when **one** feature bundle is still cheap. In chat you usually send one bundle—that is **not** the same as this summed row.

**Tailwind + header+style** — Style extraction expands utilities into structured text, so that row often grows vs raw more than on SCSS-heavy repos (in addition to duplication above).

## Mode Selection Guide

**~N% vs raw** below = rough when summed header output beats one pass over all files ([above](#what-the-two-baselines-mean)).

**none** — ~18% of raw in typical cases. CI, graphs, no UI detail.
**header** — ~30% when totals beat raw. Default for most chat/review.
**header+style** — ~62% when totals beat raw; Tailwind pushes it up. UI and design-system work.
**full** — ~130% vs one file pass; contracts + full source. Deep refactors, bugs.

## Example Workflows

```bash
stamp context --compare-modes
stamp context --include-code header --max-nodes 50
```

```bash
stamp context --compare-modes
stamp context style   # if budget allows
```

```bash
stamp context --compare-modes --stats   # writes context_compare_modes.json
```

## Common Questions

**Why don’t tokens match file size?** Tokens ≠ bytes; tokenizers split code and prose unevenly.

**When are tokenizers worth it?** Tight budgets, production gates, comparing tools. Approximations are fine for day-to-day.

**Do Claude numbers match the API?** Not necessarily. The optional Anthropic tokenizer can diverge from current Claude models; rely on response `usage` when exact counts matter.

**`full` overhead?** JSON + metadata on top of embedded source; `header` avoids most of that.

### Why can Header show more tokens than Raw source?

[What the two baselines mean](#what-the-two-baselines-mean) — raw is one copy of each file; the header row is **every root bundle** summed.

**Folder scope?** `stamp context ./src/components --compare-modes`

**Writes files?** No, unless `--stats` (JSON). Normal `stamp context` writes bundles.

## Performance

~2–3× normal run; in-memory, no bundle files unless `--stats`.

## Related Commands

- [`stamp context`](context.md)
- [`stamp context style`](style.md)
- [`stamp context compare`](compare.md)
- [`stamp context validate`](validate.md)

## Tips

- Default **header**; add **header+style** only for UI-heavy prompts.
- Re-run as the repo grows.
