#!/usr/bin/env node

/**
 * LogicStamp Context CLI - Standalone context generator
 * Scans React/TypeScript files and generates AI-friendly context bundles
 */

import { writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { globFiles, readFileWithText, getRelativePath } from '../utils/fsx.js';
import { buildContract, type ContractBuildResult } from '../core/contractBuilder.js';
import { extractFromFile } from '../core/astParser.js';
import { buildDependencyGraph } from '../core/manifest.js';
import type { UIFContract } from '../types/UIFContract.js';
import {
  pack,
  formatBundle,
  type PackOptions,
  type LogicStampBundle,
} from '../core/pack.js';

interface ContextOptions {
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
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const options: ContextOptions = {
    depth: 1,
    includeCode: 'header',
    format: 'json',
    out: 'context.json',
    hashLock: false, // No hash lock for standalone (no sidecars)
    strict: false,
    allowMissing: true,
    maxNodes: 100,
    profile: 'llm-chat',
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg.startsWith('--') || arg.startsWith('-')) {
      const key = arg.replace(/^--?/, '');
      const value = args[i + 1];

      switch (key) {
        case 'depth':
        case 'd':
          options.depth = parseInt(value, 10);
          i++;
          break;
        case 'include-code':
        case 'c':
          options.includeCode = value as 'none' | 'header' | 'full';
          i++;
          break;
        case 'format':
        case 'f':
          options.format = value as 'json' | 'pretty' | 'ndjson';
          i++;
          break;
        case 'out':
        case 'o':
          options.out = value;
          i++;
          break;
        case 'max-nodes':
        case 'm':
          options.maxNodes = parseInt(value, 10);
          i++;
          break;
        case 'profile':
          options.profile = value as 'llm-safe' | 'llm-chat' | 'ci-strict';
          i++;
          break;
        case 'strict':
        case 's':
          options.strict = true;
          break;
      }
    } else if (!arg.startsWith('-') && !options.entry) {
      options.entry = arg;
    }
  }

  try {
    await generateContext(options);
  } catch (error) {
    console.error('❌ Context generation failed:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

async function generateContext(options: ContextOptions): Promise<void> {
  const startTime = Date.now();

  // Determine the target directory
  const targetPath = options.entry || '.';
  const projectRoot = resolve(targetPath);

  console.log(`🔍 Scanning ${projectRoot}...`);

  // Step 1: Find all React/TS files
  const files = await globFiles(projectRoot);
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

  // Combine all bundles into output
  if (options.format === 'ndjson') {
    output = bundles.map(b => formatBundle(b, 'json')).join('\n');
  } else if (options.format === 'json') {
    const bundlesWithPosition = bundles.map((b, idx) => ({
      position: `${idx + 1}/${bundles.length}`,
      ...b,
    }));
    output = JSON.stringify(bundlesWithPosition, null, 2);
  } else {
    output = bundles.map((b, idx) => {
      const header = `\n# Bundle ${idx + 1}/${bundles.length}: ${b.entryId}`;
      return header + '\n' + formatBundle(b, 'pretty');
    }).join('\n\n');
  }

  // Write output
  const outPath = resolve(options.out);
  await writeFile(outPath, output, 'utf8');
  console.log(`✅ Context written to ${outPath}`);

  const elapsed = Date.now() - startTime;

  // Print summary
  console.log('\n📊 Summary:');
  const totalNodes = bundles.reduce((sum, b) => sum + b.graph.nodes.length, 0);
  const totalEdges = bundles.reduce((sum, b) => sum + b.graph.edges.length, 0);
  const totalMissing = bundles.reduce((sum, b) => sum + b.meta.missing.length, 0);

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

function printHelp() {
  console.log(`
╭─────────────────────────────────────────────────╮
│  LogicStamp Context - AI-Ready Documentation    │
│  Generate context bundles from React codebases  │
╰─────────────────────────────────────────────────╯

USAGE:
  logicstamp-context [path] [options]

ARGUMENTS:
  [path]               Directory to scan (default: current directory)

OPTIONS:
  -d, --depth <n>           Dependency depth (default: 1)
  -c, --include-code <mode> Code: none|header|full (default: header)
  -f, --format <format>     Format: json|pretty|ndjson (default: json)
  -o, --out <file>          Output file (default: context.json)
  -m, --max-nodes <n>       Max nodes per bundle (default: 100)
  --profile <profile>       Profile: llm-safe|llm-chat|ci-strict
  -s, --strict              Fail on missing dependencies
  -h, --help                Show this help

PROFILES:
  llm-safe    Conservative (depth=1, header, max 30 nodes)
  llm-chat    Balanced (depth=1, header, max 100 nodes) [default]
  ci-strict   Strict validation (no code, strict deps)

EXAMPLES:
  logicstamp-context
    Generate context for entire project

  logicstamp-context ./src
    Generate context for src directory

  logicstamp-context --profile llm-safe --out ai-context.json
    Use conservative profile with custom output

  logicstamp-context --depth 2 --include-code full
    Include full source code with deeper traversal

NOTES:
  • Scans for .ts/.tsx files automatically
  • Generates context on-the-fly (no pre-compilation needed)
  • Output is ready for Claude, ChatGPT, or other AI tools
  `);
}

main();
