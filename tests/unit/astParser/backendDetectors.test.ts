import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import { detectBackendFramework } from '../../../src/core/astParser/detectors.js';

describe('Backend Framework Detection', () => {
  describe('detectBackendFramework', () => {
    it('should detect Express.js from express import and app.get()', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.get('/users', (req, res) => {
          res.json({ users: [] });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const framework = detectBackendFramework(['express'], sourceFile);

      expect(framework).toBe('express');
    });

    it('should detect Express.js from express import and router.post()', () => {
      const sourceCode = `
        import express from 'express';
        const router = express.Router();
        
        router.post('/users', (req, res) => {
          res.json({ success: true });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const framework = detectBackendFramework(['express'], sourceFile);

      expect(framework).toBe('express');
    });

    it('should detect Express.js with app.put()', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.put('/users/:id', (req, res) => {
          res.json({ updated: true });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const framework = detectBackendFramework(['express'], sourceFile);

      expect(framework).toBe('express');
    });

    it('should detect Express.js with app.delete()', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.delete('/users/:id', (req, res) => {
          res.json({ deleted: true });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const framework = detectBackendFramework(['express'], sourceFile);

      expect(framework).toBe('express');
    });

    it('should detect Express.js with app.patch()', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.patch('/users/:id', (req, res) => {
          res.json({ patched: true });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const framework = detectBackendFramework(['express'], sourceFile);

      expect(framework).toBe('express');
    });

    it('should detect Express.js with app.all()', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.all('/users', (req, res) => {
          res.json({ all: true });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const framework = detectBackendFramework(['express'], sourceFile);

      expect(framework).toBe('express');
    });

    it('should not detect Express.js without route methods', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.use(express.json());
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('app.ts', sourceCode);

      const framework = detectBackendFramework(['express'], sourceFile);

      expect(framework).toBeUndefined();
    });

    it('should detect NestJS from @nestjs import and @Controller()', () => {
      const sourceCode = `
        import { Controller } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const framework = detectBackendFramework(['@nestjs/common'], sourceFile);

      expect(framework).toBe('nestjs');
    });

    it('should detect NestJS from @nestjs import and @Get()', () => {
      const sourceCode = `
        import { Get } from '@nestjs/common';
        
        export class UsersController {
          @Get()
          findAll() {
            return [];
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const framework = detectBackendFramework(['@nestjs/common'], sourceFile);

      expect(framework).toBe('nestjs');
    });

    it('should detect NestJS with @Post() decorator', () => {
      const sourceCode = `
        import { Post } from '@nestjs/common';
        
        export class UsersController {
          @Post()
          create() {
            return { created: true };
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const framework = detectBackendFramework(['@nestjs/common'], sourceFile);

      expect(framework).toBe('nestjs');
    });

    it('should detect NestJS with @Put() decorator', () => {
      const sourceCode = `
        import { Put } from '@nestjs/common';
        
        export class UsersController {
          @Put(':id')
          update() {
            return { updated: true };
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const framework = detectBackendFramework(['@nestjs/common'], sourceFile);

      expect(framework).toBe('nestjs');
    });

    it('should detect NestJS with @Delete() decorator', () => {
      const sourceCode = `
        import { Delete } from '@nestjs/common';
        
        export class UsersController {
          @Delete(':id')
          remove() {
            return { deleted: true };
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const framework = detectBackendFramework(['@nestjs/common'], sourceFile);

      expect(framework).toBe('nestjs');
    });

    it('should detect NestJS with @Patch() decorator', () => {
      const sourceCode = `
        import { Patch } from '@nestjs/common';
        
        export class UsersController {
          @Patch(':id')
          patch() {
            return { patched: true };
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const framework = detectBackendFramework(['@nestjs/common'], sourceFile);

      expect(framework).toBe('nestjs');
    });

    it('should not detect NestJS without decorators', () => {
      const sourceCode = `
        import { Injectable } from '@nestjs/common';
        
        @Injectable()
        export class UsersService {
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.service.ts', sourceCode);

      const framework = detectBackendFramework(['@nestjs/common'], sourceFile);

      expect(framework).toBeUndefined();
    });

    it('should return undefined for non-backend code', () => {
      const sourceCode = `
        import { useState } from 'react';
        
        export function MyComponent() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('component.tsx', sourceCode);

      const framework = detectBackendFramework(['react'], sourceFile);

      expect(framework).toBeUndefined();
    });

    it('should return undefined for empty imports', () => {
      const sourceCode = `
        export function calculate() {
          return 42;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('utils.ts', sourceCode);

      const framework = detectBackendFramework([], sourceFile);

      expect(framework).toBeUndefined();
    });

    it('should handle case-insensitive method names', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.GET('/users', (req, res) => {
          res.json({ users: [] });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const framework = detectBackendFramework(['express'], sourceFile);

      expect(framework).toBe('express');
    });

    it('should handle express subpath imports', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.get('/users', (req, res) => {
          res.json({ users: [] });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const framework = detectBackendFramework(['express/router'], sourceFile);

      // express/router starts with 'express/', so it matches the detection pattern
      expect(framework).toBe('express');
    });

    it('should handle @nestjs scoped packages', () => {
      const sourceCode = `
        import { Controller } from '@nestjs/core';
        
        @Controller('users')
        export class UsersController {
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const framework = detectBackendFramework(['@nestjs/core'], sourceFile);

      expect(framework).toBe('nestjs');
    });
  });
});
