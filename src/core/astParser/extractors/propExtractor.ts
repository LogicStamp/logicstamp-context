/**
 * Prop Extractor - Extracts component props from TypeScript interfaces/types
 */

import { SourceFile, Node } from 'ts-morph';
import type { PropType } from '../../../types/UIFContract.js';
import { debugError } from '../../../utils/debug.js';

/**
 * Extract component props from TypeScript interfaces/types
 */
export function extractProps(source: SourceFile): Record<string, PropType> {
  const props: Record<string, PropType> = {};
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    // Look for interfaces ending with Props
    try {
      source.getInterfaces().forEach((iface) => {
        try {
          if (/Props$/i.test(iface.getName())) {
            iface.getProperties().forEach((prop) => {
              try {
                const name = prop.getName();
                const isOptional = prop.hasQuestionToken();
                const type = prop.getType().getText();

                props[name] = normalizePropType(type, isOptional);
              } catch (error) {
                debugError('propExtractor', 'extractProps', {
                  filePath,
                  error: error instanceof Error ? error.message : String(error),
                  context: 'props-interface-property',
                });
                // Continue with next property
              }
            });
          }
        } catch (error) {
          debugError('propExtractor', 'extractProps', {
            filePath,
            error: error instanceof Error ? error.message : String(error),
            context: 'props-interface',
          });
          // Continue with next interface
        }
      });
    } catch (error) {
      debugError('propExtractor', 'extractProps', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        context: 'props-interfaces-batch',
      });
    }

    // Look for type aliases ending with Props
    try {
      source.getTypeAliases().forEach((typeAlias) => {
        try {
          if (/Props$/i.test(typeAlias.getName())) {
            const type = typeAlias.getType();
            const properties = type.getProperties();

            properties.forEach((prop) => {
              try {
                const name = prop.getName();
                const propType = prop.getTypeAtLocation(typeAlias).getText();
                
                // Check if optional using fast methods
                let isOptional = false;

                // Method 1: If type includes undefined in union, it's optional
                if (propType.includes('undefined')) {
                  isOptional = true;
                } else {
                  // Method 2: Check declarations for question token (faster than getText())
                  const declarations = prop.getDeclarations();
                  isOptional = declarations.some((decl) => {
                    // Use AST method to check for question token (faster than text parsing)
                    return (decl as any).hasQuestionToken?.() === true;
                  });
                }

                props[name] = normalizePropType(propType, isOptional);
              } catch (error) {
                debugError('propExtractor', 'extractProps', {
                  filePath,
                  error: error instanceof Error ? error.message : String(error),
                  context: 'props-typealias-property',
                });
                // Continue with next property
              }
            });
          }
        } catch (error) {
          debugError('propExtractor', 'extractProps', {
            filePath,
            error: error instanceof Error ? error.message : String(error),
            context: 'props-typealias',
          });
          // Continue with next type alias
        }
      });
    } catch (error) {
      debugError('propExtractor', 'extractProps', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        context: 'props-typealiases-batch',
      });
    }
  } catch (error) {
    debugError('propExtractor', 'extractProps', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }

  return props;
}

/**
 * Normalize a prop type into the rich PropType format
 */
export function normalizePropType(typeText: string, isOptional: boolean): PropType {
  try {
    // Remove 'undefined' from unions if present
    const cleanType = typeText.replace(/\s*\|\s*undefined/g, '').trim();

    // Detect literal unions: "a" | "b" | "c"
    const literalUnionMatch = cleanType.match(/^("[\w-]+"(\s*\|\s*"[\w-]+")+)$/);
    if (literalUnionMatch) {
      const literals = cleanType
        .split('|')
        .map(t => t.trim().replace(/^"|"$/g, ''));

      return {
        type: 'literal-union',
        literals,
        ...(isOptional && { optional: true })
      };
    }

    // Detect function types: () => void, (x: string) => void
    if (cleanType.includes('=>') || cleanType.startsWith('(') && cleanType.includes(')')) {
      return {
        type: 'function',
        signature: cleanType,
        ...(isOptional && { optional: true })
      };
    }

    // Simple type with optionality
    if (isOptional) {
      // For all optional types, return object with optional flag to preserve the optional information
      return {
        type: cleanType,
        optional: true
      };
    }

    // Return simple string for common types (backward compat)
    return cleanType;
  } catch (error) {
    // Fallback to simple string type on error
    debugError('propExtractor', 'normalizePropType', {
      error: error instanceof Error ? error.message : String(error),
      typeText,
    });
    return typeText;
  }
}

