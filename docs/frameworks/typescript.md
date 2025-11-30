# TypeScript Framework Support

LogicStamp Context is built with TypeScript in mind and provides comprehensive support for TypeScript features, type extraction, and type-safe patterns.

## TypeScript Detection

LogicStamp automatically works with TypeScript projects:

- **File extensions**: `.ts` and `.tsx` files
- **TypeScript configuration**: Reads `tsconfig.json` for compiler options
- **Type system**: Uses TypeScript's AST for accurate type extraction
- **Type definitions**: Extracts interfaces, types, and type aliases

## What Gets Extracted

### Type Definitions

All TypeScript type definitions are extracted:

```typescript
// types/user.ts
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  metadata?: {
    createdAt: Date;
    lastLogin?: Date;
  };
}

export type UserId = string;
export type UserRole = User['role'];
```

**Extracted:**
- Interface definitions with all properties
- Type aliases
- Union types
- Optional properties (`?`)
- Nested types and objects
- Index signatures

### Component Props Types

TypeScript prop types are fully extracted:

```tsx
// components/Button.tsx
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ 
  label, 
  onClick, 
  variant = 'primary',
  disabled = false,
  size = 'md'
}: ButtonProps) {
  // ...
}
```

**Extracted props:**
- `label`: `string` (required)
- `onClick`: `() => void` (required)
- `variant`: `'primary' | 'secondary' | 'danger'` (optional, default: `'primary'`)
- `disabled`: `boolean` (optional, default: `false`)
- `size`: `'sm' | 'md' | 'lg'` (optional, default: `'md'`)

### Generic Types

TypeScript generics are captured:

```tsx
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map(item => (
        <li key={keyExtractor(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}
```

**Extracted:**
- Generic type parameters
- Generic constraints
- Generic usage in props and functions

### Utility Types

TypeScript utility types are recognized:

```typescript
type PartialUser = Partial<User>;
type RequiredUser = Required<User>;
type UserEmail = Pick<User, 'email'>;
type UserWithoutId = Omit<User, 'id'>;
type ReadonlyUser = Readonly<User>;
```

**Extracted:**
- Utility type usage
- Transformed types
- Type composition

### Enums

TypeScript enums are extracted:

```typescript
enum Status {
  Pending = 'pending',
  Active = 'active',
  Inactive = 'inactive',
}

enum Direction {
  Up,
  Down,
  Left,
  Right,
}
```

**Extracted:**
- Enum names and values
- String enums
- Numeric enums

## TypeScript-Specific Features

### Type Inference

LogicStamp extracts inferred types where possible:

```tsx
const users = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
];

// Inferred type: { id: string; name: string }[]
```

### Type Guards

Type guards are detected:

```typescript
function isUser(obj: unknown): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'name' in obj
  );
}
```

### Discriminated Unions

Discriminated union types are extracted:

```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### Mapped Types

Mapped types are recognized:

```typescript
type Optional<T> = {
  [K in keyof T]?: T[K];
};
```

## Type Extraction Quality

LogicStamp uses TypeScript's compiler API (`ts-morph`) for accurate type extraction:

- **Accurate types**: Uses TypeScript's type checker when possible
- **Type resolution**: Resolves type aliases and imports
- **Generic inference**: Understands generic type parameters
- **Union types**: Fully extracts union and intersection types

## Usage

TypeScript projects work out of the box:

```bash
# Scan TypeScript project
stamp context

# With type information included
stamp context --include-code full
```

## TypeScript Configuration

LogicStamp respects your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "target": "ES2020",
    "module": "ESNext",
    "strict": true
  }
}
```

**Respected settings:**
- JSX mode
- Target and module settings
- Path mappings (`paths` in `tsconfig.json`)
- Base URL

## Best Practices

1. **Use explicit types**: Explicit prop types improve extraction quality
2. **Type your exports**: Export types and interfaces for better context
3. **Use TypeScript strict mode**: Enables better type checking and extraction
4. **Organize types**: Keep types in dedicated files or colocated with components
5. **Avoid `any`**: Use `unknown` or proper types for better extraction

## Limitations

- Complex conditional types may not be fully resolved
- Type-level computations are not executed
- Some advanced TypeScript features may have limited extraction
- Circular type references may not be fully resolved

## Related Documentation

- [React Support](./react.md) - TypeScript with React
- [Next.js Support](./nextjs.md) - TypeScript with Next.js
- [UIF Contracts](../uif_contracts.md) - Component contract types

