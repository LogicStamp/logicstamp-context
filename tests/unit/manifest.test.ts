import { describe, it, expect } from 'vitest';
import { buildDependencyGraph } from '../../src/core/manifest.js';
import type { UIFContract } from '../../src/types/UIFContract.js';

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
});

