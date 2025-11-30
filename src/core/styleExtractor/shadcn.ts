/**
 * ShadCN/UI extractor - Extracts ShadCN/UI component library usage
 * ShadCN/UI is a collection of re-usable components built with Radix UI and Tailwind CSS
 */

import {
  SourceFile,
  SyntaxKind,
  JsxAttribute,
  JsxElement,
  JsxSelfClosingElement,
  CallExpression,
  ImportDeclaration,
} from 'ts-morph';

/**
 * Common ShadCN/UI component names
 * These are typically imported from @/components/ui/*
 */
const SHADCN_COMPONENTS = [
  'Accordion', 'AccordionContent', 'AccordionItem', 'AccordionTrigger',
  'Alert', 'AlertDescription', 'AlertTitle',
  'AlertDialog', 'AlertDialogAction', 'AlertDialogCancel', 'AlertDialogContent', 'AlertDialogDescription',
  'AlertDialogFooter', 'AlertDialogHeader', 'AlertDialogTitle', 'AlertDialogTrigger',
  'AspectRatio',
  'Avatar', 'AvatarFallback', 'AvatarImage',
  'Badge',
  'Button',
  'Calendar',
  'Card', 'CardContent', 'CardDescription', 'CardFooter', 'CardHeader', 'CardTitle',
  'Checkbox',
  'Collapsible', 'CollapsibleContent', 'CollapsibleTrigger',
  'Command', 'CommandDialog', 'CommandEmpty', 'CommandGroup', 'CommandInput', 'CommandItem',
  'CommandList', 'CommandSeparator', 'CommandShortcut',
  'ContextMenu', 'ContextMenuCheckboxItem', 'ContextMenuContent', 'ContextMenuItem',
  'ContextMenuLabel', 'ContextMenuRadioGroup', 'ContextMenuRadioItem', 'ContextMenuSeparator',
  'ContextMenuShortcut', 'ContextMenuSub', 'ContextMenuSubContent', 'ContextMenuSubTrigger',
  'ContextMenuTrigger',
  'Dialog', 'DialogContent', 'DialogDescription', 'DialogFooter', 'DialogHeader', 'DialogTitle',
  'DialogTrigger',
  'DropdownMenu', 'DropdownMenuCheckboxItem', 'DropdownMenuContent', 'DropdownMenuItem',
  'DropdownMenuLabel', 'DropdownMenuRadioGroup', 'DropdownMenuRadioItem', 'DropdownMenuSeparator',
  'DropdownMenuShortcut', 'DropdownMenuSub', 'DropdownMenuSubContent', 'DropdownMenuSubTrigger',
  'DropdownMenuTrigger',
  'Form', 'FormControl', 'FormDescription', 'FormField', 'FormItem', 'FormLabel', 'FormMessage',
  'HoverCard', 'HoverCardContent', 'HoverCardTrigger',
  'Input',
  'Label',
  'Menubar', 'MenubarCheckboxItem', 'MenubarContent', 'MenubarItem', 'MenubarLabel',
  'MenubarMenu', 'MenubarRadioGroup', 'MenubarRadioItem', 'MenubarSeparator', 'MenubarShortcut',
  'MenubarSub', 'MenubarSubContent', 'MenubarSubTrigger', 'MenubarTrigger',
  'NavigationMenu', 'NavigationMenuContent', 'NavigationMenuItem', 'NavigationMenuLink',
  'NavigationMenuList', 'NavigationMenuTrigger',
  'Popover', 'PopoverContent', 'PopoverTrigger',
  'Progress',
  'RadioGroup', 'RadioGroupItem',
  'ScrollArea', 'ScrollBar',
  'Select', 'SelectContent', 'SelectGroup', 'SelectItem', 'SelectLabel', 'SelectSeparator',
  'SelectTrigger', 'SelectValue',
  'Separator',
  'Sheet', 'SheetContent', 'SheetDescription', 'SheetFooter', 'SheetHeader', 'SheetTitle',
  'SheetTrigger',
  'Skeleton',
  'Slider',
  'Switch',
  'Table', 'TableBody', 'TableCaption', 'TableCell', 'TableFooter', 'TableHead', 'TableHeader',
  'TableRow',
  'Tabs', 'TabsContent', 'TabsList', 'TabsTrigger',
  'Textarea',
  'Toast', 'ToastAction', 'ToastClose', 'ToastDescription', 'ToastProvider', 'ToastTitle',
  'ToastViewport', 'Toaster',
  'Toggle', 'ToggleGroup', 'ToggleGroupItem',
  'Tooltip', 'TooltipContent', 'TooltipProvider', 'TooltipTrigger',
];

/**
 * Common ShadCN/UI variant prop values
 * These are the typical variant values used across components
 */
const SHADCN_VARIANTS = {
  button: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
  badge: ['default', 'secondary', 'destructive', 'outline'],
  alert: ['default', 'destructive'],
  card: ['default', 'elevated', 'outlined'],
};

/**
 * Common ShadCN/UI size prop values
 */
const SHADCN_SIZES = ['default', 'sm', 'lg', 'icon', 'xs', 'xl'];

/**
 * ShadCN/UI import path patterns
 */
const SHADCN_IMPORT_PATTERNS = [
  /^@\/components\/ui\//,
  /^~\/components\/ui\//,
  /^components\/ui\//,
  /^\.\.?\/.*\/ui\//,
];

/**
 * Extract ShadCN/UI usage from a source file
 */
export function extractShadcnUI(source: SourceFile): {
  components: string[];
  variants: Record<string, string[]>;
  sizes: string[];
  features: {
    usesForm?: boolean;
    usesTheme?: boolean;
    usesIcons?: boolean;
    componentDensity?: 'low' | 'medium' | 'high';
  };
} {
  try {
    // Track component usage counts (incremented on both imports and JSX usage)
    // This gives us frequency-based ranking of components within the file
    const componentCounts = new Map<string, number>();
    const variants = new Map<string, Set<string>>();
    const sizes = new Set<string>();
    const localToShadcn = new Map<string, string>(); // Map local alias → canonical component name
    let hasShadcnImport = false;

    // Check for ShadCN/UI imports - wrap AST-risky operation
    let importDeclarations: ImportDeclaration[] = [];
    try {
      importDeclarations = source.getImportDeclarations();
    } catch {
      // If AST traversal fails, return empty result
      return {
        components: [],
        variants: {},
        sizes: [],
        features: {},
      };
    }

    importDeclarations.forEach(imp => {
    const moduleSpecifier = imp.getModuleSpecifierValue();

    // Check if it's a ShadCN/UI import path
    const isShadcnImport = SHADCN_IMPORT_PATTERNS.some(pattern => pattern.test(moduleSpecifier));

    if (isShadcnImport) {
      hasShadcnImport = true;
      // Extract component names from imports (including aliases)
      const namedImports = imp.getNamedImports();
      namedImports.forEach(namedImport => {
        const importName = namedImport.getName(); // Original/canonical name
        const aliasNode = namedImport.getAliasNode();
        const localName = aliasNode?.getText() ?? importName; // Local alias or original

        if (SHADCN_COMPONENTS.includes(importName)) {
          // Count import as one usage
          componentCounts.set(importName, (componentCounts.get(importName) ?? 0) + 1);
          // Track the mapping from local name (alias or original) to canonical component
          localToShadcn.set(localName, importName);
          // Always map canonical name to itself (for direct usage without alias)
          localToShadcn.set(importName, importName);
        }
      });

      // Check for default imports
      // Note: Only recognizes default imports where the import name matches a canonical
      // ShadCN component name. Aliased default imports (e.g., "import PrimaryButton from ...")
      // won't be recognized, but ShadCN typically uses named imports anyway.
      const defaultImport = imp.getDefaultImport();
      if (defaultImport) {
        const defaultName = defaultImport.getText();
        if (SHADCN_COMPONENTS.includes(defaultName)) {
          componentCounts.set(defaultName, (componentCounts.get(defaultName) ?? 0) + 1);
          localToShadcn.set(defaultName, defaultName);
        }
      }
    }
  });

    // Also check for component usage in JSX using AST – but ONLY if we saw a ShadCN import
    if (hasShadcnImport) {
      // Extract from JSX elements - wrap AST-risky operation
      let jsxElements: (JsxElement | JsxSelfClosingElement)[] = [];
      try {
        jsxElements = [
          ...source.getDescendantsOfKind(SyntaxKind.JsxElement),
          ...source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement),
        ];
      } catch {
        // If AST traversal fails, continue with what we have (imports only)
      }

    for (const element of jsxElements) {
      const openingElement = 'getOpeningElement' in element 
        ? element.getOpeningElement() 
        : element;

      const rawTag = openingElement.getTagNameNode().getText();
      
      // Handle namespace tags like <Dialog.Root> or <Dialog.Trigger>
      const baseTag = rawTag.includes('.') 
        ? rawTag.split('.')[0] 
        : rawTag;

      // Map local alias to canonical component name
      const componentName = localToShadcn.get(baseTag) ?? baseTag;

      if (SHADCN_COMPONENTS.includes(componentName)) {
        // Count each JSX usage (in addition to import count)
        componentCounts.set(componentName, (componentCounts.get(componentName) ?? 0) + 1);

        // Extract variant prop usage from JSX attributes
        const attributes = openingElement.getAttributes();
        for (const attr of attributes) {
          if (attr.getKind() !== SyntaxKind.JsxAttribute) continue;
          
          const jsxAttr = attr as JsxAttribute;
          const attrName = jsxAttr.getNameNode().getText();

          // Extract variant prop
          if (attrName === 'variant') {
            const initializer = jsxAttr.getInitializer();
            if (initializer && initializer.getKind() === SyntaxKind.StringLiteral) {
              const variantValue = (initializer as any).getLiteralText?.() ?? 
                initializer.getText().slice(1, -1);

              // Determine component type
              let componentType = 'other';
              if (componentName === 'Button') componentType = 'button';
              else if (componentName === 'Badge') componentType = 'badge';
              else if (componentName === 'Alert') componentType = 'alert';
              else if (componentName === 'Card') componentType = 'card';

              if (!variants.has(componentType)) {
                variants.set(componentType, new Set());
              }

              // For Card, don't filter strictly (custom variants are common)
              // For other components, only record known variants
              const allowed = SHADCN_VARIANTS[componentType as keyof typeof SHADCN_VARIANTS];
              if (componentType === 'card' || !allowed || allowed.includes(variantValue)) {
                variants.get(componentType)!.add(variantValue);
              }
            }
          }

          // Extract size prop
          if (attrName === 'size') {
            const initializer = jsxAttr.getInitializer();
            if (initializer && initializer.getKind() === SyntaxKind.StringLiteral) {
              const sizeValue = (initializer as any).getLiteralText?.() ?? 
                initializer.getText().slice(1, -1);
              if (SHADCN_SIZES.includes(sizeValue)) {
                sizes.add(sizeValue);
              }
            }
          }
        }
      }
    }
  }

    // Check for form usage (react-hook-form integration) using AST
    let usesForm = false;
    try {
      const callExpressions: CallExpression[] = source.getDescendantsOfKind(SyntaxKind.CallExpression);
      usesForm =
        callExpressions.some(callExpr => {
          const expr = callExpr.getExpression();
          return expr.getKind() === SyntaxKind.Identifier && 
            ['useForm', 'FormProvider', 'Controller'].includes(expr.getText());
        }) ||
        componentCounts.has('Form') ||
        componentCounts.has('FormField');
    } catch {
      // If AST traversal fails, check only component counts
      usesForm = componentCounts.has('Form') || componentCounts.has('FormField');
    }

    // Check for theme usage (next-themes or similar) using AST
    let usesTheme = false;
    try {
      const callExpressions: CallExpression[] = source.getDescendantsOfKind(SyntaxKind.CallExpression);
      usesTheme =
        callExpressions.some(callExpr => {
          const expr = callExpr.getExpression();
          return expr.getKind() === SyntaxKind.Identifier && expr.getText() === 'useTheme';
        }) ||
        importDeclarations.some(imp => {
          const moduleSpecifier = imp.getModuleSpecifierValue();
          return (
            imp.getNamedImports().some(n => n.getName() === 'ThemeProvider') ||
            /theme-provider/i.test(moduleSpecifier)
          );
        }) ||
        // Check for theme- classes in Tailwind (would need to check className attributes)
        source.getDescendantsOfKind(SyntaxKind.JsxAttribute).some(attr => {
          const jsxAttr = attr as JsxAttribute;
          const attrName = jsxAttr.getNameNode().getText();
          if (attrName === 'className' || attrName === 'class') {
            const initializer = jsxAttr.getInitializer();
            if (initializer) {
              const text = initializer.getText();
              return /theme-/.test(text) || /dark:/.test(text);
            }
          }
          return false;
        });
    } catch {
      // If AST traversal fails, check only imports
      usesTheme = importDeclarations.some(imp => {
        const moduleSpecifier = imp.getModuleSpecifierValue();
        return (
          imp.getNamedImports().some(n => n.getName() === 'ThemeProvider') ||
          /theme-provider/i.test(moduleSpecifier)
        );
      });
    }

    // Check for icon usage (lucide-react is common with ShadCN) using AST
    let usesIcons = false;
    try {
      usesIcons = importDeclarations.some(imp => {
        const moduleSpecifier = imp.getModuleSpecifierValue();
        return moduleSpecifier === 'lucide-react' ||
          moduleSpecifier === '@radix-ui/react-icons' ||
          moduleSpecifier.startsWith('react-icons');
      });
    } catch {
      // If AST traversal fails, skip icon detection
    }

    // Calculate component density based on number of distinct ShadCN components in the file
    // This is the count of unique components, not total JSX usage count
    let componentDensity: 'low' | 'medium' | 'high' | undefined;
    const distinctComponentCount = componentCounts.size;
    if (distinctComponentCount > 0) {
      if (distinctComponentCount <= 3) componentDensity = 'low';
      else if (distinctComponentCount <= 8) componentDensity = 'medium';
      else componentDensity = 'high';
    }

    // Convert variants Map to Record with sorted arrays
    const variantsRecord: Record<string, string[]> = {};
    variants.forEach((variantSet, componentType) => {
      variantsRecord[componentType] = Array.from(variantSet).sort();
    });

    // Sort components by usage count (descending), then alphabetically, then take top 30
    const components = Array.from(componentCounts.entries())
      .sort((a, b) => {
        // First sort by count (descending)
        if (b[1] !== a[1]) {
          return b[1] - a[1];
        }
        // Then alphabetically
        return a[0].localeCompare(b[0]);
      })
      .slice(0, 30)
      .map(([name]) => name);

    return {
      components, // Top 30 components by usage frequency
      variants: variantsRecord,
      sizes: Array.from(sizes).sort(),
      features: {
        ...(usesForm && { usesForm: true }),
        ...(usesTheme && { usesTheme: true }),
        ...(usesIcons && { usesIcons: true }),
        ...(componentDensity && { componentDensity }),
      },
    };
  } catch (error) {
    if (process.env.LOGICSTAMP_DEBUG === '1') {
      console.error('[logicstamp:shadcn] Failed to extract ShadCN/UI metadata:', (error as Error).message);
    }
    return {
      components: [],
      variants: {},
      sizes: [],
      features: {},
    };
  }
}
