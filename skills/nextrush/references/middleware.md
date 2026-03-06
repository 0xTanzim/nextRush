<!--reference file for the NextRush skill. Do not edit unless updating for new APIs. -->

# Middleware

Koa-style async middleware for intercepting, transforming, and controlling the HTTP lifecycle.

## Part A: Middleware Patterns

### 1. Middleware Signature

```typescript
import type { Middleware } from '@nextrush/types';

const myMiddleware: Middleware = async (ctx) => {
  // Upstream — runs before route handler
  await ctx.next();
  // Downstream — runs after route handler
};
```

### 2. Registration

```typescript
import { createApp } from 'nextrush';

const app = createApp();
app.use(myMiddleware);
```

Order matters. First registered = outermost (runs first on request, last on response).

### 3. Upstream / Downstream

```typescript
const timer: Middleware = async (ctx) => {
  const start = Date.now(); // Upstream
  await ctx.next();
  ctx.set('X-Response-Time', `${Date.now() - start}ms`); // Downstream
};
```

### 4. Short-Circuit

Return a response without calling `ctx.next()` to stop the chain:

```typescript
const auth: Middleware = async (ctx) => {
  if (!ctx.get('authorization')) {
    ctx.status = 401;
    return ctx.json({ error: 'Unauthorized' });
  }
  ctx.state.user = verifyToken(ctx.get('authorization')!);
  await ctx.next();
};
```

### 5. Error Boundary

Register as the FIRST middleware so it wraps everything:

```typescript
import { HttpError } from 'nextrush';

const errorHandler: Middleware = async (ctx) => {
  try {
    await ctx.next();
  } catch (err) {
    if (err instanceof HttpError) {
      ctx.status = err.statusCode;
      ctx.json({ error: { status: err.statusCode, message: err.message } });
    } else {
      ctx.status = 500;
      ctx.json({ error: { status: 500, message: 'Internal Server Error' } });
    }
  }
};
```

### 6. State Passing

Use `ctx.state` to pass data between middleware:

```typescript
const loadUser: Middleware = async (ctx) => {
  ctx.state.user = await getUserFromToken(ctx.get('authorization'));
  await ctx.next();
};

// Later middleware or route handler:
const user = ctx.state.user;
```

### 7. Composition

Combine multiple middleware into one using `compose()`:

```typescript
import { compose } from '@nextrush/core';

const combined = compose([auth, loadUser, validate]);
app.use(combined);
```

---

## Part B: Built-in Middleware Packages

### 8. body-parser (`@nextrush/body-parser`)

```typescript
import { bodyParser, json, urlencoded, text, raw } from '@nextrush/body-parser';

app.use(bodyParser()); // Auto-detect content type
app.use(json({ limit: '1mb', strict: true })); // JSON only
app.use(urlencoded({ extended: true, depth: 5 })); // Form data
app.use(text({ type: ['text/plain', 'text/html'] })); // Text bodies
app.use(raw({ type: 'application/octet-stream' })); // Binary bodies
```

### 9. cors (`@nextrush/cors`)

```typescript
import {
  cors,
  devCors,
  strictCors,
  simpleCors,
  staticAssetsCors,
  internalCors,
} from '@nextrush/cors';

app.use(cors()); // Default permissive
app.use(cors({ origin: 'https://example.com', credentials: true }));

// Presets
app.use(devCors()); // Permissive for development
app.use(strictCors()); // Locked-down production
app.use(simpleCors()); // Minimal CORS
app.use(staticAssetsCors()); // Static asset serving
app.use(internalCors()); // Internal service communication
```

Options: `origin`, `methods`, `allowedHeaders`, `exposedHeaders`, `credentials`, `maxAge`.

### 10. helmet (`@nextrush/helmet`)

```typescript
import {
  helmet,
  strictHelmet,
  devHelmet,
  apiHelmet,
  staticHelmet,
  hsts,
  frameguard,
  noSniff,
  hidePoweredBy,
  contentSecurityPolicy,
  referrerPolicy,
  CspBuilder,
  PermissionsPolicyBuilder,
} from '@nextrush/helmet';

app.use(helmet()); // Default security headers

// Presets
app.use(strictHelmet()); // Maximum security
app.use(devHelmet()); // Relaxed for development
app.use(apiHelmet()); // API-optimized
app.use(staticHelmet()); // Static file serving

// Individual headers
app.use(hsts());
app.use(frameguard());
app.use(noSniff());
app.use(hidePoweredBy());

// CSP builder
const csp = new CspBuilder().defaultSrc("'self'").scriptSrc("'self'", "'nonce-abc123'");
app.use(contentSecurityPolicy(csp.build()));

// Permissions-Policy builder
const pp = new PermissionsPolicyBuilder();
```

### 11. rate-limit (`@nextrush/rate-limit`)

```typescript
import { rateLimit, tieredRateLimit, MemoryStore } from '@nextrush/rate-limit';

app.use(rateLimit()); // 100 req/min per IP
app.use(rateLimit({ max: 1000, window: '15m' }));

// Algorithms: 'token-bucket' (default), 'sliding-window', 'fixed-window'
app.use(rateLimit({ algorithm: 'sliding-window', max: 100, window: '1m' }));

// Tiered limits
app.use(
  tieredRateLimit({
    tiers: {
      anonymous: { max: 60, window: '1m' },
      authenticated: { max: 1000, window: '1m' },
      premium: { max: 10000, window: '1m' },
    },
    tierResolver: (ctx) => ctx.state.user?.tier || 'anonymous',
  })
);

// CIDR whitelist
app.use(rateLimit({ whitelist: ['192.168.0.0/16', '10.0.0.0/8'] }));
```

Store: `MemoryStore` (default). Implement `RateLimitStore` interface for Redis/custom.

### 12. compression (`@nextrush/compression`)

```typescript
import { compression, gzip, deflate, brotli } from '@nextrush/compression';

app.use(compression()); // Auto-negotiate
app.use(compression({ level: 9, threshold: 512, brotli: true }));

// Specific algorithms
app.use(gzip());
app.use(deflate());
app.use(brotli());
```

Works across Node.js, Bun, Deno, and Edge via Web Compression Streams API.

### 13. cookies (`@nextrush/cookies`)

```typescript
import {
  cookies,
  signedCookies,
  parseCookies,
  serializeCookie,
  secureOptions,
} from '@nextrush/cookies';

app.use(cookies()); // Parse cookies
app.use(signedCookies({ keys: ['secret-key'] })); // Signed cookies

// In handler:
ctx.state.cookies.set('session', 'value', { httpOnly: true, secure: true });
ctx.state.cookies.get('session');
ctx.state.cookies.delete('session');
```

Supports HMAC-SHA256 signing, key rotation, `__Secure-` and `__Host-` prefixes.

### 14. csrf (`@nextrush/csrf`)

```typescript
import { csrf, generateToken, validateToken } from '@nextrush/csrf';

app.use(csrf()); // Signed Double-Submit Cookie

// Manual token operations
const token = generateToken(secret, sessionId);
const valid = validateToken(token, secret, sessionId);
```

Default ignored methods: GET, HEAD, OPTIONS.

### 15. multipart (`@nextrush/multipart`)

```typescript
import { multipart, DiskStorage, MemoryStorage } from '@nextrush/multipart';
app.use(multipart({ storage: new DiskStorage({ dest: './uploads' }) })); // Disk
app.use(multipart({ storage: new MemoryStorage() })); // Memory
app.use(
  multipart({
    storage: new DiskStorage({ dest: './uploads' }),
    limits: { fileSize: 10 * 1024 * 1024, files: 5, fields: 20 },
  })
);
```

Access: `ctx.state.files`, `ctx.state.fields`.

### 16. request-id (`@nextrush/request-id`)

```typescript
import { requestId, correlationId, traceId } from '@nextrush/request-id';

app.use(requestId()); // Generate/forward X-Request-ID
app.use(correlationId()); // X-Correlation-ID
app.use(traceId()); // X-Trace-ID
```

Uses `crypto.randomUUID()`. Validates incoming IDs to prevent header injection.

### 17. timer (`@nextrush/timer`)

```typescript
import { timer, responseTime, serverTiming, detailedTimer } from '@nextrush/timer';

app.use(timer()); // X-Response-Time header
app.use(responseTime()); // Alias for timer()
app.use(serverTiming()); // Server-Timing header (DevTools integration)
app.use(detailedTimer()); // Detailed timing with start/end timestamps
```

Uses `performance.now()` for sub-millisecond precision.

---

## Part C: Recommended Middleware Order

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// 1. Error boundary (outermost — catches everything)
app.use(errorHandler);

// 2. Request ID / tracing
app.use(requestId());

// 3. Timing
app.use(timer());

// 4. Security headers
app.use(helmet());

// 5. CORS
app.use(cors({ origin: 'https://myapp.com' }));

// 6. Rate limiting
app.use(rateLimit({ max: 100, window: '1m' }));

// 7. Compression
app.use(compression());

// 8. Body parsing
app.use(bodyParser());

// 9. Cookies / CSRF
app.use(cookies());
app.use(csrf());

// 10. Authentication middleware
app.use(auth);

// 11. Routes
app.route('/api', router);
```

---

## Rules

- MUST call `ctx.next()` OR send a response — never both, never neither
- Use `ctx.state` for passing data between middleware (not globals)
- Keep each middleware focused on one responsibility
- No blocking synchronous I/O
- Error handler must be the outermost middleware
- Never include stack traces or internal paths in error responses

## Troubleshooting

| Problem                    | Cause                                         | Solution                                        |
| -------------------------- | --------------------------------------------- | ----------------------------------------------- |
| Response never sent        | Missing `ctx.next()` and no explicit response | Add `await ctx.next()` or send a response       |
| Double response            | Calls `ctx.next()` AND sends response         | Choose one — next() or response, not both       |
| State undefined downstream | Set `ctx.state` after `ctx.next()`            | Set state BEFORE calling `await ctx.next()`     |
| Middleware skipped         | Registered after routes                       | Register middleware before mounting routes      |
| Error not caught           | Error middleware not first                    | Register error handler as the FIRST `app.use()` |
| CORS preflight fails       | Missing cors() middleware                     | Add `cors()` before route handlers              |
| Body is undefined          | No body parser registered                     | Add `bodyParser()` before route handlers        |
| Rate limit not working     | Whitelist too broad                           | Check `whitelist` CIDR ranges                   |
