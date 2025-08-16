# Developer Experience System

Enhanced error handling and developer-friendly utilities for NextRush v2 applications with helpful warnings and debugging tools.

## What it is

The Developer Experience System provides enhanced error messages, development warnings, debugging utilities, and developer-friendly error handling to improve productivity and reduce debugging time during development.

## When to use

- Setting up development environment with helpful error messages
- Debugging application issues with enhanced error information
- Adding development warnings for common mistakes
- Creating production-ready error handling

## Core Components

### DevWarningSystem Class

Provides development-time warnings for common mistakes and performance issues.

```typescript
import { DevWarningSystem } from 'nextrush/dev-experience';

// Check middleware for common issues
DevWarningSystem.checkMiddleware(yourMiddleware);

// Check CORS configuration security
DevWarningSystem.checkCorsConfig({ origin: true });

// Check performance issues
DevWarningSystem.checkPerformance(ctx, responseTime);

// Check memory usage
DevWarningSystem.checkMemoryUsage();
```

**Static Methods:**

- `warnOnce(key: string, message: string): void` - Show warning once per process
- `checkMiddleware(middleware: Function): void` - Validate middleware patterns
- `checkCorsConfig(options: CorsOptions): void` - Check CORS security
- `checkPerformance(ctx: Context, responseTime: number): void` - Monitor performance
- `checkMemoryUsage(): void` - Monitor memory usage

### NextRushError Class

Enhanced error class with developer-friendly messages and suggestions.

```typescript
import { NextRushError } from 'nextrush/dev-experience';

const error = new NextRushError(
  'Database connection failed',
  'DB_CONNECTION_ERROR',
  500,
  [
    'Check database credentials',
    'Verify database server is running',
    'Check network connectivity',
  ]
);

// Get developer-friendly error message
console.log(error.toDeveloperString());
```

**Constructor Parameters:**

- `message: string` - Error message
- `code: string` - Error code for categorization
- `statusCode: number` - HTTP status code (default: 500)
- `suggestions: string[]` - Array of helpful suggestions
- `originalError?: Error` - Original error that caused this error

**Properties:**

- `code: string` - Error classification code
- `statusCode: number` - HTTP status code
- `suggestions: string[]` - Developer suggestions
- `originalError?: Error` - Wrapped original error

**Methods:**

- `toDeveloperString(): string` - Format error with suggestions for developers

## Specialized Error Classes

### MiddlewareError

Specific error handling for middleware issues.

```typescript
import { MiddlewareError } from 'nextrush/dev-experience';

try {
  // Middleware execution
} catch (error) {
  throw new MiddlewareError('Authentication failed', 'authMiddleware', error);
}
```

### RouteHandlerError

Specific error handling for route handler issues.

```typescript
import { RouteHandlerError } from 'nextrush/dev-experience';

app.get('/users/:id', async ctx => {
  try {
    const user = await getUserById(ctx.params.id);
    ctx.res.json(user);
  } catch (error) {
    throw new RouteHandlerError('/users/:id', 'GET', error);
  }
});
```

### DIError

Dependency injection specific error handling.

```typescript
import { DIError } from 'nextrush/dev-experience';

try {
  const service = container.resolve('UserService');
} catch (error) {
  throw new DIError('UserService', 'resolution', error);
}
```

### BodyParserError

Request body parsing error handling.

```typescript
import { BodyParserError } from 'nextrush/dev-experience';

try {
  const body = await parseRequestBody(ctx.req);
} catch (error) {
  throw new BodyParserError(ctx.get('content-type'), error);
}
```

### ContextError

Context property access error handling.

```typescript
import { ContextError } from 'nextrush/dev-experience';

// Safe property access with error handling
try {
  const value = getContextProperty(ctx, 'customProperty', defaultValue);
} catch (error) {
  if (error instanceof ContextError) {
    console.error('Context property error:', error.message);
  }
}
```

## Middleware Functions

### createErrorHandler()

Enhanced error handling middleware with development features.

```typescript
import { createErrorHandler } from 'nextrush/dev-experience';

const errorHandler = createErrorHandler({
  showStackTrace: process.env.NODE_ENV === 'development',
  logErrors: true,
  customErrorPages: {
    404: 'Not Found',
    500: 'Internal Server Error',
  },
});

app.use(errorHandler);
```

**Options:**

- `showStackTrace?: boolean` - Show stack traces in responses (default: development mode)
- `logErrors?: boolean` - Log errors to console (default: true)
- `customErrorPages?: Record<number, string>` - Custom error page templates

### createDevelopmentMiddleware()

Development-specific middleware for performance and memory monitoring.

```typescript
import { createDevelopmentMiddleware } from 'nextrush/dev-experience';

// Automatically disabled in production
const devMiddleware = createDevelopmentMiddleware();
app.use(devMiddleware);
```

**Features:**

- Response time monitoring with warnings
- Memory usage tracking
- Automatic performance alerts
- Development-only activation

## Utility Functions

### debugContext()

Context inspection utility for development debugging.

```typescript
import { debugContext } from 'nextrush/dev-experience';

app.use(async (ctx, next) => {
  // Debug context in development
  debugContext(ctx);
  await next();
});
```

**Output Example:**

```
🔍 Context Debug Info:
────────────────────────────────────────
Method: GET
Path: /users/123
Status: 200
Headers: { 'content-type': 'application/json' }
Query: { page: '1', limit: '10' }
Params: { id: '123' }
Body: undefined
State: { user: { id: 123, name: 'John' } }
────────────────────────────────────────
```

### getContextProperty()

Type-safe context property getter with helpful errors.

```typescript
import { getContextProperty } from 'nextrush/dev-experience';

// Safe property access
const user = getContextProperty<User>(ctx, 'user', defaultUser);

// With default value
const theme = getContextProperty(ctx, 'theme', 'light');
```

**Parameters:**

- `ctx: Context` - Request context
- `property: string` - Property name to access
- `defaultValue?: T` - Default value if property is undefined

**Returns:** `T` - Property value or default

**Throws:** `ContextError` - When property doesn't exist

### validateMiddleware()

Middleware validation utility with development warnings.

```typescript
import { validateMiddleware } from 'nextrush/dev-experience';

const middleware = async (ctx, next) => {
  await next();
};

// Validate middleware function
validateMiddleware(middleware);

// Use validated middleware
app.use(middleware);
```

**Validation Checks:**

- Function type validation
- Parameter count validation (must accept 2 parameters)
- Async function pattern checking
- Proper next() usage validation

## Complete Examples

### Production-Ready Error Handling

```typescript
// error-handling.ts
import { createApp } from 'nextrush';
import {
  createErrorHandler,
  createDevelopmentMiddleware,
  NextRushError,
} from 'nextrush/dev-experience';

const app = createApp();

// Development middleware (auto-disabled in production)
app.use(createDevelopmentMiddleware());

// Enhanced error handler
app.use(
  createErrorHandler({
    showStackTrace: process.env.NODE_ENV === 'development',
    logErrors: true,
  })
);

// Example route with proper error handling
app.get('/users/:id', async ctx => {
  try {
    const userId = ctx.params.id;

    if (!userId || !/^\d+$/.test(userId)) {
      throw new NextRushError(
        'Invalid user ID format',
        'INVALID_USER_ID',
        400,
        ['User ID must be a positive integer', 'Check the URL parameter format']
      );
    }

    const user = await findUserById(parseInt(userId));

    if (!user) {
      throw new NextRushError('User not found', 'USER_NOT_FOUND', 404, [
        'Check if user ID exists',
        'Verify user has not been deleted',
      ]);
    }

    ctx.res.json(user);
  } catch (error) {
    // Let error handler middleware catch and process
    throw error;
  }
});

export default app;
```

### Development Debugging Setup

```typescript
// debug-server.ts
import { createApp } from 'nextrush';
import {
  debugContext,
  DevWarningSystem,
  validateMiddleware,
} from 'nextrush/dev-experience';

const app = createApp();

// Custom debug middleware
const debugMiddleware = async (ctx, next) => {
  console.log(`🚀 Request: ${ctx.method} ${ctx.path}`);
  debugContext(ctx);

  const start = performance.now();
  await next();
  const duration = performance.now() - start;

  console.log(`✅ Response: ${ctx.status} (${duration.toFixed(2)}ms)`);

  // Check performance
  DevWarningSystem.checkPerformance(ctx, duration);
};

// Validate and use middleware
validateMiddleware(debugMiddleware);
app.use(debugMiddleware);

// Example routes for testing
app.get('/fast', async ctx => {
  ctx.res.json({ message: 'Fast response' });
});

app.get('/slow', async ctx => {
  // Simulate slow operation
  await new Promise(resolve => setTimeout(resolve, 200));
  ctx.res.json({ message: 'Slow response' });
});

app.listen(3000, () => {
  console.log('Debug server running on http://localhost:3000');
});
```

### Custom Error Classes

```typescript
// custom-errors.ts
import { NextRushError } from 'nextrush/dev-experience';

export class AuthenticationError extends NextRushError {
  constructor(message: string, originalError?: Error) {
    super(
      message,
      'AUTHENTICATION_ERROR',
      401,
      [
        'Check if user is logged in',
        'Verify authentication token',
        'Ensure token has not expired',
        'Check authentication middleware setup',
      ],
      originalError
    );
  }
}

export class AuthorizationError extends NextRushError {
  constructor(resource: string, action: string, originalError?: Error) {
    super(
      `Access denied for ${action} on ${resource}`,
      'AUTHORIZATION_ERROR',
      403,
      [
        'Check user permissions',
        'Verify role-based access control',
        'Ensure user has required privileges',
        'Review authorization middleware setup',
      ],
      originalError
    );
  }
}

export class ValidationError extends NextRushError {
  constructor(field: string, value: unknown, originalError?: Error) {
    super(
      `Validation failed for field: ${field}`,
      'VALIDATION_ERROR',
      400,
      [
        'Check input data format',
        'Verify required fields are provided',
        'Ensure data types match schema',
        'Review validation rules',
      ],
      originalError
    );
  }
}

// Usage example
app.post('/users', async ctx => {
  try {
    const userData = ctx.body;

    if (!userData.email) {
      throw new ValidationError('email', userData.email);
    }

    const user = await createUser(userData);
    ctx.res.json(user);
  } catch (error) {
    throw error; // Let error handler middleware process
  }
});
```

## Development Error Messages

### Common Error Messages

The system includes helpful error messages for common developer mistakes:

```typescript
// Middleware async warning
DEV_ERROR_MESSAGES.MIDDLEWARE_ASYNC;

// Context modification warning
DEV_ERROR_MESSAGES.CONTEXT_MODIFICATION;

// DI resolution guidance
DEV_ERROR_MESSAGES.DI_RESOLUTION_FAILED('ServiceName');

// Route handler guidance
DEV_ERROR_MESSAGES.ROUTE_HANDLER_ERROR;

// Body parser guidance
DEV_ERROR_MESSAGES.BODY_PARSER_ERROR;

// CORS security warning
DEV_ERROR_MESSAGES.CORS_CONFIGURATION;

// Performance warnings
DEV_ERROR_MESSAGES.PERFORMANCE_WARNING(responseTime);

// Memory warnings
DEV_ERROR_MESSAGES.MEMORY_WARNING(memoryUsage);
```

## Security Notes

- Error messages in production should not leak sensitive information
- Stack traces are automatically hidden in production mode
- Development warnings are disabled in production
- Custom error pages can be configured for production use

## Performance Notes

- Development middleware is automatically disabled in production
- Warning system uses efficient caching to show warnings only once
- Memory monitoring uses sampling to minimize performance impact
- Error handling adds minimal overhead in production mode

## See Also

- [Application API](./application.md) - Application setup and lifecycle
- [Middleware](./middleware.md) - Built-in middleware patterns
- [Context API](./context.md) - Request context documentation
- [Configuration & Validation](./configuration.md) - Configuration validation

## Version

- **Added in:** v2.0.0-alpha.1
- **Status:** Stable
