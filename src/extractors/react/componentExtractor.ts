/**
 * Component Extractor - Extracts JSX components and React hooks from AST
 */

import { SourceFile, SyntaxKind } from 'ts-morph';
import { debugError } from '../../utils/debug.js';

/**
 * Extract all React hooks (useState, useEffect, custom hooks)
 */
export function extractHooks(source: SourceFile): string[] {
  const hooks = new Set<string>();
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    source.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((callExpr) => {
      try {
        const expr = callExpr.getExpression();
        
        // Only extract hooks from direct identifier calls (not method chains)
        // e.g., useState() is extracted, but useState().map() should only extract useState
        if (expr.getKind() === SyntaxKind.Identifier) {
          const text = expr.getText();

          // Match useXxx pattern
          if (/^use[A-Z]/.test(text)) {
            hooks.add(text);
          }
        }
      } catch (error) {
        debugError('componentExtractor', 'extractHooks', {
          filePath,
          error: error instanceof Error ? error.message : String(error),
          context: 'hooks-iteration',
        });
        // Continue with next hook
      }
    });
  } catch (error) {
    debugError('componentExtractor', 'extractHooks', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  return Array.from(hooks).sort();
}

/**
 * Extract all JSX components used in the file
 */
export function extractComponents(source: SourceFile): string[] {
  const components = new Set<string>();
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    // JSX opening elements
    try {
      source.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).forEach((openingEl) => {
        try {
          const tagName = openingEl.getTagNameNode().getText();
          if (/^[A-Z]/.test(tagName)) {
            components.add(tagName);
          }
        } catch (error) {
          debugError('componentExtractor', 'extractComponents', {
            filePath,
            error: error instanceof Error ? error.message : String(error),
            context: 'components-opening',
          });
          // Continue with next element
        }
      });
    } catch (error) {
      debugError('componentExtractor', 'extractComponents', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        context: 'components-opening-batch',
      });
    }

    // Self-closing JSX elements
    try {
      source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).forEach((selfClosing) => {
        try {
          const tagName = selfClosing.getTagNameNode().getText();
          if (/^[A-Z]/.test(tagName)) {
            components.add(tagName);
          }
        } catch (error) {
          debugError('componentExtractor', 'extractComponents', {
            filePath,
            error: error instanceof Error ? error.message : String(error),
            context: 'components-selfclosing',
          });
          // Continue with next element
        }
      });
    } catch (error) {
      debugError('componentExtractor', 'extractComponents', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        context: 'components-selfclosing-batch',
      });
    }
  } catch (error) {
    debugError('componentExtractor', 'extractComponents', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  return Array.from(components).sort();
}
