# @nextrush/controllers

Controller plugin for NextRush - **automatic controller discovery**, DI integration, and route building for decorator-based controllers.

## Installation

```bash
pnpm add @nextrush/controllers @nextrush/di @nextrush/decorators reflect-metadata
```

**TypeScript Configuration:**

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Quick Start (Auto-Discovery)

The recommended way is to use **auto-discovery** - just point to your source directory and the plugin will find all `@Controller` classes:

```typescript
import 'reflect-metadata';
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { listen } from '@nextrush/adapter-node';
import { controllersPlugin } from '@nextrush/controllers';

const app = createApp();
const router = createRouter();

// Auto-discover all controllers in ./src
app.plugin(
  controllersPlugin({
    router,
    root: './src',          // Scan this directory
    prefix: '/api/v1',      // Add prefix to all routes
    debug: true,            // Log discovered controllers
  })
);

app.use(router.routes());
listen(app, { port: 3000 });
```

That's it! No manual registration needed. Create controllers anywhere in your project:

```typescript
// src/controllers/user.controller.ts
import { Controller, Get, Post, Body, Param, Service, inject } from '@nextrush/controllers';

@Controller('/users')
@Service()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Post()
  create(@Body() data: { name: string }) {
    return this.userService.create(data);
  }
}
```

## Auto-Discovery Options

```typescript
controllersPlugin({
  router,

  // Root directory to scan for controllers
  root: './src',

  // Glob patterns to include (default shown)
  include: ['**/*.ts', '**/*.js'],

  // Glob patterns to exclude (default shown)
  exclude: [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/node_modules/**',
    '**/dist/**',
    '**/__tests__/**',
  ],

  // Throw on discovery errors (default: false = log warnings)
  strict: false,

  // Debug logging
  debug: true,
});
```

### Custom Patterns Example

```typescript
controllersPlugin({
  router,
  root: './src',
  // Only scan specific folders
  include: ['controllers/**/*.ts', 'modules/**/**.controller.ts'],
  // Exclude specific files
  exclude: ['**/*.test.ts', '**/*.mock.ts'],
});
```

## Manual Registration (Testing/Explicit Control)

For testing or when you need explicit control, you can manually specify controllers:

```typescript
import { UserController, PostController } from './controllers';

app.plugin(
  controllersPlugin({
    router,
    controllers: [UserController, PostController],
  })
);
```

## Full Example

```typescript
import 'reflect-metadata';
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { listen } from '@nextrush/adapter-node';
import {
  controllersPlugin,
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Service,
  inject,
} from '@nextrush/controllers';

// Define a service
@Service()
class UserService {
  private users = [
    { id: '1', name: 'John' },
    { id: '2', name: 'Jane' },
  ];

  findAll() {
    return this.users;
  }

  findOne(id: string) {
    return this.users.find((u) => u.id === id);
  }

  create(data: { name: string }) {
    const user = { id: String(Date.now()), ...data };
    this.users.push(user);
    return user;
  }

  remove(id: string) {
    const index = this.users.findIndex((u) => u.id === id);
    if (index > -1) {
      this.users.splice(index, 1);
    }
  }
}

// Define a controller
@Controller('/users')
@Service()
class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  findAll(@Query('limit') limit?: string) {
    const users = this.userService.findAll();
    return limit ? users.slice(0, Number(limit)) : users;
  }

  @Get('/:id')
  findOne(@Param('id') id: string) {
    const user = this.userService.findOne(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  @Post()
  create(@Body() data: { name: string }) {
    return this.userService.create(data);
  }

  @Delete('/:id')
  remove(@Param('id') id: string) {
    this.userService.remove(id);
    return { deleted: true };
  }
}

// Setup app
const app = createApp();
const router = createRouter();

// Register controllers via auto-discovery
app.plugin(
  controllersPlugin({
    router,
    root: './src',
    debug: true,
  })
);

app.use(router.routes());

listen(app, { port: 3000 });
```

## API Reference

### `controllersPlugin(options)`

Create and configure the controllers plugin.

```typescript
const plugin = controllersPlugin({
  // Required: Router instance
  router: createRouter(),

  // Auto-discovery: Root directory to scan
  root: './src',

  // Auto-discovery: Include patterns
  include: ['**/*.ts'],

  // Auto-discovery: Exclude patterns
  exclude: ['**/*.test.ts'],

  // Manual: Controller classes (for testing)
  controllers: [UserController],

  // Global route prefix
  prefix: '/api/v1',

  // Global middleware for all routes
  middleware: [authMiddleware],

  // Custom DI container
  container: createContainer(),

  // Throw on discovery errors
  strict: false,

  // Enable debug logging
  debug: true,
});

await app.plugin(plugin); // Note: async when using auto-discovery
```

### `discoverControllers(options)`

Manually discover controllers without using the plugin:

```typescript
import { discoverControllers, getControllersFromResults } from '@nextrush/controllers';

const results = await discoverControllers({
  root: './src',
  include: ['controllers/**/*.ts'],
  exclude: ['**/*.test.ts'],
  debug: true,
});

const controllers = getControllersFromResults(results);
console.log(`Found ${controllers.length} controllers`);
```

### `registerController(router, controller, container?)`

Register a single controller without using the plugin.

```typescript
import { registerController, createContainer } from '@nextrush/controllers';

const container = createContainer();
registerController(router, UserController, container);
```

### Decorators

All decorators are re-exported from `@nextrush/decorators` and `@nextrush/di`:

**Class Decorators:**

- `@Controller(path?)` - Mark class as controller
- `@Service()` - Mark class for DI

**Route Decorators:**

- `@Get(path?)` - HTTP GET
- `@Post(path?)` - HTTP POST
- `@Put(path?)` - HTTP PUT
- `@Delete(path?)` - HTTP DELETE
- `@Patch(path?)` - HTTP PATCH

**Parameter Decorators:**

- `@Body(property?)` - Request body
- `@Param(name?)` - Route parameter
- `@Query(name?)` - Query parameter
- `@Header(name?)` - Request header
- `@Ctx()` - Full Context object

## Advanced Usage

### API Versioning

```typescript
@Controller({ path: '/users', version: 'v2' })
@Service()
class UserControllerV2 {
  @Get()
  findAll() {
    return { version: 2, users: [] };
  }
}

// Route: GET /v2/users
```

### Controller Middleware

```typescript
const authMiddleware = async (ctx, next) => {
  // Check auth
  await next();
};

@Controller({ path: '/admin', middleware: [authMiddleware] })
@Service()
class AdminController {
  @Get('/dashboard')
  dashboard() {
    return { admin: true };
  }
}
```

### Route Middleware

```typescript
const rateLimit = async (ctx, next) => {
  // Rate limiting logic
  await next();
};

@Controller('/api')
@Service()
class ApiController {
  @Get('/expensive', { middleware: [rateLimit] })
  expensiveOperation() {
    return { result: 'computed' };
  }
}
```

### Parameter Transform

```typescript
@Controller('/products')
@Service()
class ProductController {
  @Get('/:id')
  findOne(@Param('id', { transform: Number }) id: number) {
    // id is now a number
    return { id, type: typeof id }; // { id: 42, type: 'number' }
  }

  @Get()
  findAll(
    @Query('page', { defaultValue: 1, transform: Number }) page: number,
    @Query('limit', { defaultValue: 10, transform: Number }) limit: number
  ) {
    return { page, limit };
  }
}
```

### Dependency Injection

```typescript
import { Service, inject, createContainer } from '@nextrush/controllers';

// Define tokens for interfaces
const DATABASE_TOKEN = Symbol('Database');

interface Database {
  query(sql: string): Promise<unknown>;
}

@Service()
class PostgresDatabase implements Database {
  async query(sql: string) {
    // ...
  }
}

@Controller('/data')
@Service()
class DataController {
  constructor(
    @inject(DATABASE_TOKEN) private readonly db: Database
  ) {}

  @Get()
  async getData() {
    return this.db.query('SELECT * FROM data');
  }
}

// Register in container
const container = createContainer();
container.register(DATABASE_TOKEN, { useClass: PostgresDatabase });

app.plugin(
  controllersPlugin({
    router,
    root: './src',
    container,
  })
);
```

## Error Handling

The plugin provides descriptive error messages:

```typescript
// DiscoveryError - Failed to import/parse a file
// NotAControllerError - Class missing @Controller decorator
// NoRoutesError - Controller has no @Get/@Post/etc methods
// ControllerResolutionError - DI failed to resolve controller
// MissingParameterError - Required parameter not provided
// ParameterInjectionError - Failed to inject parameter value
// RouteRegistrationError - Failed to register route on router
```

All errors include:

- Clear description of what went wrong
- Actionable fix suggestions
- Code examples

## Plugin State

Access plugin state for debugging:

```typescript
const plugin = controllersPlugin({ router, root: './src' });
await app.plugin(plugin);

console.log(plugin.state);
// {
//   controllers: [...],
//   routeCount: 5,
//   initialized: true
// }
```

## License

MIT
