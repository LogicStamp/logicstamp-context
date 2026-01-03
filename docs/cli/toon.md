# TOON Format Support

TOON is an alternative output format for LogicStamp context bundles, providing a compact text-based encoding optimized for AI consumption and efficient storage.

```bash
stamp context --format toon
```

## Overview

TOON format encodes the same LogicStamp bundle structure as JSON, but in a more compact representation. It's designed for:

- **Efficient storage** - Smaller file sizes compared to JSON
- **AI consumption** - Optimized encoding for LLM processing
- **Streaming** - Can be decoded incrementally if needed

**Note:** The main index file (`context_main.json`) is always in JSON format, even when using `--format toon`. Only the folder bundle files use the `.toon` extension.

## Usage

Generate context bundles in TOON format:

```bash
# Generate TOON format bundles
stamp context --format toon

# With style metadata (alternative syntax)
stamp context --format toon --include-style
stamp context style --format toon

# Custom output directory
stamp context --format toon --out ./output
```

## Output Structure

When using `--format toon`, the output structure is:

```
output/
├── context_main.json          # Main index (always JSON)
├── context.toon              # Root folder bundles (TOON format)
├── src/
│   └── context.toon          # Bundles from src/ folder (TOON format)
└── src/components/
    └── context.toon          # Bundles from src/components/ (TOON format)
```

Each folder containing components gets its own `context.toon` file. The directory structure mirrors your project layout, just like JSON format.

## Decoding TOON Files

TOON files can be decoded using the `@toon-format/toon` package:

```javascript
import { decode } from '@toon-format/toon';
import { readFile } from 'fs/promises';

// Read and decode a TOON file
const toonContent = await readFile('src/components/context.toon', 'utf-8');
const bundles = decode(toonContent);

// bundles is an array of LogicStampBundle objects
console.log(bundles[0].entryId);
console.log(bundles[0].graph.nodes);
```

The decoded structure is identical to JSON format bundles - same schema, same contracts, same dependency graphs.

## When to Use TOON

**Use TOON format when:**

- You need smaller file sizes (especially for large codebases)
- You're building tools that process context files programmatically
- You want efficient storage for CI/CD artifacts
- You're working with AI systems that can decode TOON natively

**Use JSON format when:**

- You need human-readable output for debugging
- You're manually inspecting context files
- You want to use `stamp context validate`, `compare`, or `clean` commands
- You're using tools that expect JSON
- You want to diff context files in git

## Format Comparison

All formats contain the same bundle data, just encoded differently:

| Format | Extension | Human-readable | File Size | Use Case |
|--------|-----------|----------------|-----------|----------|
| `json` | `.json` | ✅ Yes | Medium | Default, human-readable |
| `pretty` | `.json` | ✅ Yes | Large | Human inspection, debugging |
| `ndjson` | `.json` | ✅ Yes | Medium | Streaming, line-by-line processing |
| `toon` | `.toon` | ✅ Yes (less readable) | Small | Compact storage, AI consumption |

## Integration with Other Commands

TOON format works with all `stamp context` options:

```bash
# TOON with style metadata (both syntaxes work)
stamp context --format toon --include-style
stamp context style --format toon

# TOON with custom depth
stamp context --format toon --depth 2

# TOON with profile
stamp context --format toon --profile llm-safe

# TOON with code inclusion mode
stamp context --format toon --include-code header
```

## File Naming

- Folder bundles: `context.toon` (one per folder)
- Main index: `context_main.json` (always JSON, even with `--format toon`)
- Variants: `context_*.toon` (if any variants are generated)

## .gitignore Patterns

When using `stamp init`, the following patterns are automatically added to `.gitignore`:

- `context.toon` - Per-folder TOON bundles
- `context_*.toon` - TOON format variants

These patterns prevent generated TOON files from being committed to version control. See [init.md](init.md) for details.

## Working with TOON Files

**Note:** Currently, TOON format is only supported for generation (`stamp context --format toon`). The `validate`, `compare`, and `clean` commands do not yet support TOON format files.

To work with TOON files using these commands, you'll need to decode them to JSON first:

```javascript
import { decode } from '@toon-format/toon';
import { readFile, writeFile } from 'fs/promises';

// Decode TOON to JSON for validation/comparison
const toonContent = await readFile('src/components/context.toon', 'utf-8');
const bundles = decode(toonContent);
const jsonContent = JSON.stringify(bundles, null, 2);
await writeFile('src/components/context.json', jsonContent);

// Now you can validate or compare the JSON file
// stamp context validate src/components/context.json
```

## Limitations

- **Human readability** - TOON files are human-readable but less readable than JSON. While you can inspect TOON files directly, JSON format is better for manual inspection and debugging.
- **Tool compatibility** - Some tools may not support TOON format. JSON is more universally supported.
- **Index file** - The main index (`context_main.json`) is always JSON, even when using TOON format for bundles.
- **Command support** - Currently, only the `stamp context` command supports TOON format for generation. The `validate`, `compare`, and `clean` commands do not yet support TOON files and will only work with JSON format.

## Examples

### Generate and inspect TOON bundles

```bash
# Generate TOON format
stamp context --format toon --out ./output

# Decode and inspect (Node.js)
node -e "
  const { decode } = require('@toon-format/toon');
  const fs = require('fs');
  const content = fs.readFileSync('./output/src/components/context.toon', 'utf-8');
  const bundles = decode(content);
  console.log('Bundles:', bundles.length);
  console.log('First bundle:', bundles[0].entryId);
"
```

### Programmatic usage

```javascript
import { decode } from '@toon-format/toon';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function loadContextBundles(projectRoot) {
  const toonPath = join(projectRoot, 'src/components/context.toon');
  const content = await readFile(toonPath, 'utf-8');
  const bundles = decode(content);
  
  return bundles;
}

// Use the bundles
const bundles = await loadContextBundles('./my-project');
bundles.forEach(bundle => {
  console.log(`Component: ${bundle.entryId}`);
  console.log(`Nodes: ${bundle.graph.nodes.length}`);
});
```

## Related Commands

- [`stamp context`](context.md) - Generate context files (supports all formats including TOON)
- [`stamp context validate`](validate.md) - Validate context files (JSON format only)
- [`stamp context compare`](compare.md) - Compare context files (JSON format only)
- [`stamp context clean`](clean.md) - Clean context files (JSON format only)
- [`stamp init`](init.md) - Set up `.gitignore` patterns for TOON files

## Tips

- Use JSON format during development for easier debugging and to use validation/comparison tools
- Switch to TOON format for production/CI to save storage (when you don't need validation/comparison)
- The main index is always JSON, so you can always inspect the project structure
- TOON files decode to the same structure as JSON - no data loss
- To validate or compare TOON files, decode them to JSON first using the `@toon-format/toon` package

