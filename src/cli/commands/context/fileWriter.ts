/**
 * File Writer - Handles writing context files to disk
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import type { LogicStampBundle, LogicStampIndex, FolderInfo } from '../../../core/pack.js';
import { getFolderPath, normalizeEntryId } from '../../../utils/fsx.js';
import { estimateGPT4Tokens } from '../../../utils/tokens.js';
import { formatBundlesForFolder } from './bundleFormatter.js';

/**
 * Normalize path for display (convert backslashes to forward slashes)
 */
export function displayPath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Detect if a folder is a root (application entry point) and assign a label
 */
export function detectRootFolder(relativePath: string, components: string[]): { isRoot: boolean; rootLabel?: string } {
  // Project root is always a root
  if (relativePath === '.') {
    return { isRoot: true, rootLabel: 'Project Root' };
  }

  // Detect common application entry points
  const pathLower = relativePath.toLowerCase();

  // Next.js app router
  if (pathLower.includes('/app') && components.some(c => c === 'page.tsx' || c === 'layout.tsx')) {
    return { isRoot: true, rootLabel: 'Next.js App' };
  }

  // Examples folder
  if (pathLower.startsWith('examples/') && pathLower.endsWith('/src')) {
    const exampleName = relativePath.split('/')[1];
    return { isRoot: true, rootLabel: `Example: ${exampleName}` };
  }

  // Test fixtures
  if (pathLower.includes('tests/fixtures/') && pathLower.endsWith('/src')) {
    return { isRoot: true, rootLabel: 'Test Fixture' };
  }

  // Root src folder
  if (relativePath === 'src') {
    return { isRoot: true, rootLabel: 'Main Source' };
  }

  // Apps folder (monorepo pattern)
  if (pathLower.startsWith('apps/')) {
    const appName = relativePath.split('/')[1];
    return { isRoot: true, rootLabel: `App: ${appName}` };
  }

  // Default: not a root
  return { isRoot: false };
}

/**
 * Group bundles by folder
 */
export function groupBundlesByFolder(bundles: LogicStampBundle[]): Map<string, LogicStampBundle[]> {
  const bundlesByFolder = new Map<string, LogicStampBundle[]>();

  for (const bundle of bundles) {
    const folderPath = getFolderPath(bundle.entryId);

    if (!bundlesByFolder.has(folderPath)) {
      bundlesByFolder.set(folderPath, []);
    }

    bundlesByFolder.get(folderPath)!.push(bundle);
  }

  return bundlesByFolder;
}

/**
 * Write context files for all folders
 */
export async function writeContextFiles(
  bundles: LogicStampBundle[],
  outputDir: string,
  projectRoot: string,
  options: {
    format: 'json' | 'pretty' | 'ndjson';
    quiet?: boolean;
  }
): Promise<{ filesWritten: number; folderInfos: FolderInfo[]; totalTokenEstimate: number }> {
  const bundlesByFolder = groupBundlesByFolder(bundles);
  const normalizedRoot = normalizeEntryId(projectRoot);
  const folderInfos: FolderInfo[] = [];
  let filesWritten = 0;
  let totalTokenEstimate = 0;

  if (!options.quiet) {
    console.log(`📝 Writing context files for ${bundlesByFolder.size} folders...`);
  }

  for (const [folderPath, folderBundles] of bundlesByFolder) {
    // Sort bundles for deterministic output
    folderBundles.sort((a, b) => a.entryId.localeCompare(b.entryId));

    // Calculate relative path from project root
    let relativePath: string;
    if (folderPath === normalizedRoot) {
      relativePath = '.';
    } else if (folderPath.startsWith(normalizedRoot + '/')) {
      relativePath = folderPath.substring(normalizedRoot.length + 1);
    } else {
      relativePath = folderPath;
    }

    // Extract component file names from bundle entryIds
    const components = folderBundles.map(b => {
      const normalized = normalizeEntryId(b.entryId);
      const lastSlash = normalized.lastIndexOf('/');
      return lastSlash !== -1 ? normalized.substring(lastSlash + 1) : normalized;
    });

    // Detect if this is a root folder
    const { isRoot, rootLabel } = detectRootFolder(relativePath, components);

    // Format bundles for this folder
    const folderOutput = formatBundlesForFolder(folderBundles, options.format);

    // Estimate tokens for this folder's context file
    const folderTokenEstimate = await estimateGPT4Tokens(folderOutput);
    totalTokenEstimate += folderTokenEstimate;

    // Write folder's context.json to output directory maintaining relative structure
    const contextFileName = relativePath === '.' ? 'context.json' : join(relativePath, 'context.json');
    const contextFilePath = relativePath === '.' ? 'context.json' : `${relativePath}/context.json`;
    const folderContextPath = join(outputDir, contextFileName);
    await mkdir(dirname(folderContextPath), { recursive: true });
    await writeFile(folderContextPath, folderOutput, 'utf8');
    filesWritten++;
    if (!options.quiet) {
      console.log(`   ✓ ${displayPath(folderContextPath)} (${folderBundles.length} bundles)`);
    }

    // Add to folder info array
    folderInfos.push({
      path: relativePath === '.' ? '.' : relativePath,
      contextFile: contextFilePath,
      bundles: folderBundles.length,
      components: components.sort(),
      isRoot,
      rootLabel,
      tokenEstimate: folderTokenEstimate,
    });
  }

  return { filesWritten, folderInfos, totalTokenEstimate };
}

/**
 * Write main context index file
 */
export async function writeMainIndex(
  outputDir: string,
  folderInfos: FolderInfo[],
  contracts: unknown[],
  bundles: LogicStampBundle[],
  bundlesByFolderSize: number,
  totalTokenEstimate: number,
  projectRoot: string,
  options: {
    quiet?: boolean;
    suppressSuccessIndicator?: boolean;
  }
): Promise<void> {
  const mainContextPath = join(outputDir, 'context_main.json');
  const normalizedRoot = normalizeEntryId(projectRoot);

  if (!options.quiet) {
    console.log(`📝 Writing main context index...`);
  }

  // Sort folders by path for deterministic output
  folderInfos.sort((a, b) => a.path.localeCompare(b.path));

  // Create index structure
  const index: LogicStampIndex = {
    type: 'LogicStampIndex',
    schemaVersion: '0.1',
    projectRoot: '.',
    projectRootResolved: normalizedRoot,
    createdAt: new Date().toISOString(),
    summary: {
      totalComponents: contracts.length,
      totalBundles: bundles.length,
      totalFolders: bundlesByFolderSize,
      totalTokenEstimate,
    },
    folders: folderInfos,
    meta: {
      source: 'logicstamp-context@0.1.1',
    },
  };

  const indexOutput = JSON.stringify(index, null, 2);
  await writeFile(mainContextPath, indexOutput, 'utf8');
  if (options.quiet && !options.suppressSuccessIndicator) {
    // Minimal output in quiet mode (unless suppressed for internal calls)
    process.stdout.write('✓\n');
  } else if (!options.quiet) {
    console.log(`   ✓ ${displayPath(mainContextPath)} (index of ${bundlesByFolderSize} folders)`);
  }
}

