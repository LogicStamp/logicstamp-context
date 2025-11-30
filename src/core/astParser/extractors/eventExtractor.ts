/**
 * Event Extractor - Extracts event handlers and route patterns from AST
 */

import { SourceFile, SyntaxKind } from 'ts-morph';
import type { EventType } from '../../../types/UIFContract.js';

const DEBUG = process.env.LOGICSTAMP_DEBUG === '1';

/**
 * Debug logging helper for event extractor errors
 */
function debugEventExtractor(scope: string, filePath: string, error: unknown) {
  if (!DEBUG) return;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[logicstamp:eventExtractor][${scope}] ${filePath}: ${message}`);
}

/**
 * Extract event handlers from JSX attributes
 */
export function extractEvents(source: SourceFile): Record<string, EventType> {
  const events: Record<string, EventType> = {};
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    source.getDescendantsOfKind(SyntaxKind.JsxAttribute).forEach((attr) => {
      try {
        const name = attr.getNameNode().getText();

        // Match onXxx pattern
        if (/^on[A-Z]/.test(name)) {
          const initializer = attr.getInitializer();
          if (initializer) {
            try {
              // Try to infer the event handler signature
              const initText = initializer.getText();

              // Extract function signature if possible
              let signature = '() => void';  // default

              // Try to parse arrow function signature: (arg) => { ... }
              const arrowMatch = initText.match(/\(([^)]*)\)\s*=>/);
              if (arrowMatch) {
                signature = `(${arrowMatch[1]}) => void`;
              }

              events[name] = {
                type: 'function',
                signature
              };
            } catch (error) {
              debugEventExtractor('events-signature', filePath, error);
              // Use default signature
              events[name] = {
                type: 'function',
                signature: '() => void'
              };
            }
          }
        }
      } catch (error) {
        debugEventExtractor('events-iteration', filePath, error);
        // Continue with next attribute
      }
    });
  } catch (error) {
    debugEventExtractor('events', filePath, error);
    return {};
  }

  return events;
}

/**
 * Extract potential route usage (heuristic-based)
 */
export function extractJsxRoutes(source: SourceFile): string[] {
  const routes = new Set<string>();
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    // Look for route-like string literals in JSX
    source.getDescendantsOfKind(SyntaxKind.StringLiteral).forEach((strLit) => {
      try {
        const value = strLit.getLiteralValue();
        // Match route patterns like /path, /path/:id, etc.
        if (/^\/[a-z0-9\-_/:.]*$/i.test(value)) {
          routes.add(value);
        }
      } catch (error) {
        debugEventExtractor('jsxRoutes-iteration', filePath, error);
        // Continue with next literal
      }
    });
  } catch (error) {
    debugEventExtractor('jsxRoutes', filePath, error);
    return [];
  }

  return Array.from(routes).sort();
}

