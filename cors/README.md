# @nextrush/cors

> Enterprise-grade, security-hardened CORS middleware for NextRush.

Protect your APIs with comprehensive Cross-Origin Resource Sharing controls, including protection against null origin attacks, ReDoS vulnerabilities, and Private Network Access support.

## The Problem

CORS is one of the most misconfigured security features on the web. Common mistakes include:

- **Wildcard with credentials** allows any site to steal user sessions
- **Null origin bypass** lets attackers from `file://` or sandboxed iframes access your API
- **Regex ReDoS** crashes your server with crafted origin strings
- **Missing validation** for `javascript:`, `data:`, and `file:` protocol origins
- **No Private Network Access** support blocks legitimate local development

Most CORS libraries either ignore these threats or handle them inconsistently. NextRush's CORS middleware treats security as a first-class concern while remaining simple to configure.

## Installation

```bash
pnpm add @nextrush/cors
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';
import { cors } from '@nextrush/cors';

const app = createApp();

// Secure CORS for production
app.use(cors({
  origin: 'https://app.example.com',
  credentials: true,
}));

app.get('/api/data', (ctx) => {
  ctx.json({ message: 'Hello from API' });
});

await serve(app, { port: 3000 });
```

## Mental Model

Think of CORS middleware as a **security checkpoint** for cross-origin requests:

```
Browser Request (from different origin)
     │
     ▼
┌─────────────────────────────────────────────────┐
│            CORS Security Checkpoint             │
├─────────────────────────────────────────────────┤
│  1. Check Origin header presence                │
│  2. Validate origin format (block malformed)    │
│  3. Check against allowed origins               │
│  4. Block null origin attacks (default)         │
│  5. Handle preflight (OPTIONS) requests         │
│  6. Set appropriate response headers            │
│  7. Apply Vary header for caching               │
└─────────────────────────────────────────────────┘
     │
     ▼
  Request proceeds (or is blocked)
```

The middleware **blocks** requests that:
- Come from origins not in your whitelist
- Use `null` origin (file://, data URLs, sandboxed iframes)
- Have malformed origins (`javascript:`, `data:`, `file:`)
- Try to use credentials with wildcard origin

---

## API Reference

### `cors(options?)`

Main CORS middleware with comprehensive security features.

```typescript
import { cors } from '@nextrush/cors';

app.use(cors({
  origin: 'https://example.com',    // Allowed origin(s)
  methods: 'GET,POST,PUT,DELETE',   // Allowed methods
  allowedHeaders: ['Content-Type'], // Request headers allowed
  exposedHeaders: ['X-Request-Id'], // Response headers exposed
  credentials: true,                // Allow cookies/auth
  maxAge: 86400,                    // Preflight cache (seconds)
  privateNetworkAccess: true,       // Enable PNA support
  blockNullOrigin: true,            // Block null origins (default)
  preflightContinue: false,         // End OPTIONS here (default)
  optionsSuccessStatus: 204,        // Status for OPTIONS (default)
}));
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `origin` | `boolean \| string \| string[] \| RegExp \| Function` | `false` | Origin validation configuration |
| `methods` | `string \| string[]` | `'GET,HEAD,PUT,PATCH,POST,DELETE'` | Allowed HTTP methods |
| `allowedHeaders` | `string \| string[]` | _reflected_ | Allowed request headers (reflects if unset) |
| `exposedHeaders` | `string \| string[]` | `undefined` | Headers accessible to client JavaScript |
| `credentials` | `boolean` | `false` | Allow cookies and auth headers |
| `maxAge` | `number` | `undefined` | Preflight response cache duration (seconds) |
| `privateNetworkAccess` | `boolean` | `false` | Enable Private Network Access support |
| `blockNullOrigin` | `boolean` | `true` | Block requests with `null` origin |
| `preflightContinue` | `boolean` | `false` | Pass OPTIONS to next middleware |
| `optionsSuccessStatus` | `number` | `204` | Status code for OPTIONS response |

---

### `simpleCors()`

Permissive preset for development or truly public APIs.

```typescript
import { simpleCors } from '@nextrush/cors';

// Development only
if (process.env.NODE_ENV === 'development') {
  app.use(simpleCors());
}
```

**Configuration:**
- `origin: '*'` - Any origin
- `credentials: false` - No cookies/auth
- `blockNullOrigin: true` - Still blocks null origin attacks

⚠️ **Warning**: Logs a security warning in production.

---

### `strictCors(origin, options?)`

Strict preset for authenticated APIs with credentials.

```typescript
import { strictCors } from '@nextrush/cors';

// Single origin
app.use(strictCors('https://app.example.com'));

// Multiple origins
app.use(strictCors([
  'https://app.example.com',
  'https://admin.example.com',
]));

// With options
app.use(strictCors('https://app.example.com', {
  exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining'],
  maxAge: 86400,
}));
```

**Configuration:**
- `credentials: true` - Always enabled
- `blockNullOrigin: true` - Always enabled
- `maxAge: 86400` - 24-hour preflight cache (customizable)
- Origin is **required** (throws if missing or wildcard)

---

## Origin Configuration

### String (Exact Match)

```typescript
cors({ origin: 'https://example.com' })
// Only https://example.com allowed (exact match, case-sensitive)
```

### Array (Whitelist)

```typescript
cors({
  origin: [
    'https://app.example.com',
    'https://admin.example.com',
    'https://staging.example.com',
  ]
})
```

### Boolean

```typescript
// Reflect mode - echoes request origin (DANGEROUS)
cors({ origin: true })

// Disabled - no CORS headers added
cors({ origin: false })
```

### RegExp (Pattern Match)

```typescript
// Match all subdomains
cors({ origin: /\.example\.com$/ })

// Match specific patterns
cors({ origin: /^https:\/\/(app|admin)\.example\.com$/ })
```

⚠️ **Security**: Regex patterns are checked for ReDoS vulnerability. Avoid nested quantifiers like `(.*)+` or `(.+)*`.

### Function (Dynamic Validation)

```typescript
// Sync validation
cors({
  origin: (origin, ctx) => {
    return origin.endsWith('.example.com');
  }
})

// Async validation (database lookup)
cors({
  origin: async (origin, ctx) => {
    const tenantId = ctx.get('X-Tenant-Id');
    const allowed = await db.getAllowedOrigins(tenantId);
    return allowed.includes(origin);
  }
})

// Return custom origin
cors({
  origin: (origin, ctx) => {
    if (isAllowed(origin)) {
      return origin; // Return the allowed origin
    }
    return false; // Block
  }
})
```

**Validator signature:**

```typescript
type OriginValidator = (
  origin: string,
  ctx: CorsContext
) => boolean | string | Promise<boolean | string>;
```

---

## Security Features

### Null Origin Protection

The `null` origin appears in:
- Local `file://` pages
- `data:` URLs
- Sandboxed `<iframe>` elements
- Some redirect scenarios

**Default behavior:** Block all null origins.

```typescript
// Default: null origins blocked
cors({ origin: 'https://example.com' })
// Request with Origin: null → Blocked

// Explicitly allow (use with caution)
cors({
  origin: true,
  blockNullOrigin: false,
})
// Request with Origin: null → Allowed (reflects null)
```

---

### Malformed Origin Rejection

Origins using dangerous protocols are automatically blocked:

```typescript
// These are blocked automatically:
// javascript:void(0)
// data:text/html,<h1>Evil</h1>
// file:///etc/passwd
// anything not starting with http:// or https://
```

A security warning is logged in development when malformed origins are rejected.

---

### Credential + Wildcard Validation

The CORS spec forbids `Access-Control-Allow-Origin: *` with `credentials: true`. This middleware **throws an error at configuration time**:

```typescript
// ❌ This throws an error immediately
cors({
  origin: '*',
  credentials: true,
})
// Error: Cannot use credentials=true with origin="*"

// ✅ Use explicit origin instead
cors({
  origin: 'https://app.example.com',
  credentials: true,
})
```

Using `origin: true` (reflect mode) with credentials is allowed but logs a warning.

---

### ReDoS Mitigation

Regular expressions with nested quantifiers can cause catastrophic backtracking:

```typescript
// ⚠️ Potentially dangerous patterns (logged as warning):
cors({ origin: /(.*)+\.example\.com/ })  // (.*)+
cors({ origin: /(.+)+\.example\.com/ })  // (.+)+
cors({ origin: /(.+)*\.example\.com/ })  // (.+)*

// ✅ Safe patterns:
cors({ origin: /\.example\.com$/ })
cors({ origin: /^https:\/\/[a-z]+\.example\.com$/ })
```

---

### Validator Error Handling

If your custom origin validator throws an error, the middleware:
1. Logs a security warning
2. Blocks the request (fail-secure)
3. Continues without crashing

```typescript
cors({
  origin: async (origin) => {
    const result = await db.checkOrigin(origin);
    // If db.checkOrigin throws, request is blocked safely
    return result;
  }
})
```

---

### Private Network Access (PNA)

Enable PNA for local development servers accessed from public sites:

```typescript
cors({
  origin: 'https://external-app.com',
  privateNetworkAccess: true,
})
```

When a browser sends `Access-Control-Request-Private-Network: true` in a preflight, the middleware responds with `Access-Control-Allow-Private-Network: true`.

**Use cases:**
- Local development tools accessed from cloud IDEs
- IoT device configuration from web dashboards
- Internal network services accessed from public web apps

---

## Preflight Requests

OPTIONS requests with `Access-Control-Request-Method` are handled automatically:

```typescript
app.use(cors({
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Custom-Header'],
  maxAge: 86400, // Cache preflight for 24 hours
}));
```

### Custom Preflight Handling

```typescript
app.use(cors({
  preflightContinue: true, // Pass OPTIONS to next middleware
}));

// Custom handler
app.options('/api/special', (ctx) => {
  ctx.set('X-Custom-Preflight', 'handled');
  ctx.status = 204;
});
```

---

## Headers Set

| Header | When Set | Description |
|--------|----------|-------------|
| `Access-Control-Allow-Origin` | Always (if origin allowed) | The allowed origin or `*` |
| `Access-Control-Allow-Methods` | Preflight only | Allowed HTTP methods |
| `Access-Control-Allow-Headers` | Preflight only | Allowed request headers |
| `Access-Control-Allow-Credentials` | When `credentials: true` | Enables cookies/auth |
| `Access-Control-Expose-Headers` | When configured | Headers client can read |
| `Access-Control-Max-Age` | When configured | Preflight cache duration |
| `Access-Control-Allow-Private-Network` | When PNA requested | Enables private network access |
| `Vary` | Always | `Origin` (and preflight headers) |

---

## Common Patterns

### API with Frontend SPA

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  exposedHeaders: ['X-Request-Id', 'X-RateLimit-Remaining'],
  maxAge: 86400,
}));
```

### Public Read-Only API

```typescript
app.use(cors({
  origin: '*',
  methods: ['GET', 'HEAD'],
  maxAge: 86400,
}));
```

### Multi-Tenant SaaS

```typescript
app.use(cors({
  origin: async (origin, ctx) => {
    const tenantId = ctx.get('X-Tenant-Id');
    if (!tenantId) return false;

    const tenant = await db.getTenant(tenantId);
    return tenant.allowedOrigins.includes(origin);
  },
  credentials: true,
}));
```

### Development vs Production

```typescript
const corsOptions = process.env.NODE_ENV === 'production'
  ? {
      origin: ['https://app.example.com', 'https://admin.example.com'],
      credentials: true,
    }
  : {
      origin: true,  // Reflect all origins in development
      credentials: true,
    };

app.use(cors(corsOptions));
```

### Microservices (Internal)

```typescript
// Trust internal services
app.use(cors({
  origin: [
    'https://service-a.internal.example.com',
    'https://service-b.internal.example.com',
  ],
  credentials: true,
  privateNetworkAccess: true,
}));
```

---

## TypeScript Types

```typescript
import type {
  // Main types
  CorsOptions,
  OriginValidator,
  CorsContext,
  CorsMiddleware,

  // Re-exported from @nextrush/types
  Context,
  Middleware,
  Next,
} from '@nextrush/cors';
```

### Key Type Definitions

```typescript
type OriginValidator = (
  origin: string,
  ctx: CorsContext
) => boolean | string | Promise<boolean | string>;

interface CorsOptions {
  origin?: boolean | string | string[] | RegExp | OriginValidator;
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
  privateNetworkAccess?: boolean;
  blockNullOrigin?: boolean;
}

interface CorsContext {
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string | string[] | undefined>;
  get(header: string): string | undefined;
}
```

---

## Comparison with Popular Libraries

| Feature | @nextrush/cors | cors (Express) | @koa/cors |
|---------|----------------|----------------|-----------|
| Null origin protection | ✅ Default on | ❌ No | ❌ No |
| ReDoS detection | ✅ Yes | ❌ No | ❌ No |
| Credential+wildcard validation | ✅ Throws error | ❌ Silent | ⚠️ Warning |
| Private Network Access | ✅ Yes | ❌ No | ❌ No |
| Malformed origin rejection | ✅ Yes | ❌ No | ❌ No |
| Validator error handling | ✅ Fail-secure | ❌ Crashes | ❌ Crashes |
| Security warnings | ✅ Development | ❌ No | ❌ No |
| TypeScript | ✅ Native | ⚠️ @types | ⚠️ @types |
| Zero dependencies | ✅ Yes | ❌ 2 deps | ❌ 1 dep |

---

## Security Checklist

Before deploying to production:

- [ ] **Explicit origins**: Don't use `origin: true` or `origin: '*'` with credentials
- [ ] **Credential validation**: Use `strictCors()` or ensure `credentials: true` only with explicit origins
- [ ] **Null origin blocked**: Keep `blockNullOrigin: true` (default)
- [ ] **Regex reviewed**: Ensure origin patterns don't have ReDoS vulnerabilities
- [ ] **Exposed headers minimal**: Only expose headers that clients actually need
- [ ] **Max age set**: Use `maxAge` to reduce preflight requests
- [ ] **Development warning**: Check console for security warnings before deployment

---

## See Also

- [VitePress Documentation](/docs/middleware/cors.md) - Full guides and examples
- [@nextrush/core](../core) - Core application framework
- [@nextrush/body-parser](../middleware/body-parser) - Request body parsing
- [OWASP CORS Guide](https://owasp.org/www-community/attacks/CORS_OriginHeaderScrutiny) - Security best practices

---

## License

MIT
