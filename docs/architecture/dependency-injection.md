# Dependency Injection Container

NextRush v2 uses a lightweight dependency injection (DI) container internally to manage middleware dependencies and service lifecycles.

## What it is

The DI container is an internal system that automatically manages how different parts of the framework work together. Think of it as a smart registry that knows how to create and share services when they're needed.

## Why it exists

The DI container solves these problems:

- **Avoid duplicate instances** - Share the same logger across all middleware
- **Manage dependencies** - Some middleware needs other services to work
- **Control lifecycles** - Some services should be created once, others created fresh each time
- **Make testing easier** - Replace real services with test versions

## How it works

```typescript
// This happens automatically inside NextRush v2:

// 1. Register services in the container
container.singleton('logger', () => new Logger());
container.transient('requestId', () => generateUniqueId());

// 2. Middleware asks for services
const logger = container.get('logger'); // Same instance every time
const reqId = container.get('requestId'); // New ID each time

// 3. Framework uses services to create middleware
const loggerMiddleware = middlewareFactory.create('logger');
```

## Service lifecycles

### Singleton

**What**: One instance shared everywhere
**When**: Services that should be shared (loggers, database connections)
**Example**:

```typescript
// Only one logger instance for the entire app
container.singleton(
  'logger',
  () =>
    new Logger({
      level: 'info',
      output: 'console',
    })
);
```

### Transient

**What**: New instance every time
**When**: Services that should be unique (request IDs, temporary data)
**Example**:

```typescript
// New unique ID for each request
container.transient('requestId', () => {
  return Math.random().toString(36).substring(2);
});
```

### Scoped

**What**: One instance per request
**When**: Services tied to a specific request (user session, request context)
**Example**:

```typescript
// Same user session data for one request, new for next request
container.scoped('userSession', req => {
  return new UserSession(req.cookies.sessionId);
});
```

## Default services

NextRush v2 automatically registers these services:

```typescript
// Built-in middleware services
container.singleton('cors', () => createCorsHandler());
container.singleton('helmet', () => createHelmetHandler());
container.singleton('compression', () => createCompressionHandler());
container.singleton('bodyParser', () => createBodyParserHandler());
container.singleton('rateLimit', () => createRateLimitHandler());

// Request-specific services
container.transient('requestId', () => generateRequestId());
container.transient('timer', () => new RequestTimer());

// Logging services
container.singleton('logger', () => createDefaultLogger());
```

## Middleware factory

The middleware factory uses the DI container to create middleware with their dependencies:

```typescript
// This happens automatically:

class MiddlewareFactory {
  create(serviceName: string) {
    // Get service from container
    const service = this.container.get(serviceName);

    // Create middleware that uses the service
    return async (ctx, next) => {
      // Use the service
      service.process(ctx);
      await next();
    };
  }
}

// When you use built-in middleware:
app.use(app.logger()); // Factory creates logger middleware using DI
```

## Why you don't see it

The DI container is hidden because:

1. **It's an implementation detail** - You don't need to know about it to use NextRush
2. **Automatic setup** - Everything is configured for you
3. **Simple API** - The public API (`app.use()`, `app.get()`) is what matters
4. **Performance** - Internal systems are optimized for speed

## When it matters

Understanding the DI container helps when:

- **Writing plugins** - Plugins can register their own services
- **Understanding performance** - Know why services are fast (singleton caching)
- **Debugging** - Understand how middleware gets its dependencies
- **Testing** - Mock services for testing

## Plugin integration

Plugins can register services in the container:

```typescript
class LoggerPlugin {
  install(app) {
    // Plugin registers its service
    app.container.singleton('customLogger', () => {
      return new AdvancedLogger(this.options);
    });

    // Framework can now use this service
    app.middlewareFactory.register('customLogger');
  }
}
```

## Testing with DI

During tests, you can replace services:

```typescript
// In tests, the framework can replace services
test('should log requests', () => {
  const mockLogger = { log: jest.fn() };

  // Replace real logger with mock
  app.container.register('logger', () => mockLogger);

  // Now all middleware will use the mock logger
  app.use(app.logger());

  // Test that logging happens
  expect(mockLogger.log).toHaveBeenCalled();
});
```

## Performance benefits

The DI container provides:

- **Faster startup** - Services created only when needed
- **Memory efficiency** - Shared instances instead of duplicates
- **Reduced overhead** - No repeated initialization
- **Better caching** - Singletons stay in memory

## Summary

The DI container is NextRush v2's internal "service manager" that:

- ✅ Manages how services are created and shared
- ✅ Makes middleware more efficient
- ✅ Enables plugin system to work smoothly
- ✅ Improves testing capabilities
- ✅ Stays hidden so the API remains simple

You don't need to interact with it directly - it just makes everything work better behind the scenes!

---

_NextRush v2 Internal Architecture_
