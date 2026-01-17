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
- `routeRole: 'page' | 'layout' | 'loading' | 'error' | 'not-found' | 'template' | 'default' | 'route'` - Route role based on filename
- `segmentPath: string` - Route path derived from file structure (e.g., `/blog/[slug]`, `/api/users`)
- `metadata` - Metadata exports (static and/or dynamic)

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

**Detected as:** `react:component` with Next.js metadata:
- `isInAppDir: true` - File is in `/app/` directory
- `routeRole: 'page'` - Detected from `page.tsx` filename
- `segmentPath: '/'` - Root route path (or nested path like `/blog/[slug]`)

**Note:** All React components (including pages) are classified as `react:component`. Next.js-specific information is stored in the `nextjs` metadata field, not as a separate component kind.

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

**Detected as:** `react:component` with Next.js metadata:
- `isInAppDir: true` - File is in `/app/` directory
- `routeRole: 'layout'` - Detected from `layout.tsx` filename
- `segmentPath: '/'` - Route path (or nested path)

**Note:** All React components (including layouts) are classified as `react:component`. Next.js-specific information is stored in the `nextjs` metadata field, not as a separate component kind.

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

**Detected as:** `react:component` or `ts:module` (based on content) with Next.js metadata:
- `isInAppDir: true` - File is in `/app/api/` directory
- `routeRole: 'route'` - Detected from `route.ts` or `route.tsx` filename
- `segmentPath: '/api/users'` - API route path

**Note:** API routes are classified based on their content (React components vs TypeScript modules). Next.js-specific information is stored in the `nextjs` metadata field.

## Next.js-Specific Features

### Route Roles

LogicStamp detects route roles based on special Next.js filenames:

| Filename | Route Role | Description |
|----------|-----------|-------------|
| `page.tsx` | `page` | Page component |
| `layout.tsx` | `layout` | Layout component |
| `loading.tsx` | `loading` | Loading UI component |
| `error.tsx` | `error` | Error boundary component |
| `not-found.tsx` | `not-found` | Not found page |
| `template.tsx` | `template` | Template component |
| `default.tsx` | `default` | Default parallel route |
| `route.ts` | `route` | API route handler |

### Segment Paths

LogicStamp extracts route paths from file structure:

```tsx
// app/page.tsx
export default function HomePage() {
  return <div>Home</div>;
}
```

**Detected:** `segmentPath: '/'`

```tsx
// app/blog/page.tsx
export default function BlogPage() {
  return <div>Blog</div>;
}
```

**Detected:** `segmentPath: '/blog'`

```tsx
// app/blog/[slug]/page.tsx
export default function BlogPost({ params }: { params: { slug: string } }) {
  return <div>Post: {params.slug}</div>;
}
```

**Detected:** `segmentPath: '/blog/[slug]'`

```tsx
// app/(auth)/login/page.tsx
export default function LoginPage() {
  return <div>Login</div>;
}
```

**Detected:** `segmentPath: '/login'` (route groups are removed)

```tsx
// app/api/users/route.ts
export async function GET() {
  return Response.json({ users: [] });
}
```

**Detected:** `segmentPath: '/api/users'`

**Note:** Route groups (parentheses) are automatically removed from segment paths. Both `app/` and `src/app/` directory structures are supported.

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

LogicStamp extracts Next.js metadata exports:

#### Static Metadata

```tsx
// app/page.tsx
export const metadata = {
  title: 'My Page',
  description: 'Page description',
  keywords: ['nextjs', 'react']
};

export default function Page() {
  return <div>Page</div>;
}
```

**Detected:**
- `metadata.static` - Object containing extracted metadata properties
- Supports string, number, boolean, and null values
- Complex values (objects, arrays, function calls) are marked with their type

#### Dynamic Metadata

```tsx
// app/blog/[slug]/page.tsx
export function generateMetadata({ params }: { params: { slug: string } }) {
  return {
    title: `Post: ${params.slug}`,
    description: 'Dynamic description'
  };
}

export default function BlogPost() {
  return <div>Post</div>;
}
```

**Detected:**
- `metadata.dynamic: true` - Indicates `generateMetadata` function exists

#### Combined Metadata

Files can have both static and dynamic metadata:

```tsx
export const metadata = {
  title: 'Default Title'
};

export function generateMetadata() {
  return {
    description: 'Dynamic description'
  };
}
```

**Detected:**
- Both `metadata.static` and `metadata.dynamic: true` are included

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

