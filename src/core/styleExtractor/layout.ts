/**
 * Layout and visual metadata extractor - Extracts layout patterns and visual styles
 */

import { SourceFile } from 'ts-morph';
import type { LayoutMetadata, VisualMetadata } from '../../types/UIFContract.js';

/**
 * Extract layout metadata from JSX
 */
export function extractLayoutMetadata(source: SourceFile): LayoutMetadata {
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
export function extractVisualMetadata(source: SourceFile): VisualMetadata {
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

