# Dependency Injection Container Guide 🏗️

## Overview

NextRush v2 includes a custom, zero-dependency DI (Dependency Injection) container designed for high-performance web applications. This guide covers comprehensive usage patterns and best practices.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Registration Patterns](#registration-patterns)
3. [Resolution Strategies](#resolution-strategies)
4. [Lifecycle Management](#lifecycle-management)
5. [Advanced Patterns](#advanced-patterns)
6. [Integration Examples](#integration-examples)
7. [Performance Considerations](#performance-considerations)

---

## Quick Start

### Basic Usage

```typescript
import { DIContainer } from 'nextrush/core/di';

// Create container
const container = new DIContainer();

// Register services
container.register('userService', UserService);
container.register('emailService', EmailService);

// Resolve and use
const userService = container.resolve<UserService>('userService');
```

### Application Integration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Access the built-in DI container
const container = app.getContainer();

// Register your services
container.register('authService', AuthService);
container.registerSingleton('database', DatabaseConnection);

// Use in middleware
app.use(async (ctx, next) => {
  ctx.authService = container.resolve<AuthService>('authService');
  await next();
});
```

---

## Registration Patterns

### 1. Transient Registration

Creates a new instance every time the service is resolved.

```typescript
// Class-based registration
container.register('userService', UserService);

// Factory-based registration
container.register('userService', () => new UserService());

// With dependencies
container.register('userController', container => {
  const userService = container.resolve<UserService>('userService');
  return new UserController(userService);
});
```

### 2. Singleton Registration

Creates one instance that's reused for all resolutions.

```typescript
// Class-based singleton
container.registerSingleton('logger', Logger);

// Factory-based singleton
container.registerSingleton('config', () => {
  return new ConfigService(process.env);
});

// Instance registration (pre-created singleton)
const database = new DatabaseConnection();
container.registerInstance('database', database);
```

### 3. Factory Registration

Advanced factory patterns for complex object creation.

```typescript
// Conditional factory
container.registerFactory('apiClient', container => {
  const config = container.resolve<Config>('config');

  if (config.environment === 'production') {
    return new ProductionApiClient(config.apiUrl);
  } else {
    return new MockApiClient();
  }
});

// Async factory
container.registerAsyncFactory('database', async container => {
  const config = container.resolve<Config>('config');
  const db = new DatabaseConnection(config.dbUrl);
  await db.connect();
  return db;
});
```

---

## Resolution Strategies

### 1. Basic Resolution

```typescript
// Simple resolution
const service = container.resolve<UserService>('userService');

// Optional resolution (returns undefined if not found)
const service = container.resolveOptional<UserService>('userService');

// With fallback
const service =
  container.resolveOptional<UserService>('userService') ??
  new DefaultUserService();
```

### 2. Bulk Resolution

```typescript
// Resolve multiple services
const services = container.resolveMany<Service>([
  'service1',
  'service2',
  'service3',
]);

// Resolve all implementations of an interface
interface INotificationService {
  send(message: string): Promise<void>;
}

container.register('emailNotification', EmailNotificationService);
container.register('smsNotification', SmsNotificationService);

const notifications = container.resolveByType<INotificationService>(
  'INotificationService'
);
```

### 3. Conditional Resolution

```typescript
// Environment-based resolution
const logger = container.resolve<Logger>(
  process.env.NODE_ENV === 'production' ? 'productionLogger' : 'devLogger'
);

// Feature flag resolution
const paymentService = container.resolve<PaymentService>(
  config.useNewPaymentSystem ? 'newPaymentService' : 'legacyPaymentService'
);
```

---

## Lifecycle Management

### 1. Container Scopes

```typescript
// Application-wide container (singleton)
const appContainer = new DIContainer();

// Request-scoped container
app.use(async (ctx, next) => {
  const requestContainer = appContainer.createChildContainer();
  ctx.container = requestContainer;

  // Register request-specific services
  requestContainer.registerInstance('requestId', ctx.requestId);
  requestContainer.registerInstance('user', ctx.user);

  await next();

  // Container automatically cleaned up after request
});
```

### 2. Disposal Management

```typescript
// Services implementing IDisposable
class DatabaseService implements IDisposable {
  private connection: Connection;

  dispose(): void {
    this.connection.close();
  }
}

// Register with disposal
container.registerSingleton('database', DatabaseService, { disposable: true });

// Dispose all services when shutting down
process.on('SIGTERM', async () => {
  await container.dispose();
});
```

### 3. Lazy Loading

```typescript
// Lazy resolution - only created when first accessed
container.registerLazy('heavyService', () => new HeavyComputationService());

// Lazy singleton - created once on first access
container.registerLazySingleton('expensiveResource', () => {
  return new ExpensiveResourceService();
});
```

---

## Advanced Patterns

### 1. Interceptors and Decorators

```typescript
// Service interceptor
container.registerInterceptor('userService', (service, method, args) => {
  console.log(`Calling ${method} with args:`, args);
  const result = service[method](...args);
  console.log(`Result:`, result);
  return result;
});

// Caching decorator
container.registerDecorator('expensiveService', service => {
  return new CachingProxy(service, { ttl: 300000 }); // 5 min cache
});
```

### 2. Auto-Registration

```typescript
// Auto-register all services in a directory
container.autoRegister('./src/services/**/*.service.ts', {
  lifetime: 'transient',
  nameTransform: filename => filename.replace('.service', ''),
});

// Convention-based registration
container.autoRegisterByConvention('./src', {
  servicePattern: '**/*.service.ts',
  controllerPattern: '**/*.controller.ts',
  repositoryPattern: '**/*.repository.ts',
});
```

### 3. Module System

```typescript
// Service module
class UserModule implements IServiceModule {
  register(container: DIContainer): void {
    container.register('userService', UserService);
    container.register('userRepository', UserRepository);
    container.register('userController', UserController);
  }
}

// Register module
container.registerModule(new UserModule());

// Conditional module loading
if (config.features.enablePayments) {
  container.registerModule(new PaymentModule());
}
```

---

## Integration Examples

### 1. Express-style Route Handlers

```typescript
// Dependency injection in route handlers
app.get('/users', async ctx => {
  const userService = ctx.container.resolve<UserService>('userService');
  const users = await userService.getAllUsers();
  ctx.res.json(users);
});

// Constructor injection pattern
class UserController {
  constructor(
    private userService: UserService,
    private logger: Logger
  ) {}

  async getUsers(ctx: Context): Promise<void> {
    this.logger.info('Fetching all users');
    const users = await this.userService.getAllUsers();
    ctx.res.json(users);
  }
}

// Register controller with dependencies
container.register('userController', container => {
  return new UserController(
    container.resolve('userService'),
    container.resolve('logger')
  );
});
```

### 2. Middleware Integration

```typescript
// DI-aware middleware factory
function createAuthMiddleware(container: DIContainer): Middleware {
  return async (ctx, next) => {
    const authService = container.resolve<AuthService>('authService');
    const token = ctx.headers.authorization;

    if (token) {
      ctx.user = await authService.validateToken(token);
    }

    await next();
  };
}

// Use in application
app.use(createAuthMiddleware(container));
```

### 3. Plugin Integration

```typescript
// DI-aware plugin
class DatabasePlugin extends BasePlugin {
  name = 'Database';

  install(app: Application): void {
    const container = app.getContainer();

    // Register database services
    container.registerSingleton('database', Database);
    container.register('userRepository', UserRepository);
    container.register('postRepository', PostRepository);

    // Add database connection middleware
    app.use(async (ctx, next) => {
      ctx.db = container.resolve<Database>('database');
      await next();
    });
  }
}
```

---

## Performance Considerations

### 1. Registration Performance

```typescript
// Efficient registration patterns
const container = new DIContainer();

// Pre-compile registrations for better performance
container.optimize();

// Use object keys for better lookup performance
const SERVICES = {
  USER_SERVICE: 'userService',
  EMAIL_SERVICE: 'emailService',
  LOGGER: 'logger',
} as const;

container.register(SERVICES.USER_SERVICE, UserService);
```

### 2. Resolution Performance

```typescript
// Cache frequently used resolutions
const userService = container.resolve<UserService>('userService');

// Use singleton for expensive-to-create services
container.registerSingleton('expensiveService', ExpensiveService);

// Batch resolution when possible
const [userService, emailService, logger] = container.resolveMany([
  'userService',
  'emailService',
  'logger',
]);
```

### 3. Memory Management

```typescript
// Dispose of large services when no longer needed
app.use(async (ctx, next) => {
  const heavyService = container.resolve<HeavyService>('heavyService');

  try {
    await heavyService.process(ctx.body);
  } finally {
    // Clean up if service is disposable
    if ('dispose' in heavyService) {
      heavyService.dispose();
    }
  }

  await next();
});
```

---

## Best Practices

### 1. Service Design

- **Single Responsibility**: Each service should have one clear purpose
- **Interface Segregation**: Use small, focused interfaces
- **Dependency Inversion**: Depend on abstractions, not concretions

### 2. Registration Strategy

- **Register Early**: Register all services during application startup
- **Use Appropriate Lifetimes**: Singleton for stateless services, transient for stateful
- **Avoid Circular Dependencies**: Design services to avoid circular references

### 3. Error Handling

```typescript
// Graceful error handling in factories
container.register('externalApiService', container => {
  try {
    const config = container.resolve<Config>('config');
    return new ExternalApiService(config.apiUrl);
  } catch (error) {
    // Fallback to mock service in case of configuration issues
    return new MockApiService();
  }
});
```

### 4. Testing

```typescript
// Test-friendly registration
describe('UserController', () => {
  let container: DIContainer;
  let userController: UserController;

  beforeEach(() => {
    container = new DIContainer();

    // Mock services for testing
    container.registerInstance('userService', createMockUserService());
    container.registerInstance('logger', createMockLogger());

    userController = container.resolve<UserController>('userController');
  });

  // Tests here...
});
```

---

## Troubleshooting

### Common Issues

1. **Service Not Found**: Ensure service is registered before resolution
2. **Circular Dependencies**: Review service dependencies and break cycles
3. **Memory Leaks**: Properly dispose of services and avoid keeping references
4. **Performance Issues**: Use singletons for expensive services, optimize registration

### Debugging

```typescript
// Enable container debugging
const container = new DIContainer({ debug: true });

// Log all registrations
container.onRegister((key, service) => {
  console.log(`Registered: ${key} -> ${service.constructor.name}`);
});

// Log all resolutions
container.onResolve((key, instance) => {
  console.log(`Resolved: ${key} -> ${instance.constructor.name}`);
});
```

---

_The NextRush v2 DI container provides enterprise-grade dependency injection with zero external dependencies, optimized for high-performance web applications._
