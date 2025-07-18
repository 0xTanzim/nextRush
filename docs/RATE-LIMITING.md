# 🛡️ Rate Limiting Guide

NextRush includes a powerful, built-in rate limiting system with memory and Redis backend support. This guide covers all rate limiting features and configuration options.

## Quick Start

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Basic rate limiting - 100 requests per 15 minutes
app.enableGlobalRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later.',
});

app.listen(3000);
```

## Configuration Options

### Basic Configuration

```typescript
app.useRateLimit({
  windowMs: 15 * 60 * 1000, // Time window in milliseconds
  max: 100, // Maximum requests per window
  message: 'Too many requests from this IP', // Custom error message
  statusCode: 429, // HTTP status code (default: 429)
  standardHeaders: true, // Include standard rate limit headers
  legacyHeaders: false, // Include X-RateLimit headers
});
```

### Advanced Configuration

```typescript
app.useRateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,

  // Custom key generator (IP-based by default)
  keyGenerator: (req) => {
    return req.headers['x-api-key'] || req.ip;
  },

  // Skip rate limiting for certain requests
  skip: (req) => {
    return req.path.startsWith('/health');
  },

  // Custom handler when limit exceeded
  handler: (req, res) => {
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: '60 seconds',
    });
  },

  // Callback when limit is reached
  onLimitReached: (req, options) => {
    console.log(`Rate limit reached for ${req.ip}`);
  },
});
```

## Usage Examples

### Route-Specific Rate Limiting

```typescript
// Different limits for different routes
app.get(
  '/api/search',
  app.useRateLimit({ max: 10, windowMs: 60000 }), // 10 per minute
  (req, res) => {
    res.json({ results: [] });
  }
);

app.post(
  '/api/login',
  app.useRateLimit({ max: 3, windowMs: 300000 }), // 3 per 5 minutes
  (req, res) => {
    // Login logic
  }
);
```

### API Key-Based Rate Limiting

```typescript
app.use(
  '/api',
  app.useRateLimit({
    max: 1000, // 1000 requests per hour
    windowMs: 60 * 60 * 1000,
    keyGenerator: (req) => {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) {
        throw new Error('API key required');
      }
      return `api_key:${apiKey}`;
    },
  })
);
```

### User-Based Rate Limiting

```typescript
app.use(
  '/api',
  app.requireAuth(), // Ensure user is authenticated
  app.useRateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000,
    keyGenerator: (req) => {
      return `user:${req.user.id}`;
    },
  })
);
```

## Custom Store Implementation

### Redis Store Example

```typescript
import Redis from 'ioredis';

class RedisStore implements RateLimiterStore {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async get(key: string): Promise<RateLimiterData | undefined> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : undefined;
  }

  async set(
    key: string,
    data: RateLimiterData,
    windowMs: number
  ): Promise<void> {
    await this.redis.setex(
      key,
      Math.ceil(windowMs / 1000),
      JSON.stringify(data)
    );
  }

  async increment(key: string, windowMs: number): Promise<RateLimiterData> {
    const now = Date.now();
    const existing = await this.get(key);

    if (!existing || now >= existing.resetTime) {
      const data: RateLimiterData = {
        count: 1,
        resetTime: now + windowMs,
        firstHit: now,
      };
      await this.set(key, data, windowMs);
      return data;
    }

    existing.count++;
    await this.set(key, existing, windowMs);
    return existing;
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async resetAll(): Promise<void> {
    await this.redis.flushall();
  }
}

// Use Redis store
app.useRateLimit({
  max: 100,
  windowMs: 60000,
  store: new RedisStore('redis://localhost:6379'),
});
```

## Rate Limit Headers

### Standard Headers (RFC 6585)

```
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 2023-07-19T10:00:00.000Z
```

### Legacy Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1689768000
```

## Error Handling

### Default Error Response

```json
{
  "error": "Too Many Requests",
  "message": "Too many requests, please try again later.",
  "retryAfter": 60
}
```

### Custom Error Handling

```typescript
app.useRateLimit({
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'You have exceeded the rate limit',
        details: {
          limit: 100,
          window: '15 minutes',
          retryAfter: '60 seconds',
        },
      },
    });
  },
});
```

## Performance Considerations

### Memory Store Cleanup

The memory store automatically cleans up expired entries, but for high-traffic applications, consider:

```typescript
// Use shorter cleanup intervals for high traffic
const memoryStore = new MemoryStore();

// Or use Redis for distributed rate limiting
const redisStore = new RedisStore('redis://localhost:6379');
```

### Key Generation Optimization

```typescript
// Efficient key generation
keyGenerator: (req) => {
  // Use forwarded IP for load balancers
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
  return `rate_limit:${ip}`;
};
```

## Best Practices

### 1. Different Limits for Different Endpoints

```typescript
// Strict limits for authentication
app.post('/auth/*', app.useRateLimit({ max: 3, windowMs: 300000 }));

// Moderate limits for API endpoints
app.use('/api', app.useRateLimit({ max: 100, windowMs: 60000 }));

// Generous limits for static content
app.get('/public/*', app.useRateLimit({ max: 1000, windowMs: 60000 }));
```

### 2. Graceful Degradation

```typescript
app.useRateLimit({
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path === '/health') return true;

    // Skip for internal requests
    if (req.headers['x-internal-request']) return true;

    return false;
  },
});
```

### 3. Monitoring and Alerting

```typescript
app.useRateLimit({
  onLimitReached: (req, options) => {
    // Log rate limit violations
    console.warn(`Rate limit exceeded: ${req.ip} - ${req.path}`);

    // Send to monitoring system
    metrics.increment('rate_limit.exceeded', {
      ip: req.ip,
      path: req.path,
    });
  },
});
```

## Integration with Other Features

### With Authentication

```typescript
// Different limits for authenticated vs anonymous users
app.use((req, res, next) => {
  const isAuthenticated = req.headers.authorization;
  const limit = isAuthenticated ? 1000 : 100;

  app.useRateLimit({
    max: limit,
    windowMs: 60 * 60 * 1000,
    keyGenerator: (req) => {
      return isAuthenticated ? `user:${req.user?.id}` : `ip:${req.ip}`;
    },
  })(req, res, next);
});
```

### With API Documentation

```typescript
app.doc('/api/data', 'GET', {
  summary: 'Get data with rate limiting',
  description: 'This endpoint is rate limited to 100 requests per hour',
  responses: {
    '200': { description: 'Success' },
    '429': {
      description: 'Rate limit exceeded',
      headers: {
        'RateLimit-Limit': { description: 'Request limit per window' },
        'RateLimit-Remaining': { description: 'Requests remaining' },
        'Retry-After': { description: 'Seconds to wait before retry' },
      },
    },
  },
});
```

## Troubleshooting

### Common Issues

1. **Rate limits not working**: Check key generator and ensure it returns consistent keys
2. **Memory leaks**: Use Redis store for production with high traffic
3. **False positives**: Consider IP forwarding in load balancer setups

### Debug Mode

```typescript
// Enable debug logging
app.useRateLimit({
  debug: true, // Log rate limit decisions
  onLimitReached: (req, options) => {
    console.log('Rate limit details:', {
      key: options.keyGenerator(req),
      current: 'current count', // Would need to fetch from store
      limit: options.max,
      window: options.windowMs,
    });
  },
});
```

This rate limiting system provides enterprise-grade protection while maintaining simplicity and flexibility for various use cases.
