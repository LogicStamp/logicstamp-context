import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import {
  resolveKey,
  resolveDependency,
  findComponentByName,
} from '../../../src/core/pack/resolver.js';
import type { ProjectManifest } from '../../../src/core/manifest.js';
import type { TsconfigResolverContext } from '../../../src/core/pack/tsconfigResolver.js';
import { normalizeEntryId } from '../../../src/utils/fsx.js';

describe('Pack Resolver', () => {
  const repoRoot = normalizeEntryId(resolve('/repo'));

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
      const result = resolveDependency(
        manifest,
        'Button',
        'src/components/Card.tsx',
      );

      expect(result).toBe('src/components/Button.tsx');
    });

    it('should try multiple path variations', () => {
      const manifest = createMockManifest();
      // Should try Button.tsx, Button.ts, Button/index.tsx, Button/index.ts
      const result = resolveDependency(
        manifest,
        'Button',
        'src/components/Card.tsx',
      );

      expect(result).toBe('src/components/Button.tsx');
    });

    it('should fall back to global search if relative fails', () => {
      const manifest = createMockManifest();
      // If Button is not in same directory, should search globally
      const result = resolveDependency(
        manifest,
        'helpers',
        'src/components/Card.tsx',
      );

      expect(result).toBe('src/utils/helpers.ts');
    });

    it('should return null for non-existent dependency', () => {
      const manifest = createMockManifest();
      const result = resolveDependency(
        manifest,
        'NonExistent',
        'src/components/Card.tsx',
      );

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
      const result = resolveDependency(
        manifest,
        'Button',
        'src/components/Card.tsx',
      );

      expect(result).toBe('src/components/Button.tsx');
    });

    it('should handle Windows-style backslash path separators in parentId', () => {
      const manifest = createMockManifest();
      // On Windows, parentId might contain backslashes - should still resolve correctly
      const result = resolveDependency(
        manifest,
        'Button',
        'src\\components\\Card.tsx',
      );

      expect(result).toBe('src/components/Button.tsx');
    });

    it('should resolve exact tsconfig path aliases', () => {
      const manifest: ProjectManifest = {
        version: '0.3',
        generatedAt: new Date().toISOString(),
        totalComponents: 2,
        components: {
          'apps/web/src/App.tsx': {
            entryId: 'apps/web/src/App.tsx',
            description: 'App',
            dependencies: [],
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash-app',
          },
          'packages/ui/src/index.ts': {
            entryId: 'packages/ui/src/index.ts',
            description: 'UI package entry',
            dependencies: [],
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash-ui',
          },
        },
        graph: { roots: [], leaves: [] },
      };

      const resolverContext: TsconfigResolverContext = {
        projectRoot: repoRoot,
        configs: [
          {
            tsconfigPath: 'tsconfig.base.json',
            configDirAbs: repoRoot,
            baseUrlAbs: repoRoot,
            pathMappings: [
              {
                pattern: '@repo/ui',
                hasWildcard: false,
                prefix: '@repo/ui',
                suffix: '',
                targets: ['packages/ui/src/index.ts'],
                baseUrlAbs: repoRoot,
                sourceTsconfig: `${repoRoot}/tsconfig.base.json`,
              },
            ],
          },
        ],
        pathMappings: [
          {
            pattern: '@repo/ui',
            hasWildcard: false,
            prefix: '@repo/ui',
            suffix: '',
            targets: ['packages/ui/src/index.ts'],
            baseUrlAbs: repoRoot,
            sourceTsconfig: `${repoRoot}/tsconfig.base.json`,
          },
        ],
        baseUrlsAbs: [repoRoot],
        tsconfigFiles: ['tsconfig.base.json'],
      };

      const result = resolveDependency(
        manifest,
        '@repo/ui',
        'apps/web/src/App.tsx',
        resolverContext,
      );
      expect(result).toBe('packages/ui/src/index.ts');
    });

    it('should resolve wildcard tsconfig path aliases', () => {
      const manifest: ProjectManifest = {
        version: '0.3',
        generatedAt: new Date().toISOString(),
        totalComponents: 2,
        components: {
          'apps/web/src/App.tsx': {
            entryId: 'apps/web/src/App.tsx',
            description: 'App',
            dependencies: [],
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash-app',
          },
          'packages/shared/src/date.ts': {
            entryId: 'packages/shared/src/date.ts',
            description: 'Shared date utility',
            dependencies: [],
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash-date',
          },
        },
        graph: { roots: [], leaves: [] },
      };

      const resolverContext: TsconfigResolverContext = {
        projectRoot: repoRoot,
        configs: [
          {
            tsconfigPath: 'tsconfig.base.json',
            configDirAbs: repoRoot,
            baseUrlAbs: repoRoot,
            pathMappings: [
              {
                pattern: '@repo/shared/*',
                hasWildcard: true,
                prefix: '@repo/shared/',
                suffix: '',
                targets: ['packages/shared/src/*'],
                baseUrlAbs: repoRoot,
                sourceTsconfig: `${repoRoot}/tsconfig.base.json`,
              },
            ],
          },
        ],
        pathMappings: [
          {
            pattern: '@repo/shared/*',
            hasWildcard: true,
            prefix: '@repo/shared/',
            suffix: '',
            targets: ['packages/shared/src/*'],
            baseUrlAbs: repoRoot,
            sourceTsconfig: `${repoRoot}/tsconfig.base.json`,
          },
        ],
        baseUrlsAbs: [repoRoot],
        tsconfigFiles: ['tsconfig.base.json'],
      };

      const result = resolveDependency(
        manifest,
        '@repo/shared/date',
        'apps/web/src/App.tsx',
        resolverContext,
      );
      expect(result).toBe('packages/shared/src/date.ts');
    });

    it('should scope tsconfig aliases to the importing file', () => {
      const manifest: ProjectManifest = {
        version: '0.3',
        generatedAt: new Date().toISOString(),
        totalComponents: 4,
        components: {
          'apps/web/src/App.tsx': {
            entryId: 'apps/web/src/App.tsx',
            description: 'Web app',
            dependencies: [],
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash-web-app',
          },
          'apps/admin/src/App.tsx': {
            entryId: 'apps/admin/src/App.tsx',
            description: 'Admin app',
            dependencies: [],
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash-admin-app',
          },
          'packages/web-shared/src/button.ts': {
            entryId: 'packages/web-shared/src/button.ts',
            description: 'Web shared button',
            dependencies: [],
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash-web-button',
          },
          'packages/admin-shared/src/button.ts': {
            entryId: 'packages/admin-shared/src/button.ts',
            description: 'Admin shared button',
            dependencies: [],
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash-admin-button',
          },
        },
        graph: { roots: [], leaves: [] },
      };

      const webMapping = {
        pattern: '@shared/*',
        hasWildcard: true,
        prefix: '@shared/',
        suffix: '',
        targets: ['packages/web-shared/src/*'],
        baseUrlAbs: repoRoot,
        sourceTsconfig: `${repoRoot}/apps/web/tsconfig.json`,
      };
      const adminMapping = {
        pattern: '@shared/*',
        hasWildcard: true,
        prefix: '@shared/',
        suffix: '',
        targets: ['packages/admin-shared/src/*'],
        baseUrlAbs: repoRoot,
        sourceTsconfig: `${repoRoot}/apps/admin/tsconfig.json`,
      };

      const resolverContext: TsconfigResolverContext = {
        projectRoot: repoRoot,
        configs: [
          {
            tsconfigPath: 'apps/web/tsconfig.json',
            configDirAbs: `${repoRoot}/apps/web`,
            baseUrlAbs: repoRoot,
            pathMappings: [webMapping],
          },
          {
            tsconfigPath: 'apps/admin/tsconfig.json',
            configDirAbs: `${repoRoot}/apps/admin`,
            baseUrlAbs: repoRoot,
            pathMappings: [adminMapping],
          },
        ],
        pathMappings: [webMapping, adminMapping],
        baseUrlsAbs: [repoRoot],
        tsconfigFiles: ['apps/admin/tsconfig.json', 'apps/web/tsconfig.json'],
      };

      expect(
        resolveDependency(
          manifest,
          '@shared/button',
          'apps/web/src/App.tsx',
          resolverContext,
        ),
      ).toBe('packages/web-shared/src/button.ts');

      expect(
        resolveDependency(
          manifest,
          '@shared/button',
          'apps/admin/src/App.tsx',
          resolverContext,
        ),
      ).toBe('packages/admin-shared/src/button.ts');
    });
  });
});
