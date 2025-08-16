# 🔌 Plugin Development Guide

Complete guide to creating powerful plugins for NextRush v2, including architecture patterns, best practices, and real-world examples.

---

## 📖 **Table of Contents**

1. [Plugin Architecture Overview](#-plugin-architecture-overview)
2. [Creating Your First Plugin](#-creating-your-first-plugin)
3. [Plugin Lifecycle](#-plugin-lifecycle)
4. [Advanced Plugin Patterns](#-advanced-plugin-patterns)
5. [Plugin Configuration](#-plugin-configuration)
6. [Dependency Management](#-dependency-management)
7. [Testing Plugins](#-testing-plugins)
8. [Publishing Plugins](#-publishing-plugins)
9. [Real-World Examples](#-real-world-examples)

---

## 🏗️ **Plugin Architecture Overview**

### **What is a Plugin?**

A NextRush plugin is a self-contained module that extends the framework's functionality. Plugins can:

- **Add middleware** to the request pipeline
- **Register new routes** and handlers
- **Provide services** via dependency injection
- **Hook into application lifecycle** events
- **Extend context** with new properties/methods

### **Plugin Structure**

```typescript
import type { BasePlugin, Application } from 'nextrush';

export class MyPlugin implements BasePlugin {
  name = 'MyPlugin';
  version = '1.0.0';

  constructor(private options: MyPluginOptions = {}) {}

  async install(app: Application): Promise<void> {
    // Plugin installation logic
  }

  async uninstall?(app: Application): Promise<void> {
    // Optional cleanup logic
  }
}
```

### **Plugin Types**

```typescript
// 1. Middleware Plugin
class LoggerPlugin implements BasePlugin {
  install(app) {
    app.use(this.createLoggerMiddleware());
  }
}

// 2. Service Plugin
class DatabasePlugin implements BasePlugin {
  install(app) {
    app.container.singleton('database', () => new Database());
  }
}

// 3. Route Plugin
class ApiPlugin implements BasePlugin {
  install(app) {
    app.get('/api/health', this.healthCheck);
    app.post('/api/users', this.createUser);
  }
}

// 4. Event Plugin
class NotificationPlugin implements BasePlugin {
  install(app) {
    app.events.on('user.created', this.sendWelcomeEmail);
  }
}
```

---

## 🚀 **Creating Your First Plugin**

### **Step 1: Basic Plugin Structure**

```typescript
// src/plugins/hello-world.plugin.ts
import type { BasePlugin, Application, Context } from 'nextrush';

export interface HelloWorldOptions {
  message?: string;
  route?: string;
}

export class HelloWorldPlugin implements BasePlugin {
  name = 'HelloWorld';
  version = '1.0.0';

  constructor(private options: HelloWorldOptions = {}) {}

  async install(app: Application): Promise<void> {
    const { message = 'Hello, World!', route = '/hello' } = this.options;

    // Add route
    app.get(route, (ctx: Context) => {
      ctx.res.json({ message });
    });

    // Add middleware
    app.use(async (ctx, next) => {
      ctx.res.setHeader('X-Powered-By', 'HelloWorld Plugin');
      await next();
    });

    console.log(`✅ HelloWorld plugin installed on ${route}`);
  }
}
```

### **Step 2: Plugin Usage**

```typescript
// app.ts
import { createApp } from 'nextrush';
import { HelloWorldPlugin } from './plugins/hello-world.plugin';

const app = createApp();

// Install plugin
const helloPlugin = new HelloWorldPlugin({
  message: 'Hello from NextRush!',
  route: '/greeting',
});

await helloPlugin.install(app);

app.listen(3000);
```

### **Step 3: Plugin Factory Pattern**

```typescript
// Plugin factory for easier usage
export const helloWorld = (options?: HelloWorldOptions) => {
  return new HelloWorldPlugin(options);
};

// Usage
import { helloWorld } from './plugins/hello-world.plugin';

app.plugin(helloWorld({ message: 'Custom greeting!' }));
```

---

## 🔄 **Plugin Lifecycle**

### **Lifecycle Hooks**

```typescript
export class AdvancedPlugin implements BasePlugin {
  name = 'Advanced';

  // 1. Before installation
  async beforeInstall?(app: Application): Promise<void> {
    console.log('Preparing plugin installation...');
    await this.validateEnvironment();
  }

  // 2. Main installation
  async install(app: Application): Promise<void> {
    console.log('Installing plugin...');
    this.registerServices(app);
    this.addMiddleware(app);
    this.setupRoutes(app);
  }

  // 3. After installation
  async afterInstall?(app: Application): Promise<void> {
    console.log('Plugin installation complete');
    await this.runHealthChecks();
  }

  // 4. Before uninstall
  async beforeUninstall?(app: Application): Promise<void> {
    console.log('Preparing plugin removal...');
    await this.cleanupResources();
  }

  // 5. Main uninstall
  async uninstall?(app: Application): Promise<void> {
    console.log('Uninstalling plugin...');
    this.removeServices(app);
    this.removeMiddleware(app);
  }

  // 6. After uninstall
  async afterUninstall?(app: Application): Promise<void> {
    console.log('Plugin removal complete');
  }
}
```

### **Application Lifecycle Integration**

```typescript
export class DatabasePlugin implements BasePlugin {
  name = 'Database';
  private connection?: DatabaseConnection;

  async install(app: Application): Promise<void> {
    // Connect on app start
    app.events.on('app.starting', async () => {
      this.connection = await this.connect();
      console.log('✅ Database connected');
    });

    // Disconnect on app stop
    app.events.on('app.stopping', async () => {
      await this.connection?.close();
      console.log('✅ Database disconnected');
    });

    // Provide database service
    app.container.singleton('database', () => this.connection);
  }
}
```

---

## 🎯 **Advanced Plugin Patterns**

### **Configurable Plugin with Validation**

```typescript
import { z } from 'zod';

const CachePluginSchema = z.object({
  provider: z.enum(['redis', 'memory', 'file']),
  ttl: z.number().min(1).default(3600),
  maxSize: z.number().min(1).default(1000),
  keyPrefix: z.string().default('cache:'),
  redis: z
    .object({
      url: z.string().url(),
      db: z.number().default(0),
    })
    .optional(),
});

type CachePluginOptions = z.infer<typeof CachePluginSchema>;

export class CachePlugin implements BasePlugin {
  name = 'Cache';
  private options: CachePluginOptions;
  private cache: CacheProvider;

  constructor(options: Partial<CachePluginOptions> = {}) {
    this.options = CachePluginSchema.parse(options);
  }

  async install(app: Application): Promise<void> {
    // Initialize cache provider
    this.cache = await this.createCacheProvider();

    // Register cache service
    app.container.singleton('cache', () => this.cache);

    // Add cache middleware
    app.use(this.createCacheMiddleware());

    // Add cache management routes
    this.addCacheRoutes(app);
  }

  private async createCacheProvider(): Promise<CacheProvider> {
    switch (this.options.provider) {
      case 'redis':
        return new RedisCache(this.options);
      case 'memory':
        return new MemoryCache(this.options);
      case 'file':
        return new FileCache(this.options);
    }
  }
}
```

### **Plugin with Dependency Injection**

```typescript
export class MetricsPlugin implements BasePlugin {
  name = 'Metrics';

  constructor(
    private options: MetricsOptions,
    private logger = inject('logger'),
    private cache = inject('cache')
  ) {}

  async install(app: Application): Promise<void> {
    // Create metrics collector
    const collector = new MetricsCollector({
      logger: this.logger,
      cache: this.cache,
    });

    // Register metrics service
    app.container.singleton('metrics', () => collector);

    // Add metrics middleware
    app.use(async (ctx, next) => {
      const start = Date.now();

      try {
        await next();
        collector.recordRequest({
          method: ctx.method,
          path: ctx.path,
          status: ctx.res.statusCode,
          duration: Date.now() - start,
        });
      } catch (error) {
        collector.recordError(error);
        throw error;
      }
    });

    // Metrics endpoint
    app.get('/metrics', ctx => {
      ctx.res.text(collector.export());
    });
  }
}
```

### **Composable Plugin System**

```typescript
export class PluginComposer {
  private plugins: BasePlugin[] = [];

  add(plugin: BasePlugin): this {
    this.plugins.push(plugin);
    return this;
  }

  remove(name: string): this {
    this.plugins = this.plugins.filter(p => p.name !== name);
    return this;
  }

  async install(app: Application): Promise<void> {
    // Install plugins in dependency order
    const sorted = this.sortByDependencies();

    for (const plugin of sorted) {
      await plugin.beforeInstall?.(app);
      await plugin.install(app);
      await plugin.afterInstall?.(app);

      console.log(`✅ Plugin ${plugin.name} installed`);
    }
  }

  async uninstall(app: Application): Promise<void> {
    // Uninstall in reverse order
    const reversed = [...this.plugins].reverse();

    for (const plugin of reversed) {
      await plugin.beforeUninstall?.(app);
      await plugin.uninstall?.(app);
      await plugin.afterUninstall?.(app);

      console.log(`✅ Plugin ${plugin.name} uninstalled`);
    }
  }
}

// Usage
const composer = new PluginComposer()
  .add(new DatabasePlugin())
  .add(new CachePlugin())
  .add(new MetricsPlugin());

await composer.install(app);
```

---

## ⚙️ **Plugin Configuration**

### **Environment-based Configuration**

```typescript
export class ConfigurablePlugin implements BasePlugin {
  name = 'Configurable';
  private config: PluginConfig;

  constructor(options: Partial<PluginConfig> = {}) {
    this.config = this.loadConfig(options);
  }

  private loadConfig(options: Partial<PluginConfig>): PluginConfig {
    return {
      // Default values
      enabled: true,
      logLevel: 'info',

      // Environment overrides
      ...this.loadFromEnvironment(),

      // Option overrides
      ...options,
    };
  }

  private loadFromEnvironment(): Partial<PluginConfig> {
    return {
      enabled: process.env.PLUGIN_ENABLED === 'true',
      logLevel: process.env.PLUGIN_LOG_LEVEL as LogLevel,
      apiKey: process.env.PLUGIN_API_KEY,
    };
  }

  async install(app: Application): Promise<void> {
    if (!this.config.enabled) {
      console.log('Plugin disabled, skipping installation');
      return;
    }

    // Install with configuration
    this.setupWithConfig(app);
  }
}
```

### **Dynamic Configuration Updates**

```typescript
export class DynamicPlugin implements BasePlugin {
  name = 'Dynamic';
  private config: PluginConfig;
  private watchers: FileWatcher[] = [];

  async install(app: Application): Promise<void> {
    // Load initial config
    this.config = await this.loadConfig();

    // Watch for config changes
    const watcher = new FileWatcher('config/plugin.json');
    watcher.on('change', async () => {
      console.log('Config changed, reloading...');
      await this.reloadConfig();
    });

    this.watchers.push(watcher);

    // Setup with initial config
    this.setupWithConfig(app);
  }

  private async reloadConfig(): Promise<void> {
    const newConfig = await this.loadConfig();

    if (this.configChanged(this.config, newConfig)) {
      this.config = newConfig;
      this.applyConfigChanges();
    }
  }

  async uninstall(): Promise<void> {
    // Cleanup watchers
    this.watchers.forEach(w => w.close());
  }
}
```

---

## 🔗 **Dependency Management**

### **Plugin Dependencies**

```typescript
export class DependentPlugin implements BasePlugin {
  name = 'Dependent';
  dependencies = ['Database', 'Cache', 'Logger'];

  async install(app: Application): Promise<void> {
    // Verify dependencies are available
    for (const dep of this.dependencies) {
      if (!app.hasPlugin(dep)) {
        throw new Error(`Plugin ${dep} is required but not installed`);
      }
    }

    // Use dependency services
    const db = app.container.get('database');
    const cache = app.container.get('cache');
    const logger = app.container.get('logger');

    // Setup with dependencies
    this.setupWithDependencies(db, cache, logger);
  }
}
```

### **Optional Dependencies**

```typescript
export class FlexiblePlugin implements BasePlugin {
  name = 'Flexible';
  optionalDependencies = ['metrics', 'notifications'];

  async install(app: Application): Promise<void> {
    // Use optional dependencies if available
    const metrics = app.container.tryGet('metrics');
    const notifications = app.container.tryGet('notifications');

    this.setupFeatures({
      hasMetrics: !!metrics,
      hasNotifications: !!notifications,
      metrics,
      notifications,
    });
  }
}
```

---

## 🧪 **Testing Plugins**

### **Unit Testing**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from 'nextrush';
import { MyPlugin } from '../src/my-plugin';

describe('MyPlugin', () => {
  let app: Application;
  let plugin: MyPlugin;

  beforeEach(() => {
    app = createApp();
    plugin = new MyPlugin();
  });

  it('should install successfully', async () => {
    await expect(plugin.install(app)).resolves.not.toThrow();
  });

  it('should register services', async () => {
    await plugin.install(app);

    expect(app.container.has('myService')).toBe(true);
  });

  it('should add middleware', async () => {
    const middlewareCount = app.middlewareCount;

    await plugin.install(app);

    expect(app.middlewareCount).toBe(middlewareCount + 1);
  });
});
```

### **Integration Testing**

```typescript
import request from 'supertest';

describe('Plugin Integration', () => {
  it('should handle requests correctly', async () => {
    const app = createApp();
    const plugin = new MyPlugin({ route: '/test' });

    await plugin.install(app);

    const response = await request(app.callback()).get('/test').expect(200);

    expect(response.body).toEqual({ message: 'Plugin working!' });
  });

  it('should work with other plugins', async () => {
    const app = createApp();

    await new DatabasePlugin().install(app);
    await new MyPlugin().install(app);

    // Test plugin interaction
    const response = await request(app.callback())
      .post('/data')
      .send({ value: 'test' })
      .expect(201);

    expect(response.body.saved).toBe(true);
  });
});
```

### **Mock Dependencies**

```typescript
describe('Plugin with Dependencies', () => {
  it('should work with mock dependencies', async () => {
    const app = createApp();

    // Mock dependencies
    const mockDatabase = {
      save: vi.fn().mockResolvedValue({ id: '123' }),
      find: vi.fn().mockResolvedValue([]),
    };

    app.container.singleton('database', () => mockDatabase);

    const plugin = new DatabasePlugin();
    await plugin.install(app);

    // Test plugin behavior with mocks
    const result = await plugin.saveData({ test: 'data' });
    expect(mockDatabase.save).toHaveBeenCalled();
  });
});
```

---

## 📦 **Publishing Plugins**

### **Package Structure**

```
my-nextrush-plugin/
├── src/
│   ├── index.ts          # Plugin export
│   ├── plugin.ts         # Plugin implementation
│   └── types.ts          # TypeScript types
├── dist/                 # Compiled output
├── tests/                # Test files
├── README.md             # Plugin documentation
├── package.json          # Package configuration
└── tsconfig.json         # TypeScript config
```

### **Package.json Configuration**

```json
{
  "name": "@yourname/nextrush-plugin-example",
  "version": "1.0.0",
  "description": "Example plugin for NextRush v2",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["nextrush", "plugin", "middleware"],
  "peerDependencies": {
    "nextrush": "^2.0.0"
  },
  "devDependencies": {
    "nextrush": "^2.0.0",
    "typescript": "^5.0.0"
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "prepublishOnly": "npm run build && npm test"
  }
}
```

### **Plugin Index File**

```typescript
// src/index.ts
export { MyPlugin } from './plugin';
export { myPlugin } from './factory';
export type { MyPluginOptions } from './types';

// Default export for easy importing
export default MyPlugin;
```

---

## 🌍 **Real-World Examples**

### **Authentication Plugin**

```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export class AuthPlugin implements BasePlugin {
  name = 'Auth';

  constructor(private options: AuthOptions) {}

  async install(app: Application): Promise<void> {
    // Register auth service
    app.container.singleton('auth', () => new AuthService(this.options));

    // Add auth middleware
    app.use(this.createAuthMiddleware());

    // Add auth routes
    app.post('/auth/login', this.login.bind(this));
    app.post('/auth/logout', this.logout.bind(this));
    app.post('/auth/refresh', this.refresh.bind(this));
    app.get('/auth/me', this.requireAuth, this.me.bind(this));
  }

  private createAuthMiddleware() {
    return async (ctx: Context, next: () => Promise<void>) => {
      const token = this.extractToken(ctx);

      if (token) {
        try {
          const payload = jwt.verify(token, this.options.secret);
          ctx.state.user = await this.loadUser(payload.sub);
        } catch (error) {
          // Invalid token, continue without user
        }
      }

      await next();
    };
  }

  private async login(ctx: Context) {
    const { email, password } = ctx.body;

    const user = await this.findUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      ctx.res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      this.options.secret,
      { expiresIn: '1h' }
    );

    ctx.res.json({ token, user: this.sanitizeUser(user) });
  }
}
```

### **Monitoring Plugin**

```typescript
import prometheus from 'prom-client';

export class MonitoringPlugin implements BasePlugin {
  name = 'Monitoring';
  private metrics: Map<string, prometheus.Counter | prometheus.Histogram>;

  async install(app: Application): Promise<void> {
    this.setupMetrics();

    // Add metrics middleware
    app.use(this.createMetricsMiddleware());

    // Metrics endpoint
    app.get('/metrics', ctx => {
      ctx.res.text(prometheus.register.metrics());
    });

    // Health check endpoint
    app.get('/health', this.healthCheck.bind(this));
  }

  private setupMetrics() {
    this.metrics = new Map([
      [
        'requests_total',
        new prometheus.Counter({
          name: 'http_requests_total',
          help: 'Total HTTP requests',
          labelNames: ['method', 'route', 'status'],
        }),
      ],
      [
        'request_duration',
        new prometheus.Histogram({
          name: 'http_request_duration_seconds',
          help: 'HTTP request duration',
          labelNames: ['method', 'route'],
        }),
      ],
    ]);
  }

  private createMetricsMiddleware() {
    return async (ctx: Context, next: () => Promise<void>) => {
      const start = Date.now();

      try {
        await next();

        this.recordMetrics({
          method: ctx.method,
          route: ctx.route?.path || ctx.path,
          status: ctx.res.statusCode,
          duration: (Date.now() - start) / 1000,
        });
      } catch (error) {
        this.recordMetrics({
          method: ctx.method,
          route: ctx.route?.path || ctx.path,
          status: 500,
          duration: (Date.now() - start) / 1000,
        });
        throw error;
      }
    };
  }
}
```

---

## 💡 **Best Practices**

### **1. Plugin Naming Convention**

```typescript
// ✅ Good naming
class LoggerPlugin implements BasePlugin {
  name = 'Logger';
}

// ❌ Avoid generic names
class UtilsPlugin implements BasePlugin {
  name = 'Utils';
}
```

### **2. Graceful Degradation**

```typescript
// ✅ Handle missing dependencies gracefully
async install(app: Application) {
  const cache = app.container.tryGet('cache');

  if (cache) {
    this.enableCaching(cache);
  } else {
    console.warn('Cache not available, running without caching');
  }
}
```

### **3. Resource Cleanup**

```typescript
// ✅ Always implement cleanup
async uninstall(app: Application) {
  await this.closeConnections();
  this.clearTimers();
  this.removeEventListeners();
}
```

---

## 🚀 **Next Steps**

1. **Study**: [Plugin Architecture](../architecture/plugin-system.md)
2. **Learn**: [Built-in Plugins](../api/plugins.md)
3. **Practice**: Create your first plugin
4. **Publish**: Share with the community

---

## 📖 **See Also**

- [Middleware Development Guide](./middleware-development.md)
- [Dependency Injection Guide](../architecture/dependency-injection.md)
- [Testing Guide](./testing-guide.md)
- [Performance Optimization](./performance-optimization.md)
