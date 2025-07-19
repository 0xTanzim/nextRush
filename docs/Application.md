# 🏗️ Application Class

## 📚 Table of Contents

- [🏗️ Application Class](#️-application-class)
  - [📚 Table of Contents](#-table-of-contents)
  - [📖 Introduction](#-introduction)
  - [🔧 Public APIs](#-public-apis)
    - [📋 Creation Methods](#-creation-methods)
    - [⚙️ Core HTTP Methods](#️-core-http-methods)
    - [🔧 Middleware Management](#-middleware-management)
    - [🛣️ Advanced Routing](#️-advanced-routing)
    - [📁 Static File Serving](#-static-file-serving)
    - [🎨 Template Engine](#-template-engine)
    - [🌐 WebSocket Support](#-websocket-support)
    - [🔌 Plugin System](#-plugin-system)
    - [🔒 Security & Middleware Presets](#-security--middleware-presets)
    - [📦 Body Parsing](#-body-parsing)
    - [⚡ Performance & Monitoring](#-performance--monitoring)
  - [💻 Usage Examples](#-usage-examples)
  - [⚙️ Configuration Options](#️-configuration-options)
  - [📝 Notes](#-notes)

## 📖 Introduction

The `Application` class is the core component of the NextRush framework, providing a comprehensive web application server with Express.js-compatible API and enterprise-grade features. It orchestrates all framework components including routing, middleware, static file serving, template rendering, and plugin management. The Application class follows a plugin-based architecture where features are modularly added through the plugin system, ensuring flexibility and maintainability.

## 🔧 Public APIs

### 📋 Creation Methods

NextRush provides two ways to create applications:

| Method | Signature | Description |
|--------|-----------|-------------|
| `createApp(options?)` | `(options?: ApplicationOptions) => Application` | **Recommended** factory function for creating apps |
| `createApp(options?)` | `(options?: ApplicationOptions) => Application` | Direct class instantiation for advanced use cases |

### ⚙️ Core HTTP Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `get(path, ...handlers)` | `(path: string, ...handlers: RouteHandler[]) => Application` | Register GET route |
| `post(path, ...handlers)` | `(path: string, ...handlers: RouteHandler[]) => Application` | Register POST route |
| `put(path, ...handlers)` | `(path: string, ...handlers: RouteHandler[]) => Application` | Register PUT route |
| `delete(path, ...handlers)` | `(path: string, ...handlers: RouteHandler[]) => Application` | Register DELETE route |
| `patch(path, ...handlers)` | `(path: string, ...handlers: RouteHandler[]) => Application` | Register PATCH route |
| `options(path, ...handlers)` | `(path: string, ...handlers: RouteHandler[]) => Application` | Register OPTIONS route |
| `head(path, ...handlers)` | `(path: string, ...handlers: RouteHandler[]) => Application` | Register HEAD route |

### 🔧 Middleware Management

| Method | Signature | Description |
|--------|-----------|-------------|
| `use(middleware)` | `(middleware: MiddlewareFunction) => Application` | Add global middleware |
| `use(path, middleware)` | `(path: string, middleware: MiddlewareFunction) => Application` | Add path-specific middleware |

### 🛣️ Advanced Routing

| Method | Signature | Description |
|--------|-----------|-------------|
| `route(path)` | `(path: string) => RouteBuilder` | Create route builder for chaining |
| `router()` | `() => Router` | Get internal router instance |

### 📁 Static File Serving

| Method | Signature | Description |
|--------|-----------|-------------|
| `static(route, path, options?)` | `(route: string, path: string, options?: StaticOptions) => Application` | Serve static files |

### 🎨 Template Engine

| Method | Signature | Description |
|--------|-----------|-------------|
| `setViews(path)` | `(path: string) => Application` | Set views directory |
| `setTemplateEngine(engine)` | `(engine: TemplateEngine) => Application` | Set template engine |
| `render(view, data?)` | `(view: string, data?: object) => Promise<string>` | Render template |

### 🌐 WebSocket Support

| Method | Signature | Description |
|--------|-----------|-------------|
| `ws(path, handler)` | `(path: string, handler: WebSocketHandler) => Application` | Add WebSocket route |
| `wsBroadcast(data)` | `(data: any) => void` | Broadcast to all connected clients |

### 🔌 Plugin System

| Method | Signature | Description |
|--------|-----------|-------------|
| `bodyParser(options?)` | `(options?: BodyParserOptions) => Application` | Enable body parsing |
| `cors(options?)` | `(options?: CorsOptions) => Application` | Enable CORS |
| `rateLimit(options?)` | `(options?: RateLimitOptions) => Application` | Enable rate limiting |

### 🔒 Security & Middleware Presets

| Method | Signature | Description |
|--------|-----------|-------------|
| `usePreset(preset)` | `(preset: string) => Application` | Apply middleware preset |

### 📦 Body Parsing

| Method | Signature | Description |
|--------|-----------|-------------|
| `bodyParser(options?)` | `(options?: BodyParserOptions) => Application` | Configure body parsing |

### ⚡ Performance & Monitoring

| Method | Signature | Description |
|--------|-----------|-------------|
| `listen(port, callback?)` | `(port: number, callback?: () => void) => Server` | Start HTTP server |

## 💻 Usage Examples

### Creating Applications

```typescript
import { createApp, Application } from 'nextrush';

// Recommended: Factory function approach
const app = createApp({
  enableWebSocket: true,
  timeout: 5000,
});

// Alternative: Direct class instantiation
const app2 = createApp({
  cors: {
    origin: ['http://localhost:3000'],
    credentials: true
  }
});
```

### Basic HTTP Routing

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Simple routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello NextRush!' });
});

app.post('/users', (req, res) => {
  const userData = req.body;
  res.status(201).json({ user: userData });
});

// Route parameters
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.json({ userId });
});

// Query parameters
app.get('/search', (req, res) => {
  const { q, limit } = req.query;
  res.json({ query: q, limit });
});
```

### Middleware Usage

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Global middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Path-specific middleware
app.use('/api', (req, res, next) => {
  req.apiVersion = 'v1';
  next();
});

// Built-in middleware
app.bodyParser({ limit: '10mb' });
app.cors({
  origin: ['http://localhost:3000'],
  credentials: true
});
app.rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
```

### Static File Serving

```typescript
import { createApp } from 'nextrush';
import path from 'path';

const app = createApp();

// Serve static files
app.static('/public', path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true,
  compression: true
});

// Multiple static directories
app.static('/assets', './assets');
app.static('/uploads', './uploads', {
  index: false,
  dotFiles: 'deny'
});
```

### WebSocket Integration

```typescript
import { createApp } from 'nextrush';

const app = createApp({
  enableWebSocket: true
});

// WebSocket routes
app.ws('/chat', (socket, req) => {
  console.log('New WebSocket connection');
  
  socket.on('message', (data) => {
    console.log('Received:', data.toString());
    // Broadcast to all clients
    app.wsBroadcast(`Echo: ${data}`);
  });
  
  socket.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// HTTP route for chat page
app.get('/chat', (req, res) => {
  res.send(`
    <html>
      <body>
        <script>
          const ws = new WebSocket('ws://localhost:3000/chat');
          ws.onmessage = (event) => console.log(event.data);
        </script>
      </body>
    </html>
  `);
});
```

### Template Rendering

```typescript
import { createApp } from 'nextrush';
import path from 'path';

const app = createApp();

// Set views directory
app.setViews(path.join(__dirname, 'views'));

// Render templates
app.get('/profile/:id', (req, res) => {
  res.render('profile', {
    user: {
      id: req.params.id,
      name: 'John Doe'
    },
    title: 'User Profile'
  });
});

// Async rendering
app.get('/dashboard', async (req, res) => {
  try {
    const html = await app.render('dashboard', {
      user: req.user,
      stats: await getUserStats(req.user.id)
    });
    res.send(html);
  } catch (error) {
    res.status(500).json({ error: 'Template rendering failed' });
  }
});
```

### Advanced Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp({
  // WebSocket configuration
  enableWebSocket: true,
  
  // Request timeout
  timeout: 5000,
  
  // Built-in middleware
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://mydomain.com'] 
      : ['http://localhost:3000'],
    credentials: true
  },
  
  // Body parser settings
  bodyParser: {
    limit: '50mb',
    extended: true
  }
});

// Apply security preset
app.usePreset('production');

// Start server
app.listen(3000, () => {
  console.log('🚀 NextRush server running on http://localhost:3000');
});
```

## ⚙️ Configuration Options

### ApplicationOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enableWebSocket` | `boolean` | `false` | Enable WebSocket support |
| `timeout` | `number` | `30000` | Request timeout in milliseconds |
| `cors` | `CorsOptions` | `undefined` | CORS configuration |
| `bodyParser` | `BodyParserOptions` | `undefined` | Body parser configuration |
| `rateLimit` | `RateLimitOptions` | `undefined` | Rate limiting configuration |
| `static` | `StaticOptions[]` | `[]` | Static file configurations |

### StaticOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxAge` | `string` | `'0'` | Cache control max-age |
| `etag` | `boolean` | `true` | Enable ETag generation |
| `compression` | `boolean` | `false` | Enable gzip compression |
| `index` | `boolean \| string` | `true` | Directory index file |
| `dotFiles` | `'allow' \| 'deny' \| 'ignore'` | `'ignore'` | Dot file handling |

## 📝 Notes

- **Factory Function Recommended**: Use `createApp()` for most use cases as it provides better TypeScript inference and follows modern patterns
- **Express.js Compatibility**: Most Express.js middleware and patterns work unchanged with NextRush
- **Plugin Architecture**: Features are implemented as plugins, ensuring modularity and maintainability
- **TypeScript First**: Full type safety with intelligent autocompletion for all methods and options
- **Zero Dependencies**: Core features require no external dependencies
- **Production Ready**: Built-in security, performance monitoring, and optimization features
- **WebSocket Integration**: Native WebSocket support without additional libraries
- **Flexible Configuration**: Configure at creation time or add features incrementally
- **Middleware Presets**: Use predefined middleware combinations for common scenarios
- **Static File Optimization**: Professional-grade static file serving with caching and compression
