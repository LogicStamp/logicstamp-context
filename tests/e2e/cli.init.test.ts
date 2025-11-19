import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const execAsync = promisify(exec);

describe('CLI Init Command Tests', () => {
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

