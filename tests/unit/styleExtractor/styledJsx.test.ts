import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { extractStyledJsx } from '../../../src/extractors/styling/styledJsx.js';

describe('Styled JSX Extractor', () => {
  it('should extract CSS content, selectors, and properties from <style jsx> blocks', () => {
    const sourceCode = `
      export default function X() {
        return (
          <>
            <style jsx>{\`
              .a { color: red; }
              #b { margin-top: 10px; }
              div.c:hover { opacity: 0.5; }
            \`}</style>
            <div className="a c" />
          </>
        );
      }
    `;

    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.tsx', sourceCode);

    const result = extractStyledJsx(sourceFile);

    expect(result).toBeDefined();
    expect(result?.css).toBeDefined();
    expect(result?.css).toContain('.a');
    expect(result?.css).toContain('color: red');
    expect(result?.css).toContain('#b');
    expect(result?.css).toContain('margin-top: 10px');
    expect(result?.css).toContain('div.c:hover');
    expect(result?.css).toContain('opacity: 0.5');

    expect(result?.selectors).toBeDefined();
    expect(result?.selectors).toContain('.a');
    expect(result?.selectors).toContain('#b');
    expect(result?.selectors).toContain('div.c:hover');

    expect(result?.properties).toBeDefined();
    expect(result?.properties).toContain('color');
    expect(result?.properties).toContain('margin-top');
    expect(result?.properties).toContain('opacity');
  });

  it('should detect global attribute', () => {
    const sourceCode = `
      export default function Component() {
        return (
          <style jsx global>{\`
            body {
              margin: 0;
              font-family: sans-serif;
            }
          \`}</style>
        );
      }
    `;

    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.tsx', sourceCode);

    const result = extractStyledJsx(sourceFile);

    expect(result).toBeDefined();
    expect(result?.global).toBe(true);
    expect(result?.selectors).toContain('body');
    expect(result?.properties).toContain('margin');
    expect(result?.properties).toContain('font-family');
  });

  it('should return null when no <style jsx> blocks are found', () => {
    const sourceCode = `
      export default function Component() {
        return <div>Hello</div>;
      }
    `;

    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.tsx', sourceCode);

    const result = extractStyledJsx(sourceFile);

    expect(result).toBeNull();
  });

  it('should return null when style tag has no jsx attribute', () => {
    const sourceCode = `
      export default function Component() {
        return <style>{\`.a { color: red; }\`}</style>;
      }
    `;

    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.tsx', sourceCode);

    const result = extractStyledJsx(sourceFile);

    expect(result).toBeNull();
  });

  it('should handle multiple <style jsx> blocks', () => {
    const sourceCode = `
      export default function Component() {
        return (
          <>
            <style jsx>{\`.a { color: red; }\`}</style>
            <style jsx>{\`.b { padding: 1rem; }\`}</style>
          </>
        );
      }
    `;

    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('test.tsx', sourceCode);

    const result = extractStyledJsx(sourceFile);

    expect(result).toBeDefined();
    expect(result?.css).toContain('.a');
    expect(result?.css).toContain('.b');
    expect(result?.selectors).toContain('.a');
    expect(result?.selectors).toContain('.b');
    expect(result?.properties).toContain('color');
    expect(result?.properties).toContain('padding');
  });
});

