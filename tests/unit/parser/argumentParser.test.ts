import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseContextArgs,
  parseCompareArgs,
  parseValidateArgs,
  parseInitArgs,
  parseCleanArgs,
  parseStyleArgs,
  parseIgnoreArgs,
} from '../../../src/cli/parser/argumentParser.js';

describe('parseContextArgs', () => {
  let originalExit: typeof process.exit;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalExit = process.exit;
    originalConsoleError = console.error;
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exit = originalExit;
    console.error = originalConsoleError;
  });

  it('should use default values when no args provided', () => {
    const options = parseContextArgs([]);
    expect(options.depth).toBe(2);
    expect(options.format).toBe('json');
    expect(options.includeCode).toBe('header');
    expect(options.out).toBe('context.json');
    expect(options.strict).toBe(false);
    expect(options.watch).toBe(false);
    expect(options.styleMode).toBe('lean');
  });

  it('should parse depth flag', () => {
    const options = parseContextArgs(['--depth', '3']);
    expect(options.depth).toBe(3);
  });

  it('should parse depth short flag', () => {
    const options = parseContextArgs(['-d', '1']);
    expect(options.depth).toBe(1);
  });

  it('should exit on invalid depth value (non-numeric)', () => {
    parseContextArgs(['--depth', 'abc']);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid depth value'),
    );
  });

  it('should exit on negative depth value', () => {
    parseContextArgs(['--depth', '-5']);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid depth value'),
    );
  });

  it('should exit on missing depth value', () => {
    parseContextArgs(['--depth']);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid depth value'),
    );
  });

  it('should exit on invalid depth value using short flag', () => {
    parseContextArgs(['-d', 'abc']);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid depth value'),
    );
  });

  it('should parse format flag', () => {
    const options = parseContextArgs(['--format', 'pretty']);
    expect(options.format).toBe('pretty');
  });

  it('should parse format short flag', () => {
    const options = parseContextArgs(['-f', 'ndjson']);
    expect(options.format).toBe('ndjson');
  });

  it('should parse include-code flag', () => {
    const options = parseContextArgs(['--include-code', 'full']);
    expect(options.includeCode).toBe('full');
  });

  it('should parse include-code short flag', () => {
    const options = parseContextArgs(['-c', 'none']);
    expect(options.includeCode).toBe('none');
  });

  it('should parse out flag', () => {
    const options = parseContextArgs(['--out', 'custom.json']);
    expect(options.out).toBe('custom.json');
  });

  it('should parse out short flag', () => {
    const options = parseContextArgs(['-o', 'output.json']);
    expect(options.out).toBe('output.json');
  });

  it('should parse max-nodes flag', () => {
    const options = parseContextArgs(['--max-nodes', '200']);
    expect(options.maxNodes).toBe(200);
  });

  it('should parse max-nodes short flag', () => {
    const options = parseContextArgs(['-m', '50']);
    expect(options.maxNodes).toBe(50);
  });

  it('should parse max-roots flag', () => {
    const options = parseContextArgs(['--max-roots', '25']);
    expect(options.maxRoots).toBe(25);
  });

  it('should parse max-roots short flag', () => {
    const options = parseContextArgs(['-r', '10']);
    expect(options.maxRoots).toBe(10);
  });

  it('should exit on invalid max-nodes value (non-numeric)', () => {
    parseContextArgs(['--max-nodes', 'xyz']);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid max-nodes value'),
    );
  });

  it('should exit on zero max-nodes value', () => {
    parseContextArgs(['--max-nodes', '0']);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid max-nodes value'),
    );
  });

  it('should exit on negative max-nodes value', () => {
    parseContextArgs(['--max-nodes', '-10']);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid max-nodes value'),
    );
  });

  it('should exit on missing max-nodes value', () => {
    parseContextArgs(['--max-nodes']);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid max-nodes value'),
    );
  });

  it('should exit on zero max-nodes value using short flag', () => {
    parseContextArgs(['-m', '0']);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid max-nodes value'),
    );
  });

  it('should exit on invalid max-roots value (non-numeric)', () => {
    parseContextArgs(['--max-roots', 'xyz']);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid max-roots value'),
    );
  });

  it('should exit on zero max-roots value', () => {
    parseContextArgs(['--max-roots', '0']);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Invalid max-roots value'),
    );
  });

  it('should parse profile flag', () => {
    const options = parseContextArgs(['--profile', 'llm-safe']);
    expect(options.profile).toBe('llm-safe');
  });

  it('should parse style-mode flag', () => {
    const options = parseContextArgs(['--style-mode', 'full']);
    expect(options.styleMode).toBe('full');
  });

  it('should default styleMode to lean', () => {
    const options = parseContextArgs(['--include-style']);
    expect(options.styleMode).toBe('lean');
  });

  it('should parse boolean flags', () => {
    const options = parseContextArgs([
      '--strict',
      '--watch',
      '--include-style',
    ]);
    expect(options.strict).toBe(true);
    expect(options.watch).toBe(true);
    expect(options.includeStyle).toBe(true);
  });

  it('should parse strict-watch flag and automatically enable watch', () => {
    const options = parseContextArgs(['--strict-watch']);
    expect(options.strictWatch).toBe(true);
    expect(options.watch).toBe(true);
  });

  it('should allow both watch and strict-watch flags together', () => {
    const options = parseContextArgs(['--watch', '--strict-watch']);
    expect(options.watch).toBe(true);
    expect(options.strictWatch).toBe(true);
  });

  it('should parse short boolean flags', () => {
    const options = parseContextArgs(['-s', '-w', '-q']);
    expect(options.strict).toBe(true);
    expect(options.watch).toBe(true);
    expect(options.quiet).toBe(true);
  });

  it('should parse verbose flag', () => {
    const options = parseContextArgs(['--verbose']);
    expect(options.verbose).toBe(true);
  });

  it('should parse verbose short flag', () => {
    const options = parseContextArgs(['-v']);
    expect(options.verbose).toBe(true);
  });

  it('should default verbose to false', () => {
    const options = parseContextArgs([]);
    expect(options.verbose).toBe(false);
  });

  it('should parse entry path as positional argument', () => {
    const options = parseContextArgs(['src/App.tsx']);
    expect(options.entry).toBe('src/App.tsx');
  });

  it('should parse entry path with flags', () => {
    const options = parseContextArgs(['--depth', '3', 'src/App.tsx']);
    expect(options.depth).toBe(3);
    expect(options.entry).toBe('src/App.tsx');
  });

  it('should handle multiple flags', () => {
    const options = parseContextArgs([
      '--depth',
      '3',
      '--format',
      'pretty',
      '--strict',
      '--watch',
      'src/App.tsx',
    ]);
    expect(options.depth).toBe(3);
    expect(options.format).toBe('pretty');
    expect(options.strict).toBe(true);
    expect(options.watch).toBe(true);
    expect(options.entry).toBe('src/App.tsx');
  });

  it('should exit on unknown option', () => {
    parseContextArgs(['--unknown-flag']);
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Unknown option'),
    );
  });
});

describe('parseCompareArgs', () => {
  it('should parse stats flag', () => {
    const args = parseCompareArgs(['--stats', 'old.json', 'new.json']);
    expect(args.stats).toBe(true);
    expect(args.positionalArgs).toEqual(['old.json', 'new.json']);
  });

  it('should parse approve flag', () => {
    const args = parseCompareArgs(['--approve', 'old.json', 'new.json']);
    expect(args.approve).toBe(true);
  });

  it('should parse clean-orphaned flag', () => {
    const args = parseCompareArgs(['--clean-orphaned', 'old.json', 'new.json']);
    expect(args.cleanOrphaned).toBe(true);
  });

  it('should parse quiet flag', () => {
    const args = parseCompareArgs(['--quiet', 'old.json', 'new.json']);
    expect(args.quiet).toBe(true);
  });

  it('should parse quiet short flag', () => {
    const args = parseCompareArgs(['-q', 'old.json', 'new.json']);
    expect(args.quiet).toBe(true);
    expect(args.positionalArgs).toEqual(['old.json', 'new.json']);
  });

  it('should parse skip-gitignore flag', () => {
    const args = parseCompareArgs(['--skip-gitignore', 'old.json', 'new.json']);
    expect(args.skipGitignore).toBe(true);
  });

  it('should extract positional arguments', () => {
    const args = parseCompareArgs(['old.json', 'new.json']);
    expect(args.positionalArgs).toEqual(['old.json', 'new.json']);
  });

  it('should filter out flags from positional args', () => {
    const args = parseCompareArgs(['--stats', 'old.json', 'new.json', '-q']);
    expect(args.stats).toBe(true);
    expect(args.quiet).toBe(true);
    expect(args.positionalArgs).toEqual(['old.json', 'new.json']);
  });
});

describe('parseValidateArgs', () => {
  it('should parse quiet flag', () => {
    const args = parseValidateArgs(['--quiet', 'context.json']);
    expect(args.quiet).toBe(true);
    expect(args.filePath).toBe('context.json');
  });

  it('should parse quiet short flag', () => {
    const args = parseValidateArgs(['-q', 'context.json']);
    expect(args.quiet).toBe(true);
    expect(args.filePath).toBe('context.json');
  });

  it('should extract file path', () => {
    const args = parseValidateArgs(['context.json']);
    expect(args.filePath).toBe('context.json');
    expect(args.quiet).toBe(false);
  });

  it('should handle no file path', () => {
    const args = parseValidateArgs(['--quiet']);
    expect(args.quiet).toBe(true);
    expect(args.filePath).toBeUndefined();
  });
});

describe('parseInitArgs', () => {
  let originalExit: typeof process.exit;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    originalExit = process.exit;
    originalConsoleError = console.error;
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exit = originalExit;
    console.error = originalConsoleError;
  });

  it('should parse skip-gitignore flag', () => {
    const options = parseInitArgs(['--skip-gitignore']);
    expect(options.skipGitignore).toBe(true);
  });

  it('should parse yes flag', () => {
    const options = parseInitArgs(['--yes']);
    expect(options.yes).toBe(true);
  });

  it('should parse yes short flag', () => {
    const options = parseInitArgs(['-y']);
    expect(options.yes).toBe(true);
  });

  it('should parse no-secure flag', () => {
    const options = parseInitArgs(['--no-secure']);
    expect(options.noSecure).toBe(true);
  });

  it('should parse target directory', () => {
    const options = parseInitArgs(['./my-project']);
    expect(options.targetDir).toBe('./my-project');
  });

  it('should ignore quiet flags', () => {
    const options = parseInitArgs(['--quiet', '-q']);
    expect(options.yes).toBeUndefined();
  });

  it('should exit on unknown option', () => {
    parseInitArgs(['--unknown-flag']);
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});

describe('parseCleanArgs', () => {
  it('should parse all flag', () => {
    const options = parseCleanArgs(['--all']);
    expect(options.all).toBe(true);
  });

  it('should parse yes flag', () => {
    const options = parseCleanArgs(['--yes']);
    expect(options.yes).toBe(true);
  });

  it('should parse quiet flag', () => {
    const options = parseCleanArgs(['--quiet']);
    expect(options.quiet).toBe(true);
  });

  it('should parse quiet short flag', () => {
    const options = parseCleanArgs(['-q']);
    expect(options.quiet).toBe(true);
  });

  it('should parse project root', () => {
    const options = parseCleanArgs(['./my-project']);
    expect(options.projectRoot).toBe('./my-project');
  });

  it('should handle multiple flags', () => {
    const options = parseCleanArgs([
      '--all',
      '--yes',
      '--quiet',
      './my-project',
    ]);
    expect(options.all).toBe(true);
    expect(options.yes).toBe(true);
    expect(options.quiet).toBe(true);
    expect(options.projectRoot).toBe('./my-project');
  });
});

describe('parseStyleArgs', () => {
  it('should parse style args same as context args', () => {
    const options = parseStyleArgs(['--depth', '3', '--format', 'pretty']);
    expect(options.depth).toBe(3);
    expect(options.format).toBe('pretty');
  });

  it('should not include includeStyle in result', () => {
    const options = parseStyleArgs(['--include-style']);
    // includeStyle should not be in StyleOptions
    expect('includeStyle' in options).toBe(false);
  });
});

describe('parseIgnoreArgs', () => {
  it('should parse quiet flag', () => {
    const args = parseIgnoreArgs(['--quiet', 'path1', 'path2']);
    expect(args.quiet).toBe(true);
    expect(args.paths).toEqual(['path1', 'path2']);
  });

  it('should parse quiet short flag', () => {
    const args = parseIgnoreArgs(['-q', 'path1']);
    expect(args.quiet).toBe(true);
    expect(args.paths).toEqual(['path1']);
  });

  it('should collect paths', () => {
    const args = parseIgnoreArgs(['path1', 'path2', 'path3']);
    expect(args.paths).toEqual(['path1', 'path2', 'path3']);
  });

  it('should handle no paths', () => {
    const args = parseIgnoreArgs(['--quiet']);
    expect(args.quiet).toBe(true);
    expect(args.paths).toEqual([]);
  });
});
