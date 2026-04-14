/**
 * Shared test helpers for context command unit tests
 */

import type { UIFContract } from '../../../../src/types/UIFContract.js';
import type { LogicStampBundle } from '../../../../src/core/pack.js';
import type { ProjectManifest } from '../../../../src/core/manifest.js';

/**
 * Create a mock UIFContract for testing
 */
export function createMockContract(
  entryId: string,
  overrides?: Partial<UIFContract>,
): UIFContract {
  return {
    type: 'UIFContract',
    schemaVersion: '0.4',
    kind: 'react:component',
    entryId,
    description: `Mock ${entryId
      .split('/')
      .pop()
      ?.replace(/\.[tj]sx?$/, '')} component`,
    composition: {
      variables: [],
      hooks: [],
      components: [],
      functions: [],
      imports: [],
    },
    interface: {
      props: {},
      emits: {},
    },
    exports: {
      named: [
        entryId
          .split('/')
          .pop()
          ?.replace(/\.[tj]sx?$/, '') || 'Component',
      ],
    },
    semanticHash: `semantic-${entryId.replace(/[/\\]/g, '-')}`,
    fileHash: `fileHash-${entryId.replace(/[/\\]/g, '-')}`,
    ...overrides,
  };
}

/**
 * Create a mock LogicStampBundle for testing
 */
export function createMockBundle(
  entryId: string,
  contracts?: UIFContract[],
): LogicStampBundle {
  const nodeContracts = contracts || [createMockContract(entryId)];

  return {
    type: 'LogicStampBundle',
    schemaVersion: '0.1',
    entryId,
    depth: 2,
    createdAt: new Date().toISOString(),
    bundleHash: `bundleHash-${entryId.replace(/[/\\]/g, '-')}`,
    graph: {
      nodes: nodeContracts.map((contract) => ({
        entryId: contract.entryId,
        contract,
      })),
      edges: [],
    },
    meta: {
      missing: [],
      source: 'test',
    },
  };
}

/**
 * Create a mock ProjectManifest for testing
 */
export function createMockManifest(
  roots: string[],
  leaves?: string[],
): ProjectManifest {
  const components: Record<
    string,
    {
      entryId: string;
      description: string;
      dependencies: string[];
      usedBy: string[];
      imports: string[];
      routes: string[];
      semanticHash: string;
    }
  > = {};

  for (const root of roots) {
    components[root] = {
      entryId: root,
      description: `Mock ${root}`,
      dependencies: [],
      usedBy: [],
      imports: [],
      routes: [],
      semanticHash: `semantic-${root.replace(/[/\\]/g, '-')}`,
    };
  }

  return {
    version: '0.3',
    generatedAt: new Date().toISOString(),
    totalComponents: roots.length,
    components,
    graph: {
      roots,
      leaves: leaves || roots,
    },
  };
}

/**
 * Create mock token estimates for testing
 */
export function createMockTokenEstimates(
  overrides?: Partial<{
    currentGPT4: number;
    currentClaude: number;
    sourceTokensGPT4: number;
    sourceTokensClaude: number;
    modeEstimates: {
      none: { gpt4: number; claude: number };
      header: { gpt4: number; claude: number };
      full: { gpt4: number; claude: number };
    };
    savingsGPT4: string;
    savingsClaude: string;
  }>,
) {
  return {
    currentGPT4: 1000,
    currentClaude: 1100,
    sourceTokensGPT4: 2000,
    sourceTokensClaude: 2200,
    modeEstimates: {
      none: { gpt4: 600, claude: 660 },
      header: { gpt4: 1000, claude: 1100 },
      full: { gpt4: 3000, claude: 3300 },
    },
    savingsGPT4: '67',
    savingsClaude: '67',
    ...overrides,
  };
}

/**
 * Create a mock bundle stats object for testing
 */
export function createMockBundleStats(
  overrides?: Partial<{
    totalNodes: number;
    totalEdges: number;
    totalMissing: number;
  }>,
) {
  return {
    totalNodes: 10,
    totalEdges: 5,
    totalMissing: 0,
    ...overrides,
  };
}
