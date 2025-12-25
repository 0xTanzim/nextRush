# @nextrush/errors

Standardized HTTP error handling for NextRush. Type-safe error classes, factory functions, and middleware for consistent API responses.

## Installation

```bash
npm install @nextrush/errors
# or
pnpm add @nextrush/errors
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { errorHandler, NotFoundError, BadRequestError } from '@nextrush/errors';

const app = createApp();

// Add error handling middleware
app.use(errorHandler());

app.get('/users/:id', (ctx) => {
  const user = users.get(ctx.params.id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  ctx.json(user);
});

app.post('/users', (ctx) => {
  if (!ctx.body.email) {
    throw new BadRequestError('Email is required');
  }
  // Create user...
});
```

## Features

- **Type-Safe Errors**: Full TypeScript support with proper error inheritance
- **HTTP Status Codes**: All standard 4xx and 5xx errors included
- **Validation Errors**: Built-in validation error types
- **Factory Functions**: Quick error creation with `badRequest()`, `notFound()`, etc.
- **Error Middleware**: Automatic error response formatting
- **Error Codes**: Custom error codes for API consumers

## HTTP Errors

### 4xx Client Errors

```typescript
import {
  BadRequestError,        // 400
  UnauthorizedError,      // 401
  PaymentRequiredError,   // 402
  ForbiddenError,         // 403
  NotFoundError,          // 404
  MethodNotAllowedError,  // 405
  NotAcceptableError,     // 406
  RequestTimeoutError,    // 408
  ConflictError,          // 409
  GoneError,              // 410
  LengthRequiredError,    // 411
  PreconditionFailedError, // 412
  PayloadTooLargeError,   // 413
  UriTooLongError,        // 414
  UnsupportedMediaTypeError, // 415
  RangeNotSatisfiableError, // 416
  ExpectationFailedError, // 417
  ImATeapotError,         // 418
  UnprocessableEntityError, // 422
  LockedError,            // 423
  FailedDependencyError,  // 424
  TooEarlyError,          // 425
  UpgradeRequiredError,   // 426
  PreconditionRequiredError, // 428
  TooManyRequestsError,   // 429
  RequestHeaderFieldsTooLargeError, // 431
  UnavailableForLegalReasonsError,  // 451
} from '@nextrush/errors';
```

### 5xx Server Errors

```typescript
import {
  InternalServerError,    // 500
  NotImplementedError,    // 501
  BadGatewayError,        // 502
  ServiceUnavailableError, // 503
  GatewayTimeoutError,    // 504
  HttpVersionNotSupportedError, // 505
  VariantAlsoNegotiatesError,   // 506
  InsufficientStorageError,     // 507
  LoopDetectedError,      // 508
  NotExtendedError,       // 510
  NetworkAuthRequiredError, // 511
} from '@nextrush/errors';
```

## Usage Examples

### Basic Usage

```typescript
// Simple message
throw new NotFoundError('User not found');

// With error code
throw new BadRequestError('Invalid email format', {
  code: 'INVALID_EMAIL',
});

// With additional details
throw new UnprocessableEntityError('Validation failed', {
  code: 'VALIDATION_ERROR',
  details: {
    email: 'Invalid format',
    age: 'Must be positive',
  },
});
```

### With Error Codes

```typescript
throw new UnauthorizedError('Token expired', {
  code: 'TOKEN_EXPIRED',
  expose: true,
});

// API response:
// {
//   "error": "Token expired",
//   "code": "TOKEN_EXPIRED",
//   "status": 401
// }
```

## Factory Functions

Create errors with less boilerplate:

```typescript
import {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  methodNotAllowed,
  conflict,
  unprocessableEntity,
  tooManyRequests,
  internalError,
  serviceUnavailable,
  badGateway,
  gatewayTimeout,
  createError,
} from '@nextrush/errors';

// Quick creation
throw badRequest('Invalid input');
throw notFound('Resource not found');
throw unauthorized('Please login');

// With options
throw tooManyRequests('Rate limit exceeded', {
  code: 'RATE_LIMIT',
  details: { retryAfter: 60 },
});

// Custom status code
throw createError(418, "I'm a teapot");
```

## Validation Errors

Specialized errors for input validation:

```typescript
import {
  ValidationError,
  RequiredFieldError,
  TypeMismatchError,
  RangeError,
  LengthError,
  PatternError,
  InvalidEmailError,
  InvalidUrlError,
} from '@nextrush/errors';

// Generic validation error with issues
throw new ValidationError('Validation failed', {
  issues: [
    { field: 'email', message: 'Required', code: 'required' },
    { field: 'age', message: 'Must be positive', code: 'range' },
  ],
});

// Specific field errors
throw new RequiredFieldError('email');
throw new TypeMismatchError('age', 'number', 'string');
throw new RangeError('age', 18, 100);
throw new LengthError('password', 8, 128);
throw new PatternError('username', '^[a-z0-9]+$');
throw new InvalidEmailError('email');
throw new InvalidUrlError('website');
```

## Error Middleware

### errorHandler(options?)

Format errors as JSON responses:

```typescript
import { errorHandler } from '@nextrush/errors';

app.use(errorHandler({
  // Include stack trace (default: false in production)
  includeStack: process.env.NODE_ENV !== 'production',

  // Log errors (default: true)
  log: true,

  // Custom error logger
  logger: (err, ctx) => {
    myLogger.error(err, { path: ctx.path });
  },

  // Transform error response
  transform: (err) => ({
    error: err.message,
    code: err.code || 'UNKNOWN_ERROR',
    status: err.status,
  }),
}));
```

### notFoundHandler()

Catch-all 404 handler:

```typescript
import { notFoundHandler } from '@nextrush/errors';

// Add after all routes
app.use(notFoundHandler());

// Custom message
app.use(notFoundHandler('Route not found'));
```

### catchAsync(fn)

Wrap async handlers to catch errors:

```typescript
import { catchAsync } from '@nextrush/errors';

app.get('/users/:id', catchAsync(async (ctx) => {
  const user = await db.findUser(ctx.params.id);
  if (!user) throw new NotFoundError('User not found');
  ctx.json(user);
}));
```

## Error Utilities

```typescript
import {
  isHttpError,
  getErrorStatus,
  getSafeErrorMessage,
} from '@nextrush/errors';

// Check if error is HTTP error
if (isHttpError(err)) {
  console.log(err.status, err.code);
}

// Get status from any error
const status = getErrorStatus(err); // Returns 500 for unknown errors

// Get safe message (hides internal errors)
const message = getSafeErrorMessage(err);
// Returns generic message for 500 errors in production
```

## Base Classes

### HttpError

Base class for all HTTP errors:

```typescript
import { HttpError } from '@nextrush/errors';

class CustomError extends HttpError {
  constructor(message: string) {
    super(message, 422, 'CUSTOM_ERROR');
  }
}
```

### NextRushError

Base class for framework errors:

```typescript
import { NextRushError } from '@nextrush/errors';

class ConfigError extends NextRushError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}
```

## API Reference

### Exports

```typescript
import {
  // Base classes
  HttpError,
  NextRushError,

  // 4xx errors
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  // ... all 4xx errors

  // 5xx errors
  InternalServerError,
  ServiceUnavailableError,
  // ... all 5xx errors

  // Validation errors
  ValidationError,
  RequiredFieldError,
  TypeMismatchError,
  // ... all validation errors

  // Factory functions
  badRequest,
  unauthorized,
  notFound,
  createError,
  // ... all factory functions

  // Middleware
  errorHandler,
  notFoundHandler,
  catchAsync,

  // Utilities
  isHttpError,
  getErrorStatus,
  getSafeErrorMessage,
} from '@nextrush/errors';
```

### Types

```typescript
import type {
  HttpErrorOptions,
  ValidationIssue,
  ErrorContext,
  ErrorHandlerOptions,
  ErrorMiddleware,
} from '@nextrush/errors';

interface HttpErrorOptions {
  code?: string;
  expose?: boolean;
  details?: Record<string, unknown>;
}

interface ValidationIssue {
  field: string;
  message: string;
  code: string;
}
```

## Best Practices

1. **Use specific errors**: `NotFoundError` over generic `HttpError`
2. **Include error codes**: Help API consumers handle errors programmatically
3. **Don't expose internals**: Set `expose: false` for sensitive errors
4. **Log all errors**: Use the middleware's logging option
5. **Validate early**: Throw validation errors at the start of handlers

## License

MIT
