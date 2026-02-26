/**
 * Unit tests for eventExtractor module
 */

import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { extractEvents, extractJsxRoutes } from '../../../../src/extractors/react/eventExtractor.js';

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

describe('eventExtractor', () => {
  describe('extractEvents', () => {
    it('should extract event handlers that are props', () => {
      const source = createSourceFile(`
        interface Props {
          onClick: () => void;
        }
        function Button({ onClick }: Props) {
          return <button onClick={onClick}>Click</button>;
        }
      `);

      const props = { onClick: { type: 'function', signature: '() => void' } };
      const events = extractEvents(source, props);

      expect(events).toHaveProperty('onClick');
      expect(events.onClick).toEqual({
        type: 'function',
        signature: '() => void',
      });
    });

    it('should filter out event handlers that are not props', () => {
      const source = createSourceFile(`
        function Button() {
          const handleClick = () => {};
          return <button onClick={handleClick}>Click</button>;
        }
      `);

      // onClick is not in props, so it should be filtered
      const events = extractEvents(source, {});
      expect(events).not.toHaveProperty('onClick');
    });

    it('should use prop type signature when available', () => {
      const source = createSourceFile(`
        function Button({ onClick }: { onClick: (e: MouseEvent) => void }) {
          return <button onClick={(e) => onClick(e)}>Click</button>;
        }
      `);

      const props = {
        onClick: { type: 'function', signature: '(e: MouseEvent) => void' },
      };
      const events = extractEvents(source, props);

      expect(events.onClick.signature).toBe('(e: MouseEvent) => void');
    });

    it('should extract signature from arrow function when no prop signature', () => {
      const source = createSourceFile(`
        function Button({ onClick }: { onClick: Function }) {
          return <button onClick={(event) => onClick(event)}>Click</button>;
        }
      `);

      // Props without signature
      const props = { onClick: 'function' };
      const events = extractEvents(source, props);

      expect(events).toHaveProperty('onClick');
      expect(events.onClick.type).toBe('function');
      // Should extract signature from the arrow function
      expect(events.onClick.signature).toMatch(/event/);
    });

    it('should handle arrow function with no parameters', () => {
      const source = createSourceFile(`
        function Button({ onClick }: { onClick: () => void }) {
          return <button onClick={() => onClick()}>Click</button>;
        }
      `);

      const props = { onClick: 'function' };
      const events = extractEvents(source, props);

      expect(events.onClick.signature).toBe('() => void');
    });

    it('should handle multiple event handlers', () => {
      const source = createSourceFile(`
        function Form({ onSubmit, onChange, onBlur }: Props) {
          return (
            <form onSubmit={onSubmit}>
              <input onChange={onChange} onBlur={onBlur} />
            </form>
          );
        }
      `);

      const props = {
        onSubmit: { type: 'function', signature: '(e: FormEvent) => void' },
        onChange: { type: 'function', signature: '(e: ChangeEvent) => void' },
        onBlur: { type: 'function', signature: '() => void' },
      };
      const events = extractEvents(source, props);

      expect(events).toHaveProperty('onSubmit');
      expect(events).toHaveProperty('onChange');
      expect(events).toHaveProperty('onBlur');
    });

    it('should return empty object for file without event handlers', () => {
      const source = createSourceFile(`
        function Display({ text }: { text: string }) {
          return <div>{text}</div>;
        }
      `);

      const events = extractEvents(source, { text: 'string' });
      expect(events).toEqual({});
    });

    it('should not extract non-event props (not starting with on)', () => {
      const source = createSourceFile(`
        function Component({ data, config }: Props) {
          return <div data={data} config={config} />;
        }
      `);

      const props = { data: 'object', config: 'object' };
      const events = extractEvents(source, props);
      expect(events).toEqual({});
    });

    it('should handle identifier references (not arrow functions)', () => {
      const source = createSourceFile(`
        function Button({ onClick }: { onClick: () => void }) {
          return <button onClick={onClick}>Click</button>;
        }
      `);

      const props = { onClick: { type: 'function', signature: '(e: Event) => void' } };
      const events = extractEvents(source, props);

      // Should use prop signature since it's just an identifier reference
      expect(events.onClick.signature).toBe('(e: Event) => void');
    });

    it('should default to empty props when not provided', () => {
      const source = createSourceFile(`
        function Button() {
          return <button onClick={() => {}}>Click</button>;
        }
      `);

      // No props argument
      const events = extractEvents(source);
      expect(events).toEqual({});
    });

    describe('error handling', () => {
      it('should return empty object when getDescendantsOfKind throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => {
            throw new Error('Parse error');
          },
        });

        const events = extractEvents(mockSource as any, {});
        expect(events).toEqual({});
      });

      it('should continue when individual attribute throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [
            {
              getNameNode: () => {
                throw new Error('Name error');
              },
            },
            {
              getNameNode: () => ({
                getText: () => 'onClick',
              }),
              getInitializer: () => null,
            },
          ],
        });

        const props = { onClick: { type: 'function', signature: '() => void' } };
        const events = extractEvents(mockSource as any, props);
        expect(events).toHaveProperty('onClick');
      });

      it('should handle missing getFilePath gracefully', () => {
        const mockSource = createMockSourceFile({
          getFilePath: undefined,
          getDescendantsOfKind: () => [],
        });

        const events = extractEvents(mockSource as any, {});
        expect(events).toEqual({});
      });

      it('should handle error in signature extraction', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [{
            getNameNode: () => ({
              getText: () => 'onClick',
            }),
            getInitializer: () => ({
              getKind: () => 289, // JsxExpression
              getExpression: () => {
                throw new Error('Expression error');
              },
            }),
          }],
        });

        // Mock Node.isJsxExpression to return true
        const props = { onClick: 'function' };
        const events = extractEvents(mockSource as any, props);
        // Should still include the event with default signature
        expect(events).toHaveProperty('onClick');
      });
    });
  });

  describe('extractJsxRoutes', () => {
    it('should extract routes from href attribute', () => {
      const source = createSourceFile(`
        function Nav() {
          return (
            <nav>
              <a href="/home">Home</a>
              <a href="/about">About</a>
            </nav>
          );
        }
      `);

      const routes = extractJsxRoutes(source);
      expect(routes).toContain('/home');
      expect(routes).toContain('/about');
    });

    it('should extract routes from to attribute (React Router)', () => {
      const source = createSourceFile(`
        function Nav() {
          return (
            <nav>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/settings">Settings</Link>
            </nav>
          );
        }
      `);

      const routes = extractJsxRoutes(source);
      expect(routes).toContain('/dashboard');
      expect(routes).toContain('/settings');
    });

    it('should extract routes from path attribute', () => {
      const source = createSourceFile(`
        function Routes() {
          return (
            <Switch>
              <Route path="/users/:id" element={<User />} />
              <Route path="/products" element={<Products />} />
            </Switch>
          );
        }
      `);

      const routes = extractJsxRoutes(source);
      expect(routes).toContain('/users/:id');
      expect(routes).toContain('/products');
    });

    it('should extract routes from JSX expressions', () => {
      const source = createSourceFile(`
        function Nav() {
          return (
            <Link to={"/profile"}>Profile</Link>
          );
        }
      `);

      const routes = extractJsxRoutes(source);
      expect(routes).toContain('/profile');
    });

    it('should not extract non-route strings', () => {
      const source = createSourceFile(`
        function Component() {
          return (
            <div>
              <a href="https://example.com">External</a>
              <a href="mailto:test@example.com">Email</a>
              <a href="#section">Anchor</a>
            </div>
          );
        }
      `);

      const routes = extractJsxRoutes(source);
      expect(routes).not.toContain('https://example.com');
      expect(routes).not.toContain('mailto:test@example.com');
      expect(routes).not.toContain('#section');
    });

    it('should extract routes with parameters', () => {
      const source = createSourceFile(`
        function Routes() {
          return (
            <Route path="/users/:userId/posts/:postId" />
          );
        }
      `);

      const routes = extractJsxRoutes(source);
      expect(routes).toContain('/users/:userId/posts/:postId');
    });

    it('should return sorted routes', () => {
      const source = createSourceFile(`
        function Nav() {
          return (
            <nav>
              <Link to="/zebra" />
              <Link to="/apple" />
              <Link to="/mango" />
            </nav>
          );
        }
      `);

      const routes = extractJsxRoutes(source);
      expect(routes).toEqual(['/apple', '/mango', '/zebra']);
    });

    it('should deduplicate routes', () => {
      const source = createSourceFile(`
        function Nav() {
          return (
            <nav>
              <Link to="/home" />
              <a href="/home">Home</a>
              <Link to="/home">Also Home</Link>
            </nav>
          );
        }
      `);

      const routes = extractJsxRoutes(source);
      expect(routes.filter(r => r === '/home')).toHaveLength(1);
    });

    it('should return empty array for file without routes', () => {
      const source = createSourceFile(`
        function Button() {
          return <button>Click me</button>;
        }
      `);

      const routes = extractJsxRoutes(source);
      expect(routes).toEqual([]);
    });

    it('should extract routes from src attribute (for API routes)', () => {
      const source = createSourceFile(`
        function Component() {
          return <img src="/api/image" />;
        }
      `);

      const routes = extractJsxRoutes(source);
      expect(routes).toContain('/api/image');
    });

    it('should handle route attribute', () => {
      const source = createSourceFile(`
        function Component() {
          return <CustomRoute route="/custom" />;
        }
      `);

      const routes = extractJsxRoutes(source);
      expect(routes).toContain('/custom');
    });

    it('should ignore non-route attributes', () => {
      const source = createSourceFile(`
        function Component() {
          return (
            <div className="/not-a-route" id="/also-not">
              <span title="/ignore-this">Text</span>
            </div>
          );
        }
      `);

      const routes = extractJsxRoutes(source);
      expect(routes).toEqual([]);
    });

    describe('error handling', () => {
      it('should return empty array when getDescendantsOfKind throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => {
            throw new Error('Parse error');
          },
        });

        const routes = extractJsxRoutes(mockSource as any);
        expect(routes).toEqual([]);
      });

      it('should continue when individual attribute throws', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [
            {
              getNameNode: () => {
                throw new Error('Name error');
              },
            },
            {
              getNameNode: () => ({
                getText: () => 'href',
              }),
              getInitializer: () => ({
                getKind: () => 11, // StringLiteral
                getLiteralValue: () => '/valid-route',
              }),
            },
          ],
        });

        const routes = extractJsxRoutes(mockSource as any);
        expect(routes).toContain('/valid-route');
      });

      it('should handle missing getFilePath gracefully', () => {
        const mockSource = createMockSourceFile({
          getFilePath: undefined,
          getDescendantsOfKind: () => [],
        });

        const routes = extractJsxRoutes(mockSource as any);
        expect(routes).toEqual([]);
      });

      it('should use fallback when getLiteralValue throws for string literal', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [{
            getNameNode: () => ({
              getText: () => 'href',
            }),
            getInitializer: () => ({
              getKind: () => 11, // StringLiteral
              getLiteralValue: () => {
                throw new Error('Literal error');
              },
              getText: () => '"/fallback-route"',
            }),
          }],
        });

        const routes = extractJsxRoutes(mockSource as any);
        expect(routes).toContain('/fallback-route');
      });

      it('should extract route from JSX expression with string literal', () => {
        // Test the JSX expression path with a real source file
        const source = createSourceFile(`
          function Nav() {
            return <Link to={"/jsx-route"}>Link</Link>;
          }
        `);

        const routes = extractJsxRoutes(source);
        expect(routes).toContain('/jsx-route');
      });

      it('should handle non-StringLiteral initializers with fallback parsing', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [{
            getNameNode: () => ({
              getText: () => 'path',
            }),
            getInitializer: () => ({
              getKind: () => 999, // Unknown kind
              getText: () => '"/other-route"',
            }),
          }],
        });

        const routes = extractJsxRoutes(mockSource as any);
        expect(routes).toContain('/other-route');
      });

      it('should skip when fallback parsing fails', () => {
        const mockSource = createMockSourceFile({
          getDescendantsOfKind: () => [{
            getNameNode: () => ({
              getText: () => 'path',
            }),
            getInitializer: () => ({
              getKind: () => 999, // Unknown kind
              getText: () => {
                throw new Error('getText error');
              },
            }),
          }],
        });

        const routes = extractJsxRoutes(mockSource as any);
        expect(routes).toEqual([]);
      });
    });
  });
});
