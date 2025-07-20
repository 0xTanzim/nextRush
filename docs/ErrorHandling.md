# ⚠️ Error Handling - Optimized & Enterprise-Ready

## 📚 Table of Contents

- [⚠️ Error Handling - Optimized & Enterprise-Ready](#️-error-handling---optimized--enterprise-ready)
  - [📚 Table of Contents](#-table-of-contents)
  - [� Introduction](#-introduction)
  - [⚡ Performance Features](#-performance-features)
  - [🔧 Public APIs](#-public-apis)
    - [⚠️ Base Error Class](#️-base-error-class)
      - [NextRushError Properties](#nextrusherror-properties)
      - [NextRushError Methods](#nextrusherror-methods)
    - [📊 Error Classification](#-error-classification)
    - [🎯 Specific Error Classes](#-specific-error-classes)
    - [🛠️ Error Handler Class](#️-error-handler-class)
      - [ErrorHandler Methods](#errorhandler-methods)
    - [⚙️ Configuration Interfaces](#️-configuration-interfaces)
      - [ErrorHandlerConfig Properties](#errorhandlerconfig-properties)
  - [💻 Usage Examples](#-usage-examples)
    - [Creating Custom Errors](#creating-custom-errors)
    - [Using Error Handler](#using-error-handler)
    - [Error Handling in Routes](#error-handling-in-routes)
    - [Custom Error Classes](#custom-error-classes)
    - [Error Response Format](#error-response-format)
  - [⚙️ Configuration Options](#️-configuration-options)
    - [ErrorHandlerConfig](#errorhandlerconfig)
    - [Environment-Based Configuration](#environment-based-configuration)
  - [📝 Best Practices](#-best-practices)
  - [📝 Notes](#-notes)

## � Introduction

The NextRush framework provides a **high-performance, memory-optimized error handling system** with enterprise-grade features including custom error classes, centralized error handling, structured error responses, and advanced error classification. The system is designed for **zero memory leaks**, **millisecond-level performance**, and **production-ready scalability**.

## ⚡ Performance Features

- **🚀 Object Pooling**: Reuses error objects to minimize GC pressure
- **⚡ Memory Optimization**: Zero memory leaks with smart cleanup
- **📊 Error Classification**: Severity levels and categories for better organization
- **🔄 Retry Logic**: Built-in retry capability for transient errors
- **📈 Metrics Integration**: Performance monitoring and error tracking
- **🛡️ Security**: Production-safe error sanitization

## 🔧 Public APIs

### ⚠️ Base Error Class

| Class           | Extends | Description                                                                           |
| --------------- | ------- | ------------------------------------------------------------------------------------- |
| `NextRushError` | `Error` | Abstract base class for all framework-specific errors with performance optimizations. |

#### NextRushError Properties

| Property        | Type                                | Description                                                  |
| --------------- | ----------------------------------- | ------------------------------------------------------------ |
| `code`          | `string`                            | Unique error code identifier.                                |
| `statusCode`    | `number`                            | HTTP status code associated with the error.                  |
| `details`       | `Readonly<Record<string, unknown>>` | Additional error details and context (immutable).            |
| `timestamp`     | `number`                            | High-precision timestamp when error was created.             |
| `severity`      | `ErrorSeverity`                     | Error severity level (LOW, MEDIUM, HIGH, CRITICAL).          |
| `category`      | `ErrorCategory`                     | Error category for better organization.                      |
| `correlationId` | `string \| undefined`               | Unique identifier for request tracing.                       |
| `retryable`     | `boolean`                           | Whether the operation that caused this error can be retried. |

#### NextRushError Methods

| Method          | Signature             | Description                                     |
| --------------- | --------------------- | ----------------------------------------------- |
| `toJSON()`      | `() => object`        | Serializes the error to a JSON object.          |
| `isRetryable()` | `() => boolean`       | Returns whether the error is retryable.         |
| `clone()`       | `() => NextRushError` | Creates a copy of the error (memory optimized). |

### 📊 Error Classification

The NextRush error system includes advanced classification for better error handling:

#### Error Severity Levels

| Severity   | Description                                        | Use Case                          |
| ---------- | -------------------------------------------------- | --------------------------------- |
| `LOW`      | Minor issues that don't affect core functionality  | Deprecated API usage, warnings    |
| `MEDIUM`   | Issues that affect user experience                 | Validation errors, missing data   |
| `HIGH`     | Serious issues that affect application stability   | Database connection issues        |
| `CRITICAL` | Critical failures that require immediate attention | System crashes, security breaches |

#### Error Categories

| Category           | Description                   | Examples                            |
| ------------------ | ----------------------------- | ----------------------------------- |
| `VALIDATION`       | Input validation failures     | Invalid email, missing fields       |
| `AUTHENTICATION`   | Authentication-related errors | Invalid credentials, expired tokens |
| `AUTHORIZATION`    | Permission and access errors  | Insufficient permissions            |
| `NETWORK`          | Network-related issues        | Connection timeouts, DNS failures   |
| `DATABASE`         | Database operation failures   | Query errors, connection issues     |
| `FILESYSTEM`       | File system operations        | File not found, permission denied   |
| `BUSINESS_LOGIC`   | Application logic errors      | Business rule violations            |
| `SYSTEM`           | System-level errors           | Memory issues, CPU overload         |
| `EXTERNAL_SERVICE` | Third-party service failures  | API rate limits, service downtime   |

### 🎯 Specific Error Classes

| Class                       | Status Code | Error Code               | Description                          |
| --------------------------- | ----------- | ------------------------ | ------------------------------------ |
| `ValidationError`           | 400         | `VALIDATION_ERROR`       | Input validation failures.           |
| `AuthenticationError`       | 401         | `AUTHENTICATION_ERROR`   | Authentication failures.             |
| `AuthorizationError`        | 403         | `AUTHORIZATION_ERROR`    | Permission denied errors.            |
| `NotFoundError`             | 404         | `NOT_FOUND`              | Resource not found errors.           |
| `MethodNotAllowedError`     | 405         | `METHOD_NOT_ALLOWED`     | HTTP method not supported for route. |
| `RequestTimeoutError`       | 408         | `REQUEST_TIMEOUT`        | Request exceeded timeout limit.      |
| `ConflictError`             | 409         | `CONFLICT_ERROR`         | Resource conflict errors.            |
| `PayloadTooLargeError`      | 413         | `PAYLOAD_TOO_LARGE`      | Request payload exceeds size limit.  |
| `UnsupportedMediaTypeError` | 415         | `UNSUPPORTED_MEDIA_TYPE` | Content-Type not supported.          |
| `RateLimitError`            | 429         | `RATE_LIMIT_EXCEEDED`    | Rate limit exceeded.                 |
| `InternalServerError`       | 500         | `INTERNAL_SERVER_ERROR`  | Generic internal server errors.      |
| `NotImplementedError`       | 501         | `NOT_IMPLEMENTED`        | Feature not implemented.             |
| `ServiceUnavailableError`   | 503         | `SERVICE_UNAVAILABLE`    | Service temporarily unavailable.     |
| `DatabaseError`             | 500         | `DATABASE_ERROR`         | Database operation failures.         |
| `NetworkError`              | 502         | `NETWORK_ERROR`          | Network connectivity issues.         |

### 🛠️ Error Handler Class

| Class          | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `ErrorHandler` | Centralized error processing and HTTP response formatting. |

#### ErrorHandler Methods

| Method                   | Signature                                                  | Description                                         |
| ------------------------ | ---------------------------------------------------------- | --------------------------------------------------- |
| `handle(error, context)` | `(error: Error, context: RequestContext) => Promise<void>` | Handle an error and send appropriate HTTP response. |
| `configure(config)`      | `(config: Partial<ErrorHandlerConfig>) => void`            | Configure the error handler settings.               |
| `getMetrics()`           | `() => { errorCount: number, lastErrorTime: number }`      | Get basic error metrics for monitoring.             |

### ⚙️ Configuration Interfaces

| Interface            | Description                               |
| -------------------- | ----------------------------------------- |
| `ErrorHandlerConfig` | Configuration options for error handling. |

#### ErrorHandlerConfig Properties

| Property                   | Type                                              | Default        | Description                                   |
| -------------------------- | ------------------------------------------------- | -------------- | --------------------------------------------- |
| `includeStack`             | `boolean`                                         | `false` (prod) | Whether to include stack traces in responses. |
| `logErrors`                | `boolean`                                         | `true`         | Whether to log errors to console.             |
| `customErrorHandler`       | `(error: Error, context: RequestContext) => void` | `undefined`    | Custom error handler function.                |
| `enableMetrics`            | `boolean`                                         | `false`        | Enable basic error metrics collection.        |
| `sanitizeProductionErrors` | `boolean`                                         | `true`         | Sanitize sensitive data in production.        |

## 💻 Usage Examples

### Creating Custom Errors

```typescript
import {
  ValidationError,
  NotFoundError,
  PayloadTooLargeError,
  AuthenticationError,
  DatabaseError,
  ErrorSeverity,
  ErrorCategory,
} from 'nextrush';

// Validation error with details and severity
throw new ValidationError('Invalid input data', {
  field: 'email',
  value: 'invalid-email',
  expected: 'valid email format',
});

// Resource not found with correlation ID
throw new NotFoundError('User', { userId: '123' }, 'req-abc-123');

// Authentication error with retry capability
throw new AuthenticationError('Invalid token', {
  tokenType: 'JWT',
  expiresAt: Date.now() + 3600000,
});

// Database error with connection details
throw new DatabaseError('Connection timeout', {
  host: 'localhost',
  port: 5432,
  database: 'users_db',
});

// Custom error with specific severity and category
class BusinessLogicError extends NextRushError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      message,
      'BUSINESS_LOGIC_ERROR',
      422,
      details,
      ErrorSeverity.MEDIUM,
      ErrorCategory.BUSINESS_LOGIC,
      undefined, // correlationId
      false // retryable
    );
  }
}
```

### Using Error Handler

```typescript
import { createApp, ErrorHandler } from 'nextrush';

const app = createApp();

// Configure optimized error handler
const errorHandler = new ErrorHandler({
  includeStack: process.env.NODE_ENV === 'development',
  logErrors: true,
  enableMetrics: true,
  sanitizeProductionErrors: process.env.NODE_ENV === 'production',
  customErrorHandler: (error, context) => {
    // Custom logging or error reporting
    console.log(`Error in ${context.request.method} ${context.request.url}`);

    // Send to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      errorTrackingService.captureException(error, {
        request: context.request,
        correlationId: error.correlationId,
      });
    }
  },
});

// Global error handling middleware
app.use(async (req, res, next) => {
  try {
    await next();
  } catch (error) {
    await errorHandler.handle(error, { request: req, response: res });
  }
});

// Get error metrics
const metrics = errorHandler.getMetrics();
console.log(
  `Total errors: ${metrics.errorCount}, Last error: ${new Date(
    metrics.lastErrorTime
  )}`
);
```

### Error Handling in Routes

```typescript
import { ValidationError, NotFoundError } from 'nextrush';

app.get('/users/:id', async (req, res) => {
  const userId = req.params.id;

  // Validate input
  if (!userId || isNaN(Number(userId))) {
    throw new ValidationError('Invalid user ID', {
      parameter: 'id',
      value: userId,
      expected: 'numeric string',
    });
  }

  // Simulate database lookup
  const user = await getUserById(userId);
  if (!user) {
    throw new NotFoundError('User');
  }

  res.json({ user });
});

// Handle method not allowed
app.post('/read-only-resource', (req, res) => {
  throw new MethodNotAllowedError('POST', ['GET']);
});
```

### Custom Error Classes

```typescript
import { NextRushError } from 'nextrush';

// Create application-specific error
class DatabaseConnectionError extends NextRushError {
  constructor(database: string, details?: Record<string, unknown>) {
    super(
      `Failed to connect to database: ${database}`,
      'DATABASE_CONNECTION_ERROR',
      503, // Service Unavailable
      { database, ...details }
    );
  }
}

// Usage
try {
  await connectToDatabase('users_db');
} catch (error) {
  throw new DatabaseConnectionError('users_db', {
    host: 'localhost',
    port: 5432,
    originalError: error.message,
  });
}
```

### Error Response Format

```typescript
// Error responses are automatically formatted as:
{
  "error": {
    "message": "User not found",
    "code": "NOT_FOUND",
    "timestamp": 1642247400000, // High-precision timestamp
    "severity": "medium",
    "category": "validation",
    "correlationId": "req-abc-123",
    "retryable": false,
    "details": {
      "resource": "User",
      "userId": "123"
    },
    "stack": "Error: User not found\n    at ..." // Only in development
  }
}

// Production response (sanitized):
{
  "error": {
    "message": "An error occurred while processing your request",
    "code": "INTERNAL_SERVER_ERROR",
    "timestamp": 1642247400000,
    "correlationId": "req-abc-123"
  }
}
```

## ⚙️ Configuration Options

### ErrorHandlerConfig

Configure error handling behavior:

```typescript
const errorHandler = new ErrorHandler({
  // Include stack traces (default: false in production)
  includeStack: process.env.NODE_ENV === 'development',

  // Enable error logging (default: true)
  logErrors: true,

  // Custom error handler for additional processing
  customErrorHandler: (error, context) => {
    // Send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      errorTrackingService.captureException(error, {
        request: context.request,
        user: context.request.user,
      });
    }
  },
});
```

### Environment-Based Configuration

```typescript
// Development configuration
const devErrorHandler = new ErrorHandler({
  includeStack: true,
  logErrors: true,
  enableMetrics: true,
  sanitizeProductionErrors: false,
  customErrorHandler: (error, context) => {
    console.debug('Detailed error info:', {
      error: error.toJSON ? error.toJSON() : error,
      request: {
        method: context.request.method,
        url: context.request.url,
        headers: context.request.headers,
      },
    });
  },
});

// Production configuration
const prodErrorHandler = new ErrorHandler({
  includeStack: false,
  logErrors: true,
  enableMetrics: true,
  sanitizeProductionErrors: true,
  customErrorHandler: (error, context) => {
    // Log minimal information
    logger.error({
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      severity: error.severity || 'medium',
      correlationId: error.correlationId,
      url: context.request.url,
      method: context.request.method,
    });
  },
});
```

## 📝 Best Practices

### 🚀 Performance Optimization

- Use error pooling for frequently thrown errors to reduce GC pressure
- Implement correlation IDs for distributed tracing
- Monitor error metrics to identify performance bottlenecks
- Use appropriate error severity levels for better alerting

### 🛡️ Security

- Always sanitize errors in production environments
- Never expose sensitive data in error messages
- Use correlation IDs instead of exposing internal error details
- Implement rate limiting for error-prone endpoints

### 🔄 Error Recovery

- Mark transient errors as retryable
- Implement circuit breaker patterns for external services
- Use exponential backoff for retry logic
- Provide meaningful error messages for user-facing errors

### 📊 Monitoring

- Enable error metrics for production monitoring
- Integrate with APM tools using custom error handlers
- Track error trends and patterns
- Set up alerts for critical errors

### 💾 Memory Management

- Use the built-in error pooling system
- Avoid creating excessive error context
- Clean up error listeners properly
- Monitor memory usage in error-heavy scenarios

## 📝 Notes

- **Performance Optimization**: The error handling system uses object pooling and memory optimization techniques to minimize GC pressure and maximize performance.

- **Error Classification**: Use `ErrorSeverity` and `ErrorCategory` enums for better error organization and monitoring.

- **Stack Traces**: Stack traces are automatically excluded in production environments for security. Override this behavior using the `includeStack` configuration option.

- **Error Logging**: All errors are logged by default. Disable logging by setting `logErrors: false` in the configuration.

- **Custom Error Handling**: Use the `customErrorHandler` option to integrate with external error tracking services like Sentry, Bugsnag, or custom logging solutions.

- **Error Serialization**: All NextRush errors implement `toJSON()` for consistent serialization in responses and logs.

- **HTTP Status Codes**: Each error class automatically sets appropriate HTTP status codes. Custom errors should extend `NextRushError` and specify appropriate status codes.

- **Error Details**: Use the `details` property to provide additional context without exposing sensitive information.

- **Memory Management**: The error handler prevents memory leaks through object pooling, proper cleanup, and avoiding circular references.

- **Type Safety**: All error classes are fully typed, providing IDE autocompletion and type checking for error properties and methods.

- **Correlation IDs**: Use correlation IDs for distributed tracing and debugging across microservices.

- **Retry Logic**: Mark errors as retryable using the `retryable` property for automatic retry mechanisms.

- **Security**: Production error responses are automatically sanitized to prevent information leakage while maintaining debugging capabilities.
