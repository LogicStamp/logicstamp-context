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

> **Note:** Coverage metrics are automatically generated when running `npm run test:coverage`. The numbers below reflect the latest test run and may vary slightly between runs. For the most up-to-date coverage report, run `npm run test:coverage` and check the terminal output or `coverage/index.html`.

The test suite includes **108 test files** with **2,710 tests** and the following coverage metrics:

| Metric     | Coverage |
|------------|----------|
| Statements | 88.05%   |
| Branches   | 77.23%   |
| Functions  | 93.9%    |
| Lines      | 88.23%   |

**Coverage by module:**

| Module                | Statements | Branches | Functions | Lines | Notes |
|-----------------------|------------|----------|-----------|-------|-------|
| `core/`               | 97.13%     | 89.04%   | 97.18%    | 97.08% | AST parsing, contracts, signatures |
| `extractors/react/`   | 92.16%     | 76.51%   | 100%      | 92.03% | Component, prop, state extraction |
| `extractors/nest/`    | 91.89%     | 76.19%   | 100%      | 91.54% | NestJS decorator extraction |
| `extractors/express/` | 87.14%     | 68.08%   | 100%      | 86.95% | Express route extraction |
| `extractors/styling/` | 84.93%     | 69.73%   | 98.55%    | 85.44% | Tailwind, SCSS, styled-components |
| `extractors/vue/`     | 92.21%     | 67.82%   | 100%      | 92.54% | Vue.js component extraction |
| `cli/commands/`       | 89.14%     | 80.75%   | 90.47%    | 89.14% | CLI command implementations |
| `cli/commands/context/` | 88.93%   | 83.86%   | 85.12%    | 89.7%  | Context generation commands |
| `cli/handlers/`       | 94.77%     | 84.41%   | 100%      | 94.75% | Command handlers |
| `utils/`              | 84.61%     | 77.8%    | 91.71%    | 84.31% | Utilities, config, file operations |

### Detailed Coverage Report

> **Note:** This report is automatically generated by `npm run test:coverage`. For the most up-to-date detailed report, run the command and check the terminal output or open `coverage/index.html` in your browser.

```
----------------------------|---------|----------|---------|---------|----------------------------------------
File                        | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------------------------|---------|----------|---------|---------|----------------------------------------
All files                   |   88.05 |    77.23 |    93.9 |   88.23 |                                        
 cli                        |   76.92 |       85 |      75 |   76.66 |                                        
  stamp.ts                  |   73.41 |    83.92 |      50 |   73.07 | 30-41,47-49,71-73,162-166              
  validate-index.ts         |     100 |      100 |     100 |     100 |                                        
 cli/commands               |   89.14 |    80.75 |   90.47 |   89.14 |                                        
  clean.ts                  |     100 |       95 |     100 |     100 | 101,138                                
  compare.ts                |   89.21 |    81.58 |   91.89 |   89.16 | ...463-469,479-485,498-500,723,748-750 
  context.ts                |   90.39 |    78.19 |     100 |      90 | 270-277,299-321,325,476-477            
  ignore.ts                 |   90.62 |    76.92 |     100 |   90.32 | 57-60                                  
  init.ts                   |   85.71 |    82.08 |      40 |   85.71 | ...,86,102-104,141,150-151,183,192-193 
  security.ts               |   93.43 |    80.23 |     100 |   93.43 | 172-178,192-199,333                    
  style.ts                  |     100 |      100 |     100 |     100 |                                        
  validate.ts               |   84.18 |    77.77 |   84.61 |   84.51 | ...476-477,480-481,488-489,504-510,520 
 cli/commands/context       |   88.93 |    83.86 |   85.12 |    89.7 |                                        
  bundleFormatter.ts        |     100 |      100 |     100 |     100 |                                        
  configManager.ts          |     100 |      100 |     100 |     100 |                                        
  contractBuilder.ts        |     100 |      100 |     100 |     100 |                                        
  fileWriter.ts             |   80.39 |       75 |     100 |   79.79 | 22,123,125,171-178,255-276              
  incrementalWatch.ts       |     100 |    91.37 |     100 |     100 | 134-161,200,281                        
  statsCalculator.ts        |     100 |      100 |     100 |     100 |                                        
  tokenEstimator.ts         |   90.84 |    79.72 |   93.75 |   91.11 | 38-39,48,188-189,205,419-426            
  watchDiff.ts              |   82.74 |     79.8 |   68.57 |   84.74 | ...456,459,462,481-485,490-494,499-503 
  watchMode.ts              |   85.24 |    82.78 |   78.57 |   86.44 | ...253-256,402-403,442,648-653,672-673 
 cli/handlers               |   94.77 |    84.41 |     100 |   94.75 |                                        
  cleanHandler.ts           |     100 |      100 |     100 |     100 |                                        
  compareHandler.ts         |   92.53 |     78.7 |     100 |   92.53 | ...195,202-208,220-227,233-241,277,292 
  contextHandler.ts         |     100 |      100 |     100 |     100 |                                        
  ignoreHandler.ts          |     100 |      100 |     100 |     100 |                                        
  initHandler.ts            |     100 |      100 |     100 |     100 |                                        
  securityHandler.ts        |     100 |    94.44 |     100 |     100 | 31                                      
  styleHandler.ts           |     100 |      100 |     100 |     100 |                                        
  validateHandler.ts        |     100 |      100 |     100 |     100 |                                        
 cli/parser                 |   84.61 |    82.71 |     100 |      84 |                                        
  argumentParser.ts         |   83.33 |    82.71 |     100 |    82.6 | 95-111,128-135,227-228                  
  helpText.ts               |     100 |      100 |     100 |     100 |                                        
 core                       |   97.13 |    89.04 |   97.18 |   97.08 |                                        
  astParser.ts              |   96.52 |    78.87 |   96.66 |   96.52 | 79-84,304,356                          
  contractBuilder.ts        |     100 |      100 |     100 |     100 |                                        
  manifest.ts               |     100 |       94 |     100 |     100 | 83,221,229                              
  pack.ts                   |      91 |    75.71 |   85.71 |    90.9 | 71-76,118-127,368,492                  
  signature.ts              |     100 |    97.12 |     100 |     100 | 116,122-125,298                          
  styleExtractor.ts         |       0 |        0 |       0 |       0 |                                        
 core/astParser             |   78.07 |     70.6 |      95 |   77.85 |                                        
  detectors.ts              |   78.07 |     70.6 |      95 |   77.85 | ...583,606,620,626-629,650-663,702-706 
 core/pack                  |    91.3 |    85.18 |     100 |   91.85 |                                        
  builder.ts                |   88.88 |    85.71 |     100 |   87.87 | 41-43,115                              
  collector.ts              |   98.07 |    86.84 |     100 |   98.07 | 46                                      
  loader.ts                 |   85.21 |       70 |     100 |    86.6 | 200-207,270,282,297,331-341,385-395    
  packageInfo.ts            |     100 |      100 |     100 |     100 |                                        
  resolver.ts               |    93.1 |       90 |     100 |    93.1 | 27,45                                    
 extractors/express         |   87.14 |    68.08 |     100 |   86.95 |                                        
  expressExtractor.ts       |   87.14 |    68.08 |     100 |   86.95 | 71,87-100,132-134,180-185               
 extractors/nest            |   91.89 |    76.19 |     100 |   91.54 |                                        
  nestjsExtractor.ts        |   91.89 |    76.19 |     100 |   91.54 | 61,87,114-118,179-185                   
 extractors/react           |   92.16 |    76.51 |     100 |   92.03 |                                        
  componentExtractor.ts     |   94.44 |    69.23 |     100 |   94.44 | 108-112                                
  eventExtractor.ts         |    92.4 |    80.32 |     100 |    92.4 | 71,83,168-171                          
  hookParameterExtractor.ts |   89.88 |    73.94 |     100 |   89.88 | ...158,169-183,246,262-265,357,385-389 
  propExtractor.ts          |   91.91 |       75 |     100 |   91.91 | 28-35,48,57,169-172                     
  stateExtractor.ts         |   98.07 |    84.09 |     100 |   97.77 | 85                                      
 extractors/shared          |    88.7 |    83.33 |     100 |    88.7 |                                        
  backendExtractor.ts       |   88.37 |    80.55 |     100 |   88.37 | 119-126,148-154                         
  propTypeNormalizer.ts     |   89.47 |    88.88 |     100 |   89.47 | 79-83                                    
 extractors/styling         |   84.93 |    69.73 |   98.55 |   85.44 |                                        
  antd.ts                   |   85.57 |    72.44 |     100 |   85.14 | ...179,211,233,256,291,312,330,349-353 
  chakra.ts                 |      80 |    68.31 |     100 |   81.08 | ...124,153,185,214,255,295,313,331-335 
  layout.ts                 |   94.36 |       80 |     100 |   93.75 | 101-104,169-172                         
  material.ts               |   87.39 |    73.19 |     100 |   87.61 | ...159,195,213,248,268,307,325,344-348 
  motion.ts                 |   83.66 |    61.49 |     100 |      84 | ...282,297,309,353,372,416,445,456-460 
  radix.ts                  |   88.88 |    79.76 |     100 |   89.51 | 108,179,185-193,207,350-353            
  scss.ts                   |   95.58 |    72.46 |     100 |   95.58 | 220,234-238                            
  shadcn.ts                 |   88.33 |     80.2 |   81.81 |   89.28 | 133,172-175,276,310-313,373-376         
  styleExtractor.ts         |    82.2 |    65.03 |     100 |   82.88 | ...568,588-597,612-624,639-647,662-670 
  styled.ts                 |   84.92 |    67.46 |     100 |   85.48 | ...192,234-235,246-249,273,287-300,336 
  styledJsx.ts              |   67.41 |    57.57 |     100 |   68.67 | 18,33-53,72-77,115-135,200,212-217      
  tailwind.ts               |    86.3 |    73.96 |     100 |   87.01 | ...486,492-494,532-535,608-611,638-641 
 extractors/vue             |   92.21 |    67.82 |     100 |   92.54 |                                        
  componentExtractor.ts     |   92.21 |    67.82 |     100 |   92.54 | ...419,427-430,444,509,582,608,662-669 
 utils                      |   84.61 |     77.8 |   91.71 |   84.31 |                                        
  cleanup.ts                |   82.08 |    94.44 |   66.66 |   80.64 | 121-123,129-131,137-139,147-149         
  codeSanitizer.ts          |    93.2 |       80 |     100 |   93.13 | 36,85-89,106                            
  config.ts                 |   82.46 |       75 |   96.15 |   82.46 | ...130,248-260,405-411,471-477,600-606 
  debug.ts                  |     100 |      100 |     100 |     100 |                                        
  fileLock.ts               |   87.87 |       80 |     100 |    87.3 | 36,48,63,71,79-80,100,194              
  fsx.ts                    |   84.52 |    71.42 |     100 |   83.33 | 150-162,183-189,202                    
  gitignore.ts              |   76.92 |    70.37 |      95 |   75.51 | 119,129,202-224,280,316-338             
  hash.ts                   |   94.44 |    84.09 |   88.23 |   94.28 | 228-235                                
  llmContext.ts             |     100 |      100 |     100 |     100 |                                        
  schemaValidator.ts        |   79.16 |    68.75 |     100 |   82.22 | 36,55-62,80,143                         
  secretDetector.ts         |   96.87 |       85 |     100 |   96.66 | 162                                      
  stampignore.ts            |   80.95 |    74.41 |     100 |   80.48 | 92-114,175,197,217,254-259              
  tokens.ts                 |   75.51 |    70.83 |   85.71 |   75.51 | 58-66,87-90,111,134,149-151            
----------------------------|---------|----------|---------|---------|----------------------------------------
```

**Features covered:**

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

