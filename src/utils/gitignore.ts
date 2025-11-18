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
 * Check if running in interactive TTY
 */
function isTTY(): boolean {
  return process.stdout.isTTY === true && process.stdin.isTTY === true;
}

/**
 * Prompt user for Y/N input (only in TTY mode)
 */
async function promptYesNo(question: string): Promise<boolean> {
  const { createInterface } = await import('node:readline');
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    readline.question(question, (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes' || answer === '');
    });
  });
}

/**
 * Smart .gitignore management with user prompt and config persistence
 *
 * Behavior:
 * 1. If --skip-gitignore flag: do nothing
 * 2. If config has preference: respect it
 * 3. If patterns already exist: do nothing
 * 4. If TTY (interactive): prompt user once, save preference
 * 5. If non-TTY (CI): do nothing (don't auto-add)
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

  // If user previously chose to skip, respect that
  if (config.gitignorePreference === 'skipped') {
    return { added: false, created: false, prompted: false, skipped: true };
  }

  // If user previously chose to add, do it without prompting
  if (config.gitignorePreference === 'added') {
    const result = await ensureGitignorePatterns(targetDir);
    return { ...result, prompted: false, skipped: false };
  }

  // No preference saved yet - prompt if interactive
  if (isTTY()) {
    console.log('\n💡 LogicStamp generates large context files that are usually not committed.\n');
    const shouldAdd = await promptYesNo('Add recommended patterns to .gitignore? [Y/n] ');

    if (shouldAdd) {
      // User said yes - add patterns and save preference
      await updateConfig(targetDir, { gitignorePreference: 'added' });
      const result = await ensureGitignorePatterns(targetDir);
      return { ...result, prompted: true, skipped: false };
    } else {
      // User said no - save preference to never ask again
      await updateConfig(targetDir, { gitignorePreference: 'skipped' });
      return { added: false, created: false, prompted: true, skipped: true };
    }
  }

  // Non-interactive (CI) - don't auto-add, don't prompt
  return { added: false, created: false, prompted: false, skipped: true };
}
