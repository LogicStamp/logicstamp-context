# Mode Comparison Guide

Compare token costs across all context generation modes to choose the right one for your workflow.

```bash
stamp context --compare-modes
```

## Overview

Four modes balance information vs token cost:

- **none** - Contracts only (props, state, hooks, dependencies), no source code
- **header** - Contracts plus JSDoc headers and function signatures
- **header+style** - Header mode plus style metadata (Tailwind, SCSS, Material UI, animations, layout)
- **full** - Everything including complete source code

The comparison shows token costs for all modes so you can see the tradeoffs.

## Output Format

The output shows three things:

**1. Token estimation method** - Shows which tokenizers are being used, or if it's falling back to approximations

**2. Comparison vs raw source** - Savings compared to including all source files directly:

```
   Comparison:
     Mode         | Tokens GPT-4o | Tokens Claude | Savings vs Raw Source
     -------------|---------------|---------------|------------------------
     Raw source   |       273,006 |       289,573 | 0%
     Header       |        82,917 |        90,131 | 70%
     Header+style |       170,466 |       184,864 | 38%
```

Header mode saves ~70% by extracting contracts and signatures without implementation code. Header+style saves ~38% but adds visual context. Full mode actually costs more than raw source (~30% overhead) due to contract structure.

**3. Mode breakdown** - All modes compared to the maximum (full):

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

By default, the tool uses character-based approximations (~4 chars/token for GPT-4o, ~4.5 for Claude). These are usually within 10-15% of actual counts, which is fine for most cases.

For accurate counts, LogicStamp includes `@dqbd/tiktoken` (GPT-4) and `@anthropic-ai/tokenizer` (Claude) as optional dependencies. npm installs them automatically when you install `logicstamp-context`. If that works, you get exact token counts. If it fails (normal for optional deps), it falls back to approximation.

You only need to install tokenizers manually if:
- You need exact counts (not approximations)
- AND automatic installation failed

```bash
npm install @dqbd/tiktoken @anthropic-ai/tokenizer
```

Accurate counts matter for production deployments, tight budgets, or comparing tools. For development, approximations are usually fine.

## Mode Selection Guide

**none** - Maximum compression (~18% of raw source)
- Contracts only, no code or style
- Good for: CI/CD validation, dependency analysis, architecture reviews
- Skip if: You need implementation details or visual context

**header** - Balanced compression (~30% of raw source) *recommended default*
- Contracts + JSDoc headers + function signatures
- Good for: Most AI chat workflows, code review, understanding interfaces
- This is what most people need 90% of the time

**header+style** - Visual context (~62% of raw source)
- Everything from header + style metadata (Tailwind, SCSS, animations, layout patterns)
- Good for: UI/UX discussions, design system work, frontend generation
- Adds ~13% token overhead vs header mode

**full** - Complete context (~130% of raw source)
- Everything including full source code
- Good for: Deep reviews, complex refactoring, bug investigation
- Note: Costs more than raw source due to contract structure overhead

## Example Workflows

**Budget planning:**
```bash
stamp context --compare-modes
stamp context --include-code header --max-nodes 50
```

**Style cost analysis:**
```bash
stamp context --compare-modes
stamp context style  # only if budget allows
```

**Production optimization:**
```bash
stamp context --compare-modes | tee token-analysis.txt
stamp context --include-code none --profile ci-strict
```

**Multi-repo comparison:**
```bash
for repo in api web mobile; do
  echo "=== $repo ==="
  cd $repo && stamp context --compare-modes --quiet && cd ..
done
```

**MCP integration:**
```bash
stamp context --compare-modes --stats
# Creates context_compare_modes.json with structured data for MCP servers
```

## Understanding the Numbers

**Savings vs Raw Source:** Shows how much you save compared to just concatenating all source files. Higher is better. Header mode typically saves ~70%, header+style saves ~38%. Full mode actually costs more (~30% overhead) due to contract structure.

**Savings vs Full Context:** Shows efficiency compared to the maximum mode. Header saves ~77%, header+style saves ~52%.

**GPT-4o vs Claude:** Token counts differ slightly (usually 5-10%) because each model tokenizes differently. Both estimates are shown so you can plan for either.

**Accuracy:** Approximations are usually within 10-15% and fine for planning. Tokenizers give exact counts but require installation.

## Common Questions

**Why are my numbers different from raw file sizes?**
Token counts ≠ character counts. Tokenizers split text into semantic units—common words are 1 token, rare words are multiple, code symbols vary, whitespace compresses.

**Should I always use accurate tokenizers?**
Use approximations for development/prototyping. Use tokenizers for production, tight budgets, or comparing tools.

**How much overhead do contracts add?**
In `full` mode, contracts add ~30% overhead vs raw source due to JSON structure and metadata. The overhead is worth it for structured dependency graphs and better AI comprehension, but `header` mode avoids most of it while still giving you what you need.

**Why do the savings percentages seem generous?**
"Savings vs raw source" compares against simple file concatenation. Header mode saves 70% because it extracts contracts and signatures without implementation code. Full mode actually costs more than raw source (~30% overhead) due to contract structure. The real win: header mode gives you 90% of what you need at 30% of the cost.

**Can I compare specific folders?**
Yes:
```bash
stamp context ./src/components --compare-modes
```

**Does --compare-modes write files?**
No, it's analysis-only by default. It generates contracts in memory, computes estimates, and displays tables. Use `stamp context` (without the flag) to actually generate context files.

With `--stats`, it writes `context_compare_modes.json` for MCP integration:
```bash
stamp context --compare-modes --stats
```

## Performance

Takes 2-3x longer than normal generation because it regenerates contracts with and without style for accurate comparison. Uses in-memory processing (no disk writes). Typical execution: 5-15 seconds for medium projects (50-150 files).

## Related Commands

- [`stamp context`](context.md) - Generate context files
- [`stamp context style`](style.md) - Generate context with style metadata
- [`stamp context compare`](compare.md) - Compare context changes over time
- [`stamp context validate`](validate.md) - Validate schema compliance

## Tips

- Run `--compare-modes` before committing to a mode
- Use approximations in dev, tokenizers in production
- Default to `header` mode—it covers most use cases
- Add `header+style` only when you need visual context
- Reserve `full` mode for deep implementation work
- Check costs regularly as your codebase grows
