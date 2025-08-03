# 🚀 Quick Start Guide

> **Build Your First NextRush v2 Application in 5 Minutes**

This guide will walk you through creating your first NextRush v2 application with all the essential features.

## 📋 **Table of Contents**

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Your First App](#your-first-app)
- [Adding Middleware](#adding-middleware)
- [Creating Routes](#creating-routes)
- [Error Handling](#error-handling)
- [Testing Your App](#testing-your-app)
- [Next Steps](#next-steps)

## ✅ **Prerequisites**

Before you start, make sure you have:

- **Node.js** 18+ installed
- **TypeScript** knowledge (basic)
- **npm**, **yarn**, or **pnpm** package manager

### **Check Your Setup**

```bash
# Check Node.js version
node --version  # Should be 18+

# Check package manager
npm --version   # or yarn --version or pnpm --version
```

## 📦 **Installation**

### **Create a New Project**

```bash
# Create a new directory
mkdir my-nextrush-app
cd my-nextrush-app

# Initialize package.json
npm init -y

# Install NextRush v2
npm install nextrush-v2

# Install TypeScript and development dependencies
npm install -D typescript @types/node tsx
```

### **Setup TypeScript**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### **Setup Package Scripts**

Update `package.json`:

```json
{
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  }
}
```

## 🎯 **Your First App**

### **Basic Application**

Create `src/index.ts`:

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp({
  port: 3000,
  debug: true,
});

// Basic route
app.get('/', ctx => {
  ctx.res.json({ message: 'Hello NextRush v2!' });
});

// Start the server
app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
```

### **Run Your App**

```bash
# Development mode
npm run dev

# Or build and run
npm run build
npm start
```

### **Test Your App**

```bash
# Test with curl
curl http://localhost:3000

# Expected response
# {"message":"Hello NextRush v2!"}
```

## 🔧 **Adding Middleware**

### **Essential Middleware Setup**

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp({
  port: 3000,
  debug: true,
});

// Security middleware
app.use(app.helmet());
app.use(app.cors());

// Body parsing
app.use(app.json({ limit: '10mb' }));
app.use(app.urlencoded({ extended: true }));

// Request tracking
app.use(app.requestId());
app.use(app.timer());

// Rate limiting
app.use(app.rateLimit({ max: 100, windowMs: 15 * 60 * 1000 }));

// Logging
app.use(app.logger());

// Routes
app.get('/', ctx => {
  ctx.res.json({ message: 'Hello NextRush v2!' });
});

app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
```

### **Custom Middleware**

```typescript
// Authentication middleware
app.use(async (ctx, next) => {
  const token = ctx.headers.authorization;

  if (ctx.path.startsWith('/api/') && !token) {
    ctx.status = 401;
    ctx.res.json({ error: 'Authentication required' });
    return;
  }

  await next();
});

// Error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.status = 500;
    ctx.res.json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
});
```

## 🛣️ **Creating Routes**

### **Basic Routes**

```typescript
// GET route
app.get('/api/users', ctx => {
  ctx.res.json({ users: [] });
});

// POST route
app.post('/api/users', ctx => {
  const { name, email } = ctx.body;
  ctx.res.json({ success: true, user: { name, email } });
});

// Route with parameters
app.get('/api/users/:id', ctx => {
  const userId = ctx.params.id;
  ctx.res.json({ userId });
});

// PUT route
app.put('/api/users/:id', ctx => {
  const userId = ctx.params.id;
  const updates = ctx.body;
  ctx.res.json({ success: true, userId, updates });
});

// DELETE route
app.delete('/api/users/:id', ctx => {
  const userId = ctx.params.id;
  ctx.res.json({ success: true, deleted: userId });
});
```

### **Route with Validation**

```typescript
app.post('/api/users', ctx => {
  // Validate input
  const validation = ctx.req.validate({
    name: { required: true, minLength: 2 },
    email: { required: true, type: 'email' },
    age: { type: 'number', min: 18 },
  });

  if (!validation.isValid) {
    ctx.res.status(400).json({ errors: validation.errors });
    return;
  }

  // Sanitize input
  const sanitized = ctx.req.sanitize(ctx.body, {
    trim: true,
    removeHtml: true,
  });

  ctx.res.json({ success: true, data: sanitized });
});
```

### **Router Usage**

```typescript
// Create a router
const userRouter = app.router();

userRouter.get('/', ctx => {
  ctx.res.json({ users: [] });
});

userRouter.post('/', ctx => {
  ctx.res.json({ success: true });
});

userRouter.get('/:id', ctx => {
  ctx.res.json({ userId: ctx.params.id });
});

// Mount router
app.use('/api/users', userRouter);
```

## ❌ **Error Handling**

### **Built-in Error Handling**

```typescript
// NextRush automatically handles common errors
app.get('/error', ctx => {
  throw new Error('Something went wrong');
});

// Custom error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    if (error.status) {
      ctx.status = error.status;
      ctx.res.json({ error: error.message });
    } else {
      ctx.status = 500;
      ctx.res.json({ error: 'Internal Server Error' });
    }
  }
});
```

### **Custom Error Types**

```typescript
import { ValidationError, NotFoundError } from 'nextrush-v2';

app.post('/api/users', ctx => {
  const { name, email } = ctx.body;

  if (!name) {
    throw new ValidationError('Name is required', 'name');
  }

  if (!email) {
    throw new ValidationError('Email is required', 'email');
  }

  ctx.res.json({ success: true });
});

app.get('/api/users/:id', ctx => {
  const userId = ctx.params.id;
  const user = await getUser(userId);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  ctx.res.json({ user });
});
```

## 🧪 **Testing Your App**

### **Manual Testing**

```bash
# Test GET request
curl http://localhost:3000/api/users

# Test POST request
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com"}'

# Test route with parameters
curl http://localhost:3000/api/users/123

# Test error handling
curl http://localhost:3000/error
```

### **Automated Testing**

Create `src/app.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createApp } from 'nextrush-v2';

describe('NextRush App', () => {
  it('should handle GET requests', async () => {
    const app = createApp();

    app.get('/test', ctx => {
      ctx.res.json({ message: 'Hello' });
    });

    // Test your routes here
    // You can use supertest or similar for HTTP testing
  });

  it('should handle POST requests', async () => {
    const app = createApp();

    app.post('/test', ctx => {
      const { name } = ctx.body;
      ctx.res.json({ success: true, name });
    });

    // Test POST requests
  });
});
```

### **Install Testing Dependencies**

```bash
npm install -D vitest supertest @types/supertest
```

## 📚 **Complete Example**

Here's a complete example that demonstrates all the features:

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp({
  port: 3000,
  debug: true,
});

// Security middleware
app.use(app.helmet());
app.use(app.cors());

// Body parsing
app.use(app.json({ limit: '10mb' }));
app.use(app.urlencoded({ extended: true }));

// Request tracking
app.use(app.requestId());
app.use(app.timer());

// Rate limiting
app.use(app.rateLimit({ max: 100, windowMs: 15 * 60 * 1000 }));

// Logging
app.use(app.logger());

// Custom middleware
app.use(async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path} - ${ctx.ip}`);
  await next();
});

// Error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.status = error.status || 500;
    ctx.res.json({
      error: error.message || 'Internal Server Error',
      statusCode: ctx.status,
    });
  }
});

// Routes
app.get('/', ctx => {
  ctx.res.json({
    message: 'Hello NextRush v2!',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/users', ctx => {
  ctx.res.json({
    users: [
      { id: 1, name: 'John', email: 'john@example.com' },
      { id: 2, name: 'Jane', email: 'jane@example.com' },
    ],
  });
});

app.post('/api/users', ctx => {
  const { name, email } = ctx.body;

  // Validate input
  if (!name || !email) {
    ctx.res.status(400).json({ error: 'Name and email are required' });
    return;
  }

  ctx.res.json({
    success: true,
    user: { id: 3, name, email },
  });
});

app.get('/api/users/:id', ctx => {
  const userId = ctx.params.id;
  ctx.res.json({ userId, name: 'John', email: 'john@example.com' });
});

app.put('/api/users/:id', ctx => {
  const userId = ctx.params.id;
  const updates = ctx.body;
  ctx.res.json({ success: true, userId, updates });
});

app.delete('/api/users/:id', ctx => {
  const userId = ctx.params.id;
  ctx.res.json({ success: true, deleted: userId });
});

// Health check
app.get('/health', ctx => {
  ctx.res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Start server
app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
  console.log('📋 Available endpoints:');
  console.log('  GET  /health');
  console.log('  GET  /');
  console.log('  GET  /api/users');
  console.log('  POST /api/users');
  console.log('  GET  /api/users/:id');
  console.log('  PUT  /api/users/:id');
  console.log('  DELETE /api/users/:id');
});
```

## 🎯 **Next Steps**

Now that you have a basic NextRush v2 application running, here are some next steps:

### **1. Explore Advanced Features**

- [Context System](../api/context.md) - Learn about the rich context object
- [Middleware System](../api/middleware.md) - Master middleware composition
- [Routing](../api/routing.md) - Advanced routing techniques
- [Security](../api/security.md) - Security best practices

### **2. Build Real Applications**

- [Full-Stack Application](../examples/full-stack.md) - Complete web application
- [API Server](../examples/api-server.md) - RESTful API with authentication
- [WebSocket Chat](../examples/websocket-chat.md) - Real-time communication
- [File Upload Service](../examples/file-upload.md) - File handling

### **3. Production Deployment**

- [Performance Optimization](../guides/performance.md) - Optimize for production
- [Security Hardening](../guides/security.md) - Secure your application
- [Testing Strategies](../guides/testing.md) - Comprehensive testing
- [Deployment Guide](../guides/deployment.md) - Deploy to production

### **4. Community & Support**

- [API Reference](../api/) - Complete API documentation
- [Examples](../examples/) - Working code examples
- [Migration Guide](../guides/migration.md) - Migrate from Express.js
- [Contributing](../guides/contributing.md) - Contribute to NextRush

## 🆘 **Getting Help**

If you run into issues:

1. **Check the logs** - NextRush provides detailed logging
2. **Review the docs** - Comprehensive documentation available
3. **Test with curl** - Verify your endpoints manually
4. **Check TypeScript** - Ensure type safety

### **Common Issues**

```bash
# Port already in use
# Change the port in createApp({ port: 3001 })

# TypeScript errors
# Check your tsconfig.json and imports

# Middleware not working
# Ensure middleware is registered before routes
```

---

**🎉 Congratulations!** You've successfully created your first NextRush v2 application. The framework provides a solid foundation for building modern, type-safe web applications with excellent developer experience.
