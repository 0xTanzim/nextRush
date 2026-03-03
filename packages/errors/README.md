# @nextrush/errors

> Standardized HTTP error handling that eliminates response inconsistency and builds API client trust.

## The Problem

Every API returns errors differently. This creates chaos for both developers and API consumers:

**Inconsistent error responses** plague every backend project. One endpoint returns `{error: "..."}`, another returns `{message: "..."}`, and a third leaks stack traces in production. API clients can't reliably handle errors because there's no standard format.

**Internal errors leak to users.** A database connection timeout becomes `PostgreSQL connection failed on pool 'primary'` in the API response. Security researchers see your infrastructure. Users see confusing technical jargon instead of actionable messages.

**Manual error formatting is tedious.** Every route handler manually sets status codes, constructs JSON responses, and decides what to expose. Copy-paste error handling leads to bugs. Forgetting `try-catch` crashes the server.

**No programmatic error handling.** API clients resort to parsing error messages with regex because there are no stable error codes. A typo in an error message breaks production integrations.

## How NextRush Approaches This

NextRush treats **errors as API contracts**, not exceptions.

Every error has three responsibilities:

1. **HTTP status code** - Semantic meaning for browsers and clients
2. **Human message** - Clear explanation for developers/users
3. **Machine code** - Stable identifier for programmatic handling

The framework distinguishes between **client-safe errors** (4xx) and **server-internal errors** (5xx) with an `expose` flag. Client errors show detailed messages. Server errors hide implementation details by default.

All errors serialize to a consistent JSON format automatically. No manual response formatting. No leaked stack traces. No security risks.

## Mental Model

Think of errors as **structured API responses**, not crashes.

### Errors Are Contracts

```
User Request → Handler Logic → Error Thrown → Middleware Catches → JSON Response
```

When you throw `NotFoundError`, you're declaring an API contract:

- **Status:** 404 Not Found
- **Code:** `NOT_FOUND`
- **Message:** Custom message you provide
- **Format:** Consistent JSON structure

### The Expose Flag

Every error has an `expose` flag that acts as a **privacy boundary**:

```typescript
// Client errors (4xx): expose = true by default
throw new NotFoundError('User #123 not found');
// → Client sees: {"message": "User #123 not found", "code": "NOT_FOUND"}

// Server errors (5xx): expose = false by default
throw new InternalServerError('Redis connection timeout');
// → Client sees: {"message": "Internal Server Error", "code": "INTERNAL_ERROR"}
// → Server logs: Full error with stack trace
```

This prevents security leaks while maintaining debuggability.

## Installation

```bash
pnpm add @nextrush/errors
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { errorHandler, NotFoundError, BadRequestError } from '@nextrush/errors';

const app = createApp();

// Add error handling middleware FIRST
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
  ctx.json({ success: true });
});

// Request: GET /users/999
// Response: 404 Not Found
// {
//   "error": "NotFoundError",
//   "message": "User not found",
//   "code": "NOT_FOUND",
//   "status": 404
// }

// Request: POST /users (no email)
// Response: 400 Bad Request
// {
//   "error": "BadRequestError",
//   "message": "Email is required",
//   "code": "BAD_REQUEST",
//   "status": 400
// }
```

## What NextRush Does Automatically

When you throw an `HttpError` with error middleware enabled:

1. **Catches the error** - No uncaught exceptions crash your server
2. **Sets HTTP status** - Correct status code from error class
3. **Formats JSON response** - Consistent `{error, message, code, status}` structure
4. **Applies expose flag** - Hides sensitive 5xx details, shows 4xx details
5. **Logs appropriately** - 5xx logged as errors, 4xx as warnings
6. **Preserves stack traces** - Full debugging in development, hidden in production

You don't write error handling code. You **declare error states** and NextRush handles the rest.

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
  BadRequestError, // 400
  UnauthorizedError, // 401
  PaymentRequiredError, // 402
  ForbiddenError, // 403
  NotFoundError, // 404
  MethodNotAllowedError, // 405
  NotAcceptableError, // 406
  RequestTimeoutError, // 408
  ConflictError, // 409
  GoneError, // 410
  LengthRequiredError, // 411
  PreconditionFailedError, // 412
  PayloadTooLargeError, // 413
  UriTooLongError, // 414
  UnsupportedMediaTypeError, // 415
  RangeNotSatisfiableError, // 416
  ExpectationFailedError, // 417
  ImATeapotError, // 418
  UnprocessableEntityError, // 422
  LockedError, // 423
  FailedDependencyError, // 424
  TooEarlyError, // 425
  UpgradeRequiredError, // 426
  PreconditionRequiredError, // 428
  TooManyRequestsError, // 429
  RequestHeaderFieldsTooLargeError, // 431
  UnavailableForLegalReasonsError, // 451
} from '@nextrush/errors';
```

### 5xx Server Errors

```typescript
import {
  InternalServerError, // 500
  NotImplementedError, // 501
  BadGatewayError, // 502
  ServiceUnavailableError, // 503
  GatewayTimeoutError, // 504
  HttpVersionNotSupportedError, // 505
  VariantAlsoNegotiatesError, // 506
  InsufficientStorageError, // 507
  LoopDetectedError, // 508
  NotExtendedError, // 510
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
  RangeValidationError,
  LengthError,
  PatternError,
  InvalidEmailError,
  InvalidUrlError,
} from '@nextrush/errors';

// Generic validation error with issues
throw new ValidationError([
  { path: 'email', message: 'Required', rule: 'required' },
  { path: 'age', message: 'Must be positive', rule: 'range' },
]);

// Static factory methods
throw ValidationError.fromField('email', 'Invalid format', 'email');
throw ValidationError.fromFields({ email: 'Required', age: 'Must be number' });

// Specific field errors
throw new RequiredFieldError('email');
throw new TypeMismatchError('age', 'number', 'string');
throw new RangeValidationError('age', 18, 100);
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

app.use(
  errorHandler({
    // Include stack trace (default: false)
    includeStack: process.env.NODE_ENV !== 'production',

    // Custom error logger (default: logs 5xx as errors, 4xx as warnings)
    logger: (err, ctx) => {
      myLogger.error(err, { path: ctx.path });
    },

    // Custom error response transformer
    transform: (err, ctx) => ({
      error: err.message,
      status: ctx.status,
    }),
  })
);
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

app.get(
  '/users/:id',
  catchAsync(async (ctx) => {
    const user = await db.findUser(ctx.params.id);
    if (!user) throw new NotFoundError('User not found');
    ctx.json(user);
  })
);
```

## Error Utilities

```typescript
import { isHttpError, getErrorStatus, getSafeErrorMessage } from '@nextrush/errors';

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
    super(422, message, { code: 'CUSTOM_ERROR' });
  }
}
```

### NextRushError

Base class for framework errors:

```typescript
import { NextRushError } from '@nextrush/errors';

class ConfigError extends NextRushError {
  constructor(message: string) {
    super(message, { code: 'CONFIG_ERROR' });
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
  cause?: unknown;
}

interface ValidationIssue {
  path: string;
  message: string;
  rule?: string;
  expected?: unknown;
  received?: unknown;
}
```

````

## Common Mistakes

### Mistake 1: Using Generic Errors for Specific Cases

```typescript
// ❌ Don't do this
throw new Error('User not found');
// → Returns 500 Internal Server Error, no error code

// ✅ Do this instead
throw new NotFoundError('User not found');
// → Returns 404 Not Found with NOT_FOUND code
````

**Why it's wrong:** Generic JavaScript `Error` becomes 500 Internal Server Error. The client can't distinguish between "not found" and "server crash".

### Mistake 2: Exposing Internal Implementation Details

```typescript
// ❌ Don't do this
throw new InternalServerError('PostgreSQL connection timeout on pool "primary"', {
  expose: true, // Leaks infrastructure details!
});

// ✅ Do this instead
throw new InternalServerError('Database temporarily unavailable');
// expose defaults to false for 5xx errors
// Full error logged server-side for debugging
```

**Why it's wrong:** Exposing database names, connection pools, or internal service names helps attackers understand your infrastructure.

### Mistake 3: Forgetting Error Middleware

```typescript
// ❌ Errors won't be formatted
const app = createApp();

app.get('/users', (ctx) => {
  throw new NotFoundError('User not found'); // Crashes or returns HTML error page!
});

// ✅ Add errorHandler BEFORE routes
const app = createApp();
app.use(errorHandler()); // This catches and formats errors

app.get('/users', (ctx) => {
  throw new NotFoundError('User not found'); // Returns proper JSON
});
```

### Mistake 4: Using Errors for Control Flow

```typescript
// ❌ Don't use errors for expected business logic
async function getUser(id: string): Promise<User> {
  const user = await db.findUser(id);
  if (!user) throw new NotFoundError(); // Too expensive for expected case
  return user;
}

// ✅ Use nullable returns for expected cases
async function getUser(id: string): Promise<User | null> {
  return await db.findUser(id);
}

// ✅ Throw errors at the HTTP boundary
app.get('/users/:id', async (ctx) => {
  const user = await getUser(ctx.params.id);
  if (!user) throw new NotFoundError('User not found');
  ctx.json(user);
});
```

**Why it's wrong:** Throwing errors for control flow is expensive (stack trace construction) and makes code harder to reason about.

### Mistake 5: Missing Error Codes for API Clients

```typescript
// ❌ Clients can't handle errors programmatically
throw new BadRequestError('Invalid email format');
// Response: {"message": "Invalid email format"} // No code!

// ✅ Include error codes
throw new BadRequestError('Invalid email format', {
  code: 'INVALID_EMAIL',
});
// Response: {"message": "Invalid email format", "code": "INVALID_EMAIL"}

// Client can now:
if (error.code === 'INVALID_EMAIL') {
  // Show email field error
}
```

## When NOT to Use

### Don't Use for Validation in Reusable Libraries

If you're building a reusable library (not an HTTP handler), return validation results instead of throwing:

```typescript
// ❌ Don't throw in library code
export function validateEmail(email: string): string {
  if (!isValid(email)) throw new InvalidEmailError(); // Caller can't control behavior
  return email;
}

// ✅ Return validation result
export function validateEmail(email: string): { valid: boolean; error?: string } {
  return isValid(email) ? { valid: true } : { valid: false, error: 'Invalid email format' };
}

// ✅ Throw at the HTTP boundary
app.post('/users', (ctx) => {
  const result = validateEmail(ctx.body.email);
  if (!result.valid) {
    throw new BadRequestError(result.error!, { code: 'INVALID_EMAIL' });
  }
});
```

**Why:** Libraries should be composable. Throwing errors forces a specific error handling strategy on consumers.

### Don't Use for Expected Empty Results

```typescript
// ❌ Don't throw for queries that might return nothing
async function searchUsers(query: string): Promise<User[]> {
  const users = await db.search(query);
  if (users.length === 0) throw new NotFoundError(); // Expected case!
  return users;
}

// ✅ Return empty arrays for "no results"
async function searchUsers(query: string): Promise<User[]> {
  return await db.search(query); // Empty array is valid
}

// ✅ Only throw when the resource *should* exist
app.get('/users/:id', async (ctx) => {
  const user = await db.getById(ctx.params.id);
  if (!user) throw new NotFoundError(); // Specific ID should exist
  ctx.json(user);
});
```

### Don't Use for Non-HTTP Contexts

```typescript
// ❌ Don't use HTTP errors in background jobs
async function processQueue() {
  const job = await queue.pop();
  if (!job) throw new NotFoundError(); // Wrong abstraction!
}

// ✅ Use domain-specific errors or return values
async function processQueue() {
  const job = await queue.pop();
  if (!job) return { processed: false, reason: 'queue_empty' };
  // Process job...
  return { processed: true };
}
```

## Runtime Compatibility

Works on all NextRush-supported runtimes:

| Runtime             | Supported | Notes        |
| ------------------- | --------- | ------------ |
| Node.js 20+         | ✅        | Full support |
| Bun 1.0+            | ✅        | Full support |
| Deno 2.0+           | ✅        | Full support |
| Cloudflare Workers  | ✅        | Full support |
| Vercel Edge Runtime | ✅        | Full support |

**Zero external dependencies.** Uses only standard JavaScript `Error` APIs and NextRush types.

## Best Practices

1. **Use specific errors**: `NotFoundError` over generic `HttpError`
2. **Include error codes**: Help API consumers handle errors programmatically
3. **Don't expose internals**: Keep `expose: false` for 5xx errors (default)
4. **Add error middleware first**: Before all routes
5. **Validate early**: Throw validation errors at the start of handlers
6. **Return nulls for expected "not found"**: Throw errors only at HTTP boundaries

## License

MIT

```

```
