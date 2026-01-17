/**
 * Detectors - Detect component kind and Next.js metadata
 */

import { SourceFile, SyntaxKind, FunctionDeclaration, VariableStatement, ArrowFunction, ObjectLiteralExpression, PropertyAssignment } from 'ts-morph';
import type { ContractKind, NextJSMetadata } from '../../types/UIFContract.js';
import { debugError } from '../../utils/debug.js';
import { basename, dirname } from 'node:path';

/**
 * Detect Next.js 'use client' or 'use server' directives
 * These directives must appear at the top of the file (before any imports)
 */
export function detectNextJsDirective(source: SourceFile): 'client' | 'server' | undefined {
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    const fullText = source.getFullText();

    // Get the first few lines (directives must be at the top)
    const firstLines = fullText.split('\n').slice(0, 5);

    // Check each line - directive must be at start of line (ignoring whitespace)
    for (const line of firstLines) {
      try {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
          continue;
        }

        // Check for 'use client' directive at start of statement
        if (/^['"]use client['"];?$/.test(trimmed)) {
          return 'client';
        }

        // Check for 'use server' directive at start of statement
        if (/^['"]use server['"];?$/.test(trimmed)) {
          return 'server';
        }

        // If we hit a non-comment, non-directive line, stop looking
        if (trimmed) {
          break;
        }
      } catch (error) {
        debugError('detector', 'detectNextJsDirective', {
          filePath,
          error: error instanceof Error ? error.message : String(error),
          context: 'directive-line',
        });
        // Continue with next line
      }
    }
  } catch (error) {
    debugError('detector', 'detectNextJsDirective', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }

  return undefined;
}

/**
 * Detect if file is in Next.js App Router directory
 * Checks if the file path contains /app/ or \app\ directory
 */
export function isInNextAppDir(filePath: string): boolean {
  // Normalize path separators and check for /app/ directory
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Match /app/ directory (not just any path containing 'app')
  // Must be a directory boundary, not part of another word
  return /\/app\//.test(normalizedPath) || /^app\//.test(normalizedPath);
}

/**
 * Detect Next.js route role based on filename
 * Next.js App Router uses special filenames: page, layout, loading, error, not-found, template, default, route
 */
export function detectNextJsRouteRole(filePath: string): NextJSMetadata['routeRole'] | undefined {
  try {
    const fileName = basename(filePath, '.tsx').replace(/\.ts$/, '');
    
    // Check for special Next.js route files
    if (fileName === 'page') return 'page';
    if (fileName === 'layout') return 'layout';
    if (fileName === 'loading') return 'loading';
    if (fileName === 'error') return 'error';
    if (fileName === 'not-found') return 'not-found';
    if (fileName === 'template') return 'template';
    if (fileName === 'default') return 'default';
    if (fileName === 'route') return 'route';
    
    return undefined;
  } catch (error) {
    debugError('detector', 'detectNextJsRouteRole', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Extract Next.js segment path from file path
 * Converts file structure to route path (e.g., app/blog/[slug]/page.tsx -> /blog/[slug])
 */
export function extractNextJsSegmentPath(filePath: string): string | undefined {
  try {
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    // Find the app directory in the path
    const appDirMatch = normalizedPath.match(/(?:^|\/)(?:src\/)?app(\/.*)$/);
    if (!appDirMatch) {
      return undefined;
    }
    
    const pathAfterApp = appDirMatch[1];
    
    // Remove the filename (page.tsx, layout.tsx, etc.) to get the directory path
    // Handle both /page.tsx and page.tsx formats
    const dirPath = dirname(pathAfterApp);
    
    // Build segment path
    // If dirPath is '.' or '/', it means the file is directly in app/ directory
    let segmentPath = dirPath === '.' || dirPath === '/' ? '' : dirPath;
    
    // Remove route groups (parentheses) from path
    // e.g., (auth)/login -> /login
    segmentPath = segmentPath.replace(/\/\([^)]+\)/g, '');
    
    // Normalize: remove leading/trailing slashes
    segmentPath = segmentPath.replace(/^\/+|\/+$/g, '');
    
    // Return root path or normalized path
    return segmentPath ? `/${segmentPath}` : '/';
  } catch (error) {
    debugError('detector', 'extractNextJsSegmentPath', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Extract Next.js metadata exports
 * Supports both static metadata (export const metadata) and dynamic metadata (export function generateMetadata)
 */
export function extractNextJsMetadataExports(source: SourceFile): NextJSMetadata['metadata'] | undefined {
  const filePath = source.getFilePath?.() ?? 'unknown';
  
  try {
    let staticMetadata: Record<string, unknown> | undefined;
    let hasDynamicMetadata = false;
    
    const statements = source.getStatements();
    
    for (const stmt of statements) {
      const kind = stmt.getKind();
      
      // Check for `export const metadata = {...}`
      if (kind === SyntaxKind.VariableStatement) {
        const varStmt = stmt as VariableStatement;
        const modifiers = varStmt.getModifiers();
        const isExported = modifiers.some(mod => mod.getKind() === SyntaxKind.ExportKeyword);
        
        if (isExported) {
          const declarations = varStmt.getDeclarationList().getDeclarations();
          for (const decl of declarations) {
            const name = decl.getName();
            if (name === 'metadata') {
              const initializer = decl.getInitializer();
              if (initializer && initializer.getKind() === SyntaxKind.ObjectLiteralExpression) {
                // Parse object literal to extract property names and basic values
                try {
                  const objLiteral = initializer.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
                  const properties = objLiteral.getProperties();
                  const metadataObj: Record<string, unknown> = {};
                  
                  for (const prop of properties) {
                    if (prop.getKind() === SyntaxKind.PropertyAssignment) {
                      const propAssignment = prop as PropertyAssignment;
                      const propName = propAssignment.getNameNode();
                      const propValue = propAssignment.getInitializer();
                      
                      if (propName.getKind() === SyntaxKind.Identifier || propName.getKind() === SyntaxKind.StringLiteral) {
                        const name = propName.getKind() === SyntaxKind.Identifier 
                          ? propName.getText() 
                          : (propName as any).getLiteralText?.() ?? propName.getText().slice(1, -1);
                        
                        // Extract basic value types
                        if (propValue) {
                          const valueKind = propValue.getKind();
                          if (valueKind === SyntaxKind.StringLiteral) {
                            metadataObj[name] = (propValue as any).getLiteralText?.() ?? propValue.getText().slice(1, -1);
                          } else if (valueKind === SyntaxKind.NumericLiteral) {
                            metadataObj[name] = parseFloat(propValue.getText());
                          } else if (valueKind === SyntaxKind.TrueKeyword || valueKind === SyntaxKind.FalseKeyword) {
                            metadataObj[name] = valueKind === SyntaxKind.TrueKeyword;
                          } else if (valueKind === SyntaxKind.NullKeyword) {
                            metadataObj[name] = null;
                          } else {
                            // For complex values, store the type indicator
                            metadataObj[name] = `[${valueKind}]`;
                          }
                        }
                      }
                    }
                  }
                  
                  if (Object.keys(metadataObj).length > 0) {
                    staticMetadata = metadataObj;
                  } else {
                    // Even if empty, mark as having metadata
                    staticMetadata = { _hasMetadata: true };
                  }
                } catch (error) {
                  // If we can't parse, still mark as having metadata
                  staticMetadata = { _hasMetadata: true };
                }
              } else if (initializer) {
                // Has metadata but not an object literal (could be a variable reference, function call, etc.)
                staticMetadata = { _hasMetadata: true };
              }
            }
          }
        }
      }
      
      // Check for `export function generateMetadata(...) {...}`
      if (kind === SyntaxKind.FunctionDeclaration) {
        const func = stmt as FunctionDeclaration;
        const modifiers = func.getModifiers();
        const isExported = modifiers.some(mod => mod.getKind() === SyntaxKind.ExportKeyword);
        const name = func.getName();
        
        if (isExported && name === 'generateMetadata') {
          hasDynamicMetadata = true;
        }
      }
    }
    
    if (staticMetadata || hasDynamicMetadata) {
      return {
        ...(staticMetadata && { static: staticMetadata }),
        ...(hasDynamicMetadata && { dynamic: true })
      };
    }
    
    return undefined;
  } catch (error) {
    debugError('detector', 'extractNextJsMetadataExports', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Extract Next.js metadata from the file
 */
export function extractNextJsMetadata(source: SourceFile, filePath: string): NextJSMetadata | undefined {
  const resolvedPath = source.getFilePath?.() ?? filePath;

  try {
    const directive = detectNextJsDirective(source);
    const isInApp = isInNextAppDir(filePath);
    const routeRole = isInApp ? detectNextJsRouteRole(filePath) : undefined;
    const segmentPath = isInApp ? extractNextJsSegmentPath(filePath) : undefined;
    const metadata = isInApp ? extractNextJsMetadataExports(source) : undefined;

    // Only return metadata if we have something to report
    if (directive || isInApp || routeRole || segmentPath || metadata) {
      return {
        ...(isInApp && { isInAppDir: true }),
        ...(directive && { directive }),
        ...(routeRole && { routeRole }),
        ...(segmentPath && { segmentPath }),
        ...(metadata && { metadata })
      };
    }
  } catch (error) {
    debugError('detector', 'extractNextJsMetadata', {
      filePath: resolvedPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }

  return undefined;
}

/**
 * Check if the main export is a Vue composable function (starts with "use")
 */
function isMainExportAVueComposable(source: SourceFile, imports: string[]): boolean {
  // Must have Vue imports
  const hasVueImport = imports.some(imp => imp === 'vue' || imp.startsWith('vue/'));
  if (!hasVueImport) return false;

  try {
    const statements = source.getStatements();

    for (const stmt of statements) {
      const kind = stmt.getKind();
      const modifiers = (stmt as any).getModifiers?.() || [];

      let hasExport = false;
      let isDefault = false;

      for (const mod of modifiers) {
        const modKind = mod.getKind();
        if (modKind === SyntaxKind.ExportKeyword) hasExport = true;
        if (modKind === SyntaxKind.DefaultKeyword) isDefault = true;
      }

      // Check default export first (highest priority)
      if (isDefault && hasExport) {
        if (kind === SyntaxKind.FunctionDeclaration) {
          const func = stmt as FunctionDeclaration;
          const name = func.getName();
          if (name && /^use[A-Z]/.test(name)) {
            return true;
          }
        } else if (kind === SyntaxKind.VariableStatement) {
          const varStmt = stmt as VariableStatement;
          const declarations = varStmt.getDeclarationList().getDeclarations();
          for (const decl of declarations) {
            const name = decl.getName();
            const initializer = decl.getInitializer();
            if (name && /^use[A-Z]/.test(name)) {
              if (initializer && (
                initializer.getKind() === SyntaxKind.ArrowFunction ||
                initializer.getKind() === SyntaxKind.FunctionExpression
              )) {
                return true;
              }
            }
          }
        }
      }

      // Check named exports
      if (hasExport && !isDefault) {
        if (kind === SyntaxKind.FunctionDeclaration) {
          const func = stmt as FunctionDeclaration;
          const name = func.getName();
          if (name && /^use[A-Z]/.test(name)) {
            return true;
          }
        } else if (kind === SyntaxKind.VariableStatement) {
          const varStmt = stmt as VariableStatement;
          const declarations = varStmt.getDeclarationList().getDeclarations();
          for (const decl of declarations) {
            const name = decl.getName();
            const initializer = decl.getInitializer();
            if (name && /^use[A-Z]/.test(name)) {
              if (initializer && (
                initializer.getKind() === SyntaxKind.ArrowFunction ||
                initializer.getKind() === SyntaxKind.FunctionExpression
              )) {
                return true;
              }
            }
          }
        }
      }
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Check if file has Vue composables (ref, reactive, etc.)
 */
function hasVueComposables(source: SourceFile): boolean {
  try {
    const sourceText = source.getFullText();

    // Check for common Vue composables
    const vueComposablePatterns = [
      /\bref\s*\(/,
      /\breactive\s*\(/,
      /\bcomputed\s*\(/,
      /\bwatch\s*\(/,
      /\bwatchEffect\s*\(/,
      /\bonMounted\s*\(/,
      /\bonUnmounted\s*\(/,
      /\bdefineProps\s*[(<]/,
      /\bdefineEmits\s*[(<]/,
    ];

    return vueComposablePatterns.some(pattern => pattern.test(sourceText));
  } catch (error) {
    return false;
  }
}

/**
 * Check if file has Vue component registration
 */
function hasVueComponentRegistration(source: SourceFile): boolean {
  try {
    const sourceText = source.getFullText();

    // Check for defineComponent, component registration, or SFC script setup
    return /defineComponent\s*\(/.test(sourceText) ||
           /components\s*:\s*\{/.test(sourceText) ||
           /<script\s+setup/.test(sourceText);
  } catch (error) {
    return false;
  }
}

/**
 * Check if the main export is a hook function (starts with "use")
 */
function isMainExportAHook(source: SourceFile): boolean {
  try {
    const statements = source.getStatements();
    
    for (const stmt of statements) {
      const kind = stmt.getKind();
      const modifiers = (stmt as any).getModifiers?.() || [];
      
      let hasExport = false;
      let isDefault = false;
      
      for (const mod of modifiers) {
        const modKind = mod.getKind();
        if (modKind === SyntaxKind.ExportKeyword) hasExport = true;
        if (modKind === SyntaxKind.DefaultKeyword) isDefault = true;
      }
      
      // Check default export first (highest priority)
      if (isDefault && hasExport) {
        if (kind === SyntaxKind.FunctionDeclaration) {
          const func = stmt as FunctionDeclaration;
          const name = func.getName();
          if (name && /^use[A-Z]/.test(name)) {
            return true;
          }
        } else if (kind === SyntaxKind.VariableStatement) {
          const varStmt = stmt as VariableStatement;
          const declarations = varStmt.getDeclarationList().getDeclarations();
          for (const decl of declarations) {
            const name = decl.getName();
            const initializer = decl.getInitializer();
            // Check if it's an arrow function or function expression
            if (name && /^use[A-Z]/.test(name)) {
              if (initializer && (
                initializer.getKind() === SyntaxKind.ArrowFunction ||
                initializer.getKind() === SyntaxKind.FunctionExpression
              )) {
                return true;
              }
            }
          }
        }
      }
      
      // Check named exports (if no default export found)
      if (hasExport && !isDefault) {
        if (kind === SyntaxKind.FunctionDeclaration) {
          const func = stmt as FunctionDeclaration;
          const name = func.getName();
          if (name && /^use[A-Z]/.test(name)) {
            return true;
          }
        } else if (kind === SyntaxKind.VariableStatement) {
          const varStmt = stmt as VariableStatement;
          const declarations = varStmt.getDeclarationList().getDeclarations();
          for (const decl of declarations) {
            const name = decl.getName();
            const initializer = decl.getInitializer();
            // Check if it's an arrow function or function expression
            if (name && /^use[A-Z]/.test(name)) {
              if (initializer && (
                initializer.getKind() === SyntaxKind.ArrowFunction ||
                initializer.getKind() === SyntaxKind.FunctionExpression
              )) {
                return true;
              }
            }
          }
        }
      }
    }
    
    return false;
  } catch (error) {
    // If we can't determine, return false (fall back to other checks)
    return false;
  }
}

/**
 * Detect component kind based on its characteristics
 */
export function detectKind(
  hooks: string[],
  components: string[],
  imports: string[],
  source: SourceFile,
  filePath: string,
  backendFramework?: 'express' | 'nestjs'
): ContractKind {
  const resolvedPath = source.getFilePath?.() ?? filePath;

  try {
    // Backend detection (check before Vue/React)
    if (backendFramework) {
      return 'node:api';
    }

    // Vue detection (highest priority after hooks)
    const hasVueImport = imports.some(imp => imp === 'vue' || imp.startsWith('vue/'));

    if (hasVueImport) {
      // Check if main export is a Vue composable
      const mainExportIsVueComposable = isMainExportAVueComposable(source, imports);

      if (mainExportIsVueComposable && components.length === 0) {
        // Double-check: no JSX elements in the file
        try {
          const hasJsxElements = source.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 ||
                              source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0 ||
                              source.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0;
          if (!hasJsxElements) {
            return 'vue:composable';
          }
        } catch (error) {
          // If JSX check fails, still classify as composable if main export is composable
          return 'vue:composable';
        }
      }

      // Check for Vue component patterns
      if (hasVueComposables(source) || hasVueComponentRegistration(source) || components.length > 0) {
        return 'vue:component';
      }
    }

    // Check if main export is a hook BEFORE checking for components
    // This ensures hook files are classified correctly even if they use hooks internally
    const mainExportIsHook = isMainExportAHook(source);

    // If main export is a hook and file has no JSX/components, it's a hook file
    if (mainExportIsHook && components.length === 0) {
      // Double-check: no JSX elements in the file
      try {
        const hasJsxElements = source.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 ||
                            source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0 ||
                            source.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0;
        if (!hasJsxElements) {
          return 'react:hook';
        }
      } catch (error) {
        // If JSX check fails, still classify as hook if main export is hook
        return 'react:hook';
      }
    }
    
    // React component: has hooks or JSX components
    if (hooks.length > 0 || components.length > 0) {
      return 'react:component';
    }

    // Check for React imports
    const hasReactImport = imports.some(imp => imp === 'react' || imp.startsWith('react/'));

    if (hasReactImport) {
      try {
        const sourceText = source.getFullText();

        // Check for any JSX usage (including lowercase HTML elements)
        let hasJsxElements = false;
        try {
          hasJsxElements = source.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 ||
                          source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0 ||
                          source.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0;
        } catch (error) {
          debugError('detector', 'detectKind', {
            filePath: resolvedPath,
            error: error instanceof Error ? error.message : String(error),
            context: 'kind-jsx-traversal',
          });
          // Continue with other checks
        }

        if (hasJsxElements) {
          return 'react:component';
        }

        // Check for React.createElement usage
        if (/React\.createElement/.test(sourceText)) {
          return 'react:component';
        }

        // Check for React component type annotations
        // Look for React.FC, React.FunctionComponent, or return type JSX.Element
        if (/React\.(FC|FunctionComponent|ReactElement)|:\s*JSX\.Element/.test(sourceText)) {
          return 'react:component';
        }
      } catch (error) {
        debugError('detector', 'detectKind', {
          filePath: resolvedPath,
          error: error instanceof Error ? error.message : String(error),
          context: 'kind-react-check',
        });
        // Continue with other checks
      }
    }

    // Node CLI: check for CLI-specific patterns
    // 1. File is in a /cli/ directory, OR
    // 2. File uses process.argv (CLI argument parsing)
    const isInCliDir = /[/\\]cli[/\\]/.test(filePath);
    try {
      const sourceText = source.getFullText();
      const usesProcessArgv = /process\.argv/.test(sourceText);

      if (isInCliDir || usesProcessArgv) {
        return 'node:cli';
      }
    } catch (error) {
      debugError('detector', 'detectKind', {
        filePath: resolvedPath,
        error: error instanceof Error ? error.message : String(error),
        context: 'kind-cli-check',
      });
      // If CLI check fails, continue to default
    }
  } catch (error) {
    debugError('detector', 'detectKind', {
      filePath: resolvedPath,
      error: error instanceof Error ? error.message : String(error),
    });
    // Default fallback on any error
    return 'ts:module';
  }

  // Default: TypeScript module (even if it imports from node:)
  return 'ts:module';
}

/**
 * Detect backend framework from imports and source code patterns
 * Returns framework name if detected, undefined otherwise
 */
export function detectBackendFramework(
  imports: string[],
  source: SourceFile
): 'express' | 'nestjs' | undefined {
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    const sourceText = source.getFullText();

    // Express.js detection
    if (imports.some(imp => imp === 'express' || imp.startsWith('express/'))) {
      // Additional check: look for app/router usage
      if (/app\.(get|post|put|delete|patch|all)\(/i.test(sourceText) ||
          /router\.(get|post|put|delete|patch|all)\(/i.test(sourceText)) {
        return 'express';
      }
    }

    // NestJS detection
    if (imports.some(imp => imp.includes('@nestjs'))) {
      if (/@Controller\(/i.test(sourceText) ||
          /@Get\(|@Post\(|@Put\(|@Delete\(|@Patch\(/i.test(sourceText)) {
        return 'nestjs';
      }
    }

    return undefined;
  } catch (error) {
    debugError('detector', 'detectBackendFramework', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
