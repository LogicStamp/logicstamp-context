/**
 * Framer Motion extractor - Extracts animation configurations
 */

import { SourceFile } from 'ts-morph';
import type { AnimationMetadata } from '../../types/UIFContract.js';

/**
 * Extract Framer Motion animation configurations
 */
export function extractMotionConfig(source: SourceFile): {
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
 * Extract animation metadata
 */
export function extractAnimationMetadata(source: SourceFile): AnimationMetadata {
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

