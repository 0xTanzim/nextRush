# 🛣️ Routing System Guide

The NextRush framework provides a powerful and flexible routing system that combines Express.js compatibility with modern features like TypeScript support, advanced route matching, middleware composition, and context-aware request handling.

## 📚 Table of Contents

- [Overview](#-overview)
- [Basic Routing](#-basic-routing)
- [Route Parameters](#-route-parameters)
- [HTTP Methods](#-http-methods)
- [Middleware Integration](#-middleware-integration)
- [Advanced Routing](#-advanced-routing)
- [Route Management](#-route-management)
- [Router Configuration](#%EF%B8%8F-router-configuration)
- [Sub-routers](#-sub-routers)
- [Route Matching](#-route-matching)
- [Performance Optimization](#-performance-optimization)
- [Best Practices](#-best-practices)

## 🎯 Overview

### Core Features

- **🔗 Express Compatibility**: Drop-in replacement for Express routing
- **📝 TypeScript First**: Full type safety with intelligent overloads
- **🎯 Advanced Matching**: Regex patterns, wildcards, and parameter extraction
- **🔧 Middleware Integration**: Seamless middleware composition
- **⚡ Performance Optimized**: Efficient route lookup and execution
- **🧩 Modular Design**: Sub-routers and route grouping

### Basic Usage

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Simple GET route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to NextRush!' });
});

// Route with parameters
app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({ userId: id });
});

// Route with middleware
app.post('/api/users', validateUser, createUser);

app.listen(3000);
```

## 🚀 Basic Routing

### Route Definition Patterns

```typescript
// String paths
app.get('/users', getAllUsers);
app.get('/users/profile', getUserProfile);

// Path with parameters
app.get('/users/:id', getUser);
app.get('/users/:userId/posts/:postId', getPost);

// Optional parameters
app.get('/posts/:year/:month?', getPosts);

// Wildcard routes
app.get('/files/*', serveFiles);

// Regex patterns
app.get(/.*fly$/, (req, res) => {
  res.send('Route ending with "fly"');
});
```

### Route Handlers

NextRush supports both Express-style and context-style handlers:

```typescript
// Express-style handler (req, res)
app.get('/express-style', (req, res) => {
  res.json({ style: 'express' });
});

// Context-style handler
app.get('/context-style', (context) => {
  const { request, response } = context;
  response.json({ style: 'context' });
});

// Async handlers are fully supported
app.get('/async-route', async (req, res) => {
  const data = await fetchDataFromDatabase();
  res.json(data);
});
```

### TypeScript Overloads

NextRush provides intelligent TypeScript overloads for different usage patterns:

```typescript
// Just handler
app.get('/simple', (req, res) => {
  res.json({ simple: true });
});

// One middleware + handler
app.get('/with-auth', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Multiple middleware + handler
app.post(
  '/secure-endpoint',
  rateLimit,
  authenticate,
  authorize(['admin']),
  (req, res) => {
    res.json({ success: true });
  }
);

// Mixed Express and Context styles are supported
app.get(
  '/mixed',
  expressMiddleware, // Express-style middleware
  (context) => {
    // Context-style handler
    context.response.json({ mixed: true });
  }
);
```

## 📌 Route Parameters

### URL Parameters

```typescript
// Single parameter
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.json({ user: userId });
});

// Multiple parameters
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params;
  res.json({ userId, postId });
});

// Optional parameters with default values
app.get('/posts/:year/:month?', (req, res) => {
  const { year, month = 'all' } = req.params;
  res.json({
    year: parseInt(year),
    month: month === 'all' ? null : parseInt(month),
  });
});

// Wildcard parameters
app.get('/files/*', (req, res) => {
  const filePath = req.params[0]; // Gets everything after /files/
  res.json({ path: filePath });
});

// Complex parameter patterns
app.get('/api/v:version/users/:id(\\d+)', (req, res) => {
  const { version, id } = req.params;
  res.json({
    apiVersion: version,
    userId: parseInt(id),
  });
});
```

### Query Parameters

```typescript
app.get('/search', (req, res) => {
  const {
    q, // Search query
    page = 1, // Page number with default
    limit = 10, // Items per page
    sort = 'created_at', // Sort field
    order = 'desc', // Sort order
  } = req.query;

  res.json({
    query: q,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
    },
    sorting: { field: sort, order },
  });
});

// URL: /search?q=nodejs&page=2&limit=20&sort=name&order=asc
```

### Request Body and Headers

```typescript
app.post('/api/users', (req, res) => {
  // Access request body (automatically parsed)
  const userData = req.body;

  // Access headers
  const contentType = req.headers['content-type'];
  const authorization = req.headers.authorization;

  // Custom headers
  const apiKey = req.headers['x-api-key'];

  res.json({
    received: userData,
    contentType,
    hasAuth: !!authorization,
    apiKey,
  });
});
```

## 🌐 HTTP Methods

### Standard HTTP Methods

```typescript
// GET - Retrieve data
app.get('/users', (req, res) => {
  res.json(users);
});

// POST - Create new resource
app.post('/users', (req, res) => {
  const newUser = createUser(req.body);
  res.status(201).json(newUser);
});

// PUT - Update entire resource
app.put('/users/:id', (req, res) => {
  const updatedUser = updateUser(req.params.id, req.body);
  res.json(updatedUser);
});

// PATCH - Partial update
app.patch('/users/:id', (req, res) => {
  const patchedUser = patchUser(req.params.id, req.body);
  res.json(patchedUser);
});

// DELETE - Remove resource
app.delete('/users/:id', (req, res) => {
  deleteUser(req.params.id);
  res.status(204).send();
});

// HEAD - Get headers only
app.head('/users/:id', (req, res) => {
  const user = findUser(req.params.id);
  if (user) {
    res.set('Last-Modified', user.updatedAt);
    res.status(200).end();
  } else {
    res.status(404).end();
  }
});

// OPTIONS - Get allowed methods
app.options('/users', (req, res) => {
  res.set('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
  res.status(200).end();
});
```

### RESTful API Example

```typescript
// Complete RESTful Users API
class UsersController {
  // GET /api/users - List all users
  static async index(req, res) {
    const { page = 1, limit = 10, search } = req.query;
    const users = await User.findAll({
      where: search ? { name: { $like: `%${search}%` } } : {},
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    res.json(users);
  }

  // GET /api/users/:id - Get specific user
  static async show(req, res) {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  }

  // POST /api/users - Create new user
  static async create(req, res) {
    const user = await User.create(req.body);
    res.status(201).json(user);
  }

  // PUT /api/users/:id - Update user
  static async update(req, res) {
    const user = await User.findByIdAndUpdate(req.params.id, req.body);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  }

  // DELETE /api/users/:id - Delete user
  static async destroy(req, res) {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(204).send();
  }
}

// Register RESTful routes
app.get('/api/users', UsersController.index);
app.get('/api/users/:id', UsersController.show);
app.post('/api/users', validateUser, UsersController.create);
app.put('/api/users/:id', validateUser, UsersController.update);
app.delete('/api/users/:id', UsersController.destroy);
```

## 🔧 Middleware Integration

### Route-Specific Middleware

```typescript
// Authentication middleware
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Authorization middleware
const authorize = (roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// Validation middleware
const validateUser = (req, res, next) => {
  const { error } = userSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

// Apply middleware to routes
app.get('/profile', authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.get('/admin', authenticate, authorize(['admin']), (req, res) => {
  res.json({ admin: true });
});

app.post(
  '/api/users',
  validateUser,
  authenticate,
  authorize(['admin', 'moderator']),
  createUser
);
```

### Middleware Execution Order

```typescript
// Middleware executes in the order specified
app.post(
  '/api/orders',
  requestLogger, // 1. Log request
  rateLimit, // 2. Check rate limits
  authenticate, // 3. Verify authentication
  authorize(['user']), // 4. Check permissions
  validateOrder, // 5. Validate request data
  processPayment, // 6. Process payment
  createOrder // 7. Create order (final handler)
);
```

### Conditional Middleware

```typescript
// Middleware that runs conditionally
const conditionalAuth = (req, res, next) => {
  // Skip auth for public endpoints
  if (req.path.startsWith('/public')) {
    return next();
  }

  // Require auth for everything else
  return authenticate(req, res, next);
};

// Different middleware for different environments
const devMiddleware =
  process.env.NODE_ENV === 'development' ? [requestLogger, errorReporter] : [];

app.get('/api/data', ...devMiddleware, getData);
```

## 🎯 Advanced Routing

### Route Groups and Prefixes

```typescript
// API v1 routes
const apiV1Routes = (app) => {
  const prefix = '/api/v1';

  app.get(`${prefix}/users`, getUsersV1);
  app.get(`${prefix}/posts`, getPostsV1);
  app.get(`${prefix}/comments`, getCommentsV1);
};

// API v2 routes with different behavior
const apiV2Routes = (app) => {
  const prefix = '/api/v2';

  app.get(`${prefix}/users`, getUsersV2);
  app.get(`${prefix}/posts`, getPostsV2);
  app.get(`${prefix}/comments`, getCommentsV2);
};

// Admin routes with shared middleware
const adminRoutes = (app) => {
  const adminAuth = [authenticate, authorize(['admin'])];

  app.get('/admin/dashboard', ...adminAuth, getDashboard);
  app.get('/admin/users', ...adminAuth, getAdminUsers);
  app.post('/admin/users/:id/ban', ...adminAuth, banUser);
  app.delete('/admin/users/:id', ...adminAuth, deleteUser);
};

// Apply route groups
apiV1Routes(app);
apiV2Routes(app);
adminRoutes(app);
```

### Pattern-Based Routing

```typescript
// Regex patterns for advanced matching
app.get(/.*fly$/, (req, res) => {
  res.send('Matches routes ending with "fly"');
});

app.get(/^\/products\/(\d+)$/, (req, res) => {
  const productId = req.params[0];
  res.json({ productId: parseInt(productId) });
});

// Named regex groups (if supported)
app.get(/^\/users\/(?<userId>\d+)\/posts\/(?<postId>\d+)$/, (req, res) => {
  const { userId, postId } = req.params;
  res.json({ userId: parseInt(userId), postId: parseInt(postId) });
});

// Multiple pattern alternatives
const blogPatterns = ['/blog/:slug', '/articles/:slug', '/posts/:slug'];

blogPatterns.forEach((pattern) => {
  app.get(pattern, getBlogPost);
});
```

### Dynamic Route Registration

```typescript
// Load routes from configuration
const routeConfig = [
  { method: 'GET', path: '/health', handler: healthCheck },
  { method: 'GET', path: '/metrics', handler: getMetrics },
  { method: 'POST', path: '/webhook', handler: handleWebhook },
];

routeConfig.forEach(({ method, path, handler }) => {
  app[method.toLowerCase()](path, handler);
});

// Plugin-based route registration
class ApiPlugin {
  registerRoutes(app) {
    app.get('/api/status', this.getStatus);
    app.get('/api/version', this.getVersion);
    app.post('/api/feedback', this.submitFeedback);
  }

  getStatus = (req, res) => {
    res.json({ status: 'ok', plugin: 'ApiPlugin' });
  };

  // ... other methods
}

// Register plugin routes
const apiPlugin = new ApiPlugin();
apiPlugin.registerRoutes(app);
```

### Conditional Route Loading

```typescript
// Environment-specific routes
if (process.env.NODE_ENV === 'development') {
  app.get('/dev/debug', (req, res) => {
    res.json({
      headers: req.headers,
      query: req.query,
      params: req.params,
      body: req.body,
      environment: process.env.NODE_ENV,
    });
  });

  app.get('/dev/error-test', (req, res) => {
    throw new Error('Test error for development');
  });
}

// Feature flag-based routes
const features = {
  newDashboard: process.env.FEATURE_NEW_DASHBOARD === 'true',
  experimentalApi: process.env.FEATURE_EXPERIMENTAL_API === 'true',
};

if (features.newDashboard) {
  app.get('/dashboard', getNewDashboard);
} else {
  app.get('/dashboard', getOldDashboard);
}

if (features.experimentalApi) {
  app.get('/api/experimental/*', handleExperimentalApi);
}
```

## 📊 Route Management

### Route Information and Statistics

```typescript
// Get route statistics
const stats = app.getRouteStats();
console.log('Route Statistics:', {
  totalRoutes: stats.totalRoutes,
  byMethod: stats.routesByMethod,
  methods: stats.methods,
});

// List all registered routes
const allRoutes = app.getRoutes();
allRoutes.forEach((route) => {
  console.log(`${route.method} ${route.path}`);
});

// Get routes for specific method
const getRoutes = app.getRoutes('GET');
const postRoutes = app.getRoutes('POST');
```

### Route Validation and Debugging

```typescript
// Route debugging middleware
const routeDebugger = (req, res, next) => {
  console.log(`🛣️ Route: ${req.method} ${req.path}`);
  console.log(`📋 Params:`, req.params);
  console.log(`❓ Query:`, req.query);
  console.log(`📦 Body:`, req.body);
  next();
};

// Apply to specific routes for debugging
if (process.env.DEBUG_ROUTES) {
  app.use('/api/*', routeDebugger);
}

// Route validation
const validateRoute = (method, path, handler) => {
  if (typeof handler !== 'function') {
    throw new Error(`Handler for ${method} ${path} must be a function`);
  }

  if (!path || typeof path !== 'string') {
    throw new Error(`Path for ${method} route must be a non-empty string`);
  }
};

// Custom route registration with validation
const safeRoute = (method, path, ...handlers) => {
  const handler = handlers[handlers.length - 1];
  const middleware = handlers.slice(0, -1);

  validateRoute(method, path, handler);
  app[method.toLowerCase()](path, ...middleware, handler);
};

// Usage
safeRoute('GET', '/safe-route', authenticate, (req, res) => {
  res.json({ safe: true });
});
```

## ⚙️ Router Configuration

### Router Options

```typescript
import { Router } from 'nextrush';

// Create router with custom options
const router = new Router({
  caseSensitive: true, // '/Foo' and '/foo' are different
  strict: true, // '/foo' and '/foo/' are different
  mergeParams: true, // Merge parent router params
});

// Configure existing router
router.configure({
  caseSensitive: false,
  strict: false,
  mergeParams: true,
});
```

### Global Router Configuration

```typescript
// Configure application router
app.configure({
  router: {
    caseSensitive: false,
    strict: false,
    mergeParams: true,
    maxRoutes: 1000, // Limit number of routes
  },
});
```

### Route Matching Options

```typescript
// Custom route matcher configuration
const matcherOptions = {
  caseSensitive: false,
  strict: false,
};

// Apply to specific routes
app.get('/case-sensitive', { ...matcherOptions, caseSensitive: true }, handler);
```

## 🔗 Sub-routers

### Creating and Mounting Sub-routers

```typescript
import { Router } from 'nextrush';

// Create sub-router for API routes
const apiRouter = new Router();

// Add routes to sub-router
apiRouter.get('/users', getAllUsers);
apiRouter.get('/users/:id', getUser);
apiRouter.post('/users', createUser);
apiRouter.put('/users/:id', updateUser);
apiRouter.delete('/users/:id', deleteUser);

// Mount sub-router on main app
app.mount('/api/v1', apiRouter);

// Create admin sub-router with middleware
const adminRouter = new Router();

// Add admin middleware to all admin routes
adminRouter.use(authenticate);
adminRouter.use(authorize(['admin']));

adminRouter.get('/dashboard', getDashboard);
adminRouter.get('/users', getAdminUsers);
adminRouter.post('/users/:id/ban', banUser);

// Mount admin router
app.mount('/admin', adminRouter);
```

### Nested Sub-routers

```typescript
// Create nested router structure
const apiRouter = new Router();
const v1Router = new Router();
const v2Router = new Router();

// Version 1 routes
v1Router.get('/users', getUsersV1);
v1Router.get('/posts', getPostsV1);

// Version 2 routes
v2Router.get('/users', getUsersV2);
v2Router.get('/posts', getPostsV2);

// Mount version routers on API router
apiRouter.mount('/v1', v1Router);
apiRouter.mount('/v2', v2Router);

// Mount API router on main app
app.mount('/api', apiRouter);

// Results in routes like:
// GET /api/v1/users
// GET /api/v1/posts
// GET /api/v2/users
// GET /api/v2/posts
```

### Router Composition

```typescript
// Composable router modules
const authRoutes = () => {
  const router = new Router();
  router.post('/login', loginHandler);
  router.post('/logout', logoutHandler);
  router.post('/refresh', refreshTokenHandler);
  return router;
};

const userRoutes = () => {
  const router = new Router();
  router.get('/', getAllUsers);
  router.get('/:id', getUser);
  router.post('/', createUser);
  router.put('/:id', updateUser);
  router.delete('/:id', deleteUser);
  return router;
};

const postRoutes = () => {
  const router = new Router();
  router.get('/', getAllPosts);
  router.get('/:id', getPost);
  router.post('/', createPost);
  router.put('/:id', updatePost);
  router.delete('/:id', deletePost);
  return router;
};

// Compose main application
app.mount('/auth', authRoutes());
app.mount('/api/users', userRoutes());
app.mount('/api/posts', postRoutes());
```

## 🎯 Route Matching

### Route Priority and Order

```typescript
// Routes are matched in registration order
app.get('/users/new', (req, res) => {
  res.send('New user form');
});

app.get('/users/:id', (req, res) => {
  res.send(`User ${req.params.id}`);
});

// More specific routes should come first
app.get('/api/admin/users', adminUsersHandler); // Specific
app.get('/api/admin/*', adminGeneralHandler); // General
app.get('/api/*', apiGeneralHandler); // Most general
```

### Custom Route Matching

```typescript
// Custom matcher for complex patterns
const customMatcher = (pattern, path) => {
  // Custom matching logic
  if (pattern.includes('*')) {
    const prefix = pattern.replace('*', '');
    return path.startsWith(prefix);
  }
  return pattern === path;
};

// Advanced pattern matching
app.get('/complex/:type(product|service)/:id(\\d+)', (req, res) => {
  const { type, id } = req.params;
  res.json({
    type, // 'product' or 'service'
    id: parseInt(id), // numeric ID only
  });
});
```

### Route Conflicts and Resolution

```typescript
// Handle route conflicts
const routeConflictHandler = (conflictingRoutes) => {
  console.warn('Route conflict detected:', conflictingRoutes);
  // Use the first registered route
  return conflictingRoutes[0];
};

// Configure conflict resolution
app.configure({
  router: {
    conflictResolution: routeConflictHandler,
  },
});
```

## ⚡ Performance Optimization

### Route Caching

```typescript
// Enable route caching for better performance
app.configure({
  router: {
    enableCaching: true,
    cacheSize: 1000,
  },
});

// Cache frequently accessed routes
const popularRoutes = [
  '/api/popular-content',
  '/api/trending',
  '/api/featured',
];

popularRoutes.forEach((route) => {
  app.get(route, cacheMiddleware(300), handler); // Cache for 5 minutes
});
```

### Efficient Route Organization

```typescript
// Group similar routes for better performance
const userRoutes = {
  // Most frequently accessed first
  '/users/me': getCurrentUser,
  '/users/:id': getUser,
  '/users': getAllUsers,

  // Less frequent routes last
  '/users/:id/preferences': getUserPreferences,
  '/users/:id/history': getUserHistory,
};

Object.entries(userRoutes).forEach(([path, handler]) => {
  app.get(path, handler);
});
```

### Lazy Route Loading

```typescript
// Load routes on demand
const lazyRoutes = new Map();

const loadRoute = async (path) => {
  if (!lazyRoutes.has(path)) {
    const handler = await import(`./routes${path}`);
    lazyRoutes.set(path, handler.default);
  }
  return lazyRoutes.get(path);
};

// Lazy route middleware
const lazyRoute = (importPath) => async (req, res, next) => {
  const handler = await loadRoute(importPath);
  return handler(req, res, next);
};

// Usage
app.get('/heavy-feature', lazyRoute('/heavy-feature'));
```

## 📋 Best Practices

### 1. **Route Organization**

```typescript
// ✅ Good: Organized by feature
// routes/users.js
export const userRoutes = (app) => {
  app.get('/users', getAllUsers);
  app.get('/users/:id', getUser);
  app.post('/users', createUser);
};

// routes/posts.js
export const postRoutes = (app) => {
  app.get('/posts', getAllPosts);
  app.get('/posts/:id', getPost);
  app.post('/posts', createPost);
};

// ❌ Bad: Everything in one file
app.get('/users', getAllUsers);
app.get('/posts', getAllPosts);
app.get('/comments', getAllComments);
// ... hundreds of routes
```

### 2. **Parameter Validation**

```typescript
// ✅ Good: Validate parameters
app.get('/users/:id', (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  const userId = parseInt(id);
  // ... rest of handler
});

// Better: Use middleware for validation
const validateUserId = (req, res, next) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  req.params.id = parseInt(id);
  next();
};

app.get('/users/:id', validateUserId, getUser);
```

### 3. **Error Handling**

```typescript
// ✅ Good: Consistent error handling
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  })
);

// Global error handler
app.use((error, req, res, next) => {
  console.error('Route error:', error);
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.id,
  });
});
```

### 4. **Security**

```typescript
// ✅ Good: Secure route patterns
app.post(
  '/api/admin/*',
  rateLimit({ max: 10 }), // Rate limiting
  authenticate, // Authentication
  authorize(['admin']), // Authorization
  validateInput, // Input validation
  handler
);

// Sanitize parameters
app.get('/files/:filename', (req, res) => {
  const filename = req.params.filename.replace(/[^a-zA-Z0-9.-]/g, '');
  // Serve file safely
});
```

### 5. **Performance**

```typescript
// ✅ Good: Efficient middleware usage
// Global middleware for all routes
app.use(requestLogger);
app.use(corsHandler);

// Specific middleware only where needed
app.use('/api/*', authenticate);
app.use('/admin/*', adminAuth);

// Cache static routes
app.get('/api/config', cache(3600), getConfig);
```

The NextRush routing system provides a powerful foundation for building scalable web applications with clean, maintainable route organization and excellent performance characteristics. By following these patterns and best practices, developers can create robust routing architectures that scale with their applications.
