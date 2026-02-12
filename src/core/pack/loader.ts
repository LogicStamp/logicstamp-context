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

// Cache for security report with expiration
interface SecurityReportCache {
  report: SecurityReport | null;
  projectRoot: string;
  timestamp: number;
}

// Cache expiration time (5 minutes) - balances performance vs memory for long-running processes
const CACHE_MAX_AGE_MS = 5 * 60 * 1000;

let securityReportCache: SecurityReportCache | null = null;

/**
 * Clear the security report cache
 * Call this when switching projects or to free memory in long-running processes
 */
export function clearSecurityReportCache(): void {
  securityReportCache = null;
}

/**
 * Check if cache is still valid (not expired and same project)
 */
function isCacheValid(cache: SecurityReportCache | null, projectRoot: string): boolean {
  if (!cache) return false;

  const normalizedCached = normalizeProjectRoot(cache.projectRoot);
  const normalizedCurrent = normalizeProjectRoot(projectRoot);

  // Check if same project
  if (normalizedCached !== normalizedCurrent) return false;

  // Check if expired
  const age = Date.now() - cache.timestamp;
  if (age > CACHE_MAX_AGE_MS) return false;

  return true;
}

// Track sanitization statistics
export interface SanitizeStats {
  filesWithSecrets: number;
  totalSecretsReplaced: number;
  filesProcessed: string[];
}

// Per-file sanitization info returned from extraction functions
export interface SanitizeInfo {
  hadSecrets: boolean;
  secretCount: number;
  entryId: string;
}

// Result types that include sanitization info
export interface CodeHeaderResult {
  header: string | null;
  sanitizeInfo?: SanitizeInfo;
}

export interface SourceCodeResult {
  code: string | null;
  sanitizeInfo?: SanitizeInfo;
}

// Module-level stats accumulator (populated by recordSanitization, read by getAndResetSanitizeStats)
let sanitizeStats: SanitizeStats = {
  filesWithSecrets: 0,
  totalSecretsReplaced: 0,
  filesProcessed: [],
};

/**
 * Record sanitization info into the module-level accumulator
 * Thread-safe: callers aggregate results and call this once after processing
 */
export function recordSanitization(info: SanitizeInfo): void {
  if (info.hadSecrets) {
    sanitizeStats.filesWithSecrets++;
    sanitizeStats.totalSecretsReplaced += info.secretCount;
    sanitizeStats.filesProcessed.push(info.entryId);
  }
}

/**
 * Record multiple sanitization infos at once (for batch processing)
 * This is the preferred method - aggregate locally, then record once
 */
export function recordSanitizationBatch(infos: SanitizeInfo[]): void {
  for (const info of infos) {
    if (info.hadSecrets) {
      sanitizeStats.filesWithSecrets++;
      sanitizeStats.totalSecretsReplaced += info.secretCount;
      sanitizeStats.filesProcessed.push(info.entryId);
    }
  }
}

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
 * Get security report (cached per project with expiration)
 * Cache automatically expires after CACHE_MAX_AGE_MS to prevent memory leaks
 */
async function getSecurityReport(projectRoot: string): Promise<SecurityReport | null> {
  // Check if we have a valid cached report
  if (isCacheValid(securityReportCache, projectRoot)) {
    return securityReportCache!.report;
  }

  // Load and cache the report with timestamp
  const report = await loadSecurityReport(projectRoot);
  securityReportCache = {
    report,
    projectRoot,
    timestamp: Date.now(),
  };
  return report;
}

/**
 * Extract code header (JSDoc @uif block) from source file
 * NOTE: Source files are NEVER modified. Only the in-memory content is sanitized
 * before being included in generated JSON bundles.
 *
 * Returns both the header and sanitization info to avoid race conditions.
 * Callers should aggregate sanitization info and record it once after batch processing.
 */
export async function extractCodeHeader(entryId: string, projectRoot: string): Promise<CodeHeaderResult> {
  try {
    const absolutePath = isAbsolute(entryId) ? entryId : resolve(projectRoot, entryId);
    // Read file content (source file is never modified)
    let content = await readFile(absolutePath, 'utf8');

    // Sanitize code in-memory only (for JSON generation, source files remain unchanged)
    const securityReport = await getSecurityReport(projectRoot);
    let sanitizeInfo: SanitizeInfo | undefined = undefined;
    if (securityReport) {
      const sanitizeResult = sanitizeCode(content, absolutePath, securityReport, projectRoot);
      content = sanitizeResult.sanitized;

      // Return sanitization info for caller to aggregate (no global mutation)
      if (sanitizeResult.secretsReplaced) {
        sanitizeInfo = {
          hadSecrets: true,
          secretCount: sanitizeResult.matchCount,
          entryId,
        };
        console.log(`   🔒 Sanitized ${sanitizeResult.matchCount} secret(s) in ${entryId}`);
      }
    }

    // Look for @uif JSDoc block
    const headerMatch = content.match(/\/\*\*[\s\S]*?@uif[\s\S]*?\*\//);
    if (headerMatch) {
      return { header: headerMatch[0], sanitizeInfo };
    }

    return { header: null, sanitizeInfo };
  } catch (error) {
    return { header: null };
  }
}

/**
 * Read full source code
 * NOTE: Source files are NEVER modified. Only the in-memory content is sanitized
 * before being included in generated JSON bundles.
 *
 * Returns both the code and sanitization info to avoid race conditions.
 * Callers should aggregate sanitization info and record it once after batch processing.
 */
export async function readSourceCode(entryId: string, projectRoot: string): Promise<SourceCodeResult> {
  try {
    const absolutePath = isAbsolute(entryId) ? entryId : resolve(projectRoot, entryId);
    // Read file content (source file is never modified)
    let content = await readFile(absolutePath, 'utf8');

    // Sanitize code in-memory only (for JSON generation, source files remain unchanged)
    const securityReport = await getSecurityReport(projectRoot);
    let sanitizeInfo: SanitizeInfo | undefined = undefined;
    if (securityReport) {
      const sanitizeResult = sanitizeCode(content, absolutePath, securityReport, projectRoot);
      content = sanitizeResult.sanitized;

      // Return sanitization info for caller to aggregate (no global mutation)
      if (sanitizeResult.secretsReplaced) {
        sanitizeInfo = {
          hadSecrets: true,
          secretCount: sanitizeResult.matchCount,
          entryId,
        };
        console.log(`   🔒 Sanitized ${sanitizeResult.matchCount} secret(s) in ${entryId}`);
      }
    }

    return { code: content, sanitizeInfo };
  } catch (error) {
    return { code: null };
  }
}

