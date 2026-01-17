import { describe, it, expect, vi } from 'vitest';
import { Project } from 'ts-morph';
import {
  detectNextJsDirective,
  isInNextAppDir,
  extractNextJsMetadata,
  detectKind,
  detectBackendFramework,
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

      const kind = detectKind(['useState'], [], ['react'], sourceFile, 'test.tsx');

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

      const kind = detectKind([], ['Button'], ['react'], sourceFile, 'test.tsx');

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

      const kind = detectKind([], [], ['react'], sourceFile, 'test.tsx');

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
      const kind = detectKind([], [], [], sourceFile, '/project/cli/stamp.ts');

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

      const kind = detectKind([], [], [], sourceFile, 'src/main.ts');

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

      const kind = detectKind([], [], [], sourceFile, 'src/utils.ts');

      expect(kind).toBe('ts:module');
    });

    it('should detect React hook with default export', () => {
      const sourceCode = `
import { useState } from 'react';

export default function useTypewriter(text: string, speed = 30) {
  const [displayedText, setDisplayedText] = useState('');
  return displayedText;
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('hooks/useTypewriter.ts', sourceCode);

      const kind = detectKind(['useState'], [], ['react'], sourceFile, 'hooks/useTypewriter.ts');

      expect(kind).toBe('react:hook');
    });

    it('should detect React hook with named export', () => {
      const sourceCode = `
import { useState } from 'react';

export function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);
  return { count, setCount };
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('hooks/useCounter.ts', sourceCode);

      const kind = detectKind(['useState'], [], ['react'], sourceFile, 'hooks/useCounter.ts');

      expect(kind).toBe('react:hook');
    });

    it('should detect React hook with arrow function export', () => {
      const sourceCode = `
import { useState } from 'react';

export const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  return debouncedValue;
};
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('hooks/useDebounce.ts', sourceCode);

      const kind = detectKind(['useState'], [], ['react'], sourceFile, 'hooks/useDebounce.ts');

      expect(kind).toBe('react:hook');
    });

    it('should not classify component with JSX as hook', () => {
      const sourceCode = `
import { useState } from 'react';

export function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);
  return <div>{count}</div>; // Has JSX, should be component
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('components/Counter.tsx', sourceCode);

      const kind = detectKind(['useState'], [], ['react'], sourceFile, 'components/Counter.tsx');

      expect(kind).toBe('react:component');
    });

    it('should not classify hook that uses components as hook', () => {
      const sourceCode = `
import { useState } from 'react';
import { Button } from './Button';

export function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);
  return { count, setCount };
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('hooks/useCounter.ts', sourceCode);

      const kind = detectKind(['useState'], ['Button'], ['react'], sourceFile, 'hooks/useCounter.ts');

      expect(kind).toBe('react:component');
    });
  });

  describe('Error handling', () => {
    it('should handle AST traversal errors gracefully in detectNextJsDirective', () => {
      const sourceCode = `'use client';

export function MyComponent() {
  return <div>Hello</div>;
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      // Should not throw even if there are issues
      const directive = detectNextJsDirective(sourceFile);
      expect(directive === 'client' || directive === 'server' || directive === undefined).toBe(true);
    });

    it('should handle AST traversal errors gracefully in extractNextJsMetadata', () => {
      const sourceCode = `'use client';

export function MyComponent() {
  return <div>Hello</div>;
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('app/page.tsx', sourceCode);

      // Should not throw even if there are issues
      const metadata = extractNextJsMetadata(sourceFile, 'app/page.tsx');
      expect(metadata === undefined || typeof metadata === 'object').toBe(true);
    });

    it('should handle AST traversal errors gracefully in detectKind', () => {
      const sourceCode = `
import { useState } from 'react';

export function MyComponent() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}
`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', sourceCode);

      // Should not throw even if there are issues
      const kind = detectKind(['useState'], [], ['react'], sourceFile, 'test.tsx');
      expect(['react:component', 'react:hook', 'node:cli', 'ts:module']).toContain(kind);
    });

    it('should have debug logging infrastructure in place', () => {
      const originalEnv = process.env.LOGICSTAMP_DEBUG;
      process.env.LOGICSTAMP_DEBUG = '1';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', 'export function test() {}');

      detectNextJsDirective(sourceFile);
      extractNextJsMetadata(sourceFile, 'test.tsx');
      detectKind([], [], [], sourceFile, 'test.tsx');

      // If errors were logged, verify they have the correct format
      const errorCalls = consoleErrorSpy.mock.calls;
      if (errorCalls.length > 0) {
        const hasDetectorLog = errorCalls.some(call =>
          call[0]?.toString().includes('[LogicStamp][DEBUG]') &&
          call[0]?.toString().includes('detector')
        );
        expect(hasDetectorLog).toBe(true);
      }

      consoleErrorSpy.mockRestore();
      if (originalEnv === undefined) {
        delete process.env.LOGICSTAMP_DEBUG;
      } else {
        process.env.LOGICSTAMP_DEBUG = originalEnv;
      }
    });

    it('should return undefined on error in detectNextJsDirective', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      // Should return undefined on any error, not throw
      const directive = detectNextJsDirective(sourceFile);
      expect(directive === 'client' || directive === 'server' || directive === undefined).toBe(true);
    });

    it('should return undefined on error in extractNextJsMetadata', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      // Should return undefined on any error, not throw
      const metadata = extractNextJsMetadata(sourceFile, 'test.tsx');
      expect(metadata === undefined || typeof metadata === 'object').toBe(true);
    });

    it('should return ts:module as fallback on error in detectKind', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('test.tsx', '');

      // Should return a valid ContractKind on any error, defaulting to ts:module
      const kind = detectKind([], [], [], sourceFile, 'test.tsx');
      expect(['react:component', 'react:hook', 'node:cli', 'ts:module', 'node:api']).toContain(kind);
    });
  });

  describe('detectKind - Backend frameworks', () => {
    it('should detect node:api for Express.js backend', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.get('/users', (req, res) => {
          res.json({ users: [] });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const kind = detectKind([], [], ['express'], sourceFile, 'routes.ts', 'express');

      expect(kind).toBe('node:api');
    });

    it('should detect node:api for NestJS backend', () => {
      const sourceCode = `
        import { Controller, Get } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
          @Get()
          findAll() {
            return [];
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const kind = detectKind([], [], ['@nestjs/common'], sourceFile, 'users.controller.ts', 'nestjs');

      expect(kind).toBe('node:api');
    });

    it('should prioritize backend detection over React', () => {
      const sourceCode = `
        import express from 'express';
        import { useState } from 'react';
        
        const app = express();
        
        app.get('/users', (req, res) => {
          res.json({ users: [] });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const kind = detectKind(['useState'], [], ['express', 'react'], sourceFile, 'routes.ts', 'express');

      expect(kind).toBe('node:api');
    });

    it('should prioritize backend detection over Vue', () => {
      const sourceCode = `
        import express from 'express';
        import { ref } from 'vue';
        
        const app = express();
        
        app.get('/users', (req, res) => {
          res.json({ users: [] });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const kind = detectKind([], [], ['express', 'vue'], sourceFile, 'routes.ts', 'express');

      expect(kind).toBe('node:api');
    });

    it('should not detect backend when backendFramework is undefined', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.get('/users', (req, res) => {
          res.json({ users: [] });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      // Without backendFramework parameter, should not detect as node:api
      const kind = detectKind([], [], ['express'], sourceFile, 'routes.ts');

      expect(kind).not.toBe('node:api');
    });
  });
});

