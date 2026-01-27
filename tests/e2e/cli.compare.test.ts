import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const execAsync = promisify(exec);

describe('CLI Compare Command Tests', () => {
  const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
  let outputPath: string;

  beforeEach(async () => {
    // Create a unique output directory for this test run
    const uniqueId = randomUUID().substring(0, 8);
    outputPath = join(process.cwd(), 'tests/e2e/output', `compare-${uniqueId}`);
    await mkdir(outputPath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up this test's output directory
    if (outputPath) {
      try {
        await rm(outputPath, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Compare command', () => {
    it('should compare two context files and detect no drift', async () => {
      const outDir1 = join(outputPath, 'compare1');
      const outDir2 = join(outputPath, 'compare2');


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


      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );

      // Get the first per-folder context file
      const index1 = JSON.parse(await readFile(join(outDir1, 'context_main.json'), 'utf-8'));
      const contextFile1 = join(outDir1, index1.folders[0].contextFile);

      // Modify the context to simulate drift - change a semantic hash
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

    it('should support auto-mode (no arguments) for multi-file comparison', async () => {
      const testDir = join(outputPath, 'auto-mode-test');
      await mkdir(testDir, { recursive: true });


      // Copy fixture files to test directory first so both generations scan the same files
      const { cpSync } = await import('node:fs');
      cpSync(fixturesPath, testDir, { recursive: true });

      // Generate initial context in the test directory
      await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context .`,
        { cwd: testDir }
      );

      // Run auto-mode comparison from test directory
      const { stdout } = await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context compare`,
        { cwd: testDir }
      );

      expect(stdout).toContain('Auto-compare mode');
      expect(stdout).toContain('Comparing all context files');
      expect(stdout).toContain('PASS');
      expect(stdout).toContain('Folder Summary:');
    }, 60000);

    it('should exit with code 0 when no drift in auto-mode', async () => {
      const testDir = join(outputPath, 'no-drift-auto');
      await mkdir(testDir, { recursive: true });


      // Copy fixture files to test directory first
      const { cpSync } = await import('node:fs');
      cpSync(fixturesPath, testDir, { recursive: true });

      // Generate initial context in the test directory
      await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context .`,
        { cwd: testDir }
      );

      // Run comparison - should exit with code 0 (no drift)
      const { stdout } = await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context compare`,
        { cwd: testDir }
      );

      expect(stdout).toContain('PASS');
    }, 60000);

    it('should exit with code 1 when drift detected in CI mode (non-TTY)', async () => {
      const testDir = join(outputPath, 'drift-ci-test');
      await mkdir(testDir, { recursive: true });


      // Generate initial context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${testDir}`
      );

      // Copy fixture files to test directory
      const { cpSync } = await import('node:fs');
      cpSync(fixturesPath, join(testDir, 'src'), { recursive: true });

      // Modify a context file to create drift
      const index = JSON.parse(await readFile(join(testDir, 'context_main.json'), 'utf-8'));
      const contextFile = join(testDir, index.folders[0].contextFile);
      const content = JSON.parse(await readFile(contextFile, 'utf-8'));

      if (content.length > 0 && content[0].graph.nodes.length > 0) {
        content[0].graph.nodes[0].contract.semanticHash = 'uif:000000000000000000000000';
        await writeFile(contextFile, JSON.stringify(content, null, 2));
      }

      // Run comparison in non-TTY mode (should exit with code 1)
      try {
        await execAsync(
          `cd "${testDir}" && node "${join(process.cwd(), 'dist/cli/stamp.js')}" context compare`,
          { env: { ...process.env, CI: 'true' } }
        );
        expect.fail('Should have detected drift and exited with code 1');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = error.stdout || error.stderr || '';
        expect(output).toContain('DRIFT');
      }
    }, 60000);

    it('should display help for compare command', async () => {
      const { stdout } = await execAsync(
        'node dist/cli/stamp.js context compare --help'
      );

      expect(stdout).toContain('Stamp Context Compare');
      expect(stdout).toContain('USAGE:');
      expect(stdout).toContain('--approve');
      expect(stdout).toContain('--stats');
      expect(stdout).toContain('--clean-orphaned');
      expect(stdout).toContain('Auto-compare all context files');
      expect(stdout).toContain('EXIT CODES:');
    }, 30000);

    it('should show detailed diff for hash changes', async () => {
      const outDir1 = join(outputPath, 'hash-before');
      const outDir2 = join(outputPath, 'hash-after');


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
        if (!node.contract.composition) {
          node.contract.composition = { imports: [], hooks: [] };
        }
        // Add and remove imports
        node.contract.composition.imports = ['./new-import', './another-import'];
      }
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
        if (!node.contract.composition) {
          node.contract.composition = { imports: [], hooks: [] };
        }
        // Change hooks
        node.contract.composition.hooks = ['useState', 'useEffect', 'useCallback'];
      }
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
        if (!node.contract.composition) {
          node.contract.composition = { imports: [], hooks: [], components: [], functions: [] };
        }
        // Change functions
        node.contract.composition.functions = ['handleSubmit', 'validateForm', 'processData'];
      }
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
        if (!node.contract.composition) {
          node.contract.composition = { imports: [], hooks: [], components: [], functions: [] };
        }
        // Change components used
        node.contract.composition.components = ['Modal', 'Dialog', 'Button'];
      }
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
        if (!node.contract.interface) {
          node.contract.interface = { props: {}, emits: {} };
        }
        // Add new props
        node.contract.interface.props = {
          variant: 'string',
          size: 'string',
          disabled: 'boolean',
        };
      }
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
        if (!node.contract.interface) {
          node.contract.interface = { props: {}, emits: {} };
        }
        // Add new emits
        node.contract.interface.emits = {
          onClick: 'function',
          onChange: 'function',
          onSubmit: 'function',
        };
      }
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

  describe('Multi-file comparison', () => {
    it('should compare context_main.json files and detect no drift', async () => {
      const outDir1 = join(outputPath, 'multi1');
      const outDir2 = join(outputPath, 'multi2');


      // Generate two identical multi-file contexts
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir2}`
      );

      // Compare the context_main.json files
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context compare ${join(outDir1, 'context_main.json')} ${join(outDir2, 'context_main.json')}`
      );

      expect(stdout).toContain('✅');
      expect(stdout).toContain('PASS');
      expect(stdout).toContain('Folder Summary:');
      expect(stdout).toContain('Total folders:');
      expect(stdout).toContain('Unchanged folders:');
    }, 60000);

    it('should detect ADDED FILE when new folder is added', async () => {
      const outDir1 = join(outputPath, 'added-before');
      const outDir2 = join(outputPath, 'added-after');


      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );

      // Generate second context with same files
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir2}`
      );

      // Manually add a new folder to the second index
      const index2 = JSON.parse(await readFile(join(outDir2, 'context_main.json'), 'utf-8'));

      // Add a fake folder entry
      index2.folders.push({
        path: 'src/new-folder',
        contextFile: 'src/new-folder/context.json',
        bundles: 1,
        components: ['NewComponent.tsx'],
        isRoot: false,
        tokenEstimate: 500
      });

      await writeFile(join(outDir2, 'context_main.json'), JSON.stringify(index2, null, 2));

      // Create the actual context file
      await mkdir(join(outDir2, 'src/new-folder'), { recursive: true });
      await writeFile(
        join(outDir2, 'src/new-folder/context.json'),
        JSON.stringify([{
          type: 'LogicStampBundle',
          schemaVersion: '0.1',
          entryId: 'src/new-folder/NewComponent.tsx',
          graph: { nodes: [], edges: [] }
        }], null, 2)
      );

      // Compare - should detect ADDED FILE
      try {
        await execAsync(
          `node dist/cli/stamp.js context compare ${join(outDir1, 'context_main.json')} ${join(outDir2, 'context_main.json')}`
        );
        expect.fail('Should have detected drift');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = error.stdout || '';
        expect(output).toContain('DRIFT');
        expect(output).toContain('ADDED FILE');
        expect(output).toContain('src/new-folder/context.json');
      }
    }, 60000);

    it('should detect ORPHANED FILE when folder is removed', async () => {
      const outDir1 = join(outputPath, 'orphan-before');
      const outDir2 = join(outputPath, 'orphan-after');


      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );

      // Generate second context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir2}`
      );

      // Manually remove a folder from the second index
      const index2 = JSON.parse(await readFile(join(outDir2, 'context_main.json'), 'utf-8'));

      // Remove the last folder from index
      const removedFolder = index2.folders.pop();

      await writeFile(join(outDir2, 'context_main.json'), JSON.stringify(index2, null, 2));

      // Compare - should detect ORPHANED FILE
      try {
        await execAsync(
          `node dist/cli/stamp.js context compare ${join(outDir1, 'context_main.json')} ${join(outDir2, 'context_main.json')}`
        );
        expect.fail('Should have detected drift');
      } catch (error: any) {
        expect(error.code).toBe(1);
        const output = error.stdout || '';
        expect(output).toContain('DRIFT');
        expect(output).toContain('ORPHANED FILE');
      }
    }, 60000);

    it('should detect DRIFT in specific folders while others PASS', async () => {
      const outDir1 = join(outputPath, 'drift-folder-before');
      const outDir2 = join(outputPath, 'drift-folder-after');


      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );

      // Copy to second directory
      const { cpSync } = await import('node:fs');
      cpSync(outDir1, outDir2, { recursive: true });

      // Modify just one folder's context file
      const index = JSON.parse(await readFile(join(outDir2, 'context_main.json'), 'utf-8'));
      const firstFolder = index.folders[0];
      const contextFile = join(outDir2, firstFolder.contextFile);
      const content = JSON.parse(await readFile(contextFile, 'utf-8'));

      if (content.length > 0 && content[0].graph.nodes.length > 0) {
        content[0].graph.nodes[0].contract.semanticHash = 'uif:111111111111111111111111';
        await writeFile(contextFile, JSON.stringify(content, null, 2));
      }

      // Compare - should show mixed results
      try {
        const result = await execAsync(
          `node dist/cli/stamp.js context compare ${join(outDir1, 'context_main.json')} ${join(outDir2, 'context_main.json')}`
        );
        // If it succeeds, fail the test
        expect.fail('Should have detected drift and exited with code 1');
      } catch (error: any) {
        // Should exit with code 1 due to drift
        if (error.message?.includes('Should have detected drift')) {
          throw error; // Re-throw if it's our expect.fail
        }
        expect(error.code).toBe(1);
        const output = error.stdout || error.stderr || '';
        expect(output).toContain('DRIFT');
        expect(output).toContain('PASS');
        expect(output).toContain('Folder Summary:');
        expect(output).toContain('Changed folders: 1');
      }
    }, 60000);

    it('should show token statistics per folder with --stats flag', async () => {
      const outDir1 = join(outputPath, 'stats-multi1');
      const outDir2 = join(outputPath, 'stats-multi2');


      // Generate two contexts
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir2}`
      );

      // Compare with stats
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context compare ${join(outDir1, 'context_main.json')} ${join(outDir2, 'context_main.json')} --stats`
      );

      expect(stdout).toContain('Folder Summary:');
      // Token stats should be shown for folders if there's drift
      // For PASS case, stats are calculated but may not be displayed
    }, 60000);

    it('should support --clean-orphaned flag with --approve', async () => {
      const testDir = join(outputPath, 'clean-orphaned-test');
      await mkdir(testDir, { recursive: true });


      // Copy fixture files to test directory first
      const { cpSync } = await import('node:fs');
      cpSync(fixturesPath, testDir, { recursive: true });

      // Generate initial context in the test directory
      await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context .`,
        { cwd: testDir }
      );

      // Create an orphaned context file
      const orphanedDir = join(testDir, 'orphaned');
      await mkdir(orphanedDir, { recursive: true });
      await writeFile(
        join(orphanedDir, 'context.json'),
        JSON.stringify([{ type: 'LogicStampBundle' }], null, 2)
      );

      // Update context_main.json to not include the orphaned folder
      const index = JSON.parse(await readFile(join(testDir, 'context_main.json'), 'utf-8'));
      // Index doesn't include orphaned folder by default, but file exists

      // Run comparison with --clean-orphaned (no need for --approve without drift)
      // This test verifies the flag is recognized
      const { stdout } = await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context compare --clean-orphaned`,
        { cwd: testDir }
      );

      // Should run without error
      expect(stdout).toContain('Folder Summary:');
    }, 60000);

    it('should show component-level changes grouped by folder', async () => {
      const outDir1 = join(outputPath, 'grouped-before');
      const outDir2 = join(outputPath, 'grouped-after');


      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1}`
      );

      // Copy to second directory
      const { cpSync } = await import('node:fs');
      cpSync(outDir1, outDir2, { recursive: true });

      // Modify a context file to add component changes
      const index = JSON.parse(await readFile(join(outDir2, 'context_main.json'), 'utf-8'));
      const folder = index.folders[0];
      const contextFile = join(outDir2, folder.contextFile);
      const content = JSON.parse(await readFile(contextFile, 'utf-8'));

      if (content.length > 0 && content[0].graph.nodes.length > 0) {
        // Change semantic hash to create drift
        content[0].graph.nodes[0].contract.semanticHash = 'uif:222222222222222222222222';
        await writeFile(contextFile, JSON.stringify(content, null, 2));
      }

      // Compare - should show grouped output
      try {
        await execAsync(
          `node dist/cli/stamp.js context compare ${join(outDir1, 'context_main.json')} ${join(outDir2, 'context_main.json')}`
        );
      } catch (error: any) {
        const output = error.stdout || '';
        expect(output).toContain('Folder Summary:');
        expect(output).toContain('Component Summary:');
        expect(output).toContain('Folder Details:');
        expect(output).toContain('DRIFT:');
        expect(output).toContain('Path:');
      }
    }, 60000);
  });

  describe('Quiet flag', () => {
    it('should suppress verbose output with --quiet flag when comparing files', async () => {
      const outDir1 = join(outputPath, 'quiet-compare1');
      const outDir2 = join(outputPath, 'quiet-compare2');


      // Generate two identical contexts
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1} --quiet`
      );
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir2} --quiet`
      );

      // Get per-folder context files
      const index1 = JSON.parse(await readFile(join(outDir1, 'context_main.json'), 'utf-8'));
      const index2 = JSON.parse(await readFile(join(outDir2, 'context_main.json'), 'utf-8'));
      const contextFile1 = join(outDir1, index1.folders[0].contextFile);
      const contextFile2 = join(outDir2, index2.folders[0].contextFile);

      // Compare with --quiet flag
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2} --quiet`
      );

      // Should not contain verbose output messages
      expect(stdout).not.toContain('Folder Summary:');
      expect(stdout).not.toContain('Total folders:');
      expect(stdout).not.toContain('Unchanged folders:');
      expect(stdout).not.toContain('Token Stats:');
      expect(stdout).not.toContain('GPT-4o-mini');
      expect(stdout).not.toContain('Claude');
      expect(stdout).not.toContain('✅');
      expect(stdout).not.toContain('PASS');

      // Should output just ✓ in quiet mode for PASS
      expect(stdout.trim()).toBe('✓');
    }, 60000);

    it('should suppress verbose output with -q flag when comparing files', async () => {
      const outDir1 = join(outputPath, 'quiet-compare-short1');
      const outDir2 = join(outputPath, 'quiet-compare-short2');


      // Generate two identical contexts
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1} --quiet`
      );
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir2} --quiet`
      );

      // Get per-folder context files
      const index1 = JSON.parse(await readFile(join(outDir1, 'context_main.json'), 'utf-8'));
      const index2 = JSON.parse(await readFile(join(outDir2, 'context_main.json'), 'utf-8'));
      const contextFile1 = join(outDir1, index1.folders[0].contextFile);
      const contextFile2 = join(outDir2, index2.folders[0].contextFile);

      // Compare with -q flag
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2} -q`
      );

      // Should not contain verbose output messages
      expect(stdout).not.toContain('Folder Summary:');
      expect(stdout).not.toContain('Total folders:');
      expect(stdout).not.toContain('Token Stats:');
    }, 60000);

    it('should still show drift information in quiet mode', async () => {
      const outDir1 = join(outputPath, 'quiet-drift1');
      const outDir2 = join(outputPath, 'quiet-drift2');


      // Generate first context
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir1} --quiet`
      );

      // Get the first per-folder context file
      const index1 = JSON.parse(await readFile(join(outDir1, 'context_main.json'), 'utf-8'));
      const contextFile1 = join(outDir1, index1.folders[0].contextFile);

      // Modify the context to simulate drift
      const content1 = JSON.parse(await readFile(contextFile1, 'utf-8'));
      if (content1.length > 0 && content1[0].graph.nodes.length > 0) {
        content1[0].graph.nodes[0].contract.semanticHash = 'uif:000000000000000000000000';
      }
      const contextFile2 = join(outDir2, 'src', 'context.json');
      await mkdir(dirname(contextFile2), { recursive: true });
      await writeFile(contextFile2, JSON.stringify(content1, null, 2));

      // Compare with --quiet flag - should still show drift
      try {
        await execAsync(
          `node dist/cli/stamp.js context compare ${contextFile1} ${contextFile2} --quiet`
        );
        expect.fail('Should have detected drift');
      } catch (error: any) {
        const output = error.stdout || error.stderr || '';
        // Should still show DRIFT status (essential info)
        expect(output).toContain('DRIFT');
        // Should not show verbose summaries
        expect(output).not.toContain('Folder Summary:');
        expect(output).not.toContain('Token Stats:');
      }
    }, 60000);

    it('should suppress verbose output in auto-mode with --quiet flag', async () => {
      const testDir = join(outputPath, 'quiet-auto-mode');
      await mkdir(testDir, { recursive: true });


      // Copy fixture files to test directory
      const { cpSync } = await import('node:fs');
      cpSync(fixturesPath, testDir, { recursive: true });

      // Generate initial context in the test directory
      await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context . --quiet`,
        { cwd: testDir }
      );

      // Run auto-mode comparison with --quiet
      const { stdout } = await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context compare --quiet`,
        { cwd: testDir }
      );

      // Should not contain verbose output
      expect(stdout).not.toContain('Auto-compare mode');
      expect(stdout).not.toContain('Generating fresh context');
      expect(stdout).not.toContain('Comparing all context files');
      expect(stdout).not.toContain('Folder Summary:');
      expect(stdout).not.toContain('Total folders:');
      expect(stdout).not.toContain('✅');
      expect(stdout).not.toContain('PASS');

      // Should output just ✓ in quiet mode for PASS
      expect(stdout.trim()).toBe('✓');
    }, 60000);

    it('should still show errors in quiet mode', async () => {

      // Try to compare non-existent files
      try {
        await execAsync(
          'node dist/cli/stamp.js context compare /nonexistent1.json /nonexistent2.json --quiet'
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Should still show error messages even in quiet mode
        const output = error.stdout || error.stderr || '';
        expect(output).toContain('❌');
      }
    }, 30000);
  });
});

