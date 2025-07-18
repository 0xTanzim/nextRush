# 📚 NextRush Framework Documentation

> **Enterprise-grade TypeScript web framework with Express-like simplicity**

## 🚀 **Quick Start**

```bash
npm install nextrush
```

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.get('/', (req, res) => {
  res.json({ message: 'Hello NextRush!' });
});

app.listen(3000);
```

## 📋 **Core Features**

| Feature             | Status | Description                                             |
| ------------------- | ------ | ------------------------------------------------------- |
| 🛣️ **Routing**      | ✅     | Express-like routing with full HTTP methods support     |
| 🔧 **Middleware**   | ✅     | Global and route-specific middleware with presets       |
| 📁 **Static Files** | ✅     | Professional static serving with compression & caching  |
| 🌐 **WebSocket**    | ✅     | Zero-dependency WebSocket with rooms & authentication   |
| 🎨 **Templates**    | ✅     | Multi-syntax template engine (Mustache, JSX-like, etc.) |
| 🛡️ **Validation**   | ✅     | Built-in input validation and sanitization              |
| 📊 **Body Parser**  | ✅     | Ultimate body parsing with file uploads                 |
| ⚡ **Events**       | ✅     | Event-driven architecture with pipelines                |
| 🍪 **Cookies**      | ✅     | Cookie parsing and management                           |
| 🔒 **Security**     | ✅     | Built-in security headers and XSS protection            |

---

## 🎯 **API Reference**

### **Application**

```typescript
import { createApp } from 'nextrush';
const app = createApp();
```

### **Routing**

```typescript
// All HTTP methods supported
app.get('/users/:id', (req, res) => {
  res.json({ user: req.params.id });
});

app.post('/users', (req, res) => {
  const user = req.body;
  res.status(201).json({ created: user });
});

// Context-style handlers also supported
app.get('/context', (context) => {
  context.response.json({ data: 'Context style!' });
});
```

### **Middleware**

```typescript
// Global middleware
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Route-specific middleware
app.get(
  '/protected',
  (req, res, next) => {
    // Auth middleware
    next();
  },
  (req, res) => {
    res.json({ protected: true });
  }
);

// Middleware presets
app.usePreset('development'); // CORS, logging, etc.
app.usePreset('production'); // Security, compression, etc.
```

### **Enhanced Request Methods**

```typescript
app.get('/info', (req, res) => {
  const info = {
    ip: req.ip(), // Smart IP detection
    secure: req.secure(), // HTTPS check
    protocol: req.protocol(), // http/https
    hostname: req.hostname(), // Host extraction
    fullUrl: req.fullUrl(), // Complete URL
    isJson: req.is('json'), // Content-type check
    accepts: req.accepts(['html', 'json']), // Accept headers
    cookies: req.parseCookies(), // Parse cookies
  };
  res.json(info);
});
```

### **Input Validation & Sanitization**

```typescript
app.post('/validate', (req, res) => {
  // Comprehensive validation
  const validation = req.validate({
    email: { required: true, type: 'email' },
    age: { type: 'number', min: 18, max: 120 },
    name: { required: true, minLength: 2, maxLength: 50 },
  });

  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }

  // Data sanitization
  const clean = req.sanitize(req.body.comment, {
    removeHtml: true,
    trim: true,
    escape: true,
  });

  res.json({
    valid: validation.sanitized,
    clean: clean,
  });
});

// Email & URL validation
app.post('/check', (req, res) => {
  const results = {
    emailValid: req.isValidEmail(req.body.email),
    urlValid: req.isValidUrl(req.body.url),
  };
  res.json(results);
});
```

### **Enhanced Response Methods**

```typescript
app.get('/export', (req, res) => {
  const data = [
    { name: 'John', age: 30, email: 'john@example.com' },
    { name: 'Jane', age: 25, email: 'jane@example.com' },
  ];

  // CSV export
  res.csv(data, 'users.csv');
});

app.get('/cookies', (req, res) => {
  // Cookie management
  res.cookie('session', 'abc123', {
    httpOnly: true,
    secure: true,
    maxAge: 3600000, // 1 hour
  });

  res.json({ message: 'Cookie set' });
});
```

### **Professional Static Files**

```typescript
// Basic static serving
app.static('/public', './public');

// Professional features
app.static('/assets', './assets', {
  maxAge: '1y', // Cache control
  compress: true, // Gzip/Brotli compression
  etag: true, // ETag support
  memoryCache: true, // Memory caching
  acceptRanges: true, // Range requests
  spa: true, // SPA support

  setHeaders: (res, path) => {
    if (path.endsWith('.pdf')) {
      res.setHeader('Content-Disposition', 'attachment');
    }
  },
});
```

### **WebSocket Support**

```typescript
// WebSocket endpoints
app.ws('/chat', (socket) => {
  socket.send('Welcome to chat!');

  socket.on('message', (data) => {
    socket.send(`Echo: ${data}`);
  });

  socket.on('close', () => {
    console.log('Client disconnected');
  });
});

// Room-based WebSocket (if needed)
app.ws('/rooms/:room', (socket, req) => {
  const room = req.params.room;
  // Join room logic
});
```

### **Template Engine**

```typescript
// Set views directory
app.setViews('./views');

// Render templates
app.get('/page', (req, res) => {
  res.render('index.html', {
    title: 'NextRush',
    user: { name: 'John' },
  });
});

// Multiple template syntax support:
// - Mustache: {{name}}, {{#if condition}}
// - JSX-like: <Component prop={value} />
// - Include: {{> partial}}
// - Loops: {{#each items}}{{name}}{{/each}}
```

### **Event-Driven Architecture**

```typescript
// Listen for events
app.on('user:created', (userData) => {
  console.log('New user:', userData);
});

// Emit events
app.post('/users', (req, res) => {
  const user = createUser(req.body);

  // Trigger event
  app.emit('user:created', user);

  res.status(201).json(user);
});

// Event pipelines for complex workflows
app.createPipeline('user-onboarding', [
  'user:created',
  'email:welcome',
  'analytics:track',
]);
```

### **Body Parser & File Uploads**

```typescript
// Automatic body parsing (JSON, URL-encoded, multipart)
app.post('/upload', (req, res) => {
  // File uploads
  const file = req.file('avatar');
  const files = req.files('documents');

  // Form data
  const formData = req.body;

  res.json({
    file: file?.filename,
    fileCount: files?.length,
    data: formData,
  });
});
```

---

## 🏗️ **Architecture**

NextRush uses a **plugin-based architecture** where all features are implemented as plugins:

```
src/
├── core/           # Application core
├── plugins/        # All features as plugins
│   ├── router/     # Routing plugin
│   ├── middleware/ # Middleware plugin
│   ├── static-files/ # Static files plugin
│   ├── websocket/  # WebSocket plugin
│   ├── template/   # Template engine plugin
│   └── body-parser/ # Body parser plugin
└── types/          # TypeScript definitions
```

**Key Principles:**

- 🔌 **Plugin-based**: All features are plugins
- 🎯 **Type-safe**: Full TypeScript with automatic inference
- ⚡ **Zero dependencies**: Built-in implementations
- 🚀 **Express-compatible**: Familiar API
- 🏗️ **Modular**: Clean separation of concerns

---

## 🔧 **Configuration**

### **Development**

```typescript
const app = createApp({
  env: 'development',
  debug: true,
});

// Use development preset
app.usePreset('development');
```

### **Production**

```typescript
const app = createApp({
  env: 'production',
  trustProxy: true,
});

// Use production preset
app.usePreset('production');
```

### **Custom Middleware Stack**

```typescript
// Build custom middleware stack
app.usePreset('fullFeatured', {
  cors: { origin: 'https://myapp.com' },
  helmet: { contentSecurityPolicy: false },
  compression: { level: 6 },
});
```

---

## 🧪 **Testing**

```typescript
import { createApp } from 'nextrush';
import request from 'supertest';

describe('API Tests', () => {
  const app = createApp();

  app.get('/test', (req, res) => {
    res.json({ message: 'test' });
  });

  test('GET /test', async () => {
    const response = await request(app).get('/test').expect(200);

    expect(response.body.message).toBe('test');
  });
});
```

---

## 🚀 **Performance**

NextRush is designed for high performance:

- ⚡ **Plugin lazy loading** - Load only what you need
- 💾 **Memory caching** - Intelligent caching for static files
- 🗜️ **Smart compression** - Automatic gzip/brotli compression
- 📊 **Streaming** - Range requests and streaming support
- 🎯 **Optimized routing** - Fast route matching algorithms

---

## 📝 **Examples**

### **Basic REST API**

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Middleware
app.usePreset('development');

// Routes
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.post('/api/users', (req, res) => {
  const validation = req.validate({
    name: { required: true, minLength: 2 },
    email: { required: true, type: 'email' },
  });

  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }

  res.status(201).json({ user: validation.sanitized });
});

app.listen(3000);
```

### **Full-Stack Application**

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Middleware
app.usePreset('production');

// Static files
app.static('/assets', './public', {
  maxAge: '1y',
  compress: true,
  memoryCache: true,
});

// Templates
app.setViews('./views');

// API routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// WebSocket
app.ws('/ws', (socket) => {
  socket.on('message', (data) => {
    socket.send(`Server: ${data}`);
  });
});

// Catch-all for SPA
app.get('*', (req, res) => {
  res.render('index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

---

## 🤝 **Contributing**

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Add** tests
5. **Submit** a pull request

---

## 📄 **License**

MIT License - see [LICENSE](../LICENSE) file for details.

---

**NextRush Framework** - _Enterprise-grade TypeScript web framework_ 🚀
