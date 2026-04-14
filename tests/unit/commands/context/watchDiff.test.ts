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
} from '../../../../src/cli/commands/context/watchMode/watchDiff.js';

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

      const result = getContractFromBundles(
        [bundle],
        'src\\components\\Button.tsx',
      );

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

    it('should detect changed emits', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        interface: {
          props: {},
          emits: { onClick: { type: 'function', signature: '() => void' } },
        },
      });
      const newContract = createMockContract('src/Button.tsx', {
        interface: {
          props: {},
          emits: {
            onClick: {
              type: 'function',
              signature: '(event: MouseEvent) => void',
            },
          },
        },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.emits.changed.length).toBe(1);
      expect(diff.emits.changed[0].name).toBe('onClick');
    });

    it('should detect changed state', () => {
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
          state: { count: 'string' },
        },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.state.changed.length).toBe(1);
      expect(diff.state.changed[0].name).toBe('count');
    });

    it('should handle empty composition gracefully', () => {
      const oldContract = createMockContract('src/App.tsx', {
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
          imports: [],
        },
      });
      const newContract = createMockContract('src/App.tsx', {
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
          imports: [],
        },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.props.added).toHaveLength(0);
      expect(diff.props.removed).toHaveLength(0);
      expect(diff.props.changed).toHaveLength(0);
      expect(diff.hooks.added).toHaveLength(0);
      expect(diff.hooks.removed).toHaveLength(0);
    });

    it('should handle undefined composition arrays', () => {
      const oldContract = createMockContract('src/App.tsx');
      // Remove composition arrays
      (oldContract.composition as unknown as Record<string, unknown>).hooks =
        undefined;
      (
        oldContract.composition as unknown as Record<string, unknown>
      ).components = undefined;

      const newContract = createMockContract('src/App.tsx', {
        composition: {
          variables: [],
          hooks: ['useState'],
          components: ['Button'],
          functions: [],
          imports: [],
        },
      });

      const diff = compareContracts(oldContract, newContract);

      expect(diff.hooks.added).toContain('useState');
      expect(diff.components.added).toContain('Button');
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
      const oldBundle = createMockBundle('src/App.tsx', [
        createMockContract('src/App.tsx'),
      ]);
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
      const newBundle = createMockBundle('src/App.tsx', [
        createMockContract('src/App.tsx'),
      ]);

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

    it('should detect both semanticHash and fileHash changes', () => {
      const oldContract = createMockContract('src/App.tsx', {
        semanticHash: 'old-semantic-hash',
        fileHash: 'old-file-hash',
      });
      const newContract = createMockContract('src/App.tsx', {
        semanticHash: 'new-semantic-hash',
        fileHash: 'new-file-hash',
      });

      const oldBundle = createMockBundle('src/App.tsx', [oldContract]);
      const newBundle = createMockBundle('src/App.tsx', [newContract]);

      const changes = getChanges([oldBundle], [newBundle]);

      expect(changes).not.toBeNull();
      expect(changes?.changed[0].semanticHash).toBeDefined();
      expect(changes?.changed[0].fileHash).toBeDefined();
    });

    it('should handle multiple bundles', () => {
      const oldBundles = [
        createMockBundle('src/App.tsx', [createMockContract('src/App.tsx')]),
        createMockBundle('src/Button.tsx', [
          createMockContract('src/Button.tsx'),
        ]),
      ];
      const newBundles = [
        createMockBundle('src/App.tsx', [createMockContract('src/App.tsx')]),
        createMockBundle('src/Button.tsx', [
          createMockContract('src/Button.tsx'),
        ]),
        createMockBundle('src/Card.tsx', [createMockContract('src/Card.tsx')]),
      ];

      const changes = getChanges(oldBundles, newBundles);

      expect(changes).not.toBeNull();
      expect(changes?.added).toContain('src/Card.tsx');
    });

    it('should include contractDiff for semanticHash changes', () => {
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

      const changes = getChanges([oldBundle], [newBundle]);

      expect(changes).not.toBeNull();
      expect(changes?.changed[0].contractDiff).toBeDefined();
      expect(changes?.changed[0].contractDiff?.props.added).toContain('size');
    });

    it('should handle case-insensitive contract matching', () => {
      const oldContract = createMockContract('src/App.tsx');
      const newContract = createMockContract('SRC/APP.TSX');

      const oldBundle = createMockBundle('src/App.tsx', [oldContract]);
      const newBundle = createMockBundle('SRC/APP.TSX', [newContract]);

      // Should not detect as added/removed since it's the same file (case-insensitive)
      const changes = getChanges([oldBundle], [newBundle]);

      // The contracts should match case-insensitively
      expect(
        changes?.added?.includes('SRC/APP.TSX') ||
          changes?.removed?.includes('src/App.tsx'),
      ).toBeFalsy;
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
      const oldBundle = createMockBundle('src/App.tsx', [
        createMockContract('src/App.tsx'),
      ]);
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
      const newBundle = createMockBundle('src/App.tsx', [
        createMockContract('src/App.tsx'),
      ]);

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

    it('should show multiple bundle changes (>3 bundles)', () => {
      const oldBundles = [1, 2, 3, 4, 5].map((i) => {
        const b = createMockBundle(`src/Component${i}.tsx`);
        b.bundleHash = `old-hash-${i}`;
        return b;
      });
      const newBundles = [1, 2, 3, 4, 5].map((i) => {
        const b = createMockBundle(`src/Component${i}.tsx`);
        b.bundleHash = `new-hash-${i}`;
        return b;
      });

      showChanges(oldBundles, newBundles, 'src/Component1.tsx');

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Modified bundles');
      expect(calls).toContain('and 3 more');
    });

    it('should show cosmetic change message in debug mode', () => {
      const oldContract = createMockContract('src/App.tsx', {
        semanticHash: 'same-hash',
        fileHash: 'old-file-hash',
      });
      const newContract = createMockContract('src/App.tsx', {
        semanticHash: 'same-hash',
        fileHash: 'new-file-hash',
      });

      const oldBundle = createMockBundle('src/App.tsx', [oldContract]);
      const newBundle = createMockBundle('src/App.tsx', [newContract]);

      showChanges([oldBundle], [newBundle], 'src/App.tsx', { debug: true });

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Cosmetic change only');
    });

    it('should show emits changes', () => {
      const oldContract = createMockContract('src/Form.tsx', {
        semanticHash: 'old-hash',
        interface: { props: {}, emits: { onSubmit: 'function' } },
      });
      const newContract = createMockContract('src/Form.tsx', {
        semanticHash: 'new-hash',
        interface: { props: {}, emits: {} },
      });

      const oldBundle = createMockBundle('src/Form.tsx', [oldContract]);
      const newBundle = createMockBundle('src/Form.tsx', [newContract]);

      showChanges([oldBundle], [newBundle], 'src/Form.tsx');

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Removed events');
    });

    it('should show state changes', () => {
      const oldContract = createMockContract('src/Counter.tsx', {
        semanticHash: 'old-hash',
        interface: { props: {}, emits: {}, state: { count: 'number' } },
      });
      const newContract = createMockContract('src/Counter.tsx', {
        semanticHash: 'new-hash',
        interface: { props: {}, emits: {}, state: {} },
      });

      const oldBundle = createMockBundle('src/Counter.tsx', [oldContract]);
      const newBundle = createMockBundle('src/Counter.tsx', [newContract]);

      showChanges([oldBundle], [newBundle], 'src/Counter.tsx');

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Removed state');
    });

    it('should show hooks changes', () => {
      const oldContract = createMockContract('src/App.tsx', {
        semanticHash: 'old-hash',
        composition: {
          variables: [],
          hooks: ['useState'],
          components: [],
          functions: [],
          imports: [],
        },
      });
      const newContract = createMockContract('src/App.tsx', {
        semanticHash: 'new-hash',
        composition: {
          variables: [],
          hooks: ['useState', 'useEffect', 'useMemo'],
          components: [],
          functions: [],
          imports: [],
        },
      });

      const oldBundle = createMockBundle('src/App.tsx', [oldContract]);
      const newBundle = createMockBundle('src/App.tsx', [newContract]);

      showChanges([oldBundle], [newBundle], 'src/App.tsx');

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Added hooks');
    });

    it('should show components changes', () => {
      const oldContract = createMockContract('src/App.tsx', {
        semanticHash: 'old-hash',
        composition: {
          variables: [],
          hooks: [],
          components: ['Button', 'Card'],
          functions: [],
          imports: [],
        },
      });
      const newContract = createMockContract('src/App.tsx', {
        semanticHash: 'new-hash',
        composition: {
          variables: [],
          hooks: [],
          components: ['Button'],
          functions: [],
          imports: [],
        },
      });

      const oldBundle = createMockBundle('src/App.tsx', [oldContract]);
      const newBundle = createMockBundle('src/App.tsx', [newContract]);

      showChanges([oldBundle], [newBundle], 'src/App.tsx');

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Removed components');
    });

    it('should show variables changes', () => {
      const oldContract = createMockContract('src/constants.ts', {
        semanticHash: 'old-hash',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: [],
          imports: [],
        },
      });
      const newContract = createMockContract('src/constants.ts', {
        semanticHash: 'new-hash',
        composition: {
          variables: ['MAX_SIZE', 'DEFAULT_TIMEOUT'],
          hooks: [],
          components: [],
          functions: [],
          imports: [],
        },
      });

      const oldBundle = createMockBundle('src/constants.ts', [oldContract]);
      const newBundle = createMockBundle('src/constants.ts', [newContract]);

      showChanges([oldBundle], [newBundle], 'src/constants.ts');

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Added variables');
    });

    it('should show functions changes', () => {
      const oldContract = createMockContract('src/utils.ts', {
        semanticHash: 'old-hash',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: ['formatDate', 'parseDate'],
          imports: [],
        },
      });
      const newContract = createMockContract('src/utils.ts', {
        semanticHash: 'new-hash',
        composition: {
          variables: [],
          hooks: [],
          components: [],
          functions: ['formatDate'],
          imports: [],
        },
      });

      const oldBundle = createMockBundle('src/utils.ts', [oldContract]);
      const newBundle = createMockBundle('src/utils.ts', [newContract]);

      showChanges([oldBundle], [newBundle], 'src/utils.ts');

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Removed functions');
    });

    it('should show "API changed" when no detailed diff is available', () => {
      const oldContract = createMockContract('src/App.tsx', {
        semanticHash: 'old-hash',
      });
      const newContract = createMockContract('src/App.tsx', {
        semanticHash: 'new-hash',
      });

      const oldBundle = createMockBundle('src/App.tsx', [oldContract]);
      const newBundle = createMockBundle('src/App.tsx', [newContract]);

      showChanges([oldBundle], [newBundle], 'src/App.tsx');

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('API changed');
    });

    it('should show "Content changed" for fileHash-only changes', () => {
      const oldContract = createMockContract('src/App.tsx', {
        semanticHash: 'same-hash',
        fileHash: 'old-file-hash',
      });
      const newContract = createMockContract('src/App.tsx', {
        semanticHash: 'same-hash',
        fileHash: 'new-file-hash',
      });

      const oldBundle = createMockBundle('src/App.tsx', [oldContract]);
      const newBundle = createMockBundle('src/App.tsx', [newContract]);

      showChanges([oldBundle], [newBundle], 'src/App.tsx');

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Content changed');
    });

    it('should show single bundle change without count', () => {
      const oldBundle = createMockBundle('src/App.tsx');
      oldBundle.bundleHash = 'old-hash';
      const newBundle = createMockBundle('src/App.tsx');
      newBundle.bundleHash = 'new-hash';

      showChanges([oldBundle], [newBundle], 'src/App.tsx');

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Modified bundle:');
      expect(calls).toContain('Dependency graph updated');
    });

    it('should show 2-3 bundle changes with count', () => {
      const oldBundles = [1, 2, 3].map((i) => {
        const b = createMockBundle(`src/Component${i}.tsx`);
        b.bundleHash = `old-hash-${i}`;
        return b;
      });
      const newBundles = [1, 2, 3].map((i) => {
        const b = createMockBundle(`src/Component${i}.tsx`);
        b.bundleHash = `new-hash-${i}`;
        return b;
      });

      showChanges(oldBundles, newBundles, 'src/Component1.tsx');

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Modified bundles (3)');
    });

    it('should show debug detailed changes for removed props', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        semanticHash: 'old-hash',
        interface: { props: { variant: 'string', size: 'string' }, emits: {} },
      });
      const newContract = createMockContract('src/Button.tsx', {
        semanticHash: 'new-hash',
        interface: { props: {}, emits: {} },
      });

      const oldBundle = createMockBundle('src/Button.tsx', [oldContract]);
      const newBundle = createMockBundle('src/Button.tsx', [newContract]);

      showChanges([oldBundle], [newBundle], 'src/Button.tsx', { debug: true });

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('- Props');
    });

    it('should show debug detailed changes for changed props', () => {
      const oldContract = createMockContract('src/Button.tsx', {
        semanticHash: 'old-hash',
        interface: { props: { variant: 'string' }, emits: {} },
      });
      const newContract = createMockContract('src/Button.tsx', {
        semanticHash: 'new-hash',
        interface: { props: { variant: ['primary', 'secondary'] }, emits: {} },
      });

      const oldBundle = createMockBundle('src/Button.tsx', [oldContract]);
      const newBundle = createMockBundle('src/Button.tsx', [newContract]);

      showChanges([oldBundle], [newBundle], 'src/Button.tsx', { debug: true });

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('~ Props');
    });
  });
});
