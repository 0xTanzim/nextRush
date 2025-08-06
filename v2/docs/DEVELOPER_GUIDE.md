# NextRush v2 Developer Guide

This guide covers everything developers need to know to build applications with NextRush v2, from basic usage to advanced patterns.

## Quick Start

### Installation

```bash
# From npm (when published)
npm install nextrush@2.0.0

# Or from local build
cd v2 && npm run build && npm link
```

### Basic Application

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.get('/', async ctx => {
  ctx.res.json({ message: 'Hello, NextRush v2!' });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

## Core Concepts

### 1. Application Creation

NextRush v2 applications are created using the `createApp()` function:

```typescript
import { createApp } from 'nextrush';

const app = createApp({
  // Application options
});
```

### 2. Context Object

Every request handler receives a `Context` object that contains:

```typescript
interface Context {
  // Request properties
  method: string;
  path: string;
  query: Record<string, string>;
  params: Record<string, string>;
  body: any;
  headers: Record<string, string>;

  // Response object
  res: {
    status(code: number): void;
    json(data: any): void;
    send(data: string): void;
    setHeader(name: string, value: string): void;
  };

  // Additional context
  state: Record<string, any>; // For sharing data between middleware
  id: string; // Unique request ID
  ip: string; // Client IP address
}
```

### 3. Middleware

Middleware functions execute in sequence and can modify the request/response:

```typescript
// Simple middleware
app.use(async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`);
  await next(); // Continue to next middleware
});

// Error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    ctx.status = 500;
    ctx.res.json({ error: 'Internal Server Error' });
  }
});
```

### 4. Routing

NextRush v2 supports various routing patterns:

```typescript
// Basic routes
app.get('/users', handler);
app.post('/users', handler);
app.put('/users/:id', handler);
app.delete('/users/:id', handler);

// Route parameters
app.get('/users/:id', async ctx => {
  const userId = ctx.params.id;
  // Handle user by ID
});

// Query parameters
app.get('/search', async ctx => {
  const query = ctx.query.q;
  const page = parseInt(ctx.query.page) || 1;
  // Handle search
});
```

## Built-in Features

### 1. Dependency Injection Container

NextRush v2 includes a custom DI container that replaces the need for external dependencies:

```typescript
// Get container from app
const container = app.getContainer();

// Register services
container.registerSingleton('userService', UserService);
container.registerTransient('emailService', EmailService);

// Use in middleware
app.use(async (ctx, next) => {
  ctx.state.userService = container.resolve('userService');
  await next();
});

// Use in handlers
app.get('/users', async ctx => {
  const userService = ctx.state.userService;
  const users = await userService.getAllUsers();
  ctx.res.json(users);
});
```

### 2. Error Handling

Enhanced error handling with developer-friendly messages:

```typescript
import { NextRushError, createErrorHandler } from 'nextrush/dev-experience';

// Use enhanced error handler
app.use(
  createErrorHandler({
    showStackTrace: process.env.NODE_ENV === 'development',
    logErrors: true,
  })
);

// Throw enhanced errors
throw new NextRushError('User not found', 'USER_NOT_FOUND', 404, [
  'Check the user ID',
  'Verify user exists in database',
]);
```

### 3. Development Warnings

Automatic warnings for common development issues:

```typescript
import { createDevelopmentMiddleware } from 'nextrush/dev-experience';

// Enable development warnings
if (process.env.NODE_ENV === 'development') {
  app.use(createDevelopmentMiddleware());
}
```

## Advanced Patterns

### 1. Service Layer Architecture

```typescript
// Define service interfaces
interface IUserService {
  getUser(id: string): Promise<User>;
  createUser(data: CreateUserData): Promise<User>;
}

// Implement services
class UserService implements IUserService {
  async getUser(id: string): Promise<User> {
    // Implementation
  }

  async createUser(data: CreateUserData): Promise<User> {
    // Implementation
  }
}

// Register in DI container
container.registerSingleton('userService', UserService);

// Use in controllers
class UserController {
  constructor(private userService: IUserService) {}

  async getUser(ctx: Context) {
    const user = await this.userService.getUser(ctx.params.id);
    ctx.res.json(user);
  }
}
```

### 2. Plugin System

```typescript
import { LoggerPlugin, MetricsPlugin } from 'nextrush/plugins';

// Install plugins
const logger = new LoggerPlugin({
  level: 'info',
  transports: [
    { type: 'console', colorize: true },
    { type: 'file', filename: 'app.log' },
  ],
});
logger.install(app);

const metrics = new MetricsPlugin({
  collectMemoryStats: true,
  collectResponseTimes: true,
});
metrics.install(app);
```

### 3. Custom Middleware

```typescript
// Authentication middleware
function requireAuth() {
  return async (ctx: Context, next: any) => {
    const token = ctx.headers.authorization;
    if (!token) {
      ctx.status = 401;
      ctx.res.json({ error: 'Authentication required' });
      return;
    }

    // Verify token and set user
    const user = await verifyToken(token);
    ctx.state.user = user;

    await next();
  };
}

// Use authentication
app.use('/api/protected', requireAuth());
```

### 4. Request Validation

```typescript
// Validation middleware
function validate(schema: any) {
  return async (ctx: Context, next: any) => {
    try {
      ctx.body = await schema.parseAsync(ctx.body);
      await next();
    } catch (error) {
      ctx.status = 400;
      ctx.res.json({ error: 'Validation failed', details: error.issues });
    }
  };
}

// Use validation
import { z } from 'zod';

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});

app.post('/users', validate(createUserSchema), async ctx => {
  // ctx.body is now validated
  const user = await createUser(ctx.body);
  ctx.res.json(user);
});
```

## Performance Optimization

### 1. Built-in Optimizations

NextRush v2 includes several performance optimizations:

- Zero runtime dependencies
- Optimized routing with path compilation
- Efficient context reuse
- Memory pooling for high-throughput scenarios

### 2. Performance Monitoring

```typescript
// Enable performance monitoring
app.use(async (ctx, next) => {
  const start = process.hrtime.bigint();

  await next();

  const duration = Number(process.hrtime.bigint() - start) / 1e6; // ms

  if (duration > 100) {
    console.warn(`Slow request: ${ctx.method} ${ctx.path} - ${duration}ms`);
  }
});
```

### 3. Response Optimization

```typescript
// Compression middleware
app.use(async (ctx, next) => {
  await next();

  // Compress large responses
  if (ctx.res.body && JSON.stringify(ctx.res.body).length > 1024) {
    // Apply compression logic
  }
});
```

## Testing

### 1. Unit Testing

```typescript
import { createApp } from 'nextrush';
import { describe, it, expect } from 'vitest';

describe('User API', () => {
  it('should get user by ID', async () => {
    const app = createApp();

    app.get('/users/:id', async ctx => {
      ctx.res.json({ id: ctx.params.id, name: 'Test User' });
    });

    // Test the route
    const response = await request(app).get('/users/123');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: '123', name: 'Test User' });
  });
});
```

### 2. Integration Testing

```typescript
import { createTestApp } from './test-helpers';

describe('Integration Tests', () => {
  let app: Application;

  beforeEach(() => {
    app = createTestApp();
  });

  it('should handle complete user workflow', async () => {
    // Create user
    const createResponse = await request(app)
      .post('/users')
      .send({ name: 'John Doe', email: 'john@example.com' });

    expect(createResponse.status).toBe(201);

    // Get user
    const getResponse = await request(app)
      .get(\`/users/\${createResponse.body.id}\`);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.name).toBe('John Doe');
  });
});
```

## Production Deployment

### 1. Environment Configuration

```typescript
const app = createApp({
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',
});
```

### 2. Error Handling in Production

```typescript
app.use(
  createErrorHandler({
    showStackTrace: false, // Never show stack traces in production
    logErrors: true,
    errorReporter: (error, ctx) => {
      // Send to error tracking service
      errorTracker.reportError(error, {
        requestId: ctx.id,
        path: ctx.path,
        method: ctx.method,
      });
    },
  })
);
```

### 3. Health Checks

```typescript
app.get('/health', async ctx => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      database: await checkDatabase(),
      cache: await checkCache(),
      externalServices: await checkExternalServices(),
    },
  };

  const unhealthyChecks = Object.entries(health.checks).filter(
    ([_, status]) => status !== 'ok'
  );

  if (unhealthyChecks.length > 0) {
    ctx.status = 503;
    health.status = 'unhealthy';
  }

  ctx.res.json(health);
});
```

## Migration from v1

### 1. Application Creation

```typescript
// v1
const app = require('nextrush')();

// v2
import { createApp } from 'nextrush';
const app = createApp();
```

### 2. Middleware

```typescript
// v1 - Express-style
app.use((req, res, next) => {
  // req/res objects
  next();
});

// v2 - Context-based
app.use(async (ctx, next) => {
  // ctx object with req/res properties
  await next();
});
```

### 3. Route Handlers

```typescript
// v1
app.get('/users', (req, res) => {
  res.json({ users: [] });
});

// v2
app.get('/users', async ctx => {
  ctx.res.json({ users: [] });
});
```

### 4. Error Handling

```typescript
// v1
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

// v2
app.use(
  createErrorHandler({
    showStackTrace: false,
  })
);
```

## Best Practices

### 1. Project Structure

```
src/
├── controllers/     # Route handlers
├── services/        # Business logic
├── middleware/      # Custom middleware
├── models/          # Data models
├── utils/           # Utility functions
├── config/          # Configuration
└── app.ts          # Application setup
```

### 2. Error Handling

- Always use try-catch in async handlers
- Provide meaningful error messages
- Use error codes for client identification
- Log errors for debugging

### 3. Performance

- Use dependency injection for service management
- Implement caching where appropriate
- Monitor response times
- Profile memory usage in production

### 4. Security

- Validate all input data
- Sanitize user input
- Use HTTPS in production
- Implement rate limiting
- Add security headers

### 5. Testing

- Write unit tests for business logic
- Integration tests for API endpoints
- Mock external dependencies
- Test error scenarios

## Troubleshooting

### Common Issues

1. **Import Errors**: Make sure to use the correct import paths
2. **Type Errors**: Check that context types are properly imported
3. **Middleware Order**: Ensure middleware is applied in the correct order
4. **Memory Leaks**: Monitor for unclosed resources or circular references

### Debug Mode

```typescript
import { createDevelopmentMiddleware } from 'nextrush/dev-experience';

if (process.env.NODE_ENV === 'development') {
  app.use(
    createDevelopmentMiddleware({
      logRequests: true,
      validateResponses: true,
      memoryWarnings: true,
    })
  );
}
```

### Performance Profiling

```typescript
// Enable performance profiling
app.use(async (ctx, next) => {
  const start = process.hrtime.bigint();

  await next();

  const duration = Number(process.hrtime.bigint() - start) / 1e6;

  console.log(`${ctx.method} ${ctx.path}: ${duration}ms`);

  // Log memory usage for heavy operations
  if (duration > 50) {
    console.log('Memory usage:', process.memoryUsage());
  }
});
```

## Resources

- [API Reference](./api/README.md)
- [Architecture Overview](./architecture/V2_ARCHITECTURE_OVERVIEW.md)
- [Performance Analysis](./performance/V2_PERFORMANCE_ANALYSIS.md)
- [Migration Guide](./V1_TO_V2_MIGRATION_GUIDE.md)
- [Examples](../examples/)

## Support

For issues, questions, or contributions:

- GitHub Issues: Report bugs and feature requests
- Documentation: Comprehensive guides and API reference
- Examples: Working code samples and patterns
