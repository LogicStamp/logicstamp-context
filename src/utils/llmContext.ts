/**
 * Utilities for managing LLM_CONTEXT.md file
 */

import { readFile, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig, updateConfig } from './config.js';

/**
 * Read LLM_CONTEXT.md from the package
 * Tries multiple possible locations to handle both development and installed package scenarios
 */
export async function readPackageLLMContext(): Promise<string | null> {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);
  
  // Try multiple possible paths:
  // 1. Development: src/utils/llmContext.ts -> ../../LLM_CONTEXT.md
  // 2. Installed: node_modules/logicstamp-context/dist/utils/llmContext.js -> ../../../LLM_CONTEXT.md
  // 3. Alternative installed: node_modules/logicstamp-context/dist/utils/llmContext.js -> ../../../../LLM_CONTEXT.md
  const possiblePaths = [
    join(currentDir, '..', '..', 'LLM_CONTEXT.md'), // Development: src/utils/ -> ../../
    join(currentDir, '..', '..', '..', 'LLM_CONTEXT.md'), // Installed: dist/utils/ -> ../../../
    join(currentDir, '..', '..', '..', '..', 'LLM_CONTEXT.md'), // Alternative installed path
  ];

  for (const path of possiblePaths) {
    try {
      await access(path);
      return await readFile(path, 'utf-8');
    } catch {
      // Try next path
      continue;
    }
  }

  return null;
}

/**
 * Check if LLM_CONTEXT.md exists in the target directory
 */
export async function llmContextExists(targetDir: string): Promise<boolean> {
  try {
    await access(join(targetDir, 'LLM_CONTEXT.md'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Write LLM_CONTEXT.md to target directory
 */
export async function writeLLMContext(targetDir: string, content: string): Promise<void> {
  const llmContextPath = join(targetDir, 'LLM_CONTEXT.md');
  await writeFile(llmContextPath, content, 'utf-8');
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
 * Smart LLM_CONTEXT.md management with user prompt and config persistence
 *
 * Behavior:
 * 1. If file already exists: do nothing
 * 2. If config has preference: respect it
 * 3. If TTY (interactive): prompt user once, save preference
 * 4. If non-TTY (CI): do nothing (don't auto-add)
 *
 * @param targetDir - Project root directory
 * @returns Result of the operation
 */
export async function smartLLMContextSetup(
  targetDir: string
): Promise<{ added: boolean; prompted: boolean; skipped: boolean }> {
  // Check if file already exists
  if (await llmContextExists(targetDir)) {
    return { added: false, prompted: false, skipped: false };
  }

  // Check config for saved preference
  const config = await readConfig(targetDir);

  // If user previously chose to skip, respect that
  if (config.llmContextPreference === 'skipped') {
    return { added: false, prompted: false, skipped: true };
  }

  // If user previously chose to add, do it without prompting
  if (config.llmContextPreference === 'added') {
    const content = await readPackageLLMContext();
    if (content) {
      await writeLLMContext(targetDir, content);
      return { added: true, prompted: false, skipped: false };
    }
    return { added: false, prompted: false, skipped: true };
  }

  // No preference saved yet - prompt if interactive
  if (isTTY()) {
    console.log('\n💡 LogicStamp can generate LLM_CONTEXT.md to help AI assistants understand your project structure.\n');
    const shouldAdd = await promptYesNo('Generate LLM_CONTEXT.md in project root? [Y/n] ');

    if (shouldAdd) {
      // User said yes - write file and save preference
      const content = await readPackageLLMContext();
      if (content) {
        await writeLLMContext(targetDir, content);
        await updateConfig(targetDir, { llmContextPreference: 'added' });
        return { added: true, prompted: true, skipped: false };
      } else {
        console.warn('⚠️  Could not find LLM_CONTEXT.md template in package');
        await updateConfig(targetDir, { llmContextPreference: 'skipped' });
        return { added: false, prompted: true, skipped: true };
      }
    } else {
      // User said no - save preference to never ask again
      await updateConfig(targetDir, { llmContextPreference: 'skipped' });
      return { added: false, prompted: true, skipped: true };
    }
  }

  // Non-interactive (CI) - don't auto-add, don't prompt
  return { added: false, prompted: false, skipped: true };
}

