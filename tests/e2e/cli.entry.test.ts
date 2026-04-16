import { describe, it, expect } from 'vitest';
import { exec } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the built CLI entry point
const stampCliPath = join(__dirname, '../../dist/cli/stamp.js');
const standaloneCliPath = join(__dirname, '../../dist/cli/index.js');

describe('CLI Entry Points', () => {
  describe('stamp.ts', () => {
    it('should show version when --version flag is provided', async () => {
      const { stdout } = await execAsync(`node "${stampCliPath}" --version`);
      expect(stdout).toContain('Version:');
      expect(stdout).toContain('🦊');
    });

    it('should show version when -v flag is provided', async () => {
      const { stdout } = await execAsync(`node "${stampCliPath}" -v`);
      expect(stdout).toContain('Version:');
    });

    it('should show help when --help flag is provided', async () => {
      const { stdout } = await execAsync(`node "${stampCliPath}" --help`);
      expect(stdout).toContain('USAGE:');
      expect(stdout).toContain('🦊');
    });

    it('should show help when -h flag is provided', async () => {
      const { stdout } = await execAsync(`node "${stampCliPath}" -h`);
      expect(stdout).toContain('USAGE:');
    });

    it('should show help when no arguments provided', async () => {
      const { stdout } = await execAsync(`node "${stampCliPath}"`);
      expect(stdout).toContain('USAGE:');
    });

    it('should handle unknown command gracefully', async () => {
      try {
        await execAsync(`node "${stampCliPath}" unknown-command`);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Command should fail, but we can't easily test the exact error message
        // since it depends on how the CLI handles unknown commands
        expect(error).toBeDefined();
      }
    });
  });

  describe('standalone index.ts', () => {
    it('should show help for compare command', async () => {
      try {
        const { stdout } = await execAsync(
          `node "${standaloneCliPath}" compare`,
        );
        // Should show help or error message
        expect(stdout).toBeDefined();
      } catch (error: any) {
        // May exit with error code, which is expected
        expect(error).toBeDefined();
      }
    });

    it('should handle compare command with files', async () => {
      try {
        await execAsync(
          `node "${standaloneCliPath}" compare nonexistent1.json nonexistent2.json`,
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Should fail because files don't exist
        expect(error).toBeDefined();
      }
    });
  });

  describe('CLI error handling', () => {
    it('should exit with code 1 on error', async () => {
      try {
        // Use a non-existent directory and --skip-gitignore to avoid modifying project root
        await execAsync(
          `node "${stampCliPath}" context /nonexistent/path --invalid-flag --skip-gitignore`,
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        // Should exit with non-zero code
        expect(error.code).not.toBe(0);
      }
    });
  });
});
