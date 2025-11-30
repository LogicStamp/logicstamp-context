# Test Documentation

This directory contains the comprehensive test suite for LogicStamp Context. The test suite ensures reliability, correctness, and consistency across all features.

## Test Structure

```
tests/
├── e2e/              # End-to-end CLI workflow tests
├── unit/             # Unit tests for core modules
├── fixtures/         # Test fixtures (sample projects)
├── setup.ts          # Global test setup
└── test-helpers.ts   # Shared test utilities
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with UI (interactive)
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Running Specific Test Suites

```bash
# Run only E2E tests
npm test -- e2e

# Run only unit tests
npm test -- unit

# Run a specific test file
npm test -- tokens.test.ts

# Run tests matching a pattern
npm test -- --grep "CLI"
```

## Test Categories

### E2E Tests (`tests/e2e/`)

End-to-end tests verify complete CLI workflows and command behavior:

- **`cli.context.test.ts`** - Context generation workflow
- **`cli.compare.test.ts`** - Comparison and drift detection
- **`cli.validate.test.ts`** - Validation command
- **`cli.clean.test.ts`** - Clean command
- **`cli.init.test.ts`** - Initialization workflow
- **`cli.style.test.ts`** - Style metadata extraction
- **`cli.options.test.ts`** - Command-line options
- **`cli.output.test.ts`** - Output formatting
- **`cli.advanced.test.ts`** - Advanced scenarios
- **`cli.version.test.ts`** - Version commands
- **`core.test.ts`** - Core functionality integration
- **`determinism.test.ts`** - Output consistency across runs

**Characteristics:**
- Test complete CLI workflows from command invocation to file output
- Use isolated temporary directories for each test
- Verify actual file system operations
- Test error handling and edge cases
- Ensure output format correctness

### Unit Tests (`tests/unit/`)

Unit tests verify individual modules and functions in isolation:

- **`astParser/`** - AST parsing and extraction
- **`styleExtractor/`** - Style metadata extraction
  - `styleExtractor.test.ts` - Main integration tests
  - `tailwind.test.ts` - Tailwind CSS extraction
  - `scss.test.ts` - SCSS/CSS module extraction
  - `styled.test.ts` - styled-components/Emotion extraction
  - `motion.test.ts` - framer-motion extraction
  - `material.test.ts` - Material UI extraction
  - `shadcn.test.ts` - ShadCN/UI extraction
  - `radix.test.ts` - Radix UI extraction
  - `layout.test.ts` - Layout metadata extraction
- **`pack/`** - Bundle generation
- **`tokens.test.ts`** - Token counting utilities
- **`gitignore.test.ts`** - Gitignore manipulation
- **`nextjs.test.ts`** - Next.js detection
- **`exports.test.ts`** - Module exports validation

**Characteristics:**
- Fast, isolated tests
- Mock external dependencies
- Test specific functions and edge cases
- Verify type handling and transformations

### Test Fixtures (`tests/fixtures/`)

Sample projects used for testing:

- **`simple-app/`** - Basic React app for testing core functionality
- **`nextjs-app/`** - Next.js App Router project for framework-specific tests

## Writing Tests

### Test File Naming

- E2E tests: `*.test.ts` in `e2e/` directory
- Unit tests: `*.test.ts` in `unit/` directory
- Follow the pattern: `feature.test.ts` or `module.test.ts`

### Basic Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { someFunction } from '../../src/core/module';

describe('Module Name', () => {
  it('should do something', () => {
    const result = someFunction(input);
    expect(result).toBe(expected);
  });
});
```

### E2E Test Pattern

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CLI Command', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'logicstamp-test-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should generate context files', async () => {
    // Test implementation
  });
});
```

### Using Test Fixtures

```typescript
import { resolve } from 'path';
import { readFile } from 'fs/promises';

const fixturePath = resolve(__dirname, '../fixtures/simple-app');

it('should process fixture correctly', async () => {
  const content = await readFile(join(fixturePath, 'src/App.tsx'), 'utf8');
  // Test with fixture content
});
```

## Test Helpers

The `test-helpers.ts` file provides utilities for common test operations:

- File system operations
- Temporary directory management
- Content comparison
- Output validation

Check `test-helpers.ts` for available utilities.

## Test Coverage

### Current Coverage

The test suite includes **153+ passing tests** covering:

- ✅ All CLI commands and workflows
- ✅ Core AST parsing functionality
- ✅ Contract building and validation
- ✅ Style metadata extraction
- ✅ Bundle generation and formatting
- ✅ Token counting and estimation
- ✅ Dependency resolution
- ✅ Path normalization (Windows/Unix)
- ✅ Error handling and edge cases
- ✅ Output format variations (json/pretty/ndjson)

### Coverage Goals

- Maintain >80% code coverage
- Cover all public APIs
- Test error paths and edge cases
- Verify cross-platform compatibility

### Viewing Coverage

```bash
# Generate coverage report
npm run test:coverage

# View HTML report (opens in browser)
open coverage/index.html
```

## Common Test Patterns

### Testing CLI Commands

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

it('should run command successfully', async () => {
  const { stdout, stderr } = await execAsync('stamp context --help');
  expect(stdout).toContain('Usage:');
  expect(stderr).toBe('');
});
```

### Testing File Output

```typescript
import { readFile } from 'fs/promises';
import { resolve } from 'path';

it('should generate correct output', async () => {
  // Run command that generates file
  const outputPath = resolve(testDir, 'context.json');
  const content = await readFile(outputPath, 'utf8');
  const parsed = JSON.parse(content);
  
  expect(parsed.type).toBe('LogicStampBundle');
  expect(parsed.schemaVersion).toBe('0.1');
});
```

### Testing Determinism

```typescript
it('should produce consistent output', async () => {
  const result1 = await generateContext(testDir);
  const result2 = await generateContext(testDir);
  
  expect(result1).toEqual(result2);
});
```

### Testing Error Cases

```typescript
it('should handle missing files gracefully', async () => {
  await expect(
    processComponent(nonexistentPath)
  ).rejects.toThrow('File not found');
});
```

## Debugging Tests

### Running a Single Test

```bash
# Run specific test file
npm test -- cli.context.test.ts

# Run specific test by name
npm test -- --grep "should generate context"
```

### Debug Mode

```bash
# Run with Node debugger
node --inspect-brk node_modules/.bin/vitest

# Run with verbose output
npm test -- --reporter=verbose
```

### Common Issues

1. **Tests failing due to file system races**
   - Ensure each test uses isolated temporary directories
   - Clean up resources in `afterEach` hooks

2. **Platform-specific failures**
   - Test on both Windows and Unix-like systems
   - Use path utilities from `node:path` for cross-platform compatibility

3. **Async timing issues**
   - Use proper async/await or Promise handling
   - Set appropriate timeouts for long-running operations

## Continuous Integration

Tests run automatically on:
- Every pull request
- Every commit to `main` branch
- Before publishing to npm

All tests must pass before merging PRs.

## Best Practices

1. **Keep tests isolated** - Each test should be independent
2. **Use descriptive names** - Test names should clearly describe what's being tested
3. **Test behavior, not implementation** - Focus on outcomes, not internals
4. **Clean up resources** - Remove temporary files and directories
5. **Mock external dependencies** - Don't rely on network or file system state
6. **Test edge cases** - Empty inputs, invalid paths, error conditions
7. **Maintain fixtures** - Keep test fixtures up to date with real-world examples

## Related Documentation

- [CONTRIBUTING.md](../CONTRIBUTING.md) - General contribution guidelines
- [vitest.config.ts](../vitest.config.ts) - Test configuration
- [package.json](../package.json) - Test scripts and dependencies

