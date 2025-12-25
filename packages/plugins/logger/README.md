# @nextrush/logger

Structured request logging plugin for NextRush. Production-ready logging with request correlation, performance metrics, and multiple output formats.

## Installation

```bash
npm install @nextrush/logger
# or
pnpm add @nextrush/logger
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { logger } from '@nextrush/logger';

const app = createApp();

// Add request logging
app.use(logger());

app.get('/api/users', (ctx) => {
  ctx.json({ users: [] });
});
```

**Output:**

```
GET /api/users 200 45ms
```

## Features

- **Structured Logging**: JSON output for log aggregation
- **Request Correlation**: Automatic request ID tracking
- **Performance Metrics**: Response time and status tracking
- **Multiple Formats**: Development (pretty) and production (JSON)
- **Custom Fields**: Add context-specific data to logs
- **Error Logging**: Automatic error capture with stack traces
- **Zero Dependencies**: Pure TypeScript implementation

## Configuration

### Basic Options

```typescript
app.use(logger({
  // Log level: 'debug' | 'info' | 'warn' | 'error' | 'silent'
  level: 'info',

  // Output format: 'dev' | 'json' | 'combined'
  format: 'dev',

  // Include request body in logs (default: false)
  logBody: false,

  // Skip logging for specific routes
  skip: (ctx) => ctx.path === '/health',
}));
```

### Production Configuration

```typescript
app.use(logger({
  level: process.env.LOG_LEVEL || 'info',
  format: 'json',
  customProps: (ctx) => ({
    requestId: ctx.state.requestId,
    userId: ctx.state.user?.id,
    env: process.env.NODE_ENV,
  }),
}));
```

## Output Formats

### Development Format

Human-readable output for local development:

```typescript
app.use(logger({ format: 'dev' }));
```

```
GET /api/users 200 45ms
POST /api/users 201 123ms
GET /api/users/123 404 12ms
```

### JSON Format

Structured output for log aggregation:

```typescript
app.use(logger({ format: 'json' }));
```

```json
{"method":"GET","path":"/api/users","status":200,"duration":45,"timestamp":"2024-01-15T10:30:00.000Z"}
```

### Combined Format

Apache-style combined log format:

```typescript
app.use(logger({ format: 'combined' }));
```

```
127.0.0.1 - - [15/Jan/2024:10:30:00 +0000] "GET /api/users HTTP/1.1" 200 1234 "-" "Mozilla/5.0..."
```

## Custom Logger

Use your own logging function:

```typescript
import pino from 'pino';

const log = pino();

app.use(logger({
  customLogger: (info) => {
    log.info(info, `${info.method} ${info.path}`);
  },
}));
```

## Custom Properties

Add context to every log entry:

```typescript
app.use(logger({
  customProps: (ctx) => ({
    // Request correlation
    requestId: ctx.state.requestId,
    correlationId: ctx.get('X-Correlation-Id'),

    // User context
    userId: ctx.state.user?.id,
    userRole: ctx.state.user?.role,

    // Environment
    service: 'api-gateway',
    version: process.env.APP_VERSION,

    // Performance
    responseSize: ctx.response.length,
  }),
}));
```

## Error Logging

Errors are automatically logged:

```typescript
app.use(logger({
  logErrors: true,
  errorLevel: 'error',
}));

app.get('/fail', (ctx) => {
  throw new Error('Something went wrong');
});
```

**Output:**

```json
{
  "method": "GET",
  "path": "/fail",
  "status": 500,
  "error": "Something went wrong",
  "stack": "Error: Something went wrong\n    at..."
}
```

## Request Body Logging

Log request bodies (use caution with sensitive data):

```typescript
app.use(logger({
  logBody: true,
  sanitize: (body) => {
    // Remove sensitive fields
    const { password, token, ...safe } = body;
    return safe;
  },
}));
```

## Skip Logging

Exclude specific routes:

```typescript
app.use(logger({
  skip: (ctx) => {
    // Skip health checks
    if (ctx.path === '/health') return true;
    // Skip static files
    if (ctx.path.startsWith('/static')) return true;
    // Skip successful responses in production
    if (process.env.NODE_ENV === 'production' && ctx.status < 400) return true;
    return false;
  },
}));
```

## Plugin Usage

Use as a plugin instead of middleware:

```typescript
import { attachLogger } from '@nextrush/logger';

const app = createApp();
app.plugin(attachLogger({
  level: 'info',
  format: 'json',
}));

// Access logger instance
app.log.info('Application started');
app.log.error('Error occurred', { error: err });
```

## Context Logger

Access logger from context:

```typescript
app.use(logger());

app.get('/api/process', async (ctx) => {
  ctx.log.info('Processing started');

  try {
    await processData();
    ctx.log.info('Processing completed');
  } catch (err) {
    ctx.log.error('Processing failed', { error: err.message });
    throw err;
  }

  ctx.json({ success: true });
});
```

## Log Levels

```typescript
// Available levels (in order of severity)
ctx.log.debug('Debug info');   // Verbose debugging
ctx.log.info('Info message');  // General information
ctx.log.warn('Warning');       // Warning conditions
ctx.log.error('Error', err);   // Error conditions
```

## Integration with Request ID

```typescript
import { requestId } from '@nextrush/request-id';
import { logger } from '@nextrush/logger';

app.use(requestId());
app.use(logger({
  customProps: (ctx) => ({
    requestId: ctx.state.requestId,
  }),
}));
```

## API Reference

### Exports

```typescript
import {
  logger,       // Request logging middleware
  attachLogger, // Plugin version
  createLogger, // Create standalone logger
} from '@nextrush/logger';
```

### Types

```typescript
interface LoggerOptions {
  level?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
  format?: 'dev' | 'json' | 'combined';
  logBody?: boolean;
  logErrors?: boolean;
  errorLevel?: string;
  skip?: (ctx: Context) => boolean;
  customProps?: (ctx: Context) => Record<string, unknown>;
  customLogger?: (info: LogInfo) => void;
  sanitize?: (body: unknown) => unknown;
}

interface LogInfo {
  method: string;
  path: string;
  status: number;
  duration: number;
  timestamp: string;
  error?: string;
  stack?: string;
  [key: string]: unknown;
}
```

## Best Practices

1. **Use JSON in production** for log aggregation
2. **Add request IDs** for tracing
3. **Sanitize sensitive data** before logging
4. **Skip health checks** to reduce noise
5. **Log errors with stack traces** for debugging
6. **Include user context** for security audits

## License

MIT
