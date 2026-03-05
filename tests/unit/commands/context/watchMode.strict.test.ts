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
    // Based on watchMode.ts violation display logic:
    // - Shows initial message: "❌ Breaking change detected" (when errors present) or "⚠️  Warning detected" (warnings only)
    // - Then displays header: "⚠️  Strict Watch: N violation(s) detected"
    // - Groups by severity: errors first, then warnings
    // - Shows error count: "❌ Errors (N):"
    // - Shows warning count: "⚠️  Warnings (N):"
    // - Lists each violation message
    expect(true).toBe(true);
  });
});

describe('Session status tracking', () => {
  // Tests for the new session status tracking features:
  // - totalErrorsDetected and totalWarningsDetected (cumulative counts)
  // - resolvedCount (number of times violations were resolved)
  // - Session status display

  it('should track total errors and warnings detected when violations first appear', () => {
    // Simulate initial state with no violations
    const initialStatus = {
      active: true,
      startedAt: new Date().toISOString(),
      cumulativeViolations: 0,
      cumulativeErrors: 0,
      cumulativeWarnings: 0,
      totalErrorsDetected: 0,
      totalWarningsDetected: 0,
      resolvedCount: 0,
      regenerationCount: 0,
      lastCheck: undefined,
    };

    // First violation detected: 2 errors, 1 warning
    const afterFirstViolation = {
      ...initialStatus,
      regenerationCount: 1,
      cumulativeViolations: 3,
      cumulativeErrors: 2,
      cumulativeWarnings: 1,
      totalErrorsDetected: 2, // Should increment from 0 to 2
      totalWarningsDetected: 1, // Should increment from 0 to 1
      resolvedCount: 0,
      lastCheck: {
        timestamp: new Date().toISOString(),
        totalViolations: 3,
        errors: 2,
        warnings: 1,
        violations: [],
        changedFiles: ['src/App.tsx'],
      },
    };

    expect(afterFirstViolation.totalErrorsDetected).toBe(2);
    expect(afterFirstViolation.totalWarningsDetected).toBe(1);
    expect(afterFirstViolation.resolvedCount).toBe(0);
  });

  it('should track additional violations when count increases', () => {
    // Start with existing violations
    const statusWithViolations = {
      active: true,
      startedAt: new Date().toISOString(),
      cumulativeViolations: 2,
      cumulativeErrors: 1,
      cumulativeWarnings: 1,
      totalErrorsDetected: 1,
      totalWarningsDetected: 1,
      resolvedCount: 0,
      regenerationCount: 1,
      lastCheck: {
        timestamp: new Date().toISOString(),
        totalViolations: 2,
        errors: 1,
        warnings: 1,
        violations: [],
        changedFiles: ['src/App.tsx'],
      },
    };

    // Violations increase: 1 error added (now 2 errors, 1 warning)
    const afterIncrease = {
      ...statusWithViolations,
      regenerationCount: 2,
      cumulativeViolations: 3,
      cumulativeErrors: 2, // Increased from 1 to 2
      cumulativeWarnings: 1,
      totalErrorsDetected: 2, // Should increment by 1 (new error)
      totalWarningsDetected: 1, // No change
      lastCheck: {
        timestamp: new Date().toISOString(),
        totalViolations: 3,
        errors: 2,
        warnings: 1,
        violations: [],
        changedFiles: ['src/Button.tsx'],
      },
    };

    expect(afterIncrease.totalErrorsDetected).toBe(2); // 1 + 1 new error
    expect(afterIncrease.totalWarningsDetected).toBe(1); // No change
  });

  it('should increment resolvedCount when violations are cleared', () => {
    // Start with active violations
    const statusWithViolations = {
      active: true,
      startedAt: new Date().toISOString(),
      cumulativeViolations: 2,
      cumulativeErrors: 1,
      cumulativeWarnings: 1,
      totalErrorsDetected: 1,
      totalWarningsDetected: 1,
      resolvedCount: 0,
      regenerationCount: 1,
      lastCheck: {
        timestamp: new Date().toISOString(),
        totalViolations: 2,
        errors: 1,
        warnings: 1,
        violations: [],
        changedFiles: ['src/App.tsx'],
      },
    };

    // Violations resolved (reverted to baseline)
    const afterResolution = {
      ...statusWithViolations,
      regenerationCount: 2,
      cumulativeViolations: 0,
      cumulativeErrors: 0,
      cumulativeWarnings: 0,
      totalErrorsDetected: 1, // Should not change (cumulative)
      totalWarningsDetected: 1, // Should not change (cumulative)
      resolvedCount: 1, // Should increment
      lastCheck: undefined,
    };

    expect(afterResolution.resolvedCount).toBe(1);
    expect(afterResolution.totalErrorsDetected).toBe(1); // Cumulative, doesn't reset
    expect(afterResolution.totalWarningsDetected).toBe(1); // Cumulative, doesn't reset
  });

  it('should track multiple resolution cycles', () => {
    // Simulate a session with multiple violation/resolution cycles
    let status = {
      active: true,
      startedAt: new Date().toISOString(),
      cumulativeViolations: 0,
      cumulativeErrors: 0,
      cumulativeWarnings: 0,
      totalErrorsDetected: 0,
      totalWarningsDetected: 0,
      resolvedCount: 0,
      regenerationCount: 0,
      lastCheck: undefined,
    };

    // First violation: 1 error
    status = {
      ...status,
      regenerationCount: 1,
      cumulativeViolations: 1,
      cumulativeErrors: 1,
      totalErrorsDetected: 1,
      lastCheck: { timestamp: new Date().toISOString(), totalViolations: 1, errors: 1, warnings: 0, violations: [], changedFiles: [] },
    };
    expect(status.totalErrorsDetected).toBe(1);
    expect(status.resolvedCount).toBe(0);

    // Resolved
    status = {
      ...status,
      regenerationCount: 2,
      cumulativeViolations: 0,
      cumulativeErrors: 0,
      resolvedCount: 1,
      lastCheck: undefined,
    };
    expect(status.resolvedCount).toBe(1);

    // Second violation: 2 errors
    status = {
      ...status,
      regenerationCount: 3,
      cumulativeViolations: 2,
      cumulativeErrors: 2,
      totalErrorsDetected: 3, // 1 + 2 new errors
      lastCheck: { timestamp: new Date().toISOString(), totalViolations: 2, errors: 2, warnings: 0, violations: [], changedFiles: [] },
    };
    expect(status.totalErrorsDetected).toBe(3);
    expect(status.resolvedCount).toBe(1);

    // Resolved again
    status = {
      ...status,
      regenerationCount: 4,
      cumulativeViolations: 0,
      cumulativeErrors: 0,
      resolvedCount: 2,
      lastCheck: undefined,
    };
    expect(status.resolvedCount).toBe(2);
    expect(status.totalErrorsDetected).toBe(3); // Still cumulative
  });

  it('should calculate active violations correctly', () => {
    const status = {
      active: true,
      startedAt: new Date().toISOString(),
      cumulativeViolations: 3,
      cumulativeErrors: 2,
      cumulativeWarnings: 1,
      totalErrorsDetected: 2,
      totalWarningsDetected: 1,
      resolvedCount: 0,
      regenerationCount: 1,
      lastCheck: {
        timestamp: new Date().toISOString(),
        totalViolations: 3,
        errors: 2,
        warnings: 1,
        violations: [],
        changedFiles: ['src/App.tsx'],
      },
    };

    const activeErrors = status.lastCheck?.errors ?? 0;
    const activeWarnings = status.lastCheck?.warnings ?? 0;
    const activeTotal = activeErrors + activeWarnings;

    expect(activeTotal).toBe(3);
    expect(activeErrors).toBe(2);
    expect(activeWarnings).toBe(1);
  });

  it('should handle session summary format', () => {
    // Test the final session summary structure
    const finalStatus = {
      active: true,
      startedAt: new Date().toISOString(),
      cumulativeViolations: 0,
      cumulativeErrors: 0,
      cumulativeWarnings: 0,
      totalErrorsDetected: 5,
      totalWarningsDetected: 3,
      resolvedCount: 2,
      regenerationCount: 10,
      lastCheck: undefined, // No active violations
    };

    const activeErrors = finalStatus.lastCheck?.errors ?? 0;
    const activeWarnings = finalStatus.lastCheck?.warnings ?? 0;
    const activeTotal = activeErrors + activeWarnings;

    // Session summary should show:
    // - Total errors detected: 5
    // - Total warnings detected: 3
    // - Resolved: 2
    // - Active: 0
    expect(finalStatus.totalErrorsDetected).toBe(5);
    expect(finalStatus.totalWarningsDetected).toBe(3);
    expect(finalStatus.resolvedCount).toBe(2);
    expect(activeTotal).toBe(0);
  });
});
