# Monorepo Support

LogicStamp Context works seamlessly with monorepos containing both backend and frontend code. Each file is analyzed independently, so you can mix Express.js, NestJS, React, Vue, and TypeScript files in the same codebase.

## How It Works

LogicStamp analyzes **each file independently**:

1. **Scans** all `.ts` and `.tsx` files recursively (Vue `.vue` SFC support is upcoming)
2. **Detects** framework per file (Express, NestJS, React, Vue, or TypeScript)
3. **Extracts** appropriate metadata based on detected framework
4. **Generates** contracts for all files, preserving your directory structure

**Key point:** Files don't interfere with each other. A backend file in one folder doesn't affect frontend extraction in another folder.

## Framework Detection Per File

Each file is analyzed independently with framework detection:

### Priority Order

1. **Backend** (Express/NestJS detected) → `node:api`
2. **Vue** (Vue import + Vue component patterns) → `vue:component` or `vue:composable`
3. **React** (React import or JSX/TSX + React patterns) → `react:component` or `react:hook`
4. **TypeScript module** (no framework patterns) → `ts:module`

### Detection Logic

- **Express.js**: Requires `express` import AND route patterns (`app.get()`, `router.post()`, etc.)
- **NestJS**: Requires `@nestjs` import AND controller decorators (`@Controller()`, `@Get()`, etc.)
  - **Note:** Only NestJS controllers/routes are extracted as `node:api`. Providers/services without route decorators are treated as `ts:module`.
- **Vue**: Requires `vue` import AND Vue component patterns (e.g., `defineComponent`, `createApp`, `setup()`, `computed`, `ref` usage in component context, or exports a component-ish default/object)
- **React**: Detected by React import OR JSX/TSX + React patterns (hooks, component export, etc.)
- **TypeScript module**: Fallback when no framework patterns are found (React is NOT the default fallback)

## Monorepo Structure Examples

### Example 1: Packages-Based Monorepo

```
my-monorepo/
├── packages/
│   ├── backend/
│   │   └── src/
│   │       ├── routes/
│   │       │   └── users.ts          → ✅ node:api (Express routes)
│   │       └── controllers/
│   │           └── posts.ts         → ✅ node:api (NestJS controller)
│   │
│   ├── frontend/
│   │   └── src/
│   │       ├── components/
│   │       │   └── Button.tsx        → ✅ react:component
│   │       └── hooks/
│   │           └── useAuth.ts        → ✅ react:hook
│   │
│   └── shared/
│       └── types.ts                  → ✅ ts:module
```

**Result:** All files are extracted correctly:
- Backend files → `backend.routes`, `backend.controller`
- Frontend files → `hooks`, `components`, `props`
- Shared files → `functions`, `imports`

### Example 2: Apps-Based Monorepo

```
my-monorepo/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── routes.ts             → ✅ node:api (Express)
│   │       └── middleware.ts         → ✅ ts:module
│   │
│   └── web/
│       └── src/
│           ├── pages/
│           │   └── Home.tsx          → ✅ react:component
│           └── components/
│               └── Header.tsx        → ✅ react:component
│
└── packages/
    └── ui/
        └── Button.tsx                 → ✅ react:component
```

**Result:** Each app and package is analyzed independently.

### Example 3: Mixed Structure

```
my-project/
├── server/
│   └── routes/
│       └── api.ts                    → ✅ node:api (Express)
│
├── client/
│   └── components/
│       └── App.tsx                    → ✅ react:component
│
└── shared/
    └── utils.ts                       → ✅ ts:module
```

**Result:** Works perfectly - no configuration needed.

## Usage

### Scan Entire Monorepo

```bash
# From monorepo root
stamp context

# Or specify a path
stamp context ./packages
```

### Scan Specific Packages

```bash
# Backend only
stamp context ./packages/backend

# Frontend only
stamp context ./packages/frontend

# Both (from root)
stamp context
```

### Output Structure

LogicStamp preserves your directory structure:

```
my-monorepo/
├── packages/
│   ├── backend/
│   │   └── src/
│   │       └── routes/
│   │           └── context.json     ← Backend contracts
│   │
│   └── frontend/
│       └── src/
│           └── components/
│               └── context.json     ← Frontend contracts
│
└── context_main.json                  ← Index of all folders
```

## What Gets Extracted

### Backend Files

Files with Express.js or NestJS patterns:

```typescript
// packages/backend/src/routes/users.ts
import express from 'express';
const router = express.Router();

router.get('/users', getUsers);
```

**Extracted:**
- `kind: "node:api"`
- `backend.routes: [{ path: '/users', method: 'GET', ... }]`
- `backend.framework: "express"`
- `apiSignature: { parameters, returnType, ... }`

### Frontend Files

Files with React or Vue patterns:

```typescript
// packages/frontend/src/components/Button.tsx
import { useState } from 'react';

export function Button() {
  const [count, setCount] = useState(0);
  return <button>{count}</button>;
}
```

**Extracted:**
- `kind: "react:component"`
- `hooks: ['useState']`
- `components: ['Button']`
- `props: { ... }`
- `state: { count: 'number' }`

### TypeScript Modules

Files without framework patterns:

```typescript
// packages/shared/utils.ts
export function formatDate(date: Date): string {
  return date.toISOString();
}
```

**Extracted:**
- `kind: "ts:module"`
- `functions: ['formatDate']`
- `imports: [...]`

## Framework Detection Details

### Express.js Detection

Requires **both**:
1. Express import: `import express from 'express'`
2. Route patterns: `app.get()`, `router.post()`, etc.

```typescript
// ✅ Detected as Express
import express from 'express';
app.get('/users', handler);

// ❌ Not detected (no route patterns)
import express from 'express';
const app = express(); // No routes defined
```

### NestJS Detection

Requires **both**:
1. NestJS import: `import { Controller } from '@nestjs/common'`
2. Controller decorators: `@Controller()`, `@Get()`, etc.

**Important:** Only NestJS controllers/routes are extracted as `node:api`. Providers/services without route decorators are treated as `ts:module`.

```typescript
// ✅ Detected as NestJS (node:api)
import { Controller } from '@nestjs/common';
@Controller('users')
export class UsersController { }

// ❌ Not detected (no controller decorators) → ts:module
import { Injectable } from '@nestjs/common';
@Injectable()
export class UsersService { }
```

### Vue Detection

Requires **both**:
1. Vue import: `import { ref } from 'vue'` or `import { ... } from 'vue/...'`
2. Vue component patterns: `defineComponent`, `createApp`, `setup()`, `computed`, `ref` usage in component context, OR exports a component-ish default/object

```typescript
// ✅ Detected as Vue (has import + patterns)
import { ref, defineComponent } from 'vue';
export default defineComponent({ ... });

// ❌ Not detected (has import but no component patterns) → ts:module
import { ref } from 'vue';
export function useSharedUtil() { return ref(0); } // Shared util, not a component
```

### React Detection

Detected by React import OR JSX/TSX + React patterns (hooks, component export, etc.):

```typescript
// ✅ Detected as React (has React import + JSX)
import { useState } from 'react';
export function Component() { return <div>...</div>; }

// ✅ Detected as React (has JSX even without explicit import)
export function Component() { return <div>...</div>; }

// ❌ Not detected (no React patterns) → ts:module
export function utility() { return 'hello'; }
```

**Note:** React is NOT the default fallback. Files without framework patterns become `ts:module`.

## Best Practices

### 1. Separate Backend and Frontend Files

**Recommended:** Keep backend and frontend code in separate files:

```
✅ Good:
packages/backend/src/routes/users.ts    → Backend routes
packages/frontend/src/components/App.tsx → Frontend component

❌ Avoid:
src/mixed.ts                             → Both backend routes and React components
```

**Why:** LogicStamp uses priority-based detection. If a file has multiple framework patterns, only one will be extracted based on priority: Backend > Vue > React. Files without framework patterns become `ts:module`.

### 2. Use Clear File Organization

Organize by concern:

```
✅ Good:
packages/
  backend/
    routes/
    controllers/
  frontend/
    components/
    hooks/
  shared/
    types/
    utils/

❌ Less ideal:
src/
  everything.ts  ← Mixed concerns
```

### 3. Framework-Specific Folders

Group files by framework:

```
✅ Good:
packages/
  express-api/
  nestjs-api/
  react-app/
  vue-app/

❌ Less ideal:
packages/
  api/
    express.ts
    nestjs.ts
    react.ts  ← Mixed frameworks in same folder
```

## Common Patterns

### Next.js Monorepo

```
my-monorepo/
├── apps/
│   ├── web/                    → Next.js app
│   │   └── app/
│   │       └── page.tsx        → ✅ react:component (with Next.js metadata)
│   │
│   └── api/                     → Express API
│       └── routes.ts           → ✅ node:api
```

**Note:** Next.js route handlers (`app/api/route.ts`) are currently treated as `ts:module` unless Express/NestJS patterns are detected. They may be detected as `react:component` if they contain React patterns (JSX, hooks, etc.), but route handlers without React patterns default to `ts:module`.

### Full-Stack Monorepo

```
my-monorepo/
├── server/
│   └── src/
│       ├── routes.ts           → ✅ node:api (Express)
│       └── services.ts        → ✅ ts:module
│
├── client/
│   └── src/
│       ├── App.tsx             → ✅ react:component
│       └── hooks/
│           └── useAuth.ts      → ✅ react:hook
│
└── shared/
    └── types.ts                → ✅ ts:module
```

## Troubleshooting

### Files Not Detected as Backend

**Problem:** Express/NestJS files are detected as `ts:module` instead of `node:api`.

**Solution:** Ensure both conditions are met:
- ✅ Framework import exists
- ✅ Route/controller patterns exist

```typescript
// ❌ Missing route patterns
import express from 'express';
const app = express(); // No routes → detected as ts:module

// ✅ Has route patterns
import express from 'express';
const app = express();
app.get('/users', handler); // Has routes → detected as node:api
```

### Mixed Files

**Problem:** File has both backend routes and frontend components.

**Solution:** Split into separate files:

```typescript
// ❌ Mixed file
import express from 'express';
import { useState } from 'react';

app.get('/api', handler);  // Backend
function Component() { }    // Frontend
// Only backend extracted (priority)

// ✅ Separate files
// routes.ts → Backend only
// Component.tsx → Frontend only
```

## Related Documentation

- [Express.js Support](./frameworks/express.md) - Express.js framework details
- [NestJS Support](./frameworks/nestjs.md) - NestJS framework details
- [React Support](./frameworks/react.md) - React framework details
- [Vue Support](./frameworks/vue.md) - Vue framework details
- [CLI Usage](./cli/context.md) - Command-line usage
