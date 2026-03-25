# Next.js Framework Support

LogicStamp Context provides enhanced support for Next.js applications, automatically detecting Next.js-specific patterns, routing, and conventions.

## Next.js Detection

LogicStamp scans TypeScript and TSX files anywhere in the project, including Next.js folders.

- **Imports**: `next`, `next/link`, `next/router`, etc. appear in extracted import lists like any other module.
- **App Router metadata** (`isInAppDir`, `routeRole`, `segmentPath`, and `metadata` / `generateMetadata` handling) is only produced for files under an App Router tree: path contains `app/` or `src/app/` as a directory segment (see **App Router** below). This is path-based, not import-based.
- **Pages Router** (`pages/`, `pages/api/`): files are still analyzed as React or TypeScript modules, but they do **not** receive those App Router fields. Filename conventions like `pages/index.tsx` do not map to `routeRole: 'page'` or a computed `segmentPath` in the contract.

## What Gets Extracted

### App Router (Next.js 13+)

For files under `app/` or `src/app/`, LogicStamp fills the `nextjs` metadata object where applicable:

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

**Detected metadata (App Router paths only):**
- `isInAppDir: true` - File is under `app/` or `src/app/`
- `directive: 'client' | 'server'` - `'use client'` or `'use server'` at the top of the file (before imports)
- `routeRole: 'page' | 'layout' | 'loading' | 'error' | 'not-found' | 'template' | 'default' | 'route'` - Derived from the **basename** of the file (`page.tsx` → `page`, `layout.tsx` → `layout`, etc.)
- `segmentPath: string` - Route path derived from the directory under `app/` (e.g., `/blog/[slug]`, `/api/users`); route groups `(folder)` are stripped
- `metadata` - `export const metadata` and/or `export function generateMetadata` (static keys when parsable; dynamic flag when `generateMetadata` exists)

### Pages Router (Next.js 12 and earlier)

Files under `pages/` and `pages/api/` are parsed like any other `.ts` / `.tsx` source: components, hooks, props, exports, etc.

**`nextjs` metadata for Pages Router paths:**
- **`directive`**: Still detected if `'use client'` or `'use server'` appears at the top of the file (same rule as App Router).
- **`isInAppDir`, `routeRole`, `segmentPath`, `metadata`**: Not populated for `pages/` paths, because those fields are implemented for the App Router directory layout only.
- **Routing**: URL structure, dynamic segments, `pages/api` routes, and data-fetching helpers (`getServerSideProps`, `getStaticProps`, `getStaticPaths`) are **not** inferred or extracted as Next-specific metadata.

```
pages/
  index.tsx           → Analyzed as a React/TS module (not `routeRole: 'page'`)
  about.tsx           → Same
  blog/[slug].tsx     → Same (no extracted segment path in `nextjs`)
  api/users.ts        → Same (no App Router-style `segmentPath`)
```

### Next.js Components

#### Pages

**App Router — `app/page.tsx` (or `src/app/page.tsx`):**

```tsx
export default function HomePage() {
  return <div>Home</div>;
}
```

**Detected as:** `react:component` with `nextjs` metadata including:
- `isInAppDir: true`
- `routeRole: 'page'` (filename is `page.tsx`)
- `segmentPath: '/'` at the app root, or e.g. `/blog/[slug]` for `app/blog/[slug]/page.tsx`

**Pages Router — `pages/index.tsx`:**

```tsx
export default function HomePage() {
  return <div>Home</div>;
}
```

**Detected as:** `react:component` (when it matches React rules). The basename is `index`, not `page`, so **`routeRole` is not set**. **`isInAppDir`** and **`segmentPath`** are not set for `pages/` paths. Optional: `directive` if you add `'use client'` / `'use server'` at the top.

**Note:** All React components (including pages) use the kind `react:component`. Next.js-specific information is stored in the `nextjs` field when present, not as a separate component kind.

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

**Detected as:** `react:component` or `ts:module` (based on content). For **`app/api/.../route.ts`** under the App Router, `nextjs` can include:
- `isInAppDir: true`
- `routeRole: 'route'` (basename `route`)
- `segmentPath` such as `/api/users`

**Pages Router** handlers under `pages/api/` do **not** get `isInAppDir`, `routeRole`, or `segmentPath` from this logic.

**Note:** Next.js-specific information is stored in the `nextjs` metadata field when the file path is under `app/` or `src/app/`.

## Next.js-Specific Features

### Route Roles

Under **`app/`** or **`src/app/`**, LogicStamp detects route roles from special filenames:

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

These roles are **not** assigned from `pages/` filenames (e.g. `pages/index.tsx` does not produce `routeRole: 'page'`).

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

Typical layouts LogicStamp can scan (subject to your include patterns and ignore rules):

```
my-nextjs-app/
  app/                    # App Router — `nextjs` routing metadata filled here
    layout.tsx
    page.tsx
    components/
      Button.tsx
  pages/                  # Pages Router — TS/TSX analysis only; no App Router `nextjs` fields
    index.tsx
    api/
      users.ts
  public/                 # Static assets (usually ignored)
  node_modules/           # Dependencies (usually ignored)
```

## Best Practices

1. **App Router metadata**: Rich `nextjs` routing metadata is only filled for files under `app/` or `src/app/`
2. **Type your routes**: Type route params and search params for better extraction
3. **Organize components**: Keep components in `components/` directory
4. **API routes**: Use TypeScript for API route handlers

## Limitations

- **`middleware.ts`**: Not specially detected or summarized as a Next.js entry type.
- **Pages Router**: No contract fields for URL patterns, `getServerSideProps` / `getStaticProps` / `getStaticPaths`, or `pages/api` route paths in the `nextjs` object (those files are still parsed as normal TS/TSX).
- **Dynamic `import()`**: May appear in imports or code shape like other patterns; dynamic targets are not resolved to modules.

## Related Documentation

- [React Support](./react.md) - React component patterns
- [TypeScript Support](./typescript.md) - TypeScript features
- [Style Extraction](../cli/style.md) - Styling with Next.js

