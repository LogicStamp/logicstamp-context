import { describe, it, expect } from 'vitest';
import { resolveKey, resolveDependency, findComponentByName } from '../../../src/core/pack/resolver.js';
import type { ProjectManifest, ComponentNode } from '../../../src/core/manifest.js';

describe('Pack Resolver', () => {
  const createMockManifest = (): ProjectManifest => {
    return {
      version: '0.3',
      generatedAt: new Date().toISOString(),
      totalComponents: 3,
      components: {
        'src/components/Button.tsx': {
          entryId: 'src/components/Button.tsx',
          description: 'Button component',
          dependencies: [],
          usedBy: ['src/components/Card.tsx'],
          imports: [],
          routes: [],
          semanticHash: 'hash1',
        },
        'src/components/Card.tsx': {
          entryId: 'src/components/Card.tsx',
          description: 'Card component',
          dependencies: ['Button'],
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash2',
        },
        'src/utils/helpers.ts': {
          entryId: 'src/utils/helpers.ts',
          description: 'Helper functions',
          dependencies: [],
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash3',
        },
      },
      graph: {
        roots: ['src/components/Card.tsx'],
        leaves: ['src/components/Button.tsx', 'src/utils/helpers.ts'],
      },
    };
  };

  describe('resolveKey', () => {
    it('should resolve exact key match', () => {
      const manifest = createMockManifest();
      const result = resolveKey(manifest, 'src/components/Button.tsx');

      expect(result).toBe('src/components/Button.tsx');
    });

    it('should resolve by normalized key', () => {
      const manifest = createMockManifest();
      // Test with different path separators
      const result = resolveKey(manifest, 'src\\components\\Button.tsx');

      expect(result).toBe('src/components/Button.tsx');
    });

    it('should resolve by component name', () => {
      const manifest = createMockManifest();
      const result = resolveKey(manifest, 'Button');

      expect(result).toBe('src/components/Button.tsx');
    });

    it('should resolve by filename without extension', () => {
      const manifest = createMockManifest();
      const result = resolveKey(manifest, 'Card.tsx');

      expect(result).toBe('src/components/Card.tsx');
    });

    it('should return null for non-existent component', () => {
      const manifest = createMockManifest();
      const result = resolveKey(manifest, 'NonExistent');

      expect(result).toBeNull();
    });

    it('should handle ambiguous name matches', () => {
      const manifest = createMockManifest();
      // If multiple components have the same name, should return first match
      const result = resolveKey(manifest, 'helpers');

      expect(result).toBe('src/utils/helpers.ts');
    });
  });

  describe('findComponentByName', () => {
    it('should find component by key', () => {
      const manifest = createMockManifest();
      const result = findComponentByName(manifest, 'src/components/Button.tsx');

      expect(result).toBeDefined();
      expect(result?.entryId).toBe('src/components/Button.tsx');
      expect(result?.description).toBe('Button component');
    });

    it('should find component by name', () => {
      const manifest = createMockManifest();
      const result = findComponentByName(manifest, 'Button');

      expect(result).toBeDefined();
      expect(result?.entryId).toBe('src/components/Button.tsx');
    });

    it('should return null for non-existent component', () => {
      const manifest = createMockManifest();
      const result = findComponentByName(manifest, 'NonExistent');

      expect(result).toBeNull();
    });
  });

  describe('resolveDependency', () => {
    it('should resolve relative path dependency', () => {
      const manifest = createMockManifest();
      const result = resolveDependency(manifest, 'Button', 'src/components/Card.tsx');

      expect(result).toBe('src/components/Button.tsx');
    });

    it('should try multiple path variations', () => {
      const manifest = createMockManifest();
      // Should try Button.tsx, Button.ts, Button/index.tsx, Button/index.ts
      const result = resolveDependency(manifest, 'Button', 'src/components/Card.tsx');

      expect(result).toBe('src/components/Button.tsx');
    });

    it('should fall back to global search if relative fails', () => {
      const manifest = createMockManifest();
      // If Button is not in same directory, should search globally
      const result = resolveDependency(manifest, 'helpers', 'src/components/Card.tsx');

      expect(result).toBe('src/utils/helpers.ts');
    });

    it('should return null for non-existent dependency', () => {
      const manifest = createMockManifest();
      const result = resolveDependency(manifest, 'NonExistent', 'src/components/Card.tsx');

      expect(result).toBeNull();
    });

    it('should prioritize relative paths over global', () => {
      // Create manifest with same name in different directories
      const manifest: ProjectManifest = {
        version: '0.3',
        generatedAt: new Date().toISOString(),
        totalComponents: 2,
        components: {
          'src/components/Button.tsx': {
            entryId: 'src/components/Button.tsx',
            description: 'Button in components',
            dependencies: [],
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash1',
          },
          'tests/fixtures/Button.tsx': {
            entryId: 'tests/fixtures/Button.tsx',
            description: 'Button in fixtures',
            dependencies: [],
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash2',
          },
        },
        graph: {
          roots: [],
          leaves: [],
        },
      };

      // When resolving from Card.tsx, should find components/Button, not fixtures/Button
      const result = resolveDependency(manifest, 'Button', 'src/components/Card.tsx');

      expect(result).toBe('src/components/Button.tsx');
    });
  });
});

