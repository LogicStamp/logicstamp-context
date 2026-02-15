/**
 * Unit tests for bundleFormatter module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockBundle } from './helpers.js';

// Mock the @toon-format/toon module
vi.mock('@toon-format/toon', () => ({
  encode: vi.fn((data: unknown) => `TOON:${JSON.stringify(data)}`),
}));

// Import after mocks
import {
  formatBundles,
  createBundleWithSchema,
  formatBundlesForFolder,
} from '../../../../src/cli/commands/context/bundleFormatter.js';

describe('bundleFormatter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatBundles', () => {
    it('should return valid JSON array with $schema and position for json format', () => {
      const bundles = [
        createMockBundle('src/App.tsx'),
        createMockBundle('src/Button.tsx'),
      ];

      const result = formatBundles(bundles, 'json');
      const parsed = JSON.parse(result);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(2);
      expect(parsed[0].$schema).toBe('https://logicstamp.dev/schemas/context/v0.1.json');
      expect(parsed[0].position).toBe('1/2');
      expect(parsed[1].position).toBe('2/2');
    });

    it('should return newline-delimited JSON for ndjson format', () => {
      const bundles = [
        createMockBundle('src/App.tsx'),
        createMockBundle('src/Button.tsx'),
      ];

      const result = formatBundles(bundles, 'ndjson');
      const lines = result.split('\n');

      expect(lines.length).toBe(2);

      const first = JSON.parse(lines[0]);
      expect(first.$schema).toBe('https://logicstamp.dev/schemas/context/v0.1.json');
      expect(first.position).toBe('1/2');

      const second = JSON.parse(lines[1]);
      expect(second.position).toBe('2/2');
    });

    it('should encode correctly for toon format', () => {
      const bundles = [createMockBundle('src/App.tsx')];

      const result = formatBundles(bundles, 'toon');

      expect(result).toContain('TOON:');
      expect(result).toContain('"position":"1/1"');
    });

    it('should include # Bundle X/Y: headers for pretty format', () => {
      const bundles = [
        createMockBundle('src/App.tsx'),
        createMockBundle('src/Button.tsx'),
      ];

      const result = formatBundles(bundles, 'pretty');

      expect(result).toContain('# Bundle 1/2: src/App.tsx');
      expect(result).toContain('# Bundle 2/2: src/Button.tsx');
    });

    it('should handle empty bundles array', () => {
      const result = formatBundles([], 'json');
      const parsed = JSON.parse(result);

      expect(parsed).toEqual([]);
    });

    it('should handle single bundle correctly', () => {
      const bundles = [createMockBundle('src/App.tsx')];

      const result = formatBundles(bundles, 'json');
      const parsed = JSON.parse(result);

      expect(parsed.length).toBe(1);
      expect(parsed[0].position).toBe('1/1');
    });

    it('should format position as index+1/total', () => {
      const bundles = [
        createMockBundle('src/A.tsx'),
        createMockBundle('src/B.tsx'),
        createMockBundle('src/C.tsx'),
      ];

      const result = formatBundles(bundles, 'json');
      const parsed = JSON.parse(result);

      expect(parsed[0].position).toBe('1/3');
      expect(parsed[1].position).toBe('2/3');
      expect(parsed[2].position).toBe('3/3');
    });
  });

  describe('createBundleWithSchema', () => {
    it('should add $schema and position to bundle', () => {
      const bundle = createMockBundle('src/App.tsx');

      const result = createBundleWithSchema(bundle, 0, 3);

      expect(result.$schema).toBe('https://logicstamp.dev/schemas/context/v0.1.json');
      expect(result.position).toBe('1/3');
      expect(result.entryId).toBe('src/App.tsx');
    });

    it('should preserve original bundle properties', () => {
      const bundle = createMockBundle('src/App.tsx');

      const result = createBundleWithSchema(bundle, 0, 1);

      expect(result.type).toBe('LogicStampBundle');
      expect(result.schemaVersion).toBe('0.1');
      expect(result.graph).toBeDefined();
      expect(result.meta).toBeDefined();
    });

    it('should handle zero-based index correctly', () => {
      const bundle = createMockBundle('src/App.tsx');

      const result = createBundleWithSchema(bundle, 4, 10);

      expect(result.position).toBe('5/10');
    });
  });

  describe('formatBundlesForFolder', () => {
    it('should delegate to formatBundles', () => {
      const bundles = [createMockBundle('src/App.tsx')];

      const result = formatBundlesForFolder(bundles, 'json');
      const parsed = JSON.parse(result);

      expect(parsed.length).toBe(1);
      expect(parsed[0].$schema).toBeDefined();
    });

    it('should work with all format types', () => {
      const bundles = [createMockBundle('src/App.tsx')];

      // Each format should produce valid output
      expect(() => formatBundlesForFolder(bundles, 'json')).not.toThrow();
      expect(() => formatBundlesForFolder(bundles, 'pretty')).not.toThrow();
      expect(() => formatBundlesForFolder(bundles, 'ndjson')).not.toThrow();
      expect(() => formatBundlesForFolder(bundles, 'toon')).not.toThrow();
    });
  });
});
