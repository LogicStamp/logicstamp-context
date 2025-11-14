# LogicStamp Context - Examples

This directory contains example `context.json` files demonstrating the output format.

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
```

## See Also

- [../README.md](../README.md) - Main documentation
- [../schema/logicstamp.context.schema.json](../schema/logicstamp.context.schema.json) - JSON Schema
- [../docs/USAGE.md](../docs/USAGE.md) - Detailed usage guide
