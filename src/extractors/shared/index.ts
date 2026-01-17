/**
 * Shared Extractors - Main entry point
 * Re-exports all shared extraction functionality
 */

export {
  extractBackendMetadata,
  extractBackendApiSignature,
  type BackendMetadata,
} from './backendExtractor.js';
export { normalizePropType, stripUndefinedFromUnionText } from './propTypeNormalizer.js';
