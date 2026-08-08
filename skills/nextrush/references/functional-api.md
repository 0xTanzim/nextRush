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
app.use(...middleware: Middleware[]): this         // register global middleware
app.route(path: string, router: Router): this      // mount sub-router at path
app.get/post/put/patch/delete/head/all(path, ...entries): this // verbs on the app-owned router
app.setErrorHandler(handler: ErrorHandler): this   // replace the error boundary
app.extend(extension): this                        // queue an Extension (setup runs at ready())
app.ready(): Promise<this>                         // boot extensions + mount router, freeze config
app.callback(): (ctx: Context) => Promise<void>    // the composed handler (adapters + tests run this)
app.close(options?): Promise<Error[]>              // teardown (onShutdown hooks / close hooks)
```

> There is **no `app.handle(request)`**. The request path is `app.callback()`: adapters build a
> `Context` from the native request and run `callback()(ctx)`. Use `callback()` the same way in
> tests (see `references/testing.md`).
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
  caseSensitive?: boolean; // static-segment case matching (default: false)
  strict?: boolean;       // strict trailing-slash matching (default: false)
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
  host: '0.0.0.0',        // note: the option is `host`, not `hostname`
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
ContentType.MULTIPART      // 'multipart/form-data'
ContentType.XML            // 'application/xml'
ContentType.OCTET_STREAM   // 'application/octet-stream'
```

## Middleware Type

```typescript
type Middleware = (ctx: Context, next: Next) => Promise<void> | void;
type Next = () => Promise<void>;
```

## Extension API

```typescript
import type { Extension, ExtensionContext } from 'nextrush';

interface Extension<TDecorated = Record<string, never>> {
  name: string;                        // unique — collision detection
  needs?: readonly string[];           // other extensions that must be registered first
  setup(ctx: ExtensionContext): void | Promise<void>;  // runs at app.ready(), in registration order
  destroy?(): void | Promise<void>;    // runs at app.close(), in reverse registration order
}

interface ExtensionContext {
  app: ExtensionHost;
  logger: Logger;
  container?: Container;               // present only on class/DI apps
  env: 'development' | 'production' | 'test';
  decorate(name: string, value: unknown): void;  // attach app.<name> (throws on collision)
}
```

There is **no `install()` hook** — an extension attaches state via `setup()` + `decorate()` and tears
it down via `destroy()`. The generic `TDecorated` types `app.<decoration>`; chain in one expression
(`const app = createApp().extend(x)`) so the inferred type is kept.
