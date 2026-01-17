/**
 * NestJS Extractor - Extracts NestJS controllers and API metadata
 */

import { SourceFile, SyntaxKind, Node, Decorator, ClassDeclaration, MethodDeclaration } from 'ts-morph';
import type { ApiSignature } from '../../types/UIFContract.js';
import { debugError } from '../../utils/debug.js';

export interface NestJSRoute {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: string;
  params?: string[];
}

export interface NestJSController {
  name: string;
  basePath?: string;
  routes: NestJSRoute[];
}

/**
 * Extract NestJS controller metadata from source file
 */
export function extractNestJSController(source: SourceFile): NestJSController | undefined {
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    const classes = source.getClasses();
    let controllerClass: ClassDeclaration | undefined;

    // Find class with @Controller decorator
    for (const cls of classes) {
      const decorators = cls.getDecorators();
      for (const decorator of decorators) {
        const name = decorator.getName();
        if (name === 'Controller') {
          controllerClass = cls;
          break;
        }
      }
      if (controllerClass) break;
    }

    if (!controllerClass) {
      return undefined;
    }

    const controllerName = controllerClass.getName() || 'UnknownController';

    // Extract base path from @Controller decorator
    let basePath: string | undefined;
    const controllerDecorator = controllerClass.getDecorators().find(d => d.getName() === 'Controller');
    if (controllerDecorator) {
      const args = controllerDecorator.getArguments();
      if (args.length > 0) {
        const pathArg = args[0];
        if (Node.isStringLiteral(pathArg)) {
          basePath = pathArg.getLiteralValue();
        } else {
          basePath = pathArg.getText().replace(/['"]/g, '');
        }
      }
    }

    // Extract routes from methods
    const routes: NestJSRoute[] = [];
    const methods = controllerClass.getMethods();

    for (const method of methods) {
      const decorators = method.getDecorators();
      const methodName = method.getName();

      for (const decorator of decorators) {
        const decoratorName = decorator.getName().toLowerCase();
        const httpMethods = ['get', 'post', 'put', 'delete', 'patch'];

        if (httpMethods.includes(decoratorName)) {
          // Extract path from decorator
          let path = '';
          const args = decorator.getArguments();
          if (args.length > 0) {
            const pathArg = args[0];
            if (Node.isStringLiteral(pathArg)) {
              path = pathArg.getLiteralValue();
            } else {
              path = pathArg.getText().replace(/['"]/g, '');
            }
          }

          // Extract route parameters
          const params: string[] = [];
          const paramMatches = Array.from(path.matchAll(/:(\w+)/g));
          for (const match of paramMatches) {
            params.push(match[1]);
          }

          routes.push({
            path,
            method: decoratorName.toUpperCase() as NestJSRoute['method'],
            handler: methodName,
            ...(params.length > 0 && { params }),
          });
        }
      }
    }

    return {
      name: controllerName,
      ...(basePath && { basePath }),
      routes,
    };
  } catch (error) {
    debugError('nestjsExtractor', 'extractNestJSController', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Extract API signature from NestJS controller method
 */
export function extractNestJSApiSignature(
  source: SourceFile,
  className: string,
  methodName: string
): ApiSignature | undefined {
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    const classes = source.getClasses();
    const controllerClass = classes.find(c => c.getName() === className);

    if (!controllerClass) {
      return undefined;
    }

    const method = controllerClass.getMethod(methodName);
    if (!method) {
      return undefined;
    }

    const parameters: Record<string, string> = {};
    const params = method.getParameters();

    for (const param of params) {
      const paramName = param.getName();
      let paramType = 'any';

      try {
        const typeNode = param.getTypeNode();
        if (typeNode) {
          paramType = typeNode.getText();
        } else {
          paramType = param.getType().getText();
        }
      } catch {
        // Default to any
      }

      parameters[paramName] = paramType;
    }

    // Try to extract return type
    let returnType: string | undefined;
    try {
      returnType = method.getReturnType().getText();
    } catch {
      // Return type extraction failed
    }

    return {
      ...(Object.keys(parameters).length > 0 && { parameters }),
      ...(returnType && { returnType }),
    };
  } catch (error) {
    debugError('nestjsExtractor', 'extractNestJSApiSignature', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      className,
      methodName,
    });
    return undefined;
  }
}
