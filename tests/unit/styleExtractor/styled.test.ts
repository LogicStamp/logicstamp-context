import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { extractStyledComponents } from '../../../src/extractors/styling/styled.js';

describe('Styled Components Extractor', () => {
  describe('extractStyledComponents', () => {
    it('should extract styled component declarations', () => {
      const sourceCode = `
        import styled from 'styled-components';
        
        const StyledButton = styled.button\`
          padding: 1rem;
          background: blue;
        \`;
        
        const StyledCard = styled.div\`
          border: 1px solid gray;
        \`;
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractStyledComponents(sourceFile);

      expect(result.components).toContain('button');
      expect(result.components).toContain('div');
    });

    it('should extract styled component with wrapper', () => {
      const sourceCode = `
        import styled from 'styled-components';
        
        const StyledButton = styled(Button)\`
          padding: 1rem;
        \`;
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractStyledComponents(sourceFile);

      expect(result.components).toContain('Button');
    });

    it('should extract styled component with string literal', () => {
      const sourceCode = `
        import styled from 'styled-components';
        
        const Box = styled('div')\`
          padding: 1rem;
        \`;
        
        const Wrapper = styled("section")\`
          margin: 1rem;
        \`;
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractStyledComponents(sourceFile);

      expect(result.components).toContain('div');
      expect(result.components).toContain('section');
    });

    it('should detect theme usage', () => {
      const sourceCode = `
        import styled from 'styled-components';
        
        const StyledDiv = styled.div\`
          color: \${props => props.theme.colors.primary};
        \`;
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractStyledComponents(sourceFile);

      expect(result.hasTheme).toBe(true);
    });

    it('should detect useTheme hook', () => {
      const sourceCode = `
        import { useTheme } from 'styled-components';
        
        function MyComponent() {
          const theme = useTheme();
          return <div>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractStyledComponents(sourceFile);

      expect(result.hasTheme).toBe(true);
    });

    it('should detect css prop usage', () => {
      const sourceCode = `
        import { css } from 'styled-components';
        
        function MyComponent() {
          return <div css={css\`color: blue;\`}>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractStyledComponents(sourceFile);

      expect(result.hasCssProps).toBe(true);
    });

    it('should detect css template literal', () => {
      const sourceCode = `
        function MyComponent() {
          return <div css\`color: blue;\`>Hello</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractStyledComponents(sourceFile);

      expect(result.hasCssProps).toBe(true);
    });

    it('should limit components to 10', () => {
      const sourceCode = `
        import styled from 'styled-components';
        
        ${Array.from({ length: 15 }, (_, i) => 
          `const Styled${i} = styled.div\`padding: 1rem;\`;`
        ).join('\n')}
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractStyledComponents(sourceFile);

      expect(result.components.length).toBeLessThanOrEqual(10);
    });

    it('should return sorted components', () => {
      const sourceCode = `
        import styled from 'styled-components';
        
        const StyledZ = styled.z\`\`;
        const StyledA = styled.a\`\`;
        const StyledM = styled.m\`\`;
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const result = extractStyledComponents(sourceFile);

      expect(result.components).toEqual(result.components.sort());
    });

    it('should handle empty file', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      const result = extractStyledComponents(sourceFile);

      expect(result.components).toEqual([]);
      expect(result.hasTheme).toBe(false);
      expect(result.hasCssProps).toBe(false);
    });
  });
});

