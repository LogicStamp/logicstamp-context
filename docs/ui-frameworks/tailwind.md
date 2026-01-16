# Tailwind CSS Support

LogicStamp Context extracts Tailwind CSS utility classes, responsive breakpoints, and design patterns from your components.

## Tailwind Detection

LogicStamp detects Tailwind CSS by parsing your TypeScript/JavaScript with `ts-morph` to extract classes from JSX attributes, detecting utility class patterns, and reading your Tailwind config when available. It also identifies Tailwind's class naming conventions and detects breakpoint prefixes (`sm:`, `md:`, `lg:`, etc.).

## What Gets Extracted

### Utility Classes

All Tailwind utility classes are extracted and categorized. Variant prefixes (responsive, pseudo-classes, etc.) are stripped before categorization, so classes are grouped by their base utility:

```tsx
function Card() {
  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-900">Title</h2>
      <p className="text-gray-600">Description</p>
    </div>
  );
}
```

**Extracted categories:**

#### Layout
- `flex`, `grid`, `block`, `inline`, `hidden`, `container`
- `box-*`, `aspect-*`, `columns-*`, `break-*`

#### Spacing
- Padding: `p-*`, `px-*`, `py-*`, `pt-*`, `pb-*`, `pl-*`, `pr-*`
- Margin: `m-*`, `mx-*`, `my-*`, `mt-*`, `mb-*`, `ml-*`, `mr-*`
- Gap: `gap-*`, `space-*`

#### Sizing
- Width: `w-*`, `w-full`, `w-screen`, `w-auto`
- Height: `h-*`, `h-full`, `h-screen`, `h-auto`
- Min/Max: `min-w-*`, `max-w-*`, `min-h-*`, `max-h-*`
- Size: `size-*`

#### Typography
- Font size: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, etc.
- Font weight: `font-*`
- Line height: `leading-*`
- Letter spacing: `tracking-*`
- Text transforms: `uppercase`, `lowercase`, `capitalize`, `normal-case`
- Text utilities: `antialiased`, `subpixel`, `italic`, `not-italic`, `truncate`, `whitespace-*`

#### Colors
- Background: `bg-*` (e.g., `bg-blue-500`, `bg-white`, `bg-gray-100`)
- Text: `text-*` (e.g., `text-gray-900`, `text-blue-600`)
- Border: `border-*` (e.g., `border-gray-300`)
- Outline: `outline-*`
- Gradients: `from-*`, `via-*`, `to-*`
- Text decoration: `decoration-*`

**Note:** `shadow-*` utilities are categorized under **Effects**, not Colors. `ring-*` utilities are categorized under **Borders**, not Colors.

#### Borders
- Border styles: `border`, `border-*`
- Border radius: `rounded`, `rounded-*`
- Ring: `ring-*`, `ring-offset-*`
- Dividers: `divide-*`

#### Effects
- Shadows: `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl` (categorized here, not in colors)
- Opacity: `opacity-*`
- Mix blend: `mix-*`
- Backdrop: `backdrop-*`
- Filters: `blur-*`, `brightness-*`, `contrast-*`, `grayscale`, `hue-*`, `invert`, `saturate`, `sepia`

#### Transitions
- Transitions: `transition-*`, `duration-*`, `ease-*`, `delay-*`
- Animations: `animate-*`

#### Transforms
- Transform utilities: `scale-*`, `rotate-*`, `translate-*`, `skew-*`, `origin-*`

#### Interactivity
- Cursor: `cursor-*`
- Selection: `select-*`
- Pointer events: `pointer-events-*`
- Resize: `resize-*`
- Scroll: `scroll-*`
- Touch: `touch-*`
- Will change: `will-*`

#### SVG
- Fill: `fill-*`
- Stroke: `stroke-*`

#### Other
- Any utility classes that don't match the above categories are placed in the `other` category

### Variant Prefixes

The extractor handles complex variant chains, stripping all variant prefixes before categorization:

```tsx
<div className="
  group-hover:dark:sm:bg-red-500
  aria-[checked=true]:peer-focus:ring-2
  md:hover:bg-blue-500
  light:bg-white
">
  Content
</div>
```

**Supported variant types:**

#### Responsive Breakpoints
- `sm:`, `md:`, `lg:`, `xl:`, `2xl:` - Standard breakpoints
- `max-sm:`, `max-md:`, `max-lg:`, `max-xl:`, `max-2xl:` - Max-width breakpoints

Breakpoints are extracted from anywhere in the class name, not just at the start (e.g., `hover:sm:bg-red-500`).

#### Pseudo-classes
- `hover:`, `focus:`, `active:`, `disabled:`, `visited:`
- `first:`, `last:`, `odd:`, `even:`
- `before:`, `after:`, `placeholder:`, `file:`, `marker:`, `selection:`
- `first-line:`, `first-letter:`, `backdrop:`

#### State Variants
- `open:`, `checked:`, `selected:`, `indeterminate:`
- `required:`, `optional:`, `valid:`, `invalid:`
- `in-range:`, `out-of-range:`, `read-only:`, `read-write:`
- `empty:`, `target:`

#### Theme Variants
- `dark:` - Dark mode
- `light:` - Light mode

#### Motion Variants
- `motion-safe:` - Only apply when motion is safe
- `motion-reduce:` - Only apply when motion is reduced

#### ARIA/Data Variants
- `aria-[...]:` - ARIA attribute variants (e.g., `aria-[pressed=true]:`)
- `data-[...]:` - Data attribute variants (e.g., `data-[state=active]:`)

#### Group/Peer Variants
- `group-hover:`, `group-focus:`, `group-active:`
- `peer-hover:`, `peer-focus:`, `peer-active:`

#### Print
- `print:` - Print media queries

**Examples:**
- `sm:bg-red-500` → categorized as `colors` (base: `bg-red-500`)
- `md:hover:bg-red-500` → categorized as `colors` (base: `bg-red-500`)
- `dark:focus:ring-2` → categorized as `borders` (base: `ring-2`)
- `group-hover:dark:sm:bg-red-500` → categorized as `colors` (base: `bg-red-500`)
- `aria-[checked=true]:peer-focus:ring-2` → categorized as `borders` (base: `ring-2`)

### Class Extraction

The extractor uses AST-based analysis (via `ts-morph`) to extract classes from various patterns:

#### Literal Strings

```tsx
// ✅ Extracted - literal strings
<div className="px-4 py-2 rounded bg-blue-500">
  Content
</div>
```

#### Template Literals

```tsx
// ✅ Extracted - static segments from template literals
// Dynamic expressions within ${} are ignored
<div className={`px-4 py-2 ${isActive ? 'bg-blue-500' : 'bg-gray-500'}`}>
  Content
</div>

// ✅ Extracted - backticks with no interpolations
<div className={`flex p-4`}>
  Content
</div>
```

#### Conditional Expressions

```tsx
// ✅ Extracted - conditional expressions at top level
<div className={isActive && 'bg-blue-500'}>
  Content
</div>
```

#### Function Calls (cn/clsx/classnames)

```tsx
// ✅ Extracted - cn() with string arguments
<div className={cn('flex', 'p-4', 'bg-white')}>
  Content
</div>

// ✅ Extracted - cn() with conditional arguments
<div className={cn('flex', isActive && 'bg-blue-500', 'text-white')}>
  Content
</div>

// ✅ Extracted - cn() with template literal arguments
<div className={cn('flex', `p-${size}`, isActive && 'bg-blue-500')}>
  Content
</div>
```

#### Both className and class Attributes

```tsx
// ✅ Extracted - React/Preact (className)
<div className="flex p-4">
  Content
</div>

// ✅ Extracted - Vue/Svelte/etc. (class)
<div class="flex p-4">
  Content
</div>
```

**Note:** The extractor automatically deduplicates classes, so if the same class appears multiple times, it will only be included once in the output.

### Custom Tailwind Classes

Custom classes from your Tailwind configuration are detected:

```tsx
// Using custom classes from tailwind.config.js
<div className="custom-card custom-shadow">
  Content
</div>
```

## Style Extraction

When using `stamp context --include-style`, Tailwind classes are included in the style metadata:

```json
{
  "style": {
    "sources": ["tailwind"],
    "tailwind": {
      "layout": ["flex", "flex-col"],
      "spacing": ["p-6", "gap-4"],
      "sizing": ["w-full"],
      "typography": ["text-2xl", "font-bold", "text-gray-900"],
      "colors": ["bg-white", "bg-blue-500", "text-gray-600"],
      "borders": ["rounded-lg", "ring-2"],
      "effects": ["shadow-md", "opacity-50"],
      "transitions": ["transition-colors"],
      "transforms": ["scale-105"],
      "interactivity": ["cursor-pointer"],
      "svg": ["fill-blue-500"],
      "other": ["custom-class"],
      "breakpoints": ["sm", "md", "lg"]
    }
  }
}
```

**Output format:**
- All categories return **arrays** of class names (JSON-ready)
- Arrays are **sorted** alphabetically
- Classes include their full variant prefixes (e.g., `md:hover:bg-blue-500`)
- Breakpoints are extracted separately as an array of breakpoint names
- Uncategorized classes go into the `other` category

## Usage

```bash
# Extract Tailwind classes
stamp context --include-style

# Or use the style command
stamp context style
```

## Tailwind Configuration

**Note:** LogicStamp does not read `tailwind.config.js` files. It extracts Tailwind classes directly from your source code using AST-based analysis. Custom classes defined in your Tailwind configuration will be detected if they appear in your component code, but the configuration file itself is not parsed.

The extractor works by:
- Analyzing className attributes in JSX
- Extracting utility classes from your source code
- Categorizing classes by type (layout, spacing, colors, etc.)
- Detecting breakpoint prefixes from class names

Custom classes from your Tailwind config (e.g., `custom-card`, `custom-shadow`) will be extracted if they're used in your components, but they'll be categorized as "other" since they don't match standard Tailwind utility patterns.

## Best Practices

1. **Use consistent spacing**: Stick to Tailwind's spacing scale
2. **Organize classes**: Group related utilities together
3. **Use responsive prefixes**: Leverage breakpoint prefixes for responsive design
4. **Extract components**: Use component extraction for repeated patterns
5. **Custom utilities**: Define custom utilities in config for reuse

## Common Patterns

### Card Component

```tsx
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {children}
    </div>
  );
}
```

### Responsive Grid

```tsx
function Grid({ items }: { items: Item[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map(item => <ItemCard key={item.id} item={item} />)}
    </div>
  );
}
```

### Button Variants

```tsx
function Button({ variant = 'primary' }: { variant?: 'primary' | 'secondary' }) {
  // ✅ Extracted - cn() with conditionals
  return (
    <button className={cn(
      'px-4 py-2 rounded font-medium transition-colors',
      variant === 'primary' 
        ? 'bg-blue-500 text-white hover:bg-blue-600'
        : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
    )}>
      Click me
    </button>
  );
}

// ✅ Also works with template literals
function ButtonAlt({ variant = 'primary' }: { variant?: 'primary' | 'secondary' }) {
  const baseClasses = 'px-4 py-2 rounded font-medium transition-colors';
  const variantClasses = variant === 'primary' 
    ? 'bg-blue-500 text-white hover:bg-blue-600'
    : 'bg-gray-200 text-gray-900 hover:bg-gray-300';
  
  return (
    <button className={`${baseClasses} ${variantClasses}`}>
      Click me
    </button>
  );
}
```

### Complex Variant Chains

```tsx
function InteractiveCard() {
  return (
    <div className="
      group-hover:dark:sm:bg-red-500
      aria-[checked=true]:peer-focus:ring-2
      md:hover:bg-blue-500
      light:bg-white
      motion-safe:transition-all
    ">
      Content
    </div>
  );
}
```

## Error Handling

The Tailwind extractor is designed to be robust and will never crash the CLI, even when encountering:

- **Malformed JSX**: Invalid or unclosed tags are handled gracefully
- **Parse errors**: AST parsing failures fall back to regex-based extraction
- **Invalid inputs**: Non-array inputs to categorization/breakpoint functions return empty results
- **Unexpected expressions**: Dynamic or complex expressions that can't be statically analyzed are silently skipped

All error handling is silent by default. To enable debug logging for troubleshooting, set the `LOGICSTAMP_DEBUG=1` environment variable:

```bash
LOGICSTAMP_DEBUG=1 logicstamp-context --include-style
```

This will output error messages to help identify problematic files or expressions.

## Limitations

### Current Limitations

1. **Array/Object literals in cn()**: Array syntax like `cn(['foo', 'bar'])` and object syntax like `cn({ 'foo': true, 'bar': isActive })` are not currently supported. Only direct arguments are extracted.

2. **Arbitrary values**: Arbitrary values (e.g., `w-[123px]`, `bg-[#ff0000]`) are detected but not fully parsed.

3. **JIT mode**: JIT mode classes are extracted but may not be validated against your Tailwind configuration.

4. **Custom plugins**: Custom Tailwind plugins may not be fully recognized in categorization.

5. **Runtime classes**: Dynamic class generation at runtime (e.g., classes stored in variables and concatenated later) is not tracked.

6. **Template literal expressions**: Static segments and Phase 1 dynamic expressions (variables, object properties, conditionals) are extracted (v0.3.9+). Phase 2 patterns (object lookups with variables, cross-file references, function calls) are not yet resolved.

### What's Supported

✅ **AST-based extraction** using `ts-morph` for accurate parsing  
✅ **Literal strings**: `className="flex p-4"`  
✅ **Template literals**: Static segments from `` className={`flex ${var}`} ``  
✅ **Conditional expressions**: `className={isActive && 'bg-blue'}`  
✅ **Function calls**: `cn()`, `clsx()`, `classnames()` with direct arguments  
✅ **Both attributes**: `className` (React/Preact) and `class` (Vue/Svelte/etc.)  
✅ **Early deduplication**: Classes are deduplicated as they're collected

## Related Documentation

- [Style Extraction](../cli/style.md) - Complete style extraction guide
- [ShadCN Support](./shadcn.md) - ShadCN/UI (built on Tailwind)
- [React Support](../frameworks/react.md) - React component patterns

