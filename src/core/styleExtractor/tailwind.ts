/**
 * Tailwind CSS extractor - Extracts and categorizes Tailwind utility classes
 */

import { SourceFile, SyntaxKind, Node, JsxExpression, NoSubstitutionTemplateLiteral } from 'ts-morph';

/**
 * Tailwind utility class categories for semantic grouping
 * Note: Order matters - first match wins.
 * - ring- is intentionally only in borders (not colors)
 * - shadow- is intentionally only in effects (not colors)
 * - border- and outline- are in borders (checked before colors)
 */
const TAILWIND_CATEGORIES = {
  layout: /^(flex|grid|block|inline|hidden|container|box-|aspect-|columns-|break-|table|inline-table|table-caption|table-cell|table-column|table-column-group|table-footer-group|table-header-group|table-row-group|table-row|flow-root|contents|list-item)/,
  spacing: /^(p-|m-|px-|py-|mx-|my-|pt-|pb-|pl-|pr-|mt-|mb-|ml-|mr-|space-|gap-)/,
  sizing: /^(w-|h-|min-w-|min-h-|max-w-|max-h-|size-)/,
  positioning: /^(static|fixed|absolute|relative|sticky|inset-|top-|right-|bottom-|left-|z-)/,
  typography: /^(text-|font-|leading-|tracking-|antialiased|subpixel|italic|not-italic|uppercase|lowercase|capitalize|normal-case|truncate|whitespace-|line-clamp-|indent-|align-|vertical-align-)/,
  borders: /^(border-|rounded-|ring-|divide-|outline-)/,
  colors: /^(bg-|text-|from-|via-|to-|decoration-|accent-|caret-)/,
  effects: /^(shadow-|opacity-|mix-|backdrop-|blur-|brightness-|contrast-|grayscale|hue-|invert|saturate|sepia)/,
  transitions: /^(transition-|duration-|ease-|delay-|animate-)/,
  transforms: /^(scale-|rotate-|translate-|skew-|origin-)/,
  interactivity: /^(cursor-|select-|pointer-events-|resize-|scroll-|touch-|will-)/,
  overflow: /^(overflow-|overscroll-)/,
  display: /^(object-|float-|clear-|isolate)/,
  svg: /^(fill-|stroke-)/,
};

/**
 * Pattern to match chains of variant prefixes (breakpoints, pseudo-classes, etc.)
 * Matches one or more variant prefixes at the start of a class name
 * 
 * Handles:
 * - Responsive breakpoints: sm:, md:, lg:, xl:, 2xl:, max-*
 * - Pseudo-classes: hover:, focus:, active:, disabled:, etc.
 * - State variants: open:, checked:, selected:, etc.
 * - Theme variants: dark:, light:
 * - Motion variants: motion-safe:, motion-reduce:
 * - ARIA/data variants: aria-[...]:, data-[...]:
 * - Group/peer variants: group-hover:, peer-focus:, etc.
 * - Print: print:
 */
const VARIANT_PREFIX_CHAIN =
  /^(?:(sm|md|lg|xl|2xl|max-sm|max-md|max-lg|max-xl|max-2xl|hover|focus|active|disabled|visited|first|last|odd|even|group-hover|group-focus|group-active|peer-hover|peer-focus|peer-active|dark|light|motion-safe|motion-reduce|open|checked|selected|indeterminate|required|optional|valid|invalid|in-range|out-of-range|read-only|read-write|empty|target|before|after|placeholder|file|marker|selection|first-line|first-letter|backdrop|print|aria-[^:]+|data-[^:]+):)+/;

/**
 * Pattern to match breakpoint prefixes anywhere in a class name
 */
const BREAKPOINT_PATTERN = /\b(sm|md|lg|xl|2xl|max-sm|max-md|max-lg|max-xl|max-2xl):/g;

/**
 * Extract Tailwind classes from className attributes in JSX (AST-based)
 * 
 * Uses AST traversal to extract classes from:
 * - Literal strings: className="flex p-4"
 * - Template literals: className={`flex ${variable}`} (static segments extracted)
 * - Function calls: className={cn('flex', isActive && 'bg-blue')}
 * - Conditional expressions: className={isActive && 'bg-blue'}
 * 
 * Note: Template literals are partially analyzed – static segments are extracted,
 * dynamic expressions within ${} are ignored.
 * 
 * Falls back to regex extraction for source text if AST is not available.
 */
export function extractTailwindClasses(source: SourceFile | string): string[] {
  try {
    if (typeof source === 'string') {
      // Fallback to regex-based extraction for backward compatibility
      return extractTailwindClassesFromText(source);
    }

    const classNames = new Set<string>();

    // Extract from JSX attributes - wrap AST-risky operation
    let jsxElements: any[] = [];
    try {
      jsxElements = [
        ...source.getDescendantsOfKind(SyntaxKind.JsxElement),
        ...source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ];
    } catch {
      // If AST traversal fails, fallback to regex extraction
      return extractTailwindClassesFromText(source.getFullText());
    }

    for (const element of jsxElements) {
      const openingElement = 'getOpeningElement' in element 
        ? element.getOpeningElement() 
        : element;

      // Get all attributes and find className or class
      const attributes = openingElement.getAttributes();
      for (const attr of attributes) {
        if (attr.getKind() !== SyntaxKind.JsxAttribute) continue;
        
        const jsxAttr = attr as any;
        const attrName = jsxAttr.getNameNode().getText();
        // Support both className (React/Preact) and class (Vue, Svelte, etc.)
        if (attrName !== 'className' && attrName !== 'class') continue;

        const initializer = jsxAttr.getInitializer();
        if (!initializer) continue;

        let expressionNode: Node | undefined = initializer;

        // Handle className="..." (StringLiteral) vs className={...} (JsxExpression)
        // For className={...}, unwrap the JsxExpression to get the inner expression
        if (initializer.getKind() === SyntaxKind.JsxExpression) {
          const expr = (initializer as JsxExpression).getExpression();
          if (!expr) continue;
          expressionNode = expr;
        }

        // Extract classes based on the expression type
        const extracted = extractClassesFromExpression(expressionNode!);
        extracted.forEach(cls => classNames.add(cls));
      }
    }

    return Array.from(classNames);
  } catch (error) {
    if (process.env.LOGICSTAMP_DEBUG === '1') {
      console.error('[logicstamp:tailwind] Failed to extract Tailwind classes:', (error as Error).message);
    }
    return [];
  }
}

/**
 * Extract classes from a className expression (AST node)
 */
function extractClassesFromExpression(node: Node): string[] {
  try {
    const classes: string[] = [];

    // String literal: className="flex p-4"
    if (node.getKind() === SyntaxKind.StringLiteral) {
      const text = (node as any).getLiteralText?.() ?? (node as any).getText().slice(1, -1);
      classes.push(...text.split(/\s+/).filter(Boolean));
    }
    // Backtick literal with no interpolations: `flex p-4`
    else if (node.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
      const text = (node as NoSubstitutionTemplateLiteral).getLiteralText?.() ?? (node as any).getText().slice(1, -1);
      classes.push(...text.split(/\s+/).filter(Boolean));
    }
    // Template with interpolations: `flex ${...} text-white`
    // Static segments are extracted, dynamic expressions within ${} are ignored
    else if (node.getKind() === SyntaxKind.TemplateExpression) {
      const template = node.asKindOrThrow(SyntaxKind.TemplateExpression);

      // Head: initial static part before first ${}
      const headText = template.getHead().getText().replace(/^`/, '');
      if (headText.trim()) {
        classes.push(...headText.trim().split(/\s+/).filter(Boolean));
      }

      // Each span: ${ expression }<literal>
      // Only extract the literal part (static text after each ${}), ignore the expression
      for (const span of template.getTemplateSpans()) {
        const literal = span.getLiteral();
        const litText = literal.getText().replace(/`$/, '');
        if (litText.trim()) {
          classes.push(...litText.trim().split(/\s+/).filter(Boolean));
        }
      }
    }
    // Conditional expression at top level: className={isActive && 'bg-blue'}
    else if (node.getKind() === SyntaxKind.BinaryExpression) {
      const binary = node.asKindOrThrow(SyntaxKind.BinaryExpression);
      const right = binary.getRight();
      if (right && right.getKind() === SyntaxKind.StringLiteral) {
        const str = (right as any).getLiteralText?.() ?? (right as any).getText().slice(1, -1);
        classes.push(...str.split(/\s+/).filter(Boolean));
      }
    }
    // Function call: className={cn('flex', 'p-4')}
    else if (node.getKind() === SyntaxKind.CallExpression) {
      const callExpr = node.asKindOrThrow(SyntaxKind.CallExpression);
      const expr = callExpr.getExpression();

      // Check if it's cn/clsx/classnames by inspecting the identifier directly
      // This is more robust than regex on getText() which can include parentheses
      const name =
        expr.getKind() === SyntaxKind.Identifier ? expr.getText() : undefined;

      if (!name || !['cn', 'clsx', 'classnames'].includes(name)) {
        return classes;
      }

      // Extract string arguments from the call
      const args = callExpr.getArguments();
      for (const arg of args) {
        // Recursively extract from arguments (handles strings, templates, conditionals, etc.)
        classes.push(...extractClassesFromExpression(arg));
      }
    }
    // Variable reference: className={styles}
    else if (node.getKind() === SyntaxKind.Identifier) {
      // Can't statically analyze variables, skip
    }

    return classes;
  } catch {
    // Return empty array on unexpected errors - outer try/catch will handle logging
    return [];
  }
}

/**
 * Fallback: Extract Tailwind classes from source text using regex
 * Used for backward compatibility when only source text is available.
 * 
 * Note: This fallback only handles literal className/class strings (className="..."),
 * not dynamic expressions. Use AST-based extraction for full support.
 */
function extractTailwindClassesFromText(sourceText: string): string[] {
  try {
    const classNames = new Set<string>();

    // Match className="..." or className='...' or className={`...`}
    // Also match class="..." for non-React frameworks (Vue, Svelte, etc.)
    const patterns = [
      /className\s*=\s*"([^"]*)"/g,
      /className\s*=\s*'([^']*)'/g,
      /className\s*=\s*`([^`]*)`/g,
      /class\s*=\s*"([^"]*)"/g,
      /class\s*=\s*'([^']*)'/g,
      /class\s*=\s*`([^`]*)`/g,
    ];

    for (const pattern of patterns) {
      for (const match of sourceText.matchAll(pattern)) {
        if (match[1]) {
          // Split by whitespace and filter empty strings
          const classes = match[1].split(/\s+/).filter(Boolean);
          classes.forEach(cls => classNames.add(cls));
        }
      }
    }

    return Array.from(classNames);
  } catch (error) {
    if (process.env.LOGICSTAMP_DEBUG === '1') {
      console.error('[logicstamp:tailwind] Failed to extract Tailwind classes from text:', (error as Error).message);
    }
    return [];
  }
}

/**
 * Strip all variant prefixes from a class name to get the base utility
 * 
 * Examples:
 * - sm:bg-red-500 → bg-red-500
 * - md:hover:bg-red-500 → bg-red-500
 * - dark:focus:ring-2 → ring-2
 * - light:bg-white → bg-white
 * - aria-[pressed=true]:bg-blue-500 → bg-blue-500
 * - data-[state=active]:text-red-500 → text-red-500
 */
function stripVariantPrefixes(className: string): string {
  return className.replace(VARIANT_PREFIX_CHAIN, '');
}

/**
 * Categorize Tailwind utility classes
 * 
 * Returns a record mapping category names to arrays of class names (JSON-ready).
 * Each class is categorized based on its base utility (after stripping variant prefixes).
 */
export function categorizeTailwindClasses(
  classes: string[]
): Record<string, string[]> {
  try {
    if (!Array.isArray(classes)) return {};

    const categorized: Record<string, Set<string>> = {};

    for (const className of classes) {
      // Strip all variant prefixes to get the base utility class
      const baseClass = stripVariantPrefixes(className);

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

    // Convert Sets to arrays for JSON serialization
    // Let outer try/catch handle any conversion errors to preserve partial results
    const result = Object.fromEntries(
      Object.entries(categorized).map(([k, v]) => [k, Array.from(v).sort()])
    );
    return result;
  } catch (error) {
    if (process.env.LOGICSTAMP_DEBUG === '1') {
      console.error('[logicstamp:tailwind] Failed to categorize Tailwind classes:', (error as Error).message);
    }
    return {};
  }
}

/**
 * Extract responsive breakpoints used in the component
 * 
 * Finds breakpoints anywhere in class names, not just at the start.
 * Handles cases like hover:sm:bg-red-500 (though uncommon in practice).
 */
export function extractBreakpoints(classes: string[]): string[] {
  try {
    if (!Array.isArray(classes)) return [];

    const breakpoints = new Set<string>();

    for (const className of classes) {
      let match: RegExpExecArray | null;
      // Reset regex lastIndex for each string
      BREAKPOINT_PATTERN.lastIndex = 0;
      while ((match = BREAKPOINT_PATTERN.exec(className))) {
        breakpoints.add(match[1]);
      }
    }

    return Array.from(breakpoints).sort();
  } catch (error) {
    if (process.env.LOGICSTAMP_DEBUG === '1') {
      console.error('[logicstamp:tailwind] Failed to extract breakpoints:', (error as Error).message);
    }
    return [];
  }
}

