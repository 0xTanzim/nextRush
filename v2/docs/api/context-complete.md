# 🔄 Context System - Complete API Reference

> **Koa-style Context with Express-like Design + Convenience Methods for Better DX**

The Context system in NextRush v2 provides a unified object that combines request and response data with enhanced functionality, similar to Koa but with Express-like design patterns and convenience methods for better developer experience.

## 📋 **Table of Contents**

- [Overview](#overview)
- [Context Object](#context-object)
- [Convenience Methods (New!)](#convenience-methods-new)
- [Request Properties](#request-properties)
- [Response Methods (41 Total)](#response-methods-41-total)
- [Context Methods](#context-methods)
- [TypeScript Support](#typescript-support)
- [Migration Guide](#migration-guide)
- [Best Practices](#best-practices)

## 🎯 **Overview**

The Context object provides:

- **🚀 Convenience Methods**: `ctx.json()`, `ctx.send()`, `ctx.redirect()` for 99% use cases
- **Unified Interface**: Single object containing both request and response
- **Express-like Properties**: Familiar `req.body`, `req.params`, `res.json()`
- **Enhanced Methods**: Built-in validation, sanitization, and utilities
- **Type Safety**: Full TypeScript support with zero `any` types
- **Performance**: Optimized for high-throughput applications
- **100% Backward Compatible**: All existing `ctx.res.*` methods still work

## 🔧 **Context Object**

### **Basic Structure**

```typescript
interface Context {
  // Request properties
  req: NextRushRequest;
  body: unknown; // Request body (alias for req.body)
  method: string; // HTTP method
  url: string; // Full URL
  path: string; // Path without query
  headers: IncomingMessage['headers']; // Request headers
  query: ParsedUrlQuery; // Query parameters
  params: Record<string, string>; // Route parameters

  // Response properties
  res: NextRushResponse; // Enhanced response object
  status: number; // Response status code
  responseHeaders: Record<string, string | number | string[]>;

  // Context metadata
  id: string | undefined; // Request ID for tracing
  state: Record<string, unknown>; // Middleware communication
  startTime: number; // Request start timestamp
  ip: string; // Client IP address
  secure: boolean; // Is HTTPS?
  protocol: string; // 'http' or 'https'
  hostname: string; // Request hostname
  host: string; // Host header
  origin: string; // Request origin
  href: string; // Full URL
  search: string; // Query string
  searchParams: URLSearchParams; // Parsed query params

  // 🚀 NEW: Convenience Methods (Better DX)
  json(data: unknown): void; // Send JSON (99% usage!)
  send(data: string | Buffer | object): void; // Send response
  redirect(url: string, status?: number): void; // Redirect
  cookie(
    name: string,
    value: string,
    options?: CookieOptions
  ): NextRushResponse;

  // Context methods
  throw(status: number, message?: string): never;
  assert(
    condition: unknown,
    status: number,
    message?: string
  ): asserts condition;
  fresh(): boolean;
  stale(): boolean;
  idempotent(): boolean;
  cacheable(): boolean;
  set(name: string, value: string | number | string[]): void;
  sendFile(path: string, options?: { root?: string; etag?: boolean }): void;
  render(templateOrName: string, data?: Record<string, unknown>): Promise<void>;
}
```

## 🚀 **Convenience Methods (New!)**

### **Why Convenience Methods?**

```typescript
// ❌ OLD WAY (verbose - still works!)
app.get('/users', ctx => {
  ctx.res.json({ users: [] });
  ctx.res.status(201);
  ctx.res.redirect('/login');
  ctx.res.cookie('sessionId', '123');
});

// ✅ NEW WAY (concise - better DX!)
app.get('/users', ctx => {
  ctx.json({ users: [] }); // 99% of API endpoints use JSON!
  ctx.status = 201; // Direct property access
  ctx.redirect('/login'); // Clean & simple
  ctx.cookie('sessionId', '123'); // Convenient
});
```

### **ctx.json(data: unknown): void**

**Most Used Method - 99% of APIs**

Send JSON response with proper content-type and serialization.

```typescript
app.get('/api/users', ctx => {
  const users = await userService.getUsers();
  ctx.json({ users, total: users.length }); // ✅ Clean & simple!
});

// Equivalent to:
// ctx.res.json({ users, total: users.length });
```

### **ctx.send(data: string | Buffer | object): void**

**Smart Response Sending**

Send any type of response with smart content-type detection.

```typescript
app.get('/api/message', ctx => {
  ctx.send('Hello World'); // Text response
  // ctx.send({ hello: 'world' }); // JSON response
  // ctx.send(buffer);             // Buffer response
});
```

### **ctx.redirect(url: string, status?: number): void**

**Clean Redirects**

Redirect requests with optional status code.

```typescript
app.post('/login', ctx => {
  if (!ctx.body.token) {
    ctx.redirect('/auth'); // 302 redirect (default)
    return;
  }
  ctx.redirect('/dashboard', 301); // 301 redirect
});
```

### **ctx.cookie(name: string, value: string, options?: CookieOptions): NextRushResponse**

**Easy Cookie Management**

Set cookies with chaining support.

```typescript
app.post('/login', ctx => {
  ctx
    .cookie('sessionId', 'abc123', {
      httpOnly: true,
      secure: true,
      maxAge: 3600000, // 1 hour
    })
    .json({ success: true });
});
```

## 📥 **Request Properties**

### **Basic Request Data**

```typescript
app.get('/api/users/:id', ctx => {
  // HTTP method
  console.log(ctx.method); // 'GET'

  // URL and path
  console.log(ctx.url); // '/api/users/123?page=1&limit=10'
  console.log(ctx.path); // '/api/users/123'

  // Headers
  const auth = ctx.headers.authorization;
  const userAgent = ctx.headers['user-agent'];

  // Route parameters
  const userId = ctx.params.id; // '123'

  // Query parameters
  const page = ctx.query.page; // '1'
  const limit = ctx.query.limit; // '10'

  // Request body (for POST/PUT requests)
  const { name, email } = ctx.body as { name: string; email: string };

  ctx.json({ userId, page, limit, name, email });
});
```

### **Enhanced Request Properties**

```typescript
app.get('/api/info', ctx => {
  // Client information
  console.log(ctx.ip); // '192.168.1.1'
  console.log(ctx.secure); // true (if HTTPS)
  console.log(ctx.protocol); // 'https'
  console.log(ctx.hostname); // 'api.example.com'
  console.log(ctx.host); // 'api.example.com:443'
  console.log(ctx.origin); // 'https://api.example.com'
  console.log(ctx.href); // Full URL

  // Request timing
  console.log(ctx.startTime); // 1625097600000
  console.log(Date.now() - ctx.startTime); // Request duration

  // Request ID for tracing/logging
  console.log(ctx.id); // 'ctx-1625097600000-abc123'

  ctx.json({
    clientInfo: { ip: ctx.ip, secure: ctx.secure },
    timing: { start: ctx.startTime, duration: Date.now() - ctx.startTime },
    requestId: ctx.id,
  });
});
```

## 📤 **Response Methods (41 Total)**

NextRush v2 provides 41 comprehensive response methods. You can access them via `ctx.res.*` or use convenience methods.

### **🔥 Most Popular Methods**

#### **JSON Responses (99% Usage)**

```typescript
// ✅ Convenience method (recommended)
ctx.json({ users: [], total: 0 });

// Also available:
ctx.res.json({ users: [], total: 0 });
```

#### **HTML Responses**

```typescript
ctx.res.html('<h1>Hello World</h1>');
ctx.res.text('Plain text response');
ctx.res.xml('<?xml version="1.0"?><root></root>');
ctx.res.csv('name,age\nJohn,30');
```

#### **Smart Send (Auto Content-Type)**

```typescript
// ✅ Convenience method
ctx.send({ data: 'object' }); // → JSON
ctx.send('Hello'); // → Text
ctx.send(buffer); // → Binary

// Also available:
ctx.res.send(data);
```

### **File Operations**

```typescript
// Send files
ctx.res.sendFile('/path/to/file.pdf');
ctx.res.file('/path/to/file.pdf'); // Alias with chaining
ctx.res.download('/path/file.pdf', 'document.pdf');

// Template rendering
await ctx.res.render('template.html', { name: 'John' });
```

### **Redirects**

```typescript
// ✅ Convenience method
ctx.redirect('/login'); // 302 redirect
ctx.redirect('/moved', 301); // 301 redirect

// Also available:
ctx.res.redirect('/login');
ctx.res.redirectPermanent('/moved'); // 301
ctx.res.redirectTemporary('/temp'); // 307
```

### **Headers Management**

```typescript
// Status codes
ctx.status = 201; // Direct property
ctx.res.status(201); // Method chaining

// Headers
ctx.set('X-Custom-Header', 'value'); // Koa-style
ctx.res.set('X-Custom-Header', 'value');
ctx.res.header('X-Custom', 'value');
ctx.res.type('application/json');
ctx.res.length(1024);
ctx.res.etag('"abc123"');
ctx.res.lastModified(new Date());

// Remove headers
ctx.res.remove('X-Old-Header');
ctx.res.removeHeader('X-Old-Header');

// Get headers
const contentType = ctx.res.get('content-type');
```

### **Cookies Management**

```typescript
// ✅ Convenience method
ctx.cookie('sessionId', 'abc123', {
  httpOnly: true,
  secure: true,
  maxAge: 3600000,
});

// Also available:
ctx.res.cookie('sessionId', 'abc123', options);
ctx.res.clearCookie('sessionId');
```

### **Caching & Performance**

```typescript
// Cache control
ctx.res.cache(3600); // Cache for 1 hour
ctx.res.noCache(); // Disable caching

// Compression
ctx.res.compress(); // Enable compression hint

// Performance timing
ctx.res.time('database-query');
```

### **Security & CORS**

```typescript
// CORS headers
ctx.res.cors('https://example.com');
ctx.res.cors('*'); // Allow all origins

// Security headers
ctx.res.security(); // Adds XSS protection, frame options, etc.
```

### **API Response Helpers**

```typescript
// Structured API responses
ctx.res.success({ users: [] }, 'Users retrieved successfully');
ctx.res.error('User not found', 404);
ctx.res.paginate(users, page, limit, total);
```

### **Utilities**

```typescript
// Content type utilities
const mimeType = ctx.res.getContentTypeFromExtension('.json');
const smartType = ctx.res.getSmartContentType('/path/file.json');

// Data conversion
const csv = ctx.res.convertToCSV([{ name: 'John', age: 30 }]);
const etag = ctx.res.generateETag(fileStats);

// Utility helpers
const value = ctx.res.getNestedValue(obj, 'user.profile.name');
const isTruthy = ctx.res.isTruthy(someValue);
```

## 🔧 **Context Methods**

### **Error Handling**

```typescript
app.get('/users/:id', ctx => {
  const userId = ctx.params.id;

  // Throw HTTP errors
  if (!userId) {
    ctx.throw(400, 'User ID is required');
  }

  // Assert conditions
  ctx.assert(userId.length > 0, 400, 'Invalid user ID');

  ctx.json({ userId });
});
```

### **Conditional Logic**

```typescript
app.get('/api/data', ctx => {
  // Check request freshness
  if (ctx.fresh()) {
    ctx.status = 304; // Not Modified
    return;
  }

  // Check if stale
  if (ctx.stale()) {
    // Refresh data
  }

  // Check if idempotent
  if (ctx.idempotent()) {
    // Safe to retry
  }

  // Check if cacheable
  if (ctx.cacheable()) {
    ctx.res.cache(3600);
  }

  ctx.json({ data: 'fresh data' });
});
```

## 🦾 **TypeScript Support**

NextRush v2 provides complete TypeScript support with zero `any` types.

### **Full IntelliSense**

```typescript
app.get('/api/users', ctx => {
  // ✅ Full TypeScript IntelliSense
  ctx.json({ users: [] }); // ✅ Knows return type
  ctx.params.id; // ✅ string
  ctx.query.page; // ✅ string | string[] | undefined
  ctx.body; // ✅ unknown (cast as needed)
  ctx.headers.authorization; // ✅ string | string[] | undefined

  // All 41 response methods have proper types
  ctx.res.status(201).json({ created: true }); // ✅ Method chaining
});
```

### **Type-Safe Body Parsing**

```typescript
interface CreateUserDto {
  name: string;
  email: string;
}

app.post('/users', ctx => {
  // Cast body with proper validation
  const userData = ctx.body as CreateUserDto;

  // Or use validation library
  const validatedData = validateSchema(CreateUserSchema, ctx.body);

  ctx.json({ user: validatedData });
});
```

## 🔄 **Migration Guide**

### **From Express.js**

```typescript
// Express.js
app.get('/users', (req, res) => {
  res.status(200).json({ users: [] });
});

// NextRush v2 (Express-like)
app.get('/users', ctx => {
  ctx.res.status(200).json({ users: [] });
});

// NextRush v2 (Convenience - Recommended!)
app.get('/users', ctx => {
  ctx.status = 200;
  ctx.json({ users: [] });
});
```

### **From Koa.js**

```typescript
// Koa.js
app.use(ctx => {
  ctx.body = { users: [] };
  ctx.status = 200;
});

// NextRush v2 (Similar)
app.get('/users', ctx => {
  ctx.json({ users: [] }); // More explicit than ctx.body
  ctx.status = 200;
});
```

## ✨ **Best Practices**

### **🚀 Use Convenience Methods**

```typescript
// ✅ RECOMMENDED: Use convenience methods for common operations
app.get('/api/users', ctx => {
  ctx.json({ users: [] }); // Instead of ctx.res.json()
  ctx.redirect('/login'); // Instead of ctx.res.redirect()
  ctx.cookie('id', '123'); // Instead of ctx.res.cookie()
});

// ✅ ALSO GOOD: Use ctx.res.* for advanced scenarios
app.get('/api/advanced', ctx => {
  ctx.res
    .status(201)
    .type('application/json')
    .cache(3600)
    .cors('*')
    .security()
    .json({ data: 'advanced response' });
});
```

### **🛡️ Error Handling**

```typescript
app.get('/users/:id', ctx => {
  try {
    ctx.assert(ctx.params.id, 400, 'User ID required');

    const user = await userService.findById(ctx.params.id);

    if (!user) {
      ctx.throw(404, 'User not found');
    }

    ctx.json({ user });
  } catch (error) {
    ctx.res.error(error.message, error.status || 500);
  }
});
```

### **⚡ Performance Optimization**

```typescript
app.get('/api/data', ctx => {
  // Check freshness first
  if (ctx.fresh()) {
    ctx.status = 304;
    return;
  }

  // Enable caching for cacheable requests
  if (ctx.cacheable()) {
    ctx.res.cache(3600);
  }

  // Use compression for large responses
  ctx.res.compress();

  ctx.json({ data: 'large data set' });
});
```

### **🔍 Request Tracing**

```typescript
app.use(async (ctx, next) => {
  const start = Date.now();
  console.log(`→ [${ctx.id}] ${ctx.method} ${ctx.path}`);

  await next();

  const duration = Date.now() - start;
  console.log(`← [${ctx.id}] ${ctx.status} ${duration}ms`);
});
```

### **🎯 API Response Structure**

```typescript
app.get('/api/users', ctx => {
  // ✅ Structured success responses
  ctx.res.success(users, 'Users retrieved successfully');

  // ✅ Consistent error responses
  ctx.res.error('Users not found', 404);

  // ✅ Paginated responses
  ctx.res.paginate(users, page, limit, total);
});
```

## 📊 **Summary**

### **What's New:**

- 🚀 **Convenience Methods**: `ctx.json()`, `ctx.send()`, `ctx.redirect()`, `ctx.cookie()`
- 📝 **41 Response Methods**: Complete Express.js compatibility + more
- 🦾 **Full TypeScript**: Zero `any` types, complete IntelliSense
- ⚡ **Better Performance**: Optimized context creation and method calls
- 🔄 **100% Backward Compatible**: All existing code continues to work

### **Developer Benefits:**

- **Faster Development**: Less typing with convenience methods
- **Better DX**: Cleaner, more intuitive API
- **Type Safety**: Full TypeScript support prevents bugs
- **Flexibility**: Use convenience methods OR full `ctx.res.*` methods
- **Learning Curve**: Easy migration from Express.js or Koa.js

---

**🎯 NextRush v2 Context System: Express.js familiarity + Koa.js elegance + Modern DX conveniences = 🚀 Better web framework experience!**
