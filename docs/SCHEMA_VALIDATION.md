# Schema Validation Guide

LogicStamp produces deterministic architectural bundles.  
To guarantee long-term stability, we enforce strict parity between the TypeScript implementation and the published JSON Schema.

This document explains how to ensure the JSON schema (`schema/logicstamp.context.schema.json`) matches the TypeScript implementation.

## Why This Matters

AI agents, CI pipelines, and downstream tooling rely on the published JSON schema as a contract boundary.

If the schema drifts from the TypeScript implementation, contract integrity breaks.

This validation layer guarantees:
- Deterministic bundle structure
- Stable contract evolution
- Safe versioned upgrades
- Predictable AI consumption
## Quick Validation

Run the comprehensive schema completeness test:

```bash
npm test -- tests/unit/utils/schemaCompleteness.test.ts
```

This test validates:

### ✅ TypeScript → Schema Validation
- All valid TypeScript objects pass schema validation
- All required TypeScript fields are required in schema
- All optional TypeScript fields are optional in schema
- Type constants match (`type: 'LogicStampBundle'`, `schemaVersion: '0.1'`, etc.)
- Hash patterns match (`uifb:...`, `uif:...`)
- Enum values match (e.g., `MissingDependency.reason`)

### ✅ Schema → TypeScript Validation
- Schema rejects invalid data that TypeScript types would reject
- Missing required fields are caught
- Invalid enum values are rejected
- Invalid hash formats are rejected
- Additional properties are rejected (`additionalProperties: false`)

### ✅ Field-by-Field Completeness
- All required fields from TypeScript types exist in schema
- All optional fields from TypeScript types exist in schema
- Schema version constants match
- Type constants match
- Hash patterns match expectations
- **Style mode variants**: Both `lean` and `full` style modes are validated (lean uses count fields, full uses arrays)

## What the Test Covers

1. **LogicStampBundle**
   - Required fields: `type`, `schemaVersion`, `entryId`, `depth`, `createdAt`, `bundleHash`, `graph`, `meta`
   - Optional fields: `position`
   - Validates complete bundles with all fields
   - Validates minimal bundles with only required fields
   - Rejects bundles with missing required fields
   - Rejects bundles with invalid schemaVersion
   - Rejects bundles with invalid hash formats

2. **BundleNode**
   - Required fields: `entryId`, `contract`
   - Optional fields: `codeHeader`, `code` (can be null)
   - Validates nodes with codeHeader
   - Validates nodes with null codeHeader

3. **MissingDependency**
   - Required fields: `name`, `reason`
   - Optional fields: `referencedBy`, `packageName`, `packageVersion`
   - Validates all reason enum values: `'file not found'`, `'external package'`, `'outside scan path'`, `'max depth exceeded'`, `'circular dependency'`
   - Rejects invalid reason values

4. **UIFContract**
   - Required fields: `type`, `schemaVersion`, `kind`, `entryId`, `description`, `composition`, `interface`, `semanticHash`, `fileHash`
   - Optional fields: `usedIn`, `exports`, `prediction`, `metrics`, `links`, `style`, `nextjs`
   - Validates complete contracts with all optional fields
   - Validates minimal contracts with only required fields
   - Validates backend contracts with `apiSignature`
   - **Validates style metadata in both `lean` and `full` modes** (lean uses count fields like `selectorCount`, `componentCount`; full uses arrays like `selectors`, `components`)
   - Rejects contracts with invalid schemaVersion
   - Rejects contracts with invalid hash formats

## How to Ensure 100% Match

### When Adding New Fields

1. **Add to TypeScript type first** (e.g., `src/types/UIFContract.ts` or `src/core/pack.ts`)
2. **Update schema** (`schema/logicstamp.context.schema.json`)
   - Add field to `properties`
   - Add to `required` array if required
   - Set `additionalProperties: false` to prevent extra fields
   - **If adding style fields**: Ensure both `lean` (count fields) and `full` (array fields) variants are supported
3. **Update test** (`tests/unit/utils/schemaCompleteness.test.ts` and `tests/unit/utils/schemaValidator.test.ts`)
   - Add test case for new field
   - Test both valid and invalid values
   - **If adding style fields**: Test both lean and full mode variants
4. **Run validation**:
   ```bash
   npm test -- tests/unit/utils/schemaCompleteness.test.ts
   ```

### When Modifying Existing Fields

1. **Update TypeScript type**
2. **Update schema** (ensure types, patterns, enums match)
3. **Run validation test** - it should catch any mismatches
4. **Update any affected tests**

### Validation Checklist

- [ ] All required TypeScript fields are in schema `required` array
- [ ] All optional TypeScript fields are in schema `properties` but not in `required`
- [ ] Type constants match (`const` values in schema)
- [ ] Schema version constants match
- [ ] Enum values match (for `reason`, `kind`, etc.)
- [ ] Hash patterns match (`^uifb:...`, `^uif:...`)
- [ ] `additionalProperties: false` is set (prevents extra fields)
- [ ] Test passes: `npm test -- tests/unit/utils/schemaCompleteness.test.ts`

## Continuous Validation

The schema completeness test runs as part of the test suite. To ensure schema stays in sync:

1. **Pre-commit**: Run the schema completeness test
2. **CI/CD**: The test runs automatically in CI
3. **Manual check**: Run `npm test -- tests/unit/utils/schemaCompleteness.test.ts` before releases

⚠️ **Important**: Schema completeness is considered release-blocking. A failing schema test must be resolved before publishing.

## Known Limitations

- **Deprecated fields**: Fields marked `@deprecated` in TypeScript (e.g., `entryPathAbs`, `entryPathRel`, `os`) may not be in the schema if they're no longer generated. This is intentional for backward compatibility - old files with these fields may still exist.

- **Conditional validation**: The schema doesn't currently validate language-specific field combinations (e.g., `style` shouldn't exist on `node:api` contracts). This is planned for v0.8.x (see ROADMAP.md).

- **Style mode variants**: The schema supports both `lean` and `full` style modes. Lean mode uses count fields (e.g., `selectorCount`, `componentCount`), while full mode uses arrays (e.g., `selectors`, `components`). Both formats are valid and should be tested separately.

## Troubleshooting

If the test fails:

1. **Check error message** - it will show which field/validation failed
2. **Compare TypeScript type** with schema definition
3. **Check for typos** in field names, enum values, or patterns
4. **Verify `additionalProperties`** - should be `false` to prevent extra fields

Example error:
```
FAIL: should reject bundle with missing required field
Error: instancePath: /0, params: { missingProperty: 'entryId' }
```

This means a bundle is missing the `entryId` field, which is correct - the test expects this to fail validation.
