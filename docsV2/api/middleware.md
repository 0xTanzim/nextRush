# Middleware API Reference

Middleware functions in NextRush v2 execute code before your route handlers. Use built-in middleware for common tasks or create custom middleware for specific needs.

## 📖 What it is

Middleware is a function that executes during the request/response cycle. Each middleware can modify the context, perform tasks, and decide whether to continue to the next middleware.

## ⚡ When to use

Use middleware for:

- 🔐 Authentication and authorization
- 📊 Request logging and metrics
- ✅ Input validation and sanitization
- 🚨 Error handling
- 🛡️ Security headers (CORS, Helmet)
- 🔄 Request/response transformation

## 📝 TypeScript signature

```typescript
type Middleware = (ctx: Context, next: () => Promise<void>) => Promise<void>;
```

---

# 🏗️ Built-in Middleware

NextRush v2 includes production-ready middleware for common tasks.

---

## 📦 bodyParser - Smart body parsing

**What it is**: Intelligent body parser that only loads the parser needed for each request type.

**When to use**: Parse JSON, form data, multipart, or raw request bodies.

**Signature**:

```typescript
function smartBodyParser(options?: SmartBodyParserOptions): Middleware;
```

**Parameters**:

- `jsonLimit` (string): Maximum JSON payload size (default: '1mb')
- `formLimit` (string): Maximum form payload size (default: '1mb')
- `textLimit` (string): Maximum text payload size (default: '1mb')
- `multipartLimit` (string): Maximum multipart payload size (default: '10mb')
- `enableSmartParsing` (boolean): Enable intelligent parser selection (default: true)

**Example**:

```typescript
import { createApp, bodyParser } from 'nextrush';

const app = createApp();

// Basic usage
app.use(bodyParser());

// With custom limits
app.use(
  bodyParser({
    jsonLimit: '5mb',
    multipartLimit: '50mb',
    formLimit: '2mb',
  })
);

// Access parsed body
app.post('/users', async ctx => {
  const userData = ctx.body as { name: string; email: string };
  ctx.json({ received: userData });
});
```

---

## 🌍 cors - Cross-Origin Resource Sharing

**What it is**: Handles CORS headers for cross-origin requests with pre-computed header optimization.

**When to use**: Enable cross-origin requests from browsers.

**Signature**:

```typescript
function cors(options?: CorsOptions): Middleware;
```

**Parameters**:

- `origin` (string | string[] | boolean | function): Allowed origins (default: '\*')
- `methods` (string[]): Allowed HTTP methods (default: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'])
- `allowedHeaders` (string[]): Allowed request headers (default: ['Content-Type', 'Authorization'])
- `credentials` (boolean): Allow credentials (default: false)
- `maxAge` (number): Preflight cache duration in seconds (default: 86400)

**Example**:

```typescript
import { cors } from 'nextrush';

// Basic CORS (allows all origins)
app.use(cors());

// Specific origins
app.use(
  cors({
    origin: ['https://myapp.com', 'https://admin.myapp.com'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  })
);

// Dynamic origin validation
app.use(
  cors({
    origin: origin => {
      return origin.endsWith('.mycompany.com');
    },
    credentials: true,
  })
);
```

---

## 🛡️ helmet - Security headers

**What it is**: Sets security-related HTTP headers to protect against common vulnerabilities.

**When to use**: Add security headers to all responses in production.

**Signature**:

```typescript
function helmet(options?: HelmetOptions): Middleware;
```

**Parameters**:

- `contentSecurityPolicy` (object): CSP directives and settings
- `hsts` (object): HTTP Strict Transport Security settings
- `xssFilter` (boolean): Enable XSS filter (default: true)
- `noSniff` (boolean): Prevent MIME type sniffing (default: true)
- `frameguard` (object): X-Frame-Options settings
- `hidePoweredBy` (boolean): Hide X-Powered-By header (default: true)

**Example**:

```typescript
import { helmet } from 'nextrush';

// Basic security headers
app.use(helmet());

// Custom Content Security Policy
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.example.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);
```

---

## 🗜️ compression - Response compression

**What it is**: Compresses response bodies using gzip or brotli for faster transfers.

**When to use**: Reduce bandwidth usage and improve load times.

**Signature**:

```typescript
function compression(options?: CompressionOptions): Middleware;
```

**Parameters**:

- `threshold` (number): Minimum response size to compress (default: 1024)
- `level` (number): Compression level 1-9 (default: 6)
- `filter` (function): Function to determine what to compress
- `brotli` (boolean): Enable Brotli compression (default: true)

**Example**:

```typescript
import { compression } from 'nextrush';

// Basic compression
app.use(compression());

// Custom compression settings
app.use(
  compression({
    threshold: 2048, // Only compress responses > 2KB
    level: 9, // Maximum compression
    filter: ctx => {
      // Only compress JSON and text responses
      const type = ctx.res.get('Content-Type') || '';
      return type.includes('json') || type.includes('text');
    },
  })
);
```

---

## 🚦 rateLimit - Rate limiting

**What it is**: Limits the number of requests from each IP address within a time window.

**When to use**: Protect API endpoints from abuse and DoS attacks.

**Signature**:

```typescript
function rateLimit(options?: RateLimiterOptions): Middleware;
```

**Parameters**:

- `windowMs` (number): Time window in milliseconds (default: 15 _ 60 _ 1000)
- `max` (number): Maximum requests per window (default: 100)
- `message` (string | object): Error message when limit exceeded
- `keyGenerator` (function): Function to generate rate limit keys
- `skip` (function): Function to skip rate limiting for certain requests

**Example**:

```typescript
import { rateLimit } from 'nextrush';

// Basic rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests, please try again later',
  })
);

// API-specific rate limiting
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute
    keyGenerator: ctx => {
      // Rate limit by API key if available, otherwise by IP
      return ctx.headers['x-api-key'] || ctx.ip;
    },
  })
);
```

---

## 📝 logger - Request logging

**What it is**: Logs HTTP requests with configurable format and output.

**When to use**: Monitor and debug application traffic.

**Signature**:

```typescript
function logger(options?: LoggerOptions): Middleware;
```

**Parameters**:

- `format` (string): Log format ('combined', 'common', 'dev', 'short', 'tiny')
- `skip` (function): Function to skip logging certain requests
- `stream` (object): Output stream for logs

**Example**:

```typescript
import { logger } from 'nextrush';
import fs from 'fs';

// Basic request logging
app.use(logger());

// Custom log format
app.use(
  logger({
    format: 'combined',
    skip: ctx => ctx.path.startsWith('/health'),
  })
);

// Log to file
const accessLogStream = fs.createWriteStream('./access.log', { flags: 'a' });
app.use(
  logger({
    format: 'combined',
    stream: accessLogStream,
  })
);
```

---

## 🆔 requestId - Request ID generation

**What it is**: Generates unique IDs for each request for tracing and debugging.

**When to use**: Track requests across logs and services.

**Signature**:

```typescript
function requestId(options?: RequestIdOptions): Middleware;
```

**Parameters**:

- `header` (string): Header name for request ID (default: 'X-Request-ID')
- `generator` (function): Custom ID generation function
- `setHeader` (boolean): Set response header with request ID (default: true)

**Example**:

```typescript
import { requestId } from 'nextrush';

// Basic request ID
app.use(requestId());

// Custom request ID generation
app.use(
  requestId({
    header: 'X-Trace-ID',
    generator: () =>
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    setHeader: true,
  })
);

// Access request ID in routes
app.get('/users', async ctx => {
  console.log(`Request ID: ${ctx.requestId}`);
  ctx.json({ users: [], requestId: ctx.requestId });
});
```

---

## ⏱️ timer - Response timing

**What it is**: Measures and reports request processing time.

**When to use**: Monitor performance and identify slow endpoints.

**Signature**:

```typescript
function timer(options?: TimerOptions): Middleware;
```

**Parameters**:

- `header` (string): Header name for timing (default: 'X-Response-Time')
- `hrtime` (boolean): Use high-resolution time (default: true)
- `digits` (number): Decimal places for timing (default: 2)

**Example**:

```typescript
import { timer } from 'nextrush';

// Basic timing
app.use(timer());

// Custom timing configuration
app.use(
  timer({
    header: 'X-Process-Time',
    hrtime: true,
    digits: 4,
  })
);
```

---

# 🛠️ Custom Middleware

Create your own middleware for specific application needs.

---

## 🔨 Basic custom middleware

```typescript
import type { Context, Middleware } from 'nextrush/types';

// Simple logging middleware
const customLogger: Middleware = async (ctx, next) => {
  const start = Date.now();
  console.log(`→ ${ctx.method} ${ctx.path}`);

  await next(); // Continue to next middleware or route

  const duration = Date.now() - start;
  console.log(`← ${ctx.status} ${duration}ms`);
};

app.use(customLogger);
```

---

## 🔐 Authentication middleware

```typescript
const authenticate: Middleware = async (ctx, next) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    ctx.res.status(401).json({ error: 'No token provided' });
    return; // Don't call next() - stop processing
  }

  try {
    const user = await validateToken(token);
    ctx.state.user = user; // Store user in context state
    await next(); // Continue to next middleware or route
  } catch (error) {
    ctx.res.status(401).json({ error: 'Invalid token' });
  }
};

// Use authentication middleware
app.use('/api/protected', authenticate);
```

---

## ✅ Validation middleware

```typescript
import { z } from 'zod';

// Schema-based validation middleware factory
function validateBody<T>(schema: z.ZodSchema<T>): Middleware {
  return async (ctx, next) => {
    try {
      const validatedBody = schema.parse(ctx.body);
      ctx.body = validatedBody; // Replace with validated data
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        ctx.res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }
      throw error;
    }
  };
}

// Use validation middleware
const CreateUserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().min(18).optional(),
});

app.post('/users', validateBody(CreateUserSchema), async ctx => {
  // ctx.body is now typed and validated
  const userData = ctx.body as z.infer<typeof CreateUserSchema>;
  const user = await createUser(userData);
  ctx.json(user, 201);
});
```

---

## 🚨 Error handling middleware

```typescript
const errorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Request failed:', error);

    // Handle different error types
    if (error instanceof ValidationError) {
      ctx.res.status(400).json({
        error: 'Validation failed',
        message: error.message,
      });
    } else if (error instanceof AuthenticationError) {
      ctx.res.status(401).json({
        error: 'Authentication required',
      });
    } else if (error instanceof NotFoundError) {
      ctx.res.status(404).json({
        error: 'Resource not found',
      });
    } else {
      // Generic server error
      ctx.res.status(500).json({
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && {
          details: error.message,
          stack: error.stack,
        }),
      });
    }
  }
};

// Error handler should be first middleware
app.use(errorHandler);
```

---

# 🔗 Middleware Composition

## 🔄 Multiple middleware

```typescript
// Apply multiple middleware to specific routes
app.use('/api', [cors(), helmet(), rateLimit({ max: 50 }), authenticate]);

// Chain middleware for specific endpoints
app.post(
  '/users',
  bodyParser(),
  validateBody(CreateUserSchema),
  authenticate,
  async ctx => {
    const user = await createUser(ctx.body);
    ctx.json(user, 201);
  }
);
```

---

## 🔀 Conditional middleware

```typescript
// Environment-specific middleware
if (process.env.NODE_ENV === 'development') {
  app.use(logger({ format: 'dev' }));
} else {
  app.use(logger({ format: 'combined' }));
}

// Conditional application
const conditionalAuth: Middleware = async (ctx, next) => {
  // Skip auth for health checks
  if (ctx.path === '/health') {
    await next();
    return;
  }

  // Apply authentication for other routes
  await authenticate(ctx, next);
};

app.use(conditionalAuth);
```

---

## 🏭 Middleware factory pattern

```typescript
// Create reusable middleware factories
function createApiKeyAuth(validKeys: string[]): Middleware {
  return async (ctx, next) => {
    const apiKey = ctx.headers['x-api-key'];

    if (!apiKey || !validKeys.includes(apiKey)) {
      ctx.res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    ctx.state.apiKey = apiKey;
    await next();
  };
}

// Use factory
const apiKeyAuth = createApiKeyAuth(['key1', 'key2', 'key3']);
app.use('/api/public', apiKeyAuth);
```

---

# 🚀 Complete Example

```typescript
import { createApp } from 'nextrush';
import {
  bodyParser,
  cors,
  helmet,
  compression,
  rateLimit,
  logger,
  requestId,
  timer,
} from 'nextrush';
import type { Context, Middleware } from 'nextrush/types';

const app = createApp();

// 🚨 Error handling (should be first)
const errorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error(`Error in ${ctx.method} ${ctx.path}:`, error);
    ctx.res.status(500).json({
      error: 'Internal server error',
      requestId: ctx.requestId,
    });
  }
};

// 🛡️ Security and performance middleware
app.use(errorHandler);
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
  })
);
app.use(compression());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
  })
);

// 📊 Request processing middleware
app.use(requestId());
app.use(timer());
app.use(logger());
app.use(
  bodyParser({
    jsonLimit: '10mb',
    multipartLimit: '50mb',
  })
);

// 🔐 Custom authentication middleware
const authenticate: Middleware = async (ctx, next) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    ctx.res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const user = await validateToken(token);
    ctx.state.user = user;
    await next();
  } catch (error) {
    ctx.res.status(401).json({ error: 'Invalid token' });
  }
};

// 🌍 Public routes (no auth required)
app.get('/health', async ctx => {
  ctx.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/auth/login', async ctx => {
  const { email, password } = ctx.body as LoginCredentials;
  const token = await loginUser(email, password);
  ctx.json({ token });
});

// 🔒 Protected routes (auth required)
app.use('/api', authenticate);

app.get('/api/profile', async ctx => {
  const user = ctx.state.user;
  ctx.json({ profile: user });
});

app.post('/api/posts', async ctx => {
  const postData = ctx.body as CreatePostData;
  const post = await createPost(ctx.state.user.id, postData);
  ctx.json(post, 201);
});

app.listen(3000);
```

---

## ⚡ Performance notes

- Middleware executes in order - place expensive operations last
- Use conditional middleware to skip unnecessary processing
- Built-in middleware is optimized with caching and lazy loading
- Error handling middleware should be placed first

## 🔒 Security notes

- Always validate and sanitize input in middleware
- Use helmet() for security headers in production
- Implement rate limiting to prevent abuse
- Never expose sensitive information in error responses

## 📚 See also

- [Context API](./context.md) - Working with the context object
- [Routing guide](./routing.md) - Route handlers and middleware
- [Error handling](./errors.md) - Error middleware patterns
- [Logger plugin](../plugins/logger.md) - Advanced logging features

---

_Added in v2.0.0-alpha.1_## Performance notes

- Middleware executes in order - place expensive operations last
- Use conditional middleware to skip unnecessary processing
- Built-in middleware is optimized with caching and lazy loading
- Error handling middleware should be placed first

## Security notes

- Always validate and sanitize input in middleware
- Use helmet() for security headers in production
- Implement rate limiting to prevent abuse
- Never expose sensitive information in error responses

## See also

- [Context API](./context.md) - Working with the context object
- [Routing guide](./routing.md) - Route handlers and middleware
- [Error handling](./errors.md) - Error middleware patterns
- [Logger plugin](../plugins/logger.md) - Advanced logging features

---

_Added in v2.0.0-alpha.1_
