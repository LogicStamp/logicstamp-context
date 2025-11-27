/**
 * Style Extractor - Extracts style metadata from React/TypeScript components
 * Analyzes Tailwind, CSS modules, inline styles, styled-components, and framer-motion usage
 */

import { SourceFile } from 'ts-morph';
import type { StyleMetadata, StyleSources, LayoutMetadata, VisualMetadata, AnimationMetadata } from '../types/UIFContract.js';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

/**
 * Tailwind utility class categories for semantic grouping
 */
const TAILWIND_CATEGORIES = {
  layout: /^(flex|grid|block|inline|hidden|container|box-|aspect-|columns-|break-)/,
  spacing: /^(p-|m-|px-|py-|mx-|my-|pt-|pb-|pl-|pr-|mt-|mb-|ml-|mr-|space-|gap-)/,
  sizing: /^(w-|h-|min-w-|min-h-|max-w-|max-h-|size-)/,
  typography: /^(text-|font-|leading-|tracking-|antialiased|subpixel|italic|not-italic|uppercase|lowercase|capitalize|normal-case|truncate|whitespace-)/,
  colors: /^(bg-|text-|border-|ring-|outline-|shadow-|from-|via-|to-|decoration-)/,
  borders: /^(border-|rounded-|ring-|divide-)/,
  effects: /^(shadow-|opacity-|mix-|backdrop-|blur-|brightness-|contrast-|grayscale|hue-|invert|saturate|sepia)/,
  transitions: /^(transition-|duration-|ease-|delay-|animate-)/,
  transforms: /^(scale-|rotate-|translate-|skew-|origin-)/,
  interactivity: /^(cursor-|select-|pointer-events-|resize-|scroll-|touch-|will-)/,
  svg: /^(fill-|stroke-)/,
};

/**
 * Extract all className attributes from JSX
 */
function extractClassNames(sourceText: string): string[] {
  const classNames: string[] = [];

  // Match className="..." or className='...' or className={...}
  const patterns = [
    /className\s*=\s*"([^"]*)"/g,
    /className\s*=\s*'([^']*)'/g,
    /className\s*=\s*`([^`]*)`/g,
  ];

  for (const pattern of patterns) {
    for (const match of sourceText.matchAll(pattern)) {
      if (match[1]) {
        // Split by whitespace and filter empty strings
        const classes = match[1].split(/\s+/).filter(Boolean);
        classNames.push(...classes);
      }
    }
  }

  return classNames;
}

/**
 * Categorize Tailwind utility classes
 */
function categorizeTailwindClasses(classes: string[]): Record<string, Set<string>> {
  const categorized: Record<string, Set<string>> = {};

  for (const className of classes) {
    // Remove responsive prefixes (sm:, md:, lg:, etc.) for categorization
    const baseClass = className.replace(/^(sm|md|lg|xl|2xl|max-sm|max-md|max-lg|max-xl|max-2xl|hover|focus|active|disabled|group-hover|peer-focus|dark):/, '');

    let matchedCategory = false;
    for (const [category, pattern] of Object.entries(TAILWIND_CATEGORIES)) {
      if (pattern.test(baseClass)) {
        if (!categorized[category]) {
          categorized[category] = new Set();
        }
        categorized[category].add(className);
        matchedCategory = true;
        break;
      }
    }

    // Catch-all for uncategorized utilities
    if (!matchedCategory) {
      if (!categorized['other']) {
        categorized['other'] = new Set();
      }
      categorized['other'].add(className);
    }
  }

  return categorized;
}

/**
 * Extract responsive breakpoints used in the component
 */
function extractBreakpoints(classes: string[]): string[] {
  const breakpoints = new Set<string>();
  const breakpointPattern = /^(sm|md|lg|xl|2xl|max-sm|max-md|max-lg|max-xl|max-2xl):/;

  for (const className of classes) {
    const match = className.match(breakpointPattern);
    if (match) {
      breakpoints.add(match[1]);
    }
  }

  return Array.from(breakpoints).sort();
}

/**
 * Parse SCSS/CSS file content to extract style information
 */
async function parseStyleFile(filePath: string, importPath: string): Promise<{
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
    // File not found or can't be read
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
 * Extract styled-components/emotion styled declarations
 */
function extractStyledComponents(source: SourceFile): {
  components: string[];
  hasTheme: boolean;
  hasCssProps: boolean;
} {
  const sourceText = source.getFullText();
  const components = new Set<string>();

  // Match styled.div`...` or styled(Component)`...` patterns
  const styledPatterns = [
    /styled\.(\w+)`/g,
    /styled\((\w+)\)`/g,
  ];

  for (const pattern of styledPatterns) {
    for (const match of sourceText.matchAll(pattern)) {
      if (match[1]) components.add(match[1]);
    }
  }

  // Check for theme usage
  const hasTheme = /\$\{.*theme\./.test(sourceText) || /useTheme\(\)/.test(sourceText);

  // Check for css prop usage
  const hasCssProps = /css\s*=\s*\{/.test(sourceText) || /css`/.test(sourceText);

  return {
    components: Array.from(components).sort().slice(0, 10),
    hasTheme,
    hasCssProps,
  };
}

/**
 * Extract Framer Motion animation configurations
 */
function extractMotionConfig(source: SourceFile): {
  components: string[];
  variants: string[];
  hasGestures: boolean;
  hasLayout: boolean;
  hasViewport: boolean;
} {
  const sourceText = source.getFullText();

  // Extract motion components (motion.div, motion.button, etc.)
  const motionComponentMatches = sourceText.matchAll(/motion\.(\w+)/g);
  const components = new Set<string>();
  for (const match of motionComponentMatches) {
    if (match[1]) components.add(match[1]);
  }

  // Extract variant names
  const variantMatches = sourceText.matchAll(/variants\s*=\s*\{\s*(\w+)/g);
  const variants = new Set<string>();
  for (const match of variantMatches) {
    if (match[1]) variants.add(match[1]);
  }

  // Check for gesture handlers
  const hasGestures = /while(Hover|Tap|Drag|Focus|InView)\s*=/.test(sourceText) ||
                     /on(Tap|Pan|Drag|Hover)(Start|End)?\s*=/.test(sourceText);

  // Check for layout animations
  const hasLayout = /layout(?:Id)?\s*=/.test(sourceText);

  // Check for viewport animations
  const hasViewport = /useInView|viewport\s*=\s*\{/.test(sourceText);

  return {
    components: Array.from(components).sort(),
    variants: Array.from(variants).sort(),
    hasGestures,
    hasLayout,
    hasViewport,
  };
}

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

  // Check for SCSS module imports and parse them
  const scssModuleImport = source.getImportDeclarations().find(imp => {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    return moduleSpecifier.endsWith('.module.scss') || moduleSpecifier.endsWith('.scss');
  });

  if (scssModuleImport) {
    const moduleSpecifier = scssModuleImport.getModuleSpecifierValue();
    sources.scssModule = moduleSpecifier;

    // Parse the SCSS file for detailed information
    const scssInfo = await parseStyleFile(filePath, moduleSpecifier);
    if (scssInfo.selectors.length > 0 || scssInfo.properties.length > 0) {
      sources.scssDetails = {
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
  const allClasses = extractClassNames(sourceText);
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

  return sources;
}

/**
 * Extract layout metadata from JSX
 */
function extractLayoutMetadata(source: SourceFile): LayoutMetadata {
  const layout: LayoutMetadata = {};
  const sourceText = source.getFullText();

  // Check for flex layout
  const hasFlex = /className\s*=\s*["'`][^"'`]*flex[^"'`]*["'`]/.test(sourceText);
  if (hasFlex) {
    layout.type = 'flex';
  }

  // Check for grid layout
  const hasGrid = /className\s*=\s*["'`][^"'`]*grid[^"'`]*["'`]/.test(sourceText);
  if (hasGrid) {
    layout.type = 'grid';

    // Extract grid columns pattern (e.g., "grid-cols-2 md:grid-cols-3")
    const gridColsMatch = sourceText.match(/grid-cols-(\d+(?:\s+\w+:grid-cols-\d+)*)/);
    if (gridColsMatch) {
      layout.cols = gridColsMatch[1];
    }
  }

  // Detect hero pattern (large text + CTA buttons)
  const hasHeroPattern = /className\s*=\s*["'`][^"'`]*text-[4-9]xl[^"'`]*["'`]/.test(sourceText) &&
    /<button/i.test(sourceText);
  if (hasHeroPattern) {
    layout.hasHeroPattern = true;
  }

  // Detect feature cards (grid with card-like elements)
  const hasFeatureCards = hasGrid && /<div[^>]*className\s*=\s*["'`][^"'`]*(card|rounded|shadow)[^"'`]*["'`]/i.test(sourceText);
  if (hasFeatureCards) {
    layout.hasFeatureCards = true;
  }

  return layout;
}

/**
 * Extract visual metadata (colors, spacing, typography, etc.)
 */
function extractVisualMetadata(source: SourceFile): VisualMetadata {
  const visual: VisualMetadata = {};
  const sourceText = source.getFullText();

  // Extract unique color classes (sorted for determinism)
  const colorMatches = sourceText.matchAll(/(?:bg-|text-|border-)(\w+-\d+|\w+)/g);
  const colors = new Set<string>();
  for (const match of colorMatches) {
    colors.add(match[0]);
  }
  if (colors.size > 0) {
    visual.colors = Array.from(colors).sort().slice(0, 10); // Sort for determinism, limit to top 10
  }

  // Extract spacing patterns (sorted for determinism)
  const spacingMatches = sourceText.matchAll(/(?:p-|m-|px-|py-|mx-|my-|pt-|pb-|pl-|pr-|mt-|mb-|ml-|mr-)(\d+)/g);
  const spacing = new Set<string>();
  for (const match of spacingMatches) {
    spacing.add(match[0]);
  }
  if (spacing.size > 0) {
    visual.spacing = Array.from(spacing).sort().slice(0, 10); // Sort for determinism, limit to top 10
  }

  // Extract border radius (find most common pattern for determinism)
  const radiusMatches = sourceText.matchAll(/rounded(-\w+)?/g);
  const radiusFreq = new Map<string, number>();
  for (const match of radiusMatches) {
    const radius = match[1] ? match[1].substring(1) : 'default';
    radiusFreq.set(radius, (radiusFreq.get(radius) || 0) + 1);
  }
  if (radiusFreq.size > 0) {
    // Use most common radius, with stable tiebreaker (alphabetical)
    const sortedByFreq = Array.from(radiusFreq.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    visual.radius = sortedByFreq[0][0];
  }

  // Extract typography classes (sorted for determinism)
  const typographyMatches = sourceText.matchAll(/(?:text-|font-)(\w+)/g);
  const typography = new Set<string>();
  for (const match of typographyMatches) {
    typography.add(match[0]);
  }
  if (typography.size > 0) {
    visual.typography = Array.from(typography).sort().slice(0, 10); // Sort for determinism, limit to top 10
  }

  return visual;
}

/**
 * Extract animation metadata
 */
function extractAnimationMetadata(source: SourceFile): AnimationMetadata {
  const animation: AnimationMetadata = {};
  const sourceText = source.getFullText();

  // Check for framer-motion animations
  const hasFramerMotion = source.getImportDeclarations().some(imp => {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    return moduleSpecifier === 'framer-motion';
  });

  if (hasFramerMotion) {
    animation.library = 'framer-motion';

    // Check for fade-in patterns
    if (/animate\s*=\s*\{\{\s*opacity:\s*1/.test(sourceText)) {
      animation.type = 'fade-in';
    }

    // Check for useInView hook
    if (/useInView/.test(sourceText)) {
      animation.trigger = 'inView';
    }
  }

  // Check for CSS transitions/animations
  if (/transition/.test(sourceText) || /animate-/.test(sourceText)) {
    if (!animation.library) {
      animation.library = 'css';
    }
    if (!animation.type && /animate-/.test(sourceText)) {
      const animateMatch = sourceText.match(/animate-(\w+)/);
      if (animateMatch) {
        animation.type = animateMatch[1];
      }
    }
  }

  return animation;
}
