/**
 * Tailwind CSS extractor - Extracts and categorizes Tailwind utility classes
 */

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
 * Extract Tailwind classes from className attributes in JSX
 */
export function extractTailwindClasses(sourceText: string): string[] {
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
export function categorizeTailwindClasses(classes: string[]): Record<string, Set<string>> {
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
export function extractBreakpoints(classes: string[]): string[] {
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

