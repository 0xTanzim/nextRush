# @nextrush/rate-limit

Production-grade rate limiting middleware for NextRush with multiple algorithms, tiered limits, and comprehensive edge case handling.

## Features

- **Multiple Algorithms**: Token Bucket, Sliding Window Counter, Fixed Window
- **Tiered Rate Limits**: Different limits for anonymous, authenticated, and premium users
- **Edge Case Handling**: Shared IPs, corporate NAT, proxy headers, whitelists/blacklists
- **IETF-Compliant Headers**: Standard `RateLimit-*` headers + legacy `X-RateLimit-*`
- **Pluggable Storage**: In-memory store included, Redis-ready interface
- **Zero Dependencies**: No external runtime dependencies

## Installation

```bash
pnpm add @nextrush/rate-limit
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { rateLimit } from '@nextrush/rate-limit';

const app = createApp();

// Zero-config: 100 requests per minute per IP
app.use(rateLimit());

app.get('/', (ctx) => {
  ctx.json({ message: 'Hello World' });
});
```

## Configuration

### Basic Options

```typescript
app.use(rateLimit({
  // Maximum requests per window
  max: 100,

  // Time window: '1m', '15m', '1h', '1d' or milliseconds
  window: '1m',

  // Algorithm: 'token-bucket' | 'sliding-window' | 'fixed-window'
  algorithm: 'token-bucket',

  // Custom key generator (default: client IP)
  keyGenerator: (ctx) => ctx.get('X-API-Key') || ctx.ip,

  // Trust proxy headers for IP extraction
  trustProxy: true,
}));
```

### Advanced Options

```typescript
app.use(rateLimit({
  max: 1000,
  window: '15m',
  algorithm: 'sliding-window',

  // Custom response for rate-limited requests
  handler: (ctx, info) => {
    ctx.status = 429;
    ctx.json({
      error: 'Too Many Requests',
      retryAfter: info.resetTime,
      limit: info.limit,
    });
  },

  // Callback when rate limit is exceeded
  onRateLimited: (ctx, info) => {
    console.log(`Rate limit exceeded for ${ctx.ip}`);
  },

  // Skip rate limiting for certain requests
  skip: (ctx) => ctx.path === '/health',

  // IP whitelist (bypass rate limiting)
  whitelist: ['127.0.0.1', '::1'],

  // IP blacklist (stricter limits)
  blacklist: ['192.168.1.100'],
  blacklistMax: 10,

  // Include legacy X-RateLimit-* headers
  legacyHeaders: true,

  // Include standard RateLimit-* headers
  standardHeaders: true,
}));
```

## Algorithms

### Token Bucket (Default)

Best for APIs that need controlled burst handling. Tokens are added at a fixed rate and consumed per request.

```typescript
app.use(rateLimit({
  algorithm: 'token-bucket',
  max: 100,        // Bucket capacity
  window: '1m',    // Refill rate: max tokens per window
}));
```

**Behavior**: Allows bursts up to `max`, then throttles to `max/window` rate.

### Sliding Window Counter

Most accurate algorithm, prevents boundary attacks. Uses weighted average of current and previous windows.

```typescript
app.use(rateLimit({
  algorithm: 'sliding-window',
  max: 100,
  window: '1m',
}));
```

**Behavior**: Smooth rate limiting with no burst capability.

### Fixed Window

Simplest algorithm with lowest overhead. Resets counter at fixed intervals.

```typescript
app.use(rateLimit({
  algorithm: 'fixed-window',
  max: 100,
  window: '1m',
}));
```

**Behavior**: Allows up to `max` requests per window, resets at boundary.

## Tiered Rate Limits

Apply different limits based on user tier (anonymous, authenticated, premium):

```typescript
import { tieredRateLimit } from '@nextrush/rate-limit';

app.use(tieredRateLimit({
  tiers: {
    anonymous: { max: 60, window: '1m' },
    authenticated: { max: 1000, window: '1m' },
    premium: { max: 10000, window: '1m' },
  },

  // Resolve tier from context
  tierResolver: (ctx) => {
    if (ctx.state.user?.isPremium) return 'premium';
    if (ctx.state.user) return 'authenticated';
    return 'anonymous';
  },

  // Default tier for unknown values
  defaultTier: 'anonymous',
}));
```

## Response Headers

### Standard Headers (IETF Draft)

```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 1640995200
```

### Legacy Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Rate-Limited Response

```
Retry-After: 30
```

## IP Extraction

The middleware supports multiple proxy headers for accurate client IP detection:

```typescript
app.use(rateLimit({
  trustProxy: true,  // Enable proxy header parsing
}));
```

**Priority order**:
1. `CF-Connecting-IP` (Cloudflare)
2. `X-Real-IP` (nginx)
3. `X-Forwarded-For` (first IP)
4. `ctx.ip` (socket address)

## Custom Storage

Implement the `RateLimitStore` interface for Redis or other backends:

```typescript
import type { RateLimitStore, RateLimitEntry } from '@nextrush/rate-limit';

class RedisStore implements RateLimitStore {
  async get(key: string): Promise<RateLimitEntry | null> {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, entry: RateLimitEntry, ttlMs: number): Promise<void> {
    await redis.set(key, JSON.stringify(entry), 'PX', ttlMs);
  }

  async increment(key: string): Promise<number> {
    return redis.incr(key);
  }

  async reset(key: string): Promise<void> {
    await redis.del(key);
  }
}

app.use(rateLimit({
  store: new RedisStore(),
}));
```

## Programmatic Access

Access rate limit info, reset functionality, and lifecycle methods:

```typescript
const limiter = rateLimit({ max: 100, window: '1m' });
app.use(limiter);

// Get rate limit info for a key
const info = await limiter.getInfo('user:123');
console.log(info.remaining, info.resetTime);

// Reset rate limit for a key
await limiter.reset('user:123');

// Clean shutdown (clears cleanup intervals and cache)
await limiter.shutdown();
```

### Graceful Shutdown

For production deployments, call `shutdown()` to clean up resources:

```typescript
const limiter = rateLimit({ max: 100, window: '1m' });
app.use(limiter);

process.on('SIGTERM', async () => {
  await limiter.shutdown();
  process.exit(0);
});
```

## Error Handling

Rate-limited requests receive:

- **Status**: 429 Too Many Requests
- **Body**: `{ error: 'Too Many Requests' }`
- **Headers**: Rate limit headers + `Retry-After`

Customize with the `handler` option:

```typescript
app.use(rateLimit({
  handler: (ctx, info) => {
    ctx.status = 429;
    ctx.json({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(info.resetTime / 1000),
      upgrade: 'https://example.com/pricing',
    });
  },
}));
```

## Best Practices

### API Rate Limiting

```typescript
// Per-API-key limiting
app.use(rateLimit({
  keyGenerator: (ctx) => ctx.get('X-API-Key') || ctx.ip,
  max: 1000,
  window: '1h',
  algorithm: 'sliding-window',
}));
```

### Login Endpoint Protection

```typescript
// Stricter limits for auth endpoints
app.post('/login', rateLimit({
  max: 5,
  window: '15m',
  keyGenerator: (ctx) => ctx.body?.email || ctx.ip,
}), loginHandler);
```

### GraphQL/Complexity-Based

```typescript
app.use(rateLimit({
  keyGenerator: (ctx) => ctx.ip,
  max: 1000,
  window: '1m',
  // Consume multiple tokens for expensive operations
  cost: (ctx) => ctx.state.queryComplexity || 1,
}));
```

## TypeScript

Full TypeScript support with exported types:

```typescript
import type {
  RateLimitOptions,
  RateLimitInfo,
  RateLimitStore,
  RateLimitEntry,
  TieredRateLimitOptions,
  AlgorithmName,
} from '@nextrush/rate-limit';
```

## License

MIT
