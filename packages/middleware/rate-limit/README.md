# @nextrush/rate-limit

> Production-grade rate limiting middleware with multiple algorithms, tiered limits, and enterprise security features.

## The Problem

Rate limiting is critical for API security and stability, but most implementations fall short:

**Naive implementations are easily bypassed.** Simple IP-based rate limiting fails when attackers use distributed botnets or rotate IPs. Authentication-aware limiting is essential.

**One-size-fits-all limits hurt users.** Fixed limits that work for anonymous users frustrate paying customers. Tiered limits are complex to implement correctly.

**Rate limit bypass vulnerabilities.** Header spoofing, IPv6 rotation, and timing attacks can circumvent poorly implemented rate limiters.

## What NextRush Does Differently

- **Multiple algorithms** - Token Bucket, Sliding Window Counter, Fixed Window
- **Tiered rate limits** - Different limits for anonymous, authenticated, and premium users
- **CIDR support** - Whitelist/blacklist IP ranges with CIDR notation
- **IETF-compliant headers** - Standard `RateLimit-*` headers + legacy `X-RateLimit-*`
- **DoS protection** - Memory store with max entries limit, automatic cleanup
- **Input validation** - Comprehensive validation with descriptive error messages
- **Zero dependencies** - No external runtime dependencies

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

```typescript
import { rateLimit } from '@nextrush/rate-limit';

app.use(
  rateLimit({
    // Maximum requests per window
    max: 100,

    // Time window: '1m', '15m', '1h', '1d' or milliseconds
    window: '1m',

    // Algorithm: 'token-bucket' | 'sliding-window' | 'fixed-window'
    algorithm: 'token-bucket',

    // Burst limit for token bucket (allows short bursts)
    burstLimit: 20,

    // Custom key generator (default: client IP)
    keyGenerator: (ctx) => ctx.get('X-API-Key') || ctx.ip,

    // Trust proxy headers for IP extraction
    trustProxy: true,

    // Skip rate limiting for certain requests
    skip: (ctx) => ctx.path === '/health',

    // IP whitelist (bypass rate limiting) - supports CIDR
    whitelist: ['127.0.0.1', '10.0.0.0/8', '192.168.0.0/16'],

    // IP blacklist (stricter limits) - supports CIDR
    blacklist: ['192.168.1.100'],
    blacklistMultiplier: 0.5, // 50% of normal limit

    // Custom response for rate-limited requests
    handler: (ctx, info) => {
      ctx.status = 429;
      ctx.json({
        error: 'Rate limit exceeded',
        retryAfter: info.resetIn,
      });
    },

    // Callback when rate limit is hit
    onRateLimited: (ctx, info) => {
      console.log(`Rate limit exceeded for ${ctx.ip}`);
    },

    // Response header options
    standardHeaders: true, // RateLimit-* headers
    legacyHeaders: true, // X-RateLimit-* headers
    includeRetryAfter: true, // Retry-After header on 429
    draftIetfHeaders: false, // RateLimit-Policy header
  })
);
```

## Algorithms

### Token Bucket (Default)

Best for APIs that need controlled burst handling:

```typescript
app.use(
  rateLimit({
    algorithm: 'token-bucket',
    max: 100, // Sustained rate
    window: '1m',
    burstLimit: 20, // Allow bursts up to 20
  })
);
```

**Behavior**: Allows bursts up to `burstLimit`, then throttles to `max/window` rate.

### Sliding Window Counter

Most accurate algorithm, prevents boundary attacks:

```typescript
app.use(
  rateLimit({
    algorithm: 'sliding-window',
    max: 100,
    window: '1m',
  })
);
```

**Behavior**: Smooth rate limiting with weighted average of current and previous windows.

### Fixed Window

Simplest algorithm with lowest overhead:

```typescript
app.use(
  rateLimit({
    algorithm: 'fixed-window',
    max: 100,
    window: '1m',
  })
);
```

**Behavior**: Resets counter at fixed intervals. May allow 2× limit at window boundaries.

## Algorithm Comparison

| Algorithm      | Burst Handling     | Accuracy  | Overhead  | Best For          |
| -------------- | ------------------ | --------- | --------- | ----------------- |
| Token Bucket   | ✅ Allows bursts   | ⚠️ Medium | ⚠️ Medium | Public APIs       |
| Sliding Window | ❌ No bursts       | ✅ High   | ⚠️ Medium | Security-critical |
| Fixed Window   | ⚠️ Boundary bursts | ⚠️ Low    | ✅ Lowest | Internal APIs     |

## Tiered Rate Limits

Apply different limits based on user type:

```typescript
import { tieredRateLimit } from '@nextrush/rate-limit';

app.use(
  tieredRateLimit({
    tiers: {
      anonymous: { max: 60, window: '1m' },
      authenticated: { max: 1000, window: '1m' },
      premium: { max: 10000, window: '1m' },
    },
    tierResolver: (ctx) => {
      const user = ctx.state.user;
      if (!user) return 'anonymous';
      if (user.isPremium) return 'premium';
      return 'authenticated';
    },
    defaultTier: 'anonymous',
  })
);
```

## IP Extraction & Proxy Support

When behind a proxy or load balancer:

```typescript
app.use(
  rateLimit({
    trustProxy: true, // Trust proxy headers
  })
);
```

**Header priority order:**

1. `CF-Connecting-IP` (Cloudflare)
2. `X-Real-IP` (nginx)
3. `X-Forwarded-For` (first IP)
4. `X-Client-IP` (Apache)
5. `True-Client-IP` (Akamai)
6. `ctx.ip` (socket address)

## CIDR Whitelist & Blacklist

Use CIDR notation for IP ranges:

```typescript
app.use(
  rateLimit({
    // Bypass rate limiting for internal networks
    whitelist: [
      '127.0.0.1', // Localhost
      '::1', // IPv6 localhost
      '10.0.0.0/8', // Private Class A
      '172.16.0.0/12', // Private Class B
      '192.168.0.0/16', // Private Class C
    ],

    // Stricter limits for known problem ranges
    blacklist: ['203.0.113.0/24'],
    blacklistMultiplier: 0.25, // 25% of normal limit
  })
);
```

## Response Headers

### Standard Headers (IETF Draft)

```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 30
```

### Legacy Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Rate-Limited Response

```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
```

## Custom Storage

Implement the `RateLimitStore` interface for Redis or other backends:

```typescript
import type { RateLimitStore, StoreEntry } from '@nextrush/rate-limit';

class RedisStore implements RateLimitStore {
  async get(key: string): Promise<StoreEntry | null> {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, entry: StoreEntry, ttlMs: number): Promise<void> {
    await redis.set(key, JSON.stringify(entry), 'PX', ttlMs);
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const count = await redis.incr(key);
    if (count === 1) await redis.pexpire(key, ttlMs);
    return count;
  }

  async reset(key: string): Promise<void> {
    await redis.del(key);
  }

  async shutdown(): Promise<void> {
    await redis.quit();
  }
}

app.use(
  rateLimit({
    store: new RedisStore(),
  })
);
```

## Programmatic Access

Access rate limit info, reset functionality, and lifecycle methods:

```typescript
const limiter = rateLimit({ max: 100, window: '1m' });
app.use(limiter);

// Get rate limit info for a key
const info = await limiter.getInfo('rl:192.168.1.1');
console.log(info?.remaining, info?.resetIn);

// Reset rate limit for a key
await limiter.reset('rl:192.168.1.1');

// Graceful shutdown (important for production!)
process.on('SIGTERM', async () => {
  await limiter.shutdown();
  process.exit(0);
});
```

## Common Use Cases

### API Rate Limiting

```typescript
app.use(
  rateLimit({
    max: 1000,
    window: '1h',
    keyGenerator: (ctx) => ctx.get('X-API-Key') || ctx.ip,
    algorithm: 'sliding-window',
  })
);
```

### Login Protection

```typescript
const loginLimiter = rateLimit({
  max: 5,
  window: '15m',
  keyGenerator: (ctx) => ctx.body?.email || ctx.ip,
  message: 'Too many login attempts. Try again in 15 minutes.',
});

app.post('/login', loginLimiter, loginHandler);
```

### Password Reset Protection

```typescript
const resetLimiter = rateLimit({
  max: 3,
  window: '1h',
  keyGenerator: (ctx) => ctx.body?.email || ctx.ip,
});

app.post('/forgot-password', resetLimiter, handler);
```

## Validation

Options are validated at middleware creation time:

```typescript
import { rateLimit, RateLimitValidationError } from '@nextrush/rate-limit';

try {
  app.use(rateLimit({ max: -1 }));
} catch (error) {
  if (error instanceof RateLimitValidationError) {
    console.error(error.message); // "max must be greater than 0"
  }
}
```

## Low-Level API

For advanced use cases, access the algorithms and utilities directly:

```typescript
import {
  // Algorithms
  tokenBucket,
  slidingWindow,
  fixedWindow,
  getAlgorithm,
  algorithms,

  // Storage
  createMemoryStore,
  MemoryStore,

  // IP utilities
  extractClientIp,
  normalizeIp,
  isIpInList,
  isValidIpv4,
  isValidIpv6,

  // Window parsing
  parseWindow,
  formatDuration,

  // Headers
  setRateLimitHeaders,
  STANDARD_HEADERS,
  LEGACY_HEADERS,

  // Validation
  validateOptions,
  validateTieredOptions,
  RateLimitValidationError,
} from '@nextrush/rate-limit';
```

### Direct Algorithm Usage

```typescript
import { tokenBucket, createMemoryStore } from '@nextrush/rate-limit';

const store = createMemoryStore();
const info = await tokenBucket.consume('user:123', 100, 60000, store);

console.log(info.allowed); // true/false
console.log(info.remaining); // tokens/requests left
console.log(info.resetIn); // seconds until reset
```

## Types

```typescript
import type {
  RateLimitOptions,
  TieredRateLimitOptions,
  RateLimitInfo,
  RateLimitStore,
  StoreEntry,
  RateLimitMiddleware,
  RateLimitAlgorithm,
  TierConfig,
  TierResolver,
  KeyGenerator,
  SkipFunction,
  RateLimitHandler,
  OnRateLimited,
  Algorithm,
} from '@nextrush/rate-limit';
```

## Constants

```typescript
import {
  DEFAULT_ALGORITHM, // 'token-bucket'
  DEFAULT_MAX, // 100
  DEFAULT_WINDOW, // '1m'
  DEFAULT_WINDOW_MS, // 60000
  DEFAULT_STATUS_CODE, // 429
  DEFAULT_MESSAGE, // 'Too many requests...'
  DEFAULT_BLACKLIST_MULTIPLIER, // 0.5
  DEFAULT_CLEANUP_INTERVAL, // 60000
  DEFAULT_MAX_ENTRIES, // 100000
  DEFAULT_KEY_PREFIX, // 'rl:'
  PROXY_HEADERS, // Array of trusted headers
  STANDARD_HEADERS, // { LIMIT, REMAINING, RESET, POLICY }
  LEGACY_HEADERS, // { LIMIT, REMAINING, RESET }
  TIME_UNITS, // { s: 1000, m: 60000, ... }
} from '@nextrush/rate-limit';
```

## Security Considerations

### IP Spoofing Protection

- Only enable `trustProxy` when behind a trusted proxy
- Validate that requests come from known proxy IPs
- Use CIDR notation for internal network whitelisting

### DoS Protection

- Memory store has a `maxEntries` limit (default: 100,000)
- Automatic FIFO eviction (insertion-order) when limit is reached
- Automatic cleanup of expired entries

### Header Values

- Rate limit headers use numeric values only (limit, remaining, reset)
- Header sanitization is handled by the Context implementation

## Runtime Compatibility

| Runtime            | Supported                  |
| ------------------ | -------------------------- |
| Node.js 22+        | ✅                         |
| Bun 1.0+           | ✅                         |
| Deno 1.0+          | ✅                         |
| Cloudflare Workers | ✅ (use distributed store) |
| Vercel Edge        | ✅ (use distributed store) |

**Note:** For edge runtimes, use a distributed store (Redis, Upstash, etc.) since in-memory state is not shared across edge locations.

## Performance

| Metric                | Value      |
| --------------------- | ---------- |
| Overhead per request  | ~0.1ms     |
| Memory per key        | ~100 bytes |
| Max entries (default) | 100,000    |
| Cleanup interval      | 60 seconds |

## Error Handling

Rate-limited requests receive:

- **Status**: 429 Too Many Requests
- **Body**: `{ error: 'Too many requests...', retryAfter: 30 }`
- **Headers**: Rate limit headers + `Retry-After`

Customize with the `handler` option or use validation errors for misconfiguration.

## License

MIT
