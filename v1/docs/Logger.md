# 📊 NextRush Logger Plugin

## 📋 Table of Contents

- [🎯 Overview](#-overview)
- [✨ Key Features](#-key-features)
- [🚀 Quick Start](#-quick-start)
- [🔧 Public APIs](#-public-apis)
- [⚙️ Configuration Options](#️-configuration-options)
- [🚚 Transports](#-transports)
- [💻 Usage Examples](#-usage-examples)
- [🎯 Advanced Features](#-advanced-features)
- [📊 Performance & Monitoring](#-performance--monitoring)
- [🛠️ Best Practices](#️-best-practices)
- [🚨 Troubleshooting](#-troubleshooting)

---

## 🎯 Overview

NextRush provides **enterprise-grade logging** with multiple transports, structured logging, and zero external dependencies. Built for high-performance applications, the logger supports console, file, HTTP, and custom transports with automatic request tracking and performance monitoring.

### 🏗️ Architecture

The logger system uses a **plugin-based architecture** with specialized components:

- **📊 Logger Core**: High-performance logging engine with multiple transports
- **🚚 Transport System**: Console, file, HTTP, and custom output destinations
- **🔍 Request Tracking**: Automatic HTTP request logging with correlation IDs
- **📈 Performance Metrics**: Built-in performance tracking and analytics
- **👶 Child Loggers**: Component-specific loggers with inherited metadata
- **🏭 Logger Factory**: Pre-configured loggers for different environments

---

## ✨ Key Features

| Feature                    | Description                              | Performance Impact  |
| -------------------------- | ---------------------------------------- | ------------------- |
| **🚚 Multiple Transports** | Console, file, HTTP, and custom outputs  | Concurrent writing  |
| **📊 Structured Logging**  | JSON and formatted output with metadata  | Fast serialization  |
| **🔍 Request Correlation** | Automatic request ID tracking            | Zero overhead       |
| **📈 Performance Metrics** | Built-in middleware performance tracking | < 1ms overhead      |
| **👶 Child Loggers**       | Component-specific loggers with context  | Memory efficient    |
| **📁 File Rotation**       | Automatic log rotation with compression  | Size-based rotation |
| **🌐 Remote Logging**      | HTTP transport for centralized logging   | Batched sending     |
| **⚡ Zero Dependencies**   | Built with Node.js native modules        | Minimal bundle size |

---

## 🚀 Quick Start

### Basic Logger Usage

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// 📊 Basic logging (automatic with LoggerPlugin)
app.log.info('Application started');
app.log.error('Something went wrong', error);

// 🔍 Request logging (automatic)
app.get('/api/users', (req, res) => {
  req.logger.info('Fetching users', { userId: req.user?.id });
  res.json({ users: [] });
});

app.listen(3000);
```

### Custom Logger Configuration

```typescript
import { createApp, LoggerFactory, FileTransport } from 'nextrush';

const app = createApp();

// 🏭 Production logger with file output
const logger = LoggerFactory.createProduction({
  logFile: './logs/app.log',
  httpEndpoint: 'https://logs.company.com/api/logs',
});

app.setLogger(logger);
app.listen(3000);
```

---

## 🔧 Public APIs

### Core Logger Methods

| Method    | Signature                                                          | Description           |
| --------- | ------------------------------------------------------------------ | --------------------- |
| `debug()` | `(message: string, metadata?: LogMetadata) => void`                | Debug level logging   |
| `info()`  | `(message: string, metadata?: LogMetadata) => void`                | Info level logging    |
| `warn()`  | `(message: string, metadata?: LogMetadata) => void`                | Warning level logging |
| `error()` | `(message: string, error?: Error, metadata?: LogMetadata) => void` | Error level logging   |
| `fatal()` | `(message: string, error?: Error, metadata?: LogMetadata) => void` | Fatal level logging   |

### Application Logger APIs

| Method                | Signature                                        | Description                     |
| --------------------- | ------------------------------------------------ | ------------------------------- |
| `app.log.*`           | `LoggerMethods`                                  | Direct access to logger methods |
| `app.logger`          | `Logger`                                         | Access to main logger instance  |
| `app.getLogger()`     | `(component: string) => ChildLogger`             | Get component-specific logger   |
| `app.createLogger()`  | `(options: LoggerOptions) => Logger`             | Create custom logger            |
| `app.requestLogger()` | `(options?: RequestLoggerOptions) => Middleware` | Request logging middleware      |

### Transport Classes

| Transport          | Description                | Use Case                    |
| ------------------ | -------------------------- | --------------------------- |
| `ConsoleTransport` | Console output with colors | Development and debugging   |
| `FileTransport`    | File output with rotation  | Production logging          |
| `HttpTransport`    | Remote HTTP logging        | Centralized log aggregation |
| `CustomTransport`  | User-defined transport     | Custom integrations         |

### Logger Factory

| Method                              | Description                  | Environment     |
| ----------------------------------- | ---------------------------- | --------------- |
| `LoggerFactory.getDefault()`        | Default logger instance      | General purpose |
| `LoggerFactory.createDevelopment()` | Development-optimized logger | Development     |
| `LoggerFactory.createProduction()`  | Production-ready logger      | Production      |
| `LoggerFactory.createTesting()`     | Testing-optimized logger     | Testing         |

---

## ⚙️ Configuration Options

### Logger Options

```typescript
interface LoggerOptions {
  level?: LogLevel; // Minimum log level
  format?: LogFormat; // Output format
  transports?: LogTransport[]; // Output destinations
  silent?: boolean; // Disable all output
  exitOnError?: boolean; // Exit on fatal errors
  handleExceptions?: boolean; // Handle uncaught exceptions
  handleRejections?: boolean; // Handle promise rejections
}
```

### Request Logger Options

```typescript
interface RequestLoggerOptions {
  level?: LogLevel; // Log level for requests
  format?: LogFormat; // Request log format
  skip?: (req, res) => boolean; // Skip logging condition
  immediate?: boolean; // Log immediately
  colorize?: boolean; // Colorize console output
}
```

### Transport Options

| Option     | Type        | Default    | Description                       |
| ---------- | ----------- | ---------- | --------------------------------- |
| `level`    | `LogLevel`  | `'info'`   | Minimum log level                 |
| `format`   | `LogFormat` | `'simple'` | Output format                     |
| `filename` | `string`    | Required   | Log file path (FileTransport)     |
| `maxSize`  | `number`    | `10MB`     | Max file size before rotation     |
| `maxFiles` | `number`    | `5`        | Max number of rotated files       |
| `url`      | `string`    | Required   | HTTP endpoint (HttpTransport)     |
| `colorize` | `boolean`   | `true`     | Console colors (ConsoleTransport) |

---

## 🚚 Transports

### Console Transport

```typescript
import { ConsoleTransport } from 'nextrush';

const consoleTransport = new ConsoleTransport({
  level: 'debug',
  format: 'simple',
  colorize: true,
  timestamp: true,
});
```

### File Transport with Rotation

```typescript
import { FileTransport } from 'nextrush';

const fileTransport = new FileTransport({
  filename: './logs/application.log',
  level: 'info',
  format: 'json',
  maxSize: 50 * 1024 * 1024, // 50MB
  maxFiles: 10,
  rotate: true,
  compress: false,
});
```

### HTTP Transport for Remote Logging

```typescript
import { HttpTransport } from 'nextrush';

const httpTransport = new HttpTransport({
  url: 'https://logs.example.com/api/ingest',
  level: 'warn',
  format: 'json',
  method: 'POST',
  headers: {
    Authorization: 'Bearer your-token',
  },
  timeout: 5000,
});
```

### Custom Transport

```typescript
import { CustomTransport } from 'nextrush';

const customTransport = new CustomTransport(
  'slack',
  async (entry) => {
    if (entry.level === 'error') {
      await sendToSlack(entry.message);
    }
  },
  { level: 'error' }
);
```

---

## 💻 Usage Examples

### 🎯 Production Application

```typescript
import {
  createApp,
  LoggerFactory,
  FileTransport,
  HttpTransport,
} from 'nextrush';

const app = createApp();

// 🏭 Production logger configuration
const logger = new Logger({
  level: 'info',
  transports: [
    new ConsoleTransport({
      format: 'json',
      colorize: false,
    }),
    new FileTransport({
      filename: './logs/app.log',
      format: 'json',
      maxSize: 100 * 1024 * 1024, // 100MB
      maxFiles: 5,
    }),
    new HttpTransport({
      url: 'https://logs.company.com/api/ingest',
      level: 'warn',
    }),
  ],
  handleExceptions: true,
  handleRejections: true,
});

app.setLogger(logger);

// 🔍 Structured logging with context
app.get('/api/users/:id', (req, res) => {
  const userLogger = req.logger.child({ userId: req.params.id });

  userLogger.info('Fetching user profile');

  try {
    const user = getUserById(req.params.id);
    userLogger.info('User profile retrieved', {
      email: user.email,
      lastLogin: user.lastLogin,
    });
    res.json(user);
  } catch (error) {
    userLogger.error('Failed to fetch user', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### 🧪 Development Setup

```typescript
import { createApp, LoggerFactory } from 'nextrush';

const app = createApp();

// 🛠️ Development logger with enhanced debugging
const devLogger = LoggerFactory.createDevelopment();
app.setLogger(devLogger);

// 📊 Custom request logging for development
app.use(
  app.requestLogger({
    format: 'dev',
    colorize: true,
    immediate: true,
  })
);

// 🔍 Component-specific logging
const dbLogger = app.getLogger('database');
const apiLogger = app.getLogger('api');

dbLogger.debug('Database connection established');
apiLogger.info('API routes registered');
```

### 🏥 Microservices with Correlation

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// 🔗 Request correlation middleware
app.use((req, res, next) => {
  const correlationId =
    req.headers['x-correlation-id'] ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  req.logger = app.logger.child({
    correlationId,
    service: 'user-service',
    version: '1.2.3',
  });

  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

// 📡 Service communication logging
app.post('/api/users', async (req, res) => {
  req.logger.info('Creating new user', { email: req.body.email });

  try {
    // Call other services with correlation
    const profile = await callProfileService(req.body, {
      headers: { 'X-Correlation-ID': req.correlationId },
    });

    req.logger.info('User created successfully', { userId: profile.id });
    res.json(profile);
  } catch (error) {
    req.logger.error('User creation failed', error);
    res.status(500).json({ error: 'Creation failed' });
  }
});
```

### 📊 Performance Monitoring

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// 📈 Performance logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    req.logger.info('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    // Alert on slow requests
    if (duration > 1000) {
      req.logger.warn('Slow request detected', {
        threshold: 1000,
        actual: duration,
      });
    }
  });

  next();
});

// 🎯 API endpoint with detailed logging
app.get('/api/analytics', async (req, res) => {
  const analyticsLogger = req.logger.child({ endpoint: 'analytics' });

  analyticsLogger.info('Analytics request started');

  const queryStart = Date.now();
  const data = await runAnalyticsQuery(req.query);
  const queryDuration = Date.now() - queryStart;

  analyticsLogger.info('Query completed', {
    query: req.query,
    resultCount: data.length,
    queryDuration,
  });

  res.json({ data, meta: { count: data.length } });
});
```

---

## 🎯 Advanced Features

### 👶 Child Loggers

```typescript
// Create component-specific loggers
const dbLogger = app.getLogger('database');
const cacheLogger = app.getLogger('cache');
const authLogger = app.getLogger('auth');

// Child loggers inherit parent context
const userAuthLogger = authLogger.child({ module: 'user-auth' });
userAuthLogger.info('User login attempt'); // Includes component and module
```

### 🔍 Dynamic Log Levels

```typescript
// Runtime log level changes
app.post('/admin/log-level', (req, res) => {
  const { level } = req.body;

  app.logger.setLevel(level);
  req.logger.info('Log level changed', { newLevel: level });

  res.json({ success: true, level });
});
```

### 📊 Custom Formatters

```typescript
const customTransport = new CustomTransport('custom-format', (entry) => {
  const formatted = `[${entry.timestamp.toISOString()}] ${entry.level.toUpperCase()}: ${
    entry.message
  }`;
  console.log(formatted);
});

logger.addTransport(customTransport);
```

### 🌐 Distributed Tracing

```typescript
app.use((req, res, next) => {
  const traceId = req.headers['x-trace-id'] || generateTraceId();
  const spanId = generateSpanId();

  req.logger = app.logger.child({
    traceId,
    spanId,
    parentSpanId: req.headers['x-parent-span-id'],
  });

  next();
});
```

---

## 📊 Performance & Monitoring

### Built-in Metrics

| Metric             | Description               | Use Case               |
| ------------------ | ------------------------- | ---------------------- |
| `totalLogs`        | Total log entries written | Volume tracking        |
| `logsByLevel`      | Logs grouped by level     | Error rate monitoring  |
| `transportMetrics` | Per-transport performance | Transport optimization |
| `averageWriteTime` | Mean write duration       | Performance tuning     |

### Log Analytics

```typescript
// Get logger statistics
const stats = app.logger.getTransport('file').getStats();
console.log('File transport stats:', stats);

// Monitor error rates
app.get('/admin/log-stats', (req, res) => {
  const metrics = app.logger.getMetrics();
  res.json({
    totalLogs: metrics.totalLogs,
    errorRate: metrics.errorLogs / metrics.totalLogs,
    averageWriteTime: metrics.averageWriteTime,
  });
});
```

### Performance Benchmarks

| Configuration  | Logs/sec | Memory Usage | CPU Impact |
| -------------- | -------- | ------------ | ---------- |
| Console Only   | 50,000+  | 10MB         | < 1%       |
| File Transport | 25,000+  | 20MB         | < 2%       |
| HTTP Transport | 10,000+  | 30MB         | < 3%       |
| All Transports | 8,000+   | 40MB         | < 5%       |

---

## 🛠️ Best Practices

### ✅ Performance Optimization

1. **🎯 Use appropriate log levels** for different environments
2. **📊 Structure your logs** with consistent metadata
3. **🚚 Choose transports wisely** based on requirements
4. **📁 Configure file rotation** to prevent disk space issues
5. **📈 Monitor transport performance** and adjust accordingly
6. **👶 Use child loggers** for component isolation

### ✅ Security Considerations

1. **🔒 Avoid logging sensitive data** (passwords, tokens, PII)
2. **🌐 Secure HTTP transports** with proper authentication
3. **📁 Protect log files** with appropriate permissions
4. **🧹 Implement log retention** policies for compliance
5. **🔍 Monitor for log injection** attacks
6. **📊 Audit logging configuration** regularly

### ✅ Production Deployment

```typescript
// 🏭 Production-ready configuration
const prodLogger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new FileTransport({
      filename: './logs/app.log',
      maxSize: 100 * 1024 * 1024,
      maxFiles: 10,
      format: 'json',
    }),
    new HttpTransport({
      url: process.env.LOG_ENDPOINT,
      level: 'warn',
      headers: {
        Authorization: `Bearer ${process.env.LOG_TOKEN}`,
      },
    }),
  ],
  handleExceptions: true,
  handleRejections: true,
});
```

### ✅ Development Workflow

```typescript
// 🧪 Development configuration
if (process.env.NODE_ENV === 'development') {
  app.use(
    app.requestLogger({
      format: 'dev',
      colorize: true,
    })
  );

  app.logger.setLevel('debug');
} else {
  app.use(
    app.requestLogger({
      format: 'combined',
      skip: (req) => req.url.startsWith('/health'),
    })
  );
}
```

---

## 🚨 Troubleshooting

### Common Issues

#### 📁 File Transport Not Writing

```typescript
// ❌ Problem: Permission denied
new FileTransport({ filename: '/var/log/app.log' });

// ✅ Solution: Use writable directory
new FileTransport({ filename: './logs/app.log' });
```

#### 🌐 HTTP Transport Failing

```typescript
// ❌ Problem: Network timeouts
new HttpTransport({
  url: 'https://slow-endpoint.com/logs',
  timeout: 1000, // Too short
});

// ✅ Solution: Increase timeout and add retry
new HttpTransport({
  url: 'https://logs.company.com/api',
  timeout: 10000,
  // Implement retry logic in custom transport
});
```

#### 📊 High Memory Usage

```typescript
// ❌ Problem: Too much buffering
new HttpTransport({
  url: 'https://logs.company.com',
  batchSize: 1000, // Too large
});

// ✅ Solution: Reduce batch size
new HttpTransport({
  url: 'https://logs.company.com',
  batchSize: 50,
  flushInterval: 5000,
});
```

#### 🔍 Missing Request Logs

```typescript
// ❌ Problem: No request logger middleware
app.get('/api/users', handler);

// ✅ Solution: Add request logger
app.use(app.requestLogger());
app.get('/api/users', handler);
```

### Debug Mode

```typescript
// 🐛 Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Debug transport issues
const logger = new Logger({
  level: 'debug',
  transports: [new ConsoleTransport({ level: 'debug' })],
});

logger.debug('Debug logging enabled');
```

---

## 📚 Additional Resources

- **🔗 [NextRush Documentation](./README.md)**: Main framework documentation
- **🎯 [Performance Guide](./Performance.md)**: Optimization strategies
- **🔒 [Security Guide](./SECURITY.md)**: Security best practices
- **🚀 [Migration Guide](./MIGRATION.md)**: Migrate from other loggers
- **🧪 [Testing Guide](./Testing.md)**: Testing with loggers

---

**🎉 Ready to log like a pro!** The NextRush Logger Plugin provides enterprise-grade logging with multiple transports, structured output, and zero-dependency performance for modern applications.
