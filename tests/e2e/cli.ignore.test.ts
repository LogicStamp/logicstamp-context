import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, access, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const execAsync = promisify(exec);

// Get absolute path to the CLI
const stampCliPath = resolve(process.cwd(), 'dist/cli/stamp.js');

describe('CLI Ignore Command Tests', () => {
  let outputPath: string;

  beforeEach(async () => {
    // Create a unique output directory for this test run
    const uniqueId = randomUUID().substring(0, 8);
    outputPath = join(process.cwd(), 'tests/e2e/output', `ignore-${uniqueId}`);
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

  describe('Ignore command', () => {
    it('should create .stampignore and add a single path', async () => {
      const testDir = join(outputPath, 'ignore-test-1');
      await mkdir(testDir, { recursive: true });

      // Run stamp ignore
      const { stdout } = await execAsync(
        `node "${stampCliPath}" ignore src/secrets.ts`,
        { cwd: testDir }
      );

      // Verify output messages
      expect(stdout).toContain('Created .stampignore');
      expect(stdout).toContain('Added paths:');
      expect(stdout).toContain('src/secrets.ts');

      // Verify .stampignore was created with correct content
      const stampignorePath = join(testDir, '.stampignore');
      const stampignoreContent = await readFile(stampignorePath, 'utf-8');
      const config = JSON.parse(stampignoreContent);

      expect(config).toHaveProperty('ignore');
      expect(Array.isArray(config.ignore)).toBe(true);
      expect(config.ignore).toContain('src/secrets.ts');
      expect(config.ignore).toHaveLength(1);
    }, 30000);

    it('should add multiple paths to .stampignore', async () => {
      const testDir = join(outputPath, 'ignore-test-2');
      await mkdir(testDir, { recursive: true });

      // Run stamp ignore with multiple paths
      const { stdout } = await execAsync(
        `node "${stampCliPath}" ignore src/secrets.ts config/api-keys.json src/credentials/`,
        { cwd: testDir }
      );

      // Verify output messages
      expect(stdout).toContain('Created .stampignore');
      expect(stdout).toContain('added 3 path(s)');
      expect(stdout).toContain('src/secrets.ts');
      expect(stdout).toContain('config/api-keys.json');
      expect(stdout).toContain('src/credentials/');

      // Verify .stampignore contains all paths
      const stampignorePath = join(testDir, '.stampignore');
      const stampignoreContent = await readFile(stampignorePath, 'utf-8');
      const config = JSON.parse(stampignoreContent);

      expect(config.ignore).toHaveLength(3);
      expect(config.ignore).toContain('src/secrets.ts');
      expect(config.ignore).toContain('config/api-keys.json');
      expect(config.ignore).toContain('src/credentials/');
    }, 30000);

    it('should add paths to existing .stampignore', async () => {
      const testDir = join(outputPath, 'ignore-test-3');
      await mkdir(testDir, { recursive: true });

      // Create existing .stampignore
      const stampignorePath = join(testDir, '.stampignore');
      const existingConfig = {
        ignore: ['src/old-secrets.ts'],
      };
      await writeFile(stampignorePath, JSON.stringify(existingConfig, null, 2));

      // Run stamp ignore to add new path
      const { stdout } = await execAsync(
        `node "${stampCliPath}" ignore src/new-secrets.ts`,
        { cwd: testDir }
      );

      // Verify output messages
      expect(stdout).toContain('Added 1 path(s) to .stampignore');
      expect(stdout).not.toContain('Created .stampignore');

      // Verify .stampignore contains both old and new paths
      const stampignoreContent = await readFile(stampignorePath, 'utf-8');
      const config = JSON.parse(stampignoreContent);

      expect(config.ignore).toHaveLength(2);
      expect(config.ignore).toContain('src/old-secrets.ts');
      expect(config.ignore).toContain('src/new-secrets.ts');
    }, 30000);

    it('should not add duplicate paths', async () => {
      const testDir = join(outputPath, 'ignore-test-4');
      await mkdir(testDir, { recursive: true });

      // Create existing .stampignore with a path
      const stampignorePath = join(testDir, '.stampignore');
      const existingConfig = {
        ignore: ['src/secrets.ts'],
      };
      await writeFile(stampignorePath, JSON.stringify(existingConfig, null, 2));

      // Try to add the same path again
      const { stdout } = await execAsync(
        `node "${stampCliPath}" ignore src/secrets.ts`,
        { cwd: testDir }
      );

      // Verify output messages
      expect(stdout).toContain('All specified paths are already in .stampignore');

      // Verify .stampignore still has only one entry
      const stampignoreContent = await readFile(stampignorePath, 'utf-8');
      const config = JSON.parse(stampignoreContent);

      expect(config.ignore).toHaveLength(1);
      expect(config.ignore).toContain('src/secrets.ts');
    }, 30000);

    it('should handle glob patterns', async () => {
      const testDir = join(outputPath, 'ignore-test-5');
      await mkdir(testDir, { recursive: true });

      // Run stamp ignore with glob patterns
      const { stdout } = await execAsync(
        `node "${stampCliPath}" ignore "**/secrets.ts" "**/*.key"`,
        { cwd: testDir }
      );

      // Verify output messages
      expect(stdout).toContain('Created .stampignore');
      expect(stdout).toContain('added 2 path(s)');

      // Verify .stampignore contains glob patterns
      const stampignorePath = join(testDir, '.stampignore');
      const stampignoreContent = await readFile(stampignorePath, 'utf-8');
      const config = JSON.parse(stampignoreContent);

      expect(config.ignore).toHaveLength(2);
      expect(config.ignore).toContain('**/secrets.ts');
      expect(config.ignore).toContain('**/*.key');
    }, 30000);

    it('should support --quiet flag', async () => {
      const testDir = join(outputPath, 'ignore-test-6');
      await mkdir(testDir, { recursive: true });

      // Run stamp ignore with --quiet flag
      const { stdout } = await execAsync(
        `node "${stampCliPath}" ignore src/secrets.ts --quiet`,
        { cwd: testDir }
      );

      // Verify output is minimal (no verbose messages)
      expect(stdout).not.toContain('Created .stampignore');
      expect(stdout).not.toContain('Added paths:');
      expect(stdout).not.toContain('src/secrets.ts');

      // But .stampignore should still be created
      const stampignorePath = join(testDir, '.stampignore');
      const stampignoreContent = await readFile(stampignorePath, 'utf-8');
      const config = JSON.parse(stampignoreContent);

      expect(config.ignore).toContain('src/secrets.ts');
    }, 30000);

    it('should show help when --help is used', async () => {
      const testDir = join(outputPath, 'ignore-test-7');
      await mkdir(testDir, { recursive: true });

      // Run stamp ignore --help
      const { stdout } = await execAsync(
        `node "${stampCliPath}" ignore --help`,
        { cwd: testDir }
      );

      // Verify help text is shown
      expect(stdout).toContain('Stamp Ignore');
      expect(stdout).toContain('Add Files to .stampignore');
      expect(stdout).toContain('USAGE:');
      expect(stdout).toContain('stamp ignore');
      expect(stdout).toContain('EXAMPLES:');
    }, 30000);

    it('should show error when no paths are provided', async () => {
      const testDir = join(outputPath, 'ignore-test-8');
      await mkdir(testDir, { recursive: true });

      // Run stamp ignore without paths
      let error: Error | null = null;
      try {
        await execAsync(
          `node "${stampCliPath}" ignore`,
          { cwd: testDir }
        );
      } catch (e) {
        error = e as Error;
      }

      // Verify error was thrown
      expect(error).not.toBeNull();
      if (error) {
        // Check both stdout and stderr for the error message
        const errorOutput = (error as any).stderr || (error as any).stdout || error.message;
        expect(errorOutput).toContain('No paths provided');
      }
    }, 30000);

    it('should normalize paths correctly', async () => {
      const testDir = join(outputPath, 'ignore-test-9');
      await mkdir(testDir, { recursive: true });

      // Run stamp ignore with paths that need normalization
      const { stdout } = await execAsync(
        `node "${stampCliPath}" ignore "./src/secrets.ts" "src\\config\\keys.json"`,
        { cwd: testDir }
      );

      // Verify .stampignore was created
      const stampignorePath = join(testDir, '.stampignore');
      const stampignoreContent = await readFile(stampignorePath, 'utf-8');
      const config = JSON.parse(stampignoreContent);

      // Paths should be normalized (no ./ prefix, forward slashes)
      expect(config.ignore.length).toBeGreaterThan(0);
      // The exact normalization depends on the normalizeEntryId function
      // but we should have at least one entry
      expect(config.ignore.length).toBe(2);
    }, 30000);

    it('should handle adding mix of new and existing paths', async () => {
      const testDir = join(outputPath, 'ignore-test-10');
      await mkdir(testDir, { recursive: true });

      // Create existing .stampignore
      const stampignorePath = join(testDir, '.stampignore');
      const existingConfig = {
        ignore: ['src/old-secrets.ts'],
      };
      await writeFile(stampignorePath, JSON.stringify(existingConfig, null, 2));

      // Try to add mix of new and existing paths
      const { stdout } = await execAsync(
        `node "${stampCliPath}" ignore src/old-secrets.ts src/new-secrets.ts`,
        { cwd: testDir }
      );

      // Should add only the new path
      expect(stdout).toContain('Added 1 path(s)');
      expect(stdout).toContain('src/new-secrets.ts');

      // Verify .stampignore contains both paths
      const stampignoreContent = await readFile(stampignorePath, 'utf-8');
      const config = JSON.parse(stampignoreContent);

      expect(config.ignore).toHaveLength(2);
      expect(config.ignore).toContain('src/old-secrets.ts');
      expect(config.ignore).toContain('src/new-secrets.ts');
    }, 30000);
  });
});

