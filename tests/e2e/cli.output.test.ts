import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const execAsync = promisify(exec);

describe('CLI Output and Formatting Tests', () => {
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

  describe('Help and error handling', () => {
    it('should display help with --help flag', async () => {
      await execAsync('npm run build');

      const { stdout } = await execAsync('node dist/cli/index.js --help');

      expect(stdout).toContain('LogicStamp Context');
      expect(stdout).toContain('USAGE:');
      expect(stdout).toContain('OPTIONS:');
      expect(stdout).toContain('PROFILES:');
      expect(stdout).toContain('EXAMPLES:');
    }, 30000);

    it('should handle non-existent directory gracefully', async () => {
      await execAsync('npm run build');

      try {
        await execAsync('node dist/cli/index.js /non/existent/path');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe(1);
      }
    }, 30000);
  });

  describe('CLI output smoke tests', () => {
    it('should produce well-formed CLI output with all expected sections', async () => {
      const outFile = join(outputPath, 'smoke-test.json');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --out ${outFile}`
      );

      // Verify all expected output sections are present
      expect(stdout).toContain('🔍 Scanning');
      expect(stdout).toContain('Analyzing components');
      expect(stdout).toContain('Building dependency graph');
      expect(stdout).toContain('Generating context');
      expect(stdout).toContain('📝 Writing context files for');
      expect(stdout).toContain('📝 Writing main context index');
      expect(stdout).toContain('context files written successfully');
      expect(stdout).toContain('📊 Summary:');
      expect(stdout).toContain('Total components:');
      expect(stdout).toContain('Root components:');
      expect(stdout).toContain('Leaf components:');
      expect(stdout).toContain('Bundles generated:');
      expect(stdout).toContain('Total nodes in context:');
      expect(stdout).toContain('Total edges:');
      expect(stdout).toContain('⏱  Completed in');

      // Verify no error messages
      expect(stdout).not.toContain('❌');
      expect(stdout).not.toContain('Error:');
    }, 30000);

    it('should produce valid JSON output that matches schema expectations', async () => {
      const outDir = join(outputPath, 'schema-check');

      await execAsync('npm run build');

      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --out ${outDir}`
      );

      // Read index to find a per-folder context file
      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const folderContextPath = join(outDir, index.folders[0].contextFile);
      const content = await readFile(folderContextPath, 'utf-8');
      const bundles = JSON.parse(content);

      // Schema validation
      expect(Array.isArray(bundles)).toBe(true);
      expect(bundles.length).toBeGreaterThan(0);

      bundles.forEach((bundle, idx) => {
        // Required bundle fields
        expect(bundle).toHaveProperty('$schema');
        expect(bundle.$schema).toContain('logicstamp.dev/schemas/context');
        expect(bundle).toHaveProperty('position');
        expect(bundle.position).toMatch(/^\d+\/\d+$/);
        expect(bundle).toHaveProperty('type', 'LogicStampBundle');
        expect(bundle).toHaveProperty('schemaVersion', '0.1');
        expect(bundle).toHaveProperty('entryId');
        expect(bundle).toHaveProperty('depth');
        expect(bundle).toHaveProperty('createdAt');
        expect(bundle).toHaveProperty('bundleHash');
        expect(bundle.bundleHash).toMatch(/^uifb:[a-f0-9]{24}$/);

        // Graph structure
        expect(bundle).toHaveProperty('graph');
        expect(bundle.graph).toHaveProperty('nodes');
        expect(bundle.graph).toHaveProperty('edges');
        expect(Array.isArray(bundle.graph.nodes)).toBe(true);
        expect(Array.isArray(bundle.graph.edges)).toBe(true);

        // Meta information
        expect(bundle).toHaveProperty('meta');
        expect(bundle.meta).toHaveProperty('source');
        expect(bundle.meta.source).toMatch(/^logicstamp-context@/);
        expect(bundle.meta).toHaveProperty('missing');
      });
    }, 30000);
  });
});

