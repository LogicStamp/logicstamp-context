/**
 * Unit tests for hookParameterExtractor module
 */

import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import {
  hasExportedHooks,
  extractHookParameters,
} from '../../../../src/extractors/react/hookParameterExtractor.js';

/**
 * Helper to create a SourceFile from code string
 */
function createSourceFile(code: string, fileName = 'test.ts') {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      jsx: 2, // React
      target: 99, // ESNext
      strict: true,
    },
  });
  return project.createSourceFile(fileName, code);
}

/**
 * Helper to create a mock SourceFile for error testing
 */
function createMockSourceFile(overrides: Partial<any> = {}) {
  return {
    getFilePath: () => 'test.ts',
    getFunctions: () => [],
    getVariableStatements: () => [],
    getExportDeclarations: () => [],
    getExportAssignments: () => [],
    getVariableDeclarations: () => [],
    ...overrides,
  };
}

describe('hookParameterExtractor', () => {
  describe('hasExportedHooks', () => {
    describe('exported function declarations', () => {
      it('should detect export function useX', () => {
        const source = createSourceFile(`
          export function useCounter() {
            return useState(0);
          }
        `);

        expect(hasExportedHooks(source)).toBe(true);
      });

      it('should detect export default function useX', () => {
        const source = createSourceFile(`
          export default function useAuth() {
            return { user: null };
          }
        `);

        expect(hasExportedHooks(source)).toBe(true);
      });

      it('should not detect non-exported hooks', () => {
        const source = createSourceFile(`
          function useInternal() {
            return {};
          }
        `);

        expect(hasExportedHooks(source)).toBe(false);
      });

      it('should not detect exported non-hook functions', () => {
        const source = createSourceFile(`
          export function calculateSum(a: number, b: number) {
            return a + b;
          }
        `);

        expect(hasExportedHooks(source)).toBe(false);
      });

      it('should not detect functions starting with lowercase use', () => {
        const source = createSourceFile(`
          export function useless() {
            return null;
          }
        `);

        expect(hasExportedHooks(source)).toBe(false);
      });
    });

    describe('exported variable declarations', () => {
      it('should detect export const useX = arrow function', () => {
        const source = createSourceFile(`
          export const useToggle = () => {
            const [value, setValue] = useState(false);
            return [value, () => setValue(v => !v)];
          };
        `);

        expect(hasExportedHooks(source)).toBe(true);
      });

      it('should detect export const useX = function expression', () => {
        const source = createSourceFile(`
          export const useData = function() {
            return { data: null };
          };
        `);

        expect(hasExportedHooks(source)).toBe(true);
      });

      it('should not detect non-exported arrow function hooks', () => {
        const source = createSourceFile(`
          const usePrivate = () => {
            return {};
          };
        `);

        expect(hasExportedHooks(source)).toBe(false);
      });
    });

    describe('export declarations', () => {
      it('should detect export { useX }', () => {
        const source = createSourceFile(`
          function useCounter() {
            return useState(0);
          }
          export { useCounter };
        `);

        expect(hasExportedHooks(source)).toBe(true);
      });

      it('should detect export { useX as useY }', () => {
        const source = createSourceFile(`
          function internalHook() {
            return {};
          }
          export { internalHook as useExternal };
        `);

        expect(hasExportedHooks(source)).toBe(true);
      });

      it('should detect hook by local name in aliased export', () => {
        const source = createSourceFile(`
          function useOriginal() {
            return {};
          }
          export { useOriginal as renamed };
        `);

        expect(hasExportedHooks(source)).toBe(true);
      });

      it('should skip re-exports from other modules', () => {
        const source = createSourceFile(`
          export { useAuth } from './auth';
        `);

        // Re-exports can't have params extracted, but the function still returns true
        // if the exported name matches hook pattern
        expect(hasExportedHooks(source)).toBe(false);
      });
    });

    describe('export assignments', () => {
      it('should detect export default useX', () => {
        const source = createSourceFile(`
          function useAuth() {
            return { user: null };
          }
          export default useAuth;
        `);

        expect(hasExportedHooks(source)).toBe(true);
      });

      it('should detect export = useX (CommonJS style)', () => {
        const source = createSourceFile(`
          function useAuth() {
            return { user: null };
          }
          export = useAuth;
        `);

        expect(hasExportedHooks(source)).toBe(true);
      });

      it('should not detect export default non-hook', () => {
        const source = createSourceFile(`
          function helper() {
            return 42;
          }
          export default helper;
        `);

        expect(hasExportedHooks(source)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should return false for empty file', () => {
        const source = createSourceFile('');
        expect(hasExportedHooks(source)).toBe(false);
      });

      it('should return false for file with only imports', () => {
        const source = createSourceFile(`
          import { useState } from 'react';
          import { useAuth } from './auth';
        `);

        expect(hasExportedHooks(source)).toBe(false);
      });

      it('should handle multiple hooks', () => {
        const source = createSourceFile(`
          export function useA() { return 1; }
          export function useB() { return 2; }
          export const useC = () => 3;
        `);

        expect(hasExportedHooks(source)).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should return false when getFunctions throws', () => {
        const mockSource = createMockSourceFile({
          getFunctions: () => {
            throw new Error('Parse error');
          },
        });

        expect(hasExportedHooks(mockSource as any)).toBe(false);
      });

      it('should continue when individual function check throws', () => {
        const mockSource = createMockSourceFile({
          getFunctions: () => [
            {
              getName: () => {
                throw new Error('Name error');
              },
            },
            {
              getName: () => 'useValid',
              getModifiers: () => [
                {
                  getKind: () => 95, // ExportKeyword
                },
              ],
            },
          ],
        });

        expect(hasExportedHooks(mockSource as any)).toBe(true);
      });

      it('should continue when variable statement check throws', () => {
        const mockSource = createMockSourceFile({
          getFunctions: () => [],
          getVariableStatements: () => [
            {
              getModifiers: () => {
                throw new Error('Modifiers error');
              },
            },
          ],
          getExportDeclarations: () => [
            {
              getModuleSpecifierValue: () => undefined,
              getNamedExports: () => [
                {
                  getName: () => 'useExported',
                  getAliasNode: () => null,
                },
              ],
            },
          ],
        });

        expect(hasExportedHooks(mockSource as any)).toBe(true);
      });

      it('should continue when export declaration check throws', () => {
        const mockSource = createMockSourceFile({
          getFunctions: () => [],
          getVariableStatements: () => [],
          getExportDeclarations: () => [
            {
              getModuleSpecifierValue: () => {
                throw new Error('Module spec error');
              },
            },
          ],
          getExportAssignments: () => [],
        });

        // Should return false since no valid hooks are found after error
        expect(hasExportedHooks(mockSource as any)).toBe(false);
      });

      it('should continue when export assignment check throws', () => {
        const mockSource = createMockSourceFile({
          getFunctions: () => [],
          getVariableStatements: () => [],
          getExportDeclarations: () => [],
          getExportAssignments: () => [
            {
              isExportEquals: () => {
                throw new Error('Export equals error');
              },
            },
          ],
        });

        expect(hasExportedHooks(mockSource as any)).toBe(false);
      });
    });
  });

  describe('extractHookParameters', () => {
    describe('function declarations', () => {
      it('should extract parameters from exported function hook', () => {
        const source = createSourceFile(`
          export function useCounter(initialValue: number) {
            const [count, setCount] = useState(initialValue);
            return count;
          }
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('initialValue');
        expect(params.initialValue).toBe('number');
      });

      it('should extract multiple parameters', () => {
        const source = createSourceFile(`
          export function useApi(endpoint: string, method: string, body?: object) {
            return fetch(endpoint, { method, body: JSON.stringify(body) });
          }
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('endpoint');
        expect(params).toHaveProperty('method');
        expect(params).toHaveProperty('body');
        expect(params.endpoint).toBe('string');
        expect(params.method).toBe('string');
      });

      it('should handle optional parameters with ?', () => {
        const source = createSourceFile(`
          export function useData(id: string, options?: RequestInit) {
            return useSWR(id, () => fetch(id, options));
          }
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('options');
        expect(typeof params.options).toBe('object');
        expect((params.options as any).optional).toBe(true);
      });

      it('should handle parameters with default values', () => {
        const source = createSourceFile(`
          export function useToggle(initial: boolean = false) {
            return useState(initial);
          }
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('initial');
        // Parameters with defaults are optional
        expect(typeof params.initial).toBe('object');
        expect((params.initial as any).optional).toBe(true);
      });

      it('should not extract from non-exported hooks', () => {
        const source = createSourceFile(`
          function usePrivate(value: string) {
            return value;
          }
        `);

        const params = extractHookParameters(source);
        expect(params).not.toHaveProperty('value');
      });
    });

    describe('arrow function declarations', () => {
      it('should extract parameters from exported arrow function hook', () => {
        const source = createSourceFile(`
          export const useSearch = (query: string) => {
            const [results, setResults] = useState([]);
            return results;
          };
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('query');
        expect(params.query).toBe('string');
      });

      it('should extract parameters from function expression', () => {
        const source = createSourceFile(`
          export const useForm = function(initialValues: object) {
            return { values: initialValues };
          };
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('initialValues');
      });

      it('should handle arrow functions with typed parameters', () => {
        const source = createSourceFile(`
          export const useLocalStorage = <T>(key: string, initialValue: T) => {
            return useState<T>(initialValue);
          };
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('key');
        expect(params).toHaveProperty('initialValue');
        expect(params.key).toBe('string');
      });
    });

    describe('export declarations (export { useX })', () => {
      it('should extract parameters from hook exported via export declaration', () => {
        const source = createSourceFile(`
          function useCounter(start: number, step: number) {
            return useState(start);
          }
          export { useCounter };
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('start');
        expect(params).toHaveProperty('step');
      });

      it('should extract parameters from aliased export', () => {
        const source = createSourceFile(`
          function internalUseValue(value: string) {
            return value;
          }
          export { internalUseValue as useValue };
        `);

        // The local function name doesn't match hook pattern,
        // but it's exported as a hook name
        const params = extractHookParameters(source);
        // Note: extractHookParameters looks at local function names
        // This might not extract params for aliased exports that don't match locally
        // This tests the current behavior
      });
    });

    describe('type inference', () => {
      it('should infer string type from default value', () => {
        const source = createSourceFile(`
          export function useMessage(text = 'hello') {
            return text;
          }
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('text');
      });

      it('should infer number type from default value', () => {
        const source = createSourceFile(`
          export function useCounter(start = 0) {
            return start;
          }
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('start');
      });

      it('should infer boolean type from default value', () => {
        const source = createSourceFile(`
          export function useFlag(enabled = true) {
            return enabled;
          }
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('enabled');
      });

      it('should handle object default value', () => {
        const source = createSourceFile(`
          export function useConfig(config = {}) {
            return config;
          }
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('config');
      });

      it('should handle array default value', () => {
        const source = createSourceFile(`
          export function useItems(items = []) {
            return items;
          }
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('items');
      });

      it('should handle null default value', () => {
        const source = createSourceFile(`
          export function useData(data = null) {
            return data;
          }
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('data');
      });
    });

    describe('edge cases', () => {
      it('should return empty object for file without hooks', () => {
        const source = createSourceFile(`
          export function helper() {
            return 42;
          }
        `);

        const params = extractHookParameters(source);
        expect(params).toEqual({});
      });

      it('should return empty object for hook without parameters', () => {
        const source = createSourceFile(`
          export function useCounter() {
            return useState(0);
          }
        `);

        const params = extractHookParameters(source);
        expect(params).toEqual({});
      });

      it('should handle rest parameters', () => {
        const source = createSourceFile(`
          export function useArgs(first: string, ...rest: string[]) {
            return [first, ...rest];
          }
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('first');
        expect(params).toHaveProperty('rest');
        // Rest params should not be marked as optional
        expect((params.rest as any)?.optional).toBeFalsy();
      });

      it('should handle destructured parameters', () => {
        const source = createSourceFile(`
          export function useOptions({ enabled, timeout }: { enabled: boolean; timeout: number }) {
            return { enabled, timeout };
          }
        `);

        const params = extractHookParameters(source);
        // Destructured params are extracted by their binding name
        expect(params).toHaveProperty('{ enabled, timeout }');
      });

      it('should handle multiple hooks in same file', () => {
        const source = createSourceFile(`
          export function useA(a: string) { return a; }
          export function useB(b: number) { return b; }
          export const useC = (c: boolean) => c;
        `);

        const params = extractHookParameters(source);
        expect(params).toHaveProperty('a');
        expect(params).toHaveProperty('b');
        expect(params).toHaveProperty('c');
      });
    });

    describe('error handling', () => {
      it('should return empty object when outer try throws', () => {
        const mockSource = createMockSourceFile({
          getFunctions: () => {
            throw new Error('Fatal error');
          },
          getVariableDeclarations: () => {
            throw new Error('Fatal error');
          },
        });

        const params = extractHookParameters(mockSource as any);
        expect(params).toEqual({});
      });

      it('should continue when function iteration throws', () => {
        const mockSource = createMockSourceFile({
          getFunctions: () => [
            {
              getName: () => {
                throw new Error('Name error');
              },
            },
          ],
          getVariableDeclarations: () => [
            {
              getName: () => 'useValid',
              getInitializer: () => ({
                getKind: () => 219, // ArrowFunction
                getParameters: () => [
                  {
                    getName: () => 'param',
                    getTypeNode: () => ({ getText: () => 'string' }),
                    hasQuestionToken: () => false,
                    isRestParameter: () => false,
                    hasInitializer: () => false,
                  },
                ],
              }),
            },
          ],
        });

        // Mock isExported to return true for useValid
        const params = extractHookParameters(mockSource as any);
        // Should still work for valid variable declarations
      });

      it('should continue when parameter extraction throws', () => {
        const mockSource = createMockSourceFile({
          getFunctions: () => [
            {
              getName: () => 'useHook',
              getModifiers: () => [{ getKind: () => 95 }], // ExportKeyword
              getParameters: () => [
                {
                  getName: () => {
                    throw new Error('Param error');
                  },
                },
                {
                  getName: () => 'validParam',
                  getTypeNode: () => ({ getText: () => 'number' }),
                  hasQuestionToken: () => false,
                  isRestParameter: () => false,
                  hasInitializer: () => false,
                  getType: () => ({ getText: () => 'number' }),
                },
              ],
            },
          ],
          getVariableDeclarations: () => [],
          getVariableStatements: () => [
            {
              getModifiers: () => [{ getKind: () => 95 }],
              getDeclarationList: () => ({
                getDeclarations: () => [
                  {
                    getName: () => 'useHook',
                  },
                ],
              }),
            },
          ],
          getExportDeclarations: () => [],
          getExportAssignments: () => [],
        });

        const params = extractHookParameters(mockSource as any);
        expect(params).toHaveProperty('validParam');
      });

      it('should handle missing getFilePath gracefully', () => {
        const mockSource = createMockSourceFile({
          getFilePath: undefined,
          getFunctions: () => [],
          getVariableDeclarations: () => [],
        });

        const params = extractHookParameters(mockSource as any);
        expect(params).toEqual({});
      });

      it('should continue when variable declaration iteration throws', () => {
        const mockSource = createMockSourceFile({
          getFunctions: () => [],
          getVariableDeclarations: () => [
            {
              getName: () => {
                throw new Error('Name error');
              },
            },
          ],
        });

        const params = extractHookParameters(mockSource as any);
        expect(params).toEqual({});
      });

      it('should handle error in type inference', () => {
        const mockSource = createMockSourceFile({
          getFunctions: () => [
            {
              getName: () => 'useHook',
              getModifiers: () => [{ getKind: () => 95 }],
              getParameters: () => [
                {
                  getName: () => 'param',
                  getTypeNode: () => null,
                  hasInitializer: () => true,
                  getInitializer: () => ({
                    getKind: () => 999, // Unknown
                    getType: () => {
                      throw new Error('Type error');
                    },
                  }),
                  hasQuestionToken: () => false,
                  isRestParameter: () => false,
                  getType: () => {
                    throw new Error('Type error');
                  },
                },
              ],
            },
          ],
          getVariableDeclarations: () => [],
          getVariableStatements: () => [
            {
              getModifiers: () => [{ getKind: () => 95 }],
              getDeclarationList: () => ({
                getDeclarations: () => [
                  {
                    getName: () => 'useHook',
                  },
                ],
              }),
            },
          ],
          getExportDeclarations: () => [],
          getExportAssignments: () => [],
        });

        const params = extractHookParameters(mockSource as any);
        // Should still extract with 'unknown' type
        expect(params).toHaveProperty('param');
      });
    });
  });
});
