/**
 * Layout and visual metadata extractor - Extracts layout patterns and visual styles
 */

import { SourceFile, SyntaxKind } from 'ts-morph';
import type { LayoutMetadata, VisualMetadata } from '../../types/UIFContract.js';
import { debugError } from '../../utils/debug.js';
import { extractTailwindClasses } from './tailwind.js';

/**
 * Extract the core class name from a Tailwind class, stripping variant prefixes
 * 
 * Examples:
 * - md:flex -> flex
 * - hover:bg-blue-500 -> bg-blue-500
 * - dark:sm:text-xl -> text-xl
 * - flex -> flex (no prefix)
 */
function coreClass(cls: string): string {
  // Tailwind variants: md:flex, hover:bg-blue-500, dark:sm:text-xl, etc.
  const segments = cls.split(':');
  return segments[segments.length - 1] ?? cls;
}

/**
 * Extract layout metadata from JSX (AST-based)
 * 
 * Uses AST to extract Tailwind classes, then analyzes them for layout patterns.
 * This approach correctly handles dynamic className expressions like:
 * - className={cn('flex', 'items-center')}
 * - className={`grid ${cols}`}
 * - className={isActive && 'flex'}
 * 
 * Also handles variant-prefixed classes like md:flex, hover:bg-blue-500, etc.
 */
export function extractLayoutMetadata(source: SourceFile): LayoutMetadata {
  const layout: LayoutMetadata = {};

  try {
    // Extract all Tailwind classes using AST (handles dynamic expressions)
    const allClasses = extractTailwindClasses(source);
    // Normalize to core classes (strip variant prefixes) once for reuse
    const coreClasses = allClasses.map(coreClass);

    // Check for flex layout (handles variant prefixes like md:flex)
    const hasFlex = coreClasses.some(c => c.startsWith('flex'));
    
    // Check for grid layout (handles variant prefixes like lg:grid)
    // Grid takes precedence over flex if both are present
    const hasGrid = coreClasses.some(c => c.startsWith('grid'));
    
    if (hasGrid) {
      layout.type = 'grid';

      // Extract grid columns pattern (e.g., "grid-cols-2", "md:grid-cols-3")
      // Works for both because regex doesn't anchor to start
      const gridColsClasses = allClasses.filter(cls => /grid-cols-\d+/.test(cls));
      if (gridColsClasses.length > 0) {
        // Extract just the column numbers and join them (e.g., "2 3")
        const cols = gridColsClasses
          .map(cls => {
            const match = cls.match(/grid-cols-(\d+)/);
            return match ? match[1] : null;
          })
          .filter((v): v is string => v !== null)
          .join(' ');
        if (cols) {
          layout.cols = cols;
        }
      }
    } else if (hasFlex) {
      layout.type = 'flex';
    }

    // Detect hero pattern (large text + CTA buttons) using AST
    // Handles variant prefixes like md:text-5xl
    const hasLargeText = coreClasses.some(c => /^text-[4-9]xl$/.test(c));
    const hasButton = source.getDescendantsOfKind(SyntaxKind.JsxElement).some(element => {
      const tagName = element.getOpeningElement().getTagNameNode().getText().toLowerCase();
      return tagName === 'button';
    }) || source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).some(element => {
      const tagName = element.getTagNameNode().getText().toLowerCase();
      return tagName === 'button';
    });

    if (hasLargeText && hasButton) {
      layout.hasHeroPattern = true;
    }

    // Detect feature cards (grid with card-like elements) using AST
    // Handles variant prefixes like md:rounded-xl, lg:shadow-lg
    if (hasGrid) {
      const hasCardClasses = coreClasses.some(c => 
        /card/.test(c) || /rounded/.test(c) || /shadow/.test(c)
      );
      if (hasCardClasses) {
        layout.hasFeatureCards = true;
      }
    }
  } catch (error) {
    debugError('layout', 'extractLayoutMetadata', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }

  return layout;
}

/**
 * Extract visual metadata (colors, spacing, typography, etc.) - AST-based
 * 
 * Uses AST to extract Tailwind classes, then filters them by visual patterns.
 * This correctly handles dynamic className expressions and variant-prefixed classes.
 */
export function extractVisualMetadata(source: SourceFile): VisualMetadata {
  const visual: VisualMetadata = {};

  try {
    // Extract all Tailwind classes using AST (handles dynamic expressions)
    const allClasses = extractTailwindClasses(source);
    // Normalize to core classes (strip variant prefixes) once for reuse
    const coreClasses = allClasses.map(coreClass);

    // Extract color classes (bg-*, text-*, border-*)
    // Handles variant prefixes like md:bg-blue-500, dark:text-slate-50
    const colorClasses = coreClasses.filter(c => /^(?:bg-|text-|border-)/.test(c));
    if (colorClasses.length > 0) {
      visual.colors = Array.from(new Set(colorClasses)).sort().slice(0, 10);
    }

    // Extract spacing patterns (p-*, m-*, px-*, py-*, mx-*, my-*, pt-*, pb-*, pl-*, pr-*, mt-*, mb-*, ml-*, mr-*)
    // Handles variant prefixes like lg:px-4, sm:m-2
    // Also handles fractional values (p-1.5), arbitrary values (p-px, p-[2px]), and negative spacing (-mt-2)
    const spacingClasses = coreClasses.filter(c => 
      /^-?(?:p-|m-|px-|py-|mx-|my-|pt-|pb-|pl-|pr-|mt-|mb-|ml-|mr-)[\w.\[\]]+/.test(c)
    );
    if (spacingClasses.length > 0) {
      visual.spacing = Array.from(new Set(spacingClasses)).sort().slice(0, 10);
    }

    // Extract border radius (find most common pattern for determinism)
    // Handles variant prefixes like md:rounded-xl
    // Stores just the token (e.g., 'lg') not the full class (e.g., 'rounded-lg')
    // Valid values: "default" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full"
    const radiusClasses = coreClasses.filter(c => /^rounded/.test(c));
    if (radiusClasses.length > 0) {
      const radiusFreq = new Map<string, number>();
      for (const cls of radiusClasses) {
        const match = cls.match(/^rounded(?:-(\w+))?/);
        if (match) {
          const radius = match[1] || 'default';
          radiusFreq.set(radius, (radiusFreq.get(radius) || 0) + 1);
        }
      }
      // Use most common radius, with stable tiebreaker (alphabetical)
      const sortedByFreq = Array.from(radiusFreq.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      visual.radius = sortedByFreq[0][0];
    }

    // Extract typography classes (text-*, font-*)
    // Handles variant prefixes like sm:text-lg
    const typographyClasses = coreClasses.filter(c => /^(?:text-|font-)/.test(c));
    if (typographyClasses.length > 0) {
      visual.typography = Array.from(new Set(typographyClasses)).sort().slice(0, 10);
    }
  } catch (error) {
    debugError('layout', 'extractVisualMetadata', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }

  return visual;
}

