/**
 * Package Info Utility - Extract package names and versions for missing dependencies
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export type PackageJsonDeps = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type PackageJsonCacheEntry = {
  path: string;
  content: PackageJsonDeps | null;
};

/**
 * Loads and caches package.json dependency fields per project root.
 * Use one instance per process (or per test) instead of module-level globals.
 */
export class PackageJsonLoader {
  private cache: PackageJsonCacheEntry | null = null;

  clear(): void {
    this.cache = null;
  }

  async load(projectRoot: string): Promise<PackageJsonDeps | null> {
    if (this.cache && this.cache.path === projectRoot) {
      return this.cache.content;
    }

    const packageJsonPath = join(projectRoot, 'package.json');

    if (!existsSync(packageJsonPath)) {
      this.cache = { path: projectRoot, content: null };
      return null;
    }

    try {
      const raw = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(raw) as Record<string, unknown>;

      const result: PackageJsonDeps = {
        dependencies: packageJson.dependencies as Record<string, string> | undefined,
        devDependencies: packageJson.devDependencies as Record<string, string> | undefined,
        peerDependencies: packageJson.peerDependencies as Record<string, string> | undefined,
      };

      this.cache = { path: projectRoot, content: result };
      return result;
    } catch {
      this.cache = { path: projectRoot, content: null };
      return null;
    }
  }

  async getPackageVersion(packageName: string, projectRoot: string): Promise<string | undefined> {
    const packageJson = await this.load(projectRoot);

    if (!packageJson) {
      return undefined;
    }

    if (packageJson.dependencies?.[packageName]) {
      return packageJson.dependencies[packageName];
    }
    if (packageJson.devDependencies?.[packageName]) {
      return packageJson.devDependencies[packageName];
    }
    if (packageJson.peerDependencies?.[packageName]) {
      return packageJson.peerDependencies[packageName];
    }

    return undefined;
  }
}

const defaultPackageJsonLoader = new PackageJsonLoader();

/** @internal For tests or isolated loaders; normal use goes through {@link defaultPackageJsonLoader}. */
export function createPackageJsonLoader(): PackageJsonLoader {
  return new PackageJsonLoader();
}

/**
 * Check if an import specifier is a third-party package (not a relative path)
 */
export function isThirdPartyPackage(importSpecifier: string): boolean {
  if (importSpecifier.startsWith('.') || importSpecifier.startsWith('/')) {
    return false;
  }

  if (importSpecifier.includes(':') || importSpecifier.startsWith('/')) {
    return false;
  }

  return true;
}

/**
 * Extract package name from import specifier
 * Handles scoped packages (@scope/package) and subpath imports (@scope/package/path)
 */
export function extractPackageName(importSpecifier: string): string | null {
  if (!importSpecifier || importSpecifier.trim() === '') {
    return null;
  }

  if (!isThirdPartyPackage(importSpecifier)) {
    return null;
  }

  if (importSpecifier.startsWith('@')) {
    const parts = importSpecifier.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return null;
  }

  const firstSlash = importSpecifier.indexOf('/');
  if (firstSlash === -1) {
    return importSpecifier;
  }

  return importSpecifier.substring(0, firstSlash);
}

/**
 * Get version for a package from package.json
 * Checks dependencies, devDependencies, and peerDependencies
 */
export async function getPackageVersion(
  packageName: string,
  projectRoot: string
): Promise<string | undefined> {
  return defaultPackageJsonLoader.getPackageVersion(packageName, projectRoot);
}

/**
 * Clear the package.json cache (useful for testing or after edits on disk)
 */
export function clearPackageJsonCache(): void {
  defaultPackageJsonLoader.clear();
}
