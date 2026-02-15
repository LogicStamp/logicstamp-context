/**
 * Unit tests for contractBuilder module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockContract } from './helpers.js';

// Mock dependencies before imports
vi.mock('../../../../src/core/contractBuilder.js', () => ({
  buildContract: vi.fn(),
}));

vi.mock('../../../../src/core/astParser.js', () => ({
  extractFromFile: vi.fn(),
}));

vi.mock('../../../../src/extractors/styling/index.js', () => ({
  extractStyleMetadata: vi.fn(),
}));

vi.mock('../../../../src/utils/fsx.js', () => ({
  readFileWithText: vi.fn(),
}));

vi.mock('ts-morph', () => {
  return {
    Project: class MockProject {
      addSourceFileAtPath = vi.fn().mockReturnValue({});
    },
  };
});

// Import after mocks
import { buildContractsFromFiles } from '../../../../src/cli/commands/context/contractBuilder.js';
import { buildContract } from '../../../../src/core/contractBuilder.js';
import { extractFromFile } from '../../../../src/core/astParser.js';
import { readFileWithText } from '../../../../src/utils/fsx.js';
import { extractStyleMetadata } from '../../../../src/extractors/styling/index.js';

describe('contractBuilder', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('buildContractsFromFiles', () => {
    it('should return empty result for empty files array', async () => {
      const result = await buildContractsFromFiles([], '/project', {
        predictBehavior: false,
      });

      expect(result.contracts).toEqual([]);
      expect(result.analyzed).toBe(0);
      expect(result.totalSourceSize).toBe(0);
    });

    it('should build contracts for valid files', async () => {
      const mockAst = {
        kind: 'react:component',
        exports: { named: ['Button'] },
        components: [],
        functions: [],
        hooks: [],
        variables: [],
        imports: [],
        props: {},
        emits: {},
        state: {},
        jsxRoutes: [],
      };

      vi.mocked(extractFromFile).mockResolvedValue(mockAst);
      vi.mocked(readFileWithText).mockResolvedValue({ text: 'file content', path: '/project/src/Button.tsx' });
      vi.mocked(buildContract).mockReturnValue({
        contract: createMockContract('src/Button.tsx'),
        violations: [],
      });

      const result = await buildContractsFromFiles(
        ['src/Button.tsx'],
        '/project',
        { predictBehavior: false }
      );

      expect(result.contracts.length).toBe(1);
      expect(result.analyzed).toBe(1);
      expect(result.totalSourceSize).toBe('file content'.length);
    });

    it('should skip files that fail AST extraction', async () => {
      vi.mocked(extractFromFile).mockRejectedValue(new Error('Parse error'));

      const result = await buildContractsFromFiles(
        ['src/Invalid.tsx'],
        '/project',
        { predictBehavior: false, quiet: true }
      );

      expect(result.contracts).toEqual([]);
      expect(result.analyzed).toBe(0);
    });

    it('should log warning for skipped files when not quiet', async () => {
      vi.mocked(extractFromFile).mockRejectedValue(new Error('Parse error'));

      await buildContractsFromFiles(
        ['src/Invalid.tsx'],
        '/project',
        { predictBehavior: false, quiet: false }
      );

      expect(consoleWarnSpy).toHaveBeenCalled();
      const calls = consoleWarnSpy.mock.calls.flat().join(' ');
      expect(calls).toContain('Skipped');
      expect(calls).toContain('Parse error');
    });

    it('should suppress warnings when quiet flag is true', async () => {
      vi.mocked(extractFromFile).mockRejectedValue(new Error('Parse error'));

      await buildContractsFromFiles(
        ['src/Invalid.tsx'],
        '/project',
        { predictBehavior: false, quiet: true }
      );

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should extract style metadata only when includeStyle is true', async () => {
      const mockAst = {
        kind: 'react:component',
        exports: { named: ['Button'] },
        components: [],
        functions: [],
        hooks: [],
        variables: [],
        imports: [],
        props: {},
        emits: {},
        state: {},
        jsxRoutes: [],
      };

      vi.mocked(extractFromFile).mockResolvedValue(mockAst);
      vi.mocked(readFileWithText).mockResolvedValue({ text: 'content', path: '/project/src/Button.tsx' });
      vi.mocked(extractStyleMetadata).mockResolvedValue({});
      vi.mocked(buildContract).mockReturnValue({
        contract: createMockContract('src/Button.tsx'),
        violations: [],
      });

      // Without includeStyle
      await buildContractsFromFiles(
        ['src/Button.tsx'],
        '/project',
        { predictBehavior: false, includeStyle: false }
      );

      expect(extractStyleMetadata).not.toHaveBeenCalled();

      // With includeStyle
      vi.clearAllMocks();
      vi.mocked(extractFromFile).mockResolvedValue(mockAst);
      vi.mocked(readFileWithText).mockResolvedValue({ text: 'content', path: '/project/src/Button.tsx' });
      vi.mocked(extractStyleMetadata).mockResolvedValue({});
      vi.mocked(buildContract).mockReturnValue({
        contract: createMockContract('src/Button.tsx'),
        violations: [],
      });

      await buildContractsFromFiles(
        ['src/Button.tsx'],
        '/project',
        { predictBehavior: false, includeStyle: true }
      );

      expect(extractStyleMetadata).toHaveBeenCalled();
    });

    it('should accumulate totalSourceSize from multiple files', async () => {
      const mockAst = {
        kind: 'react:component',
        exports: { named: ['Component'] },
        components: [],
        functions: [],
        hooks: [],
        variables: [],
        imports: [],
        props: {},
        emits: {},
        state: {},
        jsxRoutes: [],
      };

      vi.mocked(extractFromFile).mockResolvedValue(mockAst);
      vi.mocked(readFileWithText)
        .mockResolvedValueOnce({ text: '12345', path: '/project/src/A.tsx' }) // 5 chars
        .mockResolvedValueOnce({ text: '1234567890', path: '/project/src/B.tsx' }); // 10 chars
      vi.mocked(buildContract).mockReturnValue({
        contract: createMockContract('src/Component.tsx'),
        violations: [],
      });

      const result = await buildContractsFromFiles(
        ['src/A.tsx', 'src/B.tsx'],
        '/project',
        { predictBehavior: false }
      );

      expect(result.totalSourceSize).toBe(15);
    });

    it('should handle style extraction failure gracefully', async () => {
      const mockAst = {
        kind: 'react:component',
        exports: { named: ['Button'] },
        components: [],
        functions: [],
        hooks: [],
        variables: [],
        imports: [],
        props: {},
        emits: {},
        state: {},
        jsxRoutes: [],
      };

      vi.mocked(extractFromFile).mockResolvedValue(mockAst);
      vi.mocked(readFileWithText).mockResolvedValue({ text: 'content', path: '/project/src/Button.tsx' });
      vi.mocked(extractStyleMetadata).mockRejectedValue(new Error('Style error'));
      vi.mocked(buildContract).mockReturnValue({
        contract: createMockContract('src/Button.tsx'),
        violations: [],
      });

      const result = await buildContractsFromFiles(
        ['src/Button.tsx'],
        '/project',
        { predictBehavior: false, includeStyle: true, quiet: true }
      );

      // Should still succeed even if style extraction fails
      expect(result.contracts.length).toBe(1);
      expect(result.analyzed).toBe(1);
    });

    it('should log style extraction warning when not quiet', async () => {
      const mockAst = {
        kind: 'react:component',
        exports: { named: ['Button'] },
        components: [],
        functions: [],
        hooks: [],
        variables: [],
        imports: [],
        props: {},
        emits: {},
        state: {},
        jsxRoutes: [],
      };

      vi.mocked(extractFromFile).mockResolvedValue(mockAst);
      vi.mocked(readFileWithText).mockResolvedValue({ text: 'content', path: '/project/src/Button.tsx' });
      vi.mocked(extractStyleMetadata).mockRejectedValue(new Error('Style error'));
      vi.mocked(buildContract).mockReturnValue({
        contract: createMockContract('src/Button.tsx'),
        violations: [],
      });

      await buildContractsFromFiles(
        ['src/Button.tsx'],
        '/project',
        { predictBehavior: false, includeStyle: true, quiet: false }
      );

      expect(consoleWarnSpy).toHaveBeenCalled();
      const calls = consoleWarnSpy.mock.calls.flat().join(' ');
      expect(calls).toContain('Style extraction failed');
    });

    it('should handle absolute file paths', async () => {
      const mockAst = {
        kind: 'react:component',
        exports: { named: ['Button'] },
        components: [],
        functions: [],
        hooks: [],
        variables: [],
        imports: [],
        props: {},
        emits: {},
        state: {},
        jsxRoutes: [],
      };

      vi.mocked(extractFromFile).mockResolvedValue(mockAst);
      vi.mocked(readFileWithText).mockResolvedValue({ text: 'content', path: '/project/src/Button.tsx' });
      vi.mocked(buildContract).mockReturnValue({
        contract: createMockContract('src/Button.tsx'),
        violations: [],
      });

      const result = await buildContractsFromFiles(
        ['/project/src/Button.tsx'],
        '/project',
        { predictBehavior: false }
      );

      expect(result.contracts.length).toBe(1);
      // Should have called extractFromFile with the absolute path
      expect(extractFromFile).toHaveBeenCalledWith('/project/src/Button.tsx');
    });

    it('should skip files when buildContract returns null contract', async () => {
      const mockAst = {
        kind: 'react:component',
        exports: { named: ['Button'] },
        components: [],
        functions: [],
        hooks: [],
        variables: [],
        imports: [],
        props: {},
        emits: {},
        state: {},
        jsxRoutes: [],
      };

      vi.mocked(extractFromFile).mockResolvedValue(mockAst);
      vi.mocked(readFileWithText).mockResolvedValue({ text: 'content', path: '/project/src/Button.tsx' });
      vi.mocked(buildContract).mockReturnValue({
        contract: null,
        violations: [],
      });

      const result = await buildContractsFromFiles(
        ['src/Button.tsx'],
        '/project',
        { predictBehavior: false }
      );

      expect(result.contracts).toEqual([]);
      expect(result.analyzed).toBe(0);
    });
  });
});
