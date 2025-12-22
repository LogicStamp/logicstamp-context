# Hashes in LogicStamp

LogicStamp uses three complementary hash types to track file changes, semantic changes, and bundle-level changes:

- **fileHash** – detects any raw file content modification.
- **semanticHash** – detects meaningful logical or contract changes.
- **bundleHash** – tracks changes to an entire LLM context bundle.

## fileHash: Raw File Content Hash

### Purpose

Answers: "Did the raw source file change?"

Used as a hash lock so LogicStamp can validate that a stored contract still reflects the actual file.

### How it is computed

1. Take the raw file contents.
2. Strip the @uif metadata header block.
3. Normalize line endings (\r\n → \n).
4. SHA-256 hash the text.
5. Truncate to 24 hex chars.
6. Prefix with `uif:`.

**Example:**

```
uif:1f0fa0e2c8958d7fc1696036
```

### What changes fileHash

- Any code change
- Comment changes
- Formatting / whitespace changes
- Structural edits
- Line ending differences (after normalization)

### What does not change it

- Editing the @uif header
- Purely changing metadata

### Example

```json
"contract": {
  "semanticHash": "uif:1a27d0944bbaaf561ee05a01",
  "fileHash": "uif:1f0fa0e2c8958d7fc1696036"
}
```

## semanticHash: Logical / Contract Hash

### Purpose

Answers: "Did the component's semantics or public API change?"

This hash tracks meaningful changes only—not superficial edits.

### Based on

Derived from the AST and logic signature:

**Structural footprint:**
- variables
- hooks
- components
- functions

**Logic signature:**
- props
- emits/events
- state

A stable `schemaVersion` (e.g., "0.3")

All arrays/objects are sorted deterministically for order-independence, via `stableStringify` and `sortObject`.

### How it is computed

1. Extract AST structure (AstExtract) and logic signature, then feed them into `semanticHashFromAst`, which internally combines `structureHash` and `signatureHash`.
2. Build payload:

```json
{
  "schemaVersion": "0.3",
  "structure": { "...": "..." },
  "signature": { "...": "..." }
}
```

3. Stable-stringify and SHA-256.
4. Truncate to 24 hex chars.
5. Prefix with `uif:`.

### What changes semanticHash

- Adding/removing/renaming props
- Changing events (emits)
- Changing state structure
- Adding/removing named functions, hooks, or child components
- Any structural AST shift that affects contract shape

### What does not change it

- Comments
- Whitespace/formatting
- Most implementation details inside functions
- Internal logic refactors that do not affect:
  - props
  - events
  - state
  - component/hook/function footprint

## bundleHash: LLM Bundle Hash

### Purpose

Answers: "Has the entire context bundle changed?"

Used for caching embeddings and prepared LLM contexts.

### Based on

A bundle's hash includes:

- Sorted list of nodes (by `entryId`):
  ```json
  { "entryId": "...", "semanticHash": "uif:..." }
  ```
- Bundle depth
- Bundle schemaVersion (default "0.1")

**Example payload:**

```json
{
  "schemaVersion": "0.1",
  "depth": 1,
  "nodes": [
    { "entryId": "src/Button.tsx", "semanticHash": "uif:..." },
    { "entryId": "src/Card.tsx",   "semanticHash": "uif:..." }
  ]
}
```

Then:
1. stable-stringify
2. SHA-256
3. truncate
4. prefix with `uifb:`

**Example:**

```
uifb:abc123e4f99aa01deef02bb1
```

### What changes bundleHash

- Any component's semanticHash changed
- Adding/removing a component from the bundle
- Different bundle depth
- Different bundle schema version

### What does not change it

- Cosmetic file edits
- Reordering components in memory (sorting by `entryId` ensures stability)

## Relationship Between All Three Hashes

Think of these as three layers:

| Layer | Hash | Detects |
|-------|------|---------|
| File-level | `fileHash` | Any file content modification |
| Component-level | `semanticHash` | Logic & API changes only |
| Bundle-level | `bundleHash` | Changes in the semantic footprint of a context bundle |

## Practical Scenarios

### 1. Only comments/formatting change

- `fileHash`: changes
- `semanticHash`: stays same
- `bundleHash`: stays same

→ Cosmetic edit.

### 2. A prop or state field is added

- `fileHash`: changes
- `semanticHash`: changes
- `bundleHash`: changes for all bundles involving that component

→ Meaningful contract change.

### 3. A dependency graph changes (component import added/removed)

- `semanticHash`: (maybe stays same)
- `bundleHash`: changes, because node set changed

→ Bundle must be regenerated for LLM.