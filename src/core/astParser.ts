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
import type { LogicSignature, ContractKind, PropType, EventType } from '../types/UIFContract.js';

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

  return {
    kind: detectKind(hooks, components, imports),
    variables: extractVariables(source),
    hooks,
    components,
    functions: extractFunctions(source),
    props: extractProps(source),
    state: extractState(source),
    emits: extractEvents(source),
    imports,
    jsxRoutes: extractJsxRoutes(source),
  };
}

/**
 * Extract all variable declarations (const, let, var)
 */
function extractVariables(source: SourceFile): string[] {
  const variables = new Set<string>();

  source.getVariableDeclarations().forEach((varDecl) => {
    const name = varDecl.getName();
    // Skip destructured state setters (e.g., setCount from [count, setCount])
    if (!name.startsWith('set') || !varDecl.getParent()?.getText().includes('useState')) {
      variables.add(name);
    }
  });

  return Array.from(variables).sort();
}

/**
 * Extract all React hooks (useState, useEffect, custom hooks)
 */
function extractHooks(source: SourceFile): string[] {
  const hooks = new Set<string>();

  source.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((callExpr) => {
    const expr = callExpr.getExpression();
    const text = expr.getText();

    // Match useXxx pattern
    if (/^use[A-Z]/.test(text)) {
      hooks.add(text);
    }
  });

  return Array.from(hooks).sort();
}

/**
 * Extract all JSX components used in the file
 */
function extractComponents(source: SourceFile): string[] {
  const components = new Set<string>();

  // JSX opening elements
  source.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).forEach((openingEl) => {
    const tagName = openingEl.getTagNameNode().getText();
    if (/^[A-Z]/.test(tagName)) {
      components.add(tagName);
    }
  });

  // Self-closing JSX elements
  source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).forEach((selfClosing) => {
    const tagName = selfClosing.getTagNameNode().getText();
    if (/^[A-Z]/.test(tagName)) {
      components.add(tagName);
    }
  });

  return Array.from(components).sort();
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
 * Extract component props from TypeScript interfaces/types
 */
function extractProps(source: SourceFile): Record<string, PropType> {
  const props: Record<string, PropType> = {};

  // Look for interfaces ending with Props
  source.getInterfaces().forEach((iface) => {
    if (/Props$/i.test(iface.getName())) {
      iface.getProperties().forEach((prop) => {
        const name = prop.getName();
        const isOptional = prop.hasQuestionToken();
        const type = prop.getType().getText();

        props[name] = normalizePropType(type, isOptional);
      });
    }
  });

  // Look for type aliases ending with Props
  source.getTypeAliases().forEach((typeAlias) => {
    if (/Props$/i.test(typeAlias.getName())) {
      const type = typeAlias.getType();
      const properties = type.getProperties();

      properties.forEach((prop) => {
        const name = prop.getName();
        const propType = prop.getTypeAtLocation(typeAlias).getText();
        // Check if optional from declaration
        const declarations = prop.getDeclarations();
        const isOptional = declarations.some((decl) =>
          decl.getText().includes('?:')
        );

        props[name] = normalizePropType(propType, isOptional);
      });
    }
  });

  return props;
}

/**
 * Normalize a prop type into the rich PropType format
 */
function normalizePropType(typeText: string, isOptional: boolean): PropType {
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
  if (isOptional && !['string', 'number', 'boolean'].includes(cleanType)) {
    return {
      type: cleanType,
      optional: true
    };
  }

  // Return simple string for common types (backward compat)
  return cleanType;
}

/**
 * Extract component state from useState calls
 */
function extractState(source: SourceFile): Record<string, string> {
  const state: Record<string, string> = {};

  source.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach((varDecl) => {
    const initializer = varDecl.getInitializer();
    if (!initializer) return;

    const initText = initializer.getText();
    if (initText.startsWith('useState(') || initText.startsWith('useState<')) {
      const bindingName = varDecl.getName();

      // Extract state variable name from array destructuring [value, setValue]
      const match = bindingName.match(/\[([a-zA-Z0-9_]+)\s*,/);
      if (match) {
        const stateVar = match[1];

        // Try to infer type from generic or initial value
        let type = 'unknown';
        const genericMatch = initText.match(/useState<([^>]+)>/);
        if (genericMatch) {
          type = genericMatch[1];
        } else {
          // Infer from initial value
          const valueMatch = initText.match(/useState\(([^)]+)\)/);
          if (valueMatch) {
            const value = valueMatch[1].trim();
            if (value === 'true' || value === 'false') type = 'boolean';
            else if (/^\d+$/.test(value)) type = 'number';
            else if (/^["']/.test(value)) type = 'string';
            else if (value === 'null') type = 'null';
            else if (value === '[]') type = 'array';
            else if (value === '{}') type = 'object';
          }
        }

        state[stateVar] = type;
      }
    }
  });

  return state;
}

/**
 * Extract event handlers from JSX attributes
 */
function extractEvents(source: SourceFile): Record<string, EventType> {
  const events: Record<string, EventType> = {};

  source.getDescendantsOfKind(SyntaxKind.JsxAttribute).forEach((attr) => {
    const name = attr.getNameNode().getText();

    // Match onXxx pattern
    if (/^on[A-Z]/.test(name)) {
      const initializer = attr.getInitializer();
      if (initializer) {
        // Try to infer the event handler signature
        const initText = initializer.getText();

        // Extract function signature if possible
        let signature = '() => void';  // default

        // Try to parse arrow function signature: (arg) => { ... }
        const arrowMatch = initText.match(/\(([^)]*)\)\s*=>/);
        if (arrowMatch) {
          signature = `(${arrowMatch[1]}) => void`;
        }

        events[name] = {
          type: 'function',
          signature
        };
      }
    }
  });

  return events;
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
 * Detect component kind based on its characteristics
 */
function detectKind(
  hooks: string[],
  components: string[],
  imports: string[]
): ContractKind {
  // React component: has hooks or JSX components
  if (hooks.length > 0 || components.length > 0) {
    return 'react:component';
  }

  // Node CLI: imports from node: namespace
  const hasNodeImports = imports.some(imp => imp.startsWith('node:'));
  if (hasNodeImports) {
    return 'node:cli';
  }

  // Default: TypeScript module
  return 'ts:module';
}

/**
 * Extract potential route usage (heuristic-based)
 */
function extractJsxRoutes(source: SourceFile): string[] {
  const routes = new Set<string>();

  // Look for route-like string literals in JSX
  source.getDescendantsOfKind(SyntaxKind.StringLiteral).forEach((strLit) => {
    const value = strLit.getLiteralValue();
    // Match route patterns like /path, /path/:id, etc.
    if (/^\/[a-z0-9\-_/:.]*$/i.test(value)) {
      routes.add(value);
    }
  });

  return Array.from(routes).sort();
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
