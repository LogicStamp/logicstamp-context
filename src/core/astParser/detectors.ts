/**
 * Detectors - Detect component kind and Next.js metadata
 */

import { SourceFile, SyntaxKind } from 'ts-morph';
import type { ContractKind, NextJSMetadata } from '../../types/UIFContract.js';

const DEBUG = process.env.LOGICSTAMP_DEBUG === '1';

/**
 * Debug logging helper for detector errors
 */
function debugDetector(scope: string, filePath: string, error: unknown) {
  if (!DEBUG) return;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[logicstamp:detector][${scope}] ${filePath}: ${message}`);
}

/**
 * Detect Next.js 'use client' or 'use server' directives
 * These directives must appear at the top of the file (before any imports)
 */
export function detectNextJsDirective(source: SourceFile): 'client' | 'server' | undefined {
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    const fullText = source.getFullText();

    // Get the first few lines (directives must be at the top)
    const firstLines = fullText.split('\n').slice(0, 5);

    // Check each line - directive must be at start of line (ignoring whitespace)
    for (const line of firstLines) {
      try {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
          continue;
        }

        // Check for 'use client' directive at start of statement
        if (/^['"]use client['"];?$/.test(trimmed)) {
          return 'client';
        }

        // Check for 'use server' directive at start of statement
        if (/^['"]use server['"];?$/.test(trimmed)) {
          return 'server';
        }

        // If we hit a non-comment, non-directive line, stop looking
        if (trimmed) {
          break;
        }
      } catch (error) {
        debugDetector('directive-line', filePath, error);
        // Continue with next line
      }
    }
  } catch (error) {
    debugDetector('directive', filePath, error);
    return undefined;
  }

  return undefined;
}

/**
 * Detect if file is in Next.js App Router directory
 * Checks if the file path contains /app/ or \app\ directory
 */
export function isInNextAppDir(filePath: string): boolean {
  // Normalize path separators and check for /app/ directory
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Match /app/ directory (not just any path containing 'app')
  // Must be a directory boundary, not part of another word
  return /\/app\//.test(normalizedPath) || /^app\//.test(normalizedPath);
}

/**
 * Extract Next.js metadata from the file
 */
export function extractNextJsMetadata(source: SourceFile, filePath: string): NextJSMetadata | undefined {
  const resolvedPath = source.getFilePath?.() ?? filePath;

  try {
    const directive = detectNextJsDirective(source);
    const isInApp = isInNextAppDir(filePath);

    // Only return metadata if we have something to report
    if (directive || isInApp) {
      return {
        ...(isInApp && { isInAppDir: true }),
        ...(directive && { directive })
      };
    }
  } catch (error) {
    debugDetector('nextjs-metadata', resolvedPath, error);
    return undefined;
  }

  return undefined;
}

/**
 * Detect component kind based on its characteristics
 */
export function detectKind(
  hooks: string[],
  components: string[],
  imports: string[],
  filePath: string,
  source: SourceFile
): ContractKind {
  const resolvedPath = source.getFilePath?.() ?? filePath;

  try {
    // React component: has hooks or JSX components
    if (hooks.length > 0 || components.length > 0) {
      return 'react:component';
    }

    // Check for React imports
    const hasReactImport = imports.some(imp => imp === 'react' || imp.startsWith('react/'));

    if (hasReactImport) {
      try {
        const sourceText = source.getFullText();

        // Check for any JSX usage (including lowercase HTML elements)
        let hasJsxElements = false;
        try {
          hasJsxElements = source.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 ||
                          source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0 ||
                          source.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0;
        } catch (error) {
          debugDetector('kind-jsx-traversal', resolvedPath, error);
          // Continue with other checks
        }

        if (hasJsxElements) {
          return 'react:component';
        }

        // Check for React.createElement usage
        if (/React\.createElement/.test(sourceText)) {
          return 'react:component';
        }

        // Check for React component type annotations
        // Look for React.FC, React.FunctionComponent, or return type JSX.Element
        if (/React\.(FC|FunctionComponent|ReactElement)|:\s*JSX\.Element/.test(sourceText)) {
          return 'react:component';
        }
      } catch (error) {
        debugDetector('kind-react-check', resolvedPath, error);
        // Continue with other checks
      }
    }

    // Node CLI: check for CLI-specific patterns
    // 1. File is in a /cli/ directory, OR
    // 2. File uses process.argv (CLI argument parsing)
    const isInCliDir = /[/\\]cli[/\\]/.test(filePath);
    try {
      const sourceText = source.getFullText();
      const usesProcessArgv = /process\.argv/.test(sourceText);

      if (isInCliDir || usesProcessArgv) {
        return 'node:cli';
      }
    } catch (error) {
      debugDetector('kind-cli-check', resolvedPath, error);
      // If CLI check fails, continue to default
    }
  } catch (error) {
    debugDetector('kind', resolvedPath, error);
    // Default fallback on any error
    return 'ts:module';
  }

  // Default: TypeScript module (even if it imports from node:)
  return 'ts:module';
}

