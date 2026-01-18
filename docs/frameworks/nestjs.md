# NestJS Framework Support

LogicStamp Context provides comprehensive support for NestJS applications, automatically detecting controllers, routes, decorators, and extracting API signatures from your backend code.

## NestJS Detection

LogicStamp automatically identifies NestJS code by:

- **NestJS imports**: Detects imports from `@nestjs/common`, `@nestjs/core`, and other `@nestjs/*` packages
- **Controller decorators**: Recognizes `@Controller()` decorator on classes
- **Route decorators**: Detects `@Get()`, `@Post()`, `@Put()`, `@Delete()`, `@Patch()` decorators on methods
- **Class-based architecture**: Identifies controller classes and their methods

**Detection requires both:**
1. NestJS import (`import { Controller } from '@nestjs/common'`)
2. Controller or route decorators (`@Controller()`, `@Get()`, etc.)

This two-factor detection prevents false positives - files that import NestJS but don't define controllers won't be detected as backend files.

## What Gets Extracted

### Controllers

NestJS controllers are automatically detected and analyzed:

```typescript
// Example: users.controller.ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Get()
  findAll() {
    return [];
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return { id };
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return { id: '123', ...createUserDto };
  }
}
```

**Extracted information:**
- Controller name: `UsersController`
- Base path: `users` (from `@Controller('users')`)
- Routes: All methods with HTTP decorators
- Route paths: Extracted from decorator arguments
- Route parameters: Extracted from path patterns (e.g., `:id` → `['id']`)

### Route Methods

LogicStamp extracts routes from controller methods:

```typescript
@Controller('users')
export class UsersController {
  @Get()                    // Route: GET /users
  findAll() { }

  @Get(':id')               // Route: GET /users/:id
  findOne(@Param('id') id: string) { }

  @Post()                   // Route: POST /users
  create(@Body() dto: CreateUserDto) { }

  @Put(':id')               // Route: PUT /users/:id
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) { }

  @Delete(':id')            // Route: DELETE /users/:id
  remove(@Param('id') id: string) { }

  @Patch(':id')             // Route: PATCH /users/:id
  patch(@Param('id') id: string, @Body() dto: PatchUserDto) { }
}
```

**Extracted routes:**
- HTTP methods: GET, POST, PUT, DELETE, PATCH
- Route paths: Combined base path + method path
- Handler names: Method names (`findAll`, `findOne`, etc.)
- Route parameters: Extracted from path patterns

### Base Path Extraction

The controller base path is extracted from the `@Controller()` decorator:

```typescript
// With base path
@Controller('users')
export class UsersController {
  @Get()  // Route: GET /users
  findAll() { }
}
// Extracted: basePath: 'users'

// Without base path
@Controller()
export class UsersController {
  @Get()  // Route: GET /
  findAll() { }
}
// Extracted: basePath: undefined

// Nested path
@Controller('api/v1/users')
export class UsersController {
  @Get()  // Route: GET /api/v1/users
  findAll() { }
}
// Extracted: basePath: 'api/v1/users'
```

### API Signatures

LogicStamp extracts API signatures from controller methods:

```typescript
import { Controller, Get, Post, Body, Param } from '@nestjs/common';

interface CreateUserDto {
  name: string;
  email: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

@Controller('users')
export class UsersController {
  @Get(':id')
  findOne(@Param('id') id: string): Promise<User> {
    // ...
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto): Promise<User> {
    // ...
  }
}
```

**Extracted API signature:**
- Parameters: `{ id: 'string', createUserDto: 'CreateUserDto' }`
- Return type: `Promise<User>`
- Request type: `CreateUserDto` (for POST/PUT/PATCH)
- Response type: `User`

### Decorators and Annotations

LogicStamp extracts NestJS decorators for language-specific metadata:

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Headers
} from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Get()
  findAll() { }

  @Post()
  create(@Body() dto: CreateUserDto) { }
}
```

**Extracted language-specific metadata:**
- Annotations: `['@Controller', '@Get', '@Post', '@Body']`
- Classes: `['UsersController']`
- Methods: `['findAll', 'create']`

### Component Kinds

LogicStamp categorizes NestJS files into different kinds:

- **`node:api`** - NestJS controller files with route definitions
- **`ts:module`** - TypeScript modules/utilities (non-controller files)

## NestJS-Specific Features

### Controller Detection

LogicStamp detects controllers via the `@Controller()` decorator:

```typescript
// Single controller per file (recommended)
@Controller('users')
export class UsersController {
  // ...
}

// Multiple controllers (detected separately)
@Controller('users')
export class UsersController {
  // ...
}

@Controller('posts')
export class PostsController {
  // ...
}
```

**Note:** If multiple controllers exist in one file, only the first one with `@Controller()` is extracted.

### Route Path Extraction

Route paths are extracted from decorator arguments:

```typescript
@Controller('users')
export class UsersController {
  @Get()              // Path: '' (empty, uses base path)
  findAll() { }

  @Get(':id')         // Path: ':id'
  findOne() { }

  @Get('profile')     // Path: 'profile' (full route: GET /users/profile)
  getProfile() { }

  @Get('profile/:id') // Path: 'profile/:id'
  getProfileById() { }
}
```

### Route Parameters

LogicStamp extracts route parameters from path patterns:

```typescript
@Controller('users')
export class UsersController {
  @Get(':id')                    // params: ['id']
  findOne() { }

  @Get(':userId/posts/:postId')   // params: ['userId', 'postId']
  getUserPost() { }
}
```

### Method Parameter Extraction

Controller method parameters are extracted with their types:

```typescript
@Controller('users')
export class UsersController {
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Query('include') include?: string
  ): Promise<User> {
    // ...
  }

  @Post()
  create(
    @Body() createUserDto: CreateUserDto,
    @Headers('authorization') auth: string
  ): Promise<User> {
    // ...
  }
}
```

**Extracted parameters:**
- `id: string` (from `@Param('id')`)
- `include?: string` (from `@Query('include')`)
- `createUserDto: CreateUserDto` (from `@Body()`)
- `auth: string` (from `@Headers('authorization')`)

### Return Type Extraction

Return types are extracted from method signatures:

```typescript
@Controller('users')
export class UsersController {
  @Get()
  findAll(): User[] {
    return [];
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<User> {
    return {};
  }

  @Post()
  create(@Body() dto: CreateUserDto): Observable<User> {
    return of({});
  }
}
```

**Extracted return types:**
- `User[]` - Array return type
- `Promise<User>` - Promise return type
- `Observable<User>` - Observable return type

## Usage

### Analyzing NestJS Projects

Generate context for a NestJS project:

```bash
stamp context
```

The tool will automatically:
1. Detect NestJS imports and controller decorators
2. Extract controller classes and base paths
3. Extract route definitions (paths, methods, handlers)
4. Extract API signatures from controller methods
5. Identify route parameters
6. Extract decorators and annotations
7. Generate structured contracts for each controller file

### Project Structure

LogicStamp works with common NestJS project structures:

```
my-nestjs-app/
  src/
    users/
      users.controller.ts    # Controller with routes
      users.service.ts        # Service (not extracted)
      users.module.ts         # Module (not extracted)
    posts/
      posts.controller.ts
    app.module.ts            # Root module
  main.ts                    # Application entry point
```

### Integration with Build Tools

LogicStamp works with common NestJS setups:

- **NestJS CLI** - Full support for NestJS CLI projects
- **TypeScript** - Full support for TypeScript NestJS projects
- **Decorators** - All NestJS decorators are detected
- **Custom setups** - Compatible with any NestJS TypeScript project

## Best Practices

### 1. One Controller Per File

Keep controllers separate for better extraction:

```typescript
// ✅ Good: Single controller per file
// users.controller.ts
@Controller('users')
export class UsersController {
  // ...
}

// ❌ Less ideal: Multiple controllers in one file
// controllers.ts
@Controller('users')
export class UsersController { }
@Controller('posts')
export class PostsController { }
```

### 2. Type Your DTOs

TypeScript DTOs improve extraction quality:

```typescript
// ✅ Good: Typed DTOs
export class CreateUserDto {
  name: string;
  email: string;
}

@Post()
create(@Body() createUserDto: CreateUserDto): Promise<User> {
  // ...
}

// ❌ Less ideal: Any type
@Post()
create(@Body() body: any): Promise<any> {
  // ...
}
```

### 3. Use Explicit Return Types

Explicit return types improve API signature extraction:

```typescript
// ✅ Good: Explicit return type
@Get(':id')
findOne(@Param('id') id: string): Promise<User> {
  // ...
}

// ❌ Less ideal: Inferred return type
@Get(':id')
findOne(@Param('id') id: string) {
  // ...
}
```

### 4. Organize Controllers by Resource

Keep related routes together:

```
src/
  users/
    users.controller.ts    # User routes
    users.service.ts
    users.module.ts
  posts/
    posts.controller.ts    # Post routes
    posts.service.ts
    posts.module.ts
```

## Examples

### NestJS Controller

```typescript
// users.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query
} from '@nestjs/common';

interface CreateUserDto {
  name: string;
  email: string;
}

interface UpdateUserDto {
  name?: string;
  email?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

@Controller('users')
export class UsersController {
  @Get()
  findAll(@Query('limit') limit?: number): Promise<User[]> {
    return Promise.resolve([]);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<User> {
    return Promise.resolve({ id, name: '', email: '' });
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return Promise.resolve({ id: '123', ...createUserDto });
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<User> {
    return Promise.resolve({ id, ...updateUserDto });
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return Promise.resolve();
  }
}
```

**Generated Contract:**

```json
{
  "kind": "node:api",
  "version": {
    "variables": [],
    "hooks": [],
    "components": [],
    "functions": ["findAll", "findOne", "create", "update", "remove"],
    "languageSpecific": {
      "annotations": [
        "@Controller",
        "@Get",
        "@Post",
        "@Put",
        "@Delete",
        "@Body",
        "@Param",
        "@Query"
      ],
      "classes": ["UsersController"],
      "methods": ["findAll", "findOne", "create", "update", "remove"]
    }
  },
  "logicSignature": {
    "props": {},
    "emits": {},
    "apiSignature": {
      "parameters": {
        "id": "string",
        "limit": "number",
        "createUserDto": "CreateUserDto",
        "updateUserDto": "UpdateUserDto"
      },
      "returnType": "Promise<User | User[] | void>",
      "requestType": "CreateUserDto | UpdateUserDto",
      "responseType": "User | User[]"
    }
  },
  "backend": {
    "framework": "nestjs",
    "controller": {
      "name": "UsersController",
      "basePath": "users"
    },
    "routes": [
      {
        "path": "",
        "method": "GET",
        "handler": "findAll",
        "params": []
      },
      {
        "path": ":id",
        "method": "GET",
        "handler": "findOne",
        "params": ["id"]
      },
      {
        "path": "",
        "method": "POST",
        "handler": "create",
        "params": []
      },
      {
        "path": ":id",
        "method": "PUT",
        "handler": "update",
        "params": ["id"]
      },
      {
        "path": ":id",
        "method": "DELETE",
        "handler": "remove",
        "params": ["id"]
      }
    ],
    "languageSpecific": {
      "annotations": [
        "@Controller",
        "@Get",
        "@Post",
        "@Put",
        "@Delete",
        "@Body",
        "@Param",
        "@Query"
      ],
      "classes": ["UsersController"],
      "methods": ["findAll", "findOne", "create", "update", "remove"]
    }
  }
}
```

### NestJS Controller with Guards and Interceptors

```typescript
import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LoggingInterceptor } from './logging.interceptor';

@Controller('users')
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(LoggingInterceptor)
export class UsersController {
  @Get()
  findAll() {
    return [];
  }
}
```

**Extracted:**
- Controller: `UsersController` with base path `users`
- Routes: `GET /users`
- Decorators: `@Controller`, `@Get`, `@UseGuards`, `@UseInterceptors`
- **Note:** Guards and interceptors are detected as decorators but their logic is not extracted

## Framework Detection Priority

When a file imports multiple frameworks, LogicStamp uses a priority system:

1. **Backend** (Express/NestJS detected) → `node:api` (highest priority)
2. **Vue** (Vue import + Vue component patterns) → `vue:component` or `vue:composable`
3. **React** (React import or JSX/TSX + React patterns) → `react:component` or `react:hook`
4. **TypeScript module** (no framework patterns) → `ts:module` (default fallback)

**Note:** React is NOT the default fallback. Files without framework patterns become `ts:module`.

**Example:**
```typescript
import { Controller } from '@nestjs/common';
import { useState } from 'react'; // This file will be analyzed as backend

@Controller('api')
export class ApiController {
  // Analyzed as node:api, not react:component
}
```

**Result:**
- Backend controller: ✅ Extracted (`backend.controller`, `backend.routes`)
- React hooks: ❌ Not extracted (skipped when backend detected)
- React components: ❌ Not extracted (skipped when backend detected)
- Contract kind: `node:api`

**Recommendation:** Keep backend and frontend code in separate files for accurate analysis. LogicStamp analyzes each file independently, so separating concerns ensures both are extracted correctly in their respective files.

## Limitations

### Services and Modules

NestJS services and modules are not extracted:

```typescript
// ✅ Controllers are extracted
@Controller('users')
export class UsersController { }

// ❌ Services are not extracted
@Injectable()
export class UsersService { }

// ❌ Modules are not extracted
@Module({ })
export class UsersModule { }
```

**Why:** LogicStamp focuses on extracting API routes and their signatures. Controllers define the API surface, while services and modules are implementation details that don't directly affect the API contract.

**Impact:**
- Controllers and routes are fully extracted
- Service methods and business logic are not documented
- Module configuration and dependency injection setup are not tracked

**Workaround:** Document services and modules separately if needed. LogicStamp focuses on the API contract (controllers and routes).

### Guards and Interceptors

Guards and interceptors are detected as decorators but their logic is not extracted:

```typescript
// ✅ Decorator is detected
@UseGuards(AuthGuard('jwt'))
export class UsersController { }

// ❌ Guard logic is not extracted
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate() { }
}
```

**Why:** LogicStamp extracts decorators as metadata (they appear in `languageSpecific.annotations`), but doesn't analyze the guard/interceptor implementation. Extracting guard logic would require analyzing multiple files and understanding NestJS's dependency injection system.

**Impact:**
- Decorators are detected: `@UseGuards`, `@UseInterceptors` appear in annotations
- Guard/interceptor classes are not analyzed
- Guard logic and conditions are not extracted

**Example:**
```typescript
@Controller('users')
@UseGuards(AuthGuard('jwt'))  // ✅ Detected as decorator
export class UsersController {
  @Get()
  findAll() { }
}
// Extracted: annotations: ['@Controller', '@UseGuards', '@Get']
// But AuthGuard implementation is not analyzed
```

**Workaround:** Guards and interceptors are documented as decorators. Their implementation can be documented separately if needed.

### Pipes and Filters

Pipes and filters are not extracted:

```typescript
// ❌ Pipes are not extracted
@Injectable()
export class ValidationPipe implements PipeTransform { }

// ❌ Filters are not extracted
@Catch(HttpException)
export class HttpExceptionFilter { }
```

**Why:** Similar to guards and interceptors, pipes and filters are implementation details that don't directly define the API contract. Extracting them would require analyzing multiple files and understanding NestJS's execution context.

**Impact:**
- Pipes used in route handlers (e.g., `@Body(ValidationPipe)`) are detected as decorators
- Pipe implementations are not analyzed
- Exception filters are not extracted

**Workaround:** Document pipes and filters separately. LogicStamp focuses on the API contract (routes, parameters, return types).

### Dynamic Route Paths

Only string literal paths are extracted:

```typescript
// ✅ Extracted: String literal
@Get(':id')
findOne() { }

// ❌ Not extracted: Dynamic path construction
const path = ':id';
@Get(path)
findOne() { }
```

**Why:** LogicStamp uses static analysis and can only extract values that are known at compile time. Dynamic paths require runtime evaluation, which static analysis cannot perform.

**Impact:**
- String literal paths work perfectly: `@Get(':id')`
- Variable paths are not extracted: `const path = ':id'; @Get(path)`
- Template literals with variables: ``@Get(`${prefix}/:id`)``
- Function calls: `@Get(getRoutePath())`

**Workaround:** Use string literals for route paths when possible. If you need dynamic paths, they won't be extracted, but the route structure is still captured.

### Multiple Controllers

If multiple controllers exist in one file, only the first one is extracted:

```typescript
// ⚠️ Only UsersController is extracted
@Controller('users')
export class UsersController { }

@Controller('posts')
export class PostsController { }
```

**Why:** The extractor finds the first class with a `@Controller()` decorator and stops. NestJS best practices recommend one controller per file, so this limitation aligns with common patterns.

**Impact:**
- First controller in file is fully extracted
- Subsequent controllers are ignored
- Routes from multiple controllers in one file are not all captured

**Recommendation:** Keep one controller per file for best results. This follows NestJS best practices and ensures all controllers are extracted correctly.

**Example:**
```typescript
// users.controller.ts - ✅ Fully extracted
@Controller('users')
export class UsersController {
  @Get()
  findAll() { }
}

// posts.controller.ts - ✅ Fully extracted (separate file)
@Controller('posts')
export class PostsController {
  @Get()
  findAll() { }
}

// ❌ Don't do this - only first controller extracted
// controllers.ts
@Controller('users')
export class UsersController { }  // ✅ Extracted
@Controller('posts')
export class PostsController { }   // ❌ Not extracted
```

## Related Documentation

- [Express.js Support](./express.md) - Express.js framework features
- [TypeScript Support](./typescript.md) - TypeScript-specific features
- [CLI Reference](../cli/context.md) - Command-line usage
- [Contract Schema](../schema.md) - UIFContract format

## NestJS Ecosystem Support

LogicStamp works with popular NestJS ecosystem libraries:

- **NestJS Common** - Core decorators and utilities
- **NestJS Core** - Framework core functionality
- **NestJS Passport** - Authentication (decorators detected)
- **NestJS TypeORM** - Database integration (decorators detected)
- **NestJS Swagger** - API documentation (decorators detected)

For best results, structure your NestJS project with TypeScript, use explicit types for DTOs and return types, and keep one controller per file.
