/**
 * Re-export shared test helpers for style extractor tests.
 * Style-specific helpers are kept here for backward compatibility.
 */
export {
  createTestProject,
  createTestSourceFile,
  runExtractorTests,
  type StyleExtractorTestCase,
  expectEmptyResult,
  expectComponents,
  expectPackages,
  expectSortedPackages,
  expectComponentLimit,
} from '../test-helpers.js';

