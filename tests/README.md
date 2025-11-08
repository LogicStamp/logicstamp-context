# LogicStamp Context - Test Suite

This directory contains end-to-end (E2E) tests for the LogicStamp Context CLI tool.

## Test Structure

```
tests/
├── e2e/
│   ├── cli.test.ts      # CLI integration tests
│   └── core.test.ts     # Core module tests
└── fixtures/
    └── simple-app/      # Sample React application for testing
        └── src/
            ├── components/
            │   ├── Button.tsx
            │   └── Card.tsx
            ├── utils/
            │   └── helpers.ts
            └── App.tsx
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (interactive)
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Coverage

### CLI Tests (`cli.test.ts`)

Tests the complete CLI workflow including:

- **Basic functionality**
  - Context generation for React apps
  - Custom depth configuration
  - Multiple output formats (json, ndjson, pretty)

- **Profile options**
  - `llm-safe` profile (conservative, max 30 nodes)
  - `llm-chat` profile (balanced, max 100 nodes)
  - `ci-strict` profile (strict validation)

- **Code inclusion options**
  - `--include-code none` (no code snippets)
  - `--include-code header` (headers only)
  - `--include-code full` (complete source)

- **Help and error handling**
  - Help display
  - Invalid path handling

- **Dependency graph validation**
  - Component dependency tracking
  - Summary statistics

### Core Module Tests (`core.test.ts`)

Tests individual modules in isolation:

- **AST Parser** (`astParser.ts`)
  - Extracting AST from React components
  - Identifying React imports
  - Component structure extraction
  - Props information extraction
  - Component dependency identification

- **Contract Builder** (`contractBuilder.ts`)
  - Building contracts for components
  - Extracting component signatures with props
  - Identifying component version elements
  - Working with different presets

- **Dependency Graph Builder** (`manifest.ts`)
  - Building dependency graphs from contracts
  - Identifying root and leaf components
  - Creating component relationships

- **Pack (Bundle Generator)** (`pack.ts`)
  - Generating bundles for components
  - Including dependencies based on depth
  - Respecting maxNodes limits

- **Integration: Full Pipeline**
  - End-to-end processing of React applications

## Test Fixtures

The `fixtures/simple-app` directory contains a minimal React application used for testing:

- **Button.tsx** - A simple button component with props
- **Card.tsx** - A card component that uses Button
- **App.tsx** - Root component that uses Card
- **helpers.ts** - Utility functions

These fixtures represent a typical React component hierarchy and are used to verify:
- Component extraction
- Dependency resolution
- Graph building
- Bundle generation

## Configuration

Tests are configured using Vitest:

- **Test environment**: Node.js
- **Test timeout**: 30 seconds (for long-running E2E tests)
- **Coverage provider**: v8
- **Coverage reports**: text, json, html

See `vitest.config.ts` for full configuration.

## Continuous Integration

Tests should be run as part of CI/CD pipeline:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## Writing New Tests

When adding new tests:

1. **For CLI tests**: Add to `tests/e2e/cli.test.ts`
   - Test the complete CLI workflow
   - Use fixtures from `tests/fixtures/simple-app`
   - Verify output files and console output

2. **For core module tests**: Add to `tests/e2e/core.test.ts`
   - Test individual module functionality
   - Mock or use fixtures as needed
   - Verify data structures and contracts

3. **For new fixtures**: Add to `tests/fixtures/`
   - Create realistic React components
   - Include TypeScript types
   - Add component dependencies

## Common Test Patterns

### Testing CLI output

```typescript
const { stdout, stderr } = await execAsync(
  `node dist/cli/index.js ${fixturesPath} --out ${outFile}`
);

expect(stdout).toContain('Context written to');
```

### Testing generated bundles

```typescript
const content = await readFile(outFile, 'utf-8');
const bundles = JSON.parse(content);

expect(bundles.length).toBeGreaterThan(0);
expect(bundles[0].type).toBe('LogicStampBundle');
```

### Testing core modules

```typescript
const ast = await extractFromFile(filePath);
const result = buildContract(filePath, ast, {
  preset: 'none',
  sourceText: text,
});

expect(result.contract).toBeDefined();
expect(result.contract?.type).toBe('UIFContract');
```

## Troubleshooting

### Tests timing out

Increase the timeout for specific tests:

```typescript
it('should handle large codebases', async () => {
  // test code
}, 60000); // 60 second timeout
```

### Path issues on Windows

Use `path.join()` for cross-platform compatibility:

```typescript
import { join } from 'node:path';
const filePath = join(fixturesPath, 'components', 'Button.tsx');
```

### Build failures

Ensure the project is built before running tests:

```bash
npm run build && npm test
```

## Test Results

Current test suite: **29 tests, all passing ✅**

- CLI Tests: 21 tests
- Core Module Tests: 8 tests
