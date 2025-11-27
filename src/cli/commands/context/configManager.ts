/**
 * Config Manager - Handles configuration and setup tasks
 */

import { readConfig, configExists, writeConfig } from '../../../utils/config.js';
import { smartGitignoreSetup } from '../../../utils/gitignore.js';
import { smartLLMContextSetup } from '../../../utils/llmContext.js';

/**
 * Ensure config exists, creating with safe defaults if needed
 */
export async function ensureConfigExists(
  projectRoot: string,
  options: { quiet?: boolean }
): Promise<void> {
  try {
    if (!await configExists(projectRoot)) {
      await writeConfig(projectRoot, {
        gitignorePreference: 'skipped',
        llmContextPreference: 'skipped',
      });
      if (!options.quiet) {
        console.log('\n💡 No LogicStamp config found – created .logicstamp/config.json with safe defaults (no .gitignore changes).');
        console.log('   Run `stamp init` to customize behavior.\n');
      }
    }
  } catch (error) {
    // Ignore config creation errors - not critical
  }
}

/**
 * Setup .gitignore with LogicStamp patterns
 */
export async function setupGitignore(
  projectRoot: string,
  options: {
    skipGitignore?: boolean;
    quiet?: boolean;
  }
): Promise<void> {
  try {
    const config = await readConfig(projectRoot);
    const shouldSkipGitignore = 
      options.skipGitignore || 
      config.gitignorePreference === 'skipped' ||
      !config.gitignorePreference; // default to skip if no preference

    const { added, created } = await smartGitignoreSetup(projectRoot, {
      skipGitignore: shouldSkipGitignore,
    });

    // Only show output if patterns were actually added (config preference was 'added')
    if (added && !options.quiet) {
      if (created) {
        console.log('\n📝 Created .gitignore with LogicStamp patterns');
      } else {
        console.log('\n📝 Added LogicStamp patterns to .gitignore');
      }
    }
  } catch (error) {
    // Silently ignore gitignore errors - not critical to context generation
    // Users can run `stamp init` manually if needed
  }
}

/**
 * Setup LLM_CONTEXT.md file
 */
export async function setupLLMContext(
  projectRoot: string,
  options: { quiet?: boolean }
): Promise<void> {
  try {
    const { added } = await smartLLMContextSetup(projectRoot);

    // Only show output if file was actually created (config preference was 'added')
    if (added && !options.quiet) {
      console.log('\n📝 Created LLM_CONTEXT.md');
    }
  } catch (error) {
    // Silently ignore LLM_CONTEXT.md errors - not critical to context generation
  }
}

