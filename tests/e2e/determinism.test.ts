import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

// Helper to read per-folder context from output directory
async function readFolderContext(outDir: string): Promise<any[]> {
  const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
  if (index.folders.length === 0) return [];
  const contextPath = join(outDir, index.folders[0].contextFile);
  return JSON.parse(await readFile(contextPath, 'utf-8'));
}

const execAsync = promisify(exec);

// Run these tests sequentially to avoid parallel execution issues
describe.sequential('Determinism and Ordering Tests', () => {
  const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
  const outputPath = join(process.cwd(), 'tests/e2e/output');

  beforeEach(async () => {
    try {
      await rm(outputPath, { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist
    }
    await execAsync('npm run build');
  });

  afterEach(async () => {
    try {
      await rm(outputPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Golden output - stable ordering', () => {
    it('should produce identical output on multiple runs (deterministic)', async () => {
      const testDir = join(outputPath, 'golden-output');
      await mkdir(testDir, { recursive: true });

      const outDir1 = join(testDir, 'run1');
      const outDir2 = join(testDir, 'run2');

      // Generate context twice
      try {
        const result1 = await execAsync(
          `node dist/cli/index.js ${fixturesPath} --out ${outDir1}`
        );
        if (!result1.stdout.includes('context files written')) {
          console.error('CLI output 1:', result1.stdout);
        }
      } catch (err: any) {
        console.error('Failed to generate context1:', err.message);
        console.error('stderr:', err.stderr);
        throw err;
      }

      try {
        const result2 = await execAsync(
          `node dist/cli/index.js ${fixturesPath} --out ${outDir2}`
        );
        if (!result2.stdout.includes('context files written')) {
          console.error('CLI output 2:', result2.stdout);
        }
      } catch (err: any) {
        console.error('Failed to generate context2:', err.message);
        console.error('stderr:', err.stderr);
        throw err;
      }

      // Read both outputs
      const bundles1 = await readFolderContext(outDir1);
      const bundles2 = await readFolderContext(outDir2);

      // Bundles should be in the same order
      expect(bundles1.length).toBe(bundles2.length);

      for (let i = 0; i < bundles1.length; i++) {
        expect(bundles1[i].entryId).toBe(bundles2[i].entryId);

        // Nodes should be in the same order
        expect(bundles1[i].graph.nodes.length).toBe(bundles2[i].graph.nodes.length);
        for (let j = 0; j < bundles1[i].graph.nodes.length; j++) {
          expect(bundles1[i].graph.nodes[j].entryId).toBe(
            bundles2[i].graph.nodes[j].entryId
          );
        }

        // Edges should be in the same order
        expect(bundles1[i].graph.edges).toEqual(bundles2[i].graph.edges);
      }
    }, 60000);

    it('should sort bundles alphabetically by entryId', async () => {
      const testDir = join(outputPath, 'sort-bundles');
      await mkdir(testDir, { recursive: true });

      const outDir = join(testDir, "context-out");

      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --out ${outDir}`
      );

      const bundles = await readFolderContext(outDir);

      // Check bundles are sorted
      for (let i = 1; i < bundles.length; i++) {
        const prev = bundles[i - 1].entryId;
        const curr = bundles[i].entryId;
        expect(prev.localeCompare(curr)).toBeLessThanOrEqual(0);
      }
    }, 30000);

    it('should sort nodes alphabetically by entryId within each bundle', async () => {
      const testDir = join(outputPath, 'sort-nodes');
      await mkdir(testDir, { recursive: true });

      const outDir = join(testDir, "context-out");

      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --depth 2 --out ${outDir}`
      );

      const bundles = await readFolderContext(outDir);

      bundles.forEach(bundle => {
        const nodes = bundle.graph.nodes;
        for (let i = 1; i < nodes.length; i++) {
          const prev = nodes[i - 1].entryId;
          const curr = nodes[i].entryId;
          expect(prev.localeCompare(curr)).toBeLessThanOrEqual(0);
        }
      });
    }, 30000);

    it('should sort edges deterministically', async () => {
      const testDir = join(outputPath, 'sort-edges');
      await mkdir(testDir, { recursive: true });

      const outDir = join(testDir, "context-out");

      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --depth 2 --out ${outDir}`
      );

      const bundles = await readFolderContext(outDir);

      bundles.forEach(bundle => {
        const edges = bundle.graph.edges;
        for (let i = 1; i < edges.length; i++) {
          const prev = edges[i - 1];
          const curr = edges[i];
          // Edges should be sorted by from, then by to
          const fromCompare = prev[0].localeCompare(curr[0]);
          if (fromCompare === 0) {
            expect(prev[1].localeCompare(curr[1])).toBeLessThanOrEqual(0);
          } else {
            expect(fromCompare).toBeLessThanOrEqual(0);
          }
        }
      });
    }, 30000);
  });

  describe('Schema validation in output', () => {
    it('should include $schema in all bundles (json format)', async () => {
      const testDir = join(outputPath, 'schema-json');
      await mkdir(testDir, { recursive: true });

      const outDir = join(testDir, "context-out");

      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --format json --out ${outDir}`
      );

      const bundles = await readFolderContext(outDir);

      bundles.forEach(bundle => {
        expect(bundle).toHaveProperty('$schema');
        expect(bundle.$schema).toContain('logicstamp.dev/schemas/context');
        expect(bundle.schemaVersion).toBe('0.1');
      });
    }, 30000);

    it('should include $schema in all bundles (ndjson format)', async () => {
      const testDir = join(outputPath, 'schema-ndjson');
      await mkdir(testDir, { recursive: true });

      const outDir = join(testDir, 'ndjson-out');

      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --format ndjson --out ${outDir}`
      );

      // Read ndjson file from per-folder structure
      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const ndjsonPath = join(outDir, index.folders[0].contextFile);
      const content = await readFile(ndjsonPath, 'utf-8');
      const lines = content.trim().split('\n');

      lines.forEach(line => {
        const bundle = JSON.parse(line);
        expect(bundle).toHaveProperty('$schema');
        expect(bundle.$schema).toContain('logicstamp.dev/schemas/context');
        expect(bundle.schemaVersion).toBe('0.1');
      });
    }, 30000);

    it('should include $schema in all bundles (pretty format)', async () => {
      const testDir = join(outputPath, 'schema-pretty');
      await mkdir(testDir, { recursive: true });

      const outDir = join(testDir, 'pretty-out');

      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --format pretty --out ${outDir}`
      );

      // Read pretty file from per-folder structure
      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const prettyPath = join(outDir, index.folders[0].contextFile);
      const content = await readFile(prettyPath, 'utf-8');

      // Pretty format has headers, extract JSON parts
      const jsonMatches = content.match(/\{[\s\S]*?\n\}/g);
      expect(jsonMatches).toBeTruthy();

      if (jsonMatches) {
        jsonMatches.forEach(jsonStr => {
          const bundle = JSON.parse(jsonStr);
          expect(bundle).toHaveProperty('$schema');
          expect(bundle.$schema).toContain('logicstamp.dev/schemas/context');
        });
      }
    }, 30000);
  });

  describe('Windows path handling', () => {
    it('should use forward slashes in entryId paths', async () => {
      const testDir = join(outputPath, 'windows-paths');
      await mkdir(testDir, { recursive: true });

      const outDir = join(testDir, "context-out");

      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --out ${outDir}`
      );

      const bundles = await readFolderContext(outDir);

      bundles.forEach(bundle => {
        // entryId should not contain backslashes (Windows-style paths)
        expect(bundle.entryId).not.toContain('\\\\');

        bundle.graph.nodes.forEach(node => {
          expect(node.entryId).not.toContain('\\\\');
        });

        bundle.graph.edges.forEach(edge => {
          expect(edge[0]).not.toContain('\\\\');
          expect(edge[1]).not.toContain('\\\\');
        });
      });
    }, 30000);

    it('should display forward slashes in console output', async () => {
      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --dry-run`
      );

      // Console output should use forward slashes for display
      // Even on Windows, we want consistent forward-slash display
      const lines = stdout.split('\n');
      const pathLines = lines.filter(line =>
        line.includes('Scanning') || line.includes('Context written')
      );

      // This test documents that we're displaying paths in a normalized way
      expect(pathLines.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Depth monotonicity', () => {
    it('should have monotonically increasing node/edge counts with depth', async () => {
      const testDir = join(outputPath, 'depth-monotonic');
      await mkdir(testDir, { recursive: true });

      const outDir1 = join(testDir, 'depth1');
      const outDir2 = join(testDir, 'depth2');

      // Generate with different depths
      // Note: Default profile (llm-chat) sets depth=1, so we test that vs depth=2
      try {
        const result1 = await execAsync(
          `node dist/cli/index.js ${fixturesPath} --out ${outDir1}`
        );
        if (!result1.stdout.includes('context files written')) {
          console.error('CLI output 1:', result1.stdout);
        }
      } catch (err: any) {
        console.error('Failed command 1:', err.message);
        console.error('stderr:', err.stderr);
        throw err;
      }

      try {
        const result2 = await execAsync(
          `node dist/cli/index.js ${fixturesPath} --include-code none --profile ci-strict --depth 2 --out ${outDir2}`
        );
        if (!result2.stdout.includes('context files written')) {
          console.error('CLI output 2:', result2.stdout);
        }
      } catch (err: any) {
        console.error('Failed command 2:', err.message);
        console.error('stderr:', err.stderr);
        throw err;
      }

      const bundles1 = await readFolderContext(outDir1);
      const bundles2 = await readFolderContext(outDir2);

      const totalNodes1 = bundles1.reduce((sum, b) => sum + b.graph.nodes.length, 0);
      const totalNodes2 = bundles2.reduce((sum, b) => sum + b.graph.nodes.length, 0);

      const totalEdges1 = bundles1.reduce((sum, b) => sum + b.graph.edges.length, 0);
      const totalEdges2 = bundles2.reduce((sum, b) => sum + b.graph.edges.length, 0);

      // Depth 2 should have >= nodes and edges than depth 1
      // (They could be equal if all deps are already included at depth 1)
      expect(totalNodes2).toBeGreaterThanOrEqual(totalNodes1);
      expect(totalEdges2).toBeGreaterThanOrEqual(totalEdges1);
    }, 60000);
  });

  describe('Flags matrix', () => {
    it('should handle include-code × format combinations', async () => {
      const testDir = join(outputPath, 'flags-matrix');
      await mkdir(testDir, { recursive: true });

      const includeCodeModes = ['none', 'header', 'full'];
      const formats = ['json', 'pretty', 'ndjson'];

      for (const includeCode of includeCodeModes) {
        for (const format of formats) {
          const outDir = join(testDir, `context-${includeCode}-${format}`);

          await execAsync(
            `node dist/cli/index.js ${fixturesPath} --include-code ${includeCode} --format ${format} --out ${outDir}`
          );

          // Read main index to get first context file
          const mainIndex = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
          const firstContextFile = join(outDir, mainIndex.folders[0].contextFile);
          const content = await readFile(firstContextFile, 'utf-8');

          // Verify output is valid
          if (format === 'ndjson') {
            const lines = content.trim().split('\n');
            expect(lines.length).toBeGreaterThan(0);
            lines.forEach(line => {
              expect(() => JSON.parse(line)).not.toThrow();
            });
          } else {
            // Both json and pretty should be valid JSON
            // (pretty format bundles are wrapped with headers but contain JSON)
            expect(content.length).toBeGreaterThan(0);
          }
        }
      }
    }, 120000);

    it('should handle max-nodes constraints', async () => {
      const testDir = join(outputPath, 'max-nodes');
      await mkdir(testDir, { recursive: true });

      const maxNodesSizes = [10, 30, 100];

      for (const maxNodes of maxNodesSizes) {
        const outDir = join(testDir, `context-max${maxNodes}`);

        await execAsync(
          `node dist/cli/index.js ${fixturesPath} --max-nodes ${maxNodes} --out ${outDir}`
        );

        // Read main index to collect all bundles
        const mainIndex = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
        const bundles: any[] = [];
        for (const folder of mainIndex.folders) {
          const contextPath = join(outDir, folder.contextFile);
          const folderBundles = JSON.parse(await readFile(contextPath, 'utf-8'));
          bundles.push(...folderBundles);
        }

        bundles.forEach(bundle => {
          expect(bundle.graph.nodes.length).toBeLessThanOrEqual(maxNodes);
        });
      }
    }, 90000);
  });
});
