/**
 * Unit tests for core contractBuilder module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AstExtract } from '../../../src/core/astParser.js';
import type {
  UIFContract,
  StyleMetadata,
} from '../../../src/types/UIFContract.js';

// Mock dependencies
vi.mock('../../../src/core/signature.js', () => ({
  buildLogicSignature: vi.fn(),
  generateBehavioralPredictions: vi.fn(),
  inferDescription: vi.fn(),
}));

vi.mock('../../../src/utils/hash.js', () => ({
  semanticHashFromAst: vi.fn(),
  fileHash: vi.fn(),
}));

vi.mock('../../../src/utils/fsx.js', () => ({
  normalizeEntryId: vi.fn((id: string) => id.replace(/\\/g, '/')),
}));

// Import after mocks
import {
  buildContract,
  mergeContractUpdate,
} from '../../../src/core/contractBuilder.js';
import {
  buildLogicSignature,
  generateBehavioralPredictions,
  inferDescription,
} from '../../../src/core/signature.js';
import { semanticHashFromAst, fileHash } from '../../../src/utils/hash.js';
import { normalizeEntryId } from '../../../src/utils/fsx.js';

/**
 * Helper to create a mock AstExtract for testing
 */
function createMockAst(overrides?: Partial<AstExtract>): AstExtract {
  return {
    kind: 'react:component',
    variables: [],
    hooks: [],
    components: [],
    functions: [],
    props: {},
    state: {},
    emits: {},
    imports: [],
    jsxRoutes: [],
    ...overrides,
  };
}

/**
 * Helper to create a mock UIFContract for testing
 */
function createMockContract(overrides?: Partial<UIFContract>): UIFContract {
  return {
    type: 'UIFContract',
    schemaVersion: '0.4',
    kind: 'react:component',
    entryId: 'src/Component.tsx',
    description: 'Test component',
    composition: {
      variables: [],
      hooks: [],
      components: [],
      functions: [],
      imports: [],
    },
    interface: {
      props: {},
      emits: {},
    },
    semanticHash: 'semantic-hash',
    fileHash: 'file-hash',
    ...overrides,
  };
}

describe('core/contractBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set default mock implementations
    vi.mocked(buildLogicSignature).mockReturnValue({
      signature: { props: {}, emits: {} },
      prediction: [],
      violations: [],
    });
    vi.mocked(generateBehavioralPredictions).mockReturnValue([]);
    vi.mocked(inferDescription).mockReturnValue('Inferred description');
    vi.mocked(semanticHashFromAst).mockReturnValue('semantic-hash-123');
    vi.mocked(fileHash).mockReturnValue('file-hash-456');
  });

  describe('buildContract', () => {
    describe('basic contract building', () => {
      it('should build a basic contract from AST', () => {
        const ast = createMockAst({
          kind: 'react:component',
          variables: ['count'],
          hooks: ['useState'],
          components: ['Button'],
          functions: ['handleClick'],
          imports: ['react'],
        });

        const result = buildContract('src/App.tsx', ast, {
          preset: 'none',
          sourceText: 'const App = () => {}',
        });

        expect(result.contract).toBeDefined();
        expect(result.contract.type).toBe('UIFContract');
        expect(result.contract.schemaVersion).toBe('0.4');
        expect(result.contract.kind).toBe('react:component');
        expect(result.contract.entryId).toBe('src/App.tsx');
        expect(result.contract.composition.variables).toEqual(['count']);
        expect(result.contract.composition.hooks).toEqual(['useState']);
        expect(result.contract.composition.components).toEqual(['Button']);
        expect(result.contract.composition.functions).toEqual(['handleClick']);
        expect(result.contract.composition.imports).toEqual(['react']);
      });

      it('should use provided description when given', () => {
        const ast = createMockAst();

        const result = buildContract('src/App.tsx', ast, {
          description: 'Custom description',
          preset: 'none',
          sourceText: 'const App = () => {}',
        });

        expect(result.contract.description).toBe('Custom description');
        expect(inferDescription).not.toHaveBeenCalled();
      });

      it('should infer description when not provided', () => {
        const ast = createMockAst();

        const result = buildContract('src/App.tsx', ast, {
          preset: 'none',
          sourceText: 'const App = () => {}',
        });

        expect(result.contract.description).toBe('Inferred description');
        expect(inferDescription).toHaveBeenCalledWith('src/App.tsx', ast);
      });

      it('should return violations from buildLogicSignature', () => {
        vi.mocked(buildLogicSignature).mockReturnValue({
          signature: { props: {}, emits: {} },
          prediction: [],
          violations: ['Violation 1', 'Violation 2'],
        });

        const ast = createMockAst();
        const result = buildContract('src/App.tsx', ast, {
          preset: 'none',
          sourceText: 'const App = () => {}',
        });

        expect(result.violations).toEqual(['Violation 1', 'Violation 2']);
      });

      it('should normalize entry ID', () => {
        const ast = createMockAst();

        buildContract('src\\components\\Button.tsx', ast, {
          preset: 'none',
          sourceText: 'const Button = () => {}',
        });

        expect(normalizeEntryId).toHaveBeenCalledWith(
          'src\\components\\Button.tsx',
        );
      });
    });

    describe('predictions handling', () => {
      it('should not generate behavioral predictions when enablePredictions is false', () => {
        const ast = createMockAst();

        buildContract('src/App.tsx', ast, {
          preset: 'none',
          sourceText: 'const App = () => {}',
          enablePredictions: false,
        });

        expect(generateBehavioralPredictions).not.toHaveBeenCalled();
      });

      it('should not generate behavioral predictions when enablePredictions is undefined', () => {
        const ast = createMockAst();

        buildContract('src/App.tsx', ast, {
          preset: 'none',
          sourceText: 'const App = () => {}',
        });

        expect(generateBehavioralPredictions).not.toHaveBeenCalled();
      });

      it('should generate behavioral predictions when enablePredictions is true', () => {
        vi.mocked(generateBehavioralPredictions).mockReturnValue([
          'Includes form validation logic',
          'Has side effects managed by useEffect',
        ]);
        const ast = createMockAst();

        const result = buildContract('src/App.tsx', ast, {
          preset: 'none',
          sourceText: 'const App = () => {}',
          enablePredictions: true,
        });

        expect(generateBehavioralPredictions).toHaveBeenCalledWith(ast);
        expect(result.contract.prediction).toContain(
          'Includes form validation logic',
        );
        expect(result.contract.prediction).toContain(
          'Has side effects managed by useEffect',
        );
      });

      it('should combine preset predictions with behavioral predictions', () => {
        vi.mocked(buildLogicSignature).mockReturnValue({
          signature: { props: {}, emits: {} },
          prediction: ['Contract preset: submit-only'],
          violations: [],
        });
        vi.mocked(generateBehavioralPredictions).mockReturnValue([
          'Includes form validation logic',
        ]);
        const ast = createMockAst();

        const result = buildContract('src/App.tsx', ast, {
          preset: 'submit-only',
          sourceText: 'const App = () => {}',
          enablePredictions: true,
        });

        expect(result.contract.prediction).toContain(
          'Contract preset: submit-only',
        );
        expect(result.contract.prediction).toContain(
          'Includes form validation logic',
        );
      });

      it('should set prediction to undefined when no predictions exist', () => {
        vi.mocked(buildLogicSignature).mockReturnValue({
          signature: { props: {}, emits: {} },
          prediction: [],
          violations: [],
        });
        const ast = createMockAst();

        const result = buildContract('src/App.tsx', ast, {
          preset: 'none',
          sourceText: 'const App = () => {}',
        });

        expect(result.contract.prediction).toBeUndefined();
      });
    });

    describe('exports metadata extraction', () => {
      it('should use ast.exports when defined', () => {
        const ast = createMockAst({
          exports: { named: ['Component', 'helper'] },
        });

        const result = buildContract('src/App.tsx', ast, {
          preset: 'none',
          sourceText: 'export const Component = () => {}',
        });

        expect(result.contract.exports).toEqual({
          named: ['Component', 'helper'],
        });
      });

      it('should handle default export', () => {
        const ast = createMockAst({
          exports: 'default',
        });

        const result = buildContract('src/App.tsx', ast, {
          preset: 'none',
          sourceText: 'export default App',
        });

        expect(result.contract.exports).toBe('default');
      });

      it('should handle named export shorthand', () => {
        const ast = createMockAst({
          exports: 'named',
        });

        const result = buildContract('src/App.tsx', ast, {
          preset: 'none',
          sourceText: 'export const App = () => {}',
        });

        expect(result.contract.exports).toBe('named');
      });

      it('should fallback to named when exportedFunctions has single function', () => {
        const ast = createMockAst({
          exports: undefined,
          exportedFunctions: ['myFunction'],
        });

        const result = buildContract('src/utils.ts', ast, {
          preset: 'none',
          sourceText: 'export function myFunction() {}',
        });

        expect(result.contract.exports).toBe('named');
      });

      it('should fallback to named array when exportedFunctions has multiple functions', () => {
        const ast = createMockAst({
          exports: undefined,
          exportedFunctions: ['func1', 'func2', 'func3'],
        });

        const result = buildContract('src/utils.ts', ast, {
          preset: 'none',
          sourceText: 'export function func1() {} export function func2() {}',
        });

        expect(result.contract.exports).toEqual({
          named: ['func1', 'func2', 'func3'],
        });
      });

      it('should return undefined exports when no exports metadata available', () => {
        const ast = createMockAst({
          exports: undefined,
          exportedFunctions: undefined,
        });

        const result = buildContract('src/internal.ts', ast, {
          preset: 'none',
          sourceText: 'function internal() {}',
        });

        expect(result.contract.exports).toBeUndefined();
      });

      it('should return undefined exports when exportedFunctions is empty', () => {
        const ast = createMockAst({
          exports: undefined,
          exportedFunctions: [],
        });

        const result = buildContract('src/internal.ts', ast, {
          preset: 'none',
          sourceText: 'function internal() {}',
        });

        expect(result.contract.exports).toBeUndefined();
      });
    });

    describe('style metadata', () => {
      it('should attach style metadata when provided', () => {
        const styleMetadata: StyleMetadata = {
          styleSources: {
            tailwind: {
              categories: { layout: ['flex', 'items-center'] },
              classCount: 2,
            },
          },
          visual: {
            colors: ['blue-500', 'gray-100'],
          },
        };
        const ast = createMockAst();

        const result = buildContract('src/App.tsx', ast, {
          preset: 'none',
          sourceText: 'const App = () => {}',
          styleMetadata,
        });

        expect(result.contract.style).toEqual(styleMetadata);
      });

      it('should not include style when styleMetadata is undefined', () => {
        const ast = createMockAst();

        const result = buildContract('src/App.tsx', ast, {
          preset: 'none',
          sourceText: 'const App = () => {}',
        });

        expect(result.contract.style).toBeUndefined();
      });
    });

    describe('nextjs metadata', () => {
      it('should include nextjs metadata when present in AST', () => {
        const ast = createMockAst({
          nextjs: {
            isInAppDir: true,
            directive: 'client',
            routeRole: 'page',
            segmentPath: '/blog/[slug]',
          },
        });

        const result = buildContract('src/app/blog/[slug]/page.tsx', ast, {
          preset: 'none',
          sourceText: '"use client"',
        });

        expect(result.contract.nextjs).toEqual({
          isInAppDir: true,
          directive: 'client',
          routeRole: 'page',
          segmentPath: '/blog/[slug]',
        });
      });

      it('should not include nextjs when not in AST', () => {
        const ast = createMockAst();

        const result = buildContract('src/App.tsx', ast, {
          preset: 'none',
          sourceText: 'const App = () => {}',
        });

        expect(result.contract.nextjs).toBeUndefined();
      });
    });

    describe('language-specific metadata', () => {
      it('should include languageSpecific in composition when present', () => {
        const ast = createMockAst({
          kind: 'node:api',
          backend: {
            framework: 'express',
            languageSpecific: {
              decorators: ['@app.get', '@app.post'],
              classes: ['UserController'],
            },
          },
        });

        const result = buildContract('src/api/users.ts', ast, {
          preset: 'none',
          sourceText: 'app.get("/users", handler)',
        });

        expect(result.contract.composition.languageSpecific).toEqual({
          decorators: ['@app.get', '@app.post'],
          classes: ['UserController'],
        });
      });

      it('should not include languageSpecific when not present', () => {
        const ast = createMockAst({
          backend: {
            framework: 'express',
          },
        });

        const result = buildContract('src/api/users.ts', ast, {
          preset: 'none',
          sourceText: 'app.get("/users", handler)',
        });

        expect(result.contract.composition.languageSpecific).toBeUndefined();
      });
    });

    describe('hash generation', () => {
      it('should generate semantic hash from AST and signature', () => {
        const ast = createMockAst();
        const mockSignature = { props: { title: 'string' }, emits: {} };
        vi.mocked(buildLogicSignature).mockReturnValue({
          signature: mockSignature,
          prediction: [],
          violations: [],
        });

        buildContract('src/App.tsx', ast, {
          preset: 'none',
          sourceText: 'const App = () => {}',
        });

        expect(semanticHashFromAst).toHaveBeenCalledWith(ast, mockSignature);
      });

      it('should generate file hash from source text', () => {
        const ast = createMockAst();
        const sourceText = 'const App = () => { return <div>Hello</div>; }';

        buildContract('src/App.tsx', ast, {
          preset: 'none',
          sourceText,
        });

        expect(fileHash).toHaveBeenCalledWith(sourceText);
      });
    });
  });

  describe('mergeContractUpdate', () => {
    describe('description merging', () => {
      it('should preserve existing description when present', () => {
        const existing = createMockContract({
          description: 'Existing description',
        });
        const updated = createMockContract({
          description: 'Updated description',
        });

        const result = mergeContractUpdate(existing, updated);

        expect(result.description).toBe('Existing description');
      });

      it('should use updated description when existing is empty', () => {
        const existing = createMockContract({
          description: '',
        });
        const updated = createMockContract({
          description: 'Updated description',
        });

        const result = mergeContractUpdate(existing, updated);

        expect(result.description).toBe('Updated description');
      });
    });

    describe('kind handling', () => {
      it('should always use updated kind', () => {
        const existing = createMockContract({
          kind: 'react:component',
        });
        const updated = createMockContract({
          kind: 'react:hook',
        });

        const result = mergeContractUpdate(existing, updated);

        expect(result.kind).toBe('react:hook');
      });
    });

    describe('metrics merging', () => {
      it('should preserve existing metrics when present', () => {
        const existing = createMockContract({
          metrics: {
            a11y: { contrastMin: 4.5 },
            latency: { clientP95Ms: 100 },
          },
        });
        const updated = createMockContract({
          metrics: {
            coverage: { lines: 80 },
          },
        });

        const result = mergeContractUpdate(existing, updated);

        expect(result.metrics).toEqual({
          a11y: { contrastMin: 4.5 },
          latency: { clientP95Ms: 100 },
        });
      });

      it('should use updated metrics when existing is undefined', () => {
        const existing = createMockContract({
          metrics: undefined,
        });
        const updated = createMockContract({
          metrics: {
            coverage: { lines: 80 },
          },
        });

        const result = mergeContractUpdate(existing, updated);

        expect(result.metrics).toEqual({
          coverage: { lines: 80 },
        });
      });
    });

    describe('links merging', () => {
      it('should preserve existing links when present', () => {
        const existing = createMockContract({
          links: {
            figma: 'https://figma.com/file/123',
            spec: 'https://docs.example.com/button',
          },
        });
        const updated = createMockContract({
          links: {
            tokens: 'https://tokens.example.com',
          },
        });

        const result = mergeContractUpdate(existing, updated);

        expect(result.links).toEqual({
          figma: 'https://figma.com/file/123',
          spec: 'https://docs.example.com/button',
        });
      });

      it('should use updated links when existing is undefined', () => {
        const existing = createMockContract({
          links: undefined,
        });
        const updated = createMockContract({
          links: {
            tokens: 'https://tokens.example.com',
          },
        });

        const result = mergeContractUpdate(existing, updated);

        expect(result.links).toEqual({
          tokens: 'https://tokens.example.com',
        });
      });
    });

    describe('nextjs metadata merging', () => {
      it('should shallow merge nextjs when both exist', () => {
        const existing = createMockContract({
          nextjs: {
            isInAppDir: true,
            directive: 'client',
          },
        });
        const updated = createMockContract({
          nextjs: {
            routeRole: 'page',
            segmentPath: '/dashboard',
          },
        });

        const result = mergeContractUpdate(existing, updated);

        expect(result.nextjs).toEqual({
          isInAppDir: true,
          directive: 'client',
          routeRole: 'page',
          segmentPath: '/dashboard',
        });
      });

      it('should use updated nextjs when existing is undefined', () => {
        const existing = createMockContract({
          nextjs: undefined,
        });
        const updated = createMockContract({
          nextjs: {
            isInAppDir: true,
            routeRole: 'layout',
          },
        });

        const result = mergeContractUpdate(existing, updated);

        expect(result.nextjs).toEqual({
          isInAppDir: true,
          routeRole: 'layout',
        });
      });

      it('should preserve existing nextjs when updated is undefined', () => {
        const existing = createMockContract({
          nextjs: {
            isInAppDir: true,
            directive: 'server',
          },
        });
        const updated = createMockContract({
          nextjs: undefined,
        });

        const result = mergeContractUpdate(existing, updated);

        expect(result.nextjs).toEqual({
          isInAppDir: true,
          directive: 'server',
        });
      });
    });

    describe('usedIn handling', () => {
      it('should always set usedIn to undefined', () => {
        const existing = createMockContract({
          usedIn: ['src/Parent.tsx', 'src/Other.tsx'],
        });
        const updated = createMockContract({
          usedIn: ['src/New.tsx'],
        });

        const result = mergeContractUpdate(existing, updated);

        expect(result.usedIn).toBeUndefined();
      });
    });

    describe('other fields', () => {
      it('should use all other fields from updated contract', () => {
        const existing = createMockContract({
          entryId: 'src/Old.tsx',
          composition: {
            variables: ['old'],
            hooks: [],
            components: [],
            functions: [],
            imports: [],
          },
          interface: {
            props: { oldProp: 'string' },
            emits: {},
          },
          semanticHash: 'old-hash',
          fileHash: 'old-file-hash',
        });
        const updated = createMockContract({
          entryId: 'src/New.tsx',
          composition: {
            variables: ['new'],
            hooks: ['useState'],
            components: ['Button'],
            functions: ['handleClick'],
            imports: ['react'],
          },
          interface: {
            props: { newProp: 'number' },
            emits: { onClick: 'function' },
          },
          semanticHash: 'new-hash',
          fileHash: 'new-file-hash',
        });

        const result = mergeContractUpdate(existing, updated);

        expect(result.entryId).toBe('src/New.tsx');
        expect(result.composition).toEqual(updated.composition);
        expect(result.interface).toEqual(updated.interface);
        expect(result.semanticHash).toBe('new-hash');
        expect(result.fileHash).toBe('new-file-hash');
      });

      it('should preserve type and schemaVersion from updated', () => {
        const existing = createMockContract();
        const updated = createMockContract();

        const result = mergeContractUpdate(existing, updated);

        expect(result.type).toBe('UIFContract');
        expect(result.schemaVersion).toBe('0.4');
      });
    });
  });
});
