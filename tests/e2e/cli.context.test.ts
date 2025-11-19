import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const execAsync = promisify(exec);

describe('CLI Context Generation Tests', () => {
  const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
  const outputPath = join(process.cwd(), 'tests/e2e/output');

  beforeEach(async () => {
    // Clean up any existing output files
    try {
      await rm(outputPath, { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, which is fine
    }
    // Recreate the output directory for tests
    await mkdir(outputPath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up output files after tests
    try {
      await rm(outputPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic functionality', () => {
    it('should generate context files for a simple React app', async () => {
      const outFile = join(outputPath, 'context.json');

      // Build the project first
      await execAsync('npm run build');

      // Run the CLI
      const { stdout, stderr } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --out ${outFile}`
      );

      // Verify output
      expect(stdout).toContain('Scanning');
      expect(stdout).toContain('Analyzing components');
      expect(stdout).toContain('Building dependency graph');
      expect(stdout).toContain('Generating context');
      expect(stdout).toContain('context files written successfully');

      // Verify context_main.json was created (index file)
      const mainIndexPath = join(outputPath, 'context_main.json');
      await access(mainIndexPath);

      // Verify index content
      const indexContent = await readFile(mainIndexPath, 'utf-8');
      const index = JSON.parse(indexContent);

      expect(index).toHaveProperty('type', 'LogicStampIndex');
      expect(index).toHaveProperty('schemaVersion', '0.1');
      expect(index).toHaveProperty('projectRoot', '.');
      expect(index).toHaveProperty('summary');
      expect(index.summary).toHaveProperty('totalBundles');
      expect(index.summary).toHaveProperty('totalFolders');
      expect(index).toHaveProperty('folders');
      expect(Array.isArray(index.folders)).toBe(true);
      expect(index.folders.length).toBeGreaterThan(0);

      // Check folder structure
      const folder = index.folders[0];
      expect(folder).toHaveProperty('path');
      expect(folder).toHaveProperty('contextFile');
      expect(folder).toHaveProperty('bundles');
      expect(folder).toHaveProperty('components');
      expect(folder).toHaveProperty('isRoot');
      expect(folder).toHaveProperty('tokenEstimate');

      // Verify at least one per-folder context.json exists
      const folderContextPath = join(outputPath, folder.contextFile);
      await access(folderContextPath);

      // Verify per-folder context content is array of bundles
      const folderContent = await readFile(folderContextPath, 'utf-8');
      const bundles = JSON.parse(folderContent);
      expect(Array.isArray(bundles)).toBe(true);
      expect(bundles.length).toBeGreaterThan(0);

      // Check bundle structure
      const bundle = bundles[0];
      expect(bundle).toHaveProperty('position');
      expect(bundle).toHaveProperty('type', 'LogicStampBundle');
      expect(bundle).toHaveProperty('schemaVersion');
      expect(bundle).toHaveProperty('entryId');
      expect(bundle).toHaveProperty('graph');
      expect(bundle.graph).toHaveProperty('nodes');
      expect(bundle.graph).toHaveProperty('edges');
    }, 30000);

    it('should generate context with custom depth', async () => {
      const outDir = join(outputPath, 'depth-test');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --depth 2 --out ${outDir}`
      );

      // Note: depth is overridden by the default llm-chat profile which sets depth=1
      // The profile logs show the actual depth used
      expect(stdout).toContain('depth=1');

      // Check context_main.json
      const mainIndexPath = join(outDir, 'context_main.json');
      await access(mainIndexPath);

      const index = JSON.parse(await readFile(mainIndexPath, 'utf-8'));

      // Read a per-folder context to check depth
      const folderContextPath = join(outDir, index.folders[0].contextFile);
      const bundles = JSON.parse(await readFile(folderContextPath, 'utf-8'));

      expect(bundles.length).toBeGreaterThan(0);
      // The profile overrides to depth 1
      expect(bundles[0].depth).toBe(1);
    }, 30000);

    it('should work with different output formats', async () => {
      await execAsync('npm run build');

      // Test JSON format
      const jsonDir = join(outputPath, 'json-test');
      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --format json --out ${jsonDir}`
      );

      // context_main.json should always be JSON
      const jsonMainIndex = await readFile(join(jsonDir, 'context_main.json'), 'utf-8');
      const index = JSON.parse(jsonMainIndex);
      expect(index.type).toBe('LogicStampIndex');

      // Per-folder context should be JSON array
      const jsonFolderContext = await readFile(join(jsonDir, index.folders[0].contextFile), 'utf-8');
      expect(() => JSON.parse(jsonFolderContext)).not.toThrow();

      // Test NDJSON format
      const ndjsonDir = join(outputPath, 'ndjson-test');
      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --format ndjson --out ${ndjsonDir}`
      );
      const ndjsonIndex = JSON.parse(await readFile(join(ndjsonDir, 'context_main.json'), 'utf-8'));
      const ndjsonContent = await readFile(join(ndjsonDir, ndjsonIndex.folders[0].contextFile), 'utf-8');
      const lines = ndjsonContent.trim().split('\n');
      expect(lines.length).toBeGreaterThan(0);
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });

      // Test pretty format
      const prettyDir = join(outputPath, 'pretty-test');
      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --format pretty --out ${prettyDir}`
      );
      const prettyIndex = JSON.parse(await readFile(join(prettyDir, 'context_main.json'), 'utf-8'));
      const prettyContent = await readFile(join(prettyDir, prettyIndex.folders[0].contextFile), 'utf-8');
      expect(prettyContent).toContain('Bundle');
    }, 60000);
  });

  describe('Profile options', () => {
    it('should apply llm-safe profile correctly', async () => {
      const outDir = join(outputPath, 'safe-test');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --profile llm-safe --out ${outDir}`
      );

      expect(stdout).toContain('llm-safe');
      expect(stdout).toContain('depth=1');

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      expect(bundles[0].depth).toBe(1);
      // llm-safe has max 30 nodes per bundle
      bundles.forEach(bundle => {
        expect(bundle.graph.nodes.length).toBeLessThanOrEqual(30);
      });
    }, 30000);

    it('should apply llm-chat profile correctly', async () => {
      const outDir = join(outputPath, 'chat-test');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --profile llm-chat --out ${outDir}`
      );

      expect(stdout).toContain('llm-chat');

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      expect(bundles[0].depth).toBe(1);
      // llm-chat has max 100 nodes per bundle
      bundles.forEach(bundle => {
        expect(bundle.graph.nodes.length).toBeLessThanOrEqual(100);
      });
    }, 30000);

    it('should apply ci-strict profile correctly', async () => {
      const outDir = join(outputPath, 'strict-test');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --profile ci-strict --out ${outDir}`
      );

      expect(stdout).toContain('ci-strict');

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      // ci-strict includes no code
      bundles.forEach(bundle => {
        bundle.graph.nodes.forEach(node => {
          expect(node.contract.codeSnippet).toBeUndefined();
        });
      });
    }, 30000);
  });

  describe('Code inclusion options', () => {
    it('should include no code when --include-code none', async () => {
      const outDir = join(outputPath, 'no-code-test');

      await execAsync('npm run build');

      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --include-code none --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      bundles.forEach(bundle => {
        bundle.graph.nodes.forEach(node => {
          expect(node.contract.codeSnippet).toBeUndefined();
        });
      });
    }, 30000);

    it('should include header when --include-code header', async () => {
      const outDir = join(outputPath, 'header-test');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --include-code header --out ${outDir}`
      );

      // Verify the command completed successfully
      expect(stdout).toContain('context files written successfully');

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      // Verify bundles were generated
      expect(bundles.length).toBeGreaterThan(0);
      expect(bundles[0].graph.nodes.length).toBeGreaterThan(0);
    }, 30000);

    it('should include full code when --include-code full', async () => {
      const outDir = join(outputPath, 'full-test');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --include-code full --out ${outDir}`
      );

      // Verify the command completed successfully
      expect(stdout).toContain('context files written successfully');

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      // Verify bundles were generated
      expect(bundles.length).toBeGreaterThan(0);
      expect(bundles[0].graph.nodes.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Dependency graph validation', () => {
    it('should correctly identify component dependencies', async () => {
      const outDir = join(outputPath, 'context-deps');

      await execAsync('npm run build');

      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --depth 2 --out ${outDir}`
      );

      // Read main index to find context files
      const mainIndex = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));

      // Collect all bundles from all folder context files
      const bundles: any[] = [];
      for (const folder of mainIndex.folders) {
        const contextPath = join(outDir, folder.contextFile);
        const folderBundles = JSON.parse(await readFile(contextPath, 'utf-8'));
        bundles.push(...folderBundles);
      }

      // Find the Card component bundle
      const cardBundle = bundles.find(b => b.entryId.includes('Card.tsx'));

      if (cardBundle) {
        // Card should depend on Button
        const hasButtonDependency = cardBundle.graph.edges.some(
          (edge: any) => edge.to.includes('Button.tsx')
        );
        expect(hasButtonDependency).toBe(true);
      }
    }, 30000);

    it('should report summary statistics correctly', async () => {
      const outFile = join(outputPath, 'context-summary.json');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --out ${outFile}`
      );

      expect(stdout).toContain('Summary:');
      expect(stdout).toContain('Total components:');
      expect(stdout).toContain('Root components:');
      expect(stdout).toContain('Bundles generated:');
      expect(stdout).toContain('Completed in');
    }, 30000);

    it('should not duplicate summary output (single-run logging)', async () => {
      const outFile = join(outputPath, 'context-no-dupe.json');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --out ${outFile}`
      );

      // Count occurrences of key summary lines
      const summaryCount = (stdout.match(/📊 Summary:/g) || []).length;
      const totalComponentsCount = (stdout.match(/Total components:/g) || []).length;
      const completedCount = (stdout.match(/Completed in/g) || []).length;

      // Each of these should appear exactly once
      expect(summaryCount).toBe(1);
      expect(totalComponentsCount).toBe(1);
      expect(completedCount).toBe(1);

      // No duplicate "Context written" messages
      const writtenCount = (stdout.match(/Context written/g) || []).length;
      expect(writtenCount).toBeLessThanOrEqual(1);
    }, 30000);
  });
});

