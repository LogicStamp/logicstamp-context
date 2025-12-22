/**
 * Utilities for managing .gitignore files
 */

import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { readConfig, updateConfig } from './config.js';
import { debugError } from './debug.js';

/**
 * Patterns that should be added to .gitignore for LogicStamp context & security files
 */
export const LOGICSTAMP_GITIGNORE_PATTERNS = [
  '# LogicStamp context & security files',
  'context.json',
  'context_*.json',
  'context.toon',
  'context_*.toon',
  '*.uif.json',
  'logicstamp.manifest.json',
  '.logicstamp/',
  'stamp_security_report.json',
];

/**
 * Check if .gitignore exists in the given directory
 */
export async function gitignoreExists(targetDir: string): Promise<boolean> {
  try {
    await access(join(targetDir, '.gitignore'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read .gitignore content
 */
export async function readGitignore(targetDir: string): Promise<string> {
  const gitignorePath = join(targetDir, '.gitignore');
  try {
    return await readFile(gitignorePath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Check if a pattern exists in .gitignore content
 */
export function hasPattern(content: string, pattern: string): boolean {
  const lines = content.split(/\r?\n/).map(line => line.trim());
  return lines.includes(pattern);
}

/**
 * Check if .gitignore has the LogicStamp block header comment
 */
export function hasLogicStampBlock(content: string): boolean {
  return hasPattern(content, '# LogicStamp context & security files');
}

/**
 * Check if .gitignore has LogicStamp patterns
 * This is a legacy function for backward compatibility - checks for key patterns
 */
export function hasLogicStampPatterns(content: string): boolean {
  // Check for the key patterns (ignore the comment line)
  const patterns = LOGICSTAMP_GITIGNORE_PATTERNS.filter(p => !p.startsWith('#'));

  // Check if at least the main patterns exist
  // We consider it "has patterns" if context.json and context_*.json are present
  return hasPattern(content, 'context.json') &&
         (hasPattern(content, 'context_*.json') || hasPattern(content, 'context_main.json'));
}

/**
 * Get which LogicStamp patterns are missing from .gitignore content
 */
export function getMissingPatterns(content: string): string[] {
  return LOGICSTAMP_GITIGNORE_PATTERNS.filter(pattern => {
    return !hasPattern(content, pattern);
  });
}

/**
 * Find the insertion point for LogicStamp patterns in .gitignore content
 * Returns the index where the LogicStamp block starts, or -1 if not found
 */
function findLogicStampBlockIndex(lines: string[]): number {
  const headerIndex = lines.findIndex(line => line.trim() === '# LogicStamp context & security files');
  return headerIndex;
}

/**
 * Find the insertion point for missing LogicStamp patterns
 * Returns the index after the last existing LogicStamp pattern in the block
 */
function findLogicStampInsertionPoint(lines: string[], startIndex: number): number {
  // Known LogicStamp patterns (excluding the header comment)
  const knownPatterns = new Set(
    LOGICSTAMP_GITIGNORE_PATTERNS.filter(p => !p.startsWith('#')).map(p => p.trim())
  );

  let lastPatternIndex = startIndex; // Start after the header comment
  
  // Find the last LogicStamp pattern in the block
  for (let i = startIndex + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    
    // If we hit a blank line, stop here (insert before the blank line)
    if (trimmed === '') {
      return i;
    }
    
    // If we hit a non-LogicStamp pattern (not a comment, not a known pattern), stop here
    if (!trimmed.startsWith('#') && !knownPatterns.has(trimmed)) {
      return i;
    }
    
    // If this is a LogicStamp pattern (comment or known pattern), update lastPatternIndex
    if (trimmed.startsWith('#') || knownPatterns.has(trimmed)) {
      lastPatternIndex = i + 1; // Insert after this line
    }
  }
  
  // Block extends to end of file - insert at the end
  return lastPatternIndex;
}

/**
 * Add LogicStamp patterns to .gitignore content (idempotent patch mode)
 * 
 * Behavior:
 * - If LogicStamp block exists: append only missing patterns to the block
 * - If LogicStamp block doesn't exist: add full block at the end
 * - Never duplicates patterns
 * - Preserves user's manual additions
 */
export function addLogicStampPatterns(content: string): string {
  const lines = content.split(/\r?\n/);
  const hasBlock = hasLogicStampBlock(content);
  const missingPatterns = getMissingPatterns(content);

  // If block exists and all patterns are present, return unchanged
  if (hasBlock && missingPatterns.length === 0) {
    return content;
  }

  // If block exists but patterns are missing, append only missing ones
  if (hasBlock && missingPatterns.length > 0) {
    const blockStartIndex = findLogicStampBlockIndex(lines);
    const insertIndex = findLogicStampInsertionPoint(lines, blockStartIndex);
    
    // Insert missing patterns right after the last existing LogicStamp pattern
    const newLines = [...lines];
    const patternsToAdd = missingPatterns.map(p => p.trim());
    
    // Insert patterns at the insertion point
    newLines.splice(insertIndex, 0, ...patternsToAdd);
    
    // Preserve original line ending style
    const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
    return newLines.join(lineEnding) + (content.endsWith(lineEnding) ? '' : lineEnding);
  }

  // Block doesn't exist - add full block at the end
  let newContent = content;
  
  // Add blank lines before the section if content exists
  if (newContent.length > 0) {
    // Normalize line endings and ensure we end with at least one newline
    const normalized = newContent.replace(/\r\n/g, '\n');
    if (!normalized.endsWith('\n')) {
      newContent = normalized + '\n';
    } else {
      newContent = normalized;
    }
    
    // Add one more blank line if content doesn't already end with one
    if (!newContent.endsWith('\n\n')) {
      newContent += '\n';
    }
  }

  // Add all LogicStamp patterns as a group
  newContent += LOGICSTAMP_GITIGNORE_PATTERNS.join('\n') + '\n';

  return newContent;
}

/**
 * Write content to .gitignore
 */
export async function writeGitignore(targetDir: string, content: string): Promise<void> {
  const gitignorePath = join(targetDir, '.gitignore');
  
  try {
    await writeFile(gitignorePath, content, 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('gitignore', 'writeGitignore', {
      gitignorePath,
      targetDir,
      message: err.message,
      code: err.code,
    });
    
    let userMessage: string;
    switch (err.code) {
      case 'ENOENT':
        userMessage = `Parent directory not found for: "${gitignorePath}"`;
        break;
      case 'EACCES':
        userMessage = `Permission denied writing to: "${gitignorePath}"`;
        break;
      case 'ENOSPC':
        userMessage = `No space left on device. Cannot write: "${gitignorePath}"`;
        break;
      default:
        userMessage = `Failed to write .gitignore file "${gitignorePath}": ${err.message}`;
    }
    throw new Error(userMessage);
  }
}

/**
 * Add LogicStamp patterns to .gitignore file
 * Creates .gitignore if it doesn't exist
 * Uses idempotent patch mode - only adds missing patterns if block exists
 */
export async function ensureGitignorePatterns(targetDir: string): Promise<{ added: boolean; created: boolean }> {
  const exists = await gitignoreExists(targetDir);
  const content = await readGitignore(targetDir);

  // Use smart patch mode - will append only missing patterns if block exists
  const newContent = addLogicStampPatterns(content);
  
  // Check if content actually changed
  const contentChanged = content !== newContent;
  
  if (!contentChanged) {
    return { added: false, created: false };
  }

  await writeGitignore(targetDir, newContent);

  return { added: true, created: !exists };
}

/**
 * Ensure a specific pattern is in .gitignore
 * Adds the pattern if it doesn't exist, preserves existing content
 * 
 * @param targetDir - Project root directory
 * @param pattern - Pattern to ensure (relative to project root, e.g., "reports/security.json")
 * @returns Result indicating if pattern was added and if .gitignore was created
 */
export async function ensurePatternInGitignore(
  targetDir: string,
  pattern: string
): Promise<{ added: boolean; created: boolean }> {
  const exists = await gitignoreExists(targetDir);
  const content = await readGitignore(targetDir);
  
  // Normalize pattern (forward slashes, no leading slash)
  const normalizedPattern = pattern.replace(/\\/g, '/').replace(/^\//, '').trim();
  
  // Check if pattern already exists
  if (hasPattern(content, normalizedPattern)) {
    return { added: false, created: false };
  }
  
  // Add pattern to .gitignore
  let newContent = content;
  
  // Ensure content ends with newline
  if (newContent.length > 0 && !newContent.endsWith('\n')) {
    newContent += '\n';
  }
  
  // Add blank line before pattern if content exists
  if (newContent.length > 0 && !newContent.endsWith('\n\n')) {
    newContent += '\n';
  }
  
  // Add pattern
  newContent += normalizedPattern + '\n';
  
  await writeGitignore(targetDir, newContent);
  
  return { added: true, created: !exists };
}

/**
 * Smart .gitignore management with config-based behavior (no prompting)
 *
 * Behavior:
 * 1. If --skip-gitignore flag: do nothing
 * 2. If patterns already exist: do nothing (already set up)
 * 3. If config has preference 'added': add patterns automatically
 * 4. If config has preference 'skipped' OR no config exists: skip (safe default)
 *
 * Note: Prompting should only happen in `stamp init`, not in `stamp context`
 *
 * @param targetDir - Project root directory
 * @param options - Options to control behavior
 * @returns Result of the operation
 */
export async function smartGitignoreSetup(
  targetDir: string,
  options: { skipGitignore?: boolean } = {}
): Promise<{ added: boolean; created: boolean; prompted: boolean; skipped: boolean }> {
  // If --skip-gitignore flag is set, do nothing
  if (options.skipGitignore) {
    return { added: false, created: false, prompted: false, skipped: true };
  }

  // Check if patterns already exist
  const content = await readGitignore(targetDir);
  if (hasLogicStampPatterns(content)) {
    return { added: false, created: false, prompted: false, skipped: false };
  }

  // Check config for saved preference
  const config = await readConfig(targetDir);

  // Default to skip unless explicitly set to 'added' in config
  // This means: no config = skip, config with 'skipped' = skip
  if (config.gitignorePreference === 'added') {
    // User explicitly opted in (via stamp init) - add patterns automatically
    const result = await ensureGitignorePatterns(targetDir);
    return { ...result, prompted: false, skipped: false };
  }

  // Default behavior: skip (safe, no .gitignore changes)
  return { added: false, created: false, prompted: false, skipped: true };
}
