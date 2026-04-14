/**
 * Unit tests for tokenEstimator module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockManifest } from './helpers.js';

// Mock dependencies before imports
vi.mock('../../../../src/utils/tokens.js', () => ({
  estimateGPT4Tokens: vi.fn((text: string) =>
    Promise.resolve(Math.ceil(text.length / 4)),
  ),
  estimateClaudeTokens: vi.fn((text: string) =>
    Promise.resolve(Math.ceil(text.length / 4.5)),
  ),
  formatTokenCount: vi.fn((n: number) => n.toLocaleString()),
  getTokenizerStatus: vi.fn(() =>
    Promise.resolve({ gpt4: true, claude: true }),
  ),
}));

vi.mock('../../../../src/utils/fsx.js', () => ({
  readFileWithText: vi.fn(),
}));

vi.mock('../../../../src/core/astParser.js', () => ({
  extractFromFile: vi.fn(),
}));

vi.mock('../../../../src/core/contractBuilder.js', () => ({
  buildContract: vi.fn(),
}));

vi.mock('../../../../src/extractors/styling/index.js', () => ({
  extractStyleMetadata: vi.fn(),
}));

vi.mock('../../../../src/core/pack.js', () => ({
  pack: vi.fn(),
}));

vi.mock('../../../../src/cli/commands/context/bundleFormatter.js', () => ({
  formatBundles: vi.fn(() => 'formatted bundle output'),
}));

vi.mock('ts-morph', () => {
  return {
    Project: class MockProject {
      addSourceFileAtPath = vi.fn().mockReturnValue({});
    },
  };
});

// Import after mocks
import {
  calculateTokenEstimates,
  generateModeComparison,
  displayModeComparison,
} from '../../../../src/cli/commands/context/tokenEstimator.js';
import { readFileWithText } from '../../../../src/utils/fsx.js';
import { extractFromFile } from '../../../../src/core/astParser.js';
import {
  buildContract,
  type ContractBuildResult,
} from '../../../../src/core/contractBuilder.js';
import { extractStyleMetadata } from '../../../../src/extractors/styling/index.js';
import { pack } from '../../../../src/core/pack.js';
import { formatBundles } from '../../../../src/cli/commands/context/bundleFormatter.js';
import { Project } from 'ts-morph';
import { createMockBundle } from './helpers.js';

describe('tokenEstimator', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('calculateTokenEstimates', () => {
    it('should estimate source tokens from totalSourceSize / 4', async () => {
      const result = await calculateTokenEstimates('output', 1000, 250, 275);

      expect(result.sourceTokensGPT4).toBe(250); // 1000 / 4
      expect(result.sourceTokensClaude).toBe(223); // ceil(1000 / 4.5)
    });

    it('should calculate mode estimates based on current tokens', async () => {
      const result = await calculateTokenEstimates('output', 1000, 500, 550);

      // none mode: ~60% of current
      expect(result.modeEstimates.none.gpt4).toBe(300); // 500 * 0.6
      expect(result.modeEstimates.none.claude).toBe(330); // 550 * 0.6

      // header mode: same as current
      expect(result.modeEstimates.header.gpt4).toBe(500);
      expect(result.modeEstimates.header.claude).toBe(550);

      // full mode: current + source tokens
      expect(result.modeEstimates.full.gpt4).toBe(750); // 500 + 250
      expect(result.modeEstimates.full.claude).toBe(773); // 550 + 223
    });

    it('should calculate savings percentage correctly', async () => {
      const result = await calculateTokenEstimates('output', 1000, 500, 550);

      // full = 750, current = 500, savings = (750-500)/750 = 33%
      expect(result.savingsGPT4).toBe('33');
    });

    it('should handle zero values without division errors', async () => {
      const result = await calculateTokenEstimates('', 0, 0, 0);

      expect(result.sourceTokensGPT4).toBe(0);
      expect(result.sourceTokensClaude).toBe(0);
      expect(result.savingsGPT4).toBe('0');
      expect(result.savingsClaude).toBe('0');
    });

    it('should return correct structure with all fields', async () => {
      const result = await calculateTokenEstimates('output', 1000, 500, 550);

      expect(result).toHaveProperty('currentGPT4');
      expect(result).toHaveProperty('currentClaude');
      expect(result).toHaveProperty('sourceTokensGPT4');
      expect(result).toHaveProperty('sourceTokensClaude');
      expect(result).toHaveProperty('modeEstimates');
      expect(result).toHaveProperty('savingsGPT4');
      expect(result).toHaveProperty('savingsClaude');

      expect(result.modeEstimates).toHaveProperty('none');
      expect(result.modeEstimates).toHaveProperty('header');
      expect(result.modeEstimates).toHaveProperty('full');
    });
  });

  describe('generateModeComparison', () => {
    it('should read all source files for token calculation', async () => {
      vi.mocked(readFileWithText)
        .mockResolvedValueOnce({
          text: 'file1 content',
          path: '/project/src/A.tsx',
        })
        .mockResolvedValueOnce({
          text: 'file2 content',
          path: '/project/src/B.tsx',
        });

      const manifest = createMockManifest(['src/A.tsx', 'src/B.tsx']);

      await generateModeComparison(
        ['src/A.tsx', 'src/B.tsx'],
        manifest,
        '/project',
        500,
        550,
        1000,
        {
          includeCode: 'header',
          includeStyle: false,
          depth: 2,
          maxNodes: 30,
          format: 'json',
          hashLock: false,
          strict: false,
          allowMissing: true,
          predictBehavior: false,
          quiet: true,
        },
      );

      expect(readFileWithText).toHaveBeenCalledTimes(2);
    });

    it('should handle file read failures gracefully', async () => {
      vi.mocked(readFileWithText).mockRejectedValue(
        new Error('File not found'),
      );

      const manifest = createMockManifest(['src/A.tsx']);

      // Should not throw
      const result = await generateModeComparison(
        ['src/A.tsx'],
        manifest,
        '/project',
        500,
        550,
        1000,
        {
          includeCode: 'header',
          includeStyle: false,
          depth: 2,
          maxNodes: 30,
          format: 'json',
          hashLock: false,
          strict: false,
          allowMissing: true,
          predictBehavior: false,
          quiet: true,
        },
      );

      expect(result).toBeDefined();
    });

    it('should return mode estimates for header+style mode', async () => {
      vi.mocked(readFileWithText).mockResolvedValue({
        text: 'content',
        path: '/project/src/A.tsx',
      });

      const manifest = createMockManifest(['src/A.tsx']);

      const result = await generateModeComparison(
        ['src/A.tsx'],
        manifest,
        '/project',
        500,
        550,
        1000,
        {
          includeCode: 'header',
          includeStyle: true,
          depth: 2,
          maxNodes: 30,
          format: 'json',
          hashLock: false,
          strict: false,
          allowMissing: true,
          predictBehavior: false,
          quiet: true,
        },
      );

      expect(result.modeEstimates).toHaveProperty('none');
      expect(result.modeEstimates).toHaveProperty('header');
      expect(result.modeEstimates).toHaveProperty('headerStyle');
      expect(result.modeEstimates).toHaveProperty('full');
    });

    it('should calculate actual source tokens using tokenizers', async () => {
      vi.mocked(readFileWithText).mockResolvedValue({
        text: 'x'.repeat(100),
        path: '/project/src/A.tsx',
      });

      const manifest = createMockManifest(['src/A.tsx']);

      const result = await generateModeComparison(
        ['src/A.tsx'],
        manifest,
        '/project',
        500,
        550,
        1000,
        {
          includeCode: 'header',
          includeStyle: false,
          depth: 2,
          maxNodes: 30,
          format: 'json',
          hashLock: false,
          strict: false,
          allowMissing: true,
          predictBehavior: false,
          quiet: true,
        },
      );

      // Token estimates based on mocked tokenizer (length / 4)
      expect(result.sourceTokensGPT4).toBe(25); // 100 chars / 4
    });

    describe('header mode without style (rebuild with style)', () => {
      it('should rebuild contracts with style when current is header without style', async () => {
        vi.mocked(readFileWithText).mockResolvedValue({
          text: 'file content',
          path: '/project/src/A.tsx',
        });
        vi.mocked(extractFromFile).mockResolvedValue({} as any);
        vi.mocked(buildContract).mockReturnValue({
          contract: { entryId: 'src/A.tsx' } as any,
          violations: [],
        } as ContractBuildResult);
        vi.mocked(extractStyleMetadata).mockResolvedValue({
          classes: [],
        } as any);
        vi.mocked(pack).mockResolvedValue(createMockBundle('src/A.tsx'));
        vi.mocked(formatBundles).mockReturnValue('formatted output');

        const manifest = createMockManifest(['src/A.tsx']);

        const result = await generateModeComparison(
          ['src/A.tsx'],
          manifest,
          '/project',
          500,
          550,
          1000,
          {
            includeCode: 'header',
            includeStyle: false, // Current is header without style
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
            quiet: false,
          },
        );

        // Should have called extractStyleMetadata to rebuild with style
        expect(extractStyleMetadata).toHaveBeenCalled();
        expect(result.headerNoStyleGPT4).toBe(500); // Current tokens
        expect(result.headerNoStyleClaude).toBe(550);
        expect(result.modeEstimates).toHaveProperty('headerStyle');
      });

      it('should respect quiet flag when rebuilding with style', async () => {
        vi.mocked(readFileWithText).mockResolvedValue({
          text: 'file content',
          path: '/project/src/A.tsx',
        });
        vi.mocked(extractFromFile).mockResolvedValue({} as any);
        vi.mocked(buildContract).mockReturnValue({
          contract: { entryId: 'src/A.tsx' } as any,
          violations: [],
        } as ContractBuildResult);
        vi.mocked(extractStyleMetadata).mockResolvedValue({
          classes: [],
        } as any);
        vi.mocked(pack).mockResolvedValue(createMockBundle('src/A.tsx'));
        vi.mocked(formatBundles).mockReturnValue('formatted output');

        const manifest = createMockManifest(['src/A.tsx']);

        await generateModeComparison(
          ['src/A.tsx'],
          manifest,
          '/project',
          500,
          550,
          1000,
          {
            includeCode: 'header',
            includeStyle: false,
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
            quiet: true, // Quiet mode
          },
        );

        // Should not log the rebuild message when quiet
        const logCalls = consoleSpy.mock.calls.flat().join('\n');
        expect(logCalls).not.toContain('Generating with style metadata');
      });

      it('should skip files when file content cache miss', async () => {
        // First file succeeds, second file fails to read (not in cache)
        vi.mocked(readFileWithText)
          .mockResolvedValueOnce({
            text: 'file content A',
            path: '/project/src/A.tsx',
          })
          .mockRejectedValueOnce(new Error('File B not found')); // This file won't be in cache

        vi.mocked(extractFromFile).mockResolvedValue({} as any);
        vi.mocked(buildContract).mockReturnValue({
          contract: { entryId: 'src/A.tsx' } as any,
          violations: [],
        } as ContractBuildResult);
        vi.mocked(extractStyleMetadata).mockResolvedValue({
          classes: [],
        } as any);
        vi.mocked(pack).mockResolvedValue(createMockBundle('src/A.tsx'));
        vi.mocked(formatBundles).mockReturnValue('formatted output');

        const manifest = createMockManifest(['src/A.tsx', 'src/B.tsx']);

        // File B fails to read initially, so it won't be in cache
        // When rebuilding contracts, file B will be skipped due to cache miss
        const result = await generateModeComparison(
          ['src/A.tsx', 'src/B.tsx'],
          manifest,
          '/project',
          500,
          550,
          1000,
          {
            includeCode: 'header',
            includeStyle: false,
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
            quiet: true,
          },
        );

        // Should still complete successfully even with cache misses
        expect(result).toBeDefined();
        // buildContract should only be called for file A (file B skipped due to cache miss)
        expect(buildContract).toHaveBeenCalledTimes(1);
      });

      it('should handle style extraction errors gracefully', async () => {
        vi.mocked(readFileWithText).mockResolvedValue({
          text: 'file content',
          path: '/project/src/A.tsx',
        });
        vi.mocked(extractFromFile).mockResolvedValue({} as any);
        vi.mocked(extractStyleMetadata).mockRejectedValue(
          new Error('Style extraction failed'),
        );
        vi.mocked(buildContract).mockReturnValue({
          contract: { entryId: 'src/A.tsx' } as any,
          violations: [],
        } as ContractBuildResult);
        vi.mocked(pack).mockResolvedValue(createMockBundle('src/A.tsx'));
        vi.mocked(formatBundles).mockReturnValue('formatted output');

        const manifest = createMockManifest(['src/A.tsx']);

        // Should not throw when style extraction fails
        const result = await generateModeComparison(
          ['src/A.tsx'],
          manifest,
          '/project',
          500,
          550,
          1000,
          {
            includeCode: 'header',
            includeStyle: false,
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
            quiet: true,
          },
        );

        expect(result).toBeDefined();
        // buildContract should still be called even if style extraction fails
        expect(buildContract).toHaveBeenCalled();
      });

      it('should handle contract building errors gracefully', async () => {
        vi.mocked(readFileWithText).mockResolvedValue({
          text: 'file content',
          path: '/project/src/A.tsx',
        });
        vi.mocked(extractFromFile).mockResolvedValue({} as any);
        vi.mocked(extractStyleMetadata).mockResolvedValue({
          classes: [],
        } as any);
        vi.mocked(buildContract).mockImplementation(() => {
          throw new Error('Contract building failed');
        });
        vi.mocked(pack).mockResolvedValue(createMockBundle('src/A.tsx'));
        vi.mocked(formatBundles).mockReturnValue('formatted output');

        const manifest = createMockManifest(['src/A.tsx']);

        // Should not throw when contract building fails
        const result = await generateModeComparison(
          ['src/A.tsx'],
          manifest,
          '/project',
          500,
          550,
          1000,
          {
            includeCode: 'header',
            includeStyle: false,
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
            quiet: true,
          },
        );

        expect(result).toBeDefined();
      });

      it('should throw when all style bundles fail', async () => {
        vi.mocked(readFileWithText).mockResolvedValue({
          text: 'file content',
          path: '/project/src/A.tsx',
        });
        vi.mocked(extractFromFile).mockResolvedValue({} as any);
        vi.mocked(buildContract).mockReturnValue({
          contract: { entryId: 'src/A.tsx' } as any,
          violations: [],
        } as ContractBuildResult);
        vi.mocked(extractStyleMetadata).mockResolvedValue({
          classes: [],
        } as any);
        vi.mocked(pack).mockRejectedValue(new Error('Pack failed'));
        vi.mocked(formatBundles).mockReturnValue('formatted output');

        const manifest = createMockManifest(['src/A.tsx']);

        // Should throw when all bundles fail
        await expect(
          generateModeComparison(
            ['src/A.tsx'],
            manifest,
            '/project',
            500,
            550,
            1000,
            {
              includeCode: 'header',
              includeStyle: false,
              depth: 2,
              maxNodes: 30,
              format: 'json',
              hashLock: false,
              strict: false,
              allowMissing: true,
              predictBehavior: false,
              quiet: true,
            },
          ),
        ).rejects.toThrow('Failed to compile any style bundles');
      });
    });

    describe('header mode with style (rebuild without style)', () => {
      it('should respect quiet flag when rebuilding without style', async () => {
        vi.mocked(readFileWithText).mockResolvedValue({
          text: 'file content',
          path: '/project/src/A.tsx',
        });
        vi.mocked(extractFromFile).mockResolvedValue({} as any);
        vi.mocked(buildContract).mockReturnValue({
          contract: { entryId: 'src/A.tsx' } as any,
          violations: [],
        } as ContractBuildResult);
        vi.mocked(pack).mockResolvedValue(createMockBundle('src/A.tsx'));
        vi.mocked(formatBundles).mockReturnValue('formatted output');

        const manifest = createMockManifest(['src/A.tsx']);

        await generateModeComparison(
          ['src/A.tsx'],
          manifest,
          '/project',
          500,
          550,
          1000,
          {
            includeCode: 'header',
            includeStyle: true, // Current is header with style
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
            quiet: true, // Quiet mode
          },
        );

        // Should not log the rebuild message when quiet
        const logCalls = consoleSpy.mock.calls.flat().join('\n');
        expect(logCalls).not.toContain('Generating without style metadata');
      });

      it('should skip files when file content cache miss (no-style rebuild)', async () => {
        // First file succeeds, second file fails to read (not in cache)
        vi.mocked(readFileWithText)
          .mockResolvedValueOnce({
            text: 'file content A',
            path: '/project/src/A.tsx',
          })
          .mockRejectedValueOnce(new Error('File B not found')); // This file won't be in cache

        vi.mocked(extractFromFile).mockResolvedValue({} as any);
        vi.mocked(buildContract).mockReturnValue({
          contract: { entryId: 'src/A.tsx' } as any,
          violations: [],
        } as ContractBuildResult);
        vi.mocked(pack).mockResolvedValue(createMockBundle('src/A.tsx'));
        vi.mocked(formatBundles).mockReturnValue('formatted output');

        const manifest = createMockManifest(['src/A.tsx', 'src/B.tsx']);

        // File B fails to read initially, so it won't be in cache
        // When rebuilding contracts without style, file B will be skipped due to cache miss
        const result = await generateModeComparison(
          ['src/A.tsx', 'src/B.tsx'],
          manifest,
          '/project',
          500,
          550,
          1000,
          {
            includeCode: 'header',
            includeStyle: true,
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
            quiet: true,
          },
        );

        // Should still complete successfully even with cache misses
        expect(result).toBeDefined();
        // buildContract should only be called for file A (file B skipped due to cache miss)
        expect(buildContract).toHaveBeenCalledTimes(1);
      });

      it('should handle contract building errors gracefully (no-style rebuild)', async () => {
        vi.mocked(readFileWithText).mockResolvedValue({
          text: 'file content',
          path: '/project/src/A.tsx',
        });
        vi.mocked(extractFromFile).mockResolvedValue({} as any);
        vi.mocked(buildContract).mockImplementation(() => {
          throw new Error('Contract building failed');
        });
        vi.mocked(pack).mockResolvedValue(createMockBundle('src/A.tsx'));
        vi.mocked(formatBundles).mockReturnValue('formatted output');

        const manifest = createMockManifest(['src/A.tsx']);

        // Should not throw when contract building fails
        const result = await generateModeComparison(
          ['src/A.tsx'],
          manifest,
          '/project',
          500,
          550,
          1000,
          {
            includeCode: 'header',
            includeStyle: true,
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
            quiet: true,
          },
        );

        expect(result).toBeDefined();
      });

      it('should throw when all no-style bundles fail', async () => {
        vi.mocked(readFileWithText).mockResolvedValue({
          text: 'file content',
          path: '/project/src/A.tsx',
        });
        vi.mocked(extractFromFile).mockResolvedValue({} as any);
        vi.mocked(buildContract).mockReturnValue({
          contract: { entryId: 'src/A.tsx' } as any,
          violations: [],
        } as ContractBuildResult);
        vi.mocked(pack).mockRejectedValue(new Error('Pack failed'));
        vi.mocked(formatBundles).mockReturnValue('formatted output');

        const manifest = createMockManifest(['src/A.tsx']);

        // Should throw when all bundles fail
        await expect(
          generateModeComparison(
            ['src/A.tsx'],
            manifest,
            '/project',
            500,
            550,
            1000,
            {
              includeCode: 'header',
              includeStyle: true,
              depth: 2,
              maxNodes: 30,
              format: 'json',
              hashLock: false,
              strict: false,
              allowMissing: true,
              predictBehavior: false,
              quiet: true,
            },
          ),
        ).rejects.toThrow('Failed to compile any no-style bundles');
      });
    });

    describe('non-header mode estimation', () => {
      it('should use estimated values for none mode', async () => {
        vi.mocked(readFileWithText).mockResolvedValue({
          text: 'file content',
          path: '/project/src/A.tsx',
        });

        const manifest = createMockManifest(['src/A.tsx']);

        const result = await generateModeComparison(
          ['src/A.tsx'],
          manifest,
          '/project',
          500,
          550,
          1000,
          {
            includeCode: 'none', // Non-header mode
            includeStyle: false,
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
            quiet: true,
          },
        );

        // Should use estimated values (75% and 85% of current)
        expect(result.headerNoStyleGPT4).toBe(375); // 500 * 0.75
        expect(result.headerNoStyleClaude).toBe(413); // ceil(550 * 0.75)
        expect(result.headerWithStyleGPT4).toBe(425); // ceil(500 * 0.85)
        expect(result.headerWithStyleClaude).toBe(468); // ceil(550 * 0.85)
      });

      it('should use estimated values for full mode', async () => {
        vi.mocked(readFileWithText).mockResolvedValue({
          text: 'file content',
          path: '/project/src/A.tsx',
        });

        const manifest = createMockManifest(['src/A.tsx']);

        const result = await generateModeComparison(
          ['src/A.tsx'],
          manifest,
          '/project',
          500,
          550,
          1000,
          {
            includeCode: 'full', // Non-header mode
            includeStyle: false,
            depth: 2,
            maxNodes: 30,
            format: 'json',
            hashLock: false,
            strict: false,
            allowMissing: true,
            predictBehavior: false,
            quiet: true,
          },
        );

        // Should use estimated values
        expect(result.headerNoStyleGPT4).toBe(375); // 500 * 0.75
        expect(result.headerWithStyleGPT4).toBe(425); // ceil(500 * 0.85)
      });
    });
  });

  describe('displayModeComparison', () => {
    it('should display comparison table', async () => {
      const comparison = {
        headerNoStyleGPT4: 500,
        headerNoStyleClaude: 550,
        headerWithStyleGPT4: 800,
        headerWithStyleClaude: 880,
        sourceTokensGPT4: 1000,
        sourceTokensClaude: 1100,
        modeEstimates: {
          none: { gpt4: 300, claude: 330 },
          header: { gpt4: 500, claude: 550 },
          headerStyle: { gpt4: 800, claude: 880 },
          full: { gpt4: 1500, claude: 1650 },
        },
      };

      await displayModeComparison(
        comparison,
        ['src/App.tsx', 'src/Button.tsx'],
        150,
      );

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('Mode Comparison');
      expect(calls).toContain('Raw source');
      expect(calls).toContain('Header');
      expect(calls).toContain('Completed in 150ms');
    });

    it('should show file statistics', async () => {
      const comparison = {
        headerNoStyleGPT4: 500,
        headerNoStyleClaude: 550,
        headerWithStyleGPT4: 800,
        headerWithStyleClaude: 880,
        sourceTokensGPT4: 1000,
        sourceTokensClaude: 1100,
        modeEstimates: {
          none: { gpt4: 300, claude: 330 },
          header: { gpt4: 500, claude: 550 },
          headerStyle: { gpt4: 800, claude: 880 },
          full: { gpt4: 1500, claude: 1650 },
        },
      };

      await displayModeComparison(
        comparison,
        ['src/App.tsx', 'src/Button.tsx', 'src/utils.ts'],
        150,
      );

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('3 total');
      expect(calls).toContain('.ts');
      expect(calls).toContain('.tsx');
    });

    it('should calculate savings percentages correctly', async () => {
      const comparison = {
        headerNoStyleGPT4: 500, // 50% savings vs 1000 source
        headerNoStyleClaude: 550,
        headerWithStyleGPT4: 800,
        headerWithStyleClaude: 880,
        sourceTokensGPT4: 1000,
        sourceTokensClaude: 1100,
        modeEstimates: {
          none: { gpt4: 300, claude: 330 },
          header: { gpt4: 500, claude: 550 },
          headerStyle: { gpt4: 800, claude: 880 },
          full: { gpt4: 1500, claude: 1650 },
        },
      };

      await displayModeComparison(comparison, ['src/App.tsx'], 150);

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('50%'); // Header savings
    });

    it('should handle zero source tokens without division errors', async () => {
      const comparison = {
        headerNoStyleGPT4: 0,
        headerNoStyleClaude: 0,
        headerWithStyleGPT4: 0,
        headerWithStyleClaude: 0,
        sourceTokensGPT4: 0,
        sourceTokensClaude: 0,
        modeEstimates: {
          none: { gpt4: 0, claude: 0 },
          header: { gpt4: 0, claude: 0 },
          headerStyle: { gpt4: 0, claude: 0 },
          full: { gpt4: 0, claude: 0 },
        },
      };

      // Should not throw
      await expect(
        displayModeComparison(comparison, [], 150),
      ).resolves.not.toThrow();
    });

    it('should display elapsed time', async () => {
      const comparison = {
        headerNoStyleGPT4: 500,
        headerNoStyleClaude: 550,
        headerWithStyleGPT4: 800,
        headerWithStyleClaude: 880,
        sourceTokensGPT4: 1000,
        sourceTokensClaude: 1100,
        modeEstimates: {
          none: { gpt4: 300, claude: 330 },
          header: { gpt4: 500, claude: 550 },
          headerStyle: { gpt4: 800, claude: 880 },
          full: { gpt4: 1500, claude: 1650 },
        },
      };

      await displayModeComparison(comparison, ['src/App.tsx'], 250);

      const calls = consoleSpy.mock.calls.flat().join('\n');
      expect(calls).toContain('250ms');
    });
  });
});
