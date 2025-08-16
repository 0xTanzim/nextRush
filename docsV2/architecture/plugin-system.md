# Plugin System Architecture

**Extensible, Type-Safe Plugin Architecture for NextRush v2**

---

## Overview

NextRush v2's plugin system represents a fundamental shift in web framework design, moving from monolithic structures to a modular, composable ecosystem. This architecture provides **flexibility** and **extensibility** while maintaining **performance**, **type safety**, and **developer experience**.

The plugin system enables developers to extend framework functionality through a well-defined, type-safe interface that integrates seamlessly with NextRush v2's core architecture.

## The NextRush v2 Plugin Philosophy

### Built-in Core vs. Plugin Extensibility

NextRush v2 takes a **hybrid approach** that balances convenience with extensibility:

```typescript
// ✅ Built-in features: Always available, zero configuration
const app = createApp();
app.get('/users', handler); // Built-in routing
app.use(cors()); // Built-in CORS
app.use(helmet()); // Built-in security

// ✅ Plugin features: Advanced functionality when needed
import { LoggerPlugin, WebSocketPlugin } from 'nextrush';

const logger = new LoggerPlugin({ level: 'info' });
const websocket = new WebSocketPlugin({ path: '/ws' });

logger.install(app);
websocket.install(app);
```

This approach ensures that **common needs are built-in** while **specialized features are available as plugins**. You get the best of both worlds: simplicity for basic use cases and power for complex applications.

### Type-Safe Plugin Development

Unlike many plugin systems that sacrifice type safety for flexibility, NextRush v2 provides **full TypeScript support**:

```typescript
import { BasePlugin } from 'nextrush';
import type { Application, Context } from 'nextrush';

export class MetricsPlugin extends BasePlugin {
  public name = 'MetricsPlugin';
  public version = '1.0.0';
  public description = 'Application metrics collection';

  // TypeScript ensures proper implementation
  public onInstall(app: Application): void {
    // Type-safe context enhancement
    app.use(async (ctx: Context, next) => {
      const start = Date.now();
      await next();
      const duration = Date.now() - start;

      // Fully typed metrics collection
      this.recordMetric('response_time', duration, {
        path: ctx.path,
        method: ctx.method,
        status: ctx.res.statusCode,
      });
    });
  }

  private recordMetric(
    name: string,
    value: number,
    labels: Record<string, any>
  ): void {
    // Type-safe metric recording
  }
}
```

## Core Architecture Principles

### 1. Single Responsibility Principle

Each plugin has **one clear purpose**:

```typescript
// ✅ Good: Focused responsibility
class CachePlugin extends BasePlugin {
  name = 'CachePlugin';
  // Only handles caching logic
}

class LoggerPlugin extends BasePlugin {
  name = 'LoggerPlugin';
  // Only handles logging logic
}

// ❌ Bad: Multiple responsibilities
class CacheLoggerPlugin extends BasePlugin {
  name = 'CacheLoggerPlugin';
  // Handles both caching AND logging - violates SRP
}
```

### 2. Context Enhancement Pattern

Plugins enhance the request context without breaking existing APIs:

```typescript
// Before WebSocket plugin
interface Context {
  req: IncomingMessage;
  res: ServerResponse;
  path: string;
  method: string;
}

// After WebSocket plugin installation
interface WSContext extends Context {
  isWebSocket: boolean; // Added by plugin
  ws?: WSConnection; // Added by plugin
  wsRooms: WSRoomManager; // Added by plugin
}

// Usage remains clean
app.use(async (ctx, next) => {
  const wsCtx = ctx as WSContext;

  if (wsCtx.isWebSocket) {
    // WebSocket-specific logic
  }

  await next();
});
```

### 3. Lifecycle Management

Plugins follow a **predictable lifecycle**:

```typescript
export class DatabasePlugin extends BasePlugin {
  private connection?: DatabaseConnection;

  // 1. Installation: Plugin added to app
  public onInstall(app: Application): void {
    app.use(this.createMiddleware());
  }

  // 2. Initialization: Setup resources
  public async init(): Promise<void> {
    this.connection = await connectToDatabase();
    console.log('Database plugin initialized');
  }

  // 3. Health Check: Monitor plugin status
  public async healthCheck(): Promise<boolean> {
    return this.connection?.isConnected() ?? false;
  }

  // 4. Cleanup: Release resources
  public async cleanup(): Promise<void> {
    await this.connection?.close();
    console.log('Database plugin cleaned up');
  }
}
```

## Plugin Types and Use Cases

### 1. Middleware Plugins

Add request/response processing logic:

```typescript
class SecurityPlugin extends BasePlugin {
  public onInstall(app: Application): void {
    app.use(async (ctx, next) => {
      // Security headers
      ctx.res.setHeader('X-Content-Type-Options', 'nosniff');
      ctx.res.setHeader('X-Frame-Options', 'DENY');
      ctx.res.setHeader('X-XSS-Protection', '1; mode=block');

      await next();
    });
  }
}
```

### 2. Context Enhancement Plugins

Add new capabilities to the request context:

```typescript
class DatabasePlugin extends BasePlugin {
  public onInstall(app: Application): void {
    app.use(async (ctx, next) => {
      // Add database connection to context
      (ctx as any).db = this.getConnection();
      await next();
    });
  }
}

// Usage in routes
app.get('/users', async ctx => {
  const users = await (ctx as any).db.users.findMany();
  ctx.res.json(users);
});
```

### 3. Service Plugins

Provide background services:

```typescript
class SchedulerPlugin extends BasePlugin {
  private jobs = new Map<string, ScheduledJob>();

  public onInstall(app: Application): void {
    // Add scheduler methods to app
    (app as any).schedule = (name: string, cron: string, handler: Function) => {
      this.jobs.set(name, new ScheduledJob(cron, handler));
    };
  }

  public async init(): Promise<void> {
    // Start all scheduled jobs
    for (const job of this.jobs.values()) {
      job.start();
    }
  }
}
```

### 4. Protocol Plugins

Add new communication protocols:

```typescript
class WebSocketPlugin extends BasePlugin {
  public onInstall(app: Application): void {
    // Add WebSocket methods to app
    (app as any).ws = (path: string, handler: WSHandler) => {
      this.registerWSRoute(path, handler);
    };

    // Enhance context with WebSocket detection
    app.use(this.createWSMiddleware());
  }
}
```

## Advanced Plugin Patterns

### Plugin Composition

Combine multiple plugins for complex functionality:

```typescript
class MonitoringPlugin extends BasePlugin {
  constructor(
    private metrics: MetricsPlugin,
    private logger: LoggerPlugin,
    private alerting: AlertingPlugin
  ) {
    super();
  }

  public onInstall(app: Application): void {
    // Compose functionality from other plugins
    app.use(async (ctx, next) => {
      const start = Date.now();

      try {
        await next();

        // Record success metrics
        this.metrics.record('request_success', 1, {
          path: ctx.path,
          method: ctx.method,
        });
      } catch (error) {
        // Log error and send alert
        this.logger.error('Request failed', { error, ctx });
        this.alerting.send('Request Error', error.message);

        throw error;
      } finally {
        // Always record timing
        this.metrics.record('request_duration', Date.now() - start);
      }
    });
  }
}
```

### Plugin Dependencies

Define plugin dependencies and load order:

```typescript
class AdvancedCachePlugin extends BasePlugin {
  public dependencies = ['LoggerPlugin', 'MetricsPlugin'];

  public onInstall(app: Application): void {
    // Can safely use logger and metrics plugins
    const logger = app.getPlugin('LoggerPlugin');
    const metrics = app.getPlugin('MetricsPlugin');

    app.use(async (ctx, next) => {
      const cacheKey = this.generateCacheKey(ctx);
      const cached = await this.getFromCache(cacheKey);

      if (cached) {
        logger.info('Cache hit', { key: cacheKey });
        metrics.increment('cache_hits');
        ctx.res.json(cached);
        return;
      }

      await next();

      // Cache the response
      if (ctx.res.statusCode === 200) {
        await this.setCache(cacheKey, ctx.body);
        metrics.increment('cache_misses');
      }
    });
  }
}
```

### Plugin Configuration

Flexible configuration with validation:

```typescript
interface CachePluginConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  ttl: number;
  maxMemory: string;
  keyPrefix: string;
}

class CachePlugin extends BasePlugin {
  constructor(private config: CachePluginConfig) {
    super();
  }

  public validateConfig(): boolean {
    const schema = z.object({
      redis: z.object({
        host: z.string().min(1),
        port: z.number().min(1).max(65535),
        password: z.string().optional(),
      }),
      ttl: z.number().min(1),
      maxMemory: z.string().regex(/^\d+[MGT]B$/),
      keyPrefix: z.string().min(1),
    });

    try {
      schema.parse(this.config);
      return true;
    } catch {
      return false;
    }
  }
}
```

## Real-World Plugin Examples

### Authentication Plugin

```typescript
import jwt from 'jsonwebtoken';
import { BasePlugin } from 'nextrush';

interface AuthConfig {
  secret: string;
  algorithms: string[];
  audience?: string;
  issuer?: string;
}

class AuthPlugin extends BasePlugin {
  public name = 'AuthPlugin';
  public version = '1.0.0';

  constructor(private config: AuthConfig) {
    super();
  }

  public onInstall(app: Application): void {
    // Add auth methods to app
    (app as any).requireAuth = (roles?: string[]) => {
      return async (ctx: Context, next: Next) => {
        const token = this.extractToken(ctx);

        if (!token) {
          ctx.res.status(401).json({ error: 'Authentication required' });
          return;
        }

        try {
          const payload = jwt.verify(token, this.config.secret) as any;
          (ctx as any).user = payload;

          if (roles && !this.hasRequiredRole(payload, roles)) {
            ctx.res.status(403).json({ error: 'Insufficient permissions' });
            return;
          }

          await next();
        } catch (error) {
          ctx.res.status(401).json({ error: 'Invalid token' });
        }
      };
    };
  }

  private extractToken(ctx: Context): string | null {
    const auth = ctx.req.headers.authorization;
    return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  }

  private hasRequiredRole(user: any, roles: string[]): boolean {
    return user.roles?.some((role: string) => roles.includes(role)) ?? false;
  }
}

// Usage
const auth = new AuthPlugin({
  secret: process.env.JWT_SECRET!,
  algorithms: ['HS256'],
});

auth.install(app);

app.get('/protected', (app as any).requireAuth(['admin']), async ctx => {
  ctx.res.json({ message: 'Protected data', user: (ctx as any).user });
});
```

### Rate Limiting Plugin

```typescript
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (ctx: Context) => string;
  onLimitReached?: (ctx: Context) => void;
}

class RateLimitPlugin extends BasePlugin {
  public name = 'RateLimitPlugin';
  public version = '1.0.0';

  private requests = new Map<string, { count: number; resetTime: number }>();

  constructor(private config: RateLimitConfig) {
    super();
  }

  public onInstall(app: Application): void {
    app.use(async (ctx, next) => {
      const key =
        this.config.keyGenerator?.(ctx) ??
        ctx.req.socket.remoteAddress ??
        'unknown';
      const now = Date.now();

      let record = this.requests.get(key);

      if (!record || now > record.resetTime) {
        record = {
          count: 1,
          resetTime: now + this.config.windowMs,
        };
      } else {
        record.count++;
      }

      this.requests.set(key, record);

      if (record.count > this.config.maxRequests) {
        this.config.onLimitReached?.(ctx);

        ctx.res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
        });
        return;
      }

      // Add rate limit headers
      ctx.res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
      ctx.res.setHeader(
        'X-RateLimit-Remaining',
        this.config.maxRequests - record.count
      );
      ctx.res.setHeader(
        'X-RateLimit-Reset',
        Math.ceil(record.resetTime / 1000)
      );

      await next();
    });
  }
}
```

### API Documentation Plugin

```typescript
interface APIDocConfig {
  title: string;
  version: string;
  description?: string;
  basePath?: string;
  schemes?: ('http' | 'https')[];
}

class APIDocPlugin extends BasePlugin {
  public name = 'APIDocPlugin';
  public version = '1.0.0';

  private routes: APIRoute[] = [];

  constructor(private config: APIDocConfig) {
    super();
  }

  public onInstall(app: Application): void {
    // Wrap routing methods to capture documentation
    const originalGet = app.get.bind(app);
    const originalPost = app.post.bind(app);
    const originalPut = app.put.bind(app);
    const originalDelete = app.delete.bind(app);

    app.get = (path: string, ...handlers: any[]) => {
      this.captureRoute('GET', path, handlers);
      return originalGet(path, ...handlers);
    };

    app.post = (path: string, ...handlers: any[]) => {
      this.captureRoute('POST', path, handlers);
      return originalPost(path, ...handlers);
    };

    // Add documentation endpoints
    app.get('/api-docs', async ctx => {
      ctx.res.setHeader('Content-Type', 'application/json');
      ctx.res.json(this.generateOpenAPISpec());
    });

    app.get('/api-docs/ui', async ctx => {
      ctx.res.setHeader('Content-Type', 'text/html');
      ctx.res.send(this.generateSwaggerUI());
    });
  }

  private captureRoute(method: string, path: string, handlers: any[]): void {
    // Extract documentation from handler comments or decorators
    this.routes.push({
      method,
      path,
      // ... extract documentation
    });
  }

  private generateOpenAPISpec(): object {
    return {
      openapi: '3.0.0',
      info: {
        title: this.config.title,
        version: this.config.version,
        description: this.config.description,
      },
      paths: this.generatePaths(),
    };
  }

  private generateSwaggerUI(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${this.config.title} - API Documentation</title>
        <link rel="stylesheet" type="text/css" href="//unpkg.com/swagger-ui-dist@3.25.0/swagger-ui.css" />
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="//unpkg.com/swagger-ui-dist@3.25.0/swagger-ui-bundle.js"></script>
        <script>
          SwaggerUIBundle({
            url: '/api-docs',
            dom_id: '#swagger-ui',
            presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.presets.standalone]
          });
        </script>
      </body>
      </html>
    `;
  }
}
```

## Best Practices for Plugin Development

### 1. Error Handling

Always handle errors gracefully:

```typescript
class DatabasePlugin extends BasePlugin {
  public onInstall(app: Application): void {
    app.use(async (ctx, next) => {
      try {
        (ctx as any).db = await this.getConnection();
        await next();
      } catch (error) {
        this.logger?.error('Database plugin error', { error });

        // Provide fallback behavior
        (ctx as any).db = this.getFallbackConnection();
        await next();
      }
    });
  }
}
```

### 2. Resource Management

Clean up resources properly:

```typescript
class CachePlugin extends BasePlugin {
  private client?: Redis;
  private healthCheckInterval?: NodeJS.Timeout;

  public async init(): Promise<void> {
    this.client = new Redis(this.config.redis);

    // Setup health checking
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      30000
    );
  }

  public async cleanup(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    await this.client?.quit();
  }
}
```

### 3. Configuration Validation

Validate configuration early:

```typescript
class MetricsPlugin extends BasePlugin {
  constructor(private config: MetricsConfig) {
    super();
    this.validateConfig(); // Validate in constructor
  }

  public validateConfig(): boolean {
    if (!this.config.endpoint) {
      throw new Error('MetricsPlugin: endpoint is required');
    }

    if (this.config.interval < 1000) {
      throw new Error('MetricsPlugin: interval must be at least 1000ms');
    }

    return true;
  }
}
```

### 4. Backward Compatibility

Design APIs for backward compatibility:

```typescript
class LoggerPlugin extends BasePlugin {
  // v1.0.0 method
  public log(message: string): void {
    this.info(message);
  }

  // v2.0.0 methods (expanded functionality)
  public info(message: string, meta?: object): void {
    this.write('info', message, meta);
  }

  public error(message: string, meta?: object): void {
    this.write('error', message, meta);
  }

  // Keep old interface working
  private write(level: string, message: string, meta?: object): void {
    // Implementation
  }
}
```

## Performance Considerations

### Plugin Initialization Order

Load plugins in optimal order:

```typescript
class PluginManager {
  private plugins: BasePlugin[] = [];

  public install(plugins: BasePlugin[]): void {
    // Sort by priority and dependencies
    const sortedPlugins = this.resolveDependencies(plugins);

    for (const plugin of sortedPlugins) {
      plugin.install(this.app);
    }
  }

  private resolveDependencies(plugins: BasePlugin[]): BasePlugin[] {
    // Topological sort based on dependencies
    // Plugins with no dependencies load first
    // Dependent plugins load after their dependencies
  }
}
```

### Lazy Loading

Load plugins only when needed:

```typescript
class LazyPluginLoader {
  private registry = new Map<string, () => Promise<BasePlugin>>();

  public register(name: string, loader: () => Promise<BasePlugin>): void {
    this.registry.set(name, loader);
  }

  public async load(name: string): Promise<BasePlugin> {
    const loader = this.registry.get(name);
    if (!loader) {
      throw new Error(`Plugin ${name} not found`);
    }

    const plugin = await loader();
    plugin.install(this.app);
    return plugin;
  }
}

// Usage
pluginLoader.register('websocket', () =>
  import('./websocket-plugin').then(m => new m.WebSocketPlugin())
);

// Load only when WebSocket is needed
const wsPlugin = await pluginLoader.load('websocket');
```

### Memory Management

Monitor plugin resource usage:

```typescript
class ResourceMonitor extends BasePlugin {
  public onInstall(app: Application): void {
    setInterval(() => {
      const usage = process.memoryUsage();

      if (usage.heapUsed > this.config.maxMemory) {
        this.logger.warn('High memory usage detected', { usage });

        // Trigger cleanup in other plugins
        this.app.emit('memory-pressure', usage);
      }
    }, 30000);
  }
}
```

## Testing Plugin Architecture

### Unit Testing Plugins

```typescript
describe('CachePlugin', () => {
  let plugin: CachePlugin;
  let mockApp: Application;

  beforeEach(() => {
    plugin = new CachePlugin({
      redis: { host: 'localhost', port: 6379 },
      ttl: 3600,
    });

    mockApp = createMockApp();
  });

  it('should install middleware on app', () => {
    plugin.install(mockApp);

    expect(mockApp.use).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should cache responses', async () => {
    plugin.install(mockApp);

    const middleware = mockApp.use.mock.calls[0][0];
    const mockCtx = createMockContext();
    const mockNext = jest.fn();

    await middleware(mockCtx, mockNext);

    expect(mockCtx.cache).toBeDefined();
  });
});
```

### Integration Testing

```typescript
describe('Plugin Integration', () => {
  let app: Application;
  let server: Server;

  beforeEach(async () => {
    app = createApp();

    // Install plugins
    const logger = new LoggerPlugin({ level: 'test' });
    const auth = new AuthPlugin({ secret: 'test-secret' });

    logger.install(app);
    auth.install(app);

    await logger.init();
    await auth.init();

    server = app.listen(0);
  });

  afterEach(async () => {
    await server.close();
  });

  it('should work with multiple plugins', async () => {
    app.get('/test', (app as any).requireAuth(), async ctx => {
      ctx.res.json({ success: true });
    });

    const response = await request(server)
      .get('/test')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body).toEqual({ success: true });
  });
});
```

## Future of Plugin Architecture

### Hot Plugin Reloading

```typescript
class HotReloadManager {
  private watchers = new Map<string, FSWatcher>();

  public watchPlugin(plugin: BasePlugin, path: string): void {
    const watcher = watch(path, async (event, filename) => {
      if (event === 'change') {
        await this.reloadPlugin(plugin);
      }
    });

    this.watchers.set(plugin.name, watcher);
  }

  private async reloadPlugin(plugin: BasePlugin): Promise<void> {
    // 1. Cleanup old plugin
    await plugin.cleanup();

    // 2. Remove from module cache
    delete require.cache[require.resolve(plugin.constructor.name)];

    // 3. Load new version
    const NewPlugin = require(plugin.constructor.name);
    const newPlugin = new NewPlugin();

    // 4. Install new version
    newPlugin.install(this.app);
    await newPlugin.init();
  }
}
```

### Plugin Marketplace

```typescript
class PluginMarketplace {
  async search(query: string): Promise<PluginInfo[]> {
    const response = await fetch(
      `https://nextrush-plugins.com/api/search?q=${query}`
    );
    return response.json();
  }

  async install(name: string, version?: string): Promise<BasePlugin> {
    // Download and install plugin from marketplace
    const pluginCode = await this.download(name, version);
    const plugin = await this.loadFromCode(pluginCode);

    // Verify plugin signature
    if (!(await this.verifySignature(plugin))) {
      throw new Error('Plugin signature verification failed');
    }

    return plugin;
  }

  private async verifySignature(plugin: BasePlugin): Promise<boolean> {
    // Verify plugin is signed by trusted publisher
    return true;
  }
}
```

## Conclusion: The Power of Extensibility

NextRush v2's plugin architecture represents more than just a way to add features—it's a **philosophy of sustainable development**. By providing a robust, type-safe foundation for extensibility, it enables:

- **Rapid prototyping** with built-in features
- **Gradual complexity** as applications grow
- **Community-driven innovation** through shared plugins
- **Enterprise-grade reliability** with proper lifecycle management

The plugin system bridges the gap between **simplicity and power**, ensuring that developers can start simple and scale infinitely. Whether you're building a basic API or a complex microservices platform, NextRush v2's plugin architecture provides the foundation for sustainable, maintainable applications.

**The future of web development is modular, and NextRush v2 is leading the way.**

---

## Further Reading

- [Getting Started with NextRush v2](../guides/getting-started.md)
- [Dependency Injection System](./dependency-injection.md)
- [Orchestration System](./orchestration-system.md)
- [Logger Plugin API](../api/logger-plugin.md)
- [WebSocket Plugin API](../api/websocket-plugin.md)
- [Template Plugin API](../api/template-plugin.md)
- [Static Files Plugin API](../api/static-files-plugin.md)

---

_Want to contribute to the NextRush v2 plugin ecosystem? Check out our plugin API documentation and join our growing community of developers building the future of web frameworks._
