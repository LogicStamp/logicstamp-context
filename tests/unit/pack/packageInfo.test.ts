import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  isThirdPartyPackage, 
  extractPackageName, 
  getPackageVersion,
  clearPackageJsonCache 
} from '../../../src/core/pack/packageInfo.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

describe('Package Info Utilities', () => {
  let testProjectRoot: string;
  let originalCwd: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    testProjectRoot = join(tmpdir(), `logicstamp-test-${Date.now()}`);
    await mkdir(testProjectRoot, { recursive: true });
    originalCwd = process.cwd();
    clearPackageJsonCache();
  });

  afterEach(async () => {
    clearPackageJsonCache();
    // Cleanup would go here if needed
  });

  describe('isThirdPartyPackage', () => {
    it('should identify third-party packages', () => {
      expect(isThirdPartyPackage('react')).toBe(true);
      expect(isThirdPartyPackage('@mui/material')).toBe(true);
      expect(isThirdPartyPackage('lodash')).toBe(true);
      expect(isThirdPartyPackage('@types/node')).toBe(true);
    });

    it('should identify relative imports as not third-party', () => {
      expect(isThirdPartyPackage('./Component')).toBe(false);
      expect(isThirdPartyPackage('../utils')).toBe(false);
      expect(isThirdPartyPackage('./components/Button')).toBe(false);
      expect(isThirdPartyPackage('../../shared/utils')).toBe(false);
    });

    it('should identify absolute paths as not third-party', () => {
      expect(isThirdPartyPackage('/absolute/path')).toBe(false);
      expect(isThirdPartyPackage('C:\\Windows\\path')).toBe(false);
    });

    it('should handle subpath imports', () => {
      expect(isThirdPartyPackage('@mui/material/Button')).toBe(true);
      expect(isThirdPartyPackage('lodash/debounce')).toBe(true);
    });
  });

  describe('extractPackageName', () => {
    it('should extract package name from simple package', () => {
      expect(extractPackageName('react')).toBe('react');
      expect(extractPackageName('lodash')).toBe('lodash');
    });

    it('should extract package name from scoped packages', () => {
      expect(extractPackageName('@mui/material')).toBe('@mui/material');
      expect(extractPackageName('@types/node')).toBe('@types/node');
    });

    it('should extract package name from subpath imports', () => {
      expect(extractPackageName('@mui/material/Button')).toBe('@mui/material');
      expect(extractPackageName('lodash/debounce')).toBe('lodash');
      expect(extractPackageName('@types/node/package.json')).toBe('@types/node');
    });

    it('should handle nested subpaths', () => {
      expect(extractPackageName('@mui/material/styles/createTheme')).toBe('@mui/material');
      expect(extractPackageName('package/sub/path/deep')).toBe('package');
    });

    it('should return null for relative imports', () => {
      expect(extractPackageName('./Component')).toBeNull();
      expect(extractPackageName('../utils')).toBeNull();
    });

    it('should return null for absolute paths', () => {
      expect(extractPackageName('/absolute/path')).toBeNull();
    });

    it('should handle edge cases', () => {
      expect(extractPackageName('@')).toBeNull(); // Invalid scoped package
      expect(extractPackageName('')).toBeNull(); // Empty string
    });
  });

  describe('getPackageVersion', () => {
    it('should get version from dependencies', async () => {
      const packageJson = {
        dependencies: {
          'react': '^18.2.0',
          '@mui/material': '^5.15.0',
        },
      };
      await writeFile(
        join(testProjectRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const version = await getPackageVersion('react', testProjectRoot);
      expect(version).toBe('^18.2.0');
    });

    it('should get version from devDependencies', async () => {
      const packageJson = {
        devDependencies: {
          'typescript': '^5.3.0',
          '@types/react': '^18.0.0',
        },
      };
      await writeFile(
        join(testProjectRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const version = await getPackageVersion('typescript', testProjectRoot);
      expect(version).toBe('^5.3.0');
    });

    it('should get version from peerDependencies', async () => {
      const packageJson = {
        peerDependencies: {
          'react': '^18.0.0',
        },
      };
      await writeFile(
        join(testProjectRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const version = await getPackageVersion('react', testProjectRoot);
      expect(version).toBe('^18.0.0');
    });

    it('should prioritize dependencies over devDependencies', async () => {
      const packageJson = {
        dependencies: {
          'react': '^18.2.0',
        },
        devDependencies: {
          'react': '^17.0.0',
        },
      };
      await writeFile(
        join(testProjectRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const version = await getPackageVersion('react', testProjectRoot);
      expect(version).toBe('^18.2.0');
    });

    it('should return undefined for missing package', async () => {
      const packageJson = {
        dependencies: {
          'react': '^18.2.0',
        },
      };
      await writeFile(
        join(testProjectRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const version = await getPackageVersion('nonexistent', testProjectRoot);
      expect(version).toBeUndefined();
    });

    it('should return undefined when package.json does not exist', async () => {
      const version = await getPackageVersion('react', '/nonexistent/path');
      expect(version).toBeUndefined();
    });

    it('should handle invalid package.json gracefully', async () => {
      await writeFile(
        join(testProjectRoot, 'package.json'),
        'invalid json content'
      );

      // Should not throw, but return undefined
      const version = await getPackageVersion('react', testProjectRoot);
      expect(version).toBeUndefined();
    });

    it('should cache package.json reads', async () => {
      const packageJson = {
        dependencies: {
          'react': '^18.2.0',
        },
      };
      await writeFile(
        join(testProjectRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // First call
      const version1 = await getPackageVersion('react', testProjectRoot);
      expect(version1).toBe('^18.2.0');

      // Modify package.json
      packageJson.dependencies.react = '^19.0.0';
      await writeFile(
        join(testProjectRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Second call should use cache (same projectRoot)
      const version2 = await getPackageVersion('react', testProjectRoot);
      expect(version2).toBe('^18.2.0'); // Cached version

      // Clear cache and try again
      clearPackageJsonCache();
      const version3 = await getPackageVersion('react', testProjectRoot);
      expect(version3).toBe('^19.0.0'); // Fresh read
    });

    it('should handle scoped packages', async () => {
      const packageJson = {
        dependencies: {
          '@mui/material': '^5.15.0',
          '@types/node': '^20.0.0',
        },
      };
      await writeFile(
        join(testProjectRoot, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const version1 = await getPackageVersion('@mui/material', testProjectRoot);
      expect(version1).toBe('^5.15.0');

      const version2 = await getPackageVersion('@types/node', testProjectRoot);
      expect(version2).toBe('^20.0.0');
    });
  });
});
