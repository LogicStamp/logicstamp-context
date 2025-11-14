# Compare Command Documentation

The `compare` command is a powerful tool for detecting drift between context.json files. It works like **Jest snapshots** - automatically comparing your current code against a baseline context.

## Quick Start

```bash
# Auto-mode: Generate fresh context and compare with existing context.json
stamp context compare

# Auto-approve updates (like jest -u)
stamp context compare --approve

# Manual mode: Compare two specific files
stamp context compare old.json new.json

# With token statistics
stamp context compare --stats
```

---

## What It Does

The compare command creates a lightweight signature for each component and detects:

1. **Added components** - New components in the new context
2. **Removed components** - Components that existed in old but not in new
3. **Changed components** - Components that exist in both but have differences:
   - Semantic hash changes (logic/structure changed)
   - Import changes (dependencies changed)
   - Hook changes (state management changed)
   - Export changes (default ↔ named)

---

## Two Modes of Operation

### Auto-Mode (Recommended)

```bash
stamp context compare
```

**What happens:**
1. Generates a fresh context based on your current code
2. Compares it with existing `context.json`
3. Shows you what changed
4. **Prompts you to update** if drift detected (in terminal)
5. **Exits with error** if drift detected (in CI)

This is perfect for local development - just run it after making changes!

### Manual Mode

```bash
stamp context compare old.json new.json
```

**What happens:**
1. Compares two specific context files
2. Shows differences
3. **Prompts to update old.json** with new.json (in terminal)
4. **Exits with error** if drift detected (in CI)

Use this when you want to compare specific snapshots or versions.

---

## Approval Workflow (Jest-Style)

The compare command follows Jest snapshot patterns:

### 1. Interactive Mode (Local Dev)

```bash
$ stamp context compare

⚠️  DRIFT

Changed components: 1
  ~ src/components/Button.tsx
    Δ hash

Update context.json? (y/N) y
✅ context.json updated successfully
```

- **Only in terminals** (TTY mode)
- Prompts Y/N if drift detected
- Updates if you type `y`
- Declines if you press Enter or type anything else

### 2. Auto-Approve Mode (CI-Safe)

```bash
$ stamp context compare --approve

⚠️  DRIFT

Changed components: 1
  ~ src/components/Button.tsx
    Δ hash

🔄 --approve flag set, updating context.json...
✅ context.json updated successfully
```

- **Non-interactive** - no prompts
- **Deterministic** - always updates if drift
- **Works everywhere** - scripts, CI, terminals
- Like `jest -u` for snapshots

### 3. CI Mode (Auto-Detected)

```bash
$ stamp context compare

⚠️  DRIFT

Changed components: 1
  ~ src/components/Button.tsx
    Δ hash
```

- **Never prompts** (non-TTY detected)
- **Exits with code 1** if drift
- **Never hangs or blocks**
- Safe for automated pipelines

---

## Output Format

### PASS (No Drift)

```bash
$ stamp context compare old.json new.json

✅ PASS
```

Exit code: `0`

### DRIFT Detected

```bash
$ stamp context compare old.json new.json

⚠️  DRIFT

Added components: 2
  + src/components/NewButton.tsx
  + src/utils/tokens.ts

Removed components: 1
  - src/components/OldButton.tsx

Changed components: 3
  ~ src/components/Card.tsx
    Δ imports
      - ./old-dependency
      + ./new-dependency
    Δ hooks
      + useState
      + useEffect
  ~ src/App.tsx
    Δ hash
      old: uifb:abc123456789012345678901
      new: uifb:def456789012345678901234
  ~ src/utils/helpers.ts
    Δ exports
      named → default
```

Exit code: `1`

**Detailed Diff Breakdown:**

- **hash**: Shows old and new semantic hash values
- **imports**: Shows removed (`-`) and added (`+`) imports
- **hooks**: Shows removed (`-`) and added (`+`) React hooks
- **exports**: Shows export kind change (e.g., `named → default`)

---

## With Token Statistics

Add `--stats` to see token cost impact:

```bash
$ stamp context compare old.json new.json --stats

⚠️  DRIFT

Added components: 2
  + src/components/NewButton.tsx
  + src/utils/tokens.ts

Changed components: 2
  ~ src/cli/commands/context.ts
    Δ imports
      + ../../utils/tokens.js
      + ./validate.js
  ~ src/cli/index.ts
    Δ hash
      old: uifb:1a2b3c4d5e6f7890abcdef12
      new: uifb:9876543210fedcba09876543
    Δ imports
      - ./old-module
      + ./new-module

Token Stats:
  Old: 8,484 (GPT-4o-mini) | 7,542 (Claude)
  New: 9,125 (GPT-4o-mini) | 8,111 (Claude)
  Δ +641 (+7.56%)
```

---

## Exit Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| `0` | PASS - No drift detected | CI validation passed |
| `0` | DRIFT approved and updated | User approved changes or --approve used |
| `1` | DRIFT - Changes detected but not approved | CI validation failed |
| `1` | DRIFT - User declined update (typed 'n') | Local dev declined changes |
| `1` | Error (file not found, invalid JSON, generation failed) | Fatal error occurred |

**Key Points:**
- Exit 0 = Success (no drift OR drift was approved/updated)
- Exit 1 = Failure (drift not approved OR error)
- This matches Jest snapshot behavior exactly

---

## CI/CD Integration

### GitHub Actions Example (Recommended - Auto-Mode)

```yaml
name: Context Drift Check

on:
  pull_request:
    branches: [main]

jobs:
  check-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: npm ci

      - name: Check for context drift
        run: |
          # Auto-mode: generates fresh context and compares with committed context.json
          # Will exit 1 if drift detected (no prompts in CI)
          stamp context compare --stats
        continue-on-error: true
        id: drift_check

      - name: Comment on PR if drift detected
        if: steps.drift_check.outcome == 'failure'
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ Context drift detected! Run `stamp context compare --approve` locally to update context.json, then commit the changes.'
            })

      - name: Fail if drift detected
        if: steps.drift_check.outcome == 'failure'
        run: exit 1
```

### GitHub Actions Example (Manual Comparison)

```yaml
name: Context Drift Check (Manual)

on:
  pull_request:
    branches: [main]

jobs:
  check-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Need history for base comparison

      - name: Install LogicStamp Context
        run: npm install -g logicstamp-context

      - name: Generate PR context
        run: stamp context --out pr-context.json

      - name: Checkout base branch
        run: git checkout ${{ github.base_ref }}

      - name: Generate base context
        run: stamp context --out base-context.json

      - name: Compare contexts
        run: |
          stamp context compare base-context.json pr-context.json --stats

      - name: Comment on PR if drift detected
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ Context drift detected! Please review the changes.'
            })
```

### GitLab CI Example

```yaml
compare-context:
  stage: test
  script:
    - npm install -g logicstamp-context
    - stamp context --out new-context.json
    - git fetch origin $CI_MERGE_REQUEST_TARGET_BRANCH_NAME
    - git checkout origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME
    - stamp context --out base-context.json
    - git checkout $CI_COMMIT_SHA
    - stamp context compare base-context.json new-context.json --stats
  allow_failure: false
  only:
    - merge_requests
```

### Simple Shell Script (Auto-Mode)

```bash
#!/bin/bash
# check-drift.sh

# Auto-mode: generate fresh and compare with committed context.json
if stamp context compare --stats; then
  echo "✅ No context drift detected"
  exit 0
else
  echo "⚠️  Context drift detected - see details above"
  echo "Run 'stamp context compare --approve' to update"
  exit 1
fi
```

### Shell Script with Manual Comparison

```bash
#!/bin/bash
# compare-contexts.sh

set -e

# Generate current context
stamp context --out current.json

# Generate previous context (from main branch)
git stash
git checkout main
stamp context --out previous.json
git checkout -
git stash pop || true

# Compare
if stamp context compare previous.json current.json --stats; then
  echo "✅ No context drift detected"
  exit 0
else
  echo "⚠️  Context drift detected - see details above"
  exit 1
fi

# Cleanup
rm previous.json current.json
```

---

## Local Development Workflow

### Typical Workflow

```bash
# 1. Generate initial context
$ stamp context
✅ Context written successfully

# 2. Make code changes
$ vim src/components/Button.tsx

# 3. Check for drift
$ stamp context compare
⚠️  DRIFT

Changed components: 1
  ~ src/components/Button.tsx
    Δ hash

Update context.json? (y/N) y
✅ context.json updated successfully

# 4. Commit both code and context
$ git add src/components/Button.tsx context.json
$ git commit -m "feat: update Button component"
```

### Quick Update Workflow

```bash
# After making changes, quickly update context
$ stamp context compare --approve
```

This is like `jest -u` - perfect for rapid iteration!

### Pre-Commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Check for context drift before committing
if ! stamp context compare; then
  echo ""
  echo "❌ Context drift detected!"
  echo "Run 'stamp context compare --approve' to update, or commit anyway with --no-verify"
  exit 1
fi
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

---

## How It Works

### 1. LiteSig Index Creation

For each bundle in the context file, extract a lightweight signature:

```typescript
interface LiteSig {
  semanticHash: string;        // Structure + logic hash
  imports: string[];           // Import dependencies
  hooks: string[];             // React hooks used
  exportKind: 'default' | 'named' | 'none';  // Export type
}
```

### 2. Index by Entry ID

```typescript
Map<string, LiteSig>
// Key: normalized entryId (lowercase)
// Value: LiteSig for that component
```

### 3. Compute Diff

```typescript
// Added: in new but not in old
for (const id of newIdx.keys()) {
  if (!oldIdx.has(id)) added.push(id);
}

// Removed: in old but not in new
for (const id of oldIdx.keys()) {
  if (!newIdx.has(id)) removed.push(id);
}

// Changed: in both but different
for (const id of newIdx.keys()) {
  if (oldIdx.has(id)) {
    const a = oldIdx.get(id);
    const b = newIdx.get(id);
    const deltas = [];

    if (a.semanticHash !== b.semanticHash) deltas.push('hash');
    if (JSON.stringify(a.imports) !== JSON.stringify(b.imports)) deltas.push('imports');
    if (JSON.stringify(a.hooks) !== JSON.stringify(b.hooks)) deltas.push('hooks');
    if (a.exportKind !== b.exportKind) deltas.push('exports');

    if (deltas.length) changed.push({ id, deltas });
  }
}
```

### 4. Generate Output

- PASS if no changes
- DRIFT if any added/removed/changed
- Optional token stats if `--stats` provided

---

## Delta Types Explained

### Hash Changes

Shows the old and new semantic hash values:

```
Δ hash
  old: uifb:abc123456789012345678901
  new: uifb:def456789012345678901234
```

**Meaning**: Component's structure or logic changed (function added/removed, prop types changed, etc.)

### Import Changes

Shows added (`+`) and removed (`-`) imports:

```
Δ imports
  - ./old-dependency
  - ./another-old-dep
  + ./new-dependency
  + ./shiny-new-module
```

**Meaning**: Import dependencies were added or removed

**Special case** - If only order changed:
```
Δ imports
  (order changed)
```

### Hook Changes

Shows added (`+`) and removed (`-`) React hooks:

```
Δ hooks
  - useContext
  + useState
  + useEffect
```

**Meaning**: React hooks usage changed (state management modified)

### Export Changes

Shows export kind transition:

```
Δ exports
  default → named
```

**Meaning**: Export type changed (e.g., from `export default` to `export const`)

**Possible values:**
- `default → named`
- `named → default`
- `none → default`
- `default → none`

---

## Use Cases

### 1. Pre-Merge Validation

Ensure context changes are intentional before merging:

```bash
# In CI
stamp context compare base.json pr.json || exit 1
```

### 2. Cost Impact Analysis

See how changes affect token costs:

```bash
stamp context compare base.json pr.json --stats
```

If the delta is significant, consider if changes are necessary.

### 3. Breaking Change Detection

Detect when component signatures change:

```bash
# Changed exports = potential breaking change
# Changed hooks = different behavior
# Changed imports = different dependencies
```

### 4. Documentation Triggers

Trigger doc updates when context drifts:

```bash
if ! stamp context compare base.json new.json; then
  echo "Context changed - updating docs..."
  npm run generate-docs
fi
```

---

## Performance

- **Fast**: O(n) complexity with hash-based indexing
- **Lightweight**: Only indexes essential signature data
- **Memory efficient**: Doesn't load full source code
- **Typical speed**: <100ms for most projects

---

## Limitations

1. **Entry ID matching**: Uses case-insensitive exact match
2. **No fuzzy matching**: Renamed files show as removed + added
3. **No semantic analysis**: Only compares signatures, not behavior
4. **Bundle-level only**: Doesn't compare individual nodes deeply

---

## Tips & Best Practices

### 1. Commit Context Files

```bash
# Add to git for easy comparison
git add context.json
git commit -m "feat: add new components"
```

### 2. Use in PR Workflow

```bash
# Generate on each PR
stamp context --out pr-context.json

# Compare against main
stamp context compare base-context.json pr-context.json
```

### 3. Monitor Token Growth

```bash
# Track token costs over time
stamp context compare old.json new.json --stats | tee cost-report.txt
```

### 4. Combine with Strict Mode

```bash
# Ensure no drift AND no missing deps
stamp context --strict-missing --out new.json
stamp context compare base.json new.json
```

---

## Troubleshooting

### "DRIFT" but no visible changes?

- Check semantic hashes - internal structure may have changed
- Verify import order (imports are order-sensitive)
- Look for whitespace/formatting changes that affect hashes

### Compare shows many false positives?

- Ensure both contexts generated from same commit
- Check if file paths are normalized consistently
- Verify both contexts use same profile/options

### Token delta seems wrong?

- Token estimates are approximations (~4 chars/token)
- Full tokenizer integration coming in future version
- Use `--stats` to see breakdown

---

## Advanced Usage

### Compare Specific Modes

```bash
# Compare none mode vs header mode
stamp context --include-code none --out none.json
stamp context --include-code header --out header.json
stamp context compare none.json header.json --stats
```

### Batch Comparison

```bash
# Compare multiple versions
for version in v1 v2 v3; do
  git checkout $version
  stamp context --out $version-context.json
done

stamp context compare v1-context.json v2-context.json
stamp context compare v2-context.json v3-context.json
```

### Integration with Package Scripts

```json
{
  "scripts": {
    "context": "stamp context",
    "context:compare": "stamp context compare base-context.json context.json --stats",
    "pretest": "npm run context:compare"
  }
}
```

---

## Related Commands

- `stamp context` - Generate context
- `stamp context --compare-modes` - Compare token costs across modes
- `stamp context --stats` - Get JSON stats
- `stamp context validate` - Validate context schema

---

## Help

```bash
$ stamp context compare --help

╭─────────────────────────────────────────────────╮
│  Stamp Context Compare - Drift Detection        │
│  Compare context files for changes              │
╰─────────────────────────────────────────────────╯

USAGE:
  stamp context compare [options]                 Auto-compare with fresh context
  stamp context compare <old.json> <new.json>     Compare two specific files

ARGUMENTS:
  <old.json>                          Path to old context file
  <new.json>                          Path to new context file

OPTIONS:
  --approve                           Auto-approve updates (non-interactive, CI-safe)
  --stats                             Show token count statistics
  -h, --help                          Show this help

EXAMPLES:
  stamp context compare
    Auto-mode: generate fresh context, compare with context.json
    → Interactive: prompts Y/N to update if drift detected
    → CI: exits with code 1 if drift detected (no prompt)

  stamp context compare --approve
    Auto-approve and update context.json if drift detected (like jest -u)

  stamp context compare --stats
    Show token count delta

  stamp context compare old.json new.json
    Compare two specific files (prompts Y/N to update old.json if drift)

  stamp context compare || exit 1
    CI validation: fail build if drift detected

EXIT CODES:
  0                                   PASS - No drift OR drift approved and updated
  1                                   DRIFT - Changes detected but not approved

BEHAVIOR:
  • --approve: Non-interactive, deterministic, updates immediately if drift
  • Interactive (TTY): Prompts "Update context.json? (y/N)" if drift
  • CI (non-TTY): Never prompts, exits 1 if drift detected
  • Validation runs during generation (fresh context always valid)

NOTES:
  This matches Jest snapshot workflow:
    jest          → prompts to update snapshots locally
    jest -u       → updates snapshots without prompt
    CI            → fails if snapshots don't match
```

---

## Summary

The compare command is your **context drift detector**:

✅ **Local Dev**: Auto-detects changes, prompts to update
✅ **CI/CD**: Detects drift, fails builds automatically
✅ **Jest-Style**: Familiar `--approve` flag workflow
✅ **Zero Config**: Just run `stamp context compare`

**Questions? Issues?** Report at https://github.com/yourusername/logicstamp-context/issues
