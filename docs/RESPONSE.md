# NextRush Response API

## 🚀 **Complete Response Object Documentation**

The NextRush Response object is an enhanced version of Node.js's `ServerResponse` with powerful Express-style methods and additional utilities for modern web development.

## 📋 **Response Properties**

### Core Properties

```typescript
res.locals; // Response-local data for templates
res.statusCode; // HTTP status code (inherited from ServerResponse)
res.headersSent; // Whether headers have been sent
```

## 🔧 **Status & Headers**

### Status Management

```typescript
// Set status code (chainable)
res.status(200);
res.status(404).json({ error: 'Not found' });
res.status(500).send('Internal Server Error');

// Common status shortcuts
res.statusCode = 201; // Direct assignment
```

### Header Management

```typescript
// Set single header
res.set('Content-Type', 'application/json');
res.header('Cache-Control', 'no-cache'); // Alias

// Set multiple headers
res.set({
  'Content-Type': 'application/json',
  'Cache-Control': 'max-age=3600',
  'X-Powered-By': 'NextRush',
});

// Get header value
const contentType = res.get('content-type');

// Remove header
res.removeHeader('x-powered-by');
```

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
