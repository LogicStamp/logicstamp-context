/**
 * Vue Component Extractor - Extracts Vue composables, components, and reactive state from AST
 */

import { SourceFile, SyntaxKind, Node } from 'ts-morph';
import type { PropType, EventType } from '../../../types/UIFContract.js';
import { debugError } from '../../../utils/debug.js';
import { normalizePropType } from './propExtractor.js';

/**
 * Extract all Vue composables (ref, computed, custom composables)
 * Matches the pattern: useXxx or Vue's built-in composables
 */
export function extractVueComposables(source: SourceFile): string[] {
  const composables = new Set<string>();
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    source.getDescendantsOfKind(SyntaxKind.CallExpression).forEach((callExpr) => {
      try {
        const expr = callExpr.getExpression();

        // Only extract composables from direct identifier calls
        if (expr.getKind() === SyntaxKind.Identifier) {
          const text = expr.getText();

          // Match useXxx pattern (custom composables) or Vue built-ins
          const vueBuiltins = [
            'ref', 'reactive', 'computed', 'watch', 'watchEffect',
            'onMounted', 'onUnmounted', 'onBeforeMount', 'onBeforeUnmount',
            'onUpdated', 'onBeforeUpdate', 'onActivated', 'onDeactivated',
            'onErrorCaptured', 'onRenderTracked', 'onRenderTriggered',
            'provide', 'inject', 'toRef', 'toRefs', 'isRef', 'unref',
            'shallowRef', 'triggerRef', 'customRef', 'shallowReactive',
            'readonly', 'isReactive', 'isReadonly', 'toRaw', 'markRaw',
            'effectScope', 'getCurrentScope', 'onScopeDispose',
            'useSlots', 'useAttrs', 'useCssModule', 'useCssVars',
            'defineProps', 'defineEmits', 'defineExpose', 'withDefaults'
          ];

          if (/^use[A-Z]/.test(text) || vueBuiltins.includes(text)) {
            composables.add(text);
          }
        }
      } catch (error) {
        debugError('vueComponentExtractor', 'extractVueComposables', {
          filePath,
          error: error instanceof Error ? error.message : String(error),
          context: 'composables-iteration',
        });
        // Continue with next composable
      }
    });
  } catch (error) {
    debugError('vueComponentExtractor', 'extractVueComposables', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  return Array.from(composables).sort();
}

/**
 * Extract all components used in Vue templates or JSX
 * Handles both PascalCase components and kebab-case components
 */
export function extractVueComponents(source: SourceFile): string[] {
  const components = new Set<string>();
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    // JSX opening elements (for Vue JSX/TSX)
    try {
      source.getDescendantsOfKind(SyntaxKind.JsxOpeningElement).forEach((openingEl) => {
        try {
          const tagName = openingEl.getTagNameNode().getText();
          if (/^[A-Z]/.test(tagName)) {
            components.add(tagName);
          }
        } catch (error) {
          debugError('vueComponentExtractor', 'extractVueComponents', {
            filePath,
            error: error instanceof Error ? error.message : String(error),
            context: 'components-opening',
          });
        }
      });
    } catch (error) {
      debugError('vueComponentExtractor', 'extractVueComponents', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        context: 'components-opening-batch',
      });
    }

    // Self-closing JSX elements (for Vue JSX/TSX)
    try {
      source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).forEach((selfClosing) => {
        try {
          const tagName = selfClosing.getTagNameNode().getText();
          if (/^[A-Z]/.test(tagName)) {
            components.add(tagName);
          }
        } catch (error) {
          debugError('vueComponentExtractor', 'extractVueComponents', {
            filePath,
            error: error instanceof Error ? error.message : String(error),
            context: 'components-selfclosing',
          });
        }
      });
    } catch (error) {
      debugError('vueComponentExtractor', 'extractVueComponents', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        context: 'components-selfclosing-batch',
      });
    }

    // Extract from components registration (Vue 3 Composition API)
    // Look for: components: { MyComponent, ... } or const components = { MyComponent, ... }
    try {
      // Find all property assignments named 'components'
      source.getDescendantsOfKind(SyntaxKind.PropertyAssignment).forEach((prop) => {
        try {
          const propName = prop.getName();
          if (propName === 'components') {
            const initializer = prop.getInitializer();
            if (initializer && Node.isObjectLiteralExpression(initializer)) {
              // Extract component names from the object literal
              initializer.getProperties().forEach((objProp) => {
                try {
                  if (Node.isShorthandPropertyAssignment(objProp) || Node.isPropertyAssignment(objProp)) {
                    const componentName = objProp.getName();
                    if (componentName && /^[A-Z]/.test(componentName)) {
                      components.add(componentName);
                    }
                  }
                } catch (error) {
                  debugError('vueComponentExtractor', 'extractVueComponents', {
                    filePath,
                    error: error instanceof Error ? error.message : String(error),
                    context: 'components-object-properties',
                  });
                }
              });
            }
          }
        } catch (error) {
          debugError('vueComponentExtractor', 'extractVueComponents', {
            filePath,
            error: error instanceof Error ? error.message : String(error),
            context: 'components-registration',
          });
        }
      });

      // Also check for const components = { ... }
      source.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach((varDecl) => {
        try {
          const varName = varDecl.getName();
          if (varName === 'components') {
            const initializer = varDecl.getInitializer();
            if (initializer && Node.isObjectLiteralExpression(initializer)) {
              // Extract component names from the object literal
              initializer.getProperties().forEach((objProp) => {
                try {
                  if (Node.isShorthandPropertyAssignment(objProp) || Node.isPropertyAssignment(objProp)) {
                    const componentName = objProp.getName();
                    if (componentName && /^[A-Z]/.test(componentName)) {
                      components.add(componentName);
                    }
                  }
                } catch (error) {
                  debugError('vueComponentExtractor', 'extractVueComponents', {
                    filePath,
                    error: error instanceof Error ? error.message : String(error),
                    context: 'components-var-object-properties',
                  });
                }
              });
            }
          }
        } catch (error) {
          debugError('vueComponentExtractor', 'extractVueComponents', {
            filePath,
            error: error instanceof Error ? error.message : String(error),
            context: 'components-var-registration',
          });
        }
      });
    } catch (error) {
      debugError('vueComponentExtractor', 'extractVueComponents', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        context: 'components-registration-batch',
      });
    }
  } catch (error) {
    debugError('vueComponentExtractor', 'extractVueComponents', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  return Array.from(components).sort();
}

/**
 * Extract Vue reactive state (ref, reactive, computed)
 */
export function extractVueState(source: SourceFile): Record<string, string> {
  const state: Record<string, string> = {};
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    source.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach((varDecl) => {
      try {
        const varName = varDecl.getName();
        if (!varName) return;

        const initializer = varDecl.getInitializer();
        if (!initializer) return;

        // Check if it's a ref, reactive, or computed call
        if (Node.isCallExpression(initializer)) {
          const callExpr = initializer;
          const expr = callExpr.getExpression();

          if (Node.isIdentifier(expr)) {
            const funcName = expr.getText();

            if (['ref', 'reactive', 'computed', 'shallowRef', 'shallowReactive'].includes(funcName)) {
              // Try to get type from generic or infer from initializer
              let varType = 'unknown';

              // Check for generic type argument
              const typeArgs = callExpr.getTypeArguments();
              if (typeArgs.length > 0) {
                varType = typeArgs[0].getText();
              } else {
                // Try to infer from initializer argument
                const args = callExpr.getArguments();
                if (args.length > 0) {
                  const argType = args[0].getType();
                  varType = argType.getText();
                }
              }

              state[varName] = `${funcName}<${varType}>`;
            }
          }
        }
      } catch (error) {
        debugError('vueComponentExtractor', 'extractVueState', {
          filePath,
          error: error instanceof Error ? error.message : String(error),
          context: 'state-iteration',
        });
      }
    });
  } catch (error) {
    debugError('vueComponentExtractor', 'extractVueState', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }

  return state;
}

/**
 * Extract Vue props (from defineProps)
 */
export function extractVuePropsCall(source: SourceFile): string | null {
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    const callExpressions = source.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const callExpr of callExpressions) {
      try {
        const expr = callExpr.getExpression();

        if (expr.getKind() === SyntaxKind.Identifier) {
          const funcName = expr.getText();

          if (funcName === 'defineProps' || funcName === 'withDefaults') {
            // Return the type argument or runtime props
            const typeArgs = callExpr.getTypeArguments();
            if (typeArgs.length > 0) {
              return typeArgs[0].getText();
            }

            // Check for runtime props object
            const args = callExpr.getArguments();
            if (args.length > 0) {
              return args[0].getText();
            }
          }
        }
      } catch (error) {
        debugError('vueComponentExtractor', 'extractVuePropsCall', {
          filePath,
          error: error instanceof Error ? error.message : String(error),
          context: 'props-iteration',
        });
      }
    }
  } catch (error) {
    debugError('vueComponentExtractor', 'extractVuePropsCall', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  return null;
}

/**
 * Extract Vue emits (from defineEmits)
 */
export function extractVueEmitsCall(source: SourceFile): string[] {
  const emits: string[] = [];
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    const callExpressions = source.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const callExpr of callExpressions) {
      try {
        const expr = callExpr.getExpression();

        if (expr.getKind() === SyntaxKind.Identifier) {
          const funcName = expr.getText();

          if (funcName === 'defineEmits') {
            // Get type argument (e.g., defineEmits<{ (e: 'update', value: string): void }>())
            const typeArgs = callExpr.getTypeArguments();
            if (typeArgs.length > 0) {
              const typeText = typeArgs[0].getText();
              emits.push(typeText);
            }

            // Get runtime array (e.g., defineEmits(['update', 'close']))
            const args = callExpr.getArguments();
            if (args.length > 0) {
              const arg = args[0];
              if (Node.isArrayLiteralExpression(arg)) {
                arg.getElements().forEach((el) => {
                  if (Node.isStringLiteral(el)) {
                    emits.push(el.getText().replace(/['"]/g, ''));
                  }
                });
              }
            }
          }
        }
      } catch (error) {
        debugError('vueComponentExtractor', 'extractVueEmitsCall', {
          filePath,
          error: error instanceof Error ? error.message : String(error),
          context: 'emits-iteration',
        });
      }
    }
  } catch (error) {
    debugError('vueComponentExtractor', 'extractVueEmitsCall', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  return emits;
}

/**
 * Extract Vue props from defineProps into structured Record<string, PropType>
 * Handles both type-based and runtime props definitions
 */
export function extractVueProps(source: SourceFile): Record<string, PropType> {
  const props: Record<string, PropType> = {};
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    const callExpressions = source.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const callExpr of callExpressions) {
      try {
        const expr = callExpr.getExpression();

        if (expr.getKind() === SyntaxKind.Identifier) {
          const funcName = expr.getText();

          if (funcName === 'defineProps' || funcName === 'withDefaults') {
            // Handle type-based props: defineProps<{ name: string, count?: number }>()
            const typeArgs = callExpr.getTypeArguments();
            if (typeArgs.length > 0) {
              const typeNode = typeArgs[0];
              const type = typeNode.getType();

              // Get properties from the type
              try {
                const properties = type.getProperties();
                properties.forEach((prop) => {
                  try {
                    const name = prop.getName();
                    const propType = prop.getTypeAtLocation(typeNode).getText();

                    // Check if optional
                    let isOptional = false;
                    if (propType.includes('undefined')) {
                      isOptional = true;
                    } else {
                      const declarations = prop.getDeclarations();
                      isOptional = declarations.some((decl) => {
                        return (decl as any).hasQuestionToken?.() === true;
                      });
                    }

                    props[name] = normalizePropType(propType, isOptional);
                  } catch (error) {
                    debugError('vueComponentExtractor', 'extractVueProps', {
                      filePath,
                      error: error instanceof Error ? error.message : String(error),
                      context: 'props-type-property',
                    });
                  }
                });
              } catch (error) {
                debugError('vueComponentExtractor', 'extractVueProps', {
                  filePath,
                  error: error instanceof Error ? error.message : String(error),
                  context: 'props-type-parsing',
                });
              }

              // Found props, return early
              return props;
            }

            // Handle runtime props: defineProps({ name: String, count: Number })
            const args = callExpr.getArguments();
            if (args.length > 0) {
              const arg = args[0];
              if (Node.isObjectLiteralExpression(arg)) {
                arg.getProperties().forEach((objProp) => {
                  try {
                    if (Node.isPropertyAssignment(objProp)) {
                      const name = objProp.getName();
                      const initializer = objProp.getInitializer();

                      if (initializer) {
                        // For runtime props, infer type from Vue prop types (String, Number, Boolean, Array, Object)
                        let typeText = initializer.getText();
                        let isOptional = false;

                        // Check if it's an object with type/required/default
                        if (Node.isObjectLiteralExpression(initializer)) {
                          const propObj = initializer;
                          let typeNode = propObj.getProperty('type');
                          let requiredNode = propObj.getProperty('required');
                          let defaultNode = propObj.getProperty('default');

                          if (typeNode && Node.isPropertyAssignment(typeNode)) {
                            typeText = typeNode.getInitializer()?.getText() || 'any';
                          }

                          // If required is false or default exists, it's optional
                          if (requiredNode && Node.isPropertyAssignment(requiredNode)) {
                            const requiredValue = requiredNode.getInitializer()?.getText();
                            if (requiredValue === 'false') {
                              isOptional = true;
                            }
                          } else if (defaultNode) {
                            // Has default value, so optional
                            isOptional = true;
                          }
                        } else {
                          // Direct type constructor (String, Number, etc.)
                          // If it's a direct type, check if there's a default or if it's optional
                          // For Vue runtime props, we can't determine optionality from type alone
                          // We'll mark as required by default unless we detect default
                        }

                        // Map Vue runtime types to TypeScript types
                        const normalizedType = normalizeVueRuntimeType(typeText);
                        props[name] = normalizePropType(normalizedType, isOptional);
                      }
                    } else if (Node.isShorthandPropertyAssignment(objProp)) {
                      // Shorthand property - would need to infer from context
                      const name = objProp.getName();
                      props[name] = 'any';
                    }
                  } catch (error) {
                    debugError('vueComponentExtractor', 'extractVueProps', {
                      filePath,
                      error: error instanceof Error ? error.message : String(error),
                      context: 'props-runtime-property',
                    });
                  }
                });

                // Found runtime props, return
                return props;
              }
            }
          }
        }
      } catch (error) {
        debugError('vueComponentExtractor', 'extractVueProps', {
          filePath,
          error: error instanceof Error ? error.message : String(error),
          context: 'props-iteration',
        });
      }
    }
  } catch (error) {
    debugError('vueComponentExtractor', 'extractVueProps', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }

  return props;
}

/**
 * Extract Vue emits from defineEmits into structured Record<string, EventType>
 * Handles both type-based and runtime emits definitions
 */
export function extractVueEmits(source: SourceFile): Record<string, EventType> {
  const emits: Record<string, EventType> = {};
  const filePath = source.getFilePath?.() ?? 'unknown';

  try {
    const callExpressions = source.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const callExpr of callExpressions) {
      try {
        const expr = callExpr.getExpression();

        if (expr.getKind() === SyntaxKind.Identifier) {
          const funcName = expr.getText();

          if (funcName === 'defineEmits') {
            // Handle type-based emits: defineEmits<{ (e: 'update', value: string): void }>()
            const typeArgs = callExpr.getTypeArguments();
            if (typeArgs.length > 0) {
              const typeNode = typeArgs[0];
              const typeText = typeNode.getText();

              // Parse the type to extract event names and signatures
              // Type format: { (e: 'eventName', ...args): void, (e: 'anotherEvent'): void }
              try {
                // Use regex to extract event signatures from the type
                const eventMatches = typeText.matchAll(/\(e:\s*['"]([^'"]+)['"]([^)]*)\)\s*:\s*void/g);
                for (const match of eventMatches) {
                  const eventName = match[1];
                  const args = match[2].trim();
                  const signature = args ? `(e: '${eventName}', ${args}) => void` : `(e: '${eventName}') => void`;
                  emits[eventName] = {
                    type: 'function',
                    signature,
                  };
                }
              } catch (error) {
                debugError('vueComponentExtractor', 'extractVueEmits', {
                  filePath,
                  error: error instanceof Error ? error.message : String(error),
                  context: 'emits-type-parsing',
                });
              }

              // Found type-based emits, return
              return emits;
            }

            // Handle runtime emits: defineEmits(['update', 'close'])
            const args = callExpr.getArguments();
            if (args.length > 0) {
              const arg = args[0];
              if (Node.isArrayLiteralExpression(arg)) {
                arg.getElements().forEach((el) => {
                  try {
                    if (Node.isStringLiteral(el)) {
                      const eventName = el.getText().replace(/['"]/g, '');
                      emits[eventName] = {
                        type: 'function',
                        signature: `(e: '${eventName}') => void`,
                      };
                    }
                  } catch (error) {
                    debugError('vueComponentExtractor', 'extractVueEmits', {
                      filePath,
                      error: error instanceof Error ? error.message : String(error),
                      context: 'emits-runtime-element',
                    });
                  }
                });

                // Found runtime emits, return
                return emits;
              }
            }
          }
        }
      } catch (error) {
        debugError('vueComponentExtractor', 'extractVueEmits', {
          filePath,
          error: error instanceof Error ? error.message : String(error),
          context: 'emits-iteration',
        });
      }
    }
  } catch (error) {
    debugError('vueComponentExtractor', 'extractVueEmits', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }

  return emits;
}

/**
 * Normalize Vue runtime prop types to TypeScript types
 */
function normalizeVueRuntimeType(vueType: string): string {
  // Map Vue runtime prop types to TypeScript types
  const typeMap: Record<string, string> = {
    'String': 'string',
    'Number': 'number',
    'Boolean': 'boolean',
    'Array': 'any[]',
    'Object': 'object',
    'Function': 'function',
    'Date': 'Date',
  };

  // Check if it's a direct match
  if (typeMap[vueType]) {
    return typeMap[vueType];
  }

  // Check if it's an array type: Array as () => String[]
  const arrayMatch = vueType.match(/Array\s*as\s*\(\)\s*=>\s*(\w+)\[\]/);
  if (arrayMatch) {
    const elementType = typeMap[arrayMatch[1]] || 'any';
    return `${elementType}[]`;
  }

  // Return as-is if we can't normalize
  return vueType;
}
