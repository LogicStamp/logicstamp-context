/**
 * Prop Extractor - Extracts component props from TypeScript interfaces/types
 */

import { SourceFile, Node, SyntaxKind } from 'ts-morph';
import type { PropType } from '../../../types/UIFContract.js';
import { debugError } from '../../../utils/debug.js';
import { normalizePropType, stripUndefinedFromUnionText } from './propTypeNormalizer.js';
import { hasExportedHooks, extractHookParameters } from './hookParameterExtractor.js';

// TypeScript TypeFlags.Undefined constant (0x4000 = 16384)
// Used for checking if a union type includes undefined
const TYPEFLAG_UNDEFINED = 16384; // ts.TypeFlags.Undefined

/**
 * Extract component props from TypeScript interfaces/types
 * Also extracts hook parameters when the file contains hook definitions
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
                let isOptional = prop.hasQuestionToken();
                let type = prop.getType().getText();
                let didRebuildFromUnion = false;
                
                // Also check for union-with-undefined (some people write foo: string | undefined without ?)
                if (!isOptional) {
                  try {
                    const propType = prop.getType();
                    if (propType.isUnion()) {
                      const unionTypes = propType.getUnionTypes();
                      const hasUndefined = unionTypes.some(ut => {
                        try {
                          const flags = (ut as any).getFlags?.();
                          if (flags && (flags & TYPEFLAG_UNDEFINED) !== 0) {
                            return true;
                          }
                        } catch {
                          // Fallback to string check if flags not available
                        }
                        const text = ut.getText();
                        return text === 'undefined';
                      });
                      
                      if (hasUndefined) {
                        isOptional = true;
                        // Normalize type text by removing undefined from union (handles any position)
                        type = unionTypes
                          .filter(ut => {
                            try {
                              const flags = (ut as any).getFlags?.();
                              if (flags && (flags & TYPEFLAG_UNDEFINED) !== 0) {
                                return false;
                              }
                            } catch {
                              // Fallback to string check
                            }
                            return ut.getText() !== 'undefined';
                          })
                          .map(ut => ut.getText())
                          .join(' | ');
                        didRebuildFromUnion = true;
                      }
                    }
                  } catch {
                    // Fallback if union check fails
                  }
                }
                
                // If optional but we didn't rebuild from union types, strip undefined from type text
                // This handles cases like "foo?: undefined | string" where ? token made us skip union logic
                if (isOptional && !didRebuildFromUnion) {
                  type = stripUndefinedFromUnionText(type);
                }
                
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
                
                // Check if optional using TypeScript's type system
                let isOptional = false;
                let propType = prop.getTypeAtLocation(typeAlias).getText();
                let didRebuildFromUnion = false;

                // Method 1: Check if type is a union that includes undefined
                // Use type flags instead of string matching to avoid false positives
                try {
                  const propTypeObj = prop.getTypeAtLocation(typeAlias);
                  if (propTypeObj.isUnion()) {
                    const unionTypes = propTypeObj.getUnionTypes();
                    const hasUndefined = unionTypes.some(ut => {
                      // Check type flags for undefined (more robust than string matching)
                      try {
                        const flags = (ut as any).getFlags?.();
                        if (flags && (flags & TYPEFLAG_UNDEFINED) !== 0) {
                          return true;
                        }
                      } catch {
                        // Fallback to string check if flags not available
                      }
                      // Fallback: exact string match only (avoid false positives like SomeUndefinedType)
                      const text = ut.getText();
                      return text === 'undefined';
                    });
                    
                    if (hasUndefined) {
                      isOptional = true;
                      // Normalize type text by removing undefined from union (handles any position)
                      // This ensures consistent output: undefined | string and string | undefined both become string
                      propType = unionTypes
                        .filter(ut => {
                          try {
                            const flags = (ut as any).getFlags?.();
                            if (flags && (flags & TYPEFLAG_UNDEFINED) !== 0) {
                              return false;
                            }
                          } catch {
                            // Fallback to string check
                          }
                          return ut.getText() !== 'undefined';
                        })
                        .map(ut => ut.getText())
                        .join(' | ');
                      didRebuildFromUnion = true;
                    }
                  }
                } catch {
                  // Fallback if union check fails
                }

                // Method 2: Check declarations for question token (AST method)
                if (!isOptional) {
                  const declarations = prop.getDeclarations();
                  isOptional = declarations.some((decl) => {
                    // Use AST method to check for question token
                    if (Node.isPropertySignature(decl)) {
                      return decl.hasQuestionToken();
                    }
                    return (decl as any).hasQuestionToken?.() === true;
                  });
                }

                // If optional but we didn't rebuild from union types, strip undefined from type text
                // This handles cases like "foo?: undefined | string" where ? token made us skip union logic
                // Also handles "foo?: string | number" where union exists but doesn't contain undefined
                if (isOptional && !didRebuildFromUnion) {
                  propType = stripUndefinedFromUnionText(propType);
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

    // Always try to extract hook parameters if there are exported hooks
    // This ensures hook parameters are captured even if there's a Props interface
    // Props take priority on conflicts (if a prop exists in both, Props value is kept)
    // Quick check: only extract if there might be exported hooks (performance optimization)
    if (hasExportedHooks(source)) {
      const hookParams = extractHookParameters(source);
      if (Object.keys(hookParams).length > 0) {
        // Merge hook parameters with Props, with Props taking priority on conflicts
        // Save original props to preserve Props values, then merge hookParams, then restore Props
        const originalProps = { ...props };
        Object.assign(props, hookParams);
        Object.assign(props, originalProps); // Props override any conflicting hook parameters
      }
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

// Re-export normalizePropType for backward compatibility
// Previously exported from this file, now implemented in propTypeNormalizer.ts
export { normalizePropType } from './propTypeNormalizer.js';
