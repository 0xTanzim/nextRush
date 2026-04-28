# Middleware

NextRush middleware follows the Koa-style async pattern. Every middleware is an `async (ctx, next) => void` function.

---

## Writing Custom Middleware

```typescript
import type { Middleware } from 'nextrush';

const requestLogger: Middleware = async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.method} ${ctx.path} ${ctx.status} — ${ms}ms`);
};

app.use(requestLogger);
```

### Middleware That Short-Circuits

Return without calling `next()` to stop the chain:

```typescript
const requireAuth: Middleware = async (ctx, next) => {
  if (!ctx.get('authorization')) {
    ctx.status = 401;
    ctx.json({ error: 'Unauthorized' });
    return;   // chain stops here
  }
  await next();
};
```

### Middleware That Modifies State

```typescript
const tenantMiddleware: Middleware = async (ctx, next) => {
  ctx.state.tenantId = ctx.get('x-tenant-id') ?? 'default';
  await next();
};
```

---

## Built-In Middleware Packages

All middleware is installed separately from the core.

---

### `@nextrush/body-parser`

Parse incoming request bodies.

```bash
pnpm add @nextrush/body-parser
```

```typescript
import { json, urlencoded, text, raw, bodyParser } from '@nextrush/body-parser';

// Combined parser (recommended)
app.use(bodyParser());

// Individual parsers
app.use(json({ limit: '10mb', strict: true }));
app.use(urlencoded({ extended: true, depth: 5 }));
app.use(text({ type: ['text/plain', 'text/html'] }));
app.use(raw({ type: 'application/octet-stream' }));
```

---

### `@nextrush/cors`

OWASP-compliant CORS middleware with null-origin and wildcard-credential protection.

```bash
pnpm add @nextrush/cors
```

```typescript
import { cors, strictCors, devCors, simpleCors } from '@nextrush/cors';

// Custom configuration
app.use(cors({
  origin: ['https://app.example.com'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Built-in presets
app.use(strictCors());          // production — strict origin matching
app.use(devCors());             // development — permissive
app.use(simpleCors(['https://app.example.com']));
```

---

### `@nextrush/helmet`

Security headers following OWASP recommendations.

```bash
pnpm add @nextrush/helmet
```

```typescript
import { helmet, apiHelmet } from '@nextrush/helmet';

app.use(helmet());              // all defaults
app.use(apiHelmet());           // preset for JSON APIs
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'nonce-abc123'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));
```

---

### `@nextrush/csrf`

CSRF protection using the Signed Double-Submit Cookie pattern (OWASP recommended).

```bash
pnpm add @nextrush/csrf
```

```typescript
import { csrf } from '@nextrush/csrf';

app.use(csrf({
  secret: process.env.CSRF_SECRET!,
  // Token is read from: X-CSRF-Token header, csrf body field, or _csrf query param
}));
```

---

### `@nextrush/rate-limit`

Rate limiting with Token Bucket (default), Sliding Window, and Fixed Window algorithms.

```bash
pnpm add @nextrush/rate-limit
```

```typescript
import { rateLimit } from '@nextrush/rate-limit';

// Zero-config: 100 req/min per IP
app.use(rateLimit());

// Custom limits
app.use(rateLimit({ max: 1000, window: '15m' }));

// Choose algorithm
app.use(rateLimit({ algorithm: 'sliding-window', max: 100, window: '1m' }));
```

---

### `@nextrush/cookies`

Cookie parsing and serialization.

```bash
pnpm add @nextrush/cookies
```

```typescript
import { cookies } from '@nextrush/cookies';

app.use(cookies());

// In a handler:
ctx.state.cookies.set('session', 'abc123', {
  httpOnly: true,
  secure: true,
  maxAge: 86400,
});
const session = ctx.state.cookies.get('session');
ctx.state.cookies.delete('session');
```

---

### `@nextrush/compression`

Response compression with Gzip, Deflate, and Brotli. Uses the Web Compression Streams API for multi-runtime compatibility.

```bash
pnpm add @nextrush/compression
```

```typescript
import { compression } from '@nextrush/compression';

app.use(compression());
app.use(compression({
  level: 9,        // 1-9 compression level
  threshold: 512,  // skip responses smaller than 512 bytes
}));
```

---

### `@nextrush/multipart`

Multipart form-data parsing with memory and disk storage strategies.

```bash
pnpm add @nextrush/multipart
```

```typescript
import { multipart, MemoryStorage, DiskStorage } from '@nextrush/multipart';

// Memory storage (default)
app.use(multipart({ storage: new MemoryStorage({ maxFileSize: 5 * 1024 * 1024 }) }));

// Disk storage
app.use(multipart({ storage: new DiskStorage({ dest: './uploads' }) }));

// In handler:
const files = ctx.state.files;
const fields = ctx.state.fields;
```

---

### `@nextrush/request-id`

Attach a unique request ID to every request for distributed tracing.

```bash
pnpm add @nextrush/request-id
```

```typescript
import { requestId } from '@nextrush/request-id';

app.use(requestId());
// Each request gets ctx.state.requestId = crypto.randomUUID()
// Also sets X-Request-ID response header
```

---

### `@nextrush/timer`

Measure and expose request duration via response headers.

```bash
pnpm add @nextrush/timer
```

```typescript
import { timer } from '@nextrush/timer';

app.use(timer());
// Sets X-Response-Time header on every response
```

---

## Middleware Ordering

Order matters. Register middleware in this sequence:

```typescript
// 1. Request ID (first — so all middleware can use it)
app.use(requestId());

// 2. Security headers
app.use(helmet());

// 3. CORS (before auth)
app.use(cors());

// 4. Timing
app.use(timer());

// 5. Body parsing
app.use(json());

// 6. Rate limiting
app.use(rateLimit());

// 7. Auth middleware
app.use(requireAuth);

// 8. Routes
app.route('/api', router);
```

---

## Error Middleware from `@nextrush/errors`

```typescript
import { errorHandler, notFoundHandler } from 'nextrush';

// Register as the first middleware to catch all errors from the chain
app.setErrorHandler(async (error, ctx) => {
  // handled internally
});

// Or use the built-in error handler middleware
app.use(errorHandler());

// 404 for unmatched routes — register after all routes
app.use(notFoundHandler());
```
