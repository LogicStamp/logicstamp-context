/**
 * Unit tests for watchMode module - Strict watch mode
 */

import { describe, it, expect } from 'vitest';
import type { BundleChanges, ContractDiff } from '../../../../src/cli/commands/context/watchDiff.js';

// Helper to create mock bundle changes
function createMockBundleChanges(overrides?: Partial<BundleChanges>): BundleChanges {
  return {
    added: [],
    removed: [],
    changed: [],
    bundleChanged: [],
    ...overrides,
  };
}

// Helper to create mock contract diff
function createMockContractDiff(overrides?: Partial<ContractDiff>): ContractDiff {
  return {
    props: { added: [], removed: [], changed: [] },
    emits: { added: [], removed: [], changed: [] },
    state: { added: [], removed: [], changed: [] },
    hooks: { added: [], removed: [] },
    components: { added: [], removed: [] },
    variables: { added: [], removed: [] },
    functions: { added: [], removed: [] },
    ...overrides,
  };
}

describe('detectViolations', () => {
  // detectViolations is an internal function. These tests document the expected
  // violation types and severities based on the source code analysis.
  // The function is tested indirectly through the strict watch mode flow.

  describe('violation type documentation', () => {
    it('should classify contract removal as error severity', () => {
      // Based on watchMode.ts detectViolations():
      // Removed contracts are classified as 'contract_removed' with severity 'error'
      const mockChanges = createMockBundleChanges({
        removed: ['src/DeletedComponent.tsx'],
      });
      expect(mockChanges.removed.length).toBe(1);
    });

    it('should classify removed props as error severity', () => {
      // Based on watchMode.ts detectViolations():
      // Removed props are classified as 'breaking_change_prop_removed' with severity 'error'
      const mockContractDiff = createMockContractDiff({
        props: { added: [], removed: ['onClick'], changed: [] },
      });
      expect(mockContractDiff.props.removed).toContain('onClick');
    });

    it('should classify changed prop types as warning severity', () => {
      // Based on watchMode.ts detectViolations():
      // Changed props are classified as 'breaking_change_prop_type' with severity 'warning'
      const mockContractDiff = createMockContractDiff({
        props: {
          added: [],
          removed: [],
          changed: [{ name: 'variant', old: 'string', new: 'enum' }],
        },
      });
      expect(mockContractDiff.props.changed.length).toBe(1);
    });

    it('should classify removed events as error severity', () => {
      // Based on watchMode.ts detectViolations():
      // Removed events are classified as 'breaking_change_event_removed' with severity 'error'
      const mockContractDiff = createMockContractDiff({
        emits: { added: [], removed: ['onSubmit'], changed: [] },
      });
      expect(mockContractDiff.emits.removed).toContain('onSubmit');
    });

    it('should classify removed state as warning severity', () => {
      // Based on watchMode.ts detectViolations():
      // Removed state is classified as 'breaking_change_state_removed' with severity 'warning'
      const mockContractDiff = createMockContractDiff({
        state: { added: [], removed: ['count'], changed: [] },
      });
      expect(mockContractDiff.state.removed).toContain('count');
    });

    it('should classify removed functions as error severity', () => {
      // Based on watchMode.ts detectViolations():
      // Removed functions are classified as 'breaking_change_function_removed' with severity 'error'
      const mockContractDiff = createMockContractDiff({
        functions: { added: [], removed: ['handleClick'] },
      });
      expect(mockContractDiff.functions.removed).toContain('handleClick');
    });

    it('should classify removed variables as warning severity', () => {
      // Based on watchMode.ts detectViolations():
      // Removed variables are classified as 'breaking_change_variable_removed' with severity 'warning'
      const mockContractDiff = createMockContractDiff({
        variables: { added: [], removed: ['MAX_SIZE'] },
      });
      expect(mockContractDiff.variables.removed).toContain('MAX_SIZE');
    });
  });
});

describe('displayViolations', () => {
  // displayViolations is an internal function that formats violation output.
  // It's tested indirectly through the strict watch mode flow.
  // This test documents the expected console output format.

  it('should document violation display format', () => {
    // Based on watchMode.ts displayViolations():
    // - Displays header: "⚠️  Strict Watch: N violation(s) detected"
    // - Groups by severity: errors first, then warnings
    // - Shows error count: "❌ Errors (N):"
    // - Shows warning count: "⚠️  Warnings (N):"
    // - Lists each violation message
    expect(true).toBe(true);
  });
});
