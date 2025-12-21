/**
 * Contract Builder Helper - Builds contracts from files
 */

import { buildContract } from '../../../core/contractBuilder.js';
import { extractFromFile } from '../../../core/astParser.js';
import { extractStyleMetadata } from '../../../core/styleExtractor.js';
import { readFileWithText } from '../../../utils/fsx.js';
import type { UIFContract } from '../../../types/UIFContract.js';
import { Project } from 'ts-morph';
import { join, isAbsolute } from 'node:path';

export interface BuildContractsResult {
  contracts: UIFContract[];
  analyzed: number;
  totalSourceSize: number;
}

/**
 * Build contracts from files
 * @param files - Array of file paths (relative to projectRoot)
 * @param projectRoot - Project root directory for resolving relative paths
 * @param options - Build options
 */
export async function buildContractsFromFiles(
  files: string[],
  projectRoot: string,
  options: {
    includeStyle?: boolean;
    predictBehavior: boolean;
    quiet?: boolean;
  }
): Promise<BuildContractsResult> {
  const contracts: UIFContract[] = [];
  let analyzed = 0;
  let totalSourceSize = 0;

  // Create ts-morph project for style extraction if needed
  let styleProject: Project | undefined;
  if (options.includeStyle) {
    styleProject = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        jsx: 1, // React JSX
        target: 99, // ESNext
      },
    });
  }

  for (const file of files) {
    try {
      // Resolve relative path to absolute for file operations
      const absoluteFilePath = isAbsolute(file) ? file : join(projectRoot, file);
      
      // Extract AST from file
      const ast = await extractFromFile(absoluteFilePath);

      // Build contract from AST
      const { text } = await readFileWithText(absoluteFilePath);
      totalSourceSize += text.length; // Accumulate source size

      // Extract style metadata if requested (separate layer)
      let styleMetadata;
      if (options.includeStyle && styleProject) {
        try {
          const sourceFile = styleProject.addSourceFileAtPath(absoluteFilePath);
          styleMetadata = await extractStyleMetadata(sourceFile, absoluteFilePath);
        } catch (styleError) {
          // Style extraction is optional - don't fail if it errors
          if (!options.quiet) {
            console.warn(`   ⚠️  Style extraction failed for ${file}`);
          }
        }
      }

      // Use relative path for contract entryId (file is relative)
      const result = buildContract(file, ast, {
        preset: 'none',
        sourceText: text,
        enablePredictions: options.predictBehavior,
        styleMetadata,
      });

      if (result.contract) {
        contracts.push(result.contract);
        analyzed++;
      }
    } catch (error) {
      // Skip files that can't be analyzed
      if (!options.quiet) {
        console.warn(`   ⚠️  Skipped ${file}: ${(error as Error).message}`);
      }
    }
  }

  return {
    contracts,
    analyzed,
    totalSourceSize,
  };
}

