# Rate Limit Middleware

> Production-grade request rate limiting with multiple algorithms, tiered limits, and enterprise security features.

## The Problem

APIs without rate limiting are vulnerable to abuse:

**Denial of Service (DoS) attacks overwhelm your servers.** Without rate limiting, a single client can exhaust server resources with rapid requests, affecting all users.

**Brute force attacks exploit authentication.** Login endpoints without limits allow attackers to try thousands of password combinations per minute.

**Resource exhaustion from runaway clients.** Buggy clients, infinite loops, or misconfigured scripts can accidentally hammer your API.

**Cost overruns from unlimited usage.** Cloud services charge by request—unlimited API access can lead to unexpected bills.

**Unfair resource distribution.** Heavy users consume resources at the expense of lighter users, degrading experience for everyone.

## How NextRush Approaches This

NextRush's rate limiting provides **defense-in-depth** through:

1. **Multiple algorithms** for different use cases (Token Bucket, Sliding Window, Fixed Window)
2. **Tiered limits** for different user types (anonymous, authenticated, premium)
3. **IP spoofing protection** with proxy header validation
4. **IETF-compliant headers** for client-side handling
5. **Pluggable storage** for distributed systems (Redis-ready)
6. **Zero dependencies** with minimal overhead

## Mental Model

Think of rate limiting as a **bouncer at a club**:

```
Incoming Request
     │
     ▼
┌──────────────────────────────────────────────┐
│           Rate Limit Middleware              │
├──────────────────────────────────────────────┤
│                                              │
│  1. Identify client (IP, API key, user)      │
│  2. Check whitelist → Skip if trusted        │
│  3. Check blacklist → Apply stricter limits  │
│  4. Consult algorithm (tokens/count)         │
│  5. If allowed → Decrement quota, continue   │
│  6. If blocked → Return 429, set headers     │
│                                              │
└──────────────────────────────────────────────┘
     │
     ├─ Allowed → Continue to handler
     │
     └─ Blocked → 429 Too Many Requests
                 + RateLimit-Remaining: 0
                 + Retry-After: 30
```

## Installation

```bash
pnpm add @nextrush/rate-limit
```

## Basic Usage

```typescript
import { createApp } from '@nextrush/core';
import { serve } from '@nextrush/adapter-node';
import { rateLimit } from '@nextrush/rate-limit';

const app = createApp();

// Zero-config: 100 requests per minute per IP
app.use(rateLimit());

app.get('/api/data', (ctx) => {
  ctx.json({ data: 'value' });
});

await serve(app, { port: 3000 });
```

**Response Headers (allowed request):**

```
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 30
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

**Response (blocked request):**

```
HTTP/1.1 429 Too Many Requests
Retry-After: 30
RateLimit-Remaining: 0

{
  "error": "Too many requests, please try again later.",
  "retryAfter": 30
}
```

## API Reference

### `rateLimit(options?)`

Create rate limiting middleware:

```typescript
rateLimit({
  // Rate limiting algorithm
  algorithm?: 'token-bucket' | 'sliding-window' | 'fixed-window';  // default: 'token-bucket'

  // Maximum requests per window
  max?: number;                // default: 100

  // Time window duration
  window?: string | number;    // default: '1m' (60000ms)

  // Burst limit for token bucket
  burstLimit?: number;         // default: max

  // Custom key generator
  keyGenerator?: (ctx) => string | Promise<string>;  // default: IP-based

  // Trust proxy headers for IP extraction
  trustProxy?: boolean;        // default: false

  // Skip rate limiting for certain requests
  skip?: (ctx) => boolean | Promise<boolean>;

  // Custom store implementation
  store?: RateLimitStore;      // default: MemoryStore

  // Custom handler for rate-limited requests
  handler?: (ctx, info) => void | Promise<void>;

  // Callback when rate limit is hit
  onRateLimited?: (ctx, info) => void | Promise<void>;

  // Send standard RateLimit-* headers
  standardHeaders?: boolean;   // default: true

  // Send legacy X-RateLimit-* headers
  legacyHeaders?: boolean;     // default: true

  // Include Retry-After header on 429
  includeRetryAfter?: boolean; // default: true

  // Custom error message
  message?: string;            // default: 'Too many requests, please try again later.'

  // HTTP status code for blocked requests
  statusCode?: number;         // default: 429

  // IPs to skip rate limiting
  whitelist?: string[];

  // IPs to apply stricter limits
  blacklist?: string[];

  // Multiplier for blacklisted IPs (e.g., 0.5 = half the limit)
  blacklistMultiplier?: number; // default: 0.5

  // Enable draft IETF RateLimit-Policy header
  draftIetfHeaders?: boolean;  // default: false

  // Cleanup interval for expired entries
  cleanupInterval?: number;    // default: 60000

  // Disable automatic cleanup
  disableCleanup?: boolean;    // default: false
})
```

### `tieredRateLimit(options)`

Create tiered rate limiting for different user types:

```typescript
tieredRateLimit({
  // Tier configurations
  tiers: {
    anonymous: { max: 60, window: '1m' },
    authenticated: { max: 1000, window: '1m' },
    premium: { max: 10000, window: '1m' }
  },

  // Function to resolve tier from context
  tierResolver: (ctx) => string | Promise<string>,

  // Default tier for unknown values
  defaultTier?: string,  // default: first tier

  // All other rateLimit options...
})
```

## Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `algorithm` | `'token-bucket' \| 'sliding-window' \| 'fixed-window'` | `'token-bucket'` | Rate limiting algorithm |
| `max` | `number` | `100` | Maximum requests per window |
| `window` | `string \| number` | `'1m'` | Window duration |
| `burstLimit` | `number` | `max` | Burst limit for token bucket |
| `keyGenerator` | `(ctx) => string` | IP-based | Client identification |
| `trustProxy` | `boolean` | `false` | Trust proxy headers |
| `skip` | `(ctx) => boolean` | - | Skip condition |
| `store` | `RateLimitStore` | `MemoryStore` | Storage backend |
| `handler` | `(ctx, info) => void` | JSON 429 | Custom handler |
| `standardHeaders` | `boolean` | `true` | Send RateLimit-* headers |
| `legacyHeaders` | `boolean` | `true` | Send X-RateLimit-* headers |
| `message` | `string` | `'Too many requests...'` | Error message |
| `statusCode` | `number` | `429` | HTTP status code |
| `whitelist` | `string[]` | - | Bypass IPs |
| `blacklist` | `string[]` | - | Stricter limit IPs |
| `blacklistMultiplier` | `number` | `0.5` | Limit multiplier for blacklist |

## Window Duration Formats

The `window` option accepts multiple formats:

```typescript
// Short formats
rateLimit({ window: '1s' });   // 1 second
rateLimit({ window: '30s' });  // 30 seconds
rateLimit({ window: '1m' });   // 1 minute
rateLimit({ window: '5m' });   // 5 minutes
rateLimit({ window: '15m' });  // 15 minutes
rateLimit({ window: '1h' });   // 1 hour
rateLimit({ window: '1d' });   // 1 day

// Long formats
rateLimit({ window: '1sec' });
rateLimit({ window: '1minute' });
rateLimit({ window: '1hour' });
rateLimit({ window: '1day' });

// Milliseconds (number)
rateLimit({ window: 60000 }); // 1 minute
```

## Algorithms

### Token Bucket (Default)

Best for: **APIs where controlled bursts are acceptable**

```typescript
app.use(rateLimit({
  algorithm: 'token-bucket',
  max: 100,
  window: '1m',
  burstLimit: 20,  // Allow burst of 20
}));
```

**How it works:**
1. Bucket starts with `burstLimit` tokens (default: `max`)
2. Tokens refill at `max / window` rate
3. Each request consumes one token
4. No tokens = request blocked

**Advantages:**
- Allows short bursts of traffic
- Smooth rate limiting over time
- Industry standard (AWS, Google APIs)

**Use when:**
- API clients may have bursty traffic patterns
- You want to allow occasional spikes
- User experience matters more than strict limits

### Sliding Window Counter

Best for: **Strict, accurate rate limiting**

```typescript
app.use(rateLimit({
  algorithm: 'sliding-window',
  max: 100,
  window: '1m',
}));
```

**How it works:**
1. Tracks requests in current and previous windows
2. Uses weighted average based on time position
3. Formula: `effective = prevCount × (1 - elapsed%) + currentCount`

**Advantages:**
- Prevents boundary burst attacks
- More accurate than fixed window
- Memory efficient

**Use when:**
- Preventing abuse is critical
- You need precise rate limiting
- Fixed window boundary attacks are a concern

### Fixed Window

Best for: **Simple use cases with lowest overhead**

```typescript
app.use(rateLimit({
  algorithm: 'fixed-window',
  max: 100,
  window: '1m',
}));
```

**How it works:**
1. Divides time into fixed windows (e.g., every minute)
2. Counts requests in current window
3. Resets counter when window expires

**Advantages:**
- Simplest to understand
- Lowest memory and CPU overhead
- Predictable behavior

**Disadvantages:**
- Boundary burst problem: 2× limit at window edges
- Example: 100 at 0:59, 100 at 1:00 = 200 in 2 seconds

**Use when:**
- Overhead matters more than accuracy
- Internal APIs with trusted clients
- Simple rate limiting is sufficient

## Algorithm Comparison

| Algorithm | Burst Handling | Accuracy | Overhead | Best For |
|-----------|---------------|----------|----------|----------|
| Token Bucket | ✅ Allows bursts | ⚠️ Medium | ⚠️ Medium | Public APIs |
| Sliding Window | ❌ No bursts | ✅ High | ⚠️ Medium | Security-critical |
| Fixed Window | ⚠️ Boundary bursts | ⚠️ Low | ✅ Lowest | Internal APIs |

## Tiered Rate Limits

Apply different limits based on user type:

```typescript
import { tieredRateLimit } from '@nextrush/rate-limit';

app.use(tieredRateLimit({
  tiers: {
    anonymous: { max: 60, window: '1m' },
    authenticated: { max: 1000, window: '1m' },
    premium: { max: 10000, window: '1m' },
  },

  tierResolver: (ctx) => {
    // Check authentication state
    const user = ctx.state.user;
    if (!user) return 'anonymous';
    if (user.isPremium) return 'premium';
    return 'authenticated';
  },

  // Fallback for unknown tiers
  defaultTier: 'anonymous',
}));
```

### Per-Tier Burst Limits

```typescript
tieredRateLimit({
  tiers: {
    free: { max: 60, window: '1m', burstLimit: 10 },
    pro: { max: 1000, window: '1m', burstLimit: 100 },
    enterprise: { max: 10000, window: '1m', burstLimit: 1000 },
  },
  tierResolver: (ctx) => ctx.state.plan || 'free',
});
```

## IP Extraction & Proxy Support

When behind a proxy or load balancer, enable `trustProxy`:

```typescript
app.use(rateLimit({
  trustProxy: true,  // Trust proxy headers
  max: 100,
  window: '1m',
}));
```

**Header priority order:**
1. `CF-Connecting-IP` (Cloudflare)
2. `X-Real-IP` (Nginx)
3. `X-Forwarded-For` (first IP)
4. `X-Client-IP` (Apache)
5. `True-Client-IP` (Akamai)
6. `ctx.ip` (socket address)

::: warning Security Note
Only enable `trustProxy` if you're actually behind a trusted proxy. Untrusted clients can spoof these headers to bypass rate limits.
:::

## Whitelist & Blacklist

### Whitelist (Bypass)

Skip rate limiting for trusted IPs:

```typescript
app.use(rateLimit({
  whitelist: [
    '127.0.0.1',      // Localhost
    '::1',            // IPv6 localhost
    '10.0.0.0/8',     // Internal network (CIDR coming soon)
    '192.168.1.100',  // Monitoring server
  ],
}));
```

### Blacklist (Stricter Limits)

Apply reduced limits to known bad actors:

```typescript
app.use(rateLimit({
  max: 100,
  window: '1m',

  // Known abusers get 50% of normal limit
  blacklist: ['192.168.1.200', '10.0.0.50'],
  blacklistMultiplier: 0.5,  // 50 requests/min instead of 100
}));
```

## Custom Key Generator

Rate limit by API key instead of IP:

```typescript
app.use(rateLimit({
  keyGenerator: (ctx) => {
    // Use API key if present, fallback to IP
    const apiKey = ctx.get('X-API-Key');
    if (apiKey) return `api:${apiKey}`;
    return `ip:${ctx.ip}`;
  },
}));
```

### Rate Limit by User ID

```typescript
app.use(rateLimit({
  keyGenerator: (ctx) => {
    const userId = ctx.state.user?.id;
    if (userId) return `user:${userId}`;
    return `anon:${ctx.ip}`;
  },
}));
```

### Rate Limit by Endpoint

```typescript
app.use(rateLimit({
  keyGenerator: (ctx) => `${ctx.method}:${ctx.path}:${ctx.ip}`,
}));
```

## Skip Rate Limiting

Skip certain requests from rate limiting:

```typescript
app.use(rateLimit({
  skip: (ctx) => {
    // Skip health checks
    if (ctx.path === '/health') return true;

    // Skip internal service calls
    if (ctx.get('X-Internal-Service')) return true;

    // Skip authenticated admins
    if (ctx.state.user?.isAdmin) return true;

    return false;
  },
}));
```

## Custom Response Handler

Customize the rate limit exceeded response:

```typescript
app.use(rateLimit({
  handler: (ctx, info) => {
    ctx.status = 429;
    ctx.json({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      limit: info.limit,
      remaining: info.remaining,
      resetAt: new Date(info.resetTime * 1000).toISOString(),
      retryAfter: info.resetIn,
      upgrade: 'https://example.com/pricing',
    });
  },
}));
```

## Monitoring & Callbacks

Track rate limit events for monitoring:

```typescript
app.use(rateLimit({
  onRateLimited: (ctx, info) => {
    // Log to your monitoring system
    console.warn('Rate limit exceeded:', {
      ip: ctx.ip,
      path: ctx.path,
      key: info.key,
      limit: info.limit,
      current: info.current,
    });

    // Send metric to APM
    metrics.increment('rate_limit.exceeded', {
      path: ctx.path,
      tier: ctx.state.tier,
    });
  },
}));
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

### On Rate Limit Exceeded

```
Retry-After: 30
```

### Draft IETF Policy Header

```typescript
app.use(rateLimit({
  draftIetfHeaders: true,
}));
// RateLimit-Policy: 100;w=60
```

## Custom Storage

### In-Memory Store (Default)

```typescript
import { createMemoryStore } from '@nextrush/rate-limit';

app.use(rateLimit({
  store: createMemoryStore({
    cleanupInterval: 60000,  // Clean every minute
    disableCleanup: false,
  }),
}));
```

::: warning Single Instance Only
Memory store doesn't share state across server instances. For horizontal scaling, use Redis or another distributed store.
:::

### Redis Store (Custom Implementation)

```typescript
import type { RateLimitStore, StoreEntry } from '@nextrush/rate-limit';
import Redis from 'ioredis';

class RedisStore implements RateLimitStore {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async get(key: string): Promise<StoreEntry | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, entry: StoreEntry, ttlMs: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(entry), 'PX', ttlMs);
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.pexpire(key, ttlMs);
    }
    return count;
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async shutdown(): Promise<void> {
    await this.redis.quit();
  }
}

app.use(rateLimit({
  store: new RedisStore(process.env.REDIS_URL!),
}));
```

## Programmatic Access

The middleware exposes methods for runtime control:

```typescript
const limiter = rateLimit({ max: 100, window: '1m' });
app.use(limiter);

// Get rate limit info for a key
const info = await limiter.getInfo('rl:192.168.1.1');
console.log(info);
// { allowed: true, limit: 100, remaining: 95, resetIn: 30, ... }

// Reset rate limit for a key
await limiter.reset('rl:192.168.1.1');

// Graceful shutdown
await limiter.shutdown();
```

### Graceful Shutdown

Always shutdown the limiter in production:

```typescript
const limiter = rateLimit({ max: 100, window: '1m' });
app.use(limiter);

process.on('SIGTERM', async () => {
  console.log('Shutting down rate limiter...');
  await limiter.shutdown();
  process.exit(0);
});
```

## Common Patterns

### API Rate Limiting

```typescript
// Global API limit
app.use(rateLimit({
  max: 1000,
  window: '1h',
  keyGenerator: (ctx) => ctx.get('X-API-Key') || ctx.ip,
  algorithm: 'sliding-window',
}));
```

### Login Protection

```typescript
// Strict limits on auth endpoints
const loginLimiter = rateLimit({
  max: 5,
  window: '15m',
  keyGenerator: (ctx) => ctx.body?.email || ctx.ip,
  message: 'Too many login attempts. Try again in 15 minutes.',
});

app.post('/login', loginLimiter, loginHandler);
app.post('/register', loginLimiter, registerHandler);
```

### Password Reset Protection

```typescript
const passwordResetLimiter = rateLimit({
  max: 3,
  window: '1h',
  keyGenerator: (ctx) => ctx.body?.email || ctx.ip,
  message: 'Too many password reset requests.',
});

app.post('/forgot-password', passwordResetLimiter, forgotPasswordHandler);
```

### GraphQL Complexity-Based

```typescript
app.use(rateLimit({
  max: 10000,  // Points budget
  window: '1m',
  keyGenerator: (ctx) => ctx.ip,
  // Cost multiplier based on query complexity
  // (requires integration with your GraphQL server)
}));
```

### Microservices Internal API

```typescript
app.use(rateLimit({
  max: 10000,
  window: '1m',
  algorithm: 'fixed-window',  // Lowest overhead
  skip: (ctx) => ctx.get('X-Internal-Service') === 'true',
}));
```

## Common Mistakes

### Mistake 1: Not Enabling trustProxy Behind Load Balancer

```typescript
// ❌ All requests appear from load balancer IP
app.use(rateLimit({ max: 100, window: '1m' }));
// Every user shares the same rate limit!

// ✅ Trust proxy headers
app.use(rateLimit({
  max: 100,
  window: '1m',
  trustProxy: true,
}));
```

### Mistake 2: Using Memory Store in Clustered Deployment

```typescript
// ❌ Each worker has its own rate limit state
// User can make 100 × N requests (N = workers)
cluster.fork();
cluster.fork();
app.use(rateLimit({ max: 100 }));

// ✅ Use shared store for multi-process
app.use(rateLimit({
  max: 100,
  store: new RedisStore(process.env.REDIS_URL!),
}));
```

### Mistake 3: Wrong Middleware Order

```typescript
// ❌ Rate limiter after auth - authenticated users never rate limited
app.use(authMiddleware);
app.use(rateLimit());

// ✅ Rate limiter early in the chain
app.use(rateLimit());
app.use(authMiddleware);
```

### Mistake 4: Not Handling Graceful Shutdown

```typescript
// ❌ Cleanup intervals prevent process exit
app.use(rateLimit());

// ✅ Always shutdown
const limiter = rateLimit();
app.use(limiter);
process.on('SIGTERM', () => limiter.shutdown());
```

### Mistake 5: Over-Restrictive Limits

```typescript
// ❌ Too strict for web apps with multiple assets
app.use(rateLimit({ max: 10, window: '1m' }));
// Page load triggers 20+ requests!

// ✅ Consider realistic usage patterns
app.use(rateLimit({
  max: 100,
  window: '1m',
  skip: (ctx) => ctx.path.startsWith('/static/'),
}));
```

## Security Considerations

### IP Spoofing Protection

When `trustProxy` is enabled, validate that requests actually come from your proxy:

```typescript
app.use((ctx) => {
  // Ensure requests come from known proxy IPs
  if (!isKnownProxyIp(ctx.ip)) {
    ctx.status = 403;
    return;
  }
  return ctx.next();
});

app.use(rateLimit({ trustProxy: true }));
```

### Header Injection Prevention

All header values are sanitized to prevent injection attacks. The middleware removes:
- Newline characters (`\r`, `\n`)
- Null bytes
- Invalid characters

### Timing Attack Mitigation

Rate limit checks use constant-time operations where possible to prevent timing-based enumeration.

## TypeScript Types

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

// RateLimitInfo
interface RateLimitInfo {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  resetIn: number;
  key: string;
  current: number;
}

// RateLimitMiddleware
type RateLimitMiddleware = Middleware & {
  reset(key: string): Promise<void>;
  getInfo(key: string): Promise<RateLimitInfo | null>;
  shutdown(): Promise<void>;
};
```

## Constants

```typescript
import {
  STANDARD_HEADERS,
  LEGACY_HEADERS,
} from '@nextrush/rate-limit';

// STANDARD_HEADERS
{
  LIMIT: 'RateLimit-Limit',
  REMAINING: 'RateLimit-Remaining',
  RESET: 'RateLimit-Reset',
  POLICY: 'RateLimit-Policy',
}

// LEGACY_HEADERS
{
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
}
```

## Algorithm Exports

```typescript
import {
  tokenBucket,
  slidingWindow,
  fixedWindow,
  algorithms,
  getAlgorithm,
} from '@nextrush/rate-limit';

// Use directly
const info = await tokenBucket.consume(key, limit, windowMs, store);

// Get by name
const algo = getAlgorithm('sliding-window');
```

## Utility Exports

```typescript
import {
  parseWindow,
  formatDuration,
  extractClientIp,
  normalizeIp,
  isIpInList,
  setRateLimitHeaders,
  createMemoryStore,
  MemoryStore,
} from '@nextrush/rate-limit';

// Parse window string
parseWindow('5m');  // 300000

// Format duration
formatDuration(300000);  // '5m'

// Extract client IP
const ip = extractClientIp(ctx, true);

// Check IP in list
isIpInList('192.168.1.1', ['192.168.1.0/24']);  // true
```

## Runtime Support

Works on all JavaScript runtimes:

- **Node.js** ≥20
- **Bun** ≥1.0
- **Deno** ≥1.0
- **Cloudflare Workers**
- **Vercel Edge**

::: info Edge Runtime Note
For edge runtimes, use a distributed store (Redis, Upstash, etc.) since in-memory state is not shared across edge locations.
:::

## Performance

| Metric | Value |
|--------|-------|
| Overhead per request | ~0.1ms |
| Memory per key | ~100 bytes |
| Cleanup interval | Configurable (default 60s) |

## Comparison with Popular Libraries

| Feature | @nextrush/rate-limit | express-rate-limit | rate-limiter-flexible |
|---------|---------------------|-------------------|----------------------|
| Algorithms | 3 (TB, SW, FW) | 1 (Fixed) | 5+ |
| Tiered limits | ✅ Built-in | ❌ Manual | ✅ Yes |
| TypeScript | ✅ Native | ⚠️ @types | ✅ Native |
| Zero deps | ✅ Yes | ❌ No | ❌ No |
| Multi-runtime | ✅ Yes | ❌ Node only | ❌ Node only |
| IETF headers | ✅ Yes | ⚠️ Partial | ❌ No |
| Whitelist/Blacklist | ✅ Yes | ⚠️ Manual | ✅ Yes |
| Graceful shutdown | ✅ Yes | ❌ No | ✅ Yes |

---

**Package:** `@nextrush/rate-limit`
**Version:** 3.0.0-alpha.1
**License:** MIT
**Test Coverage:** 50+ tests passing ✅
