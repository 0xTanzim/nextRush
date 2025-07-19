# ⚡ NextRush

> **The Modern Express.js Replacement You've Been Waiting For**
> Zero dependencies. TypeScript-first. Built-in everything. Drop-in compatible.

<div align="center">

[![npm version](https://badge.fury.io/js/nextrush.svg)](https://www.npmjs.com/package/nextrush)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dm/nextrush.svg)](https://www.npmjs.com/package/nextrush)
[![Build Status](https://img.shields.io/github/workflow/status/0xTanzim/nextRush/CI)](https://github.com/0xTanzim/nextRush/actions)
[![Coverage](https://img.shields.io/codecov/c/github/0xTanzim/nextRush)](https://codecov.io/gh/0xTanzim/nextRush)

</div>

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.get('/', (req, res) => {
  res.json({ message: 'Hello NextRush!' });
});

app.listen(3000);
// 🚀 That's it! Full Express.js compatibility with enhanced features built-in
```

## 🚀 Why NextRush?

NextRush is a **modern, enterprise-grade web framework** that provides Express.js compatibility with **enhanced features, better performance, and zero dependencies**. Built for developers who want Express.js simplicity with modern web development power.

### 🔥 **What Makes NextRush Special**

- 🛡️ **Built-in Security** - Validation, sanitization, XSS protection out of the box
- 📦 **Zero Dependencies** - No bloat, just pure performance
- 🚀 **Express Compatible** - Drop-in replacement for existing Express.js apps
- 🎯 **TypeScript First** - Full type safety with intelligent autocompletion
- ⚡ **Performance Focused** - Optimized for production workloads
- 🔌 **Everything Built-in** - No need for dozens of middleware packages

### **🔥 Key Features**

- 🛡️ **Built-in security** (validation, sanitization, XSS protection)
- 📁 **Professional static files** with compression & caching
- 🌐 **Built-in WebSocket** support with room management
- 📊 **Ultimate body parser** with file uploads
- 🎨 **Multi-syntax templates** (Mustache, Handlebars, EJS)
- 🍪 **Enhanced request/response** objects
- 🔧 **Zero dependencies** for core features
- 📝 **TypeScript-first** with automatic type inference
- 🔄 **Express.js compatible** - drop-in replacement
- ⚡ **Performance optimized** with smart caching
- 🛡️ **Built-in rate limiting** and CORS protection
- 🔐 **JWT & session authentication** with RBAC
- 📊 **Metrics & monitoring** with health checks
- 📚 **Auto API documentation** with Swagger UI

## 🏗️ **NextRush vs The Competition**

**Why choose NextRush over Express.js, Fastify, or Koa?**

| Feature                    | NextRush |         Express.js         |     Fastify     |        Koa         |
| -------------------------- | :------: | :------------------------: | :-------------: | :----------------: |
| **Zero Dependencies**      |    ✅    |             ❌             |       ❌        |         ❌         |
| **TypeScript First**       |    ✅    |             ⚠️             |       ✅        |         ⚠️         |
| **Built-in Body Parser**   |    ✅    |     ❌ Need middleware     |       ✅        | ❌ Need middleware |
| **Built-in File Uploads**  |    ✅    |       ❌ Need multer       | ❌ Need plugins | ❌ Need middleware |
| **Built-in WebSocket**     |    ✅    |     ❌ Need socket.io      | ❌ Need plugins |  ❌ Need packages  |
| **Built-in Templates**     |    ✅    |      ❌ Need engines       | ❌ Need plugins |  ❌ Need packages  |
| **Built-in Validation**    |    ✅    | ❌ Need express-validator  | ❌ Need plugins |  ❌ Need packages  |
| **Built-in Security**      |    ✅    |  ❌ Need helmet + others   | ❌ Need plugins |  ❌ Need packages  |
| **Built-in Rate Limiting** |    ✅    | ❌ Need express-rate-limit | ❌ Need plugins |  ❌ Need packages  |
| **Built-in Auth**          |    ✅    | ❌ Need passport + others  | ❌ Need plugins |  ❌ Need packages  |
| **API Docs Generation**    |    ✅    |  ❌ Need swagger packages  | ❌ Need plugins |  ❌ Need packages  |
| **Express Compatible**     |    ✅    |             ✅             |       ❌        |         ❌         |
| **Performance**            |    🚀    |             ⚡             |       🚀        |         ⚡         |

### **The Bottom Line**

- **Express.js**: Great, but requires 15+ packages for production features
- **Fastify**: Fast, but 50+ dependencies and different API
- **Koa**: Minimal, but requires many packages for basic features
- **NextRush**: Everything built-in, zero dependencies, Express-compatible

## 🚀 **Quick Start**

### **Installation**

```bash
# NPM
npm install nextrush

# Yarn
yarn add nextrush

# PNPM
pnpm add nextrush
```

### **Your First NextRush App**

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Express.js style - works unchanged!
app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({
    user: id,
    ip: req.ip(), // Enhanced request
    secure: req.secure(), // Built-in utilities
  });
});

// Enhanced features work out of the box
app.post('/api/upload', (req, res) => {
  const file = req.file('document'); // Auto file parsing
  const data = req.body; // Auto JSON parsing
  const validation = req.validate({
    // Built-in validation
    title: { required: true, type: 'string' },
  });

  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }

  res.json({
    uploaded: file?.filename,
    data: validation.sanitized,
  });
});

app.listen(3000, () => {
  console.log('🚀 NextRush server running on http://localhost:3000');
});
```

### **🔄 Migrating from Express.js?**

**Most Express.js code works unchanged!** Just replace the import:

```diff
- const express = require('express');
- const app = express();
+ import { createApp } from 'nextrush';
+ const app = createApp();
+ const app = new Application();

// Everything else stays exactly the same!
app.get('/', (req, res) => {
  res.json({ message: 'Works perfectly!' });
});
```

**[📖 Complete Migration Guide →](./docs/MIGRATION.md)**

## 🔥 **Built-in Superpowers**

### **🛡️ Security & Validation - Zero Configuration**

```typescript
app.post('/api/secure', (req, res) => {
  // Input validation with detailed error messages
  const validation = req.validate({
    email: { required: true, type: 'email' },
    age: { type: 'number', min: 18, max: 120 },
    name: { required: true, minLength: 2 },
  });

  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }

  // Data sanitization (XSS, HTML stripping, etc.)
  const clean = req.sanitize(req.body.bio, {
    removeHtml: true,
    escape: true,
    trim: true,
  });

  res.json({
    message: 'Data is clean and validated!',
    sanitized: clean,
  });
});
```

### **📁 Professional Static Files - Production Ready**

```typescript
// Enterprise-grade static file serving
app.static('/assets', './public', {
  compression: true, // Auto gzip/brotli compression
  caching: true, // Smart ETags and cache headers
  spa: true, // Single Page App support
  maxAge: '1y', // Cache control headers
  headers: {
    // Custom headers
    'X-Powered-By': 'NextRush',
  },
});

// Multiple static directories
app.static('/uploads', './uploads', {
  maxAge: '30d',
  index: false,
});
```

### **🌐 WebSocket - Real-time Made Easy**

```typescript
// Zero-dependency WebSocket with room management
app.ws('/chat/:room', (socket, req) => {
  const room = req.params.room;
  const userId = req.query.userId;

  // Join room automatically
  socket.join(room);

  // Broadcast to room
  socket.broadcast.to(room).send(`User ${userId} joined ${room}`);

  // Handle messages
  socket.on('message', (data) => {
    socket.broadcast.to(room).send(data);
  });

  // Handle disconnect
  socket.on('close', () => {
    socket.broadcast.to(room).send(`User ${userId} left`);
  });
});
```

### **🎨 Template Engine - Super Simple Setup**

```typescript
import { createApp, quickTemplate } from 'nextrush';

const app = createApp();

// ONE LINE SETUP! 🎉
app.setTemplateEngine(quickTemplate());

// Render templates with built-in helpers
app.get('/welcome/:name', (req, res) => {
  res.render('Hello {{name}}! Price: {{currency 29.99}}', {
    name: req.params.name,
  });
});

// Custom helpers made easy
app.setTemplateEngine(
  quickTemplate({
    badge: (type: string, text: string) => `[${type.toUpperCase()}] ${text}`,
    timeAgo: (minutes: number) => `${minutes} minutes ago`,
  })
);

app.get('/status', (req, res) => {
  res.render('{{badge "success" "All systems operational"}} {{timeAgo 5}}', {});
});
```

### **📊 Body Parser - Handle Everything**

```typescript
// Automatic parsing of JSON, forms, files
app.post('/api/data', (req, res) => {
  // JSON and form data - automatically parsed
  const { title, description } = req.body;

  // Single file upload
  const avatar = req.file('avatar');

  // Multiple files
  const documents = req.files('documents');

  // File validation built-in
  if (avatar && !avatar.isImage()) {
    return res.status(400).json({ error: 'Avatar must be an image' });
  }

  res.json({
    data: { title, description },
    avatar: avatar?.filename,
    documents: documents?.map((f) => f.filename),
  });
});
```

### **🛡️ Rate Limiting & CORS - Enterprise Security**

```typescript
// Built-in rate limiting with multiple strategies
app.rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please slow down',
  skipSuccessfulRequests: true,
});

// CORS with security presets
app.cors('production'); // Secure defaults for production

// Or detailed configuration
app.cors({
  origin: ['https://mydomain.com', 'https://app.mydomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

### **🔐 Authentication & Authorization - Built-in**

```typescript
// JWT authentication
app.use(
  '/api',
  app.auth('jwt', {
    secret: process.env.JWT_SECRET,
    algorithms: ['HS256'],
  })
);

// Role-based access control
app.get('/admin/*', app.requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin area', user: req.user });
});

// Session-based authentication
app.use(
  '/dashboard',
  app.auth('session', {
    secret: process.env.SESSION_SECRET,
    store: 'redis',
    cookie: { secure: true, httpOnly: true },
  })
);
```

### **📊 Metrics & Monitoring - Production Insights**

```typescript
// Enable comprehensive metrics
app.enableMetrics({
  prometheus: true, // Prometheus format metrics
  healthCheck: true, // Health check endpoint
  performance: true, // Performance monitoring
});

// Custom metrics
app.use((req, res, next) => {
  app.metrics.increment('requests.total', {
    method: req.method,
    path: req.route?.path || 'unknown',
  });
  next();
});

// Access endpoints:
// GET /metrics      - Prometheus format
// GET /health       - Health check
// GET /metrics/json - JSON format
```

### **📚 API Documentation - Auto-Generated**

```typescript
// Enable Swagger documentation
app.enableApiDocs({
  title: 'My Amazing API',
  version: '1.0.0',
  description: 'Built with NextRush',
  servers: [{ url: 'https://api.mydomain.com' }],
});

// Document endpoints automatically
app
  .get('/users/:id', (req, res) => {
    // Documentation inferred from route and validation
    res.json({ user: req.params.id });
  })
  .doc({
    summary: 'Get user by ID',
    tags: ['Users'],
    parameters: [
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: {
      200: { description: 'User found' },
      404: { description: 'User not found' },
    },
  });

// Access documentation:
// GET /swagger      - Interactive Swagger UI
// GET /api-docs.json - OpenAPI specification
```

## 📚 **Complete Documentation**

### **🚀 Getting Started**

- 📖 [**Complete Documentation Hub**](./docs/README.md) - Central API reference
- 🚀 [**Getting Started Guide**](./docs/GETTING-STARTED.md) - From zero to production
- 🔄 [**Express.js Migration Guide**](./docs/MIGRATION.md) - Seamless transition from Express.js
- 📖 [**Framework Overview**](./docs/Overview.md) - Architecture and core concepts

### **🏗️ Core Framework**

- 🏛️ [**Application Class**](./docs/Application.md) - Main application setup and configuration
- 📡 [**Request Enhancement**](./docs/Request.md) - Enhanced request object with utilities
- 📤 [**Response Enhancement**](./docs/Response.md) - Enhanced response object with methods
- 🛣️ [**Routing System**](./docs/Routing.md) - HTTP routing, parameters, and middleware
- � [**Middleware System**](./docs/Middleware.md) - Middleware management and composition
- 🎭 [**Event System**](./docs/EventSystem.md) - Event-driven architecture
- ⚙️ [**Configuration**](./docs/Configuration.md) - Environment and application configuration

### **📋 Core Features**

- 📊 [**Body Parser**](./docs/BodyParser.md) - Request body parsing and file uploads
- 📁 [**Static Files**](./docs/StaticFiles.md) - Professional static file serving
- 🎨 [**Template Engine**](./docs/TemplateEngine.md) - Server-side rendering support
- 🌐 [**WebSocket Support**](./docs/WebSocket.md) - Real-time communication and rooms
- 🛡️ [**Input Validation**](./docs/Validation.md) - Data validation and sanitization

### **🛡️ Security & Performance**

- �️ [**Security Guide**](./docs/SECURITY.md) - Comprehensive security features
- 🔐 [**Authentication**](./docs/Authentication.md) - JWT, sessions, and RBAC
- 🛡️ [**Rate Limiting**](./docs/RateLimit.md) - Request throttling and DDoS protection
- 🌐 [**CORS Configuration**](./docs/CORS.md) - Cross-origin resource sharing
- ⚡ [**Performance Optimization**](./docs/Performance.md) - Production best practices
- 📊 [**Metrics & Monitoring**](./docs/Metrics.md) - Performance tracking and health checks

### **🚀 Advanced Features**

- 📚 [**API Documentation**](./docs/ApiDocs.md) - Auto-generated Swagger documentation
- 📋 [**API Reference**](./docs/API.md) - Complete API documentation
- ❌ [**Error Handling**](./docs/ErrorHandling.md) - Comprehensive error management
- 🔌 [**Plugin Development**](./docs/Plugins.md) - Extending NextRush functionality

## 🏆 **Production Ready Features**

NextRush is built for **enterprise-grade applications** with:

- 🔒 **Security-First Design** - Secure defaults, input validation, XSS protection
- ⚡ **High Performance** - Optimized for production workloads, smart caching
- 🛡️ **Comprehensive Error Handling** - Detailed logging and error tracking
- 📊 **Memory Efficient** - Smart memory management and garbage collection
- 🔧 **Zero-Config Deployment** - Works out of the box in any environment
- 📈 **Horizontally Scalable** - Built for microservices and cloud deployment

## 💻 **TypeScript Excellence**

```typescript
// Full type safety with intelligent autocompletion
app.get('/users/:id', (req, res) => {
  // req.params.id is automatically typed as string
  const userId: string = req.params.id;

  // req.body gets proper typing with generics
  const data: UserCreateData = req.body;

  // Response methods are fully typed
  res.json({ user: userId, timestamp: Date.now() });
  //  ^^^^ TypeScript knows this returns JSON
});

// Generic support for request/response typing
interface CreateUserRequest {
  name: string;
  email: string;
  age: number;
}

app.post<CreateUserRequest>('/users', (req, res) => {
  // req.body is now properly typed as CreateUserRequest
  const { name, email, age } = req.body;
  //      ^^^^ Full autocompletion and type checking
});
```

## 🌟 **Community & Support**

### **📞 Get Help**

- 📖 **Documentation**: [Complete Guides](./docs/README.md)
- 💬 **GitHub Discussions**: [Ask Questions & Share Ideas](https://github.com/0xTanzim/nextRush/discussions)
- 🐛 **Issues**: [Report Bugs & Request Features](https://github.com/0xTanzim/nextRush/issues)
- 📧 **Email Support**: [tanzimhossain2@gmail.com](mailto:tanzimhossain2@gmail.com)

### **🤝 Contributing**

We welcome contributions! Check out:

- � **[Issues](https://github.com/0xTanzim/nextRush/issues)** - Report bugs & request features
- 💬 **[Discussions](https://github.com/0xTanzim/nextRush/discussions)** - Community discussions
- 📋 **[GitHub Repository](https://github.com/0xTanzim/nextRush)** - Source code and contributions

### **📈 Roadmap**

- 🔜 **GraphQL Integration** - Built-in GraphQL support
- 🔜 **Database ORM Adapters** - Prisma, TypeORM integration
- 🔜 **Microservice Utilities** - Service discovery, circuit breakers
- 🔜 **Advanced Monitoring** - Distributed tracing, APM integration
- 🔜 **Serverless Deployment** - AWS Lambda, Vercel support

## ⭐ **Show Your Support**

If NextRush makes your development easier, please consider:

- ⭐ **Star this repository** on GitHub
- 🐦 **Share on social media** with `#NextRush`
- 📝 **Write a blog post** about your experience
- 🗣️ **Tell your team** about NextRush
- 💬 **Join our community** discussions

<!-- ## 📊 **Performance Benchmarks**

```
Framework Comparison (req/sec):
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Framework   │ Hello World │ JSON API    │ Static Files│
├─────────────┼─────────────┼─────────────┼─────────────┤
│ NextRush    │ 45,230      │ 38,920      │ 52,100      │
│ Express.js  │ 42,180      │ 35,640      │ 48,300      │
│ Fastify     │ 48,920      │ 41,200      │ 51,800      │
│ Koa         │ 39,800      │ 32,100      │ 44,600      │
└─────────────┴─────────────┴─────────────┴─────────────┘

* Benchmarks run on Node.js 18.x, 4 CPU cores, 8GB RAM
* NextRush matches Fastify performance with zero dependencies
``` -->

## 📄 **License**

**MIT License** - see [LICENSE](./LICENSE) file for details.

---

## Built with ❤️ by developers, for developers

[⭐ Star on GitHub](https://github.com/0xTanzim/nextRush) • [📖 Documentation](./docs/README.md) • [🚀 Get Started](./docs/GETTING-STARTED.md)
