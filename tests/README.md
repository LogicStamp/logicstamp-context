# Test Documentation

This directory contains the comprehensive test suite for LogicStamp Context. The test suite ensures reliability, correctness, and consistency across all features.

## Table of Contents

- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Test Categories](#test-categories)
- [Writing Tests](#writing-tests)
- [Test Helpers](#test-helpers)
- [Common Test Patterns](#common-test-patterns)
- [Test Coverage](#test-coverage)
- [Debugging Tests](#debugging-tests)
- [Continuous Integration](#continuous-integration)
- [Best Practices](#best-practices)
- [Related Documentation](#related-documentation)

## Test Structure

```
tests/
├── e2e/              # End-to-end CLI workflow tests
├── unit/             # Unit tests for core modules
│   ├── astParser/    # AST parsing tests
│   ├── styleExtractor/  # Style extraction tests
│   ├── pack/         # Bundle generation tests
│   └── watch/        # Watch mode tests
├── fixtures/         # Test fixtures (sample projects)
│   ├── simple-app/   # Basic React app
│   ├── nextjs-app/   # Next.js App Router project
│   ├── vue-app/      # Vue 3 project
│   ├── express-app/  # Express.js backend
│   └── nest-app/     # NestJS backend
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
- **`cli.ignore.test.ts`** - `.stampignore` file handling
- **`cli.security.test.ts`** - Secret detection and sanitization
- **`cli.toon.test.ts`** - TOON format output
- **`cli.watch.test.ts`** - Watch mode functionality
- **`core.test.ts`** - Core functionality integration
- **`determinism.test.ts`** - Output consistency across runs
- **`vue.test.ts`** - Vue.js framework support
- **`express.test.ts`** - Express.js backend support
- **`nest.test.ts`** - NestJS backend support

**Characteristics:**
- Test complete CLI workflows from command invocation to file output
- Use isolated temporary directories for each test
- Verify actual file system operations
- Test error handling and edge cases
- Ensure output format correctness

### Unit Tests (`tests/unit/`)

Unit tests verify individual modules and functions in isolation:

- **`astParser/`** - AST parsing and extraction
  - `astParser.test.ts` - Main parser with error handling tests
  - `detectors.test.ts` - Component kind and Next.js detection with error handling
  - `componentExtractor.test.ts` - Component extraction with error handling
  - `propExtractor.test.ts` - Prop extraction with error handling
  - `stateExtractor.test.ts` - State extraction with error handling
  - `eventExtractor.test.ts` - Event extraction with error handling
  - `exports.test.ts` - Export extraction tests
  - `backendDetectors.test.ts` - Backend framework detection (Express/NestJS)
  - `backendExtractor.test.ts` - Backend metadata extraction
  - `expressExtractor.test.ts` - Express.js route extraction
  - `nestjsExtractor.test.ts` - NestJS decorator extraction
  - `vueDetectors.test.ts` - Vue.js framework detection
- **`styleExtractor/`** - Style metadata extraction
  - `styleExtractor.test.ts` - Main integration tests
  - `tailwind.test.ts` - Tailwind CSS extraction
  - `scss.test.ts` - SCSS/CSS module extraction
  - `styled.test.ts` - styled-components/Emotion extraction
  - `styledJsx.test.ts` - styled-jsx extraction
  - `motion.test.ts` - framer-motion extraction
  - `material.test.ts` - Material UI extraction
  - `shadcn.test.ts` - ShadCN/UI extraction
  - `radix.test.ts` - Radix UI extraction
  - `layout.test.ts` - Layout metadata extraction
- **`pack/`** - Bundle generation
  - `pack.test.ts` - Main bundle packing tests
  - `resolver.test.ts` - Dependency resolution
  - `collector.test.ts` - Bundle collection
  - `packageInfo.test.ts` - Package.json parsing
- **`watch/`** - Watch mode
  - `incrementalWatch.test.ts` - Incremental rebuild logic
  - `watchHelpers.test.ts` - Watch mode utilities
- **`tokens.test.ts`** - Token counting utilities
- **`gitignore.test.ts`** - Gitignore manipulation
- **`nextjs.test.ts`** - Next.js detection
- **`exports.test.ts`** - Module exports validation
- **`manifest.test.ts`** - Dependency manifest building
- **`stampignore.test.ts`** - `.stampignore` file parsing
- **`secretDetector.test.ts`** - Secret/credential detection
- **`codeSanitizer.test.ts`** - Code sanitization
- **`toonFormat.test.ts`** - TOON format generation

**Characteristics:**
- Fast, isolated tests
- Mock external dependencies
- Test specific functions and edge cases
- Verify type handling and transformations
- Test error handling with `LOGICSTAMP_DEBUG` environment variable
- Verify debug log format: `[LogicStamp][DEBUG] moduleName.functionName error:`

### Test Fixtures (`tests/fixtures/`)

Sample projects used for testing:

- **`simple-app/`** - Basic React app for testing core functionality
- **`nextjs-app/`** - Next.js App Router project for framework-specific tests
- **`vue-app/`** - Vue 3 project for Vue.js framework tests
- **`express-app/`** - Express.js backend for backend framework tests
- **`nest-app/`** - NestJS backend for decorator-based backend tests

## Writing Tests

### Test File Naming

- E2E tests: `*.test.ts` in `e2e/` directory
- Unit tests: `*.test.ts` in `unit/` directory
- Follow the pattern: `feature.test.ts` or `module.test.ts`

### Unit Test Pattern

Unit tests verify individual functions and modules in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { createTestSourceFile } from '../test-helpers.js';
import { extractComponents } from '../../../src/extractors/react/index.js';

describe('Component Extractor', () => {
  it('should extract component names', () => {
    const sourceFile = createTestSourceFile(`
      function MyComponent() {
        return <div>Hello</div>;
      }
    `);
    
    const result = extractComponents(sourceFile);
    expect(result).toContain('MyComponent');
  });
});
```

**Key Points:**
- Use `createTestSourceFile()` from test helpers (see [Test Helpers](#test-helpers))
- Mock external dependencies when needed
- Test one function or module at a time
- Keep tests fast and isolated

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
import { join } from 'path';

const fixturePath = resolve(__dirname, '../fixtures/simple-app');

it('should process fixture correctly', async () => {
  const content = await readFile(join(fixturePath, 'src/App.tsx'), 'utf8');
  // Test with fixture content
});
```

## Test Helpers

### Unit Test Helpers (`tests/unit/test-helpers.ts`)

All unit tests that work with TypeScript AST parsing should use the centralized test helpers to ensure consistency and avoid direct `ts-morph` instantiation.

#### Available Helpers

**`createTestProject()`**
- Creates a new `ts-morph` Project instance with in-memory file system
- Use when you need a Project instance for multiple files

**`createTestProjectWithJSX()`**
- Creates a Project instance with JSX support enabled
- Use for React/TSX component tests

**`createTestSourceFile(sourceCode, fileName?, project?, options?)`**
- Creates a SourceFile from source code string
- Automatically creates a new Project if not provided
- Default filename: `'test.tsx'`
- Supports JSX via options: `{ jsx: 1 }`

**`runExtractorTests<T>(extractor, testCases)`**
- Runs multiple test cases with the same extractor function
- Reduces boilerplate for parameterized tests
- Each test case includes `description`, `sourceCode`, and `assertions`

**Style Extractor Assertion Helpers:**
- `expectEmptyResult(result)` - Asserts empty components and packages arrays
- `expectComponents(result, expectedComponents)` - Asserts specific components exist
- `expectPackages(result, expectedPackages)` - Asserts specific packages exist
- `expectSortedPackages(result)` - Asserts packages array is sorted
- `expectComponentLimit(result, limit?)` - Asserts components count is within limit

#### Usage Examples

**Basic SourceFile Creation:**
```typescript
import { createTestSourceFile } from '../test-helpers.js';

it('should extract components', () => {
  const sourceFile = createTestSourceFile(`
    function MyComponent() {
      return <div>Hello</div>;
    }
  `);
  
  const result = extractComponents(sourceFile);
  expect(result).toContain('MyComponent');
});
```

**With Custom Filename:**
```typescript
const sourceFile = createTestSourceFile(sourceCode, 'Component.vue.ts');
```

**With JSX Support:**
```typescript
const sourceFile = createTestSourceFile(sourceCode, 'test.tsx', undefined, { jsx: 1 });
```

**Using runExtractorTests for Parameterized Tests:**
```typescript
import { runExtractorTests, type StyleExtractorTestCase } from '../test-helpers.js';

runExtractorTests(extractTailwindClasses, [
  {
    description: 'should extract basic classes',
    sourceCode: `<div className="flex p-4">Content</div>`,
    assertions: (result) => {
      expect(result).toContain('flex');
      expect(result).toContain('p-4');
    }
  },
  {
    description: 'should extract responsive classes',
    sourceCode: `<div className="md:flex lg:grid">Content</div>`,
    assertions: (result) => {
      expect(result).toContain('md:flex');
      expect(result).toContain('lg:grid');
    }
  }
]);
```

**Using Style Extractor Assertions:**
```typescript
import { expectComponents, expectPackages, expectSortedPackages } from './test-helpers.js';

it('should extract Ant Design components', () => {
  const sourceFile = createTestSourceFile(`
    import { Button, Card } from 'antd';
    function App() {
      return <Card><Button>Click</Button></Card>;
    }
  `);
  
  const result = extractAntDesign(sourceFile);
  
  expectComponents(result, ['Button', 'Card']);
  expectPackages(result, ['antd']);
  expectSortedPackages(result);
});
```

#### Import Pattern

For unit tests in subdirectories, import from the parent `test-helpers.ts`:
```typescript
// In tests/unit/astParser/componentExtractor.test.ts
import { createTestSourceFile } from '../test-helpers.js';

// In tests/unit/styleExtractor/antd.test.ts
import { createTestSourceFile, expectComponents } from './test-helpers.js';
// (which re-exports from ../test-helpers.js)
```

#### Best Practices

✅ **DO:**
- Always use `createTestSourceFile()` instead of directly instantiating `Project`
- Use assertion helpers for common checks
- Use `runExtractorTests()` for similar test cases
- Import from `test-helpers.js` (or subdirectory re-exports)

❌ **DON'T:**
- Don't use `new Project({ useInMemoryFileSystem: true })` directly
- Don't call `project.createSourceFile()` directly
- Don't import `Project` or `SourceFile` from `ts-morph` unless absolutely necessary

### E2E Test Helpers (`tests/test-helpers.ts`)

The root-level `test-helpers.ts` provides utilities for E2E tests:

- File system operations
- Temporary directory management
- Content comparison
- Output validation

Check `tests/test-helpers.ts` for available E2E utilities.

## Common Test Patterns

This section covers common patterns and examples for writing tests in this codebase.

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

### Testing Error Handling and Debug Logging

The codebase uses a centralized error handling system with debug logging. When testing error handling:

```typescript
import { beforeEach, afterEach, vi } from 'vitest';

describe('Error Handling', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Save original LOGICSTAMP_DEBUG value
    originalEnv = process.env.LOGICSTAMP_DEBUG;
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv === undefined) {
      delete process.env.LOGICSTAMP_DEBUG;
    } else {
      process.env.LOGICSTAMP_DEBUG = originalEnv;
    }
  });

  it('should log errors when LOGICSTAMP_DEBUG is enabled', async () => {
    process.env.LOGICSTAMP_DEBUG = '1';
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Trigger error condition
    await extractFromFile('/invalid/path.tsx');

    // Verify debug logs use correct format
    const errorCalls = consoleErrorSpy.mock.calls;
    if (errorCalls.length > 0) {
      const hasDebugLog = errorCalls.some(call =>
        call[0]?.toString().includes('[LogicStamp][DEBUG]') &&
        call[0]?.toString().includes('moduleName')
      );
      expect(hasDebugLog).toBe(true);
    }

    consoleErrorSpy.mockRestore();
  });

  it('should not log errors when LOGICSTAMP_DEBUG is disabled', async () => {
    delete process.env.LOGICSTAMP_DEBUG;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await extractFromFile('/invalid/path.tsx');

    // Should not have logged any errors
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
```

**Error Handling Test Patterns:**
- All error handling tests should verify the `[LogicStamp][DEBUG] moduleName.functionName error:` format
- Tests should check both enabled and disabled `LOGICSTAMP_DEBUG` states
- Always restore the original environment variable in `afterEach`
- Use `vi.spyOn(console, 'error')` to capture debug logs
- Verify graceful fallbacks (empty arrays/objects) when errors occur

## Test Coverage

### Current Coverage

The test suite includes **1188 passing tests** across **56 test files** covering:

- ✅ All CLI commands and workflows
- ✅ Core AST parsing functionality
- ✅ Contract building and validation
- ✅ Style metadata extraction (Tailwind, SCSS, styled-components, etc.)
- ✅ Bundle generation and formatting
- ✅ Token counting and estimation
- ✅ Dependency resolution
- ✅ Path normalization (Windows/Unix)
- ✅ Error handling and edge cases
- ✅ Output format variations (json/pretty/ndjson/toon)
- ✅ Vue.js framework support
- ✅ Backend frameworks (Express.js, NestJS)
- ✅ Watch mode with incremental rebuilds
- ✅ Secret detection and code sanitization
- ✅ `.stampignore` file handling

### Understanding Coverage Metrics

**Important:** The reported unit test coverage (~54%) doesn't reflect the full picture:

- **Unit Tests** (~54%): Test core logic, extractors, utilities, and parsers in isolation
- **E2E Tests** (not counted in coverage): Test CLI workflows end-to-end, exercising:
  - CLI entry points (`src/cli/index.ts`, `stamp.ts`)
  - CLI commands (`context.ts`, `compare.ts`, `init.ts`, etc.)
  - CLI handlers (via command execution)
  - Complete integration workflows

**Why the split?**
- E2E tests run CLI commands as subprocesses, so coverage instrumentation doesn't track them
- This is a common pattern for CLI tools: unit tests for core logic, e2e tests for CLI workflows
- Many files showing "0% coverage" are actually well-tested via e2e tests

**Effective Coverage:** Combined unit + e2e coverage is estimated at **70-80%+** for critical paths.

### Coverage Goals

- **Unit tests**: Maintain >70% coverage for core modules (extractors, parsers, utilities)
- **E2E tests**: Cover all CLI commands and workflows
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

### Testing with Debug Logging Enabled

To test error handling with debug logging enabled:

```bash
# Enable debug logging for all tests
LOGICSTAMP_DEBUG=1 npm test

# Enable debug logging for specific test
LOGICSTAMP_DEBUG=1 npm test -- astParser.test.ts
```

**Note:** Debug logging is controlled by the `LOGICSTAMP_DEBUG` environment variable. When set to `'1'`, error logs will be output in the format:
```
[LogicStamp][DEBUG] moduleName.functionName error: { context object }
```

Tests should verify this format when checking error handling behavior.

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

