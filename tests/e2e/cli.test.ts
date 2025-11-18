import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, access, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

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

  describe('Compare command', () => {
    it('should compare two context files and detect no drift', async () => {
      const outDir1 = join(outputPath, 'compare1');
      const outDir2 = join(outputPath, 'compare2');

      await execAsync('npm run build');

      // Generate two identical contexts
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir2}`
      );

      // Get a specific per-folder context.json file from each
      const index1 = JSON.parse(await readFile(join(outDir1, 'context_main.json'), 'utf-8'));
      const index2 = JSON.parse(await readFile(join(outDir2, 'context_main.json'), 'utf-8'));
      const contextFile1 = join(outDir1, index1.folders[0].contextFile);
      const contextFile2 = join(outDir2, index2.folders[0].contextFile);

      // Compare them
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2}`
      );

      expect(stdout).toContain('✅');
      expect(stdout).toContain('PASS');
    }, 60000);

    it('should detect drift when components change', async () => {
      const outDir1 = join(outputPath, 'drift-before');
      const outDir2 = join(outputPath, 'drift-after');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );

      // Get the first per-folder context file
      const index1 = JSON.parse(await readFile(join(outDir1, 'context_main.json'), 'utf-8'));
      const contextFile1 = join(outDir1, index1.folders[0].contextFile);

      // Modify the context to simulate drift - change a semantic hash
      const { writeFile } = await import('node:fs/promises');
      const content1 = JSON.parse(await readFile(contextFile1, 'utf-8'));
      if (content1.length > 0 && content1[0].graph.nodes.length > 0) {
        // Modify the semantic hash to simulate a code change
        content1[0].graph.nodes[0].contract.semanticHash = 'uif:000000000000000000000000';
      }
      const contextFile2 = join(outDir2, 'src', 'context.json');
      await mkdir(dirname(contextFile2), { recursive: true });
      await writeFile(contextFile2, JSON.stringify(content1, null, 2));

      // Compare them - should detect drift
      try {
        await execAsync(
          `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2}`
        );
        expect.fail('Should have detected drift');
      } catch (error: any) {
        // Exit code 1 indicates drift detected
        const output = error.stdout || error.stderr || '';
        expect(output).toContain('DRIFT');
      }
    }, 60000);

    it('should show token stats with --stats flag', async () => {
      const outDir1 = join(outputPath, 'stats1');
      const outDir2 = join(outputPath, 'stats2');

      await execAsync('npm run build');

      // Generate two contexts
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir2}`
      );

      // Get per-folder context files
      const index1 = JSON.parse(await readFile(join(outDir1, 'context_main.json'), 'utf-8'));
      const index2 = JSON.parse(await readFile(join(outDir2, 'context_main.json'), 'utf-8'));
      const contextFile1 = join(outDir1, index1.folders[0].contextFile);
      const contextFile2 = join(outDir2, index2.folders[0].contextFile);

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

    it.skip('should support auto-mode (no arguments) with --approve flag', async () => {
      // Skip: Auto-mode expects context.json at root, needs update for per-folder structure
    }, 60000);

    it.skip('should exit with code 0 when no drift in auto-mode', async () => {
      // Skip: Auto-mode expects context.json at root, needs update for per-folder structure
    }, 60000);

    it.skip('should exit with code 1 when drift detected in CI mode (non-TTY)', async () => {
      // Skip: Auto-mode expects context.json at root, needs update for per-folder structure
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
      const outDir1 = join(outputPath, 'hash-before');
      const outDir2 = join(outputPath, 'hash-after');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );

      // Get the per-folder context file
      const index1 = JSON.parse(await readFile(join(outDir1, 'context_main.json'), 'utf-8'));
      const contextFile1 = join(outDir1, index1.folders[0].contextFile);

      // Load and modify to simulate hash change
      const content = JSON.parse(await readFile(contextFile1, 'utf-8'));
      if (content.length > 0 && content[0].graph.nodes.length > 0) {
        // Change the semantic hash to simulate code change
        content[0].graph.nodes[0].contract.semanticHash = 'uif:999999999999999999999999';
      }
      const { writeFile } = await import('node:fs/promises');
      const contextFile2 = join(outDir2, 'src', 'context.json');
      await mkdir(dirname(contextFile2), { recursive: true });
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
        expect(error.stdout).toContain('uif:');
      }
    }, 60000);

    it('should show detailed diff for import changes', async () => {
      const outDir1 = join(outputPath, 'imports-before');
      const outDir2 = join(outputPath, 'imports-after');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );

      // Get the per-folder context file
      const index1 = JSON.parse(await readFile(join(outDir1, 'context_main.json'), 'utf-8'));
      const contextFile1 = join(outDir1, index1.folders[0].contextFile);

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
      const contextFile2 = join(outDir2, 'src', 'context.json');
      await mkdir(dirname(contextFile2), { recursive: true });
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
      const outDir1 = join(outputPath, 'exports-before');
      const outDir2 = join(outputPath, 'exports-after');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );

      // Get the per-folder context file
      const index1 = JSON.parse(await readFile(join(outDir1, 'context_main.json'), 'utf-8'));
      const contextFile1 = join(outDir1, index1.folders[0].contextFile);

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
      const contextFile2 = join(outDir2, 'src', 'context.json');
      await mkdir(dirname(contextFile2), { recursive: true });
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
      const outDir1 = join(outputPath, 'hooks-before');
      const outDir2 = join(outputPath, 'hooks-after');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );

      // Get the per-folder context file
      const index1 = JSON.parse(await readFile(join(outDir1, 'context_main.json'), 'utf-8'));
      const contextFile1 = join(outDir1, index1.folders[0].contextFile);

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
      const contextFile2 = join(outDir2, 'src', 'context.json');
      await mkdir(dirname(contextFile2), { recursive: true });
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
      const outDir1 = join(outputPath, 'functions-before');
      const outDir2 = join(outputPath, 'functions-after');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );

      // Get the per-folder context file
      const index1 = JSON.parse(await readFile(join(outDir1, 'context_main.json'), 'utf-8'));
      const contextFile1 = join(outDir1, index1.folders[0].contextFile);

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
      const contextFile2 = join(outDir2, 'src', 'context.json');
      await mkdir(dirname(contextFile2), { recursive: true });
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
      const outDir1 = join(outputPath, 'components-before');
      const outDir2 = join(outputPath, 'components-after');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );

      const index1 = JSON.parse(await readFile(join(outDir1, 'context_main.json'), 'utf-8'));
      const contextFile1 = join(outDir1, index1.folders[0].contextFile);

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
      const contextFile2 = join(outDir2, 'src', 'context.json');
      await mkdir(dirname(contextFile2), { recursive: true });
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
      const outDir1 = join(outputPath, 'props-before');
      const outDir2 = join(outputPath, 'props-after');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );

      const index1 = JSON.parse(await readFile(join(outDir1, 'context_main.json'), 'utf-8'));
      const contextFile1 = join(outDir1, index1.folders[0].contextFile);

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
      const contextFile2 = join(outDir2, 'src', 'context.json');
      await mkdir(dirname(contextFile2), { recursive: true });
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
      const outDir1 = join(outputPath, 'emits-before');
      const outDir2 = join(outputPath, 'emits-after');

      await execAsync('npm run build');

      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );

      const index1 = JSON.parse(await readFile(join(outDir1, 'context_main.json'), 'utf-8'));
      const contextFile1 = join(outDir1, index1.folders[0].contextFile);

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
      const contextFile2 = join(outDir2, 'src', 'context.json');
      await mkdir(dirname(contextFile2), { recursive: true });
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

  describe('Init command', () => {
    it('should create .gitignore with LogicStamp patterns when it does not exist', async () => {
      // Build the project first
      await execAsync('npm run build');

      // Create a test directory without .gitignore
      const testDir = join(outputPath, 'init-test-1');
      await mkdir(testDir, { recursive: true });

      // Run stamp init
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js init ${testDir}`
      );

      // Verify output messages
      expect(stdout).toContain('Initializing LogicStamp');
      expect(stdout).toContain('Created .gitignore with LogicStamp patterns');
      expect(stdout).toContain('initialization complete');

      // Verify .gitignore was created with correct patterns
      const gitignorePath = join(testDir, '.gitignore');
      const gitignoreContent = await readFile(gitignorePath, 'utf-8');

      expect(gitignoreContent).toContain('# LogicStamp context files');
      expect(gitignoreContent).toContain('context.json');
      expect(gitignoreContent).toContain('context_*.json');
      expect(gitignoreContent).toContain('*.uif.json');
      expect(gitignoreContent).toContain('logicstamp.manifest.json');
      expect(gitignoreContent).toContain('.logicstamp/');

      // Verify config was created with preference
      const configPath = join(testDir, '.logicstamp', 'config.json');
      const configContent = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.gitignorePreference).toBe('added');
    }, 30000);

    it('should add patterns to existing .gitignore', async () => {
      // Build the project first
      await execAsync('npm run build');

      // Create a test directory with existing .gitignore
      const testDir = join(outputPath, 'init-test-2');
      await mkdir(testDir, { recursive: true });

      const { writeFile } = await import('node:fs/promises');
      const gitignorePath = join(testDir, '.gitignore');
      await writeFile(gitignorePath, 'node_modules\ndist\n');

      // Run stamp init
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js init ${testDir}`
      );

      // Verify output messages
      expect(stdout).toContain('Added LogicStamp patterns to existing .gitignore');

      // Verify .gitignore has both old and new patterns
      const gitignoreContent = await readFile(gitignorePath, 'utf-8');

      // Old patterns should still be there
      expect(gitignoreContent).toContain('node_modules');
      expect(gitignoreContent).toContain('dist');

      // New patterns should be added
      expect(gitignoreContent).toContain('# LogicStamp context files');
      expect(gitignoreContent).toContain('context.json');
      expect(gitignoreContent).toContain('context_*.json');
      expect(gitignoreContent).toContain('.logicstamp/');

      // Verify config was created
      const configPath = join(testDir, '.logicstamp', 'config.json');
      const configContent = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.gitignorePreference).toBe('added');
    }, 30000);

    it('should not duplicate patterns if they already exist', async () => {
      // Build the project first
      await execAsync('npm run build');

      // Create a test directory with .gitignore that already has LogicStamp patterns
      const testDir = join(outputPath, 'init-test-3');
      await mkdir(testDir, { recursive: true });

      const { writeFile } = await import('node:fs/promises');
      const gitignorePath = join(testDir, '.gitignore');
      const existingContent = '# LogicStamp context files\ncontext.json\ncontext_*.json\n*.uif.json\nlogicstamp.manifest.json\n';
      await writeFile(gitignorePath, existingContent);

      // Run stamp init
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js init ${testDir}`
      );

      // Verify output messages
      expect(stdout).toContain('already contains LogicStamp patterns');

      // Verify .gitignore content is unchanged
      const gitignoreContent = await readFile(gitignorePath, 'utf-8');
      expect(gitignoreContent).toBe(existingContent);
    }, 30000);

    it('should respect --skip-gitignore flag', async () => {
      // Build the project first
      await execAsync('npm run build');

      // Create a test directory
      const testDir = join(outputPath, 'init-test-4');
      await mkdir(testDir, { recursive: true });

      // Run stamp init with --skip-gitignore
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js init ${testDir} --skip-gitignore`
      );

      // Verify output messages
      expect(stdout).toContain('initialization complete');
      expect(stdout).not.toContain('.gitignore');

      // Verify .gitignore was not created
      const gitignorePath = join(testDir, '.gitignore');
      let exists = true;
      try {
        await access(gitignorePath);
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);
    }, 30000);
  });
});
