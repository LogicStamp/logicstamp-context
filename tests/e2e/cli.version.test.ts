import { describe, it, expect } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const execAsync = promisify(exec);

describe('CLI Version Command Tests', () => {
  it('should display version with --version flag', async () => {
    // Build the project first
    await execAsync('npm run build');

    // Run stamp --version
    const { stdout } = await execAsync('node dist/cli/stamp.js --version');

    // Verify fox mascot is displayed
    expect(stdout).toContain('/\\_/\\');
    expect(stdout).toContain('( o.o )');
    expect(stdout).toContain('> ^ <');
    expect(stdout).toContain('🦊 Meet the Logic Fox');

    // Verify version is displayed
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    expect(stdout).toContain(`Version: ${packageJson.version}`);
  }, 30000);

  it('should display version with -v flag', async () => {
    // Build the project first
    await execAsync('npm run build');

    // Run stamp -v
    const { stdout } = await execAsync('node dist/cli/stamp.js -v');

    // Verify fox mascot is displayed
    expect(stdout).toContain('/\\_/\\');
    expect(stdout).toContain('( o.o )');
    expect(stdout).toContain('> ^ <');
    expect(stdout).toContain('🦊 Meet the Logic Fox');

    // Verify version is displayed
    const packageJsonPath = join(process.cwd(), 'package.json');
    const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    expect(stdout).toContain(`Version: ${packageJson.version}`);
  }, 30000);

  it('should exit with code 0', async () => {
    // Build the project first
    await execAsync('npm run build');

    // Run stamp --version and verify it doesn't throw
    await expect(execAsync('node dist/cli/stamp.js --version')).resolves.toBeDefined();
  }, 30000);
});

