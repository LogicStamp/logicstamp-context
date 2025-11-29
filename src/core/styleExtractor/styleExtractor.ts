/**
 * Style Extractor - Main coordination logic
 * Orchestrates extraction of style metadata from React/TypeScript components
 */

import { SourceFile } from 'ts-morph';
import type { StyleMetadata, StyleSources } from '../../types/UIFContract.js';
import { extractTailwindClasses, categorizeTailwindClasses, extractBreakpoints } from './tailwind.js';
import { extractScssMetadata, parseStyleFile } from './scss.js';
import { extractStyledComponents } from './styled.js';
import { extractMotionConfig, extractAnimationMetadata } from './motion.js';
import { extractLayoutMetadata, extractVisualMetadata } from './layout.js';
import { extractMaterialUI } from './material.js';

/**
 * Extract style metadata from a source file
 */
export async function extractStyleMetadata(source: SourceFile, filePath: string): Promise<StyleMetadata | undefined> {
  const styleSources = await extractStyleSources(source, filePath);
  const layout = extractLayoutMetadata(source);
  const visual = extractVisualMetadata(source);
  const animation = extractAnimationMetadata(source);

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
}

/**
 * Extract style sources (SCSS modules, Tailwind, inline styles, etc.)
 */
async function extractStyleSources(source: SourceFile, filePath: string): Promise<StyleSources> {
  const sources: StyleSources = {};
  const sourceText = source.getFullText();

  // Extract SCSS module metadata
  const scssMetadata = await extractScssMetadata(source, filePath);
  if (scssMetadata.scssModule) {
    sources.scssModule = scssMetadata.scssModule;
    if (scssMetadata.scssDetails) {
      sources.scssDetails = scssMetadata.scssDetails;
    }
  }

  // Check for CSS module imports and parse them
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

  // Extract Tailwind classes
  const allClasses = extractTailwindClasses(sourceText);
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

  // Check for inline styles
  const hasInlineStyles = /style\s*=\s*\{\{/.test(sourceText);
  if (hasInlineStyles) {
    sources.inlineStyles = true;
  }

  // Check for styled-components/emotion
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

  // Check for framer-motion
  const hasMotion = source.getImportDeclarations().some(imp => {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    return moduleSpecifier === 'framer-motion';
  });

  if (hasMotion || /motion\.\w+/.test(sourceText)) {
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

  // Check for Material UI
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

  return sources;
}

