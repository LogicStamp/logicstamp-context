/**
 * Code sanitization utilities
 * Replaces secret values in code with "PRIVATE_DATA" based on security report
 */

import { resolve, isAbsolute, normalize } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { SecretMatch } from './secretDetector.js';
import type { SecurityReport } from '../cli/commands/security.js';

/**
 * Load security report from file
 */
export async function loadSecurityReport(projectRoot: string): Promise<SecurityReport | null> {
  try {
    const reportPath = resolve(projectRoot, 'stamp_security_report.json');
    const content = await readFile(reportPath, 'utf8');
    return JSON.parse(content) as SecurityReport;
  } catch (error) {
    // Report doesn't exist or can't be read - that's okay
    return null;
  }
}

/**
 * Normalize a path for comparison (handles Windows case-insensitivity)
 * Converts to lowercase on Windows and normalizes separators
 */
function normalizePathForComparison(path: string): string {
  const normalized = normalize(resolve(path));
  // On Windows, paths are case-insensitive, so lowercase for comparison
  // Also normalize separators to forward slashes for consistency
  if (process.platform === 'win32') {
    return normalized.toLowerCase().replace(/\\/g, '/');
  }
  return normalized.replace(/\\/g, '/');
}

/**
 * Get secret matches for a specific file
 */
function getSecretMatchesForFile(
  report: SecurityReport,
  filePath: string,
  projectRoot: string
): SecretMatch[] {
  // Try to match file path - handle both absolute and relative paths
  const absoluteFilePath = isAbsolute(filePath) ? filePath : resolve(projectRoot, filePath);
  const normalizedTargetPath = normalizePathForComparison(absoluteFilePath);
  
  // Also normalize project roots for comparison
  const normalizedReportRoot = normalizePathForComparison(report.projectRoot);
  const normalizedCurrentRoot = normalizePathForComparison(projectRoot);
  
  return report.matches.filter(match => {
    // Normalize match file path - try multiple strategies
    let matchFilePath: string;
    
    if (isAbsolute(match.file)) {
      // Match file is already absolute
      matchFilePath = match.file;
    } else {
      // Match file is relative - try resolving from report's projectRoot first
      matchFilePath = resolve(report.projectRoot, match.file);
    }
    
    const normalizedMatchPath = normalizePathForComparison(matchFilePath);
    
    // Direct path match
    if (normalizedMatchPath === normalizedTargetPath) {
      return true;
    }
    
    // If project roots differ, try resolving relative to current projectRoot
    if (normalizedReportRoot !== normalizedCurrentRoot && !isAbsolute(match.file)) {
      // Try resolving the match file relative to current projectRoot
      const alternativePath = resolve(projectRoot, match.file);
      const normalizedAlternative = normalizePathForComparison(alternativePath);
      if (normalizedAlternative === normalizedTargetPath) {
        return true;
      }
      
      // Try making both paths relative to their respective roots and comparing
      // This handles cases where the file structure is the same but roots differ
      try {
        const relativeFromReport = match.file.replace(/^\.\//, '');
        const relativeFromCurrent = filePath.replace(/^\.\//, '');
        if (normalizePathForComparison(relativeFromReport) === normalizePathForComparison(relativeFromCurrent)) {
          return true;
        }
      } catch {
        // Ignore errors in relative path comparison
      }
    }
    
    return false;
  });
}

/**
 * Sanitize a line of code by replacing secret values with "PRIVATE_DATA"
 * Uses the match information to accurately identify and replace the secret value
 */
function sanitizeLine(line: string, matches: SecretMatch[]): string {
  if (matches.length === 0) {
    return line;
  }

  let sanitized = line;
  
  // Sort matches by column (right to left) to avoid offset issues when replacing
  const sortedMatches = [...matches].sort((a, b) => b.column - a.column);
  
  for (const match of sortedMatches) {
    // Extract the secret value from the snippet
    // The snippet typically shows: "context = 'SECRET_VALUE' context"
    // We need to extract the actual secret value
    
    // For database URLs: postgres://user:password@host (check this FIRST before quoted value matching)
    // Database URLs are often in quotes, so we need to handle them specially
    if (match.type === 'Database URL with Credentials') {
      // Extract the password from the URL pattern: protocol://user:password@host
      const dbUrlMatch = match.snippet.match(/((?:postgres|mysql|mongodb):\/\/[^:]+:)([^@]+)(@)/i);
      if (dbUrlMatch) {
        const password = dbUrlMatch[2];
        // Also try to find the full URL in the line to replace just the password part
        const fullUrlMatch = sanitized.match(/(['"`])((?:postgres|mysql|mongodb):\/\/[^:]+:)([^@]+)(@[^'"`]+)\1/i);
        if (fullUrlMatch) {
          const quote = fullUrlMatch[1];
          const prefix = fullUrlMatch[2];
          const passwordPart = fullUrlMatch[3];
          const suffix = fullUrlMatch[4];
          // Replace the URL with password sanitized
          sanitized = sanitized.replace(
            fullUrlMatch[0],
            `${quote}${prefix}PRIVATE_DATA${suffix}${quote}`
          );
        } else if (sanitized.includes(password)) {
          // Fallback: just replace the password if we can't match the full URL
          sanitized = sanitized.replace(password, 'PRIVATE_DATA');
        }
      }
      continue;
    }
    
    // Try to extract quoted values: 'value', "value", or `value`
    // Handle cases where snippet has extra context (leading/trailing spaces, etc.)
    const quotedValueMatch = match.snippet.match(/[=:]\s*(['"`])([^'"`]+)\1/);
    if (quotedValueMatch) {
      const quote = quotedValueMatch[1];
      const secretValue = quotedValueMatch[2];
      
      // Replace the secret value in the line, preserving quotes
      // The secretValue might be in the line even if the snippet has different context
      if (secretValue && secretValue.length > 0) {
        const escapedValue = secretValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Try to find and replace the quoted value in the line
        // Match: quote + secretValue + quote (with word boundaries to avoid partial matches)
        const quotePattern = new RegExp(`${quote}${escapedValue}${quote}`, 'g');
        // Check if pattern matches (don't use test() as it modifies lastIndex)
        if (quotePattern.exec(sanitized) !== null) {
          // Reset regex lastIndex before replace
          quotePattern.lastIndex = 0;
          sanitized = sanitized.replace(quotePattern, `${quote}PRIVATE_DATA${quote}`);
        } else if (sanitized.includes(secretValue)) {
          // Fallback: if exact quote match fails, try to replace the value itself
          // This handles cases where quotes might differ or context is different
          sanitized = sanitized.replace(new RegExp(escapedValue, 'g'), 'PRIVATE_DATA');
        }
      }
      continue;
    }
    
    // Try to extract unquoted values after = or :
    const unquotedValueMatch = match.snippet.match(/[=:]\s+([a-zA-Z0-9_\-]{16,})/);
    if (unquotedValueMatch) {
      const secretValue = unquotedValueMatch[1];
      if (sanitized.includes(secretValue)) {
        const escapedValue = secretValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        sanitized = sanitized.replace(
          new RegExp(`\\b${escapedValue}\\b`, 'g'),
          'PRIVATE_DATA'
        );
      }
      continue;
    }
    
    // For private keys, replace the entire key block
    if (match.type === 'Private Key' && sanitized.includes('BEGIN')) {
      // Find the private key block and replace content between BEGIN and END
      sanitized = sanitized.replace(
        /(-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----)[\s\S]*?(-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----)/g,
        '$1\nPRIVATE_DATA\n$2'
      );
      continue;
    }
    
    // Fallback: try to find and replace long alphanumeric strings that match the pattern
    // This is less precise but catches edge cases
    const longStringMatch = match.snippet.match(/([a-zA-Z0-9_\-]{20,})/);
    if (longStringMatch) {
      const potentialSecret = longStringMatch[1];
      // Only replace if it's not already been replaced and it's a reasonable length
      if (potentialSecret.length >= 16 && sanitized.includes(potentialSecret) && !sanitized.includes('PRIVATE_DATA')) {
        const escaped = potentialSecret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        sanitized = sanitized.replace(new RegExp(escaped, 'g'), 'PRIVATE_DATA');
      }
    }
  }
  
  return sanitized;
}

/**
 * Result of sanitization operation
 */
export interface SanitizeResult {
  sanitized: string;
  secretsReplaced: boolean;
  filePath: string;
  matchCount: number;
}

/**
 * Sanitize code by replacing secret values with "PRIVATE_DATA"
 * Uses security report to identify which lines contain secrets
 */
export function sanitizeCode(
  code: string,
  filePath: string,
  report: SecurityReport | null,
  projectRoot: string
): SanitizeResult {
  if (!report || report.matches.length === 0) {
    return {
      sanitized: code,
      secretsReplaced: false,
      filePath,
      matchCount: 0,
    };
  }

  // Get secret matches for this specific file
  const fileMatches = getSecretMatchesForFile(report, filePath, projectRoot);
  
  if (fileMatches.length === 0) {
    // No matches for this file - return code unchanged
    return {
      sanitized: code,
      secretsReplaced: false,
      filePath,
      matchCount: 0,
    };
  }

  // Group matches by line number
  const matchesByLine = new Map<number, SecretMatch[]>();
  for (const match of fileMatches) {
    if (!matchesByLine.has(match.line)) {
      matchesByLine.set(match.line, []);
    }
    matchesByLine.get(match.line)!.push(match);
  }

  // Sanitize each line that has secrets
  const lines = code.split('\n');
  let secretsReplaced = false;
  const sanitizedLines = lines.map((line, index) => {
    const lineNumber = index + 1; // Line numbers are 1-based
    const lineMatches = matchesByLine.get(lineNumber);
    
    if (lineMatches && lineMatches.length > 0) {
      const sanitized = sanitizeLine(line, lineMatches);
      if (sanitized !== line) {
        secretsReplaced = true;
      }
      return sanitized;
    }
    
    return line;
  });

  return {
    sanitized: sanitizedLines.join('\n'),
    secretsReplaced,
    filePath,
    matchCount: fileMatches.length,
  };
}

