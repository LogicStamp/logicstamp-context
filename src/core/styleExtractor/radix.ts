/**
 * Radix UI extractor - Extracts Radix UI primitive usage
 * Radix UI provides unstyled, accessible components/primitives
 * Many teams use Radix directly, and ShadCN is built on top of it
 */

import {
  SourceFile,
  SyntaxKind,
  JsxElement,
  JsxSelfClosingElement,
  ImportDeclaration,
  JsxAttribute,
} from 'ts-morph';

/**
 * Common Radix UI packages and their key components
 */
const RADIX_PRIMITIVES = {
  // Overlays
  'react-dialog': ['Dialog', 'DialogTrigger', 'DialogPortal', 'DialogOverlay', 'DialogContent', 'DialogTitle', 'DialogDescription', 'DialogClose'],
  'react-alert-dialog': ['AlertDialog', 'AlertDialogTrigger', 'AlertDialogPortal', 'AlertDialogOverlay', 'AlertDialogContent', 'AlertDialogTitle', 'AlertDialogDescription', 'AlertDialogAction', 'AlertDialogCancel'],
  'react-popover': ['Popover', 'PopoverTrigger', 'PopoverAnchor', 'PopoverPortal', 'PopoverContent', 'PopoverArrow', 'PopoverClose'],
  'react-tooltip': ['Tooltip', 'TooltipTrigger', 'TooltipPortal', 'TooltipContent', 'TooltipArrow', 'TooltipProvider'],
  'react-hover-card': ['HoverCard', 'HoverCardTrigger', 'HoverCardPortal', 'HoverCardContent', 'HoverCardArrow'],

  // Menus
  'react-dropdown-menu': ['DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuPortal', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuCheckboxItem', 'DropdownMenuRadioGroup', 'DropdownMenuRadioItem', 'DropdownMenuLabel', 'DropdownMenuSeparator', 'DropdownMenuShortcut', 'DropdownMenuGroup', 'DropdownMenuSub', 'DropdownMenuSubContent', 'DropdownMenuSubTrigger'],
  'react-context-menu': ['ContextMenu', 'ContextMenuTrigger', 'ContextMenuPortal', 'ContextMenuContent', 'ContextMenuItem', 'ContextMenuCheckboxItem', 'ContextMenuRadioGroup', 'ContextMenuRadioItem', 'ContextMenuLabel', 'ContextMenuSeparator', 'ContextMenuShortcut', 'ContextMenuGroup', 'ContextMenuSub', 'ContextMenuSubContent', 'ContextMenuSubTrigger'],
  'react-menubar': ['Menubar', 'MenubarMenu', 'MenubarTrigger', 'MenubarPortal', 'MenubarContent', 'MenubarItem', 'MenubarCheckboxItem', 'MenubarRadioGroup', 'MenubarRadioItem', 'MenubarLabel', 'MenubarSeparator', 'MenubarShortcut', 'MenubarGroup', 'MenubarSub', 'MenubarSubContent', 'MenubarSubTrigger'],
  'react-navigation-menu': ['NavigationMenu', 'NavigationMenuList', 'NavigationMenuItem', 'NavigationMenuTrigger', 'NavigationMenuContent', 'NavigationMenuLink', 'NavigationMenuIndicator', 'NavigationMenuViewport'],

  // Disclosure
  'react-accordion': ['Accordion', 'AccordionItem', 'AccordionHeader', 'AccordionTrigger', 'AccordionContent'],
  'react-collapsible': ['Collapsible', 'CollapsibleTrigger', 'CollapsibleContent'],
  'react-tabs': ['Tabs', 'TabsList', 'TabsTrigger', 'TabsContent'],

  // Form controls
  'react-checkbox': ['Checkbox', 'CheckboxIndicator'],
  'react-radio-group': ['RadioGroup', 'RadioGroupItem', 'RadioGroupIndicator'],
  'react-select': ['Select', 'SelectTrigger', 'SelectValue', 'SelectIcon', 'SelectPortal', 'SelectContent', 'SelectViewport', 'SelectGroup', 'SelectLabel', 'SelectItem', 'SelectItemText', 'SelectItemIndicator', 'SelectScrollUpButton', 'SelectScrollDownButton', 'SelectSeparator'],
  'react-slider': ['Slider', 'SliderTrack', 'SliderRange', 'SliderThumb'],
  'react-switch': ['Switch', 'SwitchThumb'],
  'react-toggle': ['Toggle'],
  'react-toggle-group': ['ToggleGroup', 'ToggleGroupItem'],

  // Other
  'react-avatar': ['Avatar', 'AvatarImage', 'AvatarFallback'],
  'react-progress': ['Progress', 'ProgressIndicator'],
  'react-scroll-area': ['ScrollArea', 'ScrollAreaViewport', 'ScrollAreaScrollbar', 'ScrollAreaThumb', 'ScrollAreaCorner'],
  'react-separator': ['Separator'],
  'react-aspect-ratio': ['AspectRatio'],
  'react-label': ['Label'],
  'react-portal': ['Portal'],
  'react-visually-hidden': ['VisuallyHidden'],
};

/**
 * Props that indicate controlled vs uncontrolled components
 */
const CONTROL_PATTERNS = {
  controlled: ['value', 'checked', 'open', 'pressed'],
  uncontrolled: ['defaultValue', 'defaultChecked', 'defaultOpen', 'defaultPressed'],
};

/**
 * Extract Radix UI primitive usage from a source file
 */
export function extractRadixUI(source: SourceFile): {
  primitives: Record<string, string[]>; // package -> components used
  patterns: {
    controlled: string[]; // Components using controlled pattern
    uncontrolled: string[]; // Components using uncontrolled pattern
    portals: number; // Count of Portal usage
    asChild: number; // Count of asChild composition pattern
  };
  accessibility: {
    usesDirection?: boolean; // RTL/LTR support
    usesFocusManagement?: boolean; // Focus trapping, etc.
    usesKeyboardNav?: boolean; // Loop, orientation, etc.
    usesModal?: boolean; // Modal dialogs
  };
  features: {
    primitiveCount?: number; // Total unique primitives used
    compositionDepth?: 'simple' | 'moderate' | 'complex'; // How deeply composed components are
  };
} {
  try {
    const primitives = new Map<string, Set<string>>();
    const controlled = new Set<string>();
    const uncontrolled = new Set<string>();
    let portalCount = 0;
    let asChildCount = 0;

    // Track accessibility features
    let usesDirection = false;
    let usesFocusManagement = false;
    let usesKeyboardNav = false;
    let usesModal = false;

    // Check for Radix UI imports - wrap AST-risky operation
    let importDeclarations: ImportDeclaration[] = [];
    try {
      importDeclarations = source.getImportDeclarations();
    } catch {
      // If AST traversal fails, return empty result
      return {
        primitives: {},
        patterns: {
          controlled: [],
          uncontrolled: [],
          portals: 0,
          asChild: 0,
        },
        accessibility: {},
        features: {},
      };
    }

    importDeclarations.forEach(imp => {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    const radixMatch = moduleSpecifier.match(/^@radix-ui\/(react-[\w-]+)$/);

    if (radixMatch) {
      const packageName = radixMatch[1];
      const expectedComponents = RADIX_PRIMITIVES[packageName as keyof typeof RADIX_PRIMITIVES];

      if (expectedComponents) {
        // Extract component names from imports
        const namedImports = imp.getNamedImports();
        namedImports.forEach((namedImport: any) => {
          const importName = namedImport.getName();
          if (expectedComponents.includes(importName)) {
            if (!primitives.has(packageName)) {
              primitives.set(packageName, new Set());
            }
            primitives.get(packageName)!.add(importName);
          }
        });

        // Check for namespace imports like `import * as Dialog from '@radix-ui/react-dialog'`
        const namespaceImport = imp.getNamespaceImport();
        if (namespaceImport) {
          if (!primitives.has(packageName)) {
            primitives.set(packageName, new Set());
          }
          // Add a marker that this package is imported as namespace
          primitives.get(packageName)!.add(`${namespaceImport.getText()}.*`);
        }
      }
    }
  });

  // Build a set of all Radix component names for filtering
  const allRadixComponents = new Set<string>();
  Object.values(RADIX_PRIMITIVES).forEach(components => {
    components.forEach(comp => allRadixComponents.add(comp));
  });

  // Analyze JSX elements for patterns using AST traversal
  // This handles multi-line JSX properly
  const processJsxElement = (element: { getTagNameNode: () => any, getAttributes: () => any }, tagName: string) => {
    // Normalize namespace tags like <Dialog.Root> / <Dialog.Trigger>
    // tagName is "Dialog.Root" / "Dialog.Trigger", while allRadixComponents has "Dialog" / "DialogTrigger"
    const normalizedTag = tagName.includes('.') ? tagName.split('.').pop() ?? tagName : tagName;
    
    // Helper to check if a tag name matches any Radix component
    // Handles both direct usage (<DialogTrigger>) and namespace usage (<Dialog.Trigger>)
    const isRadixComponent = (name: string): boolean => {
      if (allRadixComponents.has(name)) return true;
      if (name.includes('.')) {
        const parts = name.split('.');
        const base = parts[0];
        const component = parts[parts.length - 1];
        // Try combined name (e.g., "Dialog" + "Trigger" -> "DialogTrigger")
        return allRadixComponents.has(base + component) || allRadixComponents.has(component);
      }
      return false;
    };

    // Get the component name to use for tracking (prefer the actual component name from set)
    const getComponentName = (name: string): string | null => {
      if (allRadixComponents.has(name)) return name;
      if (name.includes('.')) {
        const parts = name.split('.');
        const base = parts[0];
        const component = parts[parts.length - 1];
        const combined = base + component;
        if (allRadixComponents.has(combined)) return combined;
        if (allRadixComponents.has(component)) return component;
      }
      return null;
    };
    
    // Check for Portal usage
    if (normalizedTag.includes('Portal')) {
      portalCount++;
    }

    // Get attributes for this element
    let attributes: any[] = [];
    try {
      attributes = element.getAttributes();
    } catch {
      // If getting attributes fails, skip this element
      return;
    }

    attributes.forEach((attr: any) => {
      try {
        if (attr.getKind() === SyntaxKind.JsxAttribute) {
          const jsxAttr = attr as JsxAttribute;
          const attrName = jsxAttr.getNameNode().getText();

        // Check for asChild composition pattern
        if (attrName === 'asChild') {
          asChildCount++;
        }

        // Check for controlled pattern (Radix components only)
        if (CONTROL_PATTERNS.controlled.includes(attrName) && isRadixComponent(tagName)) {
          const componentName = getComponentName(tagName);
          if (componentName) {
            controlled.add(componentName);
          }
        }

        // Check for uncontrolled pattern (Radix components only)
        if (CONTROL_PATTERNS.uncontrolled.includes(attrName) && isRadixComponent(tagName)) {
          const componentName = getComponentName(tagName);
          if (componentName) {
            uncontrolled.add(componentName);
          }
        }

        // Check for accessibility props
        if (attrName === 'dir') {
          usesDirection = true;
        }
        if (attrName === 'trapFocus' || attrName === 'restoreFocus') {
          usesFocusManagement = true;
        }
        if (attrName === 'loop' || attrName === 'orientation') {
          usesKeyboardNav = true;
        }
          if (attrName === 'modal') {
            usesModal = true;
          }
        }
      } catch {
        // Skip this attribute if processing fails
      }
    });
  };

    // Process JsxElement (e.g., <Dialog>...</Dialog>) - wrap AST-risky operation
    let jsxElements: JsxElement[] = [];
    try {
      jsxElements = source.getDescendantsOfKind(SyntaxKind.JsxElement);
    } catch {
      // If AST traversal fails, continue with self-closing elements only
    }

    jsxElements.forEach(element => {
      try {
        const openingElement = element.getOpeningElement();
        const tagName = openingElement.getTagNameNode().getText();
        processJsxElement(openingElement, tagName);
      } catch {
        // Skip this element if processing fails
      }
    });

    // Process JsxSelfClosingElement (e.g., <DialogTrigger />) - wrap AST-risky operation
    let jsxSelfClosingElements: JsxSelfClosingElement[] = [];
    try {
      jsxSelfClosingElements = source.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
    } catch {
      // If AST traversal fails, continue without self-closing elements
    }

    jsxSelfClosingElements.forEach(element => {
      try {
        const tagName = element.getTagNameNode().getText();
        processJsxElement(element, tagName);
      } catch {
        // Skip this element if processing fails
      }
    });

    // Calculate composition depth based on component usage
    let compositionDepth: 'simple' | 'moderate' | 'complex' | undefined;
    const totalPrimitives = Array.from(primitives.values()).reduce(
      (sum, set) => sum + set.size,
      0
    );

    if (totalPrimitives > 0) {
      // Simple: 1-3 primitives, low portal usage
      // Moderate: 4-10 primitives, some portals
      // Complex: 11+ primitives, heavy portal/composition usage
      if (totalPrimitives <= 3 && portalCount <= 1) {
        compositionDepth = 'simple';
      } else if (totalPrimitives <= 10 && portalCount <= 5) {
        compositionDepth = 'moderate';
      } else {
        compositionDepth = 'complex';
      }
    }

    // Convert primitives Map to Record with sorted arrays
    const primitivesRecord: Record<string, string[]> = {};
    primitives.forEach((componentSet, packageName) => {
      primitivesRecord[packageName] = Array.from(componentSet).sort();
    });

    // Build accessibility object
    const accessibilityResult: {
      usesDirection?: boolean;
      usesFocusManagement?: boolean;
      usesKeyboardNav?: boolean;
      usesModal?: boolean;
    } = {};
    if (usesDirection) accessibilityResult.usesDirection = true;
    if (usesFocusManagement) accessibilityResult.usesFocusManagement = true;
    if (usesKeyboardNav) accessibilityResult.usesKeyboardNav = true;
    if (usesModal) accessibilityResult.usesModal = true;

    // Build features object
    const featuresResult: {
      primitiveCount?: number;
      compositionDepth?: 'simple' | 'moderate' | 'complex';
    } = {};
    if (totalPrimitives > 0) featuresResult.primitiveCount = totalPrimitives;
    if (compositionDepth) featuresResult.compositionDepth = compositionDepth;

    return {
      primitives: primitivesRecord,
      patterns: {
        controlled: Array.from(controlled).sort(),
        uncontrolled: Array.from(uncontrolled).sort(),
        portals: portalCount,
        asChild: asChildCount,
      },
      accessibility: accessibilityResult,
      features: featuresResult,
    };
  } catch (error) {
    if (process.env.LOGICSTAMP_DEBUG === '1') {
      console.error('[logicstamp:radix] Failed to extract Radix UI metadata:', (error as Error).message);
    }
    return {
      primitives: {},
      patterns: {
        controlled: [],
        uncontrolled: [],
        portals: 0,
        asChild: 0,
      },
      accessibility: {},
      features: {},
    };
  }
}
