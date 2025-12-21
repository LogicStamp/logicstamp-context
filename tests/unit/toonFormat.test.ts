import { describe, it, expect } from 'vitest';
import { decode as decodeToon } from '@toon-format/toon';
import { formatBundles } from '../../src/cli/commands/context/bundleFormatter.js';
import type { LogicStampBundle } from '../../src/core/pack.js';

describe('TOON format', () => {
  const createMockBundle = (id: string): LogicStampBundle => ({
    type: 'LogicStampBundle',
    schemaVersion: '0.1',
    entryId: `src/components/${id}.tsx`,
    depth: 1,
    createdAt: '2025-01-01T00:00:00.000Z',
    bundleHash: 'uifb:abcdef1234567890abcdef12',
    graph: {
      nodes: [
        {
          entryId: `src/components/${id}.tsx`,
          contract: {
            type: 'UIFContract',
            schemaVersion: '0.3',
            kind: 'react:component',
            entryId: `src/components/${id}.tsx`,
            description: `${id} component`,
            version: { variables: [], hooks: [], components: [], functions: [] },
            logicSignature: { props: {}, emits: {} },
            exports: 'default',
            semanticHash: 'uif:test',
            fileHash: 'uif:test',
          },
        },
      ],
      edges: [],
    },
    meta: {
      source: 'logicstamp-context@test',
      missing: [],
    },
  });

  it('should encode bundles to valid TOON format', () => {
    const bundles = [createMockBundle('Button')];
    const output = formatBundles(bundles, 'toon');

    // Should produce non-empty output
    expect(output.length).toBeGreaterThan(0);

    // Should be decodable
    const decoded = decodeToon(output) as any[];
    expect(Array.isArray(decoded)).toBe(true);
    expect(decoded).toHaveLength(1);
  });

  it('should preserve bundle structure through encode/decode', () => {
    const bundles = [createMockBundle('Card')];
    const output = formatBundles(bundles, 'toon');
    const decoded = decodeToon(output) as any[];

    expect(decoded[0].$schema).toBe('https://logicstamp.dev/schemas/context/v0.1.json');
    expect(decoded[0].position).toBe('1/1');
    expect(decoded[0].type).toBe('LogicStampBundle');
    expect(decoded[0].entryId).toBe('src/components/Card.tsx');
    expect(decoded[0].graph.nodes).toHaveLength(1);
  });
});
