/**
 * Prop Extractor - Extracts component props from TypeScript interfaces/types
 */

import { SourceFile } from 'ts-morph';
import type { PropType } from '../../../types/UIFContract.js';

/**
 * Extract component props from TypeScript interfaces/types
 */
export function extractProps(source: SourceFile): Record<string, PropType> {
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
export function normalizePropType(typeText: string, isOptional: boolean): PropType {
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

