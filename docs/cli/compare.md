# `stamp context compare` Command

The `compare` command detects drift between context files. It compares regenerated context against existing context files on disk.

> **Note:** Context files are gitignored by default (`stamp init` sets this up). The compare command is primarily useful for **local development** - comparing your current code against previously generated context files. For CI-based comparison against git refs (e.g., `git:main`), see the [roadmap](https://logicstamp.dev/roadmap).

### Quick Start

```bash
# Auto-mode: Generate fresh context and compare ALL context files
stamp context compare

# Auto-approve updates (like jest -u)
stamp context compare --approve

# Clean up orphaned files automatically
stamp context compare --approve --clean-orphaned

# Manual mode: Compare two specific files
stamp context compare old.json new.json

# Multi-file mode: Compare two context_main.json indices
stamp context compare old/context_main.json new/context_main.json

# With token statistics
stamp context compare --stats

# Suppress verbose output (show only diffs)
stamp context compare --quiet
```

---

### What It Does

The compare command now supports **two comparison modes**:

#### Single-File Mode
Creates a lightweight signature for each component in a single context file and detects:
- **Added components** – New components in the new context
- **Removed components** – Components that existed in old but not in new
- **Changed components** – Components with differences in:
  - Semantic hash (logic/structure changed)
  - Imports (dependencies changed)
  - Hooks (state management changed)
  - Functions, components, props, emits, exports

**Note:** The compare command does **not** compare styles by design. Style changes (CSS, Tailwind classes, inline styles, etc.) are intentionally excluded from comparison as they represent visual/presentation changes rather than structural or logical changes.

#### Multi-File Mode (NEW)
Compares **all context files** across your project using `context_main.json` as the root index and detects:
- **ADDED FILE** – New folders with context files
- **ORPHANED FILE** – Folders removed from the project
- **DRIFT** – Changed files with component-level changes
- **PASS** – Unchanged files

---

### Three Modes of Operation

#### 1. Auto-Mode (Recommended) - Multi-File

```bash
stamp context compare
```

**What happens:**
1. Checks if `context_main.json` exists (errors if not found)
2. Generates fresh context files based on your current code (all folders)
3. Compares **all context files** using the indices
4. Shows a **three-tier output**:
   - Folder-level summary (added/orphaned/changed/unchanged)
   - Component-level summary (total added/removed/changed)
   - Detailed per-folder component changes
5. Prompts you to update if drift detected (in terminal)
6. Exits with error if drift detected (in CI)

This is perfect for local development – just run it after making changes!

**Example output:**
```bash
✅  PASS

📁 Folder Summary:
   Total folders: 14
   ✓  Unchanged folders: 14

📂 Folder Details:

   ✅ PASS: src/cli/context.json
      Path: src/cli

   ✅ PASS: src/core/context.json
      Path: src/core
   ...
```

#### 2. Manual Mode - Single File

```bash
stamp context compare old.json new.json
```

**What happens:**
1. Compares two specific context files (folder `context.json` files)
2. Shows component-level differences
3. **Prompts to update old.json** with new.json (in terminal)
4. **Exits with error** if drift detected (in CI)

Use this when you want to compare specific snapshots or versions.

#### 3. Manual Mode - Multi-File

```bash
stamp context compare old/context_main.json new/context_main.json
```

**What happens:**
1. Auto-detects that you're comparing `context_main.json` files
2. Loads both indices and compares **all referenced context files**
3. Shows three-tier output (folder summary + component summary + details)
4. **Prompts to update all files** if drift detected (in terminal)
5. **Exits with error** if drift detected (in CI)

Use this when comparing different branches, commits, or environments.

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

📁 Folder Summary:
   Total folders: 14
   ➕ Added folders: 1
   ~  Changed folders: 2
   ✓  Unchanged folders: 11

📦 Component Summary:
   + Added: 3
   ~ Changed: 2

📂 Folder Details:

   ➕ ADDED FILE: src/new-feature/context.json
      Path: src/new-feature

   ⚠️  DRIFT: src/cli/commands/context.json
      Path: src/cli/commands
      + Added components (1):
        + compare.ts
      ~ Changed components (1):
        ~ context.ts
          Δ hash
            old: uif:abc123456789012345678901
            new: uif:def456789012345678901234

Update all context files? (y/N) y
✅ 15 context files updated successfully
```

- Only in terminals (TTY mode)
- Prompts Y/N if drift detected
- Updates **all affected files** if you type `y`
- Declines if you press Enter or type anything else

#### 2. Auto-Approve Mode (CI-Safe)

```bash
stamp context compare --approve
```

Typical output:

```bash
⚠️  DRIFT

📁 Folder Summary:
   Total folders: 14
   ~  Changed folders: 1

🔄 --approve flag set, updating all context files...
   ✓ Updated src/cli/commands/context.json
   ✓ Updated context_main.json
✅ 2 context files updated successfully
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

📁 Folder Summary:
   Total folders: 14
   ~  Changed folders: 1

📦 Component Summary:
   ~ Changed: 2
```

- Never prompts (non-TTY detected)
- Exits with code 1 if drift
- Never hangs or blocks

---

### Output Format

#### Multi-File PASS (No Drift)

```bash
stamp context compare

✅  PASS

📁 Folder Summary:
   Total folders: 14
   ✓  Unchanged folders: 14

📂 Folder Details:

   ✅ PASS: context.json
      Path: .

   ✅ PASS: src/cli/context.json
      Path: src/cli
   ...
```

Exit code: `0`

#### Multi-File DRIFT Detected

```bash
stamp context compare

⚠️  DRIFT

📁 Folder Summary:
   Total folders: 15
   ➕ Added folders: 1
   🗑️  Orphaned folders: 1
   ~  Changed folders: 2
   ✓  Unchanged folders: 11

📦 Component Summary:
   + Added: 5
   - Removed: 2
   ~ Changed: 3

📂 Folder Details:

   ➕ ADDED FILE: src/new-feature/context.json
      Path: src/new-feature

   🗑️  ORPHANED FILE: src/old-feature/context.json
      Path: src/old-feature

   ⚠️  DRIFT: src/components/context.json
      Path: src/components
      + Added components (2):
        + NewButton.tsx
        + Modal.tsx
      - Removed components (1):
        - OldButton.tsx
      ~ Changed components (2):
        ~ Card.tsx
          Δ imports
            - ./old-dependency
            + ./new-dependency
          Δ hooks
            + useState
            + useEffect
        ~ Button.tsx
          Δ hash
            old: uif:abc123456789012345678901
            new: uif:def456789012345678901234
      Token Δ: +641 (GPT-4) | +569 (Claude)

   ✅ PASS: src/utils/context.json
      Path: src/utils

🗑️  Orphaned Files on Disk:
   (These files exist on disk but are not in the new index)

   🗑️  src/deprecated/context.json
```

Exit code: `1`

**Folder Status Indicators:**
- **➕ ADDED FILE** – New folder with context file
- **🗑️ ORPHANED FILE** – Folder removed (context file still exists)
- **⚠️ DRIFT** – Folder has component changes
- **✅ PASS** – Folder unchanged

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

### Orphaned File Cleanup

When folders are removed from your project, their context files may still exist on disk. Use `--clean-orphaned` to automatically delete them:

```bash
stamp context compare --approve --clean-orphaned
```

**What happens:**
1. Detects orphaned files (exist on disk but not in new index)
2. With `--approve`: Automatically deletes them
3. Without `--approve`: Only reports them

**Example:**
```bash
🗑️  Orphaned Files on Disk:
   🗑️  src/old-feature/context.json

🗑️  Cleaning up orphaned files...
   🗑️  Deleted: src/old-feature/context.json
   ✓ Deleted 1 orphaned file(s)
```

---

### With Token Statistics

Add `--stats` to see per-folder token cost impact:

```bash
stamp context compare --stats
```

Typical output:

```bash
⚠️  DRIFT

📁 Folder Summary:
   Total folders: 14
   ~  Changed folders: 2

📦 Component Summary:
   + Added: 3
   ~ Changed: 2

📂 Folder Details:

   ⚠️  DRIFT: src/cli/commands/context.json
      Path: src/cli/commands
      + Added components (1):
        + compare.ts
      ~ Changed components (1):
        ~ context.ts
          Δ imports
            + ../../utils/tokens.js
      Token Δ: +1,234 (GPT-4) | +1,098 (Claude)

   ⚠️  DRIFT: src/core/context.json
      Path: src/core
      ~ Changed components (1):
        ~ pack.ts
          Δ functions
            + multiFileCompare
      Token Δ: +892 (GPT-4) | +793 (Claude)
```

Token stats show the delta for each folder with changes.

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

> **Important:** By default, context files are gitignored and won't exist in CI. The examples below require either:
> 1. **Committing context files** - Remove them from `.gitignore` (not recommended)
> 2. **Manual baseline generation** - Generate context at two points and compare (shown in second example)
>
> **Coming soon:** Native git baseline support (`git:main`, `git:HEAD~1`) will simplify CI workflows without requiring committed context files.

#### GitHub Actions Example (Auto-Mode Multi-File)

> ⚠️ This example only works if context files are committed to git (not the default setup).

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
              body: '⚠️ Context drift detected across multiple folders! Run `stamp context compare --approve` locally to update all context files, then commit the changes.'
            })

      - name: Fail if drift detected
        if: steps.drift_check.outcome == 'failure'
        run: exit 1
```

#### GitHub Actions Example (Manual Multi-File Comparison)

> This workaround generates context at two git refs manually. Native git baseline support is planned.

```yaml
name: Context Drift Check (Multi-File)

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
        run: stamp context --out pr-context

      - name: Checkout base branch
        run: git checkout ${{ github.base_ref }}

      - name: Generate base context
        run: stamp context --out base-context

      - name: Compare all context files
        run: |
          stamp context compare base-context/context_main.json pr-context/context_main.json --stats

      - name: Comment on PR if drift detected
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ Context drift detected! Please review the folder-level and component-level changes.'
            })
```

#### Shell Script (Auto-Mode)

```bash
#!/bin/bash
# check-drift.sh

if stamp context compare --stats; then
  echo "✅ No context drift detected across all folders"
  exit 0
else
  echo "⚠️  Context drift detected - see folder details above"
  echo "Run 'stamp context compare --approve' to update all files"
  exit 1
fi
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
✅ 15 context files written successfully

stamp context compare
⚠️  DRIFT

📁 Folder Summary:
   Total folders: 14
   ~  Changed folders: 1

📂 Folder Details:

   ⚠️  DRIFT: src/components/context.json
      Path: src/components
      ~ Changed components (1):
        ~ Button.tsx
          Δ hash
            old: uif:abc123456789012345678901
            new: uif:def456789012345678901234

Update all context files? (y/N) y
✅ 2 context files updated successfully
```

#### Quick Update Workflow

```bash
stamp context compare --approve
```

Like `jest -u` – perfect for rapid iteration across all folders.

#### Pre-Commit Hook

```bash
#!/bin/bash

if ! stamp context compare; then
  echo ""
  echo "❌ Context drift detected across multiple folders!"
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

#### Single-File Mode

1. **LiteSig Index Creation** – Creates lightweight signatures for each component
2. **Index by Entry ID** – Maps normalized entryId to LiteSig
3. **Compute Diff** – Detects added/removed/changed components
4. **Generate Output** – Shows PASS or DRIFT with detailed deltas

#### Multi-File Mode (NEW)

1. **Load Indices** – Loads both `context_main.json` files
2. **Discover Folders** – Gets list of all context files from both indices
3. **Compare Per-Folder** – For each folder:
   - If in both: Compare context files (PASS or DRIFT)
   - If only in new: ADDED FILE
   - If only in old: ORPHANED FILE
4. **Find Orphaned on Disk** – Checks if old files still exist on disk
5. **Aggregate Results** – Combines into three-tier output:
   - Folder-level summary
   - Component-level summary
   - Detailed per-folder changes
6. **Handle Approval** – If approved, copies all new files and optionally cleans orphaned files

**Key Design Decisions:**
- **Truth comes from bundles**, not metadata (summary counts can drift)
- **Bundle→folder mapping** is checked (in `context_main.json`)
- **Folder structure** is compared (exists/missing/orphaned)
- **Metadata fields are NOT compared** (totalComponents, totalBundles are derived stats)

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

**What is NOT compared:**
- **Styles** – CSS classes, Tailwind utilities, inline styles, and other styling-related metadata are intentionally excluded. 
  Compare Mode focuses strictly on structural and logical contract changes, not visual/presentation differences.

---

### Use Cases

- **Multi-folder drift detection** – See which folders have changes at a glance
- **Pre-merge validation** – Ensure context changes are intentional before merging
- **Cost impact analysis** – See per-folder token cost impact with `--stats`
- **Breaking change detection** – Detect when component signatures change across the project
- **Folder reorganization** – Detect ADDED/ORPHANED files when restructuring
- **Orphaned file cleanup** – Automatically remove stale context files with `--clean-orphaned`

---

### Performance & Limitations

- **Performance**
  - Fast: O(n × m) where n = folders, m = components per folder
  - Lightweight: only essential signature data
  - Typical: <500ms for most projects with multi-file mode

- **Limitations**
  - Entry ID matching uses case-insensitive exact match
  - No fuzzy matching; renamed files show as removed + added
  - No deep semantic analysis; compares signatures, not behavior
  - Orphaned file detection requires files to exist on disk

---

### Summary

The compare command detects context drift with multi-file support:

- **Local dev**: auto-detects changes across all folders and prompts to update
- **Jest-style**: familiar `--approve` flag workflow
- **Zero config**: just run `stamp context compare`
- **Three-tier output**: folder summary → component summary → detailed changes
- **Orphaned file cleanup**: automatically clean up stale files with `--clean-orphaned`

> **Note:** For real-time breaking change detection during development, use `stamp context --watch --strict-watch` instead. For CI-based comparison against git refs, see the [roadmap](https://logicstamp.dev/roadmap).

