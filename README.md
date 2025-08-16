<div align="center">

# 🚀 NextRush v2

**The Modern, Type-Safe Web Framework for Node.js**

_Express-like simplicity • Koa-style power • Fastify-level performance_

[![npm version](https://img.shields.io/npm/v/nextrush?color=brightgreen&style=for-the-badge)](https://www.npmjs.com/package/nextrush)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/nextrush?color=success&style=for-the-badge)](https://bundlephobia.com/package/nextrush)

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.get('/hello', async ctx => {
  ctx.json({ message: 'Welcome to NextRush v2! 🎉' });
});

app.listen(3000);
// 🚀 Server running → http://localhost:3000
```

[**📖 Documentation**](./docsV2) • [**🎮 Examples**](./examples) • [**🚀 Quick Start**](#-quick-start) • [**💡 Why NextRush?**](#-why-nextrush-v2)

</div>

---

## 🎯 **Why NextRush v2?**

NextRush v2 is the **next evolution** of Node.js web frameworks, combining the best ideas from Express, Koa, and Fastify into one powerful, type-safe framework.

### 🏆 **Three Frameworks in One**

| **Express-like** | **Koa-style**     | **Fastify-inspired**   |
| ---------------- | ----------------- | ---------------------- |
| `ctx.res.json()` | `ctx.body = data` | `{ handler, schema }`  |
| Familiar syntax  | Async middleware  | Advanced configuration |
| Easy migration   | Performance power | Type validation        |

### ⚡ **Performance That Scales**

- **🔥 10,000+ RPS** - Optimized for high throughput
- **🧠 Zero Dependencies** - Minimal footprint, maximum speed
- **⚡ Smart Body Parser** - Intelligent parsing with lazy loading
- **� Optimized Router** - Lightning-fast route matching
- **💾 Memory Efficient** - Built for production workloads

### 🛡️ **Type Safety First**

```typescript
// ✅ Full TypeScript integration
app.get('/users/:id', async (ctx: Context) => {
  const userId: string = ctx.params.id; // ✅ Type-safe params
  const userData: User = ctx.body; // ✅ Type-safe body
  ctx.json({ user: userData }); // ✅ Type-safe response
});
```

### 🎭 **Choose Your Style**

```typescript
// 🎯 Convenience Methods (Recommended)
app.get('/users', async ctx => {
  ctx.json(await getUsers()); // Clean & simple
});

// 🔧 Express-like (Familiar)
app.get('/users', async ctx => {
  ctx.res.json(await getUsers()); // Works like Express
});

// ⚙️ Fastify-style (Advanced)
app.get('/users', {
  handler: async ctx => ctx.json(await getUsers()),
  schema: { response: { 200: UserSchema } },
  options: { tags: ['users'] },
});
```

---

## ✨ **Powerful Features**

<table>
<tr>
<td width="50%">

### 🚀 **Modern Development**

- **TypeScript First** - Full type safety
- **Zero Dependencies** - Pure Node.js performance
- **ESM & CJS** - Universal compatibility
- **Plugin System** - Extensible architecture
- **Hot Reload** - Development experience

</td>
<td width="50%">

### 🏗️ **Production Ready**

- **Error Handling** - Comprehensive error system
- **Logging** - Advanced logging capabilities
- **Security** - Built-in security middleware
- **Validation** - Schema validation support
- **Testing** - Test-friendly design

</td>
</tr>
<tr>
<td width="50%">

### 🌐 **Real-time Features**

- **WebSocket Support** - RFC 6455 compliant
- **Room Management** - Built-in room system
- **Broadcasting** - Efficient message delivery
- **Connection Pooling** - Scalable connections
- **Heartbeat** - Connection health monitoring

</td>
<td width="50%">

### 🎯 **Developer Experience**

- **IntelliSense** - Rich autocomplete
- **Error Messages** - Clear, actionable errors
- **Documentation** - Comprehensive guides
- **Examples** - Real-world patterns
- **Migration Tools** - Easy upgrades

</td>
</tr>
</table>

## 🚀 **Quick Start**

### Installation

```bash
# npm
npm install nextrush

# pnpm
pnpm add nextrush

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

NextRush v2 supports **three different programming styles** - use whichever feels most comfortable:

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

### � **Express-like Style** _(Familiar)_

```typescript
app.get('/users/:id', async ctx => {
  const user = await findUser(ctx.params.id);

  if (!user) {
    ctx.res.status(404).json({ error: 'User not found' });
    return;
  }

  ctx.res.json(user); // 🔧 Works like Express
});

app.post('/users', async ctx => {
  const user = await createUser(ctx.body);
  ctx.res.status(201).json(user); // 🔧 Express-style chaining
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

Built-in **production-ready WebSocket** server with zero dependencies:

```typescript
import { createApp, WebSocketPlugin } from 'nextrush';

const app = createApp();

// Install WebSocket plugin
const ws = new WebSocketPlugin({
  path: '/ws',
  heartbeatMs: 30000,
  maxConnections: 1000,
});
ws.install(app);

// Simple echo server
app.ws('/echo', socket => {
  socket.send('Welcome! 👋');

  socket.onMessage(data => {
    socket.send(`Echo: ${data}`);
  });
});

// Room-based chat system
app.ws('/chat/:room', socket => {
  const room = socket.params.room;

  socket.join(room);
  socket.send(`Joined room: ${room}`);

  socket.onMessage(data => {
    // Broadcast to all users in room
    app.broadcast(data, room);
  });
});

app.listen(3000);
```

**Client Usage:**

```javascript
// Browser WebSocket client
const ws = new WebSocket('ws://localhost:3000/chat/general');
ws.onopen = () => ws.send('Hello everyone! 👋');
ws.onmessage = event => console.log('📨', event.data);
```

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

### 🛡️ **Middleware & Error Handling**

```typescript
// Global middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  console.log(`🔄 ${ctx.method} ${ctx.path}`);

  try {
    await next();
    console.log(`✅ ${Date.now() - start}ms`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    ctx.json({ error: 'Internal Server Error' }, 500);
  }
});

// Authentication middleware
const requireAuth = async (ctx, next) => {
  const token = ctx.headers.authorization;

  if (!token) {
    ctx.json({ error: 'Authentication required' }, 401);
    return;
  }

  ctx.state.user = await validateToken(token);
  await next();
};

// Protected routes
app.get('/profile', requireAuth, async ctx => {
  ctx.json({ user: ctx.state.user });
});
```

### 🎯 **Smart Response Methods**

```typescript
app.get('/api/data', async ctx => {
  ctx.json({ data: [] }); // JSON response
});

app.get('/page', async ctx => {
  ctx.html('<h1>Welcome</h1>'); // HTML response
});

app.get('/download', async ctx => {
  ctx.file('./document.pdf'); // File download
});

app.get('/redirect', async ctx => {
  ctx.redirect('/new-url', 301); // Redirect
});

app.get('/csv', async ctx => {
  ctx.csv('name,email\nJohn,john@example.com'); // CSV response
});
```

### ⚙️ **Plugin System**

```typescript
import { LoggerPlugin, StaticFilesPlugin } from 'nextrush';

const app = createApp();

// Logger plugin
const logger = new LoggerPlugin({
  level: 'info',
  format: 'json',
  transports: ['console', 'file'],
});
logger.install(app);

// Static files plugin
const staticFiles = new StaticFilesPlugin({
  root: './public',
  maxAge: 3600,
  gzip: true,
});
staticFiles.install(app);
```

````

### Enhanced Response Methods

```typescript
app.get('/api/users', async ctx => {
  // JSON response
  ctx.res.json({ users: [] });
});

app.get('/page', async ctx => {
  // HTML response
  ctx.res.html('<h1>Hello, World!</h1>');
});

app.get('/data.csv', async ctx => {
  // CSV response
  ctx.res.csv('id,name,email\n1,John,john@example.com');
});

app.get('/download', async ctx => {
  // File download
  ctx.res.download('/path/to/file.pdf', 'document.pdf');
});

app.get('/redirect', async ctx => {
  // Redirect
  ctx.res.redirect('/new-page', 301);
});
````

### Middleware and Error Handling

```typescript
// Logging middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  console.log(`${ctx.method} ${ctx.path}`);

  await next();

  const duration = Date.now() - start;
  ctx.res.set('X-Response-Time', `${duration}ms`);
});

// Authentication middleware
app.use(async (ctx, next) => {
  const token = ctx.headers.authorization;

  if (!token && ctx.path.startsWith('/protected')) {
    ctx.res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  await next();
});

// Error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal Server Error',
    });
  }
});
```

### Complex Router Example

```typescript
import { createApp, createRouter } from 'nextrush-v2';

const app = createApp();

// API Router with prefix
const apiRouter = createRouter('/api/v1');

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

// Admin API
const adminRouter = apiRouter.router();

adminRouter.get('/stats', async ctx => {
  ctx.res.json({ stats: { users: 100, products: 50 } });
});

// Mount all routers
apiRouter.use('/users', usersRouter);
apiRouter.use('/admin', adminRouter);

app.use(apiRouter);
```

### WebSocket Support

NextRush v2 includes a production-ready WebSocket implementation with zero dependencies:

```typescript
import { createApp, WebSocketPlugin } from 'nextrush-v2';

const app = createApp();

// Install WebSocket plugin
const wsPlugin = new WebSocketPlugin({
  path: '/ws',
  heartbeatMs: 30000,
  maxConnections: 1000,
});
wsPlugin.install(app);

// Simple echo server
app.ws('/ws', socket => {
  socket.send('Welcome to NextRush v2 WebSocket!');

  socket.onMessage(data => {
    console.log('Received:', data);
    socket.send(`Echo: ${data}`);
  });

  socket.onClose((code, reason) => {
    console.log(`Connection closed: ${code} - ${reason}`);
  });
});

// Room-based chat system
app.ws('/chat/*', socket => {
  // Extract room from URL
  const room = socket.url.split('/').pop() || 'general';

  // Join room
  socket.join(room);

  // Welcome message
  socket.send(`Welcome to room: ${room}`);

  // Handle messages
  socket.onMessage(data => {
    // Broadcast to all users in the room
    app.wsBroadcast(`${room}: ${data}`, room);
  });

  // Leave room on disconnect
  socket.onClose(() => socket.leave(room));
});

// WebSocket middleware for authentication
app.wsUse(async (socket, req, next) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token || !isValidToken(token)) {
    return socket.close(1008, 'Authentication failed');
  }

  next();
});
```

**Client Usage:**

```javascript
// Browser WebSocket client
const ws = new WebSocket('ws://localhost:3000/chat/general');
ws.onopen = () => ws.send('Hello everyone!');
ws.onmessage = (event) => console.log('Received:', event.data);

// Test with curl
curl -i -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:3000/ws
```

````

## 🔧 Configuration

```typescript
const app = createApp({
  port: 3000, // Port to listen on
  host: 'localhost', // Host to bind to
  debug: true, // Enable debug mode
  trustProxy: false, // Trust proxy headers
  maxBodySize: 1024 * 1024, // Max request body size (1MB)
  timeout: 30000, // Request timeout (30s)
  cors: true, // Enable CORS
  static: 'public', // Static files directory
  template: {
    // Template engine config
    engine: 'simple',
    directory: 'views',
  },
});

// Enhanced body parser configuration
app.use(
  app.smartBodyParser({
    maxSize: 10 * 1024 * 1024, // 10MB
    timeout: 30000, // 30 seconds
    enableStreaming: true,
    autoDetectContentType: true,
    enableMetrics: true,
  })
);
````

## 📖 API Reference

### Context Object (`ctx`)

```typescript
// Request properties (Express-like)
ctx.req; // HTTP request object
ctx.res; // Enhanced response object
ctx.body; // Request body (Express-like)
ctx.method; // Request method
ctx.path; // Request path
ctx.url; // Request URL
ctx.query; // Query parameters
ctx.headers; // Request headers
ctx.params; // Route parameters
ctx.ip; // Client IP
ctx.secure; // Is secure connection
ctx.protocol; // Request protocol

// Response methods (Express-like)
ctx.res.json(data); // Send JSON response
ctx.res.html(data); // Send HTML response
ctx.res.text(data); // Send text response
ctx.res.csv(data); // Send CSV response
ctx.res.xml(data); // Send XML response
ctx.res.file(path, options); // Send file
ctx.res.download(path, name); // Download file
ctx.res.redirect(url, status); // Redirect
ctx.res.status(code); // Set status code
ctx.res.set(name, value); // Set header
```

### Router Methods

```typescript
// Create router
const router = app.router();
const router = createRouter('/prefix');

// Register routes
router.get(path, handler);
router.post(path, handler);
router.put(path, handler);
router.delete(path, handler);
router.patch(path, handler);

// Register middleware
router.use(middleware);

// Mount router
app.use('/prefix', router);
```

## 🧪 Testing

```typescript
import { createApp } from 'nextrush-v2';

describe('Application', () => {
  it('should handle GET requests', async () => {
    const app = createApp();

    app.get('/test', async ctx => {
      ctx.res.json({ message: 'OK' });
    });

    // Test implementation
  });

  it('should create user with valid data', async () => {
    const app = createApp();

    app.post('/users', {
      handler: async ctx => {
        ctx.res.json({ message: 'User created' });
      },
      schema: {
        body: {
          name: { type: 'string', required: true },
          email: { type: 'email', required: true },
        },
      },
    });

    // Test implementation
  });
});
```

## 🎮 Playground & Examples

The `playground/` directory contains working examples and battle-tested implementations:

### WebSocket Examples

```bash
# Run simple WebSocket echo server
node playground/websocket-test.js

# Run comprehensive WebSocket battle tests
./playground/websocket-battle-test.sh

# Test with curl
curl -i -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:3001/ws
```

### Available Playground Files

- **`websocket-test.js`** - Simple WebSocket server with echo functionality
- **`websocket-chat-demo.js`** - Full-featured chat system with rooms and HTML client
- **`websocket-battle-test.sh`** - Comprehensive test suite for WebSocket functionality

These examples demonstrate production-ready patterns and can be used as starting points for your own applications.

## 🚀 Performance

NextRush v2 is built for performance:

- **Async Middleware**: Non-blocking middleware execution
- **Zero Dependencies**: Minimal overhead
- **Type Safety**: Compile-time optimizations
- **Efficient Routing**: Fast route matching
- **Memory Efficient**: Optimized for Node.js
- **Enhanced Body Parser**: Zero-copy buffer operations with intelligent caching

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

See [Built-in Middleware Guide](./docsV2/api/built-in-middleware.md) for detailed body parser documentation.

## 📚 Documentation

Comprehensive documentation with guides, API references, and architecture deep-dives:

**🚀 Quick Start**

- [Getting Started Guide](./docsV2/guides/getting-started.md) - Your first NextRush v2 app
- [Migration Guide](./docsV2/guides/migration-guide.md) - Migrate from Express/Fastify

**📖 Essential Guides**

- [Routing Guide](./docsV2/api/routing.md) - All three routing styles explained
- [Middleware Development](./docsV2/guides/middleware-development.md) - Create custom middleware
- [Plugin Development](./docsV2/guides/plugin-development.md) - Build powerful plugins
- [Error Handling](./docsV2/guides/error-handling.md) - Robust error management
- [Testing Guide](./docsV2/guides/testing-guide.md) - Test your applications
- [Production Deployment](./docsV2/guides/production-deployment.md) - Deploy to production

**🔧 API Reference**

- [Application API](./docsV2/api/application.md) - Core application methods
- [Context API](./docsV2/api/context.md) - Request/response context
- [Middleware API](./docsV2/api/middleware.md) - Middleware system
- [Built-in Middleware](./docsV2/api/built-in-middleware.md) - Body parser, CORS, etc.
- [Events API](./docsV2/api/events.md) - Event system
- [Enhanced Request/Response](./docsV2/api/enhancers.md) - Enhanced req/res objects

**🔌 Plugin APIs**

- [Logger Plugin](./docsV2/api/logger-plugin.md) - Advanced logging
- [WebSocket Plugin](./docsV2/api/websocket-plugin.md) - Real-time communication
- [Static Files Plugin](./docsV2/api/static-files-plugin.md) - Serve static assets
- [Template Plugin](./docsV2/api/template-plugin.md) - Template rendering

**🏗️ Architecture**

- [Plugin System](./docsV2/architecture/plugin-system.md) - Plugin architecture
- [Dependency Injection](./docsV2/architecture/dependency-injection.md) - DI container
- [Orchestration System](./docsV2/architecture/orchestration-system.md) - Application orchestration
- [Optimized Router](./docsV2/architecture/optimized-router-deep-dive.md) - Router internals

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
