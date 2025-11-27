/**
 * Init command - Sets up LogicStamp in a project
 */

import { resolve } from 'node:path';
import { ensureGitignorePatterns, readGitignore, hasLogicStampPatterns } from '../../utils/gitignore.js';
import { updateConfig } from '../../utils/config.js';
import { readPackageLLMContext, writeLLMContext, llmContextExists } from '../../utils/llmContext.js';

export interface InitOptions {
  /** Target directory to initialize (default: current directory) */
  targetDir?: string;
  /** Skip gitignore setup */
  skipGitignore?: boolean;
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
 * Initialize LogicStamp in a project directory
 */
export async function init(options: InitOptions = {}): Promise<void> {
  const targetDir = resolve(options.targetDir || process.cwd());

  console.log('🚀 Initializing LogicStamp...\n');

  // Setup .gitignore (always prompt unless skipGitignore flag)
  if (!options.skipGitignore) {
    try {
      // Check if patterns already exist
      const gitignoreContent = await readGitignore(targetDir);
      const alreadyHasPatterns = hasLogicStampPatterns(gitignoreContent);

      if (!alreadyHasPatterns) {
        console.log('💡 LogicStamp generates large context files that are usually not committed.');
        console.log('\n   The following patterns will be added to .gitignore:');
        console.log('   - context.json');
        console.log('   - context_*.json');
        console.log('   - *.uif.json');
        console.log('   - logicstamp.manifest.json');
        console.log('   - .logicstamp/');
        
        let shouldAdd = true; // Default to "yes" in non-interactive mode
        if (isTTY()) {
          // Interactive prompt (local dev convenience)
          shouldAdd = await promptYesNo('\nAdd recommended patterns to .gitignore? [Y/n] ');
        }

        if (shouldAdd) {
          const { added, created } = await ensureGitignorePatterns(targetDir);

          if (created) {
            console.log('✅ Created .gitignore with LogicStamp patterns');
            await updateConfig(targetDir, { gitignorePreference: 'added' });
          } else if (added) {
            console.log('✅ Added LogicStamp patterns to existing .gitignore');
            await updateConfig(targetDir, { gitignorePreference: 'added' });
          }
        } else {
          console.log('📝 Skipping .gitignore setup');
          await updateConfig(targetDir, { gitignorePreference: 'skipped' });
        }
      } else {
        console.log('ℹ️  .gitignore already contains LogicStamp patterns');
        // Still save preference in case config doesn't exist
        await updateConfig(targetDir, { gitignorePreference: 'added' });
      }
    } catch (error) {
      console.error('⚠️  Failed to update .gitignore:', error instanceof Error ? error.message : String(error));
      console.log('   You can manually add the patterns to your .gitignore');
    }
  } else {
    await updateConfig(targetDir, { gitignorePreference: 'skipped' });
  }

  // Setup LLM_CONTEXT.md (always prompt)
  try {
    if (await llmContextExists(targetDir)) {
      console.log('\nℹ️  LLM_CONTEXT.md already exists');
      await updateConfig(targetDir, { llmContextPreference: 'added' });
    } else {
      const content = await readPackageLLMContext();
      if (content) {
        console.log('\n💡 LogicStamp can generate LLM_CONTEXT.md to help AI assistants understand your project structure.');
        let shouldAdd = true; // Default to "yes" in non-interactive mode
        if (isTTY()) {
          // Interactive prompt (local dev convenience)
          shouldAdd = await promptYesNo('Generate LLM_CONTEXT.md in project root? [Y/n] ');
        }

        if (shouldAdd) {
          await writeLLMContext(targetDir, content);
          console.log('✅ Created LLM_CONTEXT.md');
          await updateConfig(targetDir, { llmContextPreference: 'added' });
        } else {
          console.log('📝 Skipping LLM_CONTEXT.md creation');
          await updateConfig(targetDir, { llmContextPreference: 'skipped' });
        }
      } else {
        // Template not found in package - offer to create a basic default
        console.log('\n💡 LogicStamp can generate LLM_CONTEXT.md to help AI assistants understand your project structure.');
        console.log('   (Using default template - package template not found)');
        
        const defaultContent = `# LLM Context

This file helps AI assistants understand your project structure and conventions.

## Project Overview
Add a brief description of your project here.

## Key Conventions
- Add your coding conventions and patterns here
- Document any important architectural decisions
- Note any special patterns or practices

## Getting Started
Add instructions for how to get started with this project.

## Important Files
- List key files and their purposes
- Document the project structure

This file is generated by LogicStamp Context. Customize it to fit your project's needs.
`;

        let shouldAdd = true; // Default to "yes" in non-interactive mode
        if (isTTY()) {
          // Interactive prompt (local dev convenience)
          shouldAdd = await promptYesNo('Generate LLM_CONTEXT.md in project root? [Y/n] ');
        }

        if (shouldAdd) {
          await writeLLMContext(targetDir, defaultContent);
          console.log('✅ Created LLM_CONTEXT.md with default template');
          await updateConfig(targetDir, { llmContextPreference: 'added' });
        } else {
          console.log('📝 Skipping LLM_CONTEXT.md creation');
          await updateConfig(targetDir, { llmContextPreference: 'skipped' });
        }
      }
    }
  } catch (error) {
    console.error('\n⚠️  Failed to create LLM_CONTEXT.md:', error instanceof Error ? error.message : String(error));
  }

  console.log('\n✨ LogicStamp initialization complete!');
  console.log('\nNext steps:');
  console.log('  • Run `stamp context` to generate context files');
  console.log('  • Run `stamp context --help` for more options');
}
