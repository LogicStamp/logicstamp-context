/**
 * Unit tests for watch mode helper functions
 * Tests the comparison logic used in watch mode to detect changes
 */

import { describe, it, expect } from 'vitest';
import type { UIFContract } from '../../../src/types/UIFContract.js';
import type { LogicStampBundle } from '../../../src/core/pack.js';
import { compareContracts, getChanges } from '../../../src/cli/commands/context/watchDiff.js';

// Helper to create mock contracts and bundles
const createMockContract = (
  entryId: string,
  overrides: Partial<UIFContract> = {}
): UIFContract => ({
  type: 'UIFContract',
  schemaVersion: '0.4',
  kind: 'react:component',
  entryId,
  description: `Mock ${entryId}`,
  composition: {
    variables: [],
    hooks: [],
    components: [],
    functions: [],
    imports: [],
  },
  interface: {
    props: {},
    emits: {},
  },
  semanticHash: `semantic-${entryId}`,
  fileHash: `file-${entryId}`,
  ...overrides,
});

const createMockBundle = (
  entryId: string,
  contracts: UIFContract[],
  bundleHash: string = `bundle-${entryId}`
): LogicStampBundle => ({
  type: 'LogicStampBundle',
  schemaVersion: '0.1',
  entryId,
  depth: 2,
  createdAt: new Date().toISOString(),
  bundleHash,
  graph: {
    nodes: contracts.map(c => ({ entryId: c.entryId, contract: c })),
    edges: [],
  },
  meta: {
    missing: [],
    source: 'test',
  },
});

describe('compareContracts', () => {
  describe('props comparison', () => {
    it('should detect added props', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        interface: { props: { onClick: 'function' }, emits: {} },
      });
      const newContract = createMockContract('src/Button.tsx', {
        interface: { props: { onClick: 'function', disabled: 'boolean' }, emits: {} },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.props.added).toContain('disabled');
      expect(diff.props.removed).toHaveLength(0);
      expect(diff.props.changed).toHaveLength(0);
    });

    it('should detect removed props', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        interface: { props: { onClick: 'function', disabled: 'boolean' }, emits: {} },
      });
      const newContract = createMockContract('src/Button.tsx', {
        interface: { props: { onClick: 'function' }, emits: {} },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.props.removed).toContain('disabled');
      expect(diff.props.added).toHaveLength(0);
    });

    it('should detect changed props', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        interface: { props: { variant: 'string' }, emits: {} },
      });
      const newContract = createMockContract('src/Button.tsx', {
        interface: { props: { variant: { type: 'literal-union', literals: ['primary', 'secondary'] } }, emits: {} },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.props.changed).toHaveLength(1);
      expect(diff.props.changed[0].name).toBe('variant');
    });

    it('should handle identical props', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        interface: { props: { onClick: 'function' }, emits: {} },
      });
      const newContract = createMockContract('src/Button.tsx', {
        interface: { props: { onClick: 'function' }, emits: {} },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.props.added).toHaveLength(0);
      expect(diff.props.removed).toHaveLength(0);
      expect(diff.props.changed).toHaveLength(0);
    });
  });

  describe('emits comparison', () => {
    it('should detect added events', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        interface: { props: {}, emits: {} },
      });
      const newContract = createMockContract('src/Button.tsx', {
        interface: { props: {}, emits: { onClick: 'function' } },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.emits.added).toContain('onClick');
    });

    it('should detect removed events', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        interface: { props: {}, emits: { onClick: 'function', onHover: 'function' } },
      });
      const newContract = createMockContract('src/Button.tsx', {
        interface: { props: {}, emits: { onClick: 'function' } },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.emits.removed).toContain('onHover');
    });
  });

  describe('state comparison', () => {
    it('should detect added state', () => {
      const oldContract = createMockContract('src/Counter.tsx', {
        interface: { props: {}, emits: {}, state: {} },
      });
      const newContract = createMockContract('src/Counter.tsx', {
        interface: { props: {}, emits: {}, state: { count: 'number' } },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.state.added).toContain('count');
    });

    it('should detect removed state', () => {
      const oldContract = createMockContract('src/Counter.tsx', {
        interface: { props: {}, emits: {}, state: { count: 'number', isLoading: 'boolean' } },
      });
      const newContract = createMockContract('src/Counter.tsx', {
        interface: { props: {}, emits: {}, state: { count: 'number' } },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.state.removed).toContain('isLoading');
    });

    it('should detect changed state types', () => {
      const oldContract = createMockContract('src/Counter.tsx', {
        interface: { props: {}, emits: {}, state: { count: 'number' } },
      });
      const newContract = createMockContract('src/Counter.tsx', {
        interface: { props: {}, emits: {}, state: { count: 'string' } },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.state.changed).toHaveLength(1);
      expect(diff.state.changed[0].name).toBe('count');
    });
  });

  describe('version arrays comparison', () => {
    it('should detect added hooks', () => {
      const oldContract = createMockContract('src/App.tsx', {
        composition: { variables: [], hooks: ['useState'], components: [], functions: [], imports: [] },
      });
      const newContract = createMockContract('src/App.tsx', {
        composition: { variables: [], hooks: ['useState', 'useEffect'], components: [], functions: [], imports: [] },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.hooks.added).toContain('useEffect');
      expect(diff.hooks.removed).toHaveLength(0);
    });

    it('should detect removed hooks', () => {
      const oldContract = createMockContract('src/App.tsx', {
        composition: { variables: [], hooks: ['useState', 'useEffect'], components: [], functions: [], imports: [] },
      });
      const newContract = createMockContract('src/App.tsx', {
        composition: { variables: [], hooks: ['useState'], components: [], functions: [], imports: [] },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.hooks.removed).toContain('useEffect');
    });

    it('should detect added components', () => {
      const oldContract = createMockContract('src/App.tsx', {
        composition: { variables: [], hooks: [], components: ['Header'], functions: [], imports: [] },
      });
      const newContract = createMockContract('src/App.tsx', {
        composition: { variables: [], hooks: [], components: ['Header', 'Footer'], functions: [], imports: [] },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.components.added).toContain('Footer');
    });

    it('should detect added/removed functions', () => {
      const oldContract = createMockContract('src/utils.ts', {
        composition: { variables: [], hooks: [], components: [], functions: ['formatDate'], imports: [] },
      });
      const newContract = createMockContract('src/utils.ts', {
        composition: { variables: [], hooks: [], components: [], functions: ['formatDate', 'formatCurrency'], imports: [] },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.functions.added).toContain('formatCurrency');
    });

    it('should detect added/removed variables', () => {
      const oldContract = createMockContract('src/constants.ts', {
        composition: { variables: ['API_URL'], hooks: [], components: [], functions: [], imports: [] },
      });
      const newContract = createMockContract('src/constants.ts', {
        composition: { variables: ['API_URL', 'API_KEY'], hooks: [], components: [], functions: [], imports: [] },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.variables.added).toContain('API_KEY');
    });
  });

  describe('edge cases', () => {
    it('should handle empty contracts', () => {
      const oldContract = createMockContract('src/Empty.tsx');
      const newContract = createMockContract('src/Empty.tsx');

      const diff = compareContracts(oldContract, newContract);

      expect(diff.props.added).toHaveLength(0);
      expect(diff.props.removed).toHaveLength(0);
      expect(diff.props.changed).toHaveLength(0);
      expect(diff.emits.added).toHaveLength(0);
      expect(diff.hooks.added).toHaveLength(0);
    });

    it('should handle complex prop types', () => {
      const oldContract = createMockContract('src/Complex.tsx', {
        interface: {
          props: {
            config: { type: 'object', optional: true },
          },
          emits: {},
        },
      });
      const newContract = createMockContract('src/Complex.tsx', {
        interface: {
          props: {
            config: { type: 'object', optional: false },
          },
          emits: {},
        },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.props.changed).toHaveLength(1);
      expect(diff.props.changed[0].name).toBe('config');
    });
  });
});

describe('getChanges', () => {
  describe('contract changes', () => {
    it('should return null when no changes', () => {
      const contract = createMockContract('src/App.tsx');
      const oldBundles = [createMockBundle('src/App.tsx', [contract])];
      const newBundles = [createMockBundle('src/App.tsx', [contract])];

      const changes = getChanges(oldBundles, newBundles);

      expect(changes).toBeNull();
    });

    it('should detect semantic hash changes', () => {
      const oldContract = createMockContract('src/App.tsx', { semanticHash: 'hash-1' });
      const newContract = createMockContract('src/App.tsx', { semanticHash: 'hash-2' });

      const oldBundles = [createMockBundle('src/App.tsx', [oldContract])];
      const newBundles = [createMockBundle('src/App.tsx', [newContract])];

      const changes = getChanges(oldBundles, newBundles);

      expect(changes).not.toBeNull();
      expect(changes!.changed).toHaveLength(1);
      expect(changes!.changed[0].semanticHash).toEqual({ old: 'hash-1', new: 'hash-2' });
    });

    it('should detect file hash changes (cosmetic)', () => {
      const oldContract = createMockContract('src/App.tsx', {
        semanticHash: 'same-semantic',
        fileHash: 'file-1',
      });
      const newContract = createMockContract('src/App.tsx', {
        semanticHash: 'same-semantic',
        fileHash: 'file-2',
      });

      const oldBundles = [createMockBundle('src/App.tsx', [oldContract])];
      const newBundles = [createMockBundle('src/App.tsx', [newContract])];

      const changes = getChanges(oldBundles, newBundles);

      expect(changes).not.toBeNull();
      expect(changes!.changed).toHaveLength(1);
      expect(changes!.changed[0].fileHash).toEqual({ old: 'file-1', new: 'file-2' });
      expect(changes!.changed[0].semanticHash).toBeUndefined(); // Semantic didn't change
    });

    it('should detect both semantic and file hash changes', () => {
      const oldContract = createMockContract('src/App.tsx', {
        semanticHash: 'semantic-1',
        fileHash: 'file-1',
      });
      const newContract = createMockContract('src/App.tsx', {
        semanticHash: 'semantic-2',
        fileHash: 'file-2',
      });

      const oldBundles = [createMockBundle('src/App.tsx', [oldContract])];
      const newBundles = [createMockBundle('src/App.tsx', [newContract])];

      const changes = getChanges(oldBundles, newBundles);

      expect(changes).not.toBeNull();
      expect(changes!.changed[0].semanticHash).toBeDefined();
      expect(changes!.changed[0].fileHash).toBeDefined();
    });
  });

  describe('added and removed contracts', () => {
    it('should detect added contracts', () => {
      const oldContract = createMockContract('src/App.tsx');
      const newContract1 = createMockContract('src/App.tsx');
      const newContract2 = createMockContract('src/components/Button.tsx');

      const oldBundles = [createMockBundle('src/App.tsx', [oldContract])];
      const newBundles = [createMockBundle('src/App.tsx', [newContract1, newContract2])];

      const changes = getChanges(oldBundles, newBundles);

      expect(changes).not.toBeNull();
      expect(changes!.added).toContain('src/components/Button.tsx');
    });

    it('should detect removed contracts', () => {
      const oldContract1 = createMockContract('src/App.tsx');
      const oldContract2 = createMockContract('src/components/Button.tsx');
      const newContract = createMockContract('src/App.tsx');

      const oldBundles = [createMockBundle('src/App.tsx', [oldContract1, oldContract2])];
      const newBundles = [createMockBundle('src/App.tsx', [newContract])];

      const changes = getChanges(oldBundles, newBundles);

      expect(changes).not.toBeNull();
      expect(changes!.removed).toContain('src/components/Button.tsx');
    });
  });

  describe('bundle changes', () => {
    it('should detect bundle hash changes', () => {
      const contract = createMockContract('src/App.tsx');

      const oldBundles = [createMockBundle('src/App.tsx', [contract], 'bundle-hash-1')];
      const newBundles = [createMockBundle('src/App.tsx', [contract], 'bundle-hash-2')];

      const changes = getChanges(oldBundles, newBundles);

      expect(changes).not.toBeNull();
      expect(changes!.bundleChanged).toHaveLength(1);
      expect(changes!.bundleChanged[0]).toEqual({
        entryId: 'src/App.tsx',
        oldHash: 'bundle-hash-1',
        newHash: 'bundle-hash-2',
      });
    });

    it('should handle multiple bundle changes', () => {
      const contract1 = createMockContract('src/App.tsx');
      const contract2 = createMockContract('src/components/Card.tsx');

      const oldBundles = [
        createMockBundle('src/App.tsx', [contract1], 'app-hash-1'),
        createMockBundle('src/components/Card.tsx', [contract2], 'card-hash-1'),
      ];
      const newBundles = [
        createMockBundle('src/App.tsx', [contract1], 'app-hash-2'),
        createMockBundle('src/components/Card.tsx', [contract2], 'card-hash-2'),
      ];

      const changes = getChanges(oldBundles, newBundles);

      expect(changes).not.toBeNull();
      expect(changes!.bundleChanged).toHaveLength(2);
    });
  });

  describe('case insensitivity', () => {
    it('should match contracts case-insensitively', () => {
      const oldContract = createMockContract('src/App.tsx', { semanticHash: 'hash-1' });
      const newContract = createMockContract('src/app.tsx', { semanticHash: 'hash-2' }); // Different case

      const oldBundles = [createMockBundle('src/App.tsx', [oldContract])];
      const newBundles = [createMockBundle('src/app.tsx', [newContract])];

      const changes = getChanges(oldBundles, newBundles);

      // Should detect as changed, not added/removed
      expect(changes).not.toBeNull();
      expect(changes!.changed).toHaveLength(1);
      expect(changes!.added).toHaveLength(0);
      expect(changes!.removed).toHaveLength(0);
    });
  });

  describe('contract diff integration', () => {
    it('should include contract diff when semantic hash changes', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        semanticHash: 'semantic-1',
        interface: { props: { onClick: 'function' }, emits: {} },
      });
      const newContract = createMockContract('src/Button.tsx', {
        semanticHash: 'semantic-2',
        interface: { props: { onClick: 'function', disabled: 'boolean' }, emits: {} },
      });

      const oldBundles = [createMockBundle('src/Button.tsx', [oldContract])];
      const newBundles = [createMockBundle('src/Button.tsx', [newContract])];

      const changes = getChanges(oldBundles, newBundles);

      expect(changes).not.toBeNull();
      expect(changes!.changed[0].contractDiff).toBeDefined();
      expect(changes!.changed[0].contractDiff!.props.added).toContain('disabled');
    });

    it('should not include contract diff when only file hash changes', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        semanticHash: 'same-semantic',
        fileHash: 'file-1',
      });
      const newContract = createMockContract('src/Button.tsx', {
        semanticHash: 'same-semantic',
        fileHash: 'file-2',
      });

      const oldBundles = [createMockBundle('src/Button.tsx', [oldContract])];
      const newBundles = [createMockBundle('src/Button.tsx', [newContract])];

      const changes = getChanges(oldBundles, newBundles);

      expect(changes).not.toBeNull();
      expect(changes!.changed[0].contractDiff).toBeUndefined();
    });
  });

  describe('multiple contracts in bundles', () => {
    it('should handle bundles with multiple contracts', () => {
      const appContract = createMockContract('src/App.tsx');
      const buttonContract = createMockContract('src/components/Button.tsx', { semanticHash: 'btn-1' });
      const cardContract = createMockContract('src/components/Card.tsx');

      const newButtonContract = createMockContract('src/components/Button.tsx', { semanticHash: 'btn-2' });

      const oldBundles = [createMockBundle('src/App.tsx', [appContract, buttonContract, cardContract])];
      const newBundles = [createMockBundle('src/App.tsx', [appContract, newButtonContract, cardContract])];

      const changes = getChanges(oldBundles, newBundles);

      expect(changes).not.toBeNull();
      expect(changes!.changed).toHaveLength(1);
      expect(changes!.changed[0].entryId).toBe('src/components/Button.tsx');
    });
  });
});
