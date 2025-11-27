/**
 * Utilities for managing .gitignore files
 */

import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { readConfig, updateConfig } from './config.js';

/**
 * Patterns that should be added to .gitignore for LogicStamp context files
 */
export const LOGICSTAMP_GITIGNORE_PATTERNS = [
  '# LogicStamp context files',
  'context.json',
  'context_*.json',
  '*.uif.json',
  'logicstamp.manifest.json',
  '.logicstamp/',
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
  const lines = content.split('\n').map(line => line.trim());
  return lines.includes(pattern);
}

/**
 * Check if .gitignore has LogicStamp patterns
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
 * Add LogicStamp patterns to .gitignore content
 */
export function addLogicStampPatterns(content: string): string {
  const lines = content.split('\n');

  // Check which patterns are missing
  const missingPatterns = LOGICSTAMP_GITIGNORE_PATTERNS.filter(pattern => {
    if (pattern.startsWith('#')) return false; // Always add the comment
    return !hasPattern(content, pattern);
  });

  if (missingPatterns.length === 0 && hasPattern(content, '# LogicStamp context files')) {
    return content; // All patterns already exist
  }

  // Add a blank line before the section if content exists and doesn't end with blank line
  let newContent = content;
  if (newContent.length > 0 && !newContent.endsWith('\n\n') && !newContent.endsWith('\n')) {
    newContent += '\n';
  }
  if (newContent.length > 0 && !newContent.endsWith('\n\n')) {
    newContent += '\n';
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
  await writeFile(gitignorePath, content, 'utf-8');
}

/**
 * Add LogicStamp patterns to .gitignore file
 * Creates .gitignore if it doesn't exist
 */
export async function ensureGitignorePatterns(targetDir: string): Promise<{ added: boolean; created: boolean }> {
  const exists = await gitignoreExists(targetDir);
  const content = await readGitignore(targetDir);

  if (hasLogicStampPatterns(content)) {
    return { added: false, created: false };
  }

  const newContent = addLogicStampPatterns(content);
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
