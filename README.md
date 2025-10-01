<div align="center">

# 🚀 NextRush v2

**The Modern, Type-Safe Web Framework for Node.js**

_Koa-style elegance • Express-inspired helpers • Fastify-level performance_

[![npm version](https://img.shields.io/npm/v/nextrush?color=brightgreen&style=for-the-badge)](https://www.npmjs.com/package/nextrush)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white)](https://github.com/0xTanzim/nextrush/actions)
[![Tests](https://img.shields.io/badge/Tests-1652%20Passing-brightgreen?style=for-the-badge)](https://github.com/0xTanzim/nextrush)

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.get('/hello', async ctx => {
  ctx.json({ message: 'Welcome to NextRush v2! 🎉' });
});

app.listen(3000);
// 🚀 Server running → http://localhost:3000
```

[**📖 Documentation**](./docs) • [**🎮 Examples**](./examples) • [**🚀 Quick Start**](#-quick-start) • [**💡 Why NextRush?**](#-why-nextrush-v2)

</div>

---

## 🎯 **Why NextRush v2?**

NextRush v2 is the **next evolution** of Node.js web frameworks, combining the best ideas from Express, Koa, and Fastify into one powerful, type-safe framework with **enterprise-grade features built-in**.

### 🏆 **Three Frameworks in One**

| **Convenience** | **Koa-style Enhanced** | **Fastify-inspired**   |
| --------------- | ---------------------- | ---------------------- |
| `ctx.json()`    | `ctx.res.json()`       | `{ handler, schema }`  |
| Clean & simple  | Express-like helpers   | Advanced configuration |
| Recommended     | Familiar syntax        | Type validation        |

### ⚡ **Performance That Scales**

- **🧠 Zero Dependencies** - Pure Node.js, no external dependencies
- **⚡ 13,261 RPS Average** - 20% faster than Express, battle-tested
- **🚀 Optimized Router** - O(1) static path lookup, pre-compiled routes
- **💾 Memory Efficient** - ~60KB overhead, production-ready
- **📊 Smart Caching** - Template & partial caching, efficient buffers

### 🛡️ **Enterprise Features Built-In**

Unlike other frameworks, NextRush v2 includes **production-ready features** out of the box:

```typescript
const app = createApp();

// ✅ Security middleware (CORS, Helmet, Rate Limiting)
app.use(app.cors({ origin: ['https://example.com'] }));
app.use(app.helmet({ xssFilter: true }));
app.use(app.rateLimiter({ max: 100, windowMs: 15 * 60 * 1000 }));

// ✅ Smart body parser with auto-detection
app.use(app.smartBodyParser({ maxSize: 10 * 1024 * 1024 }));

// ✅ Advanced validation & sanitization
const userData = validateRequest(ctx, userSchema);
const cleanData = sanitizeInput(userData);

// ✅ Custom error classes with helpful messages
throw new NotFoundError('User not found', {
  userId: ctx.params.id,
  suggestion: 'Check the user ID',
});

// ✅ Event-driven architecture (Simple + CQRS)
await app.events.emit('user.registered', { userId: user.id });
await app.eventSystem.dispatch({ type: 'CreateUser', data: {...} });

// ✅ Template engine with auto-escaping
await ctx.render('profile.html', { user, isAdmin });

// ✅ WebSocket support with rooms
wsApp.ws('/chat', socket => {
  socket.join('room1');
  socket.onMessage(data => wsApp.wsBroadcast(data, 'room1'));
});

// ✅ Advanced logging with transports
ctx.logger.info('User action', { userId, action });

// ✅ Dependency injection container
const service = container.resolve('UserService');
```

### 🛡️ **Type Safety First**

```typescript
// ✅ Full TypeScript integration with perfect IntelliSense
import type { Context, Middleware, RouteHandler } from 'nextrush';

app.get('/users/:id', async (ctx: Context) => {
  const userId: string = ctx.params.id; // ✅ Type-safe params
  const userData: User = ctx.body; // ✅ Type-safe body
  ctx.json({ user: userData }); // ✅ Type-safe response
});

// ✅ Type-safe middleware
const authMiddleware: Middleware = async (ctx, next) => {
  ctx.state.user = await validateToken(ctx.headers.authorization);
  await next();
};
```

### 🎭 **Choose Your Style**

```typescript
// 🎯 Convenience Methods (Recommended)
app.get('/users', async ctx => {
  ctx.json(await getUsers()); // Clean & simple
});

// 🔧 Koa-style Enhanced (Express-inspired helpers)
app.get('/users', async ctx => {
  ctx.res.json(await getUsers()); // Express-like methods on Koa context
});

// ⚙️ Fastify-style (Advanced)
app.get('/users', {
  handler: async ctx => ctx.json(await getUsers()),
  schema: { response: { 200: UserSchema } },
  options: { tags: ['users'] },
});
```

### 🌟 **What's Included Out of the Box**

| Feature                       | NextRush v2       | Express | Fastify | Koa    |
| ----------------------------- | ----------------- | ------- | ------- | ------ |
| **Security Middleware**       | ✅ Built-in       | ❌      | ❌      | ❌     |
| **Validation & Sanitization** | ✅ Built-in       | ❌      | ✅      | ❌     |
| **Template Engine**           | ✅ Built-in       | ❌      | ❌      | ❌     |
| **WebSocket Support**         | ✅ Built-in       | ❌      | ❌      | ❌     |
| **Event System (CQRS)**       | ✅ Dual System    | ❌      | ❌      | ❌     |
| **Advanced Logging**          | ✅ Plugin         | ❌      | ❌      | ❌     |
| **Error Classes**             | ✅ 8 Types        | ❌      | ❌      | ❌     |
| **Dependency Injection**      | ✅ Built-in       | ❌      | ❌      | ❌     |
| **Smart Body Parser**         | ✅ Auto-detection | ❌      | ✅      | ❌     |
| **Static File Serving**       | ✅ Plugin         | ✅      | ❌      | ❌     |
| **TypeScript Support**        | ✅ Native         | ⚠️      | ✅      | ⚠️     |
| **Zero Dependencies**         | ✅                | ❌      | ❌      | ✅     |
| **Performance (RPS)**         | 13,261            | 11,030  | 22,717  | 17,547 |

---

## ✨ **Powerful Features**

<table>
<tr>
<td width="50%">

### 🚀 **Modern Development**

- **TypeScript First** - Full type safety with IntelliSense
- **Zero Dependencies** - Pure Node.js performance
- **ESM & CJS** - Universal compatibility
- **Plugin System** - Extensible architecture
- **Hot Reload** - Development experience (upcoming)
- **Smart Body Parser** - Auto-detection & zero-copy
- **Template Engine** - Built-in HTML templating

</td>
<td width="50%">

### 🏗️ **Production Ready**

- **Error Handling** - Custom error classes & middleware
- **Advanced Logging** - Structured logs with transports
- **Security** - CORS, Helmet, Rate Limiting built-in
- **Validation** - Schema validation & sanitization
- **Testing** - Test-friendly design with 1652 tests
- **Static Files** - High-performance file serving
- **Compression** - Gzip & Brotli support

</td>
</tr>
<tr>
<td width="50%">

### 🌐 **Real-time & Events**

- **WebSocket Support** - RFC 6455 compliant
- **Room Management** - Built-in room system
- **Broadcasting** - Efficient message delivery
- **Event System** - Simple + Advanced CQRS/Event Sourcing
- **Connection Pooling** - Scalable connections
- **Heartbeat** - Connection health monitoring
- **Pub/Sub** - Event-driven architecture

</td>
<td width="50%">

### 🎯 **Developer Experience**

- **Enhanced Errors** - Helpful suggestions & debugging
- **Request/Response Enhancers** - Express-like helpers
- **Path Utilities** - URL & path manipulation
- **Cookie Utilities** - Type-safe cookie handling
- **Dependency Injection** - Built-in DI container
- **Dev Warnings** - Common mistake detection
- **Performance Monitoring** - Built-in metrics

</td>
</tr>
</table>

## 🚀 **Quick Start**

### Prerequisites

- **Node.js**: >= 20.0.0
- **pnpm**: >= 10.0.0 (recommended) or npm/yarn/bun

### Installation

```bash
# pnpm (recommended)
pnpm add nextrush

# npm
npm install nextrush

# yarn
yarn add nextrush

# bun
bun add nextrush
```

### Hello World

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.get('/', async ctx => {
  ctx.json({
    message: 'Hello NextRush v2! 🚀',
    timestamp: new Date().toISOString(),
  });
});

app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
```

### 30-Second API

```typescript
import { createApp } from 'nextrush';

const app = createApp({
  cors: true, // Enable CORS
  debug: true, // Development mode
});

// Middleware
app.use(async (ctx, next) => {
  console.log(`📝 ${ctx.method} ${ctx.path}`);
  await next();
});

// Routes with three different styles
app.get('/simple', async ctx => {
  ctx.json({ style: 'convenience' });
});

app.get('/express', async ctx => {
  ctx.res.json({ style: 'express-like' });
});

app.post('/fastify', {
  handler: async ctx => ctx.json({ style: 'fastify-style' }),
  schema: {
    body: {
      type: 'object',
      properties: { name: { type: 'string' } },
    },
  },
});

app.listen(3000);
```

---

## 🎭 **Multiple Programming Styles**

NextRush v2 is **Koa-style at its core** with **three different API styles** - use whichever feels most comfortable:

### 🎯 **Convenience Methods** _(Recommended)_

```typescript
app.get('/users/:id', async ctx => {
  const user = await findUser(ctx.params.id);

  if (!user) {
    ctx.json({ error: 'User not found' }, 404);
    return;
  }

  ctx.json(user); // ✨ Clean & simple
});

app.post('/users', async ctx => {
  const user = await createUser(ctx.body);
  ctx.json(user, 201); // ✨ Status code included
});
```

### 🔧 **Enhanced API** _(Express-inspired helpers)_

```typescript
app.get('/users/:id', async ctx => {
  const user = await findUser(ctx.params.id);

  if (!user) {
    ctx.res.status(404).json({ error: 'User not found' });
    return;
  }

  ctx.res.json(user); // 🔧 Express-inspired helpers on Koa context
});

app.post('/users', async ctx => {
  const user = await createUser(ctx.body);
  ctx.res.status(201).json(user); // 🔧 Chainable helper methods
});
```

### ⚙️ **Fastify-style Configuration** _(Advanced)_

```typescript
app.get('/users/:id', {
  handler: async ctx => {
    const user = await findUser(ctx.params.id);
    ctx.json(user || { error: 'Not found' }, user ? 200 : 404);
  },
  schema: {
    params: {
      type: 'object',
      properties: { id: { type: 'string', pattern: '^[0-9]+$' } },
    },
    response: {
      200: { type: 'object', properties: { id: { type: 'string' } } },
      404: { type: 'object', properties: { error: { type: 'string' } } },
    },
  },
  options: {
    name: 'getUser',
    description: 'Retrieve user by ID',
    tags: ['users'],
  },
});
```

---

## 🌐 **Real-time WebSocket Support**

Built-in **production-ready WebSocket** server with zero dependencies and **perfect TypeScript support**:

```typescript
import { createApp, WebSocketPlugin, withWebSocket } from 'nextrush';
import type { WSConnection } from 'nextrush';

const app = createApp();

// Install WebSocket plugin
const wsPlugin = new WebSocketPlugin({
  path: '/ws',
  heartbeatMs: 30000,
  maxConnections: 1000,
  verifyClient: async req => {
    // Optional: Custom authentication
    const token = new URL(req.url || '', 'http://localhost').searchParams.get(
      'token'
    );
    return !!token;
  },
});
wsPlugin.install(app);

// ✅ Get typed WebSocket application (Perfect IntelliSense!)
const wsApp = withWebSocket(app);

// Simple echo server with full type safety
wsApp.ws('/echo', (socket: WSConnection) => {
  socket.send('Welcome! 👋');

  socket.onMessage((data: string | Buffer) => {
    socket.send(`Echo: ${data}`);
  });
});

// Room-based chat system
wsApp.ws('/chat', (socket: WSConnection) => {
  const room = 'general';

  socket.join(room);
  socket.send(`Joined room: ${room}`);

  socket.onMessage((data: string | Buffer) => {
    // Broadcast to all users in room using app-level method
    wsApp.wsBroadcast(data.toString(), room);
  });

  socket.onClose((code, reason) => {
    console.log(`Client disconnected: ${code} - ${reason}`);
  });
});

app.listen(3000);
```

**Client Usage:**

```javascript
// Browser WebSocket client
const ws = new WebSocket('ws://localhost:3000/chat');
ws.onopen = () => {
  console.log('✅ Connected!');
  ws.send('Hello everyone! 👋');
};
ws.onmessage = event => console.log('📨 Received:', event.data);
ws.onerror = error => console.error('❌ Error:', error);
ws.onclose = () => console.log('👋 Disconnected');

// With authentication token
const wsAuth = new WebSocket('ws://localhost:3000/echo?token=your-jwt-token');
```

---

## 🛡️ **Built-in Security Middleware**

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// CORS - Cross-Origin Resource Sharing
app.use(
  app.cors({
    origin: ['https://example.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  })
);

// Helmet - Security headers
app.use(
  app.helmet({
    contentSecurityPolicy: true,
    xssFilter: true,
    noSniff: true,
    frameguard: { action: 'deny' },
  })
);

// Rate Limiting - DDoS protection
app.use(
  app.rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests',
  })
);

// Request ID - Tracing
app.use(app.requestId());

// Response Timer - Performance monitoring
app.use(app.timer());
```

**Security Features:**

- **CORS** - Flexible origin control & credentials
- **Helmet** - 15+ security headers configured
- **Rate Limiting** - IP-based request throttling
- **XSS Protection** - Auto-escaping in templates
- **Request Tracing** - Unique request IDs
- **Response Timing** - Performance headers

---

## 📝 **Comprehensive Validation System**

```typescript
import { validateRequest, sanitizeInput, ValidationError } from 'nextrush';

// Define validation schema
const userSchema = {
  name: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 50,
  },
  email: {
    required: true,
    type: 'email',
  },
  age: {
    type: 'number',
    min: 18,
    max: 120,
  },
  role: {
    enum: ['user', 'admin', 'moderator'],
  },
};

app.post('/users', async ctx => {
  try {
    // Validate & sanitize in one step
    const userData = validateRequest(ctx, userSchema);

    // Sanitize HTML input
    const cleanData = sanitizeInput(userData);

    const user = await createUser(cleanData);
    ctx.json({ user }, 201);
  } catch (error) {
    if (error instanceof ValidationError) {
      ctx.json(
        {
          error: 'Validation failed',
          details: error.errors,
        },
        400
      );
    }
  }
});
```

**Validation Features:**

- **Type Checking** - string, number, boolean, email, URL, etc.
- **Length Validation** - minLength, maxLength
- **Range Validation** - min, max for numbers
- **Pattern Matching** - Regex validation
- **Enum Validation** - Allowed values
- **Custom Validation** - Your own validation functions
- **XSS Prevention** - Auto-sanitization

📚 **[Complete Validation Guide →](./docs/api/validation-utilities.md)**

---

## 🎨 **Template Engine**

```typescript
import { createApp, TemplatePlugin } from 'nextrush';

const app = createApp();

// Setup template engine
const templatePlugin = new TemplatePlugin({
  viewsDir: './views',
  cache: true,
  helpers: {
    formatDate: date => new Date(date).toLocaleDateString(),
    currency: value => `$${Number(value).toFixed(2)}`,
  },
});

templatePlugin.install(app);

// Use templates
app.get('/users/:id', async ctx => {
  const user = await getUser(ctx.params.id);

  await ctx.render('user-profile.html', {
    title: 'User Profile',
    user,
    isAdmin: user.role === 'admin',
  });
});
```

**views/user-profile.html:**

```html
<!DOCTYPE html>
<html>
  <head>
    <title>{{title}}</title>
  </head>
  <body>
    <h1>{{user.name}}</h1>
    <p>Email: {{user.email}}</p>
    <p>Joined: {{user.createdAt | formatDate}}</p>

    {{#if isAdmin}}
    <button>Admin Panel</button>
    {{/if}}

    <!-- Loop through items -->
    {{#each user.posts}}
    <article>
      <h2>{{this.title}}</h2>
      <p>{{this.excerpt}}</p>
    </article>
    {{/each}}
  </body>
</html>
```

**Template Features:**

- **Auto-escaping** - XSS protection by default
- **Control Structures** - if/else, loops, with blocks
- **Helpers** - Built-in & custom transformation functions
- **Partials** - Reusable template components
- **Layouts** - Consistent page structure
- **Caching** - Fast production performance

📚 **[Template Engine Documentation →](./docs/api/template-plugin.md)**

---

## 🚨 **Advanced Error Handling**

```typescript
import {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
  TooManyRequestsError,
  InternalServerError,
} from 'nextrush';

// Custom error classes with proper status codes
app.get('/users/:id', async ctx => {
  const user = await db.user.findById(ctx.params.id);

  if (!user) {
    throw new NotFoundError('User not found', {
      userId: ctx.params.id,
      suggestion: 'Check the user ID',
    });
  }

  if (ctx.state.user.id !== user.id) {
    throw new ForbiddenError("Cannot access other user's data", {
      requestedUserId: ctx.params.id,
      currentUserId: ctx.state.user.id,
    });
  }

  ctx.json({ user });
});

// Global error handler
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof HttpError) {
      ctx.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        error.statusCode
      );
      return;
    }

    // Unexpected errors
    ctx.json({ error: 'Internal server error' }, 500);
  }
});
```

**Error Classes:**

- **BadRequestError (400)** - Invalid request data
- **UnauthorizedError (401)** - Authentication required
- **ForbiddenError (403)** - Insufficient permissions
- **NotFoundError (404)** - Resource not found
- **ConflictError (409)** - Resource conflicts
- **UnprocessableEntityError (422)** - Business rule violations
- **TooManyRequestsError (429)** - Rate limit exceeded
- **InternalServerError (500)** - Server errors

📚 **[Complete Error Handling Guide →](./docs/api/errors.md)**

---

## 🎪 **Event-Driven Architecture**

NextRush v2 includes **dual event systems**: Simple Events (Express-style) + Advanced Event System (CQRS/Event Sourcing).

### **Simple Events API** _(Express-style)_

```typescript
// Emit events
await app.events.emit('user.registered', {
  userId: user.id,
  email: user.email,
});

// Listen to events
app.events.on('user.registered', async data => {
  await sendWelcomeEmail(data.email);
  await createDefaultProfile(data.userId);
  await trackAnalytics('User Registered', data);
});

// One-time handlers
app.events.once('app.ready', async () => {
  await warmupCache();
  await initializeServices();
});
```

### **Advanced Event System** _(CQRS/Event Sourcing)_

```typescript
// Define commands
interface CreateUserCommand {
  type: 'CreateUser';
  data: { name: string; email: string };
  metadata: { id: string; timestamp: Date; correlationId: string };
}

// Register command handlers
app.eventSystem.registerCommandHandler(
  'CreateUser',
  async (command: CreateUserCommand) => {
    const user = await db.user.create(command.data);

    // Emit domain event
    await app.eventSystem.emit({
      type: 'user.created',
      data: { userId: user.id, email: user.email },
      timestamp: new Date(),
      metadata: {
        aggregateId: user.id,
        version: 1,
      },
    });

    return user;
  }
);

// Subscribe to domain events
app.eventSystem.subscribe('user.created', async event => {
  await analytics.track('User Created', {
    userId: event.data.userId,
    correlationId: event.metadata.correlationId,
  });
});

// Execute commands with CQRS
app.post('/users', async ctx => {
  const command: CreateUserCommand = {
    type: 'CreateUser',
    data: ctx.body,
    metadata: {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      correlationId: ctx.id,
    },
  };

  const user = await app.eventSystem.dispatch(command);
  ctx.json({ user }, 201);
});
```

**Event System Features:**

- **Simple Events** - Express-style emit/on/once
- **CQRS** - Command Query Responsibility Segregation
- **Event Sourcing** - Domain event tracking
- **Saga Patterns** - Complex workflow orchestration
- **Pub/Sub** - Event broadcasting
- **Correlation IDs** - Request tracing
- **Event Store** - Event history & replay

📚 **[Complete Event System Guide →](./docs/api/events.md)**

---

## 📊 **Advanced Logging Plugin**

```typescript
import { LoggerPlugin } from 'nextrush';

// Configure advanced logging
const loggerPlugin = new LoggerPlugin({
  level: 'info',
  format: 'json',
  transports: [
    {
      type: 'console',
      colorize: true,
    },
    {
      type: 'file',
      filename: 'logs/app.log',
      maxSize: 10485760, // 10MB
      maxFiles: 5,
    },
    {
      type: 'file',
      filename: 'logs/errors.log',
      level: 'error',
      maxSize: 10485760,
    },
  ],
  includeTimestamp: true,
  includeMetadata: true,
});

loggerPlugin.install(app);

// Use in routes
app.get('/api/data', async ctx => {
  ctx.logger.info('Fetching data', {
    userId: ctx.state.user?.id,
    endpoint: '/api/data',
  });

  try {
    const data = await fetchData();
    ctx.logger.debug('Data fetched successfully', { count: data.length });
    ctx.json({ data });
  } catch (error) {
    ctx.logger.error('Failed to fetch data', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
});
```

**Logger Features:**

- **Multiple Transports** - Console, File, Custom
- **Log Levels** - debug, info, warn, error, fatal
- **Structured Logging** - JSON format with metadata
- **File Rotation** - Size-based & time-based
- **Colorized Output** - Development-friendly
- **Performance Metrics** - Request timing & throughput
- **Custom Formatters** - Your own log formats

📚 **[Logger Plugin Documentation →](./docs/api/logger-plugin.md)**

---

## 🏗️ **Advanced Features**

### 🗂️ **Modular Router System**

```typescript
import { createApp, createRouter } from 'nextrush';

const app = createApp();

// Create sub-routers
const userRouter = createRouter();
const adminRouter = createRouter();

// User routes
userRouter.get('/profile', async ctx => ctx.json({ user: 'profile' }));
userRouter.post('/login', async ctx => ctx.json({ message: 'Logged in' }));

// Admin routes
adminRouter.get('/dashboard', async ctx => ctx.json({ admin: 'dashboard' }));
adminRouter.get('/users', async ctx => ctx.json({ admin: 'users list' }));

// Mount routers
app.use('/users', userRouter);
app.use('/admin', adminRouter);
```

### 🛡️ **Custom Middleware Development**

```typescript
import type { Middleware, Context } from 'nextrush';

// Simple middleware
const logger: Middleware = async (ctx, next) => {
  const start = Date.now();
  console.log(`🔄 ${ctx.method} ${ctx.path}`);

  await next();

  const duration = Date.now() - start;
  console.log(`✅ ${ctx.status} ${duration}ms`);
};

// Authentication middleware with proper error handling
const requireAuth: Middleware = async (ctx, next) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new UnauthorizedError('Authentication token required', {
      hint: 'Include Authorization: Bearer <token> header',
    });
  }

  try {
    ctx.state.user = await validateToken(token);
    await next();
  } catch (error) {
    throw new UnauthorizedError('Invalid authentication token', {
      reason: error.message,
    });
  }
};

// Role-based authorization
const requireRole = (role: string): Middleware => {
  return async (ctx, next) => {
    if (!ctx.state.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!ctx.state.user.roles.includes(role)) {
      throw new ForbiddenError(`${role} role required`, {
        userRoles: ctx.state.user.roles,
        requiredRole: role,
      });
    }

    await next();
  };
};

// Rate limiting middleware
const rateLimiter: Middleware = async (ctx, next) => {
  const key = ctx.ip;
  const limit = 100;
  const windowMs = 15 * 60 * 1000;

  const requests = await getRequestCount(key, windowMs);

  if (requests >= limit) {
    throw new TooManyRequestsError('Rate limit exceeded', {
      limit,
      retryAfter: Math.ceil(windowMs / 1000),
    });
  }

  await incrementRequestCount(key, windowMs);
  await next();
};

// Use middleware
app.use(logger);
app.use('/api', requireAuth);
app.use('/admin', requireRole('admin'));
```

📚 **[Middleware Development Guide →](./docs/guides/middleware-development.md)**

### 🎯 **Enhanced Response Methods**

```typescript
// JSON response with status code
app.get('/api/users', async ctx => {
  const users = await getUsers();
  ctx.json({ users }, 200);
});

// HTML response
app.get('/page', async ctx => {
  ctx.html('<h1>Welcome to NextRush</h1>');
});

// File download with options
app.get('/download', async ctx => {
  ctx.file('./document.pdf', {
    filename: 'report.pdf',
    contentType: 'application/pdf',
  });
});

// Redirect with status code
app.get('/old-url', async ctx => {
  ctx.redirect('/new-url', 301); // Permanent redirect
});

// CSV export
app.get('/export/users', async ctx => {
  const users = await getUsers();
  const csv = users.map(u => `${u.name},${u.email}`).join('\n');
  ctx.csv(`name,email\n${csv}`, 'users.csv');
});

// Stream response
app.get('/stream', async ctx => {
  const stream = fs.createReadStream('./large-file.txt');
  ctx.stream(stream, 'text/plain');
});

// Set custom headers
app.get('/api/data', async ctx => {
  ctx.set('X-Custom-Header', 'value');
  ctx.set('Cache-Control', 'max-age=3600');
  ctx.json({ data: [] });
});

// Cookie management
app.get('/set-cookie', async ctx => {
  ctx.setCookie('session', 'abc123', {
    httpOnly: true,
    secure: true,
    maxAge: 3600000,
    sameSite: 'strict',
  });
  ctx.json({ message: 'Cookie set' });
});

app.get('/get-cookie', async ctx => {
  const session = ctx.getCookie('session');
  ctx.json({ session });
});
```

📚 **[Enhanced Request/Response API →](./docs/api/enhancers.md)**


## 📖 **Complete API Reference**

### **Context Object**

```typescript
// ===================== Request Properties =====================
ctx.req        // Native HTTP request object
ctx.res        // Enhanced response object
ctx.body       // Parsed request body (JSON, form, etc.)
ctx.method     // HTTP method (GET, POST, PUT, DELETE, etc.)
ctx.path       // Request path (/users/123)
ctx.url        // Full request URL
ctx.query      // Query parameters (?page=1 → { page: '1' })
ctx.headers    // Request headers (lowercase keys)
ctx.params     // Route parameters (/users/:id → { id: '123' })
ctx.cookies    // Parsed cookies
ctx.ip         // Client IP address
ctx.secure     // Is HTTPS?
ctx.protocol   // Request protocol (http/https)
ctx.hostname   // Request hostname
ctx.origin     // Request origin (protocol + host)
ctx.state      // Custom request-scoped state

// ===================== Response Methods =====================
// Convenience API (Recommended)
ctx.json(data, status?)           // Send JSON response
ctx.html(html, status?)            // Send HTML response
ctx.text(text, status?)            // Send plain text
ctx.csv(data, filename?)           // Send CSV file
ctx.file(path, options?)           // Send file download
ctx.stream(stream, contentType?)   // Send stream response
ctx.redirect(url, status?)         // Redirect to URL

// Express-like API (Enhanced)
ctx.res.json(data, status?)        // Send JSON
ctx.res.status(code)               // Set status code (chainable)
ctx.res.send(data)                 // Auto-detect content type
ctx.res.sendFile(path)             // Send file
ctx.res.render(template, data)     // Render template

// ===================== Header & Cookie Methods =====================
ctx.get(headerName)                // Get request header
ctx.set(headerName, value)         // Set response header
ctx.setCookie(name, value, opts)   // Set cookie
ctx.getCookie(name)                // Get cookie value
ctx.clearCookie(name)              // Delete cookie

// ===================== Utility Properties =====================
ctx.id                             // Unique request ID
ctx.logger                         // Request-scoped logger
ctx.services                       // DI container services
ctx.app                            // Application instance
```

### **Application Methods**

```typescript
// ===================== HTTP Methods =====================
app.get(path, ...handlers)         // GET route
app.post(path, ...handlers)        // POST route
app.put(path, ...handlers)         // PUT route
app.delete(path, ...handlers)      // DELETE route
app.patch(path, ...handlers)       // PATCH route
app.head(path, ...handlers)        // HEAD route
app.options(path, ...handlers)     // OPTIONS route
app.all(path, ...handlers)         // All HTTP methods

// ===================== Middleware =====================
app.use(...middleware)             // Global middleware
app.use(path, ...middleware)       // Path-specific middleware

// ===================== Built-in Middleware =====================
app.cors(options)                  // CORS middleware
app.helmet(options)                // Security headers
app.rateLimiter(options)           // Rate limiting
app.compression(options)           // Gzip/Brotli compression
app.requestId(options)             // Request ID tracking
app.timer()                        // Response time header
app.smartBodyParser(options)       // Auto body parsing

// ===================== Event System =====================
app.events.emit(event, data)       // Emit simple event
app.events.on(event, handler)      // Listen to event
app.events.once(event, handler)    // One-time listener
app.events.off(event, handler?)    // Remove listener

app.eventSystem.dispatch(op)       // CQRS dispatch
app.eventSystem.executeCommand(c)  // Execute command
app.eventSystem.executeQuery(q)    // Execute query
app.eventSystem.subscribe(e, h)    // Subscribe to domain event

// ===================== Server Control =====================
app.listen(port, callback?)        // Start HTTP server
app.close(callback?)               // Stop server gracefully
```

### **Router Methods**

```typescript
// Create router
const router = createRouter('/prefix');

// HTTP methods
router.get(path, handler);
router.post(path, handler);
router.put(path, handler);
router.delete(path, handler);
router.patch(path, handler);

// Middleware
router.use(middleware);

// Mount router
app.use('/api', router);
```

---

## 🧪 **Testing**

```typescript
import { createApp } from 'nextrush';

describe('NextRush Application', () => {
  it('should handle GET requests', async () => {
    const app = createApp();

    app.get('/test', async ctx => {
      ctx.json({ message: 'OK' });
    });

    // Your test implementation
  });
});
```

---


## 🔥 **Enhanced Body Parser**

**Enterprise-grade body parsing with zero-copy operations:**

```typescript
// Auto-parsing (recommended)
app.use(app.smartBodyParser());

// Advanced configuration
app.use(
  app.smartBodyParser({
    maxSize: 10 * 1024 * 1024, // 10MB
    enableStreaming: true,
    autoDetectContentType: true,
    enableMetrics: true,
  })
);

// Supports JSON, form-data, text, multipart
app.post('/api/data', ctx => {
  const data = ctx.body; // Already parsed!
  ctx.json({ received: data });
});
```

**Features:** Zero-copy buffers • Auto-detection • Streaming • Memory-pooled • Cross-platform

📚 **[Full Documentation →](./docs/api/built-in-middleware.md)**

---

## 🔥 Enhanced Body Parser

NextRush v2 includes a powerful enhanced body parser with enterprise-grade features:

### Features

- **Zero-copy buffer operations** using Node.js raw power
- **Cross-platform compatibility** (Node.js, Bun, Deno)
- **AI-like content type auto-detection**
- **Streaming parser** with backpressure handling
- **Memory-pooled buffer management**
- **CPU-optimized parsing** with vectorized operations
- **Smart caching** and pre-compiled patterns
- **Enterprise-grade error handling**
- **Real-time performance metrics** collection

### Usage

```typescript
// Automatic content-type detection and parsing
app.use(app.smartBodyParser());

// Advanced configuration
app.use(
  app.smartBodyParser({
    maxSize: 10 * 1024 * 1024, // 10MB
    enableStreaming: true,
    autoDetectContentType: true,
    enableMetrics: true,
  })
);

// Handles JSON, URL-encoded, text, multipart, and raw data automatically
app.post('/api/data', ctx => {
  const data = ctx.body; // Already parsed based on content-type
  ctx.res.json({ received: data });
});
```

See [Built-in Middleware Guide](./docs/api/built-in-middleware.md) for detailed body parser documentation.

## 📚 Comprehensive Documentation

Complete documentation with guides, API references, and architecture deep-dives:

### 🚀 **Getting Started**

- **[Getting Started Guide](./docs/guides/getting-started.md)** - Your first NextRush v2 app in 5 minutes
- **[Migration from Express](./docs/guides/migration-guide.md)** - Migrate from Express.js
- **[Migration from Fastify](./docs/guides/migration-guide.md)** - Migrate from Fastify

### 📖 **Essential Guides**

- **[Routing Guide](./docs/api/routing.md)** - All three routing styles explained (Convenience, Enhanced, Fastify-style)
- **[Middleware Development](./docs/guides/middleware-development.md)** - Create custom middleware
- **[Plugin Development](./docs/guides/plugin-development.md)** - Build powerful plugins
- **[Error Handling Guide](./docs/guides/error-handling.md)** - Robust error management patterns
- **[Testing Guide](./docs/guides/testing-guide.md)** - Unit, integration, and E2E testing
- **[Production Deployment](./docs/guides/production-deployment.md)** - Deploy to production

### 🔧 **Core API Reference**

- **[Application API](./docs/api/application.md)** - Core application methods and lifecycle
- **[Context API](./docs/api/context.md)** - Request/response context (Koa-style)
- **[Routing API](./docs/api/routing.md)** - Router and route handlers
- **[Middleware API](./docs/api/middleware.md)** - Middleware system and patterns
- **[Built-in Middleware](./docs/api/built-in-middleware.md)** - CORS, Helmet, Rate Limiting, Body Parser
- **[Events API](./docs/api/events.md)** - Simple Events + Advanced Event System (CQRS)
- **[Enhanced Request/Response](./docs/api/enhancers.md)** - Express-like helper methods

### 🛡️ **Advanced Features**

- **[Error Handling API](./docs/api/errors.md)** - Custom error classes and error middleware
- **[Validation Utilities](./docs/api/validation-utilities.md)** - Schema validation and data sanitization
- **[Configuration & Validation](./docs/api/configuration.md)** - Application configuration
- **[Path Utilities](./docs/api/path-utilities.md)** - URL and path manipulation helpers
- **[Developer Experience](./docs/api/developer-experience.md)** - Enhanced error messages and debugging

### 🔌 **Plugin APIs**

- **[Logger Plugin](./docs/api/logger-plugin.md)** - Advanced structured logging with transports
- **[WebSocket Plugin](./docs/api/websocket-plugin.md)** - Real-time WebSocket communication
- **[Static Files Plugin](./docs/api/static-files-plugin.md)** - High-performance static file serving
- **[Template Plugin](./docs/api/template-plugin.md)** - HTML template rendering engine

### 🏗️ **Architecture Deep-Dives**

- **[Plugin System](./docs/architecture/plugin-system.md)** - Plugin architecture and lifecycle
- **[Dependency Injection](./docs/architecture/dependency-injection.md)** - DI container and service resolution
- **[Orchestration System](./docs/architecture/orchestration-system.md)** - Application orchestration patterns
- **[Optimized Router](./docs/architecture/optimized-router-deep-dive.md)** - Router internals and performance

### 📊 **Performance & Benchmarks**

- **Benchmarks** - Performance comparisons with Express, Koa, and Fastify
- **Performance Guide** - Optimization techniques and best practices
- **Memory Management** - Efficient memory usage patterns

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Express.js** - For the intuitive API design
- **Koa** - For the powerful async middleware system
- **Fastify** - For the object-based route configuration
- **TypeScript** - For the type safety and developer experience

---

**Made with ❤️ by [Tanzim Hossain](https://github.com/0xTanzim)**
