# ## 📚 Table of Contents

- [� Introduction](#-introduction)
- [🔧 Public APIs](#-public-apis)
  - [📋 Properties](#-properties)
  - [⚙️ Core Response Methods](#️-core-response-methods)
  - [📁 File Operations](#-file-operations)
  - [🔄 Redirection Methods](#-redirection-methods)
  - [📋 Header Management](#-header-management)
  - [🍪 Cookie Management](#-cookie-management)
  - [🎨 Template Rendering](#-template-rendering)
  - [💾 Cache Control](#-cache-control)
  - [🌐 CORS Support](#-cors-support)
  - [🔒 Security Features](#-security-features)
- [💻 Usage Examples](#-usage-examples)
- [⚙️ Configuration Options](#️-configuration-options)
- [📝 Notes](#-notes)hancement

## �📖 Introduction

The `ResponseEnhancer` class in the NextRush framework transforms the standard Node.js `ServerResponse` object into a powerful, feature-rich response interface called `NextRushResponse`. This enhancement provides comprehensive response handling capabilities including advanced content types, file operations, template rendering, security headers, caching, and API response helpers. The enhanced response object follows Express.js conventions while adding modern TypeScript support and enterprise-grade features.

## 🔧 Public APIs

### 📋 Properties

| Property | Type                  | Description                                                 |
| -------- | --------------------- | ----------------------------------------------------------- |
| `locals` | `Record<string, any>` | Custom data attached to the response for template rendering |

### ⚙️ Core Response Methods

#### 🔧 Status Management

| Method         | Signature                            | Description                      |
| -------------- | ------------------------------------ | -------------------------------- |
| `status(code)` | `(code: number) => NextRushResponse` | Set HTTP status code (chainable) |

#### 📤 Content Response Methods

| Method       | Signature                                    | Description                                    |
| ------------ | -------------------------------------------- | ---------------------------------------------- |
| `json(data)` | `(data: any) => void`                        | Send JSON response with proper content-type    |
| `send(data)` | `(data: string \| Buffer \| object) => void` | Auto-detect and send appropriate response type |
| `html(data)` | `(data: string) => void`                     | Send HTML response with proper content-type    |
| `text(data)` | `(data: string) => void`                     | Send plain text response                       |
| `xml(data)`  | `(data: string) => void`                     | Send XML response with proper content-type     |

#### 📊 Enhanced Content Methods

| Method                                   | Signature                                                                                | Description                                          |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `csv(data, filename?)`                   | `(data: any[], filename?: string) => void`                                               | Generate and send CSV response from array of objects |
| `stream(stream, contentType?, options?)` | `(stream: NodeJS.ReadableStream, contentType?: string, options?: StreamOptions) => void` | Stream data with optional compression                |

### 📁 File Operations

#### 🗂️ File Serving Methods

| Method                                    | Signature                                                      | Description                                      |
| ----------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| `sendFile(filePath, options?)`            | `(filePath: string, options?: SendFileOptions) => void`        | Send file with smart caching and security checks |
| `download(filePath, filename?, options?)` | `(filePath: string, filename?: string, options?: any) => void` | Send file as download attachment                 |

#### 🧠 Smart File Methods

| Method                             | Signature                      | Description                               |
| ---------------------------------- | ------------------------------ | ----------------------------------------- |
| `getSmartContentType(filePath)`    | `(filePath: string) => string` | Auto-detect MIME type from file extension |
| `getContentTypeFromExtension(ext)` | `(ext: string) => string`      | Get MIME type from file extension         |
| `generateETag(stats)`              | `(stats: any) => string`       | Generate ETag for cache validation        |

### 🔄 Redirection Methods

| Method                   | Signature                                | Description                                              |
| ------------------------ | ---------------------------------------- | -------------------------------------------------------- |
| `redirect(url, status?)` | `(url: string, status?: number) => void` | Redirect to URL with optional status code (default: 302) |
| `redirectPermanent(url)` | `(url: string) => void`                  | Permanent redirect (301)                                 |
| `redirectTemporary(url)` | `(url: string) => void`                  | Temporary redirect (307)                                 |

### 📋 Header Management

#### 🔧 Header Methods

| Method                 | Signature                                              | Description                      |
| ---------------------- | ------------------------------------------------------ | -------------------------------- |
| `set(field, value)`    | `(field: string, value: string) => NextRushResponse`   | Set single header (chainable)    |
| `set(fields)`          | `(fields: Record<string, string>) => NextRushResponse` | Set multiple headers (chainable) |
| `header(field, value)` | `(field: string, value: string) => NextRushResponse`   | Alias for `set()` method         |
| `get(field)`           | `(field: string) => string \| undefined`               | Get header value                 |
| `removeHeader(field)`  | `(field: string) => NextRushResponse`                  | Remove header (chainable)        |

### 🍪 Cookie Management

#### 🍪 Cookie Methods

| Method                          | Signature                                                                    | Description             |
| ------------------------------- | ---------------------------------------------------------------------------- | ----------------------- |
| `cookie(name, value, options?)` | `(name: string, value: string, options?: CookieOptions) => NextRushResponse` | Set cookie with options |
| `clearCookie(name, options?)`   | `(name: string, options?: any) => NextRushResponse`                          | Clear cookie            |

### 🎨 Template Rendering

#### 📄 Template Methods

| Method                      | Signature                                | Description                                        |
| --------------------------- | ---------------------------------------- | -------------------------------------------------- |
| `render(template, data?)`   | `(template: string, data?: any) => void` | Render template with data                          |
| `getNestedValue(obj, path)` | `(obj: any, path: string) => any`        | Get nested object value for templates              |
| `isTruthy(value)`           | `(value: any) => boolean`                | Check if value is truthy for template conditionals |

### 💾 Cache Control

#### 🗄️ Caching Methods

| Method           | Signature                               | Description                      |
| ---------------- | --------------------------------------- | -------------------------------- |
| `cache(seconds)` | `(seconds: number) => NextRushResponse` | Set cache headers (chainable)    |
| `noCache()`      | `() => NextRushResponse`                | Set no-cache headers (chainable) |

### 🌐 CORS Support

#### 🔗 CORS Methods

| Method          | Signature                               | Description                  |
| --------------- | --------------------------------------- | ---------------------------- |
| `cors(origin?)` | `(origin?: string) => NextRushResponse` | Set CORS headers (chainable) |

### 🔒 Security Features

#### 🛡️ Security Methods

| Method       | Signature                | Description                                    |
| ------------ | ------------------------ | ---------------------------------------------- |
| `security()` | `() => NextRushResponse` | Set comprehensive security headers (chainable) |
| `compress()` | `() => NextRushResponse` | Set compression headers (chainable)            |

### 🎯 API Response Helpers

#### 📊 Structured Response Methods

| Method                               | Signature                                                           | Description                           |
| ------------------------------------ | ------------------------------------------------------------------- | ------------------------------------- |
| `success(data, message?)`            | `(data: any, message?: string) => void`                             | Send standardized success response    |
| `error(message, code?, details?)`    | `(message: string, code?: number, details?: any) => void`           | Send standardized error response      |
| `paginate(data, page, limit, total)` | `(data: any[], page: number, limit: number, total: number) => void` | Send paginated response with metadata |

### ⏱️ Performance

#### 📈 Performance Methods

| Method         | Signature                              | Description                    |
| -------------- | -------------------------------------- | ------------------------------ |
| `time(label?)` | `(label?: string) => NextRushResponse` | Add timing headers (chainable) |

## 📋 Type Definitions

### 📁 SendFileOptions Interface

```typescript
interface SendFileOptions {
  maxAge?: number;
  lastModified?: boolean;
  etag?: boolean;
  dotfiles?: 'allow' | 'deny' | 'ignore';
  root?: string;
  headers?: Record<string, string>;
  acceptRanges?: boolean;
}
```

### 🌊 StreamOptions Interface

```typescript
interface StreamOptions {
  bufferSize?: number;
  highWaterMark?: number;
  enableCompression?: boolean;
}
```

### 🍪 CookieOptions Interface

```typescript
interface CookieOptions {
  maxAge?: number;
  expires?: Date;
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  signed?: boolean;
}
```

## 💡 Usage Examples

### 🔍 Basic Response Methods

```typescript
import { createApp } from 'nextrush';

const app = createApp();

app.get('/api/users', (req, res) => {
  // JSON response
  res.json({ users: [] });
});

app.get('/hello', (req, res) => {
  // HTML response
  res.html('<h1>Hello World!</h1>');
});

app.get('/info', (req, res) => {
  // Text response
  res.text('Server information');
});

app.get('/data.xml', (req, res) => {
  // XML response
  res.xml('<?xml version="1.0"?><data></data>');
});

app.listen(3000);
```

### 📊 Enhanced Content Examples

```typescript
app.get('/export/users', (req, res) => {
  const users = [
    { id: 1, name: 'John', email: 'john@example.com' },
    { id: 2, name: 'Jane', email: 'jane@example.com' },
  ];

  // Generate CSV download
  res.csv(users, 'users.csv');
});

app.get('/stream/data', (req, res) => {
  const fs = require('fs');
  const stream = fs.createReadStream('large-file.json');

  // Stream response with compression
  res.stream(stream, 'application/json', {
    enableCompression: true,
  });
});
```

### 📁 File Operation Examples

```typescript
app.get('/files/:filename', (req, res) => {
  const { filename } = req.params;

  // Send file with caching
  res.sendFile(`./uploads/${filename}`, {
    maxAge: 86400, // 1 day cache
    etag: true,
    lastModified: true,
    dotfiles: 'deny',
  });
});

app.get('/download/:id', (req, res) => {
  const { id } = req.params;
  const filePath = `./documents/${id}.pdf`;

  // Force download
  res.download(filePath, `document-${id}.pdf`);
});
```

### 🔄 Redirection and Status

```typescript
app.get('/old-page', (req, res) => {
  // Permanent redirect
  res.redirectPermanent('/new-page');
});

app.post('/login', (req, res) => {
  // Custom status with JSON
  res.status(401).json({
    error: 'Invalid credentials',
  });
});

app.get('/temporary', (req, res) => {
  // Temporary redirect
  res.redirectTemporary('/maintenance');
});
```

### 📋 Header Management Examples

```typescript
app.get('/api/data', (req, res) => {
  // Set multiple headers
  res.set({
    'X-API-Version': '1.0',
    'X-Rate-Limit': '1000',
  });

  // Set single header
  res.header('X-Custom-Header', 'value');

  // Send response
  res.json({ data: 'response' });
});

app.get('/no-cache', (req, res) => {
  // Remove caching headers
  res.removeHeader('Cache-Control').noCache().json({ timestamp: Date.now() });
});
```

### 🍪 Cookie Management Examples

```typescript
app.post('/login', (req, res) => {
  // Set secure cookie
  res.cookie('sessionId', 'abc123', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 86400000, // 1 day
  });

  res.json({ message: 'Logged in successfully' });
});

app.post('/logout', (req, res) => {
  // Clear cookie
  res.clearCookie('sessionId').json({ message: 'Logged out' });
});
```

### 🎨 Template Rendering Examples

```typescript
app.get('/profile/:id', (req, res) => {
  const user = { name: 'John', email: 'john@example.com' };

  // Render template with data
  res.render('profile.html', {
    title: 'User Profile',
    user: user,
    isActive: true,
  });
});

// Template content (profile.html):
// <h1>{{title}}</h1>
// <p>Name: {{user.name}}</p>
// {{#if isActive}}<span>Active User</span>{{/if}}
```

### 💾 Cache Control Examples

```typescript
app.get('/static-data', (req, res) => {
  // Cache for 1 hour
  res.cache(3600).json({ data: 'cached content' });
});

app.get('/dynamic-data', (req, res) => {
  // Disable caching
  res.noCache().json({ timestamp: Date.now() });
});
```

### 🔒 Security Headers

```typescript
app.get('/secure-page', (req, res) => {
  // Apply security headers
  res.security().html('<h1>Secure Page</h1>');
});

app.get('/api/public', (req, res) => {
  // Enable CORS for specific origin
  res.cors('https://trusted-domain.com').json({ data: 'public api' });
});
```

### 🎯 API Response Helper Examples

```typescript
app.get('/api/users/:id', (req, res) => {
  const user = { id: 1, name: 'John' };

  if (user) {
    // Standardized success response
    res.success(user, 'User found successfully');
  } else {
    // Standardized error response
    res.error('User not found', 404, { userId: req.params.id });
  }
});

app.get('/api/posts', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = 10;
  const posts = []; // Array of posts
  const total = 100;

  // Paginated response
  res.paginate(posts, page, limit, total);
});
```

### ⏱️ Performance Timing

```typescript
app.get('/api/heavy-operation', (req, res) => {
  // Add timing headers
  res.time('heavy-operation');

  // Perform operation
  const result = performHeavyOperation();

  res.json({ result });
});
```

### 🔧 Method Chaining

```typescript
app.get('/api/complete', (req, res) => {
  // Chain multiple methods
  res
    .status(200)
    .set('X-API-Version', '2.0')
    .cache(300)
    .cors()
    .security()
    .json({
      message: 'Complete response with all features',
      timestamp: Date.now(),
    });
});
```

## ⚙️ Configuration Options

The `ResponseEnhancer` is automatically applied to all responses by the `Application` class. Configuration can be done through method options:

### 📁 File Serving Configuration

- **Cache Control**: Configure caching behavior with `maxAge`, `etag`, and `lastModified`
- **Security**: Control dotfile access and set custom headers
- **Performance**: Enable range requests and compression

### 🍪 Cookie Configuration

- **Security**: Set `httpOnly`, `secure`, and `sameSite` flags
- **Expiration**: Control cookie lifetime with `maxAge` and `expires`
- **Scope**: Set `domain` and `path` for cookie visibility

### 🎨 Template Configuration

- **Template Manager**: Integrates with NextRush's template system when available
- **Fallback Rendering**: Basic template replacement for standalone usage

## 📝 Notes

### ✅ Best Practices

1. **Status Codes**: Always set appropriate HTTP status codes
2. **Content Types**: Let the framework auto-detect content types when possible
3. **Security**: Use security headers for public-facing applications
4. **Caching**: Implement proper caching strategies for static content
5. **Error Handling**: Use standardized error responses for APIs

### 🔐 Security Considerations

1. **Headers**: Always set security headers for production applications
2. **Cookies**: Use secure cookie options (httpOnly, secure, sameSite)
3. **File Serving**: Deny access to dotfiles and validate file paths
4. **CORS**: Configure CORS properly for cross-origin requests
5. **Content Types**: Validate and sanitize content before sending

### ⚠️ Limitations

1. **Template Engine**: Advanced templating requires NextRush's template manager
2. **File Streaming**: Large file streaming should use appropriate chunk sizes
3. **Memory Usage**: CSV generation loads entire dataset into memory
4. **Compression**: Compression headers are hints; actual compression requires middleware

### 📦 Dependencies

The ResponseEnhancer has minimal external dependencies:

- **Node.js fs module**: For file operations
- **Node.js path module**: For file path handling
- **Node.js http module**: For core HTTP functionality

It's automatically enabled when using the NextRush Application class and integrates seamlessly with the request processing pipeline.
