# Plugins

NextRush v2 uses a plugin-based architecture that allows you to extend the framework with additional functionality. Plugins are optional, modular components that can be easily added or removed from your application.

## Table of Contents

- [Plugin Architecture](#plugin-architecture)
- [Logger Plugin](#logger-plugin)
- [Static Files Plugin](#static-files-plugin)
- [Plugin Development](#plugin-development)
- [Plugin Best Practices](#plugin-best-practices)

## Plugin Architecture

All plugins in NextRush v2 extend the `BasePlugin` class and follow a consistent interface.

### Plugin Installation

**Important**: Plugins should be installed using the `install()` method, not `app.use()`:

```typescript
// ✅ Correct - Use plugin.install(app)
const logger = new LoggerPlugin();
logger.install(app);

// ❌ Incorrect - Don't use app.use(plugin)
const logger = new LoggerPlugin();
app.use(logger); // This is wrong for plugins
```

The `app.use()` method is designed for **middleware functions**, while `plugin.install(app)` is the correct way to install plugin instances.

### Why This Distinction Matters

#### Performance

- **Plugins**: Zero runtime overhead per request
- **Middleware**: Runtime overhead on every request

#### Capabilities

- **Plugins**: Can add methods to app instance (`app.logger.info()`)
- **Middleware**: Limited to context-level access (`ctx.logger.info()`)

#### Architecture

- **Plugins**: Rich lifecycle management and state
- **Middleware**: Simple request/response processing

For detailed analysis, see [Plugin Architecture Analysis](./PLUGIN_ARCHITECTURE_ANALYSIS.md).

For type safety and custom plugin development, see:

- [Plugin Type Safety Guide](./PLUGIN_TYPE_SAFETY.md)
- [Custom Plugin Example](./CUSTOM_PLUGIN_EXAMPLE.md)

### Base Plugin Structure

```typescript
import { BasePlugin } from 'nextrush-v2';
import type { Application } from 'nextrush-v2';

export class MyPlugin extends BasePlugin {
  public name = 'MyPlugin';
  public version = '1.0.0';

  constructor(private options?: MyPluginOptions) {
    super();
  }

  onInstall(app: Application): void {
    // Plugin installation logic
    this.log('Plugin installed');
  }

  onCleanup(): void {
    // Cleanup logic when application shuts down
    this.log('Plugin cleaned up');
  }
}
```

### Plugin Lifecycle

1. **Installation**: Plugin is added to the application
2. **Initialization**: Plugin sets up its functionality
3. **Runtime**: Plugin operates during request processing
4. **Cleanup**: Plugin cleans up resources on shutdown

## Logger Plugin

## Static Files Plugin

Serve static assets from a directory, similar to Express/Koa/Fastify.

```typescript
import { createApp, StaticFilesPlugin } from 'nextrush';

const app = createApp();
new StaticFilesPlugin({
  root: __dirname + '/public',
  prefix: '/static',
  maxAge: 3600,
  immutable: true,
}).install(app);
```

Key options: `root`, `prefix`, `index`, `fallthrough`, `redirect`, `maxAge`, `immutable`, `dotfiles`, `extensions`, `setHeaders`.

See also: `docs/plugins/STATIC_FILES_PLUGIN.md` for a full guide.

### Public APIs

- `new StaticFilesPlugin(options).install(app)`
- Response helpers:
  - `ctx.res.sendFile(path, options?)`
  - `ctx.res.download(path, filename?)`
  - Alias: `ctx.res.file(path, options?)`
- Context helper:
  - `ctx.sendFile(path, options?)` (delegates to `ctx.res.sendFile`)

### Minimal Example

```typescript
import { createApp, StaticFilesPlugin } from 'nextrush';

const app = createApp();
new StaticFilesPlugin({
  root: __dirname + '/public',
  prefix: '/static',
}).install(app);

// Send a file from a handler
app.get('/readme', ctx => {
  ctx.sendFile(__dirname + '/public/index.html');
});
```

The Logger Plugin provides comprehensive logging capabilities with multiple transport options and configurable log levels.

### Features

- **Multiple Transports**: Console, File, HTTP, Stream transports
- **Configurable Log Levels**: DEBUG, INFO, WARN, ERROR
- **Request/Response Logging**: Automatic request tracking
- **Performance Monitoring**: Request timing and performance metrics
- **Structured Logging**: JSON format with metadata
- **Customizable**: Configurable formats and destinations

### Installation

```typescript
import { LoggerPlugin, ConsoleTransport, FileTransport } from 'nextrush-v2';

const app = createApp();

// Basic installation
const logger = new LoggerPlugin();
logger.install(app);

// With custom configuration
const logger2 = new LoggerPlugin({
  level: 'info',
  transports: [
    new ConsoleTransport('info'),
    new FileTransport('logs/app.log', 'info'),
  ],
  format: 'json',
});
logger2.install(app);
```

### Configuration Options

```typescript
interface LoggerConfig {
  level?: LogLevel;
  transports?: Transport[];
  format?: 'json' | 'text';
  timestamp?: boolean;
  requestLogging?: boolean;
  performanceLogging?: boolean;
  slowRequestThreshold?: number;
}
```

### Log Levels

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}
```

### Transports

#### Console Transport

```typescript
import { ConsoleTransport } from 'nextrush-v2';

const transport = new ConsoleTransport('info');
```

#### File Transport

```typescript
import { FileTransport } from 'nextrush-v2';

const transport = new FileTransport('app.log', 'info');
```

#### HTTP Transport

```typescript
import { HttpTransport } from 'nextrush-v2';

const transport = new HttpTransport(
  'https://logs.example.com/api/logs',
  'info'
);
```

#### Stream Transport

```typescript
import { StreamTransport } from 'nextrush-v2';

const transport = new StreamTransport(process.stdout, 'info');
```

### Usage Examples

#### Basic Logging

```typescript
import { LoggerPlugin } from 'nextrush-v2';

const app = createApp();
const logger = new LoggerPlugin();

logger.install(app);

app.get('/users', ctx => {
  logger.info('Fetching users');
  ctx.res.json({ users: [] });
});
```

#### Request Logging

```typescript
const logger = new LoggerPlugin({
  requestLogging: true,
  performanceLogging: true,
  slowRequestThreshold: 1000, // 1 second
});

logger.install(app);

// Automatically logs:
// - Request start/end
// - Response status
// - Request duration
// - Slow request warnings
```

#### Custom Logging

```typescript
app.post('/users', ctx => {
  const { name, email } = ctx.body as any;

  logger.info('Creating user', { name, email });

  try {
    const user = await createUser({ name, email });
    logger.info('User created successfully', { userId: user.id });
    ctx.res.json(user);
  } catch (error) {
    logger.error('Failed to create user', { error: error.message });
    throw error;
  }
});
```

#### Error Logging

```typescript
app.get('/error', () => {
  logger.error('Something went wrong', {
    error: 'Database connection failed',
    timestamp: new Date().toISOString(),
  });

  throw new Error('Database connection failed');
});
```

### Logger Factory Functions

NextRush v2 provides convenient factory functions for common logging setups.

#### Development Logger

```typescript
import { createDevLogger } from 'nextrush-v2';

const logger = createDevLogger();
logger.install(app);
```

#### Production Logger

```typescript
import { createProdLogger } from 'nextrush-v2';

const logger = createProdLogger({
  filename: 'production.log',
  level: 'warn',
});
logger.install(app);
```

#### Minimal Logger

```typescript
import { createMinimalLogger } from 'nextrush-v2';

const logger = createMinimalLogger();
logger.install(app);
```

### Testing

```typescript
import { LoggerPlugin } from '@/plugins/logger';

describe('Logger Plugin', () => {
  it('should log requests', async () => {
    const app = createApp();
    const logger = new LoggerPlugin();

    logger.install(app);
    app.get('/test', ctx => {
      ctx.res.json({ message: 'Hello' });
    });

    const response = await fetch('/test');
    expect(response.status).toBe(200);
  });
});
```

## Plugin Development

### Creating a Custom Plugin

```typescript
import { BasePlugin } from 'nextrush-v2';
import type { Application, Context } from 'nextrush-v2';

interface CachePluginOptions {
  ttl?: number;
  maxSize?: number;
}

export class CachePlugin extends BasePlugin {
  public name = 'CachePlugin';
  public version = '1.0.0';

  private cache = new Map<string, { data: unknown; expires: number }>();

  constructor(private options: CachePluginOptions = {}) {
    super();
  }

  onInstall(app: Application): void {
    // Add cache methods to context
    app.use(async (ctx: Context, next: () => Promise<void>) => {
      (ctx as any).cache = {
        get: (key: string) => this.get(key),
        set: (key: string, value: unknown, ttl?: number) =>
          this.set(key, value, ttl),
        delete: (key: string) => this.delete(key),
        clear: () => this.clear(),
      };
      await next();
    });

    this.log('Cache plugin installed');
  }

  onCleanup(): void {
    this.cache.clear();
    this.log('Cache plugin cleaned up');
  }

  private get(key: string): unknown {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  private set(
    key: string,
    value: unknown,
    ttl: number = this.options.ttl || 300000
  ): void {
    this.cache.set(key, {
      data: value,
      expires: Date.now() + ttl,
    });
  }

  private delete(key: string): boolean {
    return this.cache.delete(key);
  }

  private clear(): void {
    this.cache.clear();
  }
}
```

### Plugin Usage

```typescript
import { CachePlugin } from './cache-plugin';

const app = createApp();
const cache = new CachePlugin({ ttl: 60000 }); // 1 minute TTL

cache.install(app);

app.get('/users/:id', async ctx => {
  const userId = ctx.params['id'];

  // Try to get from cache first
  let user = ctx.cache.get(`user:${userId}`);

  if (!user) {
    // Fetch from database
    user = await findUser(userId);

    // Cache for 1 minute
    ctx.cache.set(`user:${userId}`, user, 60000);
  }

  ctx.res.json(user);
});
```

### Plugin Testing

```typescript
import { CachePlugin } from './cache-plugin';

describe('Cache Plugin', () => {
  it('should cache data', async () => {
    const app = createApp();
    const cache = new CachePlugin();

    cache.install(app);
    app.get('/test', ctx => {
      const cached = ctx.cache.get('test');
      if (cached) {
        ctx.res.json({ fromCache: true, data: cached });
      } else {
        const data = { message: 'Hello' };
        ctx.cache.set('test', data);
        ctx.res.json({ fromCache: false, data });
      }
    });

    const response1 = await fetch('/test');
    const response2 = await fetch('/test');

    const data1 = await response1.json();
    const data2 = await response2.json();

    expect(data1.fromCache).toBe(false);
    expect(data2.fromCache).toBe(true);
  });
});
```

## Plugin Best Practices

### 1. Follow the Plugin Interface

```typescript
// Good - implements required methods
export class MyPlugin extends BasePlugin {
  public name = 'MyPlugin';
  public version = '1.0.0';

  onInstall(app: Application): void {
    // Implementation
  }

  onCleanup(): void {
    // Cleanup
  }
}

// Avoid - doesn't extend BasePlugin
export class BadPlugin {
  // Missing required interface
}
```

### 2. Provide Meaningful Logging

```typescript
// Good - informative logging
onInstall(app: Application): void {
  this.log('Plugin installed with options:', this.options);
}

onCleanup(): void {
  this.log('Plugin cleaned up, resources freed');
}
```

### 3. Handle Errors Gracefully

```typescript
onInstall(app: Application): void {
  try {
    // Plugin setup
    this.log('Plugin installed successfully');
  } catch (error) {
    this.log('Failed to install plugin:', error.message);
    throw error;
  }
}
```

### 4. Clean Up Resources

```typescript
onCleanup(): void {
  // Close connections
  this.connection?.close();

  // Clear caches
  this.cache.clear();

  // Remove event listeners
  this.eventEmitter?.removeAllListeners();

  this.log('Plugin cleaned up');
}
```

### 5. Use TypeScript for Type Safety

```typescript
interface MyPluginOptions {
  enabled?: boolean;
  timeout?: number;
}

export class MyPlugin extends BasePlugin {
  constructor(private options: MyPluginOptions = {}) {
    super();
  }
}
```

### 6. Provide Default Configuration

```typescript
export class MyPlugin extends BasePlugin {
  private config: Required<MyPluginOptions>;

  constructor(options: MyPluginOptions = {}) {
    super();
    this.config = {
      enabled: true,
      timeout: 5000,
      ...options,
    };
  }
}
```

### 7. Test Your Plugins

```typescript
describe('MyPlugin', () => {
  it('should install correctly', () => {
    const app = createApp();
    const plugin = new MyPlugin();

    expect(() => plugin.install(app)).not.toThrow();
  });

  it('should cleanup resources', () => {
    const plugin = new MyPlugin();
    const cleanupSpy = jest.spyOn(plugin, 'onCleanup');

    plugin.onCleanup();
    expect(cleanupSpy).toHaveBeenCalled();
  });
});
```

## Future Plugins

NextRush v2 is designed to support additional plugins. Here are some planned plugins:

### Database Plugin

```typescript
// Planned - Database integration
import {} from /* DatabasePlugin */ 'nextrush-v2';

const db = new DatabasePlugin({
  connectionString: 'postgresql://localhost/mydb',
});
db.install(app);
```

### Authentication Plugin

```typescript
// Planned - Authentication middleware
import { AuthPlugin } from '@/plugins/auth';

const auth = new AuthPlugin({
  secret: 'your-secret-key',
  algorithms: ['HS256'],
});
auth.install(app);
```

### WebSocket Plugin

```typescript
// Planned - WebSocket support
import { WebSocketPlugin } from '@/plugins/websocket';

const ws = new WebSocketPlugin();
ws.install(app);

app.ws('/chat', ctx => {
  ctx.ws.send('Hello from WebSocket!');
});
```

### GraphQL Plugin

```typescript
// Planned - GraphQL support
import { GraphQLPlugin } from '@/plugins/graphql';

const graphql = new GraphQLPlugin({
  schema: mySchema,
  resolvers: myResolvers,
});
graphql.install(app);
```

### Static Files Plugin

```typescript
// Planned - Static file serving
import { StaticFilesPlugin } from '@/plugins/static-files';

const staticFiles = new StaticFilesPlugin({
  root: './public',
  prefix: '/static',
});
staticFiles.install(app);
```

### Template Plugin

```typescript
// Planned - Template rendering
import { TemplatePlugin } from '@/plugins/template';

const template = new TemplatePlugin({
  engine: 'ejs',
  views: './views',
});
template.install(app);
```

This plugin architecture provides a flexible, extensible foundation for building web applications with NextRush v2.
