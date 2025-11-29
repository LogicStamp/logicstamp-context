import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Project } from 'ts-morph';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractStyleMetadata } from '../../../src/core/styleExtractor/styleExtractor.js';

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

    it('should detect inline styles', async () => {
      const sourceCode = `
        function MyComponent() {
          return <div style={{ padding: '1rem', color: 'blue' }}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = await extractStyleMetadata(sourceFile, tempDir);

      expect(result).toBeDefined();
      expect(result?.styleSources?.inlineStyles).toBe(true);
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
      expect(result?.styleSources?.inlineStyles).toBe(true);
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
});

