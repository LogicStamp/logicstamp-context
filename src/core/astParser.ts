/**
 * @uif Contract 0.3
 *
 * Description: astParser - Presentational component
 *
 * Version (Component Composition):
 *   variables: []
 *   hooks: []
 *   components: []
 *   functions: ["buildLogicSignatureFromAst","detectKind","extractComponents","extractEvents","extractFromFile","extractFunctions","extractHooks","extractImports","extractJsxRoutes","extractProps","extractState","extractVariables","normalizePropType"]
 *   imports: ["../types/UIFContract.js","ts-morph"]
 *
 * Logic Signature:
 *   props: {}
 *   emits: {}
 *   state: {}
 *
 * Predictions:
 *   (none)
 *
 * Hashes (informational only - authoritative values in .uif.json):
 *   semantic: uif:7152990a34f9eda63e745359 (informational)
 *   file: uif:d25bdbc8e21386b1a5e907d7
 */

/**
 * AST Parser - Extracts structural information from TypeScript/React files
 * Uses ts-morph for robust AST traversal
 */

import { Project, SyntaxKind, SourceFile, Node, FunctionDeclaration, ClassDeclaration, VariableStatement, ExportDeclaration } from 'ts-morph';
import type { LogicSignature, ContractKind, PropType, EventType, NextJSMetadata, ExportMetadata } from '../types/UIFContract.js';
import { debugError } from '../utils/debug.js';
import { extractComponents, extractHooks } from './astParser/extractors/componentExtractor.js';
import { extractProps } from './astParser/extractors/propExtractor.js';
import { extractState, extractVariables } from './astParser/extractors/stateExtractor.js';
import { extractEvents, extractJsxRoutes } from './astParser/extractors/eventExtractor.js';
import { detectKind, extractNextJsMetadata } from './astParser/detectors.js';
import {
  extractVueComposables,
  extractVueComponents,
  extractVueState,
  extractVuePropsCall,
  extractVueEmitsCall,
  extractVueProps,
  extractVueEmits
} from './astParser/extractors/vueComponentExtractor.js';

export interface AstExtract {
  kind: ContractKind;
  variables: string[];
  hooks: string[];
  components: string[];
  functions: string[];
  props: Record<string, PropType>;
  state: Record<string, string>;
  emits: Record<string, EventType>;
  imports: string[];
  jsxRoutes: string[];
  nextjs?: NextJSMetadata;
  exports?: ExportMetadata;
  exportedFunctions?: string[];
}

/**
 * Safe extraction wrapper that catches errors and logs them
 */
function safeExtract<T>(
  label: string,
  filePath: string,
  extractor: () => T,
  fallback: T
): T {
  try {
    return extractor();
  } catch (error) {
    debugError('astParser', 'safeExtract', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      context: label,
    });
    return fallback;
  }
}

/**
 * Extract all structural information from a TypeScript/React file
 * Returns empty AST on parsing errors to prevent crashes
 */
export async function extractFromFile(filePath: string): Promise<AstExtract> {
  try {
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        jsx: 1, // React JSX
        target: 99, // ESNext
      },
    });

    const source = project.addSourceFileAtPath(filePath);
    const resolvedPath = source.getFilePath?.() ?? filePath;

    // Extract basic data first - wrap each extraction in try-catch for resilience
    const imports = safeExtract('imports', resolvedPath, () => extractImports(source), []);

    // Check if this is a Vue file
    const hasVueImport = imports.some(imp => imp === 'vue' || imp.startsWith('vue/'));

    // Extract hooks and components (use Vue extractors if Vue file, otherwise React)
    let hooks: string[];
    let components: string[];
    let state: Record<string, string>;
    let props: Record<string, PropType>;
    let emits: Record<string, EventType>;

    if (hasVueImport) {
      hooks = safeExtract('vue-composables', resolvedPath, () => extractVueComposables(source), []);
      components = safeExtract('vue-components', resolvedPath, () => extractVueComponents(source), []);
      state = safeExtract('vue-state', resolvedPath, () => extractVueState(source), {});
      props = safeExtract('vue-props', resolvedPath, () => extractVueProps(source), {});
      emits = safeExtract('vue-emits', resolvedPath, () => extractVueEmits(source), {});
    } else {
      hooks = safeExtract('hooks', resolvedPath, () => extractHooks(source), []);
      components = safeExtract('components', resolvedPath, () => extractComponents(source), []);
      state = safeExtract('state', resolvedPath, () => extractState(source), {});
      props = safeExtract('props', resolvedPath, () => extractProps(source), {});
      // Pass props to extractEvents to filter out internal handlers
      emits = safeExtract('events', resolvedPath, () => extractEvents(source, props), {});
    }

    const nextjs = safeExtract('nextjs', resolvedPath, () => extractNextJsMetadata(source, filePath), undefined);
    const variables = safeExtract('variables', resolvedPath, () => extractVariables(source), []);
    const functions = safeExtract('functions', resolvedPath, () => extractFunctions(source), []);
    const jsxRoutes = safeExtract('jsxRoutes', resolvedPath, () => extractJsxRoutes(source), []);
    const kind = safeExtract('kind', resolvedPath, () => detectKind(hooks, components, imports, filePath, source), 'ts:module' as ContractKind);
    const { exports: exportMetadata, exportedFunctions } = safeExtract('exports', resolvedPath, () => extractExports(source), { exports: undefined, exportedFunctions: [] });

    return {
      kind,
      variables,
      hooks,
      components,
      functions,
      props,
      state,
      emits,
      imports,
      jsxRoutes,
      ...(nextjs && { nextjs }),
      ...(exportMetadata && { exports: exportMetadata }),
      ...(exportedFunctions.length > 0 && { exportedFunctions }),
    };
  } catch (error) {
    debugError('astParser', 'extractFromFile', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    // Return empty AST on parsing errors instead of crashing
    // Callers should check if the result is meaningful before using it
    return {
      kind: 'ts:module',
      variables: [],
      hooks: [],
      components: [],
      functions: [],
      props: {},
      state: {},
      emits: {},
      imports: [],
      jsxRoutes: [],
      exports: undefined,
      exportedFunctions: [],
    };
  }
}


/**
 * Extract all function declarations and arrow functions
 */
function extractFunctions(source: SourceFile): string[] {
  const functions = new Set<string>();

  // Function declarations
  source.getFunctions().forEach((func) => {
    const name = func.getName();
    if (name) {
      functions.add(name);
    }
  });

  // Arrow functions assigned to variables
  source.getVariableDeclarations().forEach((varDecl) => {
    const initializer = varDecl.getInitializer();
    if (initializer && Node.isArrowFunction(initializer)) {
      functions.add(varDecl.getName());
    }
  });

  // Method declarations in classes/objects
  source.getDescendantsOfKind(SyntaxKind.MethodDeclaration).forEach((method) => {
    const name = method.getName();
    if (name) {
      functions.add(name);
    }
  });

  return Array.from(functions).sort();
}

/**
 * Extract export metadata and exported functions from source file
 * Uses fast AST traversal - optimized single pass through statements
 */
function extractExports(source: SourceFile): { exports: ExportMetadata | undefined; exportedFunctions: string[] } {
  const exportedFunctions = new Set<string>();
  let hasDefaultExport = false;
  const namedExports = new Set<string>();

  // Fast single-pass AST traversal - check statements directly
  const statements = source.getStatements();

  // Early exit if no statements
  if (statements.length === 0) {
    return { exports: undefined, exportedFunctions: [] };
  }
  // Optimized loop: only process export-related statements
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const kind = stmt.getKind();

    // Handle explicit export declarations first (most common for exports)
    if (kind === SyntaxKind.ExportDeclaration) {
      const exportStmt = stmt as ExportDeclaration;
      const namedExportsFromDecl = exportStmt.getNamedExports();
      for (let j = 0; j < namedExportsFromDecl.length; j++) {
        const name = namedExportsFromDecl[j].getName();
        if (name) {
          namedExports.add(name);
          exportedFunctions.add(name);
        }
      }
      continue;
    }

    // Skip statements that can't be exports
    if (kind !== SyntaxKind.FunctionDeclaration &&
        kind !== SyntaxKind.ClassDeclaration &&
        kind !== SyntaxKind.VariableStatement) {
      continue;
    }

    // Check modifiers once for declarations that can be exported
    const modifiers = (stmt as any).getModifiers?.() || [];
    let hasExport = false;
    let isDefault = false;

    for (let m = 0; m < modifiers.length; m++) {
      const modKind = modifiers[m].getKind();
      if (modKind === SyntaxKind.ExportKeyword) hasExport = true;
      if (modKind === SyntaxKind.DefaultKeyword) isDefault = true;
    }

    if (!hasExport) continue; // Skip non-exported statements

    // Process exported declarations
    if (kind === SyntaxKind.FunctionDeclaration || kind === SyntaxKind.ClassDeclaration) {
      const decl = stmt as FunctionDeclaration | ClassDeclaration;
      const name = decl.getName();

      if (isDefault) {
        hasDefaultExport = true;
        if (name) exportedFunctions.add(name);
      } else {
        if (name) {
          namedExports.add(name);
          exportedFunctions.add(name);
        }
      }
    } else if (kind === SyntaxKind.VariableStatement) {
      const varStmt = stmt as VariableStatement;
      if (isDefault) hasDefaultExport = true;

      const declarations = varStmt.getDeclarationList().getDeclarations();
      for (let j = 0; j < declarations.length; j++) {
        const name = declarations[j].getName();
        if (name) {
          if (isDefault) {
            exportedFunctions.add(name);
          } else {
            namedExports.add(name);
            exportedFunctions.add(name);
          }
        }
      }
    }
  }

  // Determine export metadata
  let exports: ExportMetadata | undefined;

  if (hasDefaultExport) {
    exports = 'default';
  } else if (namedExports.size > 0) {
    const namedArray = Array.from(namedExports).sort();
    if (namedArray.length === 1) {
      exports = 'named';
    } else {
      exports = { named: namedArray };
    }
  }

  return {
    exports,
    exportedFunctions: Array.from(exportedFunctions).sort(),
  };
}




/**
 * Extract import module specifiers
 */
function extractImports(source: SourceFile): string[] {
  const imports = new Set<string>();

  source.getImportDeclarations().forEach((importDecl) => {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    imports.add(moduleSpecifier);
  });

  return Array.from(imports).sort();
}


/**
 * Build the logic signature from extracted AST data
 */
export function buildLogicSignatureFromAst(ast: AstExtract): LogicSignature {
  return {
    props: ast.props,
    emits: ast.emits,
    state: Object.keys(ast.state).length > 0 ? ast.state : undefined,
  };
}
