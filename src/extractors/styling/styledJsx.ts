/**
 * Styled JSX extractor - Extracts CSS content from <style jsx> blocks
 */

import { SourceFile, SyntaxKind, JsxElement, Node, type JsxAttributeLike } from 'ts-morph';
import * as csstree from 'css-tree';
import { debugError } from '../../utils/debug.js';

/**
 * Check if an attribute with the given name exists in the JSX attributes
 */
function hasAttribute(attrs: JsxAttributeLike[], name: string): boolean {
  return attrs.some((a) => {
    if (!Node.isJsxAttribute(a)) return false;
    try {
      return a.getNameNode().getText() === name;
    } catch {
      return false;
    }
  });
}

/**
 * Extract CSS content from an expression (template literal, string literal, etc.)
 */
function extractCssFromExpr(expr: Node): string | null {
  // `...`
  if (Node.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.getLiteralText();
  }

  // `a ${x} b`
  if (Node.isTemplateExpression(expr)) {
    const parts: string[] = [];
    parts.push(expr.getHead().getLiteralText());
    for (const span of expr.getTemplateSpans()) {
      parts.push('${expr}');
      parts.push(span.getLiteral().getLiteralText());
    }
    return parts.join('');
  }

  // '...'
  if (Node.isStringLiteral(expr)) {
    return expr.getLiteralText();
  }

  // css`...` (tagged template)
  if (Node.isTaggedTemplateExpression(expr)) {
    return extractCssFromExpr(expr.getTemplate());
  }

  return null;
}

/**
 * Extract CSS content from <style jsx> blocks
 */
export function extractStyledJsx(source: SourceFile): { css: string; global?: boolean; selectors?: string[]; properties?: string[] } | null {
  const cssBlocks: string[] = [];
  let foundGlobal = false;
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    // Find all JSX elements
    let jsxElements: JsxElement[] = [];
    try {
      jsxElements = [
        ...source.getDescendantsOfKind(SyntaxKind.JsxElement),
      ];
    } catch (error) {
      debugError('styleExtractor', 'extractStyledJsx', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        context: 'getJsxElements',
      });
      return null;
    }

    for (const element of jsxElements) {
      try {
        const openingElement = element.getOpeningElement();
        const tagName = openingElement.getTagNameNode().getText();

        // Check if it's a <style> tag
        if (tagName !== 'style') continue;

        // Get attributes once for both checks
        const attrs = openingElement.getAttributes();

        // Check for jsx attribute
        if (!hasAttribute(attrs, 'jsx')) continue;

        // Check for global attribute
        const isGlobal = hasAttribute(attrs, 'global');

        if (isGlobal) foundGlobal = true;

        // Extract CSS content from immediate children only (JsxExpression)
        try {
          const children = element.getJsxChildren();
          for (const child of children) {
            if (!Node.isJsxExpression(child)) continue;

            const expr = child.getExpression();
            if (!expr) continue;

            const css = extractCssFromExpr(expr);
            if (css?.trim()) {
              cssBlocks.push(css);
            }
          }
        } catch (error) {
          // If extraction fails, continue to next element
          debugError('styleExtractor', 'extractStyledJsx', {
            filePath,
            error: error instanceof Error ? error.message : String(error),
            context: 'css-extraction',
          });
        }
      } catch (error) {
        debugError('styleExtractor', 'extractStyledJsx', {
          filePath,
          error: error instanceof Error ? error.message : String(error),
          context: 'element-iteration',
        });
        // Continue with next element
      }
    }
  } catch (error) {
    debugError('styleExtractor', 'extractStyledJsx', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  if (cssBlocks.length === 0) {
    return null;
  }

  // Extract selectors and properties using AST (css-tree)
  // Parse each block separately for resilience (if one has ${expr} placeholders, others still work)
  const selectors = new Set<string>();
  const properties = new Set<string>();
  const validCssBlocks: string[] = [];

  // generate is available on css-tree but not in TypeScript types
  // Safe fallback in case css-tree changes and generate is no longer available
  const maybeGenerate = (csstree as unknown as { generate?: (node: any) => string }).generate;
  const generate = typeof maybeGenerate === 'function' ? maybeGenerate : null;

  // Note: If generate is missing, selector extraction is skipped but properties extraction still works.
  // We don't log this as it's not actionable for users and would only appear in debug mode anyway.

  // Parse each CSS block separately
  for (const cssBlock of cssBlocks) {
    try {
      // Parse CSS using css-tree AST parser
      const ast = csstree.parse(cssBlock, {
        parseAtrulePrelude: true,
        parseRulePrelude: true,
        parseValue: false,
        positions: false,
      });

      // Walk the AST to extract selectors and properties
      csstree.walk(ast, (node: any) => {
        // Extract selectors from Rule nodes using generate() for correct serialization
        if (node.type === 'Rule' && node.prelude && generate) {
          try {
            const selectorText = generate(node.prelude);
            selectorText
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
              .forEach((s: string) => {
                if (!s.startsWith('@')) {
                  selectors.add(s);
                }
              });
          } catch {
            // Ignore selector serialization errors
          }
        }

        // Extract properties from Declaration nodes
        if (node.type === 'Declaration' && typeof node.property === 'string') {
          const property = node.property;
          if (!property.startsWith('$') && !property.startsWith('@') && /^[a-z][a-z0-9-]*$/i.test(property)) {
            properties.add(property);
          }
        }
      });

      // If parsing succeeded, add to valid blocks
      validCssBlocks.push(cssBlock);
    } catch (error) {
      // If CSS parsing fails for this block, skip it but continue with others
      debugError('styleExtractor', 'extractStyledJsx', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        context: 'css-block-parsing',
        cssBlock: cssBlock.substring(0, 50).replace(/\s+/g, ' '), // Log first 50 chars (normalized) for debugging
      });
      // Continue with next block
    }
  }

  // If no blocks parsed successfully, fall back to regex for properties only
  if (validCssBlocks.length === 0 && cssBlocks.length > 0) {
    const combinedCss = cssBlocks.join('\n');
    const propertyPattern = /(?:^|[;\s{])([a-zA-Z-][\w-]*)\s*:/g;
    const propertyMatches = combinedCss.matchAll(propertyPattern);
    for (const match of propertyMatches) {
      const prop = match[1];
      properties.add(prop);
    }
  }

  // Combine valid CSS blocks (or all blocks if parsing failed)
  const combinedCss = validCssBlocks.length > 0 ? validCssBlocks.join('\n') : cssBlocks.join('\n');

  return {
    css: combinedCss,
    ...(foundGlobal && { global: true }),
    ...(selectors.size > 0 && { selectors: Array.from(selectors).sort() }),
    ...(properties.size > 0 && { properties: Array.from(properties).sort() }),
  };
}

