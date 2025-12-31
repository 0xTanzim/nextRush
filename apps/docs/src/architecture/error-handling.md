---
title: Error Handling
description: NextRush error architecture — error hierarchy, propagation flow, and custom error patterns.
---

# Error Handling Architecture

> Understanding how NextRush handles errors: the error hierarchy, propagation through middleware, and patterns for custom errors.

## Overview

NextRush provides a structured error system:

```
Error
└── NextRushError (base for all framework errors)
    └── HttpError (has status code)
        ├── BadRequestError (400)
        ├── UnauthorizedError (401)
        ├── ForbiddenError (403)
        ├── NotFoundError (404)
        ├── ... (other 4xx errors)
        ├── InternalServerError (500)
        └── ... (other 5xx errors)
```

---

## Error Hierarchy

### NextRushError (Base)

All framework errors extend `NextRushError`:

```typescript
class NextRushError extends Error {
  /** HTTP status code */
  readonly status: number;

  /** Error code for programmatic handling */
  readonly code: string;

  /** Whether message is safe to expose to client */
  readonly expose: boolean;

  /** Additional error details */
  readonly details?: Record<string, unknown>;

  /** Original error that caused this error */
  readonly cause?: Error;
}
```

### HttpError

HTTP-specific errors with status codes:

```typescript
class HttpError extends NextRushError {
  constructor(
    status: number,
    message: string,
    options?: {
      code?: string;
      expose?: boolean;
      details?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    // status < 500 → expose = true (client error)
    // status >= 500 → expose = false (server error)
  }
}
```

### Concrete Error Classes

| Class | Status | Code | Expose |
|-------|--------|------|--------|
| `BadRequestError` | 400 | `BAD_REQUEST` | ✅ |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | ✅ |
| `ForbiddenError` | 403 | `FORBIDDEN` | ✅ |
| `NotFoundError` | 404 | `NOT_FOUND` | ✅ |
| `ConflictError` | 409 | `CONFLICT` | ✅ |
| `UnprocessableEntityError` | 422 | `UNPROCESSABLE_ENTITY` | ✅ |
| `TooManyRequestsError` | 429 | `TOO_MANY_REQUESTS` | ✅ |
| `InternalServerError` | 500 | `INTERNAL_SERVER_ERROR` | ❌ |
| `BadGatewayError` | 502 | `BAD_GATEWAY` | ❌ |
| `ServiceUnavailableError` | 503 | `SERVICE_UNAVAILABLE` | ❌ |

---

## Error Flow

### Propagation Through Middleware

```
┌─────────────────────────────────────────────────────────────────────┐
│  Handler throws NotFoundError                                        │
│       │                                                              │
│       ▼                                                              │
│  Middleware 3 (no try/catch) → error bubbles up                      │
│       │                                                              │
│       ▼                                                              │
│  Middleware 2 (no try/catch) → error bubbles up                      │
│       │                                                              │
│       ▼                                                              │
│  Middleware 1 (error handler)                                        │
│       │                                                              │
│       ├── Has try/catch? → Handle error locally                      │
│       │                                                              │
│       └── No catch? → error bubbles up                               │
│                │                                                     │
│                ▼                                                     │
│  Application.callback() catch                                        │
│       │                                                              │
│       ├── Custom error handler? → app.onError(handler)               │
│       │                                                              │
│       └── No custom handler → defaultErrorHandler()                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Application Error Handler

```typescript
// In Application.callback()
async (ctx: Context): Promise<void> => {
  try {
    await composedMiddleware(ctx);
  } catch (error) {
    await this.handleError(error, ctx);
  }
}

// handleError
private async handleError(error: unknown, ctx: Context): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));

  // Custom handler first
  if (this._errorHandler) {
    try {
      await this._errorHandler(err, ctx);
      return;
    } catch (handlerError) {
      console.error('Error handler threw:', handlerError);
    }
  }

  // Fall back to default
  this.defaultErrorHandler(err, ctx);
}
```

### Default Error Handler

```typescript
private defaultErrorHandler(error: Error, ctx: Context): void {
  // Log in development
  if (!this.isProduction) {
    console.error('Request error:', error);
  }

  // Use error.status if available
  if ('status' in error && typeof error.status === 'number') {
    ctx.status = error.status;
  } else {
    ctx.status = 500;
  }

  // Only expose message in development
  const message = !this.isProduction
    ? error.message
    : 'Internal Server Error';

  ctx.json({ error: message });
}
```

---

## Using Errors

### Throwing HTTP Errors

```typescript
import { NotFoundError, BadRequestError } from '@nextrush/errors';

app.get('/users/:id', async (ctx) => {
  const user = await db.users.findById(ctx.params.id);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  ctx.json({ user });
});

app.post('/users', async (ctx) => {
  const { email } = ctx.body;

  if (!email) {
    throw new BadRequestError('Email is required');
  }

  // ...
});
```

### Error with Details

```typescript
import { UnprocessableEntityError } from '@nextrush/errors';

app.post('/users', async (ctx) => {
  const errors = validateUser(ctx.body);

  if (errors.length > 0) {
    throw new UnprocessableEntityError('Validation failed', {
      details: { fields: errors }
    });
  }
});

// Response:
// {
//   "error": "UnprocessableEntityError",
//   "message": "Validation failed",
//   "code": "UNPROCESSABLE_ENTITY",
//   "status": 422,
//   "details": { "fields": [...] }
// }
```

### Error with Cause

```typescript
import { InternalServerError } from '@nextrush/errors';

app.get('/data', async (ctx) => {
  try {
    const data = await externalApi.fetch();
    ctx.json(data);
  } catch (apiError) {
    throw new InternalServerError('Failed to fetch data', {
      cause: apiError as Error
    });
  }
});
```

---

## Custom Error Handler

### Setting Up

```typescript
app.onError(async (error, ctx) => {
  // Log all errors
  console.error({
    error: error.name,
    message: error.message,
    path: ctx.path,
    method: ctx.method,
    stack: error.stack,
  });

  // Handle specific error types
  if (error instanceof NotFoundError) {
    ctx.status = 404;
    ctx.json({ error: 'Resource not found' });
    return;
  }

  if (error instanceof UnauthorizedError) {
    ctx.status = 401;
    ctx.set('WWW-Authenticate', 'Bearer');
    ctx.json({ error: 'Authentication required' });
    return;
  }

  // Default handling
  const isProduction = process.env.NODE_ENV === 'production';
  ctx.status = error.status ?? 500;
  ctx.json({
    error: isProduction ? 'Internal Server Error' : error.message,
    ...(isProduction ? {} : { stack: error.stack }),
  });
});
```

### Error Handler Patterns

**Pattern 1: Error Middleware**

```typescript
// Global error handling middleware
app.use(async (ctx) => {
  try {
    await ctx.next();
  } catch (error) {
    // Handle error
    if (error instanceof HttpError) {
      ctx.status = error.status;
      ctx.json(error.toJSON());
    } else {
      ctx.status = 500;
      ctx.json({ error: 'Internal Server Error' });
    }
  }
});
```

**Pattern 2: Error Boundary by Route**

```typescript
// Wrap specific routes
function errorBoundary(handler: Middleware): Middleware {
  return async (ctx) => {
    try {
      await handler(ctx);
    } catch (error) {
      // Route-specific error handling
    }
  };
}

router.get('/sensitive', errorBoundary(sensitiveHandler));
```

---

## Error Serialization

### toJSON()

```typescript
const error = new BadRequestError('Invalid input', {
  details: { field: 'email', reason: 'invalid format' }
});

error.toJSON();
// {
//   error: 'BadRequestError',
//   message: 'Invalid input',
//   code: 'BAD_REQUEST',
//   status: 400,
//   details: { field: 'email', reason: 'invalid format' }
// }
```

### toResponse()

```typescript
const { status, body } = error.toResponse();
// status: 400
// body: { error: 'BadRequestError', message: '...', ... }

ctx.status = status;
ctx.json(body);
```

### Expose Control

```typescript
// 4xx errors (client errors) → expose = true
const badRequest = new BadRequestError('Invalid email');
badRequest.expose; // true - message sent to client

// 5xx errors (server errors) → expose = false
const internal = new InternalServerError('Database connection failed');
internal.expose; // false - generic message sent to client

// Override expose
const customError = new InternalServerError('Safe message', {
  expose: true  // Force expose
});
```

---

## Creating Custom Errors

### Domain-Specific Errors

```typescript
import { HttpError } from '@nextrush/errors';

// Domain error
export class UserNotFoundError extends HttpError {
  constructor(userId: string) {
    super(404, `User ${userId} not found`, {
      code: 'USER_NOT_FOUND',
      details: { userId }
    });
  }
}

export class DuplicateEmailError extends HttpError {
  constructor(email: string) {
    super(409, 'Email already registered', {
      code: 'DUPLICATE_EMAIL',
      details: { email }
    });
  }
}

// Usage
throw new UserNotFoundError('123');
throw new DuplicateEmailError('user@example.com');
```

### Validation Error

```typescript
import { HttpError } from '@nextrush/errors';

interface ValidationIssue {
  field: string;
  message: string;
  code: string;
}

export class ValidationError extends HttpError {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(422, 'Validation failed', {
      code: 'VALIDATION_ERROR',
      details: { issues }
    });
    this.issues = issues;
  }

  static fromZodError(zodError: z.ZodError): ValidationError {
    const issues = zodError.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
    return new ValidationError(issues);
  }
}
```

---

## Error Factory

### Creating Errors by Status

```typescript
import { createHttpError } from '@nextrush/errors';

// Factory function
const error = createHttpError(404, 'Resource not found');
// Returns NotFoundError instance

const error = createHttpError(500, 'Something went wrong');
// Returns InternalServerError instance

// With options
const error = createHttpError(400, 'Invalid input', {
  code: 'INVALID_INPUT',
  details: { field: 'email' }
});
```

---

## Special Error Types

### TooManyRequestsError

```typescript
import { TooManyRequestsError } from '@nextrush/errors';

throw new TooManyRequestsError('Rate limit exceeded', {
  retryAfter: 60  // seconds
});

// Access retry info
error.retryAfter; // 60
```

### MethodNotAllowedError

```typescript
import { MethodNotAllowedError } from '@nextrush/errors';

throw new MethodNotAllowedError(['GET', 'POST'], 'PUT not allowed');

// Access allowed methods
error.allowedMethods; // ['GET', 'POST']
```

---

## Error Handling Best Practices

### 1. Be Specific

```typescript
// ✅ Good: Specific error type
throw new NotFoundError('User not found');

// ❌ Bad: Generic error
throw new Error('Not found');
```

### 2. Include Context

```typescript
// ✅ Good: Include helpful details
throw new BadRequestError('Invalid date format', {
  details: {
    field: 'startDate',
    received: ctx.query.startDate,
    expected: 'YYYY-MM-DD'
  }
});

// ❌ Bad: No context
throw new BadRequestError('Invalid input');
```

### 3. Don't Expose Internals

```typescript
// ✅ Good: Safe message
throw new InternalServerError('Database operation failed');

// ❌ Bad: Exposes internals
throw new InternalServerError(`MySQL error: ${dbError.message}`);
```

### 4. Use Cause for Debugging

```typescript
try {
  await database.query(sql);
} catch (dbError) {
  // Keep original error for debugging
  throw new InternalServerError('Query failed', {
    cause: dbError as Error
  });
}
```

### 5. Centralize Error Handling

```typescript
// ✅ Good: Single error handler
app.onError((error, ctx) => {
  logger.error(error);
  // ... handle all errors consistently
});

// ❌ Bad: Try/catch everywhere
app.get('/a', async (ctx) => { try { ... } catch { ... } });
app.get('/b', async (ctx) => { try { ... } catch { ... } });
```

---

## See Also

- [Core & Application](./core-application) — Error handling in middleware
- [Adapter Architecture](./adapters) — Error responses
- [Error Handling Guide](/guides/error-handling) — Usage patterns
