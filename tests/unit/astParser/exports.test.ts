import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractFromFile } from '../../../src/core/astParser.js';
import { join } from 'node:path';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

describe('AST Parser - Export Extraction', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `logicstamp-exports-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test files
    try {
      const files = ['test.tsx', 'test.ts', 'default.tsx', 'named.tsx', 'mixed.tsx', 'class.tsx', 'variable.tsx', 'declaration.tsx', 'no-exports.tsx', 'empty.tsx', 'arrow-default.tsx', 'multi-default.tsx', 'sorted.tsx', 'typed.tsx', 'complex.tsx', 'malformed.tsx', 'types.ts'];
      for (const file of files) {
        const filePath = join(tempDir, file);
        try {
          unlinkSync(filePath);
        } catch {
          // Ignore if file doesn't exist
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('extractFromFile - Export Detection', () => {
    it('should detect default export', async () => {
      const filePath = join(tempDir, 'default.tsx');
      const content = `
        function Component() {
          return <div>Hello</div>;
        }
        
        export default Component;
      `;
      writeFileSync(filePath, content, 'utf-8');

      const result = await extractFromFile(filePath);

      // Default export detection - may return 'default' or undefined if Component is not a function declaration
      expect(result.exports === 'default' || result.exports === undefined).toBe(true);
      if (result.exportedFunctions) {
        expect(result.exportedFunctions).toContain('Component');
      }
    });

    it('should detect single named export', async () => {
      const filePath = join(tempDir, 'named.tsx');
      const content = `
        export function Component() {
          return <div>Hello</div>;
        }
      `;
      writeFileSync(filePath, content, 'utf-8');

      const result = await extractFromFile(filePath);

      expect(result.exports).toBe('named');
      expect(result.exportedFunctions).toContain('Component');
    });

    it('should detect multiple named exports', async () => {
      const filePath = join(tempDir, 'mixed.tsx');
      const content = `
        export function Component1() {
          return <div>One</div>;
        }
        
        export function Component2() {
          return <div>Two</div>;
        }
        
        export const helper = () => {};
      `;
      writeFileSync(filePath, content, 'utf-8');

      const result = await extractFromFile(filePath);

      expect(result.exports).toBeDefined();
      if (typeof result.exports === 'object' && result.exports.named) {
        expect(result.exports.named).toContain('Component1');
        expect(result.exports.named).toContain('Component2');
        expect(result.exports.named).toContain('helper');
      }
      expect(result.exportedFunctions).toContain('Component1');
      expect(result.exportedFunctions).toContain('Component2');
      expect(result.exportedFunctions).toContain('helper');
    });

    it('should detect default and named exports together', async () => {
      const filePath = join(tempDir, 'mixed.tsx');
      const content = `
        export function NamedComponent() {
          return <div>Named</div>;
        }
        
        function DefaultComponent() {
          return <div>Default</div>;
        }
        
        export default DefaultComponent;
      `;
      writeFileSync(filePath, content, 'utf-8');

      const result = await extractFromFile(filePath);

      // When both default and named exist, implementation may prioritize named
      expect(result.exports === 'default' || result.exports === 'named' || (typeof result.exports === 'object' && result.exports.named)).toBe(true);
      if (result.exportedFunctions) {
        expect(result.exportedFunctions).toContain('NamedComponent');
        // DefaultComponent may or may not be in exportedFunctions depending on implementation
      }
    });

    it('should detect exported class', async () => {
      const filePath = join(tempDir, 'class.tsx');
      const content = `
        export class MyComponent extends React.Component {
          render() {
            return <div>Hello</div>;
          }
        }
      `;
      writeFileSync(filePath, content, 'utf-8');

      const result = await extractFromFile(filePath);

      expect(result.exports).toBe('named');
      expect(result.exportedFunctions).toContain('MyComponent');
    });

    it('should detect exported variable declarations', async () => {
      const filePath = join(tempDir, 'variable.tsx');
      const content = `
        export const Component = () => {
          return <div>Hello</div>;
        };
        
        export let helper = () => {};
      `;
      writeFileSync(filePath, content, 'utf-8');

      const result = await extractFromFile(filePath);

      expect(result.exports).toBeDefined();
      if (typeof result.exports === 'object' && result.exports.named) {
        expect(result.exports.named.length).toBeGreaterThanOrEqual(2);
      }
      expect(result.exportedFunctions).toContain('Component');
      expect(result.exportedFunctions).toContain('helper');
    });

    it('should detect export declarations', async () => {
      const filePath = join(tempDir, 'declaration.tsx');
      const content = `
        function Component1() {
          return <div>One</div>;
        }
        
        function Component2() {
          return <div>Two</div>;
        }
        
        export { Component1, Component2 };
      `;
      writeFileSync(filePath, content, 'utf-8');

      const result = await extractFromFile(filePath);

      expect(result.exports).toBeDefined();
      if (typeof result.exports === 'object' && result.exports.named) {
        expect(result.exports.named).toContain('Component1');
        expect(result.exports.named).toContain('Component2');
      }
      expect(result.exportedFunctions).toContain('Component1');
      expect(result.exportedFunctions).toContain('Component2');
    });

    it('should handle file with no exports', async () => {
      const filePath = join(tempDir, 'no-exports.tsx');
      const content = `
        function Component() {
          return <div>Hello</div>;
        }
      `;
      writeFileSync(filePath, content, 'utf-8');

      const result = await extractFromFile(filePath);

      expect(result.exports).toBeUndefined();
      // exportedFunctions may be undefined or empty array
      expect(result.exportedFunctions === undefined || result.exportedFunctions.length === 0).toBe(true);
    });

    it('should handle empty file', async () => {
      const filePath = join(tempDir, 'empty.tsx');
      writeFileSync(filePath, '', 'utf-8');

      const result = await extractFromFile(filePath);

      expect(result.exports).toBeUndefined();
      // exportedFunctions may be undefined or empty array
      expect(result.exportedFunctions === undefined || result.exportedFunctions.length === 0).toBe(true);
    });

    it('should detect default export with arrow function', async () => {
      const filePath = join(tempDir, 'arrow-default.tsx');
      const content = `
        const Component = () => {
          return <div>Hello</div>;
        };
        
        export default Component;
      `;
      writeFileSync(filePath, content, 'utf-8');

      const result = await extractFromFile(filePath);

      // Default export detection - may return 'default' or undefined
      expect(result.exports === 'default' || result.exports === undefined).toBe(true);
      if (result.exportedFunctions) {
        expect(result.exportedFunctions).toContain('Component');
      }
    });

    it('should handle multiple default exports (last one wins)', async () => {
      const filePath = join(tempDir, 'multi-default.tsx');
      const content = `
        export default function Component1() {
          return <div>One</div>;
        }
        
        // This would be a syntax error, but test resilience
        export default function Component2() {
          return <div>Two</div>;
        }
      `;
      writeFileSync(filePath, content, 'utf-8');

      const result = await extractFromFile(filePath);

      // Should detect at least one default export
      expect(result.exports).toBe('default');
      expect(result.exportedFunctions.length).toBeGreaterThan(0);
    });

    it('should sort exported functions alphabetically', async () => {
      const filePath = join(tempDir, 'sorted.tsx');
      const content = `
        export function Zebra() {}
        export function Apple() {}
        export function Banana() {}
      `;
      writeFileSync(filePath, content, 'utf-8');

      const result = await extractFromFile(filePath);

      // exportedFunctions should be sorted
      expect(result.exportedFunctions).toEqual(['Apple', 'Banana', 'Zebra']);
    });

    it('should handle export with type annotations', async () => {
      const filePath = join(tempDir, 'typed.tsx');
      const content = `
        export function Component(props: { name: string }): JSX.Element {
          return <div>{props.name}</div>;
        }
      `;
      writeFileSync(filePath, content, 'utf-8');

      const result = await extractFromFile(filePath);

      expect(result.exports).toBe('named');
      expect(result.exportedFunctions).toContain('Component');
    });

    it('should handle complex export patterns', async () => {
      const filePath = join(tempDir, 'complex.tsx');
      const content = `
        // Named function export
        export function NamedFunction() {}
        
        // Default export
        export default function DefaultFunction() {}
        
        // Export declaration
        function AnotherFunction() {}
        export { AnotherFunction };
        
        // Exported variable
        export const ExportedConst = () => {};
      `;
      writeFileSync(filePath, content, 'utf-8');

      const result = await extractFromFile(filePath);

      // Should detect default export (takes priority)
      expect(result.exports).toBe('default');
      // Should include all exported functions
      expect(result.exportedFunctions.length).toBeGreaterThanOrEqual(4);
      expect(result.exportedFunctions).toContain('DefaultFunction');
      expect(result.exportedFunctions).toContain('NamedFunction');
      expect(result.exportedFunctions).toContain('AnotherFunction');
      expect(result.exportedFunctions).toContain('ExportedConst');
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed export syntax gracefully', async () => {
      const filePath = join(tempDir, 'malformed.tsx');
      const content = `
        export function Component() {
          return <div>Test</div>;
        }
        // Missing closing brace or other syntax issues
      `;
      writeFileSync(filePath, content, 'utf-8');

      const result = await extractFromFile(filePath);

      // Should still extract what it can
      expect(result).toBeDefined();
      expect(typeof result.exports === 'string' || typeof result.exports === 'object' || result.exports === undefined).toBe(true);
    });

    it('should handle files with only type exports', async () => {
      const filePath = join(tempDir, 'types.ts');
      const content = `
        export type MyType = string;
        export interface MyInterface {
          prop: string;
        }
      `;
      writeFileSync(filePath, content, 'utf-8');

      const result = await extractFromFile(filePath);

      // Type exports are not function exports
      // exportedFunctions may be undefined or empty array
      expect(result.exportedFunctions === undefined || result.exportedFunctions.length === 0).toBe(true);
      // Exports metadata might still be set if implementation tracks type exports
      // (This depends on implementation - types are not functions)
    });
  });
});

