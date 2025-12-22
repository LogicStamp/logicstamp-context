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

**Detected metadata:**
- `isInAppDir: true` - File is in `/app/` directory
- `directive: 'client' | 'server'` - 'use client' or 'use server' directive
- Note: Route paths, layout hierarchy, page components, API route handlers, and loading/error boundaries are not extracted, only directory location and directives are detected

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

**Detected metadata:**
- `isInAppDir: true` - File is in `/app/` directory (if applicable)
- `directive: 'client' | 'server'` - 'use client' or 'use server' directive (if present)
- Note: Route paths, dynamic routes, API routes, and `getServerSideProps`/`getStaticProps`/`getStaticPaths` are not extracted, only directory location and directives are detected

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

**Detected:**
- File location in `/app/` directory (`isInAppDir: true`)
- 'use client' or 'use server' directive (`directive: 'client' | 'server'`)
- Note: Dynamic route parameters, route path structure, and route metadata are not extracted, only directory location and directives are detected

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

**Detected:**
- `directive: 'server'` - 'use server' directive is detected
- Note: Async components, server-side data fetching patterns, and server component patterns are not extracted, only the 'use server' directive is detected

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

**Detected:**
- `directive: 'client'` - 'use client' directive is detected
- Note: Client-side hooks and interactivity patterns are not extracted, only the 'use client' directive is detected

### Metadata

**Note:** Next.js metadata exports (e.g., `export const metadata = {...}`) are not currently extracted. Only the 'use client'/'use server' directives and file location in `/app/` directory are detected.

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

