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
  getAndResetSanitizeStats: vi.fn(() => ({ filesWithSecrets: 0, totalSecretsReplaced: 0 })),
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
      rawSource: 1000,
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

  it('should exit with 1 when no bundles generated', async () => {
    vi.mocked(pack.pack).mockRejectedValue(new Error('Pack failed'));

    await contextCommand(defaultOptions);

    expect(exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No bundles could be generated')
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
});
