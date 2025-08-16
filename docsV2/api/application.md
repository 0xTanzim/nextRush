# Application API Reference

The Application class is the core of NextRush v2. It provides methods for routing, middleware, configuration, and server management.

## What it is

The Application instance created by `createApp()` handles HTTP requests, manages middleware, defines routes, and orchestrates the entire request/response lifecycle.

## When to use

Use the Application API to:

- Create web servers and APIs
- Configure middleware and routing
- Handle HTTP requests and responses
- Manage application lifecycle
- Configure plugins and services

## TypeScript signature

```typescript
interface Application {
  // HTTP method routing
  get(path: string, ...handlers: RouteHandler[]): void;
  post(path: string, ...handlers: RouteHandler[]): void;
  put(path: string, ...handlers: RouteHandler[]): void;
  delete(path: string, ...handlers: RouteHandler[]): void;
  patch(path: string, ...handlers: RouteHandler[]): void;
  options(path: string, ...handlers: RouteHandler[]): void;
  head(path: string, ...handlers: RouteHandler[]): void;

  // Generic routing
  route(method: HttpMethod, path: string, ...handlers: RouteHandler[]): void;
  all(path: string, ...handlers: RouteHandler[]): void;

  // Middleware
  use(middleware: Middleware): void;
  use(path: string, middleware: Middleware): void;
  use(middleware: Middleware[]): void;
  use(path: string, middleware: Middleware[]): void;

  // Server lifecycle
  listen(port: number, callback?: () => void): Server;
  listen(port: number, host: string, callback?: () => void): Server;
  close(): Promise<void>;

  // Configuration
  set(key: string, value: any): void;
  get(key: string): any;

  // Plugin system
  plugin(plugin: Plugin): void;
}
```

---

# 🏗️ Creating Applications

## createApp() - Application factory

**What it is**: Factory function that creates a new NextRush v2 application instance.

**When to use**: Start of every NextRush application - creates the main app object.

**Signature**:

```typescript
function createApp(options?: ApplicationOptions): Application;
```

**Parameters**:

- `logger` (LoggerInstance): Custom logger instance (optional)
- `trustProxy` (boolean): Trust proxy headers (default: false)
- `env` (string): Environment mode ('development' | 'production' | 'test')
- `errorHandler` (ErrorHandler): Global error handler (optional)
- `plugins` (Plugin[]): Plugins to install automatically (optional)

**Example**:

```typescript
import { createApp } from 'nextrush';

// Basic application
const app = createApp();

// With configuration
const app = createApp({
  env: 'production',
  trustProxy: true,
  errorHandler: (error, ctx) => {
    console.error('App error:', error);
    ctx.res.status(500).json({ error: 'Internal server error' });
  },
});

// Start server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

# 🛣️ Routing Methods

## HTTP method shortcuts

**What it is**: Convenience methods for common HTTP verbs that register route handlers.

**When to use**: Define endpoints for specific HTTP methods like GET, POST, PUT, DELETE.

**Signature**:

```typescript
app.get(path: string, ...handlers: RouteHandler[]): void
app.post(path: string, ...handlers: RouteHandler[]): void
app.put(path: string, ...handlers: RouteHandler[]): void
app.delete(path: string, ...handlers: RouteHandler[]): void
app.patch(path: string, ...handlers: RouteHandler[]): void
app.options(path: string, ...handlers: RouteHandler[]): void
app.head(path: string, ...handlers: RouteHandler[]): void
```

**Example**:

```typescript
// Simple routes
app.get('/users', async ctx => {
  const users = await getUserList();
  ctx.json(users);
});

app.post('/users', async ctx => {
  const userData = ctx.body as CreateUserData;
  const user = await createUser(userData);
  ctx.json(user, 201);
});

// With middleware
app.get('/profile', authenticate, async ctx => {
  const user = ctx.state.user;
  ctx.json({ profile: user });
});

// Multiple handlers
app.post(
  '/upload',
  bodyParser({ multipartLimit: '50mb' }),
  validateUpload,
  async ctx => {
    const file = ctx.files.upload;
    const result = await processFile(file);
    ctx.json(result);
  }
);
```

## route() - Generic routing

**What it is**: Generic method to register handlers for any HTTP method.

**When to use**: Handle custom HTTP methods or when method is determined dynamically.

**Signature**:

```typescript
app.route(method: HttpMethod, path: string, ...handlers: RouteHandler[]): void
```

**Example**:

```typescript
// Custom HTTP method
app.route('LINK', '/api/resources/:id/link', async ctx => {
  const { id } = ctx.params;
  await linkResource(id, ctx.body);
  ctx.res.status(204);
});

// Dynamic method registration
const methods = ['GET', 'POST', 'PUT', 'DELETE'];
methods.forEach(method => {
  app.route(method as HttpMethod, '/api/proxy/*', proxyHandler);
});
```

## all() - Match all methods

**What it is**: Registers handlers that match all HTTP methods for a given path.

**When to use**: Create handlers that respond to any HTTP method, often for middleware or proxies.

**Signature**:

```typescript
app.all(path: string, ...handlers: RouteHandler[]): void
```

**Example**:

```typescript
// CORS preflight for all methods
app.all(
  '/api/*',
  cors({
    origin: 'https://myapp.com',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

// Logging for all methods
app.all('*', logger(), (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path} from ${ctx.ip}`);
  return next();
});

// Catch-all proxy
app.all('/proxy/*', async ctx => {
  const targetUrl = ctx.path.replace('/proxy', '');
  const response = await proxyRequest(targetUrl, ctx);
  ctx.res.send(response);
});
```

---

# 🔧 Middleware Management

## use() - Register middleware

**What it is**: Registers middleware functions to execute during the request/response cycle.

**When to use**: Add cross-cutting concerns like logging, authentication, parsing, error handling.

**Signature**:

```typescript
// Global middleware
app.use(middleware: Middleware): void
app.use(middleware: Middleware[]): void

// Path-specific middleware
app.use(path: string, middleware: Middleware): void
app.use(path: string, middleware: Middleware[]): void
```

**Example**:

```typescript
import { bodyParser, cors, helmet, logger } from 'nextrush';

// Global middleware
app.use(helmet());
app.use(cors());
app.use(bodyParser());

// Multiple middleware at once
app.use([logger(), requestId(), timer()]);

// Path-specific middleware
app.use('/api', [authenticate, rateLimit({ max: 100 })]);

app.use('/admin', [authenticate, requireRole('admin'), auditLog]);

// Custom middleware
app.use(async (ctx, next) => {
  console.log(`→ ${ctx.method} ${ctx.path}`);
  await next();
  console.log(`← ${ctx.status}`);
});
```

---

# 🚀 Server Lifecycle

## listen() - Start server

**What it is**: Starts the HTTP server and begins accepting requests.

**When to use**: Launch your application to handle incoming HTTP requests.

**Signature**:

```typescript
app.listen(port: number, callback?: () => void): Server
app.listen(port: number, host: string, callback?: () => void): Server
```

**Example**:

```typescript
// Basic server start
const server = app.listen(3000);

// With callback
app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});

// Specific host and port
app.listen(8080, '0.0.0.0', () => {
  console.log('🌍 Server running on all interfaces on port 8080');
});

// Environment-based port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Production setup
const server = app.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 NextRush app listening on port ${process.env.PORT || 3000}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await app.close();
  server.close();
  process.exit(0);
});
```

## close() - Stop server

**What it is**: Gracefully shuts down the server and cleans up resources.

**When to use**: Application shutdown, testing cleanup, or graceful restarts.

**Signature**:

```typescript
app.close(): Promise<void>
```

**Example**:

```typescript
// Graceful shutdown
async function shutdown() {
  console.log('Shutting down server...');
  await app.close();
  console.log('Server closed');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Test cleanup
afterAll(async () => {
  await app.close();
});

// Manual shutdown
if (process.env.NODE_ENV === 'test') {
  setTimeout(async () => {
    await app.close();
  }, 5000);
}
```

---

# ⚙️ Configuration

## set() / get() - Application settings

**What it is**: Methods to store and retrieve application-wide configuration values.

**When to use**: Share configuration across middleware and routes, store application state.

**Signature**:

```typescript
app.set(key: string, value: any): void
app.get(key: string): any
```

**Example**:

```typescript
// Set configuration
app.set('title', 'My NextRush App');
app.set('version', '1.0.0');
app.set('database.url', process.env.DATABASE_URL);
app.set('features.auth', true);

// Complex configuration
app.set('redis', {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
});

// Get configuration
const title = app.get('title');
const dbUrl = app.get('database.url');
const redisConfig = app.get('redis');

// Use in middleware
app.use(async (ctx, next) => {
  const version = app.get('version');
  ctx.res.set('X-App-Version', version);
  await next();
});

// Use in routes
app.get('/info', async ctx => {
  ctx.json({
    title: app.get('title'),
    version: app.get('version'),
    features: {
      auth: app.get('features.auth'),
    },
  });
});
```

---

# 🔌 Plugin System

## plugin() - Install plugins

**What it is**: Installs plugins that extend application functionality.

**When to use**: Add advanced features like database integration, WebSockets, or custom middleware.

**Signature**:

```typescript
app.plugin(plugin: Plugin): void
```

**Example**:

```typescript
import {
  LoggerPlugin,
  DatabasePlugin,
  WebSocketPlugin,
} from 'nextrush/plugins';

// Install logger plugin
const loggerPlugin = new LoggerPlugin({
  level: 'info',
  format: 'json',
  transports: [
    new FileTransport({ filename: 'app.log' }),
    new ConsoleTransport(),
  ],
});
app.plugin(loggerPlugin);

// Install database plugin
const databasePlugin = new DatabasePlugin({
  type: 'postgresql',
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});
app.plugin(databasePlugin);

// Install WebSocket plugin
const wsPlugin = new WebSocketPlugin({
  path: '/ws',
  cors: {
    origin: 'https://myapp.com',
  },
});
app.plugin(wsPlugin);

// Use plugin features
app.get('/users', async ctx => {
  const users = await ctx.db.user.findMany(); // Database plugin
  ctx.logger.info('Users fetched', { count: users.length }); // Logger plugin
  ctx.json(users);
});
```

---

# 🎯 Complete Application Example

```typescript
import { createApp } from 'nextrush';
import {
  bodyParser,
  cors,
  helmet,
  compression,
  rateLimit,
  logger,
  requestId,
  timer,
} from 'nextrush';
import { LoggerPlugin, DatabasePlugin } from 'nextrush/plugins';
import type { Context, Middleware } from 'nextrush/types';

// Create application with configuration
const app = createApp({
  env: process.env.NODE_ENV || 'development',
  trustProxy: process.env.NODE_ENV === 'production',
  errorHandler: (error, ctx) => {
    console.error('Application error:', error);
    ctx.res.status(500).json({
      error: 'Internal server error',
      requestId: ctx.requestId,
    });
  },
});

// Application settings
app.set('name', 'NextRush API');
app.set('version', '2.0.0-alpha.1');
app.set('features', {
  auth: true,
  websockets: false,
  database: true,
});

// Install plugins
app.plugin(
  new LoggerPlugin({
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'production' ? 'json' : 'dev',
  })
);

app.plugin(
  new DatabasePlugin({
    type: 'postgresql',
    url: process.env.DATABASE_URL,
  })
);

// Global middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
  })
);
app.use(compression());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests, please try again later',
  })
);

// Request processing middleware
app.use(requestId());
app.use(timer());
app.use(logger());
app.use(
  bodyParser({
    jsonLimit: '10mb',
    multipartLimit: '50mb',
  })
);

// Authentication middleware
const authenticate: Middleware = async (ctx, next) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    ctx.res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const user = await validateToken(token);
    ctx.state.user = user;
    await next();
  } catch (error) {
    ctx.res.status(401).json({ error: 'Invalid token' });
  }
};

// Public routes
app.get('/', async ctx => {
  ctx.json({
    name: app.get('name'),
    version: app.get('version'),
    status: 'running',
  });
});

app.get('/health', async ctx => {
  ctx.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.post('/auth/login', async ctx => {
  const { email, password } = ctx.body as LoginCredentials;
  const token = await loginUser(email, password);
  ctx.json({ token });
});

// Protected API routes
app.use('/api', authenticate);

app.get('/api/profile', async ctx => {
  const user = ctx.state.user;
  ctx.json({ profile: user });
});

app.get('/api/users', async ctx => {
  const users = await ctx.db.user.findMany();
  ctx.logger.info('Users fetched', { count: users.length });
  ctx.json(users);
});

app.post('/api/users', async ctx => {
  const userData = ctx.body as CreateUserData;
  const user = await ctx.db.user.create({ data: userData });
  ctx.logger.info('User created', { userId: user.id });
  ctx.json(user, 201);
});

// Admin routes
app.use('/admin', [authenticate, requireRole('admin')]);

app.get('/admin/stats', async ctx => {
  const stats = await getSystemStats();
  ctx.json(stats);
});

// Error handling for 404s
app.all('*', async ctx => {
  ctx.res.status(404).json({
    error: 'Not found',
    path: ctx.path,
    method: ctx.method,
  });
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(
    `🚀 ${app.get('name')} v${app.get('version')} running on port ${PORT}`
  );
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  await app.close();
  server.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
```

---

## Performance notes

- Use `app.set()` for read-heavy configuration (values are cached)
- Middleware order matters - place expensive operations last
- Use path-specific middleware to avoid unnecessary processing
- The `listen()` method returns a Node.js `Server` instance for advanced control

## Security notes

- Always use `helmet()` middleware in production
- Set `trustProxy: true` when behind a reverse proxy
- Implement proper error handling to avoid information leakage
- Use authentication middleware before protected routes

## See also

- [Context API](./context.md) - Working with request/response context
- [Routing guide](./routing.md) - Advanced routing patterns
- [Middleware guide](./middleware.md) - Built-in and custom middleware
- [Plugin system](../plugins/) - Extending application functionality

---

_Added in v2.0.0-alpha.1_
