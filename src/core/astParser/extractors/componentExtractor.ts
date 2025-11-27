/**
 * Component Extractor - Extracts JSX components and React hooks from AST
 */

import { SourceFile, SyntaxKind } from 'ts-morph';

/**
 * Extract all React hooks (useState, useEffect, custom hooks)
 */
export function extractHooks(source: SourceFile): string[] {
  const hooks = new Set<string>();

  source.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((callExpr) => {
    const expr = callExpr.getExpression();
    const text = expr.getText();

    // Match useXxx pattern
    if (/^use[A-Z]/.test(text)) {
      hooks.add(text);
    }
  });

  return Array.from(hooks).sort();
}

/**
 * Extract all JSX components used in the file
 */
export function extractComponents(source: SourceFile): string[] {
  const components = new Set<string>();

  // JSX opening elements
  source.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).forEach((openingEl) => {
    const tagName = openingEl.getTagNameNode().getText();
    if (/^[A-Z]/.test(tagName)) {
      components.add(tagName);
    }
  });

  // Self-closing JSX elements
  source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).forEach((selfClosing) => {
    const tagName = selfClosing.getTagNameNode().getText();
    if (/^[A-Z]/.test(tagName)) {
      components.add(tagName);
    }
  });

  return Array.from(components).sort();
}

