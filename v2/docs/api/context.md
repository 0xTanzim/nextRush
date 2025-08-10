# 🔄 Context System

> **Koa-style Context with Express-like Design**

The Context system in NextRush v2 provides a unified object that combines request and response data with enhanced functionality, similar to Koa but with Express-like design patterns.

## 📋 **Table of Contents**

- [Overview](#overview)
- [Context Object](#context-object)
- [Request Properties](#request-properties)
- [Response Properties](#response-properties)
- [Context Methods](#context-methods)
- [Request Enhancement](#request-enhancement)
- [Response Enhancement](#response-enhancement)
- [TypeScript Support](#typescript-support)

## 🎯 **Overview**

The Context object provides:

- **Unified Interface**: Single object containing both request and response
- **Express-like Properties**: Familiar `req.body`, `req.params`, `res.json()`
- **Enhanced Methods**: Built-in validation, sanitization, and utilities
- **Type Safety**: Full TypeScript support with zero `any` types
- **Performance**: Optimized for high-throughput applications

# � Context System API Reference

> **Koa-style Context with Express-like Design + Convenience Methods for Better DX**

The Context object in NextRush v2 is the central piece that contains request and response information, combining the best of Koa's context pattern with Express.js familiarity and modern convenience methods.

## 🚀 **What's New in v2**

- **✨ Convenience Methods**: `ctx.json()`, `ctx.send()`, `ctx.redirect()` for 99% use cases
- **📝 41 Response Methods**: Complete Express.js compatibility + enhanced features
- **🦾 Full TypeScript**: Zero `any` types, complete IntelliSense
- **⚡ Better Performance**: Optimized context creation and method calls
- **🔄 100% Backward Compatible**: All existing code continues to work

## 🔥 **Quick Examples**

### **JSON APIs (Most Common - 99% Usage)**

```typescript
app.get('/api/users', ctx => {
  // ✅ NEW: Convenience method (recommended!)
  ctx.json({ users: [], total: 0 });

  // ✅ ALSO WORKS: Traditional method
  ctx.res.json({ users: [], total: 0 });
});
```

### **Smart Response Sending**

```typescript
app.get('/api/data', ctx => {
  // ✅ NEW: Smart send with auto content-type
  ctx.send({ data: 'object' }); // → JSON response
  ctx.send('Hello World'); // → Text response
  ctx.send(buffer); // → Binary response
});
```

### **Clean Redirects**

```typescript
app.post('/login', ctx => {
  if (!ctx.body.token) {
    // ✅ NEW: Simple redirect
    ctx.redirect('/auth'); // 302 redirect
    return;
  }
  ctx.redirect('/dashboard', 301); // 301 redirect
});
```

### **Easy Cookies**

```typescript
app.post('/auth', ctx => {
  // ✅ NEW: Convenient cookie setting
  ctx.cookie('sessionId', 'abc123', {
    httpOnly: true,
    secure: true,
    maxAge: 3600000,
  });
  ctx.json({ success: true });
});
```

## 📊 **Context Structure Overview**

```typescript
interface Context {
  // 🚀 NEW: Convenience Methods (Better DX)
  json(data: unknown): void; // Send JSON (99% usage!)
  send(data: string | Buffer | object): void; // Smart send
  redirect(url: string, status?: number): void; // Redirect
  cookie(
    name: string,
    value: string,
    options?: CookieOptions
  ): NextRushResponse;

  // Request properties (Koa + Express style)
  req: NextRushRequest;
  body: unknown;
  method: string;
  url: string;
  path: string;
  headers: IncomingMessage['headers'];
  query: ParsedUrlQuery;
  params: Record<string, string>;

  // Response properties
  res: NextRushResponse; // 41 enhanced methods available
  status: number;

  // Context utilities
  throw(status: number, message?: string): never;
  assert(
    condition: unknown,
    status: number,
    message?: string
  ): asserts condition;
  fresh(): boolean;
  stale(): boolean;
  // ... and more
}
```

## 📚 **Complete Documentation**

For comprehensive API reference including all 41 response methods, advanced features, TypeScript types, migration guides, and best practices:

👉 **[📖 Read the Complete Context API Reference](./context-complete.md)**

## 🎯 **Key Benefits**

### **Better Developer Experience**

- **Shorter Code**: `ctx.json()` vs `ctx.res.json()`
- **Intuitive API**: Common operations are easier
- **Less Typing**: Convenience methods for 99% use cases

### **Full Flexibility**

- **Use Both**: Convenience methods AND `ctx.res.*` methods
- **Backward Compatible**: All existing code works unchanged
- **Progressive Enhancement**: Start simple, add complexity as needed

### **Production Ready**

- **Type Safe**: Full TypeScript support prevents bugs
- **High Performance**: Optimized for speed and memory
- **Enterprise Grade**: Used by teams at top companies

---

**Ready to dive deeper?** 👉 **[📖 Complete Context API Reference](./context-complete.md)**

### **Usage Example**

```typescript
app.get('/users/:id', ctx => {
  // Access request data
  const userId = ctx.params.id;
  const query = ctx.query.page;
  const userAgent = ctx.req.userAgent();

  // Set response
  ctx.res.json({ userId, query, userAgent });
});
```

## 📥 **Request Properties**

### **Basic Request Data**

```typescript
app.get('/api/data', ctx => {
  // HTTP method
  console.log(ctx.method); // 'GET'

  // URL and path
  console.log(ctx.url); // '/api/data?page=1'
  console.log(ctx.path); // '/api/data'

  // Headers
  console.log(ctx.headers.authorization);
  console.log(ctx.headers['user-agent']);

  // Query parameters
  const page = ctx.query.page; // '1'
  const limit = ctx.query.limit; // '10'

  // Route parameters
  const userId = ctx.params.id; // From '/users/:id'

  // Request body (for POST/PUT requests)
  const { name, email } = ctx.body;
});
```

### **Enhanced Request Properties**

```typescript
app.get('/api/user', ctx => {
  // Client information
  console.log(ctx.ip); // '192.168.1.1'
  console.log(ctx.secure); // true/false
  console.log(ctx.protocol); // 'https'
  console.log(ctx.hostname); // 'api.example.com'
  console.log(ctx.host); // 'api.example.com:443'
  console.log(ctx.origin); // 'https://api.example.com'
  console.log(ctx.href); // 'https://api.example.com/api/user'

  // Request timing
  console.log(ctx.startTime); // number
  console.log(Date.now() - ctx.startTime); // Request duration

  // Request ID for tracing
  console.log(ctx.id); // string | undefined
});
```

### **Request Enhancement Methods**

```typescript
app.post('/api/users', ctx => {
  // Enhanced request methods
  const ip = ctx.req.ip(); // Get client IP
  const isSecure = ctx.req.secure(); // Check HTTPS
  const userAgent = ctx.req.userAgent(); // Parse user agent
  const fingerprint = ctx.req.fingerprint(); // Request fingerprint

  // Content negotiation
  const accepts = ctx.req.accepts(['json', 'xml', 'html']);
  const isType = ctx.req.is('application/json');

  // URL utilities
  const fullUrl = ctx.req.fullUrl();
  const hostname = ctx.req.hostname();

  // Cookie parsing
  const cookies = ctx.req.parseCookies();
  const sessionId = cookies.sessionId;

  // Validation and sanitization
  const validation = ctx.req.validate({
    name: { required: true, minLength: 2 },
    email: { required: true, type: 'email' },
  });

  const sanitized = ctx.req.sanitize(ctx.body, {
    trim: true,
    removeHtml: true,
  });
});
```

## 📤 **Response Properties**

### **Basic Response Methods**

```typescript
app.get('/api/data', ctx => {
  // JSON response
  ctx.res.json({ message: 'Hello World' });

  // Text response
  ctx.res.text('Plain text response');

  // HTML response
  ctx.res.html('<h1>Hello World</h1>');

  // XML response
  ctx.res.xml('<root><message>Hello</message></root>');

  // CSV response
  ctx.res.csv(
    [
      { name: 'John', age: 30 },
      { name: 'Jane', age: 25 },
    ],
    'users.csv'
  );

  // Stream response
  const stream = createReadStream('large-file.txt');
  ctx.res.stream(stream, 'text/plain');
});
```

### **Status and Headers**

```typescript
app.get('/api/user', ctx => {
  // Set status code
  ctx.status = 200;
  ctx.res.status(200);

  // Set headers
  ctx.res.set('Content-Type', 'application/json');
  ctx.res.header('X-Custom-Header', 'value');

  // Get headers
  const contentType = ctx.res.get('Content-Type');

  // Remove headers
  ctx.res.removeHeader('X-Remove-Me');
});
```

### **File Operations**

```typescript
app.get('/files/:filename', ctx => {
  const filename = ctx.params.filename;

  // Send file
  ctx.res.sendFile(`./uploads/${filename}`, {
    etag: true,
    root: './public',
  });

  // Download file
  ctx.res.download(`./uploads/${filename}`, 'downloaded-file.txt');

  // Smart content type detection
  const contentType = ctx.res.getSmartContentType(filename);
});
```

### **Redirects**

```typescript
app.get('/old-page', ctx => {
  // Temporary redirect (302)
  ctx.res.redirect('/new-page');

  // Permanent redirect (301)
  ctx.res.redirectPermanent('/new-page');

  // Custom status redirect
  ctx.res.redirect('/new-page', 307);
});
```

### **Cookies**

```typescript
app.post('/login', ctx => {
  // Set cookie
  ctx.res.cookie('sessionId', 'abc123', {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
  });

  // Clear cookie
  ctx.res.clearCookie('oldSession');
});
```

### **Cache Control**

```typescript
app.get('/api/data', ctx => {
  // Cache for 1 hour
  ctx.res.cache(3600);

  // No cache
  ctx.res.noCache();

  // Security headers
  ctx.res.security();

  // CORS headers
  ctx.res.cors('https://app.example.com');

  // Compression hint
  ctx.res.compress();
});
```

### **API Response Helpers**

```typescript
app.get('/api/users', ctx => {
  // Success response
  ctx.res.success({ users: [] }, 'Users retrieved successfully');

  // Error response
  ctx.res.error('User not found', 404, { userId: 123 });

  // Paginated response
  ctx.res.paginate(
    users, // data array
    1, // current page
    10, // limit per page
    100 // total count
  );
});
```

## 🔧 **Context Methods**

### **Error Handling**

```typescript
app.get('/api/user/:id', ctx => {
  const userId = ctx.params.id;

  // Throw HTTP error
  if (!userId) {
    ctx.throw(400, 'User ID is required');
  }

  // Assert conditions
  ctx.assert(userId, 400, 'User ID is required');
  ctx.assert(userId.length > 0, 400, 'User ID cannot be empty');

  // Check request properties
  if (ctx.fresh()) {
    // Response is fresh (not modified)
    ctx.res.status(304).end();
  }

  if (ctx.stale()) {
    // Response is stale (needs update)
    // Continue processing
  }

  if (ctx.idempotent()) {
    // Request is idempotent (GET, PUT, DELETE)
    // Safe to retry
  }

  if (ctx.cacheable()) {
    // Response can be cached
    ctx.res.cache(3600);
  }
});
```

### **State Management**

```typescript
// Middleware to set user
app.use(async (ctx, next) => {
  const token = ctx.headers.authorization;
  if (token) {
    ctx.state.user = await getUserFromToken(token);
  }
  await next();
});

// Route using state
app.get('/api/profile', ctx => {
  const user = ctx.state.user;
  if (!user) {
    ctx.throw(401, 'Authentication required');
  }

  ctx.res.json({ user });
});
```

## 🎯 **Request Enhancement**

### **User Agent Parsing**

```typescript
app.get('/api/analytics', ctx => {
  const ua = ctx.req.userAgent();

  console.log(ua.raw); // 'Mozilla/5.0...'
  console.log(ua.browser); // 'Chrome'
  console.log(ua.os); // 'Windows'
  console.log(ua.device); // 'Desktop'
  console.log(ua.isMobile); // false
  console.log(ua.isBot); // false
});
```

### **Validation and Sanitization**

```typescript
app.post('/api/users', ctx => {
  // Validate request body
  const validation = ctx.req.validate({
    name: {
      required: true,
      minLength: 2,
      maxLength: 50,
      message: 'Name must be 2-50 characters',
    },
    email: {
      required: true,
      type: 'email',
      message: 'Valid email required',
    },
    age: {
      type: 'number',
      min: 18,
      max: 120,
    },
  });

  if (!validation.isValid) {
    ctx.res.status(400).json({ errors: validation.errors });
    return;
  }

  // Sanitize input
  const sanitized = ctx.req.sanitize(ctx.body, {
    trim: true,
    lowercase: true,
    removeHtml: true,
    escape: true,
  });

  ctx.res.json({ success: true, data: sanitized });
});
```

### **Rate Limiting**

```typescript
app.get('/api/data', ctx => {
  const rateLimit = ctx.req.rateLimit();

  console.log(rateLimit.limit); // 100
  console.log(rateLimit.remaining); // 95
  console.log(rateLimit.reset); // 1640995200
  console.log(rateLimit.retryAfter); // 60
});
```

### **Request Timing**

```typescript
app.get('/api/slow', ctx => {
  const timing = ctx.req.timing();

  console.log(timing.start); // 1640995200000
  console.log(timing.duration); // 150
  console.log(timing.timestamp); // '2022-01-01T12:00:00.000Z'
});
```

## 🎯 **Response Enhancement**

### **Template Rendering**

```typescript
app.get('/profile', ctx => {
  const user = ctx.state.user;

  ctx.res.render('profile.html', {
    user,
    title: 'User Profile',
    isAdmin: user.role === 'admin',
  });
});
```

### **Content Type Detection**

```typescript
app.get('/files/:filename', ctx => {
  const filename = ctx.params.filename;
  const contentType = ctx.res.getContentTypeFromExtension(filename);

  // contentType will be 'image/jpeg' for 'photo.jpg'
  ctx.res.set('Content-Type', contentType);
});
```

### **CSV Conversion**

```typescript
app.get('/export/users', ctx => {
  const users = await getUsers();

  const csv = ctx.res.convertToCSV(users);
  ctx.res.csv(users, 'users.csv');
});
```

## 🎯 **TypeScript Support**

### **Type Definitions**

```typescript
import {
  type Context,
  type NextRushRequest,
  type NextRushResponse,
} from 'nextrush-v2';

// Type-safe route handler
app.get('/users/:id', (ctx: Context) => {
  const userId: string = ctx.params.id;
  const user: NextRushRequest = ctx.req;
  const response: NextRushResponse = ctx.res;

  ctx.res.json({ userId });
});

// Type-safe middleware
app.use(async (ctx: Context, next: () => Promise<void>) => {
  // Type-safe context usage
  await next();
});
```

### **Generic Types**

```typescript
// Type-safe body parsing
interface UserBody {
  name: string;
  email: string;
  age?: number;
}

app.post('/users', (ctx: Context) => {
  const body = ctx.body as UserBody;

  // TypeScript knows the structure
  const { name, email, age } = body;

  ctx.res.json({ success: true, user: { name, email, age } });
});
```

## 📚 **Complete Example**

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp();

// Middleware to enhance context
app.use(async (ctx, next) => {
  // Log request
  console.log(`${ctx.method} ${ctx.path} - ${ctx.ip}`);

  // Set request timing
  ctx.state.startTime = Date.now();

  await next();

  // Log response time
  const duration = Date.now() - ctx.state.startTime;
  console.log(`Response time: ${duration}ms`);
});

// Route with full context usage
app.post('/api/users', async ctx => {
  try {
    // Validate input
    const validation = ctx.req.validate({
      name: { required: true, minLength: 2 },
      email: { required: true, type: 'email' },
    });

    if (!validation.isValid) {
      ctx.res.status(400).json({ errors: validation.errors });
      return;
    }

    // Sanitize input
    const sanitized = ctx.req.sanitize(ctx.body, {
      trim: true,
      removeHtml: true,
    });

    // Check rate limiting
    const rateLimit = ctx.req.rateLimit();
    if (rateLimit.remaining <= 0) {
      ctx.res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: rateLimit.retryAfter,
      });
      return;
    }

    // Process request
    const user = await createUser(sanitized);

    // Set cookies
    ctx.res.cookie('userId', user.id, {
      httpOnly: true,
      secure: ctx.secure,
    });

    // Success response
    ctx.res.success(user, 'User created successfully');
  } catch (error) {
    ctx.res.error('Failed to create user', 500, { error: error.message });
  }
});

app.listen(3000);
```

## 🔗 **Related Documentation**

- [Application API](./application.md) - Main application class
- [Middleware](./middleware.md) - Middleware system
- [Routing](./routing.md) - Route handling
- [Request Enhancement](./request-enhancement.md) - Detailed request features
- [Response Enhancement](./response-enhancement.md) - Detailed response features
