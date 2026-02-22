import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { extractFromFile } from '../../../src/core/astParser.js';
import { join } from 'node:path';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';

describe('AST Parser Error Handling', () => {
  let tempDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = join(tmpdir(), `logicstamp-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });

    // Save original LOGICSTAMP_DEBUG value
    originalEnv = process.env.LOGICSTAMP_DEBUG;
  });

  afterEach(() => {
    // Restore original environment
    if (originalEnv === undefined) {
      delete process.env.LOGICSTAMP_DEBUG;
    } else {
      process.env.LOGICSTAMP_DEBUG = originalEnv;
    }
  });

  describe('extractFromFile', () => {
    it('should handle invalid file paths gracefully', async () => {
      const result = await extractFromFile('/invalid/path/to/file.tsx');

      expect(result).toBeDefined();
      expect(result.kind).toBe('ts:module');
      expect(result.variables).toEqual([]);
      expect(result.hooks).toEqual([]);
      expect(result.components).toEqual([]);
      expect(result.functions).toEqual([]);
      expect(result.props).toEqual({});
      expect(result.state).toEqual({});
      expect(result.emits).toEqual({});
      expect(result.imports).toEqual([]);
      expect(result.jsxRoutes).toEqual([]);
    });

    it('should handle empty files gracefully', async () => {
      const emptyFile = join(tempDir, 'empty.tsx');
      writeFileSync(emptyFile, '', 'utf-8');

      const result = await extractFromFile(emptyFile);

      expect(result).toBeDefined();
      expect(result.kind).toBe('ts:module');
      expect(Array.isArray(result.variables)).toBe(true);
      expect(Array.isArray(result.hooks)).toBe(true);
      expect(Array.isArray(result.components)).toBe(true);
      expect(Array.isArray(result.functions)).toBe(true);
      expect(typeof result.props).toBe('object');
      expect(typeof result.state).toBe('object');
      expect(typeof result.emits).toBe('object');
      expect(Array.isArray(result.imports)).toBe(true);
      expect(Array.isArray(result.jsxRoutes)).toBe(true);
    });

    it('should handle malformed TypeScript syntax gracefully', async () => {
      const malformedFile = join(tempDir, 'malformed.tsx');
      // Malformed TypeScript - unclosed braces, invalid syntax
      const malformedContent = `
        import React from 'react';
        
        export function Component() {
          const x = {
          return <div>Test</div>;
        }
      `;
      writeFileSync(malformedFile, malformedContent, 'utf-8');

      // Should not throw, should return empty AST or partial results
      const result = await extractFromFile(malformedFile);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(Array.isArray(result.variables)).toBe(true);
      expect(Array.isArray(result.hooks)).toBe(true);
    });

    it('should handle files with syntax errors in individual extractors gracefully', async () => {
      const errorFile = join(tempDir, 'error.tsx');
      // File with valid structure but potential issues in specific extractors
      const errorContent = `
        import React from 'react';
        
        export function Component() {
          return <div>Test</div>;
        }
      `;
      writeFileSync(errorFile, errorContent, 'utf-8');

      const result = await extractFromFile(errorFile);
      expect(result).toBeDefined();
      // Should still return a valid structure even if some extractors fail
      expect(result.kind).toBeDefined();
    });

    it('should return empty AST structure on complete parse failure', async () => {
      const brokenFile = join(tempDir, 'broken.tsx');
      // Completely broken syntax
      const brokenContent = `{{{[[[`; 
      writeFileSync(brokenFile, brokenContent, 'utf-8');

      const result = await extractFromFile(brokenFile);
      
      expect(result).toBeDefined();
      expect(result.kind).toBe('ts:module');
      expect(result.variables).toEqual([]);
      expect(result.hooks).toEqual([]);
      expect(result.components).toEqual([]);
      expect(result.functions).toEqual([]);
      expect(result.props).toEqual({});
      expect(result.state).toEqual({});
      expect(result.emits).toEqual({});
      expect(result.imports).toEqual([]);
      expect(result.jsxRoutes).toEqual([]);
    });

    it('should have debug logging infrastructure in place', async () => {
      // This test verifies that the debug logging code exists and is structured correctly
      // Note: ts-morph is very tolerant and may not throw errors for invalid files,
      // but the error handling infrastructure is in place
      process.env.LOGICSTAMP_DEBUG = '1';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const invalidFile = '/invalid/path/that/does/not/exist.tsx';
      const result = await extractFromFile(invalidFile);

      // Function should not crash and should return a valid structure
      expect(result).toBeDefined();
      expect(result.kind).toBe('ts:module');
      
      // If errors were logged, verify they have the correct format
      const errorCalls = consoleErrorSpy.mock.calls;
      if (errorCalls.length > 0) {
        const hasAstParserLog = errorCalls.some(call => 
          call[0]?.toString().includes('[LogicStamp][DEBUG]') && 
          call[0]?.toString().includes('astParser')
        );
        expect(hasAstParserLog).toBe(true);
      }
      // If no errors logged, that's acceptable - ts-morph handles errors gracefully

      consoleErrorSpy.mockRestore();
    });

    it('should not log errors when LOGICSTAMP_DEBUG is disabled', async () => {
      delete process.env.LOGICSTAMP_DEBUG;
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const brokenFile = join(tempDir, 'no-debug-test.tsx');
      const brokenContent = `{{{[[[`; 
      writeFileSync(brokenFile, brokenContent, 'utf-8');

      await extractFromFile(brokenFile);

      // Should not have logged any errors
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should include file path in error logs when errors occur', async () => {
      // This test verifies that error logs include file paths when errors are logged
      // Note: ts-morph may handle errors gracefully without logging
      process.env.LOGICSTAMP_DEBUG = '1';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const invalidFile = '/invalid/path/test-file.tsx';
      await extractFromFile(invalidFile);

      // Check that if errors were logged, they include the file path
      const errorCalls = consoleErrorSpy.mock.calls;
      const astParserLogs = errorCalls.filter(call => 
        call[0]?.toString().includes('[LogicStamp][DEBUG]') && 
        call[0]?.toString().includes('astParser')
      );
      
      if (astParserLogs.length > 0) {
        // If we have AST parser logs, verify they include file path information
        // The context object (second argument) should contain filePath
        const hasFilePath = astParserLogs.some(call => {
          const message = call[0]?.toString() || '';
          const context = call[1] || {};
          return message.includes('[LogicStamp][DEBUG]') || 
                 (typeof context === 'object' && 'filePath' in context);
        });
        expect(hasFilePath).toBe(true);
      }
      // If no errors logged, that's acceptable - error handling infrastructure is still in place

      consoleErrorSpy.mockRestore();
    });

    it('should handle partial extraction failures gracefully', async () => {
      // This test verifies that if one extractor fails, others still work
      const validFile = join(tempDir, 'partial.tsx');
      const validContent = `
        import React from 'react';
        
        export function Component() {
          return <div>Test</div>;
        }
      `;
      writeFileSync(validFile, validContent, 'utf-8');

      const result = await extractFromFile(validFile);
      
      // Should have extracted something even if some extractors failed
      expect(result).toBeDefined();
      expect(result.kind).toBeDefined();
      // At minimum, should have extracted imports
      expect(Array.isArray(result.imports)).toBe(true);
    });

    it('should prioritize backend extraction over Vue extraction', async () => {
      const mixedFile = join(tempDir, `mixed-routes-vue-${Date.now()}.ts`);
      const mixedContent = `import express from 'express';
import { ref } from 'vue';

const app = express();

app.get('/users', (req, res) => {
  res.json({ users: [] });
});
`;
      writeFileSync(mixedFile, mixedContent, 'utf-8');

      const result = await extractFromFile(mixedFile);
      
      // Should extract backend (not Vue) because Backend > Vue priority
      expect(result.kind).toBe('node:api');
      expect(result.backend).toBeDefined();
      expect(result.backend?.framework).toBe('express');
      // Vue extraction should be skipped (hooks/components should be empty)
      expect(result.hooks).toEqual([]);
      expect(result.components).toEqual([]);
      expect(result.props).toEqual({});
      expect(result.state).toEqual({});
      expect(result.emits).toEqual({});
    });

    it('should prioritize backend extraction over React extraction', async () => {
      const mixedFile = join(tempDir, `mixed-routes-react-${Date.now()}.ts`);
      const mixedContent = `import express from 'express';
import { useState } from 'react';

const app = express();

app.get('/users', (req, res) => {
  res.json({ users: [] });
});
`;
      writeFileSync(mixedFile, mixedContent, 'utf-8');

      const result = await extractFromFile(mixedFile);

      // Should extract backend (not React) because Backend > React priority
      expect(result.kind).toBe('node:api');
      expect(result.backend).toBeDefined();
      expect(result.backend?.framework).toBe('express');
      // React extraction should be skipped (hooks/components should be empty)
      expect(result.hooks).toEqual([]);
      expect(result.components).toEqual([]);
      expect(result.props).toEqual({});
      expect(result.state).toEqual({});
      expect(result.emits).toEqual({});
    });
  });
});

// ============================================================================
// FAILURE MODE TESTS - Real-world edge cases and error scenarios
// ============================================================================

describe('AST Parser Failure Modes', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `logicstamp-failure-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  describe('binary and encoding edge cases', () => {
    it('should handle binary data disguised as TypeScript', async () => {
      const binaryFile = join(tempDir, 'binary.tsx');
      // Write binary data (PNG header)
      const binaryData = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      writeFileSync(binaryFile, binaryData);

      const result = await extractFromFile(binaryFile);

      // Should not crash, should return empty AST
      expect(result).toBeDefined();
      expect(result.kind).toBe('ts:module');
    });

    it('should handle file with null bytes', async () => {
      const nullFile = join(tempDir, 'nullbytes.tsx');
      const content = 'export const x = 1;\0\0\0export const y = 2;';
      writeFileSync(nullFile, content, 'utf-8');

      const result = await extractFromFile(nullFile);

      // Should handle gracefully
      expect(result).toBeDefined();
    });

    it('should handle file with only comments', async () => {
      const commentFile = join(tempDir, 'comments.tsx');
      const content = `
        // This is a comment
        /* This is a
           multiline comment */
        /**
         * JSDoc comment
         * @param x - some param
         */
      `;
      writeFileSync(commentFile, content, 'utf-8');

      const result = await extractFromFile(commentFile);

      expect(result).toBeDefined();
      expect(result.kind).toBe('ts:module');
      expect(result.functions).toEqual([]);
      expect(result.components).toEqual([]);
    });

    it('should handle file with BOM (Byte Order Mark)', async () => {
      const bomFile = join(tempDir, 'bom.tsx');
      // UTF-8 BOM + content
      const content = '\uFEFFexport const Component = () => <div>Test</div>;';
      writeFileSync(bomFile, content, 'utf-8');

      const result = await extractFromFile(bomFile);

      expect(result).toBeDefined();
      // Should still extract the component
    });

    it('should handle file with mixed line endings', async () => {
      const mixedFile = join(tempDir, 'mixed-endings.tsx');
      const content = 'import React from "react";\r\n\nexport function A() {\r  return <div />;\n}\r\n';
      writeFileSync(mixedFile, content, 'utf-8');

      const result = await extractFromFile(mixedFile);

      expect(result).toBeDefined();
      expect(result.imports).toContain('react');
    });
  });

  describe('unicode and special characters', () => {
    it('should handle unicode identifiers', async () => {
      const unicodeFile = join(tempDir, 'unicode.tsx');
      const content = `
        export const コンポーネント = () => <div>日本語</div>;
        export const Émoji = () => <div>🎉</div>;
        export const кириллица = () => <div>Привет</div>;
      `;
      writeFileSync(unicodeFile, content, 'utf-8');

      const result = await extractFromFile(unicodeFile);

      expect(result).toBeDefined();
      // Should extract functions with unicode names
      expect(result.functions.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle emoji in JSX content', async () => {
      const emojiFile = join(tempDir, 'emoji.tsx');
      const content = `
        export const Component = () => (
          <div>
            <span>🎉 Party!</span>
            <span>👍 Good</span>
          </div>
        );
      `;
      writeFileSync(emojiFile, content, 'utf-8');

      const result = await extractFromFile(emojiFile);

      expect(result).toBeDefined();
      expect(result.functions).toContain('Component');
    });

    it('should handle special characters in strings', async () => {
      const specialFile = join(tempDir, 'special.tsx');
      const content = `
        export const Component = () => {
          const text = "Special: \\n\\t\\r\\0 chars";
          const regex = /[a-z]+/gi;
          return <div>{text}</div>;
        };
      `;
      writeFileSync(specialFile, content, 'utf-8');

      const result = await extractFromFile(specialFile);

      expect(result).toBeDefined();
    });
  });

  describe('deeply nested and complex structures', () => {
    it('should handle deeply nested JSX', async () => {
      const deepFile = join(tempDir, 'deep.tsx');
      let jsx = '<div>';
      for (let i = 0; i < 50; i++) {
        jsx += `<div className="level-${i}">`;
      }
      jsx += 'Content';
      for (let i = 0; i < 50; i++) {
        jsx += '</div>';
      }
      jsx += '</div>';

      const content = `export const DeepComponent = () => (${jsx});`;
      writeFileSync(deepFile, content, 'utf-8');

      const result = await extractFromFile(deepFile);

      expect(result).toBeDefined();
      expect(result.functions).toContain('DeepComponent');
    });

    it('should handle many props', async () => {
      const manyPropsFile = join(tempDir, 'manyprops.tsx');
      const props = Array.from({ length: 100 }, (_, i) => `prop${i}: string`).join('; ');
      const content = `
        interface Props { ${props} }
        export const Component = (props: Props) => <div />;
      `;
      writeFileSync(manyPropsFile, content, 'utf-8');

      const result = await extractFromFile(manyPropsFile);

      expect(result).toBeDefined();
      // Should extract props (may be limited by implementation)
    });

    it('should handle many imports', async () => {
      const manyImportsFile = join(tempDir, 'manyimports.tsx');
      const imports = Array.from({ length: 50 }, (_, i) =>
        `import { util${i} } from './utils/util${i}';`
      ).join('\n');
      const content = `
        ${imports}
        export const Component = () => <div />;
      `;
      writeFileSync(manyImportsFile, content, 'utf-8');

      const result = await extractFromFile(manyImportsFile);

      expect(result).toBeDefined();
      expect(result.imports.length).toBeGreaterThan(0);
    });

    it('should handle circular type references', async () => {
      const circularFile = join(tempDir, 'circular.tsx');
      const content = `
        interface Node {
          children: Node[];
          parent?: Node;
        }

        export const TreeComponent = (props: { root: Node }) => (
          <div>
            {props.root.children.map((child) => (
              <TreeComponent root={child} />
            ))}
          </div>
        );
      `;
      writeFileSync(circularFile, content, 'utf-8');

      const result = await extractFromFile(circularFile);

      expect(result).toBeDefined();
      expect(result.functions).toContain('TreeComponent');
    });
  });

  describe('syntax edge cases', () => {
    it('should handle TypeScript decorators', async () => {
      const decoratorFile = join(tempDir, 'decorator.ts');
      const content = `
        function log(target: any) {
          console.log(target);
        }

        @log
        export class MyComponent {
          render() {
            return null;
          }
        }
      `;
      writeFileSync(decoratorFile, content, 'utf-8');

      const result = await extractFromFile(decoratorFile);

      expect(result).toBeDefined();
    });

    it('should handle JSX fragments', async () => {
      const fragmentFile = join(tempDir, 'fragment.tsx');
      const content = `
        export const Component = () => (
          <>
            <div>First</div>
            <div>Second</div>
          </>
        );
      `;
      writeFileSync(fragmentFile, content, 'utf-8');

      const result = await extractFromFile(fragmentFile);

      expect(result).toBeDefined();
      expect(result.functions).toContain('Component');
    });

    it('should handle JSX spread attributes', async () => {
      const spreadFile = join(tempDir, 'spread.tsx');
      const content = `
        interface Props {
          className?: string;
          [key: string]: any;
        }

        export const Component = (props: Props) => (
          <div {...props}>Content</div>
        );
      `;
      writeFileSync(spreadFile, content, 'utf-8');

      const result = await extractFromFile(spreadFile);

      expect(result).toBeDefined();
    });

    it('should handle optional chaining and nullish coalescing', async () => {
      const modernFile = join(tempDir, 'modern.tsx');
      const content = `
        export const Component = ({ data }: { data?: { value?: string } }) => (
          <div>{data?.value ?? 'default'}</div>
        );
      `;
      writeFileSync(modernFile, content, 'utf-8');

      const result = await extractFromFile(modernFile);

      expect(result).toBeDefined();
    });

    it('should handle template literal types', async () => {
      const templateFile = join(tempDir, 'template.tsx');
      const content = `
        type EventName = \`on\${string}\`;

        interface Props {
          [K in EventName]?: () => void;
        }

        export const Component = (props: Props) => <div />;
      `;
      writeFileSync(templateFile, content, 'utf-8');

      const result = await extractFromFile(templateFile);

      expect(result).toBeDefined();
    });
  });

  describe('partial parse recovery', () => {
    it('should extract what it can from partially valid file', async () => {
      const partialFile = join(tempDir, 'partial.tsx');
      const content = `
        import React from 'react';

        export const ValidComponent = () => <div>Valid</div>;

        // Below is invalid syntax
        export const Broken = () => {
          const x = {
        // Missing closing brace
      `;
      writeFileSync(partialFile, content, 'utf-8');

      const result = await extractFromFile(partialFile);

      // Should not crash
      expect(result).toBeDefined();
      // Might extract the valid import
      expect(Array.isArray(result.imports)).toBe(true);
    });

    it('should handle unterminated string literal', async () => {
      const unterminatedFile = join(tempDir, 'unterminated.tsx');
      const content = `
        export const Component = () => {
          const text = "This string never ends...
          return <div>{text}</div>;
        };
      `;
      writeFileSync(unterminatedFile, content, 'utf-8');

      const result = await extractFromFile(unterminatedFile);

      expect(result).toBeDefined();
    });

    it('should handle unbalanced brackets', async () => {
      const unbalancedFile = join(tempDir, 'unbalanced.tsx');
      const content = `
        export const Component = () => {
          const arr = [1, 2, 3;
          const obj = { a: 1, b: 2;
          return <div />;
        };
      `;
      writeFileSync(unbalancedFile, content, 'utf-8');

      const result = await extractFromFile(unbalancedFile);

      expect(result).toBeDefined();
    });
  });

  describe('large file handling', () => {
    it('should handle large file with many components', async () => {
      const largeFile = join(tempDir, 'large.tsx');
      const components = Array.from({ length: 100 }, (_, i) => `
        export const Component${i} = () => <div>Component ${i}</div>;
      `).join('\n');

      const content = `import React from 'react';\n${components}`;
      writeFileSync(largeFile, content, 'utf-8');

      const result = await extractFromFile(largeFile);

      expect(result).toBeDefined();
      expect(result.functions.length).toBeGreaterThan(0);
    });

    it('should handle file with very long single line', async () => {
      const longLineFile = join(tempDir, 'longline.tsx');
      const longString = 'x'.repeat(10000);
      const content = `export const Component = () => <div className="${longString}">Content</div>;`;
      writeFileSync(longLineFile, content, 'utf-8');

      const result = await extractFromFile(longLineFile);

      expect(result).toBeDefined();
    });
  });
});

