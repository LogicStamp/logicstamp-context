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

  describe('Route Role Detection', () => {
    it('should detect page route role', async () => {
      const testContent = `export default function Page() { return <div>Page</div>; }`;
      const tempPath = join(fixturesPath, 'app/test-route/page.tsx');
      const { writeFileSync, unlinkSync, mkdirSync, rmdirSync } = await import('node:fs');

      try {
        mkdirSync(join(fixturesPath, 'app/test-route'), { recursive: true });
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs?.routeRole).toBe('page');
      } finally {
        try {
          unlinkSync(tempPath);
          rmdirSync(join(fixturesPath, 'app/test-route'));
        } catch {}
      }
    });

    it('should detect layout route role', async () => {
      const testContent = `export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</>; }`;
      const tempPath = join(fixturesPath, 'app/test-layout/layout.tsx');
      const { writeFileSync, unlinkSync, mkdirSync, rmdirSync } = await import('node:fs');

      try {
        mkdirSync(join(fixturesPath, 'app/test-layout'), { recursive: true });
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs?.routeRole).toBe('layout');
      } finally {
        try {
          unlinkSync(tempPath);
          rmdirSync(join(fixturesPath, 'app/test-layout'));
        } catch {}
      }
    });

    it('should detect loading route role', async () => {
      const testContent = `export default function Loading() { return <div>Loading...</div>; }`;
      const tempPath = join(fixturesPath, 'app/test-loading/loading.tsx');
      const { writeFileSync, unlinkSync, mkdirSync, rmdirSync } = await import('node:fs');

      try {
        mkdirSync(join(fixturesPath, 'app/test-loading'), { recursive: true });
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs?.routeRole).toBe('loading');
      } finally {
        try {
          unlinkSync(tempPath);
          rmdirSync(join(fixturesPath, 'app/test-loading'));
        } catch {}
      }
    });

    it('should detect error route role', async () => {
      const testContent = `export default function Error({ error }: { error: Error }) { return <div>Error</div>; }`;
      const tempPath = join(fixturesPath, 'app/test-error/error.tsx');
      const { writeFileSync, unlinkSync, mkdirSync, rmdirSync } = await import('node:fs');

      try {
        mkdirSync(join(fixturesPath, 'app/test-error'), { recursive: true });
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs?.routeRole).toBe('error');
      } finally {
        try {
          unlinkSync(tempPath);
          rmdirSync(join(fixturesPath, 'app/test-error'));
        } catch {}
      }
    });

    it('should detect route handler role', async () => {
      const testContent = `export async function GET() { return Response.json({}); }`;
      const tempPath = join(fixturesPath, 'app/api/test-route/route.ts');
      const { writeFileSync, unlinkSync, mkdirSync, rmdirSync } = await import('node:fs');

      try {
        mkdirSync(join(fixturesPath, 'app/api/test-route'), { recursive: true });
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs?.routeRole).toBe('route');
      } finally {
        try {
          unlinkSync(tempPath);
          rmdirSync(join(fixturesPath, 'app/api/test-route'));
        } catch {}
      }
    });
  });

  describe('Segment Path Extraction', () => {
    it('should extract root segment path for app/page.tsx', async () => {
      const testContent = `export default function Page() { return <div>Page</div>; }`;
      const tempPath = join(fixturesPath, 'app/test-root-page.tsx');
      const { writeFileSync, unlinkSync } = await import('node:fs');

      try {
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs?.segmentPath).toBe('/');
      } finally {
        try {
          unlinkSync(tempPath);
        } catch {}
      }
    });

    it('should extract segment path for nested routes', async () => {
      const testContent = `export default function BlogPage() { return <div>Blog</div>; }`;
      const tempPath = join(fixturesPath, 'app/test-blog/page.tsx');
      const { writeFileSync, unlinkSync, mkdirSync, rmdirSync } = await import('node:fs');

      try {
        mkdirSync(join(fixturesPath, 'app/test-blog'), { recursive: true });
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs?.segmentPath).toBe('/test-blog');
      } finally {
        try {
          unlinkSync(tempPath);
          rmdirSync(join(fixturesPath, 'app/test-blog'));
        } catch {}
      }
    });

    it('should extract segment path with dynamic segments', async () => {
      const testContent = `export default function PostPage() { return <div>Post</div>; }`;
      const tempPath = join(fixturesPath, 'app/test-blog/[slug]/page.tsx');
      const { writeFileSync, unlinkSync, mkdirSync, rmdirSync } = await import('node:fs');

      try {
        mkdirSync(join(fixturesPath, 'app/test-blog/[slug]'), { recursive: true });
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs?.segmentPath).toBe('/test-blog/[slug]');
      } finally {
        try {
          unlinkSync(tempPath);
          rmdirSync(join(fixturesPath, 'app/test-blog/[slug]'));
          rmdirSync(join(fixturesPath, 'app/test-blog'));
        } catch {}
      }
    });

    it('should extract segment path for API routes', async () => {
      const testContent = `export async function GET() { return Response.json({}); }`;
      const tempPath = join(fixturesPath, 'app/api/test-users/route.ts');
      const { writeFileSync, unlinkSync, mkdirSync, rmdirSync } = await import('node:fs');

      try {
        mkdirSync(join(fixturesPath, 'app/api/test-users'), { recursive: true });
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs?.segmentPath).toBe('/api/test-users');
      } finally {
        try {
          unlinkSync(tempPath);
          rmdirSync(join(fixturesPath, 'app/api/test-users'));
        } catch {}
      }
    });

    it('should handle route groups in segment path', async () => {
      const testContent = `export default function LoginPage() { return <div>Login</div>; }`;
      const tempPath = join(fixturesPath, 'app/(test-auth)/test-login/page.tsx');
      const { writeFileSync, unlinkSync, mkdirSync, rmdirSync } = await import('node:fs');

      try {
        mkdirSync(join(fixturesPath, 'app/(test-auth)/test-login'), { recursive: true });
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs?.segmentPath).toBe('/test-login');
      } finally {
        try {
          unlinkSync(tempPath);
          rmdirSync(join(fixturesPath, 'app/(test-auth)/test-login'));
          rmdirSync(join(fixturesPath, 'app/(test-auth)'));
        } catch {}
      }
    });

    it('should handle src/app directory structure', async () => {
      const testContent = `export default function Page() { return <div>Page</div>; }`;
      const tempPath = join(fixturesPath, 'src/app/test-page.tsx');
      const { writeFileSync, unlinkSync, mkdirSync, rmdirSync } = await import('node:fs');

      try {
        mkdirSync(join(fixturesPath, 'src/app'), { recursive: true });
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs?.segmentPath).toBe('/');
      } finally {
        try {
          unlinkSync(tempPath);
          rmdirSync(join(fixturesPath, 'src/app'));
        } catch {}
      }
    });
  });

  describe('Metadata Export Extraction', () => {
    it('should detect static metadata export', async () => {
      const testContent = `
export const metadata = {
  title: 'My Page',
  description: 'Page description'
};

export default function Page() {
  return <div>Page</div>;
}
`;
      const tempPath = join(fixturesPath, 'app/test-metadata-static.tsx');
      const { writeFileSync, unlinkSync } = await import('node:fs');

      try {
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs?.metadata).toBeDefined();
        expect(ast.nextjs?.metadata?.static).toBeDefined();
        expect(ast.nextjs?.metadata?.static?.title).toBe('My Page');
        expect(ast.nextjs?.metadata?.static?.description).toBe('Page description');
      } finally {
        try {
          unlinkSync(tempPath);
        } catch {}
      }
    });

    it('should detect dynamic metadata function', async () => {
      const testContent = `
export function generateMetadata() {
  return {
    title: 'Dynamic Title'
  };
}

export default function Page() {
  return <div>Page</div>;
}
`;
      const tempPath = join(fixturesPath, 'app/test-metadata-dynamic.tsx');
      const { writeFileSync, unlinkSync } = await import('node:fs');

      try {
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs?.metadata).toBeDefined();
        expect(ast.nextjs?.metadata?.dynamic).toBe(true);
      } finally {
        try {
          unlinkSync(tempPath);
        } catch {}
      }
    });

    it('should detect both static and dynamic metadata', async () => {
      const testContent = `
export const metadata = {
  title: 'My Page'
};

export function generateMetadata() {
  return {
    description: 'Dynamic description'
  };
}

export default function Page() {
  return <div>Page</div>;
}
`;
      const tempPath = join(fixturesPath, 'app/test-metadata-both.tsx');
      const { writeFileSync, unlinkSync } = await import('node:fs');

      try {
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs?.metadata).toBeDefined();
        expect(ast.nextjs?.metadata?.static).toBeDefined();
        expect(ast.nextjs?.metadata?.static?.title).toBe('My Page');
        expect(ast.nextjs?.metadata?.dynamic).toBe(true);
      } finally {
        try {
          unlinkSync(tempPath);
        } catch {}
      }
    });

    it('should handle metadata with various value types', async () => {
      const testContent = `
export const metadata = {
  title: 'My Page',
  count: 42,
  enabled: true,
  disabled: false,
  nullValue: null
};

export default function Page() {
  return <div>Page</div>;
}
`;
      const tempPath = join(fixturesPath, 'app/test-metadata-values.tsx');
      const { writeFileSync, unlinkSync } = await import('node:fs');

      try {
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs?.metadata?.static).toBeDefined();
        expect(ast.nextjs?.metadata?.static?.title).toBe('My Page');
        expect(ast.nextjs?.metadata?.static?.count).toBe(42);
        expect(ast.nextjs?.metadata?.static?.enabled).toBe(true);
        expect(ast.nextjs?.metadata?.static?.disabled).toBe(false);
        expect(ast.nextjs?.metadata?.static?.nullValue).toBe(null);
      } finally {
        try {
          unlinkSync(tempPath);
        } catch {}
      }
    });
  });

  describe('Combined Features', () => {
    it('should extract all Next.js metadata fields together', async () => {
      const testContent = `
'use client';

export const metadata = {
  title: 'My Page'
};

export default function Page() {
  return <div>Page</div>;
}
`;
      const tempPath = join(fixturesPath, 'app/test-combined/[id]/page.tsx');
      const { writeFileSync, unlinkSync, mkdirSync, rmdirSync } = await import('node:fs');

      try {
        mkdirSync(join(fixturesPath, 'app/test-combined/[id]'), { recursive: true });
        writeFileSync(tempPath, testContent);
        const ast = await extractFromFile(tempPath);

        expect(ast.nextjs).toBeDefined();
        expect(ast.nextjs?.isInAppDir).toBe(true);
        expect(ast.nextjs?.directive).toBe('client');
        expect(ast.nextjs?.routeRole).toBe('page');
        expect(ast.nextjs?.segmentPath).toBe('/test-combined/[id]');
        expect(ast.nextjs?.metadata?.static?.title).toBe('My Page');
      } finally {
        try {
          unlinkSync(tempPath);
          rmdirSync(join(fixturesPath, 'app/test-combined/[id]'));
          rmdirSync(join(fixturesPath, 'app/test-combined'));
        } catch {}
      }
    });
  });
});
