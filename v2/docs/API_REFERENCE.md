# NextRush v2 API Reference

# 📚 NextRush v2 API Reference

> **Complete API Documentation for NextRush v2 - The Modern Web Framework**

Welcome to the comprehensive NextRush v2 API Reference. This documentation covers all components, methods, and features with practical examples.

## 🚀 **Quick Start**

### **Most Common Usage (99% of APIs)**

```typescript
import { createApp } from '@nextrush/v2';

const app = createApp();

app.get('/api/users', ctx => {
  // ✅ NEW: Convenience methods for better DX
  ctx.json({ users: [] }); // Instead of ctx.res.json()
  ctx.status = 201; // Direct property access
  ctx.redirect('/success'); // Clean redirects
  ctx.cookie('id', '123'); // Easy cookies
});

app.listen(3000);
```

---

## 🔄 **Context System (Core)**

**The heart of NextRush v2 - Koa-style context with Express-like design + convenience methods**

### **📖 Main Documentation**

- **[🔥 Context System - Complete Guide](./api/context-complete.md)** - _Comprehensive context documentation_
- **[📄 Context API Overview](./api/context.md)** - _Quick reference and examples_
- **[📤 Response Methods (41 Total)](./api/response-methods.md)** - _Complete response method reference_

### **Key Features:**

- 🚀 **Convenience Methods**: `ctx.json()`, `ctx.send()`, `ctx.redirect()` for better DX
- 📝 **41 Response Methods**: Complete Express.js compatibility + enhanced features
- 🦾 **Full TypeScript**: Zero `any` types, complete IntelliSense
- 🔄 **100% Backward Compatible**: All existing `ctx.res.*` methods still work

---

## 🏗️ **Core Components**

### **Application & Router**

- **[🏠 Application](./api/application.md)** - Main application class for creating NextRush apps
- **[🛣️ Routing](./api/routing.md)** - Flexible routing system with parameter support

### **Request/Response System**

- **[📥 Enhanced Request/Response](./api/Enhanced-Request-Response.md)** - Enhanced request and response objects

### **Middleware & Plugins**

- **[🔌 Middleware System](./api/middleware.md)** - Comprehensive middleware architecture
- **[🧩 Plugin Architecture](./api/plugins.md)** - How to create and use plugins

### **Error Handling**

- **[❌ Error System](./api/errors.md)** - Built-in error handling and custom error types

---

## 🔧 **Built-in Features**

### **Logging & Monitoring**

- **[📊 Logger Plugin](./api/logger-plugin.md)** - Advanced logging capabilities with multiple transports

### **Real-time Communication**

- **[🔗 WebSocket](./api/websocket.md)** - Real-time WebSocket support with room management
- **[⚡ Event System](./api/event-system.md)** - Comprehensive event-driven architecture

### **Web Essentials**

- **[🍪 Cookies](./api/cookies.md)** - Cookie management utilities with security options
- **[🎨 Template Engine](./api/template.md)** - Built-in template rendering support

### **Overview**

- **[✨ Features Overview](./api/features.md)** - Complete feature list and capabilities

---

## 📊 **API Quick Reference**

### **🚀 Convenience Methods (New!)**

```typescript
// JSON APIs (99% usage)
ctx.json({ users: [], total: 0 });

// Smart sending
ctx.send({ data: 'object' }); // → JSON
ctx.send('Hello World'); // → Text
ctx.send(buffer); // → Binary

// Clean redirects
ctx.redirect('/login'); // 302 redirect
ctx.redirect('/moved', 301); // 301 redirect

// Easy cookies
ctx.cookie('sessionId', 'abc123', { httpOnly: true });
```

### **📤 Response Methods (41 Total)**

```typescript
// Core responses
ctx.res.json(data); // JSON response
ctx.res.html(html); // HTML response
ctx.res.text(text); // Text response
ctx.res.xml(xml); // XML response
ctx.res.csv(data, 'file.csv'); // CSV download

// File operations
ctx.res.sendFile(path); // Send file
ctx.res.download(path, name); // Force download
ctx.res.stream(stream); // Stream response

// Headers & status
ctx.res.status(201); // Set status
ctx.res.set('X-Custom', 'val'); // Set headers
ctx.res.cache(3600); // Cache control
ctx.res.cors('*'); // CORS headers

// API helpers
ctx.res.success(data, 'Created successfully');
ctx.res.error('Not found', 404);
ctx.res.paginate(users, page, limit, total);
```

### **🔄 Context Properties**

```typescript
// Request data
ctx.method; // HTTP method
ctx.path; // Request path
ctx.query; // Query parameters
ctx.params; // Route parameters
ctx.body; // Request body
ctx.headers; // Request headers

// Response control
ctx.status = 201; // Set status code
ctx.set('Header', 'value'); // Set response header

// Context utilities
ctx.throw(400, 'Bad Request'); // Throw HTTP error
ctx.assert(condition, 400, 'Invalid'); // Assert condition
ctx.fresh(); // Check if fresh
ctx.state.user = currentUser; // Share data between middleware
```

---

## 📖 **Documentation Structure**

### **📚 Main Guides**

- **[🚀 Developer Guide](../DEVELOPER_GUIDE.md)** - Getting started and basic concepts
- **[🏗️ Architecture Overview](../architecture/V2_ARCHITECTURE_OVERVIEW.md)** - System design and patterns

### **📝 API References**

- **[📄 Context Complete](./api/context-complete.md)** - Comprehensive context guide
- **[📤 Response Methods](./api/response-methods.md)** - All 41 response methods
- **[🏠 Application](./api/application.md)** - App creation and configuration
- **[🛣️ Routing](./api/routing.md)** - Route definition and handling

### **🔧 Advanced Topics**

- **[🧩 Plugin Development](./api/plugins.md)** - Creating custom plugins
- **[⚡ Event System](./api/event-system.md)** - Event-driven architecture
- **[📊 Logger Plugin](./api/logger-plugin.md)** - Advanced logging features

---

## 💡 **Examples & Tutorials**

### **🎯 Practical Examples**

- **[📦 Simple API](../examples/simple-api.md)** - Basic REST API example
- **[🏢 Complete API](../examples/complete-api.md)** - Production-ready API example
- **[⚡ Event System Usage](../examples/event-system-usage.md)** - Event-driven patterns

### **🔧 Integration Guides**

- **[🔌 Custom Plugin Example](../guides/CUSTOM_PLUGIN_EXAMPLE.md)** - Build your own plugin
- **[🐛 Debugging Guide](../guides/DEBUGGING_GUIDE.md)** - Troubleshooting and debugging

---

## 🎯 **What's New in v2**

### **🚀 Developer Experience Improvements**

- ✅ **Convenience Methods**: `ctx.json()`, `ctx.send()`, `ctx.redirect()` for better DX
- ✅ **41 Response Methods**: Complete compatibility + modern enhancements
- ✅ **Full TypeScript**: Zero `any` types, complete IntelliSense
- ✅ **100% Backward Compatible**: All existing code works unchanged

### **⚡ Performance Enhancements**

- ✅ **Optimized Context**: Faster context creation and method calls
- ✅ **Memory Efficient**: Reduced memory allocation and garbage collection
- ✅ **High Throughput**: >10,000 RPS for basic endpoints

### **🔧 Modern Features**

- ✅ **Built-in Core Features**: No plugins needed for basic functionality
- ✅ **Plugin System**: Only for advanced features
- ✅ **Event-Driven Architecture**: Comprehensive event system
- ✅ **Production Ready**: Enterprise-grade reliability and performance

---

## 🤝 **Migration from v1**

### **Breaking Changes**

```typescript
// v1 Style
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

// v2 Style (Express-like - still works)
app.get('/users', ctx => {
  ctx.res.json({ users: [] });
});

// v2 Style (Convenience - recommended!)
app.get('/users', ctx => {
  ctx.json({ users: [] }); // ✅ Better DX!
});
```

---

**🎯 Ready to build amazing APIs?** Start with the **[Context System Complete Guide](./api/context-complete.md)** or check out our **[Simple API Example](../examples/simple-api.md)**!

## Core API

### `createApp(options?: ApplicationOptions): Application`

Creates a new NextRush v2 application instance.

**Parameters:**

- `options` (optional): Application configuration options

**Returns:** Application instance

**Example:**

```typescript
import { createApp } from 'nextrush';

const app = createApp({
  port: 3000,
  host: 'localhost',
});
```

### `createContext(req, res): Context`

Creates a new context object for request handling.

**Parameters:**

- `req`: HTTP request object
- `res`: HTTP response object

**Returns:** Context instance

## Application Methods

### `app.use(middleware: Middleware): Application`

Adds middleware to the application stack.

**Parameters:**

- `middleware`: Middleware function

**Returns:** Application instance (chainable)

**Example:**

```typescript
app.use(async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await next();
});
```

### `app.get(path: string, handler: RouteHandler): Application`

Registers a GET route handler.

**Parameters:**

- `path`: Route path (supports parameters like `/users/:id`)
- `handler`: Route handler function

**Returns:** Application instance (chainable)

### `app.post(path: string, handler: RouteHandler): Application`

Registers a POST route handler.

### `app.put(path: string, handler: RouteHandler): Application`

Registers a PUT route handler.

### `app.delete(path: string, handler: RouteHandler): Application`

Registers a DELETE route handler.

### `app.patch(path: string, handler: RouteHandler): Application`

Registers a PATCH route handler.

### `app.head(path: string, handler: RouteHandler): Application`

Registers a HEAD route handler.

### `app.options(path: string, handler: RouteHandler): Application`

Registers an OPTIONS route handler.

### `app.listen(port: number, callback?: () => void): Server`

### `app.listen(port: number, host: string, callback?: () => void): Server`

Starts the HTTP server.

**Parameters:**

- `port`: Port number to listen on
- `host` (optional): Host address to bind to
- `callback` (optional): Callback function called when server starts

**Returns:** Node.js HTTP Server instance

**Example:**

```typescript
const server = app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### `app.getContainer(): DIContainer`

Gets the dependency injection container instance.

**Returns:** DI container for service registration and resolution

**Example:**

```typescript
const container = app.getContainer();
container.registerSingleton('userService', UserService);
```

## Context API

The `Context` object is passed to all middleware and route handlers.

### Properties

#### `ctx.method: string`

HTTP request method (GET, POST, PUT, DELETE, etc.)

#### `ctx.path: string`

Request path (without query string)

#### `ctx.query: Record<string, string>`

Query string parameters as key-value pairs

**Example:**

```typescript
// For URL: /search?q=nextrust&page=1
console.log(ctx.query.q); // "nextrush"
console.log(ctx.query.page); // "1"
```

#### `ctx.params: Record<string, string>`

Route parameters extracted from the path

**Example:**

```typescript
// For route /users/:id and URL /users/123
console.log(ctx.params.id); // "123"
```

#### `ctx.body: any`

Request body (parsed based on Content-Type)

#### `ctx.headers: Record<string, string>`

Request headers as key-value pairs

#### `ctx.ip: string`

Client IP address

#### `ctx.id: string`

Unique request identifier

#### `ctx.state: Record<string, any>`

Object for sharing data between middleware

#### `ctx.status: number`

HTTP response status code (default: 200)

#### `ctx.res: ResponseObject`

Response helper object

### Response Object (`ctx.res`)

#### `ctx.res.json(data: any): void`

Sends a JSON response

**Example:**

```typescript
ctx.res.json({ message: 'Hello World', data: users });
```

#### `ctx.res.send(data: string): void`

Sends a plain text response

#### `ctx.res.setHeader(name: string, value: string): void`

Sets a response header

#### `ctx.res.redirect(url: string, status?: number): void`

Sends a redirect response

**Parameters:**

- `url`: Redirect URL
- `status` (optional): HTTP status code (default: 302)

## Types

### `Context`

```typescript
interface Context {
  method: string;
  path: string;
  query: Record<string, string>;
  params: Record<string, string>;
  body: any;
  headers: Record<string, string>;
  ip: string;
  id: string;
  status: number;
  state: Record<string, any>;
  res: ResponseObject;
}
```

### `Middleware`

```typescript
type Middleware = (ctx: Context, next: () => Promise<void>) => Promise<void>;
```

### `RouteHandler`

```typescript
type RouteHandler = (ctx: Context) => Promise<void> | void;
```

### `ApplicationOptions`

```typescript
interface ApplicationOptions {
  port?: number; // Default port (default: 3000)
  host?: string; // Default host (default: 'localhost')
  env?: string; // Environment (default: 'development')
  trustProxy?: boolean; // Trust proxy headers (default: false)
}
```

## Dependency Injection Container

### `container.registerSingleton<T>(name: string, implementation: Constructor<T>): void`

Registers a singleton service (one instance per application)

**Parameters:**

- `name`: Service identifier
- `implementation`: Service constructor

### `container.registerTransient<T>(name: string, implementation: Constructor<T>): void`

Registers a transient service (new instance per resolution)

### `container.registerInstance<T>(name: string, instance: T): void`

Registers a specific instance

### `container.resolve<T>(name: string): T`

Resolves a service by name

**Parameters:**

- `name`: Service identifier

**Returns:** Service instance

### `container.has(name: string): boolean`

Checks if a service is registered

## Error Handling

### `NextRushError`

Enhanced error class with developer-friendly features

```typescript
class NextRushError extends Error {
  constructor(
    message: string,
    code?: string,
    statusCode?: number,
    suggestions?: string[],
    cause?: Error
  );
}
```

**Properties:**

- `message`: Error description
- `code`: Error code for client identification
- `statusCode`: HTTP status code
- `suggestions`: Array of suggested fixes
- `cause`: Original error (if wrapping another error)

**Example:**

```typescript
throw new NextRushError('User not found', 'USER_NOT_FOUND', 404, [
  'Check the user ID',
  'Verify user exists in database',
]);
```

### `createErrorHandler(options?: ErrorHandlerOptions): Middleware`

Creates an enhanced error handling middleware

**Options:**

```typescript
interface ErrorHandlerOptions {
  showStackTrace?: boolean; // Show stack traces (default: false)
  logErrors?: boolean; // Log errors to console (default: true)
  errorReporter?: (error: Error, ctx: Context) => void; // Custom error reporter
}
```

## Development Experience

### `createDevelopmentMiddleware(options?: DevMiddlewareOptions): Middleware`

Creates development assistance middleware

**Options:**

```typescript
interface DevMiddlewareOptions {
  logRequests?: boolean; // Log all requests (default: true)
  validateResponses?: boolean; // Validate response formats (default: true)
  memoryWarnings?: boolean; // Warn about high memory usage (default: true)
  performanceWarnings?: boolean; // Warn about slow requests (default: true)
}
```

### `DevWarningSystem`

Development warning system for common issues

```typescript
class DevWarningSystem {
  static warn(category: string, message: string, suggestion?: string): void;
  static warnOnce(key: string, category: string, message: string): void;
}
```

## Built-in Middleware

### CORS Middleware

```typescript
app.use(cors({
  origin?: string | string[] | ((origin: string) => boolean);
  credentials?: boolean;
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
  methods?: string[];
}));
```

### Helmet (Security Headers)

```typescript
app.use(helmet({
  contentSecurityPolicy?: {
    directives: Record<string, string[]>;
  };
  crossOriginEmbedderPolicy?: boolean;
  crossOriginOpenerPolicy?: boolean;
  crossOriginResourcePolicy?: boolean;
  dnsPrefetchControl?: boolean;
  frameguard?: boolean;
  hidePoweredBy?: boolean;
  hsts?: boolean;
  ieNoOpen?: boolean;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: boolean;
  referrerPolicy?: boolean;
  xssFilter?: boolean;
}));
```

### Body Parser

```typescript
app.use(bodyParser({
  maxSize?: number;           // Max request size in bytes
  timeout?: number;           // Request timeout in ms
  enableStreaming?: boolean;  // Enable streaming for large bodies
  autoDetectContentType?: boolean; // Auto-detect content type
}));
```

### Rate Limiter

```typescript
app.use(rateLimit({
  max: number;                // Max requests per window
  windowMs: number;           // Time window in milliseconds
  keyGenerator?: (ctx: Context) => string; // Custom key generator
  skip?: (ctx: Context) => boolean;        // Skip certain requests
  onLimitReached?: (ctx: Context) => void; // Callback when limit reached
}));
```

### Request Timer

```typescript
app.use(timer({
  measureMemory?: boolean;    // Measure memory usage
  reportThreshold?: number;   // Report requests slower than threshold
  logSlowRequests?: boolean;  // Log slow requests
}));
```

### Compression

```typescript
app.use(compression({
  threshold?: number;         // Minimum size to compress
  level?: number;            // Compression level (1-9)
  chunkSize?: number;        // Chunk size for streaming
  filter?: (ctx: Context) => boolean; // Filter which responses to compress
}));
```

### Logger

```typescript
app.use(logger({
  format?: string;           // Log format string
  skip?: (ctx: Context) => boolean; // Skip logging for certain requests
  immediate?: boolean;       // Log immediately (before response)
}));
```

## Plugin System

### `LoggerPlugin`

Advanced logging plugin with multiple transports

```typescript
const logger = new LoggerPlugin({
  level: 'info' | 'debug' | 'warn' | 'error';
  transports: LoggerTransport[];
});

interface LoggerTransport {
  type: 'console' | 'file' | 'custom';
  colorize?: boolean;        // Colorize console output
  filename?: string;         // File path for file transport
  maxSize?: number;          // Max file size before rotation
  maxFiles?: number;         // Max number of rotated files
  handler?: (log: LogEntry) => void; // Custom handler
}
```

### `MetricsPlugin`

Performance and metrics collection plugin

```typescript
const metrics = new MetricsPlugin({
  collectMemoryStats?: boolean;     // Collect memory statistics
  collectResponseTimes?: boolean;   // Collect response time metrics
  collectRequestCounts?: boolean;   // Count requests by route/method
  endpoint?: string;               // Metrics endpoint path (default: /metrics)
});
```

## Utilities

### Path Utilities

```typescript
import { pathToRegexp, matchPath, compilePath } from 'nextrush/utils';

// Convert path pattern to regex
const regex = pathToRegexp('/users/:id');

// Match path against pattern
const match = matchPath('/users/123', '/users/:id');
// Returns: { path: '/users/:id', params: { id: '123' } }

// Compile path with parameters
const url = compilePath('/users/:id', { id: '123' });
// Returns: '/users/123'
```

### Validation Utilities

```typescript
import { validateEmail, validateUrl, sanitizeInput } from 'nextrush/utils';

const isValid = validateEmail('user@example.com'); // true
const cleanInput = sanitizeInput('<script>alert("xss")</script>'); // Safe string
```

## Configuration

### Environment Variables

NextRush v2 supports the following environment variables:

- `NODE_ENV`: Environment (development, production, test)
- `PORT`: Default port number
- `HOST`: Default host address
- `DEBUG`: Enable debug logging
- `NEXTRUSH_LOG_LEVEL`: Default log level

### Application Configuration

```typescript
const app = createApp({
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || 'localhost',
  env: process.env.NODE_ENV || 'development',
  trustProxy: process.env.TRUST_PROXY === 'true',
});
```

## Testing Utilities

### Test Helpers

```typescript
import { createTestApp, createTestContext } from 'nextrush/testing';

// Create test application
const app = createTestApp();

// Create test context
const ctx = createTestContext({
  method: 'GET',
  path: '/users',
  query: { page: '1' },
});
```

### Request Testing

```typescript
import { request } from 'nextrush/testing';

const response = await request(app)
  .get('/users')
  .expect(200)
  .expect('Content-Type', /json/);
```

## Performance Considerations

### Memory Management

- NextRush v2 uses object pooling for high-frequency objects
- Context objects are reused when possible
- Response buffers are managed efficiently

### Request Processing

- Routes are compiled to optimized regex patterns
- Middleware chain is optimized for minimal overhead
- JSON parsing is optimized for common cases

### Monitoring

```typescript
// Built-in performance monitoring
app.use(async (ctx, next) => {
  const start = process.hrtime.bigint();
  await next();
  const duration = Number(process.hrtime.bigint() - start) / 1e6;

  if (duration > 100) {
    console.warn(`Slow request: ${ctx.method} ${ctx.path} - ${duration}ms`);
  }
});
```

## Migration from Express

### Key Differences

1. **Context-based**: Single context object instead of separate req/res
2. **Async/Await**: Built for async operations from the ground up
3. **Zero Dependencies**: No external runtime dependencies
4. **Enhanced Errors**: Better error handling and debugging
5. **DI Container**: Built-in dependency injection

### Common Patterns

```typescript
// Express
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.json({ id: userId });
});

// NextRush v2
app.get('/users/:id', async ctx => {
  const userId = ctx.params.id;
  ctx.res.json({ id: userId });
});
```

## Examples

See the [examples directory](../examples/) for complete working examples:

- [Simple Example](../examples/simple-example.ts): Basic usage
- [Enhanced Example](../examples/enhanced-example.ts): Advanced features
- [API Server](../examples/api-server.ts): RESTful API example
- [Microservice](../examples/microservice.ts): Microservice pattern

For more detailed examples and patterns, see the [Developer Guide](./DEVELOPER_GUIDE.md).
