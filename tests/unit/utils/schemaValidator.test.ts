import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateUIFContract,
  isValidUIFContract,
  clearValidatorCache,
} from '../../../src/utils/schemaValidator.js';
import type { UIFContract } from '../../../src/types/UIFContract.js';

describe('schemaValidator', () => {
  beforeEach(() => {
    // Clear cache to ensure fresh state for each test
    clearValidatorCache();
  });

  // Helper to create a minimal valid contract
  function createValidContract(
    overrides: Partial<UIFContract> = {},
  ): UIFContract {
    return {
      type: 'UIFContract',
      schemaVersion: '0.4',
      kind: 'react:component',
      entryId: 'src/components/Button.tsx',
      description: 'A button component',
      composition: {
        variables: [],
        hooks: ['useState'],
        components: ['Icon'],
        functions: ['handleClick'],
      },
      interface: {
        props: { label: 'string', disabled: 'boolean' },
        emits: { onClick: 'function' },
      },
      semanticHash: 'uif:abcdef123456789012345678',
      fileHash: 'uif:123456789abcdef012345678',
      ...overrides,
    };
  }

  describe('validateUIFContract', () => {
    it('should validate a correct UIFContract', () => {
      const contract = createValidContract();
      const result = validateUIFContract(contract);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toEqual(contract);
    });

    it('should validate contract with optional fields', () => {
      const contract = createValidContract({
        usedIn: ['src/App.tsx', 'src/pages/Home.tsx'],
        prediction: ['renders button element', 'handles click events'],
        exports: 'default',
      });
      const result = validateUIFContract(contract);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate contract with style metadata (full mode)', () => {
      const contract = createValidContract({
        style: {
          styleSources: {
            tailwind: {
              categories: {
                layout: ['flex', 'items-center'],
                colors: ['bg-blue-500', 'text-white'],
              },
              classCount: 4,
            },
          },
          visual: {
            colors: ['blue-500', 'white'],
            spacing: ['p-4', 'px-2'],
          },
        },
      });
      const result = validateUIFContract(contract);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate contract with style metadata (lean mode)', () => {
      const contract = createValidContract({
        style: {
          styleSources: {
            tailwind: {
              categoriesUsed: ['layout', 'colors'],
              classCount: 4,
              breakpoints: ['md', 'lg'],
            },
            styledJsx: {
              global: true,
              selectorCount: 3,
              propertyCount: 5,
            },
            styledComponents: {
              componentCount: 2,
              usesTheme: true,
              usesCssProp: false,
            },
          },
          layout: {
            type: 'flex',
            sectionCount: 3,
          },
          visual: {
            colorCount: 5,
            spacingCount: 8,
            typographyCount: 2,
            radius: 'lg',
          },
          summary: {
            mode: 'lean',
            sources: ['tailwind', 'styled-jsx', 'styled-components'],
            fullModeBytes: 1234,
          },
        },
      });
      const result = validateUIFContract(contract);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate contract with nextjs metadata', () => {
      const contract = createValidContract({
        kind: 'react:component',
        nextjs: {
          isInAppDir: true,
          directive: 'client',
          routeRole: 'page',
          segmentPath: '/blog/[slug]',
        },
      });
      const result = validateUIFContract(contract);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject contract with missing required field "type"', () => {
      const contract = createValidContract();
      delete (contract as unknown as Record<string, unknown>).type;

      const result = validateUIFContract(contract);

      expect(result.valid).toBe(false);
      expect(result.data).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('type'))).toBe(true);
    });

    it('should reject contract with missing required field "schemaVersion"', () => {
      const contract = createValidContract();
      delete (contract as unknown as Record<string, unknown>).schemaVersion;

      const result = validateUIFContract(contract);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('schemaVersion'))).toBe(true);
    });

    it('should reject contract with wrong schemaVersion', () => {
      const contract = createValidContract({ schemaVersion: '0.3' as '0.4' });

      const result = validateUIFContract(contract);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) => e.includes('schemaVersion') || e.includes('0.4'),
        ),
      ).toBe(true);
    });

    it('should reject contract with wrong type value', () => {
      const contract = createValidContract({
        type: 'WrongType' as 'UIFContract',
      });

      const result = validateUIFContract(contract);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) => e.includes('type') || e.includes('UIFContract'),
        ),
      ).toBe(true);
    });

    it('should reject contract with missing composition', () => {
      const contract = createValidContract();
      delete (contract as unknown as Record<string, unknown>).composition;

      const result = validateUIFContract(contract);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('composition'))).toBe(true);
    });

    it('should reject contract with missing interface', () => {
      const contract = createValidContract();
      delete (contract as unknown as Record<string, unknown>).interface;

      const result = validateUIFContract(contract);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('interface'))).toBe(true);
    });

    it('should reject contract with invalid semanticHash format', () => {
      const contract = createValidContract({ semanticHash: 'invalid-hash' });

      const result = validateUIFContract(contract);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('semanticHash'))).toBe(true);
    });

    it('should reject contract with invalid fileHash format', () => {
      const contract = createValidContract({ fileHash: 'not-a-valid-hash' });

      const result = validateUIFContract(contract);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('fileHash'))).toBe(true);
    });

    it('should reject contract with additional unknown properties', () => {
      const contract = createValidContract();
      (contract as unknown as Record<string, unknown>).unknownProperty =
        'should not be here';

      const result = validateUIFContract(contract);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('unknownProperty'))).toBe(
        true,
      );
    });

    it('should reject non-object input', () => {
      const result = validateUIFContract('not an object');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject null input', () => {
      const result = validateUIFContract(null);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject empty object', () => {
      const result = validateUIFContract({});

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate all ContractKind values', () => {
      const kinds = [
        'react:component',
        'react:hook',
        'vue:component',
        'vue:composable',
        'ts:module',
        'node:cli',
        'node:api',
      ];

      for (const kind of kinds) {
        const contract = createValidContract({
          kind: kind as UIFContract['kind'],
        });
        const result = validateUIFContract(contract);
        expect(result.valid).toBe(true);
      }
    });

    it('should validate exports as string "default"', () => {
      const contract = createValidContract({ exports: 'default' });
      const result = validateUIFContract(contract);
      expect(result.valid).toBe(true);
    });

    it('should validate exports as string "named"', () => {
      const contract = createValidContract({ exports: 'named' });
      const result = validateUIFContract(contract);
      expect(result.valid).toBe(true);
    });

    it('should validate exports as object with named array', () => {
      const contract = createValidContract({
        exports: { named: ['Button', 'ButtonProps'] },
      });
      const result = validateUIFContract(contract);
      expect(result.valid).toBe(true);
    });
  });

  describe('isValidUIFContract', () => {
    it('should return true for valid contract', () => {
      const contract = createValidContract();
      expect(isValidUIFContract(contract)).toBe(true);
    });

    it('should return false for invalid contract', () => {
      expect(isValidUIFContract({})).toBe(false);
      expect(isValidUIFContract(null)).toBe(false);
      expect(isValidUIFContract({ type: 'Wrong' })).toBe(false);
    });

    it('should act as type guard', () => {
      const data: unknown = createValidContract();

      if (isValidUIFContract(data)) {
        // TypeScript should recognize data as UIFContract here
        expect(data.entryId).toBe('src/components/Button.tsx');
        expect(data.kind).toBe('react:component');
      } else {
        // This branch should not execute
        expect.fail('Expected valid contract');
      }
    });
  });

  describe('clearValidatorCache', () => {
    it('should not throw when called', () => {
      expect(() => clearValidatorCache()).not.toThrow();
    });

    it('should allow validation after clearing', () => {
      // Validate once to initialize
      validateUIFContract(createValidContract());

      // Clear cache
      clearValidatorCache();

      // Should still work
      const result = validateUIFContract(createValidContract());
      expect(result.valid).toBe(true);
    });
  });

  describe('error message formatting', () => {
    it('should provide readable error for missing required property', () => {
      const contract = createValidContract();
      delete (contract as unknown as Record<string, unknown>).entryId;

      const result = validateUIFContract(contract);

      expect(result.valid).toBe(false);
      // Should mention entryId is missing
      expect(result.errors.some((e) => e.includes('entryId'))).toBe(true);
    });

    it('should provide readable error for wrong type', () => {
      const contract = createValidContract();
      (contract as unknown as Record<string, unknown>).entryId = 12345; // Should be string

      const result = validateUIFContract(contract);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) => e.includes('entryId') || e.includes('string'),
        ),
      ).toBe(true);
    });

    it('should provide readable error for invalid enum value', () => {
      const contract = createValidContract({
        nextjs: {
          directive: 'invalid' as 'client',
        },
      });

      const result = validateUIFContract(contract);

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.includes('directive') ||
            e.includes('client') ||
            e.includes('server'),
        ),
      ).toBe(true);
    });
  });
});
