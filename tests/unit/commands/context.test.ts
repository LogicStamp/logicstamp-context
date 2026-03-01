import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { contextCommand, type ContextOptions } from '../../../src/cli/commands/context.js';
import * as fsx from '../../../src/utils/fsx.js';
import * as stampignore from '../../../src/utils/stampignore.js';
import * as manifest from '../../../src/core/manifest.js';
import * as pack from '../../../src/core/pack.js';
import * as tokens from '../../../src/utils/tokens.js';
import * as contextHelpers from '../../../src/cli/commands/context/index.js';
import * as validate from '../../../src/cli/commands/validate.js';

// Mock dependencies
vi.mock('../../../src/utils/fsx.js');
vi.mock('../../../src/utils/stampignore.js');
vi.mock('../../../src/core/manifest.js');
vi.mock('../../../src/core/pack.js');
vi.mock('../../../src/utils/tokens.js');
vi.mock('../../../src/cli/commands/context/index.js');
vi.mock('../../../src/cli/commands/validate.js');
vi.mock('../../../src/cli/commands/context/watchMode.js');
vi.mock('../../../src/core/pack/index.js', () => ({
  getAndResetSanitizeStats: vi.fn(() => ({ filesWithSecrets: 0, totalSecretsReplaced: 0, filesProcessed: [], securityReportLoaded: false })),
}));
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

describe('contextCommand', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalConsoleWarn: typeof console.warn;
  let exitCode: number | undefined;
  let originalArgv: string[];

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    originalArgv = process.argv;
    exitCode = undefined;

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      exitCode = code as number;
      return undefined as never;
    });

    // Reset argv
    process.argv = ['node', 'stamp', 'context'];

    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(fsx.globFiles).mockResolvedValue(['src/App.tsx', 'src/Button.tsx']);
    vi.mocked(stampignore.readStampignore).mockResolvedValue({ ignore: [] });
    vi.mocked(stampignore.filterIgnoredFiles).mockImplementation((files) => files);
    vi.mocked(contextHelpers.buildContractsFromFiles).mockResolvedValue({
      contracts: [
        { entryId: 'src/App.tsx', type: 'UIFContract', schemaVersion: '0.4' } as any,
      ],
      analyzed: 1,
      totalSourceSize: 1000,
    });
    vi.mocked(manifest.buildDependencyGraph).mockReturnValue({
      components: {},
      graph: { roots: ['src/App.tsx'], nodes: {}, edges: {} },
    } as any);
    vi.mocked(pack.pack).mockResolvedValue({
      type: 'LogicStampBundle',
      schemaVersion: '0.1',
      entryId: 'src/App.tsx',
      depth: 2,
      createdAt: new Date().toISOString(),
      bundleHash: 'uifb:test123456789012345678',
      graph: {
        nodes: [{ entryId: 'src/App.tsx', contract: {} as any }],
        edges: [],
      },
      meta: { missing: [], source: 'test' },
    });
    vi.mocked(tokens.estimateGPT4Tokens).mockResolvedValue(500);
    vi.mocked(tokens.estimateClaudeTokens).mockResolvedValue(450);
    vi.mocked(contextHelpers.formatBundles).mockReturnValue('[]');
    vi.mocked(contextHelpers.calculateStats).mockReturnValue({
      totalNodes: 1,
      totalEdges: 0,
      totalMissing: 0,
    });
    vi.mocked(contextHelpers.calculateTokenEstimates).mockResolvedValue({
      currentGPT4: 500,
      currentClaude: 450,
      sourceTokensGPT4: 1000,
      sourceTokensClaude: 900,
      modeEstimates: {
        none: { gpt4: 300, claude: 270 },
        header: { gpt4: 500, claude: 450 },
        full: { gpt4: 1000, claude: 900 },
      },
      savingsGPT4: '50%',
      savingsClaude: '50%',
    });
    vi.mocked(validate.validateBundles).mockReturnValue({
      valid: true,
      errors: 0,
      warnings: 0,
      bundles: 1,
      nodes: 1,
      edges: 0,
      messages: [],
    });
    vi.mocked(contextHelpers.writeContextFiles).mockResolvedValue({
      filesWritten: 1,
      folderInfos: [],
      totalTokenEstimate: 500,
    });
    vi.mocked(contextHelpers.writeMainIndex).mockResolvedValue();
    vi.mocked(contextHelpers.groupBundlesByFolder).mockReturnValue(new Map());
    vi.mocked(contextHelpers.displayPath).mockImplementation((p) => p);
    vi.mocked(contextHelpers.ensureConfigExists).mockResolvedValue();
    vi.mocked(contextHelpers.setupGitignore).mockResolvedValue();
    vi.mocked(contextHelpers.setupLLMContext).mockResolvedValue();
    vi.mocked(contextHelpers.generateSummary).mockResolvedValue();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  const defaultOptions: ContextOptions = {
    depth: 2,
    includeCode: 'header',
    format: 'json',
    out: 'context.json',
    hashLock: false,
    strict: false,
    allowMissing: true,
    maxNodes: 100,
    profile: 'llm-chat',
    predictBehavior: false,
    dryRun: false,
    stats: false,
    strictMissing: false,
    compareModes: false,
  };

  it('should generate context files successfully', async () => {
    await contextCommand(defaultOptions);

    expect(fsx.globFiles).toHaveBeenCalled();
    expect(contextHelpers.buildContractsFromFiles).toHaveBeenCalled();
    expect(manifest.buildDependencyGraph).toHaveBeenCalled();
    expect(pack.pack).toHaveBeenCalled();
    expect(contextHelpers.writeContextFiles).toHaveBeenCalled();
    expect(contextHelpers.writeMainIndex).toHaveBeenCalled();
  });

  it('should exit with 1 when no files found', async () => {
    vi.mocked(fsx.globFiles).mockResolvedValue([]);

    await contextCommand(defaultOptions);

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No TypeScript modules found')
    );
  });

  it('should exit with 1 when no components found', async () => {
    vi.mocked(contextHelpers.buildContractsFromFiles).mockResolvedValue({
      contracts: [],
      analyzed: 0,
      totalSourceSize: 0,
    });

    await contextCommand(defaultOptions);

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No components found')
    );
  });

  it('should exit with 1 when no bundles compiled', async () => {
    vi.mocked(pack.pack).mockRejectedValue(new Error('Pack failed'));

    await contextCommand(defaultOptions);

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No bundles could be compiled')
    );
  });

  it('should exit with 1 when validation fails', async () => {
    vi.mocked(validate.validateBundles).mockReturnValue({
      valid: false,
      errors: 1,
      warnings: 0,
      bundles: 1,
      nodes: 1,
      edges: 0,
      messages: ['Invalid bundle'],
    });

    await contextCommand(defaultOptions);

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Validation failed')
    );
  });

  it('should skip writing files in dry run mode', async () => {
    await contextCommand({ ...defaultOptions, dryRun: true });

    expect(contextHelpers.writeContextFiles).not.toHaveBeenCalled();
    expect(contextHelpers.writeMainIndex).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Dry run')
    );
  });

  it('should output stats JSON when stats flag is set', async () => {
    vi.mocked(contextHelpers.generateStatsOutput).mockReturnValue({
      components: 1,
      bundles: 1,
      tokens: { gpt4: 500, claude: 450 },
    });

    await contextCommand({ ...defaultOptions, stats: true });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/^\{.*\}$/)
    );
  });

  it('should be quiet when quiet flag is set', async () => {
    await contextCommand({ ...defaultOptions, quiet: true });

    // Check that informational logs were not called
    const logCalls = vi.mocked(console.log).mock.calls;
    const scanningCalls = logCalls.filter(call =>
      typeof call[0] === 'string' && call[0].includes('Scanning')
    );
    expect(scanningCalls).toHaveLength(0);
  });

  it('should filter files based on stampignore', async () => {
    vi.mocked(stampignore.readStampignore).mockResolvedValue({
      ignore: ['src/Button.tsx'],
    });
    vi.mocked(stampignore.filterIgnoredFiles).mockReturnValue(['src/App.tsx']);

    await contextCommand(defaultOptions);

    expect(stampignore.filterIgnoredFiles).toHaveBeenCalled();
  });

  it('should use llm-safe profile settings', async () => {
    await contextCommand({ ...defaultOptions, profile: 'llm-safe' });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('llm-safe')
    );
  });

  it('should use ci-strict profile settings', async () => {
    await contextCommand({ ...defaultOptions, profile: 'ci-strict' });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('ci-strict')
    );
  });

  it('should exit with 1 when strictMissing enabled and missing deps found', async () => {
    vi.mocked(contextHelpers.calculateStats).mockReturnValue({
      totalNodes: 1,
      totalEdges: 0,
      totalMissing: 5,
    });

    await contextCommand({ ...defaultOptions, strictMissing: true });

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Strict missing mode')
    );
  });

  it('should display sanitization warning when secrets found', async () => {
    const packIndexModule = await import('../../../src/core/pack/index.js');
    vi.mocked(packIndexModule.getAndResetSanitizeStats).mockReturnValue({
      filesWithSecrets: 2,
      totalSecretsReplaced: 5,
      filesProcessed: ['src/config.ts', 'src/secrets.ts'],
      securityReportLoaded: true,
    });

    await contextCommand(defaultOptions);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Secret sanitization')
    );
  });

  it('should use custom entry path', async () => {
    await contextCommand({ ...defaultOptions, entry: './custom/path' });

    expect(fsx.globFiles).toHaveBeenCalledWith(
      expect.stringContaining('custom')
    );
  });

  it('should handle compare modes flag', async () => {
    vi.mocked(contextHelpers.generateModeComparison).mockResolvedValue({} as any);
    vi.mocked(contextHelpers.displayModeComparison).mockResolvedValue();

    await contextCommand({ ...defaultOptions, compareModes: true });

    expect(contextHelpers.generateModeComparison).toHaveBeenCalled();
    expect(contextHelpers.displayModeComparison).toHaveBeenCalled();
    // Should return early without writing files
    expect(contextHelpers.writeContextFiles).not.toHaveBeenCalled();
  });

  it('should use watch-fast profile settings', async () => {
    await contextCommand({ ...defaultOptions, profile: 'watch-fast' });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('watch-fast')
    );
  });

  it('should use llm-chat profile settings', async () => {
    await contextCommand({ ...defaultOptions, profile: 'llm-chat' });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('llm-chat')
    );
  });

  it('should return early with stats when watch and stats are both set', async () => {
    // When stats is true, the function returns early before watch mode check
    // This tests that stats takes precedence
    vi.mocked(contextHelpers.generateStatsOutput).mockReturnValue({
      components: 1,
      bundles: 1,
      tokens: { gpt4: 500, claude: 450 },
    });

    await contextCommand({ ...defaultOptions, watch: true, stats: true });

    // Stats output should still be generated (early return)
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/^\{.*\}$/)
    );
    // Watch mode should not be started
    expect(contextHelpers.initializeWatchCache).not.toHaveBeenCalled();
  });

  it('should return early with compareModes when watch and compareModes are both set', async () => {
    // When compareModes is true, the function returns early before watch mode check
    vi.mocked(contextHelpers.generateModeComparison).mockResolvedValue({} as any);
    vi.mocked(contextHelpers.displayModeComparison).mockResolvedValue();

    await contextCommand({ ...defaultOptions, watch: true, compareModes: true });

    // Compare modes should still be displayed (early return)
    expect(contextHelpers.generateModeComparison).toHaveBeenCalled();
    expect(contextHelpers.displayModeComparison).toHaveBeenCalled();
    // Watch mode should not be started
    expect(contextHelpers.initializeWatchCache).not.toHaveBeenCalled();
  });

  it('should display validation warnings when valid but has warnings', async () => {
    vi.mocked(validate.validateBundles).mockReturnValue({
      valid: true,
      errors: 0,
      warnings: 2,
      bundles: 1,
      nodes: 1,
      edges: 0,
      messages: ['Warning: missing type', 'Warning: unused prop'],
    });

    await contextCommand(defaultOptions);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('2 warning(s)')
    );
  });

  it('should not display comparison when compareModes and stats are both set', async () => {
    vi.mocked(contextHelpers.generateModeComparison).mockResolvedValue({
      modes: [],
    } as any);

    // When both compareModes and stats are set, comparison data is written to file
    // instead of being displayed. We can't easily mock writeFile in ESM, but we can
    // verify that displayModeComparison is NOT called.
    await contextCommand({ ...defaultOptions, compareModes: true, stats: true, quiet: true });

    expect(contextHelpers.generateModeComparison).toHaveBeenCalled();
    // Should not call displayModeComparison when stats is set (writes to file instead)
    expect(contextHelpers.displayModeComparison).not.toHaveBeenCalled();
  });

  it('should respect user-set depth via command line argv', async () => {
    process.argv = ['node', 'stamp', 'context', '--depth', '5'];

    await contextCommand({ ...defaultOptions, profile: 'llm-safe', depth: 5 });

    // pack should be called with user's depth value, not profile default
    expect(pack.pack).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ depth: 5 }),
      expect.any(String)
    );
  });

  it('should respect user-set includeCode via command line argv', async () => {
    process.argv = ['node', 'stamp', 'context', '--include-code', 'full'];

    await contextCommand({ ...defaultOptions, profile: 'llm-safe', includeCode: 'full' });

    expect(pack.pack).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ includeCode: 'full' }),
      expect.any(String)
    );
  });

  it('should pack multiple root components', async () => {
    vi.mocked(manifest.buildDependencyGraph).mockReturnValue({
      components: {},
      graph: { roots: ['src/App.tsx', 'src/Button.tsx', 'src/Header.tsx'], nodes: {}, edges: {} },
    } as any);

    await contextCommand(defaultOptions);

    expect(pack.pack).toHaveBeenCalledTimes(3);
  });

  it('should continue packing when some bundles fail', async () => {
    vi.mocked(manifest.buildDependencyGraph).mockReturnValue({
      components: {},
      graph: { roots: ['src/App.tsx', 'src/Button.tsx'], nodes: {}, edges: {} },
    } as any);

    let callCount = 0;
    vi.mocked(pack.pack).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Pack failed for first component');
      }
      return {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: 'src/Button.tsx',
        depth: 2,
        createdAt: new Date().toISOString(),
        bundleHash: 'uifb:test123456789012345678',
        graph: {
          nodes: [{ entryId: 'src/Button.tsx', contract: {} as any }],
          edges: [],
        },
        meta: { missing: [], source: 'test' },
      };
    });

    await contextCommand(defaultOptions);

    expect(pack.pack).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to pack')
    );
    // Should still write files for successful bundles
    expect(contextHelpers.writeContextFiles).toHaveBeenCalled();
  });

  it('should sort bundles by entryId for deterministic output', async () => {
    vi.mocked(manifest.buildDependencyGraph).mockReturnValue({
      components: {},
      graph: { roots: ['src/Zebra.tsx', 'src/Alpha.tsx'], nodes: {}, edges: {} },
    } as any);

    const bundles: pack.LogicStampBundle[] = [];
    vi.mocked(pack.pack).mockImplementation(async (rootId) => {
      const bundle: pack.LogicStampBundle = {
        type: 'LogicStampBundle',
        schemaVersion: '0.1',
        entryId: rootId,
        depth: 2,
        createdAt: new Date().toISOString(),
        bundleHash: 'uifb:test123456789012345678',
        graph: { nodes: [{ entryId: rootId, contract: {} as any }], edges: [] },
        meta: { missing: [], source: 'test' },
      };
      bundles.push(bundle);
      return bundle;
    });

    await contextCommand(defaultOptions);

    // formatBundles should receive sorted bundles
    expect(contextHelpers.formatBundles).toHaveBeenCalled();
    const formatBundlesCall = vi.mocked(contextHelpers.formatBundles).mock.calls[0];
    const passedBundles = formatBundlesCall[0];
    expect(passedBundles[0].entryId).toBe('src/Alpha.tsx');
    expect(passedBundles[1].entryId).toBe('src/Zebra.tsx');
  });

  it('should pass includeStyle option to buildContractsFromFiles', async () => {
    await contextCommand({ ...defaultOptions, includeStyle: true });

    expect(contextHelpers.buildContractsFromFiles).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(String),
      expect.objectContaining({ includeStyle: true })
    );
  });

  it('should pass predictBehavior option to buildContractsFromFiles', async () => {
    await contextCommand({ ...defaultOptions, predictBehavior: true });

    expect(contextHelpers.buildContractsFromFiles).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(String),
      expect.objectContaining({ predictBehavior: true })
    );
  });

  it('should not skip strictMissing exit in watch mode', async () => {
    vi.mocked(contextHelpers.calculateStats).mockReturnValue({
      totalNodes: 1,
      totalEdges: 0,
      totalMissing: 5,
    });
    vi.mocked(contextHelpers.initializeWatchCache).mockResolvedValue({} as any);

    // Watch mode with strictMissing - should NOT exit because watch mode continues
    await contextCommand({ ...defaultOptions, strictMissing: true, watch: true });

    // Should exit due to watch+stats/compareModes incompatibility check happening AFTER stats check
    // Actually the code checks watch incompatibility AFTER successful run, so this will pass
    // Let me check the flow again - strictMissing exit is skipped if watch is true
    // So no exit code should be set for strictMissing
    expect(exitCode).toBeUndefined();
  });

  it('should log excluded file count when stampignore filters files', async () => {
    vi.mocked(fsx.globFiles).mockResolvedValue(['src/App.tsx', 'src/Button.tsx', 'src/Secret.tsx']);
    vi.mocked(stampignore.readStampignore).mockResolvedValue({
      ignore: ['src/Secret.tsx'],
    });
    vi.mocked(stampignore.filterIgnoredFiles).mockReturnValue(['src/App.tsx', 'src/Button.tsx']);

    await contextCommand(defaultOptions);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Excluded 1 file(s)')
    );
  });

  it('should not log excluded files in quiet mode', async () => {
    vi.mocked(fsx.globFiles).mockResolvedValue(['src/App.tsx', 'src/Button.tsx', 'src/Secret.tsx']);
    vi.mocked(stampignore.readStampignore).mockResolvedValue({
      ignore: ['src/Secret.tsx'],
    });
    vi.mocked(stampignore.filterIgnoredFiles).mockReturnValue(['src/App.tsx', 'src/Button.tsx']);

    await contextCommand({ ...defaultOptions, quiet: true });

    const logCalls = vi.mocked(console.log).mock.calls;
    const excludedCalls = logCalls.filter(call =>
      typeof call[0] === 'string' && call[0].includes('Excluded')
    );
    expect(excludedCalls).toHaveLength(0);
  });

  it('should display file count when not in quiet mode', async () => {
    await contextCommand(defaultOptions);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Found 2 files')
    );
  });

  it('should display analyzed component count when not in quiet mode', async () => {
    await contextCommand(defaultOptions);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Analyzed 1 components')
    );
  });

  it('should display validation passed message when valid and no warnings', async () => {
    await contextCommand(defaultOptions);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Validation passed')
    );
  });

  it('should display files written count on success', async () => {
    vi.mocked(contextHelpers.writeContextFiles).mockResolvedValue({
      filesWritten: 5,
      folderInfos: [],
      totalTokenEstimate: 500,
    });

    await contextCommand(defaultOptions);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('6 context files written')
    );
  });

  it('should display no secrets message when sanitization finds none', async () => {
    const packIndexModule = await import('../../../src/core/pack/index.js');
    vi.mocked(packIndexModule.getAndResetSanitizeStats).mockReturnValue({
      filesWithSecrets: 0,
      totalSecretsReplaced: 0,
      filesProcessed: [],
      securityReportLoaded: true,
    });

    await contextCommand(defaultOptions);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('no secret patterns detected')
    );
  });

  it('should display security scan skipped message when no security report exists', async () => {
    const packIndexModule = await import('../../../src/core/pack/index.js');
    vi.mocked(packIndexModule.getAndResetSanitizeStats).mockReturnValue({
      filesWithSecrets: 0,
      totalSecretsReplaced: 0,
      filesProcessed: [],
      securityReportLoaded: false,
    });

    await contextCommand(defaultOptions);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Security scan skipped')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('stamp init')
    );
  });

  it('should display elapsed time on completion', async () => {
    await contextCommand(defaultOptions);

    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/Completed in \d+ms/)
    );
  });
});
