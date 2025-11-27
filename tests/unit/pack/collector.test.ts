import { describe, it, expect } from 'vitest';
import { collectDependencies } from '../../../src/core/pack/collector.js';
import type { ProjectManifest } from '../../../src/core/manifest.js';

describe('Pack Collector', () => {
  const createMockManifest = (): ProjectManifest => {
    return {
      version: '0.3',
      generatedAt: new Date().toISOString(),
      totalComponents: 4,
      components: {
        'src/App.tsx': {
          entryId: 'src/App.tsx',
          description: 'App component',
          dependencies: ['Card'],
          usedBy: [],
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
        'src/components/Button.tsx': {
          entryId: 'src/components/Button.tsx',
          description: 'Button component',
          dependencies: [],
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash3',
        },
        'src/utils/helpers.ts': {
          entryId: 'src/utils/helpers.ts',
          description: 'Helper functions',
          dependencies: [],
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash4',
        },
      },
      graph: {
        roots: ['src/App.tsx'],
        leaves: ['src/components/Button.tsx', 'src/utils/helpers.ts'],
      },
    };
  };

  describe('collectDependencies', () => {
    it('should collect dependencies with BFS', () => {
      const manifest = createMockManifest();
      const result = collectDependencies('src/App.tsx', manifest, 2, 100);

      expect(result.visited.has('src/App.tsx')).toBe(true);
      expect(result.visited.has('src/components/Card.tsx')).toBe(true);
      expect(result.visited.has('src/components/Button.tsx')).toBe(true);
      expect(result.visited.size).toBe(3);
    });

    it('should respect depth limit', () => {
      const manifest = createMockManifest();
      const result = collectDependencies('src/App.tsx', manifest, 0, 100);

      // Depth 0 should only include the entry point
      expect(result.visited.size).toBe(1);
      expect(result.visited.has('src/App.tsx')).toBe(true);
      expect(result.visited.has('src/components/Card.tsx')).toBe(false);
    });

    it('should respect maxNodes limit', () => {
      const manifest = createMockManifest();
      const result = collectDependencies('src/App.tsx', manifest, 10, 2);

      // Should stop at maxNodes even if depth allows more
      expect(result.visited.size).toBeLessThanOrEqual(2);
    });

    it('should track missing dependencies', () => {
      const manifest: ProjectManifest = {
        version: '0.3',
        generatedAt: new Date().toISOString(),
        totalComponents: 1,
        components: {
          'src/App.tsx': {
            entryId: 'src/App.tsx',
            description: 'App component',
            dependencies: ['NonExistent', 'AnotherMissing'],
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash1',
          },
        },
        graph: {
          roots: ['src/App.tsx'],
          leaves: [],
        },
      };

      const result = collectDependencies('src/App.tsx', manifest, 2, 100);

      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing.some(m => m.name === 'NonExistent')).toBe(true);
    });

    it('should handle entry point not in manifest', () => {
      const manifest = createMockManifest();
      const result = collectDependencies('NonExistent.tsx', manifest, 2, 100);

      expect(result.visited.size).toBe(0);
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing[0].name).toBe('NonExistent.tsx');
    });

    it('should not visit same node twice', () => {
      const manifest: ProjectManifest = {
        version: '0.3',
        generatedAt: new Date().toISOString(),
        totalComponents: 2,
        components: {
          'src/App.tsx': {
            entryId: 'src/App.tsx',
            description: 'App component',
            dependencies: ['Button'],
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash1',
          },
          'src/components/Button.tsx': {
            entryId: 'src/components/Button.tsx',
            description: 'Button component',
            dependencies: ['Button'], // Circular reference
            usedBy: [],
            imports: [],
            routes: [],
            semanticHash: 'hash2',
          },
        },
        graph: {
          roots: ['src/App.tsx'],
          leaves: [],
        },
      };

      const result = collectDependencies('src/App.tsx', manifest, 10, 100);

      // Button should only be visited once despite circular reference
      const buttonVisits = Array.from(result.visited).filter(id => id.includes('Button'));
      expect(buttonVisits.length).toBe(1);
    });

    it('should handle empty manifest', () => {
      const manifest: ProjectManifest = {
        version: '0.3',
        generatedAt: new Date().toISOString(),
        totalComponents: 0,
        components: {},
        graph: {
          roots: [],
          leaves: [],
        },
      };

      const result = collectDependencies('src/App.tsx', manifest, 2, 100);

      expect(result.visited.size).toBe(0);
      expect(result.missing.length).toBeGreaterThan(0);
    });
  });
});

