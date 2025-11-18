/**
 * Init command - Sets up LogicStamp in a project
 */

import { resolve } from 'node:path';
import { ensureGitignorePatterns } from '../../utils/gitignore.js';
import { updateConfig } from '../../utils/config.js';

export interface InitOptions {
  /** Target directory to initialize (default: current directory) */
  targetDir?: string;
  /** Skip gitignore setup */
  skipGitignore?: boolean;
}

/**
 * Initialize LogicStamp in a project directory
 */
export async function init(options: InitOptions = {}): Promise<void> {
  const targetDir = resolve(options.targetDir || process.cwd());

  console.log('🚀 Initializing LogicStamp...\n');

  // Setup .gitignore
  if (!options.skipGitignore) {
    try {
      const { added, created } = await ensureGitignorePatterns(targetDir);

      if (created) {
        console.log('✅ Created .gitignore with LogicStamp patterns');
        // Save preference so stamp context won't prompt
        await updateConfig(targetDir, { gitignorePreference: 'added' });
      } else if (added) {
        console.log('✅ Added LogicStamp patterns to existing .gitignore');
        // Save preference so stamp context won't prompt
        await updateConfig(targetDir, { gitignorePreference: 'added' });
      } else {
        console.log('ℹ️  .gitignore already contains LogicStamp patterns');
        // Still save preference in case config doesn't exist
        await updateConfig(targetDir, { gitignorePreference: 'added' });
      }

      console.log('\n   The following patterns were added/verified:');
      console.log('   - context.json');
      console.log('   - context_*.json');
      console.log('   - *.uif.json');
      console.log('   - logicstamp.manifest.json');
      console.log('   - .logicstamp/');
    } catch (error) {
      console.error('⚠️  Failed to update .gitignore:', error instanceof Error ? error.message : String(error));
      console.log('   You can manually add the patterns to your .gitignore');
    }
  }

  console.log('\n✨ LogicStamp initialization complete!');
  console.log('\nNext steps:');
  console.log('  • Run `stamp context` to generate context files');
  console.log('  • Run `stamp context --help` for more options');
}
