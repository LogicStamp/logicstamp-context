/**
 * Ant Design extractor - Extracts Ant Design component library usage
 */

import { SourceFile, SyntaxKind, JsxAttribute, JsxElement, JsxSelfClosingElement } from 'ts-morph';
import { debugError } from '../../utils/debug.js';

/**
 * Common Ant Design component names
 */
const ANT_COMPONENTS = [
  'Affix', 'Alert', 'Anchor', 'AutoComplete', 'Avatar', 'BackTop', 'Badge', 'Breadcrumb',
  'Button', 'Calendar', 'Card', 'Carousel', 'Cascader', 'Checkbox', 'Col', 'Collapse',
  'Comment', 'ConfigProvider', 'DatePicker', 'Descriptions', 'Divider', 'Drawer', 'Dropdown',
  'Empty', 'Form', 'Grid', 'Image', 'Input', 'InputNumber', 'Layout', 'List', 'Mentions',
  'Menu', 'Modal', 'Notification', 'PageHeader', 'Pagination', 'Popconfirm', 'Popover',
  'Progress', 'Radio', 'Rate', 'Result', 'Row', 'Select', 'Skeleton', 'Slider', 'Space',
  'Spin', 'Statistic', 'Steps', 'Switch', 'Table', 'Tabs', 'Tag', 'TimePicker', 'Timeline',
  'Tooltip', 'Transfer', 'Tree', 'TreeSelect', 'Typography', 'Upload', 'Watermark',
];

/**
 * Ant Design package patterns
 */
const ANT_PACKAGE_PATTERNS = [
  /^antd$/,
  /^@ant-design\//,
];

/**
 * Extract Ant Design usage from a source file
 */
export function extractAntDesign(source: SourceFile): {
  components: string[];
  packages: string[];
  features: {
    usesTheme?: boolean;
    usesConfigProvider?: boolean;
    usesForm?: boolean;
    usesLocale?: boolean;
    usesIcons?: boolean;
  };
} {
  try {
    // Track component usage counts so we can rank by frequency
    const componentCounts = new Map<string, number>();
    const packages = new Set<string>();
    const localToAnt = new Map<string, string>(); // local alias → canonical Ant component

    // Cache import declarations for reuse across multiple checks
    let importDeclarations = [] as ReturnType<SourceFile['getImportDeclarations']>;
    try {
      importDeclarations = source.getImportDeclarations();
    } catch (error) {
      debugError('antd', 'extractAntDesign', {
        error: error instanceof Error ? error.message : String(error),
        context: 'getImportDeclarations',
      });
      // Continue with empty array - imports won't be detected but other checks can proceed
    }

    // Check for Ant Design imports
    try {
      importDeclarations.forEach(imp => {
        const moduleSpecifier = imp.getModuleSpecifierValue();

        // Check if it's an Ant Design package (including subpath imports like "antd/es/date-picker")
        // Note: /^antd$/ only matches exactly "antd", so we need to check for subpaths separately
        const isAntPackage = ANT_PACKAGE_PATTERNS.some(pattern => pattern.test(moduleSpecifier)) ||
          moduleSpecifier.startsWith('antd/');

        if (isAntPackage) {
          packages.add(moduleSpecifier);

          // Check for subpath imports (e.g., import Button from "antd/es/date-picker")
          // Subpaths don't match the exact patterns (/^antd$/ only matches "antd" exactly)
          if (moduleSpecifier.includes('/') && !ANT_PACKAGE_PATTERNS.some(pattern => pattern.test(moduleSpecifier))) {
            const pathSegments = moduleSpecifier.split('/');
            const lastSegment = pathSegments[pathSegments.length - 1];
            // Convert kebab-case to PascalCase (e.g., "date-picker" -> "DatePicker")
            const pascalCase = lastSegment
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join('');
            
            if (ANT_COMPONENTS.includes(pascalCase)) {
              const namedImports = imp.getNamedImports();
              namedImports.forEach(namedImport => {
                const importName = namedImport.getName();
                componentCounts.set(pascalCase, (componentCounts.get(pascalCase) ?? 0) + 1);
                localToAnt.set(importName, pascalCase);
                localToAnt.set(pascalCase, pascalCase); // self-map
              });
              
              // Also handle default imports from subpaths
              const defaultImport = imp.getDefaultImport();
              if (defaultImport) {
                const aliasName = defaultImport.getText();
                componentCounts.set(pascalCase, (componentCounts.get(pascalCase) ?? 0) + 1);
                localToAnt.set(aliasName, pascalCase);
              }
            }
          } else {
            // Extract component names from imports (including aliases)
            const namedImports = imp.getNamedImports();
            namedImports.forEach(namedImport => {
              const importName = namedImport.getName(); // canonical name
              const aliasNode = namedImport.getAliasNode();
              const localName = aliasNode?.getText() ?? importName; // local alias or original

              if (ANT_COMPONENTS.includes(importName)) {
                componentCounts.set(importName, (componentCounts.get(importName) ?? 0) + 1);
                localToAnt.set(localName, importName);
                localToAnt.set(importName, importName); // self-map
              }
            });

            // Default imports (e.g., import Button from "antd")
            const defaultImport = imp.getDefaultImport();
            if (defaultImport) {
              const aliasName = defaultImport.getText();
              // For default imports from "antd", we can't determine the component name
              // But we can check if the alias matches a known component
              if (ANT_COMPONENTS.includes(aliasName)) {
                componentCounts.set(aliasName, (componentCounts.get(aliasName) ?? 0) + 1);
                localToAnt.set(aliasName, aliasName);
              }
            }
          }
        }
      });
    } catch (error) {
      debugError('antd', 'extractAntDesign', {
        error: error instanceof Error ? error.message : String(error),
        context: 'extractAntDesignImports',
      });
      // Continue with empty imports - can still check JSX usage
    }

    const hasAntImports = packages.size > 0;

    // Also check for component usage in JSX using AST – but only trust it if we saw Ant imports
    let jsxElements: (JsxElement | JsxSelfClosingElement)[] = [];
    try {
      jsxElements = [
        ...source.getDescendantsOfKind(SyntaxKind.JsxElement),
        ...source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ];
    } catch (error) {
      debugError('antd', 'extractAntDesign', {
        error: error instanceof Error ? error.message : String(error),
        context: 'getJsxElements',
      });
      // Continue with empty array - will skip JSX-based component detection
    }

    if (hasAntImports) {
      try {
        for (const element of jsxElements) {
          const openingElement = 'getOpeningElement' in element
            ? element.getOpeningElement()
            : element;

          const rawTag = openingElement.getTagNameNode().getText();

          // Handle namespace tags like <Form.Item> or <Table.Column>
          const baseTag = rawTag.includes('.')
            ? rawTag.split('.')[0]
            : rawTag;

          // Map local alias back to canonical Ant component name
          const componentName = localToAnt.get(baseTag) ?? baseTag;

          if (ANT_COMPONENTS.includes(componentName)) {
            componentCounts.set(componentName, (componentCounts.get(componentName) ?? 0) + 1);
          }
        }
      } catch (error) {
        debugError('antd', 'extractAntDesign', {
          error: error instanceof Error ? error.message : String(error),
          context: 'processJsxElements',
        });
        // Continue - component detection may be incomplete but not fatal
      }
    }

    const usesAnt = hasAntImports || componentCounts.size > 0;

    // Check for theme usage using AST
    let usesTheme = false;
    try {
      usesTheme =
        source.getDescendantsOfKind(SyntaxKind.CallExpression).some(callExpr => {
          const expr = callExpr.getExpression();
          if (expr.getKind() !== SyntaxKind.Identifier) return false;
          const name = expr.getText();
          return name === 'theme' || name === 'useToken' || name === 'getDesignToken';
        }) ||
        importDeclarations.some(imp => {
          // Named ConfigProvider or ThemeProvider import
          return imp.getNamedImports().some(n => 
            n.getName() === 'ConfigProvider' || n.getName() === 'ThemeProvider'
          );
        }) ||
        // theme.property access
        source.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some(propAccess => {
          const expr = propAccess.getExpression();
          return expr.getKind() === SyntaxKind.Identifier && expr.getText() === 'theme';
        });
    } catch (error) {
      debugError('antd', 'extractAntDesign', {
        error: error instanceof Error ? error.message : String(error),
        context: 'checkThemeUsage',
      });
      // Default to false on error
    }

    // Check for ConfigProvider usage (Ant Design's main configuration component)
    let usesConfigProvider = false;
    try {
      usesConfigProvider =
        usesAnt &&
        (source.getDescendantsOfKind(SyntaxKind.JsxElement).some(element => {
          const openingElement = element.getOpeningElement();
          const tagName = openingElement.getTagNameNode().getText();
          const baseTag = tagName.includes('.') ? tagName.split('.')[0] : tagName;
          return localToAnt.get(baseTag) === 'ConfigProvider' || baseTag === 'ConfigProvider';
        }) ||
        importDeclarations.some(imp => {
          return imp.getNamedImports().some(n => n.getName() === 'ConfigProvider');
        }));
    } catch (error) {
      debugError('antd', 'extractAntDesign', {
        error: error instanceof Error ? error.message : String(error),
        context: 'checkConfigProviderUsage',
      });
      // Default to false on error
    }

    // Check for Form usage (Ant Design has extensive form features)
    let usesForm = false;
    try {
      usesForm =
        usesAnt &&
        (componentCounts.has('Form') ||
        jsxElements.some(element => {
          const openingElement = 'getOpeningElement' in element
            ? element.getOpeningElement()
            : element;
          const rawTag = openingElement.getTagNameNode().getText();
          const baseTag = rawTag.includes('.') ? rawTag.split('.')[0] : rawTag;
          const componentName = localToAnt.get(baseTag) ?? baseTag;
          return componentName === 'Form' || rawTag.startsWith('Form.');
        }));
    } catch (error) {
      debugError('antd', 'extractAntDesign', {
        error: error instanceof Error ? error.message : String(error),
        context: 'checkFormUsage',
      });
      // Default to false on error
    }

    // Check for locale/internationalization usage
    let usesLocale = false;
    try {
      usesLocale =
        usesAnt &&
        (source.getDescendantsOfKind(SyntaxKind.CallExpression).some(callExpr => {
          const expr = callExpr.getExpression();
          if (expr.getKind() !== SyntaxKind.Identifier) return false;
          const name = expr.getText();
          return name === 'useLocale' || name === 'getLocale';
        }) ||
        importDeclarations.some(imp => {
          const moduleSpecifier = imp.getModuleSpecifierValue();
          return moduleSpecifier.includes('locale') || moduleSpecifier.includes('i18n');
        }) ||
        jsxElements.some(element => {
          const openingElement = 'getOpeningElement' in element
            ? element.getOpeningElement()
            : element;
          const attributes = openingElement.getAttributes();
          return attributes.some((attr: any) => {
            if (attr.getKind() !== SyntaxKind.JsxAttribute) return false;
            const jsxAttr = attr as JsxAttribute;
            const attrName = jsxAttr.getNameNode().getText();
            return attrName === 'locale';
          });
        }));
    } catch (error) {
      debugError('antd', 'extractAntDesign', {
        error: error instanceof Error ? error.message : String(error),
        context: 'checkLocaleUsage',
      });
      // Default to false on error
    }

    // Check for icons usage (@ant-design/icons)
    let usesIcons = false;
    try {
      usesIcons =
        importDeclarations.some(imp => {
          const moduleSpecifier = imp.getModuleSpecifierValue();
          return moduleSpecifier === '@ant-design/icons' || moduleSpecifier.startsWith('@ant-design/icons/');
        }) ||
        source.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some(propAccess => {
          const expr = propAccess.getExpression();
          return expr.getKind() === SyntaxKind.Identifier && 
            (expr.getText() === 'icons' || expr.getText() === 'Icon');
        });
    } catch (error) {
      debugError('antd', 'extractAntDesign', {
        error: error instanceof Error ? error.message : String(error),
        context: 'checkIconsUsage',
      });
      // Default to false on error
    }

    // Rank components by frequency, then alphabetically, and return up to 20
    let components: string[] = [];
    try {
      components = Array.from(componentCounts.entries())
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1]; // by count desc
          return a[0].localeCompare(b[0]);       // then alpha
        })
        .slice(0, 20)
        .map(([name]) => name);
    } catch (error) {
      debugError('antd', 'extractAntDesign', {
        error: error instanceof Error ? error.message : String(error),
        context: 'rankComponents',
      });
      // Default to empty array on error
    }

    return {
      components, // up to 20 components, ranked by usage frequency
      packages: Array.from(packages).sort(),
      features: {
        ...(usesTheme && { usesTheme: true }),
        ...(usesConfigProvider && { usesConfigProvider: true }),
        ...(usesForm && { usesForm: true }),
        ...(usesLocale && { usesLocale: true }),
        ...(usesIcons && { usesIcons: true }),
      },
    };
  } catch (error) {
    debugError('antd', 'extractAntDesign', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Return empty/default values on unexpected errors
    return {
      components: [],
      packages: [],
      features: {},
    };
  }
}
