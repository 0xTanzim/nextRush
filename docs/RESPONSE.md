# 🚀 NextRush Response API - Complete Guide

**Enterprise-grade response handling with zero dependencies and maximum performance**

## 📋 **Table of Contents**

| Section                                              | Description                              |
| ---------------------------------------------------- | ---------------------------------------- |
| [🎯 Overview](#-overview)                            | Introduction to NextRush Response object |
| [📊 Status Management](#-status-management)          | HTTP status codes and responses          |
| [📋 Header Management](#-header-management)          | Response headers and metadata            |
| [📤 Response Methods](#-response-methods)            | Core response sending methods            |
| [🎨 Template Rendering](#-template-rendering)        | Server-side rendering support            |
| [🍪 Cookie Management](#-cookie-management)          | Cookie setting and configuration         |
| [📁 File Serving](#-file-serving)                    | Static file delivery                     |
| [🔐 Security Headers](#-security-headers)            | Security-focused response features       |
| [📱 Content Negotiation](#-content-negotiation)      | Smart content type handling              |
| [⚡ Performance Features](#-performance-features)    | High-performance response utilities      |
| [🔍 Compression](#-compression)                      | Response compression support             |
| [📈 Monitoring & Debugging](#-monitoring--debugging) | Response tracking and debugging          |

## 🎯 **Overview**

The NextRush Response object extends Node.js's `ServerResponse` with powerful Express-style methods, comprehensive template rendering, security features, and enterprise-grade capabilities.

```typescript
import { NextRushResponse } from 'nextrush';

app.get('/api/user/:id', (req, res: NextRushResponse) => {
  // ✅ Full TypeScript support with autocomplete
  res
    .status(200)
    .set('X-API-Version', '1.0')
    .json({
      user: { id: req.param('id'), name: 'John Doe' },
      timestamp: new Date().toISOString(),
    });
});
```

## 📊 **Status Management**

### 🎯 **Status Code Methods**

| Method                 | Return Type | Description                 | Example                    |
| ---------------------- | ----------- | --------------------------- | -------------------------- |
| `res.status(code)`     | `this`      | Set status code (chainable) | `res.status(201).json({})` |
| `res.sendStatus(code)` | `void`      | Set status and send message | `res.sendStatus(404)`      |

### 📋 **Common Status Patterns**

```typescript
// ✅ Success responses
res.status(200).json({ data: users }); // OK
res.status(201).json({ created: newUser }); // Created
res.status(204).end(); // No Content

// ⚠️ Client errors
res.status(400).json({ error: 'Bad request' }); // Bad Request
res.status(401).json({ error: 'Unauthorized' }); // Unauthorized
res.status(403).json({ error: 'Forbidden' }); // Forbidden
res.status(404).json({ error: 'Not found' }); // Not Found
res.status(409).json({ error: 'Conflict' }); // Conflict

// 🚨 Server errors
res.status(500).json({ error: 'Internal error' }); // Internal Server Error
res.status(502).json({ error: 'Bad gateway' }); // Bad Gateway
res.status(503).json({ error: 'Service unavailable' }); // Service Unavailable

// 🚀 Advanced status handling
res
  .status(206) // Partial Content
  .set('Content-Range', 'bytes 200-1023/1024')
  .send(partialData);
```

## 📋 **Header Management**

### 📤 **Header Methods**

| Method                    | Return Type           | Description                   | Example                                   |
| ------------------------- | --------------------- | ----------------------------- | ----------------------------------------- |
| `res.set(name, value)`    | `this`                | Set single header (chainable) | `res.set('Content-Type', 'json')`         |
| `res.set(headers)`        | `this`                | Set multiple headers          | `res.set({ 'X-API': '1.0' })`             |
| `res.header(name, value)` | `this`                | Alias for set()               | `res.header('Cache-Control', 'no-cache')` |
| `res.get(name)`           | `string \| undefined` | Get header value              | `res.get('content-type')`                 |
| `res.removeHeader(name)`  | `this`                | Remove header                 | `res.removeHeader('x-powered-by')`        |
| `res.append(name, value)` | `this`                | Append to header              | `res.append('Set-Cookie', 'id=123')`      |

### 🎯 **Header Examples**

```typescript
// 📋 Single header
res.set('Content-Type', 'application/json');
res.header('Cache-Control', 'max-age=3600');

// 📦 Multiple headers (efficient)
res.set({
  'Content-Type': 'application/json',
  'Cache-Control': 'max-age=3600',
  'X-API-Version': '2.0',
  'X-Request-ID': req.id,
});

// 🔍 Get header values
const contentType = res.get('content-type');
const apiVersion = res.get('x-api-version');

// 🗑️ Remove headers
res.removeHeader('x-powered-by'); // Remove single
res.removeHeader('server'); // Security

// 📎 Append to existing headers
res.append('Set-Cookie', 'sessionId=abc123; HttpOnly');
res.append('Set-Cookie', 'theme=dark; Path=/');

// ⛓️ Method chaining
res
  .status(200)
  .set('Content-Type', 'application/json')
  .set('Cache-Control', 'no-cache')
  .json({ success: true });
```

## 📤 **Response Methods**

### 🎯 **Core Response Methods**

| Method             | Description                       | Example                        |
| ------------------ | --------------------------------- | ------------------------------ |
| `res.send(data)`   | Send response (auto-detects type) | `res.send('Hello')`            |
| `res.json(object)` | Send JSON response                | `res.json({ user: 'John' })`   |
| `res.text(string)` | Send plain text                   | `res.text('Hello World')`      |
| `res.html(html)`   | Send HTML response                | `res.html('<h1>Hello</h1>')`   |
| `res.xml(xml)`     | Send XML response                 | `res.xml('<user>John</user>')` |
| `res.end()`        | End response                      | `res.status(204).end()`        |

### 📋 **Advanced Response Methods**

```typescript
// 📄 JSON responses with auto-formatting
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
    <head><title>NextRush App</title></head>
    <body><h1>Welcome!</h1></body>
  </html>
`);

// 📊 XML responses
res.xml(`
  <?xml version="1.0" encoding="UTF-8"?>
  <response>
    <status>success</status>
    <data>Hello World</data>
  </response>
`);

// 📦 Smart send() method - auto-detects type
res.send({ object: 'becomes JSON' }); // → JSON
res.send('<h1>HTML</h1>'); // → HTML
res.send('Plain text'); // → Text
res.send(Buffer.from('binary')); // → Binary

// 🚀 Streaming responses
res.set('Content-Type', 'application/octet-stream');
fs.createReadStream('large-file.zip').pipe(res);
```

## 🎨 **Template Rendering**

NextRush includes the **Ultimate Template Engine** - zero dependencies, maximum flexibility! 🎨

### 🖼️ **Template Methods**

| Method                             | Description               | Example                                             |
| ---------------------------------- | ------------------------- | --------------------------------------------------- |
| `res.render(template, data)`       | Render template with data | `res.render('user.html', { user })`                 |
| `res.renderString(template, data)` | Render template string    | `res.renderString('<h1>{{title}}</h1>', { title })` |

### 🎯 **Template Examples**

```typescript
// 🎨 Render template files
res.render('profile.html', {
  user: { name: 'John Doe', email: 'john@example.com' },
  title: 'User Profile',
  isAdmin: true,
});

// 📝 Render template strings
res.renderString(
  `
  <div class="user-card">
    <h2>Welcome, {{user.name}}!</h2>
    <p>Email: {{user.email}}</p>
    {{#if isAdmin}}
      <span class="badge">Admin</span>
    {{/if}}
  </div>
`,
  {
    user: { name: 'Jane', email: 'jane@example.com' },
    isAdmin: false,
  }
);

// 🎪 Advanced template features
res.render('dashboard.html', {
  users: [
    { name: 'John', role: 'admin' },
    { name: 'Jane', role: 'user' },
  ],
  stats: {
    totalUsers: 150,
    activeUsers: 89,
    growth: '+12%',
  },
  // Template helpers
  formatDate: (date) => new Date(date).toLocaleDateString(),
  capitalize: (str) => str.charAt(0).toUpperCase() + str.slice(1),
});

// 🚀 Template with layouts
res.render('page.html', {
  layout: 'layout.html',
  title: 'My Page',
  content: 'Page content here',
});
```

## 🍪 **Cookie Management**

### 🍪 **Cookie Methods**

| Method                             | Description  | Example                        |
| ---------------------------------- | ------------ | ------------------------------ |
| `res.cookie(name, value, options)` | Set cookie   | `res.cookie('theme', 'dark')`  |
| `res.clearCookie(name, options)`   | Clear cookie | `res.clearCookie('sessionId')` |

### 🎯 **Cookie Examples**

```typescript
// 🍪 Basic cookies
res.cookie('username', 'john_doe');
res.cookie('theme', 'dark');

// 🔐 Secure cookies with options
res.cookie('sessionId', 'abc123', {
  httpOnly: true, // Prevent XSS
  secure: true, // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/', // Available site-wide
  domain: '.yourdomain.com', // Subdomain sharing
});

// 🎯 Authentication cookies
res.cookie('authToken', jwt.sign({ userId: 123 }), {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});

// 🗑️ Clear cookies
res.clearCookie('sessionId');
res.clearCookie('authToken', {
  httpOnly: true,
  secure: true,
});

// ⛓️ Chaining with responses
res
  .cookie('lastVisit', new Date().toISOString())
  .json({ message: 'Welcome back!' });
```

## 📁 **File Serving**

### 📂 **File Methods**

| Method                         | Description            | Example                                                   |
| ------------------------------ | ---------------------- | --------------------------------------------------------- |
| `res.sendFile(path, options)`  | Send file with headers | `res.sendFile('/path/to/file.pdf')`                       |
| `res.download(path, filename)` | Force download         | `res.download('/files/report.pdf', 'monthly-report.pdf')` |
| `res.attachment(filename)`     | Set download headers   | `res.attachment('document.pdf')`                          |

### 🎯 **File Serving Examples**

```typescript
// 📄 Send files with proper headers
res.sendFile('/uploads/avatar.jpg', {
  headers: {
    'Cache-Control': 'public, max-age=86400',
    'Content-Type': 'image/jpeg',
  },
});

// 💾 Force file downloads
res.download('/reports/monthly.pdf', 'Monthly-Report-2024.pdf');

// 📎 Set attachment headers
res.attachment('backup.zip').sendFile('/backups/latest.zip');

// 🚀 Streaming large files
const fileStream = fs.createReadStream('/large-files/video.mp4');
res.set({
  'Content-Type': 'video/mp4',
  'Content-Disposition': 'inline; filename="video.mp4"',
  'Cache-Control': 'public, max-age=3600',
});
fileStream.pipe(res);

// 📊 File serving with range support (video/audio streaming)
app.get('/stream/:file', (req, res) => {
  const range = req.headers.range;
  const filePath = `/media/${req.params.file}`;
  const stat = fs.statSync(filePath);

  if (range) {
    // Handle partial content
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

    res.status(206).set({
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': 'video/mp4',
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.sendFile(filePath);
  }
});
```

## 🔐 **Security Headers**

### 🛡️ **Security Methods**

```typescript
// 🔐 Essential security headers
res.set({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'",
});

// 🚀 Security helper methods
res.security({
  xss: true, // X-XSS-Protection
  nosniff: true, // X-Content-Type-Options
  frameguard: 'deny', // X-Frame-Options
  hsts: {
    // Strict-Transport-Security
    maxAge: 31536000,
    includeSubDomains: true,
  },
});

// 🔒 CORS headers
res.cors({
  origin: 'https://yourdomain.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  headers: ['Content-Type', 'Authorization'],
});
```

## 📱 **Content Negotiation**

### 🎯 **Content Type Detection**

```typescript
// 📱 Smart content negotiation
app.get('/api/data', (req, res) => {
  const data = { users: ['John', 'Jane'] };

  const format = req.accepts(['json', 'xml', 'html']);

  switch (format) {
    case 'json':
      res.json(data);
      break;
    case 'xml':
      res.xml(
        `<users>${data.users.map((u) => `<user>${u}</user>`).join('')}</users>`
      );
      break;
    case 'html':
      res.html(`<ul>${data.users.map((u) => `<li>${u}</li>`).join('')}</ul>`);
      break;
    default:
      res.status(406).json({ error: 'Not Acceptable' });
  }
});

// 📄 Conditional responses based on Accept header
if (req.accepts('application/json')) {
  res.json({ data: results });
} else if (req.accepts('text/html')) {
  res.render('results.html', { results });
} else {
  res.status(406).json({ error: 'Format not supported' });
}
```

## ⚡ **Performance Features**

### 🚀 **Performance Methods**

```typescript
// ⚡ Response timing
const startTime = Date.now();

res.on('finish', () => {
  const duration = Date.now() - startTime;
  res.set('X-Response-Time', `${duration}ms`);
});

// 📊 Content length optimization
res.set('Content-Length', Buffer.byteLength(responseData));

// 🗜️ Compression hints
res.set('Vary', 'Accept-Encoding');

// 🎯 ETag support for caching
const etag = generateETag(responseData);
res.set('ETag', etag);

if (req.headers['if-none-match'] === etag) {
  res.sendStatus(304); // Not Modified
} else {
  res.json(responseData);
}

// 🚀 Efficient JSON streaming for large datasets
app.get('/api/large-dataset', (req, res) => {
  res.set('Content-Type', 'application/json');
  res.write('[');

  let first = true;
  largeDataStream.on('data', (chunk) => {
    if (!first) res.write(',');
    res.write(JSON.stringify(chunk));
    first = false;
  });

  largeDataStream.on('end', () => {
    res.write(']');
    res.end();
  });
});
```

## 🔍 **Compression**

### 🗜️ **Compression Support**

```typescript
// 🗜️ Manual compression control
res.set('Content-Encoding', 'gzip');
res.set('Vary', 'Accept-Encoding');

// 📦 Compression for specific routes
app.get('/api/large-data', (req, res) => {
  const data = getLargeDataset();

  if (req.accepts('gzip')) {
    // Compress large responses
    res.set('Content-Encoding', 'gzip');
    const compressed = zlib.gzipSync(JSON.stringify(data));
    res.send(compressed);
  } else {
    res.json(data);
  }
});

// 🎯 Smart compression based on size
const responseSize = Buffer.byteLength(JSON.stringify(data));
if (responseSize > 1024) {
  // Compress responses > 1KB
  res.set('Content-Encoding', 'gzip');
}
```

## 📈 **Monitoring & Debugging**

### 🔍 **Response Tracking**

```typescript
// 📊 Response monitoring
app.use((req, res, next) => {
  const start = Date.now();

  // Track response
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`📤 Response ${req.id}:`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length'),
      contentType: res.get('content-type'),
    });
  });

  next();
});

// 🎯 Response debugging
res.debug = function (message, data = {}) {
  console.log(`🔍 Response Debug [${req.id}]:`, message, data);
  return this;
};

// Usage
res
  .debug('Setting authentication cookie', { userId: 123 })
  .cookie('authToken', token)
  .json({ success: true });

// 📈 Performance monitoring
res.on('pipe', () => {
  console.log('📡 Starting response stream');
});

res.on('finish', () => {
  console.log('✅ Response completed');
});
```

## 🎯 **Best Practices**

### ✅ **Recommended Patterns**

| Practice              | ✅ Good                                        | ❌ Avoid                                |
| --------------------- | ---------------------------------------------- | --------------------------------------- |
| **Status Setting**    | `res.status(201).json({})`                     | `res.statusCode = 201; res.json({})`    |
| **Header Management** | `res.set('Content-Type', 'json')`              | `res.setHeader('content-type', 'json')` |
| **Method Chaining**   | `res.status(200).set('X-API', '1.0').json({})` | Multiple separate calls                 |
| **Security Headers**  | Always set security headers                    | Rely on defaults                        |
| **Error Responses**   | Consistent error format                        | Inconsistent error handling             |
| **Content Type**      | `res.json({})` for objects                     | `res.send({})` for objects              |

### 🚀 **Performance Tips**

```typescript
// ⚡ Efficient response patterns
app.get('/api/users', (req, res) => {
  // 1. Set headers early
  res.set({
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
    'X-API-Version': '1.0',
  });

  // 2. Stream large responses
  if (req.query.export === 'true') {
    return streamLargeDataset(res);
  }

  // 3. Use efficient JSON responses
  res.json({
    data: users,
    meta: { total: users.length },
  });
});

// 🎯 Conditional responses
app.get('/api/data', (req, res) => {
  // Check cache first
  const etag = generateETag(data);
  res.set('ETag', etag);

  if (req.headers['if-none-match'] === etag) {
    return res.sendStatus(304); // Not Modified
  }

  res.json(data);
});
```

## 🎉 **Summary**

The NextRush Response object provides:

- ✅ **Express-compatible API** with enhanced features
- ✅ **Professional template rendering** with Ultimate Template Engine
- ✅ **Security-first design** with built-in protection
- ✅ **Performance optimization** with smart caching and compression
- ✅ **File serving capabilities** with streaming support
- ✅ **TypeScript support** with full autocomplete
- ✅ **Zero dependencies** for maximum reliability

**Ready to deliver amazing web responses with professional-grade features!** 🚀

## 📤 **Response Methods**

### Basic Response Types

```typescript
// JSON response (auto sets content-type)
res.json({ message: 'Success', data: userData });

// HTML response
res.html('<h1>Welcome to NextRush</h1>');

// Plain text response
res.text('Hello, World!');

// XML response
res.xml('<?xml version="1.0"?><root><message>Hello</message></root>');

// Auto-detect response type
res.send('Plain text'); // → text/html
res.send({ key: 'value' }); // → application/json
res.send(Buffer.from('data')); // → binary data
```

### Advanced Response Types

```typescript
// CSV response with automatic formatting
const data = [
  { name: 'John', age: 30, city: 'New York' },
  { name: 'Jane', age: 25, city: 'San Francisco' },
];
res.csv(data, 'users.csv');

// Streaming response for large data
const fileStream = fs.createReadStream('large-video.mp4');
res.stream(fileStream, 'video/mp4', {
  bufferSize: 64 * 1024, // 64KB buffer
  highWaterMark: 128 * 1024, // 128KB high water mark
  enableCompression: true, // Enable compression
});
```

## 📁 **File Operations**

### File Serving

```typescript
// Serve static file (auto content-type detection)
await res.sendFile('/path/to/file.pdf');

// Advanced file serving with options
await res.sendFile('/path/to/document.pdf', {
  maxAge: 3600 * 1000, // Cache for 1 hour
  lastModified: true, // Send Last-Modified header
  etag: true, // Generate ETag
  dotfiles: 'deny', // Block dotfiles
  root: '/safe/directory', // Restrict to safe directory
  headers: {
    // Custom headers
    'X-Download-Source': 'NextRush',
  },
  acceptRanges: true, // Enable range requests
});
```

### File Downloads

```typescript
// Simple download (auto-detects filename)
await res.download('/path/to/report.pdf');

// Download with custom filename
await res.download('/path/to/file.pdf', 'Monthly-Report.pdf');

// Download with options
await res.download('/path/to/file.xlsx', 'report.xlsx', {
  maxAge: 0, // No caching
  dotfiles: 'deny', // Security
  headers: {
    'X-Download-Type': 'report',
  },
});
```

### Smart File Operations (Internal Methods)

```typescript
// Get appropriate content type for file
const contentType = res.getSmartContentType('/path/to/file.json');
// Returns: 'application/json'

// Generate ETag for file
const etag = res.generateETag(fileStats);
// Returns: 'W/"1234-567890abcdef"'
```

## 🔄 **Redirects**

### Redirect Methods

```typescript
// Temporary redirect (302)
res.redirect('/new-location');
res.redirectTemporary('/temp-page');

// Permanent redirect (301)
res.redirectPermanent('/permanent-new-location');

// Custom status redirect
res.redirect('/somewhere', 307); // Temporary redirect preserving method
```

## 🍪 **Cookie Management**

### Setting Cookies

```typescript
// Simple cookie
res.cookie('sessionId', 'abc123');

// Cookie with options
res.cookie('preferences', JSON.stringify(userPrefs), {
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  httpOnly: true, // Not accessible via JavaScript
  secure: true, // HTTPS only
  sameSite: 'strict', // CSRF protection
  domain: '.example.com', // Domain scope
  path: '/admin', // Path scope
});

// Clear cookie
res.clearCookie('sessionId');
res.clearCookie('preferences', { path: '/admin' });
```

## 🎨 **Template Rendering**

### Template Rendering

```typescript
// Render template with data
await res.render('user-profile.html', {
  user: { name: 'John', email: 'john@example.com' },
  title: 'User Profile',
});

// Use path aliases
await res.render('@views/dashboard.mustache', dashboardData);

// Specify engine
await res.render('api-response.json', data, { engine: 'json' });
```

### Template Helper Methods

```typescript
// Get nested object value
const value = res.getNestedValue(user, 'profile.preferences.theme');

// Check if value is truthy (for templates)
const hasItems = res.isTruthy(user.items); // Considers empty arrays as falsy
```

## ⚡ **Performance & Caching**

### Cache Control

```typescript
// Set cache duration
res.cache(3600); // Cache for 1 hour
res.cache(86400); // Cache for 1 day

// Disable caching
res.noCache();

// Chainable
res.cache(3600).json({ data: 'cached response' });
```

### Performance Timing

```typescript
// Start performance timer
res.time('database-query');
// ... perform database query
res.time('database-query'); // Automatically logs duration

// Custom timing label
res.time('custom-operation').json({ result: data });
```

### Compression

```typescript
// Hint that response should be compressed
res.compress().json(largeDataset);
```

## 🔒 **Security & CORS**

### CORS Support

```typescript
// Enable CORS for all origins
res.cors();

// CORS for specific origin
res.cors('https://trusted-domain.com');

// Chainable
res.cors().json({ api: 'response' });
```

### Security Headers

```typescript
// Apply security headers
res.security().json({ data: 'secure response' });

// Manually sets:
// X-Content-Type-Options: nosniff
// X-Frame-Options: DENY
// X-XSS-Protection: 1; mode=block
// Strict-Transport-Security: max-age=31536000
```

## 📊 **API Response Helpers**

### Structured API Responses

```typescript
// Success response
res.success(userData, 'User retrieved successfully');
// Output: { success: true, message: '...', data: userData }

// Error response
res.error('User not found', 404, { userId: 123 });
// Output: { success: false, error: '...', code: 404, details: {...} }

// Paginated response
res.paginate(users, 2, 10, 150);
// Output: {
//   data: users,
//   pagination: {
//     page: 2, limit: 10, total: 150,
//     pages: 15, hasNext: true, hasPrev: true
//   }
// }
```

## 🎯 **Advanced Features**

### Response Chaining

```typescript
// Most methods are chainable
res
  .status(201)
  .set('Location', '/users/123')
  .cache(3600)
  .cors()
  .security()
  .json({ id: 123, name: 'John' });
```

### Conditional Responses

```typescript
// Send different responses based on Accept header
if (req.accepts('json')) {
  res.json({ data: 'JSON response' });
} else if (req.accepts('html')) {
  res.html('<h1>HTML response</h1>');
} else {
  res.text('Plain text response');
}
```

## 📁 **Complete File Operations Example**

```typescript
app.get('/download/:type/:filename', async (req, res) => {
  const { type, filename } = req.params;

  try {
    switch (type) {
      case 'report':
        // Generate and serve PDF report
        await res.sendFile(`/reports/${filename}`, {
          maxAge: 3600 * 1000, // 1 hour cache
          etag: true, // Enable ETag
          acceptRanges: true, // Enable range requests
        });
        break;

      case 'download':
        // Force download with custom name
        await res.download(`/files/${filename}`, `download-${Date.now()}.pdf`);
        break;

      case 'stream':
        // Stream large file
        const fileStream = fs.createReadStream(`/large-files/${filename}`);
        res.stream(fileStream, 'video/mp4', {
          bufferSize: 64 * 1024,
          enableCompression: false, // Don't compress video
        });
        break;

      default:
        res.status(400).error('Invalid file type');
    }
  } catch (error) {
    res.status(404).error('File not found', 404, { filename });
  }
});
```

## 🎨 **Template Rendering Example**

```typescript
app.get('/dashboard', async (req, res) => {
  const user = await getUserData(req.session.userId);
  const stats = await getDashboardStats();

  // Set cache headers
  res.cache(300); // 5 minutes

  // Add security headers
  res.security();

  // Render template with data
  await res.render('@views/dashboard.mustache', {
    user,
    stats,
    title: `${user.name}'s Dashboard`,
    timestamp: new Date().toISOString(),
  });
});
```

## 🔧 **TypeScript Support**

Full TypeScript definitions are provided:

```typescript
import { NextRushResponse } from '@nextrush/core';

app.get('/api/users', (req, res: NextRushResponse) => {
  // Full IntelliSense support
  res
    .status(200) // NextRushResponse
    .cache(3600) // NextRushResponse
    .json({ users }); // void
});
```

## 🎯 **Response Headers Reference**

### Automatic Headers Set by NextRush

```typescript
// Content-Type headers (automatic)
res.json(data); // → 'application/json; charset=utf-8'
res.html(html); // → 'text/html; charset=utf-8'
res.text(text); // → 'text/plain; charset=utf-8'
res.xml(xml); // → 'application/xml; charset=utf-8'
res.csv(data); // → 'text/csv; charset=utf-8'

// Cache headers
res.cache(3600); // → 'Cache-Control: max-age=3600'
res.noCache(); // → 'Cache-Control: no-cache, no-store, must-revalidate'

// Security headers
res.security(); // → Multiple security headers

// File serving headers
res.sendFile(path); // → Content-Type, Content-Length, ETag, Last-Modified
res.download(path); // → Content-Disposition: attachment
```

### Manual Header Examples

```typescript
// API versioning
res.set('API-Version', '1.0');

// Custom application headers
res.set('X-Request-ID', requestId);
res.set('X-Response-Time', `${duration}ms`);

// Content negotiation
res.set('Vary', 'Accept, Accept-Encoding');

// Rate limiting
res.set('X-RateLimit-Limit', '100');
res.set('X-RateLimit-Remaining', '87');
```

---

**The NextRush Response object provides everything you need for modern web responses with security, performance, and developer experience in mind.**
