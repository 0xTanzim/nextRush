# 🛡️ Rate Limiting

## 📚 Table of Contents

- [📖 Introduction](#-introduction)
- [🔧 Public APIs](#-public-apis)
  - [📋 Configuration Interfaces](#-configuration-interfaces)
  - [🛠️ Rate Limiter Methods](#️-rate-limiter-methods)
  - [💾 Store Interface](#-store-interface)
- [💻 Usage Examples](#-usage-examples)
- [⚙️ Configuration Options](#️-configuration-options)
- [📝 Notes](#-notes)

## 📖 Introduction

The NextRush Rate Limiter plugin provides robust request rate limiting capabilities to protect your application from abuse, DDoS attacks, and excessive API usage. It supports multiple storage backends, flexible key generation, custom response handling, and comprehensive monitoring with rate limit headers.

## 🔧 Public APIs

### 📋 Configuration Interfaces

| Interface            | Description                              |
| -------------------- | ---------------------------------------- |
| `RateLimiterOptions` | Main rate limiter configuration options. |
| `RateLimiterStore`   | Interface for custom storage backends.   |
| `RateLimiterData`    | Rate limiting data structure.            |
| `MemoryStore`        | Built-in memory storage implementation.  |

#### RateLimiterOptions Properties

| Property                 | Type                                                          | Default               | Description                               |
| ------------------------ | ------------------------------------------------------------- | --------------------- | ----------------------------------------- |
| `windowMs`               | `number`                                                      | `900000`              | Time window in milliseconds (15 minutes). |
| `max`                    | `number`                                                      | `100`                 | Maximum requests per window.              |
| `message`                | `string`                                                      | `'Too many requests'` | Error message when limit exceeded.        |
| `statusCode`             | `number`                                                      | `429`                 | HTTP status code for rate limit exceeded. |
| `standardHeaders`        | `boolean`                                                     | `true`                | Include standard rate limit headers.      |
| `legacyHeaders`          | `boolean`                                                     | `false`               | Include legacy X-RateLimit headers.       |
| `skipSuccessfulRequests` | `boolean`                                                     | `false`               | Don't count successful requests.          |
| `skipFailedRequests`     | `boolean`                                                     | `false`               | Don't count failed requests.              |
| `keyGenerator`           | `(req: NextRushRequest) => string`                            | IP-based              | Custom key generator function.            |
| `skip`                   | `(req: NextRushRequest) => boolean`                           | `undefined`           | Skip rate limiting for certain requests.  |
| `handler`                | `(req: NextRushRequest, res: NextRushResponse) => void`       | Default JSON response | Custom handler when limit exceeded.       |
| `store`                  | `RateLimiterStore`                                            | `MemoryStore`         | Custom storage backend.                   |
| `onLimitReached`         | `(req: NextRushRequest, options: RateLimiterOptions) => void` | `undefined`           | Callback when limit is reached.           |

#### RateLimiterStore Interface

| Method                     | Signature                                                                 | Description                    |
| -------------------------- | ------------------------------------------------------------------------- | ------------------------------ |
| `get(key)`                 | `(key: string) => Promise<RateLimiterData \| undefined>`                  | Get rate limit data for key.   |
| `set(key, data, windowMs)` | `(key: string, data: RateLimiterData, windowMs: number) => Promise<void>` | Set rate limit data for key.   |
| `increment(key, windowMs)` | `(key: string, windowMs: number) => Promise<RateLimiterData>`             | Increment counter for key.     |
| `reset(key)`               | `(key: string) => Promise<void>`                                          | Reset rate limit data for key. |
| `resetAll()`               | `() => Promise<void>`                                                     | Reset all rate limit data.     |

#### RateLimiterData Properties

| Property    | Type      | Description                                   |
| ----------- | --------- | --------------------------------------------- |
| `count`     | `number`  | Current request count in the window.          |
| `resetTime` | `number`  | Timestamp when the window resets.             |
| `firstHit`  | `number?` | Timestamp of the first request in the window. |

### 🛠️ Rate Limiter Methods

| Method                      | Signature                                              | Description                      |
| --------------------------- | ------------------------------------------------------ | -------------------------------- |
| `useRateLimit(options?)`    | `(options?: RateLimiterOptions) => MiddlewareFunction` | Create rate limiting middleware. |
| `enableRateLimit(options?)` | `(options?: RateLimiterOptions) => Application`        | Enable rate limiting globally.   |

### 💾 Store Interface

The `MemoryStore` class is included for basic use cases, but you can implement custom stores for Redis, databases, or other storage systems.

## 💻 Usage Examples

### Basic Rate Limiting

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Enable basic rate limiting globally
app.enableRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

app.get('/api/data', (req, res) => {
  res.json({ message: 'Data retrieved successfully' });
});

app.listen(3000);
```

### Route-Specific Rate Limiting

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Different rate limits for different endpoints
app.use(
  '/api/auth/login',
  app.useRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per IP
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(
  '/api/search',
  app.useRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 searches per minute
    message: 'Search rate limit exceeded',
  })
);

app.use(
  '/api/upload',
  app.useRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 uploads per hour
    message: 'Upload limit exceeded',
  })
);

app.post('/api/auth/login', (req, res) => {
  // Login logic
  res.json({ message: 'Login successful' });
});

app.get('/api/search', (req, res) => {
  // Search logic
  res.json({ results: [] });
});

app.post('/api/upload', (req, res) => {
  // Upload logic
  res.json({ message: 'File uploaded' });
});

app.listen(3000);
```

### Custom Key Generation

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Rate limit by user ID instead of IP
app.use(
  '/api/user',
  app.useRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    keyGenerator: (req) => {
      // Use user ID from JWT token or session
      return req.user?.id || req.ip() || 'anonymous';
    },
    skip: (req) => {
      // Skip rate limiting for premium users
      return req.user?.isPremium === true;
    },
  })
);

// Rate limit by API key
app.use(
  '/api/external',
  app.useRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10000,
    keyGenerator: (req) => {
      const apiKey = req.headers['x-api-key'] as string;
      return apiKey || req.ip();
    },
    message: 'API rate limit exceeded for this key',
  })
);

app.get('/api/user/profile', (req, res) => {
  res.json({ profile: req.user });
});

app.get('/api/external/data', (req, res) => {
  res.json({ data: 'External API data' });
});

app.listen(3000);
```

### Advanced Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Advanced rate limiting with custom handling
app.use(
  '/api',
  app.useRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    standardHeaders: true,
    legacyHeaders: true,
    skipSuccessfulRequests: false,
    skipFailedRequests: true, // Don't count failed requests

    // Custom key generation with multiple factors
    keyGenerator: (req) => {
      const ip = req.ip();
      const userAgent = req.headers['user-agent'] || '';
      const userId = req.user?.id || 'anonymous';

      // Create composite key for more granular control
      return `${ip}:${userId}:${Buffer.from(userAgent)
        .toString('base64')
        .slice(0, 10)}`;
    },

    // Skip rate limiting for certain conditions
    skip: (req) => {
      // Skip for internal requests
      if (req.headers['x-internal-request'] === 'true') return true;

      // Skip for admin users
      if (req.user?.role === 'admin') return true;

      // Skip for health checks
      if (req.path === '/health' || req.path === '/metrics') return true;

      return false;
    },

    // Custom handler when limit is exceeded
    handler: (req, res) => {
      const retryAfter = res.getHeader('Retry-After');

      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests from this client',
        retryAfter: retryAfter,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
      });
    },

    // Callback when limit is reached (for logging/monitoring)
    onLimitReached: (req, options) => {
      console.warn(
        `Rate limit exceeded for key: ${options.keyGenerator!(req)}`
      );

      // Send to monitoring service
      monitoring.track('rate_limit_exceeded', {
        ip: req.ip(),
        path: req.path,
        userAgent: req.headers['user-agent'],
        timestamp: Date.now(),
      });
    },
  })
);

app.listen(3000);
```

### Custom Redis Store

```typescript
import { createApp, RateLimiterStore, RateLimiterData } from 'nextrush';
import Redis from 'redis';

// Custom Redis store implementation
class RedisStore implements RateLimiterStore {
  private client: Redis.RedisClientType;

  constructor(redisClient: Redis.RedisClientType) {
    this.client = redisClient;
  }

  async get(key: string): Promise<RateLimiterData | undefined> {
    const data = await this.client.get(`rate_limit:${key}`);
    return data ? JSON.parse(data) : undefined;
  }

  async set(
    key: string,
    data: RateLimiterData,
    windowMs: number
  ): Promise<void> {
    const ttl = Math.ceil(windowMs / 1000);
    await this.client.setEx(`rate_limit:${key}`, ttl, JSON.stringify(data));
  }

  async increment(key: string, windowMs: number): Promise<RateLimiterData> {
    const redisKey = `rate_limit:${key}`;
    const now = Date.now();

    // Use Redis multi for atomic operations
    const multi = this.client.multi();

    const existing = await this.get(key);

    if (!existing || now >= existing.resetTime) {
      // Create new window
      const data: RateLimiterData = {
        count: 1,
        resetTime: now + windowMs,
        firstHit: now,
      };

      const ttl = Math.ceil(windowMs / 1000);
      await this.client.setEx(redisKey, ttl, JSON.stringify(data));
      return data;
    }

    // Increment existing window
    existing.count++;
    const ttl = Math.ceil((existing.resetTime - now) / 1000);
    await this.client.setEx(redisKey, ttl, JSON.stringify(existing));
    return existing;
  }

  async reset(key: string): Promise<void> {
    await this.client.del(`rate_limit:${key}`);
  }

  async resetAll(): Promise<void> {
    const keys = await this.client.keys('rate_limit:*');
    if (keys.length > 0) {
      await this.client.del(keys);
    }
  }
}

const app = createApp();

// Setup Redis client
const redis = Redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

await redis.connect();

// Use Redis store for rate limiting
app.enableRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  store: new RedisStore(redis),
});

app.listen(3000);
```

### Dynamic Rate Limits

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Dynamic rate limits based on user tier
app.use(
  '/api',
  app.useRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: (req) => {
      // Dynamic max based on user subscription
      if (!req.user) return 100; // Anonymous users

      switch (req.user.tier) {
        case 'free':
          return 1000;
        case 'premium':
          return 10000;
        case 'enterprise':
          return 100000;
        default:
          return 100;
      }
    },
    keyGenerator: (req) => {
      return req.user?.id || req.ip();
    },
    message: (req) => {
      const tier = req.user?.tier || 'anonymous';
      return `Rate limit exceeded for ${tier} tier. Please upgrade for higher limits.`;
    },
  })
);

app.listen(3000);
```

### Multiple Rate Limit Layers

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Global rate limit (very generous)
app.use(
  app.useRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // High global limit
    keyGenerator: (req) => req.ip(),
    message: 'Global rate limit exceeded',
  })
);

// API-specific rate limit
app.use(
  '/api',
  app.useRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 1000, // Moderate API limit
    keyGenerator: (req) => `api:${req.ip()}`,
    message: 'API rate limit exceeded',
  })
);

// Strict rate limit for sensitive endpoints
app.use(
  '/api/auth',
  app.useRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Very strict for auth
    keyGenerator: (req) => `auth:${req.ip()}`,
    message: 'Authentication rate limit exceeded',
  })
);

// Per-user rate limit
app.use(
  '/api/user',
  app.useRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    keyGenerator: (req) => `user:${req.user?.id || req.ip()}`,
    skip: (req) => !req.user, // Skip for non-authenticated requests
    message: 'User rate limit exceeded',
  })
);

app.listen(3000);
```

## ⚙️ Configuration Options

### Production Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Production rate limiting configuration
app.enableRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: true,

  keyGenerator: (req) => {
    // Use forwarded IP in production (behind proxy)
    return (
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.ip()
    );
  },

  skip: (req) => {
    // Skip monitoring endpoints
    return (
      req.path === '/health' ||
      req.path === '/metrics' ||
      req.headers['x-health-check'] === 'true'
    );
  },

  handler: (req, res) => {
    // Log rate limit violations
    console.warn(`Rate limit exceeded: ${req.ip()} ${req.method} ${req.path}`);

    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});

app.listen(3000);
```

### Development Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Development rate limiting - more permissive
app.enableRateLimit({
  windowMs: 60 * 1000, // 1 minute (shorter for testing)
  max: 1000, // Higher limit for development
  standardHeaders: true,
  legacyHeaders: true, // Include legacy headers for debugging

  skip: (req) => {
    // Skip rate limiting in development for testing
    return (
      process.env.NODE_ENV === 'development' &&
      req.headers['x-skip-rate-limit'] === 'true'
    );
  },

  handler: (req, res) => {
    // Detailed response in development
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests',
      window: '1 minute',
      limit: 1000,
      current: req.rateLimit?.current,
      remaining: req.rateLimit?.remaining,
      resetTime: req.rateLimit?.resetTime,
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});

app.listen(3000);
```

### Environment-Based Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Different configurations per environment
const rateLimitConfigs = {
  development: {
    windowMs: 60 * 1000, // 1 minute
    max: 10000, // Very high for development
    standardHeaders: true,
    legacyHeaders: true,
  },

  staging: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5000, // Moderate for staging
    standardHeaders: true,
    legacyHeaders: false,
  },

  production: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Conservative for production
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: true,
  },
};

const env = process.env.NODE_ENV || 'development';
app.enableRateLimit(rateLimitConfigs[env]);

app.listen(3000);
```

## 📝 Notes

- **Memory Usage**: The default MemoryStore is suitable for single-instance applications. Use Redis or database stores for distributed systems.

- **Key Generation**: Choose appropriate key generation strategies. IP-based keys work for public APIs, while user-based keys are better for authenticated endpoints.

- **Headers**: Rate limit headers help clients understand current limits and when they can retry. Use standard headers for better client compatibility.

- **Error Handling**: Rate limit exceeded responses should include helpful information like retry-after headers and clear error messages.

- **Performance**: Rate limiting adds minimal overhead but can become a bottleneck with high request volumes. Choose efficient storage backends for production.

- **Security**: Rate limiting is crucial for preventing abuse, but don't rely on it alone. Combine with authentication, input validation, and other security measures.

- **Monitoring**: Track rate limit violations to identify potential attacks or legitimate usage patterns that need adjustment.

- **Proxy Considerations**: When behind reverse proxies or load balancers, ensure proper IP forwarding headers are configured for accurate client identification.

- **Testing**: Test rate limiting thoroughly in development, including edge cases like rapid requests and window boundaries.

- **Graceful Degradation**: Consider implementing graceful degradation strategies when rate limits are reached instead of hard failures.

- **Custom Stores**: Implement custom stores for specialized requirements like database persistence, distributed caching, or analytics integration.

- **Reset Strategies**: Different reset strategies (sliding window, fixed window, token bucket) have different characteristics. Choose based on your specific needs.
