# Error Middleware

> Automatic error handling for your application.

## Overview

NextRush provides middleware for catching, logging, and responding to errors. Instead of wrapping every route handler in try-catch, you add error handling middleware once and let it handle all errors uniformly.

## The Problem

Without centralized error handling, you end up with:

```typescript
// ❌ Repetitive try-catch in every handler
app.get('/users/:id', async (ctx) => {
  try {
    const user = await db.users.findById(ctx.params.id);
    if (!user) {
      ctx.status = 404;
      ctx.json({ error: 'Not found' });
      return;
    }
    ctx.json(user);
  } catch (error) {
    console.error(error);
    ctx.status = 500;
    ctx.json({ error: 'Internal server error' });
  }
});

app.post('/users', async (ctx) => {
  try {
    // Same error handling repeated...
  } catch (error) {
    // ...
  }
});
```

With NextRush error middleware:

```typescript
// ✅ Handle errors once, throw everywhere
app.use(errorHandler());

app.get('/users/:id', async (ctx) => {
  const user = await db.users.findById(ctx.params.id);
  if (!user) throw new NotFoundError('User not found');
  ctx.json(user);
});

app.post('/users', async (ctx) => {
  // Just throw errors, middleware handles the rest
});
```

## errorHandler

The main error handling middleware. Add it early in your middleware stack to catch all errors.

### Basic Usage

```typescript
import { createApp } from '@nextrush/core';
import { errorHandler, NotFoundError } from '@nextrush/errors';

const app = createApp();

// Add error handler first
app.use(errorHandler());

// Your routes can now just throw errors
app.get('/users/:id', async (ctx) => {
  const user = await db.users.findById(ctx.params.id);
  if (!user) throw new NotFoundError('User not found');
  ctx.json(user);
});
```

### Options

```typescript
interface ErrorHandlerOptions {
  /** Include stack trace in response (default: false) */
  includeStack?: boolean;

  /** Custom error logger */
  logger?: (error: Error, ctx: ErrorContext) => void;

  /** Custom error response transformer */
  transform?: (error: Error, ctx: ErrorContext) => Record<string, unknown>;

  /** Custom handlers for specific error types */
  handlers?: Map<ErrorConstructor, (error: Error, ctx: ErrorContext) => void>;
}
```

### With Stack Traces (Development)

```typescript
app.use(errorHandler({
  includeStack: process.env.NODE_ENV !== 'production',
}));
```

**Development Response:**
```json
{
  "error": "NotFoundError",
  "message": "User not found",
  "code": "NOT_FOUND",
  "status": 404,
  "stack": [
    "NotFoundError: User not found",
    "at /app/routes/users.ts:15:11",
    "at async dispatch (/app/node_modules/@nextrush/core/dist/index.js:42:7)"
  ]
}
```

### Custom Logger

Replace the default console logger with your own:

```typescript
import { errorHandler } from '@nextrush/errors';
import { logger } from './logger'; // Your logging library

app.use(errorHandler({
  logger: (error, ctx) => {
    logger.error({
      error: error.name,
      message: error.message,
      stack: error.stack,
      method: ctx.method,
      path: ctx.path,
      requestId: ctx.state?.requestId,
    });
  },
}));
```

### Custom Response Transformer

Transform error responses to match your API format:

```typescript
app.use(errorHandler({
  transform: (error, ctx) => {
    // Custom error response format
    return {
      success: false,
      error: {
        type: error.name,
        message: error instanceof HttpError && error.expose
          ? error.message
          : 'An unexpected error occurred',
        code: error instanceof HttpError ? error.code : 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString(),
        requestId: ctx.state?.requestId,
      },
    };
  },
}));
```

**Custom Response:**
```json
{
  "success": false,
  "error": {
    "type": "NotFoundError",
    "message": "User not found",
    "code": "NOT_FOUND",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "requestId": "req-abc123"
  }
}
```

### Custom Error Type Handlers

Handle specific error types differently:

```typescript
import { errorHandler, ValidationError, UnauthorizedError } from '@nextrush/errors';

const handlers = new Map<new (...args: any[]) => Error, (error: Error, ctx: ErrorContext) => void>();

// Special handling for validation errors
handlers.set(ValidationError, (error, ctx) => {
  const validationError = error as ValidationError;
  ctx.status = 400;
  ctx.json({
    error: 'ValidationError',
    message: 'Validation failed',
    fields: validationError.toFlatObject(),
  });
});

// Special handling for auth errors - redirect to login
handlers.set(UnauthorizedError, (error, ctx) => {
  ctx.status = 401;
  ctx.json({
    error: 'Unauthorized',
    message: 'Please log in',
    loginUrl: '/auth/login',
  });
});

app.use(errorHandler({ handlers }));
```

## notFoundHandler

Handles requests that don't match any route. Add it at the **end** of your middleware chain.

### Basic Usage

```typescript
import { createApp } from '@nextrush/core';
import { errorHandler, notFoundHandler } from '@nextrush/errors';

const app = createApp();

// Error handler catches thrown errors
app.use(errorHandler());

// Your routes
app.get('/users', async (ctx) => { /* ... */ });
app.get('/posts', async (ctx) => { /* ... */ });

// Not found handler catches unmatched routes (add last)
app.use(notFoundHandler());
```

**Response for unmatched route:**
```json
{
  "error": "NotFoundError",
  "message": "Not Found",
  "code": "NOT_FOUND",
  "status": 404,
  "path": "/unknown-route"
}
```

### Custom Message

```typescript
app.use(notFoundHandler('The requested resource was not found'));
```

### Complete Example

```typescript
import { createApp } from '@nextrush/core';
import { createRouter } from '@nextrush/router';
import { errorHandler, notFoundHandler } from '@nextrush/errors';

const app = createApp();
const router = createRouter();

// 1. Error handler first
app.use(errorHandler({
  includeStack: process.env.NODE_ENV === 'development',
}));

// 2. Your middleware
app.use(cors());
app.use(json());

// 3. Your routes
router.get('/health', (ctx) => ctx.json({ status: 'ok' }));
router.get('/users', (ctx) => { /* ... */ });

app.use(router.routes());

// 4. Not found handler last
app.use(notFoundHandler());

app.listen(3000);
```

## catchAsync

A utility wrapper for route handlers that ensures async errors are caught. This is useful when you're not using the full error handler middleware or need explicit error catching.

### Why It Exists

In some cases, unhandled promise rejections in route handlers may not be caught by the error handler middleware. `catchAsync` ensures errors are properly propagated.

```typescript
import { catchAsync, NotFoundError } from '@nextrush/errors';

// Without catchAsync - unhandled rejections possible
router.get('/users/:id', async (ctx) => {
  const user = await db.users.findById(ctx.params.id); // If this rejects...
  ctx.json(user);
});

// With catchAsync - errors always propagate to error handler
router.get('/users/:id', catchAsync(async (ctx) => {
  const user = await db.users.findById(ctx.params.id);
  if (!user) throw new NotFoundError('User not found');
  ctx.json(user);
}));
```

### Type Safety

```typescript
import { catchAsync, type ErrorMiddleware } from '@nextrush/errors';

const getUserHandler: ErrorMiddleware = catchAsync(async (ctx) => {
  const user = await db.users.findById(ctx.params.id);
  ctx.json(user);
});
```

## ErrorContext Interface

The middleware uses a minimal context interface:

```typescript
interface ErrorContext {
  method: string;  // HTTP method (GET, POST, etc.)
  path: string;    // Request path
  status: number;  // Response status code (settable)
  json: (data: unknown) => void;  // Send JSON response
}
```

This interface is compatible with NextRush's full Context type, allowing the middleware to work without tight coupling.

## Best Practices

### 1. Order Matters

```typescript
// ✅ Correct order
app.use(errorHandler());     // First - catches all errors
app.use(cors());             // Security middleware
app.use(json());             // Body parsing
app.use(router.routes());    // Routes
app.use(notFoundHandler());  // Last - catches unmatched routes

// ❌ Wrong order
app.use(cors());
app.use(errorHandler());     // Won't catch cors errors!
```

### 2. Production vs Development

```typescript
const isDev = process.env.NODE_ENV !== 'production';

app.use(errorHandler({
  includeStack: isDev,
  logger: isDev
    ? (err, ctx) => console.error(err)
    : (err, ctx) => {
        // Production: structured logging, no stack to console
        productionLogger.error({
          error: err.name,
          message: err.message,
          method: ctx.method,
          path: ctx.path,
        });
      },
}));
```

### 3. Throw, Don't Return Errors

```typescript
// ✅ Good: Throw errors, let middleware handle them
app.get('/users/:id', async (ctx) => {
  const user = await db.users.findById(ctx.params.id);
  if (!user) throw new NotFoundError('User not found');
  ctx.json(user);
});

// ❌ Bad: Manual error handling in each route
app.get('/users/:id', async (ctx) => {
  try {
    const user = await db.users.findById(ctx.params.id);
    if (!user) {
      ctx.status = 404;
      ctx.json({ error: 'Not found' });
      return;
    }
    ctx.json(user);
  } catch (err) {
    ctx.status = 500;
    ctx.json({ error: 'Server error' });
  }
});
```

### 4. Use Appropriate Error Classes

```typescript
// ✅ Good: Specific error classes
if (!user) throw new NotFoundError('User not found');
if (!authorized) throw new ForbiddenError('Cannot delete other users');
if (!valid) throw new ValidationError([...]);

// ❌ Bad: Generic errors
if (!user) throw new Error('Not found');
```

## TypeScript Types

```typescript
import type {
  ErrorContext,
  ErrorMiddleware,
  ErrorHandlerOptions,
} from '@nextrush/errors';
```

## See Also

- [Error Handling Overview](/packages/errors/) - Mental model and quick start
- [HTTP Errors](/packages/errors/http-errors) - Status code errors
- [Validation Errors](/packages/errors/validation-errors) - Input validation
- [Factory Functions](/packages/errors/factory-functions) - Quick error creation
