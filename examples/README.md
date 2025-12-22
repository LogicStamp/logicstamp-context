# LogicStamp Context - Examples

This directory contains example context files demonstrating the output format, including JSON and TOON formats.

## Files

### `context.example.json`
Complete example showing:
- ✅ Full bundle structure with 2 components (LoginForm → Button)
- ✅ Clean dependency resolution (empty `missing` array)
- ✅ Contract metadata with logic signatures
- ✅ Code headers included
- ✅ Dependency graph with edges

**Use this example to:**
- Understand the ideal output structure
- See what a successful analysis looks like
- Learn the component contract format

### `context.with-missing-deps.example.json`
Example demonstrating missing dependencies:
- ⚠️ External packages (`@mui/material`, `react`)
- ⚠️ File not found (`./DeletedComponent`)
- ⚠️ Outside scan path (`../../shared/utils`)

**Use this example to:**
- Understand the `meta.missing` structure
- See what different missing dependency reasons look like
- Learn how to diagnose and fix issues

### `context.with-style.example.json`
Example demonstrating style metadata extraction:
- **Tailwind CSS** - Utility classes categorized by type (layout, spacing, colors, typography)
- **SCSS Modules** - Module imports with selector and property extraction
- **Framer Motion** - Animation metadata with variant detection
- **Layout patterns** - Hero sections, feature cards, grid layouts
- **Visual metadata** - Color palettes, spacing patterns, typography classes
- **Animation info** - Animation types, libraries, and triggers

**Includes 3 components:**
1. **HeroSection** - Tailwind + Framer Motion with viewport animations
2. **Button** - SCSS module with hover transitions
3. **FeatureCard** - Tailwind grid layout with responsive breakpoints

**Use this example to:**
- See how style metadata is structured in contracts
- Understand different style source types (Tailwind, SCSS, motion)
- Learn how layout and visual patterns are extracted
- Reference when generating context with `stamp context style` or `--include-style`

### `context.example.toon`
Example demonstrating the TOON format - a compact binary-encoded format optimized for AI consumption:
- **TOON format** - Binary-encoded bundle format (smaller file size than JSON)
- **Same structure** - Contains identical data to JSON format, just encoded differently
- **Programmatic use** - Designed for tools and AI systems that decode TOON natively
- **Efficient storage** - Smaller file sizes, ideal for CI/CD artifacts

**⚠️ Important:** TOON files are **not human-readable** - they must be decoded programmatically using the `@toon-format/toon` package.

**Use this example to:**
- Understand that TOON format exists as an alternative to JSON
- Test TOON decoding in your tools/integrations
- See the file size difference compared to JSON format
- Reference when generating context with `stamp context --format toon`

**Decoding TOON files:**

```javascript
import { decode } from '@toon-format/toon';
import { readFile } from 'fs/promises';

// Read and decode a TOON file
const toonContent = await readFile('examples/context.example.toon', 'utf-8');
const bundles = decode(toonContent);

// bundles is an array of LogicStampBundle objects (same structure as JSON)
console.log(bundles[0].entryId);
console.log(bundles[0].graph.nodes);
```

The decoded structure is identical to JSON format bundles - same schema, same contracts, same dependency graphs. See [toon.md](../docs/cli/toon.md) for complete TOON format documentation.

### `.stampignore.example`
Example `.stampignore` file demonstrating file exclusion patterns:
- 🔒 Shows how to exclude files containing secrets from context generation
- Demonstrates both specific file paths and glob patterns
- Example patterns for common secret file locations

**Use this example to:**
- Understand the `.stampignore` JSON format
- See how to exclude specific files or use glob patterns
- Reference when setting up file exclusion for security

### `stamp_security_report.example.json`
Example security scan report showing the output format:
- Demonstrates the structure of security scan reports
- Shows match details (file, line, column, type, snippet, severity)
- Includes summary statistics (files scanned, secrets found)
- Uses clearly fake example values (safe for GitHub)

**Use this example to:**
- Understand the security report format
- See what information is included in scan results
- Reference when integrating security scanning into your workflow

## Understanding Missing Dependencies

The `meta.missing` array tracks unresolved dependencies:

```json
{
  "name": "./DeletedComponent",
  "reason": "file not found",
  "referencedBy": "src/components/Dashboard.tsx"
}
```

### Field Descriptions

| Field | Description |
|-------|-------------|
| `name` | Import specifier that couldn't be resolved |
| `reason` | Why it failed: `external package`, `file not found`, `outside scan path`, `max depth exceeded`, or `circular dependency` |
| `referencedBy` | File path of the component that tried to import it |

### Common Scenarios

**External packages (expected):**
```json
{
  "name": "@mui/material",
  "reason": "external package"
}
```
✅ Normal - LogicStamp only analyzes your source code, not node_modules

**File not found (action required):**
```json
{
  "name": "./DeletedComponent",
  "reason": "file not found"
}
```
⚠️ Fix the broken import or remove the reference

**Outside scan path:**
```json
{
  "name": "../../shared/utils",
  "reason": "outside scan path"
}
```
💡 Expand scan directory or ignore if intentional

## Generating Your Own Examples

```bash
# Generate with no missing deps (scan entire project)
stamp context --out examples/my-example.json

# Generate with focused scope (may have missing deps)
stamp context ./src/components --out examples/components-only.json

# Include full source code
stamp context --include-code full --out examples/with-full-code.json

# Generate with style metadata (like context.with-style.example.json)
stamp context style --out examples/my-style-example.json

# Generate TOON format (like context.example.toon)
stamp context --format toon --out examples/my-example.toon
```

## See Also

- [../README.md](../README.md) - Main documentation
- [../schema/logicstamp.context.schema.json](../schema/logicstamp.context.schema.json) - JSON Schema
- [../docs/usage.md](../docs/usage.md) - Detailed usage guide
