/**
 * Unit tests for watch mode helper functions
 * Tests the comparison logic used in watch mode to detect changes
 */

import { describe, it, expect } from 'vitest';
import type { UIFContract } from '../../../src/types/UIFContract.js';
import type { LogicStampBundle } from '../../../src/core/pack.js';

/**
 * Test version of compareContracts from watchMode.ts
 * Compares two contracts and returns detailed diff
 */
function compareContracts(oldContract: UIFContract, newContract: UIFContract): {
  props: { added: string[]; removed: string[]; changed: Array<{ name: string; old: any; new: any }> };
  emits: { added: string[]; removed: string[]; changed: Array<{ name: string; old: any; new: any }> };
  state: { added: string[]; removed: string[]; changed: Array<{ name: string; old: any; new: any }> };
  hooks: { added: string[]; removed: string[] };
  components: { added: string[]; removed: string[] };
  variables: { added: string[]; removed: string[] };
  functions: { added: string[]; removed: string[] };
} {
  const diff = {
    props: { added: [] as string[], removed: [] as string[], changed: [] as Array<{ name: string; old: any; new: any }> },
    emits: { added: [] as string[], removed: [] as string[], changed: [] as Array<{ name: string; old: any; new: any }> },
    state: { added: [] as string[], removed: [] as string[], changed: [] as Array<{ name: string; old: any; new: any }> },
    hooks: { added: [] as string[], removed: [] as string[] },
    components: { added: [] as string[], removed: [] as string[] },
    variables: { added: [] as string[], removed: [] as string[] },
    functions: { added: [] as string[], removed: [] as string[] },
  };

  // Compare props
  const oldProps = oldContract.logicSignature.props || {};
  const newProps = newContract.logicSignature.props || {};
  for (const [key, value] of Object.entries(newProps)) {
    if (!(key in oldProps)) {
      diff.props.added.push(key);
    } else if (JSON.stringify(oldProps[key]) !== JSON.stringify(value)) {
      diff.props.changed.push({ name: key, old: oldProps[key], new: value });
    }
  }
  for (const key of Object.keys(oldProps)) {
    if (!(key in newProps)) {
      diff.props.removed.push(key);
    }
  }

  // Compare emits
  const oldEmits = oldContract.logicSignature.emits || {};
  const newEmits = newContract.logicSignature.emits || {};
  for (const [key, value] of Object.entries(newEmits)) {
    if (!(key in oldEmits)) {
      diff.emits.added.push(key);
    } else if (JSON.stringify(oldEmits[key]) !== JSON.stringify(value)) {
      diff.emits.changed.push({ name: key, old: oldEmits[key], new: value });
    }
  }
  for (const key of Object.keys(oldEmits)) {
    if (!(key in newEmits)) {
      diff.emits.removed.push(key);
    }
  }

  // Compare state
  const oldState = oldContract.logicSignature.state || {};
  const newState = newContract.logicSignature.state || {};
  for (const [key, value] of Object.entries(newState)) {
    if (!(key in oldState)) {
      diff.state.added.push(key);
    } else if (JSON.stringify(oldState[key]) !== JSON.stringify(value)) {
      diff.state.changed.push({ name: key, old: oldState[key], new: value });
    }
  }
  for (const key of Object.keys(oldState)) {
    if (!(key in newState)) {
      diff.state.removed.push(key);
    }
  }

  // Compare version arrays
  const compareArrays = (oldArr: string[], newArr: string[], diffObj: { added: string[]; removed: string[] }) => {
    const oldSet = new Set(oldArr);
    const newSet = new Set(newArr);
    for (const item of newSet) {
      if (!oldSet.has(item)) {
        diffObj.added.push(item);
      }
    }
    for (const item of oldSet) {
      if (!newSet.has(item)) {
        diffObj.removed.push(item);
      }
    }
  };

  compareArrays(oldContract.version.hooks || [], newContract.version.hooks || [], diff.hooks);
  compareArrays(oldContract.version.components || [], newContract.version.components || [], diff.components);
  compareArrays(oldContract.version.variables || [], newContract.version.variables || [], diff.variables);
  compareArrays(oldContract.version.functions || [], newContract.version.functions || [], diff.functions);

  return diff;
}

/**
 * Normalize entry ID for comparison
 */
function normalizeEntryId(id: string): string {
  return id.replace(/\\/g, '/');
}

/**
 * Test version of getChanges from watchMode.ts
 * Compares old and new bundles to detect changes
 */
function getChanges(
  oldBundles: LogicStampBundle[],
  newBundles: LogicStampBundle[],
  compareContractsFn: typeof compareContracts
): {
  changed: Array<{
    entryId: string;
    semanticHash?: { old: string; new: string };
    fileHash?: { old: string; new: string };
    contractDiff?: ReturnType<typeof compareContracts>;
  }>;
  added: string[];
  removed: string[];
  bundleChanged: Array<{ entryId: string; oldHash: string; newHash: string }>;
} | null {
  // Index contracts
  const indexContracts = (bundles: LogicStampBundle[]): Map<string, {
    semanticHash: string;
    fileHash: string;
    entryId: string;
    contract: UIFContract;
  }> => {
    const m = new Map();
    for (const b of bundles) {
      for (const n of b.graph.nodes) {
        const normalizedId = normalizeEntryId(n.contract.entryId).toLowerCase();
        m.set(normalizedId, {
          semanticHash: n.contract.semanticHash,
          fileHash: n.contract.fileHash,
          entryId: n.contract.entryId,
          contract: n.contract,
        });
      }
    }
    return m;
  };

  // Index bundles
  const indexBundles = (bundles: LogicStampBundle[]): Map<string, { bundleHash: string; entryId: string }> => {
    const m = new Map();
    for (const b of bundles) {
      const normalizedId = normalizeEntryId(b.entryId).toLowerCase();
      m.set(normalizedId, {
        bundleHash: b.bundleHash,
        entryId: b.entryId,
      });
    }
    return m;
  };

  const oldContractIdx = indexContracts(oldBundles);
  const newContractIdx = indexContracts(newBundles);
  const oldBundleIdx = indexBundles(oldBundles);
  const newBundleIdx = indexBundles(newBundles);

  const changed: Array<{
    entryId: string;
    semanticHash?: { old: string; new: string };
    fileHash?: { old: string; new: string };
    contractDiff?: ReturnType<typeof compareContracts>;
  }> = [];
  const added: string[] = [];
  const removed: string[] = [];
  const bundleChanged: Array<{ entryId: string; oldHash: string; newHash: string }> = [];

  // Find changed contracts
  for (const [id, newContract] of newContractIdx.entries()) {
    const oldContract = oldContractIdx.get(id);
    if (oldContract) {
      const changes: {
        semanticHash?: { old: string; new: string };
        fileHash?: { old: string; new: string };
        contractDiff?: ReturnType<typeof compareContracts>;
      } = {};

      if (oldContract.semanticHash !== newContract.semanticHash) {
        changes.semanticHash = { old: oldContract.semanticHash, new: newContract.semanticHash };
        changes.contractDiff = compareContractsFn(oldContract.contract, newContract.contract);
      }

      if (oldContract.fileHash !== newContract.fileHash) {
        changes.fileHash = { old: oldContract.fileHash, new: newContract.fileHash };
      }

      if (Object.keys(changes).length > 0) {
        changed.push({ entryId: newContract.entryId, ...changes });
      }
    } else {
      added.push(newContract.entryId);
    }
  }

  // Find removed contracts
  for (const [id, oldContract] of oldContractIdx.entries()) {
    if (!newContractIdx.has(id)) {
      removed.push(oldContract.entryId);
    }
  }

  // Find changed bundles
  for (const [id, newBundle] of newBundleIdx.entries()) {
    const oldBundle = oldBundleIdx.get(id);
    if (oldBundle && oldBundle.bundleHash !== newBundle.bundleHash) {
      bundleChanged.push({
        entryId: newBundle.entryId,
        oldHash: oldBundle.bundleHash,
        newHash: newBundle.bundleHash,
      });
    }
  }

  if (changed.length === 0 && added.length === 0 && removed.length === 0 && bundleChanged.length === 0) {
    return null;
  }

  return { changed, added, removed, bundleChanged };
}

// Helper to create mock contracts and bundles
const createMockContract = (
  entryId: string,
  overrides: Partial<UIFContract> = {}
): UIFContract => ({
  type: 'UIFContract',
  schemaVersion: '0.3',
  kind: 'react:component',
  entryId,
  description: `Mock ${entryId}`,
  version: {
    variables: [],
    hooks: [],
    components: [],
    functions: [],
    imports: [],
  },
  logicSignature: {
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
        logicSignature: { props: { onClick: 'function' }, emits: {} },
      });
      const newContract = createMockContract('src/Button.tsx', {
        logicSignature: { props: { onClick: 'function', disabled: 'boolean' }, emits: {} },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.props.added).toContain('disabled');
      expect(diff.props.removed).toHaveLength(0);
      expect(diff.props.changed).toHaveLength(0);
    });

    it('should detect removed props', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        logicSignature: { props: { onClick: 'function', disabled: 'boolean' }, emits: {} },
      });
      const newContract = createMockContract('src/Button.tsx', {
        logicSignature: { props: { onClick: 'function' }, emits: {} },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.props.removed).toContain('disabled');
      expect(diff.props.added).toHaveLength(0);
    });

    it('should detect changed props', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        logicSignature: { props: { variant: 'string' }, emits: {} },
      });
      const newContract = createMockContract('src/Button.tsx', {
        logicSignature: { props: { variant: { type: 'literal-union', literals: ['primary', 'secondary'] } }, emits: {} },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.props.changed).toHaveLength(1);
      expect(diff.props.changed[0].name).toBe('variant');
    });

    it('should handle identical props', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        logicSignature: { props: { onClick: 'function' }, emits: {} },
      });
      const newContract = createMockContract('src/Button.tsx', {
        logicSignature: { props: { onClick: 'function' }, emits: {} },
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
        logicSignature: { props: {}, emits: {} },
      });
      const newContract = createMockContract('src/Button.tsx', {
        logicSignature: { props: {}, emits: { onClick: 'function' } },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.emits.added).toContain('onClick');
    });

    it('should detect removed events', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        logicSignature: { props: {}, emits: { onClick: 'function', onHover: 'function' } },
      });
      const newContract = createMockContract('src/Button.tsx', {
        logicSignature: { props: {}, emits: { onClick: 'function' } },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.emits.removed).toContain('onHover');
    });
  });

  describe('state comparison', () => {
    it('should detect added state', () => {
      const oldContract = createMockContract('src/Counter.tsx', {
        logicSignature: { props: {}, emits: {}, state: {} },
      });
      const newContract = createMockContract('src/Counter.tsx', {
        logicSignature: { props: {}, emits: {}, state: { count: 'number' } },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.state.added).toContain('count');
    });

    it('should detect removed state', () => {
      const oldContract = createMockContract('src/Counter.tsx', {
        logicSignature: { props: {}, emits: {}, state: { count: 'number', isLoading: 'boolean' } },
      });
      const newContract = createMockContract('src/Counter.tsx', {
        logicSignature: { props: {}, emits: {}, state: { count: 'number' } },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.state.removed).toContain('isLoading');
    });

    it('should detect changed state types', () => {
      const oldContract = createMockContract('src/Counter.tsx', {
        logicSignature: { props: {}, emits: {}, state: { count: 'number' } },
      });
      const newContract = createMockContract('src/Counter.tsx', {
        logicSignature: { props: {}, emits: {}, state: { count: 'string' } },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.state.changed).toHaveLength(1);
      expect(diff.state.changed[0].name).toBe('count');
    });
  });

  describe('version arrays comparison', () => {
    it('should detect added hooks', () => {
      const oldContract = createMockContract('src/App.tsx', {
        version: { variables: [], hooks: ['useState'], components: [], functions: [], imports: [] },
      });
      const newContract = createMockContract('src/App.tsx', {
        version: { variables: [], hooks: ['useState', 'useEffect'], components: [], functions: [], imports: [] },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.hooks.added).toContain('useEffect');
      expect(diff.hooks.removed).toHaveLength(0);
    });

    it('should detect removed hooks', () => {
      const oldContract = createMockContract('src/App.tsx', {
        version: { variables: [], hooks: ['useState', 'useEffect'], components: [], functions: [], imports: [] },
      });
      const newContract = createMockContract('src/App.tsx', {
        version: { variables: [], hooks: ['useState'], components: [], functions: [], imports: [] },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.hooks.removed).toContain('useEffect');
    });

    it('should detect added components', () => {
      const oldContract = createMockContract('src/App.tsx', {
        version: { variables: [], hooks: [], components: ['Header'], functions: [], imports: [] },
      });
      const newContract = createMockContract('src/App.tsx', {
        version: { variables: [], hooks: [], components: ['Header', 'Footer'], functions: [], imports: [] },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.components.added).toContain('Footer');
    });

    it('should detect added/removed functions', () => {
      const oldContract = createMockContract('src/utils.ts', {
        version: { variables: [], hooks: [], components: [], functions: ['formatDate'], imports: [] },
      });
      const newContract = createMockContract('src/utils.ts', {
        version: { variables: [], hooks: [], components: [], functions: ['formatDate', 'formatCurrency'], imports: [] },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.functions.added).toContain('formatCurrency');
    });

    it('should detect added/removed variables', () => {
      const oldContract = createMockContract('src/constants.ts', {
        version: { variables: ['API_URL'], hooks: [], components: [], functions: [], imports: [] },
      });
      const newContract = createMockContract('src/constants.ts', {
        version: { variables: ['API_URL', 'API_KEY'], hooks: [], components: [], functions: [], imports: [] },
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
        logicSignature: {
          props: {
            config: { type: 'object', optional: true },
          },
          emits: {},
        },
      });
      const newContract = createMockContract('src/Complex.tsx', {
        logicSignature: {
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

      const changes = getChanges(oldBundles, newBundles, compareContracts);

      expect(changes).toBeNull();
    });

    it('should detect semantic hash changes', () => {
      const oldContract = createMockContract('src/App.tsx', { semanticHash: 'hash-1' });
      const newContract = createMockContract('src/App.tsx', { semanticHash: 'hash-2' });

      const oldBundles = [createMockBundle('src/App.tsx', [oldContract])];
      const newBundles = [createMockBundle('src/App.tsx', [newContract])];

      const changes = getChanges(oldBundles, newBundles, compareContracts);

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

      const changes = getChanges(oldBundles, newBundles, compareContracts);

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

      const changes = getChanges(oldBundles, newBundles, compareContracts);

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

      const changes = getChanges(oldBundles, newBundles, compareContracts);

      expect(changes).not.toBeNull();
      expect(changes!.added).toContain('src/components/Button.tsx');
    });

    it('should detect removed contracts', () => {
      const oldContract1 = createMockContract('src/App.tsx');
      const oldContract2 = createMockContract('src/components/Button.tsx');
      const newContract = createMockContract('src/App.tsx');

      const oldBundles = [createMockBundle('src/App.tsx', [oldContract1, oldContract2])];
      const newBundles = [createMockBundle('src/App.tsx', [newContract])];

      const changes = getChanges(oldBundles, newBundles, compareContracts);

      expect(changes).not.toBeNull();
      expect(changes!.removed).toContain('src/components/Button.tsx');
    });
  });

  describe('bundle changes', () => {
    it('should detect bundle hash changes', () => {
      const contract = createMockContract('src/App.tsx');

      const oldBundles = [createMockBundle('src/App.tsx', [contract], 'bundle-hash-1')];
      const newBundles = [createMockBundle('src/App.tsx', [contract], 'bundle-hash-2')];

      const changes = getChanges(oldBundles, newBundles, compareContracts);

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

      const changes = getChanges(oldBundles, newBundles, compareContracts);

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

      const changes = getChanges(oldBundles, newBundles, compareContracts);

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
        logicSignature: { props: { onClick: 'function' }, emits: {} },
      });
      const newContract = createMockContract('src/Button.tsx', {
        semanticHash: 'semantic-2',
        logicSignature: { props: { onClick: 'function', disabled: 'boolean' }, emits: {} },
      });

      const oldBundles = [createMockBundle('src/Button.tsx', [oldContract])];
      const newBundles = [createMockBundle('src/Button.tsx', [newContract])];

      const changes = getChanges(oldBundles, newBundles, compareContracts);

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

      const changes = getChanges(oldBundles, newBundles, compareContracts);

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

      const changes = getChanges(oldBundles, newBundles, compareContracts);

      expect(changes).not.toBeNull();
      expect(changes!.changed).toHaveLength(1);
      expect(changes!.changed[0].entryId).toBe('src/components/Button.tsx');
    });
  });
});
