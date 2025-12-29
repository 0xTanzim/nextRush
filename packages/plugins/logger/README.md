# @nextrush/logger

Request logging middleware for NextRush. This package wraps [@nextrush/log](https://www.npmjs.com/package/@nextrush/log) and provides:

- **Re-exports** of all `@nextrush/log` functionality
- **Request logging middleware** for NextRush applications  
- **Automatic correlation ID** handling
- **Context-attached logger** (`ctx.log`) for request handlers

## Installation

```bash
pnpm add @nextrush/logger
```

## Quick Start

```typescript
import { createApp } from '@nextrush/core';
import { logger, createLogger } from '@nextrush/logger';

const app = createApp();

// Add request logging middleware
app.use(logger());

// Direct logging for application code
const log = createLogger('MyService');
log.info('Server starting');

// Access logger in handlers via context
app.get('/users', async (ctx) => {
  ctx.log.info('Fetching users');
  ctx.json({ users: [] });
});
```

**Output (development):**

```
2025-01-15 10:30:00.123 🐛 [DEBUG] [nextrush] (abc12345-...) Request started
  method: "GET"
  path: "/users"
  ip: "127.0.0.1"
2025-01-15 10:30:00.125 ℹ️  [INFO ] [nextrush] (abc12345-...) Fetching users
2025-01-15 10:30:00.130 ℹ️  [INFO ] [nextrush] (abc12345-...) GET /users
  method: "GET"
  path: "/users"
  status: 200
  duration: 7
```

## API

### `logger(options?)`

Request logging middleware that:
- Logs request start (development only by default)
- Logs request completion with duration
- Attaches `ctx.log` for use in handlers
- Extracts/generates correlation IDs

```typescript
app.use(logger({
  // Log level configuration
  minLevel: 'info',              // Minimum log level
  successLevel: 'info',          // Level for 2xx/3xx responses (default: 'info')
  clientErrorLevel: 'warn',      // Level for 4xx responses (default: 'warn')
  serverErrorLevel: 'error',     // Level for 5xx responses (default: 'error')

  // Request logging
  logRequestStart: true,         // Log when request starts (default: true in dev)

  // Correlation ID
  correlationIdHeader: 'x-request-id',  // Header name (default: 'x-request-id')
  generateCorrelationId: true,          // Generate if not in headers (default: true)

  // Customization
  context: 'api',                // Logger context name (default: 'nextrush')
  skip: (ctx) => ctx.path === '/health', // Skip logging for paths
  formatMessage: (ctx, duration) => \`\${ctx.method} \${ctx.path} - \${duration}ms\`,

  // Silent mode (no console output, transports still called)
  silent: false,
}));
```

### `attachLogger(options?)`

Lightweight middleware that only attaches `ctx.log` without request logging.

```typescript
app.use(attachLogger({
  correlationIdHeader: 'x-request-id',
  generateCorrelationId: true,
  context: 'api',
}));

app.get('/users', async (ctx) => {
  ctx.log.info('Handler called');
});
```

### `hasLogger(ctx)`

Type guard to check if context has logger attached.

```typescript
app.use(async (ctx) => {
  if (hasLogger(ctx)) {
    ctx.log.info('Logger is available');
  }
});
```

### `getLogger(ctx, fallbackContext?)`

Get logger from context, or create a fallback.

```typescript
app.use(async (ctx) => {
  const log = getLogger(ctx, 'fallback');
  log.info('Always works');
});
```

## Using `ctx.log`

When using `logger()` or `attachLogger()` middleware, a request-scoped logger is attached to `ctx.log`:

```typescript
app.use(logger());

app.get('/users/:id', async (ctx) => {
  const { id } = ctx.params;
  
  // All log levels
  ctx.log.trace('Trace message');
  ctx.log.debug('Debug message');
  ctx.log.info('Processing user', { userId: id });
  ctx.log.warn('User quota low', { remaining: 5 });
  ctx.log.error('Failed to process', new Error('Database error'));
  ctx.log.fatal('Critical failure');

  // Performance timing
  const timer = ctx.log.time('database-query');
  const user = await db.findUser(id);
  timer.end('Query completed', { rows: 1 });

  // Child loggers
  const dbLog = ctx.log.child('database');
  dbLog.info('Connection established');

  // With additional metadata
  const enrichedLog = ctx.log.withMetadata({ service: 'user-api' });
  enrichedLog.info('Request processed');

  ctx.json({ user });
});
```

### TypeScript Type Safety

```typescript
import type { LoggerContext } from '@nextrush/logger';

app.get('/users', async (ctx) => {
  // Option 1: Type cast
  (ctx as LoggerContext).log.info('Typed access');

  // Option 2: Type guard
  if (hasLogger(ctx)) {
    ctx.log.info('Now typed correctly');
  }

  // Option 3: Helper function
  const log = getLogger(ctx);
  log.info('Always safe');
});
```

## Re-exports from @nextrush/log

This package re-exports everything from `@nextrush/log`:

### Core

```typescript
import {
  createLogger,      // Create a new logger instance
  logger,            // Default logger instance
  log,               // Alias for default logger
  Logger,            // Logger class
  configure,         // Configure global settings
  setGlobalLevel,    // Set global minimum level
} from '@nextrush/logger';
```

### Transports

```typescript
import {
  createConsoleTransport,
  createBatchTransport,
  createFilteredTransport,
  createRateLimitedTransport,
  addGlobalTransport,
} from '@nextrush/logger';
```

### Serializers & Formatters

```typescript
import {
  safeSerialize,
  serializeError,
  redactSensitiveValues,
  formatJSON,
  formatPrettyTerminal,
} from '@nextrush/logger';
```

### Runtime Detection

```typescript
import {
  detectRuntime,
  getRuntime,
  isProductionBuild,
} from '@nextrush/logger';
```

### Async Context

```typescript
import {
  runWithContext,
  getAsyncContext,
  isAsyncContextAvailable,
} from '@nextrush/logger';
```

## Runtime Compatibility

| Runtime | Support | Notes |
|---------|---------|-------|
| Node.js 20+ | ✅ Full | AsyncLocalStorage for context |
| Bun | ✅ Full | AsyncLocalStorage for context |
| Deno | ✅ Full | AsyncLocalStorage for context |
| Edge (Vercel/Cloudflare) | ⚠️ Partial | Fallback context |
| Browsers | ⚠️ Partial | Fallback context, different formatting |

## Configuration Examples

### Production

```typescript
app.use(logger({
  minLevel: 'info',
  redact: true,
  logRequestStart: false,
  skip: (ctx) => ctx.path === '/health',
}));
```

### Development

```typescript
app.use(logger({
  minLevel: 'trace',
  pretty: true,
  colors: true,
  logRequestStart: true,
}));
```

## Best Practices

1. **Use `ctx.log` in handlers** - Includes correlation ID automatically
2. **Skip health check paths** - Reduce log noise
3. **Use child loggers** - `ctx.log.child('db')` for clear context
4. **Enable redaction in production** - Sensitive data is masked
5. **Use timing for performance** - `ctx.log.time()` for measurements

## License

MIT
