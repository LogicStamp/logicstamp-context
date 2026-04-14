/**
 * Chakra UI extractor - Extracts Chakra UI component library usage
 */

import {
  type SourceFile,
  SyntaxKind,
  type JsxAttribute,
  type JsxElement,
  type JsxSelfClosingElement,
  type JsxExpression,
} from 'ts-morph';
import { debugError } from '../../utils/debug.js';

/**
 * Common Chakra UI component names
 */
const CHAKRA_COMPONENTS = [
  'Accordion',
  'Alert',
  'AlertDialog',
  'AspectRatio',
  'Avatar',
  'Badge',
  'Box',
  'Breadcrumb',
  'Button',
  'Card',
  'Checkbox',
  'CircularProgress',
  'CloseButton',
  'Code',
  'Collapse',
  'Container',
  'Divider',
  'Drawer',
  'Editable',
  'Flex',
  'FormControl',
  'FormLabel',
  'FormErrorMessage',
  'FormHelperText',
  'Grid',
  'Heading',
  'HStack',
  'Icon',
  'IconButton',
  'Image',
  'Input',
  'InputGroup',
  'InputLeftElement',
  'InputRightElement',
  'Link',
  'List',
  'ListItem',
  'Menu',
  'MenuItem',
  'Modal',
  'NumberInput',
  'Popover',
  'Progress',
  'Radio',
  'RadioGroup',
  'Select',
  'SimpleGrid',
  'Skeleton',
  'Slider',
  'Spinner',
  'Stack',
  'Stat',
  'Switch',
  'Table',
  'Tabs',
  'Tag',
  'Text',
  'Textarea',
  'Tooltip',
  'VStack',
  'Wrap',
  'WrapItem',
];

/**
 * Chakra UI package patterns
 */
const CHAKRA_PACKAGE_PATTERNS = [/^@chakra-ui\//];

/**
 * Extract Chakra UI usage from a source file
 */
export function extractChakraUI(source: SourceFile): {
  components: string[];
  packages: string[];
  features: {
    usesTheme?: boolean;
    usesColorMode?: boolean;
    usesResponsiveProps?: boolean;
    usesSystemProps?: boolean;
  };
} {
  try {
    // Track component usage counts so we can rank by frequency
    const componentCounts = new Map<string, number>();
    const packages = new Set<string>();
    const localToChakra = new Map<string, string>(); // local alias → canonical Chakra component

    // Cache import declarations for reuse across multiple checks
    let importDeclarations = [] as ReturnType<
      SourceFile['getImportDeclarations']
    >;
    try {
      importDeclarations = source.getImportDeclarations();
    } catch (error) {
      debugError('chakra', 'extractChakraUI', {
        error: error instanceof Error ? error.message : String(error),
        context: 'getImportDeclarations',
      });
      // Continue with empty array - imports won't be detected but other checks can proceed
    }

    // Check for Chakra UI imports
    try {
      importDeclarations.forEach((imp) => {
        const moduleSpecifier = imp.getModuleSpecifierValue();

        // Check if it's a Chakra UI package
        const isChakraPackage = CHAKRA_PACKAGE_PATTERNS.some((pattern) =>
          pattern.test(moduleSpecifier),
        );

        if (isChakraPackage) {
          packages.add(moduleSpecifier);

          // Extract component names from imports (including aliases)
          const namedImports = imp.getNamedImports();
          namedImports.forEach((namedImport) => {
            const importName = namedImport.getName(); // canonical name
            const aliasNode = namedImport.getAliasNode();
            const localName = aliasNode?.getText() ?? importName; // local alias or original

            if (CHAKRA_COMPONENTS.includes(importName)) {
              componentCounts.set(
                importName,
                (componentCounts.get(importName) ?? 0) + 1,
              );
              localToChakra.set(localName, importName);
              localToChakra.set(importName, importName); // self-map
            }
          });

          // Default imports (e.g., import Button from "@chakra-ui/react")
          const defaultImport = imp.getDefaultImport();
          if (defaultImport) {
            const aliasName = defaultImport.getText();
            // Try to derive canonical name from module specifier path
            const pathSegments = moduleSpecifier.split('/');
            const canonicalName = pathSegments[pathSegments.length - 1];

            if (CHAKRA_COMPONENTS.includes(canonicalName)) {
              componentCounts.set(
                canonicalName,
                (componentCounts.get(canonicalName) ?? 0) + 1,
              );
              localToChakra.set(aliasName, canonicalName);
              localToChakra.set(canonicalName, canonicalName); // self-map
            }
            // Fallback: check if alias itself is a known component
            else if (CHAKRA_COMPONENTS.includes(aliasName)) {
              componentCounts.set(
                aliasName,
                (componentCounts.get(aliasName) ?? 0) + 1,
              );
              localToChakra.set(aliasName, aliasName);
            }
          }
        }
      });
    } catch (error) {
      debugError('chakra', 'extractChakraUI', {
        error: error instanceof Error ? error.message : String(error),
        context: 'extractChakraUIImports',
      });
      // Continue with empty imports - can still check JSX usage
    }

    const hasChakraImports = packages.size > 0;

    // Also check for component usage in JSX using AST – but only trust it if we saw Chakra imports
    let jsxElements: (JsxElement | JsxSelfClosingElement)[] = [];
    try {
      jsxElements = [
        ...source.getDescendantsOfKind(SyntaxKind.JsxElement),
        ...source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ];
    } catch (error) {
      debugError('chakra', 'extractChakraUI', {
        error: error instanceof Error ? error.message : String(error),
        context: 'getJsxElements',
      });
      // Continue with empty array - will skip JSX-based component detection
    }

    if (hasChakraImports) {
      try {
        for (const element of jsxElements) {
          const openingElement =
            'getOpeningElement' in element
              ? element.getOpeningElement()
              : element;

          const rawTag = openingElement.getTagNameNode().getText();

          // Handle namespace tags like <Box.Root> or <Button.Group>
          const baseTag = rawTag.includes('.') ? rawTag.split('.')[0] : rawTag;

          // Map local alias back to canonical Chakra component name
          const componentName = localToChakra.get(baseTag) ?? baseTag;

          if (CHAKRA_COMPONENTS.includes(componentName)) {
            componentCounts.set(
              componentName,
              (componentCounts.get(componentName) ?? 0) + 1,
            );
          }
        }
      } catch (error) {
        debugError('chakra', 'extractChakraUI', {
          error: error instanceof Error ? error.message : String(error),
          context: 'processJsxElements',
        });
        // Continue - component detection may be incomplete but not fatal
      }
    }

    const usesChakra = hasChakraImports || componentCounts.size > 0;

    // Check for theme usage using AST
    let usesTheme = false;
    try {
      usesTheme =
        source
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .some((callExpr) => {
            const expr = callExpr.getExpression();
            if (expr.getKind() !== SyntaxKind.Identifier) return false;
            const name = expr.getText();
            return (
              name === 'useTheme' ||
              name === 'extendTheme' ||
              name === 'createTheme'
            );
          }) ||
        importDeclarations.some((imp) => {
          // Named ChakraProvider or ThemeProvider import
          return imp
            .getNamedImports()
            .some(
              (n) =>
                n.getName() === 'ChakraProvider' ||
                n.getName() === 'ThemeProvider',
            );
        }) ||
        // theme.property access
        source
          .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
          .some((propAccess) => {
            const expr = propAccess.getExpression();
            return (
              expr.getKind() === SyntaxKind.Identifier &&
              expr.getText() === 'theme'
            );
          });
    } catch (error) {
      debugError('chakra', 'extractChakraUI', {
        error: error instanceof Error ? error.message : String(error),
        context: 'checkThemeUsage',
      });
      // Default to false on error
    }

    // Check for color mode usage (dark/light mode)
    let usesColorMode = false;
    try {
      usesColorMode =
        usesChakra &&
        (source
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .some((callExpr) => {
            const expr = callExpr.getExpression();
            if (expr.getKind() !== SyntaxKind.Identifier) return false;
            const name = expr.getText();
            return name === 'useColorMode' || name === 'useColorModeValue';
          }) ||
          importDeclarations.some((imp) => {
            return imp
              .getNamedImports()
              .some(
                (n) =>
                  n.getName() === 'useColorMode' ||
                  n.getName() === 'useColorModeValue' ||
                  n.getName() === 'ColorModeScript',
              );
          }) ||
          // colorMode property access
          source
            .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
            .some((propAccess) => {
              const expr = propAccess.getExpression();
              return (
                expr.getKind() === SyntaxKind.Identifier &&
                expr.getText() === 'colorMode'
              );
            }));
    } catch (error) {
      debugError('chakra', 'extractChakraUI', {
        error: error instanceof Error ? error.message : String(error),
        context: 'checkColorModeUsage',
      });
      // Default to false on error
    }

    // Check for responsive props (Chakra uses array syntax: [base, md, lg])
    let usesResponsiveProps = false;
    try {
      usesResponsiveProps =
        usesChakra &&
        jsxElements.some((element) => {
          const openingElement =
            'getOpeningElement' in element
              ? element.getOpeningElement()
              : element;

          const rawTag = openingElement.getTagNameNode().getText();
          const baseTag = rawTag.includes('.') ? rawTag.split('.')[0] : rawTag;
          const componentName = localToChakra.get(baseTag) ?? baseTag;

          if (!CHAKRA_COMPONENTS.includes(componentName)) {
            return false;
          }

          const attributes = openingElement.getAttributes();
          return attributes.some((attr: any) => {
            if (attr.getKind() !== SyntaxKind.JsxAttribute) return false;
            const jsxAttr = attr as JsxAttribute;
            const initializer = jsxAttr.getInitializer();

            // Check for array syntax in prop values (responsive props)
            if (
              initializer &&
              initializer.getKind() === SyntaxKind.JsxExpression
            ) {
              const jsxExpr = initializer as JsxExpression;
              const expr = jsxExpr.getExpression();
              return (
                expr && expr.getKind() === SyntaxKind.ArrayLiteralExpression
              );
            }
            return false;
          });
        });
    } catch (error) {
      debugError('chakra', 'extractChakraUI', {
        error: error instanceof Error ? error.message : String(error),
        context: 'checkResponsivePropsUsage',
      });
      // Default to false on error
    }

    // Check for system props (spacing, color, etc. on Box/Stack/Flex components)
    const systemProps = [
      'p',
      'px',
      'py',
      'pt',
      'pb',
      'pl',
      'pr',
      'm',
      'mx',
      'my',
      'mt',
      'mb',
      'ml',
      'mr',
      'w',
      'h',
      'minW',
      'minH',
      'maxW',
      'maxH',
      'bg',
      'color',
      'border',
      'rounded',
      'shadow',
      'opacity',
      'zIndex',
      'position',
      'top',
      'right',
      'bottom',
      'left',
    ];

    let usesSystemProps = false;
    try {
      usesSystemProps =
        usesChakra &&
        jsxElements.some((element) => {
          const openingElement =
            'getOpeningElement' in element
              ? element.getOpeningElement()
              : element;

          const rawTag = openingElement.getTagNameNode().getText();
          const baseTag = rawTag.includes('.') ? rawTag.split('.')[0] : rawTag;
          const componentName = localToChakra.get(baseTag) ?? baseTag;

          if (
            ![
              'Box',
              'Stack',
              'Flex',
              'HStack',
              'VStack',
              'Grid',
              'SimpleGrid',
            ].includes(componentName)
          ) {
            return false;
          }

          const attributes = openingElement.getAttributes();
          return attributes.some((attr: any) => {
            if (attr.getKind() !== SyntaxKind.JsxAttribute) return false;
            const jsxAttr = attr as JsxAttribute;
            const attrName = jsxAttr.getNameNode().getText();
            return systemProps.includes(attrName);
          });
        });
    } catch (error) {
      debugError('chakra', 'extractChakraUI', {
        error: error instanceof Error ? error.message : String(error),
        context: 'checkSystemPropsUsage',
      });
      // Default to false on error
    }

    // Rank components by frequency, then alphabetically, and return up to 20
    let components: string[] = [];
    try {
      components = Array.from(componentCounts.entries())
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1]; // by count desc
          return a[0].localeCompare(b[0]); // then alpha
        })
        .slice(0, 20)
        .map(([name]) => name);
    } catch (error) {
      debugError('chakra', 'extractChakraUI', {
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
        ...(usesColorMode && { usesColorMode: true }),
        ...(usesResponsiveProps && { usesResponsiveProps: true }),
        ...(usesSystemProps && { usesSystemProps: true }),
      },
    };
  } catch (error) {
    debugError('chakra', 'extractChakraUI', {
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
