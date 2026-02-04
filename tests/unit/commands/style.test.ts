import { describe, it, expect, vi, beforeEach } from 'vitest';
import { styleCommand } from '../../../src/cli/commands/style.js';
import { contextCommand } from '../../../src/cli/commands/context.js';

// Mock the contextCommand
vi.mock('../../../src/cli/commands/context.js', () => ({
  contextCommand: vi.fn(),
}));

describe('styleCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call contextCommand with includeStyle: true', async () => {
    const mockOptions = {
      entry: './src',
      depth: 2,
      includeCode: 'header' as const,
    };

    vi.mocked(contextCommand).mockResolvedValue(undefined);

    await styleCommand(mockOptions);

    expect(contextCommand).toHaveBeenCalledWith({
      ...mockOptions,
      includeStyle: true,
    });
  });

  it('should pass through all options to contextCommand', async () => {
    const mockOptions = {
      entry: './test',
      depth: 3,
      includeCode: 'full' as const,
      format: 'json' as const,
      out: 'custom.json',
      maxNodes: 50,
      profile: 'llm-safe' as const,
      strict: true,
      quiet: true,
    };

    vi.mocked(contextCommand).mockResolvedValue(undefined);

    await styleCommand(mockOptions);

    expect(contextCommand).toHaveBeenCalledWith({
      ...mockOptions,
      includeStyle: true,
    });
  });

  it('should override includeStyle if provided (though it should always be true)', async () => {
    const mockOptions = {
      entry: './src',
      includeStyle: false, // This shouldn't happen in practice, but test the behavior
    };

    vi.mocked(contextCommand).mockResolvedValue(undefined);

    await styleCommand(mockOptions);

    // includeStyle should be set to true regardless of input
    expect(contextCommand).toHaveBeenCalledWith({
      ...mockOptions,
      includeStyle: true,
    });
  });
});
