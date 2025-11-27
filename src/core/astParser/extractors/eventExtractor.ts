/**
 * Event Extractor - Extracts event handlers and route patterns from AST
 */

import { SourceFile, SyntaxKind } from 'ts-morph';
import type { EventType } from '../../../types/UIFContract.js';

/**
 * Extract event handlers from JSX attributes
 */
export function extractEvents(source: SourceFile): Record<string, EventType> {
  const events: Record<string, EventType> = {};

  source.getDescendantsOfKind(SyntaxKind.JsxAttribute).forEach((attr) => {
    const name = attr.getNameNode().getText();

    // Match onXxx pattern
    if (/^on[A-Z]/.test(name)) {
      const initializer = attr.getInitializer();
      if (initializer) {
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
      }
    }
  });

  return events;
}

/**
 * Extract potential route usage (heuristic-based)
 */
export function extractJsxRoutes(source: SourceFile): string[] {
  const routes = new Set<string>();

  // Look for route-like string literals in JSX
  source.getDescendantsOfKind(SyntaxKind.StringLiteral).forEach((strLit) => {
    const value = strLit.getLiteralValue();
    // Match route patterns like /path, /path/:id, etc.
    if (/^\/[a-z0-9\-_/:.]*$/i.test(value)) {
      routes.add(value);
    }
  });

  return Array.from(routes).sort();
}

