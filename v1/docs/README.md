# 📚 NextRush Framework Documentation

> **Complete Developer Guide & API Reference for NextRush**

Welcome to the comprehensive documentation for NextRush - the modern, TypeScript-first web framework that provides Express.js compatibility with enhanced features and zero dependencies.

## 🚀 **Quick Navigation**

### **New to NextRush?**

- 🚀 [**Getting Started**](./GETTING-STARTED.md) - Installation, setup, and your first app
- 🔄 [**Migration Guide**](./MIGRATION.md) - Seamless transition from Express.js
- 📖 [**Overview**](./Overview.md) - Framework introduction and key concepts

### **Core Documentation**

- 🏗️ [**Application Class**](./Application.md) - Main application setup and configuration
- 📡 [**Request Enhancement**](./Request.md) - Enhanced request object with utilities
- � [**Response Enhancement**](./Response.md) - Enhanced response object with methods
- 🛣️ [**Routing System**](./Routing.md) - HTTP routing, parameters, and middleware

### **Built-in Features**

- � [**Middleware System**](./Middleware.md) - Middleware management and composition
- 📊 [**Body Parser**](./BodyParser.md) - Request body parsing and file uploads
- 📁 [**Static Files**](./StaticFiles.md) - Professional static file serving
- 🎨 [**Template Engine**](./TemplateEngine.md) - Server-side rendering support

### **Security & Performance**

- 🛡️ [**Security & Validation**](./SECURITY.md) - Input validation, sanitization, auth
- 🛡️ [**Rate Limiting**](./RateLimit.md) - Request throttling and DDoS protection
- 🌐 [**CORS Configuration**](./CORS.md) - Cross-origin resource sharing
- 📊 [**Metrics & Monitoring**](./Metrics.md) - Performance tracking and health checks

### **Advanced Features**

- 🌐 [**WebSocket Support**](./WebSocket.md) - Real-time communication and rooms
- 🔐 [**Authentication**](./Authentication.md) - JWT, sessions, and RBAC
- � [**API Documentation**](./ApiDocs.md) - Auto-generated Swagger documentation
- 🎭 [**Event System**](./EventSystem.md) - Event-driven architecture
- ❌ [**Error Handling**](./ErrorHandling.md) - Comprehensive error management

## 🎯 **Quick Reference**

### **Application Setup**

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Basic routing
app.get('/', (req, res) => res.json({ message: 'Hello NextRush!' }));
app.post('/api/data', (req, res) => res.json(req.body));

// Built-in features
app.bodyParser(); // Auto body parsing
app.cors(); // CORS protection
app.rateLimit({ max: 100 }); // Rate limiting
app.static('/public', './public'); // Static files

app.listen(3000);
```

### **Enhanced Request/Response**

```typescript
app.post('/api/users', (req, res) => {
  // Enhanced request features
  const ip = req.ip(); // Get client IP
  const isSecure = req.secure(); // Check HTTPS
  const userAgent = req.userAgent(); // Parse user agent

  // Built-in validation
  const validation = req.validate({
    email: { required: true, type: 'email' },
    name: { required: true, minLength: 2 },
  });

  // File handling
  const avatar = req.file('avatar');

  // Enhanced response
  res.json({ success: true, data: validation.sanitized });
  res.cache(3600); // Set cache headers
  res.compress(); // Enable compression
});
```

// WebSocket
app.ws('/chat', (socket) => socket.send('Welcome!'));

// Start server
app.listen(3000);

````

### Enhanced Request Methods

```typescript
app.get('/info', (req, res) => {
  res.json({
    ip: req.ip(), // Smart IP detection
    secure: req.secure(), // HTTPS detection
    protocol: req.protocol(), // http/https
    cookies: req.parseCookies(), // Cookie parsing

    // Input validation
    validation: req.validate({
      email: { required: true, type: 'email' },
    }),

    // Data sanitization
    clean: req.sanitize(req.body.text, {
      removeHtml: true,
      trim: true,
    }),
  });
});
````

### Enhanced Response Methods

```typescript
app.get('/data', (req, res) => {
  // JSON response
  res.json({ data: [] });

  // CSV export
  res.csv(data, 'export.csv');

  // Cookie management
  res.cookie('session', 'abc123', { httpOnly: true });
  res.clearCookie('oldCookie');

  // Template rendering
  res.render('template.html', { user: req.user });
});
```

## 🔥 Feature Highlights

### **Zero Configuration**

Most features work out of the box with sensible defaults:

```typescript
// Body parsing, file uploads, cookies - all automatic
app.post('/upload', (req, res) => {
  const data = req.body; // Auto-parsed JSON/forms
  const file = req.file('doc'); // Auto-parsed files
  res.json({ success: true });
});
```

### **Express.js Compatible**

Drop-in replacement with enhanced features:

```typescript
// Your existing Express.js routes work unchanged
app.use(middleware);
app.get('/users/:id', handler);
app.listen(3000);
```

### **Built-in Security**

Security features included by default:

```typescript
// Input validation and sanitization
const validation = req.validate({
  email: { required: true, type: 'email' },
  age: { type: 'number', min: 18 },
});

const clean = req.sanitize(userInput, {
  removeHtml: true,
  escape: true,
});
```

### **Professional Static Files**

Advanced file serving with zero configuration:

```typescript
app.static('/assets', './public', {
  compression: true, // Auto gzip/brotli
  caching: true, // Smart caching
  spa: true, // SPA support
});
```

### **WebSocket Support**

Built-in WebSocket with room management:

```typescript
app.ws('/chat/:room', (socket, req) => {
  const room = req.params.room;
  socket.join(room);
  socket.broadcast.to(room).send('User joined');
});
```

## 📋 Complete Feature Matrix

| Feature                      | Status      | Documentation                           |
| ---------------------------- | ----------- | --------------------------------------- |
| **HTTP Routing**             | ✅ Complete | [Routing Guide](./ROUTING.md)           |
| **Middleware System**        | ✅ Complete | [Routing Guide](./ROUTING.md)           |
| **Body Parsing**             | ✅ Complete | [Body Parser](./BODY-PARSER.md)         |
| **File Uploads**             | ✅ Complete | [Body Parser](./BODY-PARSER.md)         |
| **Input Validation**         | ✅ Complete | [Security Guide](./SECURITY.md)         |
| **Data Sanitization**        | ✅ Complete | [Security Guide](./SECURITY.md)         |
| **Static File Serving**      | ✅ Complete | [Static Files](./STATIC-FILES.md)       |
| **Template Engine**          | ✅ Complete | [Template Engine](./TEMPLATE-ENGINE.md) |
| **WebSocket Support**        | ✅ Complete | [WebSocket Guide](./WEBSOCKET.md)       |
| **Cookie Management**        | ✅ Complete | [Security Guide](./SECURITY.md)         |
| **Error Handling**           | ✅ Complete | [Routing Guide](./ROUTING.md)           |
| **TypeScript Support**       | ✅ Complete | All Guides                              |
| **Express.js Compatibility** | ✅ Complete | [Migration Guide](./MIGRATION.md)       |

## 🎓 Learning Path

### **Beginner**

1. [Getting Started](./GETTING-STARTED.md) - Basic setup
2. [Routing & Middleware](./ROUTING.md) - Core concepts
3. [Security](./SECURITY.md) - Input validation basics

### **Intermediate**

1. [Static Files](./STATIC-FILES.md) - File serving optimization
2. [Body Parser](./BODY-PARSER.md) - File uploads and processing
3. [Template Engine](./TEMPLATE-ENGINE.md) - Server-side rendering

### **Advanced**

1. [WebSocket](./WEBSOCKET.md) - Real-time applications
2. [Performance](./PERFORMANCE.md) - Optimization techniques
3. [Plugin Development](./PLUGINS.md) - Extending NextRush

### **Production**

1. [Testing](./TESTING.md) - Comprehensive testing strategies
2. [Deployment](./DEPLOYMENT.md) - Production deployment
3. [Migration Guide](./MIGRATION.md) - Express.js migration

## 🔍 Find What You Need

### **By Use Case**

- **Building a REST API?** → [Routing](./ROUTING.md) + [Security](./SECURITY.md)
- **File upload system?** → [Body Parser](./BODY-PARSER.md) + [Security](./SECURITY.md)
- **Real-time chat?** → [WebSocket](./WEBSOCKET.md) + [Security](./SECURITY.md)
- **SPA with API?** → [Static Files](./STATIC-FILES.md) + [Routing](./ROUTING.md)
- **Server-side rendered app?** → [Template Engine](./TEMPLATE-ENGINE.md) + [Routing](./ROUTING.md)
- **Migrating from Express?** → [Migration Guide](./MIGRATION.md)

### **By Feature**

- **Authentication** → [Security Guide](./SECURITY.md)
- **File Processing** → [Body Parser](./BODY-PARSER.md)
- **Performance Issues** → [Performance Guide](./PERFORMANCE.md)
- **Testing Setup** → [Testing Guide](./TESTING.md)
- **Production Deploy** → [Deployment Guide](./DEPLOYMENT.md)

## 💡 Examples & Recipes

Each guide includes:

- ✅ **Working code examples** - Copy-paste ready
- ✅ **Real-world scenarios** - Practical use cases
- ✅ **Best practices** - Industry standards
- ✅ **Security considerations** - Safe by default
- ✅ **Performance tips** - Optimization techniques
- ✅ **Testing examples** - Quality assurance

## 🌍 Community & Support

- � **Documentation Issues**: [Report here](https://github.com/0xTanzim/nextRush/issues)
- 💬 **Questions**: [GitHub Discussions](https://github.com/0xTanzim/nextRush/discussions)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- 📧 **Direct Support**: [support@nextrush.dev](mailto:support@nextrush.dev)

## 📚 Archive

Historical documentation and detailed technical references are maintained in the [archive](./archive/) directory for future reference and deep-dive technical analysis.

---

**Ready to get started?** Begin with the [Getting Started Guide](./GETTING-STARTED.md) or jump to any specific feature you need!

> **Documentation Version**: This documentation covers NextRush v1.0+ - last updated July 2025

### HTTP Methods

```typescript
// All HTTP methods supported
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

app.post('/users', (req, res) => {
  // Body automatically parsed
  const user = req.body;
  res.status(201).json({ created: user });
});

app.put('/users/:id', (req, res) => {
  const userId = req.params.id;
  const updates = req.body;
  res.json({ updated: userId });
});

app.delete('/users/:id', (req, res) => {
  res.status(204).end();
});

// Also: app.patch(), app.head(), app.options()
```

### Route Parameters

```typescript
// URL parameters
app.get('/users/:id', (req, res) => {
  const userId = req.params.id; // Type: string
  res.json({ user: userId });
});

// Multiple parameters
app.get('/users/:userId/posts/:postId', (req, res) => {
  const { userId, postId } = req.params;
  res.json({ userId, postId });
});

// Wildcard routes
app.get('/files/*', (req, res) => {
  const filePath = req.params[0]; // Everything after /files/
  res.json({ path: filePath });
});
```

### Query Parameters

```typescript
app.get('/search', (req, res) => {
  const { q, page, limit } = req.query;
  // q=hello&page=1&limit=10
  res.json({ query: q, page, limit });
});
```

---

## 🔧 Middleware

### Global Middleware

```typescript
// Apply to all routes
app.use((req, res, next) => {
  req.startTime = Date.now();
  console.log(`${req.method} ${req.url}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});
```

### Route-Specific Middleware

```typescript
// Authentication middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  // Verify token...
  next();
};

// Apply to specific route
app.get('/protected', authenticate, (req, res) => {
  res.json({ message: 'You are authenticated!' });
});

// Multiple middleware
app.post('/admin', authenticate, authorize, (req, res) => {
  res.json({ admin: true });
});
```

---

## 🛡️ Enhanced Request Methods

### IP Detection & Security

```typescript
app.get('/info', (req, res) => {
  const info = {
    ip: req.ip(), // Smart IP detection (handles proxies)
    secure: req.secure(), // true if HTTPS
    protocol: req.protocol(), // 'http' or 'https'
    hostname: req.hostname(), // Host from headers
    fullUrl: req.fullUrl(), // Complete URL reconstruction
    userAgent: req.headers['user-agent'],
  };

  res.json(info);
});
```

### Input Validation

```typescript
app.post('/users', (req, res) => {
  // Validate request data
  const validation = req.validate({
    email: { required: true, type: 'email' },
    age: { type: 'number', min: 18, max: 120 },
    name: { required: true, minLength: 2, maxLength: 50 },
  });

  if (!validation.isValid) {
    return res.status(400).json({
      errors: validation.errors,
    });
  }

  // Use sanitized data
  const user = validation.sanitized;
  res.json({ created: user });
});
```

### Data Sanitization

```typescript
app.post('/comments', (req, res) => {
  // Sanitize user input
  const cleanComment = req.sanitize(req.body.comment, {
    removeHtml: true, // Strip HTML tags
    trim: true, // Remove whitespace
    escape: true, // Escape special characters
  });

  res.json({ comment: cleanComment });
});

// Email and URL validation
app.post('/contact', (req, res) => {
  const emailValid = req.isValidEmail(req.body.email);
  const urlValid = req.isValidUrl(req.body.website);

  res.json({ emailValid, urlValid });
});
```

### Cookie Parsing

```typescript
app.get('/profile', (req, res) => {
  const cookies = req.parseCookies();
  const sessionId = cookies.sessionId;

  res.json({ session: sessionId });
});
```

---

## 📤 Enhanced Response Methods

### JSON Responses

```typescript
app.get('/api/users', (req, res) => {
  const users = [{ name: 'John' }, { name: 'Jane' }];

  // Standard JSON response
  res.json(users);

  // JSON with status
  res.status(201).json({ created: newUser });
});
```

### CSV Export

```typescript
app.get('/export/users', (req, res) => {
  const users = [
    { name: 'John Doe', age: 30, email: 'john@example.com' },
    { name: 'Jane Smith', age: 25, email: 'jane@example.com' },
  ];

  // Export as CSV file
  res.csv(users, 'users-export.csv');
});
```

### Cookie Management

```typescript
app.post('/login', (req, res) => {
  // Set secure cookie
  res.cookie('sessionId', 'abc123', {
    httpOnly: true, // Prevent JS access
    secure: true, // HTTPS only
    maxAge: 3600000, // 1 hour
    sameSite: 'strict', // CSRF protection
  });

  res.json({ success: true });
});

app.post('/logout', (req, res) => {
  // Clear cookie
  res.clearCookie('sessionId');
  res.json({ loggedOut: true });
});
```

---

## 📊 Body Parsing

### Automatic Parsing

```typescript
// Body automatically parsed based on Content-Type
app.post('/api/data', (req, res) => {
  // JSON: application/json
  const jsonData = req.body; // Parsed object

  // Form: application/x-www-form-urlencoded
  const formData = req.body; // Parsed form fields

  res.json({ received: req.body });
});
```

### File Uploads

```typescript
app.post('/upload', (req, res) => {
  // Multipart form data with files
  const file = req.file('avatar'); // Single file
  const files = req.files('documents'); // Multiple files

  if (file) {
    console.log({
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype,
    });
  }

  res.json({
    uploadedFile: file?.filename,
    fileCount: files?.length || 0,
  });
});
```

---

## 📁 Professional Static Files

### Basic Static Serving

```typescript
// Serve files from public directory
app.static('/assets', './public');

// Files available at:
// /assets/style.css -> ./public/style.css
// /assets/js/app.js -> ./public/js/app.js
```

### Advanced Static Options

```typescript
app.static('/assets', './public', {
  // Cache control
  maxAge: '1y', // Cache for 1 year
  etag: true, // ETag headers for conditional requests
  immutable: true, // Mark as immutable

  // Compression
  compress: true, // Auto gzip/brotli compression
  memoryCache: true, // Cache files in memory

  // Range requests (for video streaming)
  acceptRanges: true, // Support partial content

  // Security
  dotfiles: 'ignore', // Hide .env, .git files

  // Custom headers
  setHeaders: (res, path) => {
    if (path.endsWith('.pdf')) {
      res.setHeader('Content-Disposition', 'attachment');
    }
  },
});
```

### SPA Support

```typescript
// Single Page Application support
app.static('/', './dist', {
  spa: true, // Fallback to index.html for 404s
  maxAge: '1h',
});

// API routes (served before static files)
app.get('/api/*', (req, res) => {
  res.json({ api: true });
});
```

---

## 🌐 WebSocket Support

### Basic WebSocket

```typescript
// WebSocket endpoint
app.ws('/chat', (socket) => {
  console.log('Client connected');

  // Send welcome message
  socket.send('Welcome to chat!');

  // Handle incoming messages
  socket.on('message', (data) => {
    console.log('Received:', data);
    socket.send(`Echo: ${data}`);
  });

  // Handle disconnection
  socket.on('close', () => {
    console.log('Client disconnected');
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});
```

### Room-Based WebSocket

```typescript
// WebSocket with room parameter
app.ws('/rooms/:roomId', (socket, req) => {
  const roomId = req.params.roomId;
  console.log(`Client joined room: ${roomId}`);

  socket.send(`Welcome to room ${roomId}!`);
});
```

---

## 🎨 Template Engine

### Setup Templates

```typescript
// Set views directory
app.setViews('./views');

// Render template
app.get('/profile/:id', (req, res) => {
  const user = {
    name: 'John Doe',
    email: 'john@example.com',
    posts: ['Post 1', 'Post 2'],
  };

  res.render('profile.html', { user });
});
```

### Template Syntax

NextRush supports multiple template syntaxes:

```html
<!-- Mustache syntax -->
<h1>{{user.name}}</h1>
<p>Email: {{user.email}}</p>

<!-- Conditionals -->
{{#if user.isActive}}
<span>User is active</span>
{{/if}}

<!-- Loops -->
<ul>
  {{#each user.posts}}
  <li>{{this}}</li>
  {{/each}}
</ul>

<!-- Partials -->
{{> header}}
<main>Content here</main>
{{> footer}}
```

---

## 🔧 Application Configuration

### Basic Setup

```typescript
import { createApp } from 'nextrush';

const app = createApp({
  // Optional configuration
  timeout: 30000, // Request timeout (30s)
  enableEvents: false, // Event system (optional)
  caseSensitive: false, // Route case sensitivity
  strict: false, // Strict routing
});
```

### Error Handling

```typescript
// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);

  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// 404 handler (put at the end)
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.url,
  });
});
```

---

## 🎯 TypeScript Support

### Type Definitions

```typescript
import { NextRushRequest, NextRushResponse, createApp } from 'nextrush';

const app = createApp();

// Typed route handlers
app.get('/users/:id', (req: NextRushRequest, res: NextRushResponse) => {
  const userId: string = req.params.id;
  res.json({ user: userId });
});

// Custom types for request data
interface CreateUserRequest extends NextRushRequest {
  body: {
    name: string;
    email: string;
    age: number;
  };
}

app.post('/users', (req: CreateUserRequest, res: NextRushResponse) => {
  const { name, email, age } = req.body; // Fully typed
  res.json({ created: { name, email, age } });
});
```

---

## 🚀 Production Deployment

### Server Setup

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Production middleware
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Static files with aggressive caching
app.static('/assets', './dist', {
  maxAge: '1y',
  compress: true,
  memoryCache: true,
});

// API routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

### Environment Configuration

```typescript
// Environment-based setup
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

if (isDevelopment) {
  // Development logging
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

if (isProduction) {
  // Production optimizations
  app.static('/assets', './dist', {
    maxAge: '1y',
    compress: true,
    memoryCache: true,
  });
}
```

---

## 🧪 Testing

### Basic Testing Setup

```typescript
import { createApp } from 'nextrush';
import request from 'supertest';

describe('NextRush API', () => {
  let app;

  beforeEach(() => {
    app = createApp();

    app.get('/test', (req, res) => {
      res.json({ message: 'test' });
    });
  });

  test('GET /test should return test message', async () => {
    const response = await request(app).get('/test').expect(200);

    expect(response.body.message).toBe('test');
  });
});
```

---

## 🔍 Debugging

### Request Logging

```typescript
// Simple request logging
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});
```

### Error Debugging

```typescript
// Detailed error logging
app.use((err, req, res, next) => {
  console.error('Error Details:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: req.body,
  });

  res.status(500).json({ error: 'Internal Server Error' });
});
```

---

## 📊 Performance Tips

### Static File Optimization

```typescript
// Optimize static files for production
app.static('/assets', './dist', {
  maxAge: '1y', // Long cache
  compress: true, // Compression
  memoryCache: true, // Memory cache
  etag: true, // Conditional requests
  immutable: true, // Immutable assets
});
```

### Response Optimization

```typescript
// Optimize JSON responses
app.get('/api/large-data', (req, res) => {
  const data = getLargeDataset();

  // Set appropriate headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache

  res.json(data);
});
```

---

## 🤝 Express.js Migration

NextRush is designed to be a **drop-in replacement** for Express.js:

```typescript
// Express.js code
const express = require('express');
const app = express();

app.get('/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);

// NextRush equivalent (same API!)
import { createApp } from 'nextrush';
const app = createApp();

app.get('/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);
```

**Migration steps:**

1. Replace `const express = require('express')` with `import { createApp } from 'nextrush'`
2. Replace `const app = express()` with `const app = createApp()`
3. Everything else works the same!

---

## 📝 Examples

### REST API

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// In-memory storage (use database in production)
let users = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
];

// Get all users
app.get('/api/users', (req, res) => {
  res.json({ users });
});

// Get user by ID
app.get('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
});

// Create new user
app.post('/api/users', (req, res) => {
  const validation = req.validate({
    name: { required: true, minLength: 2 },
    email: { required: true, type: 'email' },
  });

  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }

  const newUser = {
    id: users.length + 1,
    ...validation.sanitized,
  };

  users.push(newUser);
  res.status(201).json({ user: newUser });
});

// Update user
app.put('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const userIndex = users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  users[userIndex] = { ...users[userIndex], ...req.body };
  res.json({ user: users[userIndex] });
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);
  const userIndex = users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  users.splice(userIndex, 1);
  res.status(204).end();
});

app.listen(3000, () => {
  console.log('🚀 NextRush server running on port 3000');
});
```

### **WebSocket Integration**

```typescript
// Real-time communication
app.ws('/chat/:room', (socket, req) => {
  const room = req.params.room;
  socket.join(room);

  socket.on('message', (data) => {
    socket.broadcast.to(room).send(data);
  });
});
```

### **Authentication & Security**

```typescript
// Built-in JWT authentication
app.use('/api', app.auth('jwt', { secret: process.env.JWT_SECRET }));

// Role-based access control
app.get('/admin/*', app.requireRole('admin'), (req, res) => {
  res.json({ user: req.user, role: req.user.role });
});

// Input validation and sanitization
app.post('/api/users', (req, res) => {
  const validation = req.validate({
    email: { required: true, type: 'email' },
    name: { required: true, minLength: 2 },
  });

  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }

  res.json({ success: true });
});
```

## 🏗️ **Architecture Overview**

NextRush follows a **plugin-based architecture** where features are modularly integrated:

- **🏗️ Application Core** - Main application class and HTTP server management
- **📡 Request/Response Enhancement** - Extended functionality for handling requests
- **🔌 Plugin System** - Modular features (auth, CORS, rate limiting, etc.)
- **🛣️ Routing Engine** - Advanced routing with parameter validation
- **🎭 Event System** - Event-driven architecture for monitoring and hooks

## 📋 **Feature Matrix**

| Feature           | Status      | Documentation                         |
| ----------------- | ----------- | ------------------------------------- |
| HTTP Routing      | ✅ Complete | [Routing](./Routing.md)               |
| Middleware System | ✅ Complete | [Middleware](./Middleware.md)         |
| Body Parsing      | ✅ Complete | [Body Parser](./BodyParser.md)        |
| File Uploads      | ✅ Complete | [Body Parser](./BodyParser.md)        |
| Static Files      | ✅ Complete | [Static Files](./StaticFiles.md)      |
| Template Engine   | ✅ Complete | [Templates](./TemplateEngine.md)      |
| WebSocket         | ✅ Complete | [WebSocket](./WebSocket.md)           |
| Authentication    | ✅ Complete | [Authentication](./Authentication.md) |
| Rate Limiting     | ✅ Complete | [Rate Limiting](./RateLimit.md)       |
| CORS              | ✅ Complete | [CORS](./CORS.md)                     |
| Input Validation  | ✅ Complete | [Security](./SECURITY.md)             |
| API Documentation | ✅ Complete | [API Docs](./ApiDocs.md)              |
| Metrics           | ✅ Complete | [Metrics](./Metrics.md)               |
| Error Handling    | ✅ Complete | [Error Handling](./ErrorHandling.md)  |

## 🚀 **Getting Help**

- 📖 **Read the guides above** for detailed feature documentation
- 💬 **GitHub Discussions**: [Ask questions](https://github.com/0xTanzim/nextRush/discussions)
- 🐛 **GitHub Issues**: [Report bugs](https://github.com/0xTanzim/nextRush/issues)
- 📧 **Email**: [tanzimhossain2@gmail.com](mailto:tanzimhossain2@gmail.com)

## 🤝 **Contributing**

We welcome contributions! See our [Contributing Guide](../CONTRIBUTING.md) and [Development Setup](./DEVELOPMENT.md).

---

**[⬅️ Back to Main README](../README.md)** | **[🚀 Get Started](./GETTING-STARTED.md)** | **[� Migrate from Express](./MIGRATION.md)**
