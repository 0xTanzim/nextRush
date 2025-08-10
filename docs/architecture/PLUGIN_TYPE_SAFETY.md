# Plugin Type Safety and Custom Plugin Development

## Table of Contents

- [Plugin Installation Error Handling](#plugin-installation-error-handling)
- [Type Inference for App Instance](#type-inference-for-app-instance)
- [Custom Plugin Development](#custom-plugin-development)
- [Type Safety Best Practices](#type-safety-best-practices)
- [Advanced Type Patterns](#advanced-type-patterns)

## Plugin Installation Error Handling

### Problem: Using Plugin Methods Without Installation

```typescript
// ❌ This will cause runtime errors if plugin isn't installed
app.get('/users', ctx => {
  app.logger.info('Request'); // TypeError: app.logger is undefined
  ctx.res.json({ users: [] });
});
```

### Solution 1: Runtime Checks

```typescript
// ✅ Safe usage with runtime checks
app.get('/users', ctx => {
  if (app.logger) {
    app.logger.info('Request');
  }
  ctx.res.json({ users: [] });
});
```

### Solution 2: Optional Chaining

```typescript
// ✅ Safe usage with optional chaining
app.get('/users', ctx => {
  app.logger?.info('Request');
  ctx.res.json({ users: [] });
});
```

### Solution 3: Plugin Installation Validation

```typescript
// ✅ Validate plugin installation at startup
class Application {
  private validatePluginUsage() {
    const routes = this.getRoutes();
    for (const [path, handler] of routes) {
      const handlerStr = handler.toString();

      if (handlerStr.includes('app.logger') && !this.logger) {
        console.warn(
          `⚠️  Route ${path} uses app.logger but LoggerPlugin is not installed`
        );
      }

      if (handlerStr.includes('app.db') && !this.db) {
        console.warn(
          `⚠️  Route ${path} uses app.db but DatabasePlugin is not installed`
        );
      }
    }
  }
}
```

### Solution 4: Type-Safe Plugin Guards

```typescript
// ✅ Type-safe plugin guards
class PluginGuard {
  static requireLogger(
    app: Application
  ): asserts app is Application & {
    logger: NonNullable<Application['logger']>;
  } {
    if (!app.logger) {
      throw new Error('LoggerPlugin must be installed to use app.logger');
    }
  }

  static requireDatabase(
    app: Application
  ): asserts app is Application & { db: NonNullable<Application['db']> } {
    if (!app.db) {
      throw new Error('DatabasePlugin must be installed to use app.db');
    }
  }
}

// Usage
app.get('/users', ctx => {
  PluginGuard.requireLogger(app);
  PluginGuard.requireDatabase(app);

  // Now TypeScript knows these are defined
  app.logger.info('Request');
  app.db.query('SELECT * FROM users');
});
```

## Type Inference for App Instance

### Problem: How Does App Know About Plugin Types?

When you add plugins, the app instance needs to know about the new methods. Here's how it works:

### Current Implementation

```typescript
// ✅ Current approach - runtime type augmentation
interface Application {
  // Core methods
  use(middleware: Middleware): this;
  get(path: string, handler: RouteHandler): this;

  // Plugin-provided methods (optional)
  logger?: LoggerInstance;
  db?: DatabaseInstance;
  cache?: CacheInstance;
  template?: TemplateInstance;
}
```

### Enhanced Type System

```typescript
// ✅ Enhanced type system with plugin registration
interface PluginRegistry {
  logger?: LoggerPlugin;
  db?: DatabasePlugin;
  cache?: CachePlugin;
  template?: TemplatePlugin;
}

interface Application {
  // Core methods
  use(middleware: Middleware): this;
  get(path: string, handler: RouteHandler): this;

  // Plugin methods (inferred from registry)
  logger?: LoggerInstance;
  db?: DatabaseInstance;
  cache?: CacheInstance;
  template?: TemplateInstance;

  // Plugin registry
  plugins: PluginRegistry;
}
```

### Automatic Type Inference

```typescript
// ✅ Automatic type inference based on installed plugins
class Application {
  private plugins: PluginRegistry = {};

  installPlugin<T extends BasePlugin>(plugin: T): void {
    this.plugins[plugin.name.toLowerCase() as keyof PluginRegistry] = plugin;

    // Type augmentation happens here
    this.augmentTypes(plugin);
  }

  private augmentTypes(plugin: BasePlugin): void {
    switch (plugin.name.toLowerCase()) {
      case 'logger':
        (this as any).logger = (plugin as LoggerPlugin).getInstance();
        break;
      case 'database':
        (this as any).db = (plugin as DatabasePlugin).getInstance();
        break;
      case 'cache':
        (this as any).cache = (plugin as CachePlugin).getInstance();
        break;
      case 'template':
        (this as any).template = (plugin as TemplatePlugin).getInstance();
        break;
    }
  }
}
```

## Custom Plugin Development

### Creating a Custom Plugin

```typescript
// ✅ Custom plugin with full type safety
interface EmailPluginConfig {
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
}

interface EmailInstance {
  send(to: string, subject: string, body: string): Promise<void>;
  sendTemplate(
    to: string,
    template: string,
    data: Record<string, unknown>
  ): Promise<void>;
  validate(email: string): boolean;
}

export class EmailPlugin extends BasePlugin {
  public name = 'Email';
  public version = '1.0.0';

  private config: EmailPluginConfig;
  private emailInstance: EmailInstance;

  constructor(config: EmailPluginConfig) {
    super();
    this.config = config;
    this.emailInstance = this.createEmailInstance();
  }

  onInstall(app: Application): void {
    // ✅ Add methods to app instance
    (app as any).email = this.emailInstance;

    // ✅ Add middleware for email context
    app.use(this.createEmailMiddleware());

    this.log('Email plugin installed');
  }

  private createEmailInstance(): EmailInstance {
    return {
      send: async (to: string, subject: string, body: string) => {
        // Implementation
      },
      sendTemplate: async (
        to: string,
        template: string,
        data: Record<string, unknown>
      ) => {
        // Implementation
      },
      validate: (email: string): boolean => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
    };
  }

  private createEmailMiddleware(): Middleware {
    return (ctx, next) => {
      // ✅ Add to context for request-specific access
      (ctx as any).email = this.emailInstance;
      next();
    };
  }
}
```

### Type Declaration for Custom Plugin

```typescript
// ✅ Type declaration for custom plugin
declare module '@/types/context' {
  interface Application {
    // ... existing methods

    // Custom plugin methods
    email?: EmailInstance;
  }

  interface Context {
    // ... existing properties

    // Custom plugin context
    email?: EmailInstance;
  }
}
```

### Usage of Custom Plugin

```typescript
// ✅ Usage with full type safety
import { EmailPlugin } from './plugins/email';

const app = createApp();

// Install custom plugin
const email = new EmailPlugin({
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  username: 'user@gmail.com',
  password: 'password',
});
email.install(app);

// ✅ TypeScript knows about app.email
app.get('/contact', async ctx => {
  // App-level access
  app.email?.send('admin@example.com', 'New Contact', 'Hello');

  // Context-level access
  ctx.email?.validate('user@example.com');

  ctx.res.json({ message: 'Email sent' });
});
```

## Type Safety Best Practices

### 1. Plugin Installation Validation

```typescript
// ✅ Validate plugin installation at startup
class Application {
  private validateRequiredPlugins(): void {
    const requiredPlugins = this.getRequiredPlugins();

    for (const [pluginName, isRequired] of Object.entries(requiredPlugins)) {
      if (isRequired && !this.plugins[pluginName]) {
        throw new Error(`Required plugin '${pluginName}' is not installed`);
      }
    }
  }

  private getRequiredPlugins(): Record<string, boolean> {
    return {
      logger: this.hasLoggerUsage(),
      db: this.hasDatabaseUsage(),
      email: this.hasEmailUsage(),
    };
  }

  private hasLoggerUsage(): boolean {
    // Check if any route uses app.logger
    return this.routes.some(([_, handler]) =>
      handler.toString().includes('app.logger')
    );
  }
}
```

### 2. Type-Safe Plugin Methods

```typescript
// ✅ Type-safe plugin method access
class PluginMethodGuard {
  static getLogger(app: Application): LoggerInstance {
    if (!app.logger) {
      throw new Error('LoggerPlugin must be installed to use app.logger');
    }
    return app.logger;
  }

  static getDatabase(app: Application): DatabaseInstance {
    if (!app.db) {
      throw new Error('DatabasePlugin must be installed to use app.db');
    }
    return app.db;
  }

  static getEmail(app: Application): EmailInstance {
    if (!app.email) {
      throw new Error('EmailPlugin must be installed to use app.email');
    }
    return app.email;
  }
}

// Usage
app.get('/users', async ctx => {
  const logger = PluginMethodGuard.getLogger(app);
  const db = PluginMethodGuard.getDatabase(app);

  logger.info('Fetching users');
  const users = await db.query('SELECT * FROM users');
  ctx.res.json(users);
});
```

### 3. Conditional Plugin Usage

```typescript
// ✅ Conditional plugin usage with type safety
app.get('/users', async ctx => {
  // Safe conditional usage
  if (app.logger) {
    app.logger.info('Fetching users');
  }

  if (app.db) {
    const users = await app.db.query('SELECT * FROM users');
    ctx.res.json(users);
  } else {
    ctx.res.json({ users: [] });
  }
});
```

## Advanced Type Patterns

### 1. Plugin Type Registry

```typescript
// ✅ Advanced type registry for plugins
type PluginTypeMap = {
  logger: LoggerInstance;
  db: DatabaseInstance;
  cache: CacheInstance;
  email: EmailInstance;
  template: TemplateInstance;
};

type PluginName = keyof PluginTypeMap;

interface Application {
  // Core methods
  use(middleware: Middleware): this;
  get(path: string, handler: RouteHandler): this;

  // Plugin methods (inferred from registry)
  [K in PluginName]?: PluginTypeMap[K];
}
```

### 2. Plugin Installation Tracking

```typescript
// ✅ Track installed plugins for type safety
class PluginTracker {
  private installedPlugins = new Set<string>();

  installPlugin(plugin: BasePlugin): void {
    this.installedPlugins.add(plugin.name.toLowerCase());
  }

  isPluginInstalled(name: string): boolean {
    return this.installedPlugins.has(name.toLowerCase());
  }

  getInstalledPlugins(): string[] {
    return Array.from(this.installedPlugins);
  }

  validatePluginUsage(app: Application): void {
    const routes = app.getRoutes();

    for (const [path, handler] of routes) {
      const handlerStr = handler.toString();

      // Check for plugin usage without installation
      for (const pluginName of this.getInstalledPlugins()) {
        const methodPattern = new RegExp(`app\\.${pluginName}\\b`);
        if (
          methodPattern.test(handlerStr) &&
          !this.isPluginInstalled(pluginName)
        ) {
          console.warn(
            `⚠️  Route ${path} uses app.${pluginName} but ${pluginName}Plugin is not installed`
          );
        }
      }
    }
  }
}
```

### 3. Plugin Method Proxies

```typescript
// ✅ Plugin method proxies for better error handling
class PluginProxy {
  static createLoggerProxy(app: Application): LoggerInstance {
    return new Proxy({} as LoggerInstance, {
      get(target, prop) {
        if (!app.logger) {
          throw new Error(
            `Cannot access app.logger.${String(prop)} - LoggerPlugin is not installed`
          );
        }
        return (app.logger as any)[prop];
      },
    });
  }

  static createDatabaseProxy(app: Application): DatabaseInstance {
    return new Proxy({} as DatabaseInstance, {
      get(target, prop) {
        if (!app.db) {
          throw new Error(
            `Cannot access app.db.${String(prop)} - DatabasePlugin is not installed`
          );
        }
        return (app.db as any)[prop];
      },
    });
  }
}

// Usage
const app = createApp();
const logger = PluginProxy.createLoggerProxy(app);
const db = PluginProxy.createDatabaseProxy(app);

// This will throw a clear error if plugins aren't installed
logger.info('Hello'); // Error: LoggerPlugin is not installed
```

## Summary

### Key Points

1. **Error Handling**: Use optional chaining (`app.logger?.info()`) or runtime checks
2. **Type Inference**: Plugins automatically augment the app instance types
3. **Custom Plugins**: Extend `BasePlugin` and declare types in module augmentation
4. **Type Safety**: Use guards and proxies for better error messages
5. **Validation**: Check plugin installation at startup

### Best Practices

```typescript
// ✅ Recommended approach
const app = createApp();

// Install plugins
const logger = new LoggerPlugin();
const db = new DatabasePlugin();
const email = new EmailPlugin(config);

logger.install(app);
db.install(app);
email.install(app);

// Safe usage with type inference
app.get('/users', async ctx => {
  // App-level access (type-safe)
  app.logger?.info('Fetching users');
  const users = await app.db?.query('SELECT * FROM users');

  // Context-level access (type-safe)
  ctx.email?.send('admin@example.com', 'New user', 'Hello');

  ctx.res.json(users || []);
});
```

This approach provides:

- **Type Safety**: TypeScript knows about plugin methods
- **Error Handling**: Clear errors when plugins aren't installed
- **Flexibility**: Easy to add custom plugins
- **Performance**: Zero runtime overhead
- **Developer Experience**: Intuitive API with good error messages
