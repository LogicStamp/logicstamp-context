# React Framework Support

LogicStamp Context is designed to work seamlessly with React applications. It automatically detects React components, hooks, and patterns in your codebase.

## React Detection

LogicStamp automatically identifies React code by:

- **File extensions**: `.tsx` and `.jsx` files
- **JSX syntax**: React component declarations and JSX elements
- **React imports**: Detects imports from `react` and `react-dom`
- **Component patterns**: Functional components, class components, and hooks

## What Gets Extracted

### Components

React components are automatically detected and analyzed:

```tsx
// Example: Button.tsx
import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
}

export function Button({ label, onClick }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>;
}
```

**Extracted information:**
- Component name: `Button`
- Props interface: `ButtonProps` with `label` and `onClick`
- Component kind: `component` (presentational)
- JSX structure and element types

### React Hooks

All React hooks are detected and categorized:

```tsx
import { useState, useEffect, useCallback } from 'react';

function MyComponent() {
  const [count, setCount] = useState(0);
  const memoizedCallback = useCallback(() => {
    // ...
  }, []);
  
  useEffect(() => {
    // ...
  }, []);
}
```

**Extracted hooks:**
- `useState` - State management
- `useEffect` - Side effects
- `useCallback` - Memoized callbacks
- `useMemo` - Memoized values
- `useRef` - Refs
- `useContext` - Context consumption
- Custom hooks

### Component Kinds

LogicStamp categorizes components into different kinds:

- **`react:component`** - React functional components (with hooks, JSX, or React imports)
- **`react:hook`** - Custom React hooks (functions starting with "use" and no JSX)
- **`ts:module`** - TypeScript modules/utilities (non-React code)
- **`node:cli`** - Node.js CLI scripts (files in `/cli/` directory or using `process.argv`)

**Note:** The `container`, `page`, and `layout` kinds mentioned in some documentation are not currently implemented. All React components are classified as `react:component` regardless of whether they have state, side effects, or are used as pages/layouts.

## React-Specific Features

### Props Extraction

TypeScript interfaces and prop types are fully extracted:

```tsx
interface UserCardProps {
  user: {
    id: string;
    name: string;
    email: string;
  };
  onEdit?: (id: string) => void;
  variant?: 'default' | 'compact';
}

export function UserCard({ user, onEdit, variant = 'default' }: UserCardProps) {
  // ...
}
```

**Extracted props:**
- `user`: Object with `id`, `name`, `email`
- `onEdit`: Optional function
- `variant`: Optional union type with default value

### Event Handlers

Event handlers and their types are captured:

```tsx
function Form() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // ...
  };
  
  return <form onSubmit={handleSubmit}>...</form>;
}
```

### State Management

Component state is extracted:

```tsx
function Counter() {
  const [count, setCount] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);
  
  // State extracted: { count: number, isActive: boolean }
}
```

## Usage

No special configuration needed for React projects:

```bash
# Scan React project
stamp context

# With style extraction (Tailwind, CSS Modules, etc.)
stamp context --include-style
```

## Best Practices

1. **Use TypeScript**: LogicStamp works best with TypeScript for accurate type extraction
2. **Type your props**: Explicit prop interfaces improve extraction quality
3. **Component organization**: LogicStamp respects your folder structure
4. **Hook naming**: Use `use` prefix for custom hooks (React convention)

## Limitations

- Class components are supported but functional components are preferred
- React Server Components (RSC) are detected but may have limited extraction
- Dynamic imports are tracked but not fully resolved

## Related Documentation

- [TypeScript Support](./typescript.md) - TypeScript-specific features
- [Next.js Support](./nextjs.md) - Next.js framework features
- [Style Extraction](../cli/style.md) - React styling patterns

