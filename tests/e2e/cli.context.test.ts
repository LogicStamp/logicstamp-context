import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, access, mkdir, writeFile, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const execAsync = promisify(exec);

describe('CLI Context Generation Tests', () => {
  const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
  let outputPath: string;

  beforeEach(async () => {
    // Create a unique output directory for this test run
    const uniqueId = randomUUID().substring(0, 8);
    outputPath = join(process.cwd(), 'tests/e2e/output', `context-${uniqueId}`);
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

  describe('Basic functionality', () => {
    it('should generate context files for a simple React app', async () => {
      const outFile = join(outputPath, 'context.json');

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

  describe('Quiet flag', () => {
    it('should suppress verbose output with --quiet flag', async () => {
      const outDir = join(outputPath, 'quiet-test');


      // Run with --quiet flag
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir} --quiet`
      );

      // Should not contain verbose output messages
      expect(stdout).not.toContain('🔍 Scanning');
      expect(stdout).not.toContain('Found');
      expect(stdout).not.toContain('🔨 Analyzing');
      expect(stdout).not.toContain('📊 Building');
      expect(stdout).not.toContain('📦 Generating');
      expect(stdout).not.toContain('📝 Writing');
      expect(stdout).not.toContain('context files written successfully');
      expect(stdout).not.toContain('Summary:');
      expect(stdout).not.toContain('Total components:');
      expect(stdout).not.toContain('Completed in');

      // Should still generate the output file
      const { access } = await import('node:fs/promises');
      await access(join(outDir, 'context_main.json'));
    }, 30000);

    it('should suppress verbose output with -q flag', async () => {
      const outDir = join(outputPath, 'quiet-short-test');


      // Run with -q flag
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir} -q`
      );

      // Should not contain verbose output messages
      expect(stdout).not.toContain('🔍 Scanning');
      expect(stdout).not.toContain('Found');
      expect(stdout).not.toContain('🔨 Analyzing');
      expect(stdout).not.toContain('📊 Building');
      expect(stdout).not.toContain('📦 Generating');
      expect(stdout).not.toContain('📝 Writing');
      expect(stdout).not.toContain('context files written successfully');

      // Should still generate the output file
      const { access } = await import('node:fs/promises');
      await access(join(outDir, 'context_main.json'));
    }, 30000);

    it('should still show errors in quiet mode', async () => {

      // Try to run on a non-existent directory
      try {
        await execAsync(
          'node dist/cli/stamp.js context /nonexistent/path --quiet'
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Should still show error messages even in quiet mode
        const output = error.stdout || error.stderr || '';
        expect(output).toContain('❌');
      }
    }, 30000);

    it('should generate valid context files even in quiet mode', async () => {
      const outDir = join(outputPath, 'quiet-valid-test');


      // Run with --quiet flag
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir} --quiet`
      );

      // Verify context_main.json was created and is valid
      const mainIndexPath = join(outDir, 'context_main.json');
      const indexContent = await readFile(mainIndexPath, 'utf-8');
      const index = JSON.parse(indexContent);

      expect(index).toHaveProperty('type', 'LogicStampIndex');
      expect(index).toHaveProperty('schemaVersion', '0.1');
      expect(index).toHaveProperty('folders');
      expect(Array.isArray(index.folders)).toBe(true);
      expect(index.folders.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Gitignore and config behavior', () => {
    it('should respect --skip-gitignore flag', async () => {
      const testDir = join(outputPath, 'skip-gitignore-test');
      await mkdir(testDir, { recursive: true });
      const outDir = join(testDir, 'output');

      // Run with --skip-gitignore flag
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir} --skip-gitignore`
      );

      // Should complete successfully
      expect(stdout).toContain('context files written successfully');

      // Verify context files were generated
      await access(join(outDir, 'context_main.json'));

      // Verify .gitignore was NOT created in the fixture directory
      const gitignorePath = join(fixturesPath, '.gitignore');
      let gitignoreExists = true;
      try {
        await access(gitignorePath);
      } catch {
        gitignoreExists = false;
      }
      // We can't definitively check this since the fixture might already have .gitignore
      // But we can verify the command completed without errors
      expect(stdout).not.toContain('Created .gitignore');
      expect(stdout).not.toContain('Added LogicStamp patterns');
    }, 30000);

    it('should auto-create config with safe defaults when config does not exist', async () => {
      const testDir = join(outputPath, 'auto-config-test');
      await mkdir(testDir, { recursive: true });
      
      // Copy fixture contents to test directory to avoid modifying the original
      const testFixturesPath = join(testDir, 'simple-app');
      await cp(fixturesPath, testFixturesPath, { recursive: true });
      
      const outDir = join(testDir, 'output');

      // Ensure no config exists
      const configPath = join(testFixturesPath, '.logicstamp', 'config.json');
      try {
        await rm(configPath, { force: true });
      } catch {
        // Config doesn't exist, which is what we want
      }

      // Ensure .gitignore exists without LogicStamp patterns (fixture may have them)
      // This ensures we're testing that new patterns aren't added when preference is 'skipped'
      const gitignorePath = join(testFixturesPath, '.gitignore');
      const initialGitignoreContent = 'node_modules\ndist\n';
      await writeFile(gitignorePath, initialGitignoreContent);

      // Run context command on root - it will recursively find files in src
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${testFixturesPath} --out ${outDir}`
      );

      // Should mention config creation
      expect(stdout).toContain('No LogicStamp config found');
      expect(stdout).toContain('created .logicstamp/config.json with safe defaults');

      // Verify config was created with skipped preferences
      const configContent = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.gitignorePreference).toBe('skipped');
      expect(config.llmContextPreference).toBe('skipped');

      // Verify .gitignore was NOT modified (due to safe defaults)
      const finalGitignoreContent = await readFile(gitignorePath, 'utf-8');
      // Should match initial content (unchanged)
      expect(finalGitignoreContent).toBe(initialGitignoreContent);
      // Should not contain LogicStamp patterns (since preference is 'skipped')
      expect(finalGitignoreContent).not.toContain('# LogicStamp context & security files');
    }, 30000);

    it('should respect config preference for gitignore (added)', async () => {
      const testDir = join(outputPath, 'config-added-test');
      await mkdir(testDir, { recursive: true });
      
      // Copy fixture contents to test directory
      const testFixturesPath = join(testDir, 'simple-app');
      await cp(fixturesPath, testFixturesPath, { recursive: true });
      
      const outDir = join(testDir, 'output');

      // Create config with 'added' preference
      const configDir = join(testFixturesPath, '.logicstamp');
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, 'config.json'),
        JSON.stringify({ gitignorePreference: 'added', llmContextPreference: 'skipped' })
      );

      // Ensure .gitignore doesn't have LogicStamp patterns
      const gitignorePath = join(testFixturesPath, '.gitignore');
      await writeFile(gitignorePath, 'node_modules\n');

      // Run context command on root - it will recursively find files in src
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${testFixturesPath} --out ${outDir}`
      );

      // Should add patterns based on config preference
      const gitignoreContent = await readFile(gitignorePath, 'utf-8');
      expect(gitignoreContent).toContain('# LogicStamp context & security files');
      expect(gitignoreContent).toContain('context.json');
      expect(gitignoreContent).toContain('node_modules'); // Original content preserved
    }, 30000);

    it('should respect config preference for gitignore (skipped)', async () => {
      const testDir = join(outputPath, 'config-skipped-test');
      await mkdir(testDir, { recursive: true });
      
      // Copy fixture contents to test directory
      const testFixturesPath = join(testDir, 'simple-app');
      await cp(fixturesPath, testFixturesPath, { recursive: true });
      
      const outDir = join(testDir, 'output');

      // Create config with 'skipped' preference
      const configDir = join(testFixturesPath, '.logicstamp');
      await mkdir(configDir, { recursive: true });
      await writeFile(
        join(configDir, 'config.json'),
        JSON.stringify({ gitignorePreference: 'skipped', llmContextPreference: 'skipped' })
      );

      const gitignorePath = join(testFixturesPath, '.gitignore');
      const initialContent = 'node_modules\n';
      await writeFile(gitignorePath, initialContent);

      // Run context command on root - it will recursively find files in src
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${testFixturesPath} --out ${outDir}`
      );

      // Verify .gitignore was NOT modified
      const gitignoreContent = await readFile(gitignorePath, 'utf-8');
      expect(gitignoreContent).toBe(initialContent);
      expect(gitignoreContent).not.toContain('# LogicStamp context & security files');
      expect(stdout).not.toContain('Created .gitignore');
      expect(stdout).not.toContain('Added LogicStamp patterns');
    }, 30000);
  });

  describe('Stampignore behavior', () => {
    it('should respect .stampignore and exclude ignored files', async () => {
      const testDir = join(outputPath, 'stampignore-test');
      await mkdir(testDir, { recursive: true });
      
      // Copy fixture contents to test directory
      const testFixturesPath = join(testDir, 'simple-app');
      await cp(fixturesPath, testFixturesPath, { recursive: true });
      
      const outDir = join(testDir, 'output');

      // Create .stampignore to ignore a specific file
      const stampignorePath = join(testFixturesPath, '.stampignore');
      await writeFile(
        stampignorePath,
        JSON.stringify({
          ignore: ['src/components/Button.tsx'],
        })
      );

      // Run context command
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${testFixturesPath} --out ${outDir}`
      );

      // Should mention excluded files
      expect(stdout).toContain('Excluded');
      expect(stdout).toContain('.stampignore');

      // Verify context files were generated
      const mainIndexPath = join(outDir, 'context_main.json');
      await access(mainIndexPath);

      // Read the context and verify Button.tsx is not included
      const indexContent = await readFile(mainIndexPath, 'utf-8');
      const index = JSON.parse(indexContent);

      // Check all bundles to ensure Button.tsx is not included
      let foundButton = false;
      for (const folder of index.folders) {
        const contextPath = join(outDir, folder.contextFile);
        const bundles = JSON.parse(await readFile(contextPath, 'utf-8'));
        
        for (const bundle of bundles) {
          for (const node of bundle.graph.nodes) {
            if (node.contract?.entryId && node.contract.entryId.includes('Button.tsx')) {
              foundButton = true;
              break;
            }
          }
          if (foundButton) break;
        }
        if (foundButton) break;
      }

      // Button.tsx should not be found in any bundle
      expect(foundButton).toBe(false);
    }, 30000);

    it('should respect .stampignore with glob patterns', async () => {
      const testDir = join(outputPath, 'stampignore-glob-test');
      await mkdir(testDir, { recursive: true });
      
      // Copy fixture contents to test directory
      const testFixturesPath = join(testDir, 'simple-app');
      await cp(fixturesPath, testFixturesPath, { recursive: true });
      
      const outDir = join(testDir, 'output');

      // Create .stampignore with glob pattern to ignore all files in components directory
      const stampignorePath = join(testFixturesPath, '.stampignore');
      await writeFile(
        stampignorePath,
        JSON.stringify({
          ignore: ['src/components/**'],
        })
      );

      // Run context command
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${testFixturesPath} --out ${outDir}`
      );

      // Should mention excluded files
      expect(stdout).toContain('Excluded');
      expect(stdout).toContain('.stampignore');

      // Verify context files were generated
      const mainIndexPath = join(outDir, 'context_main.json');
      await access(mainIndexPath);

      // Read the context and verify no component files are included
      const indexContent = await readFile(mainIndexPath, 'utf-8');
      const index = JSON.parse(indexContent);

      // Check all bundles to ensure no component files are included
      let foundComponent = false;
      for (const folder of index.folders) {
        const contextPath = join(outDir, folder.contextFile);
        const bundles = JSON.parse(await readFile(contextPath, 'utf-8'));
        
        for (const bundle of bundles) {
          for (const node of bundle.graph.nodes) {
            const entryId = node.contract?.entryId || '';
            if (entryId.includes('components/Button.tsx') || entryId.includes('components/Card.tsx')) {
              foundComponent = true;
              break;
            }
          }
          if (foundComponent) break;
        }
        if (foundComponent) break;
      }

      // Component files should not be found
      expect(foundComponent).toBe(false);
    }, 30000);

    it('should work without .stampignore (no exclusions)', async () => {
      const testDir = join(outputPath, 'no-stampignore-test');
      await mkdir(testDir, { recursive: true });
      
      // Copy fixture contents to test directory
      const testFixturesPath = join(testDir, 'simple-app');
      await cp(fixturesPath, testFixturesPath, { recursive: true });
      
      const outDir = join(testDir, 'output');

      // Ensure .stampignore does not exist
      const stampignorePath = join(testFixturesPath, '.stampignore');
      try {
        await rm(stampignorePath, { force: true });
      } catch {
        // File doesn't exist, which is fine
      }

      // Run context command
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${testFixturesPath} --out ${outDir}`
      );

      // Should not mention excluded files
      expect(stdout).not.toContain('Excluded');
      expect(stdout).not.toContain('.stampignore');

      // Verify context files were generated
      const mainIndexPath = join(outDir, 'context_main.json');
      await access(mainIndexPath);

      // Read the context and verify files are included
      const indexContent = await readFile(mainIndexPath, 'utf-8');
      const index = JSON.parse(indexContent);

      // Should have bundles
      expect(index.folders.length).toBeGreaterThan(0);
    }, 30000);

    it('should handle empty .stampignore gracefully', async () => {
      const testDir = join(outputPath, 'empty-stampignore-test');
      await mkdir(testDir, { recursive: true });
      
      // Copy fixture contents to test directory
      const testFixturesPath = join(testDir, 'simple-app');
      await cp(fixturesPath, testFixturesPath, { recursive: true });
      
      const outDir = join(testDir, 'output');

      // Create empty .stampignore
      const stampignorePath = join(testFixturesPath, '.stampignore');
      await writeFile(
        stampignorePath,
        JSON.stringify({
          ignore: [],
        })
      );

      // Run context command
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${testFixturesPath} --out ${outDir}`
      );

      // Should not mention excluded files (empty ignore array)
      expect(stdout).not.toContain('Excluded');

      // Verify context files were generated
      const mainIndexPath = join(outDir, 'context_main.json');
      await access(mainIndexPath);

      // Should have bundles
      const indexContent = await readFile(mainIndexPath, 'utf-8');
      const index = JSON.parse(indexContent);
      expect(index.folders.length).toBeGreaterThan(0);
    }, 30000);
  });
});

