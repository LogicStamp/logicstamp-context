/**
 * SCSS/CSS module extractor - Parses style files and extracts metadata
 */

import { SourceFile } from 'ts-morph';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { debugError } from '../../utils/debug.js';

/**
 * Parse SCSS/CSS file content to extract style information
 */
export async function parseStyleFile(filePath: string, importPath: string): Promise<{
  selectors: string[];
  properties: string[];
  hasVariables: boolean;
  hasNesting: boolean;
  hasMixins: boolean;
}> {
  try {
    const absolutePath = resolve(dirname(filePath), importPath);
    const content = await readFile(absolutePath, 'utf-8');

    // Extract CSS selectors
    const selectorMatches = content.matchAll(/([.#][\w-]+|\w+)(?:\s*\{|,)/g);
    const selectors = new Set<string>();
    for (const match of selectorMatches) {
      if (match[1]) selectors.add(match[1]);
    }

    // Extract CSS properties
    const propertyMatches = content.matchAll(/([\w-]+)\s*:/g);
    const properties = new Set<string>();
    for (const match of propertyMatches) {
      if (match[1] && !match[1].startsWith('$') && !match[1].startsWith('@')) {
        properties.add(match[1]);
      }
    }

    // Check for SCSS features
    const hasVariables = /\$[\w-]+\s*:/.test(content);
    const hasNesting = /\s{2,}&/.test(content); // Indented & for nested selectors
    const hasMixins = /@mixin\s+\w+/.test(content);

    return {
      selectors: Array.from(selectors).sort().slice(0, 20),
      properties: Array.from(properties).sort().slice(0, 20),
      hasVariables,
      hasNesting,
      hasMixins,
    };
  } catch (error) {
    debugError('scss', 'parseStyleFile', {
      filePath,
      importPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      selectors: [],
      properties: [],
      hasVariables: false,
      hasNesting: false,
      hasMixins: false,
    };
  }
}

/**
 * Extract SCSS module metadata from source file
 */
export async function extractScssMetadata(source: SourceFile, filePath: string): Promise<{
  scssModule?: string;
  scssDetails?: {
    selectors: string[];
    properties: string[];
    features: {
      variables?: boolean;
      nesting?: boolean;
      mixins?: boolean;
    };
  };
}> {
  try {
    const result: {
      scssModule?: string;
      scssDetails?: {
        selectors: string[];
        properties: string[];
        features: {
          variables?: boolean;
          nesting?: boolean;
          mixins?: boolean;
        };
      };
    } = {};

    // Check for SCSS module imports and parse them
    const scssModuleImport = source.getImportDeclarations().find(imp => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      return moduleSpecifier.endsWith('.module.scss') || moduleSpecifier.endsWith('.scss');
    });

    if (scssModuleImport) {
      const moduleSpecifier = scssModuleImport.getModuleSpecifierValue();
      result.scssModule = moduleSpecifier;

      // Parse the SCSS file for detailed information
      const scssInfo = await parseStyleFile(filePath, moduleSpecifier);
      if (scssInfo.selectors.length > 0 || scssInfo.properties.length > 0) {
        result.scssDetails = {
          selectors: scssInfo.selectors,
          properties: scssInfo.properties,
          features: {
            ...(scssInfo.hasVariables && { variables: true }),
            ...(scssInfo.hasNesting && { nesting: true }),
            ...(scssInfo.hasMixins && { mixins: true }),
          },
        };
      }
    }

    return result;
  } catch (error) {
    debugError('scss', 'extractScssMetadata', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

