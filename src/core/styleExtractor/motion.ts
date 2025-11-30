/**
 * Framer Motion extractor - Extracts animation configurations
 */

import { SourceFile, SyntaxKind, JsxAttribute, PropertyAccessExpression, CallExpression, VariableDeclaration } from 'ts-morph';
import type { AnimationMetadata } from '../../types/UIFContract.js';

/**
 * Extract Framer Motion animation configurations using AST
 */
export function extractMotionConfig(source: SourceFile): {
  components: string[];
  variants: string[];
  hasGestures: boolean;
  hasLayout: boolean;
  hasViewport: boolean;
} {
  try {
    const components = new Set<string>();
    const variants = new Set<string>();
    let hasGestures = false;
    let hasLayout = false;
    let hasViewport = false;

    // Cache import declarations for reuse
    let importDeclarations = [] as ReturnType<SourceFile['getImportDeclarations']>;
    try {
      importDeclarations = source.getImportDeclarations();
    } catch (error) {
      if (process.env.LOGICSTAMP_DEBUG === '1') {
        console.error('[logicstamp:motion] Failed to get import declarations:', (error as Error).message);
      }
      // Continue with empty array
    }

    // Check if Framer Motion is actually being used
    let hasFramerMotionImport = false;
    try {
      hasFramerMotionImport = importDeclarations.some(imp => {
        const mod = imp.getModuleSpecifierValue();
        return mod === 'framer-motion' || mod.startsWith('framer-motion/');
      });
    } catch (error) {
      if (process.env.LOGICSTAMP_DEBUG === '1') {
        console.error('[logicstamp:motion] Failed to check Framer Motion imports:', (error as Error).message);
      }
      // Default to false on error
    }

    // Extract motion components (motion.div, motion.button, etc.) using AST
    let propertyAccessExpressions: PropertyAccessExpression[] = [];
    try {
      propertyAccessExpressions = source.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
    } catch (error) {
      if (process.env.LOGICSTAMP_DEBUG === '1') {
        console.error('[logicstamp:motion] Failed to extract property access expressions:', (error as Error).message);
      }
      // Continue with empty array
    }

    try {
      for (const propAccess of propertyAccessExpressions) {
        const expression = propAccess.getExpression();
        if (expression.getKind() === SyntaxKind.Identifier && expression.getText() === 'motion') {
          const name = propAccess.getNameNode().getText();
          components.add(name);
        }
      }
    } catch (error) {
      if (process.env.LOGICSTAMP_DEBUG === '1') {
        console.error('[logicstamp:motion] Failed to process property access expressions:', (error as Error).message);
      }
      // Continue - component detection may be incomplete but not fatal
    }

    // Only check for gestures/layout/viewport if Framer Motion is actually being used
    const usesMotion = hasFramerMotionImport || components.size > 0;

    // Extract variant names from JSX attributes using AST
    let jsxAttributes: JsxAttribute[] = [];
    try {
      jsxAttributes = source.getDescendantsOfKind(SyntaxKind.JsxAttribute);
    } catch (error) {
      if (process.env.LOGICSTAMP_DEBUG === '1') {
        console.error('[logicstamp:motion] Failed to extract JSX attributes:', (error as Error).message);
      }
      // Continue with empty array
    }

    try {
      for (const attr of jsxAttributes) {
        const jsxAttr = attr as JsxAttribute;
        const attrName = jsxAttr.getNameNode().getText();
        
        if (attrName === 'variants') {
          const initializer = jsxAttr.getInitializer();
          if (initializer && initializer.getKind() === SyntaxKind.JsxExpression) {
            const expr = (initializer as any).getExpression();
            if (expr && expr.getKind() === SyntaxKind.ObjectLiteralExpression) {
              // Extract property names from inline object literal
              const objLiteral = expr.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
              const properties = objLiteral.getProperties();
              for (const prop of properties) {
                if (prop.getKind() === SyntaxKind.PropertyAssignment) {
                  const name = prop.getNameNode();
                  if (name.getKind() === SyntaxKind.Identifier) {
                    variants.add(name.getText());
                  }
                }
              }
            } else if (expr && expr.getKind() === SyntaxKind.Identifier) {
              // Handle variants passed as variable reference (e.g., variants={variants})
              // Find the variable declaration and extract from it
              try {
                const varName = expr.getText();
                const variableDeclarations: VariableDeclaration[] = source.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
                for (const varDecl of variableDeclarations) {
                  const nameNode = varDecl.getNameNode();
                  if (nameNode.getKind() === SyntaxKind.Identifier && nameNode.getText() === varName) {
                    const initializer = varDecl.getInitializer();
                    if (initializer && initializer.getKind() === SyntaxKind.ObjectLiteralExpression) {
                      const objLiteral = initializer.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
                      const properties = objLiteral.getProperties();
                      for (const prop of properties) {
                        if (prop.getKind() === SyntaxKind.PropertyAssignment) {
                          const propAssignment = prop.asKindOrThrow(SyntaxKind.PropertyAssignment);
                          const propName = propAssignment.getNameNode();
                          if (propName.getKind() === SyntaxKind.Identifier) {
                            variants.add(propName.getText());
                          }
                        }
                      }
                    }
                    break;
                  }
                }
              } catch (error) {
                if (process.env.LOGICSTAMP_DEBUG === '1') {
                  console.error('[logicstamp:motion] Failed to extract variants from variable declarations:', (error as Error).message);
                }
                // Continue - variant detection may be incomplete but not fatal
              }
            }
          }
        }
      }
    } catch (error) {
      if (process.env.LOGICSTAMP_DEBUG === '1') {
        console.error('[logicstamp:motion] Failed to extract variants from JSX attributes:', (error as Error).message);
      }
      // Continue - variant detection may be incomplete but not fatal
    }

    // Check for gesture handlers (only if Framer Motion is being used)
    if (usesMotion && !hasGestures) {
      const gestureProps = ['whileHover', 'whileTap', 'whileDrag', 'whileFocus', 'whileInView',
        'onTap', 'onPan', 'onDrag', 'onHover', 'onTapStart', 'onTapEnd', 
        'onPanStart', 'onPanEnd', 'onDragStart', 'onDragEnd', 'onHoverStart', 'onHoverEnd'];
      
      try {
        for (const attr of jsxAttributes) {
          const jsxAttr = attr as JsxAttribute;
          const attrName = jsxAttr.getNameNode().getText();
          if (gestureProps.includes(attrName)) {
            hasGestures = true;
            break;
          }
        }
      } catch (error) {
        if (process.env.LOGICSTAMP_DEBUG === '1') {
          console.error('[logicstamp:motion] Failed to check gestures:', (error as Error).message);
        }
        // Default to false on error
      }
    }

    // Check for layout animations (only if Framer Motion is being used)
    if (usesMotion && !hasLayout) {
      try {
        for (const attr of jsxAttributes) {
          const jsxAttr = attr as JsxAttribute;
          const attrName = jsxAttr.getNameNode().getText();
          if (attrName === 'layout' || attrName === 'layoutId') {
            hasLayout = true;
            break;
          }
        }
      } catch (error) {
        if (process.env.LOGICSTAMP_DEBUG === '1') {
          console.error('[logicstamp:motion] Failed to check layout animations:', (error as Error).message);
        }
        // Default to false on error
      }
    }

    // Check for viewport animations (only if Framer Motion is being used)
    if (usesMotion && !hasViewport) {
      try {
        for (const attr of jsxAttributes) {
          const jsxAttr = attr as JsxAttribute;
          const attrName = jsxAttr.getNameNode().getText();
          if (attrName === 'viewport') {
            hasViewport = true;
            break;
          }
        }
      } catch (error) {
        if (process.env.LOGICSTAMP_DEBUG === '1') {
          console.error('[logicstamp:motion] Failed to check viewport animations:', (error as Error).message);
        }
        // Default to false on error
      }
    }

    // Check for useInView hook using AST (only if Framer Motion is being used)
    if (usesMotion && !hasViewport) {
      try {
        const callExpressions = source.getDescendantsOfKind(SyntaxKind.CallExpression);
        for (const callExpr of callExpressions) {
          const expr = callExpr.getExpression();
          if (expr.getKind() === SyntaxKind.Identifier && expr.getText() === 'useInView') {
            hasViewport = true;
            break;
          }
        }
      } catch (error) {
        if (process.env.LOGICSTAMP_DEBUG === '1') {
          console.error('[logicstamp:motion] Failed to check useInView hook:', (error as Error).message);
        }
        // Default to false on error
      }
    }

    return {
      components: Array.from(components).sort(),
      variants: Array.from(variants).sort(),
      hasGestures,
      hasLayout,
      hasViewport,
    };
  } catch (error) {
    if (process.env.LOGICSTAMP_DEBUG === '1') {
      console.error('[logicstamp:motion] Failed to extract Motion config:', (error as Error).message);
    }
    // Return empty/default values on unexpected errors
    return {
      components: [],
      variants: [],
      hasGestures: false,
      hasLayout: false,
      hasViewport: false,
    };
  }
}

/**
 * Extract animation metadata using AST
 */
export function extractAnimationMetadata(source: SourceFile): AnimationMetadata {
  try {
    const animation: AnimationMetadata = {};

    // Cache import declarations for reuse
    let importDeclarations = [] as ReturnType<SourceFile['getImportDeclarations']>;
    try {
      importDeclarations = source.getImportDeclarations();
    } catch (error) {
      if (process.env.LOGICSTAMP_DEBUG === '1') {
        console.error('[logicstamp:motion] Failed to get import declarations:', (error as Error).message);
      }
      // Continue with empty array
    }

    // Check for framer-motion animations using AST
    let hasFramerMotion = false;
    try {
      hasFramerMotion = importDeclarations.some(imp => {
        const mod = imp.getModuleSpecifierValue();
        return mod === 'framer-motion' || mod.startsWith('framer-motion/');
      });
    } catch (error) {
      if (process.env.LOGICSTAMP_DEBUG === '1') {
        console.error('[logicstamp:motion] Failed to check Framer Motion imports:', (error as Error).message);
      }
      // Default to false on error
    }

    // Cache JSX attributes once for reuse in both Framer Motion and CSS checks
    let jsxAttributes: JsxAttribute[] = [];
    try {
      jsxAttributes = source.getDescendantsOfKind(SyntaxKind.JsxAttribute);
    } catch (error) {
      if (process.env.LOGICSTAMP_DEBUG === '1') {
        console.error('[logicstamp:motion] Failed to extract JSX attributes:', (error as Error).message);
      }
      // Continue with empty array
    }

    if (hasFramerMotion) {
      animation.library = 'framer-motion';

      // Check for fade-in patterns using AST

      try {
        for (const attr of jsxAttributes) {
          if (attr.getNameNode().getText() === 'animate') {
            const animateInitializer = attr.getInitializer();
            if (animateInitializer && animateInitializer.getKind() === SyntaxKind.JsxExpression) {
              const expr = (animateInitializer as any).getExpression();
              if (expr && expr.getKind() === SyntaxKind.ObjectLiteralExpression) {
                const objLiteral = expr.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
                const properties = objLiteral.getProperties();
                for (const prop of properties) {
                  if (prop.getKind() === SyntaxKind.PropertyAssignment) {
                    const name = prop.getNameNode();
                    if (name.getKind() === SyntaxKind.Identifier && name.getText() === 'opacity') {
                      const opacityInitializer = prop.getInitializer();
                      if (opacityInitializer && opacityInitializer.getKind() === SyntaxKind.NumericLiteral) {
                        const value = (opacityInitializer as any).getLiteralValue?.() ?? parseFloat(opacityInitializer.getText());
                        if (value === 1) {
                          animation.type = 'fade-in';
                          break;
                        }
                      }
                    }
                  }
                }
                if (animation.type === 'fade-in') break;
              }
            }
          }
        }
      } catch (error) {
        if (process.env.LOGICSTAMP_DEBUG === '1') {
          console.error('[logicstamp:motion] Failed to check fade-in patterns:', (error as Error).message);
        }
        // Continue - animation detection may be incomplete but not fatal
      }

      // Check for useInView hook using AST
      if (!animation.trigger) {
        try {
          const callExpressions: CallExpression[] = source.getDescendantsOfKind(SyntaxKind.CallExpression);
          for (const callExpr of callExpressions) {
            const expr = callExpr.getExpression();
            if (expr.getKind() === SyntaxKind.Identifier && expr.getText() === 'useInView') {
              animation.trigger = 'inView';
              break;
            }
          }
        } catch (error) {
          if (process.env.LOGICSTAMP_DEBUG === '1') {
            console.error('[logicstamp:motion] Failed to check useInView hook:', (error as Error).message);
          }
          // Continue - trigger detection may be incomplete but not fatal
        }
      }
    }

    // Check for CSS transitions/animations using AST (reuse jsxAttributes from above)
    let hasTransition = false;
    let hasAnimateClass = false;
    
    try {
      // Check for transition attribute or transition-related classes in className
      hasTransition = jsxAttributes.some(attr => {
        const name = attr.getNameNode().getText();
        
        if (name === 'transition') return true; // explicit prop
        
        if (name === 'className' || name === 'class') {
          const attrInitializer = attr.getInitializer();
          if (attrInitializer) {
            const text = attrInitializer.getText();
            // Tailwind-style transitions
            return /(?:^|\s)transition-/.test(text) || /(?:^|\s)duration-/.test(text);
          }
        }
        
        return false;
      });

      hasAnimateClass = jsxAttributes.some(attr => {
        const attrName = attr.getNameNode().getText();
        if (attrName === 'className' || attrName === 'class') {
          const attrInitializer = attr.getInitializer();
          if (attrInitializer) {
            const text = attrInitializer.getText();
            return /animate-/.test(text);
          }
        }
        return false;
      });
    } catch (error) {
      if (process.env.LOGICSTAMP_DEBUG === '1') {
        console.error('[logicstamp:motion] Failed to check CSS transitions/animations:', (error as Error).message);
      }
      // Default to false on error
    }

    if (hasTransition || hasAnimateClass) {
      if (!animation.library) {
        animation.library = 'css';
      }
      if (!animation.type && hasAnimateClass) {
        try {
          // Extract animate- class name
          for (const attr of jsxAttributes) {
            const attrName = attr.getNameNode().getText();
            if (attrName === 'className' || attrName === 'class') {
              const attrInitializer = attr.getInitializer();
              if (attrInitializer) {
                const text = attrInitializer.getText();
                const animateMatch = text.match(/animate-([a-zA-Z0-9_-]+)/);
                if (animateMatch) {
                  animation.type = animateMatch[1];
                  break;
                }
              }
            }
          }
        } catch (error) {
          if (process.env.LOGICSTAMP_DEBUG === '1') {
            console.error('[logicstamp:motion] Failed to extract animate class name:', (error as Error).message);
          }
          // Continue - animation type detection may be incomplete but not fatal
        }
      }
    }

    return animation;
  } catch (error) {
    if (process.env.LOGICSTAMP_DEBUG === '1') {
      console.error('[logicstamp:motion] Failed to extract animation metadata:', (error as Error).message);
    }
    // Return empty object on unexpected errors
    return {};
  }
}

