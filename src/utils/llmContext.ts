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
 * Smart LLM_CONTEXT.md setup with config-based behavior (no prompting)
 *
 * Behavior:
 * 1. If file already exists: do nothing
 * 2. If config has preference 'added': create file automatically
 * 3. If config has preference 'skipped' OR no config exists: skip (safe default)
 *
 * Note: Prompting should only happen in `stamp init`, not in `stamp context`
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

  // Default to skip unless explicitly set to 'added' in config
  if (config.llmContextPreference === 'added') {
    // User explicitly opted in (via stamp init) - create file automatically
    const content = await readPackageLLMContext();
    if (content) {
      await writeLLMContext(targetDir, content);
      return { added: true, prompted: false, skipped: false };
    }
    return { added: false, prompted: false, skipped: true };
  }

  // Default behavior: skip (safe, no file creation)
  return { added: false, prompted: false, skipped: true };
}

