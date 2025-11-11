Must-fix (clarity & consistency)

Normalize paths

Add both:

entryPathAbs (native, e.g., C:\\...\\App.tsx)

entryPathRel (POSIX, e.g., tests/fixtures/.../App.tsx)

Keep os: "win32" | "posix" to avoid case/sep issues and make bundles portable.

Disambiguate events

Right now Card has props.onAction? and an events.onClick. Decide semantics and rename:

props = inputs passed from parent

emits = events the component fires upward

handlers = callbacks the component expects to be passed

Example:

"logicSignature": {
  "props": { "title": "string", "description": "string", "onAction?": "() => void" },
  "state": { "expanded": "boolean" },
  "emits": { "click": "() => void" }
}


Exports metadata

Add exports: "default" | "named" | { "named": ["Card"] } so consumers can import correctly.

Nice-to-have (tooling & drift detection)

Version alignment & provenance

Bundle schemaVersion: "0.1" vs contract schemaVersion: "0.3" is fine, but add:

producedBy: { "name": "logicstamp-context", "version": "x.y.z" }

contractSchemaVersionRange: ">=0.3 <0.4"

Helps future migrations.

Hash fields

Keep fileHash (raw bytes) and semanticHash (AST/contract) but add:

hashAlgo: "blake3" (or whatever you use) next to each hash.

Optional signatureHash over just logicSignature to detect API drift quickly.

Graph edge typing

Current edge is a tuple. Consider objects with a type:

{ "from": "<App.tsx>", "to": "<Card.tsx>", "kind": "imports" }


This leaves room for calls, renders, dynamicImport, etc.

Strict types for functions

In version.functions, store signatures:

"functions": [{ "name": "Card", "kind": "react:function", "signature": "(props: CardProps) => JSX.Element" }]


Optional code header

You already have codeHeader: null. When enabled, limit to first N lines + sourceMap ranges to keep it small but helpful for LLMs.

Bundle identity

Add stable bundleId (UUID v7) and projectRoot so different machines generate the same relative graph.

Validation affordances

Add meta.checks: { missingImports: [], circularDeps: [], duplicateIds: [] } to surface analyzer warnings.