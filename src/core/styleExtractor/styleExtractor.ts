/**
 * Style Extractor - Main coordination logic
 * Orchestrates extraction of style metadata from React/TypeScript components
 */

import { SourceFile, SyntaxKind, JsxAttribute } from 'ts-morph';
import type { StyleMetadata, StyleSources } from '../../types/UIFContract.js';
import { debugError } from '../../utils/debug.js';
import { extractTailwindClasses, categorizeTailwindClasses, extractBreakpoints } from './tailwind.js';
import { extractScssMetadata, parseStyleFile } from './scss.js';
import { extractStyledComponents } from './styled.js';
import { extractMotionConfig, extractAnimationMetadata } from './motion.js';
import { extractLayoutMetadata, extractVisualMetadata } from './layout.js';
import { extractMaterialUI } from './material.js';
import { extractShadcnUI } from './shadcn.js';
import { extractRadixUI } from './radix.js';

/**
 * Extract style metadata from a source file
 */
export async function extractStyleMetadata(source: SourceFile, filePath: string): Promise<StyleMetadata | undefined> {
  try {
    const styleSources = await extractStyleSources(source, filePath);
    
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
      Object.keys(styleSources).length === 0 &&
      Object.keys(layout).length === 0 &&
      Object.keys(visual).length === 0 &&
      Object.keys(animation).length === 0
    ) {
      return undefined;
    }

    return {
      ...(Object.keys(styleSources).length > 0 && { styleSources }),
      ...(Object.keys(layout).length > 0 && { layout }),
      ...(Object.keys(visual).length > 0 && { visual }),
      ...(Object.keys(animation).length > 0 && { animation }),
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
 * Extract style sources (SCSS modules, Tailwind, inline styles, etc.)
 */
async function extractStyleSources(source: SourceFile, filePath: string): Promise<StyleSources> {
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
    const cssModuleImport = source.getImportDeclarations().find(imp => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      return moduleSpecifier.endsWith('.module.css') || moduleSpecifier.endsWith('.css');
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
    const hasTailwind = allClasses.some(c =>
      /^(flex|grid|bg-|text-|p-|m-|rounded|shadow|border|w-|h-|hover:|focus:|sm:|md:|lg:|xl:|2xl:)/.test(c)
    );

    if (hasTailwind) {
      const categorized = categorizeTailwindClasses(allClasses);
      const breakpoints = extractBreakpoints(allClasses);

      sources.tailwind = {
        categories: Object.fromEntries(
          Object.entries(categorized).map(([key, set]) => [
            key,
            Array.from(set).sort().slice(0, 15), // Top 15 per category
          ])
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

  // Check for inline styles using AST
  try {
    const hasInlineStyles = source.getDescendantsOfKind(SyntaxKind.JsxAttribute).some(attr => {
      const jsxAttr = attr as JsxAttribute;
      const attrName = jsxAttr.getNameNode().getText();
      if (attrName === 'style') {
        const initializer = jsxAttr.getInitializer();
        if (initializer && initializer.getKind() === SyntaxKind.JsxExpression) {
          return true; // style={...} found
        }
      }
      return false;
    });
    if (hasInlineStyles) {
      sources.inlineStyles = true;
    }
  } catch (error) {
    debugError('styleExtractor', 'extractStyleSources', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      context: 'detectInlineStyles',
    });
  }

  // Check for styled-components/emotion
  try {
    const hasStyledComponents = source.getImportDeclarations().some(imp => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      return moduleSpecifier === 'styled-components' || moduleSpecifier === '@emotion/styled';
    });

    if (hasStyledComponents) {
      const styledInfo = extractStyledComponents(source);
      sources.styledComponents = {
        ...(styledInfo.components.length > 0 && { components: styledInfo.components }),
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
    const hasMotion = source.getImportDeclarations().some(imp => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      return moduleSpecifier === 'framer-motion';
    });

    // Also check for motion.* usage using AST
    let hasMotionUsage = false;
    try {
      hasMotionUsage = source.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some(propAccess => {
        const expression = propAccess.getExpression();
        return expression.getKind() === SyntaxKind.Identifier && expression.getText() === 'motion';
      });
    } catch {
      // If AST traversal fails, continue without motion.* detection
    }

    if (hasMotion || hasMotionUsage) {
      const motionInfo = extractMotionConfig(source);
      sources.motion = {
        ...(motionInfo.components.length > 0 && { components: motionInfo.components }),
        ...(motionInfo.variants.length > 0 && { variants: motionInfo.variants }),
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
    const hasMaterialUI = source.getImportDeclarations().some(imp => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      return /^@mui\//.test(moduleSpecifier) || /^@material-ui\//.test(moduleSpecifier);
    });

    if (hasMaterialUI) {
      const muiInfo = extractMaterialUI(source);
      sources.materialUI = {
        ...(muiInfo.components.length > 0 && { components: muiInfo.components }),
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
    const hasShadcnUI = source.getImportDeclarations().some(imp => {
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
        ...(shadcnInfo.components.length > 0 && { components: shadcnInfo.components }),
        ...(Object.keys(shadcnInfo.variants).length > 0 && { variants: shadcnInfo.variants }),
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
    const hasRadixUI = source.getImportDeclarations().some(imp => {
      const moduleSpecifier = imp.getModuleSpecifierValue();
      return /^@radix-ui\/react-/.test(moduleSpecifier);
    });

    if (hasRadixUI) {
      const radixInfo = extractRadixUI(source);
      sources.radixUI = {
        ...(Object.keys(radixInfo.primitives).length > 0 && { primitives: radixInfo.primitives }),
        ...(radixInfo.patterns.controlled.length > 0 ||
            radixInfo.patterns.uncontrolled.length > 0 ||
            radixInfo.patterns.portals > 0 ||
            radixInfo.patterns.asChild > 0) && { patterns: radixInfo.patterns },
        ...(Object.keys(radixInfo.accessibility).length > 0 && { accessibility: radixInfo.accessibility }),
        ...(radixInfo.features.primitiveCount !== undefined && { features: radixInfo.features }),
      };
    }
  } catch (error) {
    debugError('styleExtractor', 'extractStyleSources', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
      context: 'extractRadixUI',
    });
  }

  return sources;
}

