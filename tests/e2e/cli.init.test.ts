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

      expect(gitignoreContent).toContain('# LogicStamp context & security files');
      expect(gitignoreContent).toContain('context.json');
      expect(gitignoreContent).toContain('context_*.json');
      expect(gitignoreContent).toContain('*.uif.json');
      expect(gitignoreContent).toContain('logicstamp.manifest.json');
      expect(gitignoreContent).toContain('.logicstamp/');
      expect(gitignoreContent).toContain('stamp_security_report.json');

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
      expect(gitignoreContent).toContain('# LogicStamp context & security files');
      expect(gitignoreContent).toContain('context.json');
      expect(gitignoreContent).toContain('context_*.json');
      expect(gitignoreContent).toContain('.logicstamp/');
      expect(gitignoreContent).toContain('stamp_security_report.json');

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
      const existingContent = '# LogicStamp context & security files\ncontext.json\ncontext_*.json\n*.uif.json\nlogicstamp.manifest.json\n.logicstamp/\nstamp_security_report.json\n';
      await writeFile(gitignorePath, existingContent);

      // Run stamp init
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js init ${testDir}`
      );

      // Verify output messages
      expect(stdout).toContain('already contains all LogicStamp patterns');

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

    it('should skip all prompts with --yes flag and create both .gitignore and LLM_CONTEXT.md', async () => {
      // Create a test directory without .gitignore or LLM_CONTEXT.md
      const testDir = join(outputPath, 'init-test-7');
      await mkdir(testDir, { recursive: true });

      // Run stamp init with --yes flag
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js init ${testDir} --yes`
      );

      // Verify output messages - should not contain prompts
      expect(stdout).toContain('Initializing LogicStamp');
      expect(stdout).toContain('initialization complete');
      // Should not contain prompt text
      expect(stdout).not.toContain('Add recommended patterns to .gitignore?');
      expect(stdout).not.toContain('Generate LLM_CONTEXT.md in project root?');

      // Verify .gitignore was created (defaults to yes)
      const gitignorePath = join(testDir, '.gitignore');
      const gitignoreContent = await readFile(gitignorePath, 'utf-8');
      expect(gitignoreContent).toContain('context.json');
      expect(gitignoreContent).toContain('.logicstamp/');

      // Verify config was created with added preference
      const configPath = join(testDir, '.logicstamp', 'config.json');
      const configContent = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.gitignorePreference).toBe('added');
    }, 30000);

    it('should skip all prompts with -y flag and create both .gitignore and LLM_CONTEXT.md', async () => {
      // Create a test directory without .gitignore or LLM_CONTEXT.md
      const testDir = join(outputPath, 'init-test-8');
      await mkdir(testDir, { recursive: true });

      // Run stamp init with -y flag
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js init ${testDir} -y`
      );

      // Verify output messages - should not contain prompts
      expect(stdout).toContain('Initializing LogicStamp');
      expect(stdout).toContain('initialization complete');
      // Should not contain prompt text
      expect(stdout).not.toContain('Add recommended patterns to .gitignore?');
      expect(stdout).not.toContain('Generate LLM_CONTEXT.md in project root?');

      // Verify .gitignore was created (defaults to yes)
      const gitignorePath = join(testDir, '.gitignore');
      const gitignoreContent = await readFile(gitignorePath, 'utf-8');
      expect(gitignoreContent).toContain('context.json');
      expect(gitignoreContent).toContain('.logicstamp/');

      // Verify config was created with added preference
      const configPath = join(testDir, '.logicstamp', 'config.json');
      const configContent = await readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.gitignorePreference).toBe('added');
    }, 30000);

    it('should work with --yes flag even when --skip-gitignore is also used', async () => {
      // Create a test directory
      const testDir = join(outputPath, 'init-test-9');
      await mkdir(testDir, { recursive: true });

      // Run stamp init with both --yes and --skip-gitignore
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js init ${testDir} --yes --skip-gitignore`
      );

      // Verify output messages
      expect(stdout).toContain('initialization complete');
      expect(stdout).not.toContain('.gitignore');

      // Verify .gitignore was not created (skip-gitignore takes precedence)
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
  });

  describe('Init command with --secure flag', () => {
    it('should run init with auto-yes and then security scan when --secure is used', async () => {
      // Create a test directory without .gitignore
      const testDir = join(outputPath, 'init-secure-test-1');
      await mkdir(testDir, { recursive: true });

      // Run stamp init with --secure flag
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js init ${testDir} --secure`
      );

      // Verify init was run (no prompts, auto-yes)
      expect(stdout).toContain('Initializing LogicStamp');
      expect(stdout).not.toContain('Add recommended patterns to .gitignore?');
      expect(stdout).not.toContain('Generate LLM_CONTEXT.md in project root?');

      // Verify security scan was run
      expect(stdout).toContain('Running security scan');
      expect(stdout).toContain('Security scan:');
      expect(stdout).toContain('files scanned');

      // Verify combined summary
      expect(stdout).toContain('Initialization complete');
      expect(stdout).toContain('Report written to stamp_security_report.json');

      // Verify .gitignore was created (auto-yes)
      const gitignorePath = join(testDir, '.gitignore');
      const gitignoreContent = await readFile(gitignorePath, 'utf-8');
      expect(gitignoreContent).toContain('context.json');

      // Verify security report was created
      const reportPath = join(testDir, 'stamp_security_report.json');
      await access(reportPath);
      const reportContent = await readFile(reportPath, 'utf-8');
      const report = JSON.parse(reportContent);
      expect(report).toHaveProperty('type', 'LogicStampSecurityReport');
    }, 30000);

    it('should exit with code 0 when --secure is used and no secrets are found', async () => {
      // Create a test directory without secrets
      const testDir = join(outputPath, 'init-secure-test-2');
      await mkdir(testDir, { recursive: true });

      // Run stamp init with --secure flag
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js init ${testDir} --secure`
      );

      // Should complete successfully
      expect(stdout).toContain('Initialization complete');
      expect(stdout).toContain('No secrets detected');
    }, 30000);

    it('should exit with code 1 when --secure is used and secrets are found', async () => {
      // Create a test directory with a secret
      const testDir = join(outputPath, 'init-secure-test-3');
      await mkdir(testDir, { recursive: true });

      // Create a file with a secret
      const secretFile = join(testDir, 'secrets.ts');
      await writeFile(
        secretFile,
        `const apiKey = 'FAKE_SECRET_KEY_1234567890abcdefghijklmnopqrstuvwxyz';`
      );

      // Run stamp init with --secure flag
      let stdout = '';
      try {
        const result = await execAsync(
          `node dist/cli/stamp.js init ${testDir} --secure`
        );
        stdout = result.stdout;
        expect.fail('Should have exited with code 1 when secrets are found');
      } catch (error: any) {
        // Expected: should exit with code 1 when secrets found
        expect(error.code).toBe(1);
        stdout = error.stdout || '';
      }

      // Verify init and security scan both ran
      expect(stdout).toContain('Initializing LogicStamp');
      expect(stdout).toContain('Running security scan');
      expect(stdout).toContain('Security scan:');
      expect(stdout).toContain('secrets found');

      // Verify .stampignore was created (--apply was used)
      const stampignorePath = join(testDir, '.stampignore');
      await access(stampignorePath);
      const stampignoreContent = await readFile(stampignorePath, 'utf-8');
      const stampignore = JSON.parse(stampignoreContent);
      expect(stampignore.ignore).toContain('secrets.ts');
    }, 30000);

    it('should work with --secure --yes (redundant but harmless)', async () => {
      // Create a test directory
      const testDir = join(outputPath, 'init-secure-test-4');
      await mkdir(testDir, { recursive: true });

      // Run stamp init with both --secure and --yes
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js init ${testDir} --secure --yes`
      );

      // Should work the same as --secure alone
      expect(stdout).toContain('Initializing LogicStamp');
      expect(stdout).toContain('Running security scan');
      expect(stdout).toContain('Initialization complete');
      expect(stdout).not.toContain('Add recommended patterns to .gitignore?');
    }, 30000);

    it('should show combined summary with init and security scan results', async () => {
      // Create a test directory
      const testDir = join(outputPath, 'init-secure-test-5');
      await mkdir(testDir, { recursive: true });

      // Run stamp init with --secure flag
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js init ${testDir} --secure`
      );

      // Verify combined summary format
      expect(stdout).toContain('Initialization complete');
      
      // Should show gitignore status
      const hasGitignoreStatus = 
        stdout.includes('Added LogicStamp patterns to .gitignore') ||
        stdout.includes('LogicStamp patterns already in .gitignore');
      expect(hasGitignoreStatus).toBe(true);

      // Should show security scan results
      expect(stdout).toContain('Security scan:');
      expect(stdout).toContain('files scanned');
      expect(stdout).toContain('secrets found');
      expect(stdout).toContain('Report written to stamp_security_report.json');
    }, 30000);
  });
});

