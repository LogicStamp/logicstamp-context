# Compare Command Documentation

The `compare` command is a powerful tool for detecting drift between two context.json files.

## Quick Start

```bash
logicstamp-context compare old.json new.json
logicstamp-context compare old.json new.json --stats
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

## Output Format

### PASS (No Drift)

```bash
$ logicstamp-context compare old.json new.json

✅ PASS
```

Exit code: `0`

### DRIFT Detected

```bash
$ logicstamp-context compare old.json new.json

⚠️  DRIFT

Added components: 2
  + src/components/NewButton.tsx
  + src/utils/tokens.ts

Removed components: 1
  - src/components/OldButton.tsx

Changed components: 3
  ~ src/components/Card.tsx
    Δ imports, hooks
  ~ src/App.tsx
    Δ hash
  ~ src/utils/helpers.ts
    Δ exports
```

Exit code: `1`

---

## With Token Statistics

Add `--stats` to see token cost impact:

```bash
$ logicstamp-context compare old.json new.json --stats

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

---

## Exit Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| `0` | PASS - No drift | CI validation passed |
| `1` | DRIFT - Changes detected | CI validation failed |
| `1` | Error (file not found, invalid JSON) | CI validation failed |

---

## CI/CD Integration

### GitHub Actions Example

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
        with:
          fetch-depth: 0  # Need history for base comparison

      - name: Install LogicStamp Context
        run: npm install -g logicstamp-context

      - name: Generate PR context
        run: logicstamp-context --out pr-context.json

      - name: Checkout base branch
        run: git checkout ${{ github.base_ref }}

      - name: Generate base context
        run: logicstamp-context --out base-context.json

      - name: Compare contexts
        run: |
          logicstamp-context compare base-context.json pr-context.json --stats

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
    - logicstamp-context --out new-context.json
    - git fetch origin $CI_MERGE_REQUEST_TARGET_BRANCH_NAME
    - git checkout origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME
    - logicstamp-context --out base-context.json
    - git checkout $CI_COMMIT_SHA
    - logicstamp-context compare base-context.json new-context.json --stats
  allow_failure: false
  only:
    - merge_requests
```

### Simple Shell Script

```bash
#!/bin/bash
# compare-contexts.sh

set -e

# Generate current context
logicstamp-context --out current.json

# Generate previous context (from main branch)
git stash
git checkout main
logicstamp-context --out previous.json
git checkout -
git stash pop || true

# Compare
if logicstamp-context compare previous.json current.json --stats; then
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

| Delta | Meaning | Example |
|-------|---------|---------|
| `hash` | Semantic hash changed (structure/logic changed) | Added a new function, changed prop types |
| `imports` | Import dependencies changed | Added/removed imports |
| `hooks` | React hooks changed | Added useState, removed useEffect |
| `exports` | Export kind changed | Changed from default to named export |

---

## Use Cases

### 1. Pre-Merge Validation

Ensure context changes are intentional before merging:

```bash
# In CI
logicstamp-context compare base.json pr.json || exit 1
```

### 2. Cost Impact Analysis

See how changes affect token costs:

```bash
logicstamp-context compare base.json pr.json --stats
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
if ! logicstamp-context compare base.json new.json; then
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
logicstamp-context --out pr-context.json

# Compare against main
logicstamp-context compare base-context.json pr-context.json
```

### 3. Monitor Token Growth

```bash
# Track token costs over time
logicstamp-context compare old.json new.json --stats | tee cost-report.txt
```

### 4. Combine with Strict Mode

```bash
# Ensure no drift AND no missing deps
logicstamp-context --strict-missing --out new.json
logicstamp-context compare base.json new.json
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
logicstamp-context --include-code none --out none.json
logicstamp-context --include-code header --out header.json
logicstamp-context compare none.json header.json --stats
```

### Batch Comparison

```bash
# Compare multiple versions
for version in v1 v2 v3; do
  git checkout $version
  logicstamp-context --out $version-context.json
done

logicstamp-context compare v1-context.json v2-context.json
logicstamp-context compare v2-context.json v3-context.json
```

### Integration with Package Scripts

```json
{
  "scripts": {
    "context": "logicstamp-context",
    "context:compare": "logicstamp-context compare base-context.json context.json --stats",
    "pretest": "npm run context:compare"
  }
}
```

---

## Related Commands

- `logicstamp-context` - Generate context
- `logicstamp-context --compare-modes` - Compare token costs across modes
- `logicstamp-context --stats` - Get JSON stats
- `logicstamp-validate` - Validate context schema

---

## Help

```bash
$ logicstamp-context compare --help

╭─────────────────────────────────────────────────╮
│  LogicStamp Context Compare                     │
│  Diff two context.json files                    │
╰─────────────────────────────────────────────────╯

USAGE:
  logicstamp-context compare <old.json> <new.json> [options]

OPTIONS:
  --stats              Show token count statistics
  -h, --help           Show this help
```

---

**Questions? Issues?** Report at https://github.com/yourusername/logicstamp-context/issues
