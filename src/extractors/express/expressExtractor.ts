/**
 * Express Extractor - Extracts Express.js routes and API metadata
 */

import { SourceFile, SyntaxKind, Node, CallExpression } from 'ts-morph';
import type { ApiSignature } from '../../types/UIFContract.js';
import { debugError } from '../../utils/debug.js';

export interface ExpressRoute {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';
  handler: string;
  params?: string[];
}

/**
 * Extract Express routes from source file
 * Looks for patterns like: app.get('/path', handler), router.post('/path', handler)
 */
export function extractExpressRoutes(source: SourceFile): ExpressRoute[] {
  const routes: ExpressRoute[] = [];
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    // Find all call expressions
    const callExpressions = source.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const callExpr of callExpressions) {
      try {
        const expr = callExpr.getExpression();

        // Check if it's a method call (app.get, router.post, etc.)
        if (Node.isPropertyAccessExpression(expr)) {
          const methodName = expr.getName();
          const objectName = expr.getExpression().getText();

          // Check if it's an HTTP method on app/router
          if ((objectName === 'app' || objectName === 'router') &&
              ['get', 'post', 'put', 'delete', 'patch', 'all'].includes(methodName.toLowerCase())) {
            const args = callExpr.getArguments();

            if (args.length >= 2) {
              // First argument is the path
              const pathArg = args[0];
              let path = '';
              let params: string[] = [];

              if (Node.isStringLiteral(pathArg)) {
                path = pathArg.getLiteralValue();
              } else {
                // Try to get text if not a literal
                path = pathArg.getText().replace(/['"]/g, '');
              }

              // Extract route parameters (e.g., /users/:id -> ['id'])
              const paramMatches = Array.from(path.matchAll(/:(\w+)/g));
              for (const match of paramMatches) {
                params.push(match[1]);
              }

              // Second argument is the handler function
              const handlerArg = args[1];
              let handler = 'anonymous';

              if (Node.isIdentifier(handlerArg)) {
                handler = handlerArg.getText();
              } else if (Node.isArrowFunction(handlerArg) || Node.isFunctionExpression(handlerArg)) {
                // Try to find the function name from variable assignment
                const parent = handlerArg.getParent();
                if (Node.isVariableDeclaration(parent)) {
                  handler = parent.getName();
                } else {
                  handler = 'anonymous';
                }
              }

              routes.push({
                path,
                method: methodName.toUpperCase() as ExpressRoute['method'],
                handler,
                ...(params.length > 0 && { params }),
              });
            }
          }
        }
      } catch (error) {
        debugError('expressExtractor', 'extractExpressRoutes', {
          filePath,
          error: error instanceof Error ? error.message : String(error),
          context: 'route-iteration',
        });
        // Continue with next route
      }
    }
  } catch (error) {
    debugError('expressExtractor', 'extractExpressRoutes', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  return routes;
}

/**
 * Extract API signature from Express route handler function
 */
export function extractExpressApiSignature(
  source: SourceFile,
  handlerName: string
): ApiSignature | undefined {
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    // Find the handler function
    const functions = source.getFunctions();
    let handlerFunc = functions.find(f => f.getName() === handlerName);

    // Also check arrow functions assigned to variables
    if (!handlerFunc) {
      const variables = source.getVariableDeclarations();
      for (const varDecl of variables) {
        if (varDecl.getName() === handlerName) {
          const initializer = varDecl.getInitializer();
          if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
            handlerFunc = initializer as any;
            break;
          }
        }
      }
    }

    if (!handlerFunc) {
      return undefined;
    }

    const parameters: Record<string, string> = {};
    const params = (handlerFunc as any).getParameters?.() || [];

    for (const param of params) {
      const paramName = param.getName();
      let paramType = 'any';

      try {
        const typeNode = param.getTypeNode();
        if (typeNode) {
          paramType = typeNode.getText();
        } else {
          // Try to infer from type checker
          paramType = param.getType().getText();
        }
      } catch {
        // Default to any if type extraction fails
      }

      parameters[paramName] = paramType;
    }

    // Try to extract return type
    let returnType: string | undefined;
    try {
      returnType = (handlerFunc as any).getReturnType?.()?.getText();
    } catch {
      // Return type extraction failed
    }

    return {
      ...(Object.keys(parameters).length > 0 && { parameters }),
      ...(returnType && { returnType }),
    };
  } catch (error) {
    debugError('expressExtractor', 'extractExpressApiSignature', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      handlerName,
    });
    return undefined;
  }
}
