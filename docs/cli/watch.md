# `stamp context --watch` (Watch Mode)

Watch mode monitors your codebase for file changes and automatically regenerates context bundles. It provides incremental rebuilds for fast feedback during development.

```bash
stamp context --watch
stamp context -w
```

## Quick Start

```bash
# Basic watch mode
stamp context --watch

# Watch with style metadata
stamp context style --watch

# Watch a specific directory
stamp context ./src/components --watch

# Watch with debug output (shows hash changes)
stamp context --watch --debug

# Watch with structured change logs written to .logicstamp/context_watch-mode-logs.json (for change notifications)
stamp context --watch --log-file
```

## How It Works

1. **Initial Build** - Generates context files and initializes the watch cache
2. **File Monitoring** - Uses [chokidar](https://github.com/paulmillr/chokidar) to watch for file changes
3. **Debouncing** - Waits 500ms after the last change before regenerating (batches rapid changes)
4. **Incremental Rebuild** - Only rebuilds affected bundles, not the entire project
5. **Change Detection** - Shows what changed (props, hooks, state, etc.)

## Features

### Incremental Rebuilds

Watch mode maintains a cache of contracts, AST data, and style metadata. When a file changes, it only rebuilds:

- The contract for the changed file
- Bundles that include the changed component in their dependency graph

This makes rebuilds significantly faster than full regeneration.

### Change Detection

Watch mode detects and displays different types of changes:

```
📝 Changed: src/components/Button.tsx

🔄 Regenerating (1 file changed)...

✏️  Modified contract:
  src/components/Button.tsx
   • Added props: `disabled`
   • Removed props: `loading`
   • Changed hooks: `useCallback`

📦 Modified bundle:
  src/components/Button.tsx
   • Dependency graph updated

✅ Regenerated
```

**Change types detected:**
- **Props** - Added, removed, or changed prop signatures
- **Events** - Added, removed, or changed event callbacks
- **State** - Added, removed, or changed useState variables
- **Hooks** - Added or removed hook usage
- **Components** - Added or removed component dependencies
- **Variables** - Added or removed module-level variables
- **Functions** - Added or removed function exports

### File Events

Watch mode responds to three file events:

| Event | Description |
|-------|-------------|
| `change` | File content modified |
| `add` | New file created |
| `unlink` | File deleted |

### Watched File Types

By default, watch mode monitors:
- `.ts` files
- `.tsx` files

When using `--include-style`, it also watches:
- `.css` files
- `.scss` files
- `.module.css` files
- `.module.scss` files

### Ignored Paths

Watch mode automatically ignores:
- `node_modules/`
- `dist/`
- `build/`
- `.next/`
- `coverage/`
- `context.json` files (generated output)
- `context_main.json` (generated output)

## Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--watch` | `-w` | Enable watch mode |
| `--debug` | | Show detailed hash information on changes |
| `--quiet` | `-q` | Suppress verbose output (show only errors) |
| `--include-style` | | Watch style files and include style metadata |
| `--profile watch-fast` | | Use lighter style extraction for faster rebuilds |
| `--log-file` | | Write structured change logs to `.logicstamp/context_watch-mode-logs.json` (for change notifications) |

All other `stamp context` options are supported in watch mode.

## Debug Mode

Use `--debug` to see detailed information about what changed:

```bash
stamp context --watch --debug
```

Debug output shows:
- Which file triggered the rebuild
- Semantic hash changes (API/logic changes)
- File hash changes (any content change)
- Bundle hash changes (dependency graph changes)
- Detailed contract diffs

```
[DEBUG] Changed file: src/components/Button.tsx
[DEBUG] Modified contracts (1):
  ~ src/components/Button.tsx
    semanticHash (API/logic): uif:abc123... → uif:def456...
      ↳ Detects: props, events, state, hooks, components, functions
    Detailed changes:
      + Props: disabled
      - Props: loading
```

**Hash types explained:**
- **semanticHash** - Changes when the component's API changes (props, events, state, hooks)
- **fileHash** - Changes when any file content changes (including comments, formatting)
- **bundleHash** - Changes when the dependency graph structure changes

## Watch Status & Logs

Watch mode can write status files for integration with other tools (like the MCP server).

### Status File (`.logicstamp/watch_status.json`)

Written when watch mode starts, deleted when it stops:

```json
{
  "active": true,
  "projectRoot": "/path/to/project",
  "pid": 12345,
  "startedAt": "2025-01-19T10:30:00.000Z",
  "outputDir": "/path/to/project"
}
```

### Watch Log (`.logicstamp/context_watch-mode-logs.json`)

**Opt-in with `--log-file` flag.** When enabled, logs are appended after each regeneration:

```bash
# Enable watch mode with log file output
stamp context --watch --log-file
```

```json
{
  "timestamp": "2025-01-19T10:30:05.000Z",
  "changedFiles": ["src/components/Button.tsx"],
  "fileCount": 1,
  "durationMs": 234,
  "modifiedContracts": [...],
  "modifiedBundles": [...],
  "summary": {
    "modifiedContractsCount": 1,
    "modifiedBundlesCount": 1,
    "addedContractsCount": 0,
    "removedContractsCount": 0
  }
}
```

By default, watch mode does not write log files. Use `--log-file` when you need structured change notifications (e.g., to display "what changed" in a UI or for debugging).

## Examples

### Basic Development Workflow

```bash
# Start watch mode in your project
stamp context --watch

# Output:
# 👀 Watch mode enabled. Watching for file changes...
#    Press Ctrl+C to stop
#
#    Watching: /path/to/project
#    Ignoring: context.json files, node_modules, dist, build, etc.
#    Watching extensions: .ts, .tsx
#
# ✅ Watch mode active. Waiting for file changes...
```

### Watch with Style Metadata

```bash
# Watch for style changes too
stamp context style --watch

# Or equivalently
stamp context --include-style --watch

# Now watches: .ts, .tsx, .css, .scss, .module.css, .module.scss
```

### Watch a Subdirectory

```bash
# Only watch and rebuild a specific feature
stamp context ./src/components/MyFeature --watch

# Faster incremental rebuilds when focused on one area
```

### Watch with Fast Profile

```bash
# Use lighter style extraction for faster rebuilds
stamp context style --watch --profile watch-fast
```

### CI/Development Server Integration

```bash
# Run in background (redirect output)
stamp context --watch > watch.log 2>&1 &

# Run with structured change logs (for change notifications)
stamp context --watch --log-file

# Or use in a development script (package.json)
# "scripts": {
#   "context:watch": "stamp context --watch"
# }
```

## Performance Tips

1. **Focus on subdirectories** - Watch a specific directory when working on one feature
2. **Use `watch-fast` profile** - Lighter style extraction when you need faster rebuilds
3. **Skip style if not needed** - Don't use `--include-style` if you don't need style metadata
4. **Check debug mode sparingly** - Debug output adds overhead; use it for troubleshooting

## Stopping Watch Mode

Press `Ctrl+C` to stop watch mode gracefully:

```
^C
👋 Watch mode stopped
```

Watch mode cleans up:
- Closes file watcher
- Deletes watch status file
- Flushes any pending logs

## Troubleshooting

### Changes not detected

1. Check if the file type is watched (`.ts`, `.tsx`, or style files with `--include-style`)
2. Verify the file isn't in an ignored directory
3. Enable debug logging: `LOGICSTAMP_DEBUG=1 stamp context --watch`

### Slow rebuilds

1. Use `--profile watch-fast` for lighter style extraction
2. Focus on a subdirectory instead of the entire project
3. Check if you're hitting `max-nodes` limits

### Watch mode crashes

1. Check available memory (large projects need more RAM)
2. Enable debug mode to identify problematic files
3. Report issues at https://github.com/LogicStamp/logicstamp-context/issues

## See Also

- [context.md](context.md) - Complete `stamp context` command reference
- [style.md](style.md) - Style metadata extraction guide
- [compare.md](compare.md) - Context drift detection
