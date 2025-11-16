## Compare Command Documentation

The `compare` command is a powerful tool for detecting drift between `context.json` files. It works like **Jest snapshots** – automatically comparing your current code against a baseline context.

### Quick Start

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

### What It Does

The compare command creates a lightweight signature for each component and detects:

1. **Added components** – New components in the new context
2. **Removed components** – Components that existed in old but not in new
3. **Changed components** – Components that exist in both but have differences:
   - Semantic hash changes (logic/structure changed)
   - Import changes (dependencies changed)
   - Hook changes (state management changed)
   - Export changes (default ↔ named)

---

### Two Modes of Operation

#### Auto-Mode (Recommended)

```bash
stamp context compare
```

**What happens:**
1. Generates a fresh context based on your current code
2. Compares it with existing `context.json`
3. Shows you what changed
4. **Prompts you to update** if drift detected (in terminal)
5. **Exits with error** if drift detected (in CI)

This is perfect for local development – just run it after making changes!

#### Manual Mode

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

### Approval Workflow (Jest-Style)

The compare command follows Jest snapshot patterns:

#### 1. Interactive Mode (Local Dev)

```bash
stamp context compare
```

Typical output:

```bash
⚠️  DRIFT

Changed components: 1
  ~ src/components/Button.tsx
    Δ hash

Update context.json? (y/N) y
✅ context.json updated successfully
```

- Only in terminals (TTY mode)
- Prompts Y/N if drift detected
- Updates if you type `y`
- Declines if you press Enter or type anything else

#### 2. Auto-Approve Mode (CI-Safe)

```bash
stamp context compare --approve
```

Typical output:

```bash
⚠️  DRIFT

Changed components: 1
  ~ src/components/Button.tsx
    Δ hash

🔄 --approve flag set, updating context.json...
✅ context.json updated successfully
```

- Non-interactive – no prompts
- Deterministic – always updates if drift
- Works everywhere – scripts, CI, terminals
- Like `jest -u` for snapshots

#### 3. CI Mode (Auto-Detected)

```bash
stamp context compare
```

Typical output:

```bash
⚠️  DRIFT

Changed components: 1
  ~ src/components/Button.tsx
    Δ hash
```

- Never prompts (non-TTY detected)
- Exits with code 1 if drift
- Never hangs or blocks

---

### Output Format

#### PASS (No Drift)

```bash
stamp context compare old.json new.json

✅ PASS
```

Exit code: `0`

#### DRIFT Detected

```bash
stamp context compare old.json new.json

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
    Δ components
      + Modal
      - Tooltip
    Δ props
      + variant
      + size
  ~ src/App.tsx
    Δ hash
      old: uifb:abc123456789012345678901
      new: uifb:def456789012345678901234
    Δ functions
      + handleSubmit
      - handleClick
  ~ src/utils/helpers.ts
    Δ exports
      named → default
    Δ emits
      + onChange
```

Exit code: `1`

**Detailed Diff Breakdown:**

- **hash**: Shows old and new semantic hash values (indicates structure/logic changed)
- **imports**: Shows removed (`-`) and added (`+`) import dependencies
- **hooks**: Shows removed (`-`) and added (`+`) React hooks
- **functions**: Shows removed (`-`) and added (`+`) functions in the module
- **components**: Shows removed (`-`) and added (`+`) React components used
- **props**: Shows removed (`-`) and added (`+`) component props
- **emits**: Shows removed (`-`) and added (`+`) events/callbacks
- **exports**: Shows export kind change (e.g., `named → default`)

---

### With Token Statistics

Add `--stats` to see token cost impact:

```bash
stamp context compare old.json new.json --stats
```

Typical output:

```bash
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

### Exit Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| `0` | PASS – No drift detected | CI validation passed |
| `0` | DRIFT approved and updated | User approved changes or `--approve` used |
| `1` | DRIFT – Changes detected but not approved | CI validation failed |
| `1` | DRIFT – User declined update (typed `n`) | Local dev declined changes |
| `1` | Error (file not found, invalid JSON, generation failed) | Fatal error occurred |

**Key Points:**

- Exit 0 = Success (no drift OR drift was approved/updated)
- Exit 1 = Failure (drift not approved OR error)
- This matches Jest snapshot behavior exactly

---

### CI/CD Integration

#### GitHub Actions Example (Auto-Mode)

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

#### GitHub Actions Example (Manual Comparison)

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
          fetch-depth: 0

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

#### GitLab CI Example

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

#### Shell Script (Auto-Mode)

```bash
#!/bin/bash
# check-drift.sh

if stamp context compare --stats; then
  echo "✅ No context drift detected"
  exit 0
else
  echo "⚠️  Context drift detected - see details above"
  echo "Run 'stamp context compare --approve' to update"
  exit 1
fi
```

#### Shell Script (Manual Comparison)

```bash
#!/bin/bash
# compare-contexts.sh

set -e

stamp context --out current.json

git stash
git checkout main
stamp context --out previous.json
git checkout -
git stash pop || true

if stamp context compare previous.json current.json --stats; then
  echo "✅ No context drift detected"
  exit 0
else
  echo "⚠️  Context drift detected - see details above"
  exit 1
fi

rm previous.json current.json
```

---

### Local Development Workflow

#### Typical Workflow

```bash
stamp context
stamp context compare
```

Example:

```bash
stamp context
✅ Context written successfully

stamp context compare
⚠️  DRIFT

Changed components: 1
  ~ src/components/Button.tsx
    Δ hash

Update context.json? (y/N) y
✅ context.json updated successfully
```

#### Quick Update Workflow

```bash
stamp context compare --approve
```

Like `jest -u` – perfect for rapid iteration.

#### Pre-Commit Hook

```bash
#!/bin/bash

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

### How It Works

#### 1. LiteSig Index Creation

For each bundle in the context file, a lightweight signature is created:

```typescript
interface LiteSig {
  semanticHash: string;
  imports: string[];
  hooks: string[];
  exportKind: 'default' | 'named' | 'none';
}
```

#### 2. Index by Entry ID

```typescript
Map<string, LiteSig>
// Key: normalized entryId (lowercase)
// Value: LiteSig for that component
```

#### 3. Compute Diff

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

#### 4. Generate Output

- PASS if no changes
- DRIFT if any added/removed/changed
- Optional token stats if `--stats` provided

---

### Delta Types Explained

- **Hash changes** – component structure or logic changed.
- **Import changes** – import dependencies added/removed or order changed.
- **Hook changes** – React hooks usage changed.
- **Function changes** – functions declared in the module added/removed.
- **Component changes** – referenced React components changed.
- **Prop changes** – component API surface changed.
- **Event/emit changes** – event/callback interface changed.
- **Export changes** – export type changed (e.g., from `export default` to `export const`).

---

### Use Cases

- **Pre-merge validation** – ensure context changes are intentional before merging.
- **Cost impact analysis** – see how changes affect token costs with `--stats`.
- **Breaking change detection** – detect when component signatures change.
- **Documentation triggers** – trigger doc updates when context drifts.

---

### Performance & Limitations

- **Performance**
  - Fast: O(n) complexity with hash-based indexing.
  - Lightweight: only essential signature data.
  - Typical: \<100ms for most projects.

- **Limitations**
  - Entry ID matching uses case-insensitive exact match.
  - No fuzzy matching; renamed files show as removed + added.
  - No deep semantic analysis; compares signatures, not behavior.

---

### Summary

The compare command is your **context drift detector**:

- **Local dev**: auto-detects changes and prompts to update.
- **CI/CD**: detects drift and fails builds automatically.
- **Jest-style**: familiar `--approve` flag workflow.
- **Zero config**: just run `stamp context compare`.


