# NextRush v1 to v2 Migration Guide 🚀

## Overview

This comprehensive guide will help you migrate from NextRush v1 to v2, taking advantage of the new architecture, zero runtime dependencies, and massive performance improvements.

## Table of Contents

1. [Breaking Changes Overview](#breaking-changes-overview)
2. [Installation & Setup](#installation--setup)
3. [Application Structure Changes](#application-structure-changes)
4. [Context API Migration](#context-api-migration)
5. [Middleware Migration](#middleware-migration)
6. [Routing Migration](#routing-migration)
7. [Dependency Injection](#dependency-injection)
8. [Plugin System Changes](#plugin-system-changes)
9. [Performance Optimizations](#performance-optimizations)
10. [Testing Updates](#testing-updates)

---

## Breaking Changes Overview

### Major Architectural Changes

| Aspect              | v1                       | v2                                         | Impact       |
| ------------------- | ------------------------ | ------------------------------------------ | ------------ |
| **Context Pattern** | Express-style (req, res) | Koa-style (ctx) with Express compatibility | Medium       |
| **Dependencies**    | 5 runtime dependencies   | Zero runtime dependencies                  | Low          |
| **Middleware**      | Plugin-based everything  | Built-in core + optional plugins           | Medium       |
| **DI Container**    | External (tsyringe)      | Custom zero-dependency                     | High         |
| **Performance**     | ~2,000 req/s             | 10,000+ req/s                              | High benefit |
| **Bundle Size**     | 250KB                    | 146KB                                      | High benefit |

### API Compatibility

✅ **Backward Compatible**

- Basic routing patterns
- Middleware concepts
- Response methods
- Error handling patterns

⚠️ **Requires Changes**

- Middleware function signatures
- Dependency injection syntax
- Plugin installation patterns
- Context property access

❌ **Breaking Changes**

- tsyringe dependencies
- Some plugin APIs
- Internal architecture access

---

## Installation & Setup

### 1. Update Dependencies

```bash
# Remove v1
npm uninstall nextrush

# Install v2
npm install nextrush@2.0.0-alpha.1

# Remove old dependencies (no longer needed)
npm uninstall tsyringe reflect-metadata
```

### 2. Update TypeScript Configuration

```json
// tsconfig.json - Remove decorator metadata
{
  "compilerOptions": {
    // Remove these v1-specific options
    // "experimentalDecorators": true,
    // "emitDecoratorMetadata": true,

    // Keep these for v2
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true
  }
}
```

### 3. Update Package Scripts

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup --config tsup.config.ts",
    "start": "node dist/index.js",
    "test": "vitest"
  }
}
```

---

## Application Structure Changes

### v1 Application Structure

```typescript
// v1 style
import 'reflect-metadata';
import { Application } from 'nextrush';

const app = new Application();

app.get('/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);
```

### v2 Application Structure

```typescript
// v2 style
import { createApp } from 'nextrush';

const app = createApp();

app.get('/users', async ctx => {
  // Koa-style
  ctx.body = { users: [] };

  // Or Express-style (both work)
  ctx.res.json({ users: [] });
});

app.listen(3000);
```

### Advanced v2 Setup

```typescript
// v2 with full configuration
import { createApp } from 'nextrush';

const app = createApp({
  // Performance optimizations
  optimize: true,

  // Built-in middleware configuration
  cors: {
    origin: true,
    credentials: true,
  },

  helmet: {
    contentSecurityPolicy: false,
  },
});

// Custom DI container access
const container = app.getContainer();
container.register('userService', UserService);

app.listen(3000, () => {
  console.log('NextRush v2 server running on port 3000');
});
```

---

## Context API Migration

### v1 Context (Express-style)

```typescript
// v1 - Express pattern
app.get('/users/:id', (req, res) => {
  const userId = req.params.id;
  const userAgent = req.headers['user-agent'];

  res.status(200).json({
    user: { id: userId },
    userAgent,
  });
});

app.post('/users', (req, res) => {
  const userData = req.body;
  // Process user data
  res.status(201).json({ created: true });
});
```

### v2 Context (Koa-style with Express compatibility)

```typescript
// v2 - Koa pattern (preferred)
app.get('/users/:id', async ctx => {
  const userId = ctx.params.id;
  const userAgent = ctx.headers['user-agent'];

  ctx.status = 200;
  ctx.body = {
    user: { id: userId },
    userAgent,
  };
});

// v2 - Express compatibility (also works)
app.get('/users/:id', async ctx => {
  const userId = ctx.params.id;
  const userAgent = ctx.get('user-agent');

  ctx.res.status(200).json({
    user: { id: userId },
    userAgent,
  });
});

app.post('/users', async ctx => {
  const userData = ctx.body; // Auto-parsed
  // Process user data
  ctx.status = 201;
  ctx.body = { created: true };
});
```

### Context Properties Comparison

| Property       | v1            | v2                                  |
| -------------- | ------------- | ----------------------------------- |
| Request body   | `req.body`    | `ctx.body`                          |
| URL parameters | `req.params`  | `ctx.params`                        |
| Query string   | `req.query`   | `ctx.query`                         |
| Headers        | `req.headers` | `ctx.headers`                       |
| Method         | `req.method`  | `ctx.method`                        |
| Path           | `req.path`    | `ctx.path`                          |
| Response       | `res.json()`  | `ctx.res.json()` or `ctx.body = {}` |

---

## Middleware Migration

### v1 Middleware

```typescript
// v1 - Express-style middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// v1 - Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
```

### v2 Middleware

```typescript
// v2 - Koa-style middleware
app.use(async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await next();
});

// v2 - Error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error(err);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// v2 - Async middleware with timing
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.set('X-Response-Time', `${ms}ms`);
});
```

### Built-in Middleware Migration

#### CORS Migration

```typescript
// v1 - Plugin-based
import { CorsPlugin } from 'nextrush/plugins';
app.use(new CorsPlugin({ origin: true }));

// v2 - Built-in
import { cors } from 'nextrush/middleware';
app.use(cors({ origin: true, credentials: true }));
```

#### Security Headers Migration

```typescript
// v1 - Plugin-based
import { HelmetPlugin } from 'nextrush/plugins';
app.use(new HelmetPlugin());

// v2 - Built-in
import { helmet } from 'nextrush/middleware';
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
      },
    },
  })
);
```

#### Body Parser Migration

```typescript
// v1 - Plugin configuration
import { BodyParserPlugin } from 'nextrush/plugins';
app.use(
  new BodyParserPlugin({
    json: { limit: '10mb' },
    urlencoded: { extended: true },
  })
);

// v2 - Built-in with enhanced features
import { bodyParser } from 'nextrush/middleware';
app.use(
  bodyParser({
    maxSize: 10 * 1024 * 1024, // 10MB
    enableStreaming: true,
    timeout: 30000,
    multipart: true,
  })
);
```

---

## Routing Migration

### Route Definition Migration

```typescript
// v1 - Basic routing
app.get('/users', userController.getUsers);
app.post('/users', userController.createUser);
app.put('/users/:id', userController.updateUser);
app.delete('/users/:id', userController.deleteUser);

// v2 - Same API, improved performance
app.get('/users', userController.getUsers);
app.post('/users', userController.createUser);
app.put('/users/:id', userController.updateUser);
app.delete('/users/:id', userController.deleteUser);
```

### Route Groups Migration

```typescript
// v1 - Manual grouping
const apiRouter = app.createRouter();
apiRouter.get('/users', handler);
apiRouter.get('/posts', handler);
app.use('/api/v1', apiRouter);

// v2 - Enhanced router with better performance
const apiRouter = app.createRouter();
apiRouter.get('/users', handler);
apiRouter.get('/posts', handler);
app.use('/api/v1', apiRouter);
```

### Route Parameters

```typescript
// v1 & v2 - Same API
app.get('/users/:id/posts/:postId', async ctx => {
  const { id, postId } = ctx.params;
  // Handle request
});
```

---

## Dependency Injection

### v1 DI (tsyringe)

```typescript
// v1 - tsyringe decorators
import 'reflect-metadata';
import { injectable, inject, container } from 'tsyringe';

@injectable()
class UserService {
  constructor(@inject('UserRepository') private userRepo: UserRepository) {}
}

// Registration
container.register('UserRepository', UserRepository);
container.register('UserService', UserService);

// Usage
const userService = container.resolve(UserService);
```

### v2 DI (Custom Container)

```typescript
// v2 - Custom DI container
import { createApp } from 'nextrush';

class UserService {
  constructor(private userRepo: UserRepository) {}
}

const app = createApp();
const container = app.getContainer();

// Registration
container.register('userRepository', UserRepository);
container.register('userService', container => {
  const userRepo = container.resolve<UserRepository>('userRepository');
  return new UserService(userRepo);
});

// Usage in routes
app.get('/users', async ctx => {
  const userService = container.resolve<UserService>('userService');
  const users = await userService.getUsers();
  ctx.body = users;
});
```

### DI Integration with Context

```typescript
// v2 - DI context integration
app.use(async (ctx, next) => {
  // Inject common services into context
  ctx.userService = container.resolve<UserService>('userService');
  ctx.logger = container.resolve<Logger>('logger');
  await next();
});

app.get('/users', async ctx => {
  // Services available on context
  const users = await ctx.userService.getUsers();
  ctx.logger.info(`Fetched ${users.length} users`);
  ctx.body = users;
});
```

---

## Plugin System Changes

### v1 Plugin Usage

```typescript
// v1 - Everything was a plugin
import { LoggerPlugin, CorsPlugin, BodyParserPlugin } from 'nextrush/plugins';

app.use(new LoggerPlugin({ level: 'info' }));
app.use(new CorsPlugin({ origin: true }));
app.use(new BodyParserPlugin());
```

### v2 Plugin Usage

```typescript
// v2 - Built-in middleware + optional plugins
import { cors, helmet, bodyParser } from 'nextrush/middleware';
import { LoggerPlugin } from 'nextrush/plugins';

// Built-in middleware (no plugins needed)
app.use(cors({ origin: true }));
app.use(helmet());
app.use(bodyParser());

// Advanced features as plugins
const loggerPlugin = new LoggerPlugin({
  level: 'info',
  transports: [
    new ConsoleTransport(),
    new FileTransport({ filename: 'app.log' }),
  ],
});

loggerPlugin.install(app);
```

### Custom Plugin Migration

```typescript
// v1 - Plugin interface
import { Plugin } from 'nextrush';

class CustomPlugin implements Plugin {
  install(app: Application): void {
    // Plugin logic
  }
}

// v2 - Enhanced plugin interface
import { BasePlugin } from 'nextrush/plugins';

class CustomPlugin extends BasePlugin {
  name = 'CustomPlugin';

  install(app: Application): void {
    const container = app.getContainer();

    // Register services
    container.register('customService', CustomService);

    // Add middleware
    app.use(async (ctx, next) => {
      ctx.customService = container.resolve('customService');
      await next();
    });
  }
}
```

---

## Performance Optimizations

### Automatic Optimizations in v2

```typescript
// v2 automatically includes:
const app = createApp({
  // Route caching enabled by default
  optimize: true,

  // Buffer pool management
  bufferPool: {
    size: 100,
    maxSize: 1024 * 1024,
  },

  // Response caching
  caching: {
    enabled: true,
    ttl: 300000,
  },
});
```

### Manual Performance Tuning

```typescript
// v2 - Performance monitoring
import { timer } from 'nextrush/middleware';

app.use(
  timer({
    measureMemory: true,
    reportThreshold: 100, // ms
  })
);

// v2 - Request optimization
app.use(async (ctx, next) => {
  // Skip expensive operations for health checks
  if (ctx.path === '/health') {
    ctx.body = { status: 'ok' };
    return;
  }

  await next();
});
```

---

## Testing Updates

### v1 Testing

```typescript
// v1 - Testing with tsyringe
import 'reflect-metadata';
import { container } from 'tsyringe';

describe('UserController', () => {
  beforeEach(() => {
    container.clearInstances();
    container.register('UserService', MockUserService);
  });
});
```

### v2 Testing

```typescript
// v2 - Testing with custom DI
import { createApp } from 'nextrush';
import { request } from 'supertest';

describe('UserController', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
    const container = app.getContainer();

    // Mock services
    container.registerInstance('userService', new MockUserService());

    // Setup routes
    app.get('/users', async ctx => {
      const userService = container.resolve('userService');
      ctx.body = await userService.getUsers();
    });
  });

  it('should get users', async () => {
    const response = await request(app.getHttpServer())
      .get('/users')
      .expect(200);

    expect(response.body).toEqual([]);
  });
});
```

---

## Step-by-Step Migration Process

### Phase 1: Setup & Dependencies

1. ✅ Update package.json dependencies
2. ✅ Remove tsyringe and reflect-metadata
3. ✅ Update TypeScript configuration
4. ✅ Install NextRush v2

### Phase 2: Core Application Migration

1. ✅ Update application creation syntax
2. ✅ Migrate basic routes to new context API
3. ✅ Update middleware function signatures
4. ✅ Test basic functionality

### Phase 3: Dependency Injection Migration

1. ✅ Remove decorator-based DI
2. ✅ Implement custom container registration
3. ✅ Update service resolution patterns
4. ✅ Test service injection

### Phase 4: Plugin & Middleware Migration

1. ✅ Replace plugin-based middleware with built-in
2. ✅ Update custom plugin implementations
3. ✅ Migrate advanced plugin configurations
4. ✅ Test all middleware functionality

### Phase 5: Performance Optimization

1. ✅ Enable v2 performance optimizations
2. ✅ Add performance monitoring
3. ✅ Run performance benchmarks
4. ✅ Compare with v1 metrics

### Phase 6: Testing & Validation

1. ✅ Update test suites
2. ✅ Validate API compatibility
3. ✅ Performance regression testing
4. ✅ Production deployment preparation

---

## Common Migration Issues

### Issue 1: Middleware Function Signatures

```typescript
// ❌ v1 style won't work
app.use((req, res, next) => {
  next();
});

// ✅ v2 solution
app.use(async (ctx, next) => {
  await next();
});
```

### Issue 2: Dependency Injection

```typescript
// ❌ tsyringe decorators won't work
@injectable()
class UserService {}

// ✅ v2 solution
class UserService {}
container.register('userService', UserService);
```

### Issue 3: Context Property Access

```typescript
// ❌ v1 style
const userId = req.params.id;

// ✅ v2 style
const userId = ctx.params.id;
```

### Issue 4: Response Handling

```typescript
// ❌ v1 style
res.status(200).json({ data });

// ✅ v2 style (both work)
ctx.res.status(200).json({ data });
// or
ctx.status = 200;
ctx.body = { data };
```

---

## Performance Benefits After Migration

### Before Migration (v1)

```
Response Time: 10-50ms average
Memory Usage: 150MB under load
Throughput: ~2,000 req/s
Bundle Size: 250KB
Dependencies: 5 runtime dependencies
```

### After Migration (v2)

```
Response Time: 0.01-0.08ms average (99%+ improvement)
Memory Usage: 53.90MB average (64% reduction)
Throughput: 10,000+ req/s (500%+ improvement)
Bundle Size: 146KB (42% reduction)
Dependencies: 0 runtime dependencies (100% elimination)
```

---

## Migration Checklist

### Pre-Migration

- [ ] Backup existing codebase
- [ ] Document current API endpoints
- [ ] Run existing test suite
- [ ] Measure current performance metrics

### During Migration

- [ ] Update dependencies
- [ ] Migrate application setup
- [ ] Update context API usage
- [ ] Migrate middleware functions
- [ ] Update dependency injection
- [ ] Replace plugin usage
- [ ] Update test suite

### Post-Migration

- [ ] Validate all API endpoints
- [ ] Run performance benchmarks
- [ ] Update documentation
- [ ] Deploy to staging environment
- [ ] Run integration tests
- [ ] Monitor production metrics

---

## Support & Resources

### Documentation

- [NextRush v2 Architecture Guide](./V2_ARCHITECTURE_OVERVIEW.md)
- [Dependency Injection Guide](./DEPENDENCY_INJECTION_GUIDE.md)
- [Performance Analysis](../performance/V2_PERFORMANCE_ANALYSIS.md)

### Migration Support

- GitHub Issues: Report migration problems
- Documentation: Comprehensive guides and examples
- Community: Discord server for real-time help

### Migration Tools

- Automated migration scripts (coming soon)
- Code transformation utilities
- Performance comparison tools

---

_This migration guide ensures a smooth transition from NextRush v1 to v2, unlocking massive performance improvements and architectural benefits._
