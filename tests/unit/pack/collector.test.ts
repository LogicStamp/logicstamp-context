import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { collectDependencies } from '../../../src/core/pack/collector.js';
import type { ProjectManifest } from '../../../src/core/manifest.js';
import { clearPackageJsonCache } from '../../../src/core/pack/packageInfo.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Pack Collector', () => {
  let testProjectRoot: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testProjectRoot = join(tmpdir(), `logicstamp-collector-test-${Date.now()}`);
    await mkdir(testProjectRoot, { recursive: true });
    clearPackageJsonCache();
  });

  afterEach(() => {
    clearPackageJsonCache();
  });

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
    it('should collect dependencies with BFS', async () => {
      const manifest = createMockManifest();
      const result = await collectDependencies('src/App.tsx', manifest, 2, 100);

      expect(result.visited.has('src/App.tsx')).toBe(true);
      expect(result.visited.has('src/components/Card.tsx')).toBe(true);
      expect(result.visited.has('src/components/Button.tsx')).toBe(true);
      expect(result.visited.size).toBe(3);
    });

    it('should respect depth limit', async () => {
      const manifest = createMockManifest();
      const result = await collectDependencies('src/App.tsx', manifest, 0, 100);

      // Depth 0 should only include the entry point
      expect(result.visited.size).toBe(1);
      expect(result.visited.has('src/App.tsx')).toBe(true);
      expect(result.visited.has('src/components/Card.tsx')).toBe(false);
    });

    it('should respect maxNodes limit', async () => {
      const manifest = createMockManifest();
      const result = await collectDependencies('src/App.tsx', manifest, 10, 2);

      // Should stop at maxNodes even if depth allows more
      expect(result.visited.size).toBeLessThanOrEqual(2);
    });

    it('should track missing dependencies', async () => {
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

      const result = await collectDependencies('src/App.tsx', manifest, 2, 100);

      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing.some(m => m.name === 'NonExistent')).toBe(true);
    });

    it('should handle entry point not in manifest', async () => {
      const manifest = createMockManifest();
      const result = await collectDependencies('NonExistent.tsx', manifest, 2, 100);

      expect(result.visited.size).toBe(0);
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing[0].name).toBe('NonExistent.tsx');
    });

    it('should not visit same node twice', async () => {
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

      const result = await collectDependencies('src/App.tsx', manifest, 10, 100);

      // Button should only be visited once despite circular reference
      const buttonVisits = Array.from(result.visited).filter(id => id.includes('Button'));
      expect(buttonVisits.length).toBe(1);
    });

    it('should handle empty manifest', async () => {
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

      const result = await collectDependencies('src/App.tsx', manifest, 2, 100);

      expect(result.visited.size).toBe(0);
      expect(result.missing.length).toBeGreaterThan(0);
    });

    describe('package info enhancement', () => {
      it('should populate packageName and version for third-party packages', async () => {
        // Create a package.json with dependencies
        const packageJson = {
          dependencies: {
            'react': '^18.2.0',
            '@mui/material': '^5.15.0',
          },
        };
        await writeFile(
          join(testProjectRoot, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        );

        const manifest: ProjectManifest = {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 1,
          components: {
            'src/App.tsx': {
              entryId: 'src/App.tsx',
              description: 'App component',
              dependencies: ['react', '@mui/material'],
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

        const result = await collectDependencies('src/App.tsx', manifest, 2, 100, testProjectRoot);

        expect(result.missing.length).toBeGreaterThan(0);
        
        const reactDep = result.missing.find(m => m.name === 'react');
        expect(reactDep).toBeDefined();
        expect(reactDep?.packageName).toBe('react');
        expect(reactDep?.version).toBe('^18.2.0');

        const muiDep = result.missing.find(m => m.name === '@mui/material');
        expect(muiDep).toBeDefined();
        expect(muiDep?.packageName).toBe('@mui/material');
        expect(muiDep?.version).toBe('^5.15.0');
      });

      it('should not populate package info for relative imports', async () => {
        const packageJson = {
          dependencies: {
            'react': '^18.2.0',
          },
        };
        await writeFile(
          join(testProjectRoot, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        );

        const manifest: ProjectManifest = {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 1,
          components: {
            'src/App.tsx': {
              entryId: 'src/App.tsx',
              description: 'App component',
              dependencies: ['./Component', '../utils'],
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

        const result = await collectDependencies('src/App.tsx', manifest, 2, 100, testProjectRoot);

        expect(result.missing.length).toBeGreaterThan(0);
        
        const relativeDep = result.missing.find(m => m.name === './Component');
        expect(relativeDep).toBeDefined();
        expect(relativeDep?.packageName).toBeUndefined();
        expect(relativeDep?.version).toBeUndefined();
      });

      it('should handle subpath imports correctly', async () => {
        const packageJson = {
          dependencies: {
            '@mui/material': '^5.15.0',
          },
        };
        await writeFile(
          join(testProjectRoot, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        );

        const manifest: ProjectManifest = {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 1,
          components: {
            'src/App.tsx': {
              entryId: 'src/App.tsx',
              description: 'App component',
              dependencies: ['@mui/material/Button'],
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

        const result = await collectDependencies('src/App.tsx', manifest, 2, 100, testProjectRoot);

        const muiDep = result.missing.find(m => m.name === '@mui/material/Button');
        expect(muiDep).toBeDefined();
        expect(muiDep?.packageName).toBe('@mui/material');
        expect(muiDep?.version).toBe('^5.15.0');
      });

      it('should handle missing package.json gracefully', async () => {
        const manifest: ProjectManifest = {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 1,
          components: {
            'src/App.tsx': {
              entryId: 'src/App.tsx',
              description: 'App component',
              dependencies: ['react'],
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

        // Use a path without package.json
        const result = await collectDependencies('src/App.tsx', manifest, 2, 100, '/nonexistent/path');

        const reactDep = result.missing.find(m => m.name === 'react');
        expect(reactDep).toBeDefined();
        expect(reactDep?.packageName).toBe('react');
        expect(reactDep?.version).toBeUndefined(); // No package.json, so no version
      });

      it('should not populate package info when projectRoot is not provided', async () => {
        const manifest: ProjectManifest = {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 1,
          components: {
            'src/App.tsx': {
              entryId: 'src/App.tsx',
              description: 'App component',
              dependencies: ['react'],
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

        // Don't provide projectRoot
        const result = await collectDependencies('src/App.tsx', manifest, 2, 100);

        const reactDep = result.missing.find(m => m.name === 'react');
        expect(reactDep).toBeDefined();
        expect(reactDep?.packageName).toBeUndefined();
        expect(reactDep?.version).toBeUndefined();
      });

      it('should handle entry point as third-party package', async () => {
        const packageJson = {
          dependencies: {
            'react': '^18.2.0',
          },
        };
        await writeFile(
          join(testProjectRoot, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        );

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

        // Entry point is a third-party package
        const result = await collectDependencies('react', manifest, 2, 100, testProjectRoot);

        expect(result.visited.size).toBe(0);
        expect(result.missing.length).toBeGreaterThan(0);
        
        const reactDep = result.missing.find(m => m.name === 'react');
        expect(reactDep).toBeDefined();
        expect(reactDep?.packageName).toBe('react');
        expect(reactDep?.version).toBe('^18.2.0');
      });

      it('should check devDependencies and peerDependencies', async () => {
        const packageJson = {
          devDependencies: {
            'typescript': '^5.3.0',
          },
          peerDependencies: {
            'react': '^18.0.0',
          },
        };
        await writeFile(
          join(testProjectRoot, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        );

        const manifest: ProjectManifest = {
          version: '0.3',
          generatedAt: new Date().toISOString(),
          totalComponents: 1,
          components: {
            'src/App.tsx': {
              entryId: 'src/App.tsx',
              description: 'App component',
              dependencies: ['typescript', 'react'],
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

        const result = await collectDependencies('src/App.tsx', manifest, 2, 100, testProjectRoot);

        const tsDep = result.missing.find(m => m.name === 'typescript');
        expect(tsDep?.version).toBe('^5.3.0');

        const reactDep = result.missing.find(m => m.name === 'react');
        expect(reactDep?.version).toBe('^18.0.0');
      });
    });
  });
});

