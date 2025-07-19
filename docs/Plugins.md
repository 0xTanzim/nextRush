# 🔌 Plugin System Guide

The NextRush framework is built around a powerful plugin architecture that makes the framework modular, extensible, and maintainable. Every feature in NextRush is implemented as a plugin, providing consistent APIs, type safety, and unified lifecycle management.

## 📚 Table of Contents

- [Overview](#-overview)
- [Plugin Architecture](#%EF%B8%8F-plugin-architecture)
- [Core Plugins](#-core-plugins)
- [Plugin Lifecycle](#-plugin-lifecycle)
- [Built-in Plugins](#-built-in-plugins)
- [Creating Custom Plugins](#%EF%B8%8F-creating-custom-plugins)
- [Plugin Configuration](#%EF%B8%8F-plugin-configuration)
- [Plugin Registry](#-plugin-registry)
- [Event System](#-event-system)
- [Performance Optimization](#-performance-optimization)
- [Best Practices](#-best-practices)

## 🎯 Overview

### Core Principles

- **🧩 Modular Design**: Every feature is a self-contained plugin
- **🔄 Unified Lifecycle**: Consistent install → start → stop pattern
- **📦 Type Safety**: Full TypeScript support with interface contracts
- **🔗 Event-Driven**: Plugin communication through event system
- **⚡ Performance**: Lazy loading and conditional activation
- **🛠️ Extensible**: Easy to create custom plugins

### Benefits

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// All features come from plugins
app.get('/api/users', (req, res) => {
  // Router Plugin
  const data = req.body; // BodyParser Plugin
  const isValid = req.validate(data); // Validation Plugin
  res.json({ success: true }); // Response Enhancement Plugin
});

app.listen(3000); // Server lifecycle managed by plugins
```

## 🏗️ Plugin Architecture

### BasePlugin Class

All plugins inherit from the `BasePlugin` class:

```typescript
import { BasePlugin, PluginRegistry } from 'nextrush';

export abstract class BasePlugin {
  abstract name: string;
  protected registry: PluginRegistry;

  constructor(registry: PluginRegistry) {
    this.registry = registry;
  }

  // Core lifecycle methods
  abstract install(app: Application): void;
  abstract start(): void;
  abstract stop(): void;

  // Event system
  protected emit(event: string, ...args: any[]): void;
  protected on(event: string, callback: (...args: any[]) => void): void;
}
```

### Plugin Contract

Every plugin must implement three lifecycle methods:

1. **`install(app)`**: Register capabilities with the application
2. **`start()`**: Activate the plugin's functionality
3. **`stop()`**: Cleanup and deactivate the plugin

## 🔧 Core Plugins

### Router Plugin

Provides routing capabilities to the application:

```typescript
export class RouterPlugin extends BasePlugin {
  name = 'Router';

  install(app: Application): void {
    // Add HTTP methods to app
    app.get = (path, ...handlers) => {
      /* implementation */
    };
    app.post = (path, ...handlers) => {
      /* implementation */
    };
    app.put = (path, ...handlers) => {
      /* implementation */
    };
    app.delete = (path, ...handlers) => {
      /* implementation */
    };

    // Add middleware support
    app.use = (path, ...handlers) => {
      /* implementation */
    };
  }

  start(): void {
    this.emit('router:started');
  }

  stop(): void {
    this.emit('router:stopped');
  }
}
```

### Body Parser Plugin

Handles automatic request body parsing:

```typescript
export class BodyParserPlugin extends BasePlugin {
  name = 'BodyParser';

  install(app: Application): void {
    // Auto-parsing middleware
    app.use(this.createAutoParsingMiddleware());

    // Manual parsing methods
    app.json = (options) => this.createJsonMiddleware(options);
    app.urlencoded = (options) => this.createUrlencodedMiddleware(options);
    app.text = (options) => this.createTextMiddleware(options);
    app.raw = (options) => this.createRawMiddleware(options);
  }

  private createAutoParsingMiddleware() {
    return async (req, res, next) => {
      await this.parseRequestBody(req, res);
      next();
    };
  }
}
```

### Middleware Plugin

Provides middleware composition and built-in middleware:

```typescript
export class MiddlewarePlugin extends BasePlugin {
  name = 'Middleware';

  install(app: Application): void {
    // Built-in middleware
    app.cors = (options) => this.createCorsMiddleware(options);
    app.helmet = (options) => this.createHelmetMiddleware(options);
    app.logger = (options) => this.createLoggerMiddleware(options);
    app.compression = (options) => this.createCompressionMiddleware(options);

    // Middleware presets
    app.usePreset = (name, options) => this.applyPreset(name, options);
  }
}
```

## 🔄 Plugin Lifecycle

### Installation Phase

During application creation, plugins are installed:

```typescript
// Plugin installation order
const app = createApp();

// 1. Register plugins
const plugins = createCorePlugins(app.registry);
plugins.forEach((plugin) => app.registry.register(plugin));

// 2. Install plugins
await app.registry.installAll(app);

// 3. Start plugins
await app.registry.startAll();
```

### Runtime Phase

Plugins operate during request/response cycles:

```typescript
app.get('/api/data', (req, res) => {
  // Multiple plugins work together:
  // - Router Plugin: Matched this route
  // - BodyParser Plugin: Parsed req.body
  // - Validation Plugin: Provides req.validate()
  // - Response Plugin: Enhanced res.json()

  const validation = req.validate(req.body, schema);
  if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
  }

  res.json({ success: true });
});
```

### Shutdown Phase

Clean shutdown stops all plugins:

```typescript
process.on('SIGTERM', async () => {
  await app.registry.stopAll();
  process.exit(0);
});
```

## 🔧 Built-in Plugins

### Authentication Plugin

```typescript
export class AuthPlugin extends BasePlugin {
  name = 'Auth';

  install(app: Application): void {
    // JWT methods
    app.jwt = (options) => this.createJwtMiddleware(options);
    app.requireAuth = () => this.createAuthRequiredMiddleware();

    // Session methods
    app.session = (options) => this.createSessionMiddleware(options);

    // Role-based access
    app.requireRole = (roles) => this.createRoleMiddleware(roles);
    app.requirePermission = (permission) =>
      this.createPermissionMiddleware(permission);
  }
}

// Usage
app.use('/api/admin', app.requireRole(['admin']));
app.use('/api/protected', app.requireAuth());
```

### CORS Plugin

```typescript
export class CorsPlugin extends BasePlugin {
  name = 'CORS';

  install(app: Application): void {
    app.enableCors = (options) => this.createCorsMiddleware(options);
    app.cors = (options) => this.createCorsMiddleware(options);
  }
}

// Usage with presets
app.enableCors(CorsPresets.development());
app.enableCors(CorsPresets.production(['https://myapp.com']));
```

### Metrics Plugin

```typescript
export class MetricsPlugin extends BasePlugin {
  name = 'Metrics';

  install(app: Application): void {
    // Automatic request tracking
    app.use(this.createRequestTrackingMiddleware());

    // Metrics endpoint
    app.get('/metrics', this.createMetricsHandler());

    // Custom metrics
    app.addMetric = (name, value, labels) =>
      this.addCustomMetric(name, value, labels);
    app.addHealthCheck = (name, check) => this.addHealthCheck(name, check);
  }
}
```

### Rate Limiter Plugin

```typescript
export class RateLimiterPlugin extends BasePlugin {
  name = 'RateLimiter';

  install(app: Application): void {
    app.rateLimit = (options) => this.createRateLimitMiddleware(options);
    app.createLimiter = (options) => this.createCustomLimiter(options);
  }
}

// Usage
app.use(
  '/api',
  app.rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
  })
);
```

### Static Files Plugin

```typescript
export class StaticFilesPlugin extends BasePlugin {
  name = 'StaticFiles';

  install(app: Application): void {
    app.static = (mountPath, rootPath, options) => {
      this.addMount(mountPath, rootPath, options);
    };

    // Enhanced static serving with caching, compression, etc.
    app.use(this.createStaticMiddleware());
  }
}

// Usage
app.static('/assets', './public', {
  maxAge: '1d',
  etag: true,
  compression: true,
});
```

### WebSocket Plugin

```typescript
export class WebSocketPlugin extends BasePlugin {
  name = 'WebSocket';

  install(app: Application): void {
    app.ws = (path, handler) => this.addWebSocketRoute(path, handler);
    app.broadcast = (event, data) => this.broadcast(event, data);
    app.createNamespace = (namespace) => this.createNamespace(namespace);
  }
}

// Usage
app.ws('/chat', (socket) => {
  socket.on('message', (data) => {
    app.broadcast('chat:message', data);
  });
});
```

## 🛠️ Creating Custom Plugins

### Basic Plugin Structure

```typescript
import { BasePlugin, PluginRegistry } from 'nextrush';

export class MyCustomPlugin extends BasePlugin {
  name = 'MyCustom';

  constructor(registry: PluginRegistry, private options: MyPluginOptions = {}) {
    super(registry);
  }

  install(app: Application): void {
    // Add methods to the application
    app.myFeature = (options) => this.createMyFeature(options);

    // Add middleware
    app.use(this.createMyMiddleware());

    // Register routes
    app.get('/my-endpoint', this.createMyHandler());
  }

  start(): void {
    console.log('My custom plugin started');
    this.emit('myCustom:started');
  }

  stop(): void {
    console.log('My custom plugin stopped');
    this.emit('myCustom:stopped');
  }

  private createMyFeature(options: any) {
    return (req, res, next) => {
      // Custom middleware logic
      next();
    };
  }
}
```

### Advanced Plugin Example

```typescript
export class CachePlugin extends BasePlugin {
  name = 'Cache';
  private cache = new Map<string, CacheEntry>();
  private stats = { hits: 0, misses: 0 };

  constructor(registry: PluginRegistry, private options: CacheOptions = {}) {
    super(registry);
    this.options = {
      defaultTTL: 300, // 5 minutes
      maxSize: 1000, // Max entries
      ...options,
    };
  }

  install(app: Application): void {
    // Cache middleware
    app.cache = (ttl?) => this.createCacheMiddleware(ttl);

    // Manual cache operations
    app.setCache = (key, value, ttl?) => this.set(key, value, ttl);
    app.getCache = (key) => this.get(key);
    app.deleteCache = (key) => this.delete(key);
    app.clearCache = () => this.clear();

    // Cache statistics
    app.getCacheStats = () => this.getStats();

    // Cache admin endpoint
    if (this.options.adminEndpoint) {
      app.get('/admin/cache', this.createAdminHandler());
    }
  }

  start(): void {
    // Start cleanup interval
    if (this.options.cleanupInterval) {
      setInterval(() => this.cleanup(), this.options.cleanupInterval);
    }
    this.emit('cache:started');
  }

  stop(): void {
    this.clear();
    this.emit('cache:stopped');
  }

  private createCacheMiddleware(ttl: number = this.options.defaultTTL) {
    return (req, res, next) => {
      const key = `${req.method}:${req.url}`;
      const cached = this.get(key);

      if (cached) {
        this.stats.hits++;
        return res.json(cached.value);
      }

      this.stats.misses++;

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = (data) => {
        this.set(key, data, ttl);
        return originalJson.call(res, data);
      };

      next();
    };
  }

  private set(
    key: string,
    value: any,
    ttl: number = this.options.defaultTTL
  ): void {
    // Implement size limit
    if (this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + ttl * 1000,
      accessed: Date.now(),
    });
  }

  private get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    entry.accessed = Date.now();
    return entry;
  }
}

// Register and use the plugin
app.plugin(
  new CachePlugin(app.registry, {
    defaultTTL: 600,
    maxSize: 5000,
    adminEndpoint: true,
  })
);

// Usage
app.use('/api/expensive', app.cache(3600)); // Cache for 1 hour
```

## ⚙️ Plugin Configuration

### Configuration Options

```typescript
export interface PluginOptions {
  enabled?: boolean;
  priority?: number;
  dependencies?: string[];
  autoStart?: boolean;
  config?: Record<string, any>;
}

// Configure plugins
const plugins = createCorePlugins(app.registry);

app.configurePlugin('BodyParser', {
  maxSize: 5 * 1024 * 1024, // 5MB
  timeout: 60000,
  json: { strict: true },
});

app.configurePlugin('RateLimiter', {
  windowMs: 900000, // 15 minutes
  max: 1000,
});
```

### Environment-Specific Configuration

```typescript
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Conditional plugin loading
if (isDevelopment) {
  app.plugin(new DebugPlugin(app.registry));
  app.plugin(new DevToolsPlugin(app.registry));
}

if (isProduction) {
  app.plugin(
    new MonitoringPlugin(app.registry, {
      endpoint: process.env.MONITORING_URL,
    })
  );
}

// Environment-specific configuration
app.configurePlugin('Metrics', {
  enabled: isProduction,
  endpoint: '/metrics',
  collectDefaultMetrics: true,
});
```

## 📊 Plugin Registry

### Registry Management

```typescript
// Manual plugin management
const registry = app.registry;

// Check plugin status
if (registry.has('Auth')) {
  console.log('Auth plugin is registered');
}

// Get plugin instance
const authPlugin = registry.get('Auth');

// List all plugins
const allPlugins = registry.getAll();
console.log(
  'Registered plugins:',
  allPlugins.map((p) => p.name)
);

// Plugin statistics
const stats = registry.getStats();
console.log('Plugin stats:', stats);
```

### Dynamic Plugin Loading

```typescript
// Load plugins conditionally
async function loadPlugins(app: Application) {
  const registry = app.registry;

  // Always load core plugins
  const corePlugins = createCorePlugins(registry);
  for (const plugin of corePlugins) {
    await registry.register(plugin);
  }

  // Load feature plugins based on configuration
  const config = await loadConfiguration();

  if (config.features.authentication) {
    await registry.register(new AuthPlugin(registry, config.auth));
  }

  if (config.features.metrics) {
    await registry.register(new MetricsPlugin(registry, config.metrics));
  }

  if (config.features.websockets) {
    await registry.register(new WebSocketPlugin(registry, config.websocket));
  }

  // Install and start all registered plugins
  await registry.installAll(app);
  await registry.startAll();
}
```

## 🔔 Event System

### Plugin Communication

Plugins communicate through an event system:

```typescript
export class MetricsPlugin extends BasePlugin {
  install(app: Application): void {
    // Listen to other plugin events
    this.on('request:start', (req) => {
      this.trackRequest(req);
    });

    this.on('auth:login', (user) => {
      this.trackLogin(user);
    });

    this.on('error:occurred', (error) => {
      this.trackError(error);
    });
  }

  start(): void {
    // Emit plugin-specific events
    this.emit('metrics:started');
  }
}

export class AuthPlugin extends BasePlugin {
  private handleLogin(user: User): void {
    // Do login logic...

    // Notify other plugins
    this.emit('auth:login', user);
    this.emit('user:authenticated', user);
  }

  private handleLogout(user: User): void {
    // Do logout logic...

    // Notify other plugins
    this.emit('auth:logout', user);
    this.emit('user:deauthenticated', user);
  }
}
```

### Custom Events

```typescript
// Create custom events for your plugins
export class OrderPlugin extends BasePlugin {
  name = 'Order';

  install(app: Application): void {
    app.post('/orders', async (req, res) => {
      const order = await this.createOrder(req.body);

      // Emit events for other plugins to handle
      this.emit('order:created', order);
      this.emit('inventory:update', order.items);
      this.emit('email:send', {
        to: order.customerEmail,
        template: 'order-confirmation',
        data: order,
      });

      res.json(order);
    });
  }
}

// Other plugins can listen to these events
export class EmailPlugin extends BasePlugin {
  install(app: Application): void {
    this.on('email:send', async (emailData) => {
      await this.sendEmail(emailData);
    });
  }
}

export class InventoryPlugin extends BasePlugin {
  install(app: Application): void {
    this.on('inventory:update', async (items) => {
      await this.updateInventory(items);
    });
  }
}
```

## ⚡ Performance Optimization

### Lazy Loading

```typescript
// Lazy plugin loading
export class LazyPluginLoader {
  private loadedPlugins = new Set<string>();

  async loadPluginOnDemand(name: string, app: Application): Promise<void> {
    if (this.loadedPlugins.has(name)) return;

    let plugin: BasePlugin;

    switch (name) {
      case 'PaymentProcessor':
        const { PaymentPlugin } = await import('./plugins/payment.plugin');
        plugin = new PaymentPlugin(app.registry);
        break;

      case 'EmailService':
        const { EmailPlugin } = await import('./plugins/email.plugin');
        plugin = new EmailPlugin(app.registry);
        break;

      default:
        throw new Error(`Unknown plugin: ${name}`);
    }

    await app.registry.register(plugin);
    await plugin.install(app);
    await plugin.start();

    this.loadedPlugins.add(name);
  }
}

// Usage
app.post('/payment', async (req, res) => {
  await lazyLoader.loadPluginOnDemand('PaymentProcessor', app);
  // Payment plugin is now available
});
```

### Conditional Plugin Activation

```typescript
// Activate plugins based on runtime conditions
export class ConditionalPluginManager {
  async activatePluginsForRequest(
    req: Request,
    app: Application
  ): Promise<void> {
    const userAgent = req.headers['user-agent'];
    const path = req.path;

    // Load mobile-specific plugins for mobile requests
    if (this.isMobileUserAgent(userAgent)) {
      await this.ensurePluginLoaded('MobileOptimization', app);
    }

    // Load analytics plugins for specific paths
    if (path.startsWith('/api/analytics')) {
      await this.ensurePluginLoaded('AdvancedAnalytics', app);
    }

    // Load heavy plugins only for admin routes
    if (path.startsWith('/admin')) {
      await this.ensurePluginLoaded('AdminDashboard', app);
      await this.ensurePluginLoaded('SystemMonitoring', app);
    }
  }
}
```

### Plugin Caching

```typescript
// Cache plugin results to improve performance
export class CachedPlugin extends BasePlugin {
  private resultCache = new Map<string, any>();
  private cacheExpiry = new Map<string, number>();

  protected cacheResult(key: string, result: any, ttl: number = 300): void {
    this.resultCache.set(key, result);
    this.cacheExpiry.set(key, Date.now() + ttl * 1000);
  }

  protected getCachedResult<T>(key: string): T | null {
    const expiry = this.cacheExpiry.get(key);
    if (!expiry || expiry < Date.now()) {
      this.resultCache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }

    return this.resultCache.get(key) || null;
  }
}
```

## 📋 Best Practices

### 1. **Plugin Design Principles**

```typescript
// ✅ Good: Single responsibility
export class AuthPlugin extends BasePlugin {
  name = 'Auth';
  // Only handles authentication logic
}

export class ValidationPlugin extends BasePlugin {
  name = 'Validation';
  // Only handles validation logic
}

// ❌ Bad: Multiple responsibilities
export class AuthValidationPlugin extends BasePlugin {
  name = 'AuthValidation';
  // Handles both auth AND validation - violates SRP
}
```

### 2. **Error Handling**

```typescript
export class RobustPlugin extends BasePlugin {
  install(app: Application): void {
    try {
      this.setupFeatures(app);
    } catch (error) {
      console.error(`Failed to install ${this.name} plugin:`, error);
      // Don't let one plugin break the entire application
    }
  }

  start(): void {
    try {
      this.initializeServices();
      this.emit('plugin:started');
    } catch (error) {
      console.error(`Failed to start ${this.name} plugin:`, error);
      this.emit('plugin:error', error);
    }
  }
}
```

### 3. **Resource Cleanup**

```typescript
export class CleanPlugin extends BasePlugin {
  private intervals: NodeJS.Timeout[] = [];
  private connections: Connection[] = [];

  start(): void {
    // Store references for cleanup
    const interval = setInterval(() => this.doWork(), 1000);
    this.intervals.push(interval);
  }

  stop(): void {
    // Clean up all resources
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];

    this.connections.forEach((conn) => conn.close());
    this.connections = [];

    this.emit('plugin:stopped');
  }
}
```

### 4. **Type Safety**

```typescript
// Define strong types for plugin options
export interface MyPluginOptions {
  enabled: boolean;
  maxRetries: number;
  timeout: number;
  endpoints: string[];
}

export class TypeSafePlugin extends BasePlugin {
  constructor(registry: PluginRegistry, private options: MyPluginOptions) {
    super(registry);

    // Validate options
    this.validateOptions(options);
  }

  private validateOptions(options: MyPluginOptions): void {
    if (options.timeout < 0) {
      throw new Error('Timeout cannot be negative');
    }
    if (options.maxRetries < 1) {
      throw new Error('Max retries must be at least 1');
    }
  }
}
```

### 5. **Plugin Testing**

```typescript
// Test plugins in isolation
describe('AuthPlugin', () => {
  let plugin: AuthPlugin;
  let mockRegistry: PluginRegistry;
  let mockApp: Application;

  beforeEach(() => {
    mockRegistry = createMockRegistry();
    mockApp = createMockApplication();
    plugin = new AuthPlugin(mockRegistry);
  });

  test('should install auth methods on app', () => {
    plugin.install(mockApp);

    expect(mockApp.jwt).toBeDefined();
    expect(mockApp.requireAuth).toBeDefined();
    expect(mockApp.requireRole).toBeDefined();
  });

  test('should emit events on lifecycle changes', () => {
    const spy = jest.spyOn(plugin, 'emit');

    plugin.start();
    expect(spy).toHaveBeenCalledWith('auth:started');

    plugin.stop();
    expect(spy).toHaveBeenCalledWith('auth:stopped');
  });
});
```

The NextRush plugin system provides a solid foundation for building scalable, maintainable applications. By following the plugin architecture and best practices, developers can create modular applications that are easy to extend, test, and maintain while benefiting from the full power of TypeScript and modern development practices.
