/**
 * Prop Type Normalizer - Normalizes TypeScript prop types into rich PropType format
 */

import type { PropType } from '../../../types/UIFContract.js';
import { debugError } from '../../../utils/debug.js';

/**
 * Strip undefined from union type text in any position
 * Handles both "undefined | string" and "string | undefined" cases
 * 
 * @internal Utility function primarily used internally. Exported for advanced use cases.
 */
export function stripUndefinedFromUnionText(typeText: string): string {
  return typeText
    .replace(/\bundefined\b\s*\|\s*/g, '')  // Remove "undefined |"
    .replace(/\s*\|\s*\bundefined\b/g, '')  // Remove "| undefined"
    .replace(/\s*\|\s*\|\s*/g, ' | ')       // Clean up double pipes and normalize spacing
    .trim();
}

/**
 * Normalize a prop type into the rich PropType format
 */
export function normalizePropType(typeText: string, isOptional: boolean): PropType {
  try {
    // Remove 'undefined' from unions if present (handles both | undefined and undefined |)
    // Use the shared helper for consistency - ensures consistent output regardless of union member order
    const cleanType = stripUndefinedFromUnionText(typeText);

    // Detect literal unions: "a" | "b" | "c", 'a' | 'b', 1 | 2, -1 | 0, 1.5 | 2.0, 0xFF, true | false, null
    // Match string literals (single or double quotes), numbers (including negatives, decimals, hex), booleans, null
    // Order: hex before decimal to avoid partial matches (0xFF won't match -?\d+)
    const literalUnionPattern = /^((["'][^"']*["']|0x[0-9A-Fa-f]+|-?\d+(?:\.\d+)?|true|false|null)(\s*\|\s*(["'][^"']*["']|0x[0-9A-Fa-f]+|-?\d+(?:\.\d+)?|true|false|null))+)$/;
    const literalUnionMatch = cleanType.match(literalUnionPattern);
    if (literalUnionMatch) {
      const literals = cleanType
        .split('|')
        .map(t => {
          const trimmed = t.trim();
          // Remove quotes from string literals
          if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
              (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
            return trimmed.slice(1, -1);
          }
          return trimmed;
        });

      return {
        type: 'literal-union',
        literals,
        ...(isOptional && { optional: true })
      };
    }

    // Detect function types: () => void, (x: string) => void
    // Only check for => arrow, not just parentheses (which can be unions, tuples, etc.)
    if (cleanType.includes('=>')) {
      return {
        type: 'function',
        signature: cleanType,
        ...(isOptional && { optional: true })
      };
    }

    // Simple type with optionality
    if (isOptional) {
      // For all optional types, return object with optional flag to preserve the optional information
      return {
        type: cleanType,
        optional: true
      };
    }

    // Return simple string for common types (backward compat)
    return cleanType;
  } catch (error) {
    // Fallback to simple string type on error
    debugError('propTypeNormalizer', 'normalizePropType', {
      error: error instanceof Error ? error.message : String(error),
      typeText,
    });
    return typeText;
  }
}

