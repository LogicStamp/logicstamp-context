/**
 * Material UI extractor - Extracts Material UI component library usage
 */

import { SourceFile } from 'ts-morph';

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
  'ToggleButton', 'ToggleButtonGroup', 'Toolbar', 'Tooltip', 'Typography', 'Zoom'
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
  const sourceText = source.getFullText();
  const components = new Set<string>();
  const packages = new Set<string>();

  // Check for Material UI imports
  source.getImportDeclarations().forEach(imp => {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    
    // Check if it's a Material UI package
    const isMuiPackage = MUI_PACKAGE_PATTERNS.some(pattern => pattern.test(moduleSpecifier));
    
    if (isMuiPackage) {
      packages.add(moduleSpecifier);
      
      // Extract component names from imports
      const namedImports = imp.getNamedImports();
      namedImports.forEach(namedImport => {
        const importName = namedImport.getName();
        if (MUI_COMPONENTS.includes(importName)) {
          components.add(importName);
        }
      });
      
      // Check for default imports (less common but possible)
      const defaultImport = imp.getDefaultImport();
      if (defaultImport) {
        const defaultName = defaultImport.getText();
        if (MUI_COMPONENTS.includes(defaultName)) {
          components.add(defaultName);
        }
      }
    }
  });

  // Also check for component usage in JSX (e.g., <Button>, <TextField>)
  // This catches cases where components might be imported differently
  MUI_COMPONENTS.forEach(componentName => {
    // Match JSX usage: <ComponentName, <ComponentName., or ComponentName.
    const patterns = [
      new RegExp(`<${componentName}\\s`, 'g'),
      new RegExp(`<${componentName}>`, 'g'),
      new RegExp(`<${componentName}/`, 'g'),
    ];
    
    patterns.forEach(pattern => {
      if (pattern.test(sourceText)) {
        components.add(componentName);
      }
    });
  });

  // Check for theme usage
  const usesTheme = 
    /useTheme\(\)/.test(sourceText) ||
    /ThemeProvider/.test(sourceText) ||
    /createTheme\(/.test(sourceText) ||
    /theme\./.test(sourceText) ||
    /\$\{.*theme\./.test(sourceText);

  // Check for sx prop usage (Material UI's styling prop)
  const usesSxProp = /sx\s*=\s*\{/.test(sourceText);

  // Check for styled from @mui/material/styles
  const usesStyled = 
    /from\s+['"]@mui\/material\/styles['"]/.test(sourceText) ||
    /from\s+['"]@material-ui\/core\/styles['"]/.test(sourceText) ||
    /styled\(/.test(sourceText);

  // Check for makeStyles (legacy Material UI styling)
  const usesMakeStyles = 
    /makeStyles\(/.test(sourceText) ||
    /from\s+['"]@mui\/styles['"]/.test(sourceText) ||
    /from\s+['"]@material-ui\/styles['"]/.test(sourceText);

  // Check for system props (spacing, color, etc. on Box/Stack components)
  const usesSystemProps = 
    /(?:Box|Stack|Grid|Container).*?(?:spacing|color|bgcolor|p|m|px|py|mx|my|pt|pb|pl|pr|mt|mb|ml|mr)\s*=/s.test(sourceText);

  return {
    components: Array.from(components).sort().slice(0, 20), // Top 20 components
    packages: Array.from(packages).sort(),
    features: {
      ...(usesTheme && { usesTheme: true }),
      ...(usesSxProp && { usesSxProp: true }),
      ...(usesStyled && { usesStyled: true }),
      ...(usesMakeStyles && { usesMakeStyles: true }),
      ...(usesSystemProps && { usesSystemProps: true }),
    },
  };
}

