# 🚀 Advanced Features

> **Smart Body Parser, Custom Error Handling, and Enhanced Developer Experience**

NextRush v2 includes advanced features that enhance developer experience and provide robust error handling capabilities.

## 📋 **Table of Contents**

- [Smart Body Parser](#smart-body-parser)
- [Custom Error Handling](#custom-error-handling)
- [Exception Filters](#exception-filters)
- [Error Factory](#error-factory)
- [Enhanced Request/Response](#enhanced-requestresponse)
- [Built-in Middleware](#built-in-middleware)
- [Plugin System](#plugin-system)
- [Best Practices](#best-practices)

## 🔄 **Smart Body Parser**

The Smart Body Parser automatically detects and parses request bodies based on content-type headers, eliminating the need to manually configure body parsing middleware.

### **Features**

- **Automatic Content-Type Detection**: Parses JSON, URL-encoded, text, and raw data
- **Zero Configuration**: Works out of the box with sensible defaults
- **Customizable**: Supports custom options for each parser type
- **Error Handling**: Graceful error handling with proper HTTP status codes
- **Type Safety**: Full TypeScript support with proper type inference

### **Usage**

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp();

// Automatic body parsing
app.use(app.smartBodyParser());

// With custom options
app.use(
  app.smartBodyParser({
    json: { limit: '10mb' },
    urlencoded: { extended: true },
    text: { limit: '1mb' },
    raw: { limit: '5mb' },
  })
);
```

### **Content-Type Support**

| Content-Type                        | Parser      | Description          |
| ----------------------------------- | ----------- | -------------------- |
| `application/json`                  | JSON        | Parses JSON data     |
| `application/x-www-form-urlencoded` | URL-encoded | Parses form data     |
| `text/*`                            | Text        | Parses plain text    |
| Other types                         | Raw         | Parses as raw buffer |

### **Example Routes**

```typescript
// JSON endpoint
app.post('/api/users', ctx => {
  const { name, email, age } = ctx.body as {
    name: string;
    email: string;
    age?: number;
  };
  ctx.res.json({ success: true, user: { name, email, age } });
});

// Form endpoint
app.post('/api/contact', ctx => {
  const { name, email, message } = ctx.body as {
    name: string;
    email: string;
    message: string;
  };
  ctx.res.json({ success: true, message: 'Contact form submitted' });
});

// Text endpoint
app.post('/api/log', ctx => {
  const logData = ctx.body as string;
  ctx.res.json({ success: true, logged: logData });
});
```

### **Error Handling**

```typescript
// Malformed JSON
app.post('/api/users', ctx => {
  // Automatically returns 400 with proper error format
  // if JSON is malformed
});

// Size limit exceeded
app.use(
  app.smartBodyParser({
    json: { limit: '1kb' },
  })
);
```

## 🛡️ **Custom Error Handling**

NextRush v2 provides a comprehensive error handling system with custom error classes and exception filters.

### **Error Classes**

#### **Base Error Class**

```typescript
import { NextRushError } from 'nextrush-v2';

// Create error from status code
const error = NextRushError.fromStatusCode(404, 'Resource not found');

// Create custom error
const error = new NextRushError('Custom error message', 400, 'CUSTOM_ERROR');
```

#### **HTTP Error Classes**

```typescript
import {
  BadRequestError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  RateLimitError,
} from 'nextrush-v2';

// Validation errors
throw new ValidationError('Email is required', 'email');
throw new ValidationError('Age must be between 18 and 120', 'age', 15);

// HTTP errors
throw new NotFoundError('User not found');
throw new BadRequestError('Invalid parameters');
throw new AuthenticationError('Token required');
throw new AuthorizationError('Admin access required');
throw new ConflictError('Email already exists');
throw new RateLimitError('Too many requests', 60);
```

### **Exception Filters**

Exception filters provide consistent error handling across your application.

```typescript
import {
  BadRequestExceptionFilter,
  ValidationExceptionFilter,
  RateLimitExceptionFilter,
  AuthenticationExceptionFilter,
  GlobalExceptionFilter,
} from 'nextrush-v2';

// Order matters - more specific filters should come first
app.use(
  app.exceptionFilter([
    new BadRequestExceptionFilter(),
    new ValidationExceptionFilter(),
    new RateLimitExceptionFilter(),
    new AuthenticationExceptionFilter(),
    new GlobalExceptionFilter(),
  ])
);
```

### **Error Factory**

The `ErrorFactory` provides convenient methods for creating common error instances.

```typescript
import { ErrorFactory } from 'nextrush-v2';

// Create validation errors
const emailError = ErrorFactory.validation(
  'email',
  'Invalid email format',
  'invalid-email'
);

// Create not found errors
const userError = ErrorFactory.notFound('User');

// Create authentication errors
const authError = ErrorFactory.unauthorized('Token expired');

// Create authorization errors
const permError = ErrorFactory.forbidden('Admin access required');

// Create bad request errors
const paramError = ErrorFactory.badRequest('Invalid parameters');

// Create conflict errors
const conflictError = ErrorFactory.conflict('Email already exists');

// Create rate limit errors
const rateError = ErrorFactory.rateLimit('Too many requests', 60);
```

## 🔧 **Enhanced Request/Response**

NextRush v2 provides enhanced request and response objects with additional functionality.

### **Request Enhancement**

```typescript
app.get('/users/:id', ctx => {
  // Enhanced request properties
  console.log(ctx.requestId); // Unique request ID
  console.log(ctx.method); // HTTP method
  console.log(ctx.path); // Request path
  console.log(ctx.url); // Full URL
  console.log(ctx.headers); // Request headers
  console.log(ctx.params); // Route parameters
  console.log(ctx.query); // Query parameters
  console.log(ctx.body); // Parsed body
});
```

### **Response Enhancement**

```typescript
app.get('/users', ctx => {
  // Enhanced response methods
  ctx.res.json({ users: [] });
  ctx.res.status(201).json({ created: true });
  ctx.res.setHeader('X-Custom', 'value');
  ctx.res.set('Content-Type', 'application/json');
});
```

### **Koa-Style API**

```typescript
app.get('/users', ctx => {
  // Koa-style status setting
  ctx.status = 200;
  ctx.body = { users: [] };

  // Koa-style header setting
  ctx.set('X-Custom', 'value');
});
```

### **Express-Style API**

```typescript
app.get('/users', ctx => {
  // Express-style response
  ctx.res.status(200).json({ users: [] });
  ctx.res.setHeader('X-Custom', 'value');
});
```

## 🛠️ **Built-in Middleware**

NextRush v2 includes a comprehensive set of built-in middleware for common web application needs.

### **Body Parser Middleware**

```typescript
import { json, urlencoded, text, raw } from 'nextrush-v2';

// JSON parsing
app.use(json({ limit: '10mb' }));

// URL-encoded parsing
app.use(urlencoded({ extended: true }));

// Text parsing
app.use(text({ limit: '1mb' }));

// Raw parsing
app.use(raw({ limit: '5mb' }));
```

### **CORS Middleware**

```typescript
import { cors } from 'nextrush-v2';

app.use(
  cors({
    origin: ['http://localhost:3000', 'https://example.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);
```

### **Helmet Security Middleware**

```typescript
import { helmet } from 'nextrush-v2';

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
```

### **Compression Middleware**

```typescript
import { compression } from 'nextrush-v2';

app.use(
  compression({
    level: 6,
    threshold: 1024,
  })
);
```

### **Rate Limiting Middleware**

```typescript
import { rateLimit } from 'nextrush-v2';

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
  })
);
```

### **Request ID Middleware**

```typescript
import { requestId } from 'nextrush-v2';

app.use(
  requestId({
    headerName: 'X-Request-ID',
    echoHeader: false,
    setResponseHeader: true,
  })
);
```

### **Timer Middleware**

```typescript
import { timer } from 'nextrush-v2';

app.use(
  timer({
    headerName: 'X-Response-Time',
    digits: 2,
  })
);
```

### **Logger Middleware**

```typescript
import { logger } from 'nextrush-v2';

app.use(
  logger({
    format: 'combined',
    stream: {
      write: (message: string) => {
        console.log(message.trim());
      },
    },
  })
);
```

## 🔌 **Plugin System**

NextRush v2 uses a plugin-based architecture for extensibility.

### **Logger Plugin**

```typescript
import { LoggerPlugin } from 'nextrush-v2';

const logger = new LoggerPlugin({
  level: 'info',
  transports: [
    new ConsoleTransport(),
    new FileTransport({ filename: 'app.log' }),
  ],
});

app.use(logger);
```

### **Custom Plugins**

```typescript
import { BasePlugin } from 'nextrush-v2';

export class CachePlugin extends BasePlugin {
  public name = 'CachePlugin';
  public version = '1.0.0';

  onInstall(app: Application): void {
    // Plugin installation logic
    this.log('Cache plugin installed');
  }

  onCleanup(): void {
    // Cleanup logic
    this.log('Cache plugin cleaned up');
  }
}
```

## 🎯 **Best Practices**

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

### **6. Use TypeScript for Type Safety**

```typescript
// Good - type your request bodies
app.post('/users', ctx => {
  const { name, email, age } = ctx.body as {
    name: string;
    email: string;
    age?: number;
  };

  // TypeScript will catch missing properties
  if (!name || !email) {
    throw new ValidationError('Name and email are required', 'body');
  }
});

// Avoid - using any types
app.post('/users', ctx => {
  const body = ctx.body as any; // No type safety
});
```

### **7. Test Your Features**

```typescript
import { createApp } from 'nextrush-v2';
import { ValidationError } from 'nextrush-v2';

describe('Features', () => {
  it('should handle smart body parsing', async () => {
    const app = createApp();
    app.use(app.smartBodyParser());

    app.post('/test', ctx => {
      ctx.res.json(ctx.body);
    });

    const response = await fetch('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.test).toBe('data');
  });

  it('should handle validation errors', async () => {
    const app = createApp();

    app.post('/users', ctx => {
      throw new ValidationError('Name is required', 'name');
    });

    const response = await fetch('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.name).toBe('ValidationError');
  });
});
```

## 📊 **Feature Comparison**

| Feature                   | NextRush v2      | Express.js       | Koa.js          |
| ------------------------- | ---------------- | ---------------- | --------------- |
| Smart Body Parser         | ✅ Built-in      | ❌ Manual setup  | ❌ Manual setup |
| Custom Error Classes      | ✅ Comprehensive | ❌ Basic         | ❌ Basic        |
| Exception Filters         | ✅ Built-in      | ❌ Manual        | ❌ Manual       |
| Enhanced Request/Response | ✅ Both APIs     | ❌ Express only  | ❌ Koa only     |
| Built-in Middleware       | ✅ Complete set  | ⚠️ Some built-in | ❌ Minimal      |
| Plugin System             | ✅ Extensible    | ❌ No standard   | ❌ No standard  |
| TypeScript Support        | ✅ First-class   | ⚠️ Community     | ⚠️ Community    |

This comprehensive feature set makes NextRush v2 a powerful, developer-friendly framework for building modern web applications.
