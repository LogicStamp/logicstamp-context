import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import {
  extractLayoutMetadata,
  extractVisualMetadata,
} from '../../../src/core/styleExtractor/layout.js';

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
  });
});

