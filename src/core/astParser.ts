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

import { Project, SyntaxKind, SourceFile, Node } from 'ts-morph';
import type { LogicSignature, ContractKind, PropType, EventType, NextJSMetadata } from '../types/UIFContract.js';
import { extractComponents, extractHooks } from './astParser/extractors/componentExtractor.js';
import { extractProps } from './astParser/extractors/propExtractor.js';
import { extractState, extractVariables } from './astParser/extractors/stateExtractor.js';
import { extractEvents, extractJsxRoutes } from './astParser/extractors/eventExtractor.js';
import { detectKind, extractNextJsMetadata } from './astParser/detectors.js';

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
}


/**
 * Extract all structural information from a TypeScript/React file
 */
export async function extractFromFile(filePath: string): Promise<AstExtract> {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      jsx: 1, // React JSX
      target: 99, // ESNext
    },
  });

  const source = project.addSourceFileAtPath(filePath);

  // Extract basic data first
  const hooks = extractHooks(source);
  const components = extractComponents(source);
  const imports = extractImports(source);
  const nextjs = extractNextJsMetadata(source, filePath);

  return {
    kind: detectKind(hooks, components, imports, filePath, source),
    variables: extractVariables(source),
    hooks,
    components,
    functions: extractFunctions(source),
    props: extractProps(source),
    state: extractState(source),
    emits: extractEvents(source),
    imports,
    jsxRoutes: extractJsxRoutes(source),
    ...(nextjs && { nextjs }),
  };
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
