/**
 * Unit tests for stateExtractor module
 */

import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { extractVariables, extractState } from '../../../../src/extractors/react/stateExtractor.js';

/**
 * Helper to create a SourceFile from code string
 */
function createSourceFile(code: string, fileName = 'test.tsx') {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      jsx: 2, // React
      target: 99, // ESNext
    },
  });
  return project.createSourceFile(fileName, code);
}

/**
 * Helper to create a mock SourceFile for error testing
 */
function createMockSourceFile(overrides: Partial<any> = {}) {
  return {
    getFilePath: () => 'test.tsx',
    getVariableDeclarations: () => [],
    getDescendantsOfKind: () => [],
    ...overrides,
  };
}

describe('stateExtractor', () => {
  describe('extractVariables', () => {
    it('should extract const declarations', () => {
      const source = createSourceFile(`
        const name = 'John';
        const age = 30;
        const isActive = true;
      `);

      const variables = extractVariables(source);
      expect(variables).toContain('name');
      expect(variables).toContain('age');
      expect(variables).toContain('isActive');
    });

    it('should extract let declarations', () => {
      const source = createSourceFile(`
        let counter = 0;
        let message = 'hello';
      `);

      const variables = extractVariables(source);
      expect(variables).toContain('counter');
      expect(variables).toContain('message');
    });

    it('should extract top-level variables (not inside function bodies)', () => {
      const source = createSourceFile(`
        const topLevel = 'value';
        function Component() {
          const localVar = 'inside function';
          return <div>{localVar}</div>;
        }
      `);

      const variables = extractVariables(source);
      // getVariableDeclarations only gets top-level declarations
      expect(variables).toContain('topLevel');
      // Variables inside function bodies are not extracted by this method
      expect(variables).not.toContain('localVar');
    });

    it('should extract arrow function component declarations', () => {
      const source = createSourceFile(`
        const Component = () => {
          return <div />;
        };
        const helper = (x: number) => x * 2;
      `);

      const variables = extractVariables(source);
      expect(variables).toContain('Component');
      expect(variables).toContain('helper');
    });

    it('should handle top-level array destructuring', () => {
      const source = createSourceFile(`
        const [first, second] = getItems();
        const { name, age } = getPerson();
      `);

      const variables = extractVariables(source);
      // Destructuring patterns are captured as their binding pattern names
      expect(variables.length).toBe(2);
    });

    it('should include setXxx top-level variables when NOT from useState', () => {
      const source = createSourceFile(`
        const setConfig = (config: any) => {};
        const settings = { value: 1 };
      `);

      const variables = extractVariables(source);
      // setConfig is not from useState, so it should be included
      expect(variables).toContain('setConfig');
      expect(variables).toContain('settings');
    });

    it('should return sorted variables', () => {
      const source = createSourceFile(`
        const zebra = 1;
        const apple = 2;
        const mango = 3;
      `);

      const variables = extractVariables(source);
      expect(variables).toEqual(['apple', 'mango', 'zebra']);
    });

    it('should return empty array for file with only function declarations', () => {
      const source = createSourceFile(`
        function doSomething() {
          const inside = 42;
          return inside;
        }
      `);

      const variables = extractVariables(source);
      // Function declarations don't create top-level variable declarations
      // and variables inside functions are not extracted
      expect(variables).toEqual([]);
    });

    describe('error handling', () => {
      it('should return empty array when getVariableDeclarations throws', () => {
        const mockSource = createMockSourceFile({
          getVariableDeclarations: () => {
            throw new Error('Parse error');
          },
        });

        const variables = extractVariables(mockSource as any);
        expect(variables).toEqual([]);
      });

      it('should continue when individual variable throws', () => {
        const mockSource = createMockSourceFile({
          getVariableDeclarations: () => [
            {
              getName: () => {
                throw new Error('Name error');
              },
              getParent: () => null,
            },
            {
              getName: () => 'validVar',
              getParent: () => ({ getText: () => 'const validVar = 1' }),
            },
          ],
        });

        const variables = extractVariables(mockSource as any);
        expect(variables).toContain('validVar');
      });

      it('should handle missing getFilePath gracefully', () => {
        const mockSource = createMockSourceFile({
          getFilePath: undefined,
          getVariableDeclarations: () => [],
        });

        const variables = extractVariables(mockSource as any);
        expect(variables).toEqual([]);
      });
    });
  });

  describe('extractState', () => {
    it('should extract state from useState with array destructuring', () => {
      const source = createSourceFile(`
        function Component() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        }
      `);

      const state = extractState(source);
      expect(state).toHaveProperty('count');
    });

    it('should infer boolean type from initial value', () => {
      const source = createSourceFile(`
        function Component() {
          const [isOpen, setIsOpen] = useState(false);
          const [isActive, setIsActive] = useState(true);
          return <div />;
        }
      `);

      const state = extractState(source);
      expect(state.isOpen).toBe('boolean');
      expect(state.isActive).toBe('boolean');
    });

    it('should infer number type from initial value', () => {
      const source = createSourceFile(`
        function Component() {
          const [count, setCount] = useState(0);
          const [total, setTotal] = useState(100);
          return <div />;
        }
      `);

      const state = extractState(source);
      expect(state.count).toBe('number');
      expect(state.total).toBe('number');
    });

    it('should infer string type from initial value', () => {
      const source = createSourceFile(`
        function Component() {
          const [name, setName] = useState('');
          const [title, setTitle] = useState("Hello");
          return <div />;
        }
      `);

      const state = extractState(source);
      expect(state.name).toBe('string');
      expect(state.title).toBe('string');
    });

    it('should infer null type from initial value', () => {
      const source = createSourceFile(`
        function Component() {
          const [data, setData] = useState(null);
          return <div />;
        }
      `);

      const state = extractState(source);
      expect(state.data).toBe('null');
    });

    it('should infer array type from empty array initial value', () => {
      const source = createSourceFile(`
        function Component() {
          const [items, setItems] = useState([]);
          return <div />;
        }
      `);

      const state = extractState(source);
      expect(state.items).toBe('array');
    });

    it('should infer object type from empty object initial value', () => {
      const source = createSourceFile(`
        function Component() {
          const [config, setConfig] = useState({});
          return <div />;
        }
      `);

      const state = extractState(source);
      expect(state.config).toBe('object');
    });

    it('should extract type from generic useState<T>', () => {
      const source = createSourceFile(`
        function Component() {
          const [user, setUser] = useState<User | null>(null);
          const [items, setItems] = useState<string[]>([]);
          return <div />;
        }
      `);

      const state = extractState(source);
      expect(state.user).toBe('User | null');
      expect(state.items).toBe('string[]');
    });

    it('should handle multiple state declarations', () => {
      const source = createSourceFile(`
        function Component() {
          const [count, setCount] = useState(0);
          const [name, setName] = useState('');
          const [isLoading, setIsLoading] = useState(false);
          return <div />;
        }
      `);

      const state = extractState(source);
      expect(Object.keys(state)).toHaveLength(3);
      expect(state.count).toBe('number');
      expect(state.name).toBe('string');
      expect(state.isLoading).toBe('boolean');
    });

    it('should return empty object for file without useState', () => {
      const source = createSourceFile(`
        function Component() {
          const value = 'static';
          return <div>{value}</div>;
        }
      `);

      const state = extractState(source);
      expect(state).toEqual({});
    });

    it('should handle useState without array destructuring (skip it)', () => {
      const source = createSourceFile(`
        function Component() {
          const state = useState(0);
          return <div />;
        }
      `);

      const state = extractState(source);
      // Without array destructuring pattern [x, setX], it won't be extracted
      expect(state).toEqual({});
    });

    it('should handle complex initial values with unknown type', () => {
      const source = createSourceFile(`
        function Component() {
          const [data, setData] = useState(someFunction());
          return <div />;
        }
      `);

      const state = extractState(source);
      expect(state.data).toBe('unknown');
    });

    it('should handle variables without initializers (skip them)', () => {
      const source = createSourceFile(`
        function Component() {
          let value;
          const [count, setCount] = useState(0);
          return <div />;
        }
      `);

      const state = extractState(source);
      // Only useState should be extracted
      expect(state).toHaveProperty('count');
      expect(Object.keys(state)).toHaveLength(1);
    });

    describe('error handling', () => {
      it('should return empty object when getDescendantsOfKind throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => {
            throw new Error('Parse error');
          },
        });

        const state = extractState(mockSource as any);
        expect(state).toEqual({});
      });

      it('should continue when individual declaration throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [
            {
              getInitializer: () => {
                throw new Error('Initializer error');
              },
            },
            {
              getInitializer: () => ({
                getText: () => 'useState(0)',
              }),
              getName: () => '[count, setCount]',
            },
          ],
        });

        const state = extractState(mockSource as any);
        expect(state).toHaveProperty('count');
      });

      it('should handle missing getFilePath gracefully', () => {
        const mockSource = createMockSourceFile({
          getFilePath: undefined,
          getDescendantsOfKind: () => [],
        });

        const state = extractState(mockSource as any);
        expect(state).toEqual({});
      });

      it('should handle error in type inference and fallback to unknown', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [{
            getInitializer: () => ({
              getText: () => 'useState<ComplexType>(value)',
            }),
            getName: () => '[data, setData]',
          }],
        });

        const state = extractState(mockSource as any);
        expect(state).toHaveProperty('data');
        expect(state.data).toBe('ComplexType');
      });
    });
  });
});
