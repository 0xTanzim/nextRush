# HTTP Error Classes

> Type-safe error classes for all standard HTTP status codes.

## Overview

NextRush provides pre-built error classes for every common HTTP status code. Each class:

- Sets the correct status code automatically
- Provides a sensible default message
- Assigns a machine-readable error code
- Configures the `expose` flag appropriately (4xx: true, 5xx: false)

## 4xx Client Errors

Client errors indicate the request was malformed, unauthorized, or otherwise invalid. These errors are **exposed to clients by default** because they contain information the client needs to fix the request.

### Most Common

| Class | Status | Default Code | When to Use |
|-------|--------|--------------|-------------|
| `BadRequestError` | 400 | `BAD_REQUEST` | Invalid syntax, malformed JSON |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| `ForbiddenError` | 403 | `FORBIDDEN` | Authenticated but not permitted |
| `NotFoundError` | 404 | `NOT_FOUND` | Resource doesn't exist |
| `ConflictError` | 409 | `CONFLICT` | State conflict (duplicate, version mismatch) |
| `UnprocessableEntityError` | 422 | `UNPROCESSABLE_ENTITY` | Valid syntax but semantic errors |
| `TooManyRequestsError` | 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded |

### BadRequestError (400)

Invalid syntax or malformed request.

```typescript
import { BadRequestError } from '@nextrush/errors';

// Missing required field
throw new BadRequestError('Request body is required');

// Invalid JSON
throw new BadRequestError('Invalid JSON in request body');

// With error code
throw new BadRequestError('Invalid email format', {
  code: 'INVALID_EMAIL',
  details: { field: 'email', value: 'not-an-email' },
});
```

**Response:**
```json
{
  "error": "BadRequestError",
  "message": "Invalid email format",
  "code": "INVALID_EMAIL",
  "status": 400,
  "details": {
    "field": "email",
    "value": "not-an-email"
  }
}
```

### UnauthorizedError (401)

Authentication required or credentials invalid.

```typescript
import { UnauthorizedError } from '@nextrush/errors';

// Missing authentication
throw new UnauthorizedError('Authentication required');

// Invalid token
throw new UnauthorizedError('Invalid or expired token', {
  code: 'TOKEN_EXPIRED',
});

// Custom header hint
throw new UnauthorizedError('API key required', {
  code: 'API_KEY_REQUIRED',
  details: { header: 'X-API-Key' },
});
```

::: tip 401 vs 403
- **401 Unauthorized**: "Who are you?" - Authentication missing or invalid
- **403 Forbidden**: "I know who you are, but you can't do this" - Authenticated but not permitted
:::

### ForbiddenError (403)

Authenticated but not permitted to access the resource.

```typescript
import { ForbiddenError } from '@nextrush/errors';

// No permission
throw new ForbiddenError('You do not have permission to delete users');

// Role-based
throw new ForbiddenError('Admin access required', {
  code: 'ADMIN_REQUIRED',
  details: { requiredRole: 'admin', currentRole: 'user' },
});
```

### NotFoundError (404)

Resource does not exist.

```typescript
import { NotFoundError } from '@nextrush/errors';

// Simple not found
throw new NotFoundError('User not found');

// With resource type
throw new NotFoundError('Order not found', {
  code: 'ORDER_NOT_FOUND',
  details: { orderId: ctx.params.id },
});
```

### MethodNotAllowedError (405)

HTTP method not supported for this endpoint.

```typescript
import { MethodNotAllowedError } from '@nextrush/errors';

// Specify allowed methods
throw new MethodNotAllowedError(['GET', 'POST'], 'Method not allowed');

// Response includes allowed methods in details
```

**Response:**
```json
{
  "error": "MethodNotAllowedError",
  "message": "Method not allowed",
  "code": "METHOD_NOT_ALLOWED",
  "status": 405,
  "details": {
    "allowedMethods": ["GET", "POST"]
  }
}
```

### ConflictError (409)

Request conflicts with current state of the resource.

```typescript
import { ConflictError } from '@nextrush/errors';

// Duplicate resource
throw new ConflictError('Email already registered', {
  code: 'DUPLICATE_EMAIL',
});

// Optimistic locking
throw new ConflictError('Resource was modified by another request', {
  code: 'VERSION_CONFLICT',
  details: { expectedVersion: 5, actualVersion: 7 },
});
```

### UnprocessableEntityError (422)

Request is syntactically valid but contains semantic errors.

```typescript
import { UnprocessableEntityError } from '@nextrush/errors';

// Business rule violation
throw new UnprocessableEntityError('Cannot schedule meeting in the past', {
  code: 'INVALID_MEETING_TIME',
});

// Multiple field errors (consider ValidationError instead)
throw new UnprocessableEntityError('Validation failed', {
  details: {
    errors: [
      { field: 'startDate', message: 'Must be in the future' },
      { field: 'endDate', message: 'Must be after start date' },
    ],
  },
});
```

::: info 400 vs 422
- **400 Bad Request**: Syntactically invalid (malformed JSON, missing Content-Type)
- **422 Unprocessable Entity**: Syntactically valid but semantically wrong (invalid date range, business rule violation)
:::

### TooManyRequestsError (429)

Rate limit exceeded.

```typescript
import { TooManyRequestsError } from '@nextrush/errors';

// Basic rate limit
throw new TooManyRequestsError('Rate limit exceeded');

// With retry-after
throw new TooManyRequestsError('Too many requests, please try again later', {
  retryAfter: 60, // seconds
});
```

**Response:**
```json
{
  "error": "TooManyRequestsError",
  "message": "Too many requests, please try again later",
  "code": "TOO_MANY_REQUESTS",
  "status": 429,
  "details": {
    "retryAfter": 60
  }
}
```

### All 4xx Errors

<details>
<summary>Click to expand full list</summary>

| Class | Status | Code | Description |
|-------|--------|------|-------------|
| `BadRequestError` | 400 | `BAD_REQUEST` | Invalid syntax or malformed request |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | Authentication required |
| `PaymentRequiredError` | 402 | `PAYMENT_REQUIRED` | Payment needed |
| `ForbiddenError` | 403 | `FORBIDDEN` | Access denied |
| `NotFoundError` | 404 | `NOT_FOUND` | Resource not found |
| `MethodNotAllowedError` | 405 | `METHOD_NOT_ALLOWED` | HTTP method not supported |
| `NotAcceptableError` | 406 | `NOT_ACCEPTABLE` | Cannot produce acceptable response |
| `ProxyAuthRequiredError` | 407 | `PROXY_AUTH_REQUIRED` | Proxy authentication required |
| `RequestTimeoutError` | 408 | `REQUEST_TIMEOUT` | Client took too long |
| `ConflictError` | 409 | `CONFLICT` | State conflict |
| `GoneError` | 410 | `GONE` | Resource permanently deleted |
| `LengthRequiredError` | 411 | `LENGTH_REQUIRED` | Content-Length header required |
| `PreconditionFailedError` | 412 | `PRECONDITION_FAILED` | Precondition not met |
| `PayloadTooLargeError` | 413 | `PAYLOAD_TOO_LARGE` | Request body too large |
| `UriTooLongError` | 414 | `URI_TOO_LONG` | URI too long |
| `UnsupportedMediaTypeError` | 415 | `UNSUPPORTED_MEDIA_TYPE` | Content type not supported |
| `RangeNotSatisfiableError` | 416 | `RANGE_NOT_SATISFIABLE` | Cannot satisfy Range header |
| `ExpectationFailedError` | 417 | `EXPECTATION_FAILED` | Cannot meet Expect header |
| `ImATeapotError` | 418 | `IM_A_TEAPOT` | RFC 2324 |
| `UnprocessableEntityError` | 422 | `UNPROCESSABLE_ENTITY` | Semantic errors |
| `LockedError` | 423 | `LOCKED` | Resource is locked |
| `FailedDependencyError` | 424 | `FAILED_DEPENDENCY` | Dependent request failed |
| `TooEarlyError` | 425 | `TOO_EARLY` | Request replayed too early |
| `UpgradeRequiredError` | 426 | `UPGRADE_REQUIRED` | Client should upgrade |
| `PreconditionRequiredError` | 428 | `PRECONDITION_REQUIRED` | Conditional request required |
| `TooManyRequestsError` | 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded |
| `RequestHeaderFieldsTooLargeError` | 431 | `REQUEST_HEADER_FIELDS_TOO_LARGE` | Headers too large |
| `UnavailableForLegalReasonsError` | 451 | `UNAVAILABLE_FOR_LEGAL_REASONS` | Legal restriction |

</details>

## 5xx Server Errors

Server errors indicate something went wrong on the server. These errors are **NOT exposed to clients by default** because they may contain sensitive implementation details.

### Most Common

| Class | Status | Default Code | When to Use |
|-------|--------|--------------|-------------|
| `InternalServerError` | 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error |
| `BadGatewayError` | 502 | `BAD_GATEWAY` | Invalid upstream response |
| `ServiceUnavailableError` | 503 | `SERVICE_UNAVAILABLE` | Server temporarily unavailable |
| `GatewayTimeoutError` | 504 | `GATEWAY_TIMEOUT` | Upstream timeout |

### InternalServerError (500)

Generic server error for unexpected situations.

```typescript
import { InternalServerError } from '@nextrush/errors';

// Unexpected error (message hidden from client)
throw new InternalServerError('Redis connection failed');
// → Client sees: "Internal Server Error"
// → Server logs: "Redis connection failed" with stack trace

// With custom code for monitoring
throw new InternalServerError('Database query failed', {
  code: 'DB_ERROR',
  details: { query: 'SELECT * FROM users' }, // NOT exposed to client
});
```

::: danger Security Warning
Never expose internal error messages to clients. The `expose: false` default protects you, but be careful not to override it.
```typescript
// ❌ NEVER do this
throw new InternalServerError('PostgreSQL error: relation "users" does not exist', {
  expose: true, // Leaks database schema!
});
```
:::

### BadGatewayError (502)

Invalid response from upstream server.

```typescript
import { BadGatewayError } from '@nextrush/errors';

// Upstream returned invalid response
throw new BadGatewayError('Invalid response from payment service');

// With details for logging
throw new BadGatewayError('Upstream returned invalid JSON', {
  code: 'UPSTREAM_INVALID_RESPONSE',
  details: { service: 'payment-api', statusCode: 200, body: 'not-json' },
});
```

### ServiceUnavailableError (503)

Server temporarily unavailable (maintenance, overload).

```typescript
import { ServiceUnavailableError } from '@nextrush/errors';

// Maintenance mode
throw new ServiceUnavailableError('Service is under maintenance');

// With retry-after
throw new ServiceUnavailableError('Service temporarily unavailable', {
  retryAfter: 300, // 5 minutes
});
```

### GatewayTimeoutError (504)

Upstream server didn't respond in time.

```typescript
import { GatewayTimeoutError } from '@nextrush/errors';

throw new GatewayTimeoutError('Payment service did not respond');

throw new GatewayTimeoutError('Database query timeout', {
  code: 'DB_TIMEOUT',
  details: { timeout: 30000, query: 'complex-report' },
});
```

### All 5xx Errors

<details>
<summary>Click to expand full list</summary>

| Class | Status | Code | Description |
|-------|--------|------|-------------|
| `InternalServerError` | 500 | `INTERNAL_SERVER_ERROR` | Generic server error |
| `NotImplementedError` | 501 | `NOT_IMPLEMENTED` | Feature not implemented |
| `BadGatewayError` | 502 | `BAD_GATEWAY` | Invalid upstream response |
| `ServiceUnavailableError` | 503 | `SERVICE_UNAVAILABLE` | Server temporarily unavailable |
| `GatewayTimeoutError` | 504 | `GATEWAY_TIMEOUT` | Upstream timeout |
| `HttpVersionNotSupportedError` | 505 | `HTTP_VERSION_NOT_SUPPORTED` | HTTP version not supported |
| `VariantAlsoNegotiatesError` | 506 | `VARIANT_ALSO_NEGOTIATES` | Internal configuration error |
| `InsufficientStorageError` | 507 | `INSUFFICIENT_STORAGE` | Server storage full |
| `LoopDetectedError` | 508 | `LOOP_DETECTED` | Infinite loop detected |
| `NotExtendedError` | 510 | `NOT_EXTENDED` | Further extensions required |
| `NetworkAuthRequiredError` | 511 | `NETWORK_AUTH_REQUIRED` | Network authentication required |

</details>

## Custom Error Options

All error classes accept an options object:

```typescript
interface HttpErrorOptions {
  /** Custom error code (overrides default) */
  code?: string;

  /** Whether to expose message to client (default: true for 4xx, false for 5xx) */
  expose?: boolean;

  /** Additional details for the error response */
  details?: Record<string, unknown>;

  /** Original error that caused this error */
  cause?: Error;
}
```

### Example with All Options

```typescript
throw new BadRequestError('Validation failed', {
  code: 'VALIDATION_FAILED',
  expose: true,
  details: {
    fields: ['email', 'password'],
    hint: 'Check your input and try again',
  },
  cause: originalError,
});
```

## Creating Custom Errors

Extend `HttpError` for domain-specific errors:

```typescript
import { HttpError, type HttpErrorOptions } from '@nextrush/errors';

export class InsufficientCreditsError extends HttpError {
  readonly required: number;
  readonly available: number;

  constructor(required: number, available: number, options: HttpErrorOptions = {}) {
    super(402, `Insufficient credits: need ${required}, have ${available}`, {
      code: 'INSUFFICIENT_CREDITS',
      details: { required, available },
      ...options,
    });
    this.required = required;
    this.available = available;
  }
}

// Usage
throw new InsufficientCreditsError(100, 42);
```

## TypeScript Types

```typescript
import type { HttpErrorOptions } from '@nextrush/errors';

// All error classes accept HttpErrorOptions
const options: HttpErrorOptions = {
  code: 'CUSTOM_CODE',
  expose: true,
  details: { key: 'value' },
  cause: new Error('original'),
};
```

## See Also

- [Error Handling Overview](/packages/errors/) - Mental model and quick start
- [Validation Errors](/packages/errors/validation-errors) - Input validation errors
- [Error Middleware](/packages/errors/middleware) - Automatic error handling
- [Factory Functions](/packages/errors/factory-functions) - Quick error creation
