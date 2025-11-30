# ShadCN/UI Support

LogicStamp Context provides specialized support for ShadCN/UI, a popular component library built on Radix UI and Tailwind CSS.

## ShadCN Detection

LogicStamp automatically detects ShadCN/UI usage by:

- **Component imports**: Detects imports from `@/components/ui/*`, `~/components/ui/*`, or relative `components/ui/*` paths
- **Import aliases**: Tracks aliased imports (e.g., `import { Button as UIPrimaryButton }`) and maps them to canonical component names
- **ShadCN components**: Recognizes ShadCN component names and patterns
- **Component structure**: Identifies ShadCN's compound component patterns
- **Usage frequency**: Ranks components by actual usage count (imports + JSX usage), not just alphabetically
- **Tailwind integration**: Extracts Tailwind classes used with ShadCN components

## What Gets Extracted

### ShadCN Components

All ShadCN/UI components are detected and extracted:

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';

function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent>
        <Button>Click me</Button>
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>Content</DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
```

**Detected components include:**

#### Form Components
- `Button`, `Input`, `Label`, `Textarea`
- `Checkbox`, `RadioGroup`, `Select`
- `Switch`, `Slider`, `Toggle`
- `Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage`

#### Layout Components
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`
- `Separator`, `AspectRatio`
- `ScrollArea`, `ScrollBar`

#### Overlay Components
- `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`
- `AlertDialog` (all variants)
- `Popover`, `PopoverTrigger`, `PopoverContent`
- `Tooltip`, `HoverCard`
- `Sheet`, `SheetTrigger`, `SheetContent`

#### Navigation Components
- `DropdownMenu` (all variants)
- `ContextMenu` (all variants)
- `Menubar` (all variants)
- `NavigationMenu` (all variants)
- `Breadcrumbs`

#### Data Display
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`
- `Badge`, `Avatar`, `AvatarImage`, `AvatarFallback`
- `Progress`, `Skeleton`
- `Calendar`, `DatePicker`

#### Feedback
- `Alert`, `AlertTitle`, `AlertDescription`
- `Toast`, `Toaster`
- `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandItem`

### Component Variants

ShadCN's variant system is detected:

```tsx
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function Buttons() {
  return (
    <>
      <Button variant="default">Default</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
      <Button size="sm">Small</Button>
      <Button size="lg">Large</Button>
      <Card variant="custom-elevated">Custom Card</Card>
    </>
  );
}
```

**Extracted:**
- Variant prop values (filtered for known components like Button, Badge, Alert)
- Card variants accept custom values (since ShadCN Card doesn't ship with variants)
- Size prop values
- Component composition patterns

**Note:** Button, Badge, and Alert variants are filtered to known values, while Card variants accept any custom value since ShadCN Card components are frequently extended with custom variants.

### Compound Components

ShadCN's compound component pattern is recognized:

```tsx
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

function Menu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Open</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Item 1</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Item 2</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Extracted:**
- Parent-child component relationships
- Component composition hierarchy
- Compound component usage patterns

## Style Extraction

ShadCN components are analyzed for their Tailwind styling:

```tsx
import { Card } from '@/components/ui/card';

function MyCard() {
  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardContent className="p-6">
        Content
      </CardContent>
    </Card>
  );
}
```

**Extracted style information:**
- Tailwind classes applied to ShadCN components
- Custom className overrides
- Responsive design patterns
- Color and spacing usage

## ShadCN-Specific Features

### Component Library Detection

LogicStamp identifies when ShadCN is the primary UI library:

```json
{
  "style": {
    "sources": ["tailwind", "shadcn"],
    "shadcn": {
      "components": ["Button", "Card", "Dialog"],
      "packages": ["@/components/ui"]
    }
  }
}
```

### Form Integration

ShadCN's form components with React Hook Form are detected:

```tsx
import { useForm } from 'react-hook-form';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

function MyForm() {
  const form = useForm();
  
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
          </FormItem>
        )}
      />
    </Form>
  );
}
```

**Extracted:**
- Form component usage
- Form field relationships
- React Hook Form integration (`useForm`, `Controller`, `FormProvider`)

### Theme Integration

ShadCN's theme support is detected through multiple patterns:

```tsx
import { ThemeProvider } from '@/components/theme-provider';
// or
import { ThemeProvider } from 'next-themes';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

function App() {
  const { theme } = useTheme();
  
  return (
    <ThemeProvider>
      <Button className="dark:bg-gray-900">Toggle</Button>
    </ThemeProvider>
  );
}
```

**Extracted:**
- `useTheme()` hook usage
- `ThemeProvider` imports (detected from various sources)
- Theme-related Tailwind classes (`dark:`, `theme-`)

## Usage

```bash
# Extract ShadCN components and styles
stamp context --include-style

# Or use the style command
stamp context style
```

## ShadCN Project Structure

LogicStamp recognizes ShadCN's typical structure:

```
my-app/
  components/
    ui/                    # ShadCN components
      button.tsx
      card.tsx
      dialog.tsx
  lib/
    utils.ts               # cn() utility
  app/                     # Next.js App Router
    page.tsx
```

## Best Practices

1. **Use ShadCN components**: Import from `@/components/ui/*` for detection
2. **Import aliases**: Aliased imports are supported (e.g., `import { Button as UIPrimaryButton }`) and will be correctly mapped to canonical component names
3. **Extend components**: Customize ShadCN components while maintaining structure
4. **Use variants**: Leverage ShadCN's variant system for consistency
5. **Custom Card variants**: Card components accept custom variants since ShadCN Card doesn't ship with variants
6. **Combine with Tailwind**: Use Tailwind utilities alongside ShadCN components
7. **Form patterns**: Use ShadCN's form components with React Hook Form
8. **Component ranking**: Components are ranked by usage frequency, making it clear which components dominate your files

## Common Patterns

### Card with ShadCN

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

function UserCard({ user }: { user: User }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{user.email}</p>
      </CardContent>
    </Card>
  );
}
```

### Dialog Pattern

```tsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

function EditDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>Make changes to the item.</DialogDescription>
        </DialogHeader>
        {/* Form content */}
      </DialogContent>
    </Dialog>
  );
}
```

## Error Handling

The ShadCN extractor is designed to be robust and will never crash the CLI, even when encountering:

- **Malformed JSX**: Invalid or unclosed tags are handled gracefully
- **Parse errors**: AST parsing failures return empty results
- **Invalid imports**: Malformed import declarations are skipped
- **AST traversal errors**: Complex or malformed TypeScript that causes AST parsing issues falls back gracefully
- **Feature detection errors**: Failures in form/theme/icon detection return partial results

All error handling is silent by default. To enable debug logging for troubleshooting, set the `LOGICSTAMP_DEBUG=1` environment variable:

```bash
LOGICSTAMP_DEBUG=1 stamp context --include-style
```

This will output error messages to help identify problematic files or expressions:

```
[LogicStamp][DEBUG] shadcn.extractShadcnUI error: { filePath: '/path/to/file.tsx', error: 'Cannot read property \'getText\' of undefined' }
```

### Best Practices

- **Don't worry about missing imports**: If a component imports ShadCN components that don't exist, the extractor will skip them and continue
- **Check debug logs when issues occur**: Enable `LOGICSTAMP_DEBUG=1` if you suspect extraction problems
- **Expect partial results**: Some extraction failures are normal (e.g., dynamically imported components can't be statically analyzed)

## Limitations

- Custom ShadCN component modifications may not be fully detected
- Component variants defined in `components.json` are not read
- Dynamic component imports may not be tracked
- ShadCN CLI-generated components are detected but customization may not be captured
- Default import aliases (e.g., `import PrimaryButton from '@/components/ui/button'`) are not recognized - use named imports instead
- Component density is based on distinct component count, not total JSX usage count

## Related Documentation

- [Radix UI Support](./radix.md) - ShadCN is built on Radix UI
- [Tailwind CSS Support](./tailwind.md) - ShadCN uses Tailwind for styling
- [Style Extraction](../cli/style.md) - Complete style extraction guide
- [React Support](../frameworks/react.md) - React component patterns

