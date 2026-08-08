# NextRush Error Handling Reference

## Built-in Error Classes

All extend `HttpError` which extends `Error`.

```typescript
import {
  HttpError,
  BadRequestError,          // 400
  UnauthorizedError,        // 401
  ForbiddenError,           // 403
  NotFoundError,            // 404
  MethodNotAllowedError,    // 405
  ConflictError,            // 409
  UnprocessableEntityError, // 422
  TooManyRequestsError,     // 429
  InternalServerError,      // 500
  NotImplementedError,      // 501
  BadGatewayError,          // 502
  ServiceUnavailableError,  // 503
  GatewayTimeoutError,      // 504
  ValidationError,          // 400 (structured issues)
} from 'nextrush';
```

## HttpError Interface

```typescript
class HttpError extends Error {
  status: number;
  message: string;
  code?: string;          // machine-readable error code
  expose: boolean;        // true for 4xx, false for 5xx (safe to expose to client)
  headers?: Record<string, string>; // additional response headers
}
```

## createError() Factory

```typescript
import { createError } from 'nextrush';

throw createError(418, "I'm a teapot");
throw createError(400, 'Invalid input', { code: 'VALIDATION_ERROR' });
throw createError(429, 'Rate limit exceeded', {
  headers: { 'Retry-After': '60' },
  expose: true,
});
```

## Error Code Registry

```typescript
import { ERROR_CODES, codeForStatus } from 'nextrush';

codeForStatus(404);  // 'NOT_FOUND'
codeForStatus(500);  // 'INTERNAL_SERVER_ERROR'

// Built-in codes
ERROR_CODES.BAD_REQUEST        // 'BAD_REQUEST'
ERROR_CODES.UNAUTHORIZED       // 'UNAUTHORIZED'
ERROR_CODES.FORBIDDEN          // 'FORBIDDEN'
ERROR_CODES.NOT_FOUND          // 'NOT_FOUND'
// ... etc
```

## isHttpError() Guard

```typescript
import { isHttpError } from 'nextrush';

catch (err) {
  if (isHttpError(err)) {
    ctx.status = err.status;
    ctx.json({ error: err.message, code: err.code });
  } else {
    throw err;
  }
}
```

## Global errorHandler Middleware

```typescript
import { errorHandler } from 'nextrush';

// Must be first middleware registered
app.use(errorHandler({
  includeStack: process.env.NODE_ENV !== 'production',
  logErrors: true,
}));

// Produces JSON responses:
// 4xx → { error: "message", code: "ERROR_CODE" }
// 5xx → { error: "Internal Server Error" } (message hidden in production)
// 5xx + includeStack → { error: "message", code: "ERROR_CODE", stack: "..." }
```

## notFoundHandler

```typescript
import { notFoundHandler } from 'nextrush';

// Must be last — catches all unhandled paths
app.use(notFoundHandler());
// Returns 404 JSON: { error: "Not Found", code: "NOT_FOUND" }
```

## Custom Error Middleware Pattern

```typescript
// Custom error transformation
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (err instanceof ValidationError) {
      ctx.status = 400;
      ctx.json({
        error: 'Validation failed',
        issues: err.issues,    // structured ValidationIssue[]
      });
      return;
    }
    throw err; // re-throw to global errorHandler
  }
});

// Position: after errorHandler, before routes
```

## ValidationError (from @nextrush/validation)

```typescript
import { ValidationError } from 'nextrush';

try {
  validate(schema)(ctx, async () => {});
} catch (err) {
  if (err instanceof ValidationError) {
    err.issues  // structured ValidationIssue[] (non-empty)
    err.status  // 400
    err.code    // 'VALIDATION_ERROR'
  }
}
```

## Error Middleware Ordering

```
app.use(errorHandler())     // 1st — catches everything
app.use(customErrorMapper)  // 2nd — transforms specific errors
app.use(notFoundHandler())  // last — 404 for unmatched routes
```

`errorHandler` must be outermost because middleware executes top-to-bottom but errors propagate bottom-to-top. The error handler catches errors thrown from ALL downstream middleware and routes.

## Class-Based Exception Filters

```typescript
import { Catch, UseFilter, type ExceptionFilter } from 'nextrush/class';

// Define a filter
@Catch(NotFoundError)
class NotFoundFilter implements ExceptionFilter {
  catch(error: NotFoundError, ctx: Context) {
    ctx.status = 404;
    ctx.json({
      error: error.message,
      code: 'RESOURCE_NOT_FOUND',
      timestamp: new Date().toISOString(),
    });
  }
}

// Apply at method level
@Get('/:id')
@UseFilter(NotFoundFilter)
findById(@Param('id') id: string) { ... }

// Apply at controller level
@Controller('/users')
@UseFilter(NotFoundFilter)
class UserController { ... }
```
