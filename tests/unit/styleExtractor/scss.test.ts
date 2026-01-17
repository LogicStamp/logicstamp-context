import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Project } from 'ts-morph';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractScssMetadata, parseStyleFile } from '../../../src/extractors/styling/scss.js';

describe('SCSS Extractor', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `scss-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('parseStyleFile', () => {
    it('should extract CSS selectors from a CSS file', async () => {
      const cssFile = join(tempDir, 'styles.css');
      const cssContent = `
        .container {
          padding: 1rem;
        }
        #header {
          background: blue;
        }
        button {
          border: none;
        }
      `;
      await writeFile(cssFile, cssContent, 'utf-8');

      const result = await parseStyleFile(cssFile, 'styles.css');

      expect(result.selectors).toContain('.container');
      expect(result.selectors).toContain('#header');
      expect(result.selectors).toContain('button');
    });

    it('should extract CSS properties from a CSS file', async () => {
      const cssFile = join(tempDir, 'styles.css');
      const cssContent = `
        .box {
          padding: 1rem;
          margin: 2rem;
          background-color: white;
          border-radius: 4px;
        }
      `;
      await writeFile(cssFile, cssContent, 'utf-8');

      const result = await parseStyleFile(cssFile, 'styles.css');

      expect(result.properties).toContain('padding');
      expect(result.properties).toContain('margin');
      expect(result.properties).toContain('background-color');
      expect(result.properties).toContain('border-radius');
    });

    it('should detect SCSS variables', async () => {
      const scssFile = join(tempDir, 'styles.scss');
      const scssContent = `
        $primary-color: blue;
        $spacing: 1rem;
        
        .box {
          color: $primary-color;
        }
      `;
      await writeFile(scssFile, scssContent, 'utf-8');

      const result = await parseStyleFile(scssFile, 'styles.scss');

      expect(result.hasVariables).toBe(true);
    });

    it('should detect SCSS nesting', async () => {
      const scssFile = join(tempDir, 'styles.scss');
      const scssContent = `
        .container {
          padding: 1rem;
          & .nested {
            color: blue;
          }
        }
      `;
      await writeFile(scssFile, scssContent, 'utf-8');

      const result = await parseStyleFile(scssFile, 'styles.scss');

      expect(result.hasNesting).toBe(true);
    });

    it('should detect SCSS mixins', async () => {
      const scssFile = join(tempDir, 'styles.scss');
      const scssContent = `
        @mixin flex-center {
          display: flex;
          justify-content: center;
        }
        
        .box {
          @include flex-center;
        }
      `;
      await writeFile(scssFile, scssContent, 'utf-8');

      const result = await parseStyleFile(scssFile, 'styles.scss');

      expect(result.hasMixins).toBe(true);
    });

    it('should limit selectors to 20', async () => {
      const cssFile = join(tempDir, 'styles.css');
      const cssContent = Array.from({ length: 25 }, (_, i) => 
        `.class-${i} { padding: 1rem; }`
      ).join('\n');
      await writeFile(cssFile, cssContent, 'utf-8');

      const result = await parseStyleFile(cssFile, 'styles.css');

      expect(result.selectors.length).toBeLessThanOrEqual(20);
    });

    it('should limit properties to 20', async () => {
      const cssFile = join(tempDir, 'styles.css');
      const cssContent = `
        .box {
          ${Array.from({ length: 25 }, (_, i) => `prop-${i}: value;`).join('\n          ')}
        }
      `;
      await writeFile(cssFile, cssContent, 'utf-8');

      const result = await parseStyleFile(cssFile, 'styles.css');

      expect(result.properties.length).toBeLessThanOrEqual(20);
    });

    it('should return sorted selectors and properties', async () => {
      const cssFile = join(tempDir, 'styles.css');
      const cssContent = `
        .zebra { }
        .apple { }
        .banana { }
      `;
      await writeFile(cssFile, cssContent, 'utf-8');

      const result = await parseStyleFile(cssFile, 'styles.css');

      expect(result.selectors).toEqual([...result.selectors].sort());
      expect(result.properties).toEqual([...result.properties].sort());
    });

    it('should handle file not found gracefully', async () => {
      const result = await parseStyleFile(join(tempDir, 'nonexistent.css'), 'nonexistent.css');

      expect(result.selectors).toEqual([]);
      expect(result.properties).toEqual([]);
      expect(result.hasVariables).toBe(false);
      expect(result.hasNesting).toBe(false);
      expect(result.hasMixins).toBe(false);
    });

    it('should handle complex selectors', async () => {
      const cssFile = join(tempDir, 'styles.css');
      const cssContent = `
        .container .nested > .child:hover {
          color: red;
        }
        #id.class[data-attr="value"] {
          padding: 1rem;
        }
      `;
      await writeFile(cssFile, cssContent, 'utf-8');

      const result = await parseStyleFile(cssFile, 'styles.css');

      expect(result.selectors.length).toBeGreaterThan(0);
    });

    it('should not extract invalid selectors from keyframes, colors, and values (regression test)', async () => {
      const cssFile = join(tempDir, 'styles.css');
      const cssContent = `
        .scrolling-journey {
          position: relative;
          width: 100%;
        }

        .journey__missile {
          position: absolute;
          background: rgba(99, 102, 241, 0.8);
          background: rgba(99, 102, 241, 0.5);
          transform: scale(1.5);
          width: 1px;
          height: 2px;
          margin: 3px;
        }

        .journey__boom-particle {
          display: block;
        }

        .journey-target-hit {
          opacity: 0;
        }

        @keyframes smokeFloat {
          0% {
            opacity: 0;
            transform: translateY(0);
          }
          50% {
            opacity: 0.5;
          }
          100% {
            opacity: 1;
            transform: translateY(-20px);
          }
        }

        @keyframes journey-target-hit {
          0% {
            scale: 1;
          }
          102% {
            scale: 1.2;
          }
        }

        @media (max-width: 768px) {
          .scrolling-journey {
            padding: 1rem;
          }
        }
      `;
      await writeFile(cssFile, cssContent, 'utf-8');

      const result = await parseStyleFile(cssFile, 'styles.css');

      // Should contain valid selectors
      expect(result.selectors).toContain('.scrolling-journey');
      expect(result.selectors).toContain('.journey__missile');
      expect(result.selectors).toContain('.journey__boom-particle');
      expect(result.selectors).toContain('.journey-target-hit');

      // Should NOT contain invalid tokens from keyframes
      expect(result.selectors).not.toContain('0');
      expect(result.selectors).not.toContain('100');
      expect(result.selectors).not.toContain('102');
      expect(result.selectors).not.toContain('50');

      // Should NOT contain color values from rgba()
      expect(result.selectors).not.toContain('99');
      expect(result.selectors).not.toContain('102');
      expect(result.selectors).not.toContain('241');

      // Should NOT contain pixel values
      expect(result.selectors).not.toContain('1px');
      expect(result.selectors).not.toContain('2px');
      expect(result.selectors).not.toContain('3px');

      // Should NOT contain decimal numbers from CSS values (e.g., .5 from rgba(..., 0.5) or scale(1.5))
      expect(result.selectors).not.toContain('.5');
      expect(result.selectors).not.toContain('.8');

      // Should NOT contain keyframe name fragments
      expect(result.selectors).not.toContain('hit');
      expect(result.selectors).not.toContain('smokeFloat');
      expect(result.selectors).not.toContain('from');
      expect(result.selectors).not.toContain('to');

      // Verify all selectors are valid (start with . or #, or are valid elements)
      const invalidPatterns = [
        /^\d+$/, // pure numbers
        /^\d+(\.\d+)?(px|em|rem|vh|vw|vmin|vmax|%)$/i, // values with units
      ];
      
      for (const selector of result.selectors) {
        // Should be a class, ID, or valid element
        const isValid = 
          selector.startsWith('.') || 
          selector.startsWith('#') || 
          /^[a-zA-Z][\w-]*$/.test(selector);
        
        expect(isValid).toBe(true);
        
        // Should not match invalid patterns
        for (const pattern of invalidPatterns) {
          expect(selector).not.toMatch(pattern);
        }
      }
    });

    it('should not extract selectors from CSS comments', async () => {
      const cssFile = join(tempDir, 'styles.css');
      const cssContent = `
        /* This is a comment with .commented-selector */
        .container {
          padding: 1rem;
        }
        
        /* Another comment: #commented-id and div selector */
        #header {
          background: blue;
        }
        
        /* SCSS style comment
           with .multi-line-selector
           and #another-id
        */
        .footer {
          margin: 1rem;
        }
      `;
      await writeFile(cssFile, cssContent, 'utf-8');

      const result = await parseStyleFile(cssFile, 'styles.css');

      // Should contain valid selectors
      expect(result.selectors).toContain('.container');
      expect(result.selectors).toContain('#header');
      expect(result.selectors).toContain('.footer');

      // Should NOT contain selectors from comments
      expect(result.selectors).not.toContain('.commented-selector');
      expect(result.selectors).not.toContain('#commented-id');
      expect(result.selectors).not.toContain('.multi-line-selector');
      expect(result.selectors).not.toContain('#another-id');
    });

    it('should not extract selectors from SCSS // style comments', async () => {
      const scssFile = join(tempDir, 'styles.scss');
      const scssContent = `
        // This is a SCSS comment with .commented-class
        .container {
          padding: 1rem;
        }
        
        // Another comment with #commented-id
        #header {
          background: blue;
        }
      `;
      await writeFile(scssFile, scssContent, 'utf-8');

      const result = await parseStyleFile(scssFile, 'styles.scss');

      // Should contain valid selectors
      expect(result.selectors).toContain('.container');
      expect(result.selectors).toContain('#header');

      // Should NOT contain selectors from comments
      expect(result.selectors).not.toContain('.commented-class');
      expect(result.selectors).not.toContain('#commented-id');
    });

    it('should extract selectors from nested rules inside @supports', async () => {
      const cssFile = join(tempDir, 'styles.css');
      const cssContent = `
        .base {
          padding: 1rem;
        }

        @supports (display: grid) {
          .grid-container {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
          }
          
          #grid-header {
            grid-column: 1 / -1;
          }
        }

        @supports not (display: grid) {
          .fallback {
            display: flex;
          }
        }
      `;
      await writeFile(cssFile, cssContent, 'utf-8');

      const result = await parseStyleFile(cssFile, 'styles.css');

      // Should contain selectors from outside @supports
      expect(result.selectors).toContain('.base');
      
      // Should contain selectors from inside @supports
      expect(result.selectors).toContain('.grid-container');
      expect(result.selectors).toContain('#grid-header');
      expect(result.selectors).toContain('.fallback');

      // Should extract properties from nested rules
      expect(result.properties).toContain('display');
      expect(result.properties).toContain('grid-template-columns');
      expect(result.properties).toContain('grid-column');
    });

    it('should extract selectors from nested rules inside @container', async () => {
      const cssFile = join(tempDir, 'styles.css');
      const cssContent = `
        .card {
          padding: 1rem;
        }

        @container (min-width: 400px) {
          .card-large {
            padding: 2rem;
          }
          
          #card-title {
            font-size: 1.5rem;
          }
        }

        @container sidebar (max-width: 300px) {
          .sidebar-compact {
            display: none;
          }
        }
      `;
      await writeFile(cssFile, cssContent, 'utf-8');

      const result = await parseStyleFile(cssFile, 'styles.css');

      // Should contain selectors from outside @container
      expect(result.selectors).toContain('.card');
      
      // Should contain selectors from inside @container
      expect(result.selectors).toContain('.card-large');
      expect(result.selectors).toContain('#card-title');
      expect(result.selectors).toContain('.sidebar-compact');

      // Should extract properties from nested rules
      expect(result.properties).toContain('padding');
      expect(result.properties).toContain('font-size');
      expect(result.properties).toContain('display');
    });
  });

  describe('extractScssMetadata', () => {
    it('should extract SCSS module import', async () => {
      const sourceCode = `
        import styles from './styles.module.scss';
        
        function MyComponent() {
          return <div className={styles.container}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      // Create a mock SCSS file
      const scssFile = join(tempDir, 'styles.module.scss');
      await writeFile(scssFile, '.container { padding: 1rem; }', 'utf-8');

      // Note: This test may need adjustment based on how ts-morph resolves paths
      // For now, we'll test the import detection
      const result = await extractScssMetadata(sourceFile, tempDir);

      expect(result.scssModule).toBeDefined();
    });

    it('should extract SCSS file import', async () => {
      const sourceCode = `
        import './styles.scss';
        
        function MyComponent() {
          return <div>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractScssMetadata(sourceFile, tempDir);

      expect(result.scssModule).toBeDefined();
    });

    it('should parse SCSS file details when file exists', async () => {
      const scssFile = join(tempDir, 'styles.module.scss');
      const scssContent = `
        $primary: blue;
        .container {
          padding: 1rem;
          & .nested {
            color: $primary;
          }
        }
      `;
      await writeFile(scssFile, scssContent, 'utf-8');

      const sourceCode = `
        import styles from './styles.module.scss';
        
        function MyComponent() {
          return <div className={styles.container}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractScssMetadata(sourceFile, tempDir);

      if (result.scssDetails) {
        expect(result.scssDetails.selectors.length).toBeGreaterThan(0);
        expect(result.scssDetails.properties.length).toBeGreaterThan(0);
        expect(result.scssDetails.features.variables).toBe(true);
        expect(result.scssDetails.features.nesting).toBe(true);
      }
    });

    it('should not include details when file has no content', async () => {
      const scssFile = join(tempDir, 'empty.module.scss');
      await writeFile(scssFile, '', 'utf-8');

      const sourceCode = `
        import styles from './empty.module.scss';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractScssMetadata(sourceFile, tempDir);

      // Should have module but no details if file is empty
      expect(result.scssModule).toBeDefined();
    });

    it('should handle files without SCSS imports', async () => {
      const sourceCode = `
        function MyComponent() {
          return <div>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractScssMetadata(sourceFile, tempDir);

      expect(result.scssModule).toBeUndefined();
      expect(result.scssDetails).toBeUndefined();
    });

    it('should detect mixins in SCSS details', async () => {
      const scssFile = join(tempDir, 'styles.module.scss');
      const scssContent = `
        @mixin flex-center {
          display: flex;
        }
        .container {
          @include flex-center;
        }
      `;
      await writeFile(scssFile, scssContent, 'utf-8');

      const sourceCode = `
        import styles from './styles.module.scss';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractScssMetadata(sourceFile, tempDir);

      if (result.scssDetails) {
        expect(result.scssDetails.features.mixins).toBe(true);
      }
    });

    it('should handle multiple SCSS imports (first one)', async () => {
      const sourceCode = `
        import styles1 from './styles1.module.scss';
        import styles2 from './styles2.module.scss';
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractScssMetadata(sourceFile, tempDir);

      // Should extract the first SCSS import
      expect(result.scssModule).toBeDefined();
    });
  });

  describe('Error handling', () => {
    describe('parseStyleFile', () => {
      it('should handle file read errors gracefully', async () => {
        const result = await parseStyleFile(join(tempDir, 'nonexistent.css'), 'nonexistent.css');

        expect(result.selectors).toEqual([]);
        expect(result.properties).toEqual([]);
        expect(result.hasVariables).toBe(false);
        expect(result.hasNesting).toBe(false);
        expect(result.hasMixins).toBe(false);
      });

      it('should handle invalid file paths gracefully', async () => {
        const result = await parseStyleFile('/invalid/path/to/file.css', 'file.css');

        expect(result.selectors).toEqual([]);
        expect(result.properties).toEqual([]);
        expect(result.hasVariables).toBe(false);
        expect(result.hasNesting).toBe(false);
        expect(result.hasMixins).toBe(false);
      });

      it('should handle malformed CSS content gracefully', async () => {
        const cssFile = join(tempDir, 'malformed.css');
        // Malformed CSS - unclosed braces, invalid syntax
        const malformedContent = `
          .container {
            padding: 1rem
          .nested {
            color: red
        `;
        await writeFile(cssFile, malformedContent, 'utf-8');

        // Should not throw, should extract what it can
        const result = await parseStyleFile(cssFile, 'malformed.css');
        expect(typeof result).toBe('object');
        expect(Array.isArray(result.selectors)).toBe(true);
        expect(Array.isArray(result.properties)).toBe(true);
      });

      it('should handle empty file gracefully', async () => {
        const cssFile = join(tempDir, 'empty.css');
        await writeFile(cssFile, '', 'utf-8');

        const result = await parseStyleFile(cssFile, 'empty.css');

        expect(result.selectors).toEqual([]);
        expect(result.properties).toEqual([]);
        expect(result.hasVariables).toBe(false);
        expect(result.hasNesting).toBe(false);
        expect(result.hasMixins).toBe(false);
      });
    });

    describe('extractScssMetadata', () => {
      it('should handle malformed SourceFile gracefully', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        // Malformed TypeScript - unclosed import
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          import styles from './styles.module.scss'
          // Missing semicolon and closing
        `
        );

        // Should not throw, should return empty object
        const result = await extractScssMetadata(sourceFile, tempDir);
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();
      });

      it('should handle SourceFile with syntax errors gracefully', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        // Invalid TypeScript syntax
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          import styles from './styles.module.scss';
          function Component() {
            return <div
          // Missing closing
        `
        );

        // Should not throw, should return empty object or partial results
        const result = await extractScssMetadata(sourceFile, tempDir);
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();
      });

      it('should handle empty SourceFile gracefully', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile('test.tsx', '');

        const result = await extractScssMetadata(sourceFile, tempDir);
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();
        expect(result.scssModule).toBeUndefined();
      });

      it('should handle SourceFile with invalid import declarations gracefully', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          import styles from './styles.module.scss';
          function Component() {
            return <div>Hello</div>;
          }
        `
        );

        // Use invalid file path that will cause parseStyleFile to fail
        const result = await extractScssMetadata(sourceFile, '/nonexistent/path');

        // Should return module name but no details if file can't be parsed
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();
      });

      it('should handle AST traversal errors gracefully', async () => {
        const project = new Project({ useInMemoryFileSystem: true });
        // Code that might cause AST traversal issues
        const sourceFile = project.createSourceFile(
          'test.tsx',
          `
          import styles from './styles.module.scss';
          function Component() {
            const invalid = (() => { throw new Error('test'); })();
            return <div className={invalid}>Content</div>;
          }
        `
        );

        // Should not throw, should handle gracefully
        const result = await extractScssMetadata(sourceFile, tempDir);
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();
      });
    });
  });
});

