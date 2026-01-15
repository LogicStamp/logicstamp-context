/**
 * Collector module - BFS dependency collection
 */

import { normalizeEntryId } from '../../utils/fsx.js';
import type { ProjectManifest } from '../manifest.js';
import { resolveDependency } from './resolver.js';
import { isThirdPartyPackage, extractPackageName, getPackageVersion } from './packageInfo.js';

/**
 * Missing dependency information
 */
export interface MissingDependency {
  name: string;
  reason: string;
  referencedBy?: string;
  packageName?: string; // Extracted package name for third-party dependencies
  version?: string; // Version from package.json (if available)
}

/**
 * Perform BFS traversal to collect dependencies
 */
export async function collectDependencies(
  entryId: string,
  manifest: ProjectManifest,
  depth: number,
  maxNodes: number,
  projectRoot?: string
): Promise<{ visited: Set<string>; missing: MissingDependency[] }> {
  const visited = new Set<string>();
  const missing: MissingDependency[] = [];
  const queue: Array<{ id: string; level: number }> = [{ id: entryId, level: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Normalize the ID for lookup
    const normalizedId = normalizeEntryId(current.id);
    
    // Try to find component by normalized ID
    let node = manifest.components[normalizedId];
    let componentKey = normalizedId;
    
    // If not found, try to find by matching normalized entryIds
    if (!node) {
      for (const [key, comp] of Object.entries(manifest.components)) {
        if (normalizeEntryId(key) === normalizedId || normalizeEntryId(comp.entryId) === normalizedId) {
          node = comp;
          componentKey = key;
          break;
        }
      }
    }

    // Skip if already visited or exceeded depth
    if (visited.has(componentKey) || current.level > depth) {
      continue;
    }

    // Check max nodes limit
    if (visited.size >= maxNodes) {
      break;
    }
    
    if (!node) {
      const missingDep: MissingDependency = {
        name: current.id,
        reason: 'Component not found in manifest',
      };
      
      // Enhance with package info if it's a third-party package
      if (projectRoot && isThirdPartyPackage(current.id)) {
        const packageName = extractPackageName(current.id);
        if (packageName) {
          missingDep.packageName = packageName;
          const version = await getPackageVersion(packageName, projectRoot);
          if (version) {
            missingDep.version = version;
          }
        }
      }
      
      missing.push(missingDep);
      continue;
    }

    visited.add(componentKey);

    // Only traverse deeper if we haven't reached depth limit
    if (current.level < depth) {
      // Add dependencies to queue
      for (const dep of node.dependencies) {
        const resolvedId = resolveDependency(manifest, dep, componentKey);

        if (resolvedId) {
          if (!visited.has(resolvedId)) {
            queue.push({ id: resolvedId, level: current.level + 1 });
          }
        } else {
          // Track missing dependency
          if (!missing.some((m) => m.name === dep)) {
            const missingDep: MissingDependency = {
              name: dep,
              reason: 'No contract found (third-party or not scanned)',
              referencedBy: componentKey, // Use manifest key, not current.id
            };
            
            // Enhance with package info if it's a third-party package
            if (projectRoot && isThirdPartyPackage(dep)) {
              const packageName = extractPackageName(dep);
              if (packageName) {
                missingDep.packageName = packageName;
                const version = await getPackageVersion(packageName, projectRoot);
                if (version) {
                  missingDep.version = version;
                }
              }
            }
            
            missing.push(missingDep);
          }
        }
      }
    }
  }

  return { visited, missing };
}

