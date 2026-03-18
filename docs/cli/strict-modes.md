# Comparison: `compare --strict` vs `--strict-watch`

This document compares the two strict mode options available in LogicStamp Context.

## Quick Answer

**Q: Does strict watch mode contain API signature comparisons as well?**  
**A: No.** API signature changes are tracked in comparison deltas but are **not flagged as violations** in either strict mode. API signature changes are informational only and do not trigger errors or warnings.

---

## Overview

Both `compare --strict` and `--strict-watch` use the **same violation detection logic** (`detectViolations` from `src/core/violations.ts`), but they differ in execution mode, use cases, and behavior.

---

## Violation Detection (Same for Both)

Both modes detect the **same types of breaking changes**:

### Errors (Exit Code 1)
- ✅ **Contract removed** (`contract_removed`) - Component/module deleted
- ✅ **Props removed** (`breaking_change_prop_removed`) - Prop removed from component
- ✅ **Events removed** (`breaking_change_event_removed`) - Event/callback removed
- ✅ **Functions removed** (`breaking_change_function_removed`) - Exported function removed

### Warnings (Reported but don't cause exit code 1)
- ⚠️ **Prop type changed** (`breaking_change_prop_type`) - Prop type changed (e.g., `string` → `number`)
- ⚠️ **State removed** (`breaking_change_state_removed`) - State variable removed
- ⚠️ **Variables removed** (`breaking_change_variable_removed`) - Module variable removed

### Not Tracked as Violations
- ❌ **API signature changes** (`apiSignature`) - Tracked in deltas but not violations
- ❌ **Hash changes** - Semantic hash changes (informational)
- ❌ **Imports changes** - Import dependencies added/removed
- ❌ **Hooks changes** - React hooks added/removed
- ❌ **Components changes** - Component dependencies added/removed
- ❌ **Exports changes** - Export kind changes

---

## `compare --strict`

### Command
```bash
stamp context compare --strict
stamp context compare --baseline git:main --strict
```

### Execution Mode
- **One-time comparison** - Runs once and exits
- Compares current state against baseline (disk or git ref)
- Generates fresh context files for comparison

### Use Cases
- ✅ **CI/CD pipelines** - Validate PRs don't introduce breaking changes
- ✅ **Pre-commit hooks** - Check before committing
- ✅ **Release validation** - Verify no breaking changes before release
- ✅ **Git baseline comparison** - Compare against branches/tags/commits

### Exit Behavior
- **Exit code 0** - No violations detected (or drift approved and updated when no violation errors)
- **Exit code 1** - Violations with errors detected (warnings don't cause exit), or drift not approved
- Non-interactive in CI (no prompts)

### Output
- Shows full comparison diff (folder summary, component summary, details)
- Displays violations inline with comparison results
- Violations shown at the end of comparison output

### Example
```bash
$ stamp context compare --strict

⚠️  DRIFT

📁 Folder Summary:
   Total folders: 14
   ~  Changed folders: 2

📦 Component Summary:
   ~ Changed: 2

📂 Folder Details:

   ⚠️  DRIFT: src/components/context.json
      ~ Changed components (1):
        ~ Button.tsx
          Δ props
            - loading: boolean
            + disabled: boolean

   ⚠️  Strict Mode: 1 violation(s) detected

   ❌ Errors (1):
      Breaking change: prop 'loading' removed from src/components/Button.tsx

Exit code: 1
```

---

## `--watch --strict-watch`

### Command
```bash
stamp context --strict-watch
stamp context --watch --strict-watch  # Equivalent
```

### Execution Mode
- **Continuous monitoring** - Runs until stopped (Ctrl+C)
- Watches file system for changes
- Incremental rebuilds (only affected bundles)
- State-based diffing (current state vs baseline when watch started)

### Use Cases
- ✅ **Development workflow** - Real-time feedback as you code
- ✅ **Local development** - Catch breaking changes immediately
- ✅ **Interactive debugging** - See violations appear/disappear as you fix issues

### Exit Behavior
- **Exit code 130** - Standard SIGINT (Ctrl+C), regardless of violations
- **No exit code enforcement** - Designed for awareness, not CI enforcement
- Violations persist in `.logicstamp/strict_watch_violations.json` after exit

### Output
- Real-time violation notifications as files change
- Session status summary (total violations, errors, warnings, resolved count)
- Violations report file (`.logicstamp/strict_watch_violations.json`)
- Shows when violations are detected and when they're resolved

### Example
```bash
$ stamp context --strict-watch

🔄 Watching for changes...

[File changed: src/components/Button.tsx]

❌ Breaking change detected

   ⚠️  Strict Mode: 1 violation(s) detected

   ❌ Errors (1):
      Breaking change: prop 'loading' removed from src/components/Button.tsx

   Strict Watch Status:
   ❌ Errors detected:   1
   ⚠️  Warnings detected: 0
   🔧 Resolved:          0

[File changed: src/components/Button.tsx]

✅ Violation resolved

   Strict Watch Status:
   ❌ Errors detected:   0
   ⚠️  Warnings detected: 0
   🔧 Resolved:          1
```

### Violations Report File

When violations are detected, strict watch mode creates `.logicstamp/strict_watch_violations.json`:

```json
{
  "active": true,
  "startedAt": "2025-01-22T10:30:00.000Z",
  "cumulativeViolations": 1,
  "cumulativeErrors": 1,
  "cumulativeWarnings": 0,
  "regenerationCount": 5,
  "totalErrorsDetected": 1,
  "totalWarningsDetected": 0,
  "resolvedCount": 0,
  "lastCheck": {
    "timestamp": "2025-01-22T10:35:00.000Z",
    "totalViolations": 1,
    "errors": 1,
    "warnings": 0,
    "violations": [
      {
        "type": "breaking_change_prop_removed",
        "severity": "error",
        "entryId": "src/components/Button.tsx",
        "message": "Breaking change: prop 'loading' removed from src/components/Button.tsx",
        "details": { "name": "loading" }
      }
    ],
    "changedFiles": ["src/components/Button.tsx"]
  }
}
```

**Note:** The file is automatically deleted when all violations are resolved (reverted to baseline).

---

## Side-by-Side Comparison

| Feature | `compare --strict` | `--watch --strict-watch` |
|---------|-------------------|--------------------------|
| **Execution** | One-time | Continuous (until stopped) |
| **Use Case** | CI/CD, validation | Development, real-time feedback |
| **Exit Code** | 1 if errors detected | 130 (SIGINT), not based on violations |
| **Output** | Full comparison diff + violations | Real-time violation notifications |
| **Violations File** | No | Yes (`.logicstamp/strict_watch_violations.json`) |
| **Baseline** | Disk files or git ref | Session start (when watch started) |
| **Incremental** | No (full comparison) | Yes (only affected bundles) |
| **Interactive** | No (CI-safe) | Yes (shows status updates) |
| **Git Baseline** | ✅ Supported (`--baseline git:main`) | ❌ Not supported |
| **Violation Types** | Same | Same |
| **API Signature** | ❌ Not violations | ❌ Not violations |

---

## When to Use Which

### Use `compare --strict` when:
- ✅ Running in CI/CD pipelines
- ✅ Validating PRs before merge
- ✅ Pre-commit hooks
- ✅ Release validation
- ✅ Comparing against git refs (branches, tags, commits)
- ✅ One-time validation checks

### Use `--watch --strict-watch` when:
- ✅ Developing locally
- ✅ Want real-time feedback as you code
- ✅ Need to see violations appear/disappear interactively
- ✅ Want violations persisted in a file for review
- ✅ Working on a feature and want immediate breaking change detection

---

## API Signature Handling

**Important:** API signature changes (`apiSignature` delta type) are **not tracked as violations** in either mode.

API signatures are:
- ✅ **Tracked in comparison deltas** - Shows up in `compare` output
- ✅ **Included in semantic hash** - Affects hash calculation
- ❌ **Not flagged as violations** - No errors or warnings

This is intentional because:
- API signature changes may be non-breaking (e.g., adding optional parameters)
- Backend API changes require different validation logic than component props
- API signature validation is planned for future enhancements

**Example:**
```bash
# API signature change appears in diff but NOT as violation
~ apiSignature
  Δ parameters
    + optionalParam: string
```

This change will show in the comparison output but will **not** trigger a violation error or warning.

---

## Summary

Both modes use identical violation detection logic but serve different purposes:

- **`compare --strict`** = CI/CD validation (one-time, exit codes, git baseline support)
- **`--watch --strict-watch`** = Development workflow (continuous, interactive, real-time feedback)

Neither mode treats API signature changes as violations—they're tracked in deltas but are informational only.
