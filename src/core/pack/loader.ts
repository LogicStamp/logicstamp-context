/**
 * Loader module - Load contracts, manifests, and source code
 */

import { readFile } from 'node:fs/promises';
import { join, resolve, isAbsolute } from 'node:path';
import type { UIFContract } from '../../types/UIFContract.js';
import type { ProjectManifest } from '../manifest.js';
import { debugError } from '../../utils/debug.js';
import { loadSecurityReport, sanitizeCode, type SanitizeResult } from '../../utils/codeSanitizer.js';
import type { SecurityReport } from '../../cli/commands/security.js';

// Cache for security report (loaded once per project)
let cachedSecurityReport: SecurityReport | null | undefined = undefined;
let cachedProjectRoot: string | null = null;

// Track sanitization statistics
interface SanitizeStats {
  filesWithSecrets: number;
  totalSecretsReplaced: number;
  filesProcessed: string[];
}

let sanitizeStats: SanitizeStats = {
  filesWithSecrets: 0,
  totalSecretsReplaced: 0,
  filesProcessed: [],
};

/**
 * Get and reset sanitization statistics
 */
export function getAndResetSanitizeStats(): SanitizeStats {
  const stats = { ...sanitizeStats };
  sanitizeStats = {
    filesWithSecrets: 0,
    totalSecretsReplaced: 0,
    filesProcessed: [],
  };
  return stats;
}

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
 * Normalize project root for comparison (handles Windows case-insensitivity and path variations)
 */
function normalizeProjectRoot(path: string): string {
  const normalized = resolve(path);
  // On Windows, paths are case-insensitive, so lowercase for comparison
  if (process.platform === 'win32') {
    return normalized.toLowerCase().replace(/\\/g, '/');
  }
  return normalized.replace(/\\/g, '/');
}

/**
 * Get security report (cached per project)
 */
async function getSecurityReport(projectRoot: string): Promise<SecurityReport | null> {
  const normalizedRoot = normalizeProjectRoot(projectRoot);
  
  // Use cached report if available for the same project (normalized comparison)
  if (cachedSecurityReport !== undefined && cachedProjectRoot !== null) {
    const normalizedCachedRoot = normalizeProjectRoot(cachedProjectRoot);
    if (normalizedCachedRoot === normalizedRoot) {
      return cachedSecurityReport;
    }
  }
  
  // Load and cache the report
  cachedProjectRoot = projectRoot;
  cachedSecurityReport = await loadSecurityReport(projectRoot);
  return cachedSecurityReport;
}

/**
 * Extract code header (JSDoc @uif block) from source file
 * NOTE: Source files are NEVER modified. Only the in-memory content is sanitized
 * before being included in generated JSON bundles.
 */
export async function extractCodeHeader(entryId: string, projectRoot: string): Promise<string | null> {
  try {
    const absolutePath = isAbsolute(entryId) ? entryId : resolve(projectRoot, entryId);
    // Read file content (source file is never modified)
    let content = await readFile(absolutePath, 'utf8');

    // Sanitize code in-memory only (for JSON generation, source files remain unchanged)
    const securityReport = await getSecurityReport(projectRoot);
    let sanitizeResult: SanitizeResult | null = null;
    if (securityReport) {
      sanitizeResult = sanitizeCode(content, absolutePath, securityReport, projectRoot);
      content = sanitizeResult.sanitized;
      
      // Track and log when secrets are found and replaced
      if (sanitizeResult.secretsReplaced) {
        sanitizeStats.filesWithSecrets++;
        sanitizeStats.totalSecretsReplaced += sanitizeResult.matchCount;
        sanitizeStats.filesProcessed.push(entryId);
        console.log(`   🔒 Sanitized ${sanitizeResult.matchCount} secret(s) in ${entryId}`);
      }
    }

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
 * NOTE: Source files are NEVER modified. Only the in-memory content is sanitized
 * before being included in generated JSON bundles.
 */
export async function readSourceCode(entryId: string, projectRoot: string): Promise<string | null> {
  try {
    const absolutePath = isAbsolute(entryId) ? entryId : resolve(projectRoot, entryId);
    // Read file content (source file is never modified)
    let content = await readFile(absolutePath, 'utf8');

    // Sanitize code in-memory only (for JSON generation, source files remain unchanged)
    const securityReport = await getSecurityReport(projectRoot);
    let sanitizeResult: SanitizeResult | null = null;
    if (securityReport) {
      sanitizeResult = sanitizeCode(content, absolutePath, securityReport, projectRoot);
      content = sanitizeResult.sanitized;
      
      // Track and log when secrets are found and replaced
      if (sanitizeResult.secretsReplaced) {
        sanitizeStats.filesWithSecrets++;
        sanitizeStats.totalSecretsReplaced += sanitizeResult.matchCount;
        sanitizeStats.filesProcessed.push(entryId);
        console.log(`   🔒 Sanitized ${sanitizeResult.matchCount} secret(s) in ${entryId}`);
      }
    }

    return content;
  } catch (error) {
    return null;
  }
}

