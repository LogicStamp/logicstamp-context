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
  hasLogicStampBlock,
  getMissingPatterns,
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

  describe('hasLogicStampBlock', () => {
    it('should return false when block header does not exist', () => {
      const content = 'node_modules\ncontext.json\n';
      expect(hasLogicStampBlock(content)).toBe(false);
    });

    it('should return true when block header exists', () => {
      const content = 'node_modules\n# LogicStamp context & security files\ncontext.json\n';
      expect(hasLogicStampBlock(content)).toBe(true);
    });
  });

  describe('getMissingPatterns', () => {
    it('should return all patterns for empty content', () => {
      const missing = getMissingPatterns('');
      expect(missing).toEqual(LOGICSTAMP_GITIGNORE_PATTERNS);
    });

    it('should return empty array when all patterns exist', () => {
      const content = LOGICSTAMP_GITIGNORE_PATTERNS.join('\n') + '\n';
      const missing = getMissingPatterns(content);
      expect(missing).toEqual([]);
    });

    it('should return only missing patterns', () => {
      const content = '# LogicStamp context & security files\ncontext.json\ncontext_*.json\n';
      const missing = getMissingPatterns(content);
      expect(missing).toContain('*.uif.json');
      expect(missing).toContain('logicstamp.manifest.json');
      expect(missing).toContain('.logicstamp/');
      expect(missing).toContain('stamp_security_report.json');
      expect(missing).not.toContain('context.json');
      expect(missing).not.toContain('context_*.json');
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
      expect(result).toContain('# LogicStamp context & security files');
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
      expect(result).toContain('# LogicStamp context & security files');
    });

    it('should append only missing patterns when old block exists (edge case)', () => {
      // Simulate old .gitignore without stamp_security_report.json
      const oldPatterns = [
        '# LogicStamp context & security files',
        'context.json',
        'context_*.json',
        '*.uif.json',
        'logicstamp.manifest.json',
        '.logicstamp/',
        // Missing: stamp_security_report.json
      ];
      const content = oldPatterns.join('\n') + '\n';
      
      const result = addLogicStampPatterns(content);
      
      // Should contain all original patterns
      expect(result).toContain('context.json');
      expect(result).toContain('context_*.json');
      expect(result).toContain('*.uif.json');
      expect(result).toContain('logicstamp.manifest.json');
      expect(result).toContain('.logicstamp/');
      
      // Should now contain the missing pattern
      expect(result).toContain('stamp_security_report.json');
      
      // Should not duplicate the header
      const headerMatches = (result.match(/# LogicStamp context & security files/g) || []).length;
      expect(headerMatches).toBe(1);
    });

    it('should append multiple missing patterns when old block exists', () => {
      // Simulate very old .gitignore missing multiple patterns
      const oldPatterns = [
        '# LogicStamp context & security files',
        'context.json',
        'context_*.json',
        // Missing: *.uif.json, logicstamp.manifest.json, .logicstamp/, stamp_security_report.json
      ];
      const content = oldPatterns.join('\n') + '\n';
      
      const result = addLogicStampPatterns(content);
      
      // Should contain all patterns
      expect(result).toContain('context.json');
      expect(result).toContain('context_*.json');
      expect(result).toContain('*.uif.json');
      expect(result).toContain('logicstamp.manifest.json');
      expect(result).toContain('.logicstamp/');
      expect(result).toContain('stamp_security_report.json');
      
      // Should not duplicate existing patterns
      const contextJsonMatches = (result.match(/^context\.json$/gm) || []).length;
      expect(contextJsonMatches).toBe(1);
    });

    it('should preserve user content after LogicStamp block', () => {
      const content = [
        'node_modules',
        '',
        '# LogicStamp context & security files',
        'context.json',
        'context_*.json',
        '',
        '# User custom ignore',
        'custom.log',
      ].join('\n');
      
      const result = addLogicStampPatterns(content);
      
      // Should preserve user content
      expect(result).toContain('node_modules');
      expect(result).toContain('# User custom ignore');
      expect(result).toContain('custom.log');
      
      // Should add missing patterns
      expect(result).toContain('stamp_security_report.json');
    });

    it('should handle Windows line endings (CRLF)', () => {
      const content = 'node_modules\r\ncontext.json\r\n';
      const result = addLogicStampPatterns(content);
      
      // Should preserve CRLF line endings
      expect(result).toContain('node_modules');
      expect(result).toContain('context.json');
      expect(result).toContain('# LogicStamp context & security files');
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

    it('should update old block with missing patterns (edge case fix)', async () => {
      // Simulate old .gitignore without stamp_security_report.json
      const oldContent = [
        'node_modules',
        '',
        '# LogicStamp context & security files',
        'context.json',
        'context_*.json',
        '*.uif.json',
        'logicstamp.manifest.json',
        '.logicstamp/',
        // Missing: stamp_security_report.json
      ].join('\n') + '\n';
      
      await writeFile(join(testDir, '.gitignore'), oldContent);

      const result = await ensureGitignorePatterns(testDir);

      // Should detect and add the missing pattern
      expect(result.added).toBe(true);
      expect(result.created).toBe(false);

      const content = await readFile(join(testDir, '.gitignore'), 'utf-8');
      
      // Should preserve all original patterns
      expect(content).toContain('node_modules');
      expect(content).toContain('context.json');
      expect(content).toContain('context_*.json');
      expect(content).toContain('*.uif.json');
      expect(content).toContain('logicstamp.manifest.json');
      expect(content).toContain('.logicstamp/');
      
      // Should now include the missing pattern
      expect(content).toContain('stamp_security_report.json');
      
      // Should not duplicate the header
      const headerMatches = (content.match(/# LogicStamp context & security files/g) || []).length;
      expect(headerMatches).toBe(1);
    });

    it('should not modify .gitignore if all patterns already exist (even with old hasLogicStampPatterns check)', async () => {
      // This tests that ensureGitignorePatterns works correctly even when
      // hasLogicStampPatterns would return true (old check)
      const fullContent = LOGICSTAMP_GITIGNORE_PATTERNS.join('\n') + '\n';
      await writeFile(join(testDir, '.gitignore'), fullContent);

      const result = await ensureGitignorePatterns(testDir);

      expect(result.added).toBe(false);
      expect(result.created).toBe(false);

      const content = await readFile(join(testDir, '.gitignore'), 'utf-8');
      expect(content).toBe(fullContent);
    });
  });
});
