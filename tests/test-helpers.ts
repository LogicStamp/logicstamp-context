import { join } from 'node:path';
import { mkdir, rm } from 'node:fs/promises';
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

