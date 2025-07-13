# 🚀 NextRush

A **lightweight, fast, and modern HTTP server framework** for Node.js with TypeScript support. Built with simplicity and performance in mind, NextRush provides an Express-like API with enhanced features and better error handling.

[![npm version](https://badge.fury.io/js/litepress.svg)](https://badge.fury.io/js/litepress)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Why NextRush?

- 🏃‍♂️ **Lightning Fast** - Minimal overhead, maximum performance
- 📝 **TypeScript First** - Built with TypeScript, includes all type definitions
- 🛡️ **Enhanced Error Handling** - Comprehensive error handling with stack traces
- 🧩 **Router Support** - Express-like router system with parameter support
- 🔧 **Easy to Use** - Familiar API if you've used Express.js
- 📦 **Zero Dependencies** - Built on Node.js built-ins only
- 🎯 **Modern** - Uses async/await, promises, and modern JavaScript features

## 🚀 Quick Start

### Installation

```bash
npm install litepress
# or
yarn add litepress
# or
pnpm add litepress
```

### Basic Usage

```typescript
import { NextRush } from 'litepress';

const app = new NextRush();

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Hello from NextRush!' });
});

// Route with parameters
app.get('/users/:id', (req, res) => {
  const userId = req.params?.id;
  res.json({ user: { id: userId, name: 'John Doe' } });
});

// POST route with body parsing
app.post('/users', (req, res) => {
  const userData = req.body;
  res.json({ message: 'User created', data: userData }, 201);
});

// Start server
app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
```

## 📖 Core Features

### 🛣️ HTTP Methods

NextRush supports all standard HTTP methods:

```typescript
app.get('/path', handler); // GET
app.post('/path', handler); // POST
app.put('/path', handler); // PUT
app.delete('/path', handler); // DELETE
app.patch('/path', handler); // PATCH
app.options('/path', handler); // OPTIONS
app.head('/path', handler); // HEAD
```

### 🧭 Router System

Create modular route handlers with the Router system:

```typescript
import { Router, NextRush } from 'litepress';

const app = new NextRush();

// Create routers
const userRouter = new Router();
const adminRouter = new Router();

// Define routes on routers
userRouter.get('/:id', (req, res) => {
  res.json({ user: req.params?.id });
});

userRouter.post('/', (req, res) => {
  res.json({ message: 'User created', data: req.body }, 201);
});

adminRouter.get('/dashboard', (req, res) => {
  res.json({ message: 'Admin dashboard' });
});

// Mount routers
app.use('/users', userRouter);
app.use('/admin', adminRouter);

app.listen(3000);
```

**Available routes:**

- `GET /users/123` → User details
- `POST /users` → Create user
- `GET /admin/dashboard` → Admin dashboard

### 📊 Request & Response Objects

#### Request Object

```typescript
app.get('/example', (req, res) => {
  console.log(req.method); // HTTP method
  console.log(req.pathname); // URL pathname
  console.log(req.query); // Query parameters
  console.log(req.params); // Route parameters
  console.log(req.headers); // Request headers
  console.log(req.body); // Parsed body (for POST/PUT/PATCH)
});
```

#### Response Object

```typescript
app.get('/example', (req, res) => {
  // JSON response
  res.json({ message: 'Hello' });

  // JSON with status code
  res.json({ data: 'Success' }, 201);

  // Text response
  res.send('Hello World');

  // Text with status and content type
  res.send('Hello', 200, 'text/plain');

  // Set headers
  res.setHeader('Custom-Header', 'value');

  // Status code
  res.status(404).json({ error: 'Not found' });

  // Serve HTML file
  await res.serveHtmlFile('./public/index.html');
});
```

### 🎯 Route Parameters

NextRush supports Express-style route parameters:

```typescript
// Single parameter
app.get('/users/:id', (req, res) => {
  const id = req.params?.id;
  res.json({ userId: id });
});

// Multiple parameters
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params || {};
  res.json({ userId, postId });
});

// Mixed routes
app.get('/api/:version/users/:id', (req, res) => {
  const { version, id } = req.params || {};
  res.json({ apiVersion: version, userId: id });
});
```

### 🛡️ Error Handling

NextRush includes comprehensive error handling:

```typescript
const app = new NextRush({
  includeStackTrace: true, // Include stack traces in development
  logErrors: true, // Log errors to console
  timeout: 30000, // Request timeout in milliseconds
  maxBodySize: 1024 * 1024, // Max body size (1MB)
});

app.get('/error-demo', (req, res) => {
  throw new Error('Something went wrong!');
  // NextRush will automatically handle this error
});
```

### ⚙️ Configuration Options

```typescript
const app = new NextRush({
  timeout: 30000, // Request timeout (default: 30000ms)
  maxBodySize: 1024 * 1024, // Max request body size (default: 1MB)
  includeStackTrace: false, // Include stack traces in errors
  logErrors: true, // Log errors to console
  corsEnabled: false, // Enable CORS
  corsOrigins: ['*'], // Allowed CORS origins
});
```

### 🌐 CORS Support

```typescript
const app = new NextRush({
  corsEnabled: true,
  corsOrigins: ['http://localhost:3000', 'https://myapp.com'],
});
```

## 🔧 Advanced Usage

### Nested Routers

```typescript
const apiRouter = new Router();
const v1Router = new Router();
const userRouter = new Router();

// Define routes
userRouter.get('/:id', getUserHandler);
userRouter.post('/', createUserHandler);

// Nest routers
v1Router.use('/users', userRouter);
apiRouter.use('/v1', v1Router);
app.use('/api', apiRouter);

// Results in: /api/v1/users/:id and /api/v1/users/
```

### File Serving

```typescript
app.get('/profile', async (req, res) => {
  await res.serveHtmlFile('./public/profile.html');
});

app.get('/docs', async (req, res) => {
  await res.serveHtmlFile('./docs/index.html', 200);
});
```

### Custom Headers

```typescript
app.get('/api/data', (req, res) => {
  res.setHeader('Cache-Control', 'max-age=3600');
  res.setHeader('X-API-Version', '1.0');
  res.json({ data: 'Important data' });
});
```

## 📈 Performance

NextRush is designed for performance:

- **Zero external dependencies** - Only uses Node.js built-ins
- **Efficient routing** - Fast route matching with parameter extraction
- **Memory efficient** - Minimal memory footprint
- **TypeScript optimized** - Full type safety without runtime overhead

## 🛠️ Development

### With TypeScript

```typescript
import { Request, Response, Handler, NextRush } from 'litepress';

const authMiddleware: Handler = (req: Request, res: Response) => {
  // Type-safe middleware
  if (!req.headers.authorization) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
};
```

### Debugging

NextRush includes built-in debugging features:

```typescript
const app = new NextRush({ logErrors: true });

// Print all registered routes
app.printRoutes();

// Get route information
console.log(`Total routes: ${app.getRouteCount()}`);

// Validate all routes
const validation = app.validateRoutes();
if (!validation.valid) {
  console.error('Route validation errors:', validation.errors);
}
```

## 🎯 Use Cases

### 🌐 Web APIs

Perfect for building REST APIs:

```typescript
const app = new NextRush();

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/users', (req, res) => {
  // Get users from database
  res.json({ users: [] });
});

app.post('/api/users', (req, res) => {
  // Create user
  res.json({ message: 'User created' }, 201);
});
```

### 🚀 Microservices

Lightweight and fast for microservices:

```typescript
const userService = new NextRush({ timeout: 5000 });

userService.get('/users/:id', getUserById);
userService.post('/users', createUser);
userService.put('/users/:id', updateUser);
userService.delete('/users/:id', deleteUser);

userService.listen(3001);
```

### 🖥️ Web Applications

Simple web server for serving HTML:

```typescript
const app = new NextRush();

app.get('/', async (req, res) => {
  await res.serveHtmlFile('./public/index.html');
});

app.get('/about', async (req, res) => {
  await res.serveHtmlFile('./public/about.html');
});
```

## 🚧 Upcoming Features

We're constantly improving NextRush! Here's what's coming:

### 🔄 Middleware System

```typescript
// Coming soon!
app.use(logger);
app.use('/api', authMiddleware);
app.use(cors());
```

### 📁 Static File Serving

```typescript
// Coming soon!
app.static('/public', './assets');
app.static('/uploads', './user-uploads');
```

### 🎨 Template Engine Support

```typescript
// Coming soon!
app.setViewEngine('ejs');
app.get('/profile', (req, res) => {
  res.render('profile', { user: req.user });
});
```

### 🔍 Request Validation

```typescript
// Coming soon!
app.post(
  '/users',
  validate({
    body: {
      name: { type: 'string', required: true },
      email: { type: 'email', required: true },
    },
  }),
  createUserHandler
);
```

### 🔌 Plugin System

```typescript
// Coming soon!
app.use(helmet());
app.use(compression());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
```

### 📚 OpenAPI Documentation

```typescript
// Coming soon!
app.enableSwagger('/api-docs');
```

### 🔒 Built-in Authentication

```typescript
// Coming soon!
app.use(jwt({ secret: 'your-secret' }));
app.use(session({ store: 'memory' }));
```

### 📊 Built-in Monitoring

```typescript
// Coming soon!
app.enableMetrics('/metrics');
app.enableHealthCheck('/health');
```

## 📚 API Reference

### NextRush Class

```typescript
class NextRush {
  constructor(options?: ServerOptions);

  // HTTP Methods
  get(path: string, handler: Handler): void;
  post(path: string, handler: Handler): void;
  put(path: string, handler: Handler): void;
  delete(path: string, handler: Handler): void;
  patch(path: string, handler: Handler): void;
  options(path: string, handler: Handler): void;
  head(path: string, handler: Handler): void;

  // Router mounting
  use(path: string, router: Router): void;

  // Server control
  listen(port: number, callback?: () => void): Server;
  close(callback?: () => void): void;

  // Debugging
  printRoutes(): void;
  getRouteCount(): number;
  validateRoutes(): { valid: boolean; errors: string[] };
}
```

### Router Class

```typescript
class Router {
  constructor(options?: RouterOptions);

  // HTTP Methods (same as NextRush)
  get(path: string, handler: Handler): Router;
  post(path: string, handler: Handler): Router;
  // ... other methods

  // Router nesting
  use(path: string, router: Router): Router;

  // Debugging
  printRoutes(): void;
  getRouteCount(): number;
}
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by Express.js for API design
- Built with modern Node.js and TypeScript best practices
- Thanks to all contributors and users!

## 📞 Support

- 📖 [Documentation](https://github.com/0xTanzim/litepress/wiki)
- 🐛 [Issue Tracker](https://github.com/0xTanzim/litepress/issues)
- 💬 [Discussions](https://github.com/0xTanzim/litepress/discussions)
- 📧 Email: <tanzimhossain2@gmail.com>

---

**Made with ❤️ by the NextRush team**

_Start building amazing web applications with NextRush today!_ 🚀
