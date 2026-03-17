/**
 * Unit tests for violations detection module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { detectViolations, summarizeViolations, displayViolations } from '../../../src/core/violations.js';
import type { BundleChanges } from '../../../src/cli/commands/context/watchMode/watchDiff.js';
import type { CompareResult } from '../../../src/cli/commands/compare/types.js';
import type { Violation } from '../../../src/core/violations.js';

describe('detectViolations', () => {
  describe('watch mode input', () => {
    it('should detect contract removed violation', () => {
      const changes: BundleChanges = {
        removed: ['src/Button.tsx'],
        changed: [],
        added: [],
        bundleChanged: [],
      };

      const violations = detectViolations({ type: 'watch', changes });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        type: 'contract_removed',
        severity: 'error',
        entryId: 'src/Button.tsx',
        message: 'Contract removed: src/Button.tsx',
      });
    });

    it('should detect prop removed violation', () => {
      const changes: BundleChanges = {
        removed: [],
        changed: [
          {
            entryId: 'src/Button.tsx',
            contractDiff: {
              props: {
                added: [],
                removed: ['disabled'],
                changed: [],
              },
              emits: { added: [], removed: [], changed: [] },
              state: { added: [], removed: [], changed: [] },
              hooks: { added: [], removed: [] },
              components: { added: [], removed: [] },
              variables: { added: [], removed: [] },
              functions: { added: [], removed: [] },
            },
          },
        ],
        added: [],
        bundleChanged: [],
      };

      const violations = detectViolations({ type: 'watch', changes });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        type: 'breaking_change_prop_removed',
        severity: 'error',
        entryId: 'src/Button.tsx',
        message: "Breaking change: prop 'disabled' removed from src/Button.tsx",
        details: { name: 'disabled' },
      });
    });

    it('should detect prop type changed violation', () => {
      const changes: BundleChanges = {
        removed: [],
        changed: [
          {
            entryId: 'src/Button.tsx',
            contractDiff: {
              props: {
                added: [],
                removed: [],
                changed: [{ name: 'size', old: 'string', new: 'number' }],
              },
              emits: { added: [], removed: [], changed: [] },
              state: { added: [], removed: [], changed: [] },
              hooks: { added: [], removed: [] },
              components: { added: [], removed: [] },
              variables: { added: [], removed: [] },
              functions: { added: [], removed: [] },
            },
          },
        ],
        added: [],
        bundleChanged: [],
      };

      const violations = detectViolations({ type: 'watch', changes });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        type: 'breaking_change_prop_type',
        severity: 'warning',
        entryId: 'src/Button.tsx',
        message: "Prop 'size' type changed in src/Button.tsx",
        details: { name: 'size', oldValue: 'string', newValue: 'number' },
      });
    });

    it('should detect event removed violation', () => {
      const changes: BundleChanges = {
        removed: [],
        changed: [
          {
            entryId: 'src/Input.tsx',
            contractDiff: {
              props: { added: [], removed: [], changed: [] },
              emits: {
                added: [],
                removed: ['onChange'],
                changed: [],
              },
              state: { added: [], removed: [], changed: [] },
              hooks: { added: [], removed: [] },
              components: { added: [], removed: [] },
              variables: { added: [], removed: [] },
              functions: { added: [], removed: [] },
            },
          },
        ],
        added: [],
        bundleChanged: [],
      };

      const violations = detectViolations({ type: 'watch', changes });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        type: 'breaking_change_event_removed',
        severity: 'error',
        entryId: 'src/Input.tsx',
        message: "Breaking change: event 'onChange' removed from src/Input.tsx",
        details: { name: 'onChange' },
      });
    });

    it('should detect state removed violation', () => {
      const changes: BundleChanges = {
        removed: [],
        changed: [
          {
            entryId: 'src/Form.tsx',
            contractDiff: {
              props: { added: [], removed: [], changed: [] },
              emits: { added: [], removed: [], changed: [] },
              state: {
                added: [],
                removed: ['isValid'],
                changed: [],
              },
              hooks: { added: [], removed: [] },
              components: { added: [], removed: [] },
              variables: { added: [], removed: [] },
              functions: { added: [], removed: [] },
            },
          },
        ],
        added: [],
        bundleChanged: [],
      };

      const violations = detectViolations({ type: 'watch', changes });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        type: 'breaking_change_state_removed',
        severity: 'warning',
        entryId: 'src/Form.tsx',
        message: "State 'isValid' removed from src/Form.tsx",
        details: { name: 'isValid' },
      });
    });

    it('should detect function removed violation', () => {
      const changes: BundleChanges = {
        removed: [],
        changed: [
          {
            entryId: 'src/utils.ts',
            contractDiff: {
              props: { added: [], removed: [], changed: [] },
              emits: { added: [], removed: [], changed: [] },
              state: { added: [], removed: [], changed: [] },
              hooks: { added: [], removed: [] },
              components: { added: [], removed: [] },
              variables: { added: [], removed: [] },
              functions: {
                added: [],
                removed: ['calculateTotal'],
              },
            },
          },
        ],
        added: [],
        bundleChanged: [],
      };

      const violations = detectViolations({ type: 'watch', changes });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        type: 'breaking_change_function_removed',
        severity: 'error',
        entryId: 'src/utils.ts',
        message: "Breaking change: function 'calculateTotal' removed from src/utils.ts",
        details: { name: 'calculateTotal' },
      });
    });

    it('should detect variable removed violation', () => {
      const changes: BundleChanges = {
        removed: [],
        changed: [
          {
            entryId: 'src/config.ts',
            contractDiff: {
              props: { added: [], removed: [], changed: [] },
              emits: { added: [], removed: [], changed: [] },
              state: { added: [], removed: [], changed: [] },
              hooks: { added: [], removed: [] },
              components: { added: [], removed: [] },
              variables: {
                added: [],
                removed: ['API_URL'],
              },
              functions: { added: [], removed: [] },
            },
          },
        ],
        added: [],
        bundleChanged: [],
      };

      const violations = detectViolations({ type: 'watch', changes });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        type: 'breaking_change_variable_removed',
        severity: 'warning',
        entryId: 'src/config.ts',
        message: "Variable 'API_URL' removed from src/config.ts",
        details: { name: 'API_URL' },
      });
    });

    it('should detect multiple violations in one change', () => {
      const changes: BundleChanges = {
        removed: [],
        changed: [
          {
            entryId: 'src/Button.tsx',
            contractDiff: {
              props: {
                added: [],
                removed: ['disabled'],
                changed: [{ name: 'size', old: 'string', new: 'number' }],
              },
              emits: {
                added: [],
                removed: ['onClick'],
                changed: [],
              },
              state: { added: [], removed: [], changed: [] },
              hooks: { added: [], removed: [] },
              components: { added: [], removed: [] },
              variables: { added: [], removed: [] },
              functions: { added: [], removed: [] },
            },
          },
        ],
        added: [],
        bundleChanged: [],
      };

      const violations = detectViolations({ type: 'watch', changes });
      expect(violations).toHaveLength(3);
      expect(violations.find(v => v.type === 'breaking_change_prop_removed')).toBeDefined();
      expect(violations.find(v => v.type === 'breaking_change_prop_type')).toBeDefined();
      expect(violations.find(v => v.type === 'breaking_change_event_removed')).toBeDefined();
    });

    it('should handle multiple removed contracts', () => {
      const changes: BundleChanges = {
        removed: ['src/Button.tsx', 'src/Input.tsx'],
        changed: [],
        added: [],
        bundleChanged: [],
      };

      const violations = detectViolations({ type: 'watch', changes });
      expect(violations).toHaveLength(2);
      expect(violations[0].entryId).toBe('src/Button.tsx');
      expect(violations[1].entryId).toBe('src/Input.tsx');
    });

    it('should return empty array when no violations', () => {
      const changes: BundleChanges = {
        removed: [],
        changed: [
          {
            entryId: 'src/Button.tsx',
            contractDiff: {
              props: { added: ['newProp'], removed: [], changed: [] },
              emits: { added: [], removed: [], changed: [] },
              state: { added: [], removed: [], changed: [] },
              hooks: { added: [], removed: [] },
              components: { added: [], removed: [] },
              variables: { added: [], removed: [] },
              functions: { added: [], removed: [] },
            },
          },
        ],
        added: [],
        bundleChanged: [],
      };

      const violations = detectViolations({ type: 'watch', changes });
      expect(violations).toHaveLength(0);
    });

    it('should skip changes without contractDiff', () => {
      const changes: BundleChanges = {
        removed: [],
        changed: [
          {
            entryId: 'src/Button.tsx',
            // No contractDiff
          },
        ],
        added: [],
        bundleChanged: [],
      };

      const violations = detectViolations({ type: 'watch', changes });
      expect(violations).toHaveLength(0);
    });
  });

  describe('compare mode input', () => {
    it('should detect contract removed violation', () => {
      const result: CompareResult = {
        status: 'DRIFT',
        removed: ['src/Button.tsx'],
        added: [],
        changed: [],
      };

      const violations = detectViolations({ type: 'compare', result });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        type: 'contract_removed',
        severity: 'error',
        entryId: 'src/Button.tsx',
        message: 'Contract removed: src/Button.tsx',
      });
    });

    it('should detect prop removed violation', () => {
      const result: CompareResult = {
        status: 'DRIFT',
        removed: [],
        added: [],
        changed: [
          {
            id: 'src/Button.tsx',
            deltas: [
              {
                type: 'props',
                old: { disabled: 'boolean', size: 'string' },
                new: { size: 'string' },
              },
            ],
          },
        ],
      };

      const violations = detectViolations({ type: 'compare', result });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        type: 'breaking_change_prop_removed',
        severity: 'error',
        entryId: 'src/Button.tsx',
        message: "Breaking change: prop 'disabled' removed from src/Button.tsx",
        details: { name: 'disabled' },
      });
    });

    it('should detect prop type changed violation', () => {
      const result: CompareResult = {
        status: 'DRIFT',
        removed: [],
        added: [],
        changed: [
          {
            id: 'src/Button.tsx',
            deltas: [
              {
                type: 'props',
                old: { size: 'string' },
                new: { size: 'number' },
              },
            ],
          },
        ],
      };

      const violations = detectViolations({ type: 'compare', result });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        type: 'breaking_change_prop_type',
        severity: 'warning',
        entryId: 'src/Button.tsx',
        message: "Prop 'size' type changed in src/Button.tsx",
        details: { name: 'size', oldValue: 'string', newValue: 'number' },
      });
    });

    it('should detect event removed violation', () => {
      const result: CompareResult = {
        status: 'DRIFT',
        removed: [],
        added: [],
        changed: [
          {
            id: 'src/Input.tsx',
            deltas: [
              {
                type: 'emits',
                old: { onChange: '() => void', onFocus: '() => void' },
                new: { onFocus: '() => void' },
              },
            ],
          },
        ],
      };

      const violations = detectViolations({ type: 'compare', result });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        type: 'breaking_change_event_removed',
        severity: 'error',
        entryId: 'src/Input.tsx',
        message: "Breaking change: event 'onChange' removed from src/Input.tsx",
        details: { name: 'onChange' },
      });
    });

    it('should detect state removed violation', () => {
      const result: CompareResult = {
        status: 'DRIFT',
        removed: [],
        added: [],
        changed: [
          {
            id: 'src/Form.tsx',
            deltas: [
              {
                type: 'state',
                old: { isValid: 'boolean', isDirty: 'boolean' },
                new: { isDirty: 'boolean' },
              },
            ],
          },
        ],
      };

      const violations = detectViolations({ type: 'compare', result });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        type: 'breaking_change_state_removed',
        severity: 'warning',
        entryId: 'src/Form.tsx',
        message: "State 'isValid' removed from src/Form.tsx",
        details: { name: 'isValid' },
      });
    });

    it('should detect function removed violation', () => {
      const result: CompareResult = {
        status: 'DRIFT',
        removed: [],
        added: [],
        changed: [
          {
            id: 'src/utils.ts',
            deltas: [
              {
                type: 'functions',
                old: ['calculateTotal', 'formatCurrency'],
                new: ['formatCurrency'],
              },
            ],
          },
        ],
      };

      const violations = detectViolations({ type: 'compare', result });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        type: 'breaking_change_function_removed',
        severity: 'error',
        entryId: 'src/utils.ts',
        message: "Breaking change: function 'calculateTotal' removed from src/utils.ts",
        details: { name: 'calculateTotal' },
      });
    });

    it('should detect variable removed violation', () => {
      const result: CompareResult = {
        status: 'DRIFT',
        removed: [],
        added: [],
        changed: [
          {
            id: 'src/config.ts',
            deltas: [
              {
                type: 'variables',
                old: ['API_URL', 'TIMEOUT'],
                new: ['TIMEOUT'],
              },
            ],
          },
        ],
      };

      const violations = detectViolations({ type: 'compare', result });
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        type: 'breaking_change_variable_removed',
        severity: 'warning',
        entryId: 'src/config.ts',
        message: "Variable 'API_URL' removed from src/config.ts",
        details: { name: 'API_URL' },
      });
    });

    it('should handle multiple violations in one change', () => {
      const result: CompareResult = {
        status: 'DRIFT',
        removed: [],
        added: [],
        changed: [
          {
            id: 'src/Button.tsx',
            deltas: [
              {
                type: 'props',
                old: { disabled: 'boolean', size: 'string' },
                new: { size: 'number' },
              },
              {
                type: 'emits',
                old: { onClick: '() => void' },
                new: {},
              },
            ],
          },
        ],
      };

      const violations = detectViolations({ type: 'compare', result });
      expect(violations.length).toBeGreaterThanOrEqual(2);
      expect(violations.find(v => v.type === 'breaking_change_prop_removed')).toBeDefined();
      expect(violations.find(v => v.type === 'breaking_change_prop_type')).toBeDefined();
      expect(violations.find(v => v.type === 'breaking_change_event_removed')).toBeDefined();
    });

    it('should ignore non-breaking delta types', () => {
      const result: CompareResult = {
        status: 'DRIFT',
        removed: [],
        added: [],
        changed: [
          {
            id: 'src/Button.tsx',
            deltas: [
              {
                type: 'hash',
                old: 'uif:oldhash',
                new: 'uif:newhash',
              },
              {
                type: 'imports',
                old: ['react'],
                new: ['react', 'react-dom'],
              },
            ],
          },
        ],
      };

      const violations = detectViolations({ type: 'compare', result });
      expect(violations).toHaveLength(0);
    });

    it('should handle invalid delta old/new values gracefully', () => {
      const result: CompareResult = {
        status: 'DRIFT',
        removed: [],
        added: [],
        changed: [
          {
            id: 'src/Button.tsx',
            deltas: [
              {
                type: 'props',
                old: null,
                new: { size: 'string' },
              },
              {
                type: 'functions',
                old: 'not-an-array',
                new: ['test'],
              },
            ],
          },
        ],
      };

      // Should not throw and should handle gracefully
      const violations = detectViolations({ type: 'compare', result });
      expect(Array.isArray(violations)).toBe(true);
    });

    it('should handle empty compare result', () => {
      const result: CompareResult = {
        status: 'PASS',
        removed: [],
        added: [],
        changed: [],
      };

      const violations = detectViolations({ type: 'compare', result });
      expect(violations).toHaveLength(0);
    });
  });
});

describe('summarizeViolations', () => {
  it('should create summary with empty violations', () => {
    const summary = summarizeViolations([]);
    expect(summary).toMatchObject({
      totalViolations: 0,
      errors: 0,
      warnings: 0,
      violations: [],
      changedFiles: [],
    });
    expect(summary.timestamp).toBeDefined();
    expect(typeof summary.timestamp).toBe('string');
  });

  it('should count errors correctly', () => {
    const violations: Violation[] = [
      {
        type: 'contract_removed',
        severity: 'error',
        entryId: 'src/Button.tsx',
        message: 'Contract removed: src/Button.tsx',
      },
      {
        type: 'breaking_change_prop_removed',
        severity: 'error',
        entryId: 'src/Input.tsx',
        message: "Breaking change: prop 'disabled' removed from src/Input.tsx",
        details: { name: 'disabled' },
      },
    ];

    const summary = summarizeViolations(violations);
    expect(summary.totalViolations).toBe(2);
    expect(summary.errors).toBe(2);
    expect(summary.warnings).toBe(0);
    expect(summary.violations).toEqual(violations);
  });

  it('should count warnings correctly', () => {
    const violations: Violation[] = [
      {
        type: 'breaking_change_prop_type',
        severity: 'warning',
        entryId: 'src/Button.tsx',
        message: "Prop 'size' type changed in src/Button.tsx",
        details: { name: 'size', oldValue: 'string', newValue: 'number' },
      },
      {
        type: 'breaking_change_state_removed',
        severity: 'warning',
        entryId: 'src/Form.tsx',
        message: "State 'isValid' removed from src/Form.tsx",
        details: { name: 'isValid' },
      },
    ];

    const summary = summarizeViolations(violations);
    expect(summary.totalViolations).toBe(2);
    expect(summary.errors).toBe(0);
    expect(summary.warnings).toBe(2);
    expect(summary.violations).toEqual(violations);
  });

  it('should count mixed errors and warnings correctly', () => {
    const violations: Violation[] = [
      {
        type: 'contract_removed',
        severity: 'error',
        entryId: 'src/Button.tsx',
        message: 'Contract removed: src/Button.tsx',
      },
      {
        type: 'breaking_change_prop_type',
        severity: 'warning',
        entryId: 'src/Input.tsx',
        message: "Prop 'size' type changed in src/Input.tsx",
        details: { name: 'size', oldValue: 'string', newValue: 'number' },
      },
      {
        type: 'breaking_change_prop_removed',
        severity: 'error',
        entryId: 'src/Form.tsx',
        message: "Breaking change: prop 'disabled' removed from src/Form.tsx",
        details: { name: 'disabled' },
      },
    ];

    const summary = summarizeViolations(violations);
    expect(summary.totalViolations).toBe(3);
    expect(summary.errors).toBe(2);
    expect(summary.warnings).toBe(1);
    expect(summary.violations).toEqual(violations);
  });

  it('should include timestamp in ISO format', () => {
    const summary = summarizeViolations([]);
    expect(summary.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('displayViolations', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should return early when no violations', () => {
    displayViolations([]);
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should display errors only', () => {
    const violations: Violation[] = [
      {
        type: 'contract_removed',
        severity: 'error',
        entryId: 'src/Button.tsx',
        message: 'Contract removed: src/Button.tsx',
      },
      {
        type: 'breaking_change_prop_removed',
        severity: 'error',
        entryId: 'src/Input.tsx',
        message: "Breaking change: prop 'disabled' removed from src/Input.tsx",
        details: { name: 'disabled' },
      },
    ];

    displayViolations(violations);
    expect(consoleLogSpy).toHaveBeenCalled();
    const calls = consoleLogSpy.mock.calls.map(call => call[0]);
    expect(calls.some(c => typeof c === 'string' && c.includes('Strict Mode: 2 violation(s) detected'))).toBe(true);
    expect(calls.some(c => typeof c === 'string' && c.includes('Errors (2):'))).toBe(true);
    expect(calls.some(c => typeof c === 'string' && c.includes('Contract removed: src/Button.tsx'))).toBe(true);
  });

  it('should display warnings only', () => {
    const violations: Violation[] = [
      {
        type: 'breaking_change_prop_type',
        severity: 'warning',
        entryId: 'src/Button.tsx',
        message: "Prop 'size' type changed in src/Button.tsx",
        details: { name: 'size', oldValue: 'string', newValue: 'number' },
      },
    ];

    displayViolations(violations);
    expect(consoleLogSpy).toHaveBeenCalled();
    const calls = consoleLogSpy.mock.calls.map(call => call[0]);
    expect(calls.some(c => typeof c === 'string' && c.includes('Strict Mode: 1 violation(s) detected'))).toBe(true);
    expect(calls.some(c => typeof c === 'string' && c.includes('Warnings (1):'))).toBe(true);
  });

  it('should display both errors and warnings', () => {
    const violations: Violation[] = [
      {
        type: 'contract_removed',
        severity: 'error',
        entryId: 'src/Button.tsx',
        message: 'Contract removed: src/Button.tsx',
      },
      {
        type: 'breaking_change_prop_type',
        severity: 'warning',
        entryId: 'src/Input.tsx',
        message: "Prop 'size' type changed in src/Input.tsx",
        details: { name: 'size', oldValue: 'string', newValue: 'number' },
      },
    ];

    displayViolations(violations);
    expect(consoleLogSpy).toHaveBeenCalled();
    const calls = consoleLogSpy.mock.calls.map(call => call[0]);
    expect(calls.some(c => typeof c === 'string' && c.includes('Strict Mode: 2 violation(s) detected'))).toBe(true);
    expect(calls.some(c => typeof c === 'string' && c.includes('Errors (1):'))).toBe(true);
    expect(calls.some(c => typeof c === 'string' && c.includes('Warnings (1):'))).toBe(true);
  });

  it('should respect quiet option', () => {
    const violations: Violation[] = [
      {
        type: 'contract_removed',
        severity: 'error',
        entryId: 'src/Button.tsx',
        message: 'Contract removed: src/Button.tsx',
      },
    ];

    displayViolations(violations, { quiet: true });
    // Even with quiet, violations are still displayed (quiet only affects other output)
    expect(consoleLogSpy).toHaveBeenCalled();
  });
});
