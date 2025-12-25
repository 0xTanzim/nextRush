# @nextrush/controllers

Controller plugin for NextRush - **automatic controller discovery**, DI integration, and route building for decorator-based controllers.

## Development

For the best development experience with decorator support, use `@nextrush/dev`:

```bash
pnpm add -D @nextrush/dev
```

Then in your `package.json`:

```json
{
  "scripts": {
    "dev": "nextrush-dev"
  }
}
```

This automatically handles TypeScript execution, file watching, and decorator metadata support.

## Installation

```bash
pnpm add @nextrush/controllers @nextrush/di @nextrush/decorators reflect-metadata
```

## Project Setup

### 1. TypeScript Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true
  }
}
```

### 2. Entry Point (`src/index.ts`)

```typescript
import 'reflect-metadata';  // Must be first import!
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { listen } from '@nextrush/adapter-node';
import { controllersPlugin } from '@nextrush/controllers';

async function main() {
  const app = createApp();
  const router = createRouter();

  // Auto-discover all controllers in ./src
  await app.pluginAsync(
    controllersPlugin({
      router,
      root: './src',
      prefix: '/api',
      debug: true,
    })
  );

  app.use(router.routes());
  listen(app, { port: 3000 });
}

main().catch(console.error);
```

## Quick Start

### Creating a Controller

```typescript
// src/controllers/user.controller.ts
import { Controller, Get, Post, Body, Param } from '@nextrush/controllers';

// @Controller automatically includes DI registration - no @Service() needed!
@Controller('/users')
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

### Creating a Service

```typescript
// src/services/user.service.ts
import { Service } from '@nextrush/controllers';

@Service()
export class UserService {
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
}
```

That's it! Run with `pnpm dev` and your controllers are auto-discovered.

## Important: @Controller vs @Service

| Decorator | Use For | DI Included |
|-----------|---------|-------------|
| `@Controller('/path')` | HTTP controllers | ✅ Yes (auto) |
| `@Service()` | Business logic services | ✅ Yes |
| `@Repository()` | Data access layer | ✅ Yes |

**You do NOT need both `@Controller` and `@Service` on the same class!**

```typescript
// ✅ Correct - @Controller includes DI
@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}
}

// ❌ Redundant - @Service is not needed
@Controller('/users')
@Service()  // <- This is unnecessary!
export class UserController {
  constructor(private userService: UserService) {}
}
```

## Auto-Discovery Options

```typescript
controllersPlugin({
  router,
  root: './src',

  // Glob patterns to include (default)
  include: ['**/*.ts', '**/*.js'],

  // Glob patterns to exclude (default)
  exclude: [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/node_modules/**',
    '**/dist/**',
    '**/__tests__/**',
  ],

  // Global route prefix
  prefix: '/api/v1',

  // Throw on discovery errors (default: false)
  strict: false,

  // Enable debug logging
  debug: true,
});
```

## Parameter Decorators

```typescript
@Controller('/example')
export class ExampleController {
  @Post('/submit')
  submit(
    @Body() body: CreateDto,           // Full request body
    @Body('name') name: string,        // Specific body property
    @Param('id') id: string,           // Route parameter
    @Query('page') page: string,       // Query string parameter
    @Header('authorization') auth: string,  // Request header
    @Ctx() ctx: Context,               // Full context object
  ) {
    // ...
  }
}
```

### Parameter Transform

```typescript
@Controller('/products')
export class ProductController {
  @Get()
  findAll(
    @Query('page', { defaultValue: 1, transform: Number }) page: number,
    @Query('limit', { defaultValue: 10, transform: Number }) limit: number
  ) {
    return { page, limit };
  }
}
```

## Dependency Injection

### Constructor Injection (Automatic)

```typescript
@Service()
class Logger {
  log(message: string) {
    console.log(`[LOG] ${message}`);
  }
}

@Service()
class UserService {
  constructor(private logger: Logger) {}  // Auto-injected!

  findAll() {
    this.logger.log('Finding all users');
    return [];
  }
}

@Controller('/users')
export class UserController {
  constructor(private userService: UserService) {}  // Auto-injected!
}
```

### Interface Injection (Using Tokens)

```typescript
import { inject, createContainer } from '@nextrush/controllers';

const DATABASE_TOKEN = Symbol('Database');

interface IDatabase {
  query(sql: string): Promise<unknown>;
}

@Service()
class PostgresDatabase implements IDatabase {
  async query(sql: string) { /* ... */ }
}

@Controller('/data')
export class DataController {
  constructor(
    @inject(DATABASE_TOKEN) private db: IDatabase
  ) {}
}

// Register the implementation
const container = createContainer();
container.register(DATABASE_TOKEN, { useClass: PostgresDatabase });

app.pluginAsync(controllersPlugin({
  router,
  root: './src',
  container,
}));
```

## Troubleshooting

### Error: "TypeInfo not known for Controller"

**Cause**: Decorator metadata is not being emitted.

**Fix**: Use `@nextrush/dev` for development. It automatically handles metadata emission.

### Error: "TypeScript parameter property is not supported"

**Cause**: Standard Node.js strip-only mode can't handle `private readonly` in constructors.

**Fix**: Use `@nextrush/dev` or compile with `tsc` first.

### Error: "No controllers found"

**Cause**: Files not matching include patterns or discovery errors.

**Fix**: Enable debug mode and check patterns:

```typescript
controllersPlugin({
  router,
  root: './src',
  debug: true,  // See what's being scanned
  strict: true, // Throw on any discovery error
});
```

### Missing `reflect-metadata`

**Cause**: `reflect-metadata` must be imported before any decorators run.

**Fix**: Import it first in your entry point:

```typescript
import 'reflect-metadata';  // MUST be first!
import { createApp } from '@nextrush/core';
// ... rest of imports
```

## API Reference

### Decorators

| Decorator | Description |
|-----------|-------------|
| `@Controller(path?)` | Mark class as HTTP controller (includes DI) |
| `@Service()` | Mark class as injectable service |
| `@Repository()` | Mark class as data repository |
| `@Get(path?)` | HTTP GET route |
| `@Post(path?)` | HTTP POST route |
| `@Put(path?)` | HTTP PUT route |
| `@Delete(path?)` | HTTP DELETE route |
| `@Patch(path?)` | HTTP PATCH route |
| `@Body(prop?)` | Inject request body |
| `@Param(name?)` | Inject route parameter |
| `@Query(name?)` | Inject query parameter |
| `@Header(name?)` | Inject request header |
| `@Ctx()` | Inject full Context |

### Plugin Options

```typescript
interface ControllersPluginOptions {
  router: Router;              // Required: Router instance
  root?: string;               // Directory to scan
  include?: string[];          // Glob patterns to include
  exclude?: string[];          // Glob patterns to exclude
  controllers?: Function[];    // Manual controller list
  prefix?: string;             // Global route prefix
  middleware?: Middleware[];   // Global middleware
  container?: ContainerInterface;  // Custom DI container
  strict?: boolean;            // Throw on errors
  debug?: boolean;             // Enable logging
}
```

## License

MIT
