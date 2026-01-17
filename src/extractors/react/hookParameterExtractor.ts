/**
 * Hook Parameter Extractor - Extracts parameters from exported hook functions
 */

import { SourceFile, Node, SyntaxKind, ArrowFunction, FunctionExpression } from 'ts-morph';
import type { PropType } from '../../types/UIFContract.js';
import { debugError } from '../../utils/debug.js';
import { normalizePropType } from '../shared/propTypeNormalizer.js';

/**
 * Check if file has any exported hooks using AST traversal
 * Handles all export forms: direct exports, export declarations, default exports
 * 
 * @internal Primarily used internally by propExtractor. Exported for advanced use cases.
 */
export function hasExportedHooks(source: SourceFile): boolean {
  try {
    // Check function declarations (export function useX, export default function useX)
    const functions = source.getFunctions();
    for (const func of functions) {
      try {
        const name = func.getName();
        if (name && /^use[A-Z]/.test(name)) {
          const modifiers = func.getModifiers();
          const isExported = modifiers.some(mod => 
            mod.getKind() === SyntaxKind.ExportKeyword || 
            mod.getKind() === SyntaxKind.DefaultKeyword
          );
          if (isExported) {
            return true;
          }
        }
      } catch {
        // Continue checking other functions
      }
    }
    
    // Check variable declarations (export const useX = ...)
    const variableStatements = source.getVariableStatements();
    for (const varStmt of variableStatements) {
      try {
        const modifiers = varStmt.getModifiers();
        const isExported = modifiers.some(mod => 
          mod.getKind() === SyntaxKind.ExportKeyword || 
          mod.getKind() === SyntaxKind.DefaultKeyword
        );
        if (isExported) {
          const declarations = varStmt.getDeclarationList().getDeclarations();
          for (const decl of declarations) {
            const name = decl.getName();
            if (name && /^use[A-Z]/.test(name)) {
              return true;
            }
          }
        }
      } catch {
        // Continue checking other statements
      }
    }

    // Check export declarations (export { useX }, export { useX as useY })
    // For export { useThing as useOther }, check both local and exported names
    const exportDeclarations = source.getExportDeclarations();
    for (const exportDecl of exportDeclarations) {
      try {
        // Skip re-exports (export { useX } from "./x") - params can't be extracted anyway
        // Use getModuleSpecifierValue() for unambiguous check (returns string or undefined)
        if ((exportDecl as any).getModuleSpecifierValue?.()) {
          continue;
        }
        const namedExports = exportDecl.getNamedExports();
        for (const namedExport of namedExports) {
          const exportedName = namedExport.getName(); // Name after 'as' (or original if no alias)
          const localName = namedExport.getAliasNode()?.getText(); // Name before 'as' (if aliased)
          // Check if either local or exported name matches hook pattern
          if ((exportedName && /^use[A-Z]/.test(exportedName)) ||
              (localName && /^use[A-Z]/.test(localName))) {
            return true;
          }
        }
      } catch {
        // Continue checking other export declarations
      }
    }

    // Check default export assignments (export default useX)
    const exportAssignments = source.getExportAssignments();
    for (const exportAssign of exportAssignments) {
      try {
        if (exportAssign.isExportEquals()) {
          // export = useX (not common, but handle it)
          const expression = exportAssign.getExpression();
          if (Node.isIdentifier(expression)) {
            const name = expression.getText();
            if (/^use[A-Z]/.test(name)) {
              return true;
            }
          }
        } else {
          // export default useX
          const expression = exportAssign.getExpression();
          if (Node.isIdentifier(expression)) {
            const name = expression.getText();
            if (/^use[A-Z]/.test(name)) {
              return true;
            }
          }
        }
      } catch {
        // Continue checking other export assignments
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Infer parameter type from its type node or default value
 */
function inferParamType(param: any): string {
  try {
    const typeNode = param.getTypeNode();
    if (typeNode) {
      return typeNode.getText();
    }
    
    // Infer type from default value if no explicit type
    const hasDefault = param.hasInitializer();
    if (hasDefault) {
      const initializer = param.getInitializer();
      if (initializer) {
        const initKind = initializer.getKind();
        if (initKind === SyntaxKind.StringLiteral) {
          return 'string';
        } else if (initKind === SyntaxKind.NumericLiteral) {
          return 'number';
        } else if (initKind === SyntaxKind.TrueKeyword || initKind === SyntaxKind.FalseKeyword) {
          return 'boolean';
        } else if (initKind === SyntaxKind.NullKeyword) {
          return 'null';
        } else if (initKind === SyntaxKind.ObjectLiteralExpression) {
          // default {} -> use inferred type or fallback to 'object'
          try {
            const inferredType = initializer.getType().getText();
            return inferredType === '{}' ? 'object' : inferredType;
          } catch {
            return 'object';
          }
        } else if (initKind === SyntaxKind.ArrayLiteralExpression) {
          // default [] -> any[] or inferred array type
          try {
            const inferredType = initializer.getType().getText();
            return inferredType || 'any[]';
          } catch {
            return 'any[]';
          }
        } else {
          // Try to get type from the initializer
          try {
            return initializer.getType().getText();
          } catch {
            return 'unknown';
          }
        }
      }
      return 'unknown';
    }
    
    // Try to get type from TypeScript's type checker
    try {
      return param.getType().getText();
    } catch {
      return 'unknown';
    }
  } catch (error) {
    // Fallback: try to get type from TypeScript's type checker
    try {
      return param.getType().getText();
    } catch {
      return 'unknown';
    }
  }
}

/**
 * Determine if a parameter is optional (has ? token or default value, but not rest params)
 */
function inferParamOptional(param: any): boolean {
  const isOptional = param.hasQuestionToken();
  const isRest = param.isRestParameter();
  const hasDefault = param.hasInitializer();
  // Rest params are variadic, not optional in the same sense
  return (isOptional || hasDefault) && !isRest;
}

/**
 * Check if a function/variable is exported (including via export declarations)
 */
function isExported(source: SourceFile, name: string): boolean {
  try {
    // Check for direct export modifiers
    const functions = source.getFunctions();
    for (const func of functions) {
      if (func.getName() === name) {
        const modifiers = func.getModifiers();
        if (modifiers.some(mod => 
          mod.getKind() === SyntaxKind.ExportKeyword || 
          mod.getKind() === SyntaxKind.DefaultKeyword
        )) {
          return true;
        }
      }
    }

    // Check variable declarations
    const variableStatements = source.getVariableStatements();
    for (const varStmt of variableStatements) {
      const modifiers = varStmt.getModifiers();
      const hasExportModifier = modifiers.some(mod => 
        mod.getKind() === SyntaxKind.ExportKeyword || 
        mod.getKind() === SyntaxKind.DefaultKeyword
      );
      if (hasExportModifier) {
        const declarations = varStmt.getDeclarationList().getDeclarations();
        for (const decl of declarations) {
          if (decl.getName() === name) {
            return true;
          }
        }
      }
    }

    // Check export declarations (export { useX }, export { useX as useY })
    // For export { useThing as useOther }:
    // - getName() returns exported name (useOther)
    // - getAliasNode()?.getText() returns local name (useThing)
    // We need to check both to match correctly
    const exportDeclarations = source.getExportDeclarations();
    for (const exportDecl of exportDeclarations) {
      // Skip re-exports (export { useX } from "./x") - can't extract params anyway
      // Use getModuleSpecifierValue() for unambiguous check (returns string or undefined)
      if ((exportDecl as any).getModuleSpecifierValue?.()) {
        continue;
      }
      const namedExports = exportDecl.getNamedExports();
      for (const namedExport of namedExports) {
        const exportedName = namedExport.getName(); // Name after 'as' (or original if no alias)
        const localName = namedExport.getAliasNode()?.getText(); // Name before 'as' (if aliased)
        // Check both local and exported names
        if (exportedName === name || (localName && localName === name)) {
          return true;
        }
      }
    }

    // Check default export assignments (export default useX)
    const exportAssignments = source.getExportAssignments();
    for (const exportAssign of exportAssignments) {
      if (!exportAssign.isExportEquals()) {
        const expression = exportAssign.getExpression();
        if (Node.isIdentifier(expression) && expression.getText() === name) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Extract parameters from hook function definitions (functions starting with "use")
 * Returns parameters as props for hook files
 * 
 * @internal Primarily used internally by propExtractor. Exported for advanced use cases.
 */
export function extractHookParameters(source: SourceFile): Record<string, PropType> {
  const params: Record<string, PropType> = {};
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    // Look for exported function declarations starting with "use"
    try {
      source.getFunctions().forEach((func) => {
        try {
          const name = func.getName();
          if (name && /^use[A-Z]/.test(name)) {
            // Check if it's exported (including via export declarations)
            const isExportedHook = isExported(source, name);

            // Extract parameters from exported hooks
            if (isExportedHook) {
              func.getParameters().forEach((param) => {
                try {
                  const paramName = param.getName();
                  const typeText = inferParamType(param);
                  const isParamOptional = inferParamOptional(param);
                  params[paramName] = normalizePropType(typeText, isParamOptional);
                } catch (error) {
                  debugError('hookParameterExtractor', 'extractHookParameters', {
                    filePath,
                    error: error instanceof Error ? error.message : String(error),
                    context: 'hook-parameter',
                  });
                  // Continue with next parameter
                }
              });
            }
          }
        } catch (error) {
          debugError('hookParameterExtractor', 'extractHookParameters', {
            filePath,
            error: error instanceof Error ? error.message : String(error),
            context: 'hook-function',
          });
          // Continue with next function
        }
      });
    } catch (error) {
      debugError('hookParameterExtractor', 'extractHookParameters', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        context: 'hook-functions-batch',
      });
    }

    // Look for exported arrow functions assigned to variables starting with "use"
    try {
      source.getVariableDeclarations().forEach((varDecl) => {
        try {
          const name = varDecl.getName();
          if (name && /^use[A-Z]/.test(name)) {
            const initializer = varDecl.getInitializer();
            
            // Check if it's an arrow function or function expression
            if (initializer && (
              Node.isArrowFunction(initializer) || 
              Node.isFunctionExpression(initializer)
            )) {
              // Check if variable is exported (including via export declarations)
              const isExportedHook = isExported(source, name);

              if (isExportedHook) {
                const func = initializer as ArrowFunction | FunctionExpression;
                func.getParameters().forEach((param) => {
                  try {
                    const paramName = param.getName();
                    const typeText = inferParamType(param);
                    const isParamOptional = inferParamOptional(param);
                    params[paramName] = normalizePropType(typeText, isParamOptional);
                  } catch (error) {
                    debugError('hookParameterExtractor', 'extractHookParameters', {
                      filePath,
                      error: error instanceof Error ? error.message : String(error),
                      context: 'hook-arrow-parameter',
                    });
                    // Continue with next parameter
                  }
                });
              }
            }
          }
        } catch (error) {
          debugError('hookParameterExtractor', 'extractHookParameters', {
            filePath,
            error: error instanceof Error ? error.message : String(error),
            context: 'hook-variable',
          });
          // Continue with next variable
        }
      });
    } catch (error) {
      debugError('hookParameterExtractor', 'extractHookParameters', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        context: 'hook-variables-batch',
      });
    }
  } catch (error) {
    debugError('hookParameterExtractor', 'extractHookParameters', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }

  return params;
}
