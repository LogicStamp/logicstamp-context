import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

const execAsync = promisify(exec);

/**
 * Global setup function that runs once before all tests.
 * Ensures the project is built, but only if dist is older than src.
 */
export async function setup() {
  // Check if dist exists and is newer than src
  const distPath = join(process.cwd(), 'dist');
  const srcPath = join(process.cwd(), 'src');

  try {
    const distStat = await stat(distPath);
    const srcStat = await stat(srcPath);

    // If dist is newer than src, skip rebuild
    if (distStat.mtime > srcStat.mtime) {
      console.log('✓ Build is up to date, skipping rebuild');
      return;
    }
  } catch {
    // dist doesn't exist, need to build
  }

  // Build the project
  console.log('🔨 Building project before tests...');
  await execAsync('npm run build');
  console.log('✓ Build complete');
}

/**
 * Global teardown function (optional, but good practice)
 */
export async function teardown() {
  // Nothing to clean up
}

