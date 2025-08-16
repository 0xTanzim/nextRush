# Built-in Middleware API

NextRush v2 includes essential middleware built into the core framework. These middleware are production-ready and optimized for performance.

## Available Middleware

All middleware are exported from the main package and can be used immediately:

```typescript
import {
  bodyParser,
  compression,
  cors,
  helmet,
  logger,
  rateLimit,
  requestId,
  timer,
} from 'nextrush';
```

---

## Body Parser Middleware

Parses request bodies automatically with smart content-type detection.

### Usage

```typescript
import { createApp, bodyParser } from 'nextrush';

const app = createApp();

// Basic usage (parses JSON, form data, and text)
app.use(bodyParser());

// With options
app.use(
  bodyParser({
    json: { limit: '10mb' },
    urlencoded: { limit: '10mb', extended: true },
    text: { limit: '1mb' },
    raw: { limit: '5mb' },
  })
);
```

### Configuration Options

```typescript
interface BodyParserOptions {
  json?: {
    limit?: string; // Size limit (default: '1mb')
    strict?: boolean; // Only parse objects/arrays
    type?: string | string[]; // Content types to parse
  };
  urlencoded?: {
    limit?: string; // Size limit (default: '1mb')
    extended?: boolean; // Use qs library (default: true)
    type?: string | string[]; // Content types to parse
  };
  text?: {
    limit?: string; // Size limit (default: '1mb')
    type?: string | string[]; // Content types to parse
  };
  raw?: {
    limit?: string; // Size limit (default: '1mb')
    type?: string | string[]; // Content types to parse
  };
}
```

### What It Parses

```typescript
// JSON requests
// Content-Type: application/json
app.post('/api/user', ctx => {
  console.log(ctx.body); // { name: "John", age: 30 }
});

// Form data
// Content-Type: application/x-www-form-urlencoded
app.post('/form', ctx => {
  console.log(ctx.body); // { name: "John", email: "john@example.com" }
});

// Text data
// Content-Type: text/plain
app.post('/text', ctx => {
  console.log(ctx.body); // "Hello World"
});

// Raw binary data
// Content-Type: application/octet-stream
app.post('/upload', ctx => {
  console.log(ctx.body); // Buffer
});
```

---

## CORS Middleware

Handles Cross-Origin Resource Sharing with configurable policies.

### Usage

```typescript
import { createApp, cors } from 'nextrush';

const app = createApp();

// Basic usage (allows all origins)
app.use(cors());

// Production configuration
app.use(
  cors({
    origin: ['https://myapp.com', 'https://www.myapp.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // 24 hours
  })
);
```

### Configuration Options

```typescript
interface CorsOptions {
  origin?: string | string[] | boolean | ((origin: string) => boolean);
  methods?: string | string[]; // Allowed HTTP methods
  allowedHeaders?: string | string[]; // Allowed request headers
  exposedHeaders?: string | string[]; // Headers exposed to client
  credentials?: boolean; // Allow credentials
  maxAge?: number; // Preflight cache time (seconds)
  preflightContinue?: boolean; // Pass preflight to next handler
  optionsSuccessStatus?: number; // Status for OPTIONS requests
}
```

### Dynamic Origin Validation

```typescript
app.use(
  cors({
    origin: origin => {
      // Custom validation logic
      const allowedDomains = ['myapp.com', 'partner.com'];
      return allowedDomains.some(domain => origin.endsWith(domain));
    },
    credentials: true,
  })
);
```

---

## Helmet Middleware

Adds security headers to protect against common vulnerabilities.

### Usage

```typescript
import { createApp, helmet } from 'nextrush';

const app = createApp();

// Basic usage (applies all default security headers)
app.use(helmet());

// Custom configuration
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", 'https://cdn.example.com'],
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

### Security Headers Applied

```typescript
interface HelmetOptions {
  contentSecurityPolicy?: {
    directives?: Record<string, string[]>;
    reportOnly?: boolean;
  };
  crossOriginEmbedderPolicy?: boolean;
  crossOriginOpenerPolicy?: boolean;
  crossOriginResourcePolicy?: boolean;
  dnsPrefetchControl?: boolean;
  frameguard?: {
    action?: 'deny' | 'sameorigin' | 'allow-from';
    domain?: string;
  };
  hidePoweredBy?: boolean;
  hsts?: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  ieNoOpen?: boolean;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: boolean;
  referrerPolicy?: string[];
  xssFilter?: boolean;
}
```

### Headers Set by Default

- `X-DNS-Prefetch-Control: off`
- `X-Frame-Options: SAMEORIGIN`
- `X-Download-Options: noopen`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 0`
- `Strict-Transport-Security` (HTTPS only)
- `Content-Security-Policy`

---

## Compression Middleware

Compresses responses to reduce bandwidth usage.

### Usage

```typescript
import { createApp, compression } from 'nextrush';

const app = createApp();

// Basic usage
app.use(compression());

// Custom configuration
app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      return !req.headers['x-no-compression'];
    },
  })
);
```

### Configuration Options

```typescript
interface CompressionOptions {
  level?: number; // Compression level (1-9, default: 6)
  threshold?: number; // Min response size to compress (bytes)
  filter?: (req: Request, res: Response) => boolean; // Custom filter
  chunkSize?: number; // Chunk size for streaming
  windowBits?: number; // Compression window size
  memLevel?: number; // Memory usage level
}
```

### Compression Types

- **Gzip**: Most widely supported
- **Deflate**: Alternative compression
- **Brotli**: Modern, more efficient (when supported)

```typescript
// Automatic algorithm selection based on client support
app.use(
  compression({
    // Brotli for modern browsers, gzip for others
    filter: (req, res) => {
      const acceptEncoding = req.headers['accept-encoding'] || '';
      return acceptEncoding.includes('br') || acceptEncoding.includes('gzip');
    },
  })
);
```

---

## Rate Limit Middleware

Prevents abuse by limiting request rates per client.

### Usage

```typescript
import { createApp, rateLimit } from 'nextrush';

const app = createApp();

// Basic usage (15 requests per 15 minutes)
app.use(rateLimit());

// Custom configuration
app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    message: 'Too many requests from this IP',
    standardHeaders: true, // Add rate limit headers
    legacyHeaders: false, // Disable legacy headers
  })
);
```

### Configuration Options

```typescript
interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds
  maxRequests?: number; // Max requests per window
  message?: string | object; // Error message/response
  standardHeaders?: boolean; // Add standard rate limit headers
  legacyHeaders?: boolean; // Add legacy X-RateLimit headers
  keyGenerator?: (req: Request) => string; // Custom key generation
  skip?: (req: Request) => boolean; // Skip rate limiting
  onLimitReached?: (req: Request, res: Response) => void; // Callback
}
```

### Advanced Usage

```typescript
// Different limits for different endpoints
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // Only 5 login attempts
  })
);

app.use(
  '/api/',
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000, // 1000 API calls
  })
);

// Custom key generation (rate limit per user)
app.use(
  rateLimit({
    keyGenerator: req => {
      return req.headers.authorization || req.ip;
    },
  })
);

// Skip rate limiting for certain conditions
app.use(
  rateLimit({
    skip: req => {
      return req.headers['x-api-key'] === 'admin-key';
    },
  })
);
```

---

## Request ID Middleware

Adds unique identifiers to requests for tracking and debugging.

### Usage

```typescript
import { createApp, requestId } from 'nextrush';

const app = createApp();

// Basic usage
app.use(requestId());

// Custom configuration
app.use(
  requestId({
    header: 'X-Request-ID',
    generator: () => crypto.randomUUID(),
    setHeader: true,
  })
);
```

### Configuration Options

```typescript
interface RequestIdOptions {
  header?: string; // Header name (default: 'X-Request-ID')
  generator?: () => string; // ID generator function
  setHeader?: boolean; // Add header to response
}
```

### Using Request IDs

```typescript
app.use(requestId());

app.use((ctx, next) => {
  console.log(`Request ID: ${ctx.id}`);
  return next();
});

app.get('/api/user/:id', ctx => {
  ctx.logger.info('Fetching user', {
    requestId: ctx.id,
    userId: ctx.params.id,
  });

  // Request ID is also available in response headers
  ctx.res.json({ user: userData });
});
```

---

## Timer Middleware

Measures request processing time for performance monitoring.

### Usage

```typescript
import { createApp, timer } from 'nextrush';

const app = createApp();

// Basic usage
app.use(timer());

// Custom configuration
app.use(
  timer({
    header: 'X-Response-Time',
    digits: 3,
    suffix: 'ms',
  })
);
```

### Configuration Options

```typescript
interface TimerOptions {
  header?: string; // Response header name
  digits?: number; // Decimal places (default: 3)
  suffix?: string; // Unit suffix (default: 'ms')
}
```

### Performance Monitoring

```typescript
app.use(timer());

app.use((ctx, next) => {
  const start = Date.now();

  return next().finally(() => {
    const duration = Date.now() - start;

    // Log slow requests
    if (duration > 1000) {
      console.warn(
        `Slow request: ${ctx.method} ${ctx.path} took ${duration}ms`
      );
    }
  });
});
```

---

## Logger Middleware

Provides request/response logging for debugging and monitoring.

### Usage

```typescript
import { createApp, logger } from 'nextrush';

const app = createApp();

// Basic usage (logs to console)
app.use(logger());

// Custom configuration
app.use(
  logger({
    format: 'combined',
    skip: (req, res) => res.statusCode < 400,
  })
);
```

### Configuration Options

```typescript
interface LoggerOptions {
  format?: 'combined' | 'common' | 'dev' | 'short' | 'tiny' | Function;
  skip?: (req: Request, res: Response) => boolean;
  stream?: { write: (str: string) => void };
}
```

### Log Formats

```typescript
// Combined format (Apache combined log format)
app.use(logger('combined'));
// Output: ::1 - - [25/Dec/2022:10:30:00 +0000] "GET / HTTP/1.1" 200 12 "-" "Mozilla/5.0..."

// Common format (Apache common log format)
app.use(logger('common'));
// Output: ::1 - - [25/Dec/2022:10:30:00 +0000] "GET / HTTP/1.1" 200 12

// Dev format (colored output for development)
app.use(logger('dev'));
// Output: GET / 200 4.567 ms - 12

// Custom format
app.use(
  logger((tokens, req, res) => {
    return [
      tokens.method(req, res),
      tokens.url(req, res),
      tokens.status(req, res),
      tokens['response-time'](req, res),
      'ms',
    ].join(' ');
  })
);
```

---

## Middleware Order

The order of middleware matters. Here's the recommended order:

```typescript
import { createApp } from 'nextrush';
import {
  helmet,
  cors,
  compression,
  requestId,
  timer,
  logger,
  rateLimit,
  bodyParser,
} from 'nextrush';

const app = createApp();

// 1. Security (first)
app.use(helmet());

// 2. CORS (before other middleware)
app.use(cors());

// 3. Compression (before response modification)
app.use(compression());

// 4. Request tracking
app.use(requestId());
app.use(timer());

// 5. Logging (after tracking setup)
app.use(logger());

// 6. Rate limiting (before expensive operations)
app.use(rateLimit());

// 7. Body parsing (before route handlers)
app.use(bodyParser());

// 8. Your routes
app.get('/', ctx => {
  ctx.res.json({ message: 'Hello World!' });
});
```

---

## Custom Middleware

You can also create custom middleware that works alongside built-in ones:

```typescript
// Custom authentication middleware
const auth = () => {
  return async (ctx: Context, next: () => Promise<void>) => {
    const token = ctx.req.headers.authorization;

    if (!token) {
      ctx.res.status(401).json({ error: 'No token provided' });
      return;
    }

    try {
      const user = await verifyToken(token);
      ctx.user = user;
      await next();
    } catch (error) {
      ctx.res.status(401).json({ error: 'Invalid token' });
    }
  };
};

// Use with built-in middleware
app.use(helmet());
app.use(cors());
app.use(rateLimit());
app.use(auth()); // Custom middleware
app.use(bodyParser());
```

---

## Summary

NextRush v2's built-in middleware provides:

✅ **bodyParser** - Smart request body parsing with size limits
✅ **cors** - Flexible Cross-Origin Resource Sharing configuration
✅ **helmet** - Comprehensive security headers protection
✅ **compression** - Efficient response compression (gzip/brotli)
✅ **rateLimit** - Configurable request rate limiting
✅ **requestId** - Unique request tracking for debugging
✅ **timer** - Request performance monitoring
✅ **logger** - Request/response logging with multiple formats

All middleware are:

- **Production-ready** with sensible defaults
- **Highly configurable** for specific needs
- **Type-safe** with full TypeScript support
- **Performance-optimized** for minimal overhead
- **Well-documented** with comprehensive examples

---

_NextRush v2 Built-in Middleware API Reference_
