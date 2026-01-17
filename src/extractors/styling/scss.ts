/**
 * SCSS/CSS module extractor - Parses style files and extracts metadata
 * Uses css-tree AST parser for robust CSS parsing (consistent with ts-morph for TS/TSX)
 */

import { SourceFile } from 'ts-morph';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { parse, walk } from 'css-tree';
import type { CssNode } from 'css-tree';
import { debugError } from '../../utils/debug.js';

/**
 * Parse SCSS/CSS file content to extract style information using css-tree AST parser
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
    let content = await readFile(absolutePath, 'utf-8');

    // Preprocess SCSS // comments to /* */ comments for css-tree compatibility
    // css-tree is a CSS parser and doesn't support SCSS // comments
    // Convert // comments to /* */ before parsing
    // Match // at start of line or after whitespace (not in strings/URLs)
    content = content.replace(/(^|\s)\/\/[^\n]*/gm, (match, prefix) => {
      // Convert // comment to /* */ comment, preserving leading whitespace
      const commentText = match.slice(prefix.length + 2).trim();
      return `${prefix}/* ${commentText} */`;
    });

    // Parse CSS using css-tree (handles CSS and most SCSS syntax)
    // Note: css-tree may not parse all SCSS features perfectly, but handles most cases
    const ast = parse(content, {
      parseAtrulePrelude: true,
      parseRulePrelude: true,
      parseValue: false, // We don't need to parse values, just structure
      positions: false, // We don't need position info
    });

    const selectors = new Set<string>();
    const properties = new Set<string>();
    let hasNesting = false;
    let hasMixins = false;

    // Valid HTML element names for type selectors
    const validElements = new Set([
      'div', 'span', 'p', 'a', 'button', 'input', 'form', 'label',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'dl',
      'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td',
      'th', 'img', 'svg', 'path', 'circle', 'rect', 'line', 'polyline',
      'polygon', 'g', 'defs', 'use', 'symbol', 'mask', 'clipPath',
      'section', 'article', 'aside', 'nav', 'header', 'footer', 'main',
      'figure', 'figcaption', 'time', 'mark', 'code', 'pre', 'blockquote',
      'hr', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'small', 'sub', 'sup',
      'select', 'option', 'textarea', 'fieldset', 'legend', 'datalist',
      'output', 'progress', 'meter', 'details', 'summary', 'dialog',
      'menu', 'menuitem', 'canvas', 'audio', 'video', 'source', 'track',
      'embed', 'object', 'param', 'iframe', 'picture',
      'template', 'slot', 'script', 'noscript', 'style', 'link', 'meta',
      'title', 'head', 'body', 'html',
    ]);

    // File extensions to filter out (might appear in URLs)
    const fileExtensions = new Set([
      '.css', '.scss', '.sass', '.less', '.styl',
      '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
      '.woff', '.woff2', '.ttf', '.otf', '.eot',
      '.js', '.jsx', '.ts', '.tsx', '.json', '.xml', '.html', '.htm',
      '.pdf', '.zip', '.mp4', '.mp3', '.wav', '.mov', '.avi'
    ]);

    // Walk the AST to extract selectors and properties
    // Note: walk() recursively traverses the entire tree, so it automatically
    // handles rules inside @media queries, @supports, @container, and other @ rules
    walk(ast, (node: CssNode) => {
      // Extract selectors from Rule nodes (including rules inside @media, @supports, etc.)
      if (node.type === 'Rule') {
        const rule = node as any; // css-tree types may not be fully typed
        if (rule.prelude && rule.prelude.type === 'SelectorList') {
          // Walk through each selector in the selector list
          walk(rule.prelude, (selectorNode: CssNode) => {
            // Class selectors (.btn, .btn-primary, etc.)
            if (selectorNode.type === 'ClassSelector') {
              const classSel = selectorNode as any;
              const name = classSel.name;
              if (name && typeof name === 'string') {
                // Skip file extensions
                const selector = `.${name}`;
                if (!fileExtensions.has(selector.toLowerCase()) && !/^\.\d+$/.test(selector)) {
                  selectors.add(selector);
                }
              }
            }
            // ID selectors (#header, #main, etc.)
            else if (selectorNode.type === 'IdSelector') {
              const idSel = selectorNode as any;
              const name = idSel.name;
              if (name && typeof name === 'string') {
                selectors.add(`#${name}`);
              }
            }
            // Type selectors (element names like div, p, etc.)
            else if (selectorNode.type === 'TypeSelector') {
              const typeSel = selectorNode as any;
              const name = typeSel.name;
              if (name && typeof name === 'string' && validElements.has(name.toLowerCase())) {
                selectors.add(name.toLowerCase());
              }
            }
          });
        }

        // Extract properties from Declaration nodes within the rule
        if (rule.block && rule.block.type === 'Block') {
          walk(rule.block, (blockNode: CssNode) => {
            if (blockNode.type === 'Declaration') {
              const decl = blockNode as any;
              const property = decl.property;
              if (property && typeof property === 'string') {
                // Skip SCSS variables and at-rules
                if (!property.startsWith('$') && !property.startsWith('@')) {
                  // Only add valid CSS property names
                  if (/^[a-z][a-z0-9-]*$/i.test(property)) {
                    properties.add(property);
                  }
                }
              }
            }
          });
        }
      }
      // Detect @mixin (SCSS feature)
      else if (node.type === 'Atrule') {
        const atrule = node as any;
        if (atrule.name === 'mixin') {
          hasMixins = true;
        }
      }
    });

    // Check for SCSS features using regex (css-tree may not parse all SCSS syntax)
    const hasVariables = /\$[\w-]+\s*:/.test(content);
    // Check for nesting (indented & for nested selectors)
    if (!hasNesting) {
      hasNesting = /\s{2,}&/.test(content);
    }

    return {
      selectors: Array.from(selectors).sort().slice(0, 20),
      properties: Array.from(properties).sort().slice(0, 20),
      hasVariables,
      hasNesting,
      hasMixins,
    };
  } catch (error) {
    // If css-tree fails to parse (e.g., invalid CSS/SCSS), fall back gracefully
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

