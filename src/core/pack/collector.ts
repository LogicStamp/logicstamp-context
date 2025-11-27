/**
 * Collector module - BFS dependency collection
 */

import { normalizeEntryId } from '../../utils/fsx.js';
import type { ProjectManifest } from '../manifest.js';
import { resolveDependency } from './resolver.js';

/**
 * Missing dependency information
 */
export interface MissingDependency {
  name: string;
  reason: string;
  referencedBy?: string;
}

/**
 * Perform BFS traversal to collect dependencies
 */
export function collectDependencies(
  entryId: string,
  manifest: ProjectManifest,
  depth: number,
  maxNodes: number
): { visited: Set<string>; missing: MissingDependency[] } {
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
      missing.push({
        name: current.id,
        reason: 'Component not found in manifest',
      });
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
            missing.push({
              name: dep,
              reason: 'No contract found (third-party or not scanned)',
              referencedBy: componentKey, // Use manifest key, not current.id
            });
          }
        }
      }
    }
  }

  return { visited, missing };
}

