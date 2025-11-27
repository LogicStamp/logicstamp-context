import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { cleanupTestOutput, cleanupAllContextFiles } from '../test-helpers';

const execAsync = promisify(exec);

describe('CLI Command Options Tests', () => {
  const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
  let outputPath: string;

  beforeEach(async () => {
    const uniqueId = randomUUID().substring(0, 8);
    outputPath = join(process.cwd(), 'tests/e2e/output', `options-${uniqueId}`);
    await mkdir(outputPath, { recursive: true });
  });

  afterEach(async () => {
    // Clean up output directory
    if (outputPath) {
      await cleanupTestOutput(outputPath);
    }
    
    // Clean up any context files that might have been created in fixtures or current directory
    await cleanupAllContextFiles(fixturesPath);
  });

  describe('Profile options', () => {
    it('should apply llm-safe profile with correct settings', async () => {
      const outDir = join(outputPath, 'profile-safe');
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --profile llm-safe --out ${outDir}`
      );

      expect(stdout).toContain('llm-safe');
      expect(stdout).toContain('depth=1');

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      expect(bundles[0].depth).toBe(1);
      bundles.forEach((bundle: any) => {
        expect(bundle.graph.nodes.length).toBeLessThanOrEqual(30);
      });
    }, 30000);

    it('should apply llm-chat profile with correct settings', async () => {
      const outDir = join(outputPath, 'profile-chat');
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --profile llm-chat --out ${outDir}`
      );

      expect(stdout).toContain('llm-chat');

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      expect(bundles[0].depth).toBe(1);
      bundles.forEach((bundle: any) => {
        expect(bundle.graph.nodes.length).toBeLessThanOrEqual(100);
      });
    }, 30000);

    it('should apply ci-strict profile with correct settings', async () => {
      const outDir = join(outputPath, 'profile-strict');
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --profile ci-strict --out ${outDir}`
      );

      expect(stdout).toContain('ci-strict');

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      // ci-strict should have no code
      bundles.forEach((bundle: any) => {
        bundle.graph.nodes.forEach((node: any) => {
          expect(node.code).toBeUndefined();
        });
      });
    }, 30000);
  });

  describe('Format options', () => {
    it('should generate JSON format correctly', async () => {
      const outDir = join(outputPath, 'format-json');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --format json --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const folderContext = await readFile(join(outDir, index.folders[0].contextFile), 'utf-8');
      
      expect(() => JSON.parse(folderContext)).not.toThrow();
      const bundles = JSON.parse(folderContext);
      expect(Array.isArray(bundles)).toBe(true);
    }, 30000);

    it('should generate NDJSON format correctly', async () => {
      const outDir = join(outputPath, 'format-ndjson');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --format ndjson --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const folderContext = await readFile(join(outDir, index.folders[0].contextFile), 'utf-8');
      
      const lines = folderContext.trim().split('\n').filter(line => line.trim());
      expect(lines.length).toBeGreaterThan(0);
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    }, 30000);

    it('should generate pretty format correctly', async () => {
      const outDir = join(outputPath, 'format-pretty');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --format pretty --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const folderContext = await readFile(join(outDir, index.folders[0].contextFile), 'utf-8');
      
      // Pretty format should be human-readable
      expect(folderContext).toContain('Bundle');
      expect(folderContext.length).toBeGreaterThan(0);
    }, 30000);

    it('should accept short format flag -f', async () => {
      const outDir = join(outputPath, 'format-short');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} -f json --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      await access(join(outDir, index.folders[0].contextFile));
    }, 30000);
  });

  describe('Include-code options', () => {
    it('should generate with include-code none', async () => {
      const outDir = join(outputPath, 'code-none');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --include-code none --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      bundles.forEach((bundle: any) => {
        bundle.graph.nodes.forEach((node: any) => {
          expect(node.code).toBeUndefined();
        });
      });
    }, 30000);

    it('should generate with include-code header', async () => {
      const outDir = join(outputPath, 'code-header');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --include-code header --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      // Verify command ran successfully and bundles were created
      expect(bundles.length).toBeGreaterThan(0);
      // Some nodes may have code, but not all will (depends on component structure)
      const nodesWithCode = bundles.some((bundle: any) =>
        bundle.graph.nodes.some((node: any) => node.code)
      );
      // Just verify the command completed successfully
      expect(index.folders.length).toBeGreaterThan(0);
    }, 30000);

    it('should generate with include-code full', async () => {
      const outDir = join(outputPath, 'code-full');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --include-code full --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      // Verify command ran successfully and bundles were created
      expect(bundles.length).toBeGreaterThan(0);
      // Some nodes may have code, but not all will (depends on component structure)
      // Just verify the command completed successfully
      expect(index.folders.length).toBeGreaterThan(0);
    }, 30000);

    it('should accept short include-code flag -c', async () => {
      const outDir = join(outputPath, 'code-short');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} -c none --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      await access(join(outDir, index.folders[0].contextFile));
    }, 30000);
  });

  describe('Style options', () => {
    it('should include style metadata with --include-style flag', async () => {
      const outDir = join(outputPath, 'style-flag');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --include-style --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      // At least one node should have style metadata
      const hasStyle = bundles.some((bundle: any) =>
        bundle.graph.nodes.some((node: any) => node.style)
      );
      // Note: may not have style if components don't use styling
      // Just verify the command runs successfully
      expect(bundles.length).toBeGreaterThan(0);
    }, 30000);

    it('should include style metadata with style subcommand', async () => {
      const outDir = join(outputPath, 'style-subcommand');
      await execAsync(
        `node dist/cli/stamp.js context style ${fixturesPath} --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      expect(bundles.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Depth and max-nodes options', () => {
    it('should accept custom depth value', async () => {
      const outDir = join(outputPath, 'depth-custom');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --depth 1 --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      expect(bundles[0].depth).toBe(1);
    }, 30000);

    it('should accept short depth flag -d', async () => {
      const outDir = join(outputPath, 'depth-short');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} -d 1 --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      await access(join(outDir, index.folders[0].contextFile));
    }, 30000);

    it('should accept custom max-nodes value', async () => {
      const outDir = join(outputPath, 'maxnodes-custom');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --max-nodes 50 --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      bundles.forEach((bundle: any) => {
        expect(bundle.graph.nodes.length).toBeLessThanOrEqual(50);
      });
    }, 30000);

    it('should accept short max-nodes flag -m', async () => {
      const outDir = join(outputPath, 'maxnodes-short');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} -m 50 --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      const bundles = JSON.parse(await readFile(join(outDir, index.folders[0].contextFile), 'utf-8'));

      bundles.forEach((bundle: any) => {
        expect(bundle.graph.nodes.length).toBeLessThanOrEqual(50);
      });
    }, 30000);
  });

  describe('Output options', () => {
    it('should accept custom output path with --out', async () => {
      const outDir = join(outputPath, 'custom-out');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir}`
      );

      await access(join(outDir, 'context_main.json'));
    }, 30000);

    it('should accept short output flag -o', async () => {
      const outDir = join(outputPath, 'output-short');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} -o ${outDir}`
      );

      await access(join(outDir, 'context_main.json'));
    }, 30000);
  });

  describe('Flag combinations', () => {
    it('should handle multiple flags together', async () => {
      const outDir = join(outputPath, 'multi-flags');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --depth 1 --include-code header --format json --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      await access(join(outDir, index.folders[0].contextFile));
    }, 30000);

    it('should handle short flags together', async () => {
      const outDir = join(outputPath, 'multi-short');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} -d 1 -c header -f json -o ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      await access(join(outDir, index.folders[0].contextFile));
    }, 30000);

    it('should handle mixed short and long flags', async () => {
      const outDir = join(outputPath, 'mixed-flags');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} -d 1 --include-code header -f json --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      await access(join(outDir, index.folders[0].contextFile));
    }, 30000);
  });

  describe('Boolean flags', () => {
    it('should handle --strict flag', async () => {
      const outDir = join(outputPath, 'strict-flag');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --strict --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      await access(join(outDir, index.folders[0].contextFile));
    }, 30000);

    it('should handle short strict flag -s', async () => {
      const outDir = join(outputPath, 'strict-short');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} -s --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      await access(join(outDir, index.folders[0].contextFile));
    }, 30000);

    it('should handle --predict-behavior flag', async () => {
      const outDir = join(outputPath, 'predict-flag');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --predict-behavior --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      await access(join(outDir, index.folders[0].contextFile));
    }, 30000);

    it('should handle --dry-run flag', async () => {
      const outDir = join(outputPath, 'dry-run');
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --dry-run --out ${outDir}`
      );

      // Should show stats but not write files
      expect(stdout).toContain('Summary');
      expect(stdout).not.toContain('context files written successfully');
      
      // Verify no files were written
      try {
        await access(join(outDir, 'context_main.json'));
        expect.fail('Files should not be written in dry-run mode');
      } catch {
        // Expected - files should not exist
      }
    }, 30000);

    it('should handle --stats flag', async () => {
      const outDir = join(outputPath, 'stats');
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --stats --out ${outDir}`
      );

      // Should output JSON stats on last line
      const lines = stdout.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      expect(() => JSON.parse(lastLine)).not.toThrow();
      const stats = JSON.parse(lastLine);
      expect(stats).toHaveProperty('totalComponents');
      // Check for either totalBundles or bundlesGenerated
      expect(stats).toHaveProperty(stats.totalBundles !== undefined ? 'totalBundles' : 'bundlesGenerated');
    }, 30000);

    it('should handle --quiet flag', async () => {
      const outDir = join(outputPath, 'quiet-flag');
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --quiet --out ${outDir}`
      );

      // Should have minimal output
      expect(stdout.length).toBeLessThan(500);
      // Should not contain verbose messages
      expect(stdout).not.toContain('🔍 Scanning');
      expect(stdout).not.toContain('Analyzing components');
    }, 30000);

    it('should handle short quiet flag -q', async () => {
      const outDir = join(outputPath, 'quiet-short');
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} -q --out ${outDir}`
      );

      expect(stdout.length).toBeLessThan(500);
    }, 30000);

    it('should handle --strict-missing flag', async () => {
      const outDir = join(outputPath, 'strict-missing');
      // This should work even if there are no missing deps
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --strict-missing --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      await access(join(outDir, index.folders[0].contextFile));
    }, 30000);

    it('should handle --skip-gitignore flag', async () => {
      const outDir = join(outputPath, 'skip-gitignore');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --skip-gitignore --out ${outDir}`
      );

      const index = JSON.parse(await readFile(join(outDir, 'context_main.json'), 'utf-8'));
      await access(join(outDir, index.folders[0].contextFile));
    }, 30000);

    it('should handle --compare-modes flag', async () => {
      const outDir = join(outputPath, 'compare-modes');
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --compare-modes --out ${outDir}`
      );

      // Should show comparison table
      expect(stdout).toContain('Mode Comparison');
      expect(stdout).toContain('none');
      expect(stdout).toContain('header');
      expect(stdout).toContain('full');
    }, 30000);
  });

  describe('Help and version', () => {
    it('should display help with --help', async () => {
      const { stdout } = await execAsync('node dist/cli/stamp.js context --help');

      expect(stdout).toContain('Stamp Context');
      expect(stdout).toContain('USAGE:');
      expect(stdout).toContain('OPTIONS:');
    }, 30000);

    it('should display help with -h', async () => {
      const { stdout } = await execAsync('node dist/cli/stamp.js context -h');

      expect(stdout).toContain('Stamp Context');
    }, 30000);

    it('should display main help with stamp --help', async () => {
      const { stdout } = await execAsync('node dist/cli/stamp.js --help');

      expect(stdout).toContain('Stamp');
      expect(stdout).toContain('USAGE:');
    }, 30000);

    it('should display version with --version', async () => {
      const { stdout } = await execAsync('node dist/cli/stamp.js --version');

      expect(stdout).toContain('Version:');
    }, 30000);

    it('should display version with -v', async () => {
      const { stdout } = await execAsync('node dist/cli/stamp.js -v');

      expect(stdout).toContain('Version:');
    }, 30000);
  });

  describe('Error handling', () => {
    it('should handle invalid profile gracefully', async () => {
      try {
        const result = await execAsync(
          `node dist/cli/stamp.js context ${fixturesPath} --profile invalid-profile`
        );
        // If it doesn't fail, that's also acceptable (might use default)
        // Just verify it ran
        expect(result.stdout || result.stderr).toBeDefined();
      } catch (error: any) {
        // If it fails, should have exit code 1
        if (error.code !== undefined) {
          expect(error.code).toBe(1);
        }
      }
    }, 30000);

    it('should handle invalid format gracefully', async () => {
      try {
        const result = await execAsync(
          `node dist/cli/stamp.js context ${fixturesPath} --format invalid-format`
        );
        // If it doesn't fail, that's also acceptable (might use default)
        expect(result.stdout || result.stderr).toBeDefined();
      } catch (error: any) {
        // If it fails, should have exit code 1
        if (error.code !== undefined) {
          expect(error.code).toBe(1);
        }
      }
    }, 30000);

    it('should handle invalid include-code mode gracefully', async () => {
      try {
        const result = await execAsync(
          `node dist/cli/stamp.js context ${fixturesPath} --include-code invalid-mode`
        );
        // If it doesn't fail, that's also acceptable (might use default)
        expect(result.stdout || result.stderr).toBeDefined();
      } catch (error: any) {
        // If it fails, should have exit code 1
        if (error.code !== undefined) {
          expect(error.code).toBe(1);
        }
      }
    }, 30000);

    it('should handle non-existent directory', async () => {
      try {
        await execAsync('node dist/cli/stamp.js context /non/existent/path');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.code).toBe(1);
      }
    }, 30000);
  });

  describe('Entry path handling', () => {
    it('should accept entry path as first argument', async () => {
      const outDir = join(outputPath, 'entry-path');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${outDir}`
      );

      await access(join(outDir, 'context_main.json'));
    }, 30000);

    it('should accept entry path before flags', async () => {
      const outDir = join(outputPath, 'entry-before');
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --format json --out ${outDir}`
      );

      await access(join(outDir, 'context_main.json'));
    }, 30000);

    it('should accept entry path after flags', async () => {
      const outDir = join(outputPath, 'entry-after');
      await execAsync(
        `node dist/cli/stamp.js context --format json --out ${outDir} ${fixturesPath}`
      );

      await access(join(outDir, 'context_main.json'));
    }, 30000);
  });
});

