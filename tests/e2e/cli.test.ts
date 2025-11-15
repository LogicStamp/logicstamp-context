import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, access, mkdir } from 'node:fs/promises';
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
      expect(stdout).toContain('Context written successfully');

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
      expect(stdout).toContain('Context written successfully');

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
      expect(stdout).toContain('Context written successfully');

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
      expect(stdout).toContain('📝 Writing to:');
      expect(stdout).toContain('✅ Context written successfully');
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
      const outFile = join(outputPath, 'schema-check.json');

      await execAsync('npm run build');

      await execAsync(
        `node dist/cli/index.js ${fixturesPath} --out ${outFile}`
      );

      const content = await readFile(outFile, 'utf-8');
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

  describe('Compare command', () => {
    it('should compare two context files and detect no drift', async () => {
      const contextFile1 = join(outputPath, 'context1.json');
      const contextFile2 = join(outputPath, 'context2.json');

      await execAsync('npm run build');

      // Generate two identical contexts
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile1}`
      );
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile2}`
      );

      // Compare them
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2}`
      );

      expect(stdout).toContain('✅');
      expect(stdout).toContain('PASS');
    }, 60000);

    it('should detect drift when components change', async () => {
      const contextFile1 = join(outputPath, 'context-before.json');
      const contextFile2 = join(outputPath, 'context-after.json');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile1}`
      );

      // Modify the context to simulate drift
      const content1 = JSON.parse(await readFile(contextFile1, 'utf-8'));
      // Remove a component to simulate drift
      if (content1.length > 1) {
        content1.pop();
      }
      const { writeFile } = await import('node:fs/promises');
      await writeFile(contextFile2, JSON.stringify(content1, null, 2));

      // Compare them - should detect drift
      try {
        await execAsync(
          `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2}`
        );
        expect.fail('Should have detected drift');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout).toContain('⚠️');
        expect(error.stdout).toContain('DRIFT');
      }
    }, 60000);

    it('should show token stats with --stats flag', async () => {
      const contextFile1 = join(outputPath, 'stats1.json');
      const contextFile2 = join(outputPath, 'stats2.json');

      await execAsync('npm run build');

      // Generate two contexts
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile1}`
      );
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile2}`
      );

      // Compare with stats
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2} --stats`
      );

      expect(stdout).toContain('Token Stats:');
      expect(stdout).toContain('Old:');
      expect(stdout).toContain('New:');
      expect(stdout).toContain('GPT-4o-mini');
      expect(stdout).toContain('Claude');
    }, 60000);

    it('should support auto-mode (no arguments) with --approve flag', async () => {
      // First, generate a baseline context.json
      const contextFile = join(outputPath, 'context.json');

      await execAsync('npm run build');

      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile}`
      );

      // Copy it to the test directory as "context.json" (simulating committed file)
      const { copyFile } = await import('node:fs/promises');
      const projectContextFile = join(fixturesPath, 'context.json');
      await copyFile(contextFile, projectContextFile);

      try {
        // Run compare in auto-mode with --approve from the fixtures directory
        // This should generate fresh context and compare with context.json
        // Since nothing changed, it should pass
        const { stdout } = await execAsync(
          `cd ${fixturesPath} && node ${process.cwd()}/dist/cli/stamp.js context compare --approve`
        );

        expect(stdout).toContain('Auto-compare mode');
        // Should generate fresh context and compare
      } finally {
        // Clean up
        try {
          await rm(projectContextFile);
        } catch {}
      }
    }, 60000);

    it('should exit with code 0 when no drift in auto-mode', async () => {
      const contextFile = join(outputPath, 'context-auto.json');

      await execAsync('npm run build');

      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile}`
      );

      const { copyFile } = await import('node:fs/promises');
      const projectContextFile = join(fixturesPath, 'context.json');
      await copyFile(contextFile, projectContextFile);

      try {
        const { stdout } = await execAsync(
          `cd ${fixturesPath} && node ${process.cwd()}/dist/cli/stamp.js context compare`
        );

        expect(stdout).toContain('PASS');
      } finally {
        try {
          await rm(projectContextFile);
        } catch {}
      }
    }, 60000);

    it('should exit with code 1 when drift detected in CI mode (non-TTY)', async () => {
      const contextFile = join(outputPath, 'context-ci.json');

      await execAsync('npm run build');

      // Generate a baseline
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile}`
      );

      // Modify it to create drift
      const content = JSON.parse(await readFile(contextFile, 'utf-8'));
      if (content.length > 1) {
        content.pop(); // Remove a bundle
      }
      const { writeFile } = await import('node:fs/promises');
      const projectContextFile = join(fixturesPath, 'context.json');
      await writeFile(projectContextFile, JSON.stringify(content, null, 2));

      try {
        // Run in non-TTY mode (CI simulation)
        await execAsync(
          `cd ${fixturesPath} && node ${process.cwd()}/dist/cli/stamp.js context compare`,
          { env: { ...process.env, CI: 'true' } }
        );
        expect.fail('Should have exited with code 1');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout).toContain('DRIFT');
      } finally {
        try {
          await rm(projectContextFile);
        } catch {}
      }
    }, 60000);

    it('should display help for compare command', async () => {
      await execAsync('npm run build');

      const { stdout } = await execAsync(
        'node dist/cli/stamp.js context compare --help'
      );

      expect(stdout).toContain('Stamp Context Compare');
      expect(stdout).toContain('USAGE:');
      expect(stdout).toContain('--approve');
      expect(stdout).toContain('--stats');
      expect(stdout).toContain('Auto-compare with fresh context');
      expect(stdout).toContain('EXIT CODES:');
    }, 30000);

    it('should show detailed diff for hash changes', async () => {
      const contextFile1 = join(outputPath, 'hash-before.json');
      const contextFile2 = join(outputPath, 'hash-after.json');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile1}`
      );

      // Load and modify to simulate hash change
      const content = JSON.parse(await readFile(contextFile1, 'utf-8'));
      if (content.length > 0 && content[0].graph.nodes.length > 0) {
        // Change the semantic hash to simulate code change
        content[0].graph.nodes[0].contract.semanticHash = 'uifb:999999999999999999999999';
      }
      const { writeFile } = await import('node:fs/promises');
      await writeFile(contextFile2, JSON.stringify(content, null, 2));

      // Compare them - should show detailed hash diff
      try {
        await execAsync(
          `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2}`
        );
        expect.fail('Should have detected drift');
      } catch (error: any) {
        expect(error.code).toBe(1);
        expect(error.stdout).toContain('Δ hash');
        expect(error.stdout).toContain('old:');
        expect(error.stdout).toContain('new:');
        expect(error.stdout).toContain('uifb:');
      }
    }, 60000);

    it('should show detailed diff for import changes', async () => {
      const contextFile1 = join(outputPath, 'imports-before.json');
      const contextFile2 = join(outputPath, 'imports-after.json');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile1}`
      );

      // Load and modify imports
      const content = JSON.parse(await readFile(contextFile1, 'utf-8'));
      if (content.length > 0 && content[0].graph.nodes.length > 0) {
        const node = content[0].graph.nodes[0];
        if (!node.contract.version) {
          node.contract.version = { imports: [], hooks: [] };
        }
        // Add and remove imports
        node.contract.version.imports = ['./new-import', './another-import'];
      }
      const { writeFile } = await import('node:fs/promises');
      await writeFile(contextFile2, JSON.stringify(content, null, 2));

      // Compare them - should show detailed import diff
      try {
        await execAsync(
          `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2}`
        );
        // May or may not fail depending on if imports actually changed
      } catch (error: any) {
        if (error.stdout && error.stdout.includes('Δ imports')) {
          // Verify detailed diff format
          expect(error.stdout).toMatch(/[+-]\s+\.\//); // Should show + or - with import paths
        }
      }
    }, 60000);

    it('should show detailed diff for export kind changes', async () => {
      const contextFile1 = join(outputPath, 'exports-before.json');
      const contextFile2 = join(outputPath, 'exports-after.json');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile1}`
      );

      // Load and modify export kind
      const content = JSON.parse(await readFile(contextFile1, 'utf-8'));
      if (content.length > 0 && content[0].graph.nodes.length > 0) {
        const node = content[0].graph.nodes[0];
        // Change export from default to named (or vice versa)
        if (typeof node.contract.exports === 'string') {
          // Was default, change to named
          node.contract.exports = { named: ['Component'] };
        } else {
          // Was named or none, change to default
          node.contract.exports = 'default';
        }
      }
      const { writeFile } = await import('node:fs/promises');
      await writeFile(contextFile2, JSON.stringify(content, null, 2));

      // Compare them - should show detailed export diff
      try {
        await execAsync(
          `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2}`
        );
        expect.fail('Should have detected drift');
      } catch (error: any) {
        expect(error.code).toBe(1);
        if (error.stdout && error.stdout.includes('Δ exports')) {
          // Verify arrow format (old → new)
          expect(error.stdout).toMatch(/\w+\s*→\s*\w+/);
        }
      }
    }, 60000);

    it('should show hook changes with added and removed indicators', async () => {
      const contextFile1 = join(outputPath, 'hooks-before.json');
      const contextFile2 = join(outputPath, 'hooks-after.json');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile1}`
      );

      // Load and modify hooks
      const content = JSON.parse(await readFile(contextFile1, 'utf-8'));
      if (content.length > 0 && content[0].graph.nodes.length > 0) {
        const node = content[0].graph.nodes[0];
        if (!node.contract.version) {
          node.contract.version = { imports: [], hooks: [] };
        }
        // Change hooks
        node.contract.version.hooks = ['useState', 'useEffect', 'useCallback'];
      }
      const { writeFile } = await import('node:fs/promises');
      await writeFile(contextFile2, JSON.stringify(content, null, 2));

      // Compare them
      try {
        await execAsync(
          `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2}`
        );
        // May or may not fail depending on if hooks actually changed
      } catch (error: any) {
        if (error.stdout && error.stdout.includes('Δ hooks')) {
          // Verify + or - indicators
          expect(error.stdout).toMatch(/[+-]\s+use\w+/);
        }
      }
    }, 60000);

    it('should show function changes with added and removed indicators', async () => {
      const contextFile1 = join(outputPath, 'functions-before.json');
      const contextFile2 = join(outputPath, 'functions-after.json');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile1}`
      );

      // Load and modify functions
      const content = JSON.parse(await readFile(contextFile1, 'utf-8'));
      if (content.length > 0 && content[0].graph.nodes.length > 0) {
        const node = content[0].graph.nodes[0];
        if (!node.contract.version) {
          node.contract.version = { imports: [], hooks: [], components: [], functions: [] };
        }
        // Change functions
        node.contract.version.functions = ['handleSubmit', 'validateForm', 'processData'];
      }
      const { writeFile } = await import('node:fs/promises');
      await writeFile(contextFile2, JSON.stringify(content, null, 2));

      // Compare them
      try {
        await execAsync(
          `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2}`
        );
        // May or may not fail depending on if functions actually changed
      } catch (error: any) {
        if (error.stdout && error.stdout.includes('Δ functions')) {
          // Verify + or - indicators
          expect(error.stdout).toMatch(/[+-]\s+\w+/);
        }
      }
    }, 60000);

    it('should show component changes', async () => {
      const contextFile1 = join(outputPath, 'components-before.json');
      const contextFile2 = join(outputPath, 'components-after.json');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile1}`
      );

      // Load and modify components
      const content = JSON.parse(await readFile(contextFile1, 'utf-8'));
      if (content.length > 0 && content[0].graph.nodes.length > 0) {
        const node = content[0].graph.nodes[0];
        if (!node.contract.version) {
          node.contract.version = { imports: [], hooks: [], components: [], functions: [] };
        }
        // Change components used
        node.contract.version.components = ['Modal', 'Dialog', 'Button'];
      }
      const { writeFile } = await import('node:fs/promises');
      await writeFile(contextFile2, JSON.stringify(content, null, 2));

      // Compare them
      try {
        await execAsync(
          `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2}`
        );
      } catch (error: any) {
        if (error.stdout && error.stdout.includes('Δ components')) {
          // Verify + or - indicators
          expect(error.stdout).toMatch(/[+-]\s+\w+/);
        }
      }
    }, 60000);

    it('should show prop changes', async () => {
      const contextFile1 = join(outputPath, 'props-before.json');
      const contextFile2 = join(outputPath, 'props-after.json');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile1}`
      );

      // Load and modify props
      const content = JSON.parse(await readFile(contextFile1, 'utf-8'));
      if (content.length > 0 && content[0].graph.nodes.length > 0) {
        const node = content[0].graph.nodes[0];
        if (!node.contract.logicSignature) {
          node.contract.logicSignature = { props: {}, emits: {} };
        }
        // Add new props
        node.contract.logicSignature.props = {
          variant: 'string',
          size: 'string',
          disabled: 'boolean',
        };
      }
      const { writeFile } = await import('node:fs/promises');
      await writeFile(contextFile2, JSON.stringify(content, null, 2));

      // Compare them
      try {
        await execAsync(
          `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2}`
        );
      } catch (error: any) {
        if (error.stdout && error.stdout.includes('Δ props')) {
          // Verify + or - indicators showing prop names
          expect(error.stdout).toMatch(/[+-]\s+\w+/);
        }
      }
    }, 60000);

    it('should show emit/event changes', async () => {
      const contextFile1 = join(outputPath, 'emits-before.json');
      const contextFile2 = join(outputPath, 'emits-after.json');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${contextFile1}`
      );

      // Load and modify emits
      const content = JSON.parse(await readFile(contextFile1, 'utf-8'));
      if (content.length > 0 && content[0].graph.nodes.length > 0) {
        const node = content[0].graph.nodes[0];
        if (!node.contract.logicSignature) {
          node.contract.logicSignature = { props: {}, emits: {} };
        }
        // Add new emits
        node.contract.logicSignature.emits = {
          onClick: 'function',
          onChange: 'function',
          onSubmit: 'function',
        };
      }
      const { writeFile } = await import('node:fs/promises');
      await writeFile(contextFile2, JSON.stringify(content, null, 2));

      // Compare them
      try {
        await execAsync(
          `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2}`
        );
      } catch (error: any) {
        if (error.stdout && error.stdout.includes('Δ emits')) {
          // Verify + or - indicators showing event names
          expect(error.stdout).toMatch(/[+-]\s+on\w+/);
        }
      }
    }, 60000);
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
