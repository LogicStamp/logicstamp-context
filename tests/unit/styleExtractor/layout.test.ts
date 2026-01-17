import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import {
  extractLayoutMetadata,
  extractVisualMetadata,
} from '../../../src/extractors/styling/layout.js';

describe('Layout Extractor', () => {
  describe('extractLayoutMetadata', () => {
    it('should detect flex layout', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="flex items-center">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractLayoutMetadata(sourceFile);

      expect(result.type).toBe('flex');
    });

    it('should detect grid layout', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="grid grid-cols-3">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractLayoutMetadata(sourceFile);

      expect(result.type).toBe('grid');
    });

    it('should extract grid columns', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="grid grid-cols-2 md:grid-cols-3">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractLayoutMetadata(sourceFile);

      expect(result.cols).toBeDefined();
      expect(result.cols).toContain('2');
    });

    it('should detect hero pattern', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div>
              <h1 className="text-5xl">Hero Title</h1>
              <button>Get Started</button>
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractLayoutMetadata(sourceFile);

      expect(result.hasHeroPattern).toBe(true);
    });

    it('should detect feature cards pattern', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div className="grid">
              <div className="card rounded shadow">Card 1</div>
              <div className="card rounded shadow">Card 2</div>
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractLayoutMetadata(sourceFile);

      expect(result.hasFeatureCards).toBe(true);
    });

    it('should handle empty file', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const result = extractLayoutMetadata(sourceFile);

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should detect flex layout from dynamic className (cn function)', () => {
      const sourceCode = `
        import { cn } from '@/lib/utils';
        
        function MyComponent() {
          return <div className={cn('flex', 'items-center', 'justify-between')}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractLayoutMetadata(sourceFile);

      expect(result.type).toBe('flex');
    });

    it('should detect grid layout from template literal className (static segments)', () => {
      const sourceCode = `
        function MyComponent() {
          const cols = 'grid-cols-3';
          return <div className={\`grid gap-4 \${cols}\`}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractLayoutMetadata(sourceFile);

      // Should detect grid from static segment, but not dynamic variable
      expect(result.type).toBe('grid');
      // Note: cols variable is dynamic, so grid-cols-3 won't be extracted
      // This is expected - AST extraction only gets static segments
    });

    it('should detect flex layout from conditional className', () => {
      const sourceCode = `
        function MyComponent({ isActive }: { isActive: boolean }) {
          return <div className={isActive && 'flex items-center'}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractLayoutMetadata(sourceFile);

      expect(result.type).toBe('flex');
    });

    it('should detect flex layout from variant-prefixed class (md:flex)', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="md:flex items-center">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractLayoutMetadata(sourceFile);

      expect(result.type).toBe('flex');
    });

    it('should detect grid layout from variant-prefixed class (lg:grid)', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="lg:grid grid-cols-3">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractLayoutMetadata(sourceFile);

      expect(result.type).toBe('grid');
    });

    it('should detect hero pattern with variant-prefixed text (md:text-5xl)', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div>
              <h1 className="md:text-5xl">Hero Title</h1>
              <button>Get Started</button>
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractLayoutMetadata(sourceFile);

      expect(result.hasHeroPattern).toBe(true);
    });

    it('should extract grid columns from variant-prefixed classes', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractLayoutMetadata(sourceFile);

      expect(result.type).toBe('grid');
      expect(result.cols).toBeDefined();
      expect(result.cols).toContain('2');
      expect(result.cols).toContain('3');
      expect(result.cols).toContain('4');
    });
  });

  describe('extractVisualMetadata', () => {
    it('should extract color classes', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div className="bg-blue-500 text-white border-gray-300">
              Hello
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractVisualMetadata(sourceFile);

      expect(result.colors).toBeDefined();
      expect(result.colors?.length).toBeGreaterThan(0);
      expect(result.colors).toContain('bg-blue-500');
    });

    it('should extract spacing classes', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="p-4 m-2 px-6 py-8">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractVisualMetadata(sourceFile);

      expect(result.spacing).toBeDefined();
      expect(result.spacing?.length).toBeGreaterThan(0);
      expect(result.spacing).toContain('p-4');
    });

    it('should extract border radius', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="rounded-lg">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractVisualMetadata(sourceFile);

      expect(result.radius).toBe('lg');
    });

    it('should extract typography classes', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="text-xl font-bold">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractVisualMetadata(sourceFile);

      expect(result.typography).toBeDefined();
      expect(result.typography?.length).toBeGreaterThan(0);
    });

    it('should limit to top 10 items', () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div className="bg-blue-100 bg-blue-200 bg-blue-300 bg-blue-400 bg-blue-500 bg-blue-600 bg-blue-700 bg-blue-800 bg-blue-900 bg-indigo-100 bg-indigo-200 bg-indigo-300">
              Many colors
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractVisualMetadata(sourceFile);

      expect(result.colors?.length).toBeLessThanOrEqual(10);
    });

    it('should sort results for determinism', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="bg-zebra bg-apple bg-banana">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractVisualMetadata(sourceFile);

      if (result.colors) {
        expect(result.colors).toEqual([...result.colors].sort());
      }
    });

    it('should handle empty file', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const result = extractVisualMetadata(sourceFile);

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should extract colors from dynamic className (cn function)', () => {
      const sourceCode = `
        import { cn } from '@/lib/utils';
        
        function MyComponent() {
          return <div className={cn('bg-blue-500', 'text-white', 'border-gray-300')}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractVisualMetadata(sourceFile);

      expect(result.colors).toBeDefined();
      expect(result.colors?.length).toBeGreaterThan(0);
      expect(result.colors).toContain('bg-blue-500');
      expect(result.colors).toContain('text-white');
    });

    it('should extract spacing from template literal className (static segments)', () => {
      const sourceCode = `
        function MyComponent() {
          const padding = 'p-4';
          return <div className={\`m-2 \${padding}\`}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractVisualMetadata(sourceFile);

      expect(result.spacing).toBeDefined();
      expect(result.spacing?.length).toBeGreaterThan(0);
      // Static segment 'm-2' should be extracted
      expect(result.spacing).toContain('m-2');
      // Note: dynamic variable 'p-4' won't be extracted (expected limitation)
    });

    it('should extract colors from variant-prefixed classes (md:bg-blue-500, dark:text-slate-50)', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="md:bg-blue-500 dark:text-slate-50 border-gray-300">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractVisualMetadata(sourceFile);

      expect(result.colors).toBeDefined();
      expect(result.colors?.length).toBeGreaterThan(0);
      expect(result.colors).toContain('bg-blue-500');
      expect(result.colors).toContain('text-slate-50');
      expect(result.colors).toContain('border-gray-300');
    });

    it('should extract spacing from variant-prefixed classes (lg:px-4, sm:m-2)', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="lg:px-4 sm:m-2 p-4">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractVisualMetadata(sourceFile);

      expect(result.spacing).toBeDefined();
      expect(result.spacing?.length).toBeGreaterThan(0);
      expect(result.spacing).toContain('px-4');
      expect(result.spacing).toContain('m-2');
      expect(result.spacing).toContain('p-4');
    });

    it('should extract radius from variant-prefixed classes (md:rounded-xl)', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="md:rounded-xl rounded-lg">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractVisualMetadata(sourceFile);

      expect(result.radius).toBeDefined();
      // Should extract the most common radius token
      expect(['xl', 'lg']).toContain(result.radius);
    });

    it('should extract typography from variant-prefixed classes (sm:text-lg)', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="sm:text-lg font-bold text-xl">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractVisualMetadata(sourceFile);

      expect(result.typography).toBeDefined();
      expect(result.typography?.length).toBeGreaterThan(0);
      expect(result.typography).toContain('text-lg');
      expect(result.typography).toContain('font-bold');
      expect(result.typography).toContain('text-xl');
    });

    it('should extract negative spacing classes (-mt-2, -p-4)', () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="-mt-2 -p-4 md:-mx-6">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractVisualMetadata(sourceFile);

      expect(result.spacing).toBeDefined();
      expect(result.spacing?.length).toBeGreaterThan(0);
      expect(result.spacing).toContain('-mt-2');
      expect(result.spacing).toContain('-p-4');
      expect(result.spacing).toContain('-mx-6');
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSX gracefully in extractLayoutMetadata', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      // Malformed JSX - unclosed tag
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          return (
            <div className="flex p-4"
          );
        }
        `
      );

      // Should not throw, should return empty object or partial results
      const result = extractLayoutMetadata(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });

    it('should handle malformed JSX gracefully in extractVisualMetadata', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      // Malformed JSX - unclosed tag
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          return (
            <div className="bg-blue-500 text-white"
          );
        }
        `
      );

      // Should not throw, should return empty object or partial results
      const result = extractVisualMetadata(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });

    it('should handle empty SourceFile gracefully in extractLayoutMetadata', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const result = extractLayoutMetadata(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });

    it('should handle empty SourceFile gracefully in extractVisualMetadata', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const result = extractVisualMetadata(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });

    it('should handle SourceFile with syntax errors in extractLayoutMetadata', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      // Invalid TypeScript syntax
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          return (
            <div className="flex" 
          // Missing closing brace and parenthesis
        `
      );

      // Should not throw, should return empty object
      const result = extractLayoutMetadata(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });

    it('should handle SourceFile with syntax errors in extractVisualMetadata', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      // Invalid TypeScript syntax
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          return (
            <div className="bg-blue-500" 
          // Missing closing brace and parenthesis
        `
      );

      // Should not throw, should return empty object
      const result = extractVisualMetadata(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });

    it('should handle SourceFile with complex AST traversal errors in extractLayoutMetadata', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      // Code that might cause AST traversal issues
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          return (
            <div className={(() => { throw new Error('test'); })()}>
              Content
            </div>
          );
        }
        `
      );

      // Should not throw, should handle gracefully
      const result = extractLayoutMetadata(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });

    it('should handle SourceFile with complex AST traversal errors in extractVisualMetadata', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      // Code that might cause AST traversal issues
      const sourceFile = project.createSourceFile(
        'test.tsx',
        `
        export function Component() {
          return (
            <div className={(() => { throw new Error('test'); })()}>
              Content
            </div>
          );
        }
        `
      );

      // Should not throw, should handle gracefully
      const result = extractVisualMetadata(sourceFile);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });
  });
});

