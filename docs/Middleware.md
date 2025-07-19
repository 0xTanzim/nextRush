# 🔧 Middleware System

## 📚 Table of Contents

- [📖 Introduction](#-introduction)
- [🔧 Public APIs](#-public-apis)
- [💻 Usage Examples](#-usage-examples)
- [⚙️ Configuration Options](#️-configuration-options)
- [📝 Notes](#-notes)

## 📖 Introduction

The NextRush framework provides a comprehensive middleware system that enhances Express.js compatibility while adding modern features like TypeScript support, built-in security middleware, smart presets, and plugin architecture. The middleware system offers automatic body parsing, CORS handling, security headers, rate limiting, and flexible middleware composition for building robust web applications.

## 🔧 Public APIs

### 📋 Core Middleware Methods

| Method                      | Signature                                                    | Description                            |
| --------------------------- | ------------------------------------------------------------ | -------------------------------------- |
| `use(middleware)`           | `(middleware: ExpressMiddleware) => Application`             | Add middleware to the application.     |
| `usePreset(name, options?)` | `(name: PresetName, options?: PresetOptions) => Application` | Apply middleware preset configuration. |
| `useGroup(middlewares)`     | `(middlewares: ExpressMiddleware[]) => Application`          | Apply multiple middleware at once.     |

### 🛡️ Security Middleware

| Method                | Signature                                             | Description                              |
| --------------------- | ----------------------------------------------------- | ---------------------------------------- |
| `cors(options?)`      | `(options?: CorsOptions) => ExpressMiddleware`        | Enable CORS with optional configuration. |
| `helmet(options?)`    | `(options?: HelmetOptions) => ExpressMiddleware`      | Add security headers with Helmet.        |
| `rateLimit(options?)` | `(options?: RateLimiterOptions) => ExpressMiddleware` | Apply rate limiting to requests.         |

### 📦 Body Parser Middleware

| Method                 | Signature                                            | Description                       |
| ---------------------- | ---------------------------------------------------- | --------------------------------- |
| `json(options?)`       | `(options?: JsonParserOptions) => ExpressMiddleware` | Parse JSON request bodies.        |
| `urlencoded(options?)` | `(options?: UrlencodedOptions) => ExpressMiddleware` | Parse URL-encoded request bodies. |
| `text(options?)`       | `(options?: TextParserOptions) => ExpressMiddleware` | Parse text request bodies.        |
| `raw(options?)`        | `(options?: RawParserOptions) => ExpressMiddleware`  | Parse raw request bodies.         |

### 🔧 Utility Middleware

| Method                  | Signature                                             | Description                            |
| ----------------------- | ----------------------------------------------------- | -------------------------------------- |
| `logger(options?)`      | `(options?: LoggerOptions) => ExpressMiddleware`      | Add request logging functionality.     |
| `requestId(options?)`   | `(options?: RequestIdOptions) => ExpressMiddleware`   | Add unique request ID to each request. |
| `timer(options?)`       | `(options?: TimerOptions) => ExpressMiddleware`       | Add response time tracking.            |
| `compression(options?)` | `(options?: CompressionOptions) => ExpressMiddleware` | Enable response compression.           |

### 🎨 Composition Functions

| Function                        | Signature                                                                           | Description                                |
| ------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------ |
| `compose(...middlewares)`       | `(...middlewares: ExpressMiddleware[]) => ExpressMiddleware`                        | Combine multiple middleware into one.      |
| `when(condition, middleware)`   | `(condition: (req) => boolean, middleware: ExpressMiddleware) => ExpressMiddleware` | Apply middleware conditionally.            |
| `unless(condition, middleware)` | `(condition: (req) => boolean, middleware: ExpressMiddleware) => ExpressMiddleware` | Apply middleware unless condition is true. |
| `named(name, middleware)`       | `(name: string, middleware: ExpressMiddleware) => ExpressMiddleware`                | Give middleware a name for debugging.      |
| `group(middlewares)`            | `(middlewares: ExpressMiddleware[]) => ExpressMiddleware`                           | Create a group of middleware.              |

### 📋 Configuration Interfaces

| Interface           | Description                                   |
| ------------------- | --------------------------------------------- |
| `PresetOptions`     | Options for middleware presets.               |
| `ExpressMiddleware` | Standard middleware function signature.       |
| `MiddlewareHandler` | Enhanced middleware with additional features. |

#### PresetOptions Properties

| Property      | Type                            | Default | Description                                |
| ------------- | ------------------------------- | ------- | ------------------------------------------ |
| `cors`        | `boolean \| CorsOptions`        | `true`  | CORS configuration or disable.             |
| `helmet`      | `boolean \| HelmetOptions`      | `true`  | Security headers configuration or disable. |
| `logger`      | `boolean \| LoggerOptions`      | `true`  | Logging configuration or disable.          |
| `bodyParser`  | `boolean \| BodyParserOptions`  | `true`  | Body parsing configuration or disable.     |
| `compression` | `boolean \| CompressionOptions` | `false` | Compression configuration or disable.      |
| `rateLimit`   | `boolean \| RateLimiterOptions` | `false` | Rate limiting configuration or disable.    |

### 🎛️ Available Presets

| Preset Name      | Description                                 |
| ---------------- | ------------------------------------------- |
| `'development'`  | Development-optimized middleware stack.     |
| `'production'`   | Production-ready with security features.    |
| `'api'`          | API-focused middleware configuration.       |
| `'security'`     | Maximum security headers and protection.    |
| `'minimal'`      | Basic middleware with minimal overhead.     |
| `'fullFeatured'` | Enterprise-ready with all features enabled. |

## 💻 Usage Examples

### Basic Middleware Usage

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Global middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${Date.now()}`);
  next();
});

// Route-specific middleware
app.get(
  '/api/users',
  app.rateLimit({ max: 10, windowMs: 60000 }),
  (req, res) => {
    res.json({ users: [] });
  }
);

app.listen(3000);
```

### Using Middleware Presets

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Development preset
app.usePreset('development');

// Production preset with custom options
app.usePreset('production', {
  cors: {
    origin: ['https://yourdomain.com'],
    credentials: true,
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  },
});

app.listen(3000);
```

### Security Middleware Stack

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Comprehensive security setup
app.use(
  app.helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
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

app.use(
  app.cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(
  app.rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.listen(3000);
```

### Custom Middleware Creation

```typescript
import { createApp, ExpressMiddleware } from 'nextrush';

const app = createApp();

// Simple custom middleware
const timestampMiddleware: ExpressMiddleware = (req, res, next) => {
  (req as any).timestamp = new Date().toISOString();
  next();
};

// Configurable middleware factory
function createAuthMiddleware(secret: string): ExpressMiddleware {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      // Verify token logic here
      (req as any).user = { id: 'user123', role: 'admin' };
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// Apply custom middleware
app.use(timestampMiddleware);
app.use('/api/protected', createAuthMiddleware('secret-key'));

app.listen(3000);
```

### Advanced Middleware Composition

```typescript
import { createApp, compose, when, unless, named } from 'nextrush';

const app = createApp();

// Compose multiple middleware
const securityStack = compose(
  app.helmet(),
  app.cors(),
  app.rateLimit({ max: 50 })
);

// Conditional middleware
const mobileOptimization = when(
  (req) => req.headers['user-agent']?.includes('Mobile'),
  app.compression({ level: 9 })
);

// Apply middleware unless condition is met
const authExceptPublic = unless(
  (req) => req.path.startsWith('/public'),
  createAuthMiddleware('secret')
);

// Named middleware for debugging
const namedLogger = named('request-logger', app.logger());

// Apply composed middleware
app.use('/api', securityStack);
app.use(mobileOptimization);
app.use(authExceptPublic);
app.use(namedLogger);

app.listen(3000);
```

### Body Parser Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Custom JSON parser
app.use(
  app.json({
    limit: '50mb',
    strict: false,
    reviver: (key, value) => {
      // Custom JSON processing
      if (key === 'date') return new Date(value);
      return value;
    },
  })
);

// Custom URL-encoded parser
app.use(
  app.urlencoded({
    limit: '50mb',
    extended: true,
    parameterLimit: 1000,
  })
);

// Text parser for specific routes
app.use(
  '/api/webhook',
  app.text({
    limit: '1mb',
    type: 'text/plain',
  })
);

app.listen(3000);
```

### Error Handling Middleware

```typescript
import { createApp, ExpressMiddleware } from 'nextrush';

const app = createApp();

// Global error handler
const errorHandler: ExpressMiddleware = (err, req, res, next) => {
  console.error('Global error:', err);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  res.status(statusCode).json({
    error: message,
    requestId: (req as any).id,
    timestamp: new Date().toISOString(),
  });
};

// Async error wrapper
function asyncHandler(fn: Function): ExpressMiddleware {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Apply error handling
app.use(errorHandler);

// Protected async route
app.get(
  '/api/data',
  asyncHandler(async (req, res) => {
    const data = await fetchDataFromDatabase();
    res.json(data);
  })
);

app.listen(3000);
```

### Performance Monitoring Middleware

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Request timing middleware
app.use(
  app.timer({
    header: 'X-Response-Time',
  })
);

// Request ID for tracking
app.use(
  app.requestId({
    header: 'X-Request-ID',
  })
);

// Performance monitoring
app.use((req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds

    if (duration > 1000) {
      console.warn(
        `Slow request detected: ${req.method} ${req.url} - ${duration}ms`
      );
    }

    // Log to monitoring service
    monitoringService.recordRequestDuration(req.method, req.url, duration);
  });

  next();
});

app.listen(3000);
```

## ⚙️ Configuration Options

### Development Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Development-friendly setup
app.usePreset('development', {
  cors: {
    origin: '*', // Allow all origins in development
    credentials: false,
  },
  logger: {
    format: 'detailed', // Verbose logging
    colors: true,
  },
  helmet: false, // Disable security headers for easier testing
  rateLimit: false, // No rate limiting in development
});
```

### Production Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Production-ready setup
app.usePreset('production', {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400, // 24 hours
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  },
  compression: {
    level: 6,
    threshold: 1024,
  },
});
```

### API-Specific Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// API-optimized middleware stack
app.usePreset('api', {
  cors: {
    origin: ['https://app.example.com', 'https://admin.example.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  },
  bodyParser: {
    json: {
      limit: '10mb',
      strict: true,
    },
    urlencoded: {
      limit: '10mb',
      extended: true,
    },
  },
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // Higher limit for API
    keyGenerator: (req) => {
      // Custom key generator for API clients
      return req.headers['x-api-key'] || req.ip;
    },
  },
});
```

### Custom Preset Creation

```typescript
import { PresetOptions, ExpressMiddleware } from 'nextrush';

// Create custom preset
function microservicePreset(options: PresetOptions = {}): ExpressMiddleware[] {
  return [
    // Service mesh headers
    (req, res, next) => {
      res.setHeader('X-Service-Name', 'user-service');
      res.setHeader('X-Service-Version', '1.0.0');
      next();
    },
    // Health check bypass
    (req, res, next) => {
      if (req.path === '/health') {
        return res.json({ status: 'healthy' });
      }
      next();
    },
    // Distributed tracing
    (req, res, next) => {
      const traceId = req.headers['x-trace-id'] || generateTraceId();
      (req as any).traceId = traceId;
      res.setHeader('X-Trace-ID', traceId);
      next();
    },
  ];
}

// Use custom preset
const app = createApp();
app.useGroup(microservicePreset());
```

## 📝 Notes

- **Express Compatibility**: All middleware is fully compatible with Express.js middleware, enabling easy migration from existing Express applications.

- **TypeScript Support**: Complete TypeScript support with proper typing for request/response objects and middleware functions.

- **Performance**: Middleware composition is optimized for minimal overhead, with efficient execution order and memory usage.

- **Error Handling**: Built-in error handling for middleware execution with proper error propagation and cleanup.

- **Security**: Security middleware follows industry best practices and includes protection against common vulnerabilities.

- **Preset System**: Presets provide battle-tested middleware configurations for different environments and use cases.

- **Plugin Architecture**: All middleware is implemented as plugins, ensuring consistent APIs and lifecycle management.

- **Debugging**: Named middleware and request tracking make debugging easier in development and production.

- **Extensibility**: Easy to create custom middleware and compose them with existing middleware for complex scenarios.

- **Configuration**: Flexible configuration options allow fine-tuning of middleware behavior for specific requirements.

- **Order Matters**: Middleware execution order is important - security middleware should be applied early, error handlers should be applied last.

- **Memory Management**: Built-in cleanup and resource management prevent memory leaks in long-running applications.

### Security Middleware

#### 🛡️ CORS (Cross-Origin Resource Sharing)

```typescript
// Basic CORS
app.use(app.cors());

// Advanced CORS configuration
app.cors({
  origin: ['https://myapp.com', 'https://api.myapp.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
  maxAge: 86400, // 24 hours
});

// Route-specific CORS
app.use('/api/public', app.cors({ origin: '*' }));
app.use(
  '/api/private',
  app.cors({
    origin: ['https://secure-app.com'],
    credentials: true,
  })
);
```

#### 🔒 Helmet (Security Headers)

```typescript
// Default security headers
app.use(app.helmet());

// Custom helmet configuration
app.helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});
```

#### 🧹 XSS Protection

```typescript
// Enable XSS protection
app.use(app.xssProtection());

// Custom XSS protection
app.use((req, res, next) => {
  // Set XSS protection headers
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  // Sanitize request body
  if (req.body) {
    req.body = req.sanitize(req.body, {
      removeHtml: true,
      escapeHtml: true,
    });
  }

  next();
});
```

### Utility Middleware

#### 📊 Request Logger

```typescript
// Basic logging
app.use(app.logger());

// Detailed logging
app.logger({
  format: 'detailed', // 'simple' | 'detailed' | 'json'
  includeHeaders: true,
  includeBody: false,
  colors: true,
});

// Custom logger
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  });

  next();
});
```

#### 🆔 Request ID

```typescript
// Add unique request ID
app.use(app.requestId());

// Custom request ID generator
app.requestId({
  generator: () =>
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  header: 'X-Request-ID',
});

// Access request ID
app.get('/api/data', (req, res) => {
  console.log(`Processing request: ${req.id}`);
  res.json({ requestId: req.id });
});
```

#### ⏱️ Request Timer

```typescript
// Add request timing
app.use(app.requestTimer());

// Custom timer configuration
app.requestTimer({
  header: 'X-Response-Time',
  digits: 3,
  suffix: 'ms',
});
```

#### 🗜️ Compression

```typescript
// Enable compression
app.use(app.compression());

// Custom compression
app.compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Fallback to standard filter function
    return true;
  },
});
```

## 📦 Middleware Presets

### Development Preset

Perfect for development and debugging:

```typescript
app.usePreset('development');

// Equivalent to:
app.use(app.logger({ format: 'detailed' }));
app.use(app.cors({ origin: '*' }));
app.use(app.requestId());
```

### Production Preset

Optimized for production environments:

```typescript
app.usePreset('production', {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
  },
  helmet: true,
  compression: true,
});

// Includes:
// - Security headers (helmet)
// - Structured CORS
// - Request compression
// - Performance monitoring
```

### API Preset

Designed for API servers:

```typescript
app.usePreset('api', {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
  },
});

// Includes:
// - CORS for API access
// - Rate limiting
// - JSON parsing
// - Request/response logging
```

### Security Preset

Maximum security configuration:

```typescript
app.usePreset('security');

// Includes:
// - Comprehensive security headers
// - Strict CORS
// - XSS protection
// - Content Security Policy
// - HTTPS enforcement
```

### Full-Featured Preset

Everything enabled for enterprise applications:

```typescript
app.usePreset('fullFeatured', {
  cors: {
    origin: ['https://myapp.com'],
    credentials: true,
  },
  rateLimit: {
    max: 1000,
    windowMs: 60000,
  },
  metrics: true,
});

// Includes:
// - All security features
// - Performance monitoring
// - Request metrics
// - Response compression
// - Advanced logging
```

## 🛠️ Custom Middleware

### Creating Simple Middleware

```typescript
// Basic middleware function
function simpleMiddleware(
  req: NextRushRequest,
  res: NextRushResponse,
  next: () => void
) {
  req.timestamp = Date.now();
  next();
}

app.use(simpleMiddleware);
```

### Creating Configurable Middleware

```typescript
// Middleware factory
function createAuthMiddleware(options: { secret: string; algorithm?: string }) {
  return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }

    try {
      const decoded = jwt.verify(token, options.secret, {
        algorithms: [options.algorithm || 'HS256'],
      });
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// Usage
app.use(
  '/api/protected',
  createAuthMiddleware({
    secret: process.env.JWT_SECRET!,
    algorithm: 'HS256',
  })
);
```

### Async Middleware

```typescript
// Async middleware with error handling
function asyncMiddleware(
  fn: (
    req: NextRushRequest,
    res: NextRushResponse,
    next: () => void
  ) => Promise<void>
) {
  return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Usage
app.use(
  '/api/users',
  asyncMiddleware(async (req, res, next) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  })
);
```

## 🔒 Security Middleware

### Input Sanitization

```typescript
// Global sanitization
app.use(
  app.sanitize({
    removeHtml: true,
    escapeHtml: true,
    trim: true,
    removeSpecialChars: false,
  })
);

// Route-specific sanitization
app.use(
  '/api/comments',
  app.sanitize({
    removeHtml: true,
    allowedTags: ['p', 'br', 'strong', 'em'],
    maxLength: 1000,
  })
);

// Custom sanitization
app.post('/api/contact', (req, res) => {
  const cleanData = {
    name: req.sanitize(req.body.name, {
      removeHtml: true,
      trim: true,
      maxLength: 100,
      pattern: /^[a-zA-Z\s'-]+$/,
    }),
    email: req.sanitize(req.body.email, {
      trim: true,
      lowercase: true,
    }),
    message: req.sanitize(req.body.message, {
      removeHtml: true,
      trim: true,
      maxLength: 2000,
    }),
  };

  // Process sanitized data...
});
```

### Rate Limiting

```typescript
// Basic rate limiting
app.use(
  app.rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
  })
);

// Different limits for different endpoints
app.use(
  '/api/auth/login',
  app.rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // 5 login attempts per 15 minutes
    skipSuccessfulRequests: true,
  })
);

app.use(
  '/api/upload',
  app.rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 uploads per hour
    skipFailedRequests: true,
  })
);
```

### Content Security Policy

```typescript
// Basic CSP
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:;"
  );
  next();
});

// Advanced CSP with nonces
app.use((req, res, next) => {
  const nonce = generateNonce();
  res.locals.nonce = nonce;

  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'`
  );

  next();
});
```

## 🔌 Plugin Integration

### Creating Middleware Plugins

```typescript
import { BasePlugin, PluginRegistry } from 'nextrush';

class CustomMiddlewarePlugin extends BasePlugin {
  name = 'CustomMiddleware';

  constructor(registry: PluginRegistry, private options: any = {}) {
    super(registry);
  }

  install(app: Application): void {
    // Install custom middleware
    app.use(this.createCustomMiddleware());

    // Add middleware factory to app
    (app as any).customMiddleware = (options: any) => {
      return this.createCustomMiddleware(options);
    };
  }

  private createCustomMiddleware(options: any = {}) {
    return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
      // Custom middleware logic
      next();
    };
  }
}

// Register and use plugin
app.plugin(
  new CustomMiddlewarePlugin(app.registry, {
    // plugin options
  })
);
```

### Middleware Composition

```typescript
// Compose multiple middleware
function composeMiddleware(...middlewares: ExpressMiddleware[]) {
  return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
    let index = 0;

    function dispatch(i: number): void {
      if (i <= index) return;
      index = i;

      let fn = middlewares[i];
      if (i === middlewares.length) fn = next;
      if (!fn) return;

      try {
        fn(req, res, () => dispatch(i + 1));
      } catch (err) {
        next();
      }
    }

    return dispatch(0);
  };
}

// Usage
const authStack = composeMiddleware(
  app.rateLimit({ max: 10 }),
  app.cors({ credentials: true }),
  createAuthMiddleware({ secret: 'secret' })
);

app.use('/api/admin', authStack);
```

## 📝 TypeScript Support

### Type-Safe Middleware

```typescript
import { NextRushRequest, NextRushResponse, ExpressMiddleware } from 'nextrush';

// Typed middleware function
const typedMiddleware: ExpressMiddleware = (
  req: NextRushRequest,
  res: NextRushResponse,
  next: () => void
) => {
  // req and res are fully typed
  const userAgent = req.userAgent(); // TypeScript knows this exists
  const clientIP = req.ip(); // Full IntelliSense support

  res.json({ userAgent, clientIP }); // Typed response methods
};

// Middleware with custom request properties
interface CustomRequest extends NextRushRequest {
  customProperty: string;
}

const customMiddleware = (
  req: CustomRequest,
  res: NextRushResponse,
  next: () => void
) => {
  req.customProperty = 'value';
  next();
};
```

### Middleware Options Types

```typescript
interface CustomMiddlewareOptions {
  enabled: boolean;
  timeout: number;
  headers: Record<string, string>;
}

function createTypedMiddleware(
  options: CustomMiddlewareOptions
): ExpressMiddleware {
  return (req, res, next) => {
    // Fully typed options
    if (!options.enabled) return next();

    setTimeout(() => {
      Object.entries(options.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      next();
    }, options.timeout);
  };
}
```

## ⚡ Performance Optimization

### Middleware Caching

```typescript
// Cache middleware results
const cacheMiddleware = (ttl: number = 300) => {
  const cache = new Map<string, { data: any; expires: number }>();

  return (req: NextRushRequest, res: NextRushResponse, next: () => void) => {
    const key = `${req.method}:${req.url}`;
    const cached = cache.get(key);

    if (cached && cached.expires > Date.now()) {
      return res.json(cached.data);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function (data: any) {
      cache.set(key, {
        data,
        expires: Date.now() + ttl * 1000,
      });
      return originalJson.call(this, data);
    };

    next();
  };
};

app.use('/api/cached', cacheMiddleware(600)); // 10 minutes
```

### Conditional Middleware

```typescript
// Apply middleware based on conditions
function conditionalMiddleware(
  condition: (req: NextRushRequest) => boolean,
  middleware: ExpressMiddleware
): ExpressMiddleware {
  return (req, res, next) => {
    if (condition(req)) {
      return middleware(req, res, next);
    }
    next();
  };
}

// Usage examples
app.use(
  conditionalMiddleware(
    (req) => req.headers['user-agent']?.includes('bot'),
    app.rateLimit({ max: 1 }) // Rate limit bots more aggressively
  )
);

app.use(
  conditionalMiddleware(
    (req) => process.env.NODE_ENV === 'development',
    app.logger({ format: 'detailed' })
  )
);
```

### Middleware Profiling

```typescript
// Profile middleware performance
function profileMiddleware(
  name: string,
  middleware: ExpressMiddleware
): ExpressMiddleware {
  return (req, res, next) => {
    const start = process.hrtime.bigint();

    middleware(req, res, () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds

      console.log(`Middleware "${name}" took ${duration.toFixed(3)}ms`);
      next();
    });
  };
}

// Usage
app.use(profileMiddleware('CORS', app.cors()));
app.use(profileMiddleware('Auth', authMiddleware));
```

## 🚨 Error Handling

### Error Middleware

```typescript
// Global error handler
app.use(
  (
    error: Error,
    req: NextRushRequest,
    res: NextRushResponse,
    next: () => void
  ) => {
    console.error('Error:', error);

    if (res.headersSent) {
      return next(error);
    }

    const statusCode = (error as any).statusCode || 500;
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : error.message;

    res.status(statusCode).json({
      error: {
        message,
        statusCode,
        timestamp: new Date().toISOString(),
        requestId: req.id,
      },
    });
  }
);
```

### Middleware Error Boundaries

```typescript
// Catch errors in middleware
function errorBoundary(middleware: ExpressMiddleware): ExpressMiddleware {
  return async (req, res, next) => {
    try {
      await middleware(req, res, next);
    } catch (error) {
      console.error('Middleware error:', error);
      res.status(500).json({
        error: 'Middleware error occurred',
        requestId: req.id,
      });
    }
  };
}

// Usage
app.use(errorBoundary(riskyMiddleware));
```

### Timeout Middleware

```typescript
// Request timeout middleware
function timeoutMiddleware(ms: number): ExpressMiddleware {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request timeout',
          timeout: ms,
        });
      }
    }, ms);

    res.on('finish', () => clearTimeout(timeout));
    res.on('close', () => clearTimeout(timeout));

    next();
  };
}

app.use(timeoutMiddleware(30000)); // 30 seconds
```

## 🔧 Advanced Patterns

### Middleware Pipeline

```typescript
// Create reusable middleware pipelines
class MiddlewarePipeline {
  private middlewares: ExpressMiddleware[] = [];

  add(middleware: ExpressMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  remove(index: number): this {
    this.middlewares.splice(index, 1);
    return this;
  }

  build(): ExpressMiddleware {
    return composeMiddleware(...this.middlewares);
  }
}

// Usage
const apiPipeline = new MiddlewarePipeline()
  .add(app.cors())
  .add(app.rateLimit({ max: 100 }))
  .add(app.requestId())
  .add(authMiddleware);

app.use('/api', apiPipeline.build());
```

### Context-Aware Middleware

```typescript
// Middleware that shares context
class RequestContext {
  private static contexts = new WeakMap<NextRushRequest, RequestContext>();

  static get(req: NextRushRequest): RequestContext {
    if (!this.contexts.has(req)) {
      this.contexts.set(req, new RequestContext());
    }
    return this.contexts.get(req)!;
  }

  private data = new Map<string, any>();

  set(key: string, value: any): void {
    this.data.set(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.data.get(key);
  }
}

// Context middleware
const contextMiddleware: ExpressMiddleware = (req, res, next) => {
  const context = RequestContext.get(req);
  context.set('startTime', Date.now());
  next();
};

// Use context in other middleware
const timingMiddleware: ExpressMiddleware = (req, res, next) => {
  const context = RequestContext.get(req);
  const startTime = context.get<number>('startTime');

  res.on('finish', () => {
    const duration = Date.now() - (startTime || 0);
    console.log(`Request took ${duration}ms`);
  });

  next();
};
```

### Dynamic Middleware Loading

```typescript
// Load middleware based on configuration
interface MiddlewareConfig {
  name: string;
  enabled: boolean;
  options: any;
}

function loadDynamicMiddleware(
  configs: MiddlewareConfig[]
): ExpressMiddleware[] {
  const middlewares: ExpressMiddleware[] = [];

  for (const config of configs) {
    if (!config.enabled) continue;

    switch (config.name) {
      case 'cors':
        middlewares.push(app.cors(config.options));
        break;
      case 'helmet':
        middlewares.push(app.helmet(config.options));
        break;
      case 'rateLimit':
        middlewares.push(app.rateLimit(config.options));
        break;
      // Add more middleware types as needed
    }
  }

  return middlewares;
}

// Usage with configuration
const middlewareConfigs: MiddlewareConfig[] = [
  { name: 'cors', enabled: true, options: { origin: '*' } },
  {
    name: 'helmet',
    enabled: process.env.NODE_ENV === 'production',
    options: {},
  },
  { name: 'rateLimit', enabled: true, options: { max: 100 } },
];

const dynamicMiddlewares = loadDynamicMiddleware(middlewareConfigs);
dynamicMiddlewares.forEach((middleware) => app.use(middleware));
```

## 📋 Best Practices

### 1. **Order Matters**

```typescript
// Correct order
app.use(app.helmet()); // Security headers first
app.use(app.cors()); // CORS before parsing
app.use(app.json()); // Body parsing
app.use(app.requestId()); // Request tracking
app.use(authMiddleware); // Authentication
app.use('/api', apiRoutes); // Routes last
```

### 2. **Error Handling**

```typescript
// Always include error handling
app.use(errorBoundary(middleware));
app.use(globalErrorHandler);
```

### 3. **Performance**

```typescript
// Use conditional middleware
app.use(
  conditionalMiddleware(
    (req) => req.url.startsWith('/api'),
    expensiveMiddleware
  )
);
```

### 4. **Security**

```typescript
// Apply security middleware early
app.use(app.helmet());
app.use(app.xssProtection());
app.use(app.sanitize());
```

The NextRush middleware system provides a comprehensive, type-safe, and performant solution for building modern web applications. With built-in security features, smart presets, and extensive customization options, it offers everything needed for enterprise-grade applications while maintaining simplicity for smaller projects.
