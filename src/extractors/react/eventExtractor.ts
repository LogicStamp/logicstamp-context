/**
 * Event Extractor - Extracts event handlers and route patterns from AST
 */

import { SourceFile, SyntaxKind, ArrowFunction, JsxExpression, Node } from 'ts-morph';
import type { EventType, PropType } from '../../types/UIFContract.js';
import { debugError } from '../../utils/debug.js';

/**
 * Extract event handlers from JSX attributes
 * Only includes handlers that are part of the component's public API (props)
 * Filters out internal handlers that are not props
 * 
 * @param source - The source file to extract events from
 * @param props - The component's props (from Props interface/type)
 * @returns Record of event handler names to their types
 */
export function extractEvents(
  source: SourceFile,
  props: Record<string, PropType> = {}
): Record<string, EventType> {
  const events: Record<string, EventType> = {};
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    source.getDescendantsOfKind(SyntaxKind.JsxAttribute).forEach((attr) => {
      try {
        const name = attr.getNameNode().getText();

        // Match onXxx pattern
        if (/^on[A-Z]/.test(name)) {
          // Only include handlers that are props (public API)
          // This filters out internal handlers and inline handlers that are not part of the component's public API
          // Use hasOwnProperty to avoid inherited prototype properties
          const isProp = Object.prototype.hasOwnProperty.call(props, name);

          if (isProp) {
            // Get prop type once to avoid duplication
            const propType = props[name];
            const initializer = attr.getInitializer();
            
            // Extract function signature - prop type signature is authoritative
            let signature = '() => void';  // default
            
            // First priority: use prop type signature if available (most accurate)
            if (propType && typeof propType === 'object' && 'signature' in propType && typeof propType.signature === 'string') {
              signature = propType.signature;
            } else if (initializer && Node.isJsxExpression(initializer)) {
              // Only parse from JSX expressions if no prop signature exists
              // Skip StringLiteral initializers (e.g., href="/x") - they're not arrow functions
              // This avoids learning wrong signatures from wrapper functions like onClick={(e) => onClick?.(e)}
              try {
                const jsxExpr = initializer as JsxExpression;
                const expression = jsxExpr.getExpression();

                // Use AST-based parsing for arrow functions (more robust than regex)
                if (expression && Node.isArrowFunction(expression)) {
                  const arrowFunc = expression as ArrowFunction;
                  const parameters = arrowFunc.getParameters();
                  // Explicitly handle both 0 params and >0 params cases for clarity
                  if (parameters.length > 0) {
                    const paramTexts = parameters.map(param => {
                      const paramName = param.getName();
                      const paramType = param.getType();
                      // Try to get type text, fallback to just name
                      // Note: getText() can produce fully-qualified types, but we use it as-is for now
                      try {
                        const typeText = paramType.getText();
                        return typeText !== 'any' ? `${paramName}: ${typeText}` : paramName;
                      } catch {
                        return paramName;
                      }
                    });
                    signature = `(${paramTexts.join(', ')}) => void`;
                  } else {
                    signature = '() => void';
                  }
                }
                // Note: We don't infer signatures from identifier references (e.g., onClick={handleClick})
                // because: (1) prop type signatures are preferred, (2) symbol resolution is heavier,
                // (3) if prop isn't typed, guessing can get messy. This is acceptable for v0.3.7.
              } catch (error) {
                debugError('eventExtractor', 'extractEvents', {
                  filePath,
                  error: error instanceof Error ? error.message : String(error),
                  context: 'events-signature',
                });
                // Keep default signature on error
              }
            }
            // If it's a prop, always include it (even if no initializer and no signature - use default)
            events[name] = {
              type: 'function',
              signature
            };
          }
          // If handler is not a prop, skip it (it's an internal handler or inline handler)
        }
      } catch (error) {
        debugError('eventExtractor', 'extractEvents', {
          filePath,
          error: error instanceof Error ? error.message : String(error),
          context: 'events-iteration',
        });
        // Continue with next attribute
      }
    });
  } catch (error) {
    debugError('eventExtractor', 'extractEvents', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }

  return events;
}

/**
 * Extract potential route usage (heuristic-based)
 * Only extracts routes from JSX attribute values to avoid false positives from config/constants
 */
export function extractJsxRoutes(source: SourceFile): string[] {
  const routes = new Set<string>();
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    // Only look for route-like string literals in JSX attributes (path, to, href, etc.)
    source.getDescendantsOfKind(SyntaxKind.JsxAttribute).forEach((attr) => {
      try {
        const attrName = attr.getNameNode().getText().toLowerCase();
        // Common route-related attribute names
        const routeAttributes = ['path', 'to', 'href', 'as', 'route', 'src'];
        
        if (routeAttributes.includes(attrName)) {
          const initializer = attr.getInitializer();
          if (initializer) {
            // Handle string literals: path="/home"
            // Use Node.isStringLiteral() type guard for safety across ts-morph versions
            if (Node.isStringLiteral(initializer)) {
              try {
                const value = initializer.getLiteralValue();
                // Match route patterns like /path, /path/:id, etc.
                if (/^\/[a-z0-9\-_/:.]*$/i.test(value)) {
                  routes.add(value);
                }
              } catch {
                // Fallback: extract from text if getLiteralValue() fails
                const text = initializer.getText();
                const value = text.slice(1, -1); // Remove quotes
                if (/^\/[a-z0-9\-_/:.]*$/i.test(value)) {
                  routes.add(value);
                }
              }
            }
            // Handle JSX expressions: path={"/home"} or path={route}
            else if (Node.isJsxExpression(initializer)) {
              const jsxExpr = initializer as JsxExpression;
              const expression = jsxExpr.getExpression();
              if (expression && Node.isStringLiteral(expression)) {
                try {
                  const value = expression.getLiteralValue();
                  if (/^\/[a-z0-9\-_/:.]*$/i.test(value)) {
                    routes.add(value);
                  }
                } catch {
                  // Fallback: extract from text if getLiteralValue() fails
                  const text = expression.getText();
                  const value = text.slice(1, -1); // Remove quotes
                  if (/^\/[a-z0-9\-_/:.]*$/i.test(value)) {
                    routes.add(value);
                  }
                }
              }
            }
            // Handle JSX-specific literal nodes that aren't standard StringLiteral
            // Depending on ts-morph/TS AST version, href="/x" might not always be StringLiteral
            // This branch catches those cases by parsing the text directly
            else {
              try {
                const text = initializer.getText();
                // Try to parse quoted string: "/x" or '/x'
                const quotedMatch = text.match(/^["']([^"']+)["']$/);
                if (quotedMatch) {
                  const value = quotedMatch[1];
                  // Match route patterns like /path, /path/:id, etc.
                  if (/^\/[a-z0-9\-_/:.]*$/i.test(value)) {
                    routes.add(value);
                  }
                }
              } catch {
                // Skip if parsing fails
              }
            }
          }
        }
      } catch (error) {
        debugError('eventExtractor', 'extractJsxRoutes', {
          filePath,
          error: error instanceof Error ? error.message : String(error),
          context: 'jsxRoutes-iteration',
        });
        // Continue with next attribute
      }
    });
  } catch (error) {
    debugError('eventExtractor', 'extractJsxRoutes', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  return Array.from(routes).sort();
}
