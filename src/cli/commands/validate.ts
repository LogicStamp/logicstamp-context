/**
 * Validate command - Validates context.json files (single or multi-file mode)
 */

import { readFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import type { LogicStampBundle, LogicStampIndex } from '../../core/pack.js';
import { debugError } from '../../utils/debug.js';

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
  let content: string;
  
  try {
    content = await readFile(indexPath, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('validate', 'loadIndex', {
      indexPath,
      message: err.message,
      code: err.code,
    });
    throw new Error(`Failed to load index from ${indexPath}: ${err.code === 'ENOENT' ? 'File not found' : err.message}`);
  }
  
  try {
    const index = JSON.parse(content) as LogicStampIndex;

    if (index.type !== 'LogicStampIndex') {
      throw new Error(`Invalid index file: expected type 'LogicStampIndex', got '${index.type}'`);
    }

    // Backward compatibility: warn about old schema version
    if (index.schemaVersion === '0.1') {
      console.warn(`⚠️  Warning: context_main.json uses schema version 0.1 (legacy format).`);
      console.warn(``);
      console.warn(`   Consider regenerating with "stamp context" to upgrade to version 0.2 (relative paths).`);
      console.warn(``);
      console.warn(`   Optional cleanup: "stamp context clean --all --yes".`);
      console.warn(``);
      console.warn(`   See docs/MIGRATION_0.3.2.md for details.\n`);
    } else if (index.schemaVersion !== '0.2') {
      console.warn(`⚠️  Warning: Unknown schema version "${index.schemaVersion}". Expected '0.1' or '0.2'.`);
    }

    return index;
  } catch (error) {
    const err = error as Error;
    debugError('validate', 'loadIndex', {
      indexPath,
      message: err.message,
    });
    throw new Error(`Failed to load index from ${indexPath}: ${err.message}`);
  }
}

/**
 * Validate a single context file and return results
 */
async function validateContextFile(contextPath: string): Promise<ValidationResult> {
  let content: string;
  
  try {
    content = await readFile(contextPath, 'utf8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    debugError('validate', 'validateContextFile', {
      contextPath,
      message: err.message,
      code: err.code,
    });
    throw new Error(`Failed to read context file "${contextPath}": ${err.code === 'ENOENT' ? 'File not found' : err.message}`);
  }
  
  try {
    const bundles = JSON.parse(content) as LogicStampBundle[];
    return validateBundles(bundles);
  } catch (error) {
    const err = error as Error;
    debugError('validate', 'validateContextFile', {
      contextPath,
      message: err.message,
    });
    throw new Error(`Failed to parse context file "${contextPath}": ${err.message}`);
  }
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
function displayMultiFileValidationResult(result: MultiFileValidationResult, quiet?: boolean): void {
  // In quiet mode, only show status if invalid
  if (quiet && result.valid) {
    return;
  }

  if (!quiet) {
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
  }

  for (const folder of result.folders) {
    if (folder.valid) {
      // In quiet mode, skip valid folders
      if (!quiet) {
        console.log(`   ✅ VALID: ${folder.contextFile}`);
        console.log(`      Path: ${folder.folderPath}`);
        console.log(`      Bundles: ${folder.result.bundles}, Nodes: ${folder.result.nodes}, Edges: ${folder.result.edges}`);
        if (folder.result.warnings > 0) {
          console.log(`      Warnings: ${folder.result.warnings}`);
          folder.result.messages.forEach(msg => console.log(`        ⚠️  ${msg}`));
        }
        console.log();
      }
    } else {
      // Always show invalid folders (errors)
      console.log(`   ❌ INVALID: ${folder.contextFile}`);
      console.log(`      Path: ${folder.folderPath}`);
      console.log(`      Errors: ${folder.result.errors}`);
      folder.result.messages.forEach(msg => console.log(`        ❌ ${msg}`));
      console.log();
    }
  }
}

/**
 * Validate a context.json file for basic structural validity
 *
 * With no arguments: Validates all context files using context_main.json (multi-file mode)
 * With a file argument: Validates that specific file (single-file mode)
 */
export async function validateCommand(filePath?: string, quiet?: boolean): Promise<void> {
  // If no file specified, check for multi-file mode (context_main.json)
  if (!filePath) {
    const mainIndexPath = resolve('context_main.json');

    try {
      // Try to read context_main.json
      try {
        await readFile(mainIndexPath, 'utf8');
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        // Only log in debug mode, this is expected to fail sometimes
        debugError('validate', 'validateCommand', {
          mainIndexPath,
          message: err.message,
          code: err.code,
        });
        throw error;
      }

      // Multi-file mode - validate all context files
      if (!quiet) {
        console.log(`🔍 Validating all context files using "${displayPath(mainIndexPath)}"...\n`);
      }

      try {
        const result = await multiFileValidate(mainIndexPath);
        displayMultiFileValidationResult(result, quiet);

        if (result.valid) {
          if (quiet) {
            // Minimal output in quiet mode
            process.stdout.write('✓\n');
          }
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
      if (!quiet) {
        console.log('ℹ️  context_main.json not found, falling back to single-file mode\n');
      }
    }
  }

  // Single-file mode
  const targetFile = filePath || 'context.json';

  try {
    const path = resolve(targetFile);
    if (!quiet) {
      console.log(`🔍 Validating "${displayPath(path)}"...`);
    }

    let content: string;
    try {
      content = await readFile(path, 'utf8');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      debugError('validate', 'validateCommand', {
        path,
        message: err.message,
        code: err.code,
      });
      // Error handling continues below in the catch block
      throw error;
    }
    
    let bundles: LogicStampBundle[];
    try {
      bundles = JSON.parse(content) as LogicStampBundle[];
    } catch (error) {
      const err = error as Error;
      debugError('validate', 'validateCommand', {
        path,
        message: err.message,
      });
      throw error;
    }

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
      if (quiet) {
        // Minimal output in quiet mode
        process.stdout.write('✓\n');
      } else {
        console.log(`✅ Valid context file with ${bundles.length} bundle(s)`);
        console.log(`   Total nodes: ${bundles.reduce((sum, b) => sum + (b.graph?.nodes?.length || 0), 0)}`);
        console.log(`   Total edges: ${bundles.reduce((sum, b) => sum + (b.graph?.edges?.length || 0), 0)}`);
      }
      process.exit(0);
    } else if (errors === 0) {
      if (quiet) {
        // Minimal output in quiet mode
        process.stdout.write('✓\n');
      } else {
        console.log(`✅ Valid with ${warnings} warning(s)`);
      }
      process.exit(0);
    } else {
      // Always show errors, even in quiet mode
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
