# NextRush Functional API Reference

Full API surface for `import { ... } from 'nextrush'`.

## Application

```typescript
import { createApp, Application, type ApplicationOptions } from 'nextrush';

const app = createApp(options?);
```

### ApplicationOptions

```typescript
interface ApplicationOptions {
  router?: Router;      // custom router instance
  container?: Container; // custom DI container (for class-based hybrid)
}
```

### Application Methods

```typescript
app.use(middleware: Middleware): void              // register global middleware
app.route(path: string, router: Router): void      // mount sub-router at path
app.handle(request: Request): Promise<Response>    // process a request (adapter hook)
app.ready(): Promise<void>                         // signal app is ready (triggers lifecycle)
```

## Router

```typescript
import { createRouter, Router, type RouterOptions } from 'nextrush';

const router = createRouter(options?);
```

### RouterOptions

```typescript
interface RouterOptions {
  prefix?: string;        // base path for all routes
  strict?: boolean;       // strict trailing slash matching (default: false)
}
```

### Router Methods

```typescript
// HTTP method shortcuts
router.get(path: string, ...handlers: RouteHandler[]): void
router.post(path: string, ...handlers: RouteHandler[]): void
router.put(path: string, ...handlers: RouteHandler[]): void
router.delete(path: string, ...handlers: RouteHandler[]): void
router.patch(path: string, ...handlers: RouteHandler[]): void
router.head(path: string, ...handlers: RouteHandler[]): void
router.options(path: string, ...handlers: RouteHandler[]): void
router.all(path: string, ...handlers: RouteHandler[]): void   // matches any method

// Middleware on all routes
router.use(...middlewares: Middleware[]): void

// Sub-group mounting (prefix)
router.group(prefix: string, (g: GroupRouter) => void): void

// Export for OpenAPI introspection
router.getRoutes(): RouteDefinition[]
```

### RouteHandler signature

```typescript
type RouteHandler = (ctx: Context) => void | Promise<void>;
```

### Group Router

```typescript
router.group('/api/v1', (g) => {
  g.get('/users', handler);     // matches GET /api/v1/users
  g.get('/users/:id', handler); // matches GET /api/v1/users/:id
  g.group('/admin', (admin) => {
    admin.get('/dashboard', handler); // matches GET /api/v1/admin/dashboard
  });
});
```

## endpoint() — OpenAPI Metadata

```typescript
import { endpoint } from 'nextrush';

router.post('/users',
  endpoint({
    summary: 'Create a user',
    description: 'Creates a new user account',
    tags: ['users'],
    deprecated: false,
    responses: {
      201: CreateUserSchema,
      400: ErrorSchema,
    },
  }),
  validate(CreateUserSchema),
  (ctx) => { ... }
);
```

## compose()

```typescript
import { compose } from 'nextrush';

const combined = compose([middleware1, middleware2, middleware3]);
app.use(combined);
```

## serve() / listen()

```typescript
import { serve, listen, type ServeOptions, type ServerInstance } from 'nextrush';

// serve() — recommended, full control
const server = await serve(app, {
  port: 8080,
  hostname: '0.0.0.0',
  onListen: () => console.log('Ready'),
  onError: (err) => console.error('Server error:', err),
});

// listen() — simple
listen(app, 8080);

// Shutdown
server.close();
```

## HTTP Constants

```typescript
import { HttpStatus, ContentType } from 'nextrush';

HttpStatus.OK           // 200
HttpStatus.CREATED      // 201
HttpStatus.NO_CONTENT   // 204
HttpStatus.BAD_REQUEST  // 400
HttpStatus.NOT_FOUND    // 404
HttpStatus.INTERNAL_SERVER_ERROR // 500

ContentType.JSON        // 'application/json'
ContentType.HTML        // 'text/html'
ContentType.TEXT        // 'text/plain'
ContentType.FORM        // 'application/x-www-form-urlencoded'
ContentType.MULTIPART   // 'multipart/form-data'
```

## Middleware Type

```typescript
type Middleware = (ctx: Context, next: Next) => Promise<void> | void;
type Next = () => Promise<void>;
```

## Extension API

```typescript
import type { Extension, ExtensionContext } from 'nextrush';

// Extensions add capabilities to the context (e.g., WebSocket, server-sent events)
interface Extension {
  name: string;
  install(ctx: ExtensionContext): void | Promise<void>;
}
```
