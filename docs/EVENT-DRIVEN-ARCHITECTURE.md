# NextRush Event-Driven Architecture

## 🚀 **Complete Event System Documentation**

NextRush includes a powerful, lightweight event-driven architecture that allows you to monitor, log, and react to application events in real-time.

## 📋 **Event System Overview**

The NextRush event system is designed to be:

- **Optional** - Can be completely disabled if not needed
- **Lightweight** - Minimal performance impact
- **Comprehensive** - Covers all major application events
- **Extensible** - Easy to add custom events

## 🔧 **Event System Setup**

### Basic Setup

```typescript
import NextRush, { enableSimpleLogging } from '@nextrush/core';

const app = new NextRush();

// Enable event logging (optional)
enableSimpleLogging();

// Events are automatically emitted for:
// - Request start/end
// - Errors
// - Route matches
// - Middleware execution
```

### Advanced Setup

```typescript
import NextRush, { SimpleEventEmitter } from '@nextrush/core';

const app = new NextRush();

// Get the event emitter
const eventEmitter = app.getEventEmitter();

// Enable/disable events
eventEmitter.setEnabled(true); // Enable events
eventEmitter.setEnabled(false); // Disable events (better performance)

// Check if events are enabled
const isEnabled = eventEmitter.isEnabled();
```

## 📊 **Event Types**

### Request Events

```typescript
// Request started
app.on('request', (data) => {
  console.log(`${data.method} ${data.url} from ${data.ip}`);
  // Event data:
  // {
  //   id: 'req_12345',
  //   method: 'GET',
  //   url: '/api/users',
  //   timestamp: 1640995200000,
  //   userAgent: 'Mozilla/5.0...',
  //   ip: '192.168.1.1'
  // }
});

// Request completed
app.on('response', (data) => {
  console.log(
    `${data.method} ${data.url} → ${data.statusCode} (${data.duration}ms)`
  );
  // Event data extends request data with:
  // {
  //   ...requestData,
  //   statusCode: 200,
  //   duration: 45  // milliseconds
  // }
});
```

### Error Events

```typescript
// Application errors
app.on('error', (data) => {
  console.error(`Error in ${data.method} ${data.url}:`, data.error);
  // Event data:
  // {
  //   id: 'req_12345',
  //   method: 'POST',
  //   url: '/api/users',
  //   timestamp: 1640995200000,
  //   error: Error object,
  //   userAgent: '...',
  //   ip: '...'
  // }
});
```

### Route Events

```typescript
// Route matched
app.on('route:match', (data) => {
  console.log(`Route matched: ${data.pattern} for ${data.url}`);
  // Event data:
  // {
  //   pattern: '/api/users/:id',
  //   url: '/api/users/123',
  //   method: 'GET',
  //   params: { id: '123' }
  // }
});

// Route not found
app.on('route:notfound', (data) => {
  console.log(`No route found for ${data.method} ${data.url}`);
});
```

### Middleware Events

```typescript
// Middleware executed
app.on('middleware:execute', (data) => {
  console.log(`Middleware executed: ${data.name} (${data.duration}ms)`);
  // Event data:
  // {
  //   name: 'authentication',
  //   duration: 12,
  //   requestId: 'req_12345'
  // }
});

// Middleware error
app.on('middleware:error', (data) => {
  console.error(`Middleware error in ${data.name}:`, data.error);
});
```

## 📈 **Event Statistics**

### Get Statistics

```typescript
// Get comprehensive statistics
const stats = eventEmitter.getStats();
console.log({
  totalRequests: stats.totalRequests,
  averageResponseTime: stats.averageResponseTime,
  errorRate: stats.errorRate,
  requestsPerSecond: stats.requestsPerSecond,
  uptime: stats.uptime,
});
```

### Performance Monitoring

```typescript
// Monitor performance in real-time
app.on('response', (data) => {
  if (data.duration > 1000) {
    console.warn(
      `Slow request: ${data.method} ${data.url} took ${data.duration}ms`
    );
  }

  if (data.statusCode >= 500) {
    console.error(`Server error: ${data.statusCode} for ${data.url}`);
  }
});
```

## 🔍 **Custom Events**

### Emit Custom Events

```typescript
// Emit custom application events
const eventEmitter = app.getEventEmitter();

// Custom business logic events
eventEmitter.emit('user:created', {
  userId: 123,
  email: 'user@example.com',
  timestamp: Date.now(),
});

eventEmitter.emit('order:completed', {
  orderId: 456,
  amount: 99.99,
  customerId: 789,
});
```

### Listen to Custom Events

```typescript
// Listen to custom events
app.on('user:created', (data) => {
  console.log(`New user created: ${data.email}`);
  // Send welcome email, create profile, etc.
});

app.on('order:completed', (data) => {
  console.log(`Order ${data.orderId} completed for $${data.amount}`);
  // Send confirmation, update inventory, etc.
});
```

## 📊 **Real-Time Monitoring**

### Request Monitoring

```typescript
// Monitor all requests in real-time
app.on('request', (data) => {
  // Log to external service
  logger.info('Request started', {
    requestId: data.id,
    method: data.method,
    url: data.url,
    userAgent: data.userAgent,
    ip: data.ip,
  });
});

app.on('response', (data) => {
  // Log response with performance metrics
  logger.info('Request completed', {
    requestId: data.id,
    statusCode: data.statusCode,
    duration: data.duration,
    method: data.method,
    url: data.url,
  });

  // Send to analytics service
  analytics.track('request_completed', {
    path: data.url,
    method: data.method,
    status: data.statusCode,
    duration: data.duration,
  });
});
```

### Error Monitoring

```typescript
// Comprehensive error tracking
app.on('error', (data) => {
  // Send to error tracking service
  errorTracker.captureException(data.error, {
    extra: {
      requestId: data.id,
      method: data.method,
      url: data.url,
      userAgent: data.userAgent,
      ip: data.ip,
    },
  });

  // Alert for critical errors
  if (data.error.statusCode >= 500) {
    alerting.send(`Server error: ${data.error.message} in ${data.url}`);
  }
});
```

## 🎯 **Event-Driven Middleware**

### Creating Event-Aware Middleware

```typescript
// Middleware that emits events
const auditMiddleware = (req, res, next) => {
  const eventEmitter = req.app.getEventEmitter();

  // Emit audit event
  eventEmitter.emit('audit:access', {
    userId: req.session?.userId,
    resource: req.path,
    method: req.method,
    ip: req.ip(),
    timestamp: Date.now(),
  });

  next();
};

// Use the middleware
app.use('/admin/*', auditMiddleware);

// Listen to audit events
app.on('audit:access', (data) => {
  auditLogger.log('Resource accessed', data);
});
```

### Rate Limiting with Events

```typescript
const rateLimitTracker = new Map();

app.on('request', (data) => {
  const clientIp = data.ip;
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window

  // Get or create request history for this IP
  if (!rateLimitTracker.has(clientIp)) {
    rateLimitTracker.set(clientIp, []);
  }

  const requests = rateLimitTracker.get(clientIp);

  // Remove old requests
  const recentRequests = requests.filter((time) => time > windowStart);
  recentRequests.push(now);
  rateLimitTracker.set(clientIp, recentRequests);

  // Check rate limit
  if (recentRequests.length > 100) {
    // 100 requests per minute
    app.getEventEmitter().emit('ratelimit:exceeded', {
      ip: clientIp,
      requestCount: recentRequests.length,
      windowStart,
      requestId: data.id,
    });
  }
});

// Handle rate limit exceeded
app.on('ratelimit:exceeded', (data) => {
  console.warn(
    `Rate limit exceeded for IP ${data.ip}: ${data.requestCount} requests`
  );
  // Could automatically block IP, send alert, etc.
});
```

## 📊 **Analytics & Metrics**

### Performance Analytics

```typescript
const performanceMetrics = {
  responseTimes: [],
  errorCounts: new Map(),
  requestCounts: new Map(),
};

// Collect response time metrics
app.on('response', (data) => {
  performanceMetrics.responseTimes.push(data.duration);

  // Keep only last 1000 requests
  if (performanceMetrics.responseTimes.length > 1000) {
    performanceMetrics.responseTimes.shift();
  }

  // Count requests by endpoint
  const endpoint = `${data.method} ${data.url.split('?')[0]}`;
  performanceMetrics.requestCounts.set(
    endpoint,
    (performanceMetrics.requestCounts.get(endpoint) || 0) + 1
  );
});

// Collect error metrics
app.on('error', (data) => {
  const errorType = data.error.constructor.name;
  performanceMetrics.errorCounts.set(
    errorType,
    (performanceMetrics.errorCounts.get(errorType) || 0) + 1
  );
});

// Generate metrics report
function getMetricsReport() {
  const responseTimes = performanceMetrics.responseTimes;
  return {
    averageResponseTime:
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
    p95ResponseTime:
      responseTimes.sort()[Math.floor(responseTimes.length * 0.95)],
    totalRequests: responseTimes.length,
    topEndpoints: Array.from(performanceMetrics.requestCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10),
    errorCounts: Object.fromEntries(performanceMetrics.errorCounts),
  };
}
```

## 🔧 **Event System Configuration**

### Performance Optimization

```typescript
// Disable events in production for better performance
const eventEmitter = app.getEventEmitter();

if (process.env.NODE_ENV === 'production') {
  // Disable events completely
  eventEmitter.setEnabled(false);
} else {
  // Enable events in development
  eventEmitter.setEnabled(true);
  enableSimpleLogging(); // Built-in console logging
}
```

### Custom Event Emitter

```typescript
import { EventEmitter } from 'events';

// Create custom event emitter with more listeners
const customEmitter = new EventEmitter();
customEmitter.setMaxListeners(50); // Default is 10

// Use custom emitter (advanced usage)
const app = new NextRush({
  eventEmitter: customEmitter,
});
```

## 📊 **Complete Monitoring Example**

```typescript
import NextRush, { enableSimpleLogging } from '@nextrush/core';

const app = new NextRush();

// Enable event logging in development
if (process.env.NODE_ENV !== 'production') {
  enableSimpleLogging();
}

// Comprehensive request monitoring
app.on('request', (data) => {
  console.log(`🟢 [${new Date().toISOString()}] ${data.method} ${data.url}`);
});

app.on('response', (data) => {
  const emoji = data.statusCode >= 400 ? '🔴' : '🟢';
  const color = data.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
  const reset = '\x1b[0m';

  console.log(
    `${emoji} ${color}${data.statusCode}${reset} ${data.method} ${data.url} - ${data.duration}ms`
  );
});

// Error monitoring
app.on('error', (data) => {
  console.error(`🚨 Error in ${data.method} ${data.url}:`, data.error.message);

  // Send to error tracking service in production
  if (process.env.NODE_ENV === 'production') {
    // errorTracker.captureException(data.error, { extra: data });
  }
});

// Route debugging
app.on('route:match', (data) => {
  console.log(`🎯 Route matched: ${data.pattern}`);
});

app.on('route:notfound', (data) => {
  console.warn(`❌ No route found: ${data.method} ${data.url}`);
});

// Performance monitoring
setInterval(() => {
  const stats = app.getEventEmitter().getStats();
  console.log('📊 Stats:', {
    totalRequests: stats.totalRequests,
    averageResponseTime: Math.round(stats.averageResponseTime),
    uptime: Math.round(stats.uptime / 1000) + 's',
  });
}, 30000); // Every 30 seconds

app.listen(3000);
```

## 🎯 **Advanced Event Features**

### Performance Monitoring Events

```typescript
// Performance threshold events
app.on('performance:slow', (data) => {
  console.warn(`Slow request detected: ${data.url} took ${data.duration}ms`);
  // Auto-triggered when request > threshold (default 1000ms)
});

app.on('performance:memory', (data) => {
  console.warn(`High memory usage: ${data.memoryUsage.heapUsed}MB`);
  // Auto-triggered when memory > threshold
});

// Custom performance events
app.on('performance:custom', (data) => {
  // Track custom metrics
  analytics.track('custom_metric', {
    value: data.value,
    timestamp: data.timestamp,
    requestId: data.requestId,
  });
});
```

### Real-time Monitoring

```typescript
// WebSocket events for real-time monitoring
app.on('websocket:connect', (data) => {
  console.log(`WebSocket connected: ${data.socketId}`);
  // Event data:
  // {
  //   socketId: 'ws_12345',
  //   ip: '192.168.1.1',
  //   userAgent: 'Mozilla/5.0...',
  //   timestamp: 1640995200000
  // }
});

app.on('websocket:message', (data) => {
  console.log(`WebSocket message: ${data.type} from ${data.socketId}`);
});

app.on('websocket:disconnect', (data) => {
  console.log(`WebSocket disconnected: ${data.socketId} (${data.reason})`);
});
```

### File Operation Events

```typescript
// File serving events
app.on('file:serve', (data) => {
  console.log(`File served: ${data.filename} (${data.size} bytes)`);
  // Event data:
  // {
  //   filename: 'document.pdf',
  //   path: '/uploads/document.pdf',
  //   size: 1024576,  // bytes
  //   contentType: 'application/pdf',
  //   cached: false,
  //   duration: 45     // ms
  // }
});

// Template rendering events
app.on('template:render', (data) => {
  console.log(`Template rendered: ${data.template} (${data.duration}ms)`);
  // Event data:
  // {
  //   template: '@views/user/profile.html',
  //   engine: 'mustache',
  //   cached: true,
  //   duration: 12,
  //   size: 4096      // rendered size in bytes
  // }
});

// File upload events
app.on('upload:start', (data) => {
  console.log(`Upload started: ${data.filename}`);
});

app.on('upload:progress', (data) => {
  console.log(`Upload progress: ${data.filename} ${data.progress}%`);
});

app.on('upload:complete', (data) => {
  console.log(`Upload completed: ${data.filename} (${data.size} bytes)`);
});
```

## 🚀 **Custom Event Integration**

### Creating Custom Events

```typescript
// Emit custom events in your handlers
app.get('/api/users', (req, res) => {
  // Emit custom business events
  app.emit('user:accessed', {
    userId: req.params.id,
    action: 'view_profile',
    timestamp: Date.now(),
    ip: req.ip(),
  });

  // Your handler logic...
  res.json(userData);
});

// Listen to custom events
app.on('user:accessed', (data) => {
  // Track user analytics
  analytics.track('user_profile_viewed', data);

  // Update access logs
  accessLog.record(data);

  // Send to monitoring service
  monitoring.send('user_activity', data);
});
```

### Event Middleware

```typescript
// Middleware that emits events
const auditMiddleware = (req, res, next) => {
  // Emit audit event
  app.emit('audit:access', {
    resource: req.path,
    user: req.user?.id,
    action: req.method,
    timestamp: Date.now(),
    ip: req.ip(),
  });

  next();
};

// Use audit middleware
app.use('/admin', auditMiddleware);

// Listen to audit events
app.on('audit:access', (data) => {
  auditLogger.log('Admin access', data);
});
```

## 📊 **Event Analytics & Metrics**

### Real-time Metrics Collection

```typescript
// Collect metrics from events
const metrics = new Map();

app.on('request', (data) => {
  // Count requests by endpoint
  const key = `${data.method}:${data.url}`;
  metrics.set(key, (metrics.get(key) || 0) + 1);
});

app.on('response', (data) => {
  // Track response times
  const key = `response_time:${data.url}`;
  const times = metrics.get(key) || [];
  times.push(data.duration);
  metrics.set(key, times);
});

// Get aggregated metrics
app.get('/metrics', (req, res) => {
  const stats = {};

  for (const [key, value] of metrics) {
    if (key.startsWith('response_time:')) {
      const endpoint = key.replace('response_time:', '');
      const times = value as number[];
      stats[endpoint] = {
        count: times.length,
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
      };
    }
  }

  res.json(stats);
});
```

### Event-driven Caching

```typescript
// Cache invalidation based on events
const cache = new Map();

app.on('user:updated', (data) => {
  // Invalidate user cache
  cache.delete(`user:${data.userId}`);

  // Invalidate related caches
  cache.delete(`user:${data.userId}:profile`);
  cache.delete(`user:${data.userId}:settings`);
});

app.on('post:created', (data) => {
  // Invalidate feed caches
  cache.delete('posts:recent');
  cache.delete(`posts:user:${data.authorId}`);
});
```

## 🛡️ **Security Event Monitoring**

### Security Events

```typescript
// Failed authentication attempts
app.on('auth:failed', (data) => {
  console.warn(`Failed login attempt: ${data.email} from ${data.ip}`);

  // Implement rate limiting
  securityService.trackFailedAttempt(data.ip);

  // Send security alert if threshold exceeded
  if (securityService.getFailedAttempts(data.ip) > 5) {
    app.emit('security:threat', {
      type: 'brute_force',
      ip: data.ip,
      attempts: securityService.getFailedAttempts(data.ip),
    });
  }
});

// Suspicious activity detection
app.on('security:threat', (data) => {
  console.error(`Security threat detected: ${data.type} from ${data.ip}`);

  // Block IP temporarily
  securityService.blockIP(data.ip, '1h');

  // Send alert to administrators
  alertService.send('security_threat', data);

  // Log to security audit
  securityAudit.log(data);
});

// Input validation failures
app.on('validation:failed', (data) => {
  console.warn(`Validation failed: ${data.field} in ${data.endpoint}`);

  // Track potential attack patterns
  securityService.trackValidationFailure(data);
});
```

### Compliance & Audit Events

```typescript
// GDPR compliance events
app.on('gdpr:data_access', (data) => {
  complianceLogger.log('data_access_request', {
    userId: data.userId,
    requestedBy: data.requestedBy,
    timestamp: data.timestamp,
    dataTypes: data.dataTypes,
  });
});

app.on('gdpr:data_deletion', (data) => {
  complianceLogger.log('data_deletion', {
    userId: data.userId,
    deletedBy: data.deletedBy,
    timestamp: data.timestamp,
    dataTypes: data.dataTypes,
  });
});

// SOX compliance events
app.on('sox:financial_data_access', (data) => {
  soxLogger.log('financial_data_access', {
    userId: data.userId,
    resource: data.resource,
    action: data.action,
    timestamp: data.timestamp,
    justification: data.justification,
  });
});
```

---

**The NextRush Event System provides comprehensive monitoring and analytics capabilities while maintaining optimal performance when disabled.**
