# NextRush v2

> A modern, type-safe, and high-performance Node.js web framework with Express-like API and Koa-style async middleware

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0.0--alpha.1-orange.svg)](package.json)

NextRush v2 combines the best of Express.js and Koa to provide an intuitive, type-safe, and high-performance web framework for Node.js applications.

## ✨ Features

- **🚀 Express-like API**: Familiar `ctx.req`, `ctx.res`, `ctx.body` design
- **⚡ Koa-style Async Middleware**: Powerful async middleware for performance
- **� WebSocket Support**: RFC 6455-compliant WebSocket server with zero dependencies
- **🏠 Room Management**: Built-in room-based broadcasting for real-time apps
- **�🔧 Modular Router System**: Organize routes with `app.router()` and `createRouter()`
- **📝 Object-Based Routes**: Fastify-style route configuration without imports
- **🛡️ Type Safety**: Full TypeScript support with automatic type inference
- **🎯 Enhanced Response Methods**: `ctx.res.json()`, `ctx.res.html()`, `ctx.res.csv()`, etc.
- **🔥 Enhanced Body Parser**: Zero-copy buffer operations with intelligent content-type detection
- **🔒 Zero Dependencies**: Built on Node.js native APIs
- **⚙️ Flexible Configuration**: Easy setup with sensible defaults

## 🚀 Quick Start

### Installation

```bash
npm install nextrush-v2
# or
pnpm add nextrush-v2
# or
yarn add nextrush-v2
```

### Basic Usage

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp({
  port: 3000,
  debug: true,
  cors: true,
});

// Express-like middleware
app.use(async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await next();
});

// Simple routes with Express-like design
app.get('/hello', async ctx => {
  ctx.res.json({ message: 'Hello, World!' });
});

app.post('/users', async ctx => {
  const { name, email } = ctx.body as { name?: string; email?: string };
  ctx.res.json({ message: 'User created', name, email });
});

// Object-based route config
app.post('/users', {
  handler: async ctx => {
    const { name, email } = ctx.body as { name?: string; email?: string };
    ctx.res.json({ message: 'User created', name, email });
  },
  schema: {
    body: {
      name: { type: 'string', required: true, minLength: 2 },
      email: { type: 'email', required: true },
    },
  },
  options: {
    name: 'createUser',
    description: 'Create a new user',
    tags: ['users'],
  },
});

app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
```

## 📚 Advanced Usage

### Modular Routing

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp();

// Create user router
const userRouter = app.router();

userRouter.get('/profile', async ctx => {
  ctx.res.json({ user: 'profile' });
});

userRouter.post('/login', async ctx => {
  const { email, password } = ctx.body;
  ctx.res.json({ message: 'Logged in' });
});

// Create admin router
const adminRouter = app.router();

adminRouter.get('/dashboard', async ctx => {
  ctx.res.json({ admin: 'dashboard' });
});

adminRouter.get('/users', async ctx => {
  ctx.res.json({ admin: 'users list' });
});

// Mount routers
app.use('/users', userRouter);
app.use('/admin', adminRouter);
```

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
```

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

See [Enhanced Body Parser Guide](./docs/guides/enhanced-body-parser.md) for detailed documentation.

## 📚 Documentation

- [Express-like Design](./docs/Express-like-Design.md) - Learn about the Express-like API
- [Router System](./docs/Router-System.md) - Modular routing guide
- [Enhanced Body Parser](./docs/guides/enhanced-body-parser.md) - Enterprise-grade body parsing
- [Migration Guide](./docs/guides/migration.md) - Migrate from v1 to v2

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
