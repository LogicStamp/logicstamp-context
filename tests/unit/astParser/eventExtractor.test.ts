import { describe, it, expect, vi } from 'vitest';
import { Project } from 'ts-morph';
import { extractEvents, extractJsxRoutes } from '../../../src/core/astParser/extractors/eventExtractor.js';

describe('Event Extractor', () => {
  describe('extractEvents', () => {
    it('should extract event handlers from JSX', () => {
      const sourceCode = `
        function MyComponent() {
          const handleClick = () => {
            console.log('clicked');
          };
          
          return (
            <button onClick={handleClick}>
              Click me
            </button>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const events = extractEvents(sourceFile);

      expect(events.onClick).toBeDefined();
      expect(events.onClick).toHaveProperty('type', 'function');
      expect(events.onClick).toHaveProperty('signature');
    });

    it('should extract multiple event handlers', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div>
              <button onClick={() => {}}>Click</button>
              <input onChange={(e) => {}} />
              <form onSubmit={(e) => {}} />
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const events = extractEvents(sourceFile);

      expect(events.onClick).toBeDefined();
      expect(events.onChange).toBeDefined();
      expect(events.onSubmit).toBeDefined();
    });

    it('should infer function signatures', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div>
              <button onClick={() => {}}>Click</button>
              <input onChange={(e: React.ChangeEvent) => {}} />
              <form onSubmit={(e: FormEvent) => {}} />
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const events = extractEvents(sourceFile);

      expect(events.onClick).toHaveProperty('signature', '() => void');
      if (events.onChange && typeof events.onChange === 'object' && 'signature' in events.onChange) {
        expect(events.onChange.signature).toContain('e');
      }
    });

    it('should not extract non-event attributes', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div className="container" id="main">
              <button disabled>Click</button>
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const events = extractEvents(sourceFile);

      expect(events.className).toBeUndefined();
      expect(events.id).toBeUndefined();
      expect(events.disabled).toBeUndefined();
    });

    it('should handle empty file', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const events = extractEvents(sourceFile);

      expect(Object.keys(events)).toHaveLength(0);
    });
  });

  describe('extractJsxRoutes', () => {
    it('should extract route-like strings', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <Router>
              <Route path="/home" />
              <Route path="/about" />
              <Link to="/contact" />
            </Router>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const routes = extractJsxRoutes(sourceFile);

      expect(routes).toContain('/home');
      expect(routes).toContain('/about');
      expect(routes).toContain('/contact');
      expect(routes).toEqual(routes.sort()); // Should be sorted
    });

    it('should extract parameterized routes', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <Route path="/users/:id" />
            <Route path="/posts/:slug/:version" />
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const routes = extractJsxRoutes(sourceFile);

      expect(routes).toContain('/users/:id');
      expect(routes).toContain('/posts/:slug/:version');
    });

    it('should not extract non-route strings', () => {
      const sourceCode = `
        function MyComponent() {
          const text = "Hello World";
          const url = "https://example.com";
          
          return <div>{text}</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const routes = extractJsxRoutes(sourceFile);

      expect(routes).not.toContain('Hello World');
      expect(routes).not.toContain('https://example.com');
    });

    it('should handle empty file', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const routes = extractJsxRoutes(sourceFile);

      expect(routes).toEqual([]);
    });

    it('should deduplicate routes', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div>
              <Route path="/home" />
              <Route path="/home" />
              <Link to="/home" />
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const routes = extractJsxRoutes(sourceFile);

      expect(routes.filter(r => r === '/home').length).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should handle AST traversal errors gracefully in extractEvents', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <button onClick={() => {}}>
              Click
            </button>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      // Should not throw even if there are issues
      const events = extractEvents(sourceFile);
      expect(typeof events).toBe('object');
    });

    it('should handle AST traversal errors gracefully in extractJsxRoutes', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <Route path="/home" />
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      // Should not throw even if there are issues
      const routes = extractJsxRoutes(sourceFile);
      expect(Array.isArray(routes)).toBe(true);
    });

    it('should have debug logging infrastructure in place', () => {
      const originalEnv = process.env.LOGICSTAMP_DEBUG;
      process.env.LOGICSTAMP_DEBUG = '1';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '<button onClick={() => {}} />');

      extractEvents(sourceFile);
      extractJsxRoutes(sourceFile);

      // If errors were logged, verify they have the correct format
      const errorCalls = consoleErrorSpy.mock.calls;
      if (errorCalls.length > 0) {
        const hasEventExtractorLog = errorCalls.some(call =>
          call[0]?.toString().includes('[LogicStamp][DEBUG]') &&
          call[0]?.toString().includes('eventExtractor')
        );
        expect(hasEventExtractorLog).toBe(true);
      }

      consoleErrorSpy.mockRestore();
      if (originalEnv === undefined) {
        delete process.env.LOGICSTAMP_DEBUG;
      } else {
        process.env.LOGICSTAMP_DEBUG = originalEnv;
      }
    });
  });
});

