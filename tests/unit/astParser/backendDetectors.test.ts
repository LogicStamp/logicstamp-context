import { describe, it, expect } from 'vitest';
import { detectBackendFramework } from '../../../src/core/astParser/detectors.js';
import { createTestSourceFile } from '../test-helpers.js';

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

      const sourceFile = createTestSourceFile(sourceCode, 'routes.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'routes.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'routes.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'routes.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'routes.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'routes.ts');

      const framework = detectBackendFramework(['express'], sourceFile);

      expect(framework).toBe('express');
    });

    it('should not detect Express.js without route methods', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.use(express.json());
      `;

      const sourceFile = createTestSourceFile(sourceCode, 'app.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'users.controller.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'users.controller.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'users.controller.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'users.controller.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'users.controller.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'users.controller.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'users.service.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'component.tsx');

      const framework = detectBackendFramework(['react'], sourceFile);

      expect(framework).toBeUndefined();
    });

    it('should return undefined for empty imports', () => {
      const sourceCode = `
        export function calculate() {
          return 42;
        }
      `;

      const sourceFile = createTestSourceFile(sourceCode, 'utils.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'routes.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'routes.ts');

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

      const sourceFile = createTestSourceFile(sourceCode, 'users.controller.ts');

      const framework = detectBackendFramework(['@nestjs/core'], sourceFile);

      expect(framework).toBe('nestjs');
    });
  });
});
