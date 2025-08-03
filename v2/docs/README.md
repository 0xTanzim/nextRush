# NextRush v2 Documentation

Welcome to the NextRush v2 documentation! This comprehensive guide will help you understand and use NextRush v2 effectively.

## 📚 Documentation Structure

### **API Reference**

- **[Application](./api/application.md)** - Core application class and methods
- **[Context](./api/context.md)** - Request/response context system
- **[Routing](./api/routing.md)** - Route handling and URL patterns
- **[Middleware](./api/middleware.md)** - Built-in middleware and custom middleware
- **[Features](./api/features.md)** - Advanced features and capabilities
- **[Plugins](./api/plugins.md)** - Plugin system and development
- **[Errors](./api/errors.md)** - Error handling and custom error classes

### **Guides**

- **[Getting Started](./guides/getting-started.md)** - Quick start guide and setup

### **Examples**

- **[Simple API](./examples/simple-api.md)** - Basic API examples
- **[Complete API](./examples/complete-api.md)** - Full-featured API examples

### **Architecture & Design**

- **[Plugin Architecture](./architecture/PLUGIN_ARCHITECTURE_ANALYSIS.md)** - Plugin system design and analysis
- **[Enhanced Request/Response](./Enhanced-Request-Response.md)** - Request/response enhancement system
- **[Express-like Design](./Express-like-Design.md)** - Design principles and patterns

### **Guides**

- **[Getting Started](./guides/getting-started.md)** - Quick start guide and setup
- **[Plugin Type Safety](./guides/PLUGIN_TYPE_SAFETY.md)** - Type safety for plugins
- **[Custom Plugin Development](./guides/CUSTOM_PLUGIN_EXAMPLE.md)** - How to create custom plugins

### **Performance**

- **[Performance Optimization](./performance/PERFORMANCE_OPTIMIZATION.md)** - Performance optimization guide

## 🚀 Quick Start

### Installation

```bash
npm install nextrush-v2
# or
pnpm add nextrush-v2
# or
yarn add nextrush-v2
```

### Basic Usage

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp();

// Add middleware
app.use(app.smartBodyParser());
app.use(
  app.exceptionFilter([
    new ValidationExceptionFilter(),
    new GlobalExceptionFilter(),
  ])
);

// Define routes
app.get('/', ctx => {
  ctx.res.json({ message: 'Hello NextRush v2!' });
});

app.post('/users', ctx => {
  const { name, email } = ctx.body as { name: string; email: string };
  ctx.res.status(201).json({ user: { name, email } });
});

// Start server
app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
```

## 🎯 Key Features

### **Smart Body Parser**

Automatically detects and parses request bodies based on content-type headers.

```typescript
app.use(app.smartBodyParser());

// Automatically handles:
// - application/json
// - application/x-www-form-urlencoded
// - text/*
// - Other content types as raw data
```

### **Custom Error Handling**

Comprehensive error handling with custom error classes and exception filters.

```typescript
import { ValidationError, NotFoundError } from 'nextrush-v2';

app.post('/users', ctx => {
  const { name, email } = ctx.body as any;

  if (!name || !email) {
    throw new ValidationError('Name and email are required', 'body');
  }

  // Process user creation...
});

app.get('/users/:id', ctx => {
  const user = await findUser(ctx.params['id']);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  ctx.res.json(user);
});
```

### **Enhanced Request/Response**

Both Koa-style and Express-style APIs for maximum developer flexibility.

```typescript
// Koa-style
app.get('/users', ctx => {
  ctx.status = 200;
  ctx.body = { users: [] };
  ctx.set('X-Custom', 'value');
});

// Express-style
app.get('/users', ctx => {
  ctx.res.status(200).json({ users: [] });
  ctx.res.setHeader('X-Custom', 'value');
});
```

### **Built-in Middleware**

Comprehensive set of middleware for common web application needs.

```typescript
import { cors, helmet, rateLimit, compression } from 'nextrush-v2';

app.use(
  cors({
    origin: ['http://localhost:3000'],
    credentials: true,
  })
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);

app.use(
  compression({
    level: 6,
    threshold: 1024,
  })
);
```

### **Plugin System**

Extensible plugin architecture for additional functionality.

```typescript
import { LoggerPlugin } from 'nextrush-v2';

const logger = new LoggerPlugin({
  level: 'info',
  transports: [
    new ConsoleTransport(),
    new FileTransport({ filename: 'app.log' }),
  ],
});

logger.install(app);
```

## 📖 Documentation Sections

### **API Reference**

The API reference provides detailed information about all public APIs:

- **[Application](./api/application.md)** - Core application class, configuration, and lifecycle
- **[Context](./api/context.md)** - Request/response context with enhanced properties
- **[Routing](./api/routing.md)** - Route definition, parameters, and URL patterns
- **[Middleware](./api/middleware.md)** - Built-in middleware and custom middleware development
- **[Features](./api/features.md)** - Advanced features like smart body parsing and error handling
- **[Plugins](./api/plugins.md)** - Plugin system and development guidelines
- **[Errors](./api/errors.md)** - Error classes, exception filters, and error factory

### **Guides**

Step-by-step guides for common tasks:

- **[Getting Started](./guides/getting-started.md)** - Complete setup guide with examples

### **Examples**

Real-world examples demonstrating NextRush v2 capabilities:

- **[Simple API](./examples/simple-api.md)** - Basic REST API with CRUD operations
- **[Complete API](./examples/complete-api.md)** - Full-featured API with authentication, validation, and error handling

### **Architecture & Design**

Architecture and design decisions:

- **[Plugin Architecture](./architecture/PLUGIN_ARCHITECTURE_ANALYSIS.md)** - Plugin system design and analysis
- **[Enhanced Request/Response](./Enhanced-Request-Response.md)** - Request/response enhancement system design
- **[Express-like Design](./Express-like-Design.md)** - Design principles and patterns

### **Guides**

Step-by-step guides for advanced topics:

- **[Getting Started](./guides/getting-started.md)** - Complete setup guide with examples
- **[Plugin Type Safety](./guides/PLUGIN_TYPE_SAFETY.md)** - Type safety for plugins
- **[Custom Plugin Development](./guides/CUSTOM_PLUGIN_EXAMPLE.md)** - How to create custom plugins

### **Performance**

Performance optimization and benchmarking:

- **[Performance Optimization](./performance/PERFORMANCE_OPTIMIZATION.md)** - Performance optimization guide

## 🔧 Development

### **TypeScript Support**

NextRush v2 is built with TypeScript and provides excellent type safety:

```typescript
import { createApp } from 'nextrush-v2';
import type { Context } from 'nextrush-v2';

const app = createApp();

app.post('/users', (ctx: Context) => {
  // Full TypeScript support
  const { name, email } = ctx.body as { name: string; email: string };

  if (!name || !email) {
    throw new ValidationError('Name and email are required', 'body');
  }

  ctx.res.status(201).json({ user: { name, email } });
});
```

### **Testing**

NextRush v2 includes comprehensive testing support:

```typescript
import { createApp } from 'nextrush-v2';

describe('User API', () => {
  it('should create a user', async () => {
    const app = createApp();

    app.post('/users', ctx => {
      const { name, email } = ctx.body as any;
      ctx.res.status(201).json({ user: { name, email } });
    });

    const response = await fetch('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.user.name).toBe('John');
  });
});
```

### **Performance**

NextRush v2 is optimized for high performance:

- **Zero Dependencies**: Built on Node.js built-in modules
- **Memory Efficient**: Lightweight objects and efficient algorithms
- **Type Safety**: Compile-time error checking
- **Middleware Optimization**: Efficient middleware composition

## 🎯 Best Practices

### **1. Use Smart Body Parser**

```typescript
// Good - automatic content-type detection
app.use(app.smartBodyParser());

// Avoid - manual content-type checking
app.use((ctx, next) => {
  if (ctx.headers['content-type'] === 'application/json') {
    // Manual JSON parsing
  }
  next();
});
```

### **2. Handle Errors Consistently**

```typescript
// Good - use specific error types
if (!user) {
  throw new NotFoundError('User not found');
}

// Good - use error factory
const error = ErrorFactory.validation('email', 'Invalid format', email);

// Avoid - generic errors
if (!user) {
  throw new Error('User not found');
}
```

### **3. Use Exception Filters**

```typescript
// Good - consistent error handling
app.use(
  app.exceptionFilter([
    new BadRequestExceptionFilter(),
    new ValidationExceptionFilter(),
    new GlobalExceptionFilter(),
  ])
);

// Avoid - manual error handling in each route
app.get('/users', ctx => {
  try {
    // Route logic
  } catch (error) {
    ctx.status = 500;
    ctx.res.json({ error: error.message });
  }
});
```

### **4. Leverage Enhanced APIs**

```typescript
// Good - use enhanced request properties
app.get('/users/:id', ctx => {
  const userId = ctx.params['id'];
  const query = ctx.query.search;
  const requestId = ctx.requestId;

  ctx.res.json({ userId, query, requestId });
});

// Good - use both Koa and Express styles
app.get('/users', ctx => {
  // Koa style
  ctx.status = 200;
  ctx.body = { users: [] };

  // Express style
  ctx.res.status(200).json({ users: [] });
});
```

### **5. Configure Middleware Appropriately**

```typescript
// Good - configure middleware for your needs
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX || 100,
  })
);

// Avoid - using default configurations without consideration
app.use(cors());
app.use(rateLimit());
```

## 🔗 Related Resources

- **[GitHub Repository](https://github.com/your-org/nextrush-v2)** - Source code and issues
- **[NPM Package](https://www.npmjs.com/package/nextrush-v2)** - Installation and updates
- **[API Reference](./api/)** - Complete API documentation
- **[Examples](./examples/)** - Real-world usage examples

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for more information.

## 📄 License

NextRush v2 is licensed under the MIT License. See the LICENSE file for details.

---

**NextRush v2** - A modern, type-safe, and developer-friendly web framework for Node.js.
