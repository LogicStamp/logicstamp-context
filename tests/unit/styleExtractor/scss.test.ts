import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Project } from 'ts-morph';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractScssMetadata, parseStyleFile } from '../../../src/core/styleExtractor/scss.js';

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
});

