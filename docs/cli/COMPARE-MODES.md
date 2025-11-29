# Mode Comparison Guide

The `--compare-modes` flag provides detailed token cost analysis across all available context generation modes, helping you make informed decisions about which mode to use for your AI workflows.

```bash
stamp context --compare-modes
```

## Overview

Context generation supports multiple modes that balance information completeness against token cost:

- **none** - Contracts only (props, state, hooks, dependencies) with no source code
- **header** - Contracts plus JSDoc headers and function signatures
- **header+style** - Header mode plus extracted style metadata (Tailwind, SCSS, Material UI, animations, layout)
- **full** - Everything including complete source code

The `--compare-modes` flag generates a detailed comparison table showing token costs for all modes, helping you understand the tradeoffs.

## When to Use

Use `--compare-modes` when you need to:

- **Optimize token budgets** - See exact costs for different modes before committing
- **Evaluate style overhead** - Understand the token impact of including style metadata
- **Compare against raw source** - Calculate savings from using LogicStamp vs raw file dumps
- **Plan AI workflows** - Choose the most cost-effective mode for your use case
- **Budget for scale** - Project token costs for larger codebases

## Output Format

The `--compare-modes` output includes three sections:

### 1. Token Estimation Method

Shows which tokenizers are being used:

```
📊 Mode Comparison

   Token estimation: GPT-4o (tiktoken) | Claude (tokenizer)
```

or if tokenizers aren't installed (automatic installation failed or skipped):

```
📊 Mode Comparison

   Token estimation: GPT-4o (approximation) | Claude (approximation)
   💡 Tip: Tokenizers are included as optional dependencies. If installation failed, manually install @dqbd/tiktoken (GPT-4) and/or @anthropic-ai/tokenizer (Claude) for accurate token counts
```

### 2. Comparison vs Raw Source

Shows token savings compared to dumping raw source files:

```
   Comparison:
     Mode         | Tokens GPT-4o | Tokens Claude | Savings vs Raw Source
     -------------|---------------|---------------|------------------------
     Raw source   |       273,006 |       289,573 | 0%
     Header       |        82,917 |        90,131 | 70%
     Header+style |       170,466 |       184,864 | 38%
```

**Interpretation:**
- **Raw source** - Baseline showing tokens for all source code without any processing. This is the token count if you simply concatenated all source files.
- **Header** - Typical savings of 70% by extracting only contracts and signatures (no implementation code). This is the recommended default mode.
- **Header+style** - Savings of 38% when including style metadata. Style metadata adds significant tokens but provides visual context.
- **Note:** The "full" mode (contracts + complete source) will be larger than raw source due to contract structure overhead (~30% additional tokens).

### 3. Mode Breakdown vs Full Context

Shows savings compared to the maximum information mode:

```
   Mode breakdown:
     Mode         | Tokens GPT-4o | Tokens Claude | Savings vs Full Context
     -------------|---------------|---------------|--------------------------
     none         |        49,751 |        54,079 | 86%
     header       |        82,917 |        90,131 | 77%
     header+style |       170,466 |       184,864 | 52%
     full         |       355,923 |       379,704 | 0%
```

**Interpretation:**
- **none** - Maximum compression, 86% savings, contracts only (no code or style)
- **header** - Balanced compression, 77% savings, includes function signatures and JSDoc (recommended default)
- **header+style** - Moderate compression, 52% savings, adds visual/styling context
- **full** - No compression, includes complete source code plus contract overhead (~30% more than raw source)

## Token Estimation

### Default: Character-Based Approximation

By default, token estimation uses character-based approximations:
- **GPT-4o**: ~4 characters per token
- **Claude**: ~4.5 characters per token

These approximations are reasonably accurate for most codebases (typically within 10-15% of actual token counts).

### Accurate: Optional Tokenizers

LogicStamp Context includes `@dqbd/tiktoken` (GPT-4) and `@anthropic-ai/tokenizer` (Claude) as optional dependencies. npm will automatically attempt to install them when you install `logicstamp-context`. If installation succeeds, you get model-accurate token counts. If installation fails or is skipped (normal for optional dependencies), the tool gracefully falls back to character-based estimation.

**Behavior:**
- npm automatically tries to install tokenizers when installing `logicstamp-context`
- If installed, automatically detected and used for accurate counts
- If not installed (installation failed/skipped), gracefully falls back to approximation
- No configuration required - works automatically

**Manual installation (optional - only if you want accurate counts and automatic installation failed):**

The tool works fine without tokenizers (uses approximation). Only install manually if:
- You need accurate token counts (not approximations)
- AND automatic installation failed or was skipped

```bash
# For accurate GPT-4 token counts
npm install @dqbd/tiktoken

# For accurate Claude token counts
npm install @anthropic-ai/tokenizer

# Install both for complete accuracy
npm install @dqbd/tiktoken @anthropic-ai/tokenizer
```

**When accurate counts matter:**
- Cost-sensitive workflows with tight token budgets
- Production deployments requiring precise cost projections
- Large-scale batch processing
- Comparing multiple tools or approaches

## Mode Selection Guide

### none - Maximum Compression

**Best for:**
- CI/CD contract validation
- Dependency graph analysis
- Architecture reviews without implementation details
- Maximum token efficiency

**Limitations:**
- No source code or implementation details
- No visual/styling information
- Limited context for code generation tasks

**Token cost:** Typically 18% of raw source

### header - Balanced Compression

**Best for:**
- General AI chat workflows (default for `llm-chat` profile)
- Code review and refactoring
- Understanding component interfaces
- Most LLM interactions

**Includes:**
- Full contracts (props, state, hooks)
- JSDoc headers and comments
- Function signatures and types
- Dependency relationships

**Token cost:** Typically 30% of raw source

### header+style - Visual Context

**Best for:**
- UI/UX discussions with AI
- Design system maintenance
- Frontend code generation
- Visual consistency reviews

**Includes:**
- Everything from header mode
- Tailwind/CSS class patterns
- SCSS/CSS module analysis
- Animation metadata
- Layout patterns (flex/grid)
- Color and spacing patterns

**Token cost:** Typically 62% of raw source

### full - Complete Context

**Best for:**
- Deep implementation reviews
- Complex refactoring tasks
- Bug investigation requiring source
- When AI needs all implementation details

**Includes:**
- Everything from header+style mode
- Complete source code for all components
- Full file contents

**Token cost:** Typically 130% of raw source (includes contract structure overhead)

## Example Workflows

### Budget Planning

```bash
# See costs before generating context
stamp context --compare-modes

# Choose appropriate mode based on budget
stamp context --include-code header --max-nodes 50
```

### Style Cost Analysis

```bash
# Compare with and without style metadata
stamp context --compare-modes

# Enable style only if budget allows
stamp context style
```

### Production Optimization

```bash
# Audit token costs across repository
stamp context --compare-modes | tee token-analysis.txt

# Switch to more efficient mode if needed
stamp context --include-code none --profile ci-strict
```

### Multi-Repo Comparison

```bash
# Compare token costs across multiple projects
for repo in api web mobile; do
  echo "=== $repo ==="
  cd $repo
  stamp context --compare-modes --quiet
  cd ..
done
```

## Understanding the Numbers

### Savings Percentages

**Savings vs Raw Source:**
- Measures reduction compared to dumping all source files (simple concatenation)
- Higher is better for token efficiency
- Typical range: 70% for header mode, 38% for header+style mode
- Note: "Full" mode exceeds raw source due to contract structure overhead (~30% more)

**Savings vs Full Context:**
- Measures reduction compared to maximum information mode (full contracts + complete source)
- Shows relative efficiency between modes
- Typical range: 77% for header mode, 52% for header+style mode

### Token Counts

**GPT-4o vs Claude:**
- Token counts vary by model-specific tokenization (typically within 5-10% difference)
- Differences depend on the specific content being tokenized
- Both estimates are provided for flexibility

### Accuracy

**With approximation:**
- Typically within 10-15% of actual counts
- Sufficient for most planning purposes
- Fast and zero-configuration

**With tokenizers:**
- Exact token counts matching model behavior
- Required for precise cost projections
- Minimal performance overhead

## Common Questions

### Why are my numbers different from raw file sizes?

Token counts are not the same as character counts. Tokenizers split text into semantic units:
- Common words = 1 token
- Rare words = multiple tokens
- Code symbols vary widely
- Whitespace is typically compressed

### Should I always use accurate tokenizers?

**Use approximation when:**
- Rough estimates are sufficient
- Development/prototyping phase
- Token costs aren't critical
- You want zero-configuration setup

**Use tokenizers when:**
- Precise costs matter for budgeting
- Production deployments
- Cost-sensitive workflows
- Comparing against other tools

### How much overhead do contracts add?

In `full` mode, contracts add ~30% overhead compared to raw source due to the structured contract metadata (JSON structure, type information, dependency relationships). However, contracts enable:
- Structured dependency graphs
- Semantic component analysis
- Missing dependency tracking
- Reproducible builds
- Better AI comprehension through structured data

The overhead is typically worth it for AI context generation, but consider using `header` mode (which adds minimal overhead) for most use cases to maximize token efficiency.

### Why do the savings percentages seem generous?

The "savings vs raw source" compares LogicStamp output against a simple concatenation of all source files. However:

- **Raw source** = Just the file contents concatenated (no structure, no metadata)
- **Full mode** = Contracts + complete source = 130% of raw source (due to contract overhead)
- **Header mode** = Contracts + signatures only = 30% of raw source

So while header mode saves 70% compared to raw source, if you need complete source code, the "full" mode actually costs MORE than raw source due to the structured contract format. The real value is that header mode provides most of the semantic information at a fraction of the cost.

**In practice:** Use `header` mode for most AI interactions - it provides contracts, types, and function signatures (what you need 90% of the time) at only 30% of the raw source token cost.

### Can I compare specific folders?

Yes, use the comparison on a subset:

```bash
# Compare modes for specific directory
stamp context ./src/components --compare-modes
```

### Does --compare-modes write files?

No, `--compare-modes` is analysis-only:
- Generates contracts in memory
- Computes token estimates
- Displays comparison tables
- Exits without writing files

Use `stamp context` (without the flag) to actually generate files.

## Performance Notes

- `--compare-modes` takes longer than normal generation (2-3x)
- Regenerates contracts with/without style for accurate comparison
- Uses in-memory processing, no disk writes
- Typical execution: 5-15 seconds for medium projects (50-150 files)

## Related Commands

- [`stamp context`](CONTEXT.md) - Generate context files
- [`stamp context style`](STYLE.md) - Generate context with style metadata
- [`stamp context compare`](COMPARE.md) - Compare context changes over time
- [`stamp context validate`](VALIDATE.md) - Validate schema compliance

## Tips

- Run `--compare-modes` before committing to a generation mode
- Use approximation during development, tokenizers in CI/production
- Consider `header` mode as the default balanced choice
- Add `header+style` only when visual context is needed
- Reserve `full` mode for deep implementation tasks
- Check token costs regularly as your codebase grows
