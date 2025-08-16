# Logger Plugin API Reference

The Logger Plugin provides advanced logging capabilities for NextRush v2 applications with multiple transports, configurable levels, and automatic request logging.

## 📖 What it is

A comprehensive logging system that extends beyond basic console logging with:

- **Multiple transports** (Console, File, HTTP, Stream)
- **Structured logging** with context and metadata
- **Automatic request logging** with timing and status
- **Memory management** with configurable limits
- **Async/sync flushing** for performance

## ⚡ When to use

Use the Logger Plugin when you need:

- 📊 **Production logging** with structured data
- 📁 **File-based logging** for persistence
- 🌐 **Remote logging** to external services
- 🔍 **Request tracing** with unique IDs
- 🚀 **Performance monitoring** with timing data
- 🛡️ **Memory-safe logging** for high-traffic apps

## 🚀 Quick start

```typescript
import { createApp, LoggerPlugin } from 'nextrush';

const app = createApp();

// Basic logger
const logger = new LoggerPlugin();
logger.install(app);

// Access logger in your app
app.get('/users', async ctx => {
  app.logger.info('Fetching users', { userId: ctx.state.user?.id });
  const users = await getUsers();
  ctx.json(users);
});

app.listen(3000);
```

---

# 🏗️ LoggerPlugin Class

## Constructor

```typescript
constructor(config?: LoggerConfig)
```

**Parameters:**

- `config` (LoggerConfig, optional): Logger configuration options

**Example:**

```typescript
const logger = new LoggerPlugin({
  level: LogLevel.DEBUG,
  format: 'json',
  maxEntries: 5000,
  flushInterval: 3000,
  transports: [
    { type: 'console' },
    { type: 'file', options: { path: 'logs/app.log' } },
  ],
});
```

---

## Configuration Options

```typescript
interface LoggerConfig {
  level?: LogLevel; // Minimum log level (default: INFO)
  format?: 'json' | 'text' | 'simple'; // Log format (default: 'text')
  timestamp?: boolean; // Include timestamps (default: true)
  colors?: boolean; // Enable colors in console (default: true)
  maxEntries?: number; // Max entries in memory (default: 1000)
  flushInterval?: number; // Flush interval in ms (default: 5000)
  maxMemoryUsage?: number; // Max memory usage in MB (default: 50)
  asyncFlush?: boolean; // Use async flushing (default: true)
  transports?: TransportConfig[]; // Transport configurations
}
```

### Log Levels

```typescript
enum LogLevel {
  ERROR = 0, // Only errors
  WARN = 1, // Warnings and errors
  INFO = 2, // Info, warnings, and errors
  DEBUG = 3, // Debug and above
  TRACE = 4, // All messages
}
```

### Transport Configuration

```typescript
interface TransportConfig {
  type: 'console' | 'file' | 'stream' | 'http';
  options?: Record<string, unknown>;
}
```

---

# 📝 Logging Methods

## Basic logging methods

```typescript
// Error logging (always logged unless level is below ERROR)
app.logger.error('Database connection failed', {
  error: 'Connection timeout',
  database: 'users_db',
});

// Warning logging
app.logger.warn('High memory usage detected', {
  usage: '85%',
  threshold: '80%',
});

// Info logging
app.logger.info('User registered successfully', {
  userId: '123',
  email: 'user@example.com',
});

// Debug logging (only in development)
app.logger.debug('Processing request', {
  method: 'POST',
  path: '/api/users',
  body: requestData,
});

// Trace logging (very detailed)
app.logger.trace('Function entry', {
  function: 'validateUser',
  params: { id: '123' },
});
```

## Contextual logging

```typescript
// Add context to any log message
app.logger.info('Payment processed', {
  paymentId: 'pay_123',
  amount: 99.99,
  currency: 'USD',
  userId: '456',
  timestamp: new Date(),
  metadata: {
    gateway: 'stripe',
    country: 'US',
  },
});
```

---

# 🚛 Transports

Transports determine where your logs are written. You can use multiple transports simultaneously.

## Console Transport

**What:** Writes logs to console/terminal
**Best for:** Development and simple deployments

```typescript
import { LoggerPlugin, ConsoleTransport, LogLevel } from 'nextrush';

const logger = new LoggerPlugin();

// Add console transport manually
logger.addTransport(new ConsoleTransport(LogLevel.DEBUG));

// Or configure in constructor
const logger2 = new LoggerPlugin({
  transports: [{ type: 'console' }],
});
```

## File Transport

**What:** Writes logs to files on disk
**Best for:** Production logging and log analysis

```typescript
import { LoggerPlugin, FileTransport, LogLevel } from 'nextrush';

const logger = new LoggerPlugin();

// Add file transport
logger.addTransport(new FileTransport('./logs/app.log', LogLevel.INFO));

// Or configure in constructor
const logger2 = new LoggerPlugin({
  transports: [{ type: 'file', options: { path: './logs/error.log' } }],
});
```

**File features:**

- ✅ Automatic file creation
- ✅ Append mode (won't overwrite)
- ✅ Async writing for performance
- ✅ Error handling if file is locked

## HTTP Transport

**What:** Sends logs to remote HTTP endpoints
**Best for:** Centralized logging services (ELK, Datadog, etc.)

```typescript
import { LoggerPlugin, HttpTransport, LogLevel } from 'nextrush';

const logger = new LoggerPlugin();

// Add HTTP transport
logger.addTransport(
  new HttpTransport('https://logs.myapp.com/ingest', LogLevel.WARN)
);

// Or configure in constructor
const logger2 = new LoggerPlugin({
  transports: [
    {
      type: 'http',
      options: {
        url: 'https://api.loggly.com/inputs/YOUR-TOKEN',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    },
  ],
});
```

**HTTP features:**

- ✅ JSON payload format
- ✅ Async requests (non-blocking)
- ✅ Error fallback to console
- ✅ Configurable timeouts

## Stream Transport

**What:** Writes logs to any Node.js writable stream
**Best for:** Custom outputs, pipes, network streams

```typescript
import { LoggerPlugin, StreamTransport, LogLevel } from 'nextrush';
import fs from 'fs';

const logger = new LoggerPlugin();

// Write to file stream
const fileStream = fs.createWriteStream('./logs/custom.log', { flags: 'a' });
logger.addTransport(new StreamTransport(fileStream, LogLevel.INFO));

// Write to process.stdout
logger.addTransport(new StreamTransport(process.stdout, LogLevel.DEBUG));
```

---

# 🔧 Advanced Features

## Transport Management

```typescript
const logger = new LoggerPlugin();

// Add transports
logger.addTransport(new ConsoleTransport(LogLevel.DEBUG));
logger.addTransport(new FileTransport('./app.log', LogLevel.INFO));

// Remove transport by name
logger.removeTransport('console');

// Get all transports
const transports = logger.getTransports();
console.log(`Active transports: ${transports.length}`);
```

## Dynamic log levels

```typescript
const logger = new LoggerPlugin({ level: LogLevel.INFO });

// Change log level at runtime
logger.setLevel(LogLevel.DEBUG); // Now shows debug messages
logger.setLevel('ERROR'); // String format also works

// Different levels for different transports
const consoleTransport = new ConsoleTransport(LogLevel.DEBUG);
const fileTransport = new FileTransport('./app.log', LogLevel.WARN);

logger.addTransport(consoleTransport);
logger.addTransport(fileTransport);
// Console shows DEBUG+, file shows WARN+ only
```

## Memory management

```typescript
const logger = new LoggerPlugin({
  maxEntries: 2000, // Keep max 2000 log entries in memory
  maxMemoryUsage: 100, // Flush when heap usage exceeds 100MB
  flushInterval: 5000, // Flush every 5 seconds
  asyncFlush: true, // Don't block on flush
});

// Manual operations
logger.flush(); // Force flush all pending logs
logger.clear(); // Clear memory buffer
logger.getEntries(); // Get current log entries
```

## Event listeners

```typescript
const logger = new LoggerPlugin();

// Listen for log events
logger.on('log', (entry: LogEntry) => {
  if (entry.level === LogLevel.ERROR) {
    // Send alert for errors
    sendAlertToSlack(entry.message);
  }
});

// Remove event listener
const errorHandler = entry => console.log('Error:', entry.message);
logger.on('log', errorHandler);
logger.off('log', errorHandler);
```

---

# 🏭 Factory Functions

Pre-configured logger instances for common use cases.

## Development Logger

```typescript
import { createDevLogger } from 'nextrush';

const logger = createDevLogger();
// ✅ DEBUG level
// ✅ Colored console output
// ✅ Timestamps enabled
// ✅ Fast flush interval (5s)
```

## Production Logger

```typescript
import { createProdLogger } from 'nextrush';

const logger = createProdLogger();
// ✅ INFO level
// ✅ JSON format
// ✅ Console + file transports
// ✅ Longer flush interval (10s)
// ✅ Higher memory limits
```

## Test Logger

```typescript
import { createTestLogger } from 'nextrush';

const logger = createTestLogger();
// ✅ ERROR level only
// ✅ No timestamps
// ✅ Minimal memory usage
// ✅ Fast flush (100ms)
```

## Minimal Logger

```typescript
import { createMinimalLogger } from 'nextrush';

const logger = createMinimalLogger();
// ✅ INFO level
// ✅ Simple format
// ✅ Console only
// ✅ Small memory footprint
```

---

# 🔄 Automatic Request Logging

The Logger Plugin automatically logs all HTTP requests when installed.

## What's logged automatically

```typescript
// Request start
"Request started: GET /api/users" {
  requestId: "req_123",
  method: "GET",
  url: "/api/users?limit=10",
  userAgent: "Mozilla/5.0...",
  ip: "192.168.1.100"
}

// Request completion
"Request completed: 200" {
  requestId: "req_123",
  statusCode: 200,
  duration: 45  // milliseconds
}

// Request errors
"Request failed" {
  requestId: "req_123",
  error: "Database connection timeout",
  duration: 5000
}
```

## Customizing request logging

```typescript
const logger = new LoggerPlugin({
  // Only log errors and warnings
  level: LogLevel.WARN,
});

// Request logging can be customized through middleware
app.use(async (ctx, next) => {
  // Skip logging for health checks
  if (ctx.path === '/health') {
    await next();
    return;
  }

  // Add custom request context
  ctx.logger?.info('Processing request', {
    userId: ctx.state.user?.id,
    sessionId: ctx.headers['x-session-id'],
  });

  await next();
});
```

---

# 🚀 Complete Examples

## Basic API server with logging

```typescript
import { createApp, LoggerPlugin, LogLevel } from 'nextrush';

const app = createApp();

// Configure logger
const logger = new LoggerPlugin({
  level: LogLevel.INFO,
  format: 'json',
  transports: [
    { type: 'console' },
    { type: 'file', options: { path: './logs/api.log' } },
  ],
});

logger.install(app);

// Routes with logging
app.get('/users/:id', async ctx => {
  const { id } = ctx.params;

  app.logger.info('Fetching user', { userId: id });

  try {
    const user = await getUserById(id);

    if (!user) {
      app.logger.warn('User not found', { userId: id });
      ctx.res.status(404).json({ error: 'User not found' });
      return;
    }

    app.logger.info('User fetched successfully', {
      userId: id,
      userEmail: user.email,
    });

    ctx.json(user);
  } catch (error) {
    app.logger.error('Failed to fetch user', {
      userId: id,
      error: error.message,
      stack: error.stack,
    });

    ctx.res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3000);
```

## Production logging setup

```typescript
import { createApp, LoggerPlugin, LogLevel } from 'nextrush';
import { FileTransport, HttpTransport } from 'nextrush';

const app = createApp();

// Production logger configuration
const logger = new LoggerPlugin({
  level: process.env.LOG_LEVEL || LogLevel.INFO,
  format: 'json',
  maxEntries: 10000,
  flushInterval: 10000,
  maxMemoryUsage: 200,
  asyncFlush: true,
});

// Add multiple transports
logger.addTransport(new FileTransport('./logs/app.log', LogLevel.INFO));
logger.addTransport(new FileTransport('./logs/error.log', LogLevel.ERROR));

// Send errors to external service
if (process.env.LOG_ENDPOINT) {
  logger.addTransport(
    new HttpTransport(process.env.LOG_ENDPOINT, LogLevel.ERROR)
  );
}

logger.install(app);

// Error monitoring
logger.on('log', entry => {
  if (entry.level === LogLevel.ERROR) {
    // Alert on errors
    notifyOpsTeam(entry);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  app.logger.info('Received SIGTERM, shutting down gracefully');

  // Flush remaining logs
  logger.flush();

  // Wait for logs to be written
  await new Promise(resolve => setTimeout(resolve, 1000));

  process.exit(0);
});

app.listen(3000);
```

## Custom transport example

```typescript
import { LoggerPlugin, LogLevel } from 'nextrush';
import type { Transport, LogEntry } from 'nextrush';

// Custom database transport
class DatabaseTransport implements Transport {
  name = 'database';
  level = 'info';

  async write(entry: LogEntry): Promise<void> {
    try {
      await db.logs.insert({
        timestamp: entry.timestamp,
        level: entry.level,
        message: entry.message,
        context: JSON.stringify(entry.context),
        created_at: new Date(),
      });
    } catch (error) {
      console.error('Failed to write log to database:', error);
    }
  }
}

// Use custom transport
const logger = new LoggerPlugin();
logger.addTransport(new DatabaseTransport());

logger.install(app);
```

---

# 🔍 TypeScript Support

Full TypeScript support with proper type definitions:

```typescript
import type {
  LoggerPlugin,
  LoggerConfig,
  LogEntry,
  Transport,
  LogLevel,
} from 'nextrush';

// Type-safe configuration
const config: LoggerConfig = {
  level: LogLevel.DEBUG,
  format: 'json',
  timestamp: true,
  maxEntries: 1000,
};

// Type-safe log entry
const entry: LogEntry = {
  timestamp: new Date(),
  level: LogLevel.INFO,
  message: 'User action',
  context: {
    userId: '123',
    action: 'login',
  },
};

// Custom transport with types
class CustomTransport implements Transport {
  name = 'custom';
  level = 'info';

  write(entry: LogEntry): void {
    // Type-safe implementation
  }
}
```

---

# ⚡ Performance notes

- **Async flushing** prevents blocking on I/O operations
- **Memory limits** automatically prevent memory leaks
- **Transport caching** reduces overhead for repeated writes
- **Level filtering** skips processing of disabled log levels
- **Batch flushing** reduces I/O operations

# 🔒 Security notes

- **Sensitive data filtering** - Avoid logging passwords, tokens, etc.
- **Log injection protection** - Input sanitization for external transports
- **File permissions** - Secure log file access in production
- **Remote logging** - Use HTTPS for HTTP transports

# 📚 See also

- [Middleware API](./middleware.md) - Built-in middleware including basic logger
- [Context API](./context.md) - Accessing logger in request context
- [Error Handling](./errors.md) - Error logging patterns
- [Plugin Architecture](../architecture/plugin-system.md) - How plugins work

---

_Added in v2.0.0-alpha.1_
