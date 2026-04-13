/**
 * Schema validation utilities using AJV
 * Validates JSON data against LogicStamp schemas at runtime
 */

import { Ajv, type ValidateFunction, type ErrorObject } from 'ajv';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UIFContract } from '../types/UIFContract.js';
import { debugError } from './debug.js';

// Resolve schema path relative to this module
const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '../../schema/logicstamp.context.schema.json');

// Lazy-load schema and validator to avoid startup cost if validation isn't used
let ajv: Ajv | null = null;
let contractValidator: ValidateFunction<UIFContract> | null = null;
let schemaLoadError: Error | null = null;

/**
 * Initialize AJV and compile the UIFContract schema
 * Called lazily on first validation attempt
 */
function initializeValidator(): ValidateFunction<UIFContract> | null {
  if (contractValidator) return contractValidator;
  if (schemaLoadError) return null;

  try {
    const schemaContent = readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaContent);

    // Guard against malformed schema file
    if (!schema?.definitions?.UIFContract) {
      throw new Error('UIFContract definition not found in schema');
    }

    ajv = new Ajv({
      allErrors: true, // Collect all errors, not just the first
      strict: false, // Allow schema features that aren't strictly spec-compliant
      verbose: true, // Ensures `data` field is present in errors for typeof reporting
    });

    // Compile the UIFContract definition specifically
    // The schema file has definitions at the root level
    contractValidator = ajv.compile<UIFContract>({
      $ref: '#/definitions/UIFContract',
      definitions: schema.definitions,
    });

    return contractValidator;
  } catch (error) {
    // Clean up on failure
    ajv = null;
    contractValidator = null;
    schemaLoadError = error as Error;
    debugError('schemaValidator', 'initializeValidator', {
      error: schemaLoadError.message,
      note: 'Schema validation disabled, contracts will not be validated',
    });
    return null;
  }
}

/**
 * Validate data against the UIFContract schema
 * Returns validation result with detailed errors if invalid
 */
export function validateUIFContract(data: unknown): {
  valid: boolean;
  errors: string[];
  data: UIFContract | null;
} {
  const validator = initializeValidator();

  // If schema failed to load, reject validation
  // This ensures corrupted or invalid contracts are never silently accepted
  if (!validator) {
    return {
      valid: false,
      errors: ['Schema validation unavailable: ' + (schemaLoadError?.message || 'failed to load schema')],
      data: null,
    };
  }

  const valid = validator(data);

  if (valid) {
    return {
      valid: true,
      errors: [],
      data: data as UIFContract,
    };
  }

  // Format errors for readability
  const errors = formatValidationErrors(validator.errors);

  return {
    valid: false,
    errors,
    data: null,
  };
}

/**
 * Type guard that validates and narrows type
 * Use when you just need a boolean check
 */
export function isValidUIFContract(data: unknown): data is UIFContract {
  return validateUIFContract(data).valid;
}

/**
 * Format AJV errors into human-readable strings
 */
function formatValidationErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) return [];

  return errors.map((err) => {
    const path = err.instancePath || '(root)';
    const message = err.message || 'unknown error';

    // Add context for common error types
    switch (err.keyword) {
      case 'required':
        return `${path}: missing required property '${err.params.missingProperty}'`;
      case 'type': {
        // typeof null === 'object' and typeof [] === 'object', so handle explicitly
        const got = err.data === null ? 'null' : Array.isArray(err.data) ? 'array' : typeof err.data;
        return `${path}: ${message} (got ${got})`;
      }
      case 'enum':
        return `${path}: ${message}. Allowed: ${err.params.allowedValues?.join(', ')}`;
      case 'const':
        return `${path}: ${message}. Expected: ${err.params.allowedValue}`;
      case 'additionalProperties':
        return `${path}: unexpected property '${err.params.additionalProperty}'`;
      case 'anyOf':
      case 'oneOf':
        // These are notoriously noisy - simplify the message
        return `${path}: ${message} (schema union mismatch)`;
      default:
        return `${path}: ${message}`;
    }
  });
}

/**
 * Clear the cached validator (useful for testing)
 */
export function clearValidatorCache(): void {
  ajv = null;
  contractValidator = null;
  schemaLoadError = null;
}
