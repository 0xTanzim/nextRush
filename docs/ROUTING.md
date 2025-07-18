# Routing & Middleware

## HTTP Methods

NextRush supports all standard HTTP methods with Express.js compatible syntax:

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Basic routing
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

app.post('/users', (req, res) => {
  const user = req.body;
  res.status(201).json({ created: user });
});

app.put('/users/:id', (req, res) => {
  const userId = req.params.id;
  const updates = req.body;
  res.json({ updated: userId, data: updates });
});

app.delete('/users/:id', (req, res) => {
  const userId = req.params.id;
  res.status(204).end();
});

// Also available: patch, head, options, all
```

## Route Parameters

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

// Optional parameters
app.get('/posts/:year/:month?', (req, res) => {
  const { year, month } = req.params;
  res.json({ year, month: month || 'all' });
});

// Wildcard routes
app.get('/files/*', (req, res) => {
  const filePath = req.params[0];
  res.json({ path: filePath });
});
```

### Query Parameters

```typescript
app.get('/search', (req, res) => {
  const { q, page = 1, limit = 10 } = req.query;
  res.json({
    query: q,
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

// URL: /search?q=nodejs&page=2&limit=20
```

## Middleware

### Global Middleware

```typescript
// Apply to all routes
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// Authentication middleware
app.use((req, res, next) => {
  const token = req.headers.authorization;
  if (!token && req.url.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
});

// CORS middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});
```

### Route-Specific Middleware

```typescript
// Authentication middleware function
const authenticate = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  // Verify token logic here
  req.user = { id: 1, name: 'John' }; // Add user to request
  next();
};

// Authorization middleware
const authorize = (roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// Apply middleware to specific routes
app.get('/profile', authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.get('/admin', authenticate, authorize(['admin']), (req, res) => {
  res.json({ admin: true });
});

// Multiple middleware
app.post(
  '/api/posts',
  authenticate,
  validatePost,
  sanitizeInput,
  (req, res) => {
    res.json({ post: req.body });
  }
);
```

## Error Handling

### Error Middleware

```typescript
// Global error handler (must be last)
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  // Don't expose error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack }),
  });
});

// 404 handler (must be after all routes)
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.url,
    method: req.method,
  });
});
```

### Async Error Handling

```typescript
// Async wrapper function
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Use with async routes
app.get(
  '/async-route',
  asyncHandler(async (req, res) => {
    const data = await someAsyncOperation();
    res.json(data);
  })
);

// Or use try-catch
app.get('/users/:id', async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    next(error); // Pass error to error handler
  }
});
```

## Advanced Routing

### Route Groups

```typescript
// API routes group
const apiRouter = (app) => {
  app.get('/api/users', getAllUsers);
  app.get('/api/users/:id', getUser);
  app.post('/api/users', createUser);
  app.put('/api/users/:id', updateUser);
  app.delete('/api/users/:id', deleteUser);
};

// Admin routes group
const adminRouter = (app) => {
  app.use('/admin', authenticate, authorize(['admin']));
  app.get('/admin/dashboard', getDashboard);
  app.get('/admin/users', getAdminUsers);
  app.post('/admin/users/:id/ban', banUser);
};

// Apply route groups
apiRouter(app);
adminRouter(app);
```

### Conditional Routing

```typescript
// Environment-based routes
if (process.env.NODE_ENV === 'development') {
  app.get('/debug', (req, res) => {
    res.json({
      headers: req.headers,
      query: req.query,
      params: req.params,
      body: req.body,
    });
  });
}

// Feature flag routes
const features = {
  newDashboard: process.env.FEATURE_NEW_DASHBOARD === 'true',
};

if (features.newDashboard) {
  app.get('/dashboard', getNewDashboard);
} else {
  app.get('/dashboard', getOldDashboard);
}
```

## Request & Response Objects

### Enhanced Request

```typescript
app.get('/request-info', (req, res) => {
  const info = {
    // Standard Express properties
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    params: req.params,
    body: req.body,

    // NextRush enhancements
    ip: req.ip(), // Smart IP detection
    secure: req.secure(), // HTTPS detection
    protocol: req.protocol(), // http/https
    hostname: req.hostname(), // Host header
    fullUrl: req.fullUrl(), // Complete URL

    // Cookie parsing
    cookies: req.parseCookies(),

    // User agent info
    userAgent: req.headers['user-agent'],
  };

  res.json(info);
});
```

### Enhanced Response

```typescript
app.get('/response-demo', (req, res) => {
  // Standard responses
  res.json({ message: 'Hello' });
  res.status(201).json({ created: true });
  res.redirect('/new-url');
  res.send('Plain text');

  // NextRush enhancements
  res.cookie('sessionId', 'abc123', {
    httpOnly: true,
    secure: true,
    maxAge: 3600000,
  });

  res.clearCookie('oldCookie');

  // CSV export
  const data = [
    { name: 'John', age: 30 },
    { name: 'Jane', age: 25 },
  ];
  res.csv(data, 'users.csv');
});
```

## Performance Tips

### Middleware Optimization

```typescript
// Cache middleware results
const cache = new Map();
const cacheMiddleware = (req, res, next) => {
  const key = req.url;
  if (cache.has(key)) {
    return res.json(cache.get(key));
  }
  req.useCache = (data) => cache.set(key, data);
  next();
};

app.get('/cached-route', cacheMiddleware, (req, res) => {
  const data = expensiveOperation();
  req.useCache(data);
  res.json(data);
});

// Rate limiting
const rateLimiter = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip();
    const now = Date.now();
    const windowStart = now - windowMs;

    const userRequests = requests.get(key) || [];
    const validRequests = userRequests.filter((time) => time > windowStart);

    if (validRequests.length >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    validRequests.push(now);
    requests.set(key, validRequests);
    next();
  };
};

app.use('/api/', rateLimiter(100, 15 * 60 * 1000)); // 100 requests per 15 minutes
```

## Testing Routes

```typescript
// Test file: routes.test.ts
import { createApp } from 'nextrush';
import request from 'supertest';

describe('Routes', () => {
  let app;

  beforeEach(() => {
    app = createApp();

    app.get('/test', (req, res) => {
      res.json({ message: 'test' });
    });

    app.post('/users', (req, res) => {
      res.status(201).json({ user: req.body });
    });
  });

  test('GET /test returns test message', async () => {
    const response = await request(app).get('/test').expect(200);

    expect(response.body.message).toBe('test');
  });

  test('POST /users creates user', async () => {
    const userData = { name: 'John', email: 'john@example.com' };

    const response = await request(app)
      .post('/users')
      .send(userData)
      .expect(201);

    expect(response.body.user).toEqual(userData);
  });
});
```
