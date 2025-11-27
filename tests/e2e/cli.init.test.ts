import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const execAsync = promisify(exec);

describe('CLI Init Command Tests', () => {
  const fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
  let outputPath: string;

  beforeEach(async () => {
    // Create a unique output directory for this test run
    const uniqueId = randomUUID().substring(0, 8);
    outputPath = join(process.cwd(), 'tests/e2e/output', `init-${uniqueId}`);
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

  describe('Init command', () => {
    it('should create .gitignore with LogicStamp patterns when it does not exist', async () => {
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

      // Verify config was created with skipped preference
      const configPath = join(testDir, '.logicstamp', 'config.json');
      const configContent = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.gitignorePreference).toBe('skipped');
    }, 30000);

    it('should show informational messages when adding patterns', async () => {
      // Create a test directory without .gitignore
      const testDir = join(outputPath, 'init-test-5');
      await mkdir(testDir, { recursive: true });

      // Run stamp init
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js init ${testDir}`
      );

      // Verify informational messages are shown (in non-interactive mode, defaults to yes)
      expect(stdout).toContain('LogicStamp generates large context files');
      expect(stdout).toContain('context.json');
      expect(stdout).toContain('context_*.json');
    }, 30000);

    it('should handle LLM_CONTEXT.md creation', async () => {
      // Create a test directory
      const testDir = join(outputPath, 'init-test-6');
      await mkdir(testDir, { recursive: true });

      // Run stamp init
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js init ${testDir} --skip-gitignore`
      );

      // Verify LLM_CONTEXT.md was handled (either created or skipped message)
      // In non-interactive mode, it defaults to yes, so it should be created
      const llmContextPath = join(testDir, 'LLM_CONTEXT.md');
      let llmContextExists = false;
      try {
        await access(llmContextPath);
        llmContextExists = true;
      } catch {
        // File might not exist if template wasn't found or user skipped
      }

      // If it exists, verify it was created
      if (llmContextExists) {
        expect(stdout).toContain('Created LLM_CONTEXT.md');
      } else {
        // If it doesn't exist, verify skip message or template not found message
        expect(
          stdout.includes('Skipping LLM_CONTEXT.md') || 
          stdout.includes('template not found') ||
          stdout.includes('LLM_CONTEXT.md')
        ).toBe(true);
      }

      // Verify config was updated
      const configPath = join(testDir, '.logicstamp', 'config.json');
      const configContent = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config).toHaveProperty('llmContextPreference');
    }, 30000);
  });
});

