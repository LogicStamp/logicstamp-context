import { describe, it, expect } from 'vitest';
import { extractFromFile } from '../../src/core/astParser.js';
import { buildContract } from '../../src/core/contractBuilder.js';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

describe('Next.js Metadata Detection', () => {
  const fixturesPath = join(process.cwd(), 'tests/fixtures/nextjs-app');

  it('should detect "use client" directive in app directory', async () => {
    const filePath = join(fixturesPath, 'app/page.tsx');
    const ast = await extractFromFile(filePath);

    expect(ast.nextjs).toBeDefined();
    expect(ast.nextjs?.directive).toBe('client');
    expect(ast.nextjs?.isInAppDir).toBe(true);

    // Also verify in final contract
    const sourceText = readFileSync(filePath, 'utf-8');
    const { contract } = buildContract(filePath, ast, {
      preset: 'none',
      sourceText,
    });

    expect(contract.nextjs).toBeDefined();
    expect(contract.nextjs?.directive).toBe('client');
    expect(contract.nextjs?.isInAppDir).toBe(true);
  });

  it('should detect "use server" directive outside app directory', async () => {
    const filePath = join(fixturesPath, 'lib/server-action.ts');
    const ast = await extractFromFile(filePath);

    expect(ast.nextjs).toBeDefined();
    expect(ast.nextjs?.directive).toBe('server');
    expect(ast.nextjs?.isInAppDir).toBeUndefined(); // Should be omitted when false

    // Also verify in final contract
    const sourceText = readFileSync(filePath, 'utf-8');
    const { contract } = buildContract(filePath, ast, {
      preset: 'none',
      sourceText,
    });

    expect(contract.nextjs).toBeDefined();
    expect(contract.nextjs?.directive).toBe('server');
    expect(contract.nextjs?.isInAppDir).toBeUndefined(); // Should be omitted when false
  });

  it('should not add nextjs metadata for regular components', async () => {
    const filePath = join(fixturesPath, 'components/Button.tsx');
    const ast = await extractFromFile(filePath);

    expect(ast.nextjs).toBeUndefined();

    // Also verify in final contract
    const sourceText = readFileSync(filePath, 'utf-8');
    const { contract } = buildContract(filePath, ast, {
      preset: 'none',
      sourceText,
    });

    expect(contract.nextjs).toBeUndefined();
  });

  it('should ignore directives inside comments', async () => {
    // Create a temp file with directive in comment
    const testContent = `
// 'use client' - this is commented out

export function Component() {
  return <div>Test</div>;
}
`;
    const tempPath = join(fixturesPath, 'components/temp-test.tsx');
    const { writeFileSync, unlinkSync } = await import('node:fs');

    try {
      writeFileSync(tempPath, testContent);
      const ast = await extractFromFile(tempPath);

      expect(ast.nextjs).toBeUndefined();
    } finally {
      try {
        unlinkSync(tempPath);
      } catch {}
    }
  });

  it('should detect files in app directory without directive', async () => {
    // Create a server component in app dir without explicit directive
    const testContent = `
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
`;
    const tempPath = join(fixturesPath, 'app/layout.tsx');
    const { writeFileSync, unlinkSync } = await import('node:fs');

    try {
      writeFileSync(tempPath, testContent);
      const ast = await extractFromFile(tempPath);

      expect(ast.nextjs).toBeDefined();
      expect(ast.nextjs?.isInAppDir).toBe(true);
      expect(ast.nextjs?.directive).toBeUndefined();
    } finally {
      try {
        unlinkSync(tempPath);
      } catch {}
    }
  });
});
