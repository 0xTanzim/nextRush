# ⚠️ Error Handling

## 📚 Table of Contents

- [⚠️ Error Handling](#️-error-handling)
  - [📚 Table of Contents](#-table-of-contents)
  - [📖 Introduction](#-introduction)
  - [🔧 Public APIs](#-public-apis)
    - [⚠️ Base Error Class](#️-base-error-class)
      - [NextRushError Properties](#nextrusherror-properties)
      - [NextRushError Methods](#nextrusherror-methods)
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
  - [📝 Notes](#-notes)

## 📖 Introduction

The NextRush framework provides a comprehensive error handling system that includes custom error classes, centralized error handling, and structured error responses. The error handling system is designed to provide meaningful error messages, proper HTTP status codes, and detailed error information for debugging while maintaining security in production environments.

## 🔧 Public APIs

### ⚠️ Base Error Class

| Class           | Extends | Description                                            |
| --------------- | ------- | ------------------------------------------------------ |
| `NextRushError` | `Error` | Abstract base class for all framework-specific errors. |

#### NextRushError Properties

| Property     | Type                      | Description                                 |
| ------------ | ------------------------- | ------------------------------------------- |
| `code`       | `string`                  | Unique error code identifier.               |
| `statusCode` | `number`                  | HTTP status code associated with the error. |
| `details`    | `Record<string, unknown>` | Additional error details and context.       |
| `timestamp`  | `Date`                    | Timestamp when the error was created.       |

#### NextRushError Methods

| Method     | Signature      | Description                            |
| ---------- | -------------- | -------------------------------------- |
| `toJSON()` | `() => object` | Serializes the error to a JSON object. |

### 🎯 Specific Error Classes

| Class                       | Status Code | Error Code               | Description                          |
| --------------------------- | ----------- | ------------------------ | ------------------------------------ |
| `ValidationError`           | 400         | `VALIDATION_ERROR`       | Input validation failures.           |
| `NotFoundError`             | 404         | `NOT_FOUND`              | Resource not found errors.           |
| `MethodNotAllowedError`     | 405         | `METHOD_NOT_ALLOWED`     | HTTP method not supported for route. |
| `RequestTimeoutError`       | 408         | `REQUEST_TIMEOUT`        | Request exceeded timeout limit.      |
| `PayloadTooLargeError`      | 413         | `PAYLOAD_TOO_LARGE`      | Request payload exceeds size limit.  |
| `UnsupportedMediaTypeError` | 415         | `UNSUPPORTED_MEDIA_TYPE` | Content-Type not supported.          |
| `InternalServerError`       | 500         | `INTERNAL_SERVER_ERROR`  | Generic internal server errors.      |

### 🛠️ Error Handler Class

| Class          | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `ErrorHandler` | Centralized error processing and HTTP response formatting. |

#### ErrorHandler Methods

| Method                   | Signature                                                  | Description                                         |
| ------------------------ | ---------------------------------------------------------- | --------------------------------------------------- |
| `handle(error, context)` | `(error: Error, context: RequestContext) => Promise<void>` | Handle an error and send appropriate HTTP response. |
| `configure(config)`      | `(config: Partial<ErrorHandlerConfig>) => void`            | Configure the error handler settings.               |

### ⚙️ Configuration Interfaces

| Interface            | Description                               |
| -------------------- | ----------------------------------------- |
| `ErrorHandlerConfig` | Configuration options for error handling. |

#### ErrorHandlerConfig Properties

| Property             | Type                                              | Default        | Description                                   |
| -------------------- | ------------------------------------------------- | -------------- | --------------------------------------------- |
| `includeStack`       | `boolean`                                         | `false` (prod) | Whether to include stack traces in responses. |
| `logErrors`          | `boolean`                                         | `true`         | Whether to log errors to console.             |
| `customErrorHandler` | `(error: Error, context: RequestContext) => void` | `undefined`    | Custom error handler function.                |

## 💻 Usage Examples

### Creating Custom Errors

```typescript
import {
  ValidationError,
  NotFoundError,
  PayloadTooLargeError,
} from './src/errors/custom-errors';

// Validation error with details
throw new ValidationError('Invalid input data', {
  field: 'email',
  value: 'invalid-email',
  expected: 'valid email format',
});

// Resource not found
throw new NotFoundError('User');

// Payload too large with size information
throw new PayloadTooLargeError(1048576, 2097152); // 1MB limit, 2MB actual
```

### Using Error Handler

```typescript
import { createApp, ErrorHandler } from 'nextrush';

const app = createApp();

// Configure custom error handler
const errorHandler = new ErrorHandler({
  includeStack: process.env.NODE_ENV === 'development',
  logErrors: true,
  customErrorHandler: (error, context) => {
    // Custom logging or error reporting
    console.log(`Error in ${context.request.method} ${context.request.url}`);
  },
});

// Global error handling middleware
app.use((req, res, next) => {
  try {
    next();
  } catch (error) {
    errorHandler.handle(error, { request: req, response: res });
  }
});
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
    "timestamp": "2024-01-15T10:30:00.000Z",
    "details": {
      "resource": "User",
      "id": "123"
    },
    "stack": "Error: User not found\n    at ..." // Only in development
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
  customErrorHandler: (error, context) => {
    // Log minimal information
    logger.error({
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      url: context.request.url,
      method: context.request.method,
    });
  },
});
```

## 📝 Notes

- **Stack Traces**: Stack traces are automatically excluded in production environments for security. Override this behavior using the `includeStack` configuration option.
- **Error Logging**: All errors are logged by default. Disable logging by setting `logErrors: false` in the configuration.
- **Custom Error Handling**: Use the `customErrorHandler` option to integrate with external error tracking services like Sentry, Bugsnag, or custom logging solutions.
- **Error Serialization**: All NextRush errors implement `toJSON()` for consistent serialization in responses and logs.
- **HTTP Status Codes**: Each error class automatically sets appropriate HTTP status codes. Custom errors should extend `NextRushError` and specify appropriate status codes.
- **Error Details**: Use the `details` property to provide additional context without exposing sensitive information.
- **Memory Management**: The error handler prevents memory leaks by properly handling async error listeners and avoiding circular references.
- **Type Safety**: All error classes are fully typed, providing IDE autocompletion and type checking for error properties and methods.
