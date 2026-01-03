/**
 * Detectors - Detect component kind and Next.js metadata
 */

import { SourceFile, SyntaxKind, FunctionDeclaration, VariableStatement, ArrowFunction } from 'ts-morph';
import type { ContractKind, NextJSMetadata } from '../../types/UIFContract.js';
import { debugError } from '../../utils/debug.js';

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
 * Extract Next.js metadata from the file
 */
export function extractNextJsMetadata(source: SourceFile, filePath: string): NextJSMetadata | undefined {
  const resolvedPath = source.getFilePath?.() ?? filePath;

  try {
    const directive = detectNextJsDirective(source);
    const isInApp = isInNextAppDir(filePath);

    // Only return metadata if we have something to report
    if (directive || isInApp) {
      return {
        ...(isInApp && { isInAppDir: true }),
        ...(directive && { directive })
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
  filePath: string,
  source: SourceFile
): ContractKind {
  const resolvedPath = source.getFilePath?.() ?? filePath;

  try {
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

