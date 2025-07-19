# 🏗️

The `Application` class is the core component of the NextRush framework, providing a comprehensive web application server with Express.js-compatible API and enterprise-grade features. It orchestrates all framework components including routing, middleware, static file serving, template rendering, and plugin management. The Application class follows a plugin-based architecture where features are modularly added through the plugin system, ensuring flexibility and maintainability.

## 🔧 Public APIss

## 📚 Table of Contents

- [🏗️ Application Class](#️-application-class)
  - [📚 Table of Contents](#-table-of-contents)
  - [📖 Introduction](#-introduction)
  - [🔧 Public APIs](#-public-apis)
    - [📋 Properties](#-properties)
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

## 📖 Introductiontion Class](#️-application-class)

- [📚 Table of Contents](#-table-of-contents)
- [📖 Introduction](#-introduction)
- [🔧 Public APIs](#-public-apis)
  - [📋 Properties](#-properties)
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

## 📖 Introductionass

## 📚 Table of Contents ## � Table of Contents

- [📖 Introduction](#-introduction)
- [🔧 Public APIs](#-public-apis)
  - [📋 Properties](#-properties)
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
- [📝 Notes](#-notes)Class

## � Table of Contents

- [📖 Introduction](#-introduction)
- [🔧 Public APIs](#-public-apis)
  - [📋 Properties](#-properties)
  - [⚙️ Core HTTP Methods](#️-core-http-methods)
  - [🔧 Middleware Management](#-middleware-management)
  - [📁 Static File Serving](#-static-file-serving)
  - [🎨 Template Engine Support](#-template-engine-support)
  - [🌐 WebSocket Support](#-websocket-support)
  - [🔌 Plugin Integration](#-plugin-integration)
  - [⚙️ Server Lifecycle](#️-server-lifecycle)
- [💻 Usage Examples](#-usage-examples)
- [⚙️ Configuration Options](#️-configuration-options)
- [📝 Notes](#-notes)

## �📖 Introduction

The `Application` class is the core component of the NextRush framework, providing a comprehensive web application server with Express.js-compatible API and enterprise-grade features. It orchestrates all framework components including routing, middleware, static file serving, template rendering, and plugin management. The Application class follows a plugin-based architecture where features are modularly added through the plugin system, ensuring flexibility and maintainability.

## 🔧 Public APIs

### 📋 Properties

| Property | Type                 | Description                                           |
| -------- | -------------------- | ----------------------------------------------------- |
| `events` | `SimpleEventEmitter` | Event emitter for application-level events (optional) |

### ⚙️ Core HTTP Methods

#### 🌐 HTTP Verb Methods

| Method                       | Signature                                             | Description                                        |
| ---------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| `get(path, ...handlers)`     | `(path: Path, ...handlers: Handler[]) => Application` | Register GET route with middleware and handler     |
| `post(path, ...handlers)`    | `(path: Path, ...handlers: Handler[]) => Application` | Register POST route with middleware and handler    |
| `put(path, ...handlers)`     | `(path: Path, ...handlers: Handler[]) => Application` | Register PUT route with middleware and handler     |
| `delete(path, ...handlers)`  | `(path: Path, ...handlers: Handler[]) => Application` | Register DELETE route with middleware and handler  |
| `patch(path, ...handlers)`   | `(path: Path, ...handlers: Handler[]) => Application` | Register PATCH route with middleware and handler   |
| `head(path, ...handlers)`    | `(path: Path, ...handlers: Handler[]) => Application` | Register HEAD route with middleware and handler    |
| `options(path, ...handlers)` | `(path: Path, ...handlers: Handler[]) => Application` | Register OPTIONS route with middleware and handler |
| `all(path, ...handlers)`     | `(path: Path, ...handlers: Handler[]) => Application` | Register route for all HTTP methods                |

### 🔧 Middleware Management

#### 🛠️ Middleware Methods

| Method                  | Signature                                                                         | Description                       |
| ----------------------- | --------------------------------------------------------------------------------- | --------------------------------- |
| `use(middleware)`       | `(middleware: MiddlewareHandler \| ExpressMiddleware) => Application`             | Register global middleware        |
| `use(path, middleware)` | `(path: Path, middleware: MiddlewareHandler \| ExpressMiddleware) => Application` | Register path-specific middleware |
| `use(path, router)`     | `(path: Path, router: Router) => Application`                                     | Mount router at specific path     |

### 🛣️ Advanced Routing

#### 🔗 Route Creation Methods

| Method                    | Signature                                | Description                                 |
| ------------------------- | ---------------------------------------- | ------------------------------------------- |
| `createRoute(definition)` | `(definition: RouteDefinition) => Route` | Create route definition without registering |
| `addCreatedRoute(route)`  | `(route: Route) => Application`          | Register pre-created route                  |

### 📁 Static File Serving

#### 🗂️ Static Methods

| Method                          | Signature                                                               | Description                       |
| ------------------------------- | ----------------------------------------------------------------------- | --------------------------------- |
| `static(path, root?, options?)` | `(path: string, root?: string, options?: StaticOptions) => Application` | Serve static files from directory |

### 🎨 Template Engine

#### 📄 Template Methods

| Method                          | Signature                                                           | Description                       |
| ------------------------------- | ------------------------------------------------------------------- | --------------------------------- |
| `setViews(viewsPath, options?)` | `(viewsPath: string, options?: any) => Application`                 | Set views directory for templates |
| `setTemplateEngine(engine)`     | `(engine: any) => Application`                                      | Set custom template engine        |
| `render(view, data?)`           | `(view: string, data?: Record<string, unknown>) => Promise<string>` | Render template with data         |

### 🌐 WebSocket Support

#### 🔌 WebSocket Methods

| Method                      | Signature                                                  | Description                             |
| --------------------------- | ---------------------------------------------------------- | --------------------------------------- |
| `enableWebSocket(options?)` | `(options?: WebSocketOptions) => Application`              | Enable WebSocket support                |
| `ws(path, handler)`         | `(path: string, handler: WebSocketHandler) => Application` | Register WebSocket route                |
| `wsUse(middleware)`         | `(middleware: WebSocketMiddleware) => Application`         | Register WebSocket middleware           |
| `wsBroadcast(data, room?)`  | `(data: any, room?: string) => Application`                | Broadcast data to WebSocket connections |
| `getWebSocketStats()`       | `() => WebSocketStats \| undefined`                        | Get WebSocket connection statistics     |
| `getWebSocketConnections()` | `() => NextRushWebSocket[]`                                | Get active WebSocket connections        |

### 🔌 Plugin System

#### ⚙️ Plugin Methods

| Method                   | Signature                               | Description               |
| ------------------------ | --------------------------------------- | ------------------------- |
| `getPluginRegistry()`    | `() => SimplePluginRegistry`            | Access plugin registry    |
| `registerPlugin(plugin)` | `(plugin: BasePlugin) => Promise<void>` | Register new plugin       |
| `unregisterPlugin(name)` | `(name: string) => Promise<void>`       | Unregister plugin by name |

### 🔒 Security & Middleware Presets

#### 🛡️ Security Methods

| Method                      | Signature                                                    | Description                 |
| --------------------------- | ------------------------------------------------------------ | --------------------------- |
| `cors(options?)`            | `(options?: CorsOptions) => MiddlewareFunction`              | CORS middleware             |
| `helmet(options?)`          | `(options?: HelmetOptions) => MiddlewareFunction`            | Security headers middleware |
| `usePreset(name, options?)` | `(name: PresetName, options?: PresetOptions) => Application` | Apply middleware preset     |

### 📦 Body Parsing

#### 🔍 Parser Methods

| Method                 | Signature                                                   | Description                        |
| ---------------------- | ----------------------------------------------------------- | ---------------------------------- |
| `json(options?)`       | `(options?: JsonParserOptions) => MiddlewareFunction`       | JSON body parser middleware        |
| `urlencoded(options?)` | `(options?: UrlEncodedParserOptions) => MiddlewareFunction` | URL-encoded body parser middleware |
| `text(options?)`       | `(options?: TextParserOptions) => MiddlewareFunction`       | Text body parser middleware        |
| `raw(options?)`        | `(options?: RawParserOptions) => MiddlewareFunction`        | Raw body parser middleware         |

### ⚡ Performance & Monitoring

#### 📊 Performance Methods

| Method                  | Signature                                              | Description                     |
| ----------------------- | ------------------------------------------------------ | ------------------------------- |
| `compression(options?)` | `(options?: CompressionOptions) => MiddlewareFunction` | Response compression middleware |
| `rateLimit(options?)`   | `(options?: RateLimitOptions) => MiddlewareFunction`   | Rate limiting middleware        |
| `logger(options?)`      | `(options?: LoggerOptions) => MiddlewareFunction`      | Request logging middleware      |
| `requestId(options?)`   | `(options?: RequestIdOptions) => MiddlewareFunction`   | Request ID middleware           |
| `timer(options?)`       | `(options?: TimerOptions) => MiddlewareFunction`       | Request timing middleware       |

### 🔐 Authentication & Authorization

#### 🔑 Auth Methods

| Method                       | Signature                                                            | Description                  |
| ---------------------------- | -------------------------------------------------------------------- | ---------------------------- |
| `useJwt(options)`            | `(options: JwtOptions) => Application`                               | Configure JWT authentication |
| `defineRole(role)`           | `(role: Role) => Application`                                        | Define user role             |
| `signJwt(payload, options?)` | `(payload: Record<string, any>, options?: JwtSignOptions) => string` | Sign JWT token               |
| `verifyJwt(token, options?)` | `(token: string, options?: JwtVerifyOptions) => Record<string, any>` | Verify JWT token             |
| `requireAuth(strategy?)`     | `(strategy?: string) => MiddlewareFunction`                          | Authentication middleware    |

### 📊 Metrics & Monitoring

#### 📈 Monitoring Methods

| Method                                    | Signature                                                                        | Description               |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ------------------------- |
| `enableMetrics(options?)`                 | `(options?: MetricsOptions) => Application`                                      | Enable metrics collection |
| `incrementCounter(name, value?, labels?)` | `(name: string, value?: number, labels?: Record<string, string>) => Application` | Increment counter metric  |
| `recordGauge(name, value, labels?)`       | `(name: string, value: number, labels?: Record<string, string>) => Application`  | Record gauge metric       |
| `recordHistogram(name, value, labels?)`   | `(name: string, value: number, labels?: Record<string, string>) => Application`  | Record histogram metric   |
| `getMetrics()`                            | `() => MetricsData`                                                              | Get collected metrics     |

### 🔄 Event System

#### 📡 Event Methods

| Method                      | Signature                                                                             | Description                 |
| --------------------------- | ------------------------------------------------------------------------------------- | --------------------------- |
| `on(event, handler)`        | `(event: string, handler: (...args: any[]) => void \| Promise<void>) => Application`  | Add event listener          |
| `once(event, handler)`      | `(event: string, handler: (...args: any[]) => void \| Promise<void>) => Application`  | Add one-time event listener |
| `off(event, handler?)`      | `(event: string, handler?: (...args: any[]) => void \| Promise<void>) => Application` | Remove event listener       |
| `emit(event, ...args)`      | `(event: string, ...args: any[]) => Application`                                      | Emit event                  |
| `eventMiddleware(options?)` | `(options?: EventMiddlewareOptions) => MiddlewareFunction`                            | Event-based middleware      |
| `getEventStats()`           | `() => EventStats`                                                                    | Get event system statistics |
| `getEventHistory()`         | `() => any[]`                                                                         | Get event history           |

### ✅ Validation & Sanitization

#### 🔍 Validation Methods

| Method               | Signature                                               | Description                     |
| -------------------- | ------------------------------------------------------- | ------------------------------- |
| `validate(schema)`   | `(schema: ValidationSchema) => MiddlewareFunction`      | Request validation middleware   |
| `sanitize(options?)` | `(options?: SanitizationOptions) => MiddlewareFunction` | Request sanitization middleware |

### 🏥 Health Checks

#### 💊 Health Methods

| Method                        | Signature                                                   | Description                   |
| ----------------------------- | ----------------------------------------------------------- | ----------------------------- |
| `enableHealthCheck(options?)` | `(options?: HealthCheckOptions) => Application`             | Enable health check endpoint  |
| `addHealthCheck(name, check)` | `(name: string, check: HealthCheckFunction) => Application` | Add custom health check       |
| `getHealthStatus()`           | `() => HealthData`                                          | Get application health status |

### 🚀 Server Lifecycle

#### 🔧 Server Methods

| Method                               | Signature                                                                                           | Description  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------ |
| `listen(port, hostname?, callback?)` | `(port: number \| string, hostname?: string \| (() => void), callback?: () => void) => Application` | Start server |
| `close(callback?)`                   | `(callback?: () => void) => Application`                                                            | Stop server  |

## 📋 Type Definitions

### ⚙️ ApplicationOptions Interface

```typescript
interface ApplicationOptions {
  router?: Router;
  errorHandler?: ErrorHandler;
  timeout?: number;
  maxRequestSize?: number;
  enableEvents?: boolean;
  enableWebSocket?: boolean;
  caseSensitive?: boolean;
  strict?: boolean;
}
```

### 📁 StaticOptions Interface

```typescript
interface StaticOptions {
  maxAge?: string | number;
  etag?: boolean;
  index?: string | string[] | false;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  extensions?: string[] | false;
  immutable?: boolean;
  redirect?: boolean;
  spa?: boolean;
  compress?: boolean | 'auto';
  memoryCache?: boolean;
  acceptRanges?: boolean;
  cacheControl?: string;
  setHeaders?: (res: any, path: string) => void;
}
```

### 🛣️ RouteDefinition Interface

```typescript
interface RouteDefinition {
  method: HttpMethod;
  path: Path;
  handler: RouteHandler | ExpressHandler;
  middleware?: (MiddlewareHandler | ExpressMiddleware)[];
  name?: string;
  description?: string;
}
```

### 🔧 Handler Types

```typescript
type RouteHandler = (
  context: RequestContext,
  next: () => Promise<void>
) => void | Promise<void>;
type ExpressHandler = (
  req: NextRushRequest,
  res: NextRushResponse
) => void | Promise<void>;
type MiddlewareHandler = (
  context: RequestContext,
  next: () => Promise<void>
) => void | Promise<void>;
type ExpressMiddleware = (
  req: NextRushRequest,
  res: NextRushResponse,
  next: () => void
) => void | Promise<void>;
```

## 💡 Usage Examples

### 🔍 Basic Application Setup

```typescript
import { createApp } from 'nextrush';

// Create application
const app = createApp({
  enableEvents: true,
  enableWebSocket: true,
  timeout: 30000,
});

// Basic routes
app.get('/', (req, res) => {
  res.json({ message: 'Hello NextRush!' });
});

app.post('/users', (req, res) => {
  const user = req.body;
  res.status(201).json({ user });
});

// Start server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### 🛠️ Middleware Usage

```typescript
// Global middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// Path-specific middleware
app.use('/api', (req, res, next) => {
  // API-specific logic
  req.apiVersion = '1.0';
  next();
});

// Multiple middleware with route
app.get('/protected', authenticateUser, validatePermissions, (req, res) => {
  res.json({ message: 'Protected resource' });
});
```

### 🛣️ Advanced Routing Examples

```typescript
// Create route without registering
const userRoute = app.createRoute({
  method: 'GET',
  path: '/users/:id',
  handler: (req, res) => {
    res.json({ userId: req.params.id });
  },
  middleware: [authMiddleware],
  name: 'getUser',
  description: 'Get user by ID',
});

// Register the route later
app.addCreatedRoute(userRoute);

// Handle all HTTP methods
app.all('/api/*', corsMiddleware);
```

### 📁 Static File Serving Examples

```typescript
// Basic static files
app.static('/public', './public');

// Advanced static file options
app.static('/assets', './assets', {
  maxAge: '1y',
  etag: true,
  compress: true,
  immutable: true,
  dotfiles: 'deny',
  spa: true, // Single Page Application support
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  },
});
```

### 🎨 Template Engine Integration

```typescript
// Configure template engine
app.setViews('./views');
app.setTemplateEngine(customEngine);

// Render templates
app.get('/profile/:id', async (req, res) => {
  const user = await getUserById(req.params.id);
  const html = await app.render('profile', { user });
  res.html(html);
});
```

### 🌐 WebSocket Support Examples

```typescript
// Enable WebSocket
app.enableWebSocket({
  pingInterval: 30000,
  compression: true,
});

// WebSocket routes
app.ws('/chat', (ws, req) => {
  ws.on('message', (data) => {
    // Broadcast to all connections
    app.wsBroadcast(data);
  });
});

// WebSocket middleware
app.wsUse((ws, req, next) => {
  // Authentication for WebSocket
  const token = req.headers.authorization;
  if (validateToken(token)) {
    next();
  } else {
    ws.close(1008, 'Unauthorized');
  }
});
```

### 🔒 Security & Middleware Preset Examples

```typescript
// Security middleware
app.use(
  app.helmet({
    contentSecurityPolicy: true,
    xssFilter: true,
  })
);

app.use(
  app.cors({
    origin: ['https://trusted-domain.com'],
    credentials: true,
  })
);

// Apply preset configurations
app.usePreset('production', {
  enableSecurity: true,
  enableCompression: true,
  enableRateLimit: true,
});

// Custom preset
app.usePreset('api-server', {
  middlewares: [
    app.json(),
    app.cors(),
    app.rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }),
  ],
});
```

### 📦 Body Parsing Examples

```typescript
// JSON parsing
app.use(
  app.json({
    limit: '10mb',
    strict: true,
  })
);

// URL-encoded forms
app.use(
  app.urlencoded({
    extended: true,
    limit: '10mb',
  })
);

// Multiple parsers for different routes
app.use('/api', app.json());
app.use('/forms', app.urlencoded({ extended: true }));
app.use('/uploads', app.raw({ type: 'application/octet-stream' }));
```

### ⚡ Performance & Monitoring Examples

```typescript
// Enable compression
app.use(
  app.compression({
    level: 6,
    threshold: 1024,
  })
);

// Rate limiting
app.use(
  '/api',
  app.rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests',
  })
);

// Request logging
app.use(
  app.logger({
    format: 'combined',
    skip: (req) => req.url.startsWith('/health'),
  })
);

// Request timing
app.use(
  app.timer({
    header: 'X-Response-Time',
  })
);
```

### 🔐 Authentication & Authorization Examples

```typescript
// JWT configuration
app.useJwt({
  secret: process.env.JWT_SECRET,
  algorithms: ['HS256'],
  expiresIn: '24h',
});

// Define roles
app.defineRole({
  name: 'admin',
  permissions: ['read', 'write', 'delete'],
});

// Protected routes
app.get('/admin', app.requireAuth('jwt'), (req, res) => {
  res.json({ message: 'Admin area' });
});

// JWT operations
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (validateCredentials(username, password)) {
    const token = app.signJwt({ username, role: 'user' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});
```

### 📊 Metrics & Event System

```typescript
// Enable metrics
app.enableMetrics({
  endpoint: '/metrics',
  labels: { service: 'api-server' },
});

// Custom metrics
app.get('/api/data', (req, res) => {
  app.incrementCounter('api_requests_total', 1, {
    method: 'GET',
    endpoint: '/api/data',
  });

  const startTime = Date.now();
  // Process request...
  const duration = Date.now() - startTime;

  app.recordHistogram('request_duration_seconds', duration / 1000);
  res.json({ data: 'response' });
});

// Event system
app.on('user:created', async (user) => {
  console.log('New user created:', user.id);
  await sendWelcomeEmail(user);
});

app.post('/users', (req, res) => {
  const user = createUser(req.body);
  app.emit('user:created', user);
  res.json(user);
});
```

### ✅ Validation & Health Checks

```typescript
// Input validation
app.use(
  '/api',
  app.validate({
    body: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        age: { type: 'number', minimum: 0 },
      },
      required: ['email'],
    },
  })
);

// Input sanitization
app.use(
  app.sanitize({
    trim: true,
    escape: true,
    removeEmpty: true,
  })
);

// Health checks
app.enableHealthCheck({
  endpoint: '/health',
  showDetails: true,
});

app.addHealthCheck('database', async () => {
  const isConnected = await checkDatabaseConnection();
  return {
    status: isConnected ? 'healthy' : 'unhealthy',
    details: { connected: isConnected },
  };
});
```

### 🔧 Router Mounting

```typescript
import { Router } from 'nextrush';

// Create sub-router
const apiRouter = new Router();
apiRouter.get('/users', getUsersHandler);
apiRouter.post('/users', createUserHandler);

// Mount router
app.use('/api/v1', apiRouter);

// Multiple router mounting
const adminRouter = new Router();
const userRouter = new Router();

app.use('/admin', adminRouter);
app.use('/users', userRouter);
```

## ⚙️ Configuration Options

### 🚀 Application Configuration

The Application constructor accepts an `ApplicationOptions` object:

- **router**: Custom router instance
- **errorHandler**: Custom error handler
- **timeout**: Request timeout in milliseconds
- **maxRequestSize**: Maximum request body size
- **enableEvents**: Enable event system
- **enableWebSocket**: Enable WebSocket support
- **caseSensitive**: Enable case-sensitive routing
- **strict**: Enable strict routing

### 📁 Static File Configuration

Static file serving supports extensive configuration:

- **Caching**: `maxAge`, `etag`, `immutable`
- **Security**: `dotfiles` handling
- **Performance**: `compress`, `memoryCache`
- **SPA Support**: `spa` for single-page applications
- **Custom Headers**: `setHeaders` callback

## 📝 Notes

### ✅ Best Practices

1. **Initialization**: Configure all middleware before defining routes
2. **Error Handling**: Use try-catch blocks in async handlers
3. **Security**: Always use security middleware in production
4. **Performance**: Enable compression and caching for static files
5. **Monitoring**: Implement health checks and metrics for production

### 🔐 Security Considerations

1. **Input Validation**: Always validate and sanitize user input
2. **Authentication**: Implement proper authentication for protected routes
3. **CORS**: Configure CORS appropriately for your use case
4. **Rate Limiting**: Implement rate limiting to prevent abuse
5. **Security Headers**: Use helmet middleware for security headers

### ⚠️ Limitations

1. **Plugin Dependencies**: Some features require specific plugins to be registered
2. **Memory Usage**: Large static file caching can consume significant memory
3. **WebSocket Scaling**: WebSocket connections are bound to single server instance
4. **Event System**: Events are local to application instance

### 📦 Dependencies

The Application class integrates with:

- **Router**: For request routing and middleware management
- **ErrorHandler**: For centralized error handling
- **SimpleEventEmitter**: For event-driven architecture
- **Plugin System**: For modular feature implementation

It automatically initializes and manages these dependencies through the plugin system.
