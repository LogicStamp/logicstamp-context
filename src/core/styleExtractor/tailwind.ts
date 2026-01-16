/**
 * Tailwind CSS extractor - Extracts and categorizes Tailwind utility classes
 */

import { SourceFile, SyntaxKind, Node, JsxExpression, NoSubstitutionTemplateLiteral, VariableDeclaration } from 'ts-morph';
import { debugError } from '../../utils/debug.js';

/**
 * Tailwind utility class categories for semantic grouping
 * Note: Order matters - first match wins.
 * - ring- is intentionally only in borders (not colors)
 * - shadow- is intentionally only in effects (not colors)
 * - border- and outline- are in borders (checked before colors)
 */
const TAILWIND_CATEGORIES = {
  layout: /^(flex|flex-|grid|grid-cols-|grid-rows-|col-|col-span-|row-|row-span-|block|inline|hidden|container|box-|aspect-|columns-|break-|table|inline-table|table-caption|table-cell|table-column|table-column-group|table-footer-group|table-header-group|table-row-group|table-row|flow-root|contents|list-item|items-|justify-|content-|self-|place-|order-|grow|shrink|basis-)/,
  spacing: /^(p-|m-|px-|py-|mx-|my-|pt-|pb-|pl-|pr-|mt-|mb-|ml-|mr-|space-|gap-)/,
  sizing: /^(w-|h-|min-w-|min-h-|max-w-|max-h-|size-)/,
  positioning: /^(static|fixed|absolute|relative|sticky|inset-|top-|right-|bottom-|left-|z-)/,
  borders: /^(border-|rounded|rounded-|ring-|ring-offset-|divide-|outline-)/,
  // Colors must come before typography so text-red-500 matches colors, not typography
  // Match text- with color names or arbitrary values: text-red-500, text-[#fff], etc.
  colors: /^(bg-|text-(?:black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-|$)|text-\[[^\]]+\]|from-|via-|to-|decoration-|accent-|caret-)/,
  // Typography matches text- patterns that aren't colors (text-sm, text-xl, text-left, etc.)
  typography: /^(font-|leading-|tracking-|antialiased|subpixel|italic|not-italic|uppercase|lowercase|capitalize|normal-case|truncate|whitespace-|line-clamp-|indent-|align-|vertical-align-|text-)/,
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
 * - Pseudo-classes: hover:, focus:, focus-visible:, focus-within:, active:, disabled:, etc.
 * - State variants: open:, checked:, selected:, etc.
 * - Theme variants: dark:, light:
 * - Motion variants: motion-safe:, motion-reduce:
 * - ARIA/data variants: aria-[...]:, data-[...]:, aria-expanded:, etc.
 * - Group/peer variants: group-hover:, group-focus-visible:, peer-checked:, peer-disabled:, etc.
 * - Print: print:
 * - Arbitrary selector variants: [&>p]:, [&_span]:, supports-[...]:, has-[...]:
 * - Container query variants: @sm:, @md:, @lg:, @custom:, etc. (Tailwind v4+)
 *   Uses @[^:]+ pattern to match any container query variant
 * 
 * Note: Container query variants and other newer Tailwind variants are captured via
 * generic patterns. Categorization should strip all variants correctly.
 */
const VARIANT_PREFIX_CHAIN =
  /^(?:(sm|md|lg|xl|2xl|max-sm|max-md|max-lg|max-xl|max-2xl|hover|focus|focus-visible|focus-within|active|disabled|visited|first|last|odd|even|group-hover|group-focus|group-focus-visible|group-active|peer-hover|peer-focus|peer-focus-visible|peer-active|peer-checked|peer-disabled|dark|light|motion-safe|motion-reduce|open|checked|selected|indeterminate|required|optional|valid|invalid|in-range|out-of-range|read-only|read-write|empty|target|before|after|placeholder|file|marker|selection|first-line|first-letter|backdrop|print|aria-[^:]+|data-[^:]+|aria-expanded|aria-pressed|aria-selected|aria-hidden|aria-disabled|supports-\[[^\]]+\]|has-\[[^\]]+\]|\[[^\]]+\]|@[^:]+):)+/;

/**
 * Pattern to match breakpoint prefixes anywhere in a class name
 * Includes responsive breakpoints (sm:, md:, etc.) and container query variants (@sm:, @md:, @custom:, etc.)
 * Uses @[a-zA-Z0-9_-]+ to match Tailwind-like container query variants (avoids matching weird punctuation)
 */
const BREAKPOINT_PATTERN = /\b(@?sm|@?md|@?lg|@?xl|@?2xl|@?max-sm|@?max-md|@?max-lg|@?max-xl|@?max-2xl|@[a-zA-Z0-9_-]+):/g;

/**
 * Extract Tailwind classes from className attributes in JSX (AST-based)
 * 
 * Uses AST traversal to extract classes from:
 * - Literal strings: className="flex p-4"
 * - Template literals: className={`flex ${variable}`} (Phase 1: resolves variables, object properties, conditionals)
 * - Function calls: className={cn('flex', isActive && 'bg-blue')}
 * - Conditional expressions: className={isActive && 'bg-blue'} or className={isActive ? 'bg-blue' : 'bg-gray'}
 * 
 * Phase 1 (v0.3.9): Resolves dynamic expressions within template literals:
 * - Const/let variable declarations: `const base = 'px-4'` → extracts classes from variable
 * - Object property access: `variants.primary` → extracts classes from property value
 * - Conditional expressions: `${isActive ? 'bg-blue' : 'bg-gray'}` → extracts both branches
 * 
 * Phase 2 (Future): Will handle object lookups with variables (`variants[variant]`), cross-file references, and function calls.
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
        // Pass sourceFile for variable resolution (Phase 1)
        const extracted = extractClassesFromExpression(expressionNode!, source);
        extracted.forEach(cls => classNames.add(cls));
      }
    }

    return Array.from(classNames);
  } catch (error) {
    debugError('tailwind', 'extractTailwindClasses', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Extract classes from a className expression (AST node)
 * 
 * Phase 1 (v0.3.9): Resolves const/let variables, object properties, and conditional expressions
 * 
 * @param node - The AST node to extract classes from
 * @param sourceFile - The source file (required for variable resolution in Phase 1)
 */
function extractClassesFromExpression(node: Node, sourceFile?: SourceFile): string[] {
  try {
    const classes: string[] = [];

    // String literal: className="flex p-4"
    if (node.getKind() === SyntaxKind.StringLiteral) {
      const text = (node as any).getLiteralText?.() ?? (node as any).getText().slice(1, -1);
      const cleanClasses = text.split(/\s+/).filter((cls: string) => cls && cls !== '${' && cls !== '}');
      classes.push(...cleanClasses);
    }
    // Backtick literal with no interpolations: `flex p-4`
    else if (node.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
      const text = (node as NoSubstitutionTemplateLiteral).getLiteralText?.() ?? (node as any).getText().slice(1, -1);
      const cleanClasses = text.split(/\s+/).filter((cls: string) => cls && cls !== '${' && cls !== '}');
      classes.push(...cleanClasses);
    }
    // Template with interpolations: `flex ${...} text-white`
    // Phase 1: Now resolves expressions within ${} (variables, object properties, conditionals)
    else if (node.getKind() === SyntaxKind.TemplateExpression) {
      const template = node.asKindOrThrow(SyntaxKind.TemplateExpression);

      // Head: initial static part before first ${}
      const headText = template.getHead().getText().replace(/^`/, '');
      if (headText.trim()) {
        classes.push(...headText.trim().split(/\s+/).filter(Boolean));
      }

      // Each span: ${ expression }<literal>
      // Phase 1: Now recursively resolves expressions (variables, object properties, conditionals)
      for (const span of template.getTemplateSpans()) {
        const expression = span.getExpression();
        // Recursively extract from expression (handles variables, object properties, conditionals)
        if (sourceFile) {
          const exprClasses = extractClassesFromExpression(expression, sourceFile);
          classes.push(...exprClasses);
        }
        
        // Extract literal part (static text after each ${})
        const literal = span.getLiteral();
        // getLiteralText() returns the raw text content without quotes/backticks
        let litText: string;
        if ((literal as any).getLiteralText) {
          litText = (literal as any).getLiteralText();
        } else {
          // Fallback: parse getText() which includes backticks
          const rawText = literal.getText();
          // Remove leading backtick and any template syntax, remove trailing backtick
          litText = rawText.replace(/^[^`]*`/, '').replace(/`$/, '');
        }
        
        if (litText && litText.trim()) {
          // Split and filter out template syntax artifacts and empty strings
          const cleanText = litText.trim().split(/\s+/).filter((cls: string) => {
            return cls && 
                   cls !== '${' && 
                   cls !== '}' && 
                   !cls.includes('${') && 
                   !cls.includes('}') &&
                   cls.length > 0;
          });
          classes.push(...cleanText);
        }
      }
    }
    // Conditional expression (ternary): className={isActive ? 'bg-blue' : 'bg-gray'}
    // Phase 1: Extracts classes from both branches
    else if (node.getKind() === SyntaxKind.ConditionalExpression) {
      const conditional = node.asKindOrThrow(SyntaxKind.ConditionalExpression);
      const whenTrue = conditional.getWhenTrue();
      const whenFalse = conditional.getWhenFalse();
      
      // Extract from both branches
      if (sourceFile) {
        classes.push(...extractClassesFromExpression(whenTrue, sourceFile));
        classes.push(...extractClassesFromExpression(whenFalse, sourceFile));
      }
    }
    // Conditional expression at top level: className={isActive && 'bg-blue'} or className={'fallback' || base}
    // Only handle logical operators (&&, ||, ??) that are used for class toggling
    else if (node.getKind() === SyntaxKind.BinaryExpression) {
      const binary = node.asKindOrThrow(SyntaxKind.BinaryExpression);
      const operatorToken = binary.getOperatorToken();
      const operatorKind = operatorToken.getKind();
      
      // Only process logical operators used for class toggling: &&, ||, ??
      if (operatorKind === SyntaxKind.AmpersandAmpersandToken ||
          operatorKind === SyntaxKind.BarBarToken ||
          operatorKind === SyntaxKind.QuestionQuestionToken) {
        const left = binary.getLeft();
        const right = binary.getRight();
        
        // Extract from both sides (strings can be on either side)
        if (sourceFile) {
          if (left) {
            classes.push(...extractClassesFromExpression(left, sourceFile));
          }
          if (right) {
            classes.push(...extractClassesFromExpression(right, sourceFile));
          }
        }
      }
      // Ignore other binary operators (+, ===, etc.) - they're not class expressions
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
        if (sourceFile) {
          classes.push(...extractClassesFromExpression(arg, sourceFile));
        }
      }
    }
    // Property access: className={variants.primary}
    // Phase 1: Resolves object property access
    else if (node.getKind() === SyntaxKind.PropertyAccessExpression) {
      if (!sourceFile) {
        return classes;
      }
      
      const propAccess = node.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      const objectExpr = propAccess.getExpression();
      const propertyName = propAccess.getName();
      
      // Try to resolve the object expression to a variable declaration
      if (objectExpr.getKind() === SyntaxKind.Identifier) {
        const varDecl = resolveVariableDeclaration(sourceFile, objectExpr, objectExpr.getText());
        if (varDecl) {
          const initializer = varDecl.getInitializer();
          if (initializer && initializer.getKind() === SyntaxKind.ObjectLiteralExpression) {
            // Find the property in the object literal
            const objLiteral = initializer.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
            const property = objLiteral.getProperty(propertyName);
            if (property && property.getKind() === SyntaxKind.PropertyAssignment) {
              const propAssignment = property.asKindOrThrow(SyntaxKind.PropertyAssignment);
              const propInitializer = propAssignment.getInitializer();
              if (propInitializer) {
                // Recursively extract from property value
                classes.push(...extractClassesFromExpression(propInitializer, sourceFile));
              }
            }
          }
        }
      }
    }
    // Variable reference: className={base}
    // Phase 1: Resolves const/let variable declarations
    else if (node.getKind() === SyntaxKind.Identifier) {
      if (!sourceFile) {
        return classes;
      }
      
      const identifier = node.asKindOrThrow(SyntaxKind.Identifier);
      const varDecl = resolveVariableDeclaration(sourceFile, identifier, identifier.getText());
      
      if (varDecl) {
        const initializer = varDecl.getInitializer();
        if (initializer) {
          // Recursively extract from variable initializer
          classes.push(...extractClassesFromExpression(initializer, sourceFile));
        }
      }
    }

    return classes;
  } catch {
    // Return empty array on unexpected errors - outer try/catch will handle logging
    return [];
  }
}

// Cache variable declarations per file to avoid repeated getDescendantsOfKind calls
const variableDeclarationCache = new WeakMap<SourceFile, VariableDeclaration[]>();

/**
 * Resolve a variable declaration by name, respecting scope/shadowing
 * Phase 1: Only resolves variables in the same file
 * 
 * Searches from the identifier's scope upward to handle shadowing correctly.
 * Uses a scope chain approach: Block (closest) → Function → SourceFile
 * 
 * @param sourceFile - The source file to search in
 * @param identifierNode - The identifier node to resolve (used for scope detection)
 * @param variableName - The name of the variable to resolve
 * @returns The variable declaration if found, undefined otherwise
 */
function resolveVariableDeclaration(sourceFile: SourceFile, identifierNode: Node, variableName: string): VariableDeclaration | undefined {
  try {
    const identifierPos = identifierNode.getStart();
    
    // Use cached variable declarations to avoid expensive getDescendantsOfKind calls
    let allDeclarations = variableDeclarationCache.get(sourceFile);
    if (!allDeclarations) {
      allDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
      variableDeclarationCache.set(sourceFile, allDeclarations);
    }
    
    const matchingDeclarations: Array<{ decl: VariableDeclaration; scope: Node | null; pos: number }> = [];
    
    /**
     * Get the scope node for a declaration or identifier.
     * Returns Block (closest), then Function/Method/Constructor, then SourceFile, or null if none found.
     */
    const getScope = (node: Node): Node | null => {
      let current: Node | undefined = node;
      
      // Prefer Block first (closest), then function/method/constructor, then sourceFile
      while (current && current !== sourceFile) {
        const kind = current.getKind();
        if (kind === SyntaxKind.Block) {
          return current;
        }
        if (kind === SyntaxKind.FunctionDeclaration ||
            kind === SyntaxKind.FunctionExpression ||
            kind === SyntaxKind.MethodDeclaration ||
            kind === SyntaxKind.Constructor) {
          return current;
        }
        // For ArrowFunction, check if it has a block body
        if (kind === SyntaxKind.ArrowFunction) {
          const arrow = current as any;
          const body = arrow.getBody();
          // If body is a Block, prefer the Block; otherwise use ArrowFunction as scope
          if (body && body.getKind() === SyntaxKind.Block) {
            // Continue to find the Block
            current = body;
            continue;
          }
          // ArrowFunction with expression body - use ArrowFunction as scope
          return current;
        }
        current = current.getParent();
      }
      
      // Reached sourceFile - file-level scope
      return sourceFile;
    };
    
    // Collect all matching declarations with their scope information
    for (const varDecl of allDeclarations) {
      try {
        if (varDecl.getName() === variableName) {
          const scope = getScope(varDecl);
          
          matchingDeclarations.push({
            decl: varDecl,
            scope,
            pos: varDecl.getStart()
          });
        }
      } catch {
        continue;
      }
    }
    
    if (matchingDeclarations.length === 0) {
      return undefined;
    }
    
    // Build scope chain for identifier: [nearestBlock, enclosingFunction/Method/Constructor, sourceFile]
    const identifierScopeChain: Node[] = [];
    let current: Node | undefined = identifierNode;
    
    while (current && current !== sourceFile) {
      const kind = current.getKind();
      if (kind === SyntaxKind.Block) {
        identifierScopeChain.push(current);
      } else if (kind === SyntaxKind.FunctionDeclaration ||
                 kind === SyntaxKind.FunctionExpression ||
                 kind === SyntaxKind.MethodDeclaration ||
                 kind === SyntaxKind.Constructor) {
        identifierScopeChain.push(current);
      } else if (kind === SyntaxKind.ArrowFunction) {
        const arrow = current as any;
        const body = arrow.getBody();
        // If body is a Block, we'll find it in next iteration
        if (!body || body.getKind() !== SyntaxKind.Block) {
          // ArrowFunction with expression body - add it to chain
          identifierScopeChain.push(current);
        }
      }
      current = current.getParent();
    }
    
    // Always include sourceFile as the outermost scope
    identifierScopeChain.push(sourceFile);
    
    // Filter declarations that are in scope and come before the identifier
    const inScopeDeclarations = matchingDeclarations.filter(({ decl, scope, pos }) => {
      // Declaration must come before identifier
      if (pos >= identifierPos) {
        return false;
      }
      
      // Find the nearest declaration whose scope is in the identifier's scope chain
      if (!scope) {
        // This shouldn't happen with our getScope function, but handle it
        return false;
      }
      
      // Check if declaration scope is in the identifier's scope chain
      const scopeIndex = identifierScopeChain.indexOf(scope);
      if (scopeIndex !== -1) {
        return true; // Declaration is in a scope that contains the identifier
      }
      
      return false;
    });
    
    // Return the closest declaration (latest position = most recent in scope)
    if (inScopeDeclarations.length > 0) {
      // Prefer declarations in closer scopes (earlier in chain)
      const scopePriorities = new Map<Node, number>();
      identifierScopeChain.forEach((scope, index) => {
        scopePriorities.set(scope, index);
      });
      
      // Sort by scope priority (closer scopes first), then by position (most recent first)
      inScopeDeclarations.sort((a, b) => {
        const aPriority = scopePriorities.get(a.scope!) ?? Infinity;
        const bPriority = scopePriorities.get(b.scope!) ?? Infinity;
        if (aPriority !== bPriority) {
          return aPriority - bPriority;
        }
        return b.pos - a.pos; // Most recent in same scope
      });
      
      return inScopeDeclarations[0].decl;
    }
    
    return undefined;
  } catch {
    return undefined;
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
    debugError('tailwind', 'extractTailwindClassesFromText', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Strip all variant prefixes from a class name to get the base utility
 * Also strips the ! important prefix
 * 
 * Examples:
 * - sm:bg-red-500 → bg-red-500
 * - md:hover:bg-red-500 → bg-red-500
 * - dark:focus:ring-2 → ring-2
 * - light:bg-white → bg-white
 * - aria-[pressed=true]:bg-blue-500 → bg-blue-500
 * - data-[state=active]:text-red-500 → text-red-500
 * - !p-4 → p-4
 * - sm:!p-4 → p-4
 */
function stripVariantPrefixes(className: string): string {
  // Strip variant prefixes (handles sm:!p-4 pattern where ! comes after variant)
  // The regex matches variants like sm:, and we need to also handle sm:! pattern
  let base = className.replace(VARIANT_PREFIX_CHAIN, '');
  // Strip ! important prefix (can be at start or after variant)
  base = base.replace(/^!/, '');
  return base;
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
    debugError('tailwind', 'categorizeTailwindClasses', {
      error: error instanceof Error ? error.message : String(error),
    });
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
    debugError('tailwind', 'extractBreakpoints', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

