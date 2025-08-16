# Plugin System API

NextRush v2 provides several built-in plugins that extend your application with advanced functionality. All plugins follow a consistent installation pattern and provide type-safe APIs.

## Available Plugins

### 🪵 Logger Plugin

Advanced logging with multiple transports and structured output.

### 📁 Static Files Plugin

Efficient static file serving with caching and compression.

### 🎨 Template Plugin

Server-side template rendering with multiple engine support.

### 🔌 WebSocket Plugin

Production-ready WebSocket server with room management.

---

## Static Files Plugin

Serves static files with automatic caching, compression, and security features.

### Installation

```typescript
import { createApp, StaticFilesPlugin } from 'nextrush';

const app = createApp();

// Basic setup
const staticPlugin = new StaticFilesPlugin({
  root: './public',
  prefix: '/static',
});
staticPlugin.install(app);

// Advanced setup
const advancedStatic = new StaticFilesPlugin({
  root: './assets',
  prefix: '/assets',
  maxAge: 86400000, // 1 day cache
  dotfiles: 'ignore',
  etag: true,
  lastModified: true,
  immutable: false,
  cacheControl: true,
  index: ['index.html', 'index.htm'],
  fallthrough: true,
  redirect: true,
  setHeaders: (res, path, stat) => {
    res.setHeader('X-Custom-Header', 'value');
  },
});
advancedStatic.install(app);
```

### Configuration Options

```typescript
interface StaticFilesOptions {
  root: string; // Root directory to serve files from
  prefix?: string; // URL prefix (default: '/')
  maxAge?: number; // Cache max-age in milliseconds
  dotfiles?: 'allow' | 'deny' | 'ignore'; // How to handle dotfiles
  etag?: boolean; // Generate ETags
  lastModified?: boolean; // Set Last-Modified header
  immutable?: boolean; // Set immutable cache control
  cacheControl?: boolean; // Set Cache-Control headers
  index?: string[] | false; // Index file names
  fallthrough?: boolean; // Fall through to next handler
  redirect?: boolean; // Redirect to trailing slash
  extensions?: string[] | false; // File extensions to try
  setHeaders?: (res: Response, path: string, stat: any) => void;
}
```

### Response Methods Added

The plugin adds these methods to your response object:

```typescript
// Send a file
ctx.res.sendFile(path: string, options?: SendFileOptions): Promise<void>

// Download a file (adds Content-Disposition header)
ctx.res.download(path: string, filename?: string, options?: SendFileOptions): Promise<void>

// Alias for sendFile
ctx.res.file(path: string, options?: SendFileOptions): Promise<void>
```

### Context Helper Added

```typescript
// Context helper (delegates to ctx.res.sendFile)
ctx.sendFile(path: string, options?: SendFileOptions): Promise<void>
```

### Usage Examples

```typescript
// Basic file serving
app.get('/readme', async ctx => {
  await ctx.sendFile('./public/README.md');
});

// Download with custom filename
app.get('/download/:file', async ctx => {
  const filepath = `./uploads/${ctx.params.file}`;
  await ctx.res.download(filepath, 'custom-name.txt');
});

// Send with custom headers
app.get('/image/:id', async ctx => {
  await ctx.res.sendFile(`./images/${ctx.params.id}.jpg`, {
    headers: {
      'X-Image-ID': ctx.params.id,
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
```

### Security Features

- **Path Traversal Protection**: Automatically prevents `../` attacks
- **Dotfile Control**: Configure how hidden files are handled
- **MIME Type Detection**: Secure content-type headers
- **Range Request Support**: Efficient partial content delivery

---

## Template Plugin

Server-side template rendering with support for multiple template engines.

### Installation

```typescript
import { createApp, TemplatePlugin } from 'nextrush';

const app = createApp();

// Basic setup with default engine
const templatePlugin = new TemplatePlugin({
  viewsDir: './views',
  defaultEngine: 'ejs',
});
templatePlugin.install(app);

// Advanced setup with multiple engines
const advancedTemplate = new TemplatePlugin({
  viewsDir: './templates',
  defaultEngine: 'handlebars',
  engines: {
    ejs: 'ejs',
    hbs: 'handlebars',
    pug: 'pug',
  },
  cache: true,
  options: {
    // Engine-specific options
    layout: 'layouts/main',
  },
});
advancedTemplate.install(app);
```

### Configuration Options

```typescript
interface TemplatePluginOptions {
  viewsDir: string; // Directory containing templates
  defaultEngine?: string; // Default template engine
  engines?: Record<string, string>; // Map of extensions to engines
  cache?: boolean; // Cache compiled templates
  options?: Record<string, any>; // Engine-specific options
}
```

### Response Methods Added

```typescript
// Render a template
ctx.res.render(view: string, data?: object, options?: RenderOptions): Promise<void>

// Render to string (doesn't send response)
ctx.res.renderToString(view: string, data?: object, options?: RenderOptions): Promise<string>
```

### Context Helper Added

```typescript
// Context helper (delegates to ctx.res.render)
ctx.render(view: string, data?: object, options?: RenderOptions): Promise<void>
```

### Template Helpers

Register global helpers available in all templates:

```typescript
const templatePlugin = new TemplatePlugin({
  viewsDir: './views',
  helpers: {
    formatDate: (date: Date) => date.toLocaleDateString(),
    uppercase: (str: string) => str.toUpperCase(),
    json: (obj: any) => JSON.stringify(obj, null, 2),
  },
});
```

### Usage Examples

```typescript
// Basic template rendering
app.get('/users/:id', async ctx => {
  const user = await getUserById(ctx.params.id);
  await ctx.render('user/profile', { user });
});

// Render with layout
app.get('/dashboard', async ctx => {
  const data = await getDashboardData();
  await ctx.render('dashboard', data, {
    layout: 'layouts/admin',
  });
});

// Render to string for emails
app.post('/send-email', async ctx => {
  const emailHtml = await ctx.res.renderToString('emails/welcome', {
    user: ctx.body.user,
  });

  await emailService.send({
    to: ctx.body.user.email,
    html: emailHtml,
  });

  ctx.res.json({ success: true });
});

// Different template engines
app.get('/ejs-page', async ctx => {
  await ctx.render('page.ejs', { title: 'EJS Page' });
});

app.get('/handlebars-page', async ctx => {
  await ctx.render('page.hbs', { title: 'Handlebars Page' });
});
```

### Engine Support

The plugin supports popular template engines:

- **EJS**: Embedded JavaScript templates
- **Handlebars**: Logic-less templates with helpers
- **Pug**: Clean, whitespace-sensitive syntax
- **Mustache**: Logic-less templates
- **Nunjucks**: Rich templating language

---

## WebSocket Plugin

Production-ready WebSocket server with RFC 6455 compliance and advanced features.

### Installation

```typescript
import { createApp, WebSocketPlugin } from 'nextrush';

const app = createApp();

// Basic setup
const wsPlugin = new WebSocketPlugin();
wsPlugin.install(app);

// Advanced setup
const advancedWS = new WebSocketPlugin({
  heartbeatMs: 30000,
  maxConnections: 1000,
  maxMessageSize: 1024 * 1024, // 1MB
  origins: ['http://localhost:3000'],
  compression: true,
  subprotocols: ['chat', 'notifications'],
});
advancedWS.install(app);
```

### Configuration Options

```typescript
interface WebSocketPluginOptions {
  heartbeatMs?: number; // Heartbeat interval (default: 30000)
  maxConnections?: number; // Max concurrent connections (default: 1000)
  maxMessageSize?: number; // Max message size in bytes (default: 1MB)
  origins?: string[]; // Allowed origins (default: all)
  compression?: boolean; // Enable per-message compression
  subprotocols?: string[]; // Supported subprotocols
  rateLimit?: {
    messages: number; // Max messages per window
    window: number; // Time window in ms
  };
}
```

### Application Methods Added

```typescript
// Add WebSocket route
app.ws(path: string, handler: WSHandler): void

// Add WebSocket middleware
app.wsUse(middleware: WSMiddleware): void

// Broadcast to all connections
app.wsBroadcast(message: string, room?: string): void

// Get WebSocket statistics
app.wsStats(): WSStats
```

### WebSocket Handler

```typescript
type WSHandler = (socket: WSConnection, request: IncomingMessage) => void;

interface WSConnection {
  // Send message
  send(data: string | Buffer): void;

  // Close connection
  close(code?: number, reason?: string): void;

  // Join room
  join(room: string): void;

  // Leave room
  leave(room: string): void;

  // Event listeners
  onMessage(handler: (data: string | Buffer) => void): void;
  onClose(handler: (code: number, reason: string) => void): void;
  onError(handler: (error: Error) => void): void;

  // Properties
  id: string;
  rooms: Set<string>;
  readyState: number;
  url: string;
  ip: string;
}
```

### Usage Examples

```typescript
// Basic WebSocket endpoint
app.ws('/chat', (socket, request) => {
  console.log('New WebSocket connection');

  socket.onMessage(data => {
    console.log('Received:', data);
    socket.send(`Echo: ${data}`);
  });

  socket.onClose((code, reason) => {
    console.log('Connection closed:', code, reason);
  });
});

// Room-based chat system
app.ws('/chat/:room', (socket, request) => {
  const room = request.url!.split('/').pop()!;
  socket.join(room);

  socket.send(`Welcome to room: ${room}`);

  socket.onMessage(data => {
    // Broadcast to room
    app.wsBroadcast(`${socket.id}: ${data}`, room);
  });

  socket.onClose(() => {
    socket.leave(room);
  });
});

// Authentication middleware
app.wsUse(async (socket, request, next) => {
  const url = new URL(request.url!, `http://${request.headers.host}`);
  const token = url.searchParams.get('token');

  if (!isValidToken(token)) {
    return socket.close(1008, 'Authentication failed');
  }

  // Add user info to socket
  (socket as any).user = await getUserFromToken(token);
  next();
});

// Rate limiting middleware
app.wsUse(async (socket, request, next) => {
  const rateLimiter = createRateLimiter({
    windowMs: 60000, // 1 minute
    maxMessages: 100, // 100 messages per minute
  });

  if (!rateLimiter.check(socket.ip)) {
    return socket.close(1013, 'Rate limit exceeded');
  }

  next();
});

// Broadcasting examples
app.post('/notify-all', ctx => {
  app.wsBroadcast('Server notification: Maintenance in 5 minutes');
  ctx.res.json({ sent: true });
});

app.post('/notify-room', ctx => {
  const { room, message } = ctx.body;
  app.wsBroadcast(message, room);
  ctx.res.json({ sent: true, room });
});
```

### Client Usage

```typescript
// Frontend JavaScript
const ws = new WebSocket('ws://localhost:3000/chat/general?token=abc123');

ws.onopen = () => {
  console.log('Connected to WebSocket');
  ws.send('Hello Server!');
};

ws.onmessage = event => {
  console.log('Received:', event.data);
};

ws.onclose = event => {
  console.log('Connection closed:', event.code, event.reason);
};

ws.onerror = error => {
  console.error('WebSocket error:', error);
};
```

### Statistics and Monitoring

```typescript
// Get WebSocket statistics
app.get('/ws-stats', ctx => {
  const stats = app.wsStats();
  ctx.res.json(stats);
});

// WSStats interface
interface WSStats {
  totalConnections: number;
  activeConnections: number;
  rooms: Record<string, number>; // room -> connection count
  messagesPerSecond: number;
  bytesPerSecond: number;
}
```

### Error Handling

```typescript
app.ws('/secure-chat', (socket, request) => {
  socket.onError(error => {
    console.error('WebSocket error:', error);
    // Log error, notify monitoring system
  });

  try {
    // Your WebSocket logic
  } catch (error) {
    socket.close(1011, 'Internal error');
  }
});
```

---

## Plugin Development

### Creating Custom Plugins

```typescript
import { BasePlugin } from 'nextrush';

class MyCustomPlugin extends BasePlugin {
  name = 'MyCustomPlugin';
  version = '1.0.0';

  onInstall(app: Application): void {
    // Add your plugin logic here
    app.use(async (ctx, next) => {
      // Custom middleware
      await next();
    });

    // Add methods to app or context
    (app as any).myMethod = () => {
      console.log('Custom method');
    };
  }
}

// Install your plugin
const plugin = new MyCustomPlugin();
plugin.install(app);
```

### Plugin Best Practices

1. **Type Safety**: Always provide TypeScript types
2. **Error Handling**: Handle errors gracefully
3. **Resource Cleanup**: Clean up resources when app shuts down
4. **Documentation**: Document your plugin's API
5. **Testing**: Write comprehensive tests
6. **Performance**: Optimize for production use

---

## Summary

NextRush v2's plugin system provides:

✅ **Static Files Plugin** - Efficient file serving with caching and security
✅ **Template Plugin** - Multi-engine template rendering with helpers
✅ **WebSocket Plugin** - Production-ready WebSocket server with rooms
✅ **Logger Plugin** - Advanced logging with multiple transports
✅ **Consistent API** - All plugins follow the same installation pattern
✅ **Type Safety** - Full TypeScript support for all plugins
✅ **Performance** - Optimized for production workloads

Each plugin is designed to be production-ready with comprehensive configuration options and error handling.

---

_NextRush v2 Plugin API Reference_
