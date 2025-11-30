# Next.js Framework Support

LogicStamp Context provides enhanced support for Next.js applications, automatically detecting Next.js-specific patterns, routing, and conventions.

## Next.js Detection

LogicStamp automatically identifies Next.js projects by:

- **File structure**: Detects `app/`, `pages/`, and `src/app/` directories
- **Next.js imports**: Detects imports from `next`, `next/link`, `next/router`, etc.
- **Route files**: Identifies page and layout files based on Next.js conventions
- **API routes**: Detects API route handlers in `pages/api/` or `app/api/`

## What Gets Extracted

### App Router (Next.js 13+)

LogicStamp detects and extracts App Router patterns:

```
app/
  layout.tsx          → Layout component
  page.tsx            → Page component
  loading.tsx         → Loading component
  error.tsx           → Error component
  route.ts            → Route handler
  api/
    users/
      route.ts        → API route
```

**Extracted metadata:**
- Route paths from folder structure
- Layout hierarchy
- Page components
- API route handlers
- Loading and error boundaries

### Pages Router (Next.js 12 and earlier)

LogicStamp also supports the Pages Router:

```
pages/
  index.tsx           → Home page (/)
  about.tsx           → About page (/about)
  blog/
    [slug].tsx        → Dynamic route (/blog/:slug)
  api/
    users.ts          → API route (/api/users)
```

**Extracted metadata:**
- Route paths from file structure
- Dynamic routes (`[param]`, `[...slug]`)
- API routes
- `getServerSideProps`, `getStaticProps`, `getStaticPaths`

### Next.js Components

#### Pages

```tsx
// app/page.tsx or pages/index.tsx
export default function HomePage() {
  return <div>Home</div>;
}
```

**Detected as:** `page` component kind

#### Layouts

```tsx
// app/layout.tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

**Detected as:** `layout` component kind

#### API Routes

```tsx
// app/api/users/route.ts
export async function GET(request: Request) {
  return Response.json({ users: [] });
}

export async function POST(request: Request) {
  // ...
}
```

**Detected as:** API route handlers with HTTP methods

## Next.js-Specific Features

### Routing

LogicStamp extracts routing information:

```tsx
// pages/blog/[slug].tsx
export default function BlogPost({ params }: { params: { slug: string } }) {
  return <div>Post: {params.slug}</div>;
}
```

**Extracted:**
- Dynamic route parameters
- Route path structure
- Route metadata

### Next.js Imports

Common Next.js imports are tracked:

```tsx
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Metadata } from 'next';
```

**Detected imports:**
- `next/link` - Client-side navigation
- `next/image` - Optimized images
- `next/navigation` - App Router navigation hooks
- `next/router` - Pages Router navigation
- `next/head` - Head management
- `next/script` - Script optimization

### Server Components

Next.js Server Components are detected:

```tsx
// app/components/ServerComponent.tsx
async function ServerComponent() {
  const data = await fetch('...');
  return <div>{data}</div>;
}
```

**Extracted:**
- Async components
- Server-side data fetching
- Server component patterns

### Client Components

Client components with `'use client'` directive are identified:

```tsx
'use client';

import { useState } from 'react';

export function ClientComponent() {
  const [state, setState] = useState(0);
  return <button onClick={() => setState(state + 1)}>{state}</button>;
}
```

**Extracted:**
- Client component directive
- Client-side hooks and interactivity

### Metadata

Next.js metadata exports are captured:

```tsx
// app/page.tsx
export const metadata = {
  title: 'Home Page',
  description: 'Welcome to our site',
};
```

## Usage

No special configuration needed for Next.js projects:

```bash
# Scan Next.js project
stamp context

# With style extraction
stamp context --include-style

# Specific directory
stamp context ./app
```

## Next.js Project Structure

LogicStamp respects Next.js conventions:

```
my-nextjs-app/
  app/                    # App Router (Next.js 13+)
    layout.tsx
    page.tsx
    components/
      Button.tsx
  pages/                  # Pages Router (if used)
    index.tsx
    api/
      users.ts
  public/                 # Static assets (ignored)
  node_modules/             # Dependencies (ignored)
```

## Best Practices

1. **Use App Router**: LogicStamp has better support for App Router patterns
2. **Type your routes**: Type route params and search params for better extraction
3. **Organize components**: Keep components in `components/` directory
4. **API routes**: Use TypeScript for API route handlers

## Limitations

- Middleware files are detected but not fully analyzed
- `getServerSideProps` and `getStaticProps` are identified but their return types may not be fully extracted
- Dynamic imports in routes are tracked but not resolved

## Related Documentation

- [React Support](./react.md) - React component patterns
- [TypeScript Support](./typescript.md) - TypeScript features
- [Style Extraction](../cli/style.md) - Styling with Next.js

