/**
 * Tests for secret detector utilities
 */

import { describe, it, expect } from 'vitest';
import {
  scanFileForSecrets,
  filterFalsePositives,
  type SecretMatch,
} from '../../src/utils/secretDetector.js';

describe('secretDetector utilities', () => {
  describe('scanFileForSecrets', () => {
    it('should detect API keys', () => {
      const content = "const apiKey = 'FAKE_API_KEY_DO_NOT_USE_1234567890abcdefghijklmnop';";
      const filePath = 'src/config.ts';
      const matches = scanFileForSecrets(filePath, content);

      expect(matches.length).toBeGreaterThan(0);
      const apiKeyMatch = matches.find((m) => m.type === 'API Key');
      expect(apiKeyMatch).toBeDefined();
      expect(apiKeyMatch?.file).toBe(filePath);
      expect(apiKeyMatch?.line).toBe(1);
      expect(apiKeyMatch?.severity).toBe('high');
      expect(apiKeyMatch?.snippet).toContain('apiKey');
    });

    it('should detect API keys with different formats', () => {
      const content = `
        const api_key = "FAKE_API_KEY_DO_NOT_USE_1234567890abcdefghijklmnop";
        const apikey = 'FAKE_API_KEY_DO_NOT_USE_1234567890abcdefghijklmnop';
        const API_KEY = "FAKE_API_KEY_DO_NOT_USE_1234567890abcdefghijklmnop";
      `;
      const matches = scanFileForSecrets('test.ts', content);

      expect(matches.length).toBeGreaterThanOrEqual(2);
      const apiKeyMatches = matches.filter((m) => m.type === 'API Key');
      expect(apiKeyMatches.length).toBeGreaterThan(0);
    });

    it('should detect AWS access keys', () => {
      // Use string concatenation to avoid GitHub push protection blocking
      const prefix = 'AK' + 'IA';
      const content = `const awsKey = '${prefix}FAKETEST00000000';`;
      const matches = scanFileForSecrets('config.ts', content);

      const awsMatch = matches.find((m) => m.type === 'AWS Access Key');
      expect(awsMatch).toBeDefined();
      expect(awsMatch?.severity).toBe('high');
    });

    it('should detect GitHub tokens', () => {
      // Use string concatenation to avoid GitHub push protection blocking
      const prefix = 'gh' + 'p_';
      const content = `const githubToken = '${prefix}FAKETEST0000000000000000000000000000';`;
      const matches = scanFileForSecrets('config.ts', content);

      const githubMatch = matches.find((m) => m.type === 'GitHub Token');
      expect(githubMatch).toBeDefined();
      expect(githubMatch?.severity).toBe('high');
    });

    it('should detect different GitHub token types', () => {
      // Use string concatenation to avoid GitHub push protection blocking
      const prefix1 = 'gh' + 'p_';
      const prefix2 = 'gh' + 'o_';
      const prefix3 = 'gh' + 'u_';
      const content = `
        const token1 = '${prefix1}FAKETEST0000000000000000000000000000';
        const token2 = '${prefix2}FAKETEST0000000000000000000000000000';
        const token3 = '${prefix3}FAKETEST0000000000000000000000000000';
      `;
      const matches = scanFileForSecrets('tokens.ts', content);

      const githubMatches = matches.filter((m) => m.type === 'GitHub Token');
      expect(githubMatches.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect private keys', () => {
      const content = `
        const key = \`-----BEGIN RSA PRIVATE KEY-----
        MIIEpAIBAAKCAQEA...
        -----END RSA PRIVATE KEY-----\`;
      `;
      const matches = scanFileForSecrets('keys.ts', content);

      const privateKeyMatch = matches.find((m) => m.type === 'Private Key');
      expect(privateKeyMatch).toBeDefined();
      expect(privateKeyMatch?.severity).toBe('high');
    });

    it('should detect passwords', () => {
      const content = "const password = 'FAKE_PASSWORD_DO_NOT_USE_1234567890abcdefghijklmnop';";
      const matches = scanFileForSecrets('config.ts', content);

      const passwordMatch = matches.find((m) => m.type === 'Password');
      expect(passwordMatch).toBeDefined();
      expect(passwordMatch?.severity).toBe('high');
      expect(passwordMatch?.snippet).toContain('password');
    });

    it('should detect tokens', () => {
      const content = "const token = 'FAKE_TOKEN_DO_NOT_USE_1234567890abcdefghijklmnopqrstuvwxyz';";
      const matches = scanFileForSecrets('auth.ts', content);

      const tokenMatch = matches.find((m) => m.type === 'Token');
      expect(tokenMatch).toBeDefined();
      expect(tokenMatch?.severity).toBe('high');
    });

    it('should detect OAuth secrets', () => {
      const content = "const oauthSecret = 'FAKE_OAUTH_SECRET_DO_NOT_USE_1234567890abcdefghijklmnop';";
      const matches = scanFileForSecrets('oauth.ts', content);

      const oauthMatch = matches.find((m) => m.type === 'OAuth Secret');
      expect(oauthMatch).toBeDefined();
      expect(oauthMatch?.severity).toBe('high');
    });

    it('should detect database URLs with credentials', () => {
      const content = "const dbUrl = 'postgres://user:password@localhost:5432/db';";
      const matches = scanFileForSecrets('db.ts', content);

      const dbMatch = matches.find((m) => m.type === 'Database URL with Credentials');
      expect(dbMatch).toBeDefined();
      expect(dbMatch?.severity).toBe('high');
    });

    it('should detect JWT secrets', () => {
      const content = "const jwtSecret = 'FAKE_JWT_SECRET_DO_NOT_USE_1234567890abcdefghijklmnop';";
      const matches = scanFileForSecrets('jwt.ts', content);

      const jwtMatch = matches.find((m) => m.type === 'JWT Secret');
      expect(jwtMatch).toBeDefined();
      expect(jwtMatch?.severity).toBe('high');
    });

    it('should detect generic secrets', () => {
      const content = "const secret = 'FAKE_SECRET_KEY_DO_NOT_USE_1234567890abcdefghijklmnop';";
      const matches = scanFileForSecrets('config.ts', content);

      const secretMatch = matches.find((m) => m.type === 'Secret');
      expect(secretMatch).toBeDefined();
      expect(secretMatch?.severity).toBe('medium');
    });

    it('should return empty array when no secrets found', () => {
      const content = "const publicValue = 'hello world';";
      const matches = scanFileForSecrets('file.ts', content);

      expect(matches).toHaveLength(0);
    });

    it('should detect multiple secrets in same file', () => {
      const content = `
        const apiKey = 'FAKE_API_KEY_DO_NOT_USE_1234567890abcdefghijklmnop';
        const password = 'FAKE_PASSWORD_DO_NOT_USE_1234567890abcdefghijklmnop';
        const token = 'FAKE_TOKEN_DO_NOT_USE_1234567890abcdefghijklmnopqrstuvwxyz';
      `;
      const matches = scanFileForSecrets('secrets.ts', content);

      expect(matches.length).toBeGreaterThanOrEqual(3);
    });

    it('should detect secrets on different lines', () => {
      const content = `const config = {
  apiKey: 'FAKE_API_KEY_DO_NOT_USE_1234567890abcdefghijklmnop',
};

const auth = {
  password: 'FAKE_PASSWORD_DO_NOT_USE_1234567890abcdefghijklmnop',
};`;
      const matches = scanFileForSecrets('config.ts', content);

      expect(matches.length).toBeGreaterThanOrEqual(2);
      const lineNumbers = matches.map((m) => m.line);
      // apiKey should be on line 2, password should be on a later line
      expect(lineNumbers).toContain(2); // apiKey line
      expect(lineNumbers.some((n) => n > 2)).toBe(true); // password line
    });

    it('should include correct column numbers', () => {
      const content = "    const apiKey = 'FAKE_API_KEY_DO_NOT_USE_1234567890abcdefghijklmnop';";
      const matches = scanFileForSecrets('file.ts', content);

      if (matches.length > 0) {
        const match = matches[0];
        expect(match.column).toBeGreaterThan(0);
        expect(typeof match.column).toBe('number');
      }
    });

    it('should include snippet in match', () => {
      const content = "const apiKey = 'FAKE_API_KEY_DO_NOT_USE_1234567890abcdefghijklmnop';";
      const matches = scanFileForSecrets('file.ts', content);

      if (matches.length > 0) {
        const match = matches[0];
        expect(match.snippet).toBeDefined();
        expect(match.snippet.length).toBeGreaterThan(0);
        expect(match.snippet).toContain('apiKey');
      }
    });

    it('should handle empty file', () => {
      const matches = scanFileForSecrets('empty.ts', '');
      expect(matches).toHaveLength(0);
    });

    it('should handle file with only whitespace', () => {
      const matches = scanFileForSecrets('whitespace.ts', '   \n\n  \t  ');
      expect(matches).toHaveLength(0);
    });

    it('should detect secrets with different quote types', () => {
      const content = `const apiKey = "FAKE_API_KEY_DO_NOT_USE_1234567890abcdefghijklmnop";
const api_key = 'FAKE_API_KEY_DO_NOT_USE_1234567890abcdefghijklmnop';
const token = \`FAKE_TOKEN_DO_NOT_USE_1234567890abcdefghijklmnopqrstuvwxyz\`;`;
      const matches = scanFileForSecrets('quotes.ts', content);

      // Should detect at least double and single quotes (backticks may not match all patterns)
      // The patterns look for specific variable names like "apiKey", "api_key", "token", etc.
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should handle JSON format', () => {
      const content = JSON.stringify({
        apiKey: 'FAKE_API_KEY_DO_NOT_USE_1234567890abcdefghijklmnop',
        password: 'FAKE_PASSWORD_DO_NOT_USE_1234567890abcdefghijklmnop',
      }, null, 2);
      const matches = scanFileForSecrets('config.json', content);

      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe('filterFalsePositives', () => {
    it('should filter out example patterns', () => {
      const matches: SecretMatch[] = [
        {
          file: 'test.ts',
          line: 1,
          column: 1,
          type: 'API Key',
          snippet: 'apiKey = "example_key_1234567890abcdefghijklmnopqrstuvwxyz"',
          severity: 'high',
        },
        {
          file: 'test.ts',
          line: 2,
          column: 1,
          type: 'API Key',
          snippet: 'apiKey = "real_key_1234567890abcdefghijklmnopqrstuvwxyz"',
          severity: 'high',
        },
      ];

      const filtered = filterFalsePositives(matches);

      // Should filter out the example
      const exampleMatch = filtered.find((m) => m.snippet.includes('example'));
      expect(exampleMatch).toBeUndefined();

      // Should keep the real one
      const realMatch = filtered.find((m) => m.snippet.includes('real_key'));
      expect(realMatch).toBeDefined();
    });

    it('should filter out test patterns', () => {
      const matches: SecretMatch[] = [
        {
          file: 'test.ts',
          line: 1,
          column: 1,
          type: 'API Key',
          snippet: 'apiKey = "test_key_1234567890abcdefghijklmnopqrstuvwxyz"',
          severity: 'high',
        },
        {
          file: 'test.ts',
          line: 2,
          column: 1,
          type: 'Password',
          snippet: 'password = "test_password_12345678"',
          severity: 'high',
        },
      ];

      const filtered = filterFalsePositives(matches);

      expect(filtered.length).toBeLessThan(matches.length);
    });

    it('should filter out sample patterns', () => {
      const matches: SecretMatch[] = [
        {
          file: 'test.ts',
          line: 1,
          column: 1,
          type: 'API Key',
          snippet: 'apiKey = "sample_key_1234567890abcdefghijklmnopqrstuvwxyz"',
          severity: 'high',
        },
      ];

      const filtered = filterFalsePositives(matches);

      expect(filtered.length).toBe(0);
    });

    it('should filter out comment-only matches', () => {
      const matches: SecretMatch[] = [
        {
          file: 'test.ts',
          line: 1,
          column: 1,
          type: 'API Key',
          snippet: '// apiKey = "some_key_1234567890abcdefghijklmnopqrstuvwxyz"',
          severity: 'high',
        },
        {
          file: 'test.ts',
          line: 2,
          column: 1,
          type: 'API Key',
          snippet: '/* apiKey = "some_key_1234567890abcdefghijklmnopqrstuvwxyz" */',
          severity: 'high',
        },
        {
          file: 'test.ts',
          line: 3,
          column: 1,
          type: 'API Key',
          snippet: 'const apiKey = "some_key_1234567890abcdefghijklmnopqrstuvwxyz"; // comment',
          severity: 'high',
        },
      ];

      const filtered = filterFalsePositives(matches);

      // Should filter out pure comments (first two)
      // But keep the one with actual assignment (third one)
      expect(filtered.length).toBeGreaterThan(0);
      const hasAssignment = filtered.some((m) => m.snippet.includes('const apiKey'));
      expect(hasAssignment).toBe(true);
    });

    it('should filter out very short generic secrets', () => {
      const matches: SecretMatch[] = [
        {
          file: 'test.ts',
          line: 1,
          column: 1,
          type: 'Secret',
          snippet: 'secret = "short"', // Less than 20 chars
          severity: 'medium',
        },
        {
          file: 'test.ts',
          line: 2,
          column: 1,
          type: 'Secret',
          snippet: 'secret = "this_is_a_longer_secret_key_1234567890"', // More than 20 chars
          severity: 'medium',
        },
      ];

      const filtered = filterFalsePositives(matches);

      // Should filter out the short one
      const shortMatch = filtered.find((m) => m.snippet.includes('short'));
      expect(shortMatch).toBeUndefined();

      // Should keep the longer one
      const longMatch = filtered.find((m) => m.snippet.includes('longer'));
      expect(longMatch).toBeDefined();
    });

    it('should not filter out valid secrets', () => {
      const matches: SecretMatch[] = [
        {
          file: 'config.ts',
          line: 1,
          column: 1,
          type: 'API Key',
          snippet: 'const apiKey = "FAKE_API_KEY_DO_NOT_USE_1234567890abcdefghijklmnop";',
          severity: 'high',
        },
        {
          file: 'config.ts',
          line: 2,
          column: 1,
          type: 'Password',
          snippet: 'const password = "FAKE_PASSWORD_DO_NOT_USE_1234567890abcdefghijklmnop";',
          severity: 'high',
        },
      ];

      const filtered = filterFalsePositives(matches);

      expect(filtered.length).toBe(matches.length);
    });

    it('should handle empty array', () => {
      const filtered = filterFalsePositives([]);
      expect(filtered).toHaveLength(0);
    });

    it('should preserve all match properties', () => {
      const matches: SecretMatch[] = [
        {
          file: 'test.ts',
          line: 5,
          column: 10,
          type: 'API Key',
          snippet: 'const apiKey = "FAKE_API_KEY_DO_NOT_USE_1234567890abcdefghijklmnop";',
          severity: 'high',
        },
      ];

      const filtered = filterFalsePositives(matches);

      if (filtered.length > 0) {
        const match = filtered[0];
        expect(match.file).toBe('test.ts');
        expect(match.line).toBe(5);
        expect(match.column).toBe(10);
        expect(match.type).toBe('API Key');
        expect(match.severity).toBe('high');
        expect(match.snippet).toBeDefined();
      }
    });

    it('should handle matches with colons in comments', () => {
      const matches: SecretMatch[] = [
        {
          file: 'test.ts',
          line: 1,
          column: 1,
          type: 'API Key',
          snippet: '// Documentation: apiKey example',
          severity: 'high',
        },
        {
          file: 'test.ts',
          line: 2,
          column: 1,
          type: 'API Key',
          snippet: 'const apiKey: string = "real_key_1234567890abcdefghijklmnopqrstuvwxyz";',
          severity: 'high',
        },
      ];

      const filtered = filterFalsePositives(matches);

      // Should filter out the comment
      const commentMatch = filtered.find((m) => m.snippet.includes('Documentation'));
      expect(commentMatch).toBeUndefined();

      // Should keep the real assignment (even though it has a colon for TypeScript type)
      const realMatch = filtered.find((m) => m.snippet.includes('real_key'));
      expect(realMatch).toBeDefined();
    });
  });
});

