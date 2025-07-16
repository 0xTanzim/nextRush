# 🚀 NextRush User Manual

## The Ultimate Node.js Web Framework

NextRush is a modern, high-performance web framework for Node.js that provides the simplicity of Express with powerful built-in features and zero configuration.

## 🎯 Quick Start

### Installation

```bash
npm install nextrush
# or
yarn add nextrush
```

### Hello World

```typescript
import NextRush from 'nextrush';

const app = new NextRush();

app.get('/', (req, res) => {
  res.json({ message: 'Hello NextRush!' });
});

app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
```

## 📁 Core Features

### 🎨 Template Engine System

NextRush includes a powerful built-in template engine supporting multiple formats:

```typescript
// Set views directory
app.setViews('./views');

// Mustache templates
app.get('/user/:id', async (req, res) => {
  const user = { id: req.params.id, name: 'John Doe' };
  await res.render('user.mustache', { user });
});

// HTML/EJS templates
app.get('/profile/:id', async (req, res) => {
  const profile = { name: 'Jane Smith', skills: ['JavaScript', 'Node.js'] };
  await res.render('profile.html', { profile });
});
```

#### Template Features:

- **Multiple Engines**: Mustache, HTML/EJS, JSON
- **Path Aliases**: Use `@views/template.html` instead of `../../../views/template.html`
- **Automatic Caching**: Templates cached in production
- **Zero Dependencies**: Built from scratch

### 📁 Static File Serving

Professional static file serving with advanced features:

```typescript
// Basic static serving
app.static('/public', './public');

// Advanced configuration
app.static('/assets', './assets', {
  maxAge: '1d', // Cache for 1 day
  etag: true, // Generate ETags
  spa: true, // SPA fallback support
  index: ['index.html'], // Default files
});
```

#### Static File Features:

- **Smart Content-Type Detection**: 50+ file types supported
- **Professional Caching**: ETag and Last-Modified headers
- **Range Request Support**: Media streaming capabilities
- **Security Protection**: Path traversal prevention
- **SPA Support**: Fallback routing for single-page apps

### 🔄 Automatic Body Parsing

NextRush automatically parses request bodies without configuration:

```typescript
app.post('/api/users', (req, res) => {
  // JSON automatically parsed
  const { name, email } = req.body;
  res.json({ message: 'User created', data: { name, email } });
});

app.post('/upload', (req, res) => {
  // Form data automatically parsed
  const { title, description } = req.body;
  res.json({ title, description });
});
```

#### Body Parser Features:

- ✅ **JSON parsing** with validation
- ✅ **Form data parsing** (URL-encoded)
- ✅ **Raw text/binary** support
- ⚠️ **File uploads** (basic support, enhanced version coming)
- ✅ **Size limits** and security
- ✅ **Automatic content-type detection**

### 🎛️ Enhanced Request & Response APIs

#### Request Enhancements:

```typescript
app.get('/api/info', (req, res) => {
  // Enhanced request methods
  const userAgent = req.header('user-agent');
  const isJson = req.is('json');
  const acceptsHtml = req.accepts(['html', 'json']);
  const clientIp = req.ip();
  const isSecure = req.secure();

  res.json({ userAgent, isJson, acceptsHtml, clientIp, isSecure });
});
```

#### Response Enhancements:

```typescript
app.get('/api/data', (req, res) => {
  // Enhanced response methods
  res.cache(3600); // Cache for 1 hour
  res.cors(); // CORS headers
  res.json({ data: 'example' }); // JSON response
});

app.get('/download/:file', async (req, res) => {
  // File operations
  await res.download(`./files/${req.params.file}`);
  // Automatic: Content-Type, security, error handling
});

app.get('/stream/:video', async (req, res) => {
  // Streaming for large files
  await res.sendFile(`./videos/${req.params.video}`, {
    streaming: true,
    acceptRanges: true,
  });
});
```

### 🎪 Optional Event System

NextRush includes an optional event system for monitoring and debugging:

```typescript
// Enable events (optional)
const app = new NextRush({ enableEvents: true });

// Listen to application events
app.on('request:start', (req) => {
  console.log(`📥 ${req.method} ${req.url}`);
});

app.on('request:end', (req, res, duration) => {
  console.log(
    `✅ ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`
  );
});

app.on('error', (error, req) => {
  console.error(`❌ Error in ${req.method} ${req.url}:`, error);
});
```

### 🌐 WebSocket Support

Built-in WebSocket support for real-time applications:

```typescript
// WebSocket routes
app.ws('/chat', (socket, req) => {
  console.log('Client connected');

  socket.on('message', (data) => {
    // Broadcast to all clients
    app.wsBroadcast(data);
  });

  socket.on('close', () => {
    console.log('Client disconnected');
  });
});
```

## 🎯 Advanced Usage

### Middleware

NextRush supports Express-style middleware:

```typescript
// Global middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Route-specific middleware
const auth = (req, res, next) => {
  const token = req.header('authorization');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.get('/protected', auth, (req, res) => {
  res.json({ message: 'Protected resource' });
});
```

### Built-in Middleware

```typescript
import { cors, helmet, compression, logger } from 'nextrush/middleware';

// Apply built-in middleware
app.use(cors()); // CORS support
app.use(helmet()); // Security headers
app.use(compression()); // Response compression
app.use(logger()); // Request logging
```

### Error Handling

```typescript
// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
});
```

### Path Parameters & Query Strings

```typescript
// Path parameters
app.get('/users/:id/posts/:postId', (req, res) => {
  const { id, postId } = req.params;
  res.json({ userId: id, postId });
});

// Query parameters
app.get('/search', (req, res) => {
  const { q, page = 1, limit = 10 } = req.query;
  res.json({ query: q, page: parseInt(page), limit: parseInt(limit) });
});
```

## 🚀 Production Ready

### Environment Configuration

```typescript
const app = new NextRush();

// Production optimizations
if (process.env.NODE_ENV === 'production') {
  app.setViews('./views', { cache: true });

  app.static('/assets', './assets', {
    maxAge: '1y',
    immutable: true,
    etag: true,
  });
}
```

### Health Checks

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});
```

## 📊 Best Practices

### 1. Project Structure

```
my-nextrush-app/
├── src/
│   ├── routes/
│   ├── middleware/
│   ├── controllers/
│   └── models/
├── views/
│   ├── layouts/
│   ├── partials/
│   └── pages/
├── public/
│   ├── css/
│   ├── js/
│   └── images/
└── package.json
```

### 2. Environment Variables

```typescript
// config.ts
export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  dbUrl: process.env.DATABASE_URL || 'sqlite:./db.sqlite',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
};
```

### 3. Error Handling

```typescript
// Custom error classes
class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Global error handler
app.use((error, req, res, next) => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ error: error.message });
  } else {
    console.error('Unexpected error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
```

## 🔍 Debugging

### Development Mode

```typescript
// Enable detailed logging in development
if (process.env.NODE_ENV === 'development') {
  const app = new NextRush({ enableEvents: true });

  app.on('request:start', (req) => {
    console.log(`📥 ${req.method} ${req.url}`);
  });

  app.on('middleware:before', (name, req) => {
    console.log(`🔧 Middleware: ${name}`);
  });
}
```

## 📚 API Reference

For complete API documentation, see [API Reference](./API-REFERENCE.md).

## 🎯 What Makes NextRush Special

1. **🎯 Zero Configuration**: Works out of the box
2. **⚡ High Performance**: Built for speed and efficiency
3. **🛡️ Security First**: Built-in protection against common vulnerabilities
4. **🎨 Developer Experience**: Clean, intuitive API
5. **📁 Comprehensive**: File operations, templating, WebSockets all built-in
6. **🔧 Express Compatible**: Easy migration from Express
7. **📦 Zero Dependencies**: Everything built from scratch

---

**NextRush: Express-compatible simplicity with modern enhancements!** 🚀
