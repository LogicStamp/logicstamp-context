/**
 * Component Extractor - Extracts JSX components and React hooks from AST
 */

import { SourceFile, SyntaxKind } from 'ts-morph';

const DEBUG = process.env.LOGICSTAMP_DEBUG === '1';

/**
 * Debug logging helper for component extractor errors
 */
function debugComponentExtractor(scope: string, filePath: string, error: unknown) {
  if (!DEBUG) return;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[logicstamp:componentExtractor][${scope}] ${filePath}: ${message}`);
}

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
        const text = expr.getText();

        // Match useXxx pattern
        if (/^use[A-Z]/.test(text)) {
          hooks.add(text);
        }
      } catch (error) {
        debugComponentExtractor('hooks-iteration', filePath, error);
        // Continue with next hook
      }
    });
  } catch (error) {
    debugComponentExtractor('hooks', filePath, error);
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
          debugComponentExtractor('components-opening', filePath, error);
          // Continue with next element
        }
      });
    } catch (error) {
      debugComponentExtractor('components-opening-batch', filePath, error);
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
          debugComponentExtractor('components-selfclosing', filePath, error);
          // Continue with next element
        }
      });
    } catch (error) {
      debugComponentExtractor('components-selfclosing-batch', filePath, error);
    }
  } catch (error) {
    debugComponentExtractor('components', filePath, error);
    return [];
  }

  return Array.from(components).sort();
}

