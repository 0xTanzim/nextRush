# Error Handling

NextRush v2 provides a comprehensive error handling system with custom error classes, exception filters, and an error factory for consistent error management across your application.

## Table of Contents

- [Error Classes](#error-classes)
- [Exception Filters](#exception-filters)
- [Error Factory](#error-factory)
- [Global Error Handling](#global-error-handling)
- [Custom Error Handling](#custom-error-handling)
- [Error Response Format](#error-response-format)
- [Best Practices](#best-practices)

## Error Classes

NextRush v2 includes a set of built-in error classes that extend the standard `Error` class and provide consistent error handling.

### Base Error Class

```typescript
import { NextRushError } from 'nextrush-v2';

// Base error class with enhanced properties
class NextRushError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly timestamp: string;
  public readonly path?: string;
  public readonly method?: string;
  public readonly requestId?: string;
}
```

### Built-in Error Classes

#### ValidationError

Used for input validation failures.

```typescript
import { ValidationError } from 'nextrush-v2';

// Basic validation error
throw new ValidationError('Email is required', 'email');

// With value
throw new ValidationError('Age must be between 18 and 120', 'age', 15);

// Usage in route handlers
app.post('/users', ctx => {
  const { name, email, age } = ctx.body as any;

  if (!name || !email) {
    throw new ValidationError('Name and email are required', 'body');
  }

  if (age && (age < 18 || age > 120)) {
    throw new ValidationError('Age must be between 18 and 120', 'age', age);
  }

  // Process user creation...
});
```

#### NotFoundError

Used when a resource is not found.

```typescript
import { NotFoundError } from 'nextrush-v2';

app.get('/users/:id', ctx => {
  const user = await findUser(ctx.params['id']);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  ctx.res.json(user);
});
```

#### BadRequestError

Used for malformed requests or invalid parameters.

```typescript
import { BadRequestError } from 'nextrush-v2';

app.put('/users/:id', ctx => {
  const { name, email } = ctx.body as any;

  if (!name && !email) {
    throw new BadRequestError('At least one field is required');
  }

  // Process update...
});
```

#### AuthenticationError

Used for authentication failures.

```typescript
import { AuthenticationError } from 'nextrush-v2';

app.get('/protected', ctx => {
  const token = ctx.headers.authorization;

  if (!token) {
    throw new AuthenticationError('Authentication required');
  }

  // Verify token...
});
```

#### AuthorizationError

Used for authorization failures (insufficient permissions).

```typescript
import { AuthorizationError } from 'nextrush-v2';

app.delete('/users/:id', ctx => {
  const user = await findUser(ctx.params['id']);

  if (user.role !== 'admin') {
    throw new AuthorizationError('Admin access required');
  }

  // Delete user...
});
```

#### ConflictError

Used when there's a conflict with the current state.

```typescript
import { ConflictError } from 'nextrush-v2';

app.post('/users', ctx => {
  const { email } = ctx.body as any;

  if (await userExists(email)) {
    throw new ConflictError('User with this email already exists');
  }

  // Create user...
});
```

#### RateLimitError

Used when rate limits are exceeded.

```typescript
import { RateLimitError } from 'nextrush-v2';

app.post('/api/requests', ctx => {
  const userRequests = await getUserRequestCount(ctx.user.id);

  if (userRequests >= 100) {
    throw new RateLimitError('Rate limit exceeded', 60); // 60 seconds retry
  }

  // Process request...
});
```

## Exception Filters

Exception filters provide a way to handle errors consistently across your application. They can transform errors into appropriate HTTP responses.

### Built-in Exception Filters

#### GlobalExceptionFilter

Handles any unhandled errors.

```typescript
import { GlobalExceptionFilter } from 'nextrush-v2';

app.use(app.exceptionFilter([new GlobalExceptionFilter()]));
```

#### ValidationExceptionFilter

Handles validation errors with detailed field information.

```typescript
import { ValidationExceptionFilter } from 'nextrush-v2';

app.use(app.exceptionFilter([new ValidationExceptionFilter()]));
```

#### BadRequestExceptionFilter

Handles bad request errors.

```typescript
import { BadRequestExceptionFilter } from 'nextrush-v2';

app.use(app.exceptionFilter([new BadRequestExceptionFilter()]));
```

#### AuthenticationExceptionFilter

Handles authentication errors.

```typescript
import { AuthenticationExceptionFilter } from 'nextrush-v2';

app.use(app.exceptionFilter([new AuthenticationExceptionFilter()]));
```

#### AuthorizationExceptionFilter

Handles authorization errors.

```typescript
import { AuthorizationExceptionFilter } from 'nextrush-v2';

app.use(app.exceptionFilter([new AuthorizationExceptionFilter()]));
```

#### RateLimitExceptionFilter

Handles rate limit errors with retry-after headers.

```typescript
import { RateLimitExceptionFilter } from 'nextrush-v2';

app.use(app.exceptionFilter([new RateLimitExceptionFilter()]));
```

### Using Multiple Exception Filters

```typescript
import {
  BadRequestExceptionFilter,
  ValidationExceptionFilter,
  RateLimitExceptionFilter,
  AuthenticationExceptionFilter,
  GlobalExceptionFilter,
} from '@/errors/custom-errors';

// Order matters - more specific filters should come first
app.use(
  app.exceptionFilter([
    new BadRequestExceptionFilter(),
    new ValidationExceptionFilter(),
    new RateLimitExceptionFilter(),
    new AuthenticationExceptionFilter(),
    new GlobalExceptionFilter(),
  ])
);
```

### Custom Exception Filters

You can create custom exception filters for specific error types.

```typescript
import { ExceptionFilter, Catch } from 'nextrush-v2';

@Catch(CustomError)
export class CustomExceptionFilter implements ExceptionFilter {
  async catch(error: Error, ctx: any): Promise<void> {
    ctx.status = 422;
    ctx.res.json({
      error: {
        name: 'CustomError',
        message: error.message,
        code: 'CUSTOM_ERROR',
        statusCode: 422,
        timestamp: new Date().toISOString(),
        path: ctx.path,
        method: ctx.method,
        requestId: ctx.requestId,
      },
    });
  }
}
```

## Error Factory

The `ErrorFactory` provides convenient methods for creating common error instances.

```typescript
import { ErrorFactory } from 'nextrush-v2';

// Create validation errors
const emailError = ErrorFactory.validation(
  'email',
  'Invalid email format',
  'invalid-email'
);

// Create not found errors
const userError = ErrorFactory.notFound('User');

// Create authentication errors
const authError = ErrorFactory.unauthorized('Token expired');

// Create authorization errors
const permError = ErrorFactory.forbidden('Admin access required');

// Create bad request errors
const paramError = ErrorFactory.badRequest('Invalid parameters');

// Create conflict errors
const conflictError = ErrorFactory.conflict('Email already exists');

// Create rate limit errors
const rateError = ErrorFactory.rateLimit('Too many requests', 60);
```

## Global Error Handling

NextRush v2 automatically handles errors and provides consistent error responses.

### Error Response Format

All errors follow a consistent response format:

```json
{
  "error": {
    "name": "ValidationError",
    "message": "Age must be between 18 and 120",
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "field": "age",
    "value": 15,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "path": "/users",
    "method": "POST",
    "requestId": "req-1234567890"
  }
}
```

### Error Properties

| Property     | Type   | Description                                    |
| ------------ | ------ | ---------------------------------------------- |
| `name`       | string | Error class name                               |
| `message`    | string | Human-readable error message                   |
| `code`       | string | Machine-readable error code                    |
| `statusCode` | number | HTTP status code                               |
| `field`      | string | Field name (for validation errors)             |
| `value`      | any    | Invalid value (for validation errors)          |
| `retryAfter` | number | Retry delay in seconds (for rate limit errors) |
| `timestamp`  | string | ISO timestamp                                  |
| `path`       | string | Request path                                   |
| `method`     | string | HTTP method                                    |
| `requestId`  | string | Request ID for tracking                        |

## Custom Error Handling

### Creating Custom Error Classes

```typescript
import { NextRushError } from '@/errors/custom-errors';

export class DatabaseError extends NextRushError {
  constructor(
    message: string,
    public readonly operation: string
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.code = 'DATABASE_ERROR';
    this.statusCode = 500;
  }
}

// Usage
throw new DatabaseError('Connection failed', 'SELECT');
```

### Custom Exception Filter

```typescript
import { ExceptionFilter, Catch } from '@/errors/custom-errors';

@Catch(DatabaseError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  async catch(error: DatabaseError, ctx: any): Promise<void> {
    ctx.status = 500;
    ctx.res.json({
      error: {
        name: 'DatabaseError',
        message: error.message,
        code: 'DATABASE_ERROR',
        statusCode: 500,
        operation: error.operation,
        timestamp: new Date().toISOString(),
        path: ctx.path,
        method: ctx.method,
        requestId: ctx.requestId,
      },
    });
  }
}
```

## Best Practices

### 1. Use Specific Error Types

```typescript
// Good - specific error type
if (!user) {
  throw new NotFoundError('User not found');
}

// Avoid - generic error
if (!user) {
  throw new Error('User not found');
}
```

### 2. Provide Meaningful Error Messages

```typescript
// Good - descriptive message
throw new ValidationError('Email must be a valid email address', 'email');

// Avoid - vague message
throw new ValidationError('Invalid input', 'email');
```

### 3. Include Context in Errors

```typescript
// Good - includes relevant context
throw new ValidationError('Age must be between 18 and 120', 'age', userAge);

// Good - includes operation context
throw new DatabaseError('Failed to update user', 'UPDATE');
```

### 4. Use Error Factory for Common Errors

```typescript
// Good - using factory methods
const error = ErrorFactory.validation('email', 'Invalid format', email);

// Avoid - manual error creation
const error = new ValidationError('Invalid format', 'email', email);
```

### 5. Order Exception Filters Correctly

```typescript
// Good - specific filters first
app.use(
  app.exceptionFilter([
    new BadRequestExceptionFilter(),
    new ValidationExceptionFilter(),
    new GlobalExceptionFilter(), // Catch-all last
  ])
);

// Avoid - generic filter first
app.use(
  app.exceptionFilter([
    new GlobalExceptionFilter(), // This would catch everything
    new BadRequestExceptionFilter(), // Never reached
  ])
);
```

### 6. Handle Async Errors

```typescript
app.get('/users/:id', async ctx => {
  try {
    const user = await findUser(ctx.params['id']);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    ctx.res.json(user);
  } catch (error) {
    // Let exception filters handle the error
    throw error;
  }
});
```

### 7. Log Errors Appropriately

```typescript
import { LoggerPlugin } from '@/plugins/logger';

const logger = new LoggerPlugin();
app.use(logger);

// Errors will be automatically logged by the logger plugin
app.get('/error', () => {
  throw new Error('Something went wrong');
});
```

## Error Codes Reference

| Error Class           | Code                    | Status Code | Description              |
| --------------------- | ----------------------- | ----------- | ------------------------ |
| `ValidationError`     | `VALIDATION_ERROR`      | 400         | Input validation failed  |
| `BadRequestError`     | `BAD_REQUEST`           | 400         | Malformed request        |
| `AuthenticationError` | `AUTHENTICATION_ERROR`  | 401         | Authentication required  |
| `AuthorizationError`  | `AUTHORIZATION_ERROR`   | 403         | Insufficient permissions |
| `NotFoundError`       | `NOT_FOUND`             | 404         | Resource not found       |
| `ConflictError`       | `CONFLICT`              | 409         | Resource conflict        |
| `RateLimitError`      | `RATE_LIMIT_ERROR`      | 429         | Rate limit exceeded      |
| `NextRushError`       | `INTERNAL_SERVER_ERROR` | 500         | Generic server error     |

## Testing Error Handling

```typescript
import { createApp, ValidationError } from 'nextrush-v2';

describe('Error Handling', () => {
  it('should handle validation errors', async () => {
    const app = createApp();

    app.post('/users', ctx => {
      throw new ValidationError('Name is required', 'name');
    });

    const response = await fetch('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.name).toBe('ValidationError');
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});
```

This comprehensive error handling system ensures consistent, predictable error responses across your NextRush v2 application while providing the flexibility to handle custom error scenarios.
