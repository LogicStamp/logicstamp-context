/**
 * Tests for code sanitization utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  loadSecurityReport,
  sanitizeCode,
} from '../../src/utils/codeSanitizer.js';
import type { SecurityReport } from '../../src/cli/commands/security.js';

describe('codeSanitizer utilities', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a unique test directory
    const uniqueId = randomUUID().substring(0, 8);
    testDir = join(process.cwd(), 'tests/e2e/output', `sanitizer-${uniqueId}`);
    await mkdir(testDir, { recursive: true });
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

  describe('loadSecurityReport', () => {
    it('should load security report when it exists', async () => {
      const report: SecurityReport = {
        type: 'LogicStampSecurityReport',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        projectRoot: testDir,
        filesScanned: 1,
        secretsFound: 1,
        matches: [
          {
            file: 'src/config.ts',
            line: 1,
            column: 12,
            type: 'API Key',
            snippet: "const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';",
            severity: 'high',
          },
        ],
        filesWithSecrets: ['src/config.ts'],
      };

      const reportPath = join(testDir, 'stamp_security_report.json');
      await writeFile(reportPath, JSON.stringify(report, null, 2));

      const loaded = await loadSecurityReport(testDir);

      expect(loaded).not.toBeNull();
      expect(loaded?.type).toBe('LogicStampSecurityReport');
      expect(loaded?.secretsFound).toBe(1);
      expect(loaded?.matches.length).toBe(1);
    });

    it('should return null when report does not exist', async () => {
      const loaded = await loadSecurityReport(testDir);
      expect(loaded).toBeNull();
    });

    it('should return null when report file is invalid JSON', async () => {
      const reportPath = join(testDir, 'stamp_security_report.json');
      await writeFile(reportPath, 'invalid json');

      const loaded = await loadSecurityReport(testDir);
      expect(loaded).toBeNull();
    });
  });

  describe('sanitizeCode', () => {
    it('should replace API key with PRIVATE_DATA', async () => {
      const report: SecurityReport = {
        type: 'LogicStampSecurityReport',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        projectRoot: testDir,
        filesScanned: 1,
        secretsFound: 1,
        matches: [
          {
            file: 'src/config.ts',
            line: 1,
            column: 12,
            type: 'API Key',
            snippet: "const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';",
            severity: 'high',
          },
        ],
        filesWithSecrets: ['src/config.ts'],
      };

      const reportPath = join(testDir, 'stamp_security_report.json');
      await writeFile(reportPath, JSON.stringify(report, null, 2));

      const code = "const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';";
      const filePath = resolve(testDir, 'src/config.ts');
      const result = sanitizeCode(code, filePath, report, testDir);

      expect(result.sanitized).toContain('PRIVATE_DATA');
      expect(result.sanitized).not.toContain('FAKE_API_KEY_1234567890abcdefghijklmnop');
      expect(result.sanitized).toContain("const apiKey = 'PRIVATE_DATA';");
      expect(result.secretsReplaced).toBe(true);
      expect(result.matchCount).toBe(1);
    });

    it('should replace password with PRIVATE_DATA', async () => {
      const report: SecurityReport = {
        type: 'LogicStampSecurityReport',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        projectRoot: testDir,
        filesScanned: 1,
        secretsFound: 1,
        matches: [
          {
            file: 'src/config.ts',
            line: 2,
            column: 15,
            type: 'Password',
            snippet: "const password = 'FAKE_PASSWORD_1234567890abcdefghijklmnop';",
            severity: 'high',
          },
        ],
        filesWithSecrets: ['src/config.ts'],
      };

      const code = `const apiKey = 'some_key';
const password = 'FAKE_PASSWORD_1234567890abcdefghijklmnop';`;
      const filePath = resolve(testDir, 'src/config.ts');
      const result = sanitizeCode(code, filePath, report, testDir);

      expect(result.sanitized).toContain('PRIVATE_DATA');
      expect(result.sanitized).not.toContain('FAKE_PASSWORD_1234567890abcdefghijklmnop');
      expect(result.sanitized).toContain("const password = 'PRIVATE_DATA';");
      // Other lines should remain unchanged
      expect(result.sanitized).toContain("const apiKey = 'some_key';");
      expect(result.secretsReplaced).toBe(true);
      expect(result.matchCount).toBe(1);
    });

    it('should replace token with PRIVATE_DATA', async () => {
      const report: SecurityReport = {
        type: 'LogicStampSecurityReport',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        projectRoot: testDir,
        filesScanned: 1,
        secretsFound: 1,
        matches: [
          {
            file: 'src/auth.ts',
            line: 1,
            column: 12,
            type: 'Token',
            snippet: 'const token = "FAKE_TOKEN_1234567890abcdefghijklmnopqrstuvwxyz";',
            severity: 'high',
          },
        ],
        filesWithSecrets: ['src/auth.ts'],
      };

      const code = 'const token = "FAKE_TOKEN_1234567890abcdefghijklmnopqrstuvwxyz";';
      const filePath = resolve(testDir, 'src/auth.ts');
      const result = sanitizeCode(code, filePath, report, testDir);

      expect(result.sanitized).toContain('PRIVATE_DATA');
      expect(result.sanitized).not.toContain('FAKE_TOKEN_1234567890abcdefghijklmnopqrstuvwxyz');
      expect(result.sanitized).toContain('const token = "PRIVATE_DATA";');
      expect(result.secretsReplaced).toBe(true);
      expect(result.matchCount).toBe(1);
    });

    it('should handle multiple secrets in same file', async () => {
      const report: SecurityReport = {
        type: 'LogicStampSecurityReport',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        projectRoot: testDir,
        filesScanned: 1,
        secretsFound: 3,
        matches: [
          {
            file: 'src/config.ts',
            line: 1,
            column: 12,
            type: 'API Key',
            snippet: "const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';",
            severity: 'high',
          },
          {
            file: 'src/config.ts',
            line: 2,
            column: 15,
            type: 'Password',
            snippet: "const password = 'FAKE_PASSWORD_1234567890abcdefghijklmnop';",
            severity: 'high',
          },
          {
            file: 'src/config.ts',
            line: 3,
            column: 12,
            type: 'Token',
            snippet: "const token = 'FAKE_TOKEN_1234567890abcdefghijklmnopqrstuvwxyz';",
            severity: 'high',
          },
        ],
        filesWithSecrets: ['src/config.ts'],
      };

      const code = `const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';
const password = 'FAKE_PASSWORD_1234567890abcdefghijklmnop';
const token = 'FAKE_TOKEN_1234567890abcdefghijklmnopqrstuvwxyz';`;
      const filePath = resolve(testDir, 'src/config.ts');
      const result = sanitizeCode(code, filePath, report, testDir);

      expect(result.sanitized).toContain('PRIVATE_DATA');
      expect(result.sanitized).not.toContain('FAKE_API_KEY_1234567890abcdefghijklmnop');
      expect(result.sanitized).not.toContain('FAKE_PASSWORD_1234567890abcdefghijklmnop');
      expect(result.sanitized).not.toContain('FAKE_TOKEN_1234567890abcdefghijklmnopqrstuvwxyz');
      expect(result.sanitized).toContain("const apiKey = 'PRIVATE_DATA';");
      expect(result.sanitized).toContain("const password = 'PRIVATE_DATA';");
      expect(result.sanitized).toContain("const token = 'PRIVATE_DATA';");
      expect(result.secretsReplaced).toBe(true);
      expect(result.matchCount).toBe(3);
    });

    it('should not sanitize code when no report provided', () => {
      const code = "const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';";
      const filePath = resolve(testDir, 'src/config.ts');
      const result = sanitizeCode(code, filePath, null, testDir);

      expect(result.sanitized).toBe(code);
      expect(result.sanitized).toContain('FAKE_API_KEY_1234567890abcdefghijklmnop');
      expect(result.secretsReplaced).toBe(false);
      expect(result.matchCount).toBe(0);
    });

    it('should not sanitize code when report has no matches', () => {
      const report: SecurityReport = {
        type: 'LogicStampSecurityReport',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        projectRoot: testDir,
        filesScanned: 1,
        secretsFound: 0,
        matches: [],
        filesWithSecrets: [],
      };

      const code = "const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';";
      const filePath = resolve(testDir, 'src/config.ts');
      const result = sanitizeCode(code, filePath, report, testDir);

      expect(result.sanitized).toBe(code);
      expect(result.secretsReplaced).toBe(false);
      expect(result.matchCount).toBe(0);
    });

    it('should not sanitize code when file is not in report', () => {
      const report: SecurityReport = {
        type: 'LogicStampSecurityReport',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        projectRoot: testDir,
        filesScanned: 1,
        secretsFound: 1,
        matches: [
          {
            file: 'src/other.ts',
            line: 1,
            column: 12,
            type: 'API Key',
            snippet: "const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';",
            severity: 'high',
          },
        ],
        filesWithSecrets: ['src/other.ts'],
      };

      const code = "const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';";
      const filePath = resolve(testDir, 'src/config.ts'); // Different file
      const result = sanitizeCode(code, filePath, report, testDir);

      expect(result.sanitized).toBe(code);
      expect(result.sanitized).toContain('FAKE_API_KEY_1234567890abcdefghijklmnop');
      expect(result.secretsReplaced).toBe(false);
      expect(result.matchCount).toBe(0);
    });

    it('should handle database URLs with credentials', async () => {
      const report: SecurityReport = {
        type: 'LogicStampSecurityReport',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        projectRoot: testDir,
        filesScanned: 1,
        secretsFound: 1,
        matches: [
          {
            file: 'src/db.ts',
            line: 1,
            column: 12,
            type: 'Database URL with Credentials',
            snippet: "const dbUrl = 'postgres://user:password123@localhost:5432/db';",
            severity: 'high',
          },
        ],
        filesWithSecrets: ['src/db.ts'],
      };

      const code = "const dbUrl = 'postgres://user:password123@localhost:5432/db';";
      const filePath = resolve(testDir, 'src/db.ts');
      const result = sanitizeCode(code, filePath, report, testDir);

      expect(result.sanitized).toContain('PRIVATE_DATA');
      expect(result.sanitized).not.toContain('password123');
      expect(result.sanitized).toContain('postgres://user:PRIVATE_DATA@localhost:5432/db');
      expect(result.secretsReplaced).toBe(true);
      expect(result.matchCount).toBe(1);
    });

    it('should handle different quote types (single, double, backticks)', async () => {
      const report: SecurityReport = {
        type: 'LogicStampSecurityReport',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        projectRoot: testDir,
        filesScanned: 1,
        secretsFound: 3,
        matches: [
          {
            file: 'src/config.ts',
            line: 1,
            column: 12,
            type: 'API Key',
            snippet: "const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';",
            severity: 'high',
          },
          {
            file: 'src/config.ts',
            line: 2,
            column: 12,
            type: 'Token',
            snippet: 'const token = "FAKE_TOKEN_1234567890abcdefghijklmnopqrstuvwxyz";',
            severity: 'high',
          },
          {
            file: 'src/config.ts',
            line: 3,
            column: 12,
            type: 'Secret',
            snippet: 'const secret = `FAKE_SECRET_1234567890abcdefghijklmnop`;',
            severity: 'medium',
          },
        ],
        filesWithSecrets: ['src/config.ts'],
      };

      const code = `const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';
const token = "FAKE_TOKEN_1234567890abcdefghijklmnopqrstuvwxyz";
const secret = \`FAKE_SECRET_1234567890abcdefghijklmnop\`;`;
      const filePath = resolve(testDir, 'src/config.ts');
      const result = sanitizeCode(code, filePath, report, testDir);

      expect(result.sanitized).toContain("const apiKey = 'PRIVATE_DATA';");
      expect(result.sanitized).toContain('const token = "PRIVATE_DATA";');
      expect(result.sanitized).toContain('const secret = `PRIVATE_DATA`;');
      expect(result.secretsReplaced).toBe(true);
      expect(result.matchCount).toBe(3);
    });

    it('should preserve code structure and other content', async () => {
      const report: SecurityReport = {
        type: 'LogicStampSecurityReport',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        projectRoot: testDir,
        filesScanned: 1,
        secretsFound: 1,
        matches: [
          {
            file: 'src/config.ts',
            line: 3,
            column: 12,
            type: 'API Key',
            snippet: "  const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';",
            severity: 'high',
          },
        ],
        filesWithSecrets: ['src/config.ts'],
      };

      const code = `export function getConfig() {
  const baseUrl = 'https://api.example.com';
  const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';
  return { baseUrl, apiKey };
}`;
      const filePath = resolve(testDir, 'src/config.ts');
      const result = sanitizeCode(code, filePath, report, testDir);

      // Should preserve function structure
      expect(result.sanitized).toContain('export function getConfig()');
      expect(result.sanitized).toContain("const baseUrl = 'https://api.example.com';");
      expect(result.sanitized).toContain('return { baseUrl, apiKey };');
      // Should sanitize the secret
      expect(result.sanitized).toContain("const apiKey = 'PRIVATE_DATA';");
      expect(result.sanitized).not.toContain('FAKE_API_KEY_1234567890abcdefghijklmnop');
      expect(result.secretsReplaced).toBe(true);
      expect(result.matchCount).toBe(1);
    });

    it('should handle relative and absolute file paths correctly', async () => {
      const report: SecurityReport = {
        type: 'LogicStampSecurityReport',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        projectRoot: testDir,
        filesScanned: 1,
        secretsFound: 1,
        matches: [
          {
            file: 'src/config.ts', // Relative path in report
            line: 1,
            column: 12,
            type: 'API Key',
            snippet: "const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';",
            severity: 'high',
          },
        ],
        filesWithSecrets: ['src/config.ts'],
      };

      const code = "const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';";
      // Test with absolute path
      const absolutePath = resolve(testDir, 'src/config.ts');
      const result = sanitizeCode(code, absolutePath, report, testDir);

      expect(result.sanitized).toContain('PRIVATE_DATA');
      expect(result.sanitized).not.toContain('FAKE_API_KEY_1234567890abcdefghijklmnop');
      expect(result.secretsReplaced).toBe(true);
      expect(result.matchCount).toBe(1);
    });

    it('should handle secrets on different lines correctly', async () => {
      const report: SecurityReport = {
        type: 'LogicStampSecurityReport',
        schemaVersion: '0.1',
        createdAt: new Date().toISOString(),
        projectRoot: testDir,
        filesScanned: 1,
        secretsFound: 2,
        matches: [
          {
            file: 'src/config.ts',
            line: 1,
            column: 12,
            type: 'API Key',
            snippet: "const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';",
            severity: 'high',
          },
          {
            file: 'src/config.ts',
            line: 10,
            column: 15,
            type: 'Password',
            snippet: "  const password = 'FAKE_PASSWORD_1234567890abcdefghijklmnop';",
            severity: 'high',
          },
        ],
        filesWithSecrets: ['src/config.ts'],
      };

      const code = `const apiKey = 'FAKE_API_KEY_1234567890abcdefghijklmnop';

export function getConfig() {
  return {
    baseUrl: 'https://api.example.com',
  };
}

function getPassword() {
  const password = 'FAKE_PASSWORD_1234567890abcdefghijklmnop';
  return password;
}`;
      const filePath = resolve(testDir, 'src/config.ts');
      const result = sanitizeCode(code, filePath, report, testDir);

      // Both secrets should be sanitized
      expect(result.sanitized).toContain("const apiKey = 'PRIVATE_DATA';");
      expect(result.sanitized).toContain("const password = 'PRIVATE_DATA';");
      // Other content should remain
      expect(result.sanitized).toContain('export function getConfig()');
      expect(result.sanitized).toContain("baseUrl: 'https://api.example.com'");
      expect(result.secretsReplaced).toBe(true);
      expect(result.matchCount).toBe(2);
    });
  });
});

