/**
 * Context command - Generates context bundles from React/TypeScript codebases
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { globFiles, readFileWithText } from '../../utils/fsx.js';
import { buildContract } from '../../core/contractBuilder.js';
import { extractFromFile } from '../../core/astParser.js';
import { buildDependencyGraph } from '../../core/manifest.js';
import type { UIFContract } from '../../types/UIFContract.js';
import {
  pack,
  formatBundle,
  type PackOptions,
  type LogicStampBundle,
} from '../../core/pack.js';

/**
 * Normalize path for display (convert backslashes to forward slashes)
 */
function displayPath(path: string): string {
  return path.replace(/\\/g, '/');
}

export interface ContextOptions {
  entry?: string;
  depth: number;
  includeCode: 'none' | 'header' | 'full';
  format: 'json' | 'pretty' | 'ndjson';
  out: string;
  hashLock: boolean;
  strict: boolean;
  allowMissing: boolean;
  maxNodes: number;
  profile: 'llm-safe' | 'llm-chat' | 'ci-strict';
  predictBehavior: boolean;
  dryRun: boolean;
  stats: boolean;
}

export async function contextCommand(options: ContextOptions): Promise<void> {
  const startTime = Date.now();

  // Determine the target directory
  const targetPath = options.entry || '.';
  const projectRoot = resolve(targetPath);

  console.log(`🔍 Scanning ${displayPath(projectRoot)}...`);

  // Step 1: Find all React/TS files
  const files = await globFiles(projectRoot);

  if (files.length === 0) {
    console.error(`❌ No React/TypeScript modules found under ${displayPath(projectRoot)}`);
    console.error(`   Try: logicstamp-context ./src or --depth 0 to scan all directories`);
    process.exit(1);
  }

  console.log(`   Found ${files.length} files`);

  // Step 2: Build contracts for all files
  console.log(`🔨 Analyzing components...`);
  const contracts: UIFContract[] = [];
  let analyzed = 0;

  for (const file of files) {
    try {
      // Extract AST from file
      const ast = await extractFromFile(file);

      // Build contract from AST
      const { text } = await readFileWithText(file);
      const result = buildContract(file, ast, {
        preset: 'none',
        sourceText: text,
        enablePredictions: options.predictBehavior,
      });

      if (result.contract) {
        contracts.push(result.contract);
        analyzed++;
      }
    } catch (error) {
      // Skip files that can't be analyzed
      console.warn(`   ⚠️  Skipped ${file}: ${(error as Error).message}`);
    }
  }

  console.log(`   Analyzed ${analyzed} components`);

  if (contracts.length === 0) {
    console.error('❌ No components found to analyze');
    console.error(`   Files were found but could not be analyzed as React/TypeScript components`);
    console.error(`   Ensure your files contain valid React components or TypeScript modules`);
    process.exit(1);
  }

  // Step 3: Build dependency graph (manifest)
  console.log(`📊 Building dependency graph...`);
  const manifest = buildDependencyGraph(contracts);

  // Step 3.5: Create contracts map for pack function
  const contractsMap = new Map<string, UIFContract>();
  for (const contract of contracts) {
    contractsMap.set(contract.entryId, contract);
  }

  // Apply profile settings
  let depth = options.depth;
  let includeCode = options.includeCode;
  let hashLock = options.hashLock;
  let strict = options.strict;

  if (options.profile === 'llm-safe') {
    depth = 1;
    includeCode = 'header';
    hashLock = false;
    options.maxNodes = 30;
    options.allowMissing = true;
    console.log('📋 Using profile: llm-safe (depth=1, header only, max 30 nodes)');
  } else if (options.profile === 'llm-chat') {
    depth = 1;
    includeCode = 'header';
    hashLock = false;
    console.log('📋 Using profile: llm-chat (depth=1, header only, max 100 nodes)');
  } else if (options.profile === 'ci-strict') {
    includeCode = 'none';
    hashLock = false;
    strict = true;
    console.log('📋 Using profile: ci-strict (no code, strict dependencies)');
  }

  // Step 4: Pack context bundles
  const packOptions: PackOptions = {
    depth,
    includeCode,
    format: options.format,
    hashLock,
    strict,
    allowMissing: options.allowMissing,
    maxNodes: options.maxNodes,
    contractsMap, // Pass in-memory contracts
  };

  let bundles: LogicStampBundle[];
  let output: string;

  // Generate context for all root components
  console.log(`📦 Generating context for ${manifest.graph.roots.length} root components (depth=${depth})...`);

  bundles = [];
  for (const rootId of manifest.graph.roots) {
    try {
      const bundle = await pack(rootId, manifest, packOptions, projectRoot);
      bundles.push(bundle);
    } catch (error) {
      console.warn(`   ⚠️  Failed to pack ${rootId}: ${(error as Error).message}`);
    }
  }

  if (bundles.length === 0) {
    console.error('❌ No bundles could be generated');
    process.exit(1);
  }

  // Sort bundles by entryId for deterministic output
  bundles.sort((a, b) => a.entryId.localeCompare(b.entryId));

  // Combine all bundles into output
  if (options.format === 'ndjson') {
    output = bundles.map((b, idx) => {
      const bundleWithSchema = {
        $schema: './schema/logicstamp.context.schema.json',
        position: `${idx + 1}/${bundles.length}`,
        ...b,
      };
      return JSON.stringify(bundleWithSchema);
    }).join('\n');
  } else if (options.format === 'json') {
    const bundlesWithPosition = bundles.map((b, idx) => ({
      $schema: './schema/logicstamp.context.schema.json',
      position: `${idx + 1}/${bundles.length}`,
      ...b,
    }));
    output = JSON.stringify(bundlesWithPosition, null, 2);
  } else {
    // pretty format
    output = bundles.map((b, idx) => {
      const bundleWithSchema = {
        $schema: './schema/logicstamp.context.schema.json',
        position: `${idx + 1}/${bundles.length}`,
        ...b,
      };
      const header = `\n# Bundle ${idx + 1}/${bundles.length}: ${b.entryId}`;
      return header + '\n' + JSON.stringify(bundleWithSchema, null, 2);
    }).join('\n\n');
  }

  const elapsed = Date.now() - startTime;

  // Calculate stats
  const totalNodes = bundles.reduce((sum, b) => sum + b.graph.nodes.length, 0);
  const totalEdges = bundles.reduce((sum, b) => sum + b.graph.edges.length, 0);
  const totalMissing = bundles.reduce((sum, b) => sum + b.meta.missing.length, 0);

  // If --stats flag is set, output one-line JSON and exit
  // Stats Output Contract (for CI parsing):
  // {
  //   totalComponents: number,      // Total .ts/.tsx files analyzed
  //   rootComponents: number,        // Components with no dependencies (entry points)
  //   leafComponents: number,        // Components that are only dependencies (no imports)
  //   bundlesGenerated: number,      // Number of bundles created (one per root)
  //   totalNodes: number,            // Sum of all nodes across all bundles
  //   totalEdges: number,            // Sum of all edges across all bundles
  //   missingDependencies: number,   // Count of unresolved dependencies (third-party/external)
  //   elapsedMs: number              // Time taken in milliseconds
  // }
  if (options.stats) {
    const stats = {
      totalComponents: contracts.length,
      rootComponents: manifest.graph.roots.length,
      leafComponents: manifest.graph.leaves.length,
      bundlesGenerated: bundles.length,
      totalNodes,
      totalEdges,
      missingDependencies: totalMissing,
      elapsedMs: elapsed,
    };
    console.log(JSON.stringify(stats));
    return;
  }

  // Write output unless --dry-run
  if (!options.dryRun) {
    const outPath = resolve(options.out);
    // Ensure output directory exists
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, output, 'utf8');
    console.log(`✅ Context written to "${displayPath(outPath)}"`);
  } else {
    console.log('🔍 Dry run - no file written');
  }

  // Print summary
  console.log('\n📊 Summary:');
  console.log(`   Total components: ${contracts.length}`);
  console.log(`   Root components: ${manifest.graph.roots.length}`);
  console.log(`   Leaf components: ${manifest.graph.leaves.length}`);
  console.log(`   Bundles generated: ${bundles.length}`);
  console.log(`   Total nodes in context: ${totalNodes}`);
  console.log(`   Total edges: ${totalEdges}`);
  console.log(`   Missing dependencies: ${totalMissing}`);

  if (totalMissing > 0) {
    console.log('\n⚠️  Missing dependencies (external/third-party):');
    const allMissing = new Set<string>();
    bundles.forEach(b => {
      b.meta.missing.forEach(dep => allMissing.add(dep.name));
    });
    Array.from(allMissing).slice(0, 10).forEach(name => console.log(`   - ${name}`));
    if (allMissing.size > 10) {
      console.log(`   ... and ${allMissing.size - 10} more`);
    }
  }

  console.log(`\n⏱  Completed in ${elapsed}ms`);
}
