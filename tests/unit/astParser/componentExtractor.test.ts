import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { extractHooks, extractComponents } from '../../../src/core/astParser/extractors/componentExtractor.js';

describe('Component Extractor', () => {
  describe('extractHooks', () => {
    it('should extract React hooks from component', () => {
      const sourceCode = `
        import { useState, useEffect } from 'react';
        
        function MyComponent() {
          const [count, setCount] = useState(0);
          const [name, setName] = useState('');
          
          useEffect(() => {
            console.log('mounted');
          }, []);
          
          const customHook = useCustomHook();
          
          return <div>{count}</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const hooks = extractHooks(sourceFile);

      expect(hooks).toContain('useState');
      expect(hooks).toContain('useEffect');
      expect(hooks).toContain('useCustomHook');
      expect(hooks.length).toBe(3);
      expect(hooks).toEqual(hooks.sort()); // Should be sorted
    });

    it('should not extract non-hook functions', () => {
      const sourceCode = `
        function MyComponent() {
          const result = calculate();
          const value = processData();
          return <div>{result}</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const hooks = extractHooks(sourceFile);

      expect(hooks).toEqual([]);
    });

    it('should handle empty file', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const hooks = extractHooks(sourceFile);

      expect(hooks).toEqual([]);
    });

    it('should deduplicate hooks', () => {
      const sourceCode = `
        function MyComponent() {
          const [a, setA] = useState(0);
          const [b, setB] = useState(1);
          const [c, setC] = useState(2);
          
          useEffect(() => {}, []);
          useEffect(() => {}, [a]);
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const hooks = extractHooks(sourceFile);

      expect(hooks.filter(h => h === 'useState').length).toBe(1);
      expect(hooks.filter(h => h === 'useEffect').length).toBe(1);
    });
  });

  describe('extractComponents', () => {
    it('should extract JSX components', () => {
      const sourceCode = `
        import { Button, Card } from './components';
        
        function MyComponent() {
          return (
            <div>
              <Button>Click me</Button>
              <Card>
                <Header />
              </Card>
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const components = extractComponents(sourceFile);

      expect(components).toContain('Button');
      expect(components).toContain('Card');
      expect(components).toContain('Header');
      expect(components).toEqual(components.sort()); // Should be sorted
    });

    it('should extract self-closing components', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div>
              <Image src="/logo.png" />
              <Icon name="user" />
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const components = extractComponents(sourceFile);

      expect(components).toContain('Image');
      expect(components).toContain('Icon');
    });

    it('should not extract lowercase HTML elements', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div>
              <span>Text</span>
              <button>Click</button>
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const components = extractComponents(sourceFile);

      expect(components).not.toContain('div');
      expect(components).not.toContain('span');
      expect(components).not.toContain('button');
    });

    it('should handle empty file', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const components = extractComponents(sourceFile);

      expect(components).toEqual([]);
    });

    it('should deduplicate components', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div>
              <Button />
              <Button />
              <Card />
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const components = extractComponents(sourceFile);

      expect(components.filter(c => c === 'Button').length).toBe(1);
      expect(components.filter(c => c === 'Card').length).toBe(1);
    });
  });
});

