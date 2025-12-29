# @nextrush/cors

> Enterprise-grade Cross-Origin Resource Sharing with built-in protection against security vulnerabilities.

## The Problem

CORS is one of the most misconfigured security features on the web. Every API that serves different origins faces the same challenges:

**Security misconfigurations are everywhere.** Using `origin: '*'` with `credentials: true` allows any website to steal user sessions. Reflecting origins without validation enables CSRF attacks. Most developers learn this the hard way—after a security audit.

**Null origin attacks bypass naive validation.** Requests from `file://` URLs, `data:` URLs, and sandboxed iframes send `Origin: null`. Many CORS implementations accept this as a valid origin, creating a massive security hole.

**Regex patterns can crash your server.** Using regular expressions for origin matching is convenient, but patterns with nested quantifiers can trigger catastrophic backtracking (ReDoS), freezing your server for minutes.

**Private Network Access is silently blocked.** Modern browsers require explicit permission for public websites to access local network resources. Without PNA support, legitimate development workflows break mysteriously.

## What NextRush Does Differently

NextRush's CORS middleware treats **security as a first-class feature**, not an afterthought:

- **Origin format validation** blocks `javascript:`, `data:`, and `file:` protocols
- **Null origin protection** blocks requests from sandboxed contexts by default
- **Credential + wildcard validation** throws errors at configuration time
- **ReDoS detection** warns about dangerous regex patterns
- **Fail-secure validators** block requests when custom validators throw errors
- **Private Network Access** support for local development scenarios

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
┌──────────────────────────────────────────────┐
│         CORS Security Checkpoint             │
├──────────────────────────────────────────────┤
│ 1. Check Origin header presence              │
│ 2. Validate origin format (block malicious)  │
│ 3. Check against allowed origins             │
│ 4. Block null origin attacks (default)       │
│ 5. Handle preflight (OPTIONS) requests       │
│ 6. Set appropriate response headers          │
│ 7. Apply Vary header for caching             │
└──────────────────────────────────────────────┘
       │
       ▼
  Request proceeds (or blocked)
```

Anything that doesn't pass validation simply doesn't receive CORS headers, which means the browser blocks the response from JavaScript.

## API Reference

### Main Function

```typescript
cors(options?: CorsOptions): Middleware
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `origin` | `boolean \| string \| string[] \| RegExp \| Function` | `false` | Origin validation |
| `methods` | `string \| string[]` | `'GET,HEAD,PUT,PATCH,POST,DELETE'` | Allowed methods |
| `allowedHeaders` | `string \| string[]` | _reflected_ | Allowed request headers |
| `exposedHeaders` | `string \| string[]` | `undefined` | Headers client can read |
| `credentials` | `boolean` | `false` | Allow cookies/auth |
| `maxAge` | `number` | `undefined` | Preflight cache (seconds) |
| `privateNetworkAccess` | `boolean` | `false` | Enable PNA |
| `blockNullOrigin` | `boolean` | `true` | Block null origins |
| `preflightContinue` | `boolean` | `false` | Pass OPTIONS to next |
| `optionsSuccessStatus` | `number` | `204` | Status for OPTIONS |

## Origin Configuration

### String (Exact Match)

```typescript
cors({ origin: 'https://example.com' })
```

### Array (Whitelist)

```typescript
cors({
  origin: [
    'https://app.example.com',
    'https://admin.example.com',
  ]
})
```

### RegExp (Pattern Match)

```typescript
cors({ origin: /\.example\.com$/ })
```

### Function (Dynamic Validation)

```typescript
cors({
  origin: async (origin, ctx) => {
    const allowed = await db.getAllowedOrigins(ctx.get('X-Tenant-Id'));
    return allowed.includes(origin);
  }
})
```

### Presets

```typescript
import { simpleCors, strictCors } from '@nextrush/cors';

// Permissive - for development or public APIs
app.use(simpleCors());

// Strict - for authenticated APIs
app.use(strictCors('https://app.example.com'));
```

## Security Features

### Null Origin Protection

Blocks requests with `Origin: null` by default, preventing attacks from sandboxed iframes and local files.

### Credential + Wildcard Validation

```typescript
// ❌ This throws an error immediately
cors({ origin: '*', credentials: true })
// Error: Cannot use credentials=true with origin="*"

// ✅ Use explicit origin instead
cors({ origin: 'https://app.example.com', credentials: true })
```

### ReDoS Mitigation

Detects and warns about dangerous regex patterns:

```typescript
// ⚠️ Logs warning for dangerous patterns:
cors({ origin: /(.*)+\.example\.com/ })

// ✅ Safe patterns (no warning):
cors({ origin: /\.example\.com$/ })
```

### Private Network Access

Enable PNA for local development servers accessed from public sites:

```typescript
cors({
  origin: 'https://external-app.com',
  privateNetworkAccess: true,
})
```

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
    const tenant = await db.getTenant(tenantId);
    return tenant.allowedOrigins.includes(origin);
  },
  credentials: true,
}));
```

## Common Mistakes

### Mistake 1: Wildcard with Credentials

```typescript
// ❌ THROWS ERROR: Security violation
cors({ origin: '*', credentials: true })

// ✅ Use explicit origin
cors({ origin: 'https://app.example.com', credentials: true })
```

### Mistake 2: Wrong Middleware Order

```typescript
// ❌ Authentication fails before CORS headers are set
app.use(authMiddleware);
app.use(cors({ origin: 'https://app.example.com' }));

// ✅ CORS first, then authentication
app.use(cors({ origin: 'https://app.example.com' }));
app.use(authMiddleware);
```

### Mistake 3: Dangerous Regex Patterns

```typescript
// ❌ ReDoS vulnerability
cors({ origin: /(.*)+\.example\.com/ })

// ✅ Safe pattern
cors({ origin: /\.example\.com$/ })
```

## Runtime Compatibility

This package works in:

| Runtime | Supported |
|---------|-----------|
| Node.js 20+ | ✅ |
| Bun | ✅ |
| Cloudflare Workers | ✅ |
| Deno | ✅ |
| Vercel Edge Runtime | ✅ |

## TypeScript Types

```typescript
import type {
  CorsOptions,
  OriginValidator,
  CorsContext,
  Middleware,
} from '@nextrush/cors';
```

## Security Checklist

Before deploying to production:

- [ ] **Explicit origins**: Don't use `origin: true` or `origin: '*'` with credentials
- [ ] **Null origin blocked**: Keep `blockNullOrigin: true` (default)
- [ ] **Regex reviewed**: Ensure patterns don't have ReDoS vulnerabilities
- [ ] **Exposed headers minimal**: Only expose headers clients actually need
- [ ] **Max age set**: Use `maxAge` to reduce preflight requests

## See Also

- [OWASP CORS Guide](https://owasp.org/www-community/attacks/CORS_OriginHeaderScrutiny)
- [PNA Specification](https://wicg.github.io/private-network-access/)
- [Helmet Middleware](/middleware/helmet) - Security headers
- [Rate Limit Middleware](/middleware/rate-limit) - Request throttling

## License

MIT
