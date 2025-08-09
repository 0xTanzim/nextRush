# 🏗️ Application API

> **NextRush v2 Application Class Reference**

The `Application` class is the core of NextRush v2, providing a modern, type-safe web framework with Express-like design and Koa-style middleware.

## 📋 **Table of Contents**

- [Overview](#overview)
- [Creating an Application](#creating-an-application)
- [Configuration Options](#configuration-options)
- [HTTP Methods](#http-methods)
- [Fastify-Style Routes](#fastify-style-routes)
- [Middleware System](#middleware-system)
- [Router System](#router-system)
- [Server Management](#server-management)
- [Error Handling](#error-handling)
- [TypeScript Support](#typescript-support)

## 🎯 **Overview**

The `Application` class provides:

- **Express-like API**: Familiar `app.get()`, `app.post()`, `app.use()` methods
- **Fastify-style Routes**: Advanced route configuration with middleware, validation, and metadata
- **Koa-style Context**: Enhanced request/response with context object
- **Type-safe APIs**: Full TypeScript support with IntelliSense
- **Zero Dependencies**: Built on Node.js built-in modules
- **High Performance**: Optimized for millisecond-level performance

## 🚀 **Creating an Application**

### **Basic Application**

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp();
```

### **Application with Options**

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp({
  port: 3000,
  host: 'localhost',
  debug: true,
  trustProxy: true,
  maxBodySize: 10 * 1024 * 1024,
  timeout: 30000,
  keepAlive: 10000,
  cors: true,
  static: './public',
  template: {
    engine: 'ejs',
    directory: './views',
  },
});
```

## ⚙️ **Configuration Options**

```typescript
interface ApplicationOptions {
  /** Port to listen on (default: 3000) */
  port?: number;
  /** Host to bind to (default: 'localhost') */
  host?: string;
  /** Enable debug mode */
  debug?: boolean;
  /** Trust proxy headers */
  trustProxy?: boolean;
  /** Maximum request body size in bytes */
  maxBodySize?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Enable CORS by default */
  cors?: boolean;
  /** Static files directory */
  static?: string;
  /** Template engine configuration */
  template?: {
    engine: string;
    directory: string;
  };
  /** HTTP keep-alive timeout in milliseconds (default: 10000) */
  keepAlive?: number;
}
```

## 🛣️ **HTTP Methods**

### **Simple Route Handlers**

```typescript
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
  const updates = ctx.body;
  ctx.res.json({ success: true, updated: userId });
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

## 🔧 **Middleware System**

### **Global Middleware**

```typescript
// Security middleware
app.use(app.helmet());
app.use(app.cors());

// Body parsing (recommended)
app.use(app.smartBodyParser());
// Or individual parsers
app.use(app.json());
app.use(app.urlencoded());

// Logging and monitoring
app.use(app.logger());
app.use(app.timer());
app.use(app.requestId());

// Rate limiting
app.use(
  app.rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  })
);

// Compression
app.use(app.compression());
```

### **Custom Middleware**

```typescript
// Authentication middleware
app.use(async (ctx, next) => {
  const token = ctx.headers.authorization;

  if (ctx.path.startsWith('/api/') && !token) {
    ctx.throw(401, 'Authentication required');
  }

  if (token) {
    ctx.state.user = await verifyToken(token);
  }

  await next();
});

// Error handling middleware
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

### **Route-Specific Middleware**

```typescript
// Route with specific middleware
app.get('/admin/users', {
  handler: ctx => {
    ctx.res.json({ users: [] });
  },
  middleware: [adminAuthMiddleware, rateLimitMiddleware],
});
```

## 🛣️ **Router System**

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

// Mount post router under user router
userRouter.use('/:userId/posts', postRouter);

// Mount user router under main app
app.use('/users', userRouter);
```

## 🏭 **Middleware Factory Methods**

### **CORS Middleware**

```typescript
// Basic CORS
app.use(app.cors());

// Advanced CORS
app.use(
  app.cors({
    origin: ['https://app.example.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Total-Count'],
    maxAge: 86400,
  })
);
```

### **Helmet Security Middleware**

```typescript
// Basic security headers
app.use(app.helmet());

// Advanced security configuration
app.use(
  app.helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);
```

### **Body Parser Middleware**

```typescript
// JSON body parser
app.use(
  app.json({
    limit: '10mb',
    strict: true,
    type: 'application/json',
  })
);

// URL-encoded body parser
app.use(
  app.urlencoded({
    extended: true,
    limit: '10mb',
    parameterLimit: 1000,
  })
);
```

### **Rate Limiter Middleware**

```typescript
// Basic rate limiting
app.use(
  app.rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  })
);

// Advanced rate limiting
app.use(
  app.rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP',
    statusCode: 429,
    headers: true,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: ctx => ctx.ip,
    skip: ctx => ctx.path.startsWith('/health'),
    handler: ctx => {
      ctx.res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: 60,
      });
    },
  })
);
```

### **Logger Middleware**

```typescript
// Basic logging
app.use(app.logger());

// Advanced logging
app.use(
  app.logger({
    format: 'detailed',
    level: 'info',
    colorize: true,
    timestamp: true,
    showHeaders: true,
    showResponseTime: true,
    showIP: true,
    showUserAgent: true,
    filter: ctx => ctx.path !== '/health',
  })
);
```

### **Compression Middleware**

```typescript
// Basic compression
app.use(app.compression());

// Advanced compression
app.use(
  app.compression({
    level: 6,
    threshold: 1024,
    filter: ctx => {
      return ctx.path.endsWith('.json') || ctx.path.endsWith('.html');
    },
    contentType: ['application/json', 'text/html'],
    exclude: ['application/pdf'],
  })
);
```

### **Request ID Middleware**

```typescript
// Basic request ID
app.use(app.requestId());

// Advanced request ID
app.use(
  app.requestId({
    headerName: 'X-Request-ID',
    generator: () => crypto.randomUUID(),
    addResponseHeader: true,
    setInContext: true,
    includeInLogs: true,
  })
);
```

### **Timer Middleware**

```typescript
// Basic timing
app.use(app.timer());

// Advanced timing
app.use(
  app.timer({
    header: 'X-Response-Time',
    digits: 2,
    suffix: 'ms',
    includeStartTime: true,
    includeEndTime: true,
    includeDuration: true,
    format: 'milliseconds',
    threshold: 1000,
    logSlow: true,
    logSlowThreshold: 500,
  })
);
```

## 🖥️ **Server Management**

### **Starting the Server**

```typescript
// Basic server start
app.listen(3000);

// With callback
app.listen(3000, 'localhost', () => {
  console.log('Server running on http://localhost:3000');
});

// With options
app.listen(3000, '0.0.0.0', () => {
  console.log('Server running on port 3000');
});
```

### **Getting Server Instance**

```typescript
const server = app.getServer();
console.log('Server instance:', server);
```

### **Graceful Shutdown**

```typescript
// Handle shutdown signals
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await app.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await app.shutdown();
  process.exit(0);
});
```

## ⚠️ **Error Handling**

### **Global Error Handler**

```typescript
// Global error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.status = error.status || 500;
    ctx.res.json({
      error: error.message || 'Internal Server Error',
      statusCode: ctx.status,
      timestamp: new Date().toISOString(),
    });
  }
});
```

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
});
```

## 🔍 **TypeScript Support**

### **Type-Safe Application**

```typescript
import { createApp, type Application, type Context } from 'nextrush-v2';

const app: Application = createApp({
  port: 3000,
  debug: true,
});

// Type-safe route handler
app.get('/users/:id', (ctx: Context) => {
  const userId: string = ctx.params.id;
  ctx.res.json({ userId });
});
```

### **Type-Safe Route Configuration**

```typescript
interface UserBody {
  name: string;
  email: string;
  age?: number;
}

app.post('/users', {
  handler: async (ctx: Context) => {
    const body = ctx.body as UserBody;
    const { name, email, age } = body;

    // TypeScript knows the structure
    const user = { name, email, age };
    ctx.res.json({ user });
  },
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

## 📚 **Complete Example**

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp({
  port: 3000,
  debug: true,
  cors: true,
  static: './public',
});

// Global middleware
app.use(app.helmet());
app.use(app.cors());
app.use(app.json());
app.use(app.logger());
app.use(app.timer());
app.use(app.requestId());

// Rate limiting
app.use(
  app.rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);

// Compression
app.use(app.compression());

// Custom middleware
app.use(async (ctx, next) => {
  ctx.state.startTime = Date.now();
  await next();
  const duration = Date.now() - ctx.state.startTime;
  console.log(`${ctx.method} ${ctx.path} - ${duration}ms`);
});

// Routes
app.get('/health', ctx => {
  ctx.res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

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

// Router
const apiRouter = app.router();

apiRouter.get('/data', ctx => {
  ctx.res.json({ data: [] });
});

app.use('/api', apiRouter);

// Error handling
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

// Start server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await app.shutdown();
  process.exit(0);
});
```

## 🔗 **Related Documentation**

- [Context System](./context.md) - Request/response context
- [Routing System](./routing.md) - Route handling
- [Middleware System](./middleware.md) - Middleware features
- [Error Handling](./errors.md) - Error handling patterns
