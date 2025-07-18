# 🚀 NextRush API Reference - Complete Guide

**The most comprehensive, type-safe, zero-dependency web framework API**

## 📚 **Table of Contents**

| Section                                 | Description                         | Key Features                           |
| --------------------------------------- | ----------------------------------- | -------------------------------------- |
| [🏗️ Application](#️-application)        | Core app creation and configuration | Zero-config setup, TypeScript support  |
| [🔄 Routing](#-routing)                 | HTTP method routing and middleware  | Express-style + Context-style handlers |
| [📦 Body Parser](#-body-parser)         | Ultimate zero-dependency parsing    | Auto-detection, file uploads, security |
| [🎯 Request API](#-request-api)         | Enhanced request object             | Smart parsing, validation, utilities   |
| [📤 Response API](#-response-api)       | Professional response methods       | JSON, templates, files, security       |
| [🎨 Template Engine](#-template-engine) | Zero-dependency rendering           | Mustache-style, layouts, helpers       |
| [📁 Static Files](#-static-files)       | High-performance file serving       | SPA support, caching, compression      |
| [🌐 WebSocket](#-websocket)             | Real-time communication             | Event-driven, room management          |
| [🔌 Middleware](#-middleware)           | Request/response processing         | Presets, custom, security-focused      |
| [⚡ Events](#-events)                   | Plugin communication system         | Event-driven architecture              |
| [🚨 Error Handling](#-error-handling)   | Comprehensive error management      | Custom errors, debugging               |

---

## 🏗️ **Application**

### 🎯 **Creating an Application**

```typescript
import { createApp } from 'nextrush';

// ✅ Basic application
const app = createApp();

// 🚀 Advanced configuration
const app = createApp({
  timeout: 30000, // Request timeout (30s)
  maxRequestSize: 10 * 1024 * 1024, // Max body size (10MB)
  views: './views', // Template directory
  publicDir: './public', // Static files directory
  enableCors: true, // Enable CORS
  security: {
    // Security settings
    helmet: true,
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
    },
  },
});
```

### 📊 **Application Configuration**

| Option                  | Type      | Default     | Description               |
| ----------------------- | --------- | ----------- | ------------------------- |
| `timeout`               | `number`  | `30000`     | Request timeout (ms)      |
| `maxRequestSize`        | `number`  | `1MB`       | Maximum request body size |
| `views`                 | `string`  | `./views`   | Template directory        |
| `publicDir`             | `string`  | `./public`  | Static files directory    |
| `enableCors`            | `boolean` | `false`     | Enable CORS headers       |
| `security.helmet`       | `boolean` | `true`      | Security headers          |
| `security.rateLimiting` | `object`  | `undefined` | Rate limiting config      |

### 🚀 **Server Management**

```typescript
// 🌟 Start server
app.listen(3000, () => {
  console.log('🚀 NextRush server running on port 3000');
});

// 🎯 Advanced server setup
app.listen({
  port: 3000,
  host: '0.0.0.0',
  callback: () => console.log('✅ Server started'),
  onError: (error) => console.error('❌ Server error:', error),
});

// 🛑 Graceful shutdown
process.on('SIGINT', () => {
  app.close(() => {
    console.log('👋 Server gracefully shut down');
    process.exit(0);
  });
});
```

---

## 🔄 **Routing**

### 🎯 **HTTP Methods**

| Method                       | Description      | Example                             |
| ---------------------------- | ---------------- | ----------------------------------- |
| `app.get(path, handler)`     | GET requests     | `app.get('/users', handler)`        |
| `app.post(path, handler)`    | POST requests    | `app.post('/users', handler)`       |
| `app.put(path, handler)`     | PUT requests     | `app.put('/users/:id', handler)`    |
| `app.patch(path, handler)`   | PATCH requests   | `app.patch('/users/:id', handler)`  |
| `app.delete(path, handler)`  | DELETE requests  | `app.delete('/users/:id', handler)` |
| `app.head(path, handler)`    | HEAD requests    | `app.head('/users', handler)`       |
| `app.options(path, handler)` | OPTIONS requests | `app.options('/api', handler)`      |
| `app.all(path, handler)`     | All HTTP methods | `app.all('/api/*', handler)`        |

### 🎨 **Handler Styles**

NextRush supports **both Express-style and Context-style** handlers with full TypeScript support!

```typescript
// 🔥 Express-style handlers (familiar syntax)
app.get('/api/users', (req: NextRushRequest, res: NextRushResponse) => {
  res.json({ users: [{ id: 1, name: 'John' }] });
});

// 🚀 Context-style handlers (modern approach)
app.get('/api/profile', (context: RequestContext) => {
  const { req, res } = context;
  const userId = req.param('id');
  res.json({ profile: { id: userId } });
});

// ⚡ Async handlers supported
app.post('/api/users', async (req, res) => {
  const user = await createUser(req.body);
  res.status(201).json({ user });
});

// 🎯 Route parameters
app.get('/users/:id/posts/:postId', (req, res) => {
  const userId = req.param('id'); // URL parameter
  const postId = req.param('postId'); // URL parameter
  const filter = req.query('filter'); // Query parameter

  res.json({ userId, postId, filter });
});
```

### 🛣️ **Route Patterns**

```typescript
// 📍 Static routes
app.get('/about', handler);
app.get('/contact', handler);

// 📍 Dynamic routes with parameters
app.get('/users/:id', handler);
app.get('/users/:userId/posts/:postId', handler);

// 📍 Wildcard routes
app.get('/api/*', handler); // Matches /api/anything
app.get('/files/**', handler); // Matches /files/any/deep/path

// 📍 Optional parameters
app.get('/posts/:id?', handler); // Matches /posts and /posts/123

// 📍 Route with query validation
app.get('/search', (req, res) => {
  const query = req.query('q'); // Required query param
  const page = req.query('page', '1'); // Optional with default
  const limit = req.queryInt('limit', 10); // Type-safe integer parsing

  res.json({ query, page: parseInt(page), limit });
});
```

### 🔗 **Route Chaining & Grouping**

```typescript
// ⛓️ Route chaining
app
  .route('/api/users')
  .get((req, res) => res.json({ users: [] }))
  .post((req, res) => res.json({ created: req.body }))
  .put((req, res) => res.json({ updated: req.body }));

// 📂 Route grouping with middleware
const apiRouter = app.group('/api', [
  app.useMiddleware('cors'),
  app.useMiddleware('auth'),
]);

apiRouter.get('/users', getUsersHandler);
apiRouter.post('/users', createUserHandler);
apiRouter.delete('/users/:id', deleteUserHandler);
```

---

## 📦 **Body Parser**

NextRush includes the **Ultimate Body Parser** - zero dependencies, maximum security! 🔒

### 🎯 **Automatic Parsing**

```typescript
// 🚀 ZERO CONFIGURATION - Works automatically!
app.post('/api/data', (req, res) => {
  console.log('📦 Parsed body:', req.body); // Any format!
  console.log('📁 Files:', req.files); // File uploads!
  console.log('📋 Fields:', req.fields); // Form fields!

  res.json({ received: req.body });
});
```

### 📊 **Supported Formats**

| Content Type                        | Parsed To      | Example                  |
| ----------------------------------- | -------------- | ------------------------ |
| `application/json`                  | Object         | `{ "name": "John" }`     |
| `application/x-www-form-urlencoded` | Object         | `name=John&age=30`       |
| `multipart/form-data`               | Files + Fields | File uploads + form data |
| `text/plain`                        | String         | Raw text content         |
| `application/xml`                   | String         | XML documents            |
| `application/octet-stream`          | Buffer         | Binary data              |

### 📁 **File Upload Handling**

```typescript
// 🎯 Single file upload
app.post('/upload/avatar', (req, res) => {
  const avatar = req.file('avatar');

  if (avatar) {
    console.log('📄 File details:', {
      name: avatar.originalName,
      size: avatar.size,
      type: avatar.mimeType,
      path: avatar.path,
    });

    res.json({ success: true, file: avatar.originalName });
  } else {
    res.status(400).json({ error: 'No file uploaded' });
  }
});

// 📁 Multiple file uploads
app.post('/upload/gallery', (req, res) => {
  const images = req.files('images');

  if (images && images.length > 0) {
    const processedFiles = images.map((img) => ({
      name: img.originalName,
      size: img.size,
      url: `/uploads/${img.filename}`,
    }));

    res.json({ success: true, files: processedFiles });
  } else {
    res.status(400).json({ error: 'No files uploaded' });
  }
});

// 🎨 Mixed form data with files
app.post('/api/profile', (req, res) => {
  const name = req.field('name'); // Form field
  const bio = req.field('bio'); // Form field
  const avatar = req.file('avatar'); // File upload

  res.json({
    profile: { name, bio },
    hasAvatar: !!avatar,
    avatar: avatar
      ? {
          name: avatar.originalName,
          size: avatar.size,
        }
      : null,
  });
});
```

### 🔒 **Security Features**

```typescript
// 🛡️ Built-in security validations
app.post('/api/secure-upload', (req, res) => {
  // File size validation (automatic)
  const file = req.file('document');
  if (file && file.size > 5 * 1024 * 1024) {
    // 5MB limit
    return res.status(413).json({ error: 'File too large' });
  }

  // MIME type validation
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (file && !allowedTypes.includes(file.mimeType)) {
    return res.status(400).json({ error: 'Invalid file type' });
  }

  // Filename sanitization (automatic)
  console.log('✅ Safe filename:', file.safeFilename);

  res.json({ success: true });
});
```

---

## 🎯 **Request API**

### 📊 **Request Properties**

| Property      | Type     | Description          | Example                   |
| ------------- | -------- | -------------------- | ------------------------- |
| `req.body`    | `any`    | Parsed request body  | `{ name: "John" }`        |
| `req.files`   | `File[]` | Uploaded files array | `[File, File]`            |
| `req.fields`  | `object` | Form fields object   | `{ name: "John" }`        |
| `req.query`   | `object` | Query parameters     | `{ page: "1" }`           |
| `req.params`  | `object` | Route parameters     | `{ id: "123" }`           |
| `req.headers` | `object` | Request headers      | `{ "user-agent": "..." }` |
| `req.cookies` | `object` | Request cookies      | `{ sessionId: "abc" }`    |
| `req.ip`      | `string` | Client IP address    | `192.168.1.1`             |
| `req.method`  | `string` | HTTP method          | `GET`                     |
| `req.url`     | `string` | Request URL          | `/api/users?page=1`       |
| `req.path`    | `string` | URL pathname         | `/api/users`              |

### 🎯 **Request Methods**

```typescript
// 📍 Parameter access
const userId = req.param('id'); // Route parameter
const name = req.param('name', 'Anonymous'); // With default value

// 🔍 Query parameter access
const page = req.query('page'); // String value
const limit = req.queryInt('limit', 10); // Integer with default
const active = req.queryBool('active', false); // Boolean with default
const tags = req.queryArray('tags'); // Array values

// 📄 Header access
const userAgent = req.header('user-agent');
const contentType = req.header('content-type');
const authToken = req.header('authorization');

// 🍪 Cookie access
const sessionId = req.cookie('sessionId');
const theme = req.cookie('theme', 'light'); // With default

// 📁 File access methods
const avatar = req.file('avatar'); // Single file
const images = req.files('gallery'); // Multiple files
const allFiles = req.files(); // All uploaded files

// 📋 Form field access
const username = req.field('username');
const email = req.field('email');
const bio = req.field('bio', ''); // With default

// 🎯 Advanced request info
const isSecure = req.secure; // HTTPS check
const protocol = req.protocol; // http/https
const hostname = req.hostname; // Domain name
const originalUrl = req.originalUrl; // Full original URL
```

### 🔍 **Request Validation**

```typescript
// ✅ Type-safe validation helpers
app.post('/api/user', (req, res) => {
  // Required field validation
  const email = req.field('email');
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Email format validation
  if (!req.isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Number validation
  const age = req.fieldInt('age');
  if (age < 18) {
    return res.status(400).json({ error: 'Must be 18 or older' });
  }

  // File validation
  const avatar = req.file('avatar');
  if (avatar && !req.isValidImageFile(avatar)) {
    return res.status(400).json({ error: 'Invalid image file' });
  }

  res.json({ success: true });
});
```

---

## 📤 **Response API**

### 🎯 **Response Methods**

| Method                       | Description              | Example                          |
| ---------------------------- | ------------------------ | -------------------------------- |
| `res.json(data)`             | Send JSON response       | `res.json({ users: [] })`        |
| `res.text(string)`           | Send plain text          | `res.text('Hello World')`        |
| `res.html(html)`             | Send HTML                | `res.html('<h1>Hello</h1>')`     |
| `res.xml(xml)`               | Send XML                 | `res.xml('<user>John</user>')`   |
| `res.send(data)`             | Smart send (auto-detect) | `res.send(anyData)`              |
| `res.status(code)`           | Set status code          | `res.status(201)`                |
| `res.render(template, data)` | Render template          | `res.render('user.html', user)`  |
| `res.sendFile(path)`         | Send file                | `res.sendFile('/path/file.pdf')` |
| `res.download(path, name)`   | Force download           | `res.download(path, 'file.pdf')` |
| `res.cookie(name, value)`    | Set cookie               | `res.cookie('theme', 'dark')`    |
| `res.clearCookie(name)`      | Clear cookie             | `res.clearCookie('session')`     |

### 📊 **Response Examples**

```typescript
// 📄 JSON responses
res.json({
  data: users,
  meta: {
    total: users.length,
    page: 1,
    timestamp: new Date().toISOString(),
  },
});

// 📝 Text responses
res.text('Simple text response');

// 🌐 HTML responses
res.html(`
  <html>
    <head><title>NextRush</title></head>
    <body><h1>Welcome to NextRush!</h1></body>
  </html>
`);

// ⛓️ Method chaining
res.status(201).set('X-API-Version', '1.0').json({ created: true });

// 🍪 Cookie management
res.cookie('sessionId', 'abc123', {
  httpOnly: true,
  secure: true,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
});
```

---

## 🎨 **Template Engine**

NextRush includes the **Ultimate Template Engine** - zero dependencies, maximum flexibility!

### 🎯 **Template Configuration**

```typescript
// 🎨 Set template directory
app.setViews('./views');

// 🖼️ Render templates
app.get('/profile/:id', async (req, res) => {
  const user = await getUserById(req.param('id'));

  res.render('profile.html', {
    user,
    title: `${user.name}'s Profile`,
    isOwner: req.user?.id === user.id,
  });
});
```

### 🎭 **Template Syntax**

```html
<!-- 📝 Variable interpolation -->
<h1>Welcome, {{user.name}}!</h1>
<p>Email: {{user.email}}</p>

<!-- 🔄 Conditionals -->
{{#if user.isAdmin}}
<span class="badge admin">Administrator</span>
{{else}}
<span class="badge user">User</span>
{{/if}}

<!-- 📋 Loops -->
<ul class="posts">
  {{#each posts}}
  <li class="post">
    <h3>{{title}}</h3>
    <p>{{content}}</p>
    <small>By {{author.name}} on {{formatDate createdAt}}</small>
  </li>
  {{/each}}
</ul>

<!-- 🎨 Helpers -->
<p>Total: {{formatCurrency total}}</p>
<time>{{formatDate timestamp 'YYYY-MM-DD'}}</time>
```

### 🏗️ **Template Features**

```typescript
// 🎯 Template with helpers
res.render('dashboard.html', {
  users: userList,
  stats: {
    totalUsers: 150,
    activeUsers: 89,
  },
  // Custom helpers
  formatDate: (date) => new Date(date).toLocaleDateString(),
  formatCurrency: (amount) => `$${amount.toFixed(2)}`,
  capitalize: (str) => str.charAt(0).toUpperCase() + str.slice(1),
});

// 🏗️ Layout support
res.render('page.html', {
  layout: 'layout.html',
  title: 'My Page',
  content: 'Page-specific content',
});

// 📄 Render template strings
res.renderString('<h1>Hello {{name}}!</h1>', { name: 'World' });
```

---

## 📁 **Static Files**

### 🎯 **Static File Serving**

```typescript
// 📂 Basic static file serving
app.static('/public', './public');

// 🚀 Advanced static configuration
app.static('/assets', './assets', {
  spa: true, // Single Page App support
  index: 'index.html', // Default file
  dotfiles: 'ignore', // Handle dotfiles
  etag: true, // Enable ETags
  maxAge: '1d', // Cache duration
  immutable: true, // Immutable caching
  fallthrough: false, // Error on missing files
  extensions: ['html', 'htm'], // File extensions to try
});

// 🎯 Multiple static directories
app.static('/css', './styles');
app.static('/js', './scripts');
app.static('/images', './images');
app.static('/uploads', './uploads');

// 🌟 SPA (Single Page Application) support
app.static('/', './dist', {
  spa: true, // Fallback to index.html
  index: 'index.html',
});
```

---

## 🌐 **WebSocket**

### 🎯 **WebSocket Setup**

```typescript
// 🌐 WebSocket endpoint
app.ws('/chat', (socket, req) => {
  console.log('🔗 New WebSocket connection');

  // Send welcome message
  socket.send(
    JSON.stringify({
      type: 'welcome',
      message: 'Connected to chat server',
    })
  );

  // Handle incoming messages
  socket.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Received:', message);

    // Broadcast to all clients
    app.broadcast('chat', {
      type: 'message',
      user: message.user,
      text: message.text,
      timestamp: new Date().toISOString(),
    });
  });

  // Handle connection close
  socket.on('close', () => {
    console.log('👋 WebSocket disconnected');
  });
});
```

### 🎯 **Advanced WebSocket Features**

```typescript
// 🏠 Room-based messaging
app.ws('/chat/:room', (socket, req) => {
  const room = req.param('room');

  // Join room
  socket.join(room);

  // Broadcast to room
  socket.on('message', (data) => {
    app.broadcastToRoom(room, {
      message: JSON.parse(data.toString()),
    });
  });
});

// 📡 Real-time API updates
app.ws('/api/live', (socket, req) => {
  // Send live data updates
  const interval = setInterval(() => {
    socket.send(
      JSON.stringify({
        type: 'update',
        data: getLiveData(),
        timestamp: Date.now(),
      })
    );
  }, 1000);

  socket.on('close', () => {
    clearInterval(interval);
  });
});
```

---

## 🔌 **Middleware**

### 🎯 **Middleware Usage**

```typescript
// 🚀 Global middleware
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// 🛡️ Security middleware presets
app.use(app.preset('security')); // Helmet + CORS + Rate limiting
app.use(app.preset('performance')); // Compression + Caching
app.use(app.preset('development')); // Logging + Error details

// 🎯 Route-specific middleware
app.get(
  '/admin/*',
  app.middleware('auth'), // Authentication required
  app.middleware('admin'), // Admin role required
  (req, res) => {
    res.render('admin-dashboard.html');
  }
);

// 🔗 Custom middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `⏱️ ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`
    );
  });

  next();
};

app.use(requestLogger);
```

### 🛡️ **Security Middleware**

```typescript
// 🔒 Built-in security presets
app.use(
  app.preset('security', {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    },
    cors: {
      origin: ['https://yourdomain.com'],
      credentials: true,
    },
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
    },
  })
);

// 🎯 Custom authentication middleware
const authMiddleware = (req, res, next) => {
  const token = req.header('authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

app.use('/api/protected', authMiddleware);
```

---

## ⚡ **Events**

### 🎯 **Event System**

```typescript
// 📡 Listen to application events
app.on('request', (req) => {
  console.log(`📥 Incoming request: ${req.method} ${req.url}`);
});

app.on('response', (req, res) => {
  console.log(`📤 Response sent: ${res.statusCode}`);
});

app.on('error', (error, req, res) => {
  console.error('❌ Application error:', error);

  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 🎯 Custom events
app.emit('user:created', { userId: 123, email: 'user@example.com' });
app.emit('payment:processed', { orderId: 456, amount: 99.99 });

// 📨 Event listeners
app.on('user:created', (userData) => {
  console.log('👤 New user created:', userData);
  // Send welcome email, update analytics, etc.
});

app.on('payment:processed', (paymentData) => {
  console.log('💳 Payment processed:', paymentData);
  // Update inventory, send confirmation, etc.
});
```

---

## 🚨 **Error Handling**

### 🎯 **Error Management**

```typescript
// 🚨 Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Global error:', error);

  // Development vs Production error responses
  if (process.env.NODE_ENV === 'development') {
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      details: error,
    });
  } else {
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// 🎯 Custom error classes
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
  }
}

class AuthenticationError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

// 📊 Error handling in routes
app.post('/api/users', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      throw new ValidationError('Email is required', 'email');
    }

    if (!password || password.length < 8) {
      throw new ValidationError(
        'Password must be at least 8 characters',
        'password'
      );
    }

    const user = await createUser({ email, password });
    res.status(201).json({ user });
  } catch (error) {
    next(error); // Pass to error handler
  }
});
```

### 🔍 **Development Tools**

```typescript
// 🔧 Development middleware
if (process.env.NODE_ENV === 'development') {
  app.use(
    app.preset('development', {
      logging: true, // Request logging
      errorDetails: true, // Detailed error responses
      reload: true, // Auto-reload on changes
      debugMode: true, // Debug information
    })
  );
}

// 📊 Request/Response logging
app.use((req, res, next) => {
  console.log(`📊 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log(`📋 Headers:`, req.headers);
  console.log(`📦 Body:`, req.body);

  const originalJson = res.json;
  res.json = function (data) {
    console.log(`📤 Response:`, data);
    return originalJson.call(this, data);
  };

  next();
});
```

---

## 🎯 **Complete Example**

```typescript
import { createApp } from 'nextrush';

// 🚀 Create application with full configuration
const app = createApp({
  timeout: 30000,
  maxRequestSize: 10 * 1024 * 1024,
  views: './views',
  publicDir: './public',
});

// 🛡️ Security middleware
app.use(app.preset('security'));

// 📁 Static files
app.static('/', './public', { spa: true });

// 🎨 Template engine
app.setViews('./views');

// 🔄 API routes
app.get('/api/users', async (req, res) => {
  const page = req.queryInt('page', 1);
  const limit = req.queryInt('limit', 10);

  const users = await getUsersPaginated(page, limit);

  res.json({
    data: users,
    meta: { page, limit, total: users.length },
  });
});

app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;

  const user = await createUser({ name, email });

  res.status(201).json({
    success: true,
    user,
  });
});

// 📁 File upload endpoint
app.post('/upload', (req, res) => {
  const file = req.file('document');

  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  res.json({
    success: true,
    file: {
      name: file.originalName,
      size: file.size,
      type: file.mimeType,
    },
  });
});

// 🌐 WebSocket endpoint
app.ws('/live', (socket, req) => {
  socket.send(
    JSON.stringify({
      type: 'connected',
      message: 'Real-time connection established',
    })
  );

  socket.on('message', (data) => {
    const message = JSON.parse(data.toString());
    app.broadcast('live', message);
  });
});

// 🚀 Start server
app.listen(3000, () => {
  console.log('🎉 NextRush server running on port 3000');
});
```

---

## 🎯 **Summary**

NextRush provides:

- ✅ **Zero-configuration setup** with sensible defaults
- ✅ **Express-compatible API** with modern enhancements
- ✅ **Ultimate Body Parser** with automatic file handling
- ✅ **Professional template engine** with zero dependencies
- ✅ **High-performance static file serving** with SPA support
- ✅ **Real-time WebSocket support** with room management
- ✅ **Security-first middleware** with built-in protection
- ✅ **TypeScript support** with full autocomplete
- ✅ **Event-driven architecture** for extensibility

**Ready to build modern web applications with professional-grade features!** 🚀
});

// Works with ANY content type:
// ✅ JSON: application/json
// ✅ Forms: application/x-www-form-urlencoded
// ✅ Files: multipart/form-data
// ✅ Text: text/plain
// ✅ Binary: application/octet-stream

````

### Manual Parser Usage

```javascript
import { UltimateBodyParser } from 'nextrush/parsers';

const parser = new UltimateBodyParser({
  maxSize: 50 * 1024 * 1024, // 50MB limit
  encoding: 'utf8',
  strict: false,
});

app.post('/custom', async (req, res) => {
  try {
    const result = await parser.parse(req);
    console.log(`🎯 Parser: ${result.parser}`);
    console.log(`📊 Size: ${result.size} bytes`);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
````

### Parser-Specific Middleware

```javascript
// JSON only
app.post('/api/json', parser.json({ strict: true }), (req, res) =>
  res.json(req.body)
);

// Form data only
app.post('/forms/submit', parser.urlencoded({ extended: true }), (req, res) =>
  res.redirect('/success')
);

// File uploads only
app.post(
  '/upload',
  parser.multipart({ maxFileSize: 50 * 1024 * 1024 }),
  (req, res) => {
    const { file } = req.body;
    console.log(`📦 Uploaded: ${file.filename}`);
    res.json({ success: true });
  }
);
```

### 📚 Detailed Documentation

For complete body parser documentation, see:

- **[🚀 Ultimate Body Parser Guide](./BODY-PARSER-ULTIMATE.md)** - Complete overview with examples
- **[🛠️ Implementation Guide](./BODY-PARSER-GUIDE.md)** - Step-by-step usage guide
- **[🔧 API Reference](./BODY-PARSER-API.md)** - Complete API documentation

---

## Event System API

### Event Emitter Methods

#### `app.on(event: string, listener: Function)`

Register an event listener.

```javascript
app.on('request:start', (data) => {
  console.log(`Request: ${data.method} ${data.url}`);
});
```

#### `app.off(event: string, listener: Function)`

Remove an event listener.

#### `app.emit(event: string, ...args: any[])`

Emit a custom event.

### Event Data Structures

#### `RequestEventData`

```typescript
{
  id: string;
  method: string;
  url: string;
  timestamp: number;
  userAgent?: string;
  ip?: string;
}
```

#### `ResponseEventData`

```typescript
{
  id: string;
  method: string;
  url: string;
  timestamp: number;
  statusCode: number;
  duration: number;
  size?: number;
  userAgent?: string;
  ip?: string;
}
```

#### `PerformanceEventData`

```typescript
{
  activeRequests: number;
  totalRequests: number;
  averageResponseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
}
```

---

## Middleware API

### Built-in Middleware

#### `cors(options?: CorsOptions)`

Enable CORS with configurable options.

```javascript
const { cors } = require('nextrush');

app.use(
  cors({
    origin: 'https://example.com',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  })
);
```

#### `helmet(options?: HelmetOptions)`

Security middleware with configurable options.

```javascript
const { helmet } = require('nextrush');

app.use(
  helmet({
    contentSecurityPolicy: true,
    hsts: true,
  })
);
```

#### `compression(options?: CompressionOptions)`

Response compression middleware.

```javascript
const { compression } = require('nextrush');

app.use(
  compression({
    threshold: 1024,
    level: 6,
  })
);
```

#### `rateLimit(options: RateLimitOptions)`

Rate limiting middleware.

```javascript
const { rateLimit } = require('nextrush');

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests',
  })
);
```

### Middleware Composition

#### `compose(...middleware: Middleware[])`

Compose multiple middleware into a single middleware function.

```javascript
const { compose } = require('nextrush');

const authFlow = compose(validateApiKey, checkPermissions, auditLog);

app.use('/protected', authFlow);
```

#### `when(condition: Function, middleware: Middleware)`

Conditionally apply middleware.

```javascript
const { when } = require('nextrush');

const apiMiddleware = when(
  (req) => req.path.startsWith('/api'),
  rateLimit({ max: 100 })
);

app.use(apiMiddleware);
```

### Middleware Presets

#### `app.usePreset(name: string, options?: object)`

Apply a preset collection of middleware.

**Available Presets:**

##### `'production'`

- CORS with secure defaults
- Helmet security headers
- Compression
- Rate limiting
- Request logging

##### `'development'`

- Detailed request logging
- Error stack traces
- Development-friendly CORS

##### `'security'`

- Strict CORS policy
- Full Helmet protection
- Aggressive rate limiting

##### `'api'`

- API-focused CORS
- JSON parsing
- Rate limiting
- Request/response logging

```javascript
// Apply production preset
app.usePreset('production', {
  cors: { origin: 'https://mydomain.com' },
  rateLimit: { max: 1000 },
});
```

---

## Routing API

### HTTP Method Handlers

#### `app.get(path, ...handlers)`

#### `app.post(path, ...handlers)`

#### `app.put(path, ...handlers)`

#### `app.delete(path, ...handlers)`

#### `app.patch(path, ...handlers)`

#### `app.head(path, ...handlers)`

#### `app.options(path, ...handlers)`

Register route handlers for specific HTTP methods.

```javascript
// Single handler
app.get('/users', getUsersHandler);

// Multiple middleware + handler
app.post('/users', authMiddleware, validationMiddleware, createUserHandler);
```

### Route Groups

#### `app.group(path: string, middleware: Middleware[], callback: Function)`

Create a group of routes with shared middleware.

```javascript
app.group('/api/v1', [authMiddleware, rateLimitMiddleware], (router) => {
  router.get('/users', getUsersHandler);
  router.post('/users', createUserHandler);
  router.put('/users/:id', updateUserHandler);
});
```

### Sub-routers

#### `createRouter(options?: RouterOptions)`

Create a sub-router for organizing routes.

```javascript
const { createRouter } = require('nextrush');

const userRouter = createRouter();
userRouter.get('/', getAllUsers);
userRouter.get('/:id', getUser);

app.use('/users', userRouter);
```

---

## Request API

### Properties

#### `req.method: string`

HTTP method (GET, POST, etc.)

#### `req.url: string`

Full request URL

#### `req.path: string`

URL pathname

#### `req.query: object`

Parsed query parameters

#### `req.params: object`

Route parameters

#### `req.body: any`

Parsed request body

#### `req.headers: object`

Request headers

### Methods

#### `req.get(name: string): string | undefined`

#### `req.header(name: string): string | undefined`

Get header value by name (case-insensitive).

```javascript
const userAgent = req.get('user-agent');
const contentType = req.header('content-type');
```

#### `req.param(name: string): string | undefined`

Get route parameter by name.

```javascript
// Route: /users/:id
const userId = req.param('id');
```

---

## Response API

### Methods

#### `res.json(data: any): void`

Send JSON response.

```javascript
res.json({ message: 'Success', data: users });
```

#### `res.text(text: string): void`

Send plain text response.

```javascript
res.text('Hello World');
```

#### `res.html(html: string): void`

Send HTML response.

```javascript
res.html('<h1>Welcome</h1>');
```

#### `res.status(code: number): Response`

Set response status code (chainable).

```javascript
res.status(201).json({ created: true });
```

#### `res.redirect(url: string, status?: number): void`

Redirect to another URL.

```javascript
res.redirect('/login');
res.redirect(301, '/new-location');
```

#### `res.sendFile(path: string): void`

Send a file as response.

```javascript
res.sendFile('./files/document.pdf');
```

#### `res.download(path: string, filename?: string): void`

Send file as download.

```javascript
res.download('./files/data.csv', 'export.csv');
```

#### `res.cookie(name: string, value: string, options?: object): Response`

Set response cookie (chainable).

```javascript
res.cookie('sessionId', '123', {
  httpOnly: true,
  secure: true,
  maxAge: 3600000,
});
```

#### `res.set(name: string, value: string): Response`

#### `res.header(name: string, value: string): Response`

Set response header (chainable).

```javascript
res.set('Cache-Control', 'no-cache').set('X-Custom-Header', 'value');
```

---

## File Operations API

### Static File Serving

#### `app.static(mountPath: string, directory: string, options?: StaticOptions)`

Serve static files from a directory.

```javascript
app.static('/public', './public-files', {
  maxAge: '1d',
  etag: true,
  index: ['index.html'],
  dotfiles: 'ignore',
});
```

**Options:**

- `maxAge`: Cache duration
- `etag`: Enable ETag headers
- `index`: Index file names
- `dotfiles`: How to handle dotfiles ('allow', 'deny', 'ignore')
- `immutable`: Mark files as immutable
- `redirect`: Redirect trailing slashes

---

## Error Handling API

### Error Events

Listen for error events to implement custom error handling:

```javascript
app.on('error', (data) => {
  console.error(`Error in ${data.method} ${data.url}:`, data.error.message);

  // Send to error tracking service
  errorService.capture(data.error, {
    requestId: data.id,
    url: data.url,
    method: data.method,
    userAgent: data.userAgent,
    ip: data.ip,
  });
});
```

### Custom Error Middleware

```javascript
app.use((error, req, res, next) => {
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details,
    });
  }

  res.status(500).json({
    error: 'Internal server error',
  });
});
```

---

## Performance Monitoring API

### Statistics

#### `app.events.getStats(): PerformanceStats`

Get current performance statistics.

```javascript
const stats = app.events.getStats();
console.log({
  activeRequests: stats.activeRequests,
  totalRequests: stats.totalRequests,
  averageResponseTime: stats.averageResponseTime,
  uptime: stats.uptime,
  memoryUsage: stats.memoryUsage,
});
```

### Performance Events

#### `performance:metrics`

Emitted every 30 seconds with current metrics.

#### `performance:slow-request`

Emitted when a request takes longer than 1000ms.

#### `performance:slow-middleware`

Emitted when middleware takes longer than 100ms.

#### `performance:high-load`

Emitted when active requests exceed 50.

#### `performance:memory-warning`

Emitted when memory usage exceeds 100MB.

---

## TypeScript Types

### Application Types

```typescript
interface ApplicationOptions {
  timeout?: number;
  maxRequestSize?: number;
  router?: Router;
  requestHandler?: RequestHandler;
  errorHandler?: ErrorHandler;
}
```

### Request Types

```typescript
interface NextRushRequest extends IncomingMessage {
  params: Record<string, string>;
  query: ParsedUrlQuery;
  body: any;
  pathname: string;
  originalUrl: string;
  path: string;

  param(name: string): string | undefined;
  header(name: string): string | undefined;
  get(name: string): string | undefined;
}
```

### Response Types

```typescript
interface NextRushResponse extends ServerResponse {
  locals: Record<string, any>;

  status(code: number): NextRushResponse;
  json(data: any): void;
  text(text: string): void;
  html(html: string): void;
  redirect(url: string, status?: number): void;
  sendFile(path: string): void;
  download(path: string, filename?: string): void;
  cookie(
    name: string,
    value: string,
    options?: CookieOptions
  ): NextRushResponse;
  set(name: string, value: string): NextRushResponse;
  header(name: string, value: string): NextRushResponse;
}
```

### Middleware Types

```typescript
type MiddlewareHandler = (
  req: NextRushRequest,
  res: NextRushResponse,
  next: () => void
) => void | Promise<void>;

type RouteHandler = (
  req: NextRushRequest,
  res: NextRushResponse
) => void | Promise<void>;
```

---

## Configuration Examples

### Production Configuration

```javascript
const app = createApp({
  timeout: 30000,
  maxRequestSize: 10 * 1024 * 1024, // 10MB
});

// Apply production preset
app.usePreset('production', {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 1000,
  },
});

// Performance monitoring
app.on('performance:slow-request', (data) => {
  logger.warn(`Slow request: ${data.duration}ms`, {
    method: data.method,
    url: data.url,
    requestId: data.id,
  });
});

app.on('error', (data) => {
  logger.error('Request error', {
    error: data.error.message,
    stack: data.error.stack,
    method: data.method,
    url: data.url,
    requestId: data.id,
  });
});
```

### Development Configuration

```javascript
const app = createApp();

// Development preset with detailed logging
app.usePreset('development');

// Custom development logging
app.on('request:start', (data) => {
  console.log(`🚀 ${data.method} ${data.url} [${data.id}]`);
});

app.on('request:end', (data) => {
  const icon = data.statusCode >= 400 ? '❌' : '✅';
  console.log(
    `${icon} ${data.method} ${data.url} - ${data.statusCode} (${data.duration}ms)`
  );
});

app.on('middleware:before', (data) => {
  console.log(`  🔧 ${data.middlewareName} starting`);
});

app.on('middleware:after', (data) => {
  console.log(`  ✅ ${data.middlewareName} completed (${data.duration}ms)`);
});
```

---

This API reference covers all major NextRush features. For more examples, check the documentation and example files.
