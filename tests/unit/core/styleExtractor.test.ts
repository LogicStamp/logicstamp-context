import { describe, it, expect } from 'vitest';
import { extractStyleMetadata } from '../../../src/core/styleExtractor.js';

describe('styleExtractor (re-export)', () => {
  it('should export extractStyleMetadata function', () => {
    expect(typeof extractStyleMetadata).toBe('function');
  });

  it('should be importable from styleExtractor module', async () => {
    const module = await import('../../../src/core/styleExtractor.js');
    expect(module.extractStyleMetadata).toBeDefined();
    expect(typeof module.extractStyleMetadata).toBe('function');
  });
});
