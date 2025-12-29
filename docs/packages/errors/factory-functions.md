# Factory Functions

> Quick error creation without importing classes.

## Overview

Factory functions provide a shorter way to create HTTP errors. Instead of importing and instantiating error classes, you can use simple function calls:

```typescript
// With classes
import { NotFoundError } from '@nextrush/errors';
throw new NotFoundError('User not found');

// With factory functions
import { notFound } from '@nextrush/errors';
throw notFound('User not found');
```

Both approaches produce identical errors. Choose based on your preference.

## When to Use Factory Functions

| Use Factory Functions When | Use Classes When |
|---------------------------|------------------|
| Quick one-off errors | Creating custom error subclasses |
| Minimal imports desired | Need type narrowing in catch blocks |
| Functional style preferred | OOP patterns in your codebase |
| Dynamic status code needed | IDE autocomplete for specific errors |

## Factory Function Reference

### createError

Create any HTTP error by status code. Useful when the status code is dynamic.

```typescript
import { createError } from '@nextrush/errors';

// Dynamic status code
throw createError(status, 'Something went wrong');

// With options
throw createError(404, 'Resource not found', {
  code: 'RESOURCE_NOT_FOUND',
  details: { resourceType: 'user', id: '123' },
});
```

**Mapped Status Codes:**

| Status | Returns |
|--------|---------|
| 400 | `BadRequestError` |
| 401 | `UnauthorizedError` |
| 403 | `ForbiddenError` |
| 404 | `NotFoundError` |
| 409 | `ConflictError` |
| 422 | `UnprocessableEntityError` |
| 500 | `InternalServerError` |
| 502 | `BadGatewayError` |
| 504 | `GatewayTimeoutError` |
| Other | `HttpError` (generic) |

### badRequest

Create a 400 Bad Request error.

```typescript
import { badRequest } from '@nextrush/errors';

// Basic
throw badRequest('Invalid request body');

// With options
throw badRequest('Missing required field', {
  code: 'MISSING_FIELD',
  details: { field: 'email' },
});
```

### unauthorized

Create a 401 Unauthorized error.

```typescript
import { unauthorized } from '@nextrush/errors';

// Basic
throw unauthorized('Authentication required');

// With options
throw unauthorized('Invalid token', {
  code: 'TOKEN_INVALID',
});
```

### forbidden

Create a 403 Forbidden error.

```typescript
import { forbidden } from '@nextrush/errors';

// Basic
throw forbidden('Access denied');

// With options
throw forbidden('Admin access required', {
  code: 'ADMIN_REQUIRED',
  details: { requiredRole: 'admin' },
});
```

### notFound

Create a 404 Not Found error.

```typescript
import { notFound } from '@nextrush/errors';

// Basic
throw notFound('User not found');

// With options
throw notFound('Resource not found', {
  code: 'USER_NOT_FOUND',
  details: { userId: ctx.params.id },
});
```

### methodNotAllowed

Create a 405 Method Not Allowed error.

```typescript
import { methodNotAllowed } from '@nextrush/errors';

// With allowed methods
throw methodNotAllowed(['GET', 'POST']);

// With custom message
throw methodNotAllowed(['GET', 'POST'], 'This endpoint only accepts GET and POST');
```

### conflict

Create a 409 Conflict error.

```typescript
import { conflict } from '@nextrush/errors';

// Basic
throw conflict('Email already exists');

// With options
throw conflict('Resource version mismatch', {
  code: 'VERSION_CONFLICT',
  details: { expected: 5, actual: 7 },
});
```

### unprocessableEntity

Create a 422 Unprocessable Entity error.

```typescript
import { unprocessableEntity } from '@nextrush/errors';

// Basic
throw unprocessableEntity('Invalid date range');

// With options
throw unprocessableEntity('Business rule violation', {
  code: 'INVALID_DATE_RANGE',
  details: { reason: 'End date must be after start date' },
});
```

### tooManyRequests

Create a 429 Too Many Requests error.

```typescript
import { tooManyRequests } from '@nextrush/errors';

// Basic
throw tooManyRequests('Rate limit exceeded');

// With retry-after
throw tooManyRequests('Too many requests', {
  retryAfter: 60, // seconds
});
```

### internalError

Create a 500 Internal Server Error.

```typescript
import { internalError } from '@nextrush/errors';

// Basic (message hidden from client by default)
throw internalError('Database connection failed');

// With options
throw internalError('Service unavailable', {
  code: 'DB_CONNECTION_ERROR',
  cause: originalError,
});
```

### badGateway

Create a 502 Bad Gateway error.

```typescript
import { badGateway } from '@nextrush/errors';

// Basic
throw badGateway('Invalid response from upstream');

// With options
throw badGateway('Payment service returned invalid response', {
  code: 'UPSTREAM_ERROR',
  details: { service: 'payment-api' },
});
```

### serviceUnavailable

Create a 503 Service Unavailable error.

```typescript
import { serviceUnavailable } from '@nextrush/errors';

// Basic
throw serviceUnavailable('Service is under maintenance');

// With retry-after
throw serviceUnavailable('Service temporarily unavailable', {
  retryAfter: 300, // 5 minutes
});
```

### gatewayTimeout

Create a 504 Gateway Timeout error.

```typescript
import { gatewayTimeout } from '@nextrush/errors';

// Basic
throw gatewayTimeout('Upstream service timed out');

// With options
throw gatewayTimeout('Payment service timeout', {
  code: 'UPSTREAM_TIMEOUT',
  details: { service: 'payment-api', timeout: 30000 },
});
```

## Utility Functions

### isHttpError

Type guard to check if an unknown value is an HttpError.

```typescript
import { isHttpError } from '@nextrush/errors';

try {
  await someOperation();
} catch (error) {
  if (isHttpError(error)) {
    // TypeScript knows error is HttpError
    console.log(error.status);  // number
    console.log(error.code);    // string
    console.log(error.expose);  // boolean
  }
}
```

**Use Cases:**

```typescript
// In error middleware
function handleError(error: unknown, ctx: Context) {
  if (isHttpError(error)) {
    ctx.status = error.status;
    ctx.json({
      error: error.name,
      message: error.expose ? error.message : 'Internal Server Error',
    });
  } else {
    ctx.status = 500;
    ctx.json({ error: 'Internal Server Error' });
  }
}

// In logging
function logError(error: unknown) {
  if (isHttpError(error)) {
    logger.info(`HTTP ${error.status}: ${error.message}`);
  } else {
    logger.error('Unexpected error:', error);
  }
}
```

### getErrorStatus

Extract HTTP status code from any error.

```typescript
import { getErrorStatus } from '@nextrush/errors';

try {
  await someOperation();
} catch (error) {
  const status = getErrorStatus(error);
  // Returns error.status if HttpError, otherwise 500
  ctx.status = status;
}
```

**Behavior:**

| Input | Returns |
|-------|---------|
| `HttpError` | The error's status code |
| `Error` | 500 |
| Other | 500 |

### getSafeErrorMessage

Get an error message safe to expose to clients.

```typescript
import { getSafeErrorMessage, internalError, notFound } from '@nextrush/errors';

// Client errors are exposed
const clientError = notFound('User not found');
getSafeErrorMessage(clientError); // "User not found"

// Server errors are hidden
const serverError = internalError('Database password exposed in log');
getSafeErrorMessage(serverError); // "Internal Server Error"

// Non-HttpErrors are hidden
const genericError = new Error('Something secret');
getSafeErrorMessage(genericError); // "Internal Server Error"
```

**Behavior:**

| Input | Returns |
|-------|---------|
| `HttpError` with `expose: true` | The error's message |
| `HttpError` with `expose: false` | `"Internal Server Error"` |
| Other | `"Internal Server Error"` |

## Complete Example

```typescript
import {
  notFound,
  unauthorized,
  badRequest,
  conflict,
  internalError,
  isHttpError,
  getErrorStatus,
  getSafeErrorMessage,
} from '@nextrush/errors';

// Route handler using factory functions
app.post('/users', async (ctx) => {
  const { email, password } = ctx.body;

  if (!email || !password) {
    throw badRequest('Email and password are required');
  }

  const existing = await db.users.findByEmail(email);
  if (existing) {
    throw conflict('Email already registered', {
      code: 'DUPLICATE_EMAIL',
    });
  }

  try {
    const user = await db.users.create({ email, password });
    ctx.status = 201;
    ctx.json(user);
  } catch (error) {
    throw internalError('Failed to create user', { cause: error });
  }
});

// Generic error handler using utilities
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.status = getErrorStatus(error);
    ctx.json({
      error: isHttpError(error) ? error.name : 'Error',
      message: getSafeErrorMessage(error),
      code: isHttpError(error) ? error.code : 'UNKNOWN_ERROR',
    });
  }
});
```

## Factory vs Class: Side by Side

| Factory | Class | When to Choose |
|---------|-------|----------------|
| `notFound('msg')` | `new NotFoundError('msg')` | Factory is shorter |
| `createError(status, 'msg')` | `new HttpError(status, 'msg')` | Factory for dynamic status |
| `badRequest('msg', opts)` | `new BadRequestError('msg', opts)` | Same functionality |

Both produce identical errors with the same properties and behavior.

## TypeScript Types

```typescript
import type { HttpError, HttpErrorOptions } from '@nextrush/errors';

// Factory function signature
type FactoryFn = (message?: string, options?: HttpErrorOptions) => HttpError;

// Type guard usage
function process(error: unknown) {
  if (isHttpError(error)) {
    // error is now typed as HttpError
    const status: number = error.status;
    const code: string = error.code;
  }
}
```

## See Also

- [Error Handling Overview](/packages/errors/) - Mental model and quick start
- [HTTP Errors](/packages/errors/http-errors) - Full error class reference
- [Error Middleware](/packages/errors/middleware) - Automatic error handling
