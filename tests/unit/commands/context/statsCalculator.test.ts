/**
 * Unit tests for statsCalculator module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockBundle, createMockContract, createMockManifest, createMockTokenEstimates } from './helpers.js';

// Mock tokens module
vi.mock('../../../../src/utils/tokens.js', () => ({
  formatTokenCount: vi.fn((n: number) => n.toLocaleString()),
  getTokenizerStatus: vi.fn(() => Promise.resolve({ gpt4: true, claude: true })),
}));

// Import after mocks
import {
  calculateStats,
  generateStatsOutput,
  generateSummary,
} from '../../../../src/cli/commands/context/statsCalculator.js';
import * as tokens from '../../../../src/utils/tokens.js';

describe('statsCalculator', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Reset tokenizer status mock to default (both available)
    vi.mocked(tokens.getTokenizerStatus).mockResolvedValue({ gpt4: true, claude: true });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('calculateStats', () => {
    it('should sum nodes across all bundles', () => {
      const bundles = [
        createMockBundle('src/App.tsx', [
          createMockContract('src/App.tsx'),
          createMockContract('src/Button.tsx'),
        ]),
        createMockBundle('src/Card.tsx', [
          createMockContract('src/Card.tsx'),
        ]),
      ];

      const stats = calculateStats(bundles);

      expect(stats.totalNodes).toBe(3);
    });

    it('should sum edges across all bundles', () => {
      const bundle1 = createMockBundle('src/App.tsx');
      bundle1.graph.edges = [['src/App.tsx', 'src/Button.tsx']];

      const bundle2 = createMockBundle('src/Card.tsx');
      bundle2.graph.edges = [
        ['src/Card.tsx', 'src/Icon.tsx'],
        ['src/Card.tsx', 'src/Text.tsx'],
      ];

      const stats = calculateStats([bundle1, bundle2]);

      expect(stats.totalEdges).toBe(3);
    });

    it('should sum missing dependencies across all bundles', () => {
      const bundle1 = createMockBundle('src/App.tsx');
      bundle1.meta.missing = [
        { name: 'lodash', reason: 'external', referencedBy: 'src/App.tsx' },
      ];

      const bundle2 = createMockBundle('src/Card.tsx');
      bundle2.meta.missing = [
        { name: 'react-icons', reason: 'external', referencedBy: 'src/Card.tsx' },
        { name: 'date-fns', reason: 'external', referencedBy: 'src/Card.tsx' },
      ];

      const stats = calculateStats([bundle1, bundle2]);

      expect(stats.totalMissing).toBe(3);
    });

    it('should return zero counts for empty bundles', () => {
      const stats = calculateStats([]);

      expect(stats.totalNodes).toBe(0);
      expect(stats.totalEdges).toBe(0);
      expect(stats.totalMissing).toBe(0);
    });

    it('should handle bundles with empty graphs', () => {
      const bundle = createMockBundle('src/App.tsx');
      bundle.graph.nodes = [];
      bundle.graph.edges = [];
      bundle.meta.missing = [];

      const stats = calculateStats([bundle]);

      expect(stats.totalNodes).toBe(0);
      expect(stats.totalEdges).toBe(0);
      expect(stats.totalMissing).toBe(0);
    });
  });

  describe('generateStatsOutput', () => {
    it('should return correct CI-friendly object structure', () => {
      const contracts = [createMockContract('src/App.tsx')];
      const manifest = createMockManifest(['src/App.tsx']);
      const bundles = [createMockBundle('src/App.tsx')];
      const stats = { totalNodes: 5, totalEdges: 3, totalMissing: 1 };
      const tokenEstimates = createMockTokenEstimates();
      const elapsed = 150;

      const output = generateStatsOutput(
        contracts,
        manifest,
        bundles,
        stats,
        tokenEstimates,
        elapsed
      );

      expect(output).toEqual({
        totalComponents: 1,
        rootComponents: 1,
        leafComponents: 1,
        bundlesCompiled: 1,
        totalNodes: 5,
        totalEdges: 3,
        missingDependencies: 1,
        tokensGPT4: 1000,
        tokensClaude: 1100,
        modeEstimates: {
          none: { gpt4: 600, claude: 660 },
          header: { gpt4: 1000, claude: 1100 },
          full: { gpt4: 3000, claude: 3300 },
        },
        savingsGPT4: '67',
        savingsClaude: '67',
        elapsedMs: 150,
      });
    });

    it('should include all required fields', () => {
      const contracts = [createMockContract('src/A.tsx'), createMockContract('src/B.tsx')];
      const manifest = createMockManifest(['src/A.tsx', 'src/B.tsx'], ['src/B.tsx']);
      const bundles = [createMockBundle('src/A.tsx'), createMockBundle('src/B.tsx')];
      const stats = { totalNodes: 10, totalEdges: 5, totalMissing: 2 };
      const tokenEstimates = createMockTokenEstimates();
      const elapsed = 200;

      const output = generateStatsOutput(
        contracts,
        manifest,
        bundles,
        stats,
        tokenEstimates,
        elapsed
      ) as Record<string, unknown>;

      // Verify all expected keys are present
      const expectedKeys = [
        'totalComponents',
        'rootComponents',
        'leafComponents',
        'bundlesCompiled',
        'totalNodes',
        'totalEdges',
        'missingDependencies',
        'tokensGPT4',
        'tokensClaude',
        'modeEstimates',
        'savingsGPT4',
        'savingsClaude',
        'elapsedMs',
      ];

      expectedKeys.forEach(key => {
        expect(output).toHaveProperty(key);
      });
    });

    it('should count root and leaf components correctly', () => {
      const contracts = [
        createMockContract('src/App.tsx'),
        createMockContract('src/Button.tsx'),
        createMockContract('src/Icon.tsx'),
      ];
      const manifest = createMockManifest(['src/App.tsx'], ['src/Icon.tsx']);
      manifest.graph.roots = ['src/App.tsx'];
      manifest.graph.leaves = ['src/Button.tsx', 'src/Icon.tsx'];

      const bundles = [createMockBundle('src/App.tsx')];
      const stats = { totalNodes: 3, totalEdges: 2, totalMissing: 0 };
      const tokenEstimates = createMockTokenEstimates();

      const output = generateStatsOutput(
        contracts,
        manifest,
        bundles,
        stats,
        tokenEstimates,
        100
      ) as Record<string, unknown>;

      expect(output.totalComponents).toBe(3);
      expect(output.rootComponents).toBe(1);
      expect(output.leafComponents).toBe(2);
    });
  });

  describe('generateSummary', () => {
    it('should log formatted output', async () => {
      const contracts = [createMockContract('src/App.tsx')];
      const manifest = createMockManifest(['src/App.tsx']);
      const bundles = [createMockBundle('src/App.tsx')];
      const stats = { totalNodes: 5, totalEdges: 3, totalMissing: 0 };
      const tokenEstimates = createMockTokenEstimates();

      await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
        includeCode: 'header',
        includeStyle: false,
        files: ['src/App.tsx'],
        projectRoot: '/project',
        currentGPT4: 1000,
        currentClaude: 1100,
        totalSourceSize: 5000,
        packOptions: {
          depth: 2,
          maxNodes: 30,
          format: 'json',
          hashLock: false,
          strict: false,
          allowMissing: true,
          predictBehavior: false,
        },
      });

      // Verify console.log was called with summary info
      expect(consoleSpy).toHaveBeenCalled();

      // Check that key summary items were logged
      const calls = consoleSpy.mock.calls.map(c => c[0]);
      expect(calls.some((c: string) => c.includes('Summary'))).toBe(true);
      expect(calls.some((c: string) => c.includes('Total components'))).toBe(true);
    });

    it('should show missing dependencies when present', async () => {
      const contracts = [createMockContract('src/App.tsx')];
      const manifest = createMockManifest(['src/App.tsx']);
      const bundle = createMockBundle('src/App.tsx');
      bundle.meta.missing = [
        { name: 'lodash', reason: 'external', referencedBy: 'src/App.tsx' },
      ];
      const bundles = [bundle];
      const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 1 };
      const tokenEstimates = createMockTokenEstimates();

      await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
        includeCode: 'header',
        includeStyle: false,
        files: ['src/App.tsx'],
        projectRoot: '/project',
        currentGPT4: 1000,
        currentClaude: 1100,
        totalSourceSize: 5000,
        packOptions: {
          depth: 2,
          maxNodes: 30,
          format: 'json',
          hashLock: false,
          strict: false,
          allowMissing: true,
          predictBehavior: false,
        },
      });

      const calls = consoleSpy.mock.calls.map(c => c[0]);
      expect(calls.some((c: string) => c.includes('Missing dependencies'))).toBe(true);
    });

    it('should handle header+style mode correctly', async () => {
      const contracts = [createMockContract('src/App.tsx')];
      const manifest = createMockManifest(['src/App.tsx']);
      const bundles = [createMockBundle('src/App.tsx')];
      const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 0 };
      const tokenEstimates = createMockTokenEstimates();

      await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
        includeCode: 'header',
        includeStyle: true,
        files: ['src/App.tsx'],
        projectRoot: '/project',
        currentGPT4: 1000,
        currentClaude: 1100,
        totalSourceSize: 5000,
        packOptions: {
          depth: 2,
          maxNodes: 30,
          format: 'json',
          hashLock: false,
          strict: false,
          allowMissing: true,
          predictBehavior: false,
        },
      });

      const calls = consoleSpy.mock.calls.map(c => c[0]);
      expect(calls.some((c: string) => c.includes('header+style'))).toBe(true);
    });

    describe('mode label branches', () => {
      it('should use "full+style" label when includeCode is "full"', async () => {
        const contracts = [createMockContract('src/App.tsx')];
        const manifest = createMockManifest(['src/App.tsx']);
        const bundles = [createMockBundle('src/App.tsx')];
        const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 0 };
        const tokenEstimates = createMockTokenEstimates();

        await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
          includeCode: 'full',
          includeStyle: false,
          files: ['src/App.tsx'],
          projectRoot: '/project',
          currentGPT4: 1000,
          currentClaude: 1100,
          totalSourceSize: 5000,
          packOptions: {
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
          },
        });

        const calls = consoleSpy.mock.calls.map(c => c[0]);
        expect(calls.some((c: string) => c.includes('full+style mode'))).toBe(true);
      });

      it('should use "none" label when includeCode is "none"', async () => {
        const contracts = [createMockContract('src/App.tsx')];
        const manifest = createMockManifest(['src/App.tsx']);
        const bundles = [createMockBundle('src/App.tsx')];
        const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 0 };
        const tokenEstimates = createMockTokenEstimates();

        await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
          includeCode: 'none',
          includeStyle: false,
          files: ['src/App.tsx'],
          projectRoot: '/project',
          currentGPT4: 1000,
          currentClaude: 1100,
          totalSourceSize: 5000,
          packOptions: {
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
          },
        });

        const calls = consoleSpy.mock.calls.map(c => c[0]);
        expect(calls.some((c: string) => c.includes('none mode'))).toBe(true);
      });
    });

    describe('raw source estimation', () => {
      it('should use default sourceTokens in non-header mode', async () => {
        const contracts = [createMockContract('src/App.tsx')];
        const manifest = createMockManifest(['src/App.tsx']);
        const bundles = [createMockBundle('src/App.tsx')];
        const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 0 };
        const tokenEstimates = createMockTokenEstimates({
          sourceTokensGPT4: 5000,
          sourceTokensClaude: 5500,
        });

        await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
          includeCode: 'none',
          includeStyle: false,
          files: ['src/App.tsx'],
          projectRoot: '/project',
          currentGPT4: 1000,
          currentClaude: 1100,
          totalSourceSize: 5000,
          packOptions: {
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
          },
        });

        // In non-header mode, estimatedRawSource should use sourceTokensGPT4/Claude
        // Verify that the raw source value in output matches sourceTokensGPT4
        const calls = consoleSpy.mock.calls.map(c => c[0]);
        const rawSourceLine = calls.find((c: string) => c.includes('Raw source'));
        expect(rawSourceLine).toBeDefined();
        // The raw source should show the sourceTokensGPT4 value (5000)
        expect(rawSourceLine).toContain('5,000');
      });
    });

    describe('header token estimates', () => {
      it('should use estimates for non-header modes', async () => {
        const contracts = [createMockContract('src/App.tsx')];
        const manifest = createMockManifest(['src/App.tsx']);
        const bundles = [createMockBundle('src/App.tsx')];
        const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 0 };
        const tokenEstimates = createMockTokenEstimates();

        await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
          includeCode: 'none',
          includeStyle: false,
          files: ['src/App.tsx'],
          projectRoot: '/project',
          currentGPT4: 1000,
          currentClaude: 1100,
          totalSourceSize: 5000,
          packOptions: {
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
          },
        });

        // In non-header mode, headerNoStyleGPT4 = currentGPT4 * 0.75 = 750
        // headerWithStyleGPT4 = currentGPT4 * 0.85 = 850
        const calls = consoleSpy.mock.calls.map(c => c[0]);
        const headerLine = calls.find((c: string) => c.includes('Header'));
        expect(headerLine).toBeDefined();
        // Verify the header estimate is shown (750)
        expect(headerLine).toContain('750');
      });
    });

    describe('savings calculation', () => {
      it('should return "0" when estimatedRawSourceGPT4 is 0', async () => {
        const contracts = [createMockContract('src/App.tsx')];
        const manifest = createMockManifest(['src/App.tsx']);
        const bundles = [createMockBundle('src/App.tsx')];
        const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 0 };
        const tokenEstimates = createMockTokenEstimates({
          sourceTokensGPT4: 0,
          sourceTokensClaude: 0,
        });

        await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
          includeCode: 'none',
          includeStyle: false,
          files: ['src/App.tsx'],
          projectRoot: '/project',
          currentGPT4: 1000,
          currentClaude: 1100,
          totalSourceSize: 5000,
          packOptions: {
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
          },
        });

        const calls = consoleSpy.mock.calls.map(c => c[0]);
        const headerLine = calls.find((c: string) => c.includes('Header') && c.includes('%'));
        expect(headerLine).toBeDefined();
        // When estimatedRawSourceGPT4 is 0, savings should be "0%"
        expect(headerLine).toContain('0%');
      });

      it('should return "0" when estimatedRawSourceGPT4 is negative', async () => {
        const contracts = [createMockContract('src/App.tsx')];
        const manifest = createMockManifest(['src/App.tsx']);
        const bundles = [createMockBundle('src/App.tsx')];
        const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 0 };
        // Note: In practice, sourceTokensGPT4 shouldn't be negative, but we test the branch
        const tokenEstimates = createMockTokenEstimates({
          sourceTokensGPT4: -1,
          sourceTokensClaude: -1,
        });

        await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
          includeCode: 'none',
          includeStyle: false,
          files: ['src/App.tsx'],
          projectRoot: '/project',
          currentGPT4: 1000,
          currentClaude: 1100,
          totalSourceSize: 5000,
          packOptions: {
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
          },
        });

        const calls = consoleSpy.mock.calls.map(c => c[0]);
        const headerLine = calls.find((c: string) => c.includes('Header') && c.includes('%'));
        expect(headerLine).toBeDefined();
        // When estimatedRawSourceGPT4 is negative, savings should be "0%"
        expect(headerLine).toContain('0%');
      });

      it('should clamp savings to 0 when current tokens exceed raw (would be negative)', async () => {
        const contracts = [createMockContract('src/App.tsx')];
        const manifest = createMockManifest(['src/App.tsx']);
        const bundles = [createMockBundle('src/App.tsx')];
        const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 0 };
        // Set sourceTokens lower than current tokens to trigger negative savings
        const tokenEstimates = createMockTokenEstimates({
          sourceTokensGPT4: 500, // Less than currentGPT4 (1000)
          sourceTokensClaude: 550,
        });

        await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
          includeCode: 'none',
          includeStyle: false,
          files: ['src/App.tsx'],
          projectRoot: '/project',
          currentGPT4: 1000,
          currentClaude: 1100,
          totalSourceSize: 5000,
          packOptions: {
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
          },
        });

        const calls = consoleSpy.mock.calls.map(c => c[0]);
        const headerLine = calls.find((c: string) => c.includes('Header') && c.includes('%'));
        expect(headerLine).toBeDefined();
        // When current > raw, savings would be negative but should be clamped to "0%"
        expect(headerLine).toContain('0%');
      });

      it('should clamp savings to 100 when it would exceed 100%', async () => {
        const contracts = [createMockContract('src/App.tsx')];
        const manifest = createMockManifest(['src/App.tsx']);
        const bundles = [createMockBundle('src/App.tsx')];
        const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 0 };
        // Set very high sourceTokens and very low current tokens
        const tokenEstimates = createMockTokenEstimates({
          sourceTokensGPT4: 10000,
          sourceTokensClaude: 11000,
        });

        await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
          includeCode: 'none',
          includeStyle: false,
          files: ['src/App.tsx'],
          projectRoot: '/project',
          currentGPT4: 10, // Very small - header estimate will be even smaller
          currentClaude: 11,
          totalSourceSize: 5000,
          packOptions: {
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
          },
        });

        const calls = consoleSpy.mock.calls.map(c => c[0]);
        const headerLine = calls.find((c: string) => c.includes('Header') && c.includes('%'));
        expect(headerLine).toBeDefined();
        // Savings should be clamped to at most 100%
        // The percentage should be a valid number between 0 and 100
        const match = headerLine.match(/(\d+)%/);
        expect(match).toBeTruthy();
        const percentage = parseInt(match![1], 10);
        expect(percentage).toBeGreaterThanOrEqual(0);
        expect(percentage).toBeLessThanOrEqual(100);
      });

      it('should return "0" for headerStyleSavings when estimatedRawSourceGPT4 is 0', async () => {
        const contracts = [createMockContract('src/App.tsx')];
        const manifest = createMockManifest(['src/App.tsx']);
        const bundles = [createMockBundle('src/App.tsx')];
        const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 0 };
        const tokenEstimates = createMockTokenEstimates({
          sourceTokensGPT4: 0,
          sourceTokensClaude: 0,
        });

        await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
          includeCode: 'none',
          includeStyle: false,
          files: ['src/App.tsx'],
          projectRoot: '/project',
          currentGPT4: 1000,
          currentClaude: 1100,
          totalSourceSize: 5000,
          packOptions: {
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
          },
        });

        const calls = consoleSpy.mock.calls.map(c => c[0]);
        const headerStyleLine = calls.find((c: string) => c.includes('Header+style') && c.includes('%'));
        expect(headerStyleLine).toBeDefined();
        // When estimatedRawSourceGPT4 is 0, headerStyleSavings should be "0%"
        expect(headerStyleLine).toContain('0%');
      });
    });

    describe('tokenizer status', () => {
      it('should show tip when GPT-4 tokenizer is missing', async () => {
        vi.mocked(tokens.getTokenizerStatus).mockResolvedValue({ gpt4: false, claude: true });

        const contracts = [createMockContract('src/App.tsx')];
        const manifest = createMockManifest(['src/App.tsx']);
        const bundles = [createMockBundle('src/App.tsx')];
        const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 0 };
        const tokenEstimates = createMockTokenEstimates();

        await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
          includeCode: 'header',
          includeStyle: false,
          files: ['src/App.tsx'],
          projectRoot: '/project',
          currentGPT4: 1000,
          currentClaude: 1100,
          totalSourceSize: 5000,
          packOptions: {
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
          },
        });

        const calls = consoleSpy.mock.calls.map(c => c[0]);
        const tipLine = calls.find((c: string) => c.includes('💡 Tip'));
        expect(tipLine).toBeDefined();
        expect(tipLine).toContain('@dqbd/tiktoken (GPT-4)');
        expect(tipLine).not.toContain('@anthropic-ai/tokenizer (Claude)');
      });

      it('should show tip when Claude tokenizer is missing', async () => {
        vi.mocked(tokens.getTokenizerStatus).mockResolvedValue({ gpt4: true, claude: false });

        const contracts = [createMockContract('src/App.tsx')];
        const manifest = createMockManifest(['src/App.tsx']);
        const bundles = [createMockBundle('src/App.tsx')];
        const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 0 };
        const tokenEstimates = createMockTokenEstimates();

        await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
          includeCode: 'header',
          includeStyle: false,
          files: ['src/App.tsx'],
          projectRoot: '/project',
          currentGPT4: 1000,
          currentClaude: 1100,
          totalSourceSize: 5000,
          packOptions: {
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
          },
        });

        const calls = consoleSpy.mock.calls.map(c => c[0]);
        const tipLine = calls.find((c: string) => c.includes('💡 Tip'));
        expect(tipLine).toBeDefined();
        expect(tipLine).toContain('@anthropic-ai/tokenizer (Claude)');
        expect(tipLine).not.toContain('@dqbd/tiktoken (GPT-4)');
      });

      it('should show tip when both tokenizers are missing', async () => {
        vi.mocked(tokens.getTokenizerStatus).mockResolvedValue({ gpt4: false, claude: false });

        const contracts = [createMockContract('src/App.tsx')];
        const manifest = createMockManifest(['src/App.tsx']);
        const bundles = [createMockBundle('src/App.tsx')];
        const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 0 };
        const tokenEstimates = createMockTokenEstimates();

        await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
          includeCode: 'header',
          includeStyle: false,
          files: ['src/App.tsx'],
          projectRoot: '/project',
          currentGPT4: 1000,
          currentClaude: 1100,
          totalSourceSize: 5000,
          packOptions: {
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
          },
        });

        const calls = consoleSpy.mock.calls.map(c => c[0]);
        const tipLine = calls.find((c: string) => c.includes('💡 Tip'));
        expect(tipLine).toBeDefined();
        expect(tipLine).toContain('@dqbd/tiktoken (GPT-4)');
        expect(tipLine).toContain('@anthropic-ai/tokenizer (Claude)');
        expect(tipLine).toContain('and/or');
      });

      it('should use "approximation" method when tokenizers are missing', async () => {
        vi.mocked(tokens.getTokenizerStatus).mockResolvedValue({ gpt4: false, claude: false });

        const contracts = [createMockContract('src/App.tsx')];
        const manifest = createMockManifest(['src/App.tsx']);
        const bundles = [createMockBundle('src/App.tsx')];
        const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 0 };
        const tokenEstimates = createMockTokenEstimates();

        await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
          includeCode: 'header',
          includeStyle: false,
          files: ['src/App.tsx'],
          projectRoot: '/project',
          currentGPT4: 1000,
          currentClaude: 1100,
          totalSourceSize: 5000,
          packOptions: {
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
          },
        });

        const calls = consoleSpy.mock.calls.map(c => c[0]);
        const estimationLine = calls.find((c: string) => c.includes('Token estimation:'));
        expect(estimationLine).toBeDefined();
        expect(estimationLine).toContain('approximation');
        expect(estimationLine).not.toContain('tiktoken');
        expect(estimationLine).not.toContain('tokenizer');
      });
    });

    describe('missing dependencies', () => {
      it('should show "... and X more" when there are more than 10 missing dependencies', async () => {
        const contracts = [createMockContract('src/App.tsx')];
        const manifest = createMockManifest(['src/App.tsx']);
        const bundle = createMockBundle('src/App.tsx');
        // Create 15 unique missing dependencies
        bundle.meta.missing = Array.from({ length: 15 }, (_, i) => ({
          name: `dependency-${i}`,
          reason: 'external' as const,
          referencedBy: 'src/App.tsx',
        }));
        const bundles = [bundle];
        const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 15 };
        const tokenEstimates = createMockTokenEstimates();

        await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
          includeCode: 'header',
          includeStyle: false,
          files: ['src/App.tsx'],
          projectRoot: '/project',
          currentGPT4: 1000,
          currentClaude: 1100,
          totalSourceSize: 5000,
          packOptions: {
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
          },
        });

        const calls = consoleSpy.mock.calls.map(c => c[0]);
        const moreLine = calls.find((c: string) => c.includes('... and') && c.includes('more'));
        expect(moreLine).toBeDefined();
        // Should show "... and 5 more" (15 - 10 = 5)
        expect(moreLine).toContain('... and 5 more');
      });

      it('should show exactly 10 dependencies when there are exactly 10', async () => {
        const contracts = [createMockContract('src/App.tsx')];
        const manifest = createMockManifest(['src/App.tsx']);
        const bundle = createMockBundle('src/App.tsx');
        // Create exactly 10 unique missing dependencies
        bundle.meta.missing = Array.from({ length: 10 }, (_, i) => ({
          name: `dependency-${i}`,
          reason: 'external' as const,
          referencedBy: 'src/App.tsx',
        }));
        const bundles = [bundle];
        const stats = { totalNodes: 1, totalEdges: 0, totalMissing: 10 };
        const tokenEstimates = createMockTokenEstimates();

        await generateSummary(contracts, manifest, bundles, stats, tokenEstimates, {
          includeCode: 'header',
          includeStyle: false,
          files: ['src/App.tsx'],
          projectRoot: '/project',
          currentGPT4: 1000,
          currentClaude: 1100,
          totalSourceSize: 5000,
          packOptions: {
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
          },
        });

        const calls = consoleSpy.mock.calls.map(c => c[0]);
        const moreLine = calls.find((c: string) => c.includes('... and') && c.includes('more'));
        // Should NOT show "... and X more" when exactly 10
        expect(moreLine).toBeUndefined();
        
        // Count dependency lines
        const dependencyLines = calls.filter((c: string) => c.trim().startsWith('- dependency-'));
        expect(dependencyLines.length).toBe(10);
      });
    });
  });
});
