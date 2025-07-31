# 🎭 Event System

## 📚 Table of Contents

- [🎭 Event System](#-event-system)
  - [📚 Table of Contents](#-table-of-contents)
  - [📖 Introduction](#-introduction)
  - [🔧 Public APIs](#-public-apis)
    - [📡 Base Event Emitter](#-base-event-emitter)
      - [SimpleEventEmitter Methods](#simpleeventemitter-methods)
    - [🎪 Application Event System](#-application-event-system)
      - [ApplicationEventSystem Methods](#applicationeventsystem-methods)
    - [📊 Event Data Interfaces](#-event-data-interfaces)
      - [Event Data Properties](#event-data-properties)
        - [EventData](#eventdata)
        - [RequestEventData](#requesteventdata)
        - [ResponseEventData](#responseeventdata)
        - [ErrorEventData](#erroreventdata)
    - [🛠️ Built-in Event Listeners](#️-built-in-event-listeners)
      - [EventListeners Static Methods](#eventlisteners-static-methods)
    - [🏭 Factory Functions](#-factory-functions)
    - [🌐 Global Instance](#-global-instance)
  - [💻 Usage Examples](#-usage-examples)
    - [Basic Event Handling](#basic-event-handling)
    - [Performance Monitoring](#performance-monitoring)
    - [Security Monitoring](#security-monitoring)
    - [Error Tracking](#error-tracking)
    - [Custom Event System](#custom-event-system)
    - [Request Lifecycle Tracking](#request-lifecycle-tracking)
    - [Rate Limiting with Events](#rate-limiting-with-events)
  - [⚙️ Configuration Options](#️-configuration-options)
    - [Event System Configuration](#event-system-configuration)
    - [Conditional Event Handling](#conditional-event-handling)
  - [📝 Notes](#-notes)

## 📖 Introduction

The NextRush framework includes a powerful event-driven architecture that enables monitoring, logging, and extending application behavior through events. The event system provides comprehensive tracking of requests, responses, errors, and application lifecycle events with built-in listeners for common use cases like logging, performance monitoring, and security.

## 🔧 Public APIs

### 📡 Base Event Emitter

| Class                | Description                                         |
| -------------------- | --------------------------------------------------- |
| `SimpleEventEmitter` | Lightweight event emitter with basic functionality. |

#### SimpleEventEmitter Methods

| Method                       | Signature                                                | Description                                   |
| ---------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| `on(event, callback)`        | `<T>(event: string, callback: EventCallback<T>) => this` | Add event listener.                           |
| `once(event, callback)`      | `<T>(event: string, callback: EventCallback<T>) => this` | Add one-time event listener.                  |
| `off(event, callback)`       | `<T>(event: string, callback: EventCallback<T>) => this` | Remove event listener.                        |
| `removeAllListeners(event?)` | `(event?: string) => this`                               | Remove all listeners for event or all events. |
| `emit(event, data?)`         | `<T>(event: string, data?: T) => boolean`                | Emit event with optional data.                |
| `listenerCount(event)`       | `(event: string) => number`                              | Get listener count for event.                 |
| `eventNames()`               | `() => string[]`                                         | Get all event names.                          |
| `listeners(event)`           | `<T>(event: string) => EventCallback<T>[]`               | Get listeners for event.                      |
| `setMaxListeners(max)`       | `(max: number) => this`                                  | Set maximum listeners per event.              |
| `getMaxListeners()`          | `() => number`                                           | Get maximum listeners limit.                  |

### 🎪 Application Event System

| Class                    | Extends              | Description                                        |
| ------------------------ | -------------------- | -------------------------------------------------- |
| `ApplicationEventSystem` | `SimpleEventEmitter` | Enhanced event system for application-wide events. |

#### ApplicationEventSystem Methods

| Method                                       | Signature                                                       | Description                      |
| -------------------------------------------- | --------------------------------------------------------------- | -------------------------------- |
| `generateRequestId()`                        | `() => string`                                                  | Generate unique request ID.      |
| `emitRequestStart(data)`                     | `(data: Omit<RequestEventData, 'id' \| 'timestamp'>) => string` | Emit request start event.        |
| `emitRequestEnd(data)`                       | `(data: Omit<ResponseEventData, 'timestamp'>) => void`          | Emit request end event.          |
| `emitError(error, requestId?, context?)`     | `(error: Error, requestId?: string, context?: any) => void`     | Emit error event.                |
| `emitAppStart(data)`                         | `(data: {port: number, host?: string, pid: number}) => void`    | Emit application start event.    |
| `emitAppStop()`                              | `() => void`                                                    | Emit application stop event.     |
| `emitMiddleware(name, requestId, duration?)` | `(name: string, requestId: string, duration?: number) => void`  | Emit middleware execution event. |
| `emitRouteMatch(route, method, requestId)`   | `(route: string, method: string, requestId: string) => void`    | Emit route match event.          |

### 📊 Event Data Interfaces

| Interface           | Description                   |
| ------------------- | ----------------------------- |
| `EventData`         | Base event data structure.    |
| `RequestEventData`  | Request-specific event data.  |
| `ResponseEventData` | Response-specific event data. |
| `ErrorEventData`    | Error-specific event data.    |

#### Event Data Properties

##### EventData

| Property    | Type     | Description                      |
| ----------- | -------- | -------------------------------- |
| `timestamp` | `number` | Event timestamp in milliseconds. |
| `id`        | `string` | Unique event identifier.         |

##### RequestEventData

| Property    | Type                                              | Description        |
| ----------- | ------------------------------------------------- | ------------------ |
| `method`    | `string`                                          | HTTP method.       |
| `url`       | `string`                                          | Request URL.       |
| `headers`   | `Record<string, string \| string[] \| undefined>` | Request headers.   |
| `ip`        | `string?`                                         | Client IP address. |
| `userAgent` | `string?`                                         | User agent string. |

##### ResponseEventData

| Property       | Type                                                        | Description                    |
| -------------- | ----------------------------------------------------------- | ------------------------------ |
| `statusCode`   | `number`                                                    | HTTP status code.              |
| `headers`      | `Record<string, string \| string[] \| number \| undefined>` | Response headers.              |
| `responseTime` | `number`                                                    | Response time in milliseconds. |
| `requestId`    | `string`                                                    | Associated request ID.         |

##### ErrorEventData

| Property    | Type      | Description               |
| ----------- | --------- | ------------------------- |
| `error`     | `Error`   | Error object.             |
| `requestId` | `string?` | Associated request ID.    |
| `context`   | `any?`    | Additional error context. |

### 🛠️ Built-in Event Listeners

| Class            | Description                              |
| ---------------- | ---------------------------------------- |
| `EventListeners` | Collection of pre-built event listeners. |

#### EventListeners Static Methods

| Method               | Signature                           | Description                                    |
| -------------------- | ----------------------------------- | ---------------------------------------------- |
| `requestLogger`      | `(data: RequestEventData) => void`  | Basic request logger.                          |
| `responseLogger`     | `(data: ResponseEventData) => void` | Basic response logger with color-coded status. |
| `errorLogger`        | `(data: ErrorEventData) => void`    | Error logger with stack traces.                |
| `performanceMonitor` | `(data: ResponseEventData) => void` | Performance monitor for slow requests.         |
| `securityMonitor`    | `(data: RequestEventData) => void`  | Security monitor for suspicious requests.      |
| `rateLimitMonitor`   | `(data: RequestEventData) => void`  | Rate limiting monitor.                         |

### 🏭 Factory Functions

| Function             | Signature                      | Description                                   |
| -------------------- | ------------------------------ | --------------------------------------------- |
| `createEventSystem`  | `() => ApplicationEventSystem` | Create new application event system instance. |
| `createEventEmitter` | `() => SimpleEventEmitter`     | Create new simple event emitter instance.     |

### 🌐 Global Instance

| Variable            | Type                     | Description                   |
| ------------------- | ------------------------ | ----------------------------- |
| `globalEventSystem` | `ApplicationEventSystem` | Global event system instance. |

## 💻 Usage Examples

### Basic Event Handling

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Add built-in listeners
app.events.on('request:start', (data) => {
  console.log(`Request started: ${data.method} ${data.url}`);
});

app.events.on('request:end', (data) => {
  console.log(`Request completed: ${data.statusCode} in ${data.duration}ms`);
});

app.events.on('error', (data) => {
  console.error(`Error occurred: ${data.error.message}`);
});

// Custom event listener
globalEventSystem.on('request:start', (data) => {
  console.log(`New request: ${data.method} ${data.url} from ${data.ip}`);
});

app.listen(3000);
```

### Performance Monitoring

```typescript
import { createApp } from 'nextrush';

// Monitor performance
globalEventSystem.on('request:end', EventListeners.performanceMonitor);

// Custom performance analytics
globalEventSystem.on('request:end', (data) => {
  // Send metrics to analytics service
  analytics.track('request_completed', {
    statusCode: data.statusCode,
    responseTime: data.responseTime,
    requestId: data.requestId,
  });

  // Alert on critical performance
  if (data.responseTime > 5000) {
    alertingService.send(`Critical slow request: ${data.responseTime}ms`);
  }
});
```

### Security Monitoring

```typescript
import { globalEventSystem, EventListeners } from 'nextrush';

// Enable security monitoring
globalEventSystem.on('request:start', EventListeners.securityMonitor);

// Custom security events
globalEventSystem.on('request:start', (data) => {
  // Check for suspicious patterns
  if (data.url.includes('admin') && !data.ip?.startsWith('192.168.')) {
    securityService.logSuspiciousActivity({
      ip: data.ip,
      url: data.url,
      userAgent: data.userAgent,
      timestamp: data.timestamp,
    });
  }
});
```

### Error Tracking

```typescript
import { globalEventSystem } from 'nextrush';

// Comprehensive error tracking
globalEventSystem.on('error', (data) => {
  const errorInfo = {
    message: data.error.message,
    stack: data.error.stack,
    requestId: data.requestId,
    timestamp: data.timestamp,
    context: data.context,
  };

  // Send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    errorTracker.captureException(data.error, errorInfo);
  }

  // Log locally
  console.error('Application Error:', errorInfo);
});
```

### Custom Event System

```typescript
import { createEventSystem, createEventEmitter } from 'nextrush';

// Create custom event system for module
const moduleEventSystem = createEventSystem();

// Custom events for business logic
moduleEventSystem.on('user:created', (userData) => {
  emailService.sendWelcomeEmail(userData.email);
  analyticsService.trackUserSignup(userData);
});

moduleEventSystem.on('order:placed', (orderData) => {
  inventoryService.updateStock(orderData.items);
  paymentService.processPayment(orderData.payment);
});

// Emit custom events
moduleEventSystem.emit('user:created', {
  id: 123,
  email: 'user@example.com',
});
```

### Request Lifecycle Tracking

```typescript
import { globalEventSystem } from 'nextrush';

// Track complete request lifecycle
const requestTimes = new Map();

globalEventSystem.on('request:start', (data) => {
  requestTimes.set(data.id, {
    startTime: data.timestamp,
    method: data.method,
    url: data.url,
  });
});

globalEventSystem.on('middleware', (data) => {
  console.log(
    `Middleware ${data.name} executed for ${data.requestId} in ${data.duration}ms`
  );
});

globalEventSystem.on('route:match', (data) => {
  console.log(
    `Route matched: ${data.method} ${data.route} for ${data.requestId}`
  );
});

globalEventSystem.on('request:end', (data) => {
  const requestInfo = requestTimes.get(data.requestId);
  if (requestInfo) {
    const totalTime = data.timestamp - requestInfo.startTime;
    console.log(
      `Request completed: ${requestInfo.method} ${requestInfo.url} - ${totalTime}ms total`
    );
    requestTimes.delete(data.requestId);
  }
});
```

### Rate Limiting with Events

```typescript
import { globalEventSystem, EventListeners } from 'nextrush';

// Enable built-in rate limit monitoring
globalEventSystem.on('request:start', EventListeners.rateLimitMonitor);

// Custom rate limiting
const rateLimiter = new Map();

globalEventSystem.on('request:start', (data) => {
  const ip = data.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 50;

  if (!rateLimiter.has(ip)) {
    rateLimiter.set(ip, { count: 0, resetTime: now + windowMs });
  }

  const clientData = rateLimiter.get(ip);
  if (now >= clientData.resetTime) {
    clientData.count = 0;
    clientData.resetTime = now + windowMs;
  }

  clientData.count++;

  if (clientData.count > maxRequests) {
    // Emit rate limit exceeded event
    globalEventSystem.emit('rate:limit:exceeded', {
      ip,
      count: clientData.count,
      limit: maxRequests,
      timestamp: now,
    });
  }
});
```

## ⚙️ Configuration Options

### Event System Configuration

```typescript
import { createEventSystem } from 'nextrush';

// Create with custom configuration
const eventSystem = createEventSystem();

// Set maximum listeners to prevent memory leaks
eventSystem.setMaxListeners(100);

// Configure built-in listeners
if (process.env.NODE_ENV === 'development') {
  eventSystem.on('request:start', EventListeners.requestLogger);
  eventSystem.on('request:end', EventListeners.responseLogger);
  eventSystem.on('error', EventListeners.errorLogger);
}

// Production-only listeners
if (process.env.NODE_ENV === 'production') {
  eventSystem.on('request:end', EventListeners.performanceMonitor);
  eventSystem.on('request:start', EventListeners.securityMonitor);
  eventSystem.on('request:start', EventListeners.rateLimitMonitor);
}
```

### Conditional Event Handling

```typescript
import { globalEventSystem } from 'nextrush';

// Environment-based event handling
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

if (isDevelopment) {
  // Verbose logging in development
  globalEventSystem.on('request:start', (data) => {
    console.log('Request Details:', JSON.stringify(data, null, 2));
  });
}

if (isProduction) {
  // Minimal logging in production
  globalEventSystem.on('error', (data) => {
    console.error(`Error: ${data.error.message} (${data.requestId})`);
  });
}
```

## 📝 Notes

- **Memory Management**: The event system automatically warns when too many listeners are added to prevent memory leaks. Use `setMaxListeners()` to adjust the threshold.
- **Async Listeners**: Event listeners can be asynchronous. Errors in async listeners are automatically caught and logged.
- **Performance**: The event system is designed for high performance with minimal overhead. Events are processed synchronously but async listeners are handled separately.
- **Request IDs**: All request-related events include a unique request ID for tracking across the request lifecycle.
- **Built-in Listeners**: Use the pre-built listeners from `EventListeners` for common functionality like logging, performance monitoring, and security.
- **Global vs Local**: Use the global event system for application-wide events or create custom instances for module-specific events.
- **Event Names**: Standard event names follow the pattern `category:action` (e.g., `request:start`, `request:end`, `error`).
- **Data Immutability**: Event data should be treated as immutable to prevent side effects between listeners.
- **Error Handling**: Errors in event listeners are caught and logged automatically without affecting the main application flow.
