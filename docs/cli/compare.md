# `stamp context compare` Command

The `compare` command detects drift between context files. It compares regenerated context against existing context files on disk.

> **Note:** Context files are gitignored by default (`stamp init` sets this up). The compare command supports both **local development** (comparing against disk) and **git baseline** comparison (comparing against any git ref like branches, tags, or commits).

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

# Git baseline: Compare against a git ref (branch, tag, commit)
stamp context compare --baseline git:main
stamp context compare --baseline git:HEAD
stamp context compare --baseline git:v1.0.0

# With token statistics
stamp context compare --stats

# Suppress verbose output (show only diffs)
stamp context compare --quiet
```

---

### What It Does

The compare command now supports **three comparison modes**:

#### Single-File Mode
Creates a lightweight signature for each component in a single context file and detects:
- **Added components** – New components in the new context
- **Removed components** – Components that existed in old but not in new
- **Changed components** – Components with differences in:
  - Semantic hash (logic/structure changed)
  - Imports (dependencies changed)
  - Hooks (state management changed)
  - Functions, components, props, emits, exports
  - Variables (module-level variables changed)
  - State (component state variables changed)
  - API signature (backend API parameters, return types, request/response types changed)

**Note:** The compare command does **not** compare styles by design. Style changes (CSS, Tailwind classes, inline styles, etc.) are intentionally excluded from comparison as they represent visual/presentation changes rather than structural or logical changes.

#### Git Baseline Mode
Compares your **current working tree against a local git ref** (branch, tag, or commit). This mode:
- Creates a temporary git worktree at the specified ref
- Generates context for both the baseline and current code
- Compares the two generated contexts
- Cleans up automatically

> **Note:** Git baseline only works with **local refs** that exist in your local repository. Remote branches must be fetched first (e.g., `git fetch origin main` before using `--baseline git:origin/main`).

**How Semantic Hashes Work in Comparisons:**

Semantic hashes track meaningful structural and logical changes to components (props, emits, state, imports, hooks, functions, components). They are computed from the component's contract structure and provide a fast way to detect when a component's public API or internal structure has changed.

**Hash Behavior by Comparison Mode:**

1. **Git Baseline Mode** (`--baseline git:<ref>`):
   - **Hash-only changes are filtered**: When only the semantic hash differs (with no changes to imports, hooks, functions, components, props, emits, or exports), the hash change is ignored
   - **Hash changes with other changes are reported**: When the hash differs AND there are other structural changes, the hash is still reported to provide context
   - **Why filter hash-only?** TypeScript project resolution can produce slightly different AST structures between worktree and working directory contexts (different absolute paths, module resolution contexts, or TypeScript compiler state) even for functionally identical code. Filtering hash-only changes prevents false positives while preserving hash information when there are real changes.

2. **Regular Comparison Modes** (single-file, multi-file, auto-mode):
   - **All hash changes are reported**: Hash-only filtering does not apply—all hash changes are included in the comparison results
   - **Why always report?** In regular comparisons, both sides are generated from the same environment context, so hash differences reliably indicate actual structural changes

3. **Watch Mode** (`stamp context --watch`):
   - **Hashes drive incremental rebuilds**: Semantic hashes are used to detect which components changed and need rebuilding
   - **Bundle hashing**: Bundle-level hashes depend on component semantic hashes for efficient change detection

**Why Hashes Are Still Needed:**

Even though hash-only changes are filtered in git baseline mode, semantic hashes are still computed and used because:
- **Context for real changes**: When there ARE other changes (imports, props, etc.), the hash is still reported to provide context about what changed
- **Regular comparisons**: In non-git-baseline comparisons, hashes are always reported (hash-only filtering only applies to git baseline mode)
- **Watch mode**: Hashes are used for incremental rebuild detection in watch mode
- **Bundle hashing**: Bundle-level hashes depend on component semantic hashes for change detection
- **Contract integrity**: Hashes are part of the contract structure and used for validation

The filtering only suppresses hash-only noise in git baseline mode—hashes still provide value when there are real structural changes.

**Determinism in Git Baseline Mode:**

✅ **Yes, the workflow is deterministic for detecting meaningful changes.**

Even if semantic hashes differ between worktree and working directory (due to TypeScript resolution differences), the comparison will:
- **Always report the same structural/logical changes** for identical code
- **Filter out hash-only differences** that don't represent actual code changes
- **Report hash changes** when they occur alongside other structural changes

**Why hash differences occur with identical code:**
- Different absolute paths (worktree vs working directory)
- TypeScript module resolution context differences
- TypeScript compiler state differences

These are environment-dependent factors, not code changes. The comparison filters them out to ensure deterministic results.

**Example:** If you run `stamp context compare --baseline git:main` twice on the same codebase with no changes, you'll get the same comparison result (PASS or DRIFT) even if individual hash values differ between runs.

**File Exclusion Symmetry:**
Both baseline and current context generation use the working directory's `.stampignore` file for symmetric file scanning. This prevents false positives when `.stampignore` differs between the git ref and current state, ensuring consistent file exclusion patterns across both sides of the comparison.

**Git-Ignored File Filtering:**
Git-ignored files (like `next-env.d.ts`, `.env.local`, etc.) are automatically filtered from comparison results in git baseline mode. This prevents false positives where git-ignored files exist in your working directory but not in the git worktree (since git doesn't track them).

**Example:** If `next-env.d.ts` exists in your working directory but is git-ignored, it won't appear as an "added" component in the comparison results, even though it's included in context generation with `--skip-gitignore`. The comparison filters these files out before reporting results, ensuring only tracked files contribute to drift detection.

This is ideal for PR reviews, CI validation, and release checks.

#### Multi-File Mode
Compares **all context files** across your project using `context_main.json` as the root index and detects:
- **ADDED FILE** – New folders with context files (treated as growth, not drift)
- **ORPHANED FILE** – Folders removed from the project (triggers DRIFT)
- **DRIFT** – Changed files with component-level changes (triggers DRIFT)
- **PASS** – Unchanged files

**Important:** Only **ORPHANED FILE** and **DRIFT** statuses cause the overall comparison to result in DRIFT. **ADDED FILE** folders are treated as growth (new features/components) and do not trigger DRIFT status. This means:
- Adding new components or folders results in **PASS** status (ideal for CI/CD where new features shouldn't fail validation)
- Only removals and modifications trigger **DRIFT** status
- This behavior ensures that new development work doesn't unnecessarily fail validation checks

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

**Note:** Only removals (ORPHANED FILE) and modifications (DRIFT) trigger drift detection. New additions (ADDED FILE) result in PASS status, so adding new features won't fail CI validation.

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

#### 2. Git Baseline Mode

```bash
stamp context compare --baseline git:main
```

**What happens:**
1. Validates you're in a git repository
2. Resolves the git ref to a commit hash
3. Creates a git worktree at the specified ref
4. Generates context for the baseline (from worktree)
5. Generates context for the current working tree
6. Compares baseline vs current
7. Cleans up worktree and temp directories
8. Exits with code 1 if drift detected (useful for CI)

**Example output:**
```bash
Git baseline comparison
  Baseline: main (a1b2c3d4)
  Current:  working tree

🔄 Creating worktree at main...
🔄 Generating baseline context...
🔄 Generating current context...
🔍 Comparing baseline vs current...

⚠️  DRIFT

📁 Folder Summary:
   Total folders: 14
   ~  Changed folders: 2
   ✓  Unchanged folders: 12

📦 Component Summary:
   + Added: 3
   ~ Changed: 2

📊 Summary: Changes detected compared to main
```

**Use cases:**
- **PR review:** "What changed in this branch vs main?"
- **CI validation:** "Did this PR introduce breaking changes?"
- **Release checks:** "What changed since the last release tag?"

#### 3. Manual Mode - Single File

```bash
stamp context compare old.json new.json
```

**What happens:**
1. Compares two specific context files (folder `context.json` files)
2. Shows component-level differences
3. **Prompts to update old.json** with new.json (in terminal)
4. **Exits with error** if drift detected (in CI)

Use this when you want to compare specific snapshots or versions.

#### 4. Manual Mode - Multi-File

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

**Note:** In this example, the overall status is `⚠️ DRIFT` because there are changed folders (`~ Changed folders: 2`). If there were **only** added folders (no changed or orphaned folders), the status would be `✅ PASS` instead, since additions are growth, not drift.

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

**Note:** In this example, the overall status is `⚠️ DRIFT` because there are **ORPHANED FILE** folders (`🗑️ Orphaned folders: 1`) and **DRIFT** folders (`~ Changed folders: 2`). The `➕ ADDED FILE` folder alone would not cause DRIFT status—only removals and modifications trigger DRIFT.

**Folder Status Indicators:**
- **➕ ADDED FILE** – New folder with context file (results in PASS status - growth, not drift)
- **🗑️ ORPHANED FILE** – Folder removed (context file still exists) (triggers DRIFT status)
- **⚠️ DRIFT** – Folder has component changes (triggers DRIFT status)
- **✅ PASS** – Folder unchanged

**Drift Detection Logic:**
- **ADDED FILE** folders contribute to **PASS** status (new components/folders are growth, not drift)
- **ORPHANED FILE** and **DRIFT** folders cause the overall comparison to result in **DRIFT**
- This ensures CI/CD workflows don't fail when adding new features, only when removing or modifying existing contracts

**Detailed Diff Breakdown:**
- **hash**: Shows old and new semantic hash values (indicates structure/logic changed)
- **imports**: Shows removed (`-`) and added (`+`) import dependencies
- **hooks**: Shows removed (`-`) and added (`+`) React hooks
- **functions**: Shows removed (`-`) and added (`+`) functions in the module
- **components**: Shows removed (`-`) and added (`+`) React components used
- **props**: Shows removed (`-`) and added (`+`) component props
- **propsChanged**: Shows prop type changes (`~ propName: "string" → "number"`)
- **emits**: Shows removed (`-`) and added (`+`) events/callbacks
- **emitsChanged**: Shows emit type changes (`~ eventName: "(old signature)" → "(new signature)"`)
- **variables**: Shows removed (`-`) and added (`+`) module-level variables
- **state**: Shows removed (`-`) and added (`+`) component state variables
- **exports**: Shows export kind change (e.g., `named → default`)
- **apiSignature**: Shows API signature changes for backend files:
  - Parameters added/removed/changed (with type information)
  - Return type changes
  - Request/response type changes

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
| `0` | PASS – No drift detected (includes additions only) | CI validation passed |
| `0` | DRIFT approved and updated | User approved changes or `--approve` used |
| `1` | DRIFT – Changes detected but not approved (removals/modifications) | CI validation failed |
| `1` | DRIFT – User declined update (typed `n`) | Local dev declined changes |
| `1` | Error (file not found, invalid JSON, generation failed) | Fatal error occurred |

**Key Points:**

- Exit 0 = Success (no drift OR drift was approved/updated)
  - **Includes additions only**: New components/folders result in PASS (exit 0)
  - **Only removals/modifications trigger DRIFT**: ORPHANED FILE and DRIFT folders cause exit 1
- Exit 1 = Failure (drift not approved OR error)
- This matches Jest snapshot behavior exactly

---

### CI/CD Integration

The git baseline feature makes CI/CD integration straightforward. No need to commit context files or use complex manual workflows.

#### GitHub Actions Example (Git Baseline)

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
          fetch-depth: 0  # Required for git baseline to access branch history

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Check for context drift against main
        run: stamp context compare --baseline git:origin/main --stats

      - name: Comment on PR if drift detected
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ Context drift detected! This PR introduces changes to component contracts compared to main branch.'
            })
```

#### GitHub Actions Example (Compare Against Last Commit)

```yaml
name: Context Drift Check (Last Commit)

on:
  push:
    branches: [main]

jobs:
  check-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 2  # Need at least 2 commits for HEAD~1

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Check for context drift against previous commit
        run: stamp context compare --baseline git:HEAD~1 --stats
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
   - If only in new: ADDED FILE (treated as PASS, not drift)
   - If only in old: ORPHANED FILE (triggers DRIFT)
4. **Find Orphaned on Disk** – Checks if old files still exist on disk
5. **Aggregate Results** – Combines into three-tier output:
   - Folder-level summary
   - Component-level summary
   - Detailed per-folder changes
   - **Overall status**: PASS if only additions, DRIFT if removals or modifications exist
6. **Handle Approval** – If approved, copies all new files and optionally cleans orphaned files

**Key Design Decisions:**
- **Truth comes from bundles**, not metadata (summary counts can drift)
- **Bundle→folder mapping** is checked (in `context_main.json`)
- **Folder structure** is compared (exists/missing/orphaned)
- **Metadata fields are NOT compared** (totalComponents, totalBundles are derived stats)

---

### Delta Types Explained

- **Hash changes** – component structure or logic changed. 
  - **In git baseline mode**: Hash-only changes (without other changes) are filtered out to ensure deterministic structural comparison, preventing false positives from environment-dependent TypeScript resolution differences. Hash changes are still reported when they occur alongside other structural changes.
  - **In regular comparison modes**: All hash changes are reported, as both sides are generated from the same environment context.
- **Import changes** – import dependencies added/removed or order changed.
- **Hook changes** – React hooks usage changed.
- **Function changes** – functions declared in the module added/removed.
- **Component changes** – referenced React components changed.
- **Prop changes** – component props added/removed, or prop types changed (e.g., `string` → `number`).
  - **In git baseline mode**: Only added/removed props are detected; type changes are skipped to avoid false positives from TypeScript resolution differences.
  - **In regular comparison modes**: Both added/removed and type changes are detected.
- **Event/emit changes** – events/callbacks added/removed, or emit types changed.
  - Same git baseline behavior as props: type changes only detected in regular comparison modes.
- **Variable changes** – module-level variables added/removed or changed.
- **State changes** – component state variables added/removed or changed.
- **Export changes** – export type changed (e.g., from `export default` to `export const`).
- **API signature changes** – backend API signature changed (parameters added/removed/changed, return type changed, request/response types changed).

**What is NOT compared:**
- **Styles** – CSS classes, Tailwind utilities, inline styles, and other styling-related metadata are intentionally excluded. 
  Compare Mode focuses strictly on structural and logical contract changes, not visual/presentation differences.

---

### Use Cases

- **Git baseline comparison** – Compare against any local git ref (branch, tag, commit)
- **PR review** – "What changed in this branch vs main?" with `--baseline git:main`
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
- **Git baseline**: compare against any local git ref with `--baseline git:<ref>`
- **Jest-style**: familiar `--approve` flag workflow
- **Zero config**: just run `stamp context compare`
- **Three-tier output**: folder summary → component summary → detailed changes
- **Orphaned file cleanup**: automatically clean up stale files with `--clean-orphaned`

> **Tip:** For real-time breaking change detection during development, use `stamp context --strict-watch`. For CI-based comparison against git refs, use `--baseline git:main` or `--baseline git:origin/main`.

---

### Frequently Asked Questions

#### Q: Is git baseline comparison deterministic?

**A: Yes, the workflow is deterministic for detecting meaningful changes.**

Even when semantic hashes differ between worktree and working directory (which can happen due to TypeScript resolution differences), the comparison will:
- Always produce the same result (PASS or DRIFT) for identical code
- Filter out hash-only differences that don't represent actual code changes
- Report hash changes when they occur alongside other structural changes

**Example:** Running `stamp context compare --baseline git:main` twice on the same codebase with no changes will produce identical comparison results, even if individual hash values differ between runs.

#### Q: Why do I see hash differences even when there are no git diffs?

**A: This is expected and correctly handled.**

Semantic hashes can differ between worktree and working directory contexts even for identical code due to:
- Different absolute paths (worktree vs working directory)
- TypeScript module resolution context differences
- TypeScript compiler state differences

These are environment-dependent factors, not code changes. The comparison filters out hash-only differences to ensure deterministic results. If you see hash differences but no structural changes (imports, props, hooks, etc.), the comparison will correctly report PASS.

#### Q: Should I be concerned if hashes differ but no other changes are reported?

**A: No, this is normal and expected.**

Hash-only differences are filtered out in git baseline mode because they don't represent actual code changes. The comparison focuses on structural and logical changes (props, imports, hooks, functions, components, emits, exports), which are deterministic regardless of environment differences.

If you want to see all hash changes (including hash-only), use regular comparison mode instead of git baseline mode.

#### Q: Why don't I see git-ignored files like `next-env.d.ts` in comparison results?

**A: Git-ignored files are automatically filtered from comparison results in git baseline mode.**

When comparing against a git baseline with `--skip-gitignore`, git-ignored files are included in context generation but filtered out from comparison results. This prevents false positives where git-ignored files (like `next-env.d.ts`, `.env.local`, etc.) exist in your working directory but not in the git worktree.

**Example:** If `next-env.d.ts` exists in your working directory but is git-ignored, it won't appear as an "added" component in the comparison results, even though it's included in context generation. The comparison filters these files out before reporting results, ensuring only tracked files contribute to drift detection.

This behavior is automatic and requires no configuration. If you need to see git-ignored files in comparisons, you can add them to `.stampignore` to exclude them from context generation entirely.

#### Q: Why do ADDED FILE folders result in PASS instead of DRIFT?

**A: Additions are treated as growth, not drift, to support healthy development workflows.**

The compare command distinguishes between:
- **Growth** (additions) – New components and folders are expected during development and should not fail validation
- **Drift** (removals/modifications) – Changes to existing contracts may indicate breaking changes that need review

**Behavior:**
- **ADDED FILE** folders alone result in **PASS** status (exit code 0)
- Only **ORPHANED FILE** (removals) and **DRIFT** (modifications) trigger **DRIFT** status (exit code 1)

**Why this matters for CI/CD:**
- New features and components can be added without failing validation checks
- Only actual breaking changes (removals/modifications) trigger failures
- This prevents false positives in PR validation where new work is expected

**Example:** If you add a new feature folder with components, the comparison will show `➕ ADDED FILE` but still result in `✅ PASS` status, allowing CI to pass. Only if you remove or modify existing components will it result in `⚠️ DRIFT` status.

#### Q: Why don't I see prop/emit type changes in git baseline mode?

**A: Type changes are intentionally skipped in git baseline mode to avoid false positives.**

When comparing against a git baseline (`--baseline git:<ref>`), prop and emit **type changes** are not detected—only added/removed props and emits are reported. This is because:

- TypeScript resolution can produce slightly different type representations between worktree and working directory contexts
- The same prop might be extracted as `"string"` in one context and `{ type: "string" }` in another
- These are environment-dependent differences, not actual code changes

**In regular comparison modes** (direct file comparison), both added/removed and type changes are detected since both sides are generated from the same environment.

**Workaround:** If you need to detect prop type changes, use direct file comparison instead of git baseline mode, or ensure both contexts are generated from the same environment.

