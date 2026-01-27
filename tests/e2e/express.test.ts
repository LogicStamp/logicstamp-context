import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { extractFromFile } from '../../src/core/astParser.js';
import { buildContract } from '../../src/core/contractBuilder.js';
import { buildDependencyGraph } from '../../src/core/manifest.js';
import { readFileWithText } from '../../src/utils/fsx.js';
import type { UIFContract } from '../../src/types/UIFContract.js';

describe('Express.js End-to-End Tests', () => {
  const fixturesPath = join(process.cwd(), 'tests/fixtures/express-app/src');

  describe('AST Parser - Express Routes', () => {
    it('should extract AST from Express route file', async () => {
      const routesPath = join(fixturesPath, 'routes/users.ts');
      const ast = await extractFromFile(routesPath);

      expect(ast).toBeDefined();
      expect(ast.kind).toBe('node:api');
      expect(ast.backend).toBeDefined();
      expect(ast.backend?.framework).toBe('express');
    });

    it('should detect Express imports', async () => {
      const routesPath = join(fixturesPath, 'routes/users.ts');
      const ast = await extractFromFile(routesPath);

      expect(ast.imports).toContain('express');
    });

    it('should extract Express routes', async () => {
      const routesPath = join(fixturesPath, 'routes/users.ts');
      const ast = await extractFromFile(routesPath);

      expect(ast.backend?.routes).toBeDefined();
      expect(ast.backend?.routes?.length).toBeGreaterThan(0);
      
      const routes = ast.backend!.routes!;
      expect(routes.some(r => r.method === 'GET' && r.path === '/')).toBe(true);
      expect(routes.some(r => r.method === 'GET' && r.path === '/:id')).toBe(true);
      expect(routes.some(r => r.method === 'POST' && r.path === '/')).toBe(true);
    });

    it('should extract route parameters', async () => {
      const routesPath = join(fixturesPath, 'routes/users.ts');
      const ast = await extractFromFile(routesPath);

      const routeWithParams = ast.backend?.routes?.find(r => r.path === '/:id');
      expect(routeWithParams?.params).toEqual(['id']);
    });

    it('should extract handler function names', async () => {
      const routesPath = join(fixturesPath, 'routes/users.ts');
      const ast = await extractFromFile(routesPath);

      const routes = ast.backend?.routes || [];
      expect(routes.some(r => r.handler === 'getUsers')).toBe(true);
      expect(routes.some(r => r.handler === 'createUser')).toBe(true);
    });

    it('should extract functions from controllers', async () => {
      const controllerPath = join(fixturesPath, 'controllers/userController.ts');
      const ast = await extractFromFile(controllerPath);

      // Controllers are TypeScript modules, not Express route files
      // They don't have routes directly, but they have handler functions
      expect(ast.kind).toBe('ts:module');
      expect(ast.functions).toContain('getUsers');
      expect(ast.functions).toContain('createUser');
    });

    it('should skip frontend extraction for backend files', async () => {
      const routesPath = join(fixturesPath, 'routes/users.ts');
      const ast = await extractFromFile(routesPath);

      // Backend files should have empty frontend arrays
      expect(ast.hooks).toEqual([]);
      expect(ast.components).toEqual([]);
      expect(ast.props).toEqual({});
      expect(ast.emits).toEqual({});
    });
  });

  describe('Contract Builder - Express Routes', () => {
    it('should build a contract for Express route file', async () => {
      const routesPath = join(fixturesPath, 'routes/users.ts');
      const ast = await extractFromFile(routesPath);
      const { text } = await readFileWithText(routesPath);

      const result = buildContract(routesPath, ast, {
        preset: 'none',
        sourceText: text,
      });

      expect(result.contract).toBeDefined();
      if (result.contract) {
        expect(result.contract.kind).toBe('node:api');
        expect(result.contract.interface.apiSignature).toBeDefined();
      }
    });

    it('should include backend metadata in contract', async () => {
      const routesPath = join(fixturesPath, 'routes/users.ts');
      const ast = await extractFromFile(routesPath);
      const { text } = await readFileWithText(routesPath);

      const result = buildContract(routesPath, ast, {
        preset: 'none',
        sourceText: text,
      });

      if (result.contract) {
        expect(result.contract.composition.languageSpecific).toBeDefined();
        const langSpecific = result.contract.composition.languageSpecific;
        expect(langSpecific?.decorators).toBeDefined();
      }
    });

    it('should build contract for Express controller', async () => {
      const controllerPath = join(fixturesPath, 'controllers/userController.ts');
      const ast = await extractFromFile(controllerPath);
      const { text } = await readFileWithText(controllerPath);

      const result = buildContract(controllerPath, ast, {
        preset: 'none',
        sourceText: text,
      });

      expect(result.contract).toBeDefined();
      if (result.contract) {
        // Controllers are TypeScript modules, not route files
        expect(result.contract.kind).toBe('ts:module');
        expect(result.contract.composition.functions).toContain('getUsers');
        expect(result.contract.composition.functions).toContain('createUser');
      }
    });
  });

  describe('Dependency Graph - Express App', () => {
    it('should build dependency graph for Express app', async () => {
      const contracts: UIFContract[] = [];

      const files = [
        join(fixturesPath, 'app.ts'),
        join(fixturesPath, 'routes/users.ts'),
        join(fixturesPath, 'routes/posts.ts'),
        join(fixturesPath, 'controllers/userController.ts'),
        join(fixturesPath, 'controllers/postController.ts'),
      ];

      for (const file of files) {
        const ast = await extractFromFile(file);
        const { text } = await readFileWithText(file);
        const result = buildContract(file, ast, {
          preset: 'none',
          sourceText: text,
        });

        if (result.contract) {
          contracts.push(result.contract);
        }
      }

      const manifest = buildDependencyGraph(contracts);

      expect(manifest).toBeDefined();
      expect(manifest.components).toBeDefined();
      expect(Object.keys(manifest.components).length).toBeGreaterThan(0);
    });

    it('should include route files in dependency graph', async () => {
      const contracts: UIFContract[] = [];

      const files = [
        join(fixturesPath, 'app.ts'),
        join(fixturesPath, 'routes/users.ts'),
        join(fixturesPath, 'routes/posts.ts'),
      ];

      for (const file of files) {
        const ast = await extractFromFile(file);
        const { text } = await readFileWithText(file);
        const result = buildContract(file, ast, {
          preset: 'none',
          sourceText: text,
        });

        if (result.contract) {
          contracts.push(result.contract);
        }
      }

      const manifest = buildDependencyGraph(contracts);

      const routeFiles = Object.values(manifest.components).filter(c => 
        c.entryId.includes('routes/')
      );
      expect(routeFiles.length).toBeGreaterThan(0);
    });
  });
});
