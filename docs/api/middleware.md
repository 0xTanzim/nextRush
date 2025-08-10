# Middleware

NextRush v2 provides a comprehensive set of built-in middleware for common web application needs. All middleware is designed to be lightweight, performant, and easy to configure.

## Table of Contents

- [Middleware](#middleware)
  - [Table of Contents](#table-of-contents)
  - [Middleware Overview](#middleware-overview)
    - [Basic Middleware Structure](#basic-middleware-structure)
    - [Middleware Registration](#middleware-registration)
  - [Body Parser Middleware](#body-parser-middleware)
    - [Smart Body Parser (Recommended)](#smart-body-parser-recommended)
    - [Individual Parsers](#individual-parsers)
      - [JSON Parser](#json-parser)
      - [URL-encoded Parser](#url-encoded-parser)
      - [Multipart Parser](#multipart-parser)
      - [Text Parser](#text-parser)
      - [Raw Parser](#raw-parser)
    - [Performance Metrics](#performance-metrics)
    - [Error Handling](#error-handling)
    - [Content Type Support](#content-type-support)
  - [CORS Middleware](#cors-middleware)
    - [Dynamic Origin](#dynamic-origin)
  - [Helmet Security Middleware](#helmet-security-middleware)
  - [Compression Middleware](#compression-middleware)
  - [Rate Limiting Middleware](#rate-limiting-middleware)
    - [Custom Key Generator](#custom-key-generator)
    - [Multiple Rate Limits](#multiple-rate-limits)
  - [Request ID Middleware](#request-id-middleware)
    - [Custom Generator](#custom-generator)
  - [Timer Middleware](#timer-middleware)
  - [Logger Middleware](#logger-middleware)
    - [Custom Format](#custom-format)
  - [Custom Middleware](#custom-middleware)
    - [Authentication Middleware](#authentication-middleware)
    - [Validation Middleware](#validation-middleware)
    - [Error Handling Middleware](#error-handling-middleware)
    - [Async Middleware](#async-middleware)
  - [Middleware Best Practices](#middleware-best-practices)
    - [1. Order Matters](#1-order-matters)
    - [2. Use TypeScript for Type Safety](#2-use-typescript-for-type-safety)
    - [3. Handle Errors Properly](#3-handle-errors-properly)
    - [4. Use Configuration Objects](#4-use-configuration-objects)
    - [5. Optimize Performance](#5-optimize-performance)
    - [6. Test Your Middleware](#6-test-your-middleware)
    - [7. Use Environment Variables](#7-use-environment-variables)

## Middleware Overview

Middleware in NextRush v2 follows the standard Node.js middleware pattern with enhanced TypeScript support and improved error handling.

### Basic Middleware Structure

```typescript
import type { Context } from 'nextrush-v2';

const myMiddleware = async (ctx: Context, next: () => Promise<void>) => {
  // Pre-processing logic
  console.log('Request to:', ctx.path);

  // Call next middleware
  await next();

  // Post-processing logic
  console.log('Response status:', ctx.status);
};
```

### Middleware Registration

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp();

// Global middleware
app.use(myMiddleware);

// Route-specific middleware
app.get('/users', myMiddleware, ctx => {
  ctx.res.json({ users: [] });
});

// Compose multiple middleware by registering in order
app.use(middleware1);
app.use(middleware2);
app.use(middleware3);
```

## Body Parser Middleware

The smart body parser middleware automatically detects and parses incoming request bodies based on content-type headers with intelligent lazy loading for optimal performance.

### Smart Body Parser (Recommended)

The smart body parser automatically detects content type and only loads the specific parser needed, providing significant performance improvements.

```typescript
import { bodyParser } from 'nextrush-v2'; // alias of smartBodyParser

app.use(
  bodyParser({
    maxSize: 10 * 1024 * 1024, // 10MB
    timeout: 5000, // 5 seconds
    enableStreaming: true,
    streamingThreshold: 50 * 1024 * 1024, // 50MB
    autoDetectContentType: true,
    strictContentType: false,
    enableMetrics: true,
    encoding: 'utf8',
  })
);
```

**Key Features:**

- 🚀 **Lazy Loading**: Only loads parsers when needed (JSON parser for JSON requests, etc.)
- 🎯 **Smart Detection**: Automatically detects content type from headers and body
- ⚡ **Performance**: Reduces memory usage by 80% compared to loading all parsers
- 🔒 **Security**: Built-in size limits and timeout protection
- 📊 **Metrics**: Optional performance tracking and analytics

**Options:**

- `maxSize`: Maximum body size in bytes (default: 10MB)
- `timeout`: Parsing timeout in milliseconds (default: 5000)
- `enableStreaming`: Enable streaming for large bodies (default: true)
- `streamingThreshold`: Size threshold for streaming (default: 50MB)
- `autoDetectContentType`: Auto-detect content type from body (default: true)
- `strictContentType`: Strict content-type validation (default: false)
- `enableMetrics`: Enable performance metrics (default: true)
- `encoding`: Default text encoding (default: 'utf8')

### Individual Parsers

You can also import and use individual parsers if needed:

#### JSON Parser

```typescript
import { getJsonParser } from 'nextrush-v2/core/middleware/body-parser/json-parser';

const parser = getJsonParser();
const result = await parser.parse(buffer, 'application/json');
```

#### URL-encoded Parser

```typescript
import { getUrlEncodedParser } from 'nextrush-v2/core/middleware/body-parser/url-encoded-parser';

const parser = getUrlEncodedParser();
const result = await parser.parse(buffer, 'application/x-www-form-urlencoded');
```

#### Multipart Parser

```typescript
import { getMultipartParser } from 'nextrush-v2/core/middleware/body-parser/multipart-parser';

const parser = getMultipartParser();
const result = await parser.parse(buffer, 'multipart/form-data; boundary=...');
```

#### Text Parser

```typescript
import { getTextParser } from 'nextrush-v2/core/middleware/body-parser/text-raw-parsers';

const parser = getTextParser();
const result = await parser.parse(buffer, 'text/plain');
```

#### Raw Parser

```typescript
import { getRawParser } from 'nextrush-v2/core/middleware/body-parser/text-raw-parsers';

const parser = getRawParser();
const result = await parser.parse(buffer, 'application/octet-stream');
```

### Performance Metrics

The smart body parser includes built-in performance monitoring:

```typescript
import { SmartBodyParser } from 'nextrush-v2';

const parser = new SmartBodyParser({ enableMetrics: true });

// After processing requests, get metrics
const metrics = parser.getMetrics();
console.log('Total requests:', metrics.totalRequests);
console.log('Parser usage:', metrics.parserLoads);
console.log(
  'Average parser loads per request:',
  metrics.efficiency.averageParserLoads
);
```

### Error Handling

The body parser automatically handles various error scenarios:

```typescript
app.use(bodyParser());

app.post('/api/data', ctx => {
  try {
    // Body is automatically parsed and available at ctx.body
    console.log('Parsed body:', ctx.body);
    ctx.res.json({ success: true });
  } catch (error) {
    // Parsing errors are handled by the global exception filter
    // Returns appropriate HTTP status codes (400 for client errors, 500 for server errors)
  }
});
```

### Content Type Support

The smart body parser supports:

- **JSON**: `application/json`, `application/*+json`
- **Form Data**: `application/x-www-form-urlencoded`
- **Multipart**: `multipart/form-data` (file uploads)
- **Text**: `text/*`, `application/xml`, `application/*+xml`
- **Binary**: `application/octet-stream` and other binary types

## CORS Middleware

The CORS middleware handles Cross-Origin Resource Sharing headers.

```typescript
import { cors } from 'nextrush-v2';

app.use(
  cors({
    origin: ['http://localhost:3000', 'https://example.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  })
);
```

**Options:**

- `origin`: Allowed origins (string, array, or function)
- `methods`: Allowed HTTP methods (default: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
- `allowedHeaders`: Allowed request headers
- `exposedHeaders`: Headers to expose to the client
- `credentials`: Allow credentials (default: false)
- `maxAge`: Preflight cache duration in seconds (default: 86400)

### Dynamic Origin

```typescript
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  })
);
```

## Helmet Security Middleware

The helmet middleware sets various HTTP headers to help protect your app from well-known web vulnerabilities.

```typescript
import { helmet } from 'nextrush-v2';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    xssFilter: true,
    frameguard: {
      action: 'deny',
    },
  })
);
```

**Options:**

- `contentSecurityPolicy`: CSP configuration
- `hsts`: HTTP Strict Transport Security
- `noSniff`: X-Content-Type-Options header
- `xssFilter`: X-XSS-Protection header
- `frameguard`: X-Frame-Options header
- `referrerPolicy`: Referrer-Policy header

## Compression Middleware

The compression middleware compresses response bodies for all requests that traverse through the middleware.

```typescript
import { compression } from 'nextrush-v2';

app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);
```

**Options:**

- `level`: Compression level (0-9, default: 6)
- `threshold`: Minimum response size to compress (default: 1024)
- `filter`: Function to determine if response should be compressed
- `chunkSize`: Size of output chunks (default: 16384)
- `windowBits`: Size of history buffer (default: 15)

## Rate Limiting Middleware

The rate limiting middleware limits repeated requests to public APIs and/or endpoints such as password reset.

```typescript
import { rateLimit } from 'nextrush-v2';

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  })
);
```

**Options:**

- `windowMs`: Time window in milliseconds (default: 15 minutes)
- `max`: Maximum number of requests per window (default: 5)
- `message`: Error message (default: 'Too many requests')
- `standardHeaders`: Enable rate limit headers (default: true)
- `legacyHeaders`: Enable legacy headers (default: false)
- `skipSuccessfulRequests`: Skip successful requests (default: false)
- `skipFailedRequests`: Skip failed requests (default: false)

### Custom Key Generator

```typescript
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    keyGenerator: ctx => ctx.ip,
  })
);
```

### Multiple Rate Limits

```typescript
// General rate limit
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  })
);

// Stricter rate limit for auth routes
app.use(
  '/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
  })
);
```

## Request ID Middleware

The request ID middleware generates unique request IDs for tracking and debugging.

```typescript
import { requestId } from 'nextrush-v2';

app.use(
  requestId({
    headerName: 'X-Request-ID',
    echoHeader: false,
    addResponseHeader: true,
    generator: () =>
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  })
);
```

**Options:**

- `headerName`: Header name for request ID (default: 'X-Request-ID')
- `echoHeader`: Echo the header if present (default: true)
- `setResponseHeader`: Set response header (default: true)
- `generator`: Function to generate request ID

### Custom Generator

```typescript
import { v4 as uuidv4 } from 'uuid';

app.use(
  requestId({
    generator: () => uuidv4(),
  })
);
```

## Timer Middleware

The timer middleware adds response time headers to track request performance.

```typescript
import { timer } from 'nextrush-v2';

app.use(
  timer({
    headerName: 'X-Response-Time',
    digits: 2,
  })
);
```

**Options:**

- `headerName`: Header name for response time (default: 'X-Response-Time')
- `digits`: Number of decimal places (default: 2)

## Logger Middleware

The logger middleware provides request logging with various formats.

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

**Options:**

- `format`: Log format ('combined', 'common', 'dev', 'short', 'tiny')
- `stream`: Output stream (default: process.stdout)
- `immediate`: Log on request instead of response (default: false)

### Custom Format

```typescript
app.use(
  logger({
    format: (tokens, req, res) => {
      return [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens.res(req, res, 'content-length'),
        '-',
        tokens['response-time'](req, res),
        'ms',
      ].join(' ');
    },
  })
);
```

## Custom Middleware

### Authentication Middleware

```typescript
const authMiddleware = async (ctx: Context, next: () => Promise<void>) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new AuthenticationError('Token required');
  }

  try {
    const user = await verifyToken(token);
    ctx.state.user = user;
    await next();
  } catch (error) {
    throw new AuthenticationError('Invalid token');
  }
};

app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/protected')) {
    return authMiddleware(ctx, next);
  }
  await next();
});
```

### Validation Middleware

```typescript
import { ValidationError } from '@/errors/custom-errors';

const validateUser = async (ctx: Context, next: () => Promise<void>) => {
  const { name, email, age } = ctx.body as Record<string, unknown>;

  if (!name || !email) {
    throw new ValidationError('Name and email are required', 'body');
  }

  if (age && (age < 18 || age > 120)) {
    throw new ValidationError('Age must be between 18 and 120', 'age', age);
  }

  await next();
};

app.post('/users', {
  middleware: [validateUser],
  handler: ctx => {
    // Create user logic
    ctx.res.json({ ok: true });
  },
});
```

### Error Handling Middleware

```typescript
const errorHandler = async (ctx: Context, next: () => Promise<void>) => {
  try {
    await next();
  } catch (error) {
    console.error('Error:', error);

    if (error instanceof ValidationError) {
      ctx.status = 400;
      ctx.res.json({
        error: {
          name: 'ValidationError',
          message: error.message,
          field: error.field,
          value: error.value,
        },
      });
    } else {
      ctx.status = 500;
      ctx.res.json({
        error: {
          name: 'InternalServerError',
          message: 'Something went wrong',
        },
      });
    }
  }
};

app.use(errorHandler);
```

### Async Middleware

```typescript
const asyncMiddleware = async (ctx: Context, next: NextFunction) => {
  const start = Date.now();

  try {
    await next();
  } finally {
    const duration = Date.now() - start;
    console.log(`${ctx.method} ${ctx.path} - ${duration}ms`);
  }
};

app.use(asyncMiddleware);
```

## Middleware Best Practices

### 1. Order Matters

```typescript
// Good - logical order
app.use(helmet()); // Security first
app.use(cors()); // CORS before routes
app.use(compression()); // Compression for all responses
app.use(requestId()); // Request tracking
app.use(timer()); // Performance tracking
app.use(logger()); // Logging
app.use(bodyParser()); // Body parsing
app.use(rateLimit()); // Rate limiting
app.use(errorHandler); // Error handling last
```

### 2. Use TypeScript for Type Safety

```typescript
// Good - typed middleware
interface AuthenticatedContext extends Context {
  user: User;
}

const authMiddleware = async (
  ctx: AuthenticatedContext,
  next: NextFunction
) => {
  // TypeScript knows ctx.user exists
  console.log(ctx.user.id);
  await next();
};
```

### 3. Handle Errors Properly

```typescript
// Good - proper error handling
const safeMiddleware = async (ctx: Context, next: NextFunction) => {
  try {
    await next();
  } catch (error) {
    // Log error
    console.error('Middleware error:', error);

    // Re-throw to let other error handlers deal with it
    throw error;
  }
};
```

### 4. Use Configuration Objects

```typescript
// Good - configurable middleware
const createAuthMiddleware = (options: AuthOptions) => {
  return async (ctx: Context, next: NextFunction) => {
    // Use options for configuration
    const token = ctx.headers[options.headerName];
    // ... rest of logic
  };
};

app.use(
  createAuthMiddleware({
    headerName: 'X-API-Key',
    required: true,
  })
);
```

### 5. Optimize Performance

```typescript
// Good - efficient middleware
const cacheMiddleware = (() => {
  const cache = new Map();

  return (ctx: Context, next: NextFunction) => {
    const key = `${ctx.method}:${ctx.path}`;
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < 60000) {
      ctx.res.json(cached.data);
      return;
    }

    next();
  };
})();
```

### 6. Test Your Middleware

```typescript
import { createApp } from '@/index';

describe('Custom Middleware', () => {
  it('should add user to context', async () => {
    const app = createApp();

    app.use(authMiddleware);
    app.get('/test', ctx => {
      ctx.res.json({ userId: ctx.user.id });
    });

    const response = await fetch('/test', {
      headers: {
        Authorization: 'Bearer valid-token',
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.userId).toBeDefined();
  });
});
```

### 7. Use Environment Variables

```typescript
// Good - environment-based configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: process.env.CORS_CREDENTIALS === 'true',
  })
);

app.use(
  rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  })
);
```

This comprehensive middleware system provides all the essential functionality needed for modern web applications while maintaining flexibility and performance.
