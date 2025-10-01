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

NextRush v2 is the **next evolution** of Node.js web frameworks, combining the best ideas from Express, Koa, and Fastify into one powerful, type-safe framework.

### 🏆 **Three Frameworks in One**

| **Convenience** | **Koa-style Enhanced** | **Fastify-inspired**   |
| --------------- | ---------------------- | ---------------------- |
| `ctx.json()`    | `ctx.res.json()`       | `{ handler, schema }`  |
| Clean & simple  | Express-like helpers   | Advanced configuration |
| Recommended     | Familiar syntax        | Type validation        |

### ⚡ **Performance That Scales**

- **🧠 Zero Dependencies** - Minimal footprint, maximum speed
- **⚡ Smart Body Parser** - Intelligent parsing with lazy loading
- **🚀 Optimized Router** - Lightning-fast route matching with O(1) static path lookup
- **💾 Memory Efficient** - Built for production workloads (~60KB optimization overhead)
- **⚡ Pre-compiled Routes** - Production mode pre-compiles middleware chains

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
- **Hot Reload** - Development experience (upcoming)

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

---

## 🔧 **Configuration**

### **Application Options**

```typescript
const app = createApp({
  port: 3000, // Port to listen on
  host: 'localhost', // Host to bind to
  debug: true, // Enable debug mode
  trustProxy: false, // Trust proxy headers
  maxBodySize: 1024 * 1024, // Max body size (1MB)
  timeout: 30000, // Request timeout (30s)
  cors: true, // Enable CORS
  static: 'public', // Static files directory
  template: {
    engine: 'simple',
    directory: 'views',
  },
});
```

### **Body Parser Configuration**

```typescript
// Smart body parser with auto-detection
app.use(
  app.smartBodyParser({
    maxSize: 10 * 1024 * 1024, // 10MB
    timeout: 30000, // 30 seconds
    enableStreaming: true,
    autoDetectContentType: true,
    enableMetrics: true,
  })
);
```

---

## 📖 **API Reference**

### **Context Object**

```typescript
// Request properties
ctx.req        // HTTP request object
ctx.res        // Enhanced response object
ctx.body       // Request body (parsed)
ctx.method     // Request method
ctx.path       // Request path
ctx.url        // Request URL
ctx.query      // Query parameters
ctx.headers    // Request headers
ctx.params     // Route parameters
ctx.ip         // Client IP address
ctx.secure     // Is HTTPS?
ctx.protocol   // Request protocol

// Response methods
ctx.json(data, status?)           // Send JSON
ctx.html(data)                     // Send HTML
ctx.text(data)                     // Send text
ctx.csv(data)                      // Send CSV
ctx.file(path, options?)           // Send file
ctx.redirect(url, status?)         // Redirect
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

## 🎮 **Examples & Playground**

The `playground/` directory contains production-ready examples:

```bash
# WebSocket echo server
node playground/websocket-test.js

# Full-featured chat with rooms
node playground/websocket-chat-demo.js

# Battle-tested WebSocket scenarios
./playground/websocket-battle-test.sh
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

## 📚 Documentation

Comprehensive documentation with guides, API references, and architecture deep-dives:

**🚀 Quick Start**

- [Getting Started Guide](./docs/guides/getting-started.md) - Your first NextRush v2 app
- [Migration Guide](./docs/guides/migration-guide.md) - Migrate from Express/Fastify

**📖 Essential Guides**

- [Routing Guide](./docs/api/routing.md) - All three routing styles explained
- [Middleware Development](./docs/guides/middleware-development.md) - Create custom middleware
- [Plugin Development](./docs/guides/plugin-development.md) - Build powerful plugins
- [Error Handling](./docs/guides/error-handling.md) - Robust error management
- [Testing Guide](./docs/guides/testing-guide.md) - Test your applications
- [Production Deployment](./docs/guides/production-deployment.md) - Deploy to production

**🔧 API Reference**

- [Application API](./docs/api/application.md) - Core application methods
- [Context API](./docs/api/context.md) - Request/response context
- [Middleware API](./docs/api/middleware.md) - Middleware system
- [Built-in Middleware](./docs/api/built-in-middleware.md) - Body parser, CORS, etc.
- [Events API](./docs/api/events.md) - Event system
- [Enhanced Request/Response](./docs/api/enhancers.md) - Enhanced req/res objects

**🔌 Plugin APIs**

- [Logger Plugin](./docs/api/logger-plugin.md) - Advanced logging
- [WebSocket Plugin](./docs/api/websocket-plugin.md) - Real-time communication
- [Static Files Plugin](./docs/api/static-files-plugin.md) - Serve static assets
- [Template Plugin](./docs/api/template-plugin.md) - Template rendering

**🏗️ Architecture**

- [Plugin System](./docs/architecture/plugin-system.md) - Plugin architecture
- [Dependency Injection](./docs/architecture/dependency-injection.md) - DI container
- [Orchestration System](./docs/architecture/orchestration-system.md) - Application orchestration
- [Optimized Router](./docs/architecture/optimized-router-deep-dive.md) - Router internals

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
