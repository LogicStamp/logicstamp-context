/**
 * Tests for gitignore utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  gitignoreExists,
  readGitignore,
  hasPattern,
  hasLogicStampPatterns,
  addLogicStampPatterns,
  writeGitignore,
  ensureGitignorePatterns,
  LOGICSTAMP_GITIGNORE_PATTERNS,
} from '../../src/utils/gitignore.js';

describe('gitignore utilities', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = join(tmpdir(), `logicstamp-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('gitignoreExists', () => {
    it('should return false when .gitignore does not exist', async () => {
      const exists = await gitignoreExists(testDir);
      expect(exists).toBe(false);
    });

    it('should return true when .gitignore exists', async () => {
      await writeFile(join(testDir, '.gitignore'), 'node_modules\n');
      const exists = await gitignoreExists(testDir);
      expect(exists).toBe(true);
    });
  });

  describe('readGitignore', () => {
    it('should return empty string when .gitignore does not exist', async () => {
      const content = await readGitignore(testDir);
      expect(content).toBe('');
    });

    it('should return file content when .gitignore exists', async () => {
      const testContent = 'node_modules\ndist\n';
      await writeFile(join(testDir, '.gitignore'), testContent);
      const content = await readGitignore(testDir);
      expect(content).toBe(testContent);
    });
  });

  describe('hasPattern', () => {
    it('should return true when pattern exists', () => {
      const content = 'node_modules\ncontext.json\ndist\n';
      expect(hasPattern(content, 'context.json')).toBe(true);
    });

    it('should return false when pattern does not exist', () => {
      const content = 'node_modules\ndist\n';
      expect(hasPattern(content, 'context.json')).toBe(false);
    });

    it('should ignore whitespace', () => {
      const content = 'node_modules\n  context.json  \ndist\n';
      expect(hasPattern(content, 'context.json')).toBe(true);
    });
  });

  describe('hasLogicStampPatterns', () => {
    it('should return false for empty content', () => {
      expect(hasLogicStampPatterns('')).toBe(false);
    });

    it('should return true when all key patterns exist', () => {
      const content = 'node_modules\ncontext.json\ncontext_*.json\n';
      expect(hasLogicStampPatterns(content)).toBe(true);
    });

    it('should return true with context_main.json instead of context_*.json', () => {
      const content = 'node_modules\ncontext.json\ncontext_main.json\n';
      expect(hasLogicStampPatterns(content)).toBe(true);
    });

    it('should return false when only context.json exists', () => {
      const content = 'node_modules\ncontext.json\n';
      expect(hasLogicStampPatterns(content)).toBe(false);
    });

    it('should return false when only context_*.json exists', () => {
      const content = 'node_modules\ncontext_*.json\n';
      expect(hasLogicStampPatterns(content)).toBe(false);
    });
  });

  describe('addLogicStampPatterns', () => {
    it('should add all patterns to empty content', () => {
      const result = addLogicStampPatterns('');
      const expected = LOGICSTAMP_GITIGNORE_PATTERNS.join('\n') + '\n';
      expect(result).toBe(expected);
    });

    it('should add patterns with blank line separator', () => {
      const content = 'node_modules\ndist\n';
      const result = addLogicStampPatterns(content);
      expect(result).toContain('node_modules');
      expect(result).toContain('# LogicStamp context files');
      expect(result).toContain('context.json');
    });

    it('should not duplicate patterns if they already exist', () => {
      const content = LOGICSTAMP_GITIGNORE_PATTERNS.join('\n') + '\n';
      const result = addLogicStampPatterns(content);
      expect(result).toBe(content);
    });

    it('should handle content without trailing newline', () => {
      const content = 'node_modules';
      const result = addLogicStampPatterns(content);
      expect(result).toContain('node_modules');
      expect(result).toContain('# LogicStamp context files');
    });
  });

  describe('writeGitignore', () => {
    it('should write content to .gitignore', async () => {
      const content = 'node_modules\ncontext.json\n';
      await writeGitignore(testDir, content);

      const written = await readFile(join(testDir, '.gitignore'), 'utf-8');
      expect(written).toBe(content);
    });
  });

  describe('ensureGitignorePatterns', () => {
    it('should create .gitignore when it does not exist', async () => {
      const result = await ensureGitignorePatterns(testDir);

      expect(result.added).toBe(true);
      expect(result.created).toBe(true);

      const content = await readFile(join(testDir, '.gitignore'), 'utf-8');
      expect(content).toContain('context.json');
      expect(content).toContain('context_*.json');
      expect(content).toContain('*.uif.json');
      expect(content).toContain('logicstamp.manifest.json');
      expect(content).toContain('.logicstamp/');
    });

    it('should add patterns to existing .gitignore', async () => {
      await writeFile(join(testDir, '.gitignore'), 'node_modules\n');

      const result = await ensureGitignorePatterns(testDir);

      expect(result.added).toBe(true);
      expect(result.created).toBe(false);

      const content = await readFile(join(testDir, '.gitignore'), 'utf-8');
      expect(content).toContain('node_modules');
      expect(content).toContain('context.json');
    });

    it('should not modify .gitignore if patterns already exist', async () => {
      const initialContent = LOGICSTAMP_GITIGNORE_PATTERNS.join('\n') + '\n';
      await writeFile(join(testDir, '.gitignore'), initialContent);

      const result = await ensureGitignorePatterns(testDir);

      expect(result.added).toBe(false);
      expect(result.created).toBe(false);

      const content = await readFile(join(testDir, '.gitignore'), 'utf-8');
      expect(content).toBe(initialContent);
    });

    it('should preserve existing content when adding patterns', async () => {
      const existingContent = '# My custom ignore\nnode_modules\n*.log\n';
      await writeFile(join(testDir, '.gitignore'), existingContent);

      await ensureGitignorePatterns(testDir);

      const content = await readFile(join(testDir, '.gitignore'), 'utf-8');
      expect(content).toContain('# My custom ignore');
      expect(content).toContain('node_modules');
      expect(content).toContain('*.log');
      expect(content).toContain('context.json');
    });
  });
});
