# NextRush Middleware Reference

All available middleware packages with import paths, signatures, and examples. Every middleware follows the `(options?) => Middleware` factory pattern.

## cors — `@nextrush/cors`

```typescript
import { cors } from '@nextrush/cors';

app.use(cors({
  origin: 'https://example.com',   // or '*' | string[] | RegExp | (origin, ctx) => string
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count'],
  credentials: true,
  maxAge: 86400,                    // preflight cache seconds
}));

// Presets
import { corsPresets } from '@nextrush/cors';
app.use(cors(corsPresets.permissive));  // allow all origins
app.use(cors(corsPresets.strict));      // same-origin only
```

## helmet — `@nextrush/helmet`

```typescript
import { helmet } from '@nextrush/helmet';

app.use(helmet());  // sensible defaults

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  xssFilter: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

## body-parser — `@nextrush/body-parser`

```typescript
import { json, text, urlencoded, bodyParser } from '@nextrush/body-parser';
import { formData } from '@nextrush/form-data';

// Individual parsers
app.use(json({ limit: '1mb' }));
app.use(text({ type: 'text/*' }));
app.use(urlencoded({ extended: true }));
app.use(formData({ maxFileSize: '10mb' }));

// All-in-one (registers json + text + urlencoded)
app.use(bodyParser());

// Per-route
router.post('/upload', formData({ maxFileSize: '50mb' }), (ctx) => {
  const files = ctx.body.files;
  const fields = ctx.body.fields;
});
```

## validation — `@nextrush/validation`

```typescript
import { validate } from '@nextrush/validation';
import { z } from 'zod';

// Single schema → validates ctx.body
router.post('/users', validate(z.object({ name: z.string().min(1) })), handler);

// Named targets
router.post('/users',
  validate({
    body: CreateUserSchema,
    query: z.object({ dryRun: z.boolean().optional() }),
    params: z.object({ id: z.string().uuid() }),
  }),
  handler
);

// Types
import type { ValidationSchema, ValidationTarget } from '@nextrush/validation';
```

## rate-limit — `@nextrush/rate-limit`

```typescript
import { rateLimit } from '@nextrush/rate-limit';

app.use(rateLimit({
  windowMs: 60_000,      // 1 minute window
  max: 100,               // 100 requests per window
  keyGenerator: (ctx) => ctx.get('x-forwarded-for') || ctx.get('host'),
}));

// Custom store (Redis, etc.)
app.use(rateLimit({
  max: 1000,
  store: new RedisStore({ client: redis }),
}));
```

## compression — `@nextrush/compression`

```typescript
import { compression } from '@nextrush/compression';

app.use(compression());  // gzip + deflate, skips small/compressed responses

app.use(compression({
  threshold: 1024,        // min bytes to compress
  level: 6,               // zlib compression level
  brotli: true,           // enable brotli
  filter: (ctx) => !ctx.path.startsWith('/stream'),
}));
```

## cookies — `@nextrush/cookies`

```typescript
import { cookies, signedCookies } from '@nextrush/cookies';

app.use(cookies());
app.use(signedCookies({ secret: 'signing-secret' }));  // opt-in, for signed cookies

// In handler
router.get('/', (ctx) => {
  const sessionId = ctx.cookies.get('session');           // read
  ctx.cookies.set('theme', 'dark', { httpOnly: true });    // write
  ctx.cookies.delete('session');                           // delete
  const signed = await ctx.cookies.signed.get('auth-token'); // verify signed
});
```

Notes:
- `cookies()` takes no secret — it is the plain read/write middleware. Signing is the
  separate `signedCookies()` middleware, and `signedCookies()` requires `cookies()` first.
- `ctx.cookies` always exists and is fully typed (RFC-034). Before the middleware runs,
  operations throw `CapabilityNotInitializedError` with a WHAT/WHY/HOW/WHERE diagnostic.
- `ctx.state.cookies` / `ctx.state.signedCookies` are deprecated aliases, removed next major.

## csrf — `@nextrush/csrf`

```typescript
import { csrf } from '@nextrush/csrf';

app.use(csrf({ secret: 'csrf-secret' }));

// Token available as ctx.csrfToken — include in forms
// Validates X-CSRF-Token header or _csrf body field on state-changing methods
```

## static — `@nextrush/static`

```typescript
import { staticMiddleware } from '@nextrush/static';

app.use(staticMiddleware({
  root: './public',
  index: 'index.html',
  cacheControl: 'public, max-age=3600',
}));

router.get('/assets/*', staticMiddleware({ root: './dist/assets' }));
```

## template — `@nextrush/template`

```typescript
import { template } from '@nextrush/template';

app.use(template({ root: './views', extension: '.html' }));

// In handler
router.get('/welcome', (ctx) => {
  ctx.render('welcome', { name: 'Alice', items: [1, 2, 3] });
});

// Template syntax supports {{ variable }}, {{#each}}, {{#if}}, {{> partial}}
```

## logger — `@nextrush/logger`

```typescript
import { logger } from '@nextrush/logger';

app.use(logger());  // colored console output

app.use(logger({
  format: 'combined',         // combined | common | dev | short | custom
  customFormat: (ctx, elapsed) => `${ctx.method} ${ctx.path} ${ctx.status} ${elapsed}ms`,
  stream: fs.createWriteStream('./access.log'),
}));
```

## timer — `@nextrush/timer`

```typescript
import { timer } from '@nextrush/timer';

app.use(timer());  // adds X-Response-Time header
```

## request-id — `@nextrush/request-id`

```typescript
import { requestId } from '@nextrush/request-id';

app.use(requestId());  // X-Request-Id: uuid

app.use(requestId({ headerName: 'X-Correlation-Id', generator: () => nanoid() }));
```

## health — `@nextrush/health`

```typescript
import { health } from '@nextrush/health';

app.use(health({
  path: '/health',
  checks: {
    database: async () => { await db.ping(); return true; },
    cache: async () => { await redis.ping(); return true; },
  },
}));
// GET /health → { status: 'ok', checks: { database: true, cache: true } }
```

## openapi — `@nextrush/openapi`

```typescript
import { openapi } from '@nextrush/openapi';

app.use(openapi({
  router,
  info: { title: 'My API', version: '1.0.0', description: 'API docs' },
  servers: [{ url: 'https://api.example.com' }],
  security: [{ bearerAuth: [] }],
}));

// GET /openapi.json — OpenAPI 3.1 spec
// GET /docs — Swagger UI
// Auto-discovers routes with endpoint() metadata and validate() schemas
```

## Middleware Ordering Convention

```
1. errorHandler        (outermost — catches everything)
2. requestId           (early — tag every request)
3. timer               (early — time everything)
4. logger              (early — log everything)
5. helmet              (security headers first)
6. cors                (preflight handling)
7. compression         (before body parsing)
8. cookies             (before body parsing)
9. csrf                (before body parsing)
10. bodyParser          (enables ctx.body)
11. rateLimit           (after body parsing — can inspect body if needed)
12. validation          (route-level, after body parsing)
13. static              (fallback, near the end)
14. openapi             (near the end, reads route metadata)
15. Routes              (last — the actual handlers)
```
