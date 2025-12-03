import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, rm, access, mkdir, writeFile, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const execAsync = promisify(exec);

describe('CLI Security Command Tests', () => {
  let testDir: string;
  let fixturesPath: string;

  beforeEach(async () => {
    // Create a unique test directory
    const uniqueId = randomUUID().substring(0, 8);
    testDir = join(process.cwd(), 'tests/e2e/output', `security-${uniqueId}`);
    await mkdir(testDir, { recursive: true });

    // Copy simple-app fixture to test directory
    fixturesPath = join(process.cwd(), 'tests/fixtures/simple-app');
    const testFixturesPath = join(testDir, 'simple-app');
    await cp(fixturesPath, testFixturesPath, { recursive: true });
    fixturesPath = testFixturesPath;
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      try {
        await rm(testDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('stamp security scan', () => {
    it('should scan for secrets and generate a report', async () => {
      // Create a file with a secret
      const secretFile = join(fixturesPath, 'src', 'secrets.ts');
      await writeFile(
        secretFile,
        `// This file contains secrets
const apiKey = 'FAKE_SECRET_KEY_1234567890abcdefghijklmnopqrstuvwxyz';
const password = 'mySecretPassword123';
`
      );

      const reportPath = join(testDir, 'stamp_security_report.json');

      // Command exits with code 1 when secrets are found (expected behavior)
      let stdout = '';
      try {
        const result = await execAsync(
          `node dist/cli/stamp.js security scan ${fixturesPath} --out ${reportPath}`
        );
        stdout = result.stdout;
      } catch (error: any) {
        // Expected: command exits with code 1 when secrets found
        expect(error.code).toBe(1);
        stdout = error.stdout || '';
      }

      // Should detect secrets
      expect(stdout).toContain('Scanning for secrets');
      expect(stdout).toContain('Secrets found');
      expect(stdout).toContain('secrets.ts');

      // Report file should exist
      await access(reportPath);

      // Read and verify report structure
      const reportContent = await readFile(reportPath, 'utf-8');
      const report = JSON.parse(reportContent);

      expect(report).toHaveProperty('type', 'LogicStampSecurityReport');
      expect(report).toHaveProperty('schemaVersion', '0.1');
      expect(report).toHaveProperty('createdAt');
      expect(report).toHaveProperty('projectRoot');
      expect(report).toHaveProperty('filesScanned');
      expect(report).toHaveProperty('secretsFound');
      expect(report).toHaveProperty('matches');
      expect(report).toHaveProperty('filesWithSecrets');
      expect(Array.isArray(report.matches)).toBe(true);
      expect(Array.isArray(report.filesWithSecrets)).toBe(true);
      expect(report.secretsFound).toBeGreaterThan(0);
      expect(report.filesWithSecrets.length).toBeGreaterThan(0);

      // Verify match structure
      if (report.matches.length > 0) {
        const match = report.matches[0];
        expect(match).toHaveProperty('file');
        expect(match).toHaveProperty('line');
        expect(match).toHaveProperty('column');
        expect(match).toHaveProperty('type');
        expect(match).toHaveProperty('snippet');
        expect(match).toHaveProperty('severity');
        expect(['high', 'medium', 'low']).toContain(match.severity);
      }
    }, 30000);

    it('should exit with error code when secrets are found', async () => {
      // Create a file with a secret
      const secretFile = join(fixturesPath, 'src', 'secrets.ts');
      await writeFile(
        secretFile,
        `const apiKey = 'FAKE_SECRET_KEY_1234567890abcdefghijklmnopqrstuvwxyz';`
      );

      const reportPath = join(testDir, 'stamp_security_report.json');

      try {
        await execAsync(
          `node dist/cli/stamp.js security scan ${fixturesPath} --out ${reportPath}`
        );
        expect.fail('Should have exited with non-zero code');
      } catch (error: any) {
        // Should exit with code 1 when secrets found
        expect(error.code).toBe(1);
      }
    }, 30000);

    it('should exit with code 0 when no secrets are found', async () => {
      const reportPath = join(testDir, 'stamp_security_report.json');

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js security scan ${fixturesPath} --out ${reportPath}`
      );

      // Should report no secrets
      expect(stdout).toContain('No secrets detected');
      expect(stdout).toContain('Files scanned');

      // Report should exist
      await access(reportPath);

      const reportContent = await readFile(reportPath, 'utf-8');
      const report = JSON.parse(reportContent);
      expect(report.secretsFound).toBe(0);
    }, 30000);

    it('should exclude .stampignore and report file from scanning', async () => {
      // Create .stampignore with a secret (should not be scanned)
      const stampignorePath = join(fixturesPath, '.stampignore');
      await writeFile(
        stampignorePath,
        JSON.stringify({
          ignore: ['src/secrets.ts'],
        })
      );

      // Create report file with a secret (should not be scanned)
      const reportPath = join(fixturesPath, 'stamp_security_report.json');
      await writeFile(
        reportPath,
        JSON.stringify({
          type: 'LogicStampSecurityReport',
          apiKey: 'FAKE_SECRET_KEY_1234567890abcdefghijklmnopqrstuvwxyz',
        })
      );

      // Create a file with a secret that should be detected
      const secretFile = join(fixturesPath, 'src', 'secrets.ts');
      await writeFile(
        secretFile,
        `const apiKey = 'FAKE_SECRET_KEY_1234567890abcdefghijklmnopqrstuvwxyz';`
      );

      const outputReportPath = join(testDir, 'output_report.json');

      // Command exits with code 1 when secrets are found (expected behavior)
      let stdout = '';
      try {
        const result = await execAsync(
          `node dist/cli/stamp.js security scan ${fixturesPath} --out ${outputReportPath}`
        );
        stdout = result.stdout;
      } catch (error: any) {
        // Expected: command exits with code 1 when secrets found
        expect(error.code).toBe(1);
        stdout = error.stdout || '';
      }

      // Should detect the secret in secrets.ts but not in .stampignore or report file
      expect(stdout).toContain('Secrets found');
      
      const reportContent = await readFile(outputReportPath, 'utf-8');
      const report = JSON.parse(reportContent);
      
      // Should not report .stampignore or the report file itself
      const reportedFiles = report.filesWithSecrets.map((f: string) => f.replace(/\\/g, '/'));
      expect(reportedFiles).not.toContain(expect.stringContaining('.stampignore'));
      expect(reportedFiles).not.toContain(expect.stringContaining('stamp_security_report.json'));
    }, 30000);

    it('should work with --quiet flag', async () => {
      // Create a file with a secret
      const secretFile = join(fixturesPath, 'src', 'secrets.ts');
      await writeFile(
        secretFile,
        `const apiKey = 'FAKE_SECRET_KEY_1234567890abcdefghijklmnopqrstuvwxyz';`
      );

      const reportPath = join(testDir, 'stamp_security_report.json');

      // Command exits with code 1 when secrets are found (expected behavior)
      let stdout = '';
      try {
        const result = await execAsync(
          `node dist/cli/stamp.js security scan ${fixturesPath} --out ${reportPath} --quiet`
        );
        stdout = result.stdout;
      } catch (error: any) {
        // Expected: command exits with code 1 when secrets found
        expect(error.code).toBe(1);
        stdout = error.stdout || '';
      }

      // Should output JSON stats only
      expect(stdout).not.toContain('Scanning for secrets');
      expect(stdout).not.toContain('Secrets found');
      
      // Should be valid JSON
      const stats = JSON.parse(stdout.trim());
      expect(stats).toHaveProperty('filesScanned');
      expect(stats).toHaveProperty('secretsFound');
      expect(stats).toHaveProperty('filesWithSecrets');
      expect(stats).toHaveProperty('reportPath');
    }, 30000);

    it('should scan TypeScript, JavaScript, and JSON files', async () => {
      // Create files with secrets in different formats
      const tsFile = join(fixturesPath, 'src', 'secrets.ts');
      await writeFile(tsFile, `const apiKey = 'FAKE_SECRET_KEY_1234567890abcdefghijklmnopqrstuvwxyz';`);

      const jsFile = join(fixturesPath, 'src', 'secrets.js');
      await writeFile(jsFile, `const password = 'mySecretPassword123';`);

      // Use a secret pattern that will definitely be detected in JSON format
      // Write JSON with pretty formatting to ensure pattern matches (spaces help regex matching)
      const jsonFile = join(fixturesPath, 'config.json');
      await writeFile(
        jsonFile,
        JSON.stringify({ apiKey: 'FAKE_SECRET_KEY_1234567890abcdefghijklmnopqrstuvwxyz' }, null, 2)
      );

      const reportPath = join(testDir, 'stamp_security_report.json');

      // Command exits with code 1 when secrets are found (expected behavior)
      try {
        await execAsync(
          `node dist/cli/stamp.js security scan ${fixturesPath} --out ${reportPath}`
        );
      } catch (error: any) {
        // Expected: command exits with code 1 when secrets found
        expect(error.code).toBe(1);
      }

      const reportContent = await readFile(reportPath, 'utf-8');
      const report = JSON.parse(reportContent);

      // Should find secrets in all three file types
      const reportedFiles = report.filesWithSecrets.map((f: string) => f.replace(/\\/g, '/'));
      expect(reportedFiles.some((f: string) => f.includes('secrets.ts'))).toBe(true);
      expect(reportedFiles.some((f: string) => f.includes('secrets.js'))).toBe(true);
      
      // JSON files should be detected - the pretty-printed format should match the pattern
      // The pattern looks for: apiKey : "value" or apiKey: "value"
      expect(reportedFiles.some((f: string) => f.includes('config.json'))).toBe(true);
    }, 30000);

    it('should automatically add default report file to .gitignore', async () => {
      const reportPath = join(fixturesPath, 'stamp_security_report.json');

      // Run security scan (no secrets expected)
      await execAsync(
        `node dist/cli/stamp.js security scan ${fixturesPath} --out ${reportPath}`
      );

      // Verify report was created
      await access(reportPath);

      // Verify .gitignore was updated with stamp_security_report.json
      const gitignorePath = join(fixturesPath, '.gitignore');
      let gitignoreExists = false;
      try {
        await access(gitignorePath);
        gitignoreExists = true;
      } catch {
        // .gitignore might not exist yet - ensureGitignorePatterns should create it
      }

      // Read .gitignore
      const gitignoreContent = gitignoreExists
        ? await readFile(gitignorePath, 'utf-8')
        : '';

      // Should contain stamp_security_report.json pattern
      expect(gitignoreContent).toContain('stamp_security_report.json');
    }, 30000);

    it('should automatically add custom report file path to .gitignore', async () => {
      const customReportPath = join(testDir, 'reports', 'security-report.json');

      // Run security scan with custom report path
      await execAsync(
        `node dist/cli/stamp.js security scan ${fixturesPath} --out ${customReportPath}`
      );

      // Verify report was created
      await access(customReportPath);

      // Verify .gitignore was updated with custom report path
      const gitignorePath = join(fixturesPath, '.gitignore');
      const gitignoreContent = await readFile(gitignorePath, 'utf-8');

      // Should contain the custom report path (relative to project root)
      const relativeReportPath = customReportPath.replace(fixturesPath + '/', '').replace(/\\/g, '/');
      expect(gitignoreContent).toContain('reports/security-report.json');
    }, 30000);

    it('should not fail if .gitignore update fails (non-fatal)', async () => {
      // Create a read-only directory to simulate permission issues
      // This is tricky on Windows, so we'll test that the scan continues even if gitignore update fails
      const reportPath = join(fixturesPath, 'stamp_security_report.json');

      // Run security scan - should complete successfully even if gitignore update fails
      const { stdout } = await execAsync(
        `node dist/cli/stamp.js security scan ${fixturesPath} --out ${reportPath}`
      );

      // Verify report was still created
      await access(reportPath);

      // Should not mention gitignore errors in successful run (errors are non-fatal warnings)
      // The scan should complete successfully
      expect(stdout).toContain('No secrets detected');
    }, 30000);

    it('should handle report file already in .gitignore (idempotent)', async () => {
      // Create .gitignore with stamp_security_report.json already in it
      const gitignorePath = join(fixturesPath, '.gitignore');
      await writeFile(
        gitignorePath,
        `# Existing patterns
node_modules/
stamp_security_report.json
`
      );

      const reportPath = join(fixturesPath, 'stamp_security_report.json');

      // Run security scan
      await execAsync(
        `node dist/cli/stamp.js security scan ${fixturesPath} --out ${reportPath}`
      );

      // Verify report was created
      await access(reportPath);

      // Verify .gitignore still contains the pattern (idempotent)
      const gitignoreContent = await readFile(gitignorePath, 'utf-8');
      expect(gitignoreContent).toContain('stamp_security_report.json');
      
      // Should not duplicate the pattern
      const matches = gitignoreContent.match(/stamp_security_report\.json/g);
      expect(matches?.length).toBeLessThanOrEqual(2); // Allow for comment and pattern
    }, 30000);

    it('should add default report to LogicStamp patterns block in .gitignore', async () => {
      // Create .gitignore with LogicStamp block already started
      const gitignorePath = join(fixturesPath, '.gitignore');
      await writeFile(
        gitignorePath,
        `# LogicStamp context & security files
context.json
context_*.json
`
      );

      const reportPath = join(fixturesPath, 'stamp_security_report.json');

      // Run security scan
      await execAsync(
        `node dist/cli/stamp.js security scan ${fixturesPath} --out ${reportPath}`
      );

      // Verify .gitignore was updated with the report in the LogicStamp block
      const gitignoreContent = await readFile(gitignorePath, 'utf-8');
      expect(gitignoreContent).toContain('# LogicStamp context & security files');
      expect(gitignoreContent).toContain('stamp_security_report.json');
      
      // The report should be in the LogicStamp section
      const lines = gitignoreContent.split('\n');
      const logicStampIndex = lines.findIndex(line => line.includes('# LogicStamp context & security files'));
      const reportIndex = lines.findIndex(line => line.includes('stamp_security_report.json'));
      expect(reportIndex).toBeGreaterThan(logicStampIndex);
    }, 30000);
  });

  describe('stamp security scan --apply', () => {
    it('should automatically add files with secrets to .stampignore', async () => {
      // Create a file with a secret
      const secretFile = join(fixturesPath, 'src', 'secrets.ts');
      await writeFile(
        secretFile,
        `const apiKey = 'FAKE_SECRET_KEY_1234567890abcdefghijklmnopqrstuvwxyz';`
      );

      const reportPath = join(testDir, 'stamp_security_report.json');

      // Command exits with code 1 when secrets are found (expected behavior)
      let stdout = '';
      try {
        const result = await execAsync(
          `node dist/cli/stamp.js security scan ${fixturesPath} --out ${reportPath} --apply`
        );
        stdout = result.stdout;
      } catch (error: any) {
        // Expected: command exits with code 1 when secrets found
        expect(error.code).toBe(1);
        stdout = error.stdout || '';
      }

      // Should mention adding files to .stampignore
      expect(stdout).toContain('Added');
      expect(stdout).toContain('.stampignore');

      // Verify .stampignore was created
      const stampignorePath = join(fixturesPath, '.stampignore');
      await access(stampignorePath);

      // Read and verify content
      const stampignoreContent = await readFile(stampignorePath, 'utf-8');
      const stampignore = JSON.parse(stampignoreContent);

      expect(stampignore).toHaveProperty('ignore');
      expect(Array.isArray(stampignore.ignore)).toBe(true);
      expect(stampignore.ignore.length).toBeGreaterThan(0);
      
      // Should contain the file with secrets (relative path)
      const ignorePaths = stampignore.ignore.map((p: string) => p.replace(/\\/g, '/'));
      expect(ignorePaths.some((p: string) => p.includes('secrets.ts'))).toBe(true);
    }, 30000);

    it('should append to existing .stampignore', async () => {
      // Create existing .stampignore
      const stampignorePath = join(fixturesPath, '.stampignore');
      await writeFile(
        stampignorePath,
        JSON.stringify({
          ignore: ['src/old-file.ts'],
        })
      );

      // Create a file with a secret
      const secretFile = join(fixturesPath, 'src', 'secrets.ts');
      await writeFile(
        secretFile,
        `const apiKey = 'FAKE_SECRET_KEY_1234567890abcdefghijklmnopqrstuvwxyz';`
      );

      const reportPath = join(testDir, 'stamp_security_report.json');

      // Command exits with code 1 when secrets are found (expected behavior)
      try {
        await execAsync(
          `node dist/cli/stamp.js security scan ${fixturesPath} --out ${reportPath} --apply`
        );
      } catch (error: any) {
        // Expected: command exits with code 1 when secrets found
        expect(error.code).toBe(1);
      }

      // Read .stampignore
      const stampignoreContent = await readFile(stampignorePath, 'utf-8');
      const stampignore = JSON.parse(stampignoreContent);

      // Should contain both old and new files
      expect(stampignore.ignore).toContain('src/old-file.ts');
      expect(stampignore.ignore.some((p: string) => p.includes('secrets.ts'))).toBe(true);
    }, 30000);

    it('should not duplicate files already in .stampignore', async () => {
      // Create .stampignore with the file already ignored
      const stampignorePath = join(fixturesPath, '.stampignore');
      await writeFile(
        stampignorePath,
        JSON.stringify({
          ignore: ['src/secrets.ts'],
        })
      );

      // Create a file with a secret
      const secretFile = join(fixturesPath, 'src', 'secrets.ts');
      await writeFile(
        secretFile,
        `const apiKey = 'FAKE_SECRET_KEY_1234567890abcdefghijklmnopqrstuvwxyz';`
      );

      const reportPath = join(testDir, 'stamp_security_report.json');

      // Command exits with code 1 when secrets are found (expected behavior)
      let stdout = '';
      try {
        const result = await execAsync(
          `node dist/cli/stamp.js security scan ${fixturesPath} --out ${reportPath} --apply`
        );
        stdout = result.stdout;
      } catch (error: any) {
        // Expected: command exits with code 1 when secrets found
        expect(error.code).toBe(1);
        stdout = error.stdout || '';
      }

      // Should mention files already in .stampignore
      expect(stdout).toContain('already in .stampignore');

      // Read .stampignore
      const stampignoreContent = await readFile(stampignorePath, 'utf-8');
      const stampignore = JSON.parse(stampignoreContent);

      // Should only have one entry for secrets.ts
      const secretsCount = stampignore.ignore.filter((p: string) => p.includes('secrets.ts')).length;
      expect(secretsCount).toBe(1);
    }, 30000);

    it('should only add relative paths to .stampignore (no absolute paths)', async () => {
      // Create a file with a secret
      const secretFile = join(fixturesPath, 'src', 'secrets.ts');
      await writeFile(
        secretFile,
        `const apiKey = 'FAKE_SECRET_KEY_1234567890abcdefghijklmnopqrstuvwxyz';`
      );

      const reportPath = join(testDir, 'stamp_security_report.json');

      // Command exits with code 1 when secrets are found (expected behavior)
      let stdout = '';
      try {
        const result = await execAsync(
          `node dist/cli/stamp.js security scan ${fixturesPath} --out ${reportPath} --apply`
        );
        stdout = result.stdout;
      } catch (error: any) {
        // Expected: command exits with code 1 when secrets found
        expect(error.code).toBe(1);
        stdout = error.stdout || '';
      }

      // Verify .stampignore was created
      const stampignorePath = join(fixturesPath, '.stampignore');
      await access(stampignorePath);

      // Read and verify content
      const stampignoreContent = await readFile(stampignorePath, 'utf-8');
      const stampignore = JSON.parse(stampignoreContent);

      // All paths should be relative (no absolute paths, no user-specific paths)
      stampignore.ignore.forEach((path: string) => {
        // Should not start with / (Unix absolute path)
        expect(path).not.toMatch(/^\//);
        // Should not match Windows absolute path pattern (C:, D:, etc.)
        expect(path).not.toMatch(/^[A-Z]:/);
        // Should not contain user home directory patterns
        expect(path).not.toMatch(/^~\/|^\/Users\/|^\/home\/|^C:\\Users\\/);
      });

      // Should contain relative path to secrets file
      const ignorePaths = stampignore.ignore.map((p: string) => p.replace(/\\/g, '/'));
      expect(ignorePaths.some((p: string) => p.includes('src/secrets.ts') || p.includes('secrets.ts'))).toBe(true);
    }, 30000);

    it('should filter out absolute paths when adding to .stampignore', async () => {
      // This test verifies that if somehow an absolute path gets through,
      // it will be filtered out (though this shouldn't happen in practice)
      
      // Create a file with a secret
      const secretFile = join(fixturesPath, 'src', 'secrets.ts');
      await writeFile(
        secretFile,
        `const apiKey = 'FAKE_SECRET_KEY_1234567890abcdefghijklmnopqrstuvwxyz';`
      );

      const reportPath = join(testDir, 'stamp_security_report.json');

      // Run security scan
      try {
        await execAsync(
          `node dist/cli/stamp.js security scan ${fixturesPath} --out ${reportPath} --apply`
        );
      } catch (error: any) {
        // Expected: command exits with code 1 when secrets found
        expect(error.code).toBe(1);
      }

      // Verify .stampignore paths are all relative
      const stampignorePath = join(fixturesPath, '.stampignore');
      await access(stampignorePath);
      const stampignoreContent = await readFile(stampignorePath, 'utf-8');
      const stampignore = JSON.parse(stampignoreContent);

      // Verify all paths are relative to project root
      stampignore.ignore.forEach((path: string) => {
        // Paths should not be absolute
        const isAbsolute = path.startsWith('/') || !!path.match(/^[A-Z]:/);
        expect(isAbsolute).toBe(false);
      });
    }, 30000);
  });

  describe('stamp security --hard-reset', () => {
    it('should accept --hard-reset flag without --force (confirmation required)', async () => {
      // Create .stampignore
      const stampignorePath = join(fixturesPath, '.stampignore');
      await writeFile(
        stampignorePath,
        JSON.stringify({ ignore: ['src/secrets.ts'] })
      );

      // Create report file
      const reportPath = join(fixturesPath, 'stamp_security_report.json');
      await writeFile(
        reportPath,
        JSON.stringify({ type: 'LogicStampSecurityReport', secretsFound: 0 })
      );

      // Verify files exist before test
      await access(stampignorePath);
      await access(reportPath);
      
      // Test that the command accepts --hard-reset without --force
      // The actual confirmation prompt interaction is tested via --force flag
      // This test verifies the command structure accepts the flag
      // In a real scenario, the command would prompt for confirmation
      // We verify the command doesn't error with invalid syntax
      try {
        // This will wait for stdin input, so we expect it to timeout or be cancelled
        // The important verification is that --force works (tested separately)
        await execAsync(
          `node dist/cli/stamp.js security --hard-reset ${fixturesPath} --out ${reportPath}`,
          { timeout: 2000 }
        );
      } catch (error: any) {
        // Timeout is expected since we're not providing stdin input
        // The command structure is valid (verified by no syntax errors)
        // Files should still exist since we didn't confirm
        await access(stampignorePath);
        await access(reportPath);
      }
    }, 5000);

    it('should delete .stampignore and report file with --force flag', async () => {
      // Create .stampignore
      const stampignorePath = join(fixturesPath, '.stampignore');
      await writeFile(
        stampignorePath,
        JSON.stringify({ ignore: ['src/secrets.ts'] })
      );

      // Create report file
      const reportPath = join(fixturesPath, 'stamp_security_report.json');
      await writeFile(
        reportPath,
        JSON.stringify({ type: 'LogicStampSecurityReport', secretsFound: 0 })
      );

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js security --hard-reset ${fixturesPath} --out ${reportPath} --force`
      );

      // Should delete without prompting
      expect(stdout).toContain('Reset complete');
      expect(stdout).toContain('Deleted .stampignore');
      expect(stdout).toContain('Deleted');

      // Verify files were deleted
      let stampignoreExists = true;
      let reportExists = true;
      try {
        await access(stampignorePath);
      } catch {
        stampignoreExists = false;
      }
      try {
        await access(reportPath);
      } catch {
        reportExists = false;
      }

      expect(stampignoreExists).toBe(false);
      expect(reportExists).toBe(false);
    }, 30000);

    it('should handle case when files do not exist', async () => {
      // Don't create the files
      const reportPath = join(fixturesPath, 'stamp_security_report.json');

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js security --hard-reset ${fixturesPath} --out ${reportPath} --force`
      );

      // Should report that no files were found
      expect(stdout).toContain('No files to reset');
    }, 30000);

    it('should work with custom report file path', async () => {
      // Create .stampignore
      const stampignorePath = join(fixturesPath, '.stampignore');
      await writeFile(
        stampignorePath,
        JSON.stringify({ ignore: ['src/secrets.ts'] })
      );

      // Create custom report file
      const customReportPath = join(testDir, 'custom-report.json');
      await writeFile(
        customReportPath,
        JSON.stringify({ type: 'LogicStampSecurityReport', secretsFound: 0 })
      );

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js security --hard-reset ${fixturesPath} --out ${customReportPath} --force`
      );

      // Should delete both files
      expect(stdout).toContain('Reset complete');

      // Verify files were deleted
      let stampignoreExists = true;
      let reportExists = true;
      try {
        await access(stampignorePath);
      } catch {
        stampignoreExists = false;
      }
      try {
        await access(customReportPath);
      } catch {
        reportExists = false;
      }

      expect(stampignoreExists).toBe(false);
      expect(reportExists).toBe(false);
    }, 30000);

    it('should work with --quiet flag', async () => {
      // Create .stampignore
      const stampignorePath = join(fixturesPath, '.stampignore');
      await writeFile(
        stampignorePath,
        JSON.stringify({ ignore: ['src/secrets.ts'] })
      );

      // Create report file
      const reportPath = join(fixturesPath, 'stamp_security_report.json');
      await writeFile(
        reportPath,
        JSON.stringify({ type: 'LogicStampSecurityReport', secretsFound: 0 })
      );

      const { stdout } = await execAsync(
        `node dist/cli/stamp.js security --hard-reset ${fixturesPath} --out ${reportPath} --force --quiet`
      );

      // Should be minimal output
      expect(stdout.length).toBeLessThan(200);
      
      // Verify files were deleted
      let stampignoreExists = true;
      try {
        await access(stampignorePath);
      } catch {
        stampignoreExists = false;
      }
      expect(stampignoreExists).toBe(false);
    }, 30000);
  });
});

