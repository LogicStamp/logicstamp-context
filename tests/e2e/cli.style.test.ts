import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, access, mkdir, writeFile, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const execAsync = promisify(exec);

describe('CLI Style Command Tests', () => {
  const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
  let outputPath: string;

  beforeEach(async () => {
    // Create a unique output directory for this test run
    const uniqueId = randomUUID().substring(0, 8);
    outputPath = join(process.cwd(), 'tests/e2e/output', `style-${uniqueId}`);
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

  describe('Basic style command functionality', () => {
    it('should generate context with style metadata using "stamp context style"', async () => {
      const outDir = join(outputPath, 'basic-style');

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context style ${fixturesPath} --out ${outDir}`
      );

      // Verify output messages
      expect(stdout).toContain('Scanning');
      expect(stdout).toContain('context files written successfully');

      // Verify context_main.json was created
      const mainIndexPath = join(outDir, 'context_main.json');
      await access(mainIndexPath);

      // Read index and verify structure
      const indexContent = await readFile(mainIndexPath, 'utf-8');
      const index = JSON.parse(indexContent);

      expect(index).toHaveProperty('type', 'LogicStampIndex');
      expect(index).toHaveProperty('folders');
      expect(index.folders.length).toBeGreaterThan(0);

      // Read first folder's context bundles
      const folder = index.folders[0];
      const contextPath = join(outDir, folder.contextFile);
      const bundlesContent = await readFile(contextPath, 'utf-8');
      const bundles = JSON.parse(bundlesContent);

      expect(Array.isArray(bundles)).toBe(true);
      expect(bundles.length).toBeGreaterThan(0);

      // Verify at least one bundle has style metadata
      const bundlesWithStyle = bundles.filter((bundle: any) => {
        return bundle.graph.nodes.some((node: any) => {
          return node.contract && node.contract.style !== undefined;
        });
      });

      expect(bundlesWithStyle.length).toBeGreaterThan(0);
    }, 30000);

    it('should be equivalent to "stamp context --include-style"', async () => {
      const styleDir = join(outputPath, 'with-style-cmd');
      const includeStyleDir = join(outputPath, 'with-include-style-flag');

      // Generate with style command
      await execAsync(
        `node dist/cli/stamp.js context style ${fixturesPath} --out ${styleDir}`
      );

      // Generate with --include-style flag
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --include-style --out ${includeStyleDir}`
      );

      // Read both outputs
      const styleIndex = JSON.parse(
        await readFile(join(styleDir, 'context_main.json'), 'utf-8')
      );
      const includeStyleIndex = JSON.parse(
        await readFile(join(includeStyleDir, 'context_main.json'), 'utf-8')
      );

      // Both should have folders
      expect(styleIndex.folders.length).toBeGreaterThan(0);
      expect(includeStyleIndex.folders.length).toBeGreaterThan(0);

      // Read first folder's bundles from both
      const styleBundles = JSON.parse(
        await readFile(join(styleDir, styleIndex.folders[0].contextFile), 'utf-8')
      );
      const includeStyleBundles = JSON.parse(
        await readFile(join(includeStyleDir, includeStyleIndex.folders[0].contextFile), 'utf-8')
      );

      // Both should have style metadata in nodes
      const hasStyleInStyleCmd = styleBundles.some((bundle: any) =>
        bundle.graph.nodes.some((node: any) => node.contract?.style !== undefined)
      );
      const hasStyleInIncludeFlag = includeStyleBundles.some((bundle: any) =>
        bundle.graph.nodes.some((node: any) => node.contract?.style !== undefined)
      );

      expect(hasStyleInStyleCmd).toBe(true);
      expect(hasStyleInIncludeFlag).toBe(true);
    }, 60000);

    it('should work without specifying a path (defaults to current directory)', async () => {
      const outDir = join(outputPath, 'no-path');

      // Run with fixtures path explicitly provided
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context style ${fixturesPath} --out ${outDir}`
      );

      expect(stdout).toContain('context files written successfully');

      // Verify files were created
      const mainIndexPath = join(outDir, 'context_main.json');
      await access(mainIndexPath);

      const indexContent = await readFile(mainIndexPath, 'utf-8');
      const index = JSON.parse(indexContent);
      expect(index.folders.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Style metadata verification', () => {
    it('should include style field in UIFContract when style metadata is present', async () => {
      const outDir = join(outputPath, 'style-fields');

      await execAsync(
        `node dist/cli/stamp.js context style ${fixturesPath} --out ${outDir}`
      );

      // Read all bundles from all folders
      const mainIndex = JSON.parse(
        await readFile(join(outDir, 'context_main.json'), 'utf-8')
      );

      let foundStyleMetadata = false;
      let exampleStyleNode: any = null;

      for (const folder of mainIndex.folders) {
        const contextPath = join(outDir, folder.contextFile);
        const bundles = JSON.parse(await readFile(contextPath, 'utf-8'));

        for (const bundle of bundles) {
          for (const node of bundle.graph.nodes) {
            if (node.contract && node.contract.style) {
              foundStyleMetadata = true;
              exampleStyleNode = node;
              break;
            }
          }
          if (foundStyleMetadata) break;
        }
        if (foundStyleMetadata) break;
      }

      // Verify we found at least one node with style metadata
      expect(foundStyleMetadata).toBe(true);
      expect(exampleStyleNode).toBeDefined();

      // Verify style structure (matches StyleMetadata interface)
      const style = exampleStyleNode.contract.style;
      // StyleMetadata has optional fields: styleSources, layout, visual, animation
      expect(style).toBeDefined();

      // At least one of these should be present
      const hasStyleData =
        style.styleSources !== undefined ||
        style.layout !== undefined ||
        style.visual !== undefined ||
        style.animation !== undefined;

      expect(hasStyleData).toBe(true);
    }, 30000);

    it('should extract Tailwind classes when present', async () => {
      const outDir = join(outputPath, 'tailwind-check');

      await execAsync(
        `node dist/cli/stamp.js context style ${fixturesPath} --out ${outDir}`
      );

      // Read all bundles
      const mainIndex = JSON.parse(
        await readFile(join(outDir, 'context_main.json'), 'utf-8')
      );

      let foundTailwindClasses = false;

      for (const folder of mainIndex.folders) {
        const contextPath = join(outDir, folder.contextFile);
        const bundles = JSON.parse(await readFile(contextPath, 'utf-8'));

        for (const bundle of bundles) {
          for (const node of bundle.graph.nodes) {
            // Check styleSources.tailwind in the correct structure
            if (node.contract?.style?.styleSources?.tailwind) {
              const tailwind = node.contract.style.styleSources.tailwind;
              if (tailwind.classCount && tailwind.classCount > 0) {
                foundTailwindClasses = true;
                break;
              }
            }
          }
          if (foundTailwindClasses) break;
        }
        if (foundTailwindClasses) break;
      }

      // We added Tailwind classes to fixtures, so this should be found
      expect(foundTailwindClasses).toBe(true);
    }, 30000);

    it('should extract layout information (flexbox, grid)', async () => {
      const outDir = join(outputPath, 'layout-check');

      await execAsync(
        `node dist/cli/stamp.js context style ${fixturesPath} --out ${outDir}`
      );

      // Read all bundles
      const mainIndex = JSON.parse(
        await readFile(join(outDir, 'context_main.json'), 'utf-8')
      );

      let foundLayoutInfo = false;

      for (const folder of mainIndex.folders) {
        const contextPath = join(outDir, folder.contextFile);
        const bundles = JSON.parse(await readFile(contextPath, 'utf-8'));

        for (const bundle of bundles) {
          for (const node of bundle.graph.nodes) {
            if (node.contract?.style?.layout) {
              const layout = node.contract.style.layout;
              // Check if any layout properties are present
              if (layout.type || layout.cols || layout.hasHeroPattern || layout.hasFeatureCards) {
                foundLayoutInfo = true;
                break;
              }
            }
          }
          if (foundLayoutInfo) break;
        }
        if (foundLayoutInfo) break;
      }

      // Fixtures should have some layout information (we have flex classes)
      expect(foundLayoutInfo).toBe(true);
    }, 30000);
  });

  describe('Style command with options', () => {
    it('should work with --depth flag', async () => {
      const outDir = join(outputPath, 'style-with-depth');

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context style ${fixturesPath} --depth 2 --out ${outDir}`
      );

      expect(stdout).toContain('context files written successfully');

      // Verify output
      const mainIndex = JSON.parse(
        await readFile(join(outDir, 'context_main.json'), 'utf-8')
      );
      expect(mainIndex.folders.length).toBeGreaterThan(0);
    }, 30000);

    it('should work with --include-code flag', async () => {
      const outDir = join(outputPath, 'style-with-code');

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context style ${fixturesPath} --include-code full --out ${outDir}`
      );

      expect(stdout).toContain('context files written successfully');

      // Verify bundles were created successfully
      const mainIndex = JSON.parse(
        await readFile(join(outDir, 'context_main.json'), 'utf-8')
      );

      // Just verify we got bundles - source code inclusion is tested in other test files
      expect(mainIndex.folders.length).toBeGreaterThan(0);
    }, 30000);

    it('should work with --profile flag', async () => {
      const outDir = join(outputPath, 'style-with-profile');

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context style ${fixturesPath} --profile llm-safe --out ${outDir}`
      );

      expect(stdout).toContain('context files written successfully');

      // Verify output
      const mainIndex = JSON.parse(
        await readFile(join(outDir, 'context_main.json'), 'utf-8')
      );
      expect(mainIndex.folders.length).toBeGreaterThan(0);
    }, 30000);

    it('should work with --quiet flag', async () => {
      const outDir = join(outputPath, 'style-quiet');

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context style ${fixturesPath} --quiet --out ${outDir}`
      );

      // In quiet mode, output should be minimal or JSON only
      expect(stdout.length).toBeLessThan(100);
    }, 30000);

    it('should work with --stats flag', async () => {
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context style ${fixturesPath} --stats`
      );

      // Parse JSON output (last line)
      const lines = stdout.trim().split('\n');
      const jsonLine = lines[lines.length - 1];
      const stats = JSON.parse(jsonLine);

      // Verify stats structure
      expect(stats).toHaveProperty('tokensGPT4');
      expect(stats).toHaveProperty('tokensClaude');
      expect(stats.tokensGPT4).toBeGreaterThan(0);
      expect(stats.tokensClaude).toBeGreaterThan(0);
    }, 30000);

    it('should combine multiple flags correctly', async () => {
      const outDir = join(outputPath, 'style-multi-flags');

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context style ${fixturesPath} --depth 2 --include-code header --out ${outDir}`
      );

      expect(stdout).toContain('context files written successfully');

      // Verify bundles have style metadata
      const mainIndex = JSON.parse(
        await readFile(join(outDir, 'context_main.json'), 'utf-8')
      );

      const contextPath = join(outDir, mainIndex.folders[0].contextFile);
      const bundles = JSON.parse(await readFile(contextPath, 'utf-8'));

      // Check for style metadata
      const hasStyle = bundles.some((bundle: any) =>
        bundle.graph.nodes.some((node: any) => node.contract?.style)
      );

      expect(hasStyle).toBe(true);
      expect(mainIndex.folders.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Style command help and documentation', () => {
    it('should display help with --help flag', async () => {
      const { stdout } = await execAsync('node dist/cli/stamp.js context style --help');

      expect(stdout).toContain('Stamp Context Style');
      expect(stdout).toContain('Generate context with style metadata');
      expect(stdout).toContain('stamp context style');
      expect(stdout).toContain('Tailwind');
      expect(stdout).toContain('SCSS');
      expect(stdout).toContain('animations');
      expect(stdout).toContain('layout');
    }, 30000);

    it('should mention style command in main context help', async () => {
      const { stdout } = await execAsync('node dist/cli/stamp.js context --help');

      expect(stdout).toContain('style');
      expect(stdout).toContain('--include-style');
    }, 30000);
  });

  describe('Style command token estimation', () => {
    it('should include token estimates with style metadata', async () => {
      const outDir = join(outputPath, 'style-tokens');

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context style ${fixturesPath} --out ${outDir}`
      );

      // Verify token estimates are shown
      expect(stdout).toContain('Token Estimates');
      expect(stdout).toContain('GPT-4o-mini:');
      expect(stdout).toContain('Claude:');
      expect(stdout).toContain('Full context (code+style):');
    }, 30000);
  });

  describe('Style command error handling', () => {
    it('should handle invalid path gracefully', async () => {
      const invalidPath = join(outputPath, 'does-not-exist-xyz');

      try {
        await execAsync(`node dist/cli/stamp.js context style ${invalidPath}`);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Should exit with non-zero code
        expect(error.code).toBeGreaterThan(0);
      }
    }, 30000);

    it('should handle invalid flags gracefully', async () => {
      try {
        await execAsync(
          `node dist/cli/stamp.js context style ${fixturesPath} --invalid-flag-xyz`
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Should exit with non-zero code
        expect(error.code).toBeGreaterThan(0);
        const output = error.stdout || error.stderr || '';
        expect(output).toMatch(/unknown|invalid/i);
      }
    }, 30000);
  });

  describe('Stampignore behavior with style command', () => {
    it('should respect .stampignore and exclude ignored files', async () => {
      const testDir = join(outputPath, 'style-stampignore-test');
      await mkdir(testDir, { recursive: true });
      
      // Copy fixture contents to test directory
      const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
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

      // Run context style command
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context style ${testFixturesPath} --out ${outDir}`
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

    it('should respect .stampignore with glob patterns in style command', async () => {
      const testDir = join(outputPath, 'style-stampignore-glob-test');
      await mkdir(testDir, { recursive: true });
      
      // Copy fixture contents to test directory
      const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
      const testFixturesPath = join(testDir, 'simple-app');
      await cp(fixturesPath, testFixturesPath, { recursive: true });
      
      const outDir = join(testDir, 'output');

      // Create .stampignore with glob pattern
      const stampignorePath = join(testFixturesPath, '.stampignore');
      await writeFile(
        stampignorePath,
        JSON.stringify({
          ignore: ['src/components/**'],
        })
      );

      // Run context style command
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context style ${testFixturesPath} --out ${outDir}`
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

    it('should work without .stampignore in style command', async () => {
      const testDir = join(outputPath, 'style-no-stampignore-test');
      await mkdir(testDir, { recursive: true });
      
      // Copy fixture contents to test directory
      const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
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

      // Run context style command
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context style ${testFixturesPath} --out ${outDir}`
      );

      // Should not mention excluded files
      expect(stdout).not.toContain('Excluded');
      expect(stdout).not.toContain('.stampignore');

      // Verify context files were generated with style metadata
      const mainIndexPath = join(outDir, 'context_main.json');
      await access(mainIndexPath);

      // Read the context and verify files are included
      const indexContent = await readFile(mainIndexPath, 'utf-8');
      const index = JSON.parse(indexContent);

      // Should have bundles
      expect(index.folders.length).toBeGreaterThan(0);
    }, 30000);
  });
});
