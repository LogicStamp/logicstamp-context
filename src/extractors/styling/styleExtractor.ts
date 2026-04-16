/**
 * Style Extractor - Main coordination logic
 * Orchestrates extraction of style metadata from TypeScript components
 */

import {
  type SourceFile,
  SyntaxKind,
  type JsxAttribute,
  type JsxExpression,
  type StringLiteral,
  type NoSubstitutionTemplateLiteral,
} from 'ts-morph';
import type {
  StyleMetadata,
  StyleSources,
  StyleMode,
  StyleSummary,
  LayoutMetadata,
  VisualMetadata,
} from '../../types/UIFContract.js';
import { debugError } from '../../utils/debug.js';
import {
  extractTailwindClasses,
  categorizeTailwindClasses,
  extractBreakpoints,
} from './tailwind.js';
import { extractScssMetadata, parseStyleFile } from './scss.js';
import { extractStyledComponents } from './styled.js';
import { extractMotionConfig, extractAnimationMetadata } from './motion.js';
import { extractLayoutMetadata, extractVisualMetadata } from './layout.js';
import { extractMaterialUI } from './material.js';
import { extractShadcnUI } from './shadcn.js';
import { extractRadixUI } from './radix.js';
import { extractStyledJsx } from './styledJsx.js';
import { extractChakraUI } from './chakra.js';
import { extractAntDesign } from './antd.js';

/**
 * Extract style metadata from a source file
 * @param source - The source file to extract from
 * @param filePath - The file path for error reporting
 * @param mode - Style extraction mode: 'lean' (default) or 'full'
 */
export async function extractStyleMetadata(
  source: SourceFile,
  filePath: string,
  mode: StyleMode = 'lean',
): Promise<StyleMetadata | undefined> {
  try {
    const fullStyleSources = await extractStyleSources(source, filePath);

    let layout: ReturnType<typeof extractLayoutMetadata> = {};
    try {
      layout = extractLayoutMetadata(source);
    } catch (error) {
      debugError('styleExtractor', 'extractStyleMetadata', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        context: 'extractLayoutMetadata',
      });
    }

    let visual: ReturnType<typeof extractVisualMetadata> = {};
    try {
      visual = extractVisualMetadata(source);
    } catch (error) {
      debugError('styleExtractor', 'extractStyleMetadata', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        context: 'extractVisualMetadata',
      });
    }

    let animation: ReturnType<typeof extractAnimationMetadata> = {};
    try {
      animation = extractAnimationMetadata(source);
    } catch (error) {
      debugError('styleExtractor', 'extractStyleMetadata', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        context: 'extractAnimationMetadata',
      });
    }

    // Only return metadata if we found any style information
    if (
      Object.keys(fullStyleSources).length === 0 &&
      Object.keys(layout).length === 0 &&
      Object.keys(visual).length === 0 &&
      Object.keys(animation).length === 0
    ) {
      return undefined;
    }

    // Build summary and apply lean transformation if needed
    const summary = buildStyleSummary(fullStyleSources, mode);
    const styleSources =
      mode === 'lean'
        ? transformToLean(fullStyleSources, summary)
        : fullStyleSources;

    // Transform layout and visual in lean mode
    const finalLayout =
      mode === 'lean' ? transformLayoutToLean(layout) : layout;
    const finalVisual =
      mode === 'lean' ? transformVisualToLean(visual) : visual;

    return {
      ...(Object.keys(styleSources).length > 0 && { styleSources }),
      ...(Object.keys(finalLayout).length > 0 && { layout: finalLayout }),
      ...(Object.keys(finalVisual).length > 0 && { visual: finalVisual }),
      ...(Object.keys(animation).length > 0 && { animation }),
      summary,
    };
  } catch (error) {
    debugError('styleExtractor', 'extractStyleMetadata', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

/**
 * Build style summary from full style sources
 */
function buildStyleSummary(
  styleSources: StyleSources,
  mode: StyleMode,
): StyleSummary {
  const sources: string[] = [];

  if (styleSources.tailwind) sources.push('tailwind');
  if (styleSources.scssModule) sources.push('scss');
  if (styleSources.cssModule) sources.push('css');
  if (styleSources.inlineStyles) sources.push('inline');
  if (styleSources.styledJsx) sources.push('styled-jsx');
  if (styleSources.styledComponents) sources.push('styled-components');
  if (styleSources.motion) sources.push('framer-motion');
  if (styleSources.materialUI) sources.push('material-ui');
  if (styleSources.shadcnUI) sources.push('shadcn');
  if (styleSources.radixUI) sources.push('radix');
  if (styleSources.chakraUI) sources.push('chakra');
  if (styleSources.antd) sources.push('antd');

  const summary: StyleSummary = { mode, sources };

  // Add fullModeBytes only in lean mode to show what full would cost
  if (mode === 'lean' && sources.length > 0) {
    try {
      summary.fullModeBytes = JSON.stringify(styleSources).length;
    } catch {
      // Ignore serialization errors
    }
  }

  return summary;
}

/**
 * Transform full style sources to lean format
 * Drops verbose arrays, keeps counts and flags
 */
function transformToLean(
  fullSources: StyleSources,
  _summary: StyleSummary,
): StyleSources {
  const lean: StyleSources = {};

  // Tailwind: keep classCount + categoriesUsed, drop class arrays
  if (fullSources.tailwind) {
    lean.tailwind = {
      classCount: fullSources.tailwind.classCount,
      categoriesUsed: fullSources.tailwind.categories
        ? Object.keys(fullSources.tailwind.categories)
        : undefined,
      breakpoints: fullSources.tailwind.breakpoints,
    };
  }

  // SCSS: keep import path + features, drop selectors/properties
  if (fullSources.scssModule) {
    lean.scssModule = fullSources.scssModule;
    if (fullSources.scssDetails?.features) {
      lean.scssDetails = { features: fullSources.scssDetails.features };
    }
  }

  // CSS: keep import path only, drop cssDetails entirely
  if (fullSources.cssModule) {
    lean.cssModule = fullSources.cssModule;
  }

  // Inline styles: keep as-is (already compact)
  if (fullSources.inlineStyles) {
    lean.inlineStyles = fullSources.inlineStyles;
  }

  // Styled-jsx: keep selectors/properties count, drop full css
  if (fullSources.styledJsx) {
    lean.styledJsx = {
      global: fullSources.styledJsx.global,
      // Keep counts instead of arrays
      ...(fullSources.styledJsx.selectors && {
        selectorCount: fullSources.styledJsx.selectors.length,
      }),
      ...(fullSources.styledJsx.properties && {
        propertyCount: fullSources.styledJsx.properties.length,
      }),
    };
  }

  // Styled-components: keep as-is (already compact flags)
  if (fullSources.styledComponents) {
    lean.styledComponents = {
      usesTheme: fullSources.styledComponents.usesTheme,
      usesCssProp: fullSources.styledComponents.usesCssProp,
      // Drop components array, keep count
      ...(fullSources.styledComponents.components && {
        componentCount: fullSources.styledComponents.components.length,
      }),
    };
  }

  // Motion: keep features only, drop components/variants arrays
  if (fullSources.motion) {
    lean.motion = {
      features: fullSources.motion.features,
    };
  }

  // Material UI: keep features only, drop components/packages arrays
  if (fullSources.materialUI) {
    lean.materialUI = {
      features: fullSources.materialUI.features,
    };
  }

  // ShadCN: keep features only, drop components/variants/sizes arrays
  if (fullSources.shadcnUI) {
    lean.shadcnUI = {
      features: fullSources.shadcnUI.features,
    };
  }

  // Radix: keep features + accessibility, drop primitives/patterns
  if (fullSources.radixUI) {
    lean.radixUI = {
      ...(fullSources.radixUI.accessibility && {
        accessibility: fullSources.radixUI.accessibility,
      }),
      ...(fullSources.radixUI.features && {
        features: fullSources.radixUI.features,
      }),
    };
  }

  // Chakra: keep features only, drop components/packages arrays
  if (fullSources.chakraUI) {
    lean.chakraUI = {
      features: fullSources.chakraUI.features,
    };
  }

  // Ant Design: keep features only, drop components/packages arrays
  if (fullSources.antd) {
    lean.antd = {
      features: fullSources.antd.features,
    };
  }

  return lean;
}

/**
 * Transform layout metadata to lean format
 */
function transformLayoutToLean(layout: LayoutMetadata): LayoutMetadata {
  if (Object.keys(layout).length === 0) return layout;

  return {
    type: layout.type,
    cols: layout.cols,
    hasHeroPattern: layout.hasHeroPattern,
    hasFeatureCards: layout.hasFeatureCards,
    // Replace sections array with count
    ...(layout.sections && { sectionCount: layout.sections.length }),
  };
}

/**
 * Transform visual metadata to lean format
 */
function transformVisualToLean(visual: VisualMetadata): VisualMetadata {
  if (Object.keys(visual).length === 0) return visual;

  return {
    // Replace arrays with counts
    ...(visual.colors && { colorCount: visual.colors.length }),
    ...(visual.spacing && { spacingCount: visual.spacing.length }),
    radius: visual.radius,
    ...(visual.typography && { typographyCount: visual.typography.length }),
  };
}

/**
 * Extract inline style properties and values from style={{...}} attributes
 */
function extractInlineStyles(
  source: SourceFile,
): { properties: string[]; values?: Record<string, string> } | null {
  const properties = new Set<string>();
  const values: Record<string, string> = {};
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    const jsxAttributes = source.getDescendantsOfKind(SyntaxKind.JsxAttribute);

    for (const attr of jsxAttributes) {
      try {
        const jsxAttr = attr as JsxAttribute;
        const attrName = jsxAttr.getNameNode().getText();

        if (attrName === 'style') {
          const initializer = jsxAttr.getInitializer();
          if (
            initializer &&
            initializer.getKind() === SyntaxKind.JsxExpression
          ) {
            const jsxExpr = initializer as JsxExpression;
            const expr = jsxExpr.getExpression();

            // Handle object literal: style={{ color: 'blue', padding: '1rem' }}
            if (expr && expr.getKind() === SyntaxKind.ObjectLiteralExpression) {
              const objLiteral = expr.asKindOrThrow(
                SyntaxKind.ObjectLiteralExpression,
              );
              const objProperties = objLiteral.getProperties();

              for (const prop of objProperties) {
                if (prop.getKind() === SyntaxKind.PropertyAssignment) {
                  const propAssignment = prop.asKindOrThrow(
                    SyntaxKind.PropertyAssignment,
                  );
                  const nameNode = propAssignment.getNameNode();
                  const initializer = propAssignment.getInitializer();

                  // Extract property name (handles both identifier and string literal)
                  let propName: string | undefined;
                  if (nameNode.getKind() === SyntaxKind.Identifier) {
                    propName = nameNode.getText();
                  } else if (nameNode.getKind() === SyntaxKind.StringLiteral) {
                    propName = (nameNode as StringLiteral).getLiteralText();
                  }

                  if (propName) {
                    properties.add(propName);

                    // Extract property value if it's a literal
                    if (initializer) {
                      const initKind = initializer.getKind();

                      // String literal: 'blue', "1rem"
                      if (initKind === SyntaxKind.StringLiteral) {
                        const value = (
                          initializer as StringLiteral
                        ).getLiteralText();
                        values[propName] = value;
                      }
                      // Numeric literal: 10, 1.5
                      else if (initKind === SyntaxKind.NumericLiteral) {
                        values[propName] = initializer.getText();
                      }
                      // Boolean literal: true, false
                      else if (
                        initKind === SyntaxKind.TrueKeyword ||
                        initKind === SyntaxKind.FalseKeyword
                      ) {
                        values[propName] = initializer.getText();
                      }
                      // Null literal
                      else if (initKind === SyntaxKind.NullKeyword) {
                        values[propName] = 'null';
                      }
                      // Template literal (no substitutions): `2s`
                      else if (
                        initKind === SyntaxKind.NoSubstitutionTemplateLiteral
                      ) {
                        const value = (
                          initializer as NoSubstitutionTemplateLiteral
                        ).getLiteralText();
                        values[propName] = value;
                      }
                      // For other expressions (variables, function calls, etc.), we skip the value
                      // but still record the property name
                    }
                  }
                }
              }
            }
            // Handle variable reference: style={myStyles} - we can't extract values statically
            // but we still want to mark that inline styles are used
          }
        }
      } catch (error) {
        debugError('styleExtractor', 'extractInlineStyles', {
          filePath,
          error: error instanceof Error ? error.message : String(error),
          context: 'attribute-iteration',
        });
        // Continue with next attribute
      }
    }
  } catch (error) {
    debugError('styleExtractor', 'extractInlineStyles', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  // Only return object if we found properties
  if (properties.size > 0) {
    return {
      properties: Array.from(properties).sort(),
      ...(Object.keys(values).length > 0 && { values }),
    };
  }

  return null;
}

/**
 * Extract style sources (SCSS modules, Tailwind, inline styles, etc.)
 */
async function extractStyleSources(
  source: SourceFile,
  filePath: string,
): Promise<StyleSources> {
  const sources: StyleSources = {};

  // Extract SCSS module metadata
  try {
    const scssMetadata = await extractScssMetadata(source, filePath);
    if (scssMetadata.scssModule) {
      sources.scssModule = scssMetadata.scssModule;
      if (scssMetadata.scssDetails) {
        sources.scssDetails = scssMetadata.scssDetails;
      }
    }
  } catch (error) {
    debugError('styleExtractor', 'extractStyleSources', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      context: 'extractScssMetadata',
    });
  }

  // Check for CSS module imports and parse them
  try {
    const cssModuleImport = source.getImportDeclarations().find((imp) => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      return (
        moduleSpecifier.endsWith('.module.css') ||
        moduleSpecifier.endsWith('.css')
      );
    });

    if (cssModuleImport) {
      const moduleSpecifier = cssModuleImport.getModuleSpecifierValue();
      sources.cssModule = moduleSpecifier;

      // Parse the CSS file for detailed information
      const cssInfo = await parseStyleFile(filePath, moduleSpecifier);
      if (cssInfo.selectors.length > 0 || cssInfo.properties.length > 0) {
        sources.cssDetails = {
          selectors: cssInfo.selectors,
          properties: cssInfo.properties,
        };
      }
    }
  } catch (error) {
    debugError('styleExtractor', 'extractStyleSources', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      context: 'extractCSSModuleMetadata',
    });
  }

  // Extract Tailwind classes (using AST for better dynamic class support)
  try {
    const allClasses = extractTailwindClasses(source);
    const hasTailwind = allClasses.some((c) =>
      /^(flex|grid|bg-|text-|p-|m-|rounded|shadow|border|w-|h-|hover:|focus:|sm:|md:|lg:|xl:|2xl:)/.test(
        c,
      ),
    );

    if (hasTailwind) {
      const categorized = categorizeTailwindClasses(allClasses);
      const breakpoints = extractBreakpoints(allClasses);

      sources.tailwind = {
        categories: Object.fromEntries(
          Object.entries(categorized).map(([key, set]) => [
            key,
            Array.from(set).sort().slice(0, 15), // Top 15 per category
          ]),
        ),
        ...(breakpoints.length > 0 && { breakpoints }),
        classCount: allClasses.length,
      };
    }
  } catch (error) {
    debugError('styleExtractor', 'extractStyleSources', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      context: 'extractTailwindClasses',
    });
  }

  // Extract inline styles using AST
  try {
    const inlineStylesData = extractInlineStyles(source);
    if (inlineStylesData) {
      sources.inlineStyles = inlineStylesData;
    }
  } catch (error) {
    debugError('styleExtractor', 'extractStyleSources', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      context: 'extractInlineStyles',
    });
  }

  // Extract styled-jsx CSS content
  try {
    const styledJsxData = extractStyledJsx(source);
    if (styledJsxData) {
      sources.styledJsx = styledJsxData;
    }
  } catch (error) {
    debugError('styleExtractor', 'extractStyleSources', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      context: 'extractStyledJsx',
    });
  }

  // Check for styled-components/emotion
  try {
    const hasStyledComponents = source.getImportDeclarations().some((imp) => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      return (
        moduleSpecifier === 'styled-components' ||
        moduleSpecifier === '@emotion/styled'
      );
    });

    if (hasStyledComponents) {
      const styledInfo = extractStyledComponents(source);
      sources.styledComponents = {
        ...(styledInfo.components.length > 0 && {
          components: styledInfo.components,
        }),
        ...(styledInfo.hasTheme && { usesTheme: true }),
        ...(styledInfo.hasCssProps && { usesCssProp: true }),
      };
    }
  } catch (error) {
    debugError('styleExtractor', 'extractStyleSources', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      context: 'extractStyledComponents',
    });
  }

  // Check for framer-motion
  try {
    const hasMotion = source.getImportDeclarations().some((imp) => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      return moduleSpecifier === 'framer-motion';
    });

    // Also check for motion.* usage using AST
    let hasMotionUsage = false;
    try {
      hasMotionUsage = source
        .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        .some((propAccess) => {
          const expression = propAccess.getExpression();
          return (
            expression.getKind() === SyntaxKind.Identifier &&
            expression.getText() === 'motion'
          );
        });
    } catch {
      // If AST traversal fails, continue without motion.* detection
    }

    if (hasMotion || hasMotionUsage) {
      const motionInfo = extractMotionConfig(source);
      sources.motion = {
        ...(motionInfo.components.length > 0 && {
          components: motionInfo.components,
        }),
        ...(motionInfo.variants.length > 0 && {
          variants: motionInfo.variants,
        }),
        features: {
          ...(motionInfo.hasGestures && { gestures: true }),
          ...(motionInfo.hasLayout && { layoutAnimations: true }),
          ...(motionInfo.hasViewport && { viewportAnimations: true }),
        },
      };
    }
  } catch (error) {
    debugError('styleExtractor', 'extractStyleSources', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      context: 'extractFramerMotion',
    });
  }

  // Check for Material UI
  try {
    const hasMaterialUI = source.getImportDeclarations().some((imp) => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      return (
        /^@mui\//.test(moduleSpecifier) ||
        /^@material-ui\//.test(moduleSpecifier)
      );
    });

    if (hasMaterialUI) {
      const muiInfo = extractMaterialUI(source);
      sources.materialUI = {
        ...(muiInfo.components.length > 0 && {
          components: muiInfo.components,
        }),
        ...(muiInfo.packages.length > 0 && { packages: muiInfo.packages }),
        features: muiInfo.features,
      };
    }
  } catch (error) {
    debugError('styleExtractor', 'extractStyleSources', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      context: 'extractMaterialUI',
    });
  }

  // Check for ShadCN/UI
  try {
    const hasShadcnUI = source.getImportDeclarations().some((imp) => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      return (
        /^@\/components\/ui\//.test(moduleSpecifier) ||
        /^~\/components\/ui\//.test(moduleSpecifier) ||
        /^components\/ui\//.test(moduleSpecifier) ||
        /^\.\.?\/.*\/ui\//.test(moduleSpecifier)
      );
    });

    if (hasShadcnUI) {
      const shadcnInfo = extractShadcnUI(source);
      sources.shadcnUI = {
        ...(shadcnInfo.components.length > 0 && {
          components: shadcnInfo.components,
        }),
        ...(Object.keys(shadcnInfo.variants).length > 0 && {
          variants: shadcnInfo.variants,
        }),
        ...(shadcnInfo.sizes.length > 0 && { sizes: shadcnInfo.sizes }),
        features: shadcnInfo.features,
      };
    }
  } catch (error) {
    debugError('styleExtractor', 'extractStyleSources', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      context: 'extractShadcnUI',
    });
  }

  // Check for Radix UI
  try {
    const hasRadixUI = source.getImportDeclarations().some((imp) => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      return /^@radix-ui\/react-/.test(moduleSpecifier);
    });

    if (hasRadixUI) {
      const radixInfo = extractRadixUI(source);
      sources.radixUI = {
        ...(Object.keys(radixInfo.primitives).length > 0 && {
          primitives: radixInfo.primitives,
        }),
        ...((radixInfo.patterns.controlled.length > 0 ||
          radixInfo.patterns.uncontrolled.length > 0 ||
          radixInfo.patterns.portals > 0 ||
          radixInfo.patterns.asChild > 0) && { patterns: radixInfo.patterns }),
        ...(Object.keys(radixInfo.accessibility).length > 0 && {
          accessibility: radixInfo.accessibility,
        }),
        ...(radixInfo.features.primitiveCount !== undefined && {
          features: radixInfo.features,
        }),
      };
    }
  } catch (error) {
    debugError('styleExtractor', 'extractStyleSources', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      context: 'extractRadixUI',
    });
  }

  // Check for Chakra UI
  try {
    const hasChakraUI = source.getImportDeclarations().some((imp) => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      return /^@chakra-ui\//.test(moduleSpecifier);
    });

    if (hasChakraUI) {
      const chakraInfo = extractChakraUI(source);
      sources.chakraUI = {
        ...(chakraInfo.components.length > 0 && {
          components: chakraInfo.components,
        }),
        ...(chakraInfo.packages.length > 0 && {
          packages: chakraInfo.packages,
        }),
        features: chakraInfo.features,
      };
    }
  } catch (error) {
    debugError('styleExtractor', 'extractStyleSources', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      context: 'extractChakraUI',
    });
  }

  // Check for Ant Design
  try {
    const hasAntDesign = source.getImportDeclarations().some((imp) => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      return (
        moduleSpecifier === 'antd' || /^@ant-design\//.test(moduleSpecifier)
      );
    });

    if (hasAntDesign) {
      const antdInfo = extractAntDesign(source);
      sources.antd = {
        ...(antdInfo.components.length > 0 && {
          components: antdInfo.components,
        }),
        ...(antdInfo.packages.length > 0 && { packages: antdInfo.packages }),
        features: antdInfo.features,
      };
    }
  } catch (error) {
    debugError('styleExtractor', 'extractStyleSources', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      context: 'extractAntDesign',
    });
  }

  return sources;
}
