# 🚀 Getting Started with NextRush

## 📚 Table of Contents

- [🚀 Getting Started with NextRush](#-getting-started-with-nextrush)
  - [📚 Table of Contents](#-table-of-contents)
  - [📖 Introduction](#-introduction)
  - [🔧 Public APIs](#-public-apis)
    - [📦 Installation](#-installation)
    - [🏗️ Basic Application Setup](#️-basic-application-setup)
    - [🛣️ Routing Methods](#️-routing-methods)
    - [🔌 Middleware System](#-middleware-system)
    - [🔧 Core Features](#-core-features)
  - [💻 Usage Examples](#-usage-examples)
    - [🌟 Hello World](#-hello-world)
    - [📝 Basic CRUD API](#-basic-crud-api)
    - [🔗 Middleware Usage](#-middleware-usage)
    - [🌐 Static Files](#-static-files)
    - [🎨 Template Rendering](#-template-rendering)
    - [📡 WebSocket Support](#-websocket-support)
  - [⚙️ Configuration Options](#️-configuration-options)
    - [ApplicationOptions](#applicationoptions)
    - [Built-in Middleware Options](#built-in-middleware-options)
  - [📝 Notes](#-notes)

## 📖 Introduction

NextRush is a modern, TypeScript-first web framework that provides an Express.js-compatible API with enhanced features for building scalable web applications and APIs. It combines familiar Express patterns with advanced capabilities like built-in validation, comprehensive middleware, WebSocket support, and a powerful plugin architecture.

## 🔧 Public APIs

### 📦 Installation

Install NextRush using your preferred package manager:

```bash
npm install nextrush
# or
yarn add nextrush
# or
pnpm add nextrush
```

### 🏗️ Basic Application Setup

| Method                      | Signature                                         | Description                               |
| --------------------------- | ------------------------------------------------- | ----------------------------------------- |
| `createApp(options?)` | `(options?: ApplicationOptions) => Application`   | Create new NextRush application instance. |
| `listen(port, callback?)`   | `(port: number, callback?: () => void) => Server` | Start HTTP server on specified port.      |

### 🛣️ Routing Methods

| Method                       | Signature                                                    | Description             |
| ---------------------------- | ------------------------------------------------------------ | ----------------------- |
| `get(path, ...handlers)`     | `(path: string, ...handlers: RouteHandler[]) => Application` | Register GET route.     |
| `post(path, ...handlers)`    | `(path: string, ...handlers: RouteHandler[]) => Application` | Register POST route.    |
| `put(path, ...handlers)`     | `(path: string, ...handlers: RouteHandler[]) => Application` | Register PUT route.     |
| `delete(path, ...handlers)`  | `(path: string, ...handlers: RouteHandler[]) => Application` | Register DELETE route.  |
| `patch(path, ...handlers)`   | `(path: string, ...handlers: RouteHandler[]) => Application` | Register PATCH route.   |
| `options(path, ...handlers)` | `(path: string, ...handlers: RouteHandler[]) => Application` | Register OPTIONS route. |
| `head(path, ...handlers)`    | `(path: string, ...handlers: RouteHandler[]) => Application` | Register HEAD route.    |

### 🔌 Middleware System

| Method                 | Signature                                         | Description                     |
| ---------------------- | ------------------------------------------------- | ------------------------------- |
| `use(middleware)`      | `(middleware: MiddlewareFunction) => Application` | Add global middleware.          |
| `cors(options?)`       | `(options?: CorsOptions) => Application`          | Enable CORS middleware.         |
| `bodyParser(options?)` | `(options?: BodyParserOptions) => Application`    | Enable body parsing middleware. |
| `rateLimit(options?)`  | `(options?: RateLimitOptions) => Application`     | Enable rate limiting.           |

### 🔧 Core Features

| Feature               | Description                                            |
| --------------------- | ------------------------------------------------------ |
| Express Compatibility | Drop-in replacement for Express.js applications.       |
| TypeScript First      | Full type safety with intelligent autocompletion.      |
| Enhanced Request      | Extended request object with validation and utilities. |
| Enhanced Response     | Extended response object with additional methods.      |
| Plugin Architecture   | Modular system for extending framework capabilities.   |
| WebSocket Support     | Built-in WebSocket integration.                        |
| Template Engine       | Flexible template rendering support.                   |
| Static File Serving   | Professional static file serving with caching.         |

## 💻 Usage Examples

### 🌟 Hello World

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.get('/', (req, res) => {
  res.json({ message: 'Hello NextRush!' });
});

app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
```

### 📝 Basic CRUD API

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Enable body parsing
app.bodyParser();

// In-memory data store
let users = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
];

// GET all users
app.get('/api/users', (req, res) => {
  res.json(users);
});

// GET user by ID
app.get('/api/users/:id', (req, res) => {
  const user = users.find((u) => u.id === parseInt(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

// CREATE new user
app.post('/api/users', (req, res) => {
  const newUser = {
    id: users.length + 1,
    name: req.body.name,
    email: req.body.email,
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

// UPDATE user
app.put('/api/users/:id', (req, res) => {
  const user = users.find((u) => u.id === parseInt(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  user.name = req.body.name || user.name;
  user.email = req.body.email || user.email;
  res.json(user);
});

// DELETE user
app.delete('/api/users/:id', (req, res) => {
  const index = users.findIndex((u) => u.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  users.splice(index, 1);
  res.status(204).send();
});

app.listen(3000);
```

### 🔗 Middleware Usage

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Global middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
  next();
});

// Built-in middleware
app.cors({
  origin: 'http://localhost:3000',
  credentials: true,
});

app.bodyParser({ limit: '10mb' });

app.rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

// Route-specific middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Validate token logic here
  next();
};

app.get('/api/protected', authenticate, (req, res) => {
  res.json({ message: 'This is a protected route' });
});

app.listen(3000);
```

### 🌐 Static Files

```typescript
import { createApp } from 'nextrush';
import path from 'path';

const app = createApp();

// Serve static files from public directory
app.static('/static', path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true,
  cacheControl: true,
});

// Serve files with custom options
app.static('/assets', './assets', {
  index: false,
  dotFiles: 'deny',
  headers: {
    'X-Custom-Header': 'NextRush',
  },
});

app.listen(3000);
```

### 🎨 Template Rendering

```typescript
import { createApp } from 'nextrush';
import path from 'path';

const app = createApp();

// Set views directory
app.setViews(path.join(__dirname, 'views'));

// Render template
app.get('/', (req, res) => {
  res.render('index', {
    title: 'NextRush App',
    message: 'Welcome to NextRush Framework!',
  });
});

// Render with data
app.get('/user/:name', (req, res) => {
  res.render('user', {
    username: req.params.name,
    timestamp: new Date().toISOString(),
  });
});

app.listen(3000);
```

### 📡 WebSocket Support

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// WebSocket route
app.ws('/chat', (ws, req) => {
  console.log('New WebSocket connection');

  ws.on('message', (message) => {
    console.log('Received:', message.toString());

    // Broadcast to all connected clients
    app.wsBroadcast(
      JSON.stringify({
        type: 'message',
        data: message.toString(),
        timestamp: Date.now(),
      })
    );
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// HTTP route for chat page
app.get('/chat', (req, res) => {
  res.send(`
    <html>
      <body>
        <div id="messages"></div>
        <input type="text" id="messageInput" placeholder="Type a message...">
        <script>
          const ws = new WebSocket('ws://localhost:3000/chat');
          const messages = document.getElementById('messages');
          const input = document.getElementById('messageInput');

          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            messages.innerHTML += '<div>' + data.data + '</div>';
          };

          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              ws.send(input.value);
              input.value = '';
            }
          });
        </script>
      </body>
    </html>
  `);
});

app.listen(3000);
```

## ⚙️ Configuration Options

### ApplicationOptions

| Option           | Type                | Default     | Description                          |
| ---------------- | ------------------- | ----------- | ------------------------------------ |
| `cors`           | `CorsOptions`       | `undefined` | CORS configuration options.          |
| `bodyParser`     | `BodyParserOptions` | `undefined` | Body parser configuration options.   |
| `rateLimit`      | `RateLimitOptions`  | `undefined` | Rate limiting configuration options. |
| `static`         | `StaticOptions[]`   | `[]`        | Static file serving configurations.  |
| `views`          | `string`            | `undefined` | Views directory path for templates.  |
| `templateEngine` | `TemplateEngine`    | `undefined` | Custom template engine instance.     |

### Built-in Middleware Options

| Middleware   | Options Type        | Description                              |
| ------------ | ------------------- | ---------------------------------------- |
| CORS         | `CorsOptions`       | Configure cross-origin resource sharing. |
| Body Parser  | `BodyParserOptions` | Configure request body parsing.          |
| Rate Limit   | `RateLimitOptions`  | Configure request rate limiting.         |
| Static Files | `StaticOptions`     | Configure static file serving.           |

## 📝 Notes

- **Express Compatibility**: NextRush is designed as a drop-in replacement for Express.js with enhanced TypeScript support and additional features.
- **TypeScript First**: The framework is built with TypeScript from the ground up, providing full type safety and intelligent autocompletion.
- **Zero Dependencies**: NextRush has minimal external dependencies, ensuring lightweight and secure applications.
- **Plugin Architecture**: Extend functionality through the modular plugin system without bloating the core framework.
- **Performance Focused**: Built-in performance monitoring and optimization features help maintain high application performance.
- **Production Ready**: Includes enterprise-grade features like rate limiting, security headers, and comprehensive error handling.
- **Migration Path**: Easy migration from existing Express.js applications with minimal code changes required.

## Project Structure

```text
my-nextrush-app/
├── src/
│   ├── index.ts          # Main server file
│   ├── routes/           # Route handlers
│   ├── middleware/       # Custom middleware
│   └── views/           # Template files
├── public/              # Static files
├── package.json
└── tsconfig.json
```

## Configuration Options

```typescript
const app = createApp({
  timeout: 30000, // Request timeout (30s)
  caseSensitive: false, // Route case sensitivity
  strict: false, // Strict routing
});
```

## Environment Setup

```bash
# Development
NODE_ENV=development

# Production
NODE_ENV=production
PORT=3000
```

## Next Steps

- [Routing Guide](./ROUTING.md) - Learn about HTTP methods and middleware
- [Security Guide](./SECURITY.md) - Input validation and sanitization
- [Templates](./TEMPLATE-ENGINE.md) - Server-side rendering
- [Static Files](./STATIC-FILES.md) - Serving static content
- [WebSocket](./WEBSOCKET.md) - Real-time communication
