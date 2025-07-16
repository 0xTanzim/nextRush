# 📚 NextRush API Reference

## Complete API Documentation

### Table of Contents

- [Application Class](#application-class)
- [Request Object](#request-object)
- [Response Object](#response-object)
- [Template Engine](#template-engine)
- [Static File Serving](#static-file-serving)
- [WebSocket Support](#websocket-support)
- [Event System](#event-system)
- [Middleware](#middleware)
- [Error Handling](#error-handling)

### `createApp(options?: ApplicationOptions)`

Creates a new NextRush application instance.

```javascript
const { createApp } = require('nextrush');

const app = createApp({
  timeout: 30000,
  maxRequestSize: 1024 * 1024,
});
```

**Options:**

- `timeout`: Request timeout in milliseconds (default: 30000)
- `maxRequestSize`: Maximum request size in bytes (default: 1MB)

---

## Event System API

### Event Emitter Methods

#### `app.on(event: string, listener: Function)`

Register an event listener.

```javascript
app.on('request:start', (data) => {
  console.log(`Request: ${data.method} ${data.url}`);
});
```

#### `app.off(event: string, listener: Function)`

Remove an event listener.

#### `app.emit(event: string, ...args: any[])`

Emit a custom event.

### Event Data Structures

#### `RequestEventData`

```typescript
{
  id: string;
  method: string;
  url: string;
  timestamp: number;
  userAgent?: string;
  ip?: string;
}
```

#### `ResponseEventData`

```typescript
{
  id: string;
  method: string;
  url: string;
  timestamp: number;
  statusCode: number;
  duration: number;
  size?: number;
  userAgent?: string;
  ip?: string;
}
```

#### `PerformanceEventData`

```typescript
{
  activeRequests: number;
  totalRequests: number;
  averageResponseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
}
```

---

## Middleware API

### Built-in Middleware

#### `cors(options?: CorsOptions)`

Enable CORS with configurable options.

```javascript
const { cors } = require('nextrush');

app.use(
  cors({
    origin: 'https://example.com',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  })
);
```

#### `helmet(options?: HelmetOptions)`

Security middleware with configurable options.

```javascript
const { helmet } = require('nextrush');

app.use(
  helmet({
    contentSecurityPolicy: true,
    hsts: true,
  })
);
```

#### `compression(options?: CompressionOptions)`

Response compression middleware.

```javascript
const { compression } = require('nextrush');

app.use(
  compression({
    threshold: 1024,
    level: 6,
  })
);
```

#### `rateLimit(options: RateLimitOptions)`

Rate limiting middleware.

```javascript
const { rateLimit } = require('nextrush');

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests',
  })
);
```

### Middleware Composition

#### `compose(...middleware: Middleware[])`

Compose multiple middleware into a single middleware function.

```javascript
const { compose } = require('nextrush');

const authFlow = compose(validateApiKey, checkPermissions, auditLog);

app.use('/protected', authFlow);
```

#### `when(condition: Function, middleware: Middleware)`

Conditionally apply middleware.

```javascript
const { when } = require('nextrush');

const apiMiddleware = when(
  (req) => req.path.startsWith('/api'),
  rateLimit({ max: 100 })
);

app.use(apiMiddleware);
```

### Middleware Presets

#### `app.usePreset(name: string, options?: object)`

Apply a preset collection of middleware.

**Available Presets:**

##### `'production'`

- CORS with secure defaults
- Helmet security headers
- Compression
- Rate limiting
- Request logging

##### `'development'`

- Detailed request logging
- Error stack traces
- Development-friendly CORS

##### `'security'`

- Strict CORS policy
- Full Helmet protection
- Aggressive rate limiting

##### `'api'`

- API-focused CORS
- JSON parsing
- Rate limiting
- Request/response logging

```javascript
// Apply production preset
app.usePreset('production', {
  cors: { origin: 'https://mydomain.com' },
  rateLimit: { max: 1000 },
});
```

---

## Routing API

### HTTP Method Handlers

#### `app.get(path, ...handlers)`

#### `app.post(path, ...handlers)`

#### `app.put(path, ...handlers)`

#### `app.delete(path, ...handlers)`

#### `app.patch(path, ...handlers)`

#### `app.head(path, ...handlers)`

#### `app.options(path, ...handlers)`

Register route handlers for specific HTTP methods.

```javascript
// Single handler
app.get('/users', getUsersHandler);

// Multiple middleware + handler
app.post('/users', authMiddleware, validationMiddleware, createUserHandler);
```

### Route Groups

#### `app.group(path: string, middleware: Middleware[], callback: Function)`

Create a group of routes with shared middleware.

```javascript
app.group('/api/v1', [authMiddleware, rateLimitMiddleware], (router) => {
  router.get('/users', getUsersHandler);
  router.post('/users', createUserHandler);
  router.put('/users/:id', updateUserHandler);
});
```

### Sub-routers

#### `createRouter(options?: RouterOptions)`

Create a sub-router for organizing routes.

```javascript
const { createRouter } = require('nextrush');

const userRouter = createRouter();
userRouter.get('/', getAllUsers);
userRouter.get('/:id', getUser);

app.use('/users', userRouter);
```

---

## Request API

### Properties

#### `req.method: string`

HTTP method (GET, POST, etc.)

#### `req.url: string`

Full request URL

#### `req.path: string`

URL pathname

#### `req.query: object`

Parsed query parameters

#### `req.params: object`

Route parameters

#### `req.body: any`

Parsed request body

#### `req.headers: object`

Request headers

### Methods

#### `req.get(name: string): string | undefined`

#### `req.header(name: string): string | undefined`

Get header value by name (case-insensitive).

```javascript
const userAgent = req.get('user-agent');
const contentType = req.header('content-type');
```

#### `req.param(name: string): string | undefined`

Get route parameter by name.

```javascript
// Route: /users/:id
const userId = req.param('id');
```

---

## Response API

### Methods

#### `res.json(data: any): void`

Send JSON response.

```javascript
res.json({ message: 'Success', data: users });
```

#### `res.text(text: string): void`

Send plain text response.

```javascript
res.text('Hello World');
```

#### `res.html(html: string): void`

Send HTML response.

```javascript
res.html('<h1>Welcome</h1>');
```

#### `res.status(code: number): Response`

Set response status code (chainable).

```javascript
res.status(201).json({ created: true });
```

#### `res.redirect(url: string, status?: number): void`

Redirect to another URL.

```javascript
res.redirect('/login');
res.redirect(301, '/new-location');
```

#### `res.sendFile(path: string): void`

Send a file as response.

```javascript
res.sendFile('./files/document.pdf');
```

#### `res.download(path: string, filename?: string): void`

Send file as download.

```javascript
res.download('./files/data.csv', 'export.csv');
```

#### `res.cookie(name: string, value: string, options?: object): Response`

Set response cookie (chainable).

```javascript
res.cookie('sessionId', '123', {
  httpOnly: true,
  secure: true,
  maxAge: 3600000,
});
```

#### `res.set(name: string, value: string): Response`

#### `res.header(name: string, value: string): Response`

Set response header (chainable).

```javascript
res.set('Cache-Control', 'no-cache').set('X-Custom-Header', 'value');
```

---

## File Operations API

### Static File Serving

#### `app.static(mountPath: string, directory: string, options?: StaticOptions)`

Serve static files from a directory.

```javascript
app.static('/public', './public-files', {
  maxAge: '1d',
  etag: true,
  index: ['index.html'],
  dotfiles: 'ignore',
});
```

**Options:**

- `maxAge`: Cache duration
- `etag`: Enable ETag headers
- `index`: Index file names
- `dotfiles`: How to handle dotfiles ('allow', 'deny', 'ignore')
- `immutable`: Mark files as immutable
- `redirect`: Redirect trailing slashes

---

## Error Handling API

### Error Events

Listen for error events to implement custom error handling:

```javascript
app.on('error', (data) => {
  console.error(`Error in ${data.method} ${data.url}:`, data.error.message);

  // Send to error tracking service
  errorService.capture(data.error, {
    requestId: data.id,
    url: data.url,
    method: data.method,
    userAgent: data.userAgent,
    ip: data.ip,
  });
});
```

### Custom Error Middleware

```javascript
app.use((error, req, res, next) => {
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details,
    });
  }

  res.status(500).json({
    error: 'Internal server error',
  });
});
```

---

## Performance Monitoring API

### Statistics

#### `app.events.getStats(): PerformanceStats`

Get current performance statistics.

```javascript
const stats = app.events.getStats();
console.log({
  activeRequests: stats.activeRequests,
  totalRequests: stats.totalRequests,
  averageResponseTime: stats.averageResponseTime,
  uptime: stats.uptime,
  memoryUsage: stats.memoryUsage,
});
```

### Performance Events

#### `performance:metrics`

Emitted every 30 seconds with current metrics.

#### `performance:slow-request`

Emitted when a request takes longer than 1000ms.

#### `performance:slow-middleware`

Emitted when middleware takes longer than 100ms.

#### `performance:high-load`

Emitted when active requests exceed 50.

#### `performance:memory-warning`

Emitted when memory usage exceeds 100MB.

---

## TypeScript Types

### Application Types

```typescript
interface ApplicationOptions {
  timeout?: number;
  maxRequestSize?: number;
  router?: Router;
  requestHandler?: RequestHandler;
  errorHandler?: ErrorHandler;
}
```

### Request Types

```typescript
interface NextRushRequest extends IncomingMessage {
  params: Record<string, string>;
  query: ParsedUrlQuery;
  body: any;
  pathname: string;
  originalUrl: string;
  path: string;

  param(name: string): string | undefined;
  header(name: string): string | undefined;
  get(name: string): string | undefined;
}
```

### Response Types

```typescript
interface NextRushResponse extends ServerResponse {
  locals: Record<string, any>;

  status(code: number): NextRushResponse;
  json(data: any): void;
  text(text: string): void;
  html(html: string): void;
  redirect(url: string, status?: number): void;
  sendFile(path: string): void;
  download(path: string, filename?: string): void;
  cookie(
    name: string,
    value: string,
    options?: CookieOptions
  ): NextRushResponse;
  set(name: string, value: string): NextRushResponse;
  header(name: string, value: string): NextRushResponse;
}
```

### Middleware Types

```typescript
type MiddlewareHandler = (
  req: NextRushRequest,
  res: NextRushResponse,
  next: () => void
) => void | Promise<void>;

type RouteHandler = (
  req: NextRushRequest,
  res: NextRushResponse
) => void | Promise<void>;
```

---

## Configuration Examples

### Production Configuration

```javascript
const app = createApp({
  timeout: 30000,
  maxRequestSize: 10 * 1024 * 1024, // 10MB
});

// Apply production preset
app.usePreset('production', {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 1000,
  },
});

// Performance monitoring
app.on('performance:slow-request', (data) => {
  logger.warn(`Slow request: ${data.duration}ms`, {
    method: data.method,
    url: data.url,
    requestId: data.id,
  });
});

app.on('error', (data) => {
  logger.error('Request error', {
    error: data.error.message,
    stack: data.error.stack,
    method: data.method,
    url: data.url,
    requestId: data.id,
  });
});
```

### Development Configuration

```javascript
const app = createApp();

// Development preset with detailed logging
app.usePreset('development');

// Custom development logging
app.on('request:start', (data) => {
  console.log(`🚀 ${data.method} ${data.url} [${data.id}]`);
});

app.on('request:end', (data) => {
  const icon = data.statusCode >= 400 ? '❌' : '✅';
  console.log(
    `${icon} ${data.method} ${data.url} - ${data.statusCode} (${data.duration}ms)`
  );
});

app.on('middleware:before', (data) => {
  console.log(`  🔧 ${data.middlewareName} starting`);
});

app.on('middleware:after', (data) => {
  console.log(`  ✅ ${data.middlewareName} completed (${data.duration}ms)`);
});
```

---

This API reference covers all major NextRush features. For more examples, check the documentation and example files.
