/**
 * Unit tests for core comparison logic
 */

import { describe, it, expect } from 'vitest';
import { normalizeName, normalizeNames, index, arraysEqual, diff } from '../../../../src/cli/commands/compare/core.js';
import type { LogicStampBundle } from '../../../../src/core/pack.js';

/**
 * Helper to create a minimal valid bundle for testing
 */
function createBundle(entryId: string, semanticHash: string, overrides: Record<string, any> = {}): LogicStampBundle {
  return {
    type: 'LogicStampBundle',
    schemaVersion: '0.1',
    entryId,
    depth: 2,
    createdAt: new Date().toISOString(),
    bundleHash: `bundleHash-${entryId.replace(/[/\\]/g, '-')}`,
    graph: {
      nodes: [
        {
          entryId,
          contract: {
            entryId,
            type: 'UIFContract',
            schemaVersion: '0.4',
            kind: 'react:component',
            description: `Test ${entryId}`,
            semanticHash,
            fileHash: `fileHash-${entryId.replace(/[/\\]/g, '-')}`,
            composition: {
              variables: [],
              imports: [],
              hooks: [],
              functions: [],
              components: [],
            },
            interface: {
              props: {},
              emits: {},
            },
            exports: 'default',
          },
        },
      ],
      edges: [],
    },
    meta: {
      missing: [],
      source: 'test',
    },
    ...overrides,
  };
}

describe('normalizeName', () => {
  it('should strip relative path prefixes', () => {
    expect(normalizeName('./Component')).toBe('component');
    expect(normalizeName('../Component')).toBe('component');
    expect(normalizeName('../../Component')).toBe('component');
    expect(normalizeName('../../../Component')).toBe('component');
  });

  it('should extract basename from paths', () => {
    expect(normalizeName('src/components/Button')).toBe('button');
    expect(normalizeName('./src/components/Button')).toBe('button');
    expect(normalizeName('../src/components/Button')).toBe('button');
  });

  it('should normalize to lowercase', () => {
    expect(normalizeName('Button')).toBe('button');
    expect(normalizeName('BUTTON')).toBe('button');
    expect(normalizeName('BuTtOn')).toBe('button');
  });

  it('should handle names without paths', () => {
    expect(normalizeName('Button')).toBe('button');
    expect(normalizeName('useState')).toBe('usestate');
  });
});

describe('normalizeNames', () => {
  it('should normalize and sort array of names', () => {
    const result = normalizeNames(['./Button', '../Header', 'Footer']);
    expect(result).toEqual(['button', 'footer', 'header']);
  });

  it('should handle empty array', () => {
    expect(normalizeNames([])).toEqual([]);
  });

  it('should handle single element', () => {
    expect(normalizeNames(['Button'])).toEqual(['button']);
  });
});

describe('index', () => {
  it('should index bundles by entryId', () => {
    const bundles = [
      createBundle('src/App.tsx', 'uif:hash123'),
      createBundle('src/Button.tsx', 'uif:hash456'),
    ];

    const idx = index(bundles);
    expect(idx.size).toBe(2);
    expect(idx.has('src/app.tsx')).toBe(true);
    expect(idx.has('src/button.tsx')).toBe(true);
  });

  it('should lowercase entryId keys', () => {
    const bundles = [createBundle('src/App.TSX', 'uif:hash123')];
    const idx = index(bundles);
    expect(idx.has('src/app.tsx')).toBe(true);
  });

  it('should extract semantic hash', () => {
    const bundles = [createBundle('src/App.tsx', 'uif:hash123')];
    const idx = index(bundles);
    const sig = idx.get('src/app.tsx')!;
    expect(sig.semanticHash).toBe('uif:hash123');
  });

  it('should extract imports', () => {
    const bundles = [
      createBundle('src/App.tsx', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/App.tsx',
              contract: {
                entryId: 'src/App.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'react:component',
                description: 'Test App component',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: ['react', 'react-dom'],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: { props: {}, emits: {} },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];

    const idx = index(bundles);
    const sig = idx.get('src/app.tsx')!;
    expect(sig.imports).toEqual(['react', 'react-dom']);
  });

  it('should handle missing composition fields', () => {
    const bundles: LogicStampBundle[] = [
      {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/App.tsx',
        depth: 2,
        createdAt: new Date().toISOString(),
        bundleHash: 'bundleHash-src-App-tsx',
        graph: {
          nodes: [
            {
              entryId: 'src/App.tsx',
              contract: {
                entryId: 'src/App.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'react:component',
                description: 'Test component',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: { props: {}, emits: {} },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
        meta: { missing: [], source: 'test' },
      },
    ];

    const idx = index(bundles);
    const sig = idx.get('src/app.tsx')!;
    expect(sig.imports).toEqual([]);
    expect(sig.hooks).toEqual([]);
    expect(sig.functions).toEqual([]);
    expect(sig.components).toEqual([]);
  });

  it('should normalize names when normalize=true', () => {
    const bundles = [
      createBundle('src/App.tsx', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/App.tsx',
              contract: {
                entryId: 'src/App.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'react:component',
                description: 'Test App component',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: ['./react', '../Button'],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: { props: {}, emits: {} },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];

    const idx = index(bundles, true);
    const sig = idx.get('src/app.tsx')!;
    expect(sig.imports).toEqual(['button', 'react']);
  });

  it('should extract export kind correctly', () => {
    const defaultBundle = createBundle('src/App.tsx', 'uif:hash123');
    const namedBundle = createBundle('src/utils.ts', 'uif:hash456', {
      graph: {
        nodes: [
          {
            entryId: 'src/utils.ts',
            contract: {
              entryId: 'src/utils.ts',
              type: 'UIFContract',
              schemaVersion: '0.4',
              kind: 'ts:module',
              description: 'Test utils module',
              semanticHash: 'uif:hash456',
              fileHash: 'fileHash-src-utils-ts',
              composition: { variables: [], imports: [], hooks: [], functions: [], components: [] },
              interface: { props: {}, emits: {} },
              exports: { named: ['foo', 'bar'] },
            },
          },
        ],
        edges: [],
      },
    });
    const noneBundle = createBundle('src/config.ts', 'uif:hash789', {
      graph: {
        nodes: [
          {
            entryId: 'src/config.ts',
            contract: {
              entryId: 'src/config.ts',
              type: 'UIFContract',
              schemaVersion: '0.4',
              kind: 'ts:module',
              description: 'Test config module',
              semanticHash: 'uif:hash789',
              fileHash: 'fileHash-src-config-ts',
              composition: { variables: [], imports: [], hooks: [], functions: [], components: [] },
              interface: { props: {}, emits: {} },
            },
          },
        ],
        edges: [],
      },
    });

    const idx = index([defaultBundle, namedBundle, noneBundle]);
    expect(idx.get('src/app.tsx')!.exportKind).toBe('default');
    expect(idx.get('src/utils.ts')!.exportKind).toBe('named');
    expect(idx.get('src/config.ts')!.exportKind).toBe('none');
  });
});

describe('arraysEqual', () => {
  it('should return true for identical arrays', () => {
    expect(arraysEqual(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  it('should return true for arrays with same elements in different order', () => {
    expect(arraysEqual(['a', 'b'], ['b', 'a'])).toBe(true);
  });

  it('should return false for different arrays', () => {
    expect(arraysEqual(['a', 'b'], ['a', 'c'])).toBe(false);
  });

  it('should handle empty arrays', () => {
    expect(arraysEqual([], [])).toBe(true);
  });

  it('should normalize when normalize=true', () => {
    expect(arraysEqual(['./Button', '../Header'], ['button', 'header'], true)).toBe(true);
    expect(arraysEqual(['./Button'], ['../Button'], true)).toBe(true);
  });

  it('should handle duplicates correctly', () => {
    expect(arraysEqual(['a', 'a'], ['a'])).toBe(false);
    expect(arraysEqual(['a'], ['a', 'a'])).toBe(false);
  });
});

describe('diff', () => {
  it('should return PASS when indices are identical', () => {
    const bundles = [createBundle('src/App.tsx', 'uif:hash123')];
    const oldIdx = index(bundles);
    const newIdx = index(bundles);

    const result = diff(oldIdx, newIdx);
    expect(result.status).toBe('PASS');
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
    expect(result.changed).toHaveLength(0);
  });

  it('should detect added components', () => {
    const oldBundles = [createBundle('src/App.tsx', 'uif:hash123')];
    const newBundles = [
      createBundle('src/App.tsx', 'uif:hash123'),
      createBundle('src/Button.tsx', 'uif:hash456'),
    ];

    const oldIdx = index(oldBundles);
    const newIdx = index(newBundles);

    const result = diff(oldIdx, newIdx);
    // Additions are growth, not drift - should be PASS
    expect(result.status).toBe('PASS');
    expect(result.added).toContain('src/button.tsx');
    expect(result.removed).toHaveLength(0);
  });

  it('should detect removed components', () => {
    const oldBundles = [
      createBundle('src/App.tsx', 'uif:hash123'),
      createBundle('src/Button.tsx', 'uif:hash456'),
    ];
    const newBundles = [createBundle('src/App.tsx', 'uif:hash123')];

    const oldIdx = index(oldBundles);
    const newIdx = index(newBundles);

    const result = diff(oldIdx, newIdx);
    expect(result.status).toBe('DRIFT');
    expect(result.removed).toContain('src/button.tsx');
    expect(result.added).toHaveLength(0);
  });

  it('should detect hash changes', () => {
    const oldBundles = [createBundle('src/App.tsx', 'uif:oldhash')];
    const newBundles = [createBundle('src/App.tsx', 'uif:newhash')];

    const oldIdx = index(oldBundles);
    const newIdx = index(newBundles);

    const result = diff(oldIdx, newIdx);
    expect(result.status).toBe('DRIFT');
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].id).toBe('src/app.tsx');
    expect(result.changed[0].deltas).toContainEqual({
      type: 'hash',
      old: 'uif:oldhash',
      new: 'uif:newhash',
    });
  });

  it('should ignore hash-only changes when ignoreHashOnly=true', () => {
    const oldBundles = [createBundle('src/App.tsx', 'uif:oldhash')];
    const newBundles = [createBundle('src/App.tsx', 'uif:newhash')];

    const oldIdx = index(oldBundles);
    const newIdx = index(newBundles);

    const result = diff(oldIdx, newIdx, false, true);
    expect(result.status).toBe('PASS');
    expect(result.changed).toHaveLength(0);
  });

  it('should report hash changes when accompanied by other changes in ignoreHashOnly mode', () => {
    const oldBundles = [
      createBundle('src/App.tsx', 'uif:oldhash', {
        graph: {
          nodes: [
            {
              entryId: 'src/App.tsx',
              contract: {
                entryId: 'src/App.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'react:component',
                description: 'Test App component',
                semanticHash: 'uif:oldhash',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: ['react'],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: { props: {}, emits: {} },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/App.tsx', 'uif:newhash', {
        graph: {
          nodes: [
            {
              entryId: 'src/App.tsx',
              contract: {
                entryId: 'src/App.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'react:component',
                description: 'Test App component',
                semanticHash: 'uif:newhash',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: ['react', 'react-dom'],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: { props: {}, emits: {} },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];

    const oldIdx = index(oldBundles);
    const newIdx = index(newBundles);

    const result = diff(oldIdx, newIdx, false, true);
    expect(result.status).toBe('DRIFT');
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].deltas).toContainEqual({
      type: 'hash',
      old: 'uif:oldhash',
      new: 'uif:newhash',
    });
    expect(result.changed[0].deltas).toContainEqual({
      type: 'imports',
      old: ['react'],
      new: ['react', 'react-dom'],
    });
  });

  it('should detect import changes', () => {
    const oldBundles = [
      createBundle('src/App.tsx', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/App.tsx',
              contract: {
                entryId: 'src/App.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'react:component',
                description: 'Test App component',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: ['react'],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: { props: {}, emits: {} },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/App.tsx', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/App.tsx',
              contract: {
                entryId: 'src/App.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'react:component',
                description: 'Test App component',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: ['react', 'react-dom'],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: { props: {}, emits: {} },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];

    const oldIdx = index(oldBundles);
    const newIdx = index(newBundles);

    const result = diff(oldIdx, newIdx);
    expect(result.status).toBe('DRIFT');
    expect(result.changed[0].deltas).toContainEqual({
      type: 'imports',
      old: ['react'],
      new: ['react', 'react-dom'],
    });
  });

  it('should detect multiple delta types in one component', () => {
    const oldBundles = [
      createBundle('src/App.tsx', 'uif:oldhash', {
        graph: {
          nodes: [
            {
              entryId: 'src/App.tsx',
              contract: {
                entryId: 'src/App.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'react:component',
                description: 'Test App component',
                semanticHash: 'uif:oldhash',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: ['react'],
                  hooks: ['useState'],
                  functions: [],
                  components: [],
                },
                interface: { props: {}, emits: {} },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/App.tsx', 'uif:newhash', {
        graph: {
          nodes: [
            {
              entryId: 'src/App.tsx',
              contract: {
                entryId: 'src/App.tsx',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'react:component',
                description: 'Test App component',
                semanticHash: 'uif:newhash',
                fileHash: 'fileHash-src-App-tsx',
                composition: {
                  variables: [],
                  imports: ['react', 'lodash'],
                  hooks: ['useState', 'useEffect'],
                  functions: [],
                  components: [],
                },
                interface: { props: {}, emits: {} },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];

    const oldIdx = index(oldBundles);
    const newIdx = index(newBundles);

    const result = diff(oldIdx, newIdx);
    expect(result.status).toBe('DRIFT');
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].deltas).toHaveLength(3); // hash, imports, hooks
    expect(result.changed[0].deltas.map(d => d.type)).toContain('hash');
    expect(result.changed[0].deltas.map(d => d.type)).toContain('imports');
    expect(result.changed[0].deltas.map(d => d.type)).toContain('hooks');
  });

  it('should detect apiSignature changes', () => {
    const oldBundles = [
      createBundle('src/api/users.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-api-users-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  apiSignature: {
                    parameters: { id: 'string' },
                    returnType: 'User',
                  },
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/api/users.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-api-users-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  apiSignature: {
                    parameters: { id: 'string', includeDeleted: 'boolean' },
                    returnType: 'User',
                  },
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];

    const oldIdx = index(oldBundles);
    const newIdx = index(newBundles);

    const result = diff(oldIdx, newIdx);
    expect(result.status).toBe('DRIFT');
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].deltas).toContainEqual({
      type: 'apiSignature',
      old: { parameters: { id: 'string' }, returnType: 'User' },
      new: { parameters: { id: 'string', includeDeleted: 'boolean' }, returnType: 'User' },
    });
  });

  it('should detect apiSignature parameter changes', () => {
    const oldBundles = [
      createBundle('src/api/users.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-api-users-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  apiSignature: {
                    parameters: { id: 'string' },
                    returnType: 'User',
                  },
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/api/users.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-api-users-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  apiSignature: {
                    parameters: { id: 'number' }, // Type changed from string to number
                    returnType: 'User',
                  },
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];

    const oldIdx = index(oldBundles);
    const newIdx = index(newBundles);

    const result = diff(oldIdx, newIdx);
    expect(result.status).toBe('DRIFT');
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].deltas).toContainEqual({
      type: 'apiSignature',
      old: { parameters: { id: 'string' }, returnType: 'User' },
      new: { parameters: { id: 'number' }, returnType: 'User' },
    });
  });

  it('should detect apiSignature returnType changes', () => {
    const oldBundles = [
      createBundle('src/api/users.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-api-users-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  apiSignature: {
                    parameters: { id: 'string' },
                    returnType: 'User',
                  },
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/api/users.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-api-users-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  apiSignature: {
                    parameters: { id: 'string' },
                    returnType: 'UserResponse', // Changed
                  },
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];

    const oldIdx = index(oldBundles);
    const newIdx = index(newBundles);

    const result = diff(oldIdx, newIdx);
    expect(result.status).toBe('DRIFT');
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].deltas).toContainEqual({
      type: 'apiSignature',
      old: { parameters: { id: 'string' }, returnType: 'User' },
      new: { parameters: { id: 'string' }, returnType: 'UserResponse' },
    });
  });

  it('should detect apiSignature requestType and responseType changes', () => {
    const oldBundles = [
      createBundle('src/api/users.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-api-users-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  apiSignature: {
                    parameters: { id: 'string' },
                    returnType: 'User',
                    requestType: 'CreateUserRequest',
                    responseType: 'UserResponse',
                  },
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/api/users.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-api-users-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  apiSignature: {
                    parameters: { id: 'string' },
                    returnType: 'User',
                    requestType: 'UpdateUserRequest', // Changed
                    responseType: 'UserResponse',
                  },
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];

    const oldIdx = index(oldBundles);
    const newIdx = index(newBundles);

    const result = diff(oldIdx, newIdx);
    expect(result.status).toBe('DRIFT');
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].deltas).toContainEqual({
      type: 'apiSignature',
      old: {
        parameters: { id: 'string' },
        returnType: 'User',
        requestType: 'CreateUserRequest',
        responseType: 'UserResponse',
      },
      new: {
        parameters: { id: 'string' },
        returnType: 'User',
        requestType: 'UpdateUserRequest',
        responseType: 'UserResponse',
      },
    });
  });

  it('should detect apiSignature added (was undefined)', () => {
    const oldBundles = [
      createBundle('src/api/users.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-api-users-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  // No apiSignature
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/api/users.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-api-users-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  apiSignature: {
                    parameters: { id: 'string' },
                    returnType: 'User',
                  },
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];

    const oldIdx = index(oldBundles);
    const newIdx = index(newBundles);

    const result = diff(oldIdx, newIdx);
    expect(result.status).toBe('DRIFT');
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].deltas).toContainEqual({
      type: 'apiSignature',
      old: null,
      new: { parameters: { id: 'string' }, returnType: 'User' },
    });
  });

  it('should detect apiSignature removed (became undefined)', () => {
    const oldBundles = [
      createBundle('src/api/users.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-api-users-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  apiSignature: {
                    parameters: { id: 'string' },
                    returnType: 'User',
                  },
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/api/users.ts', 'uif:hash123', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:hash123',
                fileHash: 'fileHash-src-api-users-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  // No apiSignature
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];

    const oldIdx = index(oldBundles);
    const newIdx = index(newBundles);

    const result = diff(oldIdx, newIdx);
    expect(result.status).toBe('DRIFT');
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].deltas).toContainEqual({
      type: 'apiSignature',
      old: { parameters: { id: 'string' }, returnType: 'User' },
      new: null,
    });
  });

  it('should include apiSignature in non-hash change detection for git baseline mode', () => {
    const oldBundles = [
      createBundle('src/api/users.ts', 'uif:oldhash', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:oldhash',
                fileHash: 'fileHash-src-api-users-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  apiSignature: {
                    parameters: { id: 'string' },
                    returnType: 'User',
                  },
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];
    const newBundles = [
      createBundle('src/api/users.ts', 'uif:newhash', {
        graph: {
          nodes: [
            {
              entryId: 'src/api/users.ts',
              contract: {
                entryId: 'src/api/users.ts',
                type: 'UIFContract',
                schemaVersion: '0.4',
                kind: 'node:api',
                description: 'Users API',
                semanticHash: 'uif:newhash',
                fileHash: 'fileHash-src-api-users-ts',
                composition: {
                  variables: [],
                  imports: [],
                  hooks: [],
                  functions: [],
                  components: [],
                },
                interface: {
                  props: {},
                  emits: {},
                  apiSignature: {
                    parameters: { id: 'string', includeDeleted: 'boolean' },
                    returnType: 'User',
                  },
                },
                exports: 'default',
              },
            },
          ],
          edges: [],
        },
      }),
    ];

    const oldIdx = index(oldBundles);
    const newIdx = index(newBundles);

    // With ignoreHashOnly=true (git baseline mode), hash should be included because apiSignature changed
    const result = diff(oldIdx, newIdx, false, true);
    expect(result.status).toBe('DRIFT');
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].deltas.map(d => d.type)).toContain('hash');
    expect(result.changed[0].deltas.map(d => d.type)).toContain('apiSignature');
  });
});
