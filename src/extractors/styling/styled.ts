/**
 * Styled-components/Emotion extractor - Extracts CSS-in-JS library usage
 */

import { SourceFile, SyntaxKind, Node, NoSubstitutionTemplateLiteral, JsxAttribute, TaggedTemplateExpression, CallExpression, JsxElement, JsxSelfClosingElement } from 'ts-morph';
import { debugError } from '../../utils/debug.js';

/**
 * Check if styled is imported from styled-components or emotion libraries
 */
function hasStyledImport(source: SourceFile): boolean {
  try {
    for (const imp of source.getImportDeclarations()) {
      try {
        const module = imp.getModuleSpecifierValue();
        if (
          module === 'styled-components' ||
          module === '@emotion/styled' ||
          module === '@emotion/react'
        ) {
          const named = imp.getNamedImports();
          const defaultImport = imp.getDefaultImport();

          if (defaultImport && defaultImport.getText() === 'styled') {
            return true;
          }

          for (const n of named) {
            if (n.getName() === 'styled') {
              return true;
            }
          }
        }
      } catch {
        // Continue checking other imports
      }
    }

    return false;
  } catch {
    // Return false on unexpected errors - outer try/catch will handle logging
    return false;
  }
}

/**
 * Extract styled-components/emotion styled declarations using AST
 */
export function extractStyledComponents(source: SourceFile): {
  components: string[];
  hasTheme: boolean;
  hasCssProps: boolean;
} {
  try {
    const components = new Set<string>();
    let hasTheme = false;
    let hasCssProps = false;

    // Check if styled is imported from valid sources (styled-components/emotion)
    let hasValidStyledImport = false;
    try {
      hasValidStyledImport = hasStyledImport(source);
    } catch {
      // If import check fails, continue without styled import validation
    }

    // Find all tagged template expressions (e.g., styled.div`...` or styled(Component)`...`)
    let taggedTemplates: TaggedTemplateExpression[] = [];
    try {
      taggedTemplates = source.getDescendantsOfKind(SyntaxKind.TaggedTemplateExpression);
    } catch (error) {
      debugError('styled', 'extractStyledComponents', {
        error: error instanceof Error ? error.message : String(error),
        context: 'getTaggedTemplateExpressions',
      });
      // Keep taggedTemplates = [] and continue to theme/useTheme/css checks
    }

    for (const taggedTemplate of taggedTemplates) {
      try {
        const tag = taggedTemplate.getTag();
        const template = taggedTemplate.getTemplate();

        // Check if this is a styled component pattern (only if styled is from valid sources)
        if (hasValidStyledImport) {
          const componentName = extractStyledComponentName(tag);
          if (componentName) {
            components.add(componentName);
          }
        }

        // Check for theme usage in template literals
        if (!hasTheme) {
          try {
            if (containsThemeUsage(template)) {
              hasTheme = true;
            }
          } catch {
            // Continue if theme check fails for this template
          }
        }
      } catch {
        // Continue processing other tagged templates
      }
    }

    // Check for useTheme() hook calls
    if (!hasTheme) {
      let callExpressions: CallExpression[] = [];
      try {
        callExpressions = source.getDescendantsOfKind(SyntaxKind.CallExpression);
      } catch (error) {
        debugError('styled', 'extractStyledComponents', {
          error: error instanceof Error ? error.message : String(error),
          context: 'getCallExpressions',
        });
        // Continue with empty array
      }

      try {
        for (const callExpr of callExpressions) {
          try {
            const expr = callExpr.getExpression();
            if (expr.getKind() === SyntaxKind.Identifier && expr.getText() === 'useTheme') {
              hasTheme = true;
              break;
            }
          } catch {
            // Continue checking other call expressions
          }
        }
      } catch {
        // Continue if call expression processing fails
      }
    }

    // Check for css prop usage in JSX
    if (!hasCssProps) {
      let jsxElements: (JsxElement | JsxSelfClosingElement)[] = [];
      try {
        jsxElements = [
          ...source.getDescendantsOfKind(SyntaxKind.JsxElement),
          ...source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
        ];
      } catch (error) {
        debugError('styled', 'extractStyledComponents', {
          error: error instanceof Error ? error.message : String(error),
          context: 'getJsxElements',
        });
        // Continue with empty array
      }

      try {
        for (const element of jsxElements) {
          try {
            const openingElement = 'getOpeningElement' in element 
              ? element.getOpeningElement() 
              : element;

            const attributes = openingElement.getAttributes();
            for (const attr of attributes) {
              if (attr.getKind() !== SyntaxKind.JsxAttribute) continue;
              
              const jsxAttr = attr as JsxAttribute;
              const attrName = jsxAttr.getNameNode().getText();
              
              if (attrName === 'css') {
                hasCssProps = true;
                break;
              }
            }

            if (hasCssProps) break;
          } catch {
            // Continue checking other JSX elements
          }
        }
      } catch {
        // Continue if JSX processing fails
      }
    }

    return {
      components: Array.from(components).sort().slice(0, 10),
      hasTheme,
      hasCssProps,
    };
  } catch (error) {
    debugError('styled', 'extractStyledComponents', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      components: [],
      hasTheme: false,
      hasCssProps: false,
    };
  }
}

/**
 * Extract component name from styled component tag
 * Handles styled.div`...`, styled(Component)`...`, and styled('div')`...` patterns
 */
function extractStyledComponentName(tag: Node): string | null {
  try {
    // Pattern 1: styled.div`...` (PropertyAccessExpression)
    if (tag.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propAccess = tag.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      const expression = propAccess.getExpression();
      const name = propAccess.getNameNode().getText();

      // Check if expression is 'styled'
      if (expression.getKind() === SyntaxKind.Identifier && expression.getText() === 'styled') {
        return name;
      }
    }

    // Pattern 2: styled(Component)`...` or styled('div')`...` (CallExpression)
    if (tag.getKind() === SyntaxKind.CallExpression) {
      const callExpr = tag.asKindOrThrow(SyntaxKind.CallExpression);
      const expression = callExpr.getExpression();

      // Check if it's styled(...)
      if (expression.getKind() === SyntaxKind.Identifier && expression.getText() === 'styled') {
        const args = callExpr.getArguments();
        if (args.length > 0) {
          const firstArg = args[0];
          // Extract identifier name from argument
          if (firstArg.getKind() === SyntaxKind.Identifier) {
            return firstArg.getText();
          }
          // Handle PropertyAccessExpression like styled(Some.Component)
          if (firstArg.getKind() === SyntaxKind.PropertyAccessExpression) {
            const propAccess = firstArg.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
            return propAccess.getNameNode().getText();
          }
          // Handle string literals like styled('div') or styled("section")
          if (firstArg.getKind() === SyntaxKind.StringLiteral) {
            const str = firstArg.asKindOrThrow(SyntaxKind.StringLiteral);
            return str.getLiteralText();
          }
        }
      }
    }

    return null;
  } catch {
    // Return null on unexpected errors - outer try/catch will handle logging
    return null;
  }
}

/**
 * Check if a template literal contains theme usage
 * Looks for patterns like ${props => props.theme.colors.primary}
 */
function containsThemeUsage(template: Node): boolean {
  try {
    // For NoSubstitutionTemplateLiteral, check for theme. in literal text
    // (NoSubstitutionTemplateLiteral can't contain ${}, so just check for theme.)
    if (template.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral) {
      const text = (template as NoSubstitutionTemplateLiteral).getLiteralText?.() ?? template.getText();
      return /theme\./.test(text);
    }

    // For TemplateExpression, check all template spans for theme references
    if (template.getKind() === SyntaxKind.TemplateExpression) {
      const templateExpr = template.asKindOrThrow(SyntaxKind.TemplateExpression);
      
      // Check head for theme references
      const headText = templateExpr.getHead().getText();
      if (/theme\./.test(headText)) {
        return true;
      }

      // Check each span's expression for theme references
      for (const span of templateExpr.getTemplateSpans()) {
        try {
          const expression = span.getExpression();
          
          // Recursively check the expression for theme references
          if (containsThemeInExpression(expression)) {
            return true;
          }

          // Check literal part for theme references
          const literalText = span.getLiteral().getText();
          if (/theme\./.test(literalText)) {
            return true;
          }
        } catch {
          // Continue checking other spans
        }
      }
    }

    return false;
  } catch {
    // Return false on unexpected errors - outer try/catch will handle logging
    return false;
  }
}

/**
 * Recursively check if an expression contains theme references
 * Optimized to only check identifiers and property access expressions
 */
function containsThemeInExpression(node: Node): boolean {
  try {
    // Only check identifiers and property access expressions for theme references
    // This avoids calling getText() on every node recursively
    if (
      node.getKind() === SyntaxKind.Identifier ||
      node.getKind() === SyntaxKind.PropertyAccessExpression
    ) {
      const text = node.getText();
      if (/theme\./.test(text)) {
        return true;
      }
    }

    // Recursively check child nodes
    for (const child of node.getChildren()) {
      try {
        if (containsThemeInExpression(child)) {
          return true;
        }
      } catch {
        // Continue checking other children
      }
    }

    return false;
  } catch {
    // Return false on unexpected errors - outer try/catch will handle logging
    return false;
  }
}

