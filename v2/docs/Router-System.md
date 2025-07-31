# Router System in NextRush v2

NextRush v2 provides a powerful modular router system inspired by Express.js, allowing you to organize your application into logical modules and maintain clean, scalable code.

## Overview

The router system enables you to:

- **Modular Organization**: Split your application into logical modules
- **Prefix Management**: Automatically handle route prefixes
- **Middleware Isolation**: Apply middleware to specific route groups
- **Nested Routing**: Create complex route hierarchies
- **Type Safety**: Full TypeScript support with type inference

## Creating Routers

### Using `app.router()`

The simplest way to create a router is using the `app.router()` method:

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp();

// Create a user router
const userRouter = app.router();

userRouter.get('/profile', async ctx => {
  ctx.res.json({ user: 'profile' });
});

userRouter.post('/login', async ctx => {
  const { email, password } = ctx.body;
  ctx.res.json({ message: 'Logged in' });
});

// Mount the router
app.use('/users', userRouter);
```

### Using `createRouter()`

You can also create routers independently using `createRouter()`:

```typescript
import { createApp, createRouter } from 'nextrush-v2';

const app = createApp();

// Create router with prefix
const apiRouter = createRouter('/api/v1');

apiRouter.get('/users', async ctx => {
  ctx.res.json({ users: [] });
});

apiRouter.get('/users/:id', async ctx => {
  const id = ctx.params.id;
  ctx.res.json({ user: { id, name: `User ${id}` } });
});

// Mount the router
app.use(apiRouter);
```

## Router Methods

Routers support all the same HTTP methods as the main application:

```typescript
const router = app.router();

// GET routes
router.get('/items', async ctx => {
  ctx.res.json({ items: [] });
});

// POST routes
router.post('/items', async ctx => {
  const { name, description } = ctx.body;
  ctx.res.json({ message: 'Item created', item: { name, description } });
});

// PUT routes
router.put('/items/:id', async ctx => {
  const id = ctx.params.id;
  const { name, description } = ctx.body;
  ctx.res.json({ message: 'Item updated', item: { id, name, description } });
});

// DELETE routes
router.delete('/items/:id', async ctx => {
  const id = ctx.params.id;
  ctx.res.json({ message: 'Item deleted', id });
});

// PATCH routes
router.patch('/items/:id', async ctx => {
  const id = ctx.params.id;
  const updates = ctx.body;
  ctx.res.json({ message: 'Item patched', item: { id, ...updates } });
});
```

## Router Middleware

Routers support middleware just like the main application:

```typescript
const userRouter = app.router();

// Router-specific middleware
userRouter.use(async (ctx, next) => {
  console.log(`User router: ${ctx.method} ${ctx.path}`);
  await next();
});

// Authentication middleware for user routes
userRouter.use(async (ctx, next) => {
  const token = ctx.headers.authorization;

  if (!token) {
    ctx.res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Validate token here
  await next();
});

userRouter.get('/profile', async ctx => {
  ctx.res.json({ user: 'profile' });
});

app.use('/users', userRouter);
```

## Nested Routers

You can nest routers to create complex route hierarchies:

```typescript
const app = createApp();

// Create admin router
const adminRouter = app.router();

adminRouter.get('/dashboard', async ctx => {
  ctx.res.json({ admin: 'dashboard' });
});

adminRouter.get('/users', async ctx => {
  ctx.res.json({ admin: 'users list' });
});

// Create user router
const userRouter = app.router();

userRouter.get('/profile', async ctx => {
  ctx.res.json({ user: 'profile' });
});

userRouter.post('/login', async ctx => {
  ctx.res.json({ message: 'Logged in' });
});

// Nest admin router under user router
userRouter.use('/admin', adminRouter);

// Mount user router (admin routes become /users/admin/dashboard)
app.use('/users', userRouter);
```

This creates the following route structure:

- `/users/profile` - User profile
- `/users/login` - User login
- `/users/admin/dashboard` - Admin dashboard
- `/users/admin/users` - Admin users list

## Object-Based Routes in Routers

Routers support object-based route configuration:

```typescript
const userRouter = app.router();

userRouter.post('/register', {
  handler: async ctx => {
    const { name, email, password } = ctx.body;
    ctx.res.json({ message: 'User registered', user: { name, email } });
  },
  schema: {
    body: {
      name: { type: 'string', required: true, minLength: 2 },
      email: { type: 'email', required: true },
      password: { type: 'string', required: true, minLength: 8 },
    },
  },
  options: {
    name: 'registerUser',
    description: 'Register a new user',
    tags: ['users', 'auth'],
  },
});

app.use('/users', userRouter);
```

## Router with Prefix

You can create routers with built-in prefixes:

```typescript
// Create router with prefix
const apiRouter = createRouter('/api/v1');

apiRouter.get('/users', async ctx => {
  // This route becomes /api/v1/users
  ctx.res.json({ users: [] });
});

apiRouter.get('/products', async ctx => {
  // This route becomes /api/v1/products
  ctx.res.json({ products: [] });
});

// Mount without additional prefix
app.use(apiRouter);

// Or mount with additional prefix
app.use('/v1', apiRouter); // Routes become /v1/api/v1/users
```

## Complex Router Example

Here's a complete example showing how to organize a large application:

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp();

// API Router
const apiRouter = app.router();

// Users API
const usersRouter = apiRouter.router();

usersRouter.get('/', async ctx => {
  ctx.res.json({ users: [] });
});

usersRouter.get('/:id', async ctx => {
  const id = ctx.params.id;
  ctx.res.json({ user: { id, name: `User ${id}` } });
});

usersRouter.post('/', async ctx => {
  const { name, email } = ctx.body;
  ctx.res.json({ message: 'User created', user: { name, email } });
});

// Products API
const productsRouter = apiRouter.router();

productsRouter.get('/', async ctx => {
  ctx.res.json({ products: [] });
});

productsRouter.get('/:id', async ctx => {
  const id = ctx.params.id;
  ctx.res.json({ product: { id, name: `Product ${id}` } });
});

// Admin API
const adminRouter = apiRouter.router();

adminRouter.get('/stats', async ctx => {
  ctx.res.json({ stats: { users: 100, products: 50 } });
});

adminRouter.get('/logs', async ctx => {
  ctx.res.json({ logs: [] });
});

// Mount all API routers
apiRouter.use('/users', usersRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/admin', adminRouter);

// Web Router
const webRouter = app.router();

webRouter.get('/', async ctx => {
  ctx.res.html('<h1>Welcome to NextRush v2</h1>');
});

webRouter.get('/about', async ctx => {
  ctx.res.html('<h1>About Us</h1>');
});

// Mount routers
app.use('/api/v1', apiRouter);
app.use('/', webRouter);
```

This creates the following route structure:

- `/` - Home page
- `/about` - About page
- `/api/v1/users` - List users
- `/api/v1/users/:id` - Get user by ID
- `/api/v1/users` (POST) - Create user
- `/api/v1/products` - List products
- `/api/v1/products/:id` - Get product by ID
- `/api/v1/admin/stats` - Admin stats
- `/api/v1/admin/logs` - Admin logs

## Router Middleware and Error Handling

Routers can have their own middleware and error handling:

```typescript
const apiRouter = app.router();

// API-specific middleware
apiRouter.use(async (ctx, next) => {
  ctx.res.set('X-API-Version', '1.0');
  await next();
});

// API authentication
apiRouter.use(async (ctx, next) => {
  const apiKey = ctx.headers['x-api-key'];

  if (!apiKey) {
    ctx.res.status(401).json({ error: 'API key required' });
    return;
  }

  // Validate API key
  await next();
});

// API error handling
apiRouter.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.res.status(500).json({
      error: 'API Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API routes
apiRouter.get('/data', async ctx => {
  ctx.res.json({ data: 'API data' });
});

app.use('/api', apiRouter);
```

## Best Practices

### 1. Organize by Feature

```typescript
// Instead of mixing all routes in one file
const userRouter = app.router();
const productRouter = app.router();
const orderRouter = app.router();

// Organize by feature
app.use('/users', userRouter);
app.use('/products', productRouter);
app.use('/orders', orderRouter);
```

### 2. Use Prefixes for Versioning

```typescript
const v1Router = createRouter('/v1');
const v2Router = createRouter('/v2');

app.use('/api', v1Router);
app.use('/api', v2Router);
```

### 3. Isolate Middleware

```typescript
// Global middleware
app.use(async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await next();
});

// Router-specific middleware
const protectedRouter = app.router();

protectedRouter.use(async (ctx, next) => {
  // Authentication logic
  await next();
});

app.use('/protected', protectedRouter);
```

### 4. Use Object-Based Routes for Complex Configs

```typescript
const userRouter = app.router();

userRouter.post('/register', {
  handler: async ctx => {
    // Handler logic
  },
  schema: {
    body: {
      name: { type: 'string', required: true },
      email: { type: 'email', required: true },
    },
  },
  middleware: [
    async (ctx, next) => {
      // Route-specific middleware
      await next();
    },
  ],
});
```

### 5. Handle Errors Appropriately

```typescript
const apiRouter = app.router();

// API-specific error handling
apiRouter.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof ValidationError) {
      ctx.res.status(400).json({ error: error.message });
    } else {
      ctx.res.status(500).json({ error: 'Internal server error' });
    }
  }
});
```

## Benefits

1. **Modularity**: Organize code by feature or module
2. **Reusability**: Routers can be reused across applications
3. **Maintainability**: Easier to maintain large applications
4. **Type Safety**: Full TypeScript support
5. **Flexibility**: Support for nested routers and complex hierarchies
6. **Performance**: Efficient route matching and middleware execution

The router system in NextRush v2 provides the flexibility and power needed for building large, scalable applications while maintaining clean, organized code.
