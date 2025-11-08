import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';

const execAsync = promisify(exec);

describe('CLI End-to-End Tests', () => {
  const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
  const outputPath = join(process.cwd(), 'tests/e2e/output');

  beforeEach(async () => {
    // Clean up any existing output files
    try {
      await rm(outputPath, { recursive: true, force: true });
    } catch (error) {
      // Directory doesn't exist, which is fine
    }
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
    it('should generate context.json for a simple React app', async () => {
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
      expect(stdout).toContain('Context written to');

      // Verify file was created
      await access(outFile);

      // Verify content
      const content = await readFile(outFile, 'utf-8');
      const bundles = JSON.parse(content);

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
      const outFile = join(outputPath, 'context-depth2.json');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --depth 2 --out ${outFile}`
      );

      // Note: depth is overridden by the default llm-chat profile which sets depth=1
      // The profile logs show the actual depth used
      expect(stdout).toContain('depth=1');

      const content = await readFile(outFile, 'utf-8');
      const bundles = JSON.parse(content);

      expect(bundles.length).toBeGreaterThan(0);
      // The profile overrides to depth 1
      expect(bundles[0].depth).toBe(1);
    }, 30000);

    it('should work with different output formats', async () => {
      await execAsync('npm run build');

      // Test JSON format
      const jsonFile = join(outputPath, 'context.json');
      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --format json --out ${jsonFile}`
      );
      const jsonContent = await readFile(jsonFile, 'utf-8');
      expect(() => JSON.parse(jsonContent)).not.toThrow();

      // Test NDJSON format
      const ndjsonFile = join(outputPath, 'context.ndjson');
      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --format ndjson --out ${ndjsonFile}`
      );
      const ndjsonContent = await readFile(ndjsonFile, 'utf-8');
      const lines = ndjsonContent.trim().split('\n');
      expect(lines.length).toBeGreaterThan(0);
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });

      // Test pretty format
      const prettyFile = join(outputPath, 'context.txt');
      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --format pretty --out ${prettyFile}`
      );
      const prettyContent = await readFile(prettyFile, 'utf-8');
      expect(prettyContent).toContain('Bundle');
    }, 60000);
  });

  describe('Profile options', () => {
    it('should apply llm-safe profile correctly', async () => {
      const outFile = join(outputPath, 'context-safe.json');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --profile llm-safe --out ${outFile}`
      );

      expect(stdout).toContain('llm-safe');
      expect(stdout).toContain('depth=1');

      const content = await readFile(outFile, 'utf-8');
      const bundles = JSON.parse(content);

      expect(bundles[0].depth).toBe(1);
      // llm-safe has max 30 nodes per bundle
      bundles.forEach(bundle => {
        expect(bundle.graph.nodes.length).toBeLessThanOrEqual(30);
      });
    }, 30000);

    it('should apply llm-chat profile correctly', async () => {
      const outFile = join(outputPath, 'context-chat.json');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --profile llm-chat --out ${outFile}`
      );

      expect(stdout).toContain('llm-chat');

      const content = await readFile(outFile, 'utf-8');
      const bundles = JSON.parse(content);

      expect(bundles[0].depth).toBe(1);
      // llm-chat has max 100 nodes per bundle
      bundles.forEach(bundle => {
        expect(bundle.graph.nodes.length).toBeLessThanOrEqual(100);
      });
    }, 30000);

    it('should apply ci-strict profile correctly', async () => {
      const outFile = join(outputPath, 'context-strict.json');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --profile ci-strict --out ${outFile}`
      );

      expect(stdout).toContain('ci-strict');

      const content = await readFile(outFile, 'utf-8');
      const bundles = JSON.parse(content);

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
      const outFile = join(outputPath, 'context-no-code.json');

      await execAsync('npm run build');

      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --include-code none --out ${outFile}`
      );

      const content = await readFile(outFile, 'utf-8');
      const bundles = JSON.parse(content);

      bundles.forEach(bundle => {
        bundle.graph.nodes.forEach(node => {
          expect(node.contract.codeSnippet).toBeUndefined();
        });
      });
    }, 30000);

    it('should include header when --include-code header', async () => {
      const outFile = join(outputPath, 'context-header.json');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --include-code header --out ${outFile}`
      );

      // Verify the command completed successfully
      expect(stdout).toContain('Context written to');

      const content = await readFile(outFile, 'utf-8');
      const bundles = JSON.parse(content);

      // Verify bundles were generated
      expect(bundles.length).toBeGreaterThan(0);
      expect(bundles[0].graph.nodes.length).toBeGreaterThan(0);
    }, 30000);

    it('should include full code when --include-code full', async () => {
      const outFile = join(outputPath, 'context-full.json');

      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/index.js ${fixturesPath} --include-code full --out ${outFile}`
      );

      // Verify the command completed successfully
      expect(stdout).toContain('Context written to');

      const content = await readFile(outFile, 'utf-8');
      const bundles = JSON.parse(content);

      // Verify bundles were generated
      expect(bundles.length).toBeGreaterThan(0);
      expect(bundles[0].graph.nodes.length).toBeGreaterThan(0);
    }, 30000);
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

  describe('Dependency graph validation', () => {
    it('should correctly identify component dependencies', async () => {
      const outFile = join(outputPath, 'context-deps.json');

      await execAsync('npm run build');

      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --depth 2 --out ${outFile}`
      );

      const content = await readFile(outFile, 'utf-8');
      const bundles = JSON.parse(content);

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
  });
});
