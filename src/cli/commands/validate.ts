/**
 * Validate command - Validates context.json files (single or multi-file mode)
 */

import { readFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import type { LogicStampBundle, LogicStampIndex } from '../../core/pack.js';

/**
 * Normalize path for display (convert backslashes to forward slashes)
 */
function displayPath(path: string): string {
  return path.replace(/\\/g, '/');
}

export interface ValidationResult {
  valid: boolean;
  errors: number;
  warnings: number;
  bundles: number;
  nodes: number;
  edges: number;
  messages: string[];
}

/**
 * Validate bundles in memory (for auto-validation during generation)
 */
export function validateBundles(bundles: LogicStampBundle[]): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: 0,
    warnings: 0,
    bundles: bundles.length,
    nodes: 0,
    edges: 0,
    messages: [],
  };

  if (!Array.isArray(bundles)) {
    result.valid = false;
    result.errors++;
    result.messages.push('Invalid format: expected array of bundles');
    return result;
  }

  for (let i = 0; i < bundles.length; i++) {
    const bundle = bundles[i];
    const bundleLabel = `Bundle ${i + 1}`;

    // Count nodes and edges
    result.nodes += bundle.graph?.nodes?.length || 0;
    result.edges += bundle.graph?.edges?.length || 0;

    // Check required fields
    if (bundle.type !== 'LogicStampBundle') {
      result.valid = false;
      result.errors++;
      result.messages.push(`${bundleLabel}: Invalid type (expected 'LogicStampBundle', got '${bundle.type}')`);
    }

    if (bundle.schemaVersion !== '0.1') {
      result.valid = false;
      result.errors++;
      result.messages.push(`${bundleLabel}: Invalid schemaVersion (expected '0.1', got '${bundle.schemaVersion}')`);
    }

    if (!bundle.entryId) {
      result.valid = false;
      result.errors++;
      result.messages.push(`${bundleLabel}: Missing entryId`);
    }

    if (!bundle.graph || !Array.isArray(bundle.graph.nodes) || !Array.isArray(bundle.graph.edges)) {
      result.valid = false;
      result.errors++;
      result.messages.push(`${bundleLabel}: Invalid graph structure`);
    }

    if (!bundle.meta || !Array.isArray(bundle.meta.missing)) {
      result.valid = false;
      result.errors++;
      result.messages.push(`${bundleLabel}: Invalid meta structure`);
    }

    // Validate contracts
    if (bundle.graph && bundle.graph.nodes) {
      for (const node of bundle.graph.nodes) {
        const contract = node.contract;
        if (contract?.type !== 'UIFContract') {
          result.valid = false;
          result.errors++;
          result.messages.push(`${bundleLabel}: Node ${node.entryId} has invalid contract type`);
        }
        if (contract?.schemaVersion !== '0.3') {
          result.warnings++;
          result.messages.push(`${bundleLabel}: Node ${node.entryId} has unexpected contract version ${contract?.schemaVersion}`);
        }
      }
    }

    // Check hash format (bundle hashes use uifb: prefix)
    if (bundle.bundleHash && !bundle.bundleHash.match(/^uifb:[a-f0-9]{24}$/)) {
      result.warnings++;
      result.messages.push(`${bundleLabel}: bundleHash has unexpected format`);
    }
  }

  return result;
}

/**
 * Multi-file validation result for a single folder's context file
 */
export interface FolderValidationResult {
  folderPath: string;
  contextFile: string;
  valid: boolean;
  result: ValidationResult;
}

/**
 * Multi-file validation result (validates all context files)
 */
export interface MultiFileValidationResult {
  valid: boolean;
  totalFolders: number;
  validFolders: number;
  invalidFolders: number;
  folders: FolderValidationResult[];
  totalErrors: number;
  totalWarnings: number;
  totalNodes: number;
  totalEdges: number;
}

/**
 * Load LogicStampIndex from file
 */
async function loadIndex(indexPath: string): Promise<LogicStampIndex> {
  try {
    const content = await readFile(indexPath, 'utf8');
    const index = JSON.parse(content) as LogicStampIndex;

    if (index.type !== 'LogicStampIndex') {
      throw new Error(`Invalid index file: expected type 'LogicStampIndex', got '${index.type}'`);
    }

    return index;
  } catch (error) {
    throw new Error(`Failed to load index from ${indexPath}: ${(error as Error).message}`);
  }
}

/**
 * Validate a single context file and return results
 */
async function validateContextFile(contextPath: string): Promise<ValidationResult> {
  const content = await readFile(contextPath, 'utf8');
  const bundles = JSON.parse(content) as LogicStampBundle[];
  return validateBundles(bundles);
}

/**
 * Multi-file validation - validates all context files using context_main.json index
 */
export async function multiFileValidate(indexPath: string): Promise<MultiFileValidationResult> {
  const baseDir = dirname(indexPath);

  // Load index file
  const index = await loadIndex(indexPath);

  const folderResults: FolderValidationResult[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalNodes = 0;
  let totalEdges = 0;

  // Validate each folder's context file
  for (const folder of index.folders) {
    const contextPath = join(baseDir, folder.contextFile);

    try {
      const result = await validateContextFile(contextPath);

      folderResults.push({
        folderPath: folder.path,
        contextFile: folder.contextFile,
        valid: result.valid,
        result,
      });

      totalErrors += result.errors;
      totalWarnings += result.warnings;
      totalNodes += result.nodes;
      totalEdges += result.edges;
    } catch (error) {
      // If validation fails, mark as invalid
      folderResults.push({
        folderPath: folder.path,
        contextFile: folder.contextFile,
        valid: false,
        result: {
          valid: false,
          errors: 1,
          warnings: 0,
          bundles: 0,
          nodes: 0,
          edges: 0,
          messages: [`Failed to validate: ${(error as Error).message}`],
        },
      });
      totalErrors++;
    }
  }

  const validFolders = folderResults.filter(f => f.valid).length;
  const invalidFolders = folderResults.filter(f => !f.valid).length;
  const valid = invalidFolders === 0 && totalErrors === 0;

  return {
    valid,
    totalFolders: folderResults.length,
    validFolders,
    invalidFolders,
    folders: folderResults,
    totalErrors,
    totalWarnings,
    totalNodes,
    totalEdges,
  };
}

/**
 * Display multi-file validation results
 */
function displayMultiFileValidationResult(result: MultiFileValidationResult): void {
  console.log(`\n${result.valid ? '✅' : '❌'} ${result.valid ? 'All context files are valid' : 'Validation failed'}\n`);

  // Display summary
  console.log('📁 Validation Summary:');
  console.log(`   Total folders: ${result.totalFolders}`);
  console.log(`   ✅ Valid: ${result.validFolders}`);
  if (result.invalidFolders > 0) {
    console.log(`   ❌ Invalid: ${result.invalidFolders}`);
  }
  console.log(`   Total errors: ${result.totalErrors}`);
  console.log(`   Total warnings: ${result.totalWarnings}`);
  console.log(`   Total nodes: ${result.totalNodes}`);
  console.log(`   Total edges: ${result.totalEdges}`);
  console.log();

  // Display detailed results for each folder
  console.log('📂 Folder Details:\n');

  for (const folder of result.folders) {
    if (folder.valid) {
      console.log(`   ✅ VALID: ${folder.contextFile}`);
      console.log(`      Path: ${folder.folderPath}`);
      console.log(`      Bundles: ${folder.result.bundles}, Nodes: ${folder.result.nodes}, Edges: ${folder.result.edges}`);
      if (folder.result.warnings > 0) {
        console.log(`      Warnings: ${folder.result.warnings}`);
        folder.result.messages.forEach(msg => console.log(`        ⚠️  ${msg}`));
      }
    } else {
      console.log(`   ❌ INVALID: ${folder.contextFile}`);
      console.log(`      Path: ${folder.folderPath}`);
      console.log(`      Errors: ${folder.result.errors}`);
      folder.result.messages.forEach(msg => console.log(`        ❌ ${msg}`));
    }
    console.log();
  }
}

/**
 * Validate a context.json file for basic structural validity
 *
 * With no arguments: Validates all context files using context_main.json (multi-file mode)
 * With a file argument: Validates that specific file (single-file mode)
 */
export async function validateCommand(filePath?: string): Promise<void> {
  // If no file specified, check for multi-file mode (context_main.json)
  if (!filePath) {
    const mainIndexPath = resolve('context_main.json');

    try {
      // Try to read context_main.json
      await readFile(mainIndexPath, 'utf8');

      // Multi-file mode - validate all context files
      console.log(`🔍 Validating all context files using "${displayPath(mainIndexPath)}"...\n`);

      try {
        const result = await multiFileValidate(mainIndexPath);
        displayMultiFileValidationResult(result);

        if (result.valid) {
          process.exit(0);
        } else {
          process.exit(1);
        }
      } catch (error) {
        console.error(`❌ Multi-file validation failed: ${(error as Error).message}`);
        process.exit(1);
      }
    } catch {
      // context_main.json doesn't exist, fall back to single-file mode with context.json
      console.log('ℹ️  context_main.json not found, falling back to single-file mode\n');
    }
  }

  // Single-file mode
  const targetFile = filePath || 'context.json';

  try {
    const path = resolve(targetFile);
    console.log(`🔍 Validating "${displayPath(path)}"...`);

    const content = await readFile(path, 'utf8');
    const bundles = JSON.parse(content) as LogicStampBundle[];

    // Basic validation
    if (!Array.isArray(bundles)) {
      console.error('❌ Invalid format: expected array of bundles');
      process.exit(1);
    }

    let errors = 0;
    let warnings = 0;

    for (let i = 0; i < bundles.length; i++) {
      const bundle = bundles[i];
      const bundleLabel = `Bundle ${i + 1}`;

      // Check required fields
      if (bundle.type !== 'LogicStampBundle') {
        console.error(`❌ ${bundleLabel}: Invalid type (expected 'LogicStampBundle', got '${bundle.type}')`);
        errors++;
      }

      if (bundle.schemaVersion !== '0.1') {
        console.error(`❌ ${bundleLabel}: Invalid schemaVersion (expected '0.1', got '${bundle.schemaVersion}')`);
        errors++;
      }

      if (!bundle.entryId) {
        console.error(`❌ ${bundleLabel}: Missing entryId`);
        errors++;
      }

      if (!bundle.graph || !Array.isArray(bundle.graph.nodes) || !Array.isArray(bundle.graph.edges)) {
        console.error(`❌ ${bundleLabel}: Invalid graph structure`);
        errors++;
      }

      if (!bundle.meta || !Array.isArray(bundle.meta.missing)) {
        console.error(`❌ ${bundleLabel}: Invalid meta structure`);
        errors++;
      }

      // Validate contracts
      if (bundle.graph && bundle.graph.nodes) {
        for (const node of bundle.graph.nodes) {
          const contract = node.contract;
          if (contract?.type !== 'UIFContract') {
            console.error(`❌ ${bundleLabel}: Node ${node.entryId} has invalid contract type`);
            errors++;
          }
          if (contract?.schemaVersion !== '0.3') {
            console.warn(`⚠️  ${bundleLabel}: Node ${node.entryId} has unexpected contract version ${contract?.schemaVersion}`);
            warnings++;
          }
        }
      }

      // Check hash format (bundle hashes use uifb: prefix)
      if (bundle.bundleHash && !bundle.bundleHash.match(/^uifb:[a-f0-9]{24}$/)) {
        console.warn(`⚠️  ${bundleLabel}: bundleHash has unexpected format`);
        warnings++;
      }
    }

    if (errors === 0 && warnings === 0) {
      console.log(`✅ Valid context file with ${bundles.length} bundle(s)`);
      console.log(`   Total nodes: ${bundles.reduce((sum, b) => sum + (b.graph?.nodes?.length || 0), 0)}`);
      console.log(`   Total edges: ${bundles.reduce((sum, b) => sum + (b.graph?.edges?.length || 0), 0)}`);
      process.exit(0);
    } else if (errors === 0) {
      console.log(`✅ Valid with ${warnings} warning(s)`);
      process.exit(0);
    } else {
      console.error(`\n❌ Validation failed: ${errors} error(s), ${warnings} warning(s)`);
      process.exit(1);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`❌ File not found: ${targetFile}`);
      if (!filePath) {
        console.error('   Tip: Specify a file path or ensure context.json exists in the current directory');
      }
    } else if (error instanceof SyntaxError) {
      console.error(`❌ Invalid JSON: ${error.message}`);
    } else {
      console.error(`❌ Validation failed: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}
