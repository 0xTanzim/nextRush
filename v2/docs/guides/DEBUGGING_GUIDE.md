# NextRush v2 Debugging Guide 🐛

## Overview

This guide provides comprehensive debugging techniques, tools, and best practices for troubleshooting NextRush v2 applications.

## Table of Contents

1. [Built-in Debugging Tools](#built-in-debugging-tools)
2. [Common Issues & Solutions](#common-issues--solutions)
3. [Performance Debugging](#performance-debugging)
4. [Memory Debugging](#memory-debugging)
5. [Request/Response Debugging](#requestresponse-debugging)
6. [Middleware Debugging](#middleware-debugging)
7. [DI Container Debugging](#di-container-debugging)
8. [Production Debugging](#production-debugging)

---

## Built-in Debugging Tools

### 1. Development Mode Warnings

NextRush v2 automatically provides helpful warnings in development mode:

```typescript
import { createApp } from 'nextrush';

// Automatic development warnings enabled
const app = createApp();

// Common issues are automatically detected:
app.use((ctx, next) => {
  // ❌ Missing 'async'
  console.log('Request:', ctx.path);
  next(); // ❌ Missing 'await'
});

// NextRush will warn:
// 🚨 Middleware Error: Non-async middleware detected
```

### 2. Context Debugging

Use the built-in context debugger for request inspection:

```typescript
import { debugContext } from 'nextrush/dev-experience';

app.use(async (ctx, next) => {
  debugContext(ctx); // Logs detailed context information
  await next();
});

// Output:
// 🔍 Context Debug Info:
// ────────────────────────────────────────
// Method: GET
// Path: /users/123
// Status: 200
// Headers: { ... }
// Query: { ... }
// Params: { ... }
```

### 3. Enhanced Error Messages

NextRush v2 provides developer-friendly error messages with suggestions:

```typescript
import { createErrorHandler } from 'nextrush/dev-experience';

// Install enhanced error handler
app.use(
  createErrorHandler({
    showStackTrace: true, // Show stack traces in development
    logErrors: true, // Log errors with suggestions
  })
);

// Example error output:
// 🚨 NextRushError: Service 'userService' not found
// Code: DI_ERROR
// Status: 500
//
// 💡 Suggestions:
// 1. Register the service: container.register('userService', UserService)
// 2. Check service name spelling and case sensitivity
// 3. Ensure service is registered before resolution
```

---

## Common Issues & Solutions

### Issue 1: Middleware Not Working

**Problem**: Middleware doesn't seem to execute

**Debugging Steps**:

```typescript
// 1. Check middleware registration order
app.use(async (ctx, next) => {
  console.log('Middleware 1 - Before');
  await next();
  console.log('Middleware 1 - After');
});

app.use(async (ctx, next) => {
  console.log('Middleware 2 - Before');
  await next();
  console.log('Middleware 2 - After');
});

// Expected output for GET /test:
// Middleware 1 - Before
// Middleware 2 - Before
// Middleware 2 - After
// Middleware 1 - After
```

**Common Solutions**:

- Ensure middleware is `async`
- Always `await next()`
- Check middleware registration order
- Verify route handler exists

### Issue 2: Context Properties Undefined

**Problem**: `ctx.body`, `ctx.params`, etc. are undefined

**Debugging**:

```typescript
app.use(async (ctx, next) => {
  console.log('Route matched:', ctx.path);
  console.log('Method:', ctx.method);
  console.log('Params available:', Object.keys(ctx.params));
  console.log('Query available:', Object.keys(ctx.query));
  await next();
});

app.get('/users/:id', async ctx => {
  // Debug specific properties
  if (!ctx.params.id) {
    console.error('❌ Missing route parameter: id');
  }

  if (!ctx.body && ctx.method === 'POST') {
    console.error('❌ Missing request body - check body parser middleware');
  }
});
```

**Solutions**:

- Ensure body parser middleware is installed for POST/PUT requests
- Check route parameter syntax: `/users/:id` not `/users/{id}`
- Verify Content-Type headers for request body

### Issue 3: DI Container Resolution Failures

**Problem**: Services not resolving from DI container

**Debugging**:

```typescript
const container = app.getContainer();

// Debug container state
console.log('Registered services:', container.getRegisteredServices());

// Try resolution with error handling
try {
  const service = container.resolve('userService');
  console.log('✅ Service resolved successfully');
} catch (error) {
  console.error('❌ Service resolution failed:', error.message);
}

// Check registration
if (!container.isRegistered('userService')) {
  console.error('❌ Service not registered');
  // Register it
  container.register('userService', UserService);
}
```

---

## Performance Debugging

### 1. Request Timing

Use the built-in timer middleware to measure performance:

```typescript
import { timer } from 'nextrush/middleware';

app.use(
  timer({
    measureMemory: true,
    reportThreshold: 100, // Report requests > 100ms
    logSlowRequests: true,
  })
);

// Access timing in routes
app.get('/users', async ctx => {
  const users = await getUsersFromDB();

  // Check timing
  console.log(`Request took: ${ctx.timer?.duration}ms`);
  console.log(`Memory delta: ${ctx.timer?.memoryDelta}MB`);

  ctx.res.json(users);
});
```

### 2. Route Performance Analysis

Debug slow routes with detailed timing:

```typescript
app.use(async (ctx, next) => {
  const start = Date.now();

  await next();

  const duration = Date.now() - start;
  if (duration > 100) {
    console.warn(`🐌 Slow route: ${ctx.method} ${ctx.path} (${duration}ms)`);
  }
});
```

### 3. Memory Usage Monitoring

Track memory usage patterns:

```typescript
app.use(async (ctx, next) => {
  const memBefore = process.memoryUsage();

  await next();

  const memAfter = process.memoryUsage();
  const heapDelta = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

  if (heapDelta > 10) {
    // > 10MB increase
    console.warn(
      `💾 High memory usage: ${heapDelta.toFixed(2)}MB for ${ctx.path}`
    );
  }
});
```

---

## Memory Debugging

### 1. Memory Leak Detection

Detect potential memory leaks:

```typescript
// Monitor heap size over time
setInterval(() => {
  const usage = process.memoryUsage();
  const heapMB = (usage.heapUsed / 1024 / 1024).toFixed(2);

  if (parseFloat(heapMB) > 200) {
    // Alert if > 200MB
    console.warn(`⚠️  High heap usage: ${heapMB}MB`);
  }
}, 60000); // Check every minute

// Force garbage collection (Node.js --expose-gc flag)
if (global.gc && Math.random() < 0.01) {
  global.gc();
}
```

### 2. Object Pool Monitoring

Debug buffer pool usage:

```typescript
app.use(async (ctx, next) => {
  // Log buffer pool stats
  if (ctx.bufferPool) {
    console.log('Buffer pool size:', ctx.bufferPool.size);
    console.log('Buffer pool utilization:', ctx.bufferPool.utilization);
  }

  await next();
});
```

---

## Request/Response Debugging

### 1. Request Inspection

Log detailed request information:

```typescript
app.use(async (ctx, next) => {
  console.log('\n📥 Incoming Request:');
  console.log('─'.repeat(40));
  console.log(`${ctx.method} ${ctx.url}`);
  console.log('Headers:', JSON.stringify(ctx.headers, null, 2));
  console.log('Query:', ctx.query);
  console.log('Params:', ctx.params);
  console.log('Body:', ctx.body);
  console.log('─'.repeat(40));

  await next();

  console.log('\n📤 Outgoing Response:');
  console.log('─'.repeat(40));
  console.log('Status:', ctx.status);
  console.log('Headers:', ctx.res.getHeaders());
  console.log('Body length:', JSON.stringify(ctx.body).length);
  console.log('─'.repeat(40));
});
```

### 2. Response Validation

Validate response data:

```typescript
app.use(async (ctx, next) => {
  await next();

  // Validate response
  if (ctx.status >= 400) {
    console.error(`❌ Error response: ${ctx.status} for ${ctx.path}`);
    console.error('Error body:', ctx.body);
  }

  if (!ctx.body && ctx.status === 200) {
    console.warn(`⚠️  Empty response body for successful request: ${ctx.path}`);
  }
});
```

---

## Middleware Debugging

### 1. Middleware Execution Tracking

Track middleware execution order:

```typescript
function createTrackedMiddleware(name: string, middleware: Function) {
  return async (ctx: Context, next: Next) => {
    console.log(`🔄 [${name}] Starting`);
    const start = Date.now();

    try {
      await middleware(ctx, next);
      const duration = Date.now() - start;
      console.log(`✅ [${name}] Completed (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`❌ [${name}] Failed (${duration}ms):`, error.message);
      throw error;
    }
  };
}

// Usage
app.use(createTrackedMiddleware('CORS', cors()));
app.use(createTrackedMiddleware('Body Parser', bodyParser()));
app.use(createTrackedMiddleware('Auth', authMiddleware));
```

### 2. Middleware State Debugging

Track state changes between middleware:

```typescript
app.use(async (ctx, next) => {
  const stateBefore = { ...ctx.state };

  await next();

  const stateAfter = { ...ctx.state };

  // Log state changes
  const changes = Object.keys(stateAfter).filter(
    key => stateAfter[key] !== stateBefore[key]
  );

  if (changes.length > 0) {
    console.log('State changes:', changes);
  }
});
```

---

## DI Container Debugging

### 1. Service Registration Debugging

Track service registrations:

```typescript
const container = app.getContainer();

// Override register method to add logging
const originalRegister = container.register.bind(container);
container.register = (name: string, service: any, options?: any) => {
  console.log(`📦 Registering service: ${name}`);
  return originalRegister(name, service, options);
};

// Override resolve method to add logging
const originalResolve = container.resolve.bind(container);
container.resolve = <T>(name: string): T => {
  console.log(`🔍 Resolving service: ${name}`);
  try {
    const service = originalResolve<T>(name);
    console.log(`✅ Resolved service: ${name}`);
    return service;
  } catch (error) {
    console.error(`❌ Failed to resolve service: ${name}`, error.message);
    throw error;
  }
};
```

### 2. Circular Dependency Detection

Detect circular dependencies:

```typescript
const resolutionStack = new Set<string>();

function detectCircularDependency(serviceName: string): boolean {
  if (resolutionStack.has(serviceName)) {
    console.error(
      `🔄 Circular dependency detected: ${Array.from(resolutionStack).join(' -> ')} -> ${serviceName}`
    );
    return true;
  }

  resolutionStack.add(serviceName);
  // ... resolution logic ...
  resolutionStack.delete(serviceName);

  return false;
}
```

---

## Production Debugging

### 1. Structured Logging

Use structured logging for production debugging:

```typescript
import { LoggerPlugin } from 'nextrush/plugins';

const logger = new LoggerPlugin({
  level: 'info',
  format: 'json',
  transports: [
    new FileTransport({ filename: 'app.log' }),
    new FileTransport({ filename: 'error.log', level: 'error' }),
  ],
});

logger.install(app);

// Use structured logging
app.use(async (ctx, next) => {
  ctx.logger?.info('Request started', {
    method: ctx.method,
    path: ctx.path,
    ip: ctx.ip,
    userAgent: ctx.get('user-agent'),
  });

  await next();

  ctx.logger?.info('Request completed', {
    status: ctx.status,
    duration: ctx.timer?.duration,
  });
});
```

### 2. Health Check Debugging

Implement comprehensive health checks:

```typescript
app.get('/health', async ctx => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version,
    environment: process.env['NODE_ENV'],
    services: {},
  };

  // Check database connection
  try {
    await checkDatabaseConnection();
    health.services.database = 'ok';
  } catch (error) {
    health.services.database = 'error';
    health.status = 'degraded';
  }

  // Check external APIs
  try {
    await checkExternalAPI();
    health.services.externalAPI = 'ok';
  } catch (error) {
    health.services.externalAPI = 'error';
    health.status = 'degraded';
  }

  ctx.status = health.status === 'ok' ? 200 : 503;
  ctx.res.json(health);
});
```

### 3. Error Tracking Integration

Integrate with error tracking services:

```typescript
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    // Send to error tracking service (e.g., Sentry)
    if (process.env['SENTRY_DSN']) {
      Sentry.captureException(error, {
        contexts: {
          request: {
            method: ctx.method,
            url: ctx.url,
            headers: ctx.headers,
            body: ctx.body,
          },
        },
      });
    }

    throw error;
  }
});
```

---

## Debugging Checklist

### Before Production

- [ ] Enable comprehensive logging
- [ ] Set up error tracking
- [ ] Implement health checks
- [ ] Configure monitoring dashboards
- [ ] Test error scenarios
- [ ] Validate performance metrics

### When Issues Occur

- [ ] Check application logs
- [ ] Review error tracking dashboard
- [ ] Monitor memory usage trends
- [ ] Analyze request patterns
- [ ] Check external service dependencies
- [ ] Review recent deployments

### Common Debug Commands

```bash
# Memory usage
node --expose-gc --inspect app.js

# CPU profiling
node --prof app.js
node --prof-process isolate-*.log > profile.txt

# Heap snapshot
kill -USR2 <pid>  # Triggers heap snapshot

# Debug logs
DEBUG=nextrush:* node app.js

# Memory leak detection
node --trace-gc app.js
```

---

## Best Practices

### 1. Logging Strategy

- Use structured logging (JSON format)
- Log at appropriate levels (error, warn, info, debug)
- Include request context in logs
- Avoid logging sensitive information

### 2. Error Handling

- Use specific error types
- Include helpful error messages
- Provide actionable suggestions
- Log errors with full context

### 3. Monitoring

- Monitor key metrics (response time, error rate, memory)
- Set up alerting for critical issues
- Use distributed tracing for complex applications
- Monitor external dependencies

### 4. Development Workflow

- Use development mode warnings
- Enable detailed error messages
- Test error scenarios
- Profile performance regularly

---

_This debugging guide helps you quickly identify and resolve issues in NextRush v2 applications, from development to production._
