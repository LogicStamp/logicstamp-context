/**
 * Loader module - Load contracts, manifests, and source code
 */

import { readFile } from 'node:fs/promises';
import { join, resolve, isAbsolute } from 'node:path';
import type { UIFContract } from '../../types/UIFContract.js';
import type { ProjectManifest } from '../manifest.js';
import { debugError } from '../../utils/debug.js';
import { isPathWithinRoot, toForwardSlashes } from '../../utils/fsx.js';
import { validateUIFContract } from '../../utils/schemaValidator.js';
import {
  loadSecurityReport,
  sanitizeCode,
  type SanitizeResult,
} from '../../utils/codeSanitizer.js';
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
function isCacheValid(
  cache: SecurityReportCache | null,
  projectRoot: string,
): boolean {
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
  /** Whether a security report was loaded (false = security scan was never run) */
  securityReportLoaded: boolean;
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
  securityReportLoaded: false,
};

// Track whether security report was loaded during this context generation
let securityReportWasLoaded = false;

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
  const stats = {
    ...sanitizeStats,
    securityReportLoaded: securityReportWasLoaded,
  };
  sanitizeStats = {
    filesWithSecrets: 0,
    totalSecretsReplaced: 0,
    filesProcessed: [],
    securityReportLoaded: false,
  };
  securityReportWasLoaded = false;
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
      `Failed to load manifest at ${manifestPath}: ${err.code === 'ENOENT' ? 'File not found' : err.message}`,
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
    throw new Error(
      `Failed to parse manifest at ${manifestPath}: ${err.message}`,
    );
  }
}

/**
 * Load a sidecar contract file
 * Sidecar path is computed from the manifest key (project-relative): resolved from projectRoot + key + '.uif.json'
 */
export async function loadContract(
  entryId: string,
  projectRoot: string,
): Promise<UIFContract | null> {
  // Validate path stays within project root (prevents path traversal attacks)
  if (!isPathWithinRoot(entryId, projectRoot)) {
    debugError('loader', 'loadContract', {
      entryId,
      projectRoot,
      message: 'Path traversal attempt detected - path outside project root',
    });
    return null;
  }

  // Resolve relative path from project root
  const absolutePath = isAbsolute(entryId)
    ? entryId
    : resolve(projectRoot, entryId);
  const sidecarPath = `${absolutePath}.uif.json`;

  // 1. Read file
  let content: string;
  try {
    content = await readFile(sidecarPath, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    // File not found is normal (sidecar doesn't exist yet) - silent return
    if (err.code === 'ENOENT') {
      return null;
    }
    // Other read errors (permissions, etc.) - log and return
    debugError('loader', 'loadContract', {
      sidecarPath,
      entryId,
      message: 'Failed to read sidecar file',
      errorCode: err.code,
      errorMessage: err.message,
    });
    return null;
  }

  // 2. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const err = error as Error;
    debugError('loader', 'loadContract', {
      sidecarPath,
      entryId,
      message: 'Invalid JSON in sidecar file',
      parseError: err.message,
    });
    return null;
  }

  // 3. Validate against UIFContract schema
  const { valid, errors, data } = validateUIFContract(parsed);

  if (!valid) {
    // Cap errors to prevent log spam (AJV can output dozens of lines)
    const MAX_ERRORS = 20;
    const shownErrors = errors.slice(0, MAX_ERRORS);
    const extraCount = errors.length - shownErrors.length;

    debugError('loader', 'loadContract', {
      sidecarPath,
      entryId,
      message: 'Invalid contract schema',
      validationErrors: shownErrors,
      ...(extraCount > 0 && { additionalErrors: `+${extraCount} more` }),
      hint: 'This file may have been generated by an older LogicStamp version; rerun `stamp context`',
    });
    return null;
  }

  return data;
}

/**
 * Normalize project root for comparison (handles Windows case-insensitivity and path variations)
 */
function normalizeProjectRoot(path: string): string {
  const normalized = resolve(path);
  // On Windows, paths are case-insensitive, so lowercase for comparison
  if (process.platform === 'win32') {
    return toForwardSlashes(normalized.toLowerCase());
  }
  return toForwardSlashes(normalized);
}

/**
 * Get security report (cached per project with expiration)
 * Cache automatically expires after CACHE_MAX_AGE_MS to prevent memory leaks
 */
async function getSecurityReport(
  projectRoot: string,
): Promise<SecurityReport | null> {
  // Check if we have a valid cached report
  if (isCacheValid(securityReportCache, projectRoot)) {
    // Track that we have a security report available
    if (securityReportCache!.report !== null) {
      securityReportWasLoaded = true;
    }
    return securityReportCache!.report;
  }

  // Load and cache the report with timestamp
  const report = await loadSecurityReport(projectRoot);
  securityReportCache = {
    report,
    projectRoot,
    timestamp: Date.now(),
  };

  // Track that we have a security report available
  if (report !== null) {
    securityReportWasLoaded = true;
  }

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
export async function extractCodeHeader(
  entryId: string,
  projectRoot: string,
): Promise<CodeHeaderResult> {
  // Validate path stays within project root (prevents path traversal attacks)
  if (!isPathWithinRoot(entryId, projectRoot)) {
    debugError('loader', 'extractCodeHeader', {
      entryId,
      projectRoot,
      message: 'Path traversal attempt detected - path outside project root',
    });
    return { header: null };
  }

  try {
    const absolutePath = isAbsolute(entryId)
      ? entryId
      : resolve(projectRoot, entryId);
    // Read file content (source file is never modified)
    let content = await readFile(absolutePath, 'utf8');

    // Sanitize code in-memory only (for JSON generation, source files remain unchanged)
    const securityReport = await getSecurityReport(projectRoot);
    let sanitizeInfo: SanitizeInfo | undefined;
    if (securityReport) {
      const sanitizeResult = sanitizeCode(
        content,
        absolutePath,
        securityReport,
        projectRoot,
      );
      content = sanitizeResult.sanitized;

      // Return sanitization info for caller to aggregate (no global mutation)
      if (sanitizeResult.secretsReplaced) {
        sanitizeInfo = {
          hadSecrets: true,
          secretCount: sanitizeResult.matchCount,
          entryId,
        };
        console.log(
          `   🔒 Sanitized ${sanitizeResult.matchCount} secret(s) in ${entryId}`,
        );
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
export async function readSourceCode(
  entryId: string,
  projectRoot: string,
): Promise<SourceCodeResult> {
  // Validate path stays within project root (prevents path traversal attacks)
  if (!isPathWithinRoot(entryId, projectRoot)) {
    debugError('loader', 'readSourceCode', {
      entryId,
      projectRoot,
      message: 'Path traversal attempt detected - path outside project root',
    });
    return { code: null };
  }

  try {
    const absolutePath = isAbsolute(entryId)
      ? entryId
      : resolve(projectRoot, entryId);
    // Read file content (source file is never modified)
    let content = await readFile(absolutePath, 'utf8');

    // Sanitize code in-memory only (for JSON generation, source files remain unchanged)
    const securityReport = await getSecurityReport(projectRoot);
    let sanitizeInfo: SanitizeInfo | undefined;
    if (securityReport) {
      const sanitizeResult = sanitizeCode(
        content,
        absolutePath,
        securityReport,
        projectRoot,
      );
      content = sanitizeResult.sanitized;

      // Return sanitization info for caller to aggregate (no global mutation)
      if (sanitizeResult.secretsReplaced) {
        sanitizeInfo = {
          hadSecrets: true,
          secretCount: sanitizeResult.matchCount,
          entryId,
        };
        console.log(
          `   🔒 Sanitized ${sanitizeResult.matchCount} secret(s) in ${entryId}`,
        );
      }
    }

    return { code: content, sanitizeInfo };
  } catch (error) {
    return { code: null };
  }
}
