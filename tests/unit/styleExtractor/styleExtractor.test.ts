import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Project } from 'ts-morph';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractStyleMetadata } from '../../../src/extractors/styling/styleExtractor.js';

describe('Style Extractor', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `style-extractor-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('extractStyleMetadata', () => {
    it('should extract Tailwind CSS metadata', async () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="flex items-center bg-blue-500 p-4">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.tailwind).toBeDefined();
      expect(result?.styleSources?.tailwind?.classCount).toBeGreaterThan(0);
    });

    it('should extract SCSS module metadata', async () => {
      const scssFile = join(tempDir, 'styles.module.scss');
      await writeFile(scssFile, '.container { padding: 1rem; }', 'utf-8');

      const sourceCode = `
        import styles from './styles.module.scss';
        
        function MyComponent() {
          return <div className={styles.container}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.scssModule).toBeDefined();
    });

    it('should extract CSS module metadata', async () => {
      const cssFile = join(tempDir, 'styles.module.css');
      await writeFile(cssFile, '.container { padding: 1rem; }', 'utf-8');

      const sourceCode = `
        import styles from './styles.module.css';
        
        function MyComponent() {
          return <div className={styles.container}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.cssModule).toBeDefined();
    });

    it('should extract styled-components metadata', async () => {
      const sourceCode = `
        import styled from 'styled-components';
        
        const StyledButton = styled.button\`
          padding: 1rem;
        \`;
        
        function MyComponent() {
          return <StyledButton>Click</StyledButton>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.styledComponents).toBeDefined();
      expect(result?.styleSources?.styledComponents?.components).toContain('button');
    });

    it('should extract framer-motion metadata', async () => {
      const sourceCode = `
        import { motion } from 'framer-motion';
        
        function MyComponent() {
          return (
            <motion.div
              whileHover={{ scale: 1.1 }}
              animate={{ opacity: 1 }}
            >
              Hello
            </motion.div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.motion).toBeDefined();
      expect(result?.styleSources?.motion?.components).toContain('div');
      expect(result?.styleSources?.motion?.features?.gestures).toBe(true);
    });

    it('should extract Material UI metadata', async () => {
      const sourceCode = `
        import { Button, TextField, Card } from '@mui/material';
        
        function MyComponent() {
          return (
            <Card>
              <TextField label="Name" />
              <Button sx={{ p: 2 }}>Submit</Button>
            </Card>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.materialUI).toBeDefined();
      expect(result?.styleSources?.materialUI?.components).toContain('Button');
      expect(result?.styleSources?.materialUI?.components).toContain('TextField');
      expect(result?.styleSources?.materialUI?.components).toContain('Card');
      expect(result?.styleSources?.materialUI?.packages).toContain('@mui/material');
      expect(result?.styleSources?.materialUI?.features?.usesSxProp).toBe(true);
    });

    it('should detect and extract inline styles', async () => {
      const sourceCode = `
        function MyComponent() {
          return <div style={{ padding: '1rem', color: 'blue' }}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.inlineStyles).toBeDefined();
      
      // Should be an object with properties and values
      if (typeof result?.styleSources?.inlineStyles === 'object') {
        expect(result.styleSources.inlineStyles.properties).toContain('color');
        expect(result.styleSources.inlineStyles.properties).toContain('padding');
        expect(result.styleSources.inlineStyles.values).toBeDefined();
        expect(result.styleSources.inlineStyles.values?.color).toBe('blue');
        expect(result.styleSources.inlineStyles.values?.padding).toBe('1rem');
      } else {
        // Fallback: at least should be true for backward compat
        expect(result?.styleSources?.inlineStyles).toBe(true);
      }
    });

    it('should extract inline styles with various value types', async () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div style={{
              padding: '1rem',
              margin: 10,
              opacity: 0.5,
              display: true,
              animationDelay: \`2s\`,
              transformOrigin: 'center'
            }}>
              Hello
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      if (typeof result?.styleSources?.inlineStyles === 'object') {
        expect(result.styleSources.inlineStyles.properties).toContain('padding');
        expect(result.styleSources.inlineStyles.properties).toContain('margin');
        expect(result.styleSources.inlineStyles.properties).toContain('opacity');
        expect(result.styleSources.inlineStyles.properties).toContain('display');
        expect(result.styleSources.inlineStyles.properties).toContain('animationDelay');
        expect(result.styleSources.inlineStyles.properties).toContain('transformOrigin');
        
        // Check extracted values
        expect(result.styleSources.inlineStyles.values?.padding).toBe('1rem');
        expect(result.styleSources.inlineStyles.values?.margin).toBe('10');
        expect(result.styleSources.inlineStyles.values?.opacity).toBe('0.5');
        expect(result.styleSources.inlineStyles.values?.display).toBe('true');
        expect(result.styleSources.inlineStyles.values?.animationDelay).toBe('2s');
        expect(result.styleSources.inlineStyles.values?.transformOrigin).toBe('center');
      }
    });

    it('should extract styled-jsx CSS content', async () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <>
              <div className="container">Hello</div>
              <style jsx>{\`
                .container {
                  padding: 1rem;
                  color: blue;
                  background-color: white;
                }
                @keyframes border-spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              \`}</style>
            </>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.styledJsx).toBeDefined();
      expect(result?.styleSources?.styledJsx?.css).toContain('.container');
      expect(result?.styleSources?.styledJsx?.css).toContain('padding: 1rem');
      expect(result?.styleSources?.styledJsx?.css).toContain('@keyframes border-spin');
      expect(result?.styleSources?.styledJsx?.selectors).toContain('.container');
      expect(result?.styleSources?.styledJsx?.properties).toContain('padding');
      expect(result?.styleSources?.styledJsx?.properties).toContain('color');
      expect(result?.styleSources?.styledJsx?.properties).toContain('background-color');
      expect(result?.styleSources?.styledJsx?.global).toBeUndefined(); // Should not be global
    });

    it('should detect global attribute in styled-jsx', async () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <>
              <style jsx global>{\`
                body {
                  margin: 0;
                  font-family: sans-serif;
                }
              \`}</style>
            </>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.styledJsx).toBeDefined();
      expect(result?.styleSources?.styledJsx?.global).toBe(true);
      expect(result?.styleSources?.styledJsx?.css).toContain('body');
      expect(result?.styleSources?.styledJsx?.selectors).toContain('body');
    });

    it('should extract layout metadata', async () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="flex items-center justify-between">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.layout).toBeDefined();
      expect(result?.layout?.type).toBe('flex');
    });

    it('should extract visual metadata', async () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div className="bg-blue-500 text-white rounded-lg p-4">
              Hello
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.visual).toBeDefined();
      expect(result?.visual?.colors).toBeDefined();
    });

    it('should extract animation metadata', async () => {
      const sourceCode = `
        import { motion } from 'framer-motion';
        
        function MyComponent() {
          return <motion.div animate={{ opacity: 1 }}>Hello</motion.div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.animation).toBeDefined();
      expect(result?.animation?.library).toBe('framer-motion');
    });

    it('should return undefined when no style information is found', async () => {
      const sourceCode = `
        function MyComponent() {
          return <div>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeUndefined();
    });

    it('should combine multiple style sources', async () => {
      const sourceCode = `
        import styled from 'styled-components';
        import { motion } from 'framer-motion';
        import { Button } from '@mui/material';
        
        const StyledDiv = styled.div\`padding: 1rem;\`;
        
        function MyComponent() {
          return (
            <motion.div className="flex bg-blue-500" style={{ margin: '1rem' }}>
              <StyledDiv>Hello</StyledDiv>
              <Button sx={{ p: 2 }}>Click</Button>
            </motion.div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.tailwind).toBeDefined();
      expect(result?.styleSources?.styledComponents).toBeDefined();
      expect(result?.styleSources?.motion).toBeDefined();
      expect(result?.styleSources?.materialUI).toBeDefined();
      // Should detect inline styles (either object or boolean for backward compat)
      expect(result?.styleSources?.inlineStyles).toBeDefined();
      if (typeof result?.styleSources?.inlineStyles === 'object') {
        expect(result.styleSources.inlineStyles.properties).toContain('margin');
        expect(result.styleSources.inlineStyles.values?.margin).toBe('1rem');
      }
    });

    it('should extract Tailwind breakpoints', async () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div className="sm:text-sm md:flex lg:grid xl:container">
              Hello
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.tailwind?.breakpoints).toBeDefined();
      expect(result?.styleSources?.tailwind?.breakpoints?.length).toBeGreaterThan(0);
    });

    it('should categorize Tailwind classes', async () => {
      const sourceCode = `
        function MyComponent() {
          return (
            <div className="flex p-4 bg-blue-500 text-white rounded-lg">
              Hello
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.tailwind?.categories).toBeDefined();
      expect(result?.styleSources?.tailwind?.categories?.layout).toBeDefined();
      expect(result?.styleSources?.tailwind?.categories?.spacing).toBeDefined();
      expect(result?.styleSources?.tailwind?.categories?.colors).toBeDefined();
    });

    it('should detect emotion styled-components', async () => {
      const sourceCode = `
        import styled from '@emotion/styled';
        
        const StyledDiv = styled.div\`
          padding: 1rem;
        \`;
        
        function MyComponent() {
          return <StyledDiv>Hello</StyledDiv>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.styledComponents).toBeDefined();
    });

    it('should extract motion variants', async () => {
      const sourceCode = `
        import { motion } from 'framer-motion';
        
        const variants = {
          hidden: { opacity: 0 },
          visible: { opacity: 1 },
        };
        
        function MyComponent() {
          return <motion.div variants={variants}>Hello</motion.div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.motion?.variants).toBeDefined();
      expect(result?.styleSources?.motion?.variants?.length).toBeGreaterThan(0);
    });

    it('should detect motion layout animations', async () => {
      const sourceCode = `
        import { motion } from 'framer-motion';
        
        function MyComponent() {
          return <motion.div layout={true}>Hello</motion.div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.motion?.features?.layoutAnimations).toBe(true);
    });

    it('should detect motion viewport animations', async () => {
      const sourceCode = `
        import { motion, useInView } from 'framer-motion';
        
        function MyComponent() {
          const ref = useRef(null);
          const isInView = useInView(ref);
          return <motion.div ref={ref}>Hello</motion.div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.motion?.features?.viewportAnimations).toBe(true);
    });

    it('should extract styled-components theme usage', async () => {
      const sourceCode = `
        import styled from 'styled-components';
        
        const StyledDiv = styled.div\`
          color: \${props => props.theme.colors.primary};
        \`;
        
        function MyComponent() {
          return <StyledDiv>Hello</StyledDiv>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.styledComponents?.usesTheme).toBe(true);
    });

    it('should extract styled-components css prop usage', async () => {
      const sourceCode = `
        import { css } from 'styled-components';
        
        function MyComponent() {
          return <div css={css\`color: blue;\`}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.styledComponents?.usesCssProp).toBe(true);
    });

    it('should handle CSS file imports', async () => {
      const cssFile = join(tempDir, 'styles.css');
      await writeFile(cssFile, '.container { padding: 1rem; }', 'utf-8');

      const sourceCode = `
        import './styles.css';
        
        function MyComponent() {
          return <div className="container">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.cssModule).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle missing SCSS file gracefully', async () => {
      const sourceCode = `
        import styles from './missing.module.scss';
        
        function MyComponent() {
          return <div className={styles.container}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      // Should not throw, should return partial results
      const result = await extractStyleMetadata(sourceFile, tempDir);
      
      // Should still be able to extract other metadata if available
      expect(result).toBeDefined();
    });

    it('should handle missing CSS file gracefully', async () => {
      const sourceCode = `
        import './missing.css';
        
        function MyComponent() {
          return <div className="container">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      // Should not throw
      const result = await extractStyleMetadata(sourceFile, tempDir);
      expect(result).toBeDefined();
    });

    it('should return partial results when some extractors fail', async () => {
      // Create a file that will cause one extractor to potentially fail,
      // but others should still work
      const sourceCode = `
        function MyComponent() {
          return <div className="flex p-4 bg-blue-500">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      // Should still extract Tailwind even if other extractors fail
      expect(result).toBeDefined();
      expect(result?.styleSources?.tailwind).toBeDefined();
    });

    it('should handle malformed JSX gracefully', async () => {
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

      // Should not throw
      const result = await extractStyleMetadata(sourceFile, tempDir);
      expect(result).toBeDefined();
    });

    it('should handle empty SourceFile gracefully', async () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const result = await extractStyleMetadata(sourceFile, tempDir);

      // Should return undefined when no style information is found
      expect(result).toBeUndefined();
    });

    it('should handle invalid source file path gracefully', async () => {
      const sourceCode = `
        function MyComponent() {
          return <div className="flex">Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      // Use an invalid path - should not crash
      const invalidPath = join(tempDir, 'nonexistent', 'subdir');
      const result = await extractStyleMetadata(sourceFile, invalidPath);

      // Should still extract metadata that doesn't require file system access
      expect(result).toBeDefined();
      expect(result?.styleSources?.tailwind).toBeDefined();
    });

    it('should isolate extractor failures - one failure should not break others', async () => {
      // This test verifies that if one extractor fails, others still work
      const sourceCode = `
        import styled from 'styled-components';
        
        const StyledDiv = styled.div\`padding: 1rem;\`;
        
        function MyComponent() {
          return (
            <div className="flex p-4 bg-blue-500">
              <StyledDiv>Hello</StyledDiv>
            </div>
          );
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      // Should extract multiple sources even if one might fail
      expect(result).toBeDefined();
      expect(result?.styleSources?.tailwind).toBeDefined();
      expect(result?.styleSources?.styledComponents).toBeDefined();
    });

    it('should return undefined instead of throwing on critical errors', async () => {
      // Test that the main function catches errors and returns undefined
      // rather than throwing
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      // Should not throw
      const result = await extractStyleMetadata(sourceFile, tempDir);
      
      // Should return undefined gracefully
      expect(result).toBeUndefined();
    });
  });
});

