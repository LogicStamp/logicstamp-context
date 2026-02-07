import { Project, SourceFile } from 'ts-morph';
import { it, expect } from 'vitest';

/**
 * Creates a new ts-morph Project instance for testing.
 * Uses in-memory file system to avoid touching the actual filesystem.
 */
export function createTestProject(): Project {
  return new Project({ useInMemoryFileSystem: true });
}

/**
 * Creates a new ts-morph Project instance with JSX support for testing.
 * Uses in-memory file system to avoid touching the actual filesystem.
 */
export function createTestProjectWithJSX(): Project {
  return new Project({ 
    useInMemoryFileSystem: true, 
    compilerOptions: { jsx: 1 } 
  });
}

/**
 * Creates a SourceFile from source code string for testing.
 * Automatically creates a new Project if not provided.
 * 
 * @param sourceCode - The source code to create a file from
 * @param fileName - The name of the file (default: 'test.tsx')
 * @param project - Optional project instance. If not provided, creates a new one.
 * @param options - Optional compiler options (e.g., { jsx: 1 } for JSX support)
 */
export function createTestSourceFile(
  sourceCode: string,
  fileName: string = 'test.tsx',
  project?: Project,
  options?: { jsx?: number }
): SourceFile {
  const proj = project ?? (options?.jsx ? createTestProjectWithJSX() : createTestProject());
  return proj.createSourceFile(fileName, sourceCode);
}

/**
 * Helper to create a test case with source code and expected results.
 * Useful for parameterized tests.
 */
export interface StyleExtractorTestCase<T> {
  description: string;
  sourceCode: string;
  assertions: (result: T) => void;
}

/**
 * Runs multiple test cases with the same extractor function.
 * Reduces boilerplate for similar test cases.
 */
export function runExtractorTests<T>(
  extractor: (sourceFile: SourceFile) => T,
  testCases: StyleExtractorTestCase<T>[]
): void {
  testCases.forEach(({ description, sourceCode, assertions }) => {
    it(description, () => {
      const sourceFile = createTestSourceFile(sourceCode);
      const result = extractor(sourceFile);
      assertions(result);
    });
  });
}

/**
 * Common assertion helpers for style extractor tests
 */
export const expectEmptyResult = <T extends { components: string[]; packages: string[] }>(
  result: T
): void => {
  expect(result.components).toEqual([]);
  expect(result.packages).toEqual([]);
};

/**
 * Asserts that a result contains specific components
 */
export const expectComponents = (
  result: { components: string[] },
  expectedComponents: string[]
): void => {
  expectedComponents.forEach(component => {
    expect(result.components).toContain(component);
  });
};

/**
 * Asserts that a result contains specific packages
 */
export const expectPackages = (
  result: { packages: string[] },
  expectedPackages: string[]
): void => {
  expectedPackages.forEach(pkg => {
    expect(result.packages).toContain(pkg);
  });
};

/**
 * Asserts that packages array is sorted alphabetically
 */
export const expectSortedPackages = (result: { packages: string[] }): void => {
  expect(result.packages).toEqual([...result.packages].sort());
};

/**
 * Asserts that components array length is within limit
 */
export const expectComponentLimit = (
  result: { components: string[] },
  limit: number = 20
): void => {
  expect(result.components.length).toBeLessThanOrEqual(limit);
};
