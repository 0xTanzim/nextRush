# 🚀 NextRush Framework Overview

## 📚 Table of Contents

- [📖 Introduction](#-introduction)
- [🔧 Public APIs](#-public-apis)
  - [✨ Core Framework Features](#-core-framework-features)
  - [🏗️ Core Classes and Methods](#️-core-classes-and-methods)
  - [🔌 Built-in Plugins](#-built-in-plugins)
  - [⚡ Enhanced Features](#-enhanced-features)
- [💻 Usage Examples](#-usage-examples)
- [⚙️ Configuration Options](#️-configuration-options)
- [📝 Notes](#-notes)

## 📖 Introduction

NextRush is a modern, TypeScript-first web framework built on top of Node.js that provides a powerful, Express.js-compatible API with enhanced features for building scalable web applications and APIs. The framework combines the simplicity and familiarity of Express.js with advanced features like built-in authentication, comprehensive validation, performance monitoring, WebSocket support, and a plugin-based architecture.

## 🔧 Public APIs

### ✨ Core Framework Features

| Feature                   | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| Express Compatibility     | Drop-in replacement for Express.js with enhanced TypeScript support. |
| Enhanced Request/Response | Extended request and response objects with additional utilities.     |
| Plugin Architecture       | Modular plugin system for extending framework capabilities.          |
| Built-in Middleware       | Pre-configured middleware for common use cases.                      |
| WebSocket Support         | Native WebSocket integration with event-driven architecture.         |
| Template Engine           | Flexible template engine support with multiple rendering backends.   |

### 🏗️ Core Classes and Methods

| Class              | Description                                            |
| ------------------ | ------------------------------------------------------ |
| `Application`      | Main application class with HTTP server management.    |
| `RequestEnhancer`  | Enhanced request object with validation and utilities. |
| `ResponseEnhancer` | Enhanced response object with additional methods.      |
| `Router`           | Advanced routing with parameter validation.            |
| `EventSystem`      | Event-driven architecture for application monitoring.  |

#### Application Core Methods

| Method                      | Signature                                                    | Description                    |
| --------------------------- | ------------------------------------------------------------ | ------------------------------ |
| `get(path, ...handlers)`    | `(path: string, ...handlers: RouteHandler[]) => Application` | Register GET route.            |
| `post(path, ...handlers)`   | `(path: string, ...handlers: RouteHandler[]) => Application` | Register POST route.           |
| `put(path, ...handlers)`    | `(path: string, ...handlers: RouteHandler[]) => Application` | Register PUT route.            |
| `delete(path, ...handlers)` | `(path: string, ...handlers: RouteHandler[]) => Application` | Register DELETE route.         |
| `use(middleware)`           | `(middleware: MiddlewareFunction) => Application`            | Add middleware to application. |
| `listen(port, callback?)`   | `(port: number, callback?: () => void) => Server`            | Start HTTP server.             |
| `ws(path, handler)`         | `(path: string, handler: WebSocketHandler) => Application`   | Register WebSocket route.      |

### 🔌 Built-in Plugins

| Plugin          | Description                                                    |
| --------------- | -------------------------------------------------------------- |
| Authentication  | JWT and session-based authentication with RBAC.                |
| Body Parser     | Request body parsing for JSON, form data, and multipart.       |
| CORS            | Cross-Origin Resource Sharing configuration.                   |
| Rate Limiter    | Request rate limiting with multiple strategies.                |
| Metrics         | Performance monitoring and Prometheus-compatible metrics.      |
| Static Files    | Static file serving with caching and compression.              |
| Template Engine | Template rendering with Mustache, Handlebars, and EJS support. |

### ⚡ Enhanced Features

| Feature          | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| Type Safety      | Full TypeScript support with comprehensive type definitions. |
| Input Validation | Built-in request validation with sanitization.               |
| Error Handling   | Comprehensive error handling with custom error classes.      |
| Performance      | Optimized for high performance with built-in monitoring.     |
| Security         | Built-in security features and best practices.               |
| Extensibility    | Plugin architecture for easy feature extension.              |

## 💻 Usage Examples

### Basic Application Setup

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Hello NextRush!' });
});

// Start server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Enhanced Features Example

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Enable built-in features
app.enableCors();
app.enableBodyParser();
app.enableMetrics();

// Authentication setup
app.useJwt({
  secret: 'your-secret-key',
  expiresIn: '24h',
});

// Protected route with validation
app.post('/api/users', app.requireAuth('jwt'), (req, res) => {
  // Input validation
  const validationRules = {
    email: { required: true, type: 'email' },
    name: { required: true, minLength: 2 },
  };

  const { isValid, errors, sanitized } = req.validate(validationRules);
  if (!isValid) {
    return res.status(400).json({ errors });
  }

  res.json({ user: sanitized });
});

app.listen(3000);
```

### Middleware and Plugins

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Enable plugins
app.enableCors({
  origin: ['http://localhost:3000', 'https://yourdomain.com'],
  credentials: true,
});

app.enableRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

// Custom middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${req.ip()}`);
  next();
});

// Route with multiple middleware
app.get(
  '/api/profile',
  app.requireAuth('jwt'),
  app.requireRole('user'),
  (req, res) => {
    res.json({ profile: req.user });
  }
);

app.listen(3000);
```

### WebSocket Integration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// WebSocket route
app.ws('/chat', (ws, req) => {
  console.log('Client connected');

  ws.on('message', (data) => {
    // Broadcast to all clients
    app.wsBroadcast('/chat', data);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// HTTP route that interacts with WebSocket
app.post('/api/broadcast', (req, res) => {
  const message = req.body.message;
  app.wsBroadcast('/chat', JSON.stringify({ message }));
  res.json({ success: true });
});

app.listen(3000);
```

### Template Engine Usage

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Configure template engine
app.setViews('./views');
app.setTemplateEngine('mustache');

// Serve static files
app.static('/public', './public');

// Route with template rendering
app.get('/dashboard', (req, res) => {
  const data = {
    user: { name: 'John Doe' },
    stats: { visits: 1234, posts: 56 },
  };

  res.render('dashboard', data);
});

app.listen(3000);
```

### Production-Ready Configuration

```typescript
import { createApp } from 'nextrush';
import helmet from 'helmet';

const app = createApp();

// Security middleware
app.use(helmet());

// Production plugins
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true,
});

app.enableRateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
});

app.enableMetrics({
  endpoint: '/metrics',
  authentication: (req) => {
    return req.headers.authorization === `Bearer ${process.env.METRICS_TOKEN}`;
  },
});

// JWT configuration
app.useJwt({
  secret: process.env.JWT_SECRET!,
  expiresIn: '15m',
  algorithm: 'HS256',
});

// Health check
app.addHealthCheck('database', async () => {
  try {
    await database.ping();
    return { status: 'pass' };
  } catch (error) {
    return { status: 'fail', message: error.message };
  }
});

// Global error handling
app.use((error, req, res, next) => {
  console.error('Application error:', error);

  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

## ⚙️ Configuration Options

### Application Configuration

NextRush applications can be configured through various options and environment variables:

```typescript
// Environment-based configuration
const config = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'app',
  },

  // Security
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['*'],
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
};

// Apply configuration
const app = createApp();

app.useJwt(config.jwt);
app.enableCors(config.cors);

app.listen(config.port);
```

### Plugin Configuration

```typescript
// Comprehensive plugin setup
app
  .enableBodyParser({
    json: { limit: '10mb' },
    urlencoded: { extended: true, limit: '10mb' },
  })
  .enableCors({
    origin: ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
  .enableRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests',
  })
  .enableMetrics({
    endpoint: '/metrics',
    format: 'prometheus',
  });
```

## 📝 Notes

- **Express Compatibility**: NextRush is designed as a drop-in replacement for Express.js, meaning existing Express applications can be migrated with minimal changes.

- **TypeScript First**: The framework is built with TypeScript from the ground up, providing excellent IDE support and type safety throughout your application.

- **Performance Optimized**: NextRush includes built-in performance optimizations and monitoring capabilities to help build high-performance applications.

- **Plugin Architecture**: The modular plugin system allows you to include only the features you need, keeping your application lightweight and focused.

- **Production Ready**: Includes essential production features like security middleware, error handling, rate limiting, and health checks out of the box.

- **WebSocket Integration**: Native WebSocket support is built into the framework, making real-time applications easier to develop.

- **Monitoring & Observability**: Built-in metrics collection and health checks provide visibility into your application's performance and health.

- **Security by Default**: Implements security best practices and provides built-in protection against common web vulnerabilities.

- **Flexible Authentication**: Supports both JWT and session-based authentication with role-based access control (RBAC).

- **Developer Experience**: Focuses on developer productivity with features like automatic request validation, comprehensive error messages, and excellent TypeScript support.

For detailed information about specific features, please refer to the individual documentation files for each component.
