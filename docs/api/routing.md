# 🛣️ Routing System

> **Express-like Routing with Fastify-style Configuration**

NextRush v2 provides a powerful routing system that combines Express-like simplicity with Fastify-style advanced configuration options.

## 📋 **Table of Contents**

- [Overview](#overview)
- [Basic Routing](#basic-routing)
- [Fastify-Style Routes](#fastify-style-routes)
- [Route Parameters](#route-parameters)
- [Query Parameters](#query-parameters)
- [Router System](#router-system)
- [Middleware Integration](#middleware-integration)
- [Error Handling](#error-handling)
- [TypeScript Support](#typescript-support)

## 🎯 **Overview**

The routing system supports:

- **Express-like API**: Simple `app.get()`, `app.post()` methods
- **Fastify-style Configuration**: Advanced route config with middleware, validation, and metadata
- **Route Parameters**: Dynamic path segments with `:param` syntax
- **Query Parameters**: Automatic parsing of URL query strings
- **Modular Routing**: Router instances for organized code
- **TypeScript Support**: Full type safety and IntelliSense

## 🚀 **Basic Routing**

### **Simple Route Handlers**

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp();

// GET route
app.get('/users', ctx => {
  ctx.res.json({ users: [] });
});

// POST route
app.post('/users', ctx => {
  const { name, email } = ctx.body;
  ctx.res.json({ success: true, user: { name, email } });
});

// PUT route
app.put('/users/:id', ctx => {
  const userId = ctx.params.id;
  const { name, email } = ctx.body;
  ctx.res.json({ success: true, userId });
});

// DELETE route
app.delete('/users/:id', ctx => {
  const userId = ctx.params.id;
  ctx.res.json({ success: true, deleted: userId });
});

// PATCH route
app.patch('/users/:id', ctx => {
  const userId = ctx.params.id;
  const updates = ctx.body;
  ctx.res.json({ success: true, updated: userId });
});
```

### **Route Parameters**

```typescript
// Single parameter
app.get('/users/:id', ctx => {
  const userId = ctx.params.id;
  ctx.res.json({ userId });
});

// Multiple parameters
app.get('/users/:id/posts/:postId', ctx => {
  const { id, postId } = ctx.params;
  ctx.res.json({ userId: id, postId });
});

// Pagination parameters via query
app.get('/users', ctx => {
  const page = (ctx.query.page as string) || '1';
  const limit = (ctx.query.limit as string) || '10';
  ctx.res.json({ page, limit });
});
```

### **Query Parameters**

```typescript
app.get('/search', ctx => {
  const { q, page, limit, sort } = ctx.query;

  // q = search query
  // page = page number
  // limit = results per page
  // sort = sort order

  ctx.res.json({
    query: q,
    page: parseInt(page as string) || 1,
    limit: parseInt(limit as string) || 10,
    sort: sort || 'relevance',
  });
});
```

## ⚡ **Fastify-Style Routes**

### **Route Configuration Object**

```typescript
app.get('/users/:id', {
  handler: ctx => {
    const userId = ctx.params.id;
    ctx.res.json({ userId });
  },
  middleware: [authMiddleware, validationMiddleware],
  schema: {
    params: {
      id: { type: 'string', required: true },
    },
    response: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
      },
    },
  },
  options: {
    name: 'getUser',
    description: 'Get user by ID',
    tags: ['users'],
    version: '1.0.0',
    deprecated: false,
    summary: 'Retrieve user information',
  },
});
```

### **Advanced Route Configuration**

```typescript
// Complex route with full configuration
app.post('/users', {
  handler: async ctx => {
    const user = await createUser(ctx.body);
    ctx.res.status(201).json({ user });
  },
  middleware: [
    rateLimitMiddleware,
    validationMiddleware,
    sanitizationMiddleware,
  ],
  schema: {
    body: {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name: { type: 'string', minLength: 2 },
        email: { type: 'string', format: 'email' },
        age: { type: 'number', minimum: 18 },
      },
    },
    response: {
      201: {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
            },
          },
        },
      },
    },
  },
  options: {
    name: 'createUser',
    description: 'Create a new user',
    tags: ['users', 'authentication'],
    version: '1.0.0',
    summary: 'Register a new user account',
    externalDocs: {
      description: 'User API Documentation',
      url: 'https://docs.example.com/users',
    },
  },
});
```

### **Route with Custom Middleware**

```typescript
// Authentication middleware
const authMiddleware = async (ctx, next) => {
  const token = ctx.headers.authorization;
  if (!token) {
    ctx.throw(401, 'Authentication required');
  }
  ctx.state.user = await verifyToken(token);
  await next();
};

// Validation middleware
const validationMiddleware = async (ctx, next) => {
  const { name, email } = ctx.body;
  if (!name || !email) {
    ctx.throw(400, 'Name and email are required');
  }
  await next();
};

// Route with custom middleware
app.put('/users/:id', {
  handler: async ctx => {
    const userId = ctx.params.id;
    const user = ctx.state.user;
    const updates = ctx.body;

    const updatedUser = await updateUser(userId, updates);
    ctx.res.json({ user: updatedUser });
  },
  middleware: [authMiddleware, validationMiddleware],
  schema: {
    params: {
      id: { type: 'string', required: true },
    },
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 2 },
        email: { type: 'string', format: 'email' },
      },
    },
  },
  options: {
    name: 'updateUser',
    description: 'Update user information',
    tags: ['users'],
  },
});
```

## 🔧 **Router System**

### **Creating Routers**

```typescript
// Create a router for user-related routes
const userRouter = app.router();

userRouter.get('/', ctx => {
  ctx.res.json({ users: [] });
});

userRouter.post('/', ctx => {
  const { name, email } = ctx.body;
  ctx.res.json({ success: true, user: { name, email } });
});

userRouter.get('/:id', ctx => {
  const userId = ctx.params.id;
  ctx.res.json({ userId });
});

userRouter.put('/:id', ctx => {
  const userId = ctx.params.id;
  const updates = ctx.body;
  ctx.res.json({ success: true, updated: userId });
});

userRouter.delete('/:id', ctx => {
  const userId = ctx.params.id;
  ctx.res.json({ success: true, deleted: userId });
});

// Mount the router with a prefix
app.use('/users', userRouter);
```

### **Nested Routers**

```typescript
// User router
const userRouter = app.router();

// Post router (nested under users)
const postRouter = app.router();

postRouter.get('/', ctx => {
  const userId = ctx.params.userId;
  ctx.res.json({ posts: [], userId });
});

postRouter.post('/', ctx => {
  const userId = ctx.params.userId;
  const { title, content } = ctx.body;
  ctx.res.json({ success: true, post: { title, content, userId } });
});

postRouter.get('/:postId', ctx => {
  const { userId, postId } = ctx.params;
  ctx.res.json({ userId, postId });
});

// Mount post router under user router
userRouter.use('/:userId/posts', postRouter);

// Mount user router under main app
app.use('/users', userRouter);
```

### **Router with Middleware**

```typescript
const apiRouter = app.router();

// Add middleware to the router
apiRouter.use(async (ctx, next) => {
  ctx.state.apiVersion = 'v1';
  await next();
});

apiRouter.use(app.json());
apiRouter.use(app.logger());

// Add routes
apiRouter.get('/health', ctx => {
  ctx.res.json({ status: 'ok', version: ctx.state.apiVersion });
});

apiRouter.get('/data', ctx => {
  ctx.res.json({ data: [] });
});

// Mount with prefix
app.use('/api', apiRouter);
```

## 🛡️ **Middleware Integration**

### **Route-Specific Middleware**

```typescript
// Global middleware
app.use(app.cors());
app.use(app.helmet());
app.use(app.json());

// Route-specific middleware
app.get('/admin/users', {
  handler: ctx => {
    ctx.res.json({ users: [] });
  },
  middleware: [adminAuthMiddleware, rateLimitMiddleware],
});
```

### **Conditional Middleware**

```typescript
const conditionalAuth = (requiredRole?: string) => {
  return async (ctx, next) => {
    const user = ctx.state.user;

    if (!user) {
      ctx.throw(401, 'Authentication required');
    }

    if (requiredRole && user.role !== requiredRole) {
      ctx.throw(403, 'Insufficient permissions');
    }

    await next();
  };
};

app.get('/admin/dashboard', {
  handler: ctx => {
    ctx.res.json({ dashboard: 'admin' });
  },
  middleware: [conditionalAuth('admin')],
});

app.get('/user/profile', {
  handler: ctx => {
    ctx.res.json({ profile: ctx.state.user });
  },
  middleware: [conditionalAuth()],
});
```

## ⚠️ **Error Handling**

### **Route-Level Error Handling**

```typescript
app.get('/users/:id', {
  handler: async ctx => {
    const userId = ctx.params.id;
    const user = await getUser(userId);

    if (!user) {
      ctx.throw(404, 'User not found');
    }

    ctx.res.json({ user });
  },
  middleware: [validationMiddleware],
});
```

### **Global Error Handling**

```typescript
// Global error handler
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.status = error.status || 500;
    ctx.res.json({
      error: error.message || 'Internal Server Error',
      statusCode: ctx.status,
    });
  }
});
```

## 🔍 **TypeScript Support**

### **Type-Safe Route Handlers**

```typescript
import { type Context, type RouteHandler } from 'nextrush-v2';

interface UserBody {
  name: string;
  email: string;
  age?: number;
}

interface UserResponse {
  id: string;
  name: string;
  email: string;
  age?: number;
}

const createUserHandler: RouteHandler = async ctx => {
  const body = ctx.body as UserBody;
  const { name, email, age } = body;

  // TypeScript knows the structure
  const user: UserResponse = {
    id: generateId(),
    name,
    email,
    age,
  };

  ctx.res.json({ user });
};

app.post('/users', {
  handler: createUserHandler,
  schema: {
    body: {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name: { type: 'string', minLength: 2 },
        email: { type: 'string', format: 'email' },
        age: { type: 'number', minimum: 18 },
      },
    },
  },
});
```

### **Type-Safe Route Configuration**

```typescript
interface RouteConfig {
  handler: RouteHandler;
  middleware?: Middleware[];
  schema?: {
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
    params?: Record<string, unknown>;
    response?: Record<string, unknown>;
  };
  options?: {
    name?: string;
    description?: string;
    tags?: string[];
    version?: string;
    deprecated?: boolean;
    summary?: string;
  };
}

// Type-safe route configuration
const userRoutes: Record<string, RouteConfig> = {
  'GET /users': {
    handler: async ctx => {
      ctx.res.json({ users: [] });
    },
    options: {
      name: 'getUsers',
      description: 'Get all users',
      tags: ['users'],
    },
  },
  'POST /users': {
    handler: createUserHandler,
    middleware: [validationMiddleware],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string', minLength: 2 },
          email: { type: 'string', format: 'email' },
        },
      },
    },
    options: {
      name: 'createUser',
      description: 'Create a new user',
      tags: ['users'],
    },
  },
};
```

## 📚 **Examples**

### **Complete API Example**

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp();

// Global middleware
app.use(app.cors());
app.use(app.helmet());
app.use(app.json());
app.use(app.logger());

// Health check
app.get('/health', ctx => {
  ctx.res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// User routes with Fastify-style config
app.get('/users', {
  handler: async ctx => {
    const users = await getUsers();
    ctx.res.json({ users });
  },
  options: {
    name: 'getUsers',
    description: 'Get all users',
    tags: ['users'],
  },
});

app.post('/users', {
  handler: async ctx => {
    const user = await createUser(ctx.body);
    ctx.res.status(201).json({ user });
  },
  middleware: [validationMiddleware],
  schema: {
    body: {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name: { type: 'string', minLength: 2 },
        email: { type: 'string', format: 'email' },
      },
    },
  },
  options: {
    name: 'createUser',
    description: 'Create a new user',
    tags: ['users'],
  },
});

app.get('/users/:id', {
  handler: async ctx => {
    const userId = ctx.params.id;
    const user = await getUser(userId);

    if (!user) {
      ctx.throw(404, 'User not found');
    }

    ctx.res.json({ user });
  },
  schema: {
    params: {
      id: { type: 'string', required: true },
    },
  },
  options: {
    name: 'getUser',
    description: 'Get user by ID',
    tags: ['users'],
  },
});

// Start server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## 🔗 **Related Documentation**

- [Application API](./application.md) - Main application class
- [Context System](./context.md) - Request/response context
- [Middleware System](./middleware.md) - Middleware features
- [Error Handling](./error-handling.md) - Error handling patterns
