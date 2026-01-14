# CSS/SCSS Modules Support

LogicStamp Context provides comprehensive support for CSS and SCSS Modules, extracting style information from your style files and component usage.

## CSS/SCSS Modules Detection

LogicStamp automatically detects CSS and SCSS Modules usage by:

- **File imports**: Detects imports from `.module.scss`, `.module.css`, `.scss`, and `.css` files in TSX/TS component files
- **Module syntax**: Recognizes CSS Module import patterns
- **File parsing**: Parses the imported style files to extract selectors, properties, and SCSS features

**Important**: Only CSS/SCSS files that are imported by your TSX/TS component files are parsed. Standalone CSS/SCSS files that aren't imported won't be analyzed.

## What Gets Extracted

### CSS Modules

CSS Modules are detected and their usage is extracted:

```tsx
// components/Button.tsx
import styles from './Button.module.css';

function Button() {
  return <button className={styles.button}>Click me</button>;
}
```

```css
/* Button.module.css */
.button {
  padding: 12px 24px;
  background-color: #007bff;
  color: white;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}

.button:hover {
  background-color: #0056b3;
}
```

**Extracted information:**
- Module import path: `./Button.module.css`
- CSS selectors: `.button`
- CSS properties: `padding`, `background-color`, `color`, `border-radius`, `border`, `cursor`
- Pseudo-selectors: `:hover`

### SCSS Modules

SCSS Modules with advanced features are detected:

```tsx
// components/Card.tsx
import styles from './Card.module.scss';

function Card({ children }: { children: React.ReactNode }) {
  return <div className={styles.card}>{children}</div>;
}
```

```scss
// Card.module.scss
$primary-color: #007bff;
$spacing: 16px;

.card {
  padding: $spacing;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .title {
    font-size: 1.5rem;
    font-weight: bold;
    color: $primary-color;
  }

  @mixin card-variant($bg-color) {
    background-color: $bg-color;
    border: 2px solid darken($bg-color, 10%);
  }

  &.featured {
    @include card-variant($primary-color);
  }
}
```

**Extracted SCSS features:**
- **Variables**: `$primary-color`, `$spacing`
- **Nesting**: Nested selectors (`.card .title`, `.card:hover`)
- **Mixins**: `@mixin card-variant`
- **Selectors**: `.card`, `.title`, `.featured`
- **Properties**: All CSS properties used

### Regular CSS/SCSS Files

Non-module CSS and SCSS files are also detected:

```tsx
// components/Header.tsx
import './Header.css';

function Header() {
  return <header className="header">Header</header>;
}
```

```css
/* Header.css */
.header {
  background-color: #333;
  color: white;
  padding: 1rem;
}
```

**Extracted:**
- Style file import path
- Selectors and properties
- SCSS features (if applicable)

## Style Extraction

When using `stamp context --include-style`, CSS/SCSS Module information is included:

```json
{
  "style": {
    "sources": ["scssModule"],
    "scssModule": "./Button.module.scss",
    "scssDetails": {
      "selectors": [".button", ".button:hover"],
      "properties": ["padding", "background-color", "color", "border-radius"],
      "features": {
        "variables": true,
        "nesting": true,
        "mixins": false
      }
    }
  }
}
```

## SCSS-Specific Features

### Variables

SCSS variables are detected:

```scss
$primary-color: #007bff;
$secondary-color: #6c757d;
$spacing-unit: 8px;

.button {
  background-color: $primary-color;
  padding: $spacing-unit * 2;
}
```

**Detected:**
- Presence of SCSS variables (boolean flag: `variables: true`)
- Note: Variable names, values, and usage patterns are not extracted, only the presence of variables is detected

### Nesting

SCSS nesting is recognized:

```scss
.card {
  padding: 16px;

  .header {
    font-size: 1.5rem;
  }

  .content {
    margin-top: 8px;
  }

  &:hover {
    transform: scale(1.02);
  }
}
```

**Detected:**
- Presence of SCSS nesting (boolean flag: `nesting: true`)
- Detects nesting via parent selector (`&`) with indentation
- Note: Full nested selector structure is not extracted, only the presence of nesting is detected

### Mixins

SCSS mixins are detected:

```scss
@mixin flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}

@mixin button-variant($color) {
  background-color: $color;
  border: 2px solid darken($color, 10%);
  
  &:hover {
    background-color: darken($color, 5%);
  }
}

.container {
  @include flex-center;
}

.button {
  @include button-variant(#007bff);
}
```

**Detected:**
- Presence of `@mixin` definitions (boolean flag: `mixins: true`)
- Note: `@include` usage is not detected, only `@mixin` definitions are detected

### Partials and Imports

SCSS partials and imports are tracked:

```scss
// _variables.scss
$primary-color: #007bff;

// _mixins.scss
@mixin card-style {
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

// main.scss
@import 'variables';
@import 'mixins';

.card {
  @include card-style;
  background-color: $primary-color;
}
```

**Extracted:**
- Import statements
- Partial file usage

## Usage

```bash
# Extract CSS/SCSS Module information
stamp context --include-style

# Or use the style command
stamp context style
```

## Project Structure

LogicStamp recognizes common CSS/SCSS Module patterns:

```
my-app/
  components/
    Button/
      Button.tsx
      Button.module.scss    # SCSS Module
    Card/
      Card.tsx
      Card.module.css       # CSS Module
  styles/
    _variables.scss         # SCSS partials
    _mixins.scss
    main.scss              # Main stylesheet
  app/
    page.tsx
```

## Best Practices

1. **Use CSS Modules**: Use `.module.css` or `.module.scss` for component-scoped styles
2. **Organize variables**: Keep SCSS variables in partials for reuse
3. **Use mixins**: Create reusable mixins for common patterns
4. **Nest appropriately**: Use SCSS nesting but avoid deep nesting
5. **Name selectors clearly**: Use descriptive class names in CSS Modules

## Common Patterns

### Component with CSS Module

```tsx
// Button.tsx
import styles from './Button.module.css';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export function Button({ variant = 'primary', children }: ButtonProps) {
  return (
    <button className={`${styles.button} ${styles[variant]}`}>
      {children}
    </button>
  );
}
```

```css
/* Button.module.css */
.button {
  padding: 12px 24px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.primary {
  background-color: #007bff;
  color: white;
}

.primary:hover {
  background-color: #0056b3;
}

.secondary {
  background-color: #6c757d;
  color: white;
}

.secondary:hover {
  background-color: #545b62;
}
```

### SCSS Module with Variables and Mixins

```tsx
// Card.tsx
import styles from './Card.module.scss';

export function Card({ children }: { children: React.ReactNode }) {
  return <div className={styles.card}>{children}</div>;
}
```

```scss
// Card.module.scss
$card-padding: 24px;
$card-radius: 8px;
$card-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

@mixin card-base {
  padding: $card-padding;
  border-radius: $card-radius;
  box-shadow: $card-shadow;
  background-color: white;
}

.card {
  @include card-base;
  
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .title {
    font-size: 1.5rem;
    font-weight: bold;
    margin-bottom: 12px;
  }

  .content {
    color: #666;
    line-height: 1.6;
  }
}
```

### Combining CSS Modules with Tailwind

```tsx
// HybridComponent.tsx
import styles from './HybridComponent.module.css';

function HybridComponent() {
  return (
    <div className={`${styles.container} flex flex-col gap-4`}>
      <h1 className={styles.title}>Title</h1>
      <p className="text-gray-600">Description</p>
    </div>
  );
}
```

## Error Handling

The SCSS extractor is designed to be robust and will never crash the CLI, even when encountering:

- **Missing files**: CSS/SCSS module files that don't exist are silently skipped
- **Malformed CSS/SCSS**: Invalid syntax, unclosed braces, or parse errors are handled gracefully
- **Invalid file paths**: Non-existent directories or invalid paths return empty results
- **AST traversal errors**: Complex or malformed TypeScript that causes AST parsing issues falls back gracefully
- **File read errors**: Permission issues or inaccessible files are handled without crashing

All error handling is silent by default. To enable debug logging for troubleshooting, set the `LOGICSTAMP_DEBUG=1` environment variable:

```bash
LOGICSTAMP_DEBUG=1 stamp context --include-style
```

This will output error messages to help identify problematic files or expressions:

```
[LogicStamp][DEBUG] scss.parseStyleFile error: { filePath: '/path/to/file.scss', error: 'ENOENT: no such file or directory' }
[LogicStamp][DEBUG] scss.extractScssMetadata error: { filePath: '/path/to/file.tsx', error: 'Cannot read property \'getText\' of undefined' }
```

### Best Practices

- **Don't worry about missing files**: If a component imports a style file that doesn't exist, the extractor will skip it and continue
- **Check debug logs when issues occur**: Enable `LOGICSTAMP_DEBUG=1` if you suspect extraction problems
- **Expect partial results**: Some extraction failures are normal (e.g., files that don't exist yet or are generated at build time)

## Limitations

- Complex SCSS functions and calculations may not be fully parsed
- Dynamic imports of style files may not be tracked
- CSS custom properties (CSS variables) are detected but not fully analyzed
- Some advanced SCSS features may have limited extraction
- Style files referenced via string interpolation may not be detected

## Related Documentation

- [Style Extraction](../cli/style.md) - Complete style extraction guide
- [Tailwind CSS Support](./tailwind.md) - Combining with Tailwind
- [React Support](../frameworks/react.md) - React component patterns

