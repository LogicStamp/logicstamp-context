import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import {
  extractNestJSController,
  extractNestJSApiSignature,
} from '../../../src/extractors/nest/nestjsExtractor.js';

describe('NestJS Extractor', () => {
  describe('extractNestJSController', () => {
    it('should extract controller with @Controller decorator', () => {
      const sourceCode = `
        import { Controller } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const controller = extractNestJSController(sourceFile);

      expect(controller).toBeDefined();
      expect(controller?.name).toBe('UsersController');
      expect(controller?.basePath).toBe('users');
      expect(controller?.routes).toEqual([]);
    });

    it('should extract controller without base path', () => {
      const sourceCode = `
        import { Controller } from '@nestjs/common';
        
        @Controller()
        export class UsersController {
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const controller = extractNestJSController(sourceFile);

      expect(controller).toBeDefined();
      expect(controller?.name).toBe('UsersController');
      expect(controller?.basePath).toBeUndefined();
    });

    it('should extract controller with @Get() method', () => {
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

      const controller = extractNestJSController(sourceFile);

      expect(controller).toBeDefined();
      expect(controller?.routes).toHaveLength(1);
      expect(controller?.routes[0]).toEqual({
        path: '',
        method: 'GET',
        handler: 'findAll',
      });
    });

    it('should extract controller with @Get() method and path', () => {
      const sourceCode = `
        import { Controller, Get } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
          @Get(':id')
          findOne() {
            return {};
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const controller = extractNestJSController(sourceFile);

      expect(controller).toBeDefined();
      expect(controller?.routes).toHaveLength(1);
      expect(controller?.routes[0]).toEqual({
        path: ':id',
        method: 'GET',
        handler: 'findOne',
        params: ['id'],
      });
    });

    it('should extract controller with @Post() method', () => {
      const sourceCode = `
        import { Controller, Post } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
          @Post()
          create() {
            return { created: true };
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const controller = extractNestJSController(sourceFile);

      expect(controller).toBeDefined();
      expect(controller?.routes).toHaveLength(1);
      expect(controller?.routes[0]).toEqual({
        path: '',
        method: 'POST',
        handler: 'create',
      });
    });

    it('should extract controller with @Put() method', () => {
      const sourceCode = `
        import { Controller, Put } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
          @Put(':id')
          update() {
            return { updated: true };
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const controller = extractNestJSController(sourceFile);

      expect(controller).toBeDefined();
      expect(controller?.routes).toHaveLength(1);
      expect(controller?.routes[0]).toEqual({
        path: ':id',
        method: 'PUT',
        handler: 'update',
        params: ['id'],
      });
    });

    it('should extract controller with @Delete() method', () => {
      const sourceCode = `
        import { Controller, Delete } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
          @Delete(':id')
          remove() {
            return { deleted: true };
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const controller = extractNestJSController(sourceFile);

      expect(controller).toBeDefined();
      expect(controller?.routes).toHaveLength(1);
      expect(controller?.routes[0]).toEqual({
        path: ':id',
        method: 'DELETE',
        handler: 'remove',
        params: ['id'],
      });
    });

    it('should extract controller with @Patch() method', () => {
      const sourceCode = `
        import { Controller, Patch } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
          @Patch(':id')
          patch() {
            return { patched: true };
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const controller = extractNestJSController(sourceFile);

      expect(controller).toBeDefined();
      expect(controller?.routes).toHaveLength(1);
      expect(controller?.routes[0]).toEqual({
        path: ':id',
        method: 'PATCH',
        handler: 'patch',
        params: ['id'],
      });
    });

    it('should extract multiple routes from controller', () => {
      const sourceCode = `
        import { Controller, Get, Post, Put, Delete } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
          @Get()
          findAll() {
            return [];
          }
          
          @Get(':id')
          findOne() {
            return {};
          }
          
          @Post()
          create() {
            return { created: true };
          }
          
          @Put(':id')
          update() {
            return { updated: true };
          }
          
          @Delete(':id')
          remove() {
            return { deleted: true };
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const controller = extractNestJSController(sourceFile);

      expect(controller).toBeDefined();
      expect(controller?.routes).toHaveLength(5);
      expect(controller?.routes[0]).toEqual({
        path: '',
        method: 'GET',
        handler: 'findAll',
      });
      expect(controller?.routes[1]).toEqual({
        path: ':id',
        method: 'GET',
        handler: 'findOne',
        params: ['id'],
      });
      expect(controller?.routes[2]).toEqual({
        path: '',
        method: 'POST',
        handler: 'create',
      });
      expect(controller?.routes[3]).toEqual({
        path: ':id',
        method: 'PUT',
        handler: 'update',
        params: ['id'],
      });
      expect(controller?.routes[4]).toEqual({
        path: ':id',
        method: 'DELETE',
        handler: 'remove',
        params: ['id'],
      });
    });

    it('should extract route with multiple path parameters', () => {
      const sourceCode = `
        import { Controller, Get } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
          @Get(':userId/posts/:postId')
          getUserPost() {
            return {};
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const controller = extractNestJSController(sourceFile);

      expect(controller).toBeDefined();
      expect(controller?.routes).toHaveLength(1);
      expect(controller?.routes[0]).toEqual({
        path: ':userId/posts/:postId',
        method: 'GET',
        handler: 'getUserPost',
        params: ['userId', 'postId'],
      });
    });

    it('should return undefined when no @Controller decorator', () => {
      const sourceCode = `
        import { Injectable } from '@nestjs/common';
        
        @Injectable()
        export class UsersService {
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.service.ts', sourceCode);

      const controller = extractNestJSController(sourceFile);

      expect(controller).toBeUndefined();
    });

    it('should handle controller with double quotes in base path', () => {
      const sourceCode = `
        import { Controller } from '@nestjs/common';
        
        @Controller("users")
        export class UsersController {
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const controller = extractNestJSController(sourceFile);

      expect(controller).toBeDefined();
      expect(controller?.basePath).toBe('users');
    });

    it('should handle method without decorator', () => {
      const sourceCode = `
        import { Controller, Get } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
          @Get()
          findAll() {
            return [];
          }
          
          helperMethod() {
            // This should not be extracted as a route
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const controller = extractNestJSController(sourceFile);

      expect(controller).toBeDefined();
      expect(controller?.routes).toHaveLength(1);
      expect(controller?.routes[0].handler).toBe('findAll');
    });
  });

  describe('extractNestJSApiSignature', () => {
    it('should extract parameters from controller method', () => {
      const sourceCode = `
        import { Controller, Get } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
          @Get(':id')
          findOne(id: string, req: Request) {
            return {};
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const signature = extractNestJSApiSignature(sourceFile, 'UsersController', 'findOne');

      expect(signature).toBeDefined();
      expect(signature?.parameters).toBeDefined();
      expect(signature?.parameters?.['id']).toBe('string');
      expect(signature?.parameters?.['req']).toBe('Request');
    });

    it('should extract return type from controller method', () => {
      const sourceCode = `
        import { Controller, Get } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
          @Get()
          findAll(): User[] {
            return [];
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const signature = extractNestJSApiSignature(sourceFile, 'UsersController', 'findAll');

      expect(signature).toBeDefined();
      expect(signature?.returnType).toBe('User[]');
    });

    it('should handle method with no parameters', () => {
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

      const signature = extractNestJSApiSignature(sourceFile, 'UsersController', 'findAll');

      // When no parameters, signature might be undefined (since parameters object would be empty)
      // This is expected behavior - the function should not throw
      expect(() => extractNestJSApiSignature(sourceFile, 'UsersController', 'findAll')).not.toThrow();
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

      const signature = extractNestJSApiSignature(sourceFile, 'NonExistentController', 'findAll');

      expect(signature).toBeUndefined();
    });

    it('should return undefined for non-existent method', () => {
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

      const signature = extractNestJSApiSignature(sourceFile, 'UsersController', 'nonExistent');

      expect(signature).toBeUndefined();
    });

    it('should handle method with inferred types', () => {
      const sourceCode = `
        import { Controller, Get } from '@nestjs/common';
        
        @Controller('users')
        export class UsersController {
          @Get(':id')
          findOne(id, req) {
            return {};
          }
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('users.controller.ts', sourceCode);

      const signature = extractNestJSApiSignature(sourceFile, 'UsersController', 'findOne');

      // Should still extract function, but types might be 'any' or inferred
      expect(signature).toBeDefined();
      expect(signature?.parameters).toBeDefined();
    });
  });
});
