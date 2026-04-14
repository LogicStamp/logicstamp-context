/**
 * Cleanup functions for compare command
 */

import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Clean up orphaned files
 */
export async function cleanOrphanedFiles(
  orphanedFiles: string[],
  baseDir: string,
  quiet?: boolean,
): Promise<number> {
  let deletedCount = 0;

  for (const file of orphanedFiles) {
    const filePath = join(baseDir, file);
    try {
      await unlink(filePath);
      if (!quiet) {
        console.log(`   🗑️  Deleted: ${file}`);
      }
      deletedCount++;
    } catch (error) {
      // Always show errors even in quiet mode
      console.error(
        `   ⚠️  Failed to delete ${file}: ${(error as Error).message}`,
      );
    }
  }

  return deletedCount;
}
