import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { extractFromFile } from '../../src/core/astParser.js';
import { buildContract } from '../../src/core/contractBuilder.js';
import { buildDependencyGraph } from '../../src/core/manifest.js';
import { readFileWithText } from '../../src/utils/fsx.js';
import type { UIFContract } from '../../src/types/UIFContract.js';

describe('NestJS End-to-End Tests', () => {
  const fixturesPath = join(process.cwd(), 'tests/fixtures/nest-app/src');

  describe('AST Parser - NestJS Controllers', () => {
    it('should extract AST from NestJS controller', async () => {
      const controllerPath = join(fixturesPath, 'users/users.controller.ts');
      const ast = await extractFromFile(controllerPath);

      expect(ast).toBeDefined();
      expect(ast.kind).toBe('node:api');
      expect(ast.backend?.framework).toBe('nestjs');
    });

    it('should detect NestJS imports', async () => {
      const controllerPath = join(fixturesPath, 'users/users.controller.ts');
      const ast = await extractFromFile(controllerPath);

      expect(ast.imports.some(imp => imp.includes('@nestjs'))).toBe(true);
    });

    it('should extract controller base path', async () => {
      const controllerPath = join(fixturesPath, 'users/users.controller.ts');
      const ast = await extractFromFile(controllerPath);

      expect(ast.backend?.controller).toBeDefined();
      expect(ast.backend?.controller?.name).toBe('UsersController');
      expect(ast.backend?.controller?.basePath).toBe('users');
    });

    it('should extract route decorators', async () => {
      const controllerPath = join(fixturesPath, 'users/users.controller.ts');
      const ast = await extractFromFile(controllerPath);

      expect(ast.backend?.routes).toBeDefined();
      const routes = ast.backend!.routes!;
      
      expect(routes.some(r => r.method === 'GET' && r.path === '')).toBe(true);
      expect(routes.some(r => r.method === 'POST' && r.path === '')).toBe(true);
      expect(routes.some(r => r.method === 'GET' && r.path === ':id')).toBe(true);
    });

    it('should extract method parameters and return types', async () => {
      const controllerPath = join(fixturesPath, 'users/users.controller.ts');
      const ast = await extractFromFile(controllerPath);

      expect(ast.backend?.routes).toBeDefined();
      const routes = ast.backend!.routes!;
      
      // Check that routes have handlers
      expect(routes.length).toBeGreaterThan(0);
      const routeWithHandler = routes.find(r => r.handler);
      expect(routeWithHandler).toBeDefined();
    });

    it('should extract annotations', async () => {
      const controllerPath = join(fixturesPath, 'users/users.controller.ts');
      const ast = await extractFromFile(controllerPath);

      const langSpecific = ast.backend?.languageSpecific;
      expect(langSpecific?.annotations).toBeDefined();
      if (langSpecific?.annotations) {
        expect(langSpecific.annotations).toContain('@Controller');
        expect(langSpecific.annotations.some(a => a.includes('@Get'))).toBe(true);
        expect(langSpecific.annotations.some(a => a.includes('@Post'))).toBe(true);
      }
    });

    it('should extract class names', async () => {
      const controllerPath = join(fixturesPath, 'users/users.controller.ts');
      const ast = await extractFromFile(controllerPath);

      const langSpecific = ast.backend?.languageSpecific;
      expect(langSpecific?.classes).toBeDefined();
      if (langSpecific?.classes) {
        expect(langSpecific.classes).toContain('UsersController');
      }
    });

    it('should skip frontend extraction for backend files', async () => {
      const controllerPath = join(fixturesPath, 'users/users.controller.ts');
      const ast = await extractFromFile(controllerPath);

      // Backend files should have empty frontend arrays
      expect(ast.hooks).toEqual([]);
      expect(ast.components).toEqual([]);
      expect(ast.props).toEqual({});
      expect(ast.emits).toEqual({});
    });
  });

  describe('Contract Builder - NestJS Controllers', () => {
    it('should build a contract for NestJS controller', async () => {
      const controllerPath = join(fixturesPath, 'users/users.controller.ts');
      const ast = await extractFromFile(controllerPath);
      const { text } = await readFileWithText(controllerPath);

      const result = buildContract(controllerPath, ast, {
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
      const controllerPath = join(fixturesPath, 'users/users.controller.ts');
      const ast = await extractFromFile(controllerPath);
      const { text } = await readFileWithText(controllerPath);

      const result = buildContract(controllerPath, ast, {
        preset: 'none',
        sourceText: text,
      });

      if (result.contract) {
        expect(result.contract.composition.languageSpecific).toBeDefined();
        const langSpecific = result.contract.composition.languageSpecific;
        expect(langSpecific?.annotations).toBeDefined();
        expect(langSpecific?.classes).toBeDefined();
      }
    });

    it('should build contract for NestJS service', async () => {
      const servicePath = join(fixturesPath, 'users/users.service.ts');
      const ast = await extractFromFile(servicePath);
      const { text } = await readFileWithText(servicePath);

      const result = buildContract(servicePath, ast, {
        preset: 'none',
        sourceText: text,
      });

      expect(result.contract).toBeDefined();
      if (result.contract) {
        expect(result.contract.composition.functions).toContain('findAll');
        expect(result.contract.composition.functions).toContain('create');
      }
    });
  });

  describe('Dependency Graph - NestJS App', () => {
    it('should build dependency graph for NestJS app', async () => {
      const contracts: UIFContract[] = [];

      const files = [
        join(fixturesPath, 'app.module.ts'),
        join(fixturesPath, 'users/users.controller.ts'),
        join(fixturesPath, 'users/users.service.ts'),
        join(fixturesPath, 'posts/posts.controller.ts'),
        join(fixturesPath, 'posts/posts.service.ts'),
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

    it('should include controllers and services in dependency graph', async () => {
      const contracts: UIFContract[] = [];

      const files = [
        join(fixturesPath, 'users/users.controller.ts'),
        join(fixturesPath, 'users/users.service.ts'),
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

      const controllerFiles = Object.values(manifest.components).filter(c => 
        c.entryId.includes('controller')
      );
      const serviceFiles = Object.values(manifest.components).filter(c => 
        c.entryId.includes('service')
      );
      
      expect(controllerFiles.length).toBeGreaterThan(0);
      expect(serviceFiles.length).toBeGreaterThan(0);
    });
  });
});
