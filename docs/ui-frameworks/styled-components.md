# Styled Components & Emotion Support

LogicStamp Context provides specialized support for CSS-in-JS libraries, including styled-components and Emotion, extracting styled component declarations and styling patterns.

## Styled Components Detection

LogicStamp automatically detects CSS-in-JS usage using **AST-based extraction** for accurate pattern matching:

- **Library imports**: Detects imports from `styled-components`, `@emotion/styled`, and `@emotion/react`
- **Styled syntax**: Recognizes `styled.div`, `styled(Component)`, `styled('div')`, and template literal patterns
- **Precise matching**: Only matches styled-components/Emotion imports (avoids false positives from MUI's `styled` or custom functions)
- **Theme usage**: Identifies theme provider and theme hook usage via AST traversal
- **CSS prop**: Detects `css` prop usage (Emotion) in JSX attributes

## What Gets Extracted

### Styled Components

Styled component declarations are detected and extracted:

```tsx
import styled from 'styled-components';

const Button = styled.button`
  padding: 12px 24px;
  background-color: #007bff;
  color: white;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;

  &:hover {
    background-color: #0056b3;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

function MyComponent() {
  return <Button>Click me</Button>;
}
```

**Extracted information:**
- Styled component names: `Button`
- Base element or component: `button` (extracted from AST)
- CSS properties used
- Pseudo-selectors: `:hover`, `:disabled`

### String Literal Styled Components

Styled components using string literals are also detected:

```tsx
import styled from 'styled-components';

const Box = styled('div')`
  padding: 1rem;
  margin: 1rem;
`;

const Wrapper = styled("section")`
  max-width: 1200px;
  margin: 0 auto;
`;
```

**Extracted:**
- String literal element names: `div`, `section`
- Component declarations
- Styling patterns

### Styled Component Extensions

Extended styled components are detected:

```tsx
import styled from 'styled-components';

const BaseButton = styled.button`
  padding: 12px 24px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
`;

const PrimaryButton = styled(BaseButton)`
  background-color: #007bff;
  color: white;

  &:hover {
    background-color: #0056b3;
  }
`;

const SecondaryButton = styled(BaseButton)`
  background-color: #6c757d;
  color: white;

  &:hover {
    background-color: #545b62;
  }
`;
```

**Extracted:**
- Component inheritance patterns
- Extended component relationships
- Variant component structures

### Styled Component with Props

Props-based styling is detected:

```tsx
import styled from 'styled-components';

interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

const Button = styled.button<ButtonProps>`
  padding: ${props => {
    switch (props.size) {
      case 'sm': return '8px 16px';
      case 'lg': return '16px 32px';
      default: return '12px 24px';
    }
  }};
  background-color: ${props => 
    props.variant === 'primary' ? '#007bff' : '#6c757d'
  };
  color: white;
  border-radius: 4px;
  border: none;
  cursor: pointer;
`;
```

**Extracted:**
- Props-based styling patterns
- Conditional styling logic
- Dynamic value generation

### Theme Integration

Theme usage with styled-components is detected:

```tsx
import styled, { ThemeProvider } from 'styled-components';

const theme = {
  colors: {
    primary: '#007bff',
    secondary: '#6c757d',
  },
  spacing: {
    sm: '8px',
    md: '16px',
    lg: '24px',
  },
};

const Button = styled.button`
  padding: ${props => props.theme.spacing.md};
  background-color: ${props => props.theme.colors.primary};
  color: white;
  border-radius: 4px;
`;

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Button>Click me</Button>
    </ThemeProvider>
  );
}
```

**Extracted:**
- Theme provider usage
- Theme access patterns (`props.theme`)
- Theme structure (when detectable)

### Emotion Styled

Emotion's styled API is also detected:

```tsx
import styled from '@emotion/styled';

const Card = styled.div`
  padding: 24px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 12px;
  color: #333;
`;
```

**Extracted:**
- Emotion styled components
- Component declarations
- Styling patterns

### CSS Prop (Emotion)

Emotion's `css` prop is detected:

```tsx
import { css } from '@emotion/react';

function MyComponent() {
  return (
    <div
      css={css`
        padding: 24px;
        background-color: white;
        border-radius: 8px;
      `}
    >
      Content
    </div>
  );
}
```

**Extracted:**
- `css` prop usage
- Inline CSS-in-JS styles
- Template literal styles

## Style Extraction

When using `stamp context --include-style`, styled-components information is included:

```json
{
  "styleSources": {
    "styledComponents": {
      "components": ["button", "div", "section"],
      "usesTheme": true,
      "usesCssProp": false
    }
  }
}
```

**Fields:**
- `components`: Array of base element/component names (e.g., `"button"`, `"div"`, `"Button"`) extracted from styled declarations, sorted and limited to 10
- `usesTheme`: Boolean indicating if theme usage is detected (via `props.theme`, `useTheme()` hook, or theme references in template literals)
- `usesCssProp`: Boolean indicating if `css` prop is used (Emotion feature)

## Styled Components-Specific Features

### Component Composition

Styled component composition patterns are recognized:

```tsx
import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Card = styled.div`
  padding: 24px;
  background-color: white;
  border-radius: 8px;
`;

const CardHeader = styled(Card)`
  border-bottom: 1px solid #eee;
  padding-bottom: 16px;
`;
```

**Extracted:**
- Component composition
- Nested styled components
- Reusable patterns

### Media Queries

Responsive design with styled-components is detected:

```tsx
import styled from 'styled-components';

const Container = styled.div`
  padding: 16px;

  @media (min-width: 768px) {
    padding: 24px;
  }

  @media (min-width: 1024px) {
    padding: 32px;
  }
`;
```

**Extracted:**
- Media query usage
- Responsive breakpoints
- Responsive styling patterns

### Keyframe Animations

CSS animations in styled-components are detected:

```tsx
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const AnimatedBox = styled.div`
  animation: ${fadeIn} 0.3s ease-in-out;
`;
```

**Extracted:**
- Animation keyframes
- Animation usage
- Animation patterns

## Usage

```bash
# Extract styled-components/Emotion information
stamp context --include-style

# Or use the style command
stamp context style
```

## Project Structure

LogicStamp recognizes common CSS-in-JS patterns:

```
my-app/
  components/
    Button/
      Button.tsx          # Uses styled-components
    Card/
      Card.tsx
  theme/
    index.ts              # Theme configuration
  app/
    page.tsx
```

## Best Practices

1. **Use TypeScript**: Type your styled components for better extraction
2. **Theme organization**: Centralize theme configuration
3. **Component composition**: Build complex components from simpler styled components
4. **Performance**: Use `css` prop (Emotion) for one-off styles
5. **Reusability**: Create base styled components for common patterns

## Common Patterns

### Themed Styled Component

```tsx
import styled from 'styled-components';
import { ThemeProvider } from 'styled-components';

const theme = {
  colors: {
    primary: '#007bff',
    secondary: '#6c757d',
    background: '#f8f9fa',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
  },
};

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${props => props.theme.spacing.md};
  background-color: ${props => 
    props.variant === 'primary' 
      ? props.theme.colors.primary 
      : props.theme.colors.secondary
  };
  color: white;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${props => 
      props.variant === 'primary' 
        ? '#0056b3' 
        : '#545b62'
    };
  }
`;

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
    </ThemeProvider>
  );
}
```

### Card Component with Styled Components

```tsx
import styled from 'styled-components';

const Card = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 24px;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
`;

const CardHeader = styled.div`
  border-bottom: 1px solid #eee;
  padding-bottom: 16px;
  margin-bottom: 16px;
`;

const CardTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: bold;
  margin: 0;
  color: #333;
`;

const CardContent = styled.div`
  color: #666;
  line-height: 1.6;
`;

function UserCard({ user }: { user: User }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
      </CardHeader>
      <CardContent>{user.bio}</CardContent>
    </Card>
  );
}
```

### Emotion with CSS Prop

```tsx
import { css } from '@emotion/react';

function Alert({ variant, children }: { variant: 'success' | 'error'; children: React.ReactNode }) {
  return (
    <div
      css={css`
        padding: 12px 16px;
        border-radius: 4px;
        background-color: ${variant === 'success' ? '#d4edda' : '#f8d7da'};
        color: ${variant === 'success' ? '#155724' : '#721c24'};
        border: 1px solid ${variant === 'success' ? '#c3e6cb' : '#f5c6cb'};
      `}
    >
      {children}
    </div>
  );
}
```

## Technical Details

### AST-Based Extraction

LogicStamp uses TypeScript AST parsing for accurate extraction:

- **Tagged template expressions**: Analyzes AST nodes to find `styled.*` patterns
- **Call expressions**: Detects `styled(Component)` and `styled('div')` patterns
- **Template literals**: Extracts theme usage from template literal expressions
- **JSX attributes**: Detects `css` prop usage in JSX elements
- **Optimized traversal**: Only checks relevant AST node types for performance

### Import Verification

The extractor verifies that `styled` is actually imported from:
- `styled-components`
- `@emotion/styled`
- `@emotion/react`

This prevents false positives from other libraries (e.g., Material-UI's `styled` function).

## Limitations

- Complex template literal expressions with deeply nested logic may have limited extraction
- Dynamic styled component generation via factory functions may not be detected
- Theme structure is detected but not fully analyzed (only presence is noted)
- Some advanced CSS-in-JS patterns may have limited extraction
- Styled components created via higher-order functions may not be recognized

## Related Documentation

- [Style Extraction](../cli/style.md) - Complete style extraction guide
- [React Support](../frameworks/react.md) - React component patterns
- [TypeScript Support](../frameworks/typescript.md) - TypeScript with styled-components

