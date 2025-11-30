/**
 * Material UI extractor - Extracts Material UI component library usage
 */

import { SourceFile, SyntaxKind, JsxAttribute, JsxElement, JsxSelfClosingElement } from 'ts-morph';
import { debugError } from '../../utils/debug.js';

/**
 * Common Material UI component names
 */
const MUI_COMPONENTS = [
  'Accordion', 'Alert', 'AppBar', 'Autocomplete', 'Avatar', 'Backdrop', 'Badge', 'BottomNavigation',
  'Box', 'Breadcrumbs', 'Button', 'ButtonGroup', 'Card', 'Checkbox', 'Chip', 'CircularProgress',
  'Container', 'CssBaseline', 'Dialog', 'Divider', 'Drawer', 'Fab', 'FormControl', 'FormGroup',
  'FormLabel', 'Grid', 'Icon', 'IconButton', 'Input', 'InputAdornment', 'InputBase', 'InputLabel',
  'LinearProgress', 'Link', 'List', 'ListItem', 'ListItemButton', 'ListItemIcon', 'ListItemText',
  'Menu', 'MenuItem', 'MobileStepper', 'Modal', 'NativeSelect', 'Pagination', 'Paper', 'Popover',
  'Popper', 'Radio', 'RadioGroup', 'Rating', 'Select', 'Skeleton', 'Slider', 'Snackbar',
  'SpeedDial', 'Stack', 'Stepper', 'Switch', 'Tab', 'Table', 'TableBody', 'TableCell',
  'TableContainer', 'TableFooter', 'TableHead', 'TablePagination', 'TableRow', 'Tabs', 'TextField',
  'ToggleButton', 'ToggleButtonGroup', 'Toolbar', 'Tooltip', 'Typography', 'Zoom',
];

/**
 * Material UI package patterns
 */
const MUI_PACKAGE_PATTERNS = [
  /^@mui\//,
  /^@material-ui\//,
];

/**
 * Extract Material UI usage from a source file
 */
export function extractMaterialUI(source: SourceFile): {
  components: string[];
  packages: string[];
  features: {
    usesTheme?: boolean;
    usesSxProp?: boolean;
    usesStyled?: boolean;
    usesMakeStyles?: boolean;
    usesSystemProps?: boolean;
  };
} {
  try {
    // Track component usage counts so we can rank by frequency
    const componentCounts = new Map<string, number>();
    const packages = new Set<string>();
    const localToMui = new Map<string, string>(); // local alias → canonical MUI component

    // Cache import declarations for reuse across multiple checks
    let importDeclarations = [] as ReturnType<SourceFile['getImportDeclarations']>;
    try {
      importDeclarations = source.getImportDeclarations();
    } catch (error) {
      debugError('material', 'extractMaterialUI', {
        error: error instanceof Error ? error.message : String(error),
        context: 'getImportDeclarations',
      });
      // Continue with empty array - imports won't be detected but other checks can proceed
    }

    // Check for Material UI imports
    try {
      importDeclarations.forEach(imp => {
        const moduleSpecifier = imp.getModuleSpecifierValue();

        // Check if it's a Material UI package
        const isMuiPackage = MUI_PACKAGE_PATTERNS.some(pattern => pattern.test(moduleSpecifier));

        if (isMuiPackage) {
          packages.add(moduleSpecifier);

          // Extract component names from imports (including aliases)
          const namedImports = imp.getNamedImports();
          namedImports.forEach(namedImport => {
            const importName = namedImport.getName(); // canonical name
            const aliasNode = namedImport.getAliasNode();
            const localName = aliasNode?.getText() ?? importName; // local alias or original

            if (MUI_COMPONENTS.includes(importName)) {
              componentCounts.set(importName, (componentCounts.get(importName) ?? 0) + 1);
              localToMui.set(localName, importName);
              localToMui.set(importName, importName); // self-map
            }
          });

          // Default imports (e.g., import Button from "@mui/material/Button")
          // Also handles aliases: import Btn from "@mui/material/Button"
          const defaultImport = imp.getDefaultImport();
          if (defaultImport) {
            const aliasName = defaultImport.getText();
            // Try to derive canonical name from module specifier path
            // e.g., "@mui/material/Button" -> "Button"
            const pathSegments = moduleSpecifier.split('/');
            const canonicalName = pathSegments[pathSegments.length - 1];
            
            if (MUI_COMPONENTS.includes(canonicalName)) {
              componentCounts.set(canonicalName, (componentCounts.get(canonicalName) ?? 0) + 1);
              localToMui.set(aliasName, canonicalName);
              localToMui.set(canonicalName, canonicalName); // self-map
            }
            // Fallback: check if alias itself is a known component
            else if (MUI_COMPONENTS.includes(aliasName)) {
              componentCounts.set(aliasName, (componentCounts.get(aliasName) ?? 0) + 1);
              localToMui.set(aliasName, aliasName);
            }
          }
        }
      });
    } catch (error) {
      debugError('material', 'extractMaterialUI', {
        error: error instanceof Error ? error.message : String(error),
        context: 'extractMaterialUIImports',
      });
      // Continue with empty imports - can still check JSX usage
    }

    const hasMuiImports = packages.size > 0;

    // Also check for component usage in JSX using AST – but only trust it if we saw MUI imports
    let jsxElements: (JsxElement | JsxSelfClosingElement)[] = [];
    try {
      jsxElements = [
        ...source.getDescendantsOfKind(SyntaxKind.JsxElement),
        ...source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
      ];
    } catch (error) {
      debugError('material', 'extractMaterialUI', {
        error: error instanceof Error ? error.message : String(error),
        context: 'getJsxElements',
      });
      // Continue with empty array - will skip JSX-based component detection
    }

    if (hasMuiImports) {
      try {
        for (const element of jsxElements) {
          const openingElement = 'getOpeningElement' in element
            ? element.getOpeningElement()
            : element;

          const rawTag = openingElement.getTagNameNode().getText();

          // Handle namespace tags like <Box.Root> or <Grid.Item>
          const baseTag = rawTag.includes('.')
            ? rawTag.split('.')[0]
            : rawTag;

          // Map local alias back to canonical MUI component name
          const componentName = localToMui.get(baseTag) ?? baseTag;

          if (MUI_COMPONENTS.includes(componentName)) {
            componentCounts.set(componentName, (componentCounts.get(componentName) ?? 0) + 1);
          }
        }
      } catch (error) {
        debugError('material', 'extractMaterialUI', {
          error: error instanceof Error ? error.message : String(error),
          context: 'processJsxElements',
        });
        // Continue - component detection may be incomplete but not fatal
      }
    }

    const usesMui = hasMuiImports || componentCounts.size > 0;

    // Check for theme usage using AST
    let usesTheme = false;
    try {
      usesTheme =
        source.getDescendantsOfKind(SyntaxKind.CallExpression).some(callExpr => {
          const expr = callExpr.getExpression();
          if (expr.getKind() !== SyntaxKind.Identifier) return false;
          const name = expr.getText();
          return name === 'useTheme' || name === 'createTheme';
        }) ||
        importDeclarations.some(imp => {
          // Named ThemeProvider import from any MUI package
          return imp.getNamedImports().some(n => n.getName() === 'ThemeProvider');
        }) ||
        // theme.property access
        source.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some(propAccess => {
          const expr = propAccess.getExpression();
          return expr.getKind() === SyntaxKind.Identifier && expr.getText() === 'theme';
        }) ||
        // theme usage in tagged template literals (styled, emotion, etc.)
        source.getDescendantsOfKind(SyntaxKind.TaggedTemplateExpression).some(taggedTemplate => {
          const template = taggedTemplate.getTemplate();
          const text = template.getText();
          return /theme\./.test(text);
        });
    } catch (error) {
      debugError('material', 'extractMaterialUI', {
        error: error instanceof Error ? error.message : String(error),
        context: 'checkThemeUsage',
      });
      // Default to false on error
    }

    // Check for sx prop usage (only meaningful if MUI is present)
    let usesSxProp = false;
    try {
      usesSxProp =
        usesMui &&
        source.getDescendantsOfKind(SyntaxKind.JsxAttribute).some(attr => {
          const jsxAttr = attr as JsxAttribute;
          const attrName = jsxAttr.getNameNode().getText();
          return attrName === 'sx';
        });
    } catch (error) {
      debugError('material', 'extractMaterialUI', {
        error: error instanceof Error ? error.message : String(error),
        context: 'checkSxPropUsage',
      });
      // Default to false on error
    }

    // Check for styled from MUI styles packages using AST
    let usesStyled = false;
    try {
      usesStyled =
        importDeclarations.some(imp => {
          const mod = imp.getModuleSpecifierValue();
          const isMuiStyles = [
            '@mui/material/styles',
            '@mui/styles',
            '@mui/system',
            '@material-ui/core/styles',
            '@material-ui/styles',
          ].includes(mod);

          if (!isMuiStyles) return false;

          // styled as named or default import
          if (imp.getNamedImports().some(n => n.getName() === 'styled')) return true;
          const def = imp.getDefaultImport();
          return def?.getText() === 'styled';
        }) ||
        // fallback: call expression named styled, but only if we know MUI is present
        (usesMui &&
          source.getDescendantsOfKind(SyntaxKind.CallExpression).some(callExpr => {
            const expr = callExpr.getExpression();
            return expr.getKind() === SyntaxKind.Identifier && expr.getText() === 'styled';
          }));
    } catch (error) {
      debugError('material', 'extractMaterialUI', {
        error: error instanceof Error ? error.message : String(error),
        context: 'checkStyledUsage',
      });
      // Default to false on error
    }

    // Check for makeStyles (legacy Material UI styling) using AST
    let usesMakeStyles = false;
    try {
      usesMakeStyles =
        source.getDescendantsOfKind(SyntaxKind.CallExpression).some(callExpr => {
          const expr = callExpr.getExpression();
          return expr.getKind() === SyntaxKind.Identifier && expr.getText() === 'makeStyles';
        }) ||
        importDeclarations.some(imp => {
          const mod = imp.getModuleSpecifierValue();
          return mod === '@mui/styles' || mod === '@material-ui/styles';
        });
    } catch (error) {
      debugError('material', 'extractMaterialUI', {
        error: error instanceof Error ? error.message : String(error),
        context: 'checkMakeStylesUsage',
      });
      // Default to false on error
    }

    // Check for system props (spacing, color, etc. on Box/Stack components) using AST
    const systemProps = [
      'spacing', 'color', 'bgcolor', 'p', 'm', 'px', 'py', 'mx', 'my',
      'pt', 'pb', 'pl', 'pr', 'mt', 'mb', 'ml', 'mr',
    ];

    let usesSystemProps = false;
    try {
      usesSystemProps =
        usesMui &&
        jsxElements.some(element => {
          const openingElement = 'getOpeningElement' in element
            ? element.getOpeningElement()
            : element;

          const rawTag = openingElement.getTagNameNode().getText();
          const baseTag = rawTag.includes('.') ? rawTag.split('.')[0] : rawTag;
          const componentName = localToMui.get(baseTag) ?? baseTag;

          if (!['Box', 'Stack', 'Grid', 'Container'].includes(componentName)) {
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
      debugError('material', 'extractMaterialUI', {
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
          return a[0].localeCompare(b[0]);       // then alpha
        })
        .slice(0, 20)
        .map(([name]) => name);
    } catch (error) {
      debugError('material', 'extractMaterialUI', {
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
        ...(usesSxProp && { usesSxProp: true }),
        ...(usesStyled && { usesStyled: true }),
        ...(usesMakeStyles && { usesMakeStyles: true }),
        ...(usesSystemProps && { usesSystemProps: true }),
      },
    };
  } catch (error) {
    debugError('material', 'extractMaterialUI', {
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
