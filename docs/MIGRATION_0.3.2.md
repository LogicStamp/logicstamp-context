# Migration Guide: Upgrading to v0.3.2

## Overview

**TL;DR**: v0.3.2 improves portability by using relative paths instead of absolute paths. Most users won't need any changes - just regenerate your context files. Only custom tools or scripts that parse `context_main.json` may need updates.

## Breaking Changes

### 1. Relative Paths Instead of Absolute Paths

**What changed:**
- `projectRoot` in `context_main.json` is now `"."` (relative) instead of an absolute path
- All `contextFile` paths in folder entries are now relative to the project root
- The `projectRootResolved` field is no longer emitted (removed from output)

**Why:** This improves portability of context files across different machines and environments.

**Impact:** 
- ✅ **Most users**: No action needed. Relative paths work the same way when resolved from the project root.
- ⚠️ **Tools/scripts**: If you have custom tools that parse `context_main.json` and expect absolute paths or rely on `projectRootResolved`, you'll need to update them to handle relative paths.

**Example:**

**Before (v0.3.1):**
```json
{
  "type": "LogicStampIndex",
  "schemaVersion": "0.1",
  "projectRoot": "/Users/name/project",
  "projectRootResolved": "/Users/name/project",
  "folders": [
    {
      "path": "src",
      "contextFile": "/Users/name/project/src/context.json"
    }
  ]
}
```

**After (v0.3.2):**
```json
{
  "type": "LogicStampIndex",
  "schemaVersion": "0.2",
  "projectRoot": ".",
  "folders": [
    {
      "path": "src",
      "contextFile": "src/context.json"
    }
  ]
}
```

### 2. Schema Version Bump

**What changed:**
- `LogicStampIndex` schema version bumped from `0.1` to `0.2`

**Why:** To reflect the breaking change in path format.

**Impact:**
- Validation tools should accept both `0.1` and `0.2` for backward compatibility
- New context files will have `schemaVersion: "0.2"`

### 3. CSS/SCSS Parsing Improvements

**What changed:**
- CSS and SCSS parsing now uses AST-based parsing instead of regex
- More accurate extraction of selectors, properties, and SCSS features

**Impact:**
- ✅ **Most users**: No action needed. This is a non-breaking improvement.
- ⚠️ **Style extraction**: You may see slightly different style metadata in generated context files (more accurate, but potentially different format)

## Migration Steps

### Step 1: Update Your Tools (If Applicable)

If you have custom scripts or tools that parse `context_main.json`:

1. **Update path handling**: Change from absolute paths to relative paths
   ```javascript
   // Before
   const contextFile = folder.contextFile; // absolute path
   
   // After
   const contextFile = path.join(projectRoot, folder.contextFile); // resolve relative path
   ```

2. **Remove `projectRootResolved` usage**: This field no longer exists
   ```javascript
   // Before
   const root = index.projectRootResolved || index.projectRoot;
   
   // After
   const root = path.resolve(process.cwd(), index.projectRoot); // resolve "." to absolute
   ```

3. **Update schema version checks**: Accept both `0.1` and `0.2`
   ```javascript
   // Before
   if (index.schemaVersion !== '0.1') { /* error */ }
   
   // After
   if (!['0.1', '0.2'].includes(index.schemaVersion)) { /* error */ }
   ```

### Step 2: Regenerate Context Files

After upgrading to v0.3.2, regenerate your context files:

```bash
# Option 1: Clean and regenerate (recommended)
stamp context clean --all --yes
stamp context

# Option 2: Just regenerate (will update existing files)
stamp context
```

### Step 3: Verify Migration

Check that your new context files are correct:

```bash
# Validate the new context files
stamp context validate
```

**Manual verification:** Open `context_main.json` in a text editor and check:
- `"schemaVersion": "0.2"` (should be 0.2, not 0.1)
- `"projectRoot": "."` (should be ".", not an absolute path)
- `"contextFile"` values in `folders` array should be relative paths (e.g., `"src/context.json"`, not `"/Users/name/project/src/context.json"`)

## Optional: Cleaning Up Orphaned Context Files

If you've been using LogicStamp Context for a while, you might have old `context.json` files in subdirectories that aren't listed in your current `context_main.json`. These are called "orphaned" files.

### Is This Critical?

**No.** Orphaned files don't break anything. They're just leftover files from previous runs. You can:
- Leave them alone (they'll just sit there unused)
- Delete them (recommended for cleanliness)
- Regenerate everything fresh (if you prefer a clean slate)

### Why This Happens

LogicStamp Context creates `context.json` files for **entry point folders** (folders containing root components that serve as application entry points). Dependency components are included within parent bundles rather than getting their own `context.json` files.

When you upgrade or regenerate context, old `context.json` files in dependency subdirectories become orphaned—they exist on disk but aren't listed in the new `context_main.json` index.

### Identifying Orphaned Files

Orphaned files are `context.json` files that:
1. Exist on disk from a previous LogicStamp version
2. Are **not** listed in the current `context_main.json` index
3. Are in subdirectories that are now treated as dependencies rather than entry points

### Example Structure

**What you might see (old structure):**
```
project/
├── context_main.json
├── src/
│   ├── context.json
│   └── components/
│       ├── context.json
│       ├── sections/
│       │   └── context.json  ← Orphaned (not in context_main.json)
│       └── layout/
│           └── context.json  ← Orphaned (not in context_main.json)
```

**Current behavior:**
```
project/
├── context_main.json
├── src/
│   ├── components/
│   │   └── context.json  ← Entry point folder (root components)
│   ├── hooks/
│   │   └── context.json  ← Entry point folder (custom hooks)
│   ├── utils/
│   │   └── context.json  ← Entry point folder (utility functions)
│   ├── lib/
│   │   └── context.json  ← Entry point folder (library code)
│   └── context.json  ← Entry point folder (main app files)
└── tests/
    └── fixtures/
        └── context.json  ← Entry point folder (test fixtures)
```

**Real-world example:** In a typical project, you might see multiple `context.json` files like:
- `src/components/context.json` - for root component files
- `src/hooks/context.json` - for custom React hooks
- `src/utils/context.json` - for utility functions
- `src/lib/context.json` - for library/API code
- `tests/fixtures/context.json` - for test fixtures

Each of these folders contains root components (not imported by other components), so they each get their own `context.json` file.

**Key points:**
- Only **entry point folders** (folders containing root components) get `context.json` files
- **Dependency-only folders** (like `sections/` and `layout/`) don't get their own files
- Components from `sections/` and `layout/` are still included—they're bundled in the parent entry point's `context.json` file
- Projects can have **multiple** `context.json` files (one per entry point folder)

## How to Clean Up Orphaned Files

### Step 1: Identify Orphaned Files

First, check which `context.json` files are actually referenced:

**Option 1: Open `context_main.json` in a text editor**
- Look at the `folders` array
- Each entry has a `contextFile` field showing which files are referenced

**Option 2: Use the validation command**
```bash
stamp context validate
```
This will show you which context files are valid and referenced.

Then find all `context.json` files on disk:

**Option 1: Use your file explorer/IDE**
- Search for files named `context.json` in your project
- Exclude `node_modules` folder

**Option 2: Use command line (if available)**
```bash
# Works on Unix/Linux/Mac/Git Bash
find . -name "context.json" -not -path "*/node_modules/*"
```

Any `context.json` files on disk that aren't listed in `context_main.json`'s `folders` array are orphaned.

### Option 1: Manual Deletion (Recommended)

Simply delete the orphaned files manually. They're safe to remove since they're not referenced anywhere.

**When to use this:** You have a few orphaned files and want to remove them quickly.

### Option 2: Identify Orphaned Files (Optional)

If you want to see which files are orphaned before deleting them, you can check manually:

1. Open `context_main.json` in a text editor
2. Note all the `contextFile` values in the `folders` array
3. Search your project for all `context.json` files
4. Any `context.json` files that aren't in the list from step 2 are orphaned

**When to use this:** You want to see what would be removed before deleting anything.

### Option 3: Clean Slate (Regenerate Everything)

If you prefer a fresh start or want to ensure everything is up-to-date:

```bash
# Remove all context files
stamp context clean --all --yes

# Regenerate with current version
stamp context
```

**When to use this:** You want a guaranteed clean state, don't mind regenerating everything, or suspect other issues with your context files.

⚠️ **Note:** This deletes ALL context files (not just orphaned ones) and regenerates everything from scratch, which may take a few moments.

## Verification

After cleanup, verify your context is correct:

```bash
# Check that all components are included
stamp context validate
```

**Manual verification:** Open the context files in a text editor:
- `context_main.json` should only list entry point folders in the `folders` array
- Open any `context.json` file (e.g., `src/context.json`) and check the `graph.nodes` array
- You should see components from `sections/` and `layout/` listed with paths like `src/components/sections/About.tsx`
- All components should be included in parent bundles, not as separate `context.json` files

### Expected Behavior After Cleanup

After cleaning up orphaned files, you should have:

1. ✅ Only entry point folders have `context.json` files
2. ✅ All components (including those from `sections/`, `layout/`, and other subdirectories) are included in parent bundles
3. ✅ `context_main.json` only lists entry point folders
4. ✅ Component paths in bundles use relative paths (e.g., `src/components/sections/About.tsx`)
5. ✅ Projects can have multiple `context.json` files (one per entry point folder)

## Summary

**Required actions for v0.3.2:**
- ✅ Update tools/scripts that parse `context_main.json` (if you have any)
- ✅ Regenerate context files with `stamp context`

**Optional actions:**
- 🧹 Clean up orphaned `context.json` files (housekeeping only)

## Need Help?

If you encounter issues:

1. Run `stamp context validate` to check for schema issues
2. Verify all components are included in parent bundles (they should be)
3. Check that `context_main.json` schema version is `0.2`
4. Review the [CHANGELOG.md](../CHANGELOG.md) for detailed change notes
5. Open an issue on GitHub if something seems wrong

