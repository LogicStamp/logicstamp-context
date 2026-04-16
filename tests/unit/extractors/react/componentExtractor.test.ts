/**
 * Unit tests for componentExtractor module
 */

import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import {
  extractHooks,
  extractComponents,
} from '../../../../src/extractors/react/componentExtractor.js';

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
    getDescendantsOfKind: () => [],
    ...overrides,
  };
}

describe('componentExtractor', () => {
  describe('extractHooks', () => {
    it('should extract useState hook', () => {
      const source = createSourceFile(`
        import { useState } from 'react';
        function Component() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        }
      `);

      const hooks = extractHooks(source);
      expect(hooks).toContain('useState');
    });

    it('should extract multiple hooks', () => {
      const source = createSourceFile(`
        import { useState, useEffect, useMemo } from 'react';
        function Component() {
          const [count, setCount] = useState(0);
          useEffect(() => {}, []);
          const value = useMemo(() => count * 2, [count]);
          return <div>{value}</div>;
        }
      `);

      const hooks = extractHooks(source);
      expect(hooks).toContain('useState');
      expect(hooks).toContain('useEffect');
      expect(hooks).toContain('useMemo');
    });

    it('should extract custom hooks', () => {
      const source = createSourceFile(`
        import { useAuth } from './hooks';
        function Component() {
          const { user } = useAuth();
          return <div>{user.name}</div>;
        }
      `);

      const hooks = extractHooks(source);
      expect(hooks).toContain('useAuth');
    });

    it('should not extract non-hook function calls', () => {
      const source = createSourceFile(`
        function Component() {
          const result = calculateSum(1, 2);
          const data = fetchData();
          return <div>{result}</div>;
        }
      `);

      const hooks = extractHooks(source);
      expect(hooks).not.toContain('calculateSum');
      expect(hooks).not.toContain('fetchData');
      expect(hooks).toHaveLength(0);
    });

    it('should not extract lowercase use functions', () => {
      const source = createSourceFile(`
        function Component() {
          const result = useless();
          return <div>{result}</div>;
        }
      `);

      const hooks = extractHooks(source);
      expect(hooks).not.toContain('useless');
      expect(hooks).toHaveLength(0);
    });

    it('should extract hooks from method chain but not include the chain methods', () => {
      const source = createSourceFile(`
        function Component() {
          const items = useState([]).map(x => x);
          return <div />;
        }
      `);

      const hooks = extractHooks(source);
      expect(hooks).toContain('useState');
      expect(hooks).not.toContain('map');
    });

    it('should deduplicate hooks', () => {
      const source = createSourceFile(`
        function Component() {
          const [a, setA] = useState(0);
          const [b, setB] = useState('');
          return <div />;
        }
      `);

      const hooks = extractHooks(source);
      expect(hooks.filter((h) => h === 'useState')).toHaveLength(1);
    });

    it('should return sorted hooks', () => {
      const source = createSourceFile(`
        function Component() {
          const ref = useRef(null);
          const [count] = useState(0);
          useEffect(() => {}, []);
          return <div />;
        }
      `);

      const hooks = extractHooks(source);
      expect(hooks).toEqual(['useEffect', 'useRef', 'useState']);
    });

    it('should return empty array for file without hooks', () => {
      const source = createSourceFile(`
        function Component() {
          return <div>Hello</div>;
        }
      `);

      const hooks = extractHooks(source);
      expect(hooks).toEqual([]);
    });

    it('should handle property access expressions (not extract them)', () => {
      const source = createSourceFile(`
        function Component() {
          const result = React.useState(0);
          return <div />;
        }
      `);

      const hooks = extractHooks(source);
      // React.useState is a PropertyAccessExpression, not an Identifier
      // The extractor only extracts direct Identifier calls
      expect(hooks).toHaveLength(0);
    });

    describe('error handling', () => {
      it('should return empty array when getDescendantsOfKind throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => {
            throw new Error('Parse error');
          },
        });

        const hooks = extractHooks(mockSource as any);
        expect(hooks).toEqual([]);
      });

      it('should continue processing when individual call expression throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [
            {
              getExpression: () => {
                throw new Error('Expression error');
              },
            },
            {
              getExpression: () => ({
                getKind: () => 80, // SyntaxKind.Identifier
                getText: () => 'useState',
              }),
            },
          ],
        });

        const hooks = extractHooks(mockSource as any);
        // Should still extract the valid hook despite the error
        expect(hooks).toContain('useState');
      });

      it('should handle missing getFilePath gracefully', () => {
        const mockSource = createMockSourceFile({
          getFilePath: undefined,
          getDescendantsOfKind: () => [],
        });

        const hooks = extractHooks(mockSource as any);
        expect(hooks).toEqual([]);
      });
    });
  });

  describe('extractComponents', () => {
    it('should extract PascalCase JSX components', () => {
      const source = createSourceFile(`
        function App() {
          return (
            <Container>
              <Header />
              <Content>
                <Button>Click</Button>
              </Content>
            </Container>
          );
        }
      `);

      const components = extractComponents(source);
      expect(components).toContain('Container');
      expect(components).toContain('Header');
      expect(components).toContain('Content');
      expect(components).toContain('Button');
    });

    it('should not extract lowercase HTML elements', () => {
      const source = createSourceFile(`
        function App() {
          return (
            <div>
              <span>Text</span>
              <input type="text" />
              <button>Click</button>
            </div>
          );
        }
      `);

      const components = extractComponents(source);
      expect(components).not.toContain('div');
      expect(components).not.toContain('span');
      expect(components).not.toContain('input');
      expect(components).not.toContain('button');
      expect(components).toHaveLength(0);
    });

    it('should extract self-closing components', () => {
      const source = createSourceFile(`
        function App() {
          return (
            <div>
              <Icon />
              <Spacer />
              <Divider />
            </div>
          );
        }
      `);

      const components = extractComponents(source);
      expect(components).toContain('Icon');
      expect(components).toContain('Spacer');
      expect(components).toContain('Divider');
    });

    it('should deduplicate components', () => {
      const source = createSourceFile(`
        function App() {
          return (
            <div>
              <Button>One</Button>
              <Button>Two</Button>
              <Button>Three</Button>
            </div>
          );
        }
      `);

      const components = extractComponents(source);
      expect(components.filter((c) => c === 'Button')).toHaveLength(1);
    });

    it('should return sorted components', () => {
      const source = createSourceFile(`
        function App() {
          return (
            <div>
              <Zebra />
              <Apple />
              <Mango />
            </div>
          );
        }
      `);

      const components = extractComponents(source);
      expect(components).toEqual(['Apple', 'Mango', 'Zebra']);
    });

    it('should extract components with namespaces', () => {
      const source = createSourceFile(`
        function App() {
          return (
            <Form.Input />
          );
        }
      `);

      const components = extractComponents(source);
      // Form.Input is extracted as "Form.Input"
      expect(components).toContain('Form.Input');
    });

    it('should return empty array for file without components', () => {
      const source = createSourceFile(`
        function util() {
          return 42;
        }
      `);

      const components = extractComponents(source);
      expect(components).toEqual([]);
    });

    it('should handle mixed case scenarios', () => {
      const source = createSourceFile(`
        function App() {
          return (
            <div className="container">
              <MyComponent>
                <span>Hello</span>
              </MyComponent>
              <AnotherComponent prop={value} />
            </div>
          );
        }
      `);

      const components = extractComponents(source);
      expect(components).toContain('MyComponent');
      expect(components).toContain('AnotherComponent');
      expect(components).not.toContain('div');
      expect(components).not.toContain('span');
      expect(components).toHaveLength(2);
    });

    describe('error handling', () => {
      it('should return empty array when outer try block throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => {
            throw new Error('Parse error');
          },
        });

        const components = extractComponents(mockSource as any);
        expect(components).toEqual([]);
      });

      it('should continue when opening element iteration throws', () => {
        let callCount = 0;
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: (_kind: number) => {
            callCount++;
            if (callCount === 1) {
              // First call for JsxOpeningElement
              return [
                {
                  getTagNameNode: () => {
                    throw new Error('Tag error');
                  },
                },
              ];
            }
            // Second call for JsxSelfClosingElement
            return [
              {
                getTagNameNode: () => ({
                  getText: () => 'ValidComponent',
                }),
              },
            ];
          },
        });

        const components = extractComponents(mockSource as any);
        expect(components).toContain('ValidComponent');
      });

      it('should continue when self-closing element iteration throws', () => {
        let callCount = 0;
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: (_kind: number) => {
            callCount++;
            if (callCount === 1) {
              // First call for JsxOpeningElement
              return [
                {
                  getTagNameNode: () => ({
                    getText: () => 'OpeningComponent',
                  }),
                },
              ];
            }
            // Second call for JsxSelfClosingElement - throws
            return [
              {
                getTagNameNode: () => {
                  throw new Error('Self-closing error');
                },
              },
            ];
          },
        });

        const components = extractComponents(mockSource as any);
        expect(components).toContain('OpeningComponent');
      });

      it('should handle missing getFilePath gracefully', () => {
        const mockSource = createMockSourceFile({
          getFilePath: undefined,
          getDescendantsOfKind: () => [],
        });

        const components = extractComponents(mockSource as any);
        expect(components).toEqual([]);
      });

      it('should handle batch error in opening elements', () => {
        let callCount = 0;
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: (_kind: number) => {
            callCount++;
            if (callCount === 1) {
              // Throw on the forEach level for opening elements
              const arr: any[] = [];
              arr.forEach = () => {
                throw new Error('Batch error');
              };
              return arr;
            }
            return [];
          },
        });

        const components = extractComponents(mockSource as any);
        expect(components).toEqual([]);
      });
    });
  });
});
