import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ignoreCommand } from '../../../src/cli/commands/ignore.js';
import * as stampignore from '../../../src/utils/stampignore.js';
import * as fsx from '../../../src/utils/fsx.js';

// Mock dependencies
vi.mock('../../../src/utils/stampignore.js');
vi.mock('../../../src/utils/fsx.js');

describe('ignoreCommand', () => {
  let originalCwd: string;
  let originalConsoleLog: typeof console.log;

  beforeEach(() => {
    originalCwd = process.cwd();
    originalConsoleLog = console.log;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('should throw error when no paths provided', async () => {
    await expect(ignoreCommand({ paths: [] })).rejects.toThrow(
      'No paths provided. Usage: stamp ignore <path1> [path2] ...',
    );
  });

  it('should add paths to .stampignore', async () => {
    vi.mocked(stampignore.readStampignore).mockResolvedValue({ ignore: [] });
    vi.mocked(stampignore.addToStampignore).mockResolvedValue({
      added: true,
      created: false,
    });
    vi.mocked(fsx.normalizeEntryId).mockImplementation((p) => p);
    vi.mocked(fsx.getRelativePath).mockImplementation((_, p) => p);

    await ignoreCommand({ paths: ['src/secrets.ts'] });

    expect(stampignore.addToStampignore).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Added'));
  });

  it('should handle absolute paths by converting to relative', async () => {
    vi.mocked(stampignore.readStampignore).mockResolvedValue({ ignore: [] });
    vi.mocked(stampignore.addToStampignore).mockResolvedValue({
      added: true,
      created: false,
    });
    vi.mocked(fsx.normalizeEntryId).mockImplementation((p) => p);
    vi.mocked(fsx.getRelativePath).mockReturnValue('src/secrets.ts');

    await ignoreCommand({ paths: ['/absolute/path/to/secrets.ts'] });

    expect(fsx.getRelativePath).toHaveBeenCalled();
    expect(stampignore.addToStampignore).toHaveBeenCalled();
  });

  it('should skip paths that already exist in .stampignore', async () => {
    vi.mocked(stampignore.readStampignore).mockResolvedValue({
      ignore: ['src/secrets.ts'],
    });
    vi.mocked(fsx.normalizeEntryId).mockImplementation((p) => p);

    await ignoreCommand({ paths: ['src/secrets.ts'] });

    expect(stampignore.addToStampignore).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('already in .stampignore'),
    );
  });

  it('should not output when quiet flag is set', async () => {
    vi.mocked(stampignore.readStampignore).mockResolvedValue({ ignore: [] });
    vi.mocked(stampignore.addToStampignore).mockResolvedValue({
      added: true,
      created: false,
    });
    vi.mocked(fsx.normalizeEntryId).mockImplementation((p) => p);
    vi.mocked(fsx.getRelativePath).mockImplementation((_, p) => p);

    await ignoreCommand({ paths: ['src/secrets.ts'], quiet: true });

    expect(console.log).not.toHaveBeenCalled();
  });

  it('should show created message when .stampignore is created', async () => {
    vi.mocked(stampignore.readStampignore).mockResolvedValue({ ignore: [] });
    vi.mocked(stampignore.addToStampignore).mockResolvedValue({
      added: true,
      created: true,
    });
    vi.mocked(fsx.normalizeEntryId).mockImplementation((p) => p);
    vi.mocked(fsx.getRelativePath).mockImplementation((_, p) => p);

    await ignoreCommand({ paths: ['src/secrets.ts'] });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Created .stampignore'),
    );
  });

  it('should handle multiple paths', async () => {
    vi.mocked(stampignore.readStampignore).mockResolvedValue({ ignore: [] });
    vi.mocked(stampignore.addToStampignore).mockResolvedValue({
      added: true,
      created: false,
    });
    vi.mocked(fsx.normalizeEntryId).mockImplementation((p) => p);
    vi.mocked(fsx.getRelativePath).mockImplementation((_, p) => p);

    await ignoreCommand({ paths: ['src/secrets.ts', 'src/config.ts'] });

    expect(stampignore.addToStampignore).toHaveBeenCalledWith(
      expect.any(String),
      ['src/secrets.ts', 'src/config.ts'],
    );
  });

  it('should filter out duplicates from normalized paths', async () => {
    vi.mocked(stampignore.readStampignore).mockResolvedValue({ ignore: [] });
    vi.mocked(stampignore.addToStampignore).mockResolvedValue({
      added: true,
      created: false,
    });
    vi.mocked(fsx.normalizeEntryId).mockImplementation((p) =>
      p.replace(/\\/g, '/'),
    );
    vi.mocked(fsx.getRelativePath).mockImplementation((_, p) => p);

    await ignoreCommand({ paths: ['src/secrets.ts', 'src\\secrets.ts'] });

    // Should normalize and deduplicate
    expect(stampignore.addToStampignore).toHaveBeenCalled();
  });
});
