import { join } from 'node:path';
import { mkdir, rm, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

/**
 * Creates a unique output directory for a test.
 * Uses the test name and a UUID to ensure uniqueness across parallel tests.
 */
export async function getTestOutputDir(testName: string): Promise<string> {
  // Sanitize test name for filesystem
  const sanitized = testName
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase()
    .substring(0, 50);
  
  const uniqueId = randomUUID().substring(0, 8);
  const outputPath = join(process.cwd(), 'tests/e2e/output', `${sanitized}-${uniqueId}`);
  
  // Ensure directory exists
  await mkdir(outputPath, { recursive: true });
  
  return outputPath;
}

/**
 * Cleans up a test output directory
 */
export async function cleanupTestOutput(outputPath: string): Promise<void> {
  try {
    await rm(outputPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Recursively remove context.json and context_main.json files from a directory.
 * Useful for cleaning up test artifacts that might be created in fixtures or other directories.
 */
export async function cleanupContextFiles(dir: string): Promise<void> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await cleanupContextFiles(fullPath);
      } else if (entry.name === 'context.json' || entry.name === 'context_main.json') {
        try {
          await rm(fullPath, { force: true });
        } catch {
          // Ignore individual file deletion errors
        }
      }
    }
  } catch {
    // Ignore directory read errors
  }
}

/**
 * Comprehensive cleanup that removes context files from common test locations.
 * Call this in afterEach hooks to ensure no context files are left behind.
 * 
 * This function only removes context.json and context_main.json files, not entire directories,
 * so it won't break tests that rely on other files in these directories.
 */
export async function cleanupAllContextFiles(fixturesPath?: string): Promise<void> {
  const cwd = process.cwd();
  
  // Clean up context files in fixtures directory if provided
  if (fixturesPath) {
    try {
      await cleanupContextFiles(fixturesPath);
    } catch {
      // Ignore cleanup errors
    }
  }
  
  // Clean up context files in current working directory root (safety measure)
  try {
    const contextMain = join(cwd, 'context_main.json');
    const contextJson = join(cwd, 'context.json');
    await rm(contextMain, { force: true }).catch(() => {});
    await rm(contextJson, { force: true }).catch(() => {});
  } catch {
    // Ignore cleanup errors
  }
  
  // Clean up context files in src/ directory (where tests might create them)
  // Only removes context.json files, not the directory itself
  try {
    const srcDir = join(cwd, 'src');
    await cleanupContextFiles(srcDir);
  } catch {
    // Ignore cleanup errors (src directory might not exist or not be readable)
  }
  
  // Clean up context files in utils/ directory (where tests might create them)
  // Only removes context.json files, not the directory itself
  try {
    const utilsDir = join(cwd, 'utils');
    await cleanupContextFiles(utilsDir);
  } catch {
    // Ignore cleanup errors (utils directory might not exist or not be readable)
  }
}

