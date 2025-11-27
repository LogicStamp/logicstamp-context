/**
 * State Extractor - Extracts component state and variable declarations from AST
 */

import { SourceFile, SyntaxKind } from 'ts-morph';

/**
 * Extract all variable declarations (const, let, var)
 */
export function extractVariables(source: SourceFile): string[] {
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
 * Extract component state from useState calls
 */
export function extractState(source: SourceFile): Record<string, string> {
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

