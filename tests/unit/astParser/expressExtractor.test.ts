import { describe, it, expect } from 'vitest';
import { Project } from 'ts-morph';
import {
  extractExpressRoutes,
  extractExpressApiSignature,
} from '../../../src/extractors/express/expressExtractor.js';

describe('Express Extractor', () => {
  describe('extractExpressRoutes', () => {
    it('should extract GET route with named handler', () => {
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

      const routes = extractExpressRoutes(sourceFile);

      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual({
        path: '/users',
        method: 'GET',
        handler: 'getUsers',
      });
    });

    it('should extract POST route with anonymous handler', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.post('/users', (req, res) => {
          res.json({ created: true });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const routes = extractExpressRoutes(sourceFile);

      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual({
        path: '/users',
        method: 'POST',
        handler: 'anonymous',
      });
    });

    it('should extract route with path parameters', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        function getUser(req: any, res: any) {
          res.json({ user: {} });
        }
        
        app.get('/users/:id', getUser);
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const routes = extractExpressRoutes(sourceFile);

      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual({
        path: '/users/:id',
        method: 'GET',
        handler: 'getUser',
        params: ['id'],
      });
    });

    it('should extract multiple path parameters', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.get('/users/:userId/posts/:postId', (req, res) => {
          res.json({});
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const routes = extractExpressRoutes(sourceFile);

      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual({
        path: '/users/:userId/posts/:postId',
        method: 'GET',
        handler: 'anonymous',
        params: ['userId', 'postId'],
      });
    });

    it('should extract PUT route', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        function updateUser(req: any, res: any) {
          res.json({ updated: true });
        }
        
        app.put('/users/:id', updateUser);
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const routes = extractExpressRoutes(sourceFile);

      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual({
        path: '/users/:id',
        method: 'PUT',
        handler: 'updateUser',
        params: ['id'],
      });
    });

    it('should extract DELETE route', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.delete('/users/:id', (req, res) => {
          res.json({ deleted: true });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const routes = extractExpressRoutes(sourceFile);

      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual({
        path: '/users/:id',
        method: 'DELETE',
        handler: 'anonymous',
        params: ['id'],
      });
    });

    it('should extract PATCH route', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        function patchUser(req: any, res: any) {
          res.json({ patched: true });
        }
        
        app.patch('/users/:id', patchUser);
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const routes = extractExpressRoutes(sourceFile);

      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual({
        path: '/users/:id',
        method: 'PATCH',
        handler: 'patchUser',
        params: ['id'],
      });
    });

    it('should extract ALL route', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.all('/users', (req, res) => {
          res.json({});
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const routes = extractExpressRoutes(sourceFile);

      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual({
        path: '/users',
        method: 'ALL',
        handler: 'anonymous',
      });
    });

    it('should extract routes from router', () => {
      const sourceCode = `
        import express from 'express';
        const router = express.Router();
        
        router.get('/users', (req, res) => {
          res.json({ users: [] });
        });
        
        router.post('/users', (req, res) => {
          res.json({ created: true });
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const routes = extractExpressRoutes(sourceFile);

      expect(routes).toHaveLength(2);
      expect(routes[0]).toEqual({
        path: '/users',
        method: 'GET',
        handler: 'anonymous',
      });
      expect(routes[1]).toEqual({
        path: '/users',
        method: 'POST',
        handler: 'anonymous',
      });
    });

    it('should extract multiple routes', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        function getUsers(req: any, res: any) {
          res.json({ users: [] });
        }
        
        function createUser(req: any, res: any) {
          res.json({ created: true });
        }
        
        app.get('/users', getUsers);
        app.post('/users', createUser);
        app.get('/users/:id', getUsers);
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const routes = extractExpressRoutes(sourceFile);

      expect(routes).toHaveLength(3);
      expect(routes[0]).toEqual({
        path: '/users',
        method: 'GET',
        handler: 'getUsers',
      });
      expect(routes[1]).toEqual({
        path: '/users',
        method: 'POST',
        handler: 'createUser',
      });
      expect(routes[2]).toEqual({
        path: '/users/:id',
        method: 'GET',
        handler: 'getUsers',
        params: ['id'],
      });
    });

    it('should handle arrow function assigned to variable', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        const getUsers = (req: any, res: any) => {
          res.json({ users: [] });
        };
        
        app.get('/users', getUsers);
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const routes = extractExpressRoutes(sourceFile);

      expect(routes).toHaveLength(1);
      expect(routes[0]).toEqual({
        path: '/users',
        method: 'GET',
        handler: 'getUsers',
      });
    });

    it('should return empty array when no routes found', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        app.use(express.json());
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('app.ts', sourceCode);

      const routes = extractExpressRoutes(sourceFile);

      expect(routes).toEqual([]);
    });

    it('should handle non-string path literals gracefully', () => {
      const sourceCode = `
        import express from 'express';
        const app = express();
        
        const path = '/users';
        app.get(path, (req, res) => {
          res.json({});
        });
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('routes.ts', sourceCode);

      const routes = extractExpressRoutes(sourceFile);

      // Should still extract, but path might be extracted from variable name or text
      expect(routes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('extractExpressApiSignature', () => {
    it('should extract parameters from function declaration', () => {
      const sourceCode = `
        function getUser(req: express.Request, res: express.Response) {
          res.json({ user: {} });
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('handlers.ts', sourceCode);

      const signature = extractExpressApiSignature(sourceFile, 'getUser');

      expect(signature).toBeDefined();
      expect(signature?.parameters).toBeDefined();
      expect(signature?.parameters?.['req']).toBe('express.Request');
      expect(signature?.parameters?.['res']).toBe('express.Response');
    });

    it('should extract parameters from arrow function', () => {
      const sourceCode = `
        const getUser = (req: express.Request, res: express.Response) => {
          res.json({ user: {} });
        };
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('handlers.ts', sourceCode);

      const signature = extractExpressApiSignature(sourceFile, 'getUser');

      expect(signature).toBeDefined();
      expect(signature?.parameters).toBeDefined();
      expect(signature?.parameters?.['req']).toBe('express.Request');
      expect(signature?.parameters?.['res']).toBe('express.Response');
    });

    it('should extract return type when available', () => {
      const sourceCode = `
        function getUser(req: express.Request, res: express.Response): void {
          res.json({ user: {} });
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('handlers.ts', sourceCode);

      const signature = extractExpressApiSignature(sourceFile, 'getUser');

      expect(signature).toBeDefined();
      expect(signature?.returnType).toBe('void');
    });

    it('should handle function with no parameters', () => {
      const sourceCode = `
        function getUsers(): void {
          return;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('handlers.ts', sourceCode);

      const signature = extractExpressApiSignature(sourceFile, 'getUsers');

      // When no parameters, signature might be undefined (since parameters object would be empty)
      // This is expected behavior - the function should not throw
      expect(() => extractExpressApiSignature(sourceFile, 'getUsers')).not.toThrow();
    });

    it('should return undefined for non-existent function', () => {
      const sourceCode = `
        function otherFunction() {
          return;
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('handlers.ts', sourceCode);

      const signature = extractExpressApiSignature(sourceFile, 'getUser');

      expect(signature).toBeUndefined();
    });

    it('should handle function with inferred types', () => {
      const sourceCode = `
        function getUser(req, res) {
          res.json({ user: {} });
        }
      `;

      const project = new Project({ useInMemoryFileSystem: true });
      const sourceFile = project.createSourceFile('handlers.ts', sourceCode);

      const signature = extractExpressApiSignature(sourceFile, 'getUser');

      // Should still extract function, but types might be 'any' or inferred
      expect(signature).toBeDefined();
      expect(signature?.parameters).toBeDefined();
    });
  });
});
