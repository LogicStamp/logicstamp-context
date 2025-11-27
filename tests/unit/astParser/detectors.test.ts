import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import {
  detectNextJsDirective,
  isInNextAppDir,
  extractNextJsMetadata,
  detectKind,
} from '../../../src/core/astParser/detectors.js';

describe('Detectors', () => {
  describe('detectNextJsDirective', () => {
    it('should detect "use client" directive', () => {
      const sourceCode = `'use client';

import { useState } from 'react';

export function MyComponent() {
  return <div>Hello</div>;
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const directive = detectNextJsDirective(sourceFile);

      expect(directive).toBe('client');
    });

    it('should detect "use server" directive', () => {
      const sourceCode = `"use server";

export async function serverAction() {
  return { data: 'test' };
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.ts', sourceCode);

      const directive = detectNextJsDirective(sourceFile);

      expect(directive).toBe('server');
    });

    it('should return undefined when no directive', () => {
      const sourceCode = `
import { useState } from 'react';

export function MyComponent() {
  return <div>Hello</div>;
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const directive = detectNextJsDirective(sourceFile);

      expect(directive).toBeUndefined();
    });

    it('should ignore directives in comments', () => {
      const sourceCode = `// 'use client' - commented out

export function MyComponent() {
  return <div>Hello</div>;
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const directive = detectNextJsDirective(sourceFile);

      expect(directive).toBeUndefined();
    });

    it('should stop looking after first non-comment line', () => {
      const sourceCode = `
import { useState } from 'react';

'use client'; // Too late, directive must be at top
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const directive = detectNextJsDirective(sourceFile);

      expect(directive).toBeUndefined();
    });
  });

  describe('isInNextAppDir', () => {
    it('should detect app directory on Unix paths', () => {
      expect(isInNextAppDir('/project/app/page.tsx')).toBe(true);
      expect(isInNextAppDir('/project/src/app/layout.tsx')).toBe(true);
    });

    it('should detect app directory on Windows paths', () => {
      expect(isInNextAppDir('C:\\project\\app\\page.tsx')).toBe(true);
      expect(isInNextAppDir('C:\\project\\src\\app\\layout.tsx')).toBe(true);
    });

    it('should detect app directory at root', () => {
      expect(isInNextAppDir('app/page.tsx')).toBe(true);
    });

    it('should not match "app" in other contexts', () => {
      expect(isInNextAppDir('/project/application/page.tsx')).toBe(false);
      expect(isInNextAppDir('/project/src/components/app.tsx')).toBe(false);
    });

    it('should handle paths without app directory', () => {
      expect(isInNextAppDir('/project/src/components/Button.tsx')).toBe(false);
      expect(isInNextAppDir('/project/lib/utils.ts')).toBe(false);
    });
  });

  describe('extractNextJsMetadata', () => {
    it('should extract metadata with directive', () => {
      const sourceCode = `'use client';

export function MyComponent() {
  return <div>Hello</div>;
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('app/page.tsx', sourceCode);

      const metadata = extractNextJsMetadata(sourceFile, 'app/page.tsx');

      expect(metadata).toBeDefined();
      expect(metadata?.directive).toBe('client');
      expect(metadata?.isInAppDir).toBe(true);
    });

    it('should extract metadata for app directory without directive', () => {
      const sourceCode = `
export function Layout() {
  return <div>Layout</div>;
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('app/layout.tsx', sourceCode);

      const metadata = extractNextJsMetadata(sourceFile, 'app/layout.tsx');

      expect(metadata).toBeDefined();
      expect(metadata?.isInAppDir).toBe(true);
      expect(metadata?.directive).toBeUndefined();
    });

    it('should return undefined when no metadata', () => {
      const sourceCode = `
export function MyComponent() {
  return <div>Hello</div>;
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('src/components/Button.tsx', sourceCode);

      const metadata = extractNextJsMetadata(sourceFile, 'src/components/Button.tsx');

      expect(metadata).toBeUndefined();
    });
  });

  describe('detectKind', () => {
    it('should detect React component with hooks', () => {
      const sourceCode = `
import { useState } from 'react';

export function MyComponent() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const kind = detectKind(['useState'], [], ['react'], 'test.tsx', sourceFile);

      expect(kind).toBe('react:component');
    });

    it('should detect React component with JSX components', () => {
      const sourceCode = `
import { Button } from './Button';

export function MyComponent() {
  return <Button>Click</Button>;
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const kind = detectKind([], ['Button'], ['react'], 'test.tsx', sourceFile);

      expect(kind).toBe('react:component');
    });

    it('should detect React component with JSX elements', () => {
      const sourceCode = `
import React from 'react';

export function MyComponent() {
  return <div>Hello</div>;
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      const kind = detectKind([], [], ['react'], 'test.tsx', sourceFile);

      expect(kind).toBe('react:component');
    });

    it('should detect Node CLI in cli directory', () => {
      const sourceCode = `
export function main() {
  console.log('CLI tool');
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('cli/stamp.ts', sourceCode);

      // The regex requires /cli/ or \cli\ in the path (directory boundary)
      // Use a path that clearly has /cli/ as a directory
      const kind = detectKind([], [], [], '/project/cli/stamp.ts', sourceFile);

      expect(kind).toBe('node:cli');
    });

    it('should detect Node CLI with process.argv', () => {
      const sourceCode = `
const args = process.argv.slice(2);
export function main() {
  console.log(args);
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('src/main.ts', sourceCode);

      const kind = detectKind([], [], [], 'src/main.ts', sourceFile);

      expect(kind).toBe('node:cli');
    });

    it('should default to ts:module', () => {
      const sourceCode = `
export function calculate() {
  return 42;
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('src/utils.ts', sourceCode);

      const kind = detectKind([], [], [], 'src/utils.ts', sourceFile);

      expect(kind).toBe('ts:module');
    });
  });
});

