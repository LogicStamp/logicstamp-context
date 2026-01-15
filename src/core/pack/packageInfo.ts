/**
 * Package Info Utility - Extract package names and versions for missing dependencies
 */

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Cache for package.json content to avoid repeated file reads
 */
let packageJsonCache: {
  path: string;
  content: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  } | null;
} | null = null;

/**
 * Check if an import specifier is a third-party package (not a relative path)
 */
export function isThirdPartyPackage(importSpecifier: string): boolean {
  // Relative imports start with . or /
  if (importSpecifier.startsWith('.') || importSpecifier.startsWith('/')) {
    return false;
  }
  
  // Absolute paths (Windows or Unix)
  if (importSpecifier.includes(':') || importSpecifier.startsWith('/')) {
    return false;
  }
  
  // Everything else is likely a third-party package
  return true;
}

/**
 * Extract package name from import specifier
 * Handles scoped packages (@scope/package) and subpath imports (@scope/package/path)
 */
export function extractPackageName(importSpecifier: string): string | null {
  // Handle empty string
  if (!importSpecifier || importSpecifier.trim() === '') {
    return null;
  }
  
  if (!isThirdPartyPackage(importSpecifier)) {
    return null;
  }
  
  // Handle scoped packages: @scope/package -> @scope/package
  // Handle subpath imports: @scope/package/path -> @scope/package
  if (importSpecifier.startsWith('@')) {
    const parts = importSpecifier.split('/');
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
    return null;
  }
  
  // Handle regular packages: package -> package
  // Handle subpath imports: package/path -> package
  const firstSlash = importSpecifier.indexOf('/');
  if (firstSlash === -1) {
    return importSpecifier;
  }
  
  return importSpecifier.substring(0, firstSlash);
}

/**
 * Load package.json from project root
 * Caches the result to avoid repeated file reads
 */
async function loadPackageJson(projectRoot: string): Promise<{
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
} | null> {
  // Use cached version if available and path matches
  if (packageJsonCache && packageJsonCache.path === projectRoot) {
    return packageJsonCache.content;
  }
  
  const packageJsonPath = join(projectRoot, 'package.json');
  
  // Check if package.json exists
  if (!existsSync(packageJsonPath)) {
    packageJsonCache = { path: projectRoot, content: null };
    return null;
  }
  
  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    
    const result = {
      dependencies: packageJson.dependencies,
      devDependencies: packageJson.devDependencies,
      peerDependencies: packageJson.peerDependencies,
    };
    
    // Cache the result
    packageJsonCache = { path: projectRoot, content: result };
    return result;
  } catch (error) {
    // If parsing fails, cache null to avoid repeated attempts
    packageJsonCache = { path: projectRoot, content: null };
    return null;
  }
}

/**
 * Get version for a package from package.json
 * Checks dependencies, devDependencies, and peerDependencies
 */
export async function getPackageVersion(
  packageName: string,
  projectRoot: string
): Promise<string | undefined> {
  const packageJson = await loadPackageJson(projectRoot);
  
  if (!packageJson) {
    return undefined;
  }
  
  // Check dependencies first (most common)
  if (packageJson.dependencies && packageJson.dependencies[packageName]) {
    return packageJson.dependencies[packageName];
  }
  
  // Check devDependencies
  if (packageJson.devDependencies && packageJson.devDependencies[packageName]) {
    return packageJson.devDependencies[packageName];
  }
  
  // Check peerDependencies
  if (packageJson.peerDependencies && packageJson.peerDependencies[packageName]) {
    return packageJson.peerDependencies[packageName];
  }
  
  return undefined;
}

/**
 * Clear the package.json cache (useful for testing)
 */
export function clearPackageJsonCache(): void {
  packageJsonCache = null;
}
