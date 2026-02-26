import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildDependencyGraph, generateStats, writeManifest, type ProjectManifest } from '../../src/core/manifest.js';
import type { UIFContract } from '../../src/types/UIFContract.js';

// Mock fs/promises for writeManifest tests
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
}));

import { writeFile } from 'node:fs/promises';

describe('Manifest - Internal Component Filtering', () => {
  describe('filterInternalComponents', () => {
    it('should filter out internal components from dependencies', () => {
      const contracts: UIFContract[] = [
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/components/Card.tsx',
          entryPathAbs: '/project/src/components/Card.tsx',
          entryPathRel: 'src/components/Card.tsx',
          os: 'posix',
          description: 'Card component',
          composition: {
            variables: [],
            hooks: [],
            components: ['Button', 'InternalHelper'], // InternalHelper is internal
            functions: ['InternalHelper'], // Defined as function in same file
            imports: [],
          },
          interface: {
            props: {},
            emits: {},
          },
          exports: { named: ['Card'] }, // Only Card is exported, InternalHelper is not
          semanticHash: 'hash1',
          fileHash: 'file1',
        },
      ];

      const manifest = buildDependencyGraph(contracts);

      // InternalHelper should be filtered out from dependencies
      const cardNode = manifest.components['src/components/Card.tsx'];
      expect(cardNode).toBeDefined();
      expect(cardNode.dependencies).not.toContain('InternalHelper');
      expect(cardNode.dependencies).toContain('Button'); // External dependency should remain
    });

    it('should keep exported components even if they are functions', () => {
      const contracts: UIFContract[] = [
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/components/Card.tsx',
          entryPathAbs: '/project/src/components/Card.tsx',
          entryPathRel: 'src/components/Card.tsx',
          os: 'posix',
          description: 'Card component',
          composition: {
            variables: [],
            hooks: [],
            components: ['Button', 'ExportedHelper'],
            functions: ['ExportedHelper'], // Defined as function
            imports: [],
          },
          interface: {
            props: {},
            emits: {},
          },
          exports: { named: ['Card', 'ExportedHelper'] }, // ExportedHelper is exported
          semanticHash: 'hash1',
          fileHash: 'file1',
        },
      ];

      const manifest = buildDependencyGraph(contracts);

      // ExportedHelper should NOT be filtered out since it's exported
      const cardNode = manifest.components['src/components/Card.tsx'];
      expect(cardNode).toBeDefined();
      expect(cardNode.dependencies).toContain('ExportedHelper');
    });

    it('should not filter when exports is "default" (conservative)', () => {
      const contracts: UIFContract[] = [
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/components/Card.tsx',
          entryPathAbs: '/project/src/components/Card.tsx',
          entryPathRel: 'src/components/Card.tsx',
          os: 'posix',
          description: 'Card component',
          composition: {
            variables: [],
            hooks: [],
            components: ['Button', 'InternalHelper'],
            functions: ['InternalHelper'],
            imports: [],
          },
          interface: {
            props: {},
            emits: {},
          },
          exports: 'default', // Can't determine specific names, be conservative
          semanticHash: 'hash1',
          fileHash: 'file1',
        },
      ];

      const manifest = buildDependencyGraph(contracts);

      // Should not filter anything when exports is "default"
      const cardNode = manifest.components['src/components/Card.tsx'];
      expect(cardNode).toBeDefined();
      expect(cardNode.dependencies).toContain('InternalHelper');
      expect(cardNode.dependencies).toContain('Button');
    });

    it('should not filter when exports is "named" (single, conservative)', () => {
      const contracts: UIFContract[] = [
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/components/Card.tsx',
          entryPathAbs: '/project/src/components/Card.tsx',
          entryPathRel: 'src/components/Card.tsx',
          os: 'posix',
          description: 'Card component',
          composition: {
            variables: [],
            hooks: [],
            components: ['Button', 'InternalHelper'],
            functions: ['InternalHelper'],
            imports: [],
          },
          interface: {
            props: {},
            emits: {},
          },
          exports: 'named', // Single named export, can't determine name, be conservative
          semanticHash: 'hash1',
          fileHash: 'file1',
        },
      ];

      const manifest = buildDependencyGraph(contracts);

      // Should not filter anything when exports is just "named"
      const cardNode = manifest.components['src/components/Card.tsx'];
      expect(cardNode).toBeDefined();
      expect(cardNode.dependencies).toContain('InternalHelper');
      expect(cardNode.dependencies).toContain('Button');
    });

    it('should not filter components that are not functions', () => {
      const contracts: UIFContract[] = [
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/components/Card.tsx',
          entryPathAbs: '/project/src/components/Card.tsx',
          entryPathRel: 'src/components/Card.tsx',
          os: 'posix',
          description: 'Card component',
          composition: {
            variables: [],
            hooks: [],
            components: ['Button', 'ExternalComponent'],
            functions: [], // ExternalComponent is not a function
            imports: [],
          },
          interface: {
            props: {},
            emits: {},
          },
          exports: { named: ['Card'] },
          semanticHash: 'hash1',
          fileHash: 'file1',
        },
      ];

      const manifest = buildDependencyGraph(contracts);

      // ExternalComponent should not be filtered (not a function)
      const cardNode = manifest.components['src/components/Card.tsx'];
      expect(cardNode).toBeDefined();
      expect(cardNode.dependencies).toContain('ExternalComponent');
      expect(cardNode.dependencies).toContain('Button');
    });

    it('should handle contracts with no exports field', () => {
      const contracts: UIFContract[] = [
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/components/Card.tsx',
          entryPathAbs: '/project/src/components/Card.tsx',
          entryPathRel: 'src/components/Card.tsx',
          os: 'posix',
          description: 'Card component',
          composition: {
            variables: [],
            hooks: [],
            components: ['Button', 'InternalHelper'],
            functions: ['InternalHelper'],
            imports: [],
          },
          interface: {
            props: {},
            emits: {},
          },
          // No exports field
          semanticHash: 'hash1',
          fileHash: 'file1',
        },
      ];

      const manifest = buildDependencyGraph(contracts);

      // Should not filter anything when exports is undefined
      const cardNode = manifest.components['src/components/Card.tsx'];
      expect(cardNode).toBeDefined();
      expect(cardNode.dependencies).toContain('InternalHelper');
      expect(cardNode.dependencies).toContain('Button');
    });

    it('should build correct usedBy relationships with filtered dependencies', () => {
      const contracts: UIFContract[] = [
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/App.tsx',
          entryPathAbs: '/project/src/App.tsx',
          entryPathRel: 'src/App.tsx',
          os: 'posix',
          description: 'App component',
          composition: {
            variables: [],
            hooks: [],
            components: ['Card'],
            functions: [],
            imports: [],
          },
          interface: {
            props: {},
            emits: {},
          },
          exports: { named: ['App'] },
          semanticHash: 'hash1',
          fileHash: 'file1',
        },
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/components/Card.tsx',
          entryPathAbs: '/project/src/components/Card.tsx',
          entryPathRel: 'src/components/Card.tsx',
          os: 'posix',
          description: 'Card component',
          composition: {
            variables: [],
            hooks: [],
            components: ['Button', 'InternalHelper'],
            functions: ['InternalHelper'],
            imports: [],
          },
          interface: {
            props: {},
            emits: {},
          },
          exports: { named: ['Card'] },
          semanticHash: 'hash2',
          fileHash: 'file2',
        },
      ];

      const manifest = buildDependencyGraph(contracts);

      // Card should be in App's dependencies
      const appNode = manifest.components['src/App.tsx'];
      expect(appNode.dependencies).toContain('Card');

      // App should be in Card's usedBy
      const cardNode = manifest.components['src/components/Card.tsx'];
      expect(cardNode.usedBy).toContain('src/App.tsx');

      // InternalHelper should not create a usedBy relationship
      expect(cardNode.dependencies).not.toContain('InternalHelper');
    });
  });

  describe('buildDependencyGraph - additional coverage', () => {
    it('should handle contracts with missing imports field', () => {
      const contracts: UIFContract[] = [
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/Component.tsx',
          description: 'Test component',
          composition: {
            variables: [],
            hooks: [],
            components: [],
            functions: [],
            // imports field is missing
          },
          interface: {
            props: {},
            emits: {},
          },
          semanticHash: 'hash1',
          fileHash: 'file1',
        },
      ];

      const manifest = buildDependencyGraph(contracts);
      const node = manifest.components['src/Component.tsx'];
      expect(node.imports).toEqual([]);
    });

    it('should include hash indices when includeHashIndices is true', () => {
      const contracts: UIFContract[] = [
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/Button.tsx',
          description: 'Button component',
          composition: {
            variables: [],
            hooks: ['useState'],
            components: [],
            functions: ['handleClick'],
            imports: ['react'],
          },
          interface: {
            props: { label: 'string' },
            emits: {},
          },
          semanticHash: 'hash1',
          fileHash: 'file1',
        },
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/Link.tsx',
          description: 'Link component',
          composition: {
            variables: [],
            hooks: ['useState'],
            components: [],
            functions: ['handleClick'],
            imports: ['react'],
          },
          interface: {
            props: { label: 'string' },
            emits: {},
          },
          semanticHash: 'hash2',
          fileHash: 'file2',
        },
      ];

      const manifest = buildDependencyGraph(contracts, { includeHashIndices: true });

      expect(manifest.hashIndex).toBeDefined();
      expect(manifest.hashIndex!.structureHash).toBeDefined();
      expect(manifest.hashIndex!.signatureHash).toBeDefined();

      // Both components have same structure, so they should be grouped
      const structureHashes = Object.values(manifest.hashIndex!.structureHash);
      const signatureHashes = Object.values(manifest.hashIndex!.signatureHash);

      // At least one hash group should have entries
      expect(structureHashes.some(arr => arr.length > 0)).toBe(true);
      expect(signatureHashes.some(arr => arr.length > 0)).toBe(true);
    });

    it('should find components with .ts extension', () => {
      const contracts: UIFContract[] = [
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'ts:module',
          entryId: 'src/utils/helper.ts',
          description: 'Helper module',
          composition: {
            variables: [],
            hooks: [],
            components: [],
            functions: ['formatDate'],
            imports: [],
          },
          interface: {
            props: {},
            emits: {},
          },
          semanticHash: 'hash1',
          fileHash: 'file1',
        },
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/App.tsx',
          description: 'App component',
          composition: {
            variables: [],
            hooks: [],
            components: ['helper'], // References the .ts file by name
            functions: [],
            imports: [],
          },
          interface: {
            props: {},
            emits: {},
          },
          semanticHash: 'hash2',
          fileHash: 'file2',
        },
      ];

      const manifest = buildDependencyGraph(contracts);

      // The helper.ts should be found and added to usedBy
      const helperNode = manifest.components['src/utils/helper.ts'];
      expect(helperNode.usedBy).toContain('src/App.tsx');
    });

    it('should not add duplicate usedBy entries', () => {
      const contracts: UIFContract[] = [
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/components/Button.tsx',
          description: 'Button component',
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
          semanticHash: 'hash1',
          fileHash: 'file1',
        },
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/App.tsx',
          description: 'App component',
          composition: {
            variables: [],
            hooks: [],
            // Button appears twice in components (simulating duplicate reference)
            components: ['Button', 'Button'],
            functions: [],
            imports: [],
          },
          interface: {
            props: {},
            emits: {},
          },
          semanticHash: 'hash2',
          fileHash: 'file2',
        },
      ];

      const manifest = buildDependencyGraph(contracts);

      // Button should only have App in usedBy once
      const buttonNode = manifest.components['src/components/Button.tsx'];
      const appOccurrences = buttonNode.usedBy.filter(id => id === 'src/App.tsx');
      expect(appOccurrences).toHaveLength(1);
    });

    it('should correctly identify roots and leaves', () => {
      const contracts: UIFContract[] = [
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/App.tsx',
          description: 'App - root component',
          composition: {
            variables: [],
            hooks: [],
            components: ['Page'],
            functions: [],
            imports: [],
          },
          interface: { props: {}, emits: {} },
          semanticHash: 'hash1',
          fileHash: 'file1',
        },
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/components/Page.tsx',
          description: 'Page component',
          composition: {
            variables: [],
            hooks: [],
            components: ['Button'],
            functions: [],
            imports: [],
          },
          interface: { props: {}, emits: {} },
          semanticHash: 'hash2',
          fileHash: 'file2',
        },
        {
          type: 'UIFContract',
          schemaVersion: '0.4',
          kind: 'react:component',
          entryId: 'src/components/Button.tsx',
          description: 'Button - leaf component',
          composition: {
            variables: [],
            hooks: [],
            components: [],
            functions: [],
            imports: [],
          },
          interface: { props: {}, emits: {} },
          semanticHash: 'hash3',
          fileHash: 'file3',
        },
      ];

      const manifest = buildDependencyGraph(contracts);

      // App is a root (not used by anyone)
      expect(manifest.graph.roots).toContain('src/App.tsx');

      // Button is a leaf (doesn't use any components)
      expect(manifest.graph.leaves).toContain('src/components/Button.tsx');
    });
  });
});

describe('generateStats', () => {
  it('should return most used components', () => {
    const manifest: ProjectManifest = {
      version: '0.3',
      generatedAt: new Date().toISOString(),
      totalComponents: 3,
      components: {
        'src/Button.tsx': {
          entryId: 'src/Button.tsx',
          description: 'Button',
          dependencies: [],
          usedBy: ['src/App.tsx', 'src/Form.tsx', 'src/Modal.tsx'],
          imports: [],
          routes: [],
          semanticHash: 'hash1',
        },
        'src/App.tsx': {
          entryId: 'src/App.tsx',
          description: 'App',
          dependencies: ['Button'],
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash2',
        },
        'src/Form.tsx': {
          entryId: 'src/Form.tsx',
          description: 'Form',
          dependencies: ['Button'],
          usedBy: ['src/App.tsx'],
          imports: [],
          routes: [],
          semanticHash: 'hash3',
        },
      },
      graph: {
        roots: ['src/App.tsx'],
        leaves: ['src/Button.tsx'],
      },
    };

    const stats = generateStats(manifest);

    expect(stats.mostUsed[0].id).toBe('src/Button.tsx');
    expect(stats.mostUsed[0].usageCount).toBe(3);
  });

  it('should return most complex components', () => {
    const manifest: ProjectManifest = {
      version: '0.3',
      generatedAt: new Date().toISOString(),
      totalComponents: 2,
      components: {
        'src/Simple.tsx': {
          entryId: 'src/Simple.tsx',
          description: 'Simple',
          dependencies: [],
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash1',
        },
        'src/Complex.tsx': {
          entryId: 'src/Complex.tsx',
          description: 'Complex',
          dependencies: ['A', 'B', 'C', 'D', 'E'],
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash2',
        },
      },
      graph: {
        roots: [],
        leaves: [],
      },
    };

    const stats = generateStats(manifest);

    expect(stats.mostComplex[0].id).toBe('src/Complex.tsx');
    expect(stats.mostComplex[0].dependencyCount).toBe(5);
  });

  it('should identify isolated components', () => {
    const manifest: ProjectManifest = {
      version: '0.3',
      generatedAt: new Date().toISOString(),
      totalComponents: 2,
      components: {
        'src/Connected.tsx': {
          entryId: 'src/Connected.tsx',
          description: 'Connected',
          dependencies: ['Other'],
          usedBy: ['Parent'],
          imports: [],
          routes: [],
          semanticHash: 'hash1',
        },
        'src/Isolated.tsx': {
          entryId: 'src/Isolated.tsx',
          description: 'Isolated',
          dependencies: [],
          usedBy: [],
          imports: [],
          routes: [],
          semanticHash: 'hash2',
        },
      },
      graph: {
        roots: [],
        leaves: [],
      },
    };

    const stats = generateStats(manifest);

    expect(stats.isolated).toContain('src/Isolated.tsx');
    expect(stats.isolated).not.toContain('src/Connected.tsx');
  });
});

describe('writeManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should write manifest to file', async () => {
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const manifest: ProjectManifest = {
      version: '0.3',
      generatedAt: new Date().toISOString(),
      totalComponents: 0,
      components: {},
      graph: { roots: [], leaves: [] },
    };

    await writeManifest(manifest, '/output/path');

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('logicstamp.manifest.json'),
      expect.any(String),
      'utf8'
    );
  });

  it('should throw user-friendly error for ENOENT', async () => {
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(writeFile).mockRejectedValue(error);

    const manifest: ProjectManifest = {
      version: '0.3',
      generatedAt: new Date().toISOString(),
      totalComponents: 0,
      components: {},
      graph: { roots: [], leaves: [] },
    };

    await expect(writeManifest(manifest, '/nonexistent/path')).rejects.toThrow(
      /Parent directory not found/
    );
  });

  it('should throw user-friendly error for EACCES', async () => {
    const error = new Error('EACCES') as NodeJS.ErrnoException;
    error.code = 'EACCES';
    vi.mocked(writeFile).mockRejectedValue(error);

    const manifest: ProjectManifest = {
      version: '0.3',
      generatedAt: new Date().toISOString(),
      totalComponents: 0,
      components: {},
      graph: { roots: [], leaves: [] },
    };

    await expect(writeManifest(manifest, '/protected/path')).rejects.toThrow(
      /Permission denied/
    );
  });

  it('should throw user-friendly error for ENOSPC', async () => {
    const error = new Error('ENOSPC') as NodeJS.ErrnoException;
    error.code = 'ENOSPC';
    vi.mocked(writeFile).mockRejectedValue(error);

    const manifest: ProjectManifest = {
      version: '0.3',
      generatedAt: new Date().toISOString(),
      totalComponents: 0,
      components: {},
      graph: { roots: [], leaves: [] },
    };

    await expect(writeManifest(manifest, '/full/disk')).rejects.toThrow(
      /No space left on device/
    );
  });

  it('should throw generic error for unknown error codes', async () => {
    const error = new Error('Unknown error') as NodeJS.ErrnoException;
    error.code = 'UNKNOWN';
    vi.mocked(writeFile).mockRejectedValue(error);

    const manifest: ProjectManifest = {
      version: '0.3',
      generatedAt: new Date().toISOString(),
      totalComponents: 0,
      components: {},
      graph: { roots: [], leaves: [] },
    };

    await expect(writeManifest(manifest, '/some/path')).rejects.toThrow(
      /Failed to write manifest/
    );
  });
});

