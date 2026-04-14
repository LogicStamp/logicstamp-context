/**
 * Prop Extractor - Extracts component props from TypeScript interfaces/types
 */

import {
  type SourceFile,
  Node,
  type Type,
  type InterfaceDeclaration,
  type TypeAliasDeclaration,
  type PropertySignature,
  type Symbol as TsMorphSymbol,
} from 'ts-morph';
import type { PropType } from '../../types/UIFContract.js';
import { debugError } from '../../utils/debug.js';
import {
  normalizePropType,
  stripUndefinedFromUnionText,
} from '../shared/propTypeNormalizer.js';
import {
  hasExportedHooks,
  extractHookParameters,
} from './hookParameterExtractor.js';

// TypeScript TypeFlags.Undefined constant (0x4000 = 16384)
// Used for checking if a union type includes undefined
const TYPEFLAG_UNDEFINED = 16384; // ts.TypeFlags.Undefined

/**
 * Wraps a function call in a try-catch, returning a default value on error.
 * Use this to simplify error handling for operations that may fail but shouldn't
 * stop processing of other items.
 */
function safeExtract<T>(
  fn: () => T,
  defaultValue: T,
  errorContext?: { filePath: string; context: string },
): T {
  try {
    return fn();
  } catch (error) {
    if (errorContext) {
      debugError('propExtractor', 'extractProps', {
        filePath: errorContext.filePath,
        error: error instanceof Error ? error.message : String(error),
        context: errorContext.context,
      });
    }
    return defaultValue;
  }
}

/**
 * Safely get TypeScript type flags from a ts-morph Type
 * Accesses the underlying TypeScript compiler type to get flags
 */
function getTypeFlags(type: Type): number {
  const compilerType = type.compilerType;
  if (compilerType && typeof compilerType.flags === 'number') {
    return compilerType.flags;
  }
  return 0;
}

/**
 * Check if a union type includes undefined
 */
function isUndefinedType(type: Type): boolean {
  const flags = getTypeFlags(type);
  if ((flags & TYPEFLAG_UNDEFINED) !== 0) {
    return true;
  }
  return type.getText() === 'undefined';
}

/**
 * Check if a union type contains undefined and extract the non-undefined type text
 * Returns { hasUndefined, typeText } where typeText excludes undefined
 */
function analyzeUnionForUndefined(propType: Type): {
  hasUndefined: boolean;
  typeText: string;
} {
  if (!propType.isUnion()) {
    return { hasUndefined: false, typeText: propType.getText() };
  }

  const unionTypes = propType.getUnionTypes();
  const hasUndefined = unionTypes.some(isUndefinedType);

  if (!hasUndefined) {
    return { hasUndefined: false, typeText: propType.getText() };
  }

  const typeText = unionTypes
    .filter((ut) => !isUndefinedType(ut))
    .map((ut) => ut.getText())
    .join(' | ');

  return { hasUndefined: true, typeText };
}

/**
 * Extract a single prop from an interface property
 */
function extractInterfaceProp(
  prop: PropertySignature,
): { name: string; propType: PropType } | null {
  const name = prop.getName();
  let isOptional = prop.hasQuestionToken();
  let type = prop.getType().getText();
  let didRebuildFromUnion = false;

  // Check for union-with-undefined (some people write foo: string | undefined without ?)
  if (!isOptional) {
    const analysis = analyzeUnionForUndefined(prop.getType());
    if (analysis.hasUndefined) {
      isOptional = true;
      type = analysis.typeText;
      didRebuildFromUnion = true;
    }
  }

  // If optional but we didn't rebuild from union types, strip undefined from type text
  if (isOptional && !didRebuildFromUnion) {
    type = stripUndefinedFromUnionText(type);
  }

  return { name, propType: normalizePropType(type, isOptional) };
}

/**
 * Extract props from a single interface declaration
 */
function extractPropsFromInterface(
  iface: InterfaceDeclaration,
  filePath: string,
): Record<string, PropType> {
  const props: Record<string, PropType> = {};

  if (!/Props$/i.test(iface.getName())) {
    return props;
  }

  for (const prop of iface.getProperties()) {
    const result = safeExtract(() => extractInterfaceProp(prop), null, {
      filePath,
      context: 'props-interface-property',
    });

    if (result) {
      props[result.name] = result.propType;
    }
  }

  return props;
}

/**
 * Extract a single prop from a type alias property symbol
 */
function extractTypeAliasProp(
  prop: TsMorphSymbol,
  typeAlias: TypeAliasDeclaration,
): { name: string; propType: PropType } | null {
  const name = prop.getName();
  let isOptional = false;
  let propType = prop.getTypeAtLocation(typeAlias).getText();
  let didRebuildFromUnion = false;

  // Method 1: Check if type is a union that includes undefined
  const propTypeObj = prop.getTypeAtLocation(typeAlias);
  const analysis = analyzeUnionForUndefined(propTypeObj);
  if (analysis.hasUndefined) {
    isOptional = true;
    propType = analysis.typeText;
    didRebuildFromUnion = true;
  }

  // Method 2: Check declarations for question token (AST method)
  if (!isOptional) {
    const declarations = prop.getDeclarations();
    isOptional = declarations.some((decl) => {
      if (Node.isPropertySignature(decl)) {
        return decl.hasQuestionToken();
      }
      if (Node.isPropertyDeclaration(decl)) {
        return decl.hasQuestionToken();
      }
      return false;
    });
  }

  // If optional but we didn't rebuild from union types, strip undefined from type text
  if (isOptional && !didRebuildFromUnion) {
    propType = stripUndefinedFromUnionText(propType);
  }

  return { name, propType: normalizePropType(propType, isOptional) };
}

/**
 * Extract props from a single type alias declaration
 */
function extractPropsFromTypeAlias(
  typeAlias: TypeAliasDeclaration,
  filePath: string,
): Record<string, PropType> {
  const props: Record<string, PropType> = {};

  if (!/Props$/i.test(typeAlias.getName())) {
    return props;
  }

  const type = typeAlias.getType();
  const properties = type.getProperties();

  for (const prop of properties) {
    const result = safeExtract(
      () => extractTypeAliasProp(prop, typeAlias),
      null,
      { filePath, context: 'props-typealias-property' },
    );

    if (result) {
      props[result.name] = result.propType;
    }
  }

  return props;
}

/**
 * Extract component props from TypeScript interfaces/types
 * Also extracts hook parameters when the file contains hook definitions
 */
export function extractProps(source: SourceFile): Record<string, PropType> {
  const props: Record<string, PropType> = {};
  const filePath = source.getFilePath?.() ?? 'unknown';

  // Extract props from interfaces ending with Props
  const interfaces = safeExtract(() => source.getInterfaces(), [], {
    filePath,
    context: 'props-interfaces-batch',
  });

  for (const iface of interfaces) {
    const ifaceProps = safeExtract(
      () => extractPropsFromInterface(iface, filePath),
      {},
      { filePath, context: 'props-interface' },
    );
    Object.assign(props, ifaceProps);
  }

  // Extract props from type aliases ending with Props
  const typeAliases = safeExtract(() => source.getTypeAliases(), [], {
    filePath,
    context: 'props-typealiases-batch',
  });

  for (const typeAlias of typeAliases) {
    const typeAliasProps = safeExtract(
      () => extractPropsFromTypeAlias(typeAlias, filePath),
      {},
      { filePath, context: 'props-typealias' },
    );
    Object.assign(props, typeAliasProps);
  }

  // Extract hook parameters if there are exported hooks
  // Props take priority on conflicts (if a prop exists in both, Props value is kept)
  if (hasExportedHooks(source)) {
    const hookParams = extractHookParameters(source);
    if (Object.keys(hookParams).length > 0) {
      // Merge hook parameters with Props, with Props taking priority on conflicts
      const originalProps = { ...props };
      Object.assign(props, hookParams);
      Object.assign(props, originalProps); // Props override any conflicting hook parameters
    }
  }

  return props;
}

// Re-export normalizePropType for backward compatibility
// Previously exported from this file, now implemented in propTypeNormalizer.ts
export { normalizePropType } from '../shared/propTypeNormalizer.js';
