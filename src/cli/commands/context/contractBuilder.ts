/**
 * Contract Builder Helper - Builds contracts from files
 */

import { buildContract } from '../../../core/contractBuilder.js';
import { extractFromFile } from '../../../core/astParser.js';
import { extractStyleMetadata } from '../../../core/styleExtractor.js';
import { readFileWithText } from '../../../utils/fsx.js';
import type { UIFContract } from '../../../types/UIFContract.js';
import { Project } from 'ts-morph';

export interface BuildContractsResult {
  contracts: UIFContract[];
  analyzed: number;
  totalSourceSize: number;
}

/**
 * Build contracts from files
 */
export async function buildContractsFromFiles(
  files: string[],
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
      // Extract AST from file
      const ast = await extractFromFile(file);

      // Build contract from AST
      const { text } = await readFileWithText(file);
      totalSourceSize += text.length; // Accumulate source size

      // Extract style metadata if requested (separate layer)
      let styleMetadata;
      if (options.includeStyle && styleProject) {
        try {
          const sourceFile = styleProject.addSourceFileAtPath(file);
          styleMetadata = await extractStyleMetadata(sourceFile, file);
        } catch (styleError) {
          // Style extraction is optional - don't fail if it errors
          if (!options.quiet) {
            console.warn(`   ⚠️  Style extraction failed for ${file}`);
          }
        }
      }

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

