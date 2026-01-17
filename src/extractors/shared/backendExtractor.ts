/**
 * Backend Extractor - Orchestrates backend metadata extraction
 */

import { SourceFile } from 'ts-morph';
import type { ApiSignature, LanguageSpecificVersion } from '../../types/UIFContract.js';
import { debugError } from '../../utils/debug.js';
import { extractExpressRoutes, extractExpressApiSignature } from '../express/expressExtractor.js';
import { extractNestJSController, extractNestJSApiSignature } from '../nest/nestjsExtractor.js';

export interface BackendMetadata {
  framework: 'express' | 'nestjs';
  routes?: Array<{
    path: string;
    method: string;
    handler: string;
    params?: string[];
    apiSignature?: ApiSignature;
  }>;
  controller?: {
    name: string;
    basePath?: string;
  };
  languageSpecific?: LanguageSpecificVersion;
}

/**
 * Extract backend metadata from source file
 */
export function extractBackendMetadata(
  source: SourceFile,
  filePath: string,
  imports: string[],
  framework: 'express' | 'nestjs'
): BackendMetadata | undefined {
  const resolvedPath = source.getFilePath?.() ?? filePath;

  try {
    if (framework === 'express') {
      const routes = extractExpressRoutes(source);

      // Extract API signatures for each route
      const routesWithSignatures = routes.map(route => {
        // Only extract API signature for named handlers (skip anonymous handlers)
        if (route.handler !== 'anonymous') {
          const apiSignature = extractExpressApiSignature(source, route.handler);
          return {
            ...route,
            ...(apiSignature && { apiSignature }),
          };
        }
        return route;
      });

      // Extract decorators/annotations for language-specific metadata
      const languageSpecific: LanguageSpecificVersion = {};
      const sourceText = source.getFullText();

      // Extract decorators (Express doesn't use decorators, but check for patterns)
      // For Express, we might extract middleware usage or other patterns
      const decorators: string[] = [];
      // Express doesn't typically use decorators, but we can extract route patterns
      const routePatterns = Array.from(sourceText.matchAll(/(app|router)\.(get|post|put|delete|patch|all)\(/g));
      for (const match of routePatterns) {
        decorators.push(`@${match[1]}.${match[2]}`);
      }

      return {
        framework: 'express',
        ...(routesWithSignatures.length > 0 && { routes: routesWithSignatures }),
        ...(decorators.length > 0 && { languageSpecific: { decorators } }),
      };
    } else if (framework === 'nestjs') {
      const controller = extractNestJSController(source);

      if (!controller) {
        return undefined;
      }

      // Extract API signatures for each route
      const routesWithSignatures = controller.routes.map(route => {
        const apiSignature = extractNestJSApiSignature(source, controller.name, route.handler);
        return {
          ...route,
          ...(apiSignature && { apiSignature }),
        };
      });

      // Extract annotations (NestJS decorators)
      const annotations: string[] = [];
      const sourceText = source.getFullText();

      // Extract decorator patterns
      const decoratorPatterns = Array.from(sourceText.matchAll(/@(\w+)\(/g));
      for (const match of decoratorPatterns) {
        annotations.push(`@${match[1]}`);
      }

      // Extract class names
      const classes: string[] = [];
      if (controller.name) {
        classes.push(controller.name);
      }

      return {
        framework: 'nestjs',
        routes: routesWithSignatures,
        controller: {
          name: controller.name,
          ...(controller.basePath && { basePath: controller.basePath }),
        },
        languageSpecific: {
          ...(annotations.length > 0 && { annotations }),
          ...(classes.length > 0 && { classes }),
        },
      };
    }

    return undefined;
  } catch (error) {
    debugError('backendExtractor', 'extractBackendMetadata', {
      filePath: resolvedPath,
      error: error instanceof Error ? error.message : String(error),
      framework,
    });
    return undefined;
  }
}

/**
 * Extract API signature for a specific route handler
 */
export function extractBackendApiSignature(
  source: SourceFile,
  framework: 'express' | 'nestjs',
  handlerName: string,
  className?: string
): ApiSignature | undefined {
  try {
    if (framework === 'express') {
      return extractExpressApiSignature(source, handlerName);
    } else if (framework === 'nestjs' && className) {
      return extractNestJSApiSignature(source, className, handlerName);
    }

    return undefined;
  } catch (error) {
    debugError('backendExtractor', 'extractBackendApiSignature', {
      error: error instanceof Error ? error.message : String(error),
      framework,
      handlerName,
      className,
    });
    return undefined;
  }
}
