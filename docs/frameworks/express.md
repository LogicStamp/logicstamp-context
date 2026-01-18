# Express.js Framework Support

LogicStamp Context provides comprehensive support for Express.js applications, automatically detecting routes, API handlers, and extracting API signatures from your backend code.

## Express.js Detection

LogicStamp automatically identifies Express.js code by:

- **Express imports**: Detects imports from `express` and `express/*` packages
- **Route patterns**: Recognizes `app.get()`, `app.post()`, `router.get()`, `router.post()`, etc.
- **HTTP methods**: Detects GET, POST, PUT, DELETE, PATCH, and ALL methods
- **Route handlers**: Identifies named functions and anonymous handlers

**Detection requires both:**
1. Express import (`import express from 'express'`)
2. Route method calls (`app.get()`, `router.post()`, etc.)

This two-factor detection prevents false positives - files that import Express but don't define routes won't be detected as backend files.

## What Gets Extracted

### Routes

Express routes are automatically detected and analyzed:

```typescript
// Example: routes/users.ts
import express from 'express';
const router = express.Router();

function getUsers(req: express.Request, res: express.Response) {
  res.json({ users: [] });
}

router.get('/users', getUsers);
router.post('/users', (req, res) => {
  res.json({ created: true });
});
```

**Extracted information:**
- Route paths: `/users`, `/users/:id`
- HTTP methods: GET, POST, PUT, DELETE, PATCH, ALL
- Handler function names: `getUsers` or `anonymous` for inline handlers
- Route parameters: `['id']` from paths like `/users/:id`

### Route Parameters

LogicStamp extracts route parameters from path patterns:

```typescript
// Single parameter
app.get('/users/:id', getUserById);
// Extracted: params: ['id']

// Multiple parameters
app.get('/users/:userId/posts/:postId', getPost);
// Extracted: params: ['userId', 'postId']
```

### API Signatures

For named handler functions, LogicStamp extracts API signatures:

```typescript
import express, { Request, Response } from 'express';

function createUser(
  req: Request<{}, UserResponse, CreateUserRequest>,
  res: Response<UserResponse>
): void {
  const user = req.body;
  // ... create user logic
  res.status(201).json({ id: '123', ...user });
}

app.post('/users', createUser);
```

**Extracted API signature:**
- Parameters: `{ req: 'Request<{}, UserResponse, CreateUserRequest>', res: 'Response<UserResponse>' }`
- Return type: `void`
- Request type: `CreateUserRequest` (for POST/PUT/PATCH)
- Response type: `UserResponse`

### Component Kinds

LogicStamp categorizes Express files into different kinds:

- **`node:api`** - Express route files with route definitions
- **`ts:module`** - TypeScript modules/utilities (non-route files)

## Express-Specific Features

### Route Extraction

LogicStamp extracts routes from both `app` and `router` instances:

```typescript
// Using app instance
import express from 'express';
const app = express();

app.get('/users', getUsers);
app.post('/users', createUser);
app.put('/users/:id', updateUser);
app.delete('/users/:id', deleteUser);
app.patch('/users/:id', patchUser);
app.all('/api/*', handleAll);

// Using router instance
const router = express.Router();

router.get('/posts', getPosts);
router.post('/posts', createPost);
```

**Extracted routes:**
- All HTTP methods are supported (GET, POST, PUT, DELETE, PATCH, ALL)
- Both `app` and `router` instances are detected
- Route paths are extracted from string literals

### Handler Function Detection

LogicStamp identifies handler functions:

```typescript
// Named function handler
function getUserById(req: Request, res: Response) {
  // ...
}
app.get('/users/:id', getUserById);
// Extracted: handler: 'getUserById'

// Anonymous handler
app.post('/users', (req, res) => {
  // ...
});
// Extracted: handler: 'anonymous'

// Arrow function assigned to variable
const createUser = (req: Request, res: Response) => {
  // ...
};
app.post('/users', createUser);
// Extracted: handler: 'createUser'
```

### API Signature Extraction

For named handlers, LogicStamp extracts function signatures:

```typescript
interface CreateUserRequest {
  name: string;
  email: string;
}

interface UserResponse {
  id: string;
  name: string;
  email: string;
}

function createUser(
  req: Request<{}, UserResponse, CreateUserRequest>,
  res: Response<UserResponse>
): Promise<void> {
  // ...
}

app.post('/users', createUser);
```

**Extracted API signature:**
```json
{
  "parameters": {
    "req": "Request<{}, UserResponse, CreateUserRequest>",
    "res": "Response<UserResponse>"
  },
  "returnType": "Promise<void>",
  "requestType": "CreateUserRequest",
  "responseType": "UserResponse"
}
```

**Note:** API signatures are only extracted for named handler functions. Anonymous handlers don't have API signatures extracted.

### Language-Specific Metadata

LogicStamp extracts Express-specific patterns:

```typescript
// Route patterns are captured
app.get('/users', handler);
router.post('/posts', handler);
// Extracted: decorators: ['@app.get', '@router.post']
```

## Usage

### Analyzing Express Projects

Generate context for an Express.js project:

```bash
stamp context
```

The tool will automatically:
1. Detect Express imports and route patterns
2. Extract route definitions (paths, methods, handlers)
3. Extract API signatures from named handlers
4. Identify route parameters
5. Generate structured contracts for each route file

### Project Structure

LogicStamp works with common Express.js project structures:

```
my-express-app/
  src/
    routes/
      users.ts          # Route definitions
      posts.ts
    controllers/
      userController.ts # Controller logic
    app.ts              # Express app setup
  server.ts            # Server entry point
```

### Integration with Build Tools

LogicStamp works with common Express.js setups:

- **TypeScript** - Full support for TypeScript Express projects
- **Express Router** - Detects routes defined with `express.Router()`
- **Express App** - Detects routes defined on `express()` instance
- **Custom setups** - Compatible with any Express.js TypeScript project

## Best Practices

### 1. Use Named Handler Functions

Named functions enable API signature extraction:

```typescript
// ✅ Good: Named function with types
function getUserById(
  req: Request<{ id: string }>,
  res: Response<User>
): void {
  // ...
}
app.get('/users/:id', getUserById);

// ❌ Less ideal: Anonymous handler (no API signature extraction)
app.get('/users/:id', (req, res) => {
  // ...
});
```

### 2. Type Your Request/Response

TypeScript types improve extraction quality:

```typescript
// ✅ Good: Typed request and response
interface CreateUserRequest {
  name: string;
  email: string;
}

interface UserResponse {
  id: string;
  name: string;
  email: string;
}

function createUser(
  req: Request<{}, UserResponse, CreateUserRequest>,
  res: Response<UserResponse>
): void {
  // ...
}
```

### 3. Organize Routes by Resource

Keep related routes together:

```
routes/
  users.ts      # All user routes
  posts.ts      # All post routes
  comments.ts   # All comment routes
```

### 4. Use Express Router for Modular Routes

Router instances are fully supported:

```typescript
// routes/users.ts
import express from 'express';
const router = express.Router();

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', createUser);

export default router;

// app.ts
import usersRouter from './routes/users';
app.use('/api/users', usersRouter);
```

## Examples

### Express Route File

```typescript
// routes/users.ts
import express, { Request, Response } from 'express';

interface User {
  id: string;
  name: string;
  email: string;
}

interface CreateUserRequest {
  name: string;
  email: string;
}

function getAllUsers(req: Request, res: Response<User[]>) {
  res.json([]);
}

function getUserById(req: Request<{ id: string }>, res: Response<User>) {
  const { id } = req.params;
  res.json({ id, name: '', email: '' });
}

function createUser(
  req: Request<{}, User, CreateUserRequest>,
  res: Response<User>
) {
  const user = req.body;
  res.status(201).json({ id: '123', ...user });
}

const router = express.Router();
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.post('/', createUser);

export default router;
```

**Generated Contract:**

```json
{
  "kind": "node:api",
  "version": {
    "variables": [],
    "hooks": [],
    "components": [],
    "functions": ["getAllUsers", "getUserById", "createUser"]
  },
  "logicSignature": {
    "props": {},
    "emits": {},
    "apiSignature": {
      "parameters": {
        "req": "Request",
        "res": "Response",
        "id": "string"
      },
      "returnType": "void",
      "requestType": "CreateUserRequest",
      "responseType": "User | User[]"
    }
  },
  "backend": {
    "framework": "express",
    "routes": [
      {
        "path": "/",
        "method": "GET",
        "handler": "getAllUsers"
      },
      {
        "path": "/:id",
        "method": "GET",
        "handler": "getUserById",
        "params": ["id"]
      },
      {
        "path": "/",
        "method": "POST",
        "handler": "createUser"
      }
    ]
  }
}
```

### Express App with Multiple Routes

```typescript
// app.ts
import express from 'express';
import usersRouter from './routes/users';
import postsRouter from './routes/posts';

const app = express();

app.use('/api/users', usersRouter);
app.use('/api/posts', postsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
```

**Extracted routes:**
- `/api/users/*` - From usersRouter
- `/api/posts/*` - From postsRouter
- `/health` - Direct app route

## Framework Detection Priority

When a file imports both frontend and backend frameworks, LogicStamp uses a priority system:

- **Vue takes priority**: If a file has Vue imports, Vue extractors are used
- **Backend takes priority**: If no Vue imports but Express imports AND route patterns are detected, backend extractors are used
- **React fallback**: If no Vue or backend patterns are detected, React extractors are used (default)

**Example:**
```typescript
import express from 'express';
import { useState } from 'react'; // This file will be analyzed as backend

const app = express();
app.get('/api/data', (req, res) => {
  // Analyzed as node:api, not react:component
});
```

**Result:**
- Backend routes: ✅ Extracted (`backend.routes`)
- React hooks: ❌ Not extracted (skipped when backend detected)
- React components: ❌ Not extracted (skipped when backend detected)
- Contract kind: `node:api`

**Recommendation:** Keep backend and frontend code in separate files for accurate analysis. LogicStamp analyzes each file independently, so separating concerns ensures both are extracted correctly in their respective files.

## Limitations

### Middleware Extraction

Express middleware is not currently extracted:

```typescript
// ✅ Routes are extracted
app.get('/users', handler);

// ❌ Middleware is not extracted
app.use(express.json());
app.use(cors());
app.use('/api', authMiddleware);
```

**Why:** LogicStamp focuses on extracting API routes and their signatures. The extractor only looks for HTTP method calls (`get`, `post`, `put`, `delete`, `patch`, `all`) and doesn't process `app.use()` calls for middleware.

**Impact:** 
- Route definitions are fully extracted
- Middleware configuration is not documented
- Route-level middleware (`app.use('/api', middleware)`) is not tracked

**Workaround:** Document middleware separately or use comments to annotate middleware usage.

### Route Composition

Nested route composition may not be fully tracked:

```typescript
// ✅ Direct routes are extracted
app.get('/users', handler);

// ⚠️ Routes from mounted routers are extracted from router file, not app file
app.use('/api', router); // Router routes extracted from router.ts, not app.ts
```

**Why:** LogicStamp analyzes each file independently. When you mount a router with `app.use('/api', router)`, the extractor sees this as a middleware call (not a route), so it's not extracted. The routes are extracted from the router file itself, but the full path (`/api/users`) isn't computed.

**Impact:**
- Routes in router files are extracted correctly
- The mounting path (`/api`) is not combined with router paths
- Each file is analyzed in isolation

**Example:**
```typescript
// app.ts
app.use('/api/users', usersRouter);  // ❌ Not extracted here

// routes/users.ts  
router.get('/', getAllUsers);         // ✅ Extracted as GET /
router.get('/:id', getUserById);      // ✅ Extracted as GET /:id
// Note: Full paths (/api/users/:id) are not computed
```

**Workaround:** Routes are still extracted from router files. The route structure is captured, but you'll need to manually combine mounting paths with route paths.

### Dynamic Route Paths

Only string literal paths are extracted:

```typescript
// ✅ Extracted: String literal
app.get('/users/:id', handler);

// ❌ Not extracted: Dynamic path construction
const path = '/users';
app.get(path, handler);
```

**Why:** LogicStamp uses static analysis and can only extract values that are known at compile time. Dynamic paths require runtime evaluation, which static analysis cannot perform.

**Impact:**
- String literal paths work perfectly: `app.get('/users/:id', handler)`
- Variable paths are not extracted: `const path = '/users'; app.get(path, handler)`
- Template literals with variables: ``app.get(`${prefix}/users`, handler)``
- Function calls: `app.get(getRoutePath(), handler)`

**Workaround:** Use string literals for route paths when possible. If you need dynamic paths, they won't be extracted, but the route structure is still captured.

### Anonymous Handlers

Anonymous handlers don't have API signatures extracted:

```typescript
// ✅ API signature extracted
function handler(req: Request, res: Response) { }
app.get('/users', handler);

// ❌ No API signature for anonymous handlers
app.get('/users', (req, res) => { });
```

**Why:** The API signature extractor requires a function name to locate and analyze the function definition. Anonymous handlers are inline and don't have separate definitions that can be analyzed.

**Impact:**
- Named functions: Full API signature extracted (parameters, return types, request/response types)
- Anonymous handlers: Route is extracted, but no API signature
- Arrow functions assigned to variables: API signature extracted (from variable name)

**Example:**
```typescript
// ✅ Full API signature extracted
function getUser(req: Request<{ id: string }>, res: Response<User>): void {
  // ...
}
app.get('/users/:id', getUser);
// Extracted: parameters, returnType, requestType, responseType

// ❌ Route extracted, but no API signature
app.get('/users', (req, res) => {
  // ...
});
// Extracted: route exists, handler: 'anonymous', but no signature

// ✅ API signature extracted from variable
const getUser = (req: Request, res: Response): void => {
  // ...
};
app.get('/users', getUser);
// Extracted: parameters, returnType (from variable name)
```

**Workaround:** Extract handlers into named functions to enable API signature extraction:
```typescript
// Instead of:
app.get('/users', (req, res) => { /* ... */ });

// Do this:
function getUsers(req: Request, res: Response) {
  // ...
}
app.get('/users', getUsers);
```

## Related Documentation

- [NestJS Support](./nestjs.md) - NestJS framework features
- [TypeScript Support](./typescript.md) - TypeScript-specific features
- [CLI Reference](../cli/context.md) - Command-line usage
- [Contract Schema](../schema.md) - UIFContract format

## Express Ecosystem Support

LogicStamp works with popular Express.js ecosystem libraries:

- **Express Router** - Modular route definitions
- **Express Middleware** - Middleware patterns (detected but not extracted)
- **TypeScript Express** - Full TypeScript support
- **Express with TypeScript** - Type-safe Express applications

For best results, structure your Express project with TypeScript and use named handler functions for API signature extraction.
