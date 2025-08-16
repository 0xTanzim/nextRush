# 🔧 Middleware Development Guide

A comprehensive guide to creating custom middleware for NextRush v2, covering patterns, best practices, and real-world examples.

---

## 📖 **Table of Contents**

1. [Middleware Fundamentals](#-middleware-fundamentals)
2. [Creating Basic Middleware](#-creating-basic-middleware)
3. [Advanced Middleware Patterns](#-advanced-middleware-patterns)
4. [Error Handling in Middleware](#-error-handling-in-middleware)
5. [Performance Optimization](#-performance-optimization)
6. [Testing Middleware](#-testing-middleware)
7. [Common Patterns](#-common-patterns)
8. [Real-World Examples](#-real-world-examples)

---

## 🎯 **Middleware Fundamentals**

### **What is Middleware?**

Middleware are functions that execute during the request-response lifecycle. They have access to:

- **Request object** (`ctx.req`)
- **Response object** (`ctx.res`)
- **Context object** (`ctx`)
- **Next function** (`next`)

### **Middleware Signature**

```typescript
import type { Context, Middleware } from 'nextrush';

const myMiddleware: Middleware = async (ctx: Context, next) => {
  // Before request processing
  console.log(`${ctx.method} ${ctx.path}`);

  // Call next middleware
  await next();

  // After request processing
  console.log(`Response: ${ctx.res.statusCode}`);
};
```

### **Execution Flow**

```typescript
// Middleware stack execution
app.use(middleware1); // Executes first
app.use(middleware2); // Executes second
app.use(middleware3); // Executes third

// Flow:
// middleware1 → before
// middleware2 → before
// middleware3 → before
// Route handler
// middleware3 → after
// middleware2 → after
// middleware1 → after
```

---

## 🏗️ **Creating Basic Middleware**

### **Simple Logging Middleware**

```typescript
import type { Middleware } from 'nextrush';

const simpleLogger: Middleware = async (ctx, next) => {
  const start = Date.now();

  console.log(`→ ${ctx.method} ${ctx.path}`);

  await next();

  const duration = Date.now() - start;
  console.log(`← ${ctx.method} ${ctx.path} - ${duration}ms`);
};

// Usage
app.use(simpleLogger);
```

### **Authentication Middleware**

```typescript
import type { Middleware } from 'nextrush';

const requireAuth: Middleware = async (ctx, next) => {
  const token = ctx.req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    ctx.res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const user = await verifyToken(token);
    ctx.state.user = user;
    await next();
  } catch (error) {
    ctx.res.status(401).json({ error: 'Invalid token' });
  }
};

// Usage
app.use('/api/protected', requireAuth);
```

### **Configurable Middleware Factory**

```typescript
interface CacheOptions {
  ttl: number;
  key?: (ctx: Context) => string;
}

const cache = (options: CacheOptions): Middleware => {
  const { ttl, key = ctx => ctx.path } = options;
  const cache = new Map<string, { data: any; expires: number }>();

  return async (ctx, next) => {
    const cacheKey = key(ctx);
    const cached = cache.get(cacheKey);

    if (cached && cached.expires > Date.now()) {
      ctx.body = cached.data;
      return;
    }

    await next();

    if (ctx.res.statusCode === 200) {
      cache.set(cacheKey, {
        data: ctx.body,
        expires: Date.now() + ttl,
      });
    }
  };
};

// Usage
app.use('/api/data', cache({ ttl: 300000 })); // 5 minutes
```

---

## 🚀 **Advanced Middleware Patterns**

### **Conditional Middleware**

```typescript
const conditionalMiddleware = (
  condition: (ctx: Context) => boolean,
  middleware: Middleware
): Middleware => {
  return async (ctx, next) => {
    if (condition(ctx)) {
      await middleware(ctx, next);
    } else {
      await next();
    }
  };
};

// Usage
app.use(
  conditionalMiddleware(
    ctx => ctx.path.startsWith('/api'),
    rateLimiter({ requests: 100, window: 60000 })
  )
);
```

### **Compose Multiple Middleware**

```typescript
const compose = (...middlewares: Middleware[]): Middleware => {
  return async (ctx, next) => {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }

      index = i;

      let fn = middlewares[i];
      if (i === middlewares.length) fn = next;
      if (!fn) return;

      return fn(ctx, () => dispatch(i + 1));
    };

    return dispatch(0);
  };
};

// Usage
const authStack = compose(validateApiKey, parseUserToken, checkPermissions);

app.use('/admin', authStack);
```

### **Async Resource Management**

```typescript
const withDatabase: Middleware = async (ctx, next) => {
  const db = await connectToDatabase();
  ctx.state.db = db;

  try {
    await next();
  } finally {
    await db.close();
  }
};

const withTransaction: Middleware = async (ctx, next) => {
  const { db } = ctx.state;
  const transaction = await db.beginTransaction();
  ctx.state.transaction = transaction;

  try {
    await next();
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
```

---

## 🚨 **Error Handling in Middleware**

### **Error Boundary Middleware**

```typescript
const errorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error('Request error:', error);

    if (error instanceof ValidationError) {
      ctx.res.status(400).json({
        error: 'Validation failed',
        details: error.details,
      });
    } else if (error instanceof AuthenticationError) {
      ctx.res.status(401).json({
        error: 'Authentication required',
      });
    } else {
      ctx.res.status(500).json({
        error: 'Internal server error',
      });
    }
  }
};

// Use as first middleware
app.use(errorHandler);
```

### **Timeout Middleware**

```typescript
const timeout = (ms: number): Middleware => {
  return async (ctx, next) => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), ms);
    });

    try {
      await Promise.race([next(), timeoutPromise]);
    } catch (error) {
      if (error.message === 'Request timeout') {
        ctx.res.status(408).json({ error: 'Request timeout' });
      } else {
        throw error;
      }
    }
  };
};

// Usage
app.use(timeout(30000)); // 30 seconds
```

---

## ⚡ **Performance Optimization**

### **Lazy Initialization**

```typescript
let expensiveService: ExpensiveService | null = null;

const lazyService: Middleware = async (ctx, next) => {
  if (!expensiveService) {
    expensiveService = await initializeExpensiveService();
  }

  ctx.state.service = expensiveService;
  await next();
};
```

### **Memory-Efficient Streaming**

```typescript
const streamProcessor: Middleware = async (ctx, next) => {
  if (ctx.req.headers['content-type']?.includes('multipart/form-data')) {
    // Process large uploads in chunks
    const chunks: Buffer[] = [];

    ctx.req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);

      // Prevent memory overflow
      if (chunks.length > 1000) {
        ctx.req.destroy();
        ctx.res.status(413).json({ error: 'Payload too large' });
        return;
      }
    });

    await new Promise((resolve, reject) => {
      ctx.req.on('end', resolve);
      ctx.req.on('error', reject);
    });

    ctx.body = Buffer.concat(chunks);
  }

  await next();
};
```

---

## 🧪 **Testing Middleware**

### **Unit Testing**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createMockContext } from 'nextrush/testing';

describe('Authentication Middleware', () => {
  it('should authenticate valid token', async () => {
    const ctx = createMockContext();
    ctx.req.headers.authorization = 'Bearer valid-token';

    const next = vi.fn();

    await requireAuth(ctx, next);

    expect(ctx.state.user).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('should reject invalid token', async () => {
    const ctx = createMockContext();
    ctx.req.headers.authorization = 'Bearer invalid-token';

    const next = vi.fn();

    await requireAuth(ctx, next);

    expect(ctx.res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
```

### **Integration Testing**

```typescript
import { createApp } from 'nextrush';
import request from 'supertest';

describe('Middleware Integration', () => {
  it('should apply middleware in correct order', async () => {
    const app = createApp();
    const calls: string[] = [];

    app.use(async (ctx, next) => {
      calls.push('middleware1-before');
      await next();
      calls.push('middleware1-after');
    });

    app.use(async (ctx, next) => {
      calls.push('middleware2-before');
      await next();
      calls.push('middleware2-after');
    });

    app.get('/test', ctx => {
      calls.push('handler');
      ctx.res.json({ success: true });
    });

    await request(app.callback()).get('/test').expect(200);

    expect(calls).toEqual([
      'middleware1-before',
      'middleware2-before',
      'handler',
      'middleware2-after',
      'middleware1-after',
    ]);
  });
});
```

---

## 📚 **Common Patterns**

### **API Key Validation**

```typescript
const validateApiKey: Middleware = async (ctx, next) => {
  const apiKey = ctx.req.headers['x-api-key'] as string;

  if (!apiKey) {
    ctx.res.status(401).json({ error: 'API key required' });
    return;
  }

  const isValid = await validateKey(apiKey);
  if (!isValid) {
    ctx.res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  await next();
};
```

### **Request Validation**

```typescript
import { z } from 'zod';

const validateBody = (schema: z.ZodSchema): Middleware => {
  return async (ctx, next) => {
    try {
      ctx.body = schema.parse(ctx.body);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        ctx.res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
      } else {
        throw error;
      }
    }
  };
};

// Usage
const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

app.post('/users', validateBody(userSchema), createUser);
```

### **Response Transformation**

```typescript
const jsonTransformer: Middleware = async (ctx, next) => {
  await next();

  if (ctx.body && typeof ctx.body === 'object') {
    // Add metadata to all JSON responses
    ctx.body = {
      ...ctx.body,
      _metadata: {
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        requestId: ctx.state.requestId,
      },
    };
  }
};
```

---

## 🌍 **Real-World Examples**

### **Rate Limiting with Redis**

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const rateLimiter = (options: {
  requests: number;
  window: number;
  keyGenerator?: (ctx: Context) => string;
}): Middleware => {
  const { requests, window, keyGenerator = ctx => ctx.ip } = options;

  return async (ctx, next) => {
    const key = `rate_limit:${keyGenerator(ctx)}`;

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, Math.ceil(window / 1000));
    }

    if (current > requests) {
      ctx.res.status(429).json({
        error: 'Too many requests',
        retryAfter: await redis.ttl(key),
      });
      return;
    }

    ctx.res.setHeader('X-RateLimit-Limit', requests.toString());
    ctx.res.setHeader('X-RateLimit-Remaining', (requests - current).toString());

    await next();
  };
};
```

### **Request/Response Logging**

```typescript
import { createLogger } from 'winston';

const logger = createLogger({
  // Winston configuration
});

const requestLogger: Middleware = async (ctx, next) => {
  const start = Date.now();
  const requestId = crypto.randomUUID();

  ctx.state.requestId = requestId;

  logger.info('Request started', {
    requestId,
    method: ctx.method,
    path: ctx.path,
    userAgent: ctx.req.headers['user-agent'],
    ip: ctx.ip,
  });

  try {
    await next();

    const duration = Date.now() - start;
    logger.info('Request completed', {
      requestId,
      statusCode: ctx.res.statusCode,
      duration,
      responseSize: ctx.res.getHeader('content-length'),
    });
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Request failed', {
      requestId,
      error: error.message,
      stack: error.stack,
      duration,
    });
    throw error;
  }
};
```

### **Health Check Middleware**

```typescript
const healthCheck: Middleware = async (ctx, next) => {
  if (ctx.path === '/health') {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      checks: {
        database: await checkDatabase(),
        redis: await checkRedis(),
        externalApi: await checkExternalApi(),
      },
    };

    const isHealthy = Object.values(health.checks).every(check => check);

    ctx.res.status(isHealthy ? 200 : 503).json(health);
    return;
  }

  await next();
};
```

---

## 💡 **Best Practices**

### **1. Always Call `next()`**

```typescript
// ❌ Wrong - next() not called
const badMiddleware: Middleware = async (ctx, next) => {
  console.log('Processing...');
  // Missing await next()
};

// ✅ Correct
const goodMiddleware: Middleware = async (ctx, next) => {
  console.log('Processing...');
  await next();
};
```

### **2. Handle Errors Properly**

```typescript
// ✅ Error handling
const safeMiddleware: Middleware = async (ctx, next) => {
  try {
    await someAsyncOperation();
    await next();
  } catch (error) {
    console.error('Middleware error:', error);
    throw error; // Re-throw for error handler
  }
};
```

### **3. Use TypeScript Types**

```typescript
// ✅ Typed middleware
interface AuthenticatedContext extends Context {
  state: {
    user: User;
  };
}

const typedAuth: Middleware<AuthenticatedContext> = async (ctx, next) => {
  // ctx.state.user is typed as User
  await next();
};
```

---

## 🚀 **Next Steps**

1. **Read**: [Built-in Middleware Reference](../api/built-in-middleware.md)
2. **Explore**: [Error Handling Guide](./error-handling.md)
3. **Learn**: [Performance Optimization Guide](./performance-optimization.md)
4. **Practice**: [Testing Guide](./testing-guide.md)

---

## 📖 **See Also**

- [Context API Reference](../api/context.md)
- [Application API Reference](../api/application.md)
- [Event System Guide](./event-system.md)
- [Plugin Development Guide](./plugin-development.md)
