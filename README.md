# ⚡ NextRush

> **The Express.js replacement you've been waiting for.**
> Zero dependencies. TypeScript-first. Built-in everything. Drop-in compatible.[![npm version](https://badge.fury.io/js/nextrush.svg)](https://www.npmjs.com/package/nextrush)
> [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
> [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
> [![Downloads](https://img.shields.io/npm/dm/nextrush.svg)](https://www.npmjs.com/package/nextrush)

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.get('/', (req, res) => {
  res.json({ message: 'Hello NextRush!' });
});

app.listen(3000);
```

## 🚀 Why NextRush?

NextRush is a **modern, type-safe web framework** that provides Express.js compatibility with **enhanced features, better performance, and zero dependencies**. It's designed for developers who want the simplicity of Express with the power of modern web development.

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

## 🏗️ What Makes NextRush Different

NextRush comes with **everything built-in** - no need to install dozens of packages:

| Feature               | NextRush    | Express.js                | Fastify          | Koa                |
| --------------------- | ----------- | ------------------------- | ---------------- | ------------------ |
| **Body Parsing**      | ✅ Built-in | ❌ Need middleware        | ✅ Built-in      | ❌ Need middleware |
| **File Uploads**      | ✅ Built-in | ❌ Need multer            | ❌ Need plugins  | ❌ Need middleware |
| **Static Files**      | ✅ Built-in | ✅ Built-in               | ❌ Need plugins  | ❌ Need middleware |
| **WebSocket**         | ✅ Built-in | ❌ Need socket.io         | ❌ Need plugins  | ❌ Need packages   |
| **Templates**         | ✅ Built-in | ❌ Need engines           | ❌ Need plugins  | ❌ Need packages   |
| **Input Validation**  | ✅ Built-in | ❌ Need express-validator | ❌ Need plugins  | ❌ Need packages   |
| **Security Features** | ✅ Built-in | ❌ Need helmet + others   | ❌ Need plugins  | ❌ Need packages   |
| **Rate Limiting**     | ✅ Built-in | ❌ Need express-rate-limit| ❌ Need plugins  | ❌ Need packages   |
| **Authentication**    | ✅ Built-in | ❌ Need passport + others | ❌ Need plugins  | ❌ Need packages   |
| **API Documentation** | ✅ Built-in | ❌ Need swagger packages  | ❌ Need plugins  | ❌ Need packages   |
| **Metrics/Monitoring**| ✅ Built-in | ❌ Need prom-client + etc | ❌ Need plugins  | ❌ Need packages   |
| **Zero Dependencies** | ✅ Yes      | ❌ No                     | ❌ No (50+ deps) | ❌ No              |

## 🚀 Quick Start

### **Installation**

```bash
npm install nextrush
```

### **Basic Server**

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Express.js style - works unchanged!
app.get('/users/:id', (req, res) => {
  const { id } = req.params;
  res.json({ user: id, ip: req.ip() });
});

// Enhanced features built-in
app.post('/upload', (req, res) => {
  const file = req.file('document'); // Auto file parsing
  const data = req.body; // Auto JSON parsing
  res.json({ uploaded: file.filename });
});

app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
```

## 🎯 Express.js Migration

**Most Express.js code works unchanged!** Just replace the import:

```diff
- const express = require('express');
- const app = express();
+ import { createApp } from 'nextrush';
+ const app = createApp();

app.get('/', (req, res) => {
  res.json({ message: 'Works the same!' });
});
```

**[📖 Complete Migration Guide →](./docs/MIGRATION.md)**

## 🔥 Enhanced Features

### **🛡️ Built-in Security**

```typescript
app.post('/secure', (req, res) => {
  // Input validation
  const validation = req.validate({
    email: { required: true, type: 'email' },
    age: { type: 'number', min: 18 },
  });

  // Data sanitization
  const clean = req.sanitize(req.body.text, {
    removeHtml: true,
    escape: true,
  });

  res.json({ clean, valid: validation.isValid });
});
```

### **📁 Professional Static Files**

```typescript
// Compression, caching, SPA support - all built-in
app.static('/assets', './public', {
  compression: true, // Auto gzip/brotli
  caching: true, // Smart ETags
  spa: true, // Single Page App support
});
```

### **🌐 WebSocket Support**

```typescript
// Zero-dependency WebSocket with rooms
app.ws('/chat/:room', (socket, req) => {
  const room = req.params.room;
  socket.join(room);
  socket.broadcast.to(room).send('User joined!');
});
```

### **🎨 Template Engine**

```typescript
// Multi-syntax support (Mustache, Handlebars, EJS)
app.setViews('./views');

app.get('/profile/:id', (req, res) => {
  res.render('profile.html', {
    user: { name: 'John', id: req.params.id },
  });
});
```

### **📊 Ultimate Body Parser**

```typescript
// JSON, forms, files - all automatic
app.post('/api/data', (req, res) => {
  const data = req.body; // Auto-parsed JSON/forms
  const avatar = req.file('avatar'); // Auto-parsed files
  const files = req.files(); // Multiple files

  res.json({ data, avatar: avatar.filename });
});
```

### **🛡️ Built-in Rate Limiting & CORS**

```typescript
// Enterprise-grade rate limiting
app.useRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.'
});

// CORS with security presets
app.useCors('production'); // Secure defaults for production
// Or custom configuration
app.useCors({
  origin: ['https://mydomain.com'],
  credentials: true,
  methods: ['GET', 'POST']
});
```

### **🔐 Built-in Authentication**

```typescript
// JWT authentication
app.useAuth('jwt', { secret: 'your-secret' });

// Session-based authentication
app.useAuth('session', { store: 'redis' });

// Role-based access control
app.get('/admin/*', app.requireRole('admin'), (req, res) => {
  res.json({ message: 'Admin only area' });
});
```

### **📊 Metrics & Monitoring**

```typescript
// Built-in metrics collection
app.enableMetrics({
  prometheus: true,
  healthCheck: true
});

// Access metrics
// GET /metrics - Prometheus format
// GET /health - Health check endpoint
// GET /metrics/json - JSON format
```

### **📚 Auto API Documentation**

```typescript
// Enable Swagger documentation
app.enableApiDocs({
  title: 'My API',
  version: '1.0.0'
});

// Document endpoints
app.doc('/users/:id', 'GET', {
  summary: 'Get user by ID',
  parameters: [
    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
  ]
});

// Access documentation
// GET /swagger - Interactive Swagger UI
// GET /api-docs.json - OpenAPI specification
```

## 📚 Documentation

### **🚀 Getting Started**

- 📖 [**Complete Documentation**](./docs/README.md) - Central API reference
- 🚀 [**Getting Started Guide**](./docs/GETTING-STARTED.md) - Installation & setup
- 🔄 [**Migration from Express.js**](./docs/MIGRATION.md) - Step-by-step guide

### **📋 Feature Guides**

- 🛣️ [**Routing & Middleware**](./docs/ROUTING.md) - HTTP methods, middleware, parameters
- 🛡️ [**Security**](./docs/SECURITY.md) - Input validation, sanitization, authentication
- 📁 [**Static Files**](./docs/STATIC-FILES.md) - Professional file serving & optimization
- 🌐 [**WebSocket**](./docs/WEBSOCKET.md) - Real-time communication & room management
- 🎨 [**Template Engine**](./docs/TEMPLATE-ENGINE.md) - Server-side rendering & templates
- 📊 [**Body Parser**](./docs/BODY-PARSER.md) - File uploads, parsing, security

### **🚀 Enhanced Features**

- 🛡️ [**Rate Limiting**](./docs/RATE-LIMITING.md) - Built-in request throttling & DDoS protection
- 🌐 [**CORS Configuration**](./docs/CORS.md) - Cross-origin resource sharing with security presets
- 🔐 [**Authentication**](./docs/AUTHENTICATION.md) - JWT, sessions, and role-based access control
- 📊 [**Metrics & Monitoring**](./docs/METRICS-MONITORING.md) - Performance tracking & health checks
- 📚 [**API Documentation**](./docs/API-DOCUMENTATION.md) - Auto-generated Swagger docs from code

### **🏗️ Advanced Topics**

- ⚡ [**Performance**](./docs/PERFORMANCE.md) - Optimization techniques
- 🧪 [**Testing**](./docs/TESTING.md) - Unit & integration testing
- 🚀 [**Deployment**](./docs/DEPLOYMENT.md) - Production deployment
- 🔌 [**Plugin Development**](./docs/PLUGINS.md) - Extending NextRush

## 🔧 Framework Comparison

### **vs Express.js**

- ✅ **Built-in security** (no middleware needed)
- ✅ **Zero dependencies** for core features
- ✅ **TypeScript-first** with auto-inference
- ✅ **Enhanced request/response** objects
- ✅ **Built-in file uploads** (no multer needed)
- ✅ **Drop-in compatible** with existing code

### **vs Fastify**

- ✅ **Zero dependencies** (Fastify has 50+ dependencies)
- ✅ **Express.js compatible** (easier migration)
- ✅ **Built-in WebSocket** (no plugins needed)
- ✅ **Multi-syntax templates** built-in
- ✅ **Built-in file uploads** (no plugins needed)

### **vs Koa**

- ✅ **Express.js style** handlers (familiar API)
- ✅ **Built-in body parsing** (no middleware)
- ✅ **Professional static files** built-in
- ✅ **Better TypeScript** support
- ✅ **Built-in security features** (no packages needed)

## 🏆 Production Ready

NextRush is built for **enterprise-grade applications** with:

- 🔒 **Security-first** design with secure defaults
- ⚡ **High performance** optimized for production workloads
- 🛡️ **Comprehensive error handling** and logging
- 📊 **Memory efficient** with smart caching
- 🔧 **Zero-config** deployment ready
- 📈 **Scalable architecture** for microservices

## 📦 Ecosystem

### **Supported Features**

- ✅ All HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
- ✅ Express.js middleware compatibility
- ✅ File uploads with security validation
- ✅ Cookie parsing and management
- ✅ Session handling
- ✅ CORS, CSRF, XSS protection
- ✅ Rate limiting and request throttling
- ✅ JWT & session authentication with RBAC
- ✅ Built-in metrics & monitoring (Prometheus compatible)
- ✅ Auto API documentation with Swagger UI
- ✅ Compression (gzip, brotli)
- ✅ Static file caching with ETags
- ✅ WebSocket rooms and authentication
- ✅ Template partials and helpers
- ✅ Environment-based configuration

### **TypeScript Support**

```typescript
// Full type safety with auto-inference
app.get('/users/:id', (req, res) => {
  req.params.id; // ✅ string
  req.body; // ✅ any (or use generics)
  req.ip(); // ✅ string
  res.json({}); // ✅ type-safe
});
```

## 🌟 Community & Support

### **📞 Getting Help**

- 📖 **Documentation**: [./docs/README.md](./docs/README.md)
- 💬 **GitHub Discussions**: [Ask questions & share ideas](https://github.com/0xTanzim/nextRush/discussions)
- 🐛 **Issues**: [Report bugs & request features](https://github.com/0xTanzim/nextRush/issues)
- 📧 **Email**: [tanzimhossain2@gmail.com](mailto:tanzimhossain2@gmail.com)

### **🤝 Contributing**

We welcome contributions! Check out our:

- 🔧 **[Contributing Guide](./CONTRIBUTING.md)**
- 🎯 **[Development Setup](./docs/DEVELOPMENT.md)**
- 📋 **[Feature Roadmap](./ROADMAP.md)**

### **📈 Roadmap**

- 🔜 **GraphQL integration**
- 🔜 **Database ORM adapters**
- 🔜 **Microservice utilities**
- 🔜 **Monitoring & metrics**
- 🔜 **Serverless deployment**

## ⭐ Show Your Support

If NextRush helps your project, please consider:

- ⭐ **Star this repository**
- 🐦 **Share on Twitter** with `#NextRush`
- 📝 **Write a blog post** about your experience
- 🗣️ **Tell your team** about NextRush

## 📄 License

**MIT License** - see [LICENSE](./LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by developers, for developers**

[⭐ Star on GitHub](https://github.com/0xTanzim/nextRush) • [📖 Read the Docs](./docs/README.md) • [🚀 Get Started](./docs/GETTING-STARTED.md)

</div>
