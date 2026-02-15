/**
 * Unit tests for watchDiff module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockBundle, createMockContract } from './helpers.js';

// Mock fsx module
vi.mock('../../../../src/utils/fsx.js', () => ({
  normalizeEntryId: (id: string) => id.replace(/\\/g, '/'),
}));

// Import after mocks
import {
  compareContracts,
  getContractFromBundles,
  getChanges,
  showChanges,
} from '../../../../src/cli/commands/context/watchDiff.js';

describe('watchDiff', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('getContractFromBundles', () => {
    it('should find contract by entryId (case-insensitive)', () => {
      const contract = createMockContract('src/App.tsx');
      const bundle = createMockBundle('src/App.tsx', [contract]);

      const result = getContractFromBundles([bundle], 'SRC/APP.TSX');

      expect(result).not.toBeNull();
      expect(result?.entryId).toBe('src/App.tsx');
    });

    it('should find contract in nested bundle', () => {
      const contract1 = createMockContract('src/App.tsx');
      const contract2 = createMockContract('src/Button.tsx');
      const bundle = createMockBundle('src/App.tsx', [contract1, contract2]);

      const result = getContractFromBundles([bundle], 'src/Button.tsx');

      expect(result).not.toBeNull();
      expect(result?.entryId).toBe('src/Button.tsx');
    });

    it('should return null when contract not found', () => {
      const bundle = createMockBundle('src/App.tsx');

      const result = getContractFromBundles([bundle], 'src/NonExistent.tsx');

      expect(result).toBeNull();
    });

    it('should handle backslash paths (Windows)', () => {
      const contract = createMockContract('src/components/Button.tsx');
      const bundle = createMockBundle('src/components/Button.tsx', [contract]);

      const result = getContractFromBundles([bundle], 'src\\components\\Button.tsx');

      expect(result).not.toBeNull();
      expect(result?.entryId).toBe('src/components/Button.tsx');
    });
  });

  describe('compareContracts', () => {
    it('should detect added props', () => {
      const oldContract = createMockContract('src/Button.tsx');
      const newContract = createMockContract('src/Button.tsx', {
        interface: {
          props: { variant: 'string', size: 'string' },
          emits: {},
        },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.props.added).toContain('variant');
      expect(diff.props.added).toContain('size');
    });

    it('should detect removed props', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        interface: {
          props: { variant: 'string', size: 'string' },
          emits: {},
        },
      });
      const newContract = createMockContract('src/Button.tsx');

      const diff = compareContracts(oldContract, newContract);

      expect(diff.props.removed).toContain('variant');
      expect(diff.props.removed).toContain('size');
    });

    it('should detect changed props', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        interface: {
          props: { variant: 'string' },
          emits: {},
        },
      });
      const newContract = createMockContract('src/Button.tsx', {
        interface: {
          props: { variant: ['primary', 'secondary'] },
          emits: {},
        },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.props.changed.length).toBe(1);
      expect(diff.props.changed[0].name).toBe('variant');
    });

    it('should detect added emits', () => {
      const oldContract = createMockContract('src/Button.tsx');
      const newContract = createMockContract('src/Button.tsx', {
        interface: {
          props: {},
          emits: { onClick: 'function' },
        },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.emits.added).toContain('onClick');
    });

    it('should detect removed emits', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        interface: {
          props: {},
          emits: { onClick: 'function' },
        },
      });
      const newContract = createMockContract('src/Button.tsx');

      const diff = compareContracts(oldContract, newContract);

      expect(diff.emits.removed).toContain('onClick');
    });

    it('should detect added/removed state', () => {
      const oldContract = createMockContract('src/Counter.tsx', {
        interface: {
          props: {},
          emits: {},
          state: { count: 'number' },
        },
      });
      const newContract = createMockContract('src/Counter.tsx', {
        interface: {
          props: {},
          emits: {},
          state: { value: 'number' },
        },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.state.added).toContain('value');
      expect(diff.state.removed).toContain('count');
    });

    it('should detect added/removed hooks', () => {
      const oldContract = createMockContract('src/App.tsx', {
        composition: {
          variables: [],
          hooks: ['useState'],
          components: [],
          functions: [],
          imports: [],
        },
      });
      const newContract = createMockContract('src/App.tsx', {
        composition: {
          variables: [],
          hooks: ['useState', 'useEffect'],
          components: [],
          functions: [],
          imports: [],
        },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.hooks.added).toContain('useEffect');
    });

    it('should detect added/removed components', () => {
      const oldContract = createMockContract('src/App.tsx', {
        composition: {
          variables: [],
          hooks: [],
          components: ['Button'],
          functions: [],
          imports: [],
        },
      });
      const newContract = createMockContract('src/App.tsx', {
        composition: {
          variables: [],
          hooks: [],
          components: ['Button', 'Card'],
          functions: [],
          imports: [],
        },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.components.added).toContain('Card');
    });

    it('should detect added/removed variables', () => {
      const oldContract = createMockContract('src/utils.ts', {
        composition: {
          variables: ['MAX_SIZE'],
          hooks: [],
          components: [],
          functions: [],
          imports: [],
        },
      });
      const newContract = createMockContract('src/utils.ts', {
        composition: {
          variables: ['MAX_SIZE', 'MIN_SIZE'],
          hooks: [],
          components: [],
          functions: [],
          imports: [],
        },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.variables.added).toContain('MIN_SIZE');
    });

    it('should detect added/removed functions', () => {
      const oldContract = createMockContract('src/utils.ts', {
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: ['formatDate'],
          imports: [],
        },
      });
      const newContract = createMockContract('src/utils.ts', {
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: ['formatDate', 'parseDate'],
          imports: [],
        },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.functions.added).toContain('parseDate');
    });
  });

  describe('getChanges', () => {
    it('should return null when no changes', () => {
      const contract = createMockContract('src/App.tsx');
      const bundle = createMockBundle('src/App.tsx', [contract]);

      const changes = getChanges([bundle], [bundle]);

      expect(changes).toBeNull();
    });

    it('should detect added contracts', () => {
      const oldBundle = createMockBundle('src/App.tsx', [createMockContract('src/App.tsx')]);
      const newBundle = createMockBundle('src/App.tsx', [
        createMockContract('src/App.tsx'),
        createMockContract('src/Button.tsx'),
      ]);

      const changes = getChanges([oldBundle], [newBundle]);

      expect(changes).not.toBeNull();
      expect(changes?.added).toContain('src/Button.tsx');
    });

    it('should detect removed contracts', () => {
      const oldBundle = createMockBundle('src/App.tsx', [
        createMockContract('src/App.tsx'),
        createMockContract('src/Button.tsx'),
      ]);
      const newBundle = createMockBundle('src/App.tsx', [createMockContract('src/App.tsx')]);

      const changes = getChanges([oldBundle], [newBundle]);

      expect(changes).not.toBeNull();
      expect(changes?.removed).toContain('src/Button.tsx');
    });

    it('should detect changed contracts via semanticHash', () => {
      const oldContract = createMockContract('src/App.tsx', {
        semanticHash: 'old-semantic-hash',
      });
      const newContract = createMockContract('src/App.tsx', {
        semanticHash: 'new-semantic-hash',
      });

      const oldBundle = createMockBundle('src/App.tsx', [oldContract]);
      const newBundle = createMockBundle('src/App.tsx', [newContract]);

      const changes = getChanges([oldBundle], [newBundle]);

      expect(changes).not.toBeNull();
      expect(changes?.changed.length).toBe(1);
      expect(changes?.changed[0].entryId).toBe('src/App.tsx');
      expect(changes?.changed[0].semanticHash).toBeDefined();
    });

    it('should detect changed contracts via fileHash', () => {
      const oldContract = createMockContract('src/App.tsx', {
        fileHash: 'old-file-hash',
      });
      const newContract = createMockContract('src/App.tsx', {
        fileHash: 'new-file-hash',
      });

      const oldBundle = createMockBundle('src/App.tsx', [oldContract]);
      const newBundle = createMockBundle('src/App.tsx', [newContract]);

      const changes = getChanges([oldBundle], [newBundle]);

      expect(changes).not.toBeNull();
      expect(changes?.changed[0].fileHash).toBeDefined();
    });

    it('should detect changed bundles via bundleHash', () => {
      const contract = createMockContract('src/App.tsx');
      const oldBundle = createMockBundle('src/App.tsx', [contract]);
      oldBundle.bundleHash = 'old-bundle-hash';

      const newBundle = createMockBundle('src/App.tsx', [contract]);
      newBundle.bundleHash = 'new-bundle-hash';

      const changes = getChanges([oldBundle], [newBundle]);

      expect(changes).not.toBeNull();
      expect(changes?.bundleChanged.length).toBe(1);
      expect(changes?.bundleChanged[0].oldHash).toBe('old-bundle-hash');
      expect(changes?.bundleChanged[0].newHash).toBe('new-bundle-hash');
    });
  });

  describe('showChanges', () => {
    it('should not log anything when no changes', () => {
      const contract = createMockContract('src/App.tsx');
      const bundle = createMockBundle('src/App.tsx', [contract]);

      showChanges([bundle], [bundle], 'src/App.tsx');

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should show modified contract info', () => {
      const oldContract = createMockContract('src/App.tsx', {
        semanticHash: 'old-hash',
        interface: { props: {}, emits: {} },
      });
      const newContract = createMockContract('src/App.tsx', {
        semanticHash: 'new-hash',
        interface: { props: { newProp: 'string' }, emits: {} },
      });

      const oldBundle = createMockBundle('src/App.tsx', [oldContract]);
      const newBundle = createMockBundle('src/App.tsx', [newContract]);

      showChanges([oldBundle], [newBundle], 'src/App.tsx');

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Modified contract');
    });

    it('should show added contract info', () => {
      const oldBundle = createMockBundle('src/App.tsx', [createMockContract('src/App.tsx')]);
      const newBundle = createMockBundle('src/App.tsx', [
        createMockContract('src/App.tsx'),
        createMockContract('src/Button.tsx'),
      ]);

      showChanges([oldBundle], [newBundle], 'src/Button.tsx');

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Added contract');
    });

    it('should show removed contract info', () => {
      const oldBundle = createMockBundle('src/App.tsx', [
        createMockContract('src/App.tsx'),
        createMockContract('src/Button.tsx'),
      ]);
      const newBundle = createMockBundle('src/App.tsx', [createMockContract('src/App.tsx')]);

      showChanges([oldBundle], [newBundle], 'src/Button.tsx');

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Removed contract');
    });

    it('should show debug mode hash details', () => {
      const oldContract = createMockContract('src/App.tsx', {
        semanticHash: 'old-semantic-hash-value',
      });
      const newContract = createMockContract('src/App.tsx', {
        semanticHash: 'new-semantic-hash-value',
      });

      const oldBundle = createMockBundle('src/App.tsx', [oldContract]);
      const newBundle = createMockBundle('src/App.tsx', [newContract]);

      showChanges([oldBundle], [newBundle], 'src/App.tsx', { debug: true });

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('[DEBUG]');
      expect(calls).toContain('semanticHash');
    });

    it('should show prop changes in debug mode', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        semanticHash: 'old-hash',
        interface: { props: { variant: 'string' }, emits: {} },
      });
      const newContract = createMockContract('src/Button.tsx', {
        semanticHash: 'new-hash',
        interface: { props: { variant: 'string', size: 'string' }, emits: {} },
      });

      const oldBundle = createMockBundle('src/Button.tsx', [oldContract]);
      const newBundle = createMockBundle('src/Button.tsx', [newContract]);

      showChanges([oldBundle], [newBundle], 'src/Button.tsx', { debug: true });

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Props');
    });
  });
});
