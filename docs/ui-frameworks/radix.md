# Radix UI Support

LogicStamp Context provides specialized support for Radix UI, a low-level UI primitive library that provides accessible, unstyled components.

## Radix Detection

LogicStamp automatically detects Radix UI usage by:

- **Package imports**: Detects imports from `@radix-ui/*` packages
- **Component patterns**: Recognizes Radix primitive component names
- **Accessibility features**: Identifies Radix's accessibility patterns
- **Primitive composition**: Detects Radix's compound component patterns

## What Gets Extracted

### Radix Primitives

All Radix UI primitives are detected and extracted:

```tsx
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';

function MyComponent() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Open</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>Title</Dialog.Title>
          <Dialog.Description>Description</Dialog.Description>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

**Detected Radix packages and components:**

#### Overlays
- **`@radix-ui/react-dialog`**: `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogOverlay`, `DialogContent`, `DialogTitle`, `DialogDescription`, `DialogClose`
- **`@radix-ui/react-alert-dialog`**: `AlertDialog`, `AlertDialogTrigger`, `AlertDialogPortal`, `AlertDialogOverlay`, `AlertDialogContent`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`
- **`@radix-ui/react-popover`**: `Popover`, `PopoverTrigger`, `PopoverAnchor`, `PopoverPortal`, `PopoverContent`, `PopoverArrow`, `PopoverClose`
- **`@radix-ui/react-tooltip`**: `Tooltip`, `TooltipTrigger`, `TooltipPortal`, `TooltipContent`, `TooltipArrow`, `TooltipProvider`
- **`@radix-ui/react-hover-card`**: `HoverCard`, `HoverCardTrigger`, `HoverCardPortal`, `HoverCardContent`, `HoverCardArrow`

#### Menus
- **`@radix-ui/react-dropdown-menu`**: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuPortal`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuGroup`, `DropdownMenuSub`, `DropdownMenuSubContent`, `DropdownMenuSubTrigger`
- **`@radix-ui/react-context-menu`**: `ContextMenu`, `ContextMenuTrigger`, `ContextMenuPortal`, `ContextMenuContent`, `ContextMenuItem`, `ContextMenuCheckboxItem`, `ContextMenuRadioGroup`, `ContextMenuRadioItem`, `ContextMenuLabel`, `ContextMenuSeparator`, `ContextMenuShortcut`, `ContextMenuGroup`, `ContextMenuSub`, `ContextMenuSubContent`, `ContextMenuSubTrigger`
- **`@radix-ui/react-menubar`**: `Menubar`, `MenubarMenu`, `MenubarTrigger`, `MenubarPortal`, `MenubarContent`, `MenubarItem`, `MenubarCheckboxItem`, `MenubarRadioGroup`, `MenubarRadioItem`, `MenubarLabel`, `MenubarSeparator`, `MenubarShortcut`, `MenubarGroup`, `MenubarSub`, `MenubarSubContent`, `MenubarSubTrigger`
- **`@radix-ui/react-navigation-menu`**: `NavigationMenu`, `NavigationMenuList`, `NavigationMenuItem`, `NavigationMenuTrigger`, `NavigationMenuContent`, `NavigationMenuLink`, `NavigationMenuIndicator`, `NavigationMenuViewport`

#### Disclosure
- **`@radix-ui/react-accordion`**: `Accordion`, `AccordionItem`, `AccordionHeader`, `AccordionTrigger`, `AccordionContent`
- **`@radix-ui/react-collapsible`**: `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`
- **`@radix-ui/react-tabs`**: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`

#### Form Controls
- **`@radix-ui/react-checkbox`**: `Checkbox`, `CheckboxIndicator`
- **`@radix-ui/react-radio-group`**: `RadioGroup`, `RadioGroupItem`, `RadioGroupIndicator`
- **`@radix-ui/react-select`**: `Select`, `SelectTrigger`, `SelectValue`, `SelectIcon`, `SelectPortal`, `SelectContent`, `SelectViewport`, `SelectGroup`, `SelectLabel`, `SelectItem`, `SelectItemText`, `SelectItemIndicator`, `SelectScrollUpButton`, `SelectScrollDownButton`, `SelectSeparator`
- **`@radix-ui/react-slider`**: `Slider`, `SliderTrack`, `SliderRange`, `SliderThumb`
- **`@radix-ui/react-switch`**: `Switch`, `SwitchThumb`
- **`@radix-ui/react-toggle`**: `Toggle`
- **`@radix-ui/react-toggle-group`**: `ToggleGroup`, `ToggleGroupItem`

#### Other Primitives
- **`@radix-ui/react-avatar`**: `Avatar`, `AvatarImage`, `AvatarFallback`
- **`@radix-ui/react-progress`**: `Progress`, `ProgressIndicator`
- **`@radix-ui/react-scroll-area`**: `ScrollArea`, `ScrollAreaViewport`, `ScrollAreaScrollbar`, `ScrollAreaThumb`, `ScrollAreaCorner`
- **`@radix-ui/react-separator`**: `Separator`
- **`@radix-ui/react-aspect-ratio`**: `AspectRatio`
- **`@radix-ui/react-label`**: `Label`
- **`@radix-ui/react-portal`**: `Portal`
- **`@radix-ui/react-visually-hidden`**: `VisuallyHidden`

### Primitive Composition

Radix's compound component pattern is recognized:

```tsx
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

function Menu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>Options</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Edit</DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item>Delete</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

**Extracted:**
- Primitive component relationships
- Compound component hierarchy
- Portal usage patterns

### Accessibility Features

Radix's built-in accessibility features are detected:

```tsx
import * as Dialog from '@radix-ui/react-dialog';

function AccessibleDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Open Dialog</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content
          aria-describedby="dialog-description"
          className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        >
          <Dialog.Title>Dialog Title</Dialog.Title>
          <Dialog.Description id="dialog-description">
            Dialog description
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

**Extracted:**
- ARIA attributes
- Accessibility patterns
- Focus management
- Keyboard navigation

## Style Extraction

Radix components are analyzed for their styling (typically Tailwind or CSS):

```tsx
import * as Dialog from '@radix-ui/react-dialog';

function StyledDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="px-4 py-2 bg-blue-500 text-white rounded">
        Open
      </Dialog.Trigger>
      <Dialog.Content className="bg-white rounded-lg shadow-lg p-6">
        <Dialog.Title className="text-2xl font-bold">Title</Dialog.Title>
      </Dialog.Content>
    </Dialog.Root>
  );
}
```

**Extracted style information:**
- Custom styling applied to Radix primitives
- Tailwind classes
- CSS modules
- Inline styles

## Radix-Specific Features

### Package Detection

LogicStamp identifies which Radix packages are used:

```json
{
  "style": {
    "sources": ["radix"],
    "radix": {
      "packages": [
        "@radix-ui/react-dialog",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-popover"
      ],
      "components": [
        "Dialog",
        "DialogTrigger",
        "DialogContent",
        "DropdownMenu",
        "DropdownMenuItem"
      ]
    }
  }
}
```

### State Management

Radix's controlled/uncontrolled state patterns are detected:

```tsx
import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

function ControlledDialog() {
  const [open, setOpen] = useState(false);
  
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>Toggle</Dialog.Trigger>
      <Dialog.Content>
        Content
      </Dialog.Content>
    </Dialog.Root>
  );
}
```

**Extracted:**
- Controlled component patterns
- State management integration
- Event handlers

## Usage

```bash
# Extract Radix components and styles
stamp context --include-style

# Or use the style command
stamp context style
```

## Radix Project Structure

LogicStamp recognizes Radix usage patterns:

```
my-app/
  components/
    ui/
      dialog.tsx        # Radix Dialog wrapper
      dropdown.tsx      # Radix DropdownMenu wrapper
  app/
    page.tsx
```

## Best Practices

1. **Use Radix primitives**: Import from `@radix-ui/*` packages for detection
2. **Style with Tailwind**: Combine Radix with Tailwind for styling
3. **Compose components**: Build higher-level components from Radix primitives
4. **Accessibility**: Leverage Radix's built-in accessibility features
5. **State management**: Use Radix's controlled/uncontrolled patterns

## Common Patterns

### Dialog with Radix

```tsx
import * as Dialog from '@radix-ui/react-dialog';

function MyDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="px-4 py-2 bg-blue-500 text-white rounded">
        Open Dialog
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6">
          <Dialog.Title className="text-2xl font-bold">Title</Dialog.Title>
          <Dialog.Description>Description</Dialog.Description>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

### Dropdown Menu Pattern

```tsx
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

function UserMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>User</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          <DropdownMenu.Item>Profile</DropdownMenu.Item>
          <DropdownMenu.Item>Settings</DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item>Logout</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

## Error Handling

The Radix extractor is designed to be robust and will never crash the CLI, even when encountering:

- **Malformed JSX**: Invalid or unclosed tags are handled gracefully
- **Parse errors**: AST parsing failures return empty results
- **Invalid imports**: Malformed import declarations are skipped
- **AST traversal errors**: Complex or malformed TypeScript that causes AST parsing issues falls back gracefully
- **Attribute processing errors**: Failures in attribute extraction return partial results

All error handling is silent by default. To enable debug logging for troubleshooting, set the `LOGICSTAMP_DEBUG=1` environment variable:

```bash
LOGICSTAMP_DEBUG=1 stamp context --include-style
```

This will output error messages to help identify problematic files or expressions:

```
[LogicStamp][DEBUG] radix.extractRadixUI error: { filePath: '/path/to/file.tsx', error: 'Cannot read property \'getText\' of undefined' }
```

### Best Practices

- **Don't worry about missing imports**: If a component imports Radix packages that don't exist, the extractor will skip them and continue
- **Check debug logs when issues occur**: Enable `LOGICSTAMP_DEBUG=1` if you suspect extraction problems
- **Expect partial results**: Some extraction failures are normal (e.g., dynamically imported primitives can't be statically analyzed)

## Limitations

- Custom Radix component wrappers may not be fully detected
- Dynamic imports of Radix packages may not be tracked
- Radix component variants created through composition may not be recognized
- Some advanced Radix patterns may have limited extraction

## Related Documentation

- [ShadCN Support](./shadcn.md) - ShadCN is built on Radix UI
- [Tailwind CSS Support](./tailwind.md) - Common styling approach with Radix
- [Style Extraction](../cli/style.md) - Complete style extraction guide
- [React Support](../frameworks/react.md) - React component patterns

