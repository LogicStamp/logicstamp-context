import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, access, mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const execAsync = promisify(exec);

describe('CLI Clean Command Tests', () => {
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

  describe('Dry run mode', () => {
    it('should show what would be removed without actually deleting', async () => {
      const testDir = join(outputPath, 'clean-dry-run');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Generate context files first
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${testDir}`
      );

      // Verify files exist
      const mainContextPath = join(testDir, 'context_main.json');
      await access(mainContextPath);

      // Run clean in dry run mode (default)
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context clean ${testDir}`
      );

      // Verify output shows what would be removed
      expect(stdout).toContain('🧹 This will remove:');
      expect(stdout).toContain('context_main.json');
      expect(stdout).toContain('Run with --all --yes to confirm');

      // Verify files still exist (dry run didn't delete)
      await access(mainContextPath);
    }, 30000);

    it('should show all context.json files that would be removed', async () => {
      const testDir = join(outputPath, 'clean-dry-run-multiple');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Generate context files
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${testDir}`
      );

      // Run clean in dry run mode
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context clean ${testDir}`
      );

      // Should show context_main.json
      expect(stdout).toContain('context_main.json');

      // Should show at least one context.json file
      const index = JSON.parse(await readFile(join(testDir, 'context_main.json'), 'utf-8'));
      if (index.folders && index.folders.length > 0) {
        const firstFolder = index.folders[0];
        expect(stdout).toContain(firstFolder.contextFile);
      }
    }, 30000);

    it('should show message when no context files exist', async () => {
      const testDir = join(outputPath, 'clean-no-files');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Run clean on empty directory
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context clean ${testDir}`
      );

      // Should show no files found message
      expect(stdout).toContain('No context artifacts found');
    }, 30000);
  });

  describe('Actual deletion', () => {
    it('should delete context_main.json and all context.json files with --all --yes', async () => {
      const testDir = join(outputPath, 'clean-delete');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Generate context files
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${testDir}`
      );

      // Verify files exist before deletion
      const mainContextPath = join(testDir, 'context_main.json');
      await access(mainContextPath);

      const index = JSON.parse(await readFile(mainContextPath, 'utf-8'));
      const contextFiles: string[] = [];
      for (const folder of index.folders) {
        const contextFile = join(testDir, folder.contextFile);
        await access(contextFile);
        contextFiles.push(contextFile);
      }

      // Run clean with --all --yes
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context clean ${testDir} --all --yes`
      );

      // Verify output shows deletion
      expect(stdout).toContain('🗑️  Removing files');
      expect(stdout).toContain('Removed');
      expect(stdout).toContain('Cleaned');

      // Verify context_main.json is deleted
      let exists = true;
      try {
        await access(mainContextPath);
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);

      // Verify all context.json files are deleted
      for (const contextFile of contextFiles) {
        exists = true;
        try {
          await access(contextFile);
        } catch {
          exists = false;
        }
        expect(exists).toBe(false);
      }
    }, 30000);

    it('should not delete files without --all --yes flags', async () => {
      const testDir = join(outputPath, 'clean-no-flags');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Generate context files
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${testDir}`
      );

      const mainContextPath = join(testDir, 'context_main.json');
      await access(mainContextPath);

      // Try to run clean without --all --yes (should be dry run)
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context clean ${testDir}`
      );

      // Should show dry run message
      expect(stdout).toContain('Run with --all --yes');

      // Files should still exist
      await access(mainContextPath);
    }, 30000);

    it('should not delete files with only --all flag (missing --yes)', async () => {
      const testDir = join(outputPath, 'clean-all-only');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Generate context files
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${testDir}`
      );

      const mainContextPath = join(testDir, 'context_main.json');
      await access(mainContextPath);

      // Try to run clean with only --all (should be dry run)
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context clean ${testDir} --all`
      );

      // Should show dry run message
      expect(stdout).toContain('Run with --all --yes');

      // Files should still exist
      await access(mainContextPath);
    }, 30000);

    it('should not delete files with only --yes flag (missing --all)', async () => {
      const testDir = join(outputPath, 'clean-yes-only');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Generate context files
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${testDir}`
      );

      const mainContextPath = join(testDir, 'context_main.json');
      await access(mainContextPath);

      // Try to run clean with only --yes (should be dry run)
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context clean ${testDir} --yes`
      );

      // Should show dry run message
      expect(stdout).toContain('Run with --all --yes');

      // Files should still exist
      await access(mainContextPath);
    }, 30000);
  });

  describe('.logicstamp directory', () => {
    it('should detect and remove .logicstamp directory if it exists', async () => {
      const testDir = join(outputPath, 'clean-logicstamp');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Generate context files
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${testDir}`
      );

      // Create .logicstamp directory and config file
      const logicstampDir = join(testDir, '.logicstamp');
      await mkdir(logicstampDir, { recursive: true });
      await writeFile(
        join(logicstampDir, 'config.json'),
        JSON.stringify({ gitignorePreference: 'added' })
      );

      // Verify .logicstamp exists
      await access(logicstampDir);

      // Run clean in dry run mode first
      const { stdout: dryRunOutput } = await execAsync(
        `node dist/cli/stamp.js context clean ${testDir}`
      );

      // Should show .logicstamp/ in the list
      expect(dryRunOutput).toContain('.logicstamp/');

      // Run clean with --all --yes
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context clean ${testDir} --all --yes`
      );

      // Should show .logicstamp/ was removed
      expect(stdout).toContain('.logicstamp/');

      // Verify .logicstamp directory is deleted
      let exists = true;
      try {
        await stat(logicstampDir);
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);
    }, 30000);

    it('should work correctly when .logicstamp does not exist', async () => {
      const testDir = join(outputPath, 'clean-no-logicstamp');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Generate context files
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${testDir}`
      );

      // Run clean with --all --yes
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context clean ${testDir} --all --yes`
      );

      // Should still work and clean context files
      expect(stdout).toContain('Cleaned');

      // Verify context_main.json is deleted
      let exists = true;
      try {
        await access(join(testDir, 'context_main.json'));
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);
    }, 30000);
  });

  describe('Help and error handling', () => {
    it('should show help when --help flag is used', async () => {
      await execAsync('npm run build');

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context clean --help`
      );

      expect(stdout).toContain('Stamp Context Clean');
      expect(stdout).toContain('Remove Artifacts');
      expect(stdout).toContain('USAGE:');
      expect(stdout).toContain('--all');
      expect(stdout).toContain('--yes');
    }, 30000);

    it('should handle non-existent directory gracefully', async () => {
      await execAsync('npm run build');

      const nonExistentDir = join(outputPath, 'non-existent-dir');

      // Should not throw error, just show no files found
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js context clean ${nonExistentDir}`
      );

      expect(stdout).toContain('No context artifacts found');
    }, 30000);
  });

  describe('Specific directory targeting', () => {
    it('should clean context files in specified directory', async () => {
      const testDir = join(outputPath, 'clean-specific-dir');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Generate context files
      await execAsync(
        `node dist/cli/stamp.js context ${fixturesPath} --out ${testDir}`
      );

      // Verify files exist
      const mainContextPath = join(testDir, 'context_main.json');
      await access(mainContextPath);

      // Run clean with specific directory path
      await execAsync(
        `node dist/cli/stamp.js context clean ${testDir} --all --yes`
      );

      // Verify files are deleted
      let exists = true;
      try {
        await access(mainContextPath);
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);
    }, 30000);

    it('should use current directory when no path specified', async () => {
      const testDir = join(outputPath, 'clean-current-dir');
      await mkdir(testDir, { recursive: true });

      await execAsync('npm run build');

      // Generate context files
      await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context ${fixturesPath} --out .`,
        { cwd: testDir }
      );

      // Verify files exist
      const mainContextPath = join(testDir, 'context_main.json');
      await access(mainContextPath);

      // Run clean without specifying path (should use current directory)
      await execAsync(
        `node "${join(process.cwd(), 'dist/cli/stamp.js')}" context clean --all --yes`,
        { cwd: testDir }
      );

      // Verify files are deleted
      let exists = true;
      try {
        await access(mainContextPath);
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);
    }, 30000);
  });
});

