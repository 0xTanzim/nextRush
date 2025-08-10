# Advanced Logger Plugin

## Overview

The Advanced Logger Plugin provides comprehensive logging capabilities similar to Winston/Pino with multiple transports, structured logging, and performance optimization.

## Quick Start

```typescript
import { createApp } from 'nextrush-v2';
import { LoggerPlugin, createDevLogger } from 'nextrush-v2';

const app = createApp();

// Method 1: Use pre-configured logger
const logger = createDevLogger();
logger.install(app);

// Method 2: Create custom logger
const customLogger = new LoggerPlugin({
  level: LogLevel.DEBUG,
  format: 'json',
  timestamp: true,
  colors: true,
});
customLogger.install(app);

// Use logger in routes
app.get('/users', ctx => {
  app.logger.info('Fetching users', { userId: ctx.params.id });
  ctx.res.json({ users: [] });
});
```

## Using Logger Across Multiple Files

### Method 1: Global Logger Instance (Recommended)

Create a shared logger instance that can be imported across your application:

```typescript
// src/utils/logger.ts
import { LoggerPlugin, createDevLogger } from 'nextrush-v2';

// Create a singleton logger instance
export const logger = createDevLogger();

// Or create a custom logger
export const customLogger = new LoggerPlugin({
  level: LogLevel.DEBUG,
  format: 'json',
  timestamp: true,
  colors: true,
  maxMemoryUsage: 100, // 100MB limit
  asyncFlush: true, // Better performance
});

// Export logger methods for convenience
export const { info, warn, error, debug } = logger;
```

Then use it in any file:

```typescript
// src/routes/users.ts
import { logger } from '../utils/logger';

export const getUserHandler = ctx => {
  logger.info('Fetching user', { userId: ctx.params.id });
  // ... handler logic
};

// src/routes/auth.ts
import { logger } from '../utils/logger';

export const loginHandler = ctx => {
  logger.info('User login attempt', { email: ctx.body.email });
  // ... handler logic
};
```

### Method 2: Application Logger

Access the logger through the application instance:

```typescript
// src/app.ts
import { createApp } from 'nextrush-v2';
import { createDevLogger } from 'nextrush-v2';

const app = createApp();
const logger = createDevLogger();
logger.install(app);

export { app };

// src/routes/users.ts
import { app } from '../app';

export const getUserHandler = ctx => {
  app.logger.info('Fetching user', { userId: ctx.params.id });
  // ... handler logic
};
```

### Method 3: Dependency Injection

Pass the logger as a dependency to your modules:

```typescript
// src/services/userService.ts
import type { LoggerPlugin } from 'nextrush-v2';

export class UserService {
  constructor(private logger: LoggerPlugin) {}

  async getUser(id: string) {
    this.logger.info('Fetching user from database', { userId: id });
    // ... service logic
  }
}

// src/routes/users.ts
import { UserService } from '../services/userService';

export const createUserHandler = logger => {
  const userService = new UserService(logger);

  return async ctx => {
    const user = await userService.getUser(ctx.params.id);
    ctx.res.json(user);
  };
};
```

## NPM Package Exports

The logger plugin is properly exported for npm package usage:

```typescript
// Import the main logger functionality
import {
  LoggerPlugin,
  createDevLogger,
  createProdLogger,
  createMinimalLogger,
  createTestLogger,
  LogLevel,
} from 'nextrush-v2';

// Import transports
import {
  ConsoleTransport,
  FileTransport,
  HttpTransport,
  StreamTransport,
} from 'nextrush-v2';

// Import types
import type { LogLevel, LogEntry, Transport, LoggerConfig } from 'nextrush-v2';
```

### TypeScript Support

All types are properly exported and available:

```typescript
import {
  LogLevel,
  LoggerPlugin,
  type LogEntry,
  type Transport,
  type LoggerConfig,
} from 'nextrush-v2';

// Use types in your code
const config: LoggerConfig = {
  level: LogLevel.DEBUG,
  format: 'json',
  timestamp: true,
  maxMemoryUsage: 50,
  asyncFlush: true,
};

const transport: Transport = new ConsoleTransport('info');
const logger = new LoggerPlugin(config);
logger.addTransport(transport);
```

## Transports

### Console Transport

```typescript
import { ConsoleTransport } from 'nextrush-v2';

const transport = new ConsoleTransport('info');
logger.addTransport(transport);
```

### File Transport

```typescript
import { FileTransport } from 'nextrush-v2';

const transport = new FileTransport('logs/app.log', 'info', {
  maxSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  flushInterval: 1000,
});
logger.addTransport(transport);
```

### HTTP Transport

```typescript
import { HttpTransport } from 'nextrush-v2';

const transport = new HttpTransport(
  'https://logs.example.com/api/logs',
  'info',
  {
    headers: {
      Authorization: 'Bearer your-token',
    },
  }
);
logger.addTransport(transport);
```

### Stream Transport

```typescript
import { StreamTransport } from 'nextrush-v2';
import { createWriteStream } from 'node:fs';

const stream = createWriteStream('logs/custom.log');
const transport = new StreamTransport(stream, 'info');
logger.addTransport(transport);
```

## Configuration

```typescript
import { LoggerPlugin, LogLevel } from 'nextrush-v2';

const logger = new LoggerPlugin({
  level: LogLevel.DEBUG, // Log level (ERROR, WARN, INFO, DEBUG, TRACE)
  format: 'json', // 'json' | 'text' | 'simple'
  timestamp: true, // Include timestamps
  colors: true, // Enable colors in console
  maxEntries: 1000, // Maximum log entries to keep in memory
  flushInterval: 5000, // Automatic flush interval in ms
  maxMemoryUsage: 50, // Maximum memory usage in MB before forced flush
  asyncFlush: true, // Use async flushing for better performance
  transports: [
    { type: 'console' },
    { type: 'file', options: { path: 'logs/app.log' } },
  ],
});
```

## Pre-configured Loggers

### Development Logger

```typescript
import { createDevLogger } from 'nextrush-v2';

const logger = createDevLogger(); // Colored output, debug level, text format
```

### Production Logger

```typescript
import { createProdLogger } from 'nextrush-v2';

const logger = createProdLogger(); // JSON format, info level, file transport
```

### Minimal Logger

```typescript
import { createMinimalLogger } from 'nextrush-v2';

const logger = createMinimalLogger(); // Basic console output, info level
```

### Test Logger

```typescript
import { createTestLogger } from 'nextrush-v2';

const logger = createTestLogger(); // Error level only, minimal output for testing
```

## Usage Examples

### Basic Logging

```typescript
logger.info('User logged in', { userId: '123', email: 'user@example.com' });
logger.warn('Rate limit exceeded', { ip: '192.168.1.1' });
logger.error('Database connection failed', { error: err.message });
logger.debug('Processing request', { method: 'GET', url: '/api/users' });
```

### Request Logging

```typescript
// Automatically logs all HTTP requests when requestLogging: true
app.get('/api/users', ctx => {
  // Request is automatically logged
  ctx.res.json({ users: [] });
});
```

### Performance Monitoring

```typescript
// Automatically monitors slow requests when performance: true
app.get('/api/slow', async ctx => {
  await new Promise(resolve => setTimeout(resolve, 200)); // Slow operation
  ctx.res.json({ message: 'Done' });
});
```

### Critical Log Handling

The logger automatically handles critical log levels (ERROR and WARN) with immediate writes:

```typescript
// These are written immediately to all transports
logger.error('Database connection failed', { error: err.message });
logger.warn('Rate limit exceeded', { ip: ctx.ip });

// These are buffered for performance
logger.info('User logged in', { userId: '123' });
logger.debug('Processing request', { method: 'GET' });
```

### Event Handling

```typescript
logger.on('log', (entry: LogEntry) => {
  // Custom log processing
  console.log('Custom log handler:', entry);
});

logger.on('error', (error: Error) => {
  // Handle logger errors
  console.error('Logger error:', error);
});
```

## Performance

The logger is optimized for high-performance applications:

- **Immediate Error/Warning Writes**: Critical log levels (ERROR, WARN) are written immediately to transports for faster debugging
- **Async Buffered Writes**: Non-critical levels (INFO, DEBUG, TRACE) use async buffering for better performance
- **Memory Management**: Automatic memory monitoring with configurable limits and forced cleanup
- **Level Filtering**: Messages are filtered at the transport level to reduce overhead
- **Transport Flexibility**: Support for multiple transport types with individual configuration
- **Configurable Flushing**: Both sync and async flush modes available

### Performance Configuration

```typescript
const logger = new LoggerPlugin({
  asyncFlush: true, // Enable async flushing for better performance
  maxMemoryUsage: 50, // 50MB limit before forced flush
  flushInterval: 5000, // Auto-flush every 5 seconds
  maxEntries: 1000, // Keep max 1000 entries in memory
});
```

## Best Practices

### 1. Use Appropriate Log Levels

```typescript
logger.error('Critical system failure', { error: err.stack });
logger.warn('Deprecated API called', { endpoint: '/old-api' });
logger.info('User action completed', { action: 'login', userId: '123' });
logger.debug('Processing step', { step: 'validation', data: ctx.body });
```

### 2. Include Context in Logs

```typescript
logger.info('Database query executed', {
  query: 'SELECT * FROM users',
  duration: 45,
  rows: 100,
  userId: ctx.user?.id,
  requestId: ctx.requestId,
});
```

### 3. Use Structured Logging

```typescript
// Good
logger.info('User created', {
  userId: user.id,
  email: user.email,
  timestamp: new Date().toISOString(),
});

// Avoid
logger.info(`User created: ${user.id} with email ${user.email}`);
```

### 4. Handle Logger Errors

```typescript
logger.on('error', error => {
  // Fallback to console if logger fails
  console.error('Logger error:', error);
});
```

### 5. Configure for Environment

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';
const logger = isDevelopment ? createDevLogger() : createProdLogger();
```

### 6. Optimize for Performance

```typescript
// For high-throughput applications
const logger = new LoggerPlugin({
  asyncFlush: true, // Enable async flushing
  maxMemoryUsage: 100, // Increase memory limit
  flushInterval: 10000, // Flush less frequently
  level: LogLevel.INFO, // Reduce log verbosity in production
});
```

### 7. Handle Memory Management

```typescript
// Monitor memory usage
const logger = new LoggerPlugin({
  maxMemoryUsage: 50, // 50MB limit
  maxEntries: 1000, // Limit entries in memory
});

// Logger will automatically flush when limits are reached
```

## Migration from Basic Logger

If you're migrating from the basic logger middleware:

```typescript
// Old way
import { logger } from '@/core/middleware/logger';

// New way
import { LoggerPlugin, createDevLogger } from 'nextrush-v2';

// Option 1: Use pre-configured logger
const logger = createDevLogger();
logger.install(app);

// Option 2: Create custom logger
const logger = new LoggerPlugin({
  level: LogLevel.INFO,
  format: 'json',
  asyncFlush: true,
});
logger.install(app);
```

### Breaking Changes in v2

- **Constructor Pattern**: Use `new LoggerPlugin()` instead of `createLogger()`
- **Log Levels**: Use `LogLevel` enum instead of string values
- **Configuration**: New options for memory management and async flushing
- **Factory Functions**: New pre-configured loggers available
- **Performance**: Critical levels (ERROR/WARN) now write immediately

## Related Documentation

- [Middleware System](./middleware.md)
- [Plugin System](./plugins.md)
- [Application Lifecycle](./application.md)
