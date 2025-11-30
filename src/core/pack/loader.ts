/**
 * Loader module - Load contracts, manifests, and source code
 */

import { readFile } from 'node:fs/promises';
import { join, resolve, isAbsolute } from 'node:path';
import type { UIFContract } from '../../types/UIFContract.js';
import type { ProjectManifest } from '../manifest.js';
import { debugError } from '../../utils/debug.js';

/**
 * Load manifest from file
 */
export async function loadManifest(basePath: string): Promise<ProjectManifest> {
  const manifestPath = join(basePath, 'logicstamp.manifest.json');
  
  let content: string;
  try {
    content = await readFile(manifestPath, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('loader', 'loadManifest', {
      manifestPath,
      basePath,
      message: err.message,
      code: err.code,
    });
    throw new Error(
      `Failed to load manifest at ${manifestPath}: ${err.code === 'ENOENT' ? 'File not found' : err.message}`
    );
  }
  
  try {
    return JSON.parse(content) as ProjectManifest;
  } catch (error) {
    const err = error as Error;
    debugError('loader', 'loadManifest', {
      manifestPath,
      operation: 'JSON.parse',
      message: err.message,
    });
    throw new Error(`Failed to parse manifest at ${manifestPath}: ${err.message}`);
  }
}

/**
 * Load a sidecar contract file
 * Sidecar path is computed from the manifest key (project-relative): resolved from projectRoot + key + '.uif.json'
 */
export async function loadContract(entryId: string, projectRoot: string): Promise<UIFContract | null> {
  // Resolve relative path from project root
  const absolutePath = isAbsolute(entryId) ? entryId : resolve(projectRoot, entryId);
  const sidecarPath = `${absolutePath}.uif.json`;

  try {
    const content = await readFile(sidecarPath, 'utf8');
    return JSON.parse(content) as UIFContract;
  } catch (error) {
    // Sidecar file doesn't exist or can't be read
    return null;
  }
}

/**
 * Extract code header (JSDoc @uif block) from source file
 */
export async function extractCodeHeader(entryId: string, projectRoot: string): Promise<string | null> {
  try {
    const absolutePath = isAbsolute(entryId) ? entryId : resolve(projectRoot, entryId);
    const content = await readFile(absolutePath, 'utf8');

    // Look for @uif JSDoc block
    const headerMatch = content.match(/\/\*\*[\s\S]*?@uif[\s\S]*?\*\//);
    if (headerMatch) {
      return headerMatch[0];
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Read full source code
 */
export async function readSourceCode(entryId: string, projectRoot: string): Promise<string | null> {
  try {
    const absolutePath = isAbsolute(entryId) ? entryId : resolve(projectRoot, entryId);
    return await readFile(absolutePath, 'utf8');
  } catch (error) {
    return null;
  }
}

