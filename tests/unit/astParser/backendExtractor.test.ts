import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import {
  extractBackendMetadata,
  extractBackendApiSignature,
} from '../../../src/extractors/shared/backendExtractor.js';

describe('Backend Extractor', () => {
  describe('extractBackendMetadata - Express', () => {
    it('should extract Express routes', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        function getUsers(req: any, res: any) {
          res.json({ users: [] });
        }
        
        app.get('/users', getUsers);
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const metadata = extractBackendMetadata(sourceFile, 'routes.ts', ['express'], 'express');

      expect(metadata).toBeDefined();
      expect(metadata?.framework).toBe('express');
      expect(metadata?.routes).toBeDefined();
      expect(metadata?.routes).toHaveLength(1);
      expect(metadata?.routes?.[0]).toEqual({
        path: '/users',
        method: 'GET',
        handler: 'getUsers',
        apiSignature: {
          parameters: {
            req: 'any',
            res: 'any',
          },
          returnType: 'void',
        },
      });
    });

    it('should extract Express routes with language-specific decorators', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.get('/users', (req, res) => {
          res.json({ users: [] });
        });
        
        app.post('/users', (req, res) => {
          res.json({ created: true });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const metadata = extractBackendMetadata(sourceFile, 'routes.ts', ['express'], 'express');

      expect(metadata).toBeDefined();
      expect(metadata?.framework).toBe('express');
      expect(metadata?.languageSpecific).toBeDefined();
      expect(metadata?.languageSpecific?.decorators).toBeDefined();
      expect(metadata?.languageSpecific?.decorators?.length).toBeGreaterThan(0);
    });

    it('should handle Express file with no routes', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.use(express.json());
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('app.ts', sourceCode);

      const metadata = extractBackendMetadata(sourceFile, 'app.ts', ['express'], 'express');

      expect(metadata).toBeDefined();
      expect(metadata?.framework).toBe('express');
      // When no routes found, routes field might be undefined or empty array
      if (metadata?.routes !== undefined) {
        expect(metadata.routes).toEqual([]);
      }
    });
  });

  describe('extractBackendMetadata - NestJS', () => {
    it('should extract NestJS controller', () => {
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

      const metadata = extractBackendMetadata(
        sourceFile,
        'users.controller.ts',
        ['@nestjs/common'],
        'nestjs'
      );

      expect(metadata).toBeDefined();
      expect(metadata?.framework).toBe('nestjs');
      expect(metadata?.controller).toBeDefined();
      expect(metadata?.controller?.name).toBe('UsersController');
      expect(metadata?.controller?.basePath).toBe('users');
      expect(metadata?.routes).toBeDefined();
      expect(metadata?.routes).toHaveLength(1);
    });

    it('should extract NestJS controller with language-specific metadata', () => {
      const sourceCode = `
        import { Controller, Get, Post } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
          @Get()
          findAll() {
            return [];
          }
          
          @Post()
          create() {
            return { created: true };
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const metadata = extractBackendMetadata(
        sourceFile,
        'users.controller.ts',
        ['@nestjs/common'],
        'nestjs'
      );

      expect(metadata).toBeDefined();
      expect(metadata?.framework).toBe('nestjs');
      expect(metadata?.languageSpecific).toBeDefined();
      expect(metadata?.languageSpecific?.annotations).toBeDefined();
      expect(metadata?.languageSpecific?.annotations?.length).toBeGreaterThan(0);
      expect(metadata?.languageSpecific?.classes).toBeDefined();
      expect(metadata?.languageSpecific?.classes).toContain('UsersController');
    });

    it('should return undefined for NestJS file without controller', () => {
      const sourceCode = `
        import { Injectable } from '@nestjs/common';
        
        @Injectable()
        export class UsersService {
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.service.ts', sourceCode);

      const metadata = extractBackendMetadata(
        sourceFile,
        'users.service.ts',
        ['@nestjs/common'],
        'nestjs'
      );

      expect(metadata).toBeUndefined();
    });
  });

  describe('extractBackendApiSignature - Express', () => {
    it('should extract API signature from Express handler', () => {
      const sourceCode = `
        import express from 'express';
        
        function getUser(req: express.Request, res: express.Response) {
          res.json({ user: {} });
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('handlers.ts', sourceCode);

      const signature = extractBackendApiSignature(sourceFile, 'express', 'getUser');

      expect(signature).toBeDefined();
      expect(signature?.parameters).toBeDefined();
      expect(signature?.parameters?.['req']).toBe('express.Request');
      expect(signature?.parameters?.['res']).toBe('express.Response');
    });

    it('should return undefined for non-existent handler', () => {
      const sourceCode = `
        import express from 'express';
        
        function otherHandler() {
          return;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('handlers.ts', sourceCode);

      const signature = extractBackendApiSignature(sourceFile, 'express', 'getUser');

      expect(signature).toBeUndefined();
    });
  });

  describe('extractBackendApiSignature - NestJS', () => {
    it('should extract API signature from NestJS controller method', () => {
      const sourceCode = `
        import { Controller, Get } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
          @Get(':id')
          findOne(id: string, req: Request): User {
            return {} as User;
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const signature = extractBackendApiSignature(
        sourceFile,
        'nestjs',
        'findOne',
        'UsersController'
      );

      expect(signature).toBeDefined();
      expect(signature?.parameters).toBeDefined();
      expect(signature?.parameters?.['id']).toBe('string');
      expect(signature?.parameters?.['req']).toBe('Request');
      expect(signature?.returnType).toBe('User');
    });

    it('should return undefined for non-existent class', () => {
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

      const signature = extractBackendApiSignature(
        sourceFile,
        'nestjs',
        'findAll',
        'NonExistentController'
      );

      expect(signature).toBeUndefined();
    });

    it('should return undefined when className is missing', () => {
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

      const signature = extractBackendApiSignature(sourceFile, 'nestjs', 'findAll');

      expect(signature).toBeUndefined();
    });
  });

  describe('Error handling', () => {
    it('should handle errors gracefully', () => {
      const sourceCode = `invalid syntax {`;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('invalid.ts', sourceCode);

      // Should not throw, but might return undefined or empty result
      const metadata = extractBackendMetadata(
        sourceFile,
        'invalid.ts',
        ['express'],
        'express'
      );

      // Result might be undefined or empty, but should not throw
      expect(() => {
        extractBackendMetadata(sourceFile, 'invalid.ts', ['express'], 'express');
      }).not.toThrow();
    });
  });
});
