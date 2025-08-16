# Error Handling API Reference

NextRush v2 provides a comprehensive error handling system with custom error types, middleware patterns, and production-ready error responses.

## What it is

Error handling in NextRush v2 manages exceptions, validation failures, HTTP errors, and application errors with type-safe error classes and middleware patterns.

## When to use

Use error handling for:

- HTTP status errors (404, 401, 500, etc.)
- Input validation failures
- Business logic errors
- Database and external service errors
- Security violations
- Rate limiting and throttling

## TypeScript signature

```typescript
type ErrorHandler = (error: Error, ctx: Context) => Promise<void> | void;

interface CustomError extends Error {
  statusCode: number;
  code: string;
  details?: any;
  isOperational: boolean;
}
```

---

# 🚨 Built-in Error Classes

NextRush v2 includes pre-built error classes for common HTTP scenarios.

---

## HttpError - Base HTTP error

**What it is**: Base class for all HTTP-related errors with status codes and structured responses.

**When to use**: Create custom HTTP errors with specific status codes and messages.

**Signature**:

```typescript
class HttpError extends Error {
  constructor(
    statusCode: number,
    message: string,
    code?: string,
    details?: any
  );

  statusCode: number;
  code: string;
  details?: any;
  isOperational: boolean;
}
```

**Example**:

```typescript
import { HttpError } from 'nextrush/errors';

// Custom HTTP error
throw new HttpError(429, 'Rate limit exceeded', 'RATE_LIMIT_ERROR', {
  limit: 100,
  windowMs: 15 * 60 * 1000,
  retryAfter: 900,
});

// Generic server error
throw new HttpError(500, 'Database connection failed', 'DB_CONNECTION_ERROR');

// Catch and handle
try {
  await riskyOperation();
} catch (error) {
  if (error instanceof HttpError) {
    ctx.res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
  }
}
```

---

## BadRequestError - 400 errors

**What it is**: Represents client-side request errors (malformed requests, invalid data).

**When to use**: Invalid request data, malformed JSON, missing required fields.

**Signature**:

```typescript
class BadRequestError extends HttpError {
  constructor(message: string, details?: any);
}
```

**Example**:

```typescript
import { BadRequestError } from 'nextrush/errors';

// Validation failure
if (!userData.email) {
  throw new BadRequestError('Email is required', {
    field: 'email',
    received: userData,
  });
}

// Invalid format
if (!/\S+@\S+\.\S+/.test(userData.email)) {
  throw new BadRequestError('Invalid email format', {
    field: 'email',
    value: userData.email,
  });
}

// JSON parsing error
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      throw new BadRequestError('Invalid JSON in request body', {
        originalError: error.message,
      });
    }
    throw error;
  }
});
```

---

## UnauthorizedError - 401 errors

**What it is**: Represents authentication failures and missing credentials.

**When to use**: Missing auth tokens, invalid credentials, expired sessions.

**Signature**:

```typescript
class UnauthorizedError extends HttpError {
  constructor(message: string, details?: any);
}
```

**Example**:

```typescript
import { UnauthorizedError } from 'nextrush/errors';

// Missing authentication
const token = ctx.headers.authorization?.replace('Bearer ', '');
if (!token) {
  throw new UnauthorizedError('Authentication token required', {
    hint: 'Include Authorization: Bearer <token> header',
  });
}

// Invalid token
try {
  const payload = jwt.verify(token, secret);
  ctx.state.user = payload;
} catch (error) {
  throw new UnauthorizedError('Invalid authentication token', {
    reason: error.message,
    action: 'Please login again',
  });
}

// Expired session
if (user.sessionExpiry < Date.now()) {
  throw new UnauthorizedError('Session expired', {
    expiredAt: new Date(user.sessionExpiry),
    action: 'Please login again',
  });
}
```

---

## ForbiddenError - 403 errors

**What it is**: Represents authorization failures (valid user, insufficient permissions).

**When to use**: Role-based access control, resource ownership, feature restrictions.

**Signature**:

```typescript
class ForbiddenError extends HttpError {
  constructor(message: string, details?: any);
}
```

**Example**:

```typescript
import { ForbiddenError } from 'nextrush/errors';

// Role-based access control
if (!user.roles.includes('admin')) {
  throw new ForbiddenError('Admin access required', {
    userRoles: user.roles,
    requiredRole: 'admin',
  });
}

// Resource ownership
const post = await getPost(postId);
if (post.authorId !== user.id && !user.roles.includes('moderator')) {
  throw new ForbiddenError("Cannot modify another user's post", {
    postId,
    authorId: post.authorId,
    userId: user.id,
  });
}

// Feature access
if (!user.subscription.features.includes('api_access')) {
  throw new ForbiddenError('API access not included in your plan', {
    currentPlan: user.subscription.plan,
    requiredFeature: 'api_access',
    upgradeUrl: '/upgrade',
  });
}
```

---

## NotFoundError - 404 errors

**What it is**: Represents missing resources or endpoints.

**When to use**: Missing database records, invalid URLs, deleted resources.

**Signature**:

```typescript
class NotFoundError extends HttpError {
  constructor(message: string, details?: any);
}
```

**Example**:

```typescript
import { NotFoundError } from 'nextrush/errors';

// Database record not found
const user = await db.user.findById(userId);
if (!user) {
  throw new NotFoundError('User not found', {
    userId,
    suggestions: ['Check user ID', 'User may have been deleted'],
  });
}

// API endpoint not found
app.all('*', async ctx => {
  throw new NotFoundError('Endpoint not found', {
    path: ctx.path,
    method: ctx.method,
    availableEndpoints: ['/api/users', '/api/posts', '/health'],
  });
});

// File not found
if (!fs.existsSync(filePath)) {
  throw new NotFoundError('File not found', {
    filePath,
    directory: path.dirname(filePath),
  });
}
```

---

## ConflictError - 409 errors

**What it is**: Represents resource conflicts and constraint violations.

**When to use**: Duplicate records, version conflicts, concurrent modifications.

**Signature**:

```typescript
class ConflictError extends HttpError {
  constructor(message: string, details?: any);
}
```

**Example**:

```typescript
import { ConflictError } from 'nextrush/errors';

// Duplicate email
const existingUser = await db.user.findByEmail(email);
if (existingUser) {
  throw new ConflictError('User with this email already exists', {
    email,
    existingUserId: existingUser.id,
    action: 'Use a different email or try logging in',
  });
}

// Version conflict
if (updateData.version !== currentResource.version) {
  throw new ConflictError('Resource has been modified by another user', {
    currentVersion: currentResource.version,
    providedVersion: updateData.version,
    action: 'Refresh and try again',
  });
}

// Concurrent modification
try {
  await db.inventory.update({
    where: { id: itemId, quantity: { gte: requestedQuantity } },
    data: { quantity: { decrement: requestedQuantity } },
  });
} catch (error) {
  throw new ConflictError('Insufficient inventory', {
    itemId,
    requestedQuantity,
    action: 'Check availability and try again',
  });
}
```

---

## UnprocessableEntityError - 422 errors

**What it is**: Represents semantic validation errors (valid format, invalid business logic).

**When to use**: Business rule violations, schema validation failures, logical conflicts.

**Signature**:

```typescript
class UnprocessableEntityError extends HttpError {
  constructor(message: string, details?: any);
}
```

**Example**:

```typescript
import { UnprocessableEntityError } from 'nextrush/errors';

// Business rule violation
if (transferAmount > account.balance) {
  throw new UnprocessableEntityError('Insufficient funds', {
    requestedAmount: transferAmount,
    availableBalance: account.balance,
    accountId: account.id,
  });
}

// Date logic error
if (new Date(endDate) <= new Date(startDate)) {
  throw new UnprocessableEntityError('End date must be after start date', {
    startDate,
    endDate,
    field: 'endDate',
  });
}

// Schema validation with Zod
import { z } from 'zod';

const schema = z.object({
  age: z.number().min(18),
  email: z.string().email(),
});

try {
  schema.parse(userData);
} catch (error) {
  throw new UnprocessableEntityError('Validation failed', {
    errors: error.errors,
    receivedData: userData,
  });
}
```

---

## TooManyRequestsError - 429 errors

**What it is**: Represents rate limiting and throttling violations.

**When to use**: API rate limits, request throttling, abuse prevention.

**Signature**:

```typescript
class TooManyRequestsError extends HttpError {
  constructor(message: string, details?: any);
}
```

**Example**:

```typescript
import { TooManyRequestsError } from 'nextrush/errors';

// Rate limit exceeded
const limit = 100;
const windowMs = 15 * 60 * 1000; // 15 minutes
const requests = await getRequestCount(ctx.ip, windowMs);

if (requests >= limit) {
  const resetTime = Date.now() + windowMs;
  throw new TooManyRequestsError('Rate limit exceeded', {
    limit,
    windowMs,
    requests,
    resetTime,
    retryAfter: Math.ceil(windowMs / 1000),
  });
}

// API quota exceeded
if (user.apiCallsThisMonth >= user.plan.monthlyApiLimit) {
  throw new TooManyRequestsError('Monthly API quota exceeded', {
    used: user.apiCallsThisMonth,
    limit: user.plan.monthlyApiLimit,
    resetDate: user.plan.quotaResetDate,
    upgradeUrl: '/upgrade',
  });
}
```

---

## InternalServerError - 500 errors

**What it is**: Represents unexpected server errors and system failures.

**When to use**: Database errors, external service failures, unexpected exceptions.

**Signature**:

```typescript
class InternalServerError extends HttpError {
  constructor(message: string, details?: any);
}
```

**Example**:

```typescript
import { InternalServerError } from 'nextrush/errors';

// Database connection error
try {
  await db.connect();
} catch (error) {
  throw new InternalServerError('Database connection failed', {
    error: error.message,
    timestamp: new Date().toISOString(),
    action: 'Please try again later',
  });
}

// External service error
try {
  const response = await fetch('https://api.external.com/data');
  if (!response.ok) {
    throw new InternalServerError('External service unavailable', {
      service: 'external-api',
      status: response.status,
      statusText: response.statusText,
    });
  }
} catch (error) {
  throw new InternalServerError('Failed to fetch external data', {
    service: 'external-api',
    error: error.message,
  });
}

// Unexpected error wrapping
try {
  await complexOperation();
} catch (error) {
  // Log the original error for debugging
  console.error('Unexpected error:', error);

  throw new InternalServerError('Operation failed', {
    requestId: ctx.requestId,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      originalError: error.message,
      stack: error.stack,
    }),
  });
}
```

---

# 🛠️ Error Middleware

## Global error handler

**What it is**: Middleware that catches all unhandled errors and formats responses.

**When to use**: Provide consistent error responses and prevent application crashes.

**Example**:

```typescript
import type { Context, Middleware } from 'nextrush/types';
import { HttpError } from 'nextrush/errors';

const globalErrorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    // Log error for debugging
    console.error('Request failed:', {
      error: error.message,
      stack: error.stack,
      requestId: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      ip: ctx.ip,
      userAgent: ctx.headers['user-agent'],
    });

    // Handle known HTTP errors
    if (error instanceof HttpError) {
      ctx.res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error.details,
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Handle validation errors (Zod, Joi, etc.)
    if (error.name === 'ZodError') {
      ctx.res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors,
        requestId: ctx.requestId,
      });
      return;
    }

    // Handle database errors
    if (error.code === 'P2002') {
      // Prisma unique constraint
      ctx.res.status(409).json({
        error: 'Resource already exists',
        code: 'DUPLICATE_RESOURCE',
        requestId: ctx.requestId,
      });
      return;
    }

    // Handle unexpected errors
    ctx.res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      requestId: ctx.requestId,
      timestamp: new Date().toISOString(),
      // Only include details in development
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message,
        stack: error.stack,
      }),
    });
  }
};

// Install as first middleware
app.use(globalErrorHandler);
```

## Async error wrapper

**What it is**: Utility to automatically catch async errors in route handlers.

**When to use**: Simplify error handling in async route handlers.

**Example**:

```typescript
import type { RouteHandler } from 'nextrush/types';

// Async wrapper utility
function asyncHandler(handler: RouteHandler): RouteHandler {
  return async (ctx, next) => {
    try {
      await handler(ctx, next);
    } catch (error) {
      // Pass error to global error handler
      throw error;
    }
  };
}

// Usage in routes
app.get(
  '/users/:id',
  asyncHandler(async ctx => {
    const user = await getUserById(ctx.params.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    ctx.json(user);
  })
);

// Or create a decorator
function handleAsync(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;
  descriptor.value = asyncHandler(originalMethod);
  return descriptor;
}

class UserController {
  @handleAsync
  async getUser(ctx: Context) {
    const user = await getUserById(ctx.params.id);
    ctx.json(user);
  }
}
```

## Validation error handler

**What it is**: Specialized middleware for handling input validation errors.

**When to use**: Provide detailed validation error responses with field-level details.

**Example**:

```typescript
import { z } from 'zod';

function validateRequest<T>(schema: z.ZodSchema<T>) {
  return async (ctx: Context, next: () => Promise<void>) => {
    try {
      const validatedData = schema.parse(ctx.body);
      ctx.body = validatedData;
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new UnprocessableEntityError('Validation failed', {
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            received: err.received,
          })),
          summary: `${error.errors.length} validation error(s)`,
        });
      }
      throw error;
    }
  };
}

// Usage
const CreateUserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().min(18).max(120),
});

app.post('/users', validateRequest(CreateUserSchema), async ctx => {
  const userData = ctx.body as z.infer<typeof CreateUserSchema>;
  const user = await createUser(userData);
  ctx.json(user, 201);
});
```

---

# 🔧 Error Utilities

## Error factory functions

**What it is**: Utility functions to create common error patterns.

**When to use**: Standardize error creation across your application.

**Example**:

```typescript
// Error factory utilities
export const ErrorFactory = {
  notFound: (resource: string, id: string) =>
    new NotFoundError(`${resource} not found`, { id, resource }),

  unauthorized: (reason: string) =>
    new UnauthorizedError('Authentication failed', { reason }),

  forbidden: (action: string, resource: string) =>
    new ForbiddenError(`Cannot ${action} ${resource}`, { action, resource }),

  validation: (field: string, value: any, rule: string) =>
    new UnprocessableEntityError(`Invalid ${field}`, { field, value, rule }),

  conflict: (resource: string, constraint: string) =>
    new ConflictError(`${resource} conflict`, { resource, constraint }),

  rateLimit: (limit: number, window: number) =>
    new TooManyRequestsError('Rate limit exceeded', { limit, window }),
};

// Usage
const user = await db.user.findById(id);
if (!user) {
  throw ErrorFactory.notFound('User', id);
}

if (!user.roles.includes('admin')) {
  throw ErrorFactory.forbidden('delete', 'user');
}
```

## Error assertion functions

**What it is**: Assertion utilities that throw errors when conditions aren't met.

**When to use**: Guard clauses and precondition checking.

**Example**:

```typescript
// Assertion utilities
export const assert = {
  exists: <T>(value: T | null | undefined, message: string): T => {
    if (value == null) {
      throw new NotFoundError(message);
    }
    return value;
  },

  authorized: (condition: boolean, message: string) => {
    if (!condition) {
      throw new ForbiddenError(message);
    }
  },

  valid: (condition: boolean, message: string, details?: any) => {
    if (!condition) {
      throw new UnprocessableEntityError(message, details);
    }
  },

  authenticated: (user: any) => {
    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }
  },
};

// Usage
app.get('/users/:id', async ctx => {
  assert.authenticated(ctx.state.user);

  const user = assert.exists(
    await getUserById(ctx.params.id),
    'User not found'
  );

  assert.authorized(
    ctx.state.user.id === user.id || ctx.state.user.roles.includes('admin'),
    "Cannot access other user's data"
  );

  ctx.json(user);
});
```

---

# 🎯 Complete Error Handling Example

```typescript
import { createApp } from 'nextrush';
import {
  HttpError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
  TooManyRequestsError,
  InternalServerError,
} from 'nextrush/errors';
import { z } from 'zod';
import type { Context, Middleware } from 'nextrush/types';

const app = createApp();

// Global error handler (must be first)
const errorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    // Structured error logging
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      requestId: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      ip: ctx.ip,
      userAgent: ctx.headers['user-agent'],
      timestamp: new Date().toISOString(),
    };

    // Log error based on severity
    if (error instanceof HttpError && error.statusCode < 500) {
      console.warn('Client error:', errorInfo);
    } else {
      console.error('Server error:', errorInfo);
    }

    // Format error response
    if (error instanceof HttpError) {
      ctx.res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
        meta: {
          requestId: ctx.requestId,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Handle specific error types
    if (error.name === 'ZodError') {
      ctx.res.status(422).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.errors,
        },
        meta: {
          requestId: ctx.requestId,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Database errors
    if (error.code === 'P2002') {
      ctx.res.status(409).json({
        success: false,
        error: {
          message: 'Resource already exists',
          code: 'DUPLICATE_RESOURCE',
        },
        meta: {
          requestId: ctx.requestId,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Unexpected errors
    ctx.res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      meta: {
        requestId: ctx.requestId,
        timestamp: new Date().toISOString(),
      },
      // Development details
      ...(process.env.NODE_ENV === 'development' && {
        debug: {
          message: error.message,
          stack: error.stack,
        },
      }),
    });
  }
};

app.use(errorHandler);

// Validation middleware
function validate<T>(schema: z.ZodSchema<T>) {
  return async (ctx: Context, next: () => Promise<void>) => {
    try {
      ctx.body = schema.parse(ctx.body);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new UnprocessableEntityError('Validation failed', {
          errors: error.errors,
          received: ctx.body,
        });
      }
      throw error;
    }
  };
}

// Authentication middleware
const authenticate: Middleware = async (ctx, next) => {
  const token = ctx.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new UnauthorizedError('Authentication token required', {
      hint: 'Include Authorization: Bearer <token> header',
    });
  }

  try {
    const user = await validateToken(token);
    if (!user) {
      throw new UnauthorizedError('Invalid authentication token');
    }
    ctx.state.user = user;
    await next();
  } catch (error) {
    if (error instanceof JsonWebTokenError) {
      throw new UnauthorizedError('Invalid token format', {
        reason: error.message,
      });
    }
    throw error;
  }
};

// Authorization middleware
function requireRole(role: string): Middleware {
  return async (ctx, next) => {
    if (!ctx.state.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!ctx.state.user.roles.includes(role)) {
      throw new ForbiddenError(`${role} role required`, {
        userRoles: ctx.state.user.roles,
        requiredRole: role,
      });
    }

    await next();
  };
}

// Rate limiting middleware
const rateLimit = new Map<string, { count: number; resetTime: number }>();

const rateLimiter: Middleware = async (ctx, next) => {
  const key = ctx.ip;
  const limit = 100;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const now = Date.now();

  const record = rateLimit.get(key);

  if (!record || now > record.resetTime) {
    rateLimit.set(key, { count: 1, resetTime: now + windowMs });
    await next();
    return;
  }

  if (record.count >= limit) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    throw new TooManyRequestsError('Rate limit exceeded', {
      limit,
      windowMs,
      retryAfter,
      resetTime: record.resetTime,
    });
  }

  record.count++;
  await next();
};

// Schema definitions
const CreateUserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['user', 'admin']).optional(),
});

const UpdateUserSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
});

// Routes with comprehensive error handling
app.use(rateLimiter);

// Public routes
app.post('/auth/register', validate(CreateUserSchema), async ctx => {
  const userData = ctx.body as z.infer<typeof CreateUserSchema>;

  // Check for existing user
  const existingUser = await db.user.findByEmail(userData.email);
  if (existingUser) {
    throw new ConflictError('User already exists', {
      email: userData.email,
      suggestion: 'Try logging in or use password reset',
    });
  }

  try {
    const user = await db.user.create(userData);
    const token = generateToken(user);

    ctx.json(
      {
        success: true,
        data: { user, token },
        meta: { requestId: ctx.requestId },
      },
      201
    );
  } catch (error) {
    throw new InternalServerError('Failed to create user', {
      error: error.message,
    });
  }
});

// Protected routes
app.use('/api', authenticate);

app.get('/api/users/:id', async ctx => {
  const { id } = ctx.params;

  const user = await db.user.findById(id);
  if (!user) {
    throw new NotFoundError('User not found', {
      userId: id,
      suggestion: 'Check the user ID',
    });
  }

  // Authorization check
  if (
    ctx.state.user.id !== user.id &&
    !ctx.state.user.roles.includes('admin')
  ) {
    throw new ForbiddenError("Cannot access other user's profile", {
      requestedUserId: id,
      currentUserId: ctx.state.user.id,
    });
  }

  ctx.json({
    success: true,
    data: { user },
    meta: { requestId: ctx.requestId },
  });
});

app.patch('/api/users/:id', validate(UpdateUserSchema), async ctx => {
  const { id } = ctx.params;
  const updateData = ctx.body as z.infer<typeof UpdateUserSchema>;

  const user = await db.user.findById(id);
  if (!user) {
    throw new NotFoundError('User not found', { userId: id });
  }

  // Authorization
  if (
    ctx.state.user.id !== user.id &&
    !ctx.state.user.roles.includes('admin')
  ) {
    throw new ForbiddenError("Cannot modify other user's profile");
  }

  // Email uniqueness check
  if (updateData.email && updateData.email !== user.email) {
    const emailExists = await db.user.findByEmail(updateData.email);
    if (emailExists) {
      throw new ConflictError('Email already in use', {
        email: updateData.email,
      });
    }
  }

  try {
    const updatedUser = await db.user.update(id, updateData);
    ctx.json({
      success: true,
      data: { user: updatedUser },
      meta: { requestId: ctx.requestId },
    });
  } catch (error) {
    throw new InternalServerError('Failed to update user', {
      userId: id,
      error: error.message,
    });
  }
});

// Admin routes
app.use('/admin', requireRole('admin'));

app.delete('/admin/users/:id', async ctx => {
  const { id } = ctx.params;

  const user = await db.user.findById(id);
  if (!user) {
    throw new NotFoundError('User not found', { userId: id });
  }

  // Prevent self-deletion
  if (ctx.state.user.id === user.id) {
    throw new UnprocessableEntityError('Cannot delete your own account', {
      suggestion: 'Ask another admin to delete your account',
    });
  }

  try {
    await db.user.delete(id);
    ctx.res.status(204);
  } catch (error) {
    throw new InternalServerError('Failed to delete user', {
      userId: id,
      error: error.message,
    });
  }
});

// 404 handler (should be last)
app.all('*', async ctx => {
  throw new NotFoundError('Endpoint not found', {
    method: ctx.method,
    path: ctx.path,
    availableEndpoints: [
      'POST /auth/register',
      'GET /api/users/:id',
      'PATCH /api/users/:id',
      'DELETE /admin/users/:id',
    ],
  });
});

app.listen(3000, () => {
  console.log(
    '🚀 Server with comprehensive error handling running on port 3000'
  );
});

export default app;
```

---

## Performance notes

- Error handling middleware should be the first middleware
- Use specific error types instead of generic `HttpError`
- Log errors appropriately based on severity level
- Avoid exposing sensitive information in error responses

## Security notes

- Never expose internal error details in production
- Use different error messages for development vs production
- Implement rate limiting to prevent error-based attacks
- Log security-related errors for monitoring

## See also

- [Context API](./context.md) - Error handling in context
- [Middleware guide](./middleware.md) - Error middleware patterns
- [Application API](./application.md) - Global error configuration
- [Validation guide](../guides/validation.md) - Input validation patterns

---

_Added in v2.0.0-alpha.1_
