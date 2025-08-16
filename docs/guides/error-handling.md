# 🚨 Error Handling Guide

Comprehensive guide to error handling in NextRush v2, covering error types, handling patterns, debugging techniques, and production strategies.

---

## 📖 **Table of Contents**

1. [Error Handling Overview](#-error-handling-overview)
2. [Built-in Error Types](#-built-in-error-types)
3. [Error Middleware](#-error-middleware)
4. [Custom Error Classes](#-custom-error-classes)
5. [Error Recovery Strategies](#-error-recovery-strategies)
6. [Production Error Handling](#-production-error-handling)
7. [Debugging Techniques](#-debugging-techniques)
8. [Testing Error Scenarios](#-testing-error-scenarios)

---

## 🎯 **Error Handling Overview**

### **Error Flow in NextRush**

```typescript
Request → Middleware → Route Handler → Response
    ↓         ↓             ↓
Error ← Error Middleware ← Error ←
```

### **Error Handling Principles**

1. **Fail Fast**: Detect errors early in the request lifecycle
2. **Graceful Degradation**: Provide meaningful responses to clients
3. **Logging**: Capture detailed error information for debugging
4. **Recovery**: Attempt to recover from transient errors
5. **Security**: Don't leak sensitive information in error responses

---

## 🛠️ **Built-in Error Types**

### **HTTP Errors**

```typescript
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalServerError,
} from 'nextrush/errors';

// 400 Bad Request
throw new BadRequestError('Invalid request format');

// 401 Unauthorized
throw new UnauthorizedError('Authentication required');

// 403 Forbidden
throw new ForbiddenError('Insufficient permissions');

// 404 Not Found
throw new NotFoundError('User not found');

// 409 Conflict
throw new ConflictError('Email already exists');

// 422 Validation Error
throw new ValidationError('Invalid email format', 'email', 'invalid@');

// 500 Internal Server Error
throw new InternalServerError('Database connection failed');
```

### **Error Factory**

```typescript
import { ErrorFactory } from 'nextrush/errors';

// Quick error creation
throw ErrorFactory.badRequest('Missing required field: name');
throw ErrorFactory.unauthorized('Token expired');
throw ErrorFactory.notFound('Resource', id);
throw ErrorFactory.validation('email', 'Invalid format');
```

### **Error Properties**

```typescript
class CustomError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

// Usage
const error = new CustomError('Something went wrong', 400, 'CUSTOM_ERROR', {
  field: 'username',
  value: 'invalid-user',
});

console.log(error.statusCode); // 400
console.log(error.code); // 'CUSTOM_ERROR'
console.log(error.details); // { field: 'username', value: 'invalid-user' }
```

---

## 🛡️ **Error Middleware**

### **Global Error Handler**

```typescript
import type { Context, Middleware } from 'nextrush';

const errorHandler: Middleware = async (ctx: Context, next) => {
  try {
    await next();
  } catch (error) {
    // Log the error
    console.error('Request failed:', {
      error: error.message,
      stack: error.stack,
      path: ctx.path,
      method: ctx.method,
      requestId: ctx.state.requestId,
    });

    // Determine response based on error type
    if (error.statusCode) {
      // Known HTTP error
      ctx.res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
    } else if (error.name === 'ValidationError') {
      // Validation error
      ctx.res.status(422).json({
        error: 'Validation failed',
        details: error.errors,
      });
    } else {
      // Unknown error - don't leak details
      ctx.res.status(500).json({
        error: 'Internal server error',
        requestId: ctx.state.requestId,
      });
    }
  }
};

// Install as first middleware
app.use(errorHandler);
```

### **Async Error Wrapper**

```typescript
const asyncHandler = (fn: (ctx: Context) => Promise<void>) => {
  return async (ctx: Context, next: () => Promise<void>) => {
    try {
      await fn(ctx);
    } catch (error) {
      // Pass error to error middleware
      throw error;
    }
  };
};

// Usage
app.get(
  '/users/:id',
  asyncHandler(async ctx => {
    const user = await UserService.findById(ctx.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    ctx.res.json(user);
  })
);
```

### **Route-Specific Error Handling**

```typescript
app.get('/api/data', async ctx => {
  try {
    const data = await fetchExternalData();
    ctx.res.json(data);
  } catch (error) {
    if (error.code === 'NETWORK_ERROR') {
      // Handle network errors specifically
      ctx.res.status(503).json({
        error: 'Service temporarily unavailable',
        retryAfter: 60,
      });
    } else {
      // Re-throw for global handler
      throw error;
    }
  }
});
```

---

## 🎨 **Custom Error Classes**

### **Domain-Specific Errors**

```typescript
// Base application error
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'APP_ERROR',
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Business logic errors
export class UserNotFoundError extends AppError {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`, 404, 'USER_NOT_FOUND');
  }
}

export class InsufficientFundsError extends AppError {
  constructor(available: number, required: number) {
    super(
      `Insufficient funds: ${available} available, ${required} required`,
      400,
      'INSUFFICIENT_FUNDS'
    );
  }
}

export class RateLimitExceededError extends AppError {
  constructor(limit: number, window: number) {
    super(
      `Rate limit exceeded: ${limit} requests per ${window}ms`,
      429,
      'RATE_LIMIT_EXCEEDED'
    );
  }
}
```

### **Error with Context**

```typescript
export class DatabaseError extends AppError {
  constructor(
    operation: string,
    originalError: Error,
    public query?: string,
    public params?: any[]
  ) {
    super(
      `Database ${operation} failed: ${originalError.message}`,
      500,
      'DATABASE_ERROR'
    );

    this.cause = originalError;
  }
}

// Usage
try {
  await db.query('SELECT * FROM users WHERE id = ?', [userId]);
} catch (error) {
  throw new DatabaseError('SELECT', error, 'SELECT * FROM users WHERE id = ?', [
    userId,
  ]);
}
```

### **Validation Errors with Details**

```typescript
export class DetailedValidationError extends AppError {
  constructor(
    public field: string,
    public value: any,
    public constraint: string,
    public expectedFormat?: string
  ) {
    super(
      `Validation failed for field '${field}': ${constraint}`,
      422,
      'VALIDATION_ERROR'
    );
  }

  toJSON() {
    return {
      message: this.message,
      code: this.code,
      field: this.field,
      value: this.value,
      constraint: this.constraint,
      expectedFormat: this.expectedFormat,
    };
  }
}

// Usage
if (!email.includes('@')) {
  throw new DetailedValidationError(
    'email',
    email,
    'must contain @ symbol',
    'user@domain.com'
  );
}
```

---

## 🔄 **Error Recovery Strategies**

### **Retry Logic**

```typescript
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors
      if (error.statusCode && error.statusCode < 500) {
        throw error;
      }

      if (attempt < maxRetries) {
        console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw lastError;
};

// Usage
app.get('/external-data', async ctx => {
  try {
    const data = await withRetry(() => fetchExternalApi(), 3, 1000);
    ctx.res.json(data);
  } catch (error) {
    throw new ServiceUnavailableError('External service unavailable');
  }
});
```

### **Circuit Breaker Pattern**

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new ServiceUnavailableError('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}

// Usage
const externalApiBreaker = new CircuitBreaker(5, 60000);

app.get('/external-data', async ctx => {
  try {
    const data = await externalApiBreaker.execute(() => fetchExternalApi());
    ctx.res.json(data);
  } catch (error) {
    ctx.res.status(503).json({
      error: 'Service temporarily unavailable',
    });
  }
});
```

### **Fallback Strategies**

```typescript
const withFallback = async <T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  shouldFallback: (error: Error) => boolean = () => true
): Promise<T> => {
  try {
    return await primary();
  } catch (error) {
    if (shouldFallback(error)) {
      console.warn('Primary operation failed, using fallback:', error.message);
      return await fallback();
    }
    throw error;
  }
};

// Usage
app.get('/user-preferences', async ctx => {
  const userId = ctx.params.id;

  const preferences = await withFallback(
    () => PreferenceService.getFromDatabase(userId),
    () => PreferenceService.getDefaults(),
    error => error.statusCode >= 500 // Only fallback on server errors
  );

  ctx.res.json(preferences);
});
```

---

## 🏭 **Production Error Handling**

### **Structured Logging**

```typescript
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
  ],
});

const productionErrorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    // Structured error logging
    logger.error('Request failed', {
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
        statusCode: error.statusCode,
      },
      request: {
        method: ctx.method,
        path: ctx.path,
        query: ctx.query,
        headers: ctx.req.headers,
        ip: ctx.ip,
        userAgent: ctx.req.headers['user-agent'],
      },
      user: ctx.state.user?.id,
      requestId: ctx.state.requestId,
      timestamp: new Date().toISOString(),
    });

    // Send appropriate response
    if (error.isOperational) {
      ctx.res.status(error.statusCode || 500).json({
        error: error.message,
        code: error.code,
        requestId: ctx.state.requestId,
      });
    } else {
      // Programming error - don't expose details
      ctx.res.status(500).json({
        error: 'Internal server error',
        requestId: ctx.state.requestId,
      });
    }
  }
};
```

### **Error Reporting Integration**

```typescript
import * as Sentry from '@sentry/node';

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

const sentryErrorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    // Add context to Sentry
    Sentry.withScope(scope => {
      scope.setTag('path', ctx.path);
      scope.setTag('method', ctx.method);
      scope.setUser({ id: ctx.state.user?.id });
      scope.setContext('request', {
        query: ctx.query,
        body: ctx.body,
        headers: ctx.req.headers,
      });

      // Only report operational errors to Sentry
      if (error.isOperational && error.statusCode >= 500) {
        Sentry.captureException(error);
      }
    });

    throw error;
  }
};
```

### **Health Checks with Error Monitoring**

```typescript
app.get('/health', async ctx => {
  const checks = {
    database: false,
    redis: false,
    externalApi: false,
  };

  const errors: string[] = [];

  try {
    await database.ping();
    checks.database = true;
  } catch (error) {
    errors.push(`Database: ${error.message}`);
  }

  try {
    await redis.ping();
    checks.redis = true;
  } catch (error) {
    errors.push(`Redis: ${error.message}`);
  }

  try {
    await externalApi.healthCheck();
    checks.externalApi = true;
  } catch (error) {
    errors.push(`External API: ${error.message}`);
  }

  const isHealthy = Object.values(checks).every(Boolean);

  ctx.res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
    errors: errors.length > 0 ? errors : undefined,
  });
});
```

---

## 🔍 **Debugging Techniques**

### **Request Tracking**

```typescript
const requestTracker: Middleware = async (ctx, next) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  ctx.state.requestId = requestId;

  console.log(`[${requestId}] → ${ctx.method} ${ctx.path}`);

  try {
    await next();

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ← ${ctx.res.statusCode} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`[${requestId}] ✗ ${error.message} (${duration}ms)`);
    throw error;
  }
};
```

### **Error Context Collection**

```typescript
const contextCollector: Middleware = async (ctx, next) => {
  const context = {
    timestamp: new Date().toISOString(),
    method: ctx.method,
    path: ctx.path,
    query: ctx.query,
    headers: ctx.req.headers,
    body: ctx.body,
    user: ctx.state.user,
    ip: ctx.ip,
    userAgent: ctx.req.headers['user-agent'],
  };

  try {
    await next();
  } catch (error) {
    // Attach context to error
    error.context = context;
    throw error;
  }
};
```

### **Performance Monitoring**

```typescript
const performanceMonitor: Middleware = async (ctx, next) => {
  const marks = {
    start: Date.now(),
    middleware: 0,
    handler: 0,
    response: 0,
  };

  try {
    marks.middleware = Date.now();
    await next();
    marks.handler = Date.now();

    // Log performance metrics
    if (marks.handler - marks.start > 1000) {
      // Slow request
      console.warn('Slow request detected', {
        path: ctx.path,
        duration: marks.handler - marks.start,
        breakdown: {
          middleware: marks.middleware - marks.start,
          handler: marks.handler - marks.middleware,
        },
      });
    }
  } catch (error) {
    error.timing = {
      total: Date.now() - marks.start,
      toError: Date.now() - marks.start,
    };
    throw error;
  }
};
```

---

## 🧪 **Testing Error Scenarios**

### **Error Simulation**

```typescript
describe('Error Handling', () => {
  it('should handle validation errors', async () => {
    const app = createTestApp();

    const response = await request(app)
      .post('/users')
      .send({ name: '', email: 'invalid' })
      .expect(422);

    expect(response.body).toMatchObject({
      error: 'Validation failed',
      details: expect.arrayContaining([
        expect.objectContaining({ field: 'name' }),
        expect.objectContaining({ field: 'email' }),
      ]),
    });
  });

  it('should handle database errors gracefully', async () => {
    const app = createTestApp();

    // Mock database error
    vi.spyOn(UserService, 'create').mockRejectedValue(
      new Error('Connection timeout')
    );

    const response = await request(app)
      .post('/users')
      .send({ name: 'John', email: 'john@example.com' })
      .expect(500);

    expect(response.body).toMatchObject({
      error: 'Internal server error',
      requestId: expect.any(String),
    });
  });
});
```

### **Error Boundary Testing**

```typescript
describe('Error Boundaries', () => {
  it('should isolate errors in middleware', async () => {
    const app = createTestApp();

    // Add middleware that throws
    app.use(async (ctx, next) => {
      if (ctx.path === '/error') {
        throw new Error('Middleware error');
      }
      await next();
    });

    // Error path should fail
    await request(app).get('/error').expect(500);

    // Other paths should work
    await request(app).get('/health').expect(200);
  });
});
```

### **Recovery Testing**

```typescript
describe('Error Recovery', () => {
  it('should retry failed operations', async () => {
    let attempts = 0;
    const mockOperation = vi.fn(() => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary failure');
      }
      return { success: true };
    });

    const result = await withRetry(mockOperation, 3, 10);

    expect(result).toEqual({ success: true });
    expect(attempts).toBe(3);
  });

  it('should use fallback when primary fails', async () => {
    const primary = vi.fn().mockRejectedValue(new Error('Primary failed'));
    const fallback = vi.fn().mockResolvedValue({ fallback: true });

    const result = await withFallback(primary, fallback);

    expect(result).toEqual({ fallback: true });
    expect(primary).toHaveBeenCalled();
    expect(fallback).toHaveBeenCalled();
  });
});
```

---

## 💡 **Best Practices**

### **1. Error Classification**

```typescript
// ✅ Classify errors properly
if (error.isOperational) {
  // Business logic error - safe to expose
  return error.message;
} else {
  // Programming error - don't expose details
  return 'Internal server error';
}
```

### **2. Error Enrichment**

```typescript
// ✅ Add context to errors
catch (error) {
  throw new EnrichedError(error.message, {
    operation: 'user.create',
    userId: ctx.state.user.id,
    timestamp: new Date().toISOString()
  });
}
```

### **3. Graceful Degradation**

```typescript
// ✅ Provide fallbacks
try {
  return await getPremiumFeature();
} catch (error) {
  console.warn('Premium feature unavailable, using basic');
  return await getBasicFeature();
}
```

---

## 🚀 **Next Steps**

1. **Implement**: Global error handler
2. **Create**: Custom error classes for your domain
3. **Add**: Structured logging
4. **Test**: Error scenarios thoroughly
5. **Monitor**: Error rates in production

---

## 📖 **See Also**

- [Developer Experience Guide](../api/developer-experience.md)
- [Testing Guide](./testing-guide.md)
- [Performance Optimization](./performance-optimization.md)
- [Production Deployment](./production-deployment.md)
