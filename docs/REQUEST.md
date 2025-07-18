# 🚀 NextRush Request API - Complete Guide

**Professional-grade request handling with zero dependencies and maximum performance**

## � **Table of Contents**

| Section                                                    | Description                             |
| ---------------------------------------------------------- | --------------------------------------- |
| [🎯 Overview](#-overview)                                  | Introduction to NextRush Request object |
| [📦 Core Properties](#-core-properties)                    | Essential request properties            |
| [🔧 Basic Methods](#-basic-methods)                        | Fundamental request methods             |
| [📊 Body Parsing](#-body-parsing)                          | Advanced body parsing capabilities      |
| [📁 File Handling](#-file-handling)                        | File upload and multipart support       |
| [🍪 Cookie Management](#-cookie-management)                | Cookie parsing and handling             |
| [🔐 Security Features](#-security-features)                | Security-focused request methods        |
| [🔍 Content Type Detection](#-content-type-detection)      | Smart content type handling             |
| [⚡ Performance Features](#-performance-features)          | High-performance request utilities      |
| [🧪 Validation & Sanitization](#-validation--sanitization) | Built-in validation system              |
| [📈 Monitoring & Debugging](#-monitoring--debugging)       | Request tracking and debugging          |

## 🎯 **Overview**

The NextRush Request object extends Node.js's `IncomingMessage` with powerful Express-style methods, comprehensive body parsing, file handling, and enterprise-grade features.

```typescript
import { NextRushRequest } from 'nextrush';

app.get('/api/user/:id', (req: NextRushRequest, res) => {
  // ✅ Full TypeScript support with autocomplete
  const userId = req.param('id');
  const userAgent = req.header('user-agent');
  const clientIp = req.ip();

  res.json({
    userId,
    userAgent,
    clientIp,
    isSecure: req.secure(),
  });
});
```

## � **Core Properties**

### 🎯 **Essential Properties**

| Property          | Type                     | Description                       | Example                          |
| ----------------- | ------------------------ | --------------------------------- | -------------------------------- |
| `req.params`      | `Record<string, string>` | Route parameters                  | `req.params.id` from `/user/:id` |
| `req.query`       | `ParsedUrlQuery`         | Query string parameters           | `req.query.page` from `?page=1`  |
| `req.body`        | `any`                    | Parsed request body (auto-parsed) | JSON, form data, text, files     |
| `req.pathname`    | `string`                 | URL pathname                      | `/api/users`                     |
| `req.originalUrl` | `string`                 | Complete original URL             | `/api/users?page=1`              |
| `req.path`        | `string`                 | URL path (alias for pathname)     | `/api/users`                     |

### 🚀 **Enhanced Properties**

| Property        | Type                         | Description                | Example                    |
| --------------- | ---------------------------- | -------------------------- | -------------------------- |
| `req.files`     | `Record<string, FileUpload>` | Uploaded files (multipart) | `req.files.avatar`         |
| `req.cookies`   | `Record<string, string>`     | Parsed cookies             | `req.cookies.sessionId`    |
| `req.session`   | `Record<string, any>`        | Session data storage       | `req.session.user`         |
| `req.locals`    | `Record<string, any>`        | Request-scoped data        | `req.locals.currentUser`   |
| `req.startTime` | `number`                     | Request start timestamp    | `Date.now()`               |
| `req.id`        | `string`                     | Unique request ID          | `req_1642680000000_abc123` |

## 🔧 **Basic Methods**

### 📝 **Parameter & Header Access**

```typescript
// 🎯 Get route parameters
const userId = req.param('id'); // From /user/:id
const category = req.param('category'); // From /products/:category

// 📋 Get header values
const userAgent = req.header('user-agent');
const contentType = req.get('content-type'); // Alias for header()
const authorization = req.header('authorization');

// 🌐 Get client information
const clientIp = req.ip(); // Smart IP detection with proxy support
const isSecure = req.secure(); // Check if HTTPS
const protocol = req.protocol(); // 'http' or 'https'
const hostname = req.hostname(); // Domain name
const fullUrl = req.fullUrl(); // Complete URL with protocol
```

### 🔍 **Content Type Detection**

```typescript
// ✅ Check content types
if (req.is('application/json')) {
  console.log('📄 JSON request');
}

if (req.isJson()) {
  // Convenience method
  console.log('📄 JSON detected');
}

if (req.isForm()) {
  // URL-encoded form
  console.log('📝 Form data detected');
}

if (req.isMultipart()) {
  // Multipart/form-data
  console.log('📁 File upload detected');
}

// 🎯 Accept header checking
const acceptsJson = req.accepts('application/json');
const acceptsHtml = req.accepts(['text/html', 'application/json']);
```

## 📊 **Body Parsing**

NextRush includes the **Ultimate Body Parser** - zero dependencies, maximum performance! 🚀

### 🔄 **Automatic Body Parsing**

```typescript
// ✨ Body parsing is AUTOMATIC for all requests!
app.post('/api/data', (req, res) => {
  // req.body is already parsed based on Content-Type:
  // - application/json → JavaScript object
  // - application/x-www-form-urlencoded → Object with form fields
  // - multipart/form-data → Object + files in req.files
  // - text/* → String
  // - application/octet-stream → Buffer

  console.log('📦 Parsed body:', req.body);
  console.log('📁 Uploaded files:', req.files);

  res.json({ received: req.body });
});
```

### 🎯 **Advanced Body Methods**

| Method                | Return Type                    | Description                  | Example                 |
| --------------------- | ------------------------------ | ---------------------------- | ----------------------- |
| `req.parseBody()`     | `Promise<UnifiedParsedResult>` | Get full parsing result      | `await req.parseBody()` |
| `req.getBody()`       | `Promise<any>`                 | Get parsed body data         | `await req.getBody()`   |
| `req.json()`          | `Promise<any>`                 | Get body as JSON (validates) | `await req.json()`      |
| `req.text()`          | `Promise<string>`              | Get body as text             | `await req.text()`      |
| `req.buffer()`        | `Promise<Buffer>`              | Get body as buffer           | `await req.buffer()`    |
| `req.isEmpty()`       | `boolean`                      | Check if body is empty       | `req.isEmpty()`         |
| `req.contentLength()` | `number`                       | Get content length           | `req.contentLength()`   |

```typescript
// 🎯 Advanced body parsing examples
app.post('/api/upload', async (req, res) => {
  try {
    // Get full parsing result with metadata
    const parseResult = await req.parseBody();
    console.log('📊 Parse info:', {
      parser: parseResult.parser, // 'json', 'multipart', 'urlencoded'
      hasFiles: parseResult.hasFiles, // Boolean
      contentType: parseResult.contentType,
    });

    // Validate JSON specifically
    if (req.is('application/json')) {
      const jsonData = await req.json();
      console.log('✅ Valid JSON:', jsonData);
    }

    // Get as text for any content type
    const textData = await req.text();
    console.log('📝 Text representation:', textData);

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Invalid request body' });
  }
});
```

## 📁 **File Handling**

Professional file upload handling with comprehensive metadata and validation! 🗂️

### 📂 **File Upload Methods**

| Method               | Return Type                           | Description                   | Example                       |
| -------------------- | ------------------------------------- | ----------------------------- | ----------------------------- |
| `req.getFiles()`     | `Promise<Record<string, FileUpload>>` | Get all uploaded files        | `await req.getFiles()`        |
| `req.getFile(name)`  | `Promise<FileUpload \| null>`         | Get single file by field name | `await req.getFile('avatar')` |
| `req.allFiles()`     | `Promise<FileUpload[]>`               | Get all files as array        | `await req.allFiles()`        |
| `req.hasFiles()`     | `Promise<boolean>`                    | Check if request has files    | `await req.hasFiles()`        |
| `req.getFields()`    | `Promise<Record<string, string>>`     | Get form fields (multipart)   | `await req.getFields()`       |
| `req.getField(name)` | `Promise<string \| null>`             | Get single form field         | `await req.getField('title')` |

### �️ **File Upload Example**

```typescript
app.post('/api/upload', async (req, res) => {
  try {
    // Check if files were uploaded
    const hasFiles = await req.hasFiles();
    if (!hasFiles) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Get all uploaded files
    const files = await req.getFiles();
    console.log('📁 Uploaded files:', Object.keys(files));

    // Get specific file
    const avatar = await req.getFile('avatar');
    if (avatar) {
      console.log('👤 Avatar file:', {
        originalName: avatar.originalName,
        filename: avatar.filename,
        mimetype: avatar.mimetype,
        size: avatar.size,
        path: avatar.path,
      });
    }

    // Get all files as array for processing
    const allFiles = await req.allFiles();
    for (const file of allFiles) {
      console.log(`📄 Processing ${file.originalName} (${file.size} bytes)`);
    }

    // Get form fields alongside files
    const fields = await req.getFields();
    const title = await req.getField('title');

    res.json({
      success: true,
      filesUploaded: allFiles.length,
      title,
      files: allFiles.map((f) => ({
        name: f.originalName,
        size: f.size,
        type: f.mimetype,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});
```

### 📋 **FileUpload Interface**

```typescript
interface FileUpload {
  fieldname: string; // Form field name
  originalName: string; // Original filename
  filename: string; // Generated filename
  mimetype: string; // MIME type
  size: number; // File size in bytes
  path: string; // File path on disk
  buffer?: Buffer; // File data (if memory storage)
  encoding: string; // File encoding
  destination?: string; // Upload destination
}
```

## 🍪 **Cookie Management**

```typescript
// 🍪 Access parsed cookies
const sessionId = req.cookies.sessionId;
const theme = req.cookies.theme || 'light';

// Example with authentication
app.get('/api/profile', (req, res) => {
  const authToken = req.cookies.authToken;

  if (!authToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Validate token and get user profile
  const user = validateToken(authToken);
  res.json({ user });
});
```

## 🔐 **Security Features**

### 🛡️ **Security-Focused Methods**

```typescript
// 🔐 Security information
const clientIp = req.ip(); // Real client IP (proxy-aware)
const isSecure = req.secure(); // HTTPS check
const userAgent = req.header('user-agent'); // User agent string

// 🌐 Origin and referrer validation
const origin = req.header('origin');
const referrer = req.header('referer');

// 📊 Request timing for rate limiting
const requestStart = req.startTime;
const requestId = req.id;

// Example: Rate limiting by IP
const rateLimitKey = `rate_limit_${req.ip()}`;
```

## 🔍 **Content Type Detection**

### 📋 **Smart Content Detection**

```typescript
// 🎯 Precise content type checking
if (req.is('application/json')) {
  console.log('📄 JSON content');
}

if (req.is('multipart/form-data')) {
  console.log('📁 File upload');
}

if (req.is('text/html')) {
  console.log('🌐 HTML content');
}

// 📱 Accept header negotiation
const preferredFormat = req.accepts(['json', 'html', 'xml']);
switch (preferredFormat) {
  case 'json':
    res.json({ data: 'JSON response' });
    break;
  case 'html':
    res.render('template.html', { data: 'HTML response' });
    break;
  case 'xml':
    res
      .set('Content-Type', 'application/xml')
      .send('<data>XML response</data>');
    break;
  default:
    res.status(406).json({ error: 'Not acceptable' });
}
```

## ⚡ **Performance Features**

### 📈 **High-Performance Utilities**

```typescript
// ⏱️ Request timing
const startTime = req.startTime;
const duration = Date.now() - startTime;

// 📊 Content length optimization
const contentLength = req.contentLength();
if (contentLength > 10 * 1024 * 1024) {
  // 10MB
  return res.status(413).json({ error: 'Request too large' });
}

// 🔍 Efficient empty body check
if (req.isEmpty()) {
  console.log('📝 Empty request body');
}

// 🎯 Request ID for tracing
const requestId = req.id;
console.log(`🔍 Processing request ${requestId}`);
```

## 🧪 **Validation & Sanitization**

### ✅ **Built-in Validation System**

```typescript
// 🧪 Advanced validation example
app.post('/api/user', async (req, res) => {
  try {
    // Validate request has body
    if (req.isEmpty()) {
      return res.status(400).json({ error: 'Request body required' });
    }

    // Get and validate JSON
    const userData = await req.json();

    // Basic validation
    if (!userData.email || !userData.name) {
      return res.status(400).json({
        error: 'Missing required fields: email, name',
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Success
    res.json({ success: true, user: userData });
  } catch (error) {
    res.status(400).json({ error: 'Invalid JSON in request body' });
  }
});
```

## 📈 **Monitoring & Debugging**

### 🔍 **Request Tracking & Debugging**

```typescript
// 🔍 Request debugging information
app.use((req, res, next) => {
  console.log(`🚀 Request ${req.id}:`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip(),
    userAgent: req.header('user-agent'),
    contentType: req.header('content-type'),
    contentLength: req.contentLength(),
    startTime: new Date(req.startTime).toISOString(),
  });

  next();
});

// 📊 Performance monitoring
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`⚡ Request ${req.id} completed in ${duration}ms`);
  });

  next();
});
```

## 🎯 **Best Practices**

### ✅ **Recommended Patterns**

| Practice             | ✅ Good                        | ❌ Avoid                           |
| -------------------- | ------------------------------ | ---------------------------------- |
| **Parameter Access** | `req.param('id')`              | `req.params.id` (no validation)    |
| **Header Access**    | `req.header('content-type')`   | `req.headers['content-type']`      |
| **Body Parsing**     | `await req.json()` (validates) | `req.body` (assumes parsed)        |
| **File Handling**    | `await req.getFile('upload')`  | `req.files.upload` (may not exist) |
| **Content Type**     | `req.is('application/json')`   | Manual string comparison           |
| **IP Detection**     | `req.ip()` (proxy-aware)       | `req.connection.remoteAddress`     |

### 🚀 **Performance Tips**

```typescript
// ⚡ Efficient request handling
app.post('/api/data', async (req, res) => {
  // 1. Early validation
  if (req.isEmpty()) {
    return res.status(400).json({ error: 'Body required' });
  }

  // 2. Content type checking
  if (!req.is('application/json')) {
    return res.status(415).json({ error: 'JSON required' });
  }

  // 3. Size validation
  if (req.contentLength() > 1024 * 1024) {
    // 1MB
    return res.status(413).json({ error: 'Request too large' });
  }

  // 4. Parse and process
  const data = await req.json();
  res.json({ success: true, data });
});
```

## 🎉 **Summary**

The NextRush Request object provides:

- ✅ **Express-compatible API** with enhanced features
- ✅ **Automatic body parsing** for all content types
- ✅ **Professional file handling** with metadata
- ✅ **Security-first design** with proxy awareness
- ✅ **Performance optimization** with smart caching
- ✅ **TypeScript support** with full autocomplete
- ✅ **Zero dependencies** for maximum reliability

**Ready to build amazing web applications with professional request handling!** 🚀

// Get hostname
const host = req.hostname();

// Get full URL
const fullUrl = req.fullUrl();

````

### Content Type Detection

```typescript
// Check request content type
if (req.is('json')) {
  // Handle JSON request
}

if (req.is('multipart')) {
  // Handle file upload
}

if (req.is('application/xml')) {
  // Handle XML request
}

// Check accepted response types
const acceptsJson = req.accepts('json');
const acceptsHtml = req.accepts(['html', 'json']);
````

### Cookie Handling

```typescript
// Parse cookies from request
const cookies = req.parseCookies();

// Access specific cookie
const sessionId = req.cookies.sessionId;
```

## 🛡️ **Validation & Sanitization**

### Request Validation

```typescript
// Define validation rules
const validationRules = {
  email: {
    required: true,
    type: 'email',
    message: 'Valid email required',
  },
  age: {
    required: true,
    type: 'number',
    custom: (value) => value >= 18,
    message: 'Must be 18 or older',
  },
  name: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 50,
    sanitize: {
      trim: true,
      removeHtml: true,
    },
  },
};

// Validate request data
const result = req.validate(validationRules);

if (result.isValid) {
  // Use sanitized data
  const cleanData = result.sanitized;
} else {
  // Handle validation errors
  res.status(400).json({ errors: result.errors });
}
```

### Data Sanitization

```typescript
// Sanitize individual values
const cleanName = req.sanitize(userInput, {
  trim: true,
  escape: true,
  removeHtml: true,
  removeSpecialChars: true,
});

// Built-in validation helpers
const isValidEmail = req.isValidEmail('user@example.com');
const isValidUrl = req.isValidUrl('https://example.com');
```

## 🔍 **Utility Methods**

### Rate Limiting Info

```typescript
const rateLimit = req.rateLimit();
console.log({
  limit: rateLimit.limit,
  remaining: rateLimit.remaining,
  reset: rateLimit.reset,
  retryAfter: rateLimit.retryAfter,
});
```

### Request Fingerprinting

```typescript
// Generate unique request fingerprint
const fingerprint = req.fingerprint();
// Uses IP, User-Agent, Accept headers to create unique ID
```

### User Agent Analysis

```typescript
const userAgent = req.userAgent();
console.log({
  raw: userAgent.raw,
  browser: userAgent.browser, // 'Chrome', 'Firefox', etc.
  os: userAgent.os, // 'Windows', 'macOS', etc.
  device: userAgent.device, // 'Desktop', 'Mobile', etc.
  isBot: userAgent.isBot, // true/false
  isMobile: userAgent.isMobile, // true/false
});
```

### Request Timing

```typescript
const timing = req.timing();
console.log({
  start: timing.start, // Start timestamp
  duration: timing.duration, // Duration in ms
  timestamp: timing.timestamp, // ISO string
});
```

## 📁 **File Upload Handling**

### Multipart Form Data

```typescript
app.post('/upload', (req, res) => {
  // Access uploaded files
  const avatar = req.files.avatar;
  const documents = req.files.documents; // Array for multiple files

  // Access form fields
  const { title, description } = req.body;

  // File properties
  console.log({
    filename: avatar.filename,
    mimetype: avatar.mimetype,
    size: avatar.size,
    buffer: avatar.buffer,
  });
});
```

## 🍪 **Cookie Management**

### Reading Cookies

```typescript
// Get all cookies
const allCookies = req.cookies;

// Get specific cookie
const sessionId = req.cookies.sessionId;

// Parse cookies manually
const parsedCookies = req.parseCookies();
```

## 🎯 **Advanced Features**

### Session Support

```typescript
// Session data (requires session middleware)
req.session.userId = 123;
req.session.preferences = { theme: 'dark' };
```

### Request-Local Data

```typescript
// Store data for this request only
req.locals.startTime = Date.now();
req.locals.requestId = generateId();
```

### Middleware Stack Debugging

```typescript
// See which middleware have been executed
console.log(req.middlewareStack);
// ['cors', 'bodyParser', 'authentication', 'validation']
```

## 📊 **Complete Example**

```typescript
app.post('/api/users', (req, res) => {
  // Get request info
  const ip = req.ip();
  const userAgent = req.userAgent();

  // Validate request
  const validation = req.validate({
    name: { required: true, type: 'string', minLength: 2 },
    email: { required: true, type: 'email' },
    age: { required: true, type: 'number' },
  });

  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Validation failed',
      errors: validation.errors,
    });
  }

  // Use sanitized data
  const { name, email, age } = validation.sanitized;

  // Check rate limiting
  const rateLimit = req.rateLimit();
  if (rateLimit.remaining === 0) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfter: rateLimit.retryAfter,
    });
  }

  // Process request
  const user = { name, email, age, ip };

  // Log request
  console.log(`User creation from ${ip} using ${userAgent.browser}`);

  res.json({ success: true, user });
});
```

## 🔧 **TypeScript Support**

Full TypeScript definitions are provided:

```typescript
import { NextRushRequest } from '@nextrush/core';

app.get('/api/profile/:id', (req: NextRushRequest, res) => {
  // Full IntelliSense support
  const userId = req.param('id'); // string | undefined
  const userAgent = req.userAgent(); // UserAgentInfo
  const timing = req.timing(); // RequestTiming
});
```

## 🎯 **Validation Rules Reference**

### Available Validation Types

```typescript
{
  required?: boolean;                    // Field is required
  type?: 'string' | 'number' | 'email' | 'url' | 'boolean';
  minLength?: number;                    // Minimum string length
  maxLength?: number;                    // Maximum string length
  custom?: (value: any) => boolean;      // Custom validation function
  message?: string;                      // Custom error message
  sanitize?: {                          // Sanitization options
    trim?: boolean;                      // Remove whitespace
    escape?: boolean;                    // Escape HTML
    lowercase?: boolean;                 // Convert to lowercase
    uppercase?: boolean;                 // Convert to uppercase
    removeHtml?: boolean;                // Strip HTML tags
    removeSpecialChars?: boolean;        // Remove special characters
  }
}
```

### Example Validation Scenarios

```typescript
// Email validation
const emailRule = {
  required: true,
  type: 'email',
  message: 'Please provide a valid email address',
};

// Password validation
const passwordRule = {
  required: true,
  type: 'string',
  minLength: 8,
  custom: (value) => /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value),
  message: 'Password must contain uppercase, lowercase, and number',
};

// Safe string validation
const nameRule = {
  required: true,
  type: 'string',
  minLength: 2,
  maxLength: 50,
  sanitize: {
    trim: true,
    removeHtml: true,
    removeSpecialChars: true,
  },
};
```

---

**The NextRush Request object provides everything you need for modern web development with security, validation, and developer experience in mind.**

## 📁 **File Upload API (Multipart Support)**

### Current Status: **PARTIALLY IMPLEMENTED**

NextRush includes comprehensive body parsing but multipart file uploads need enhancement:

```typescript
// CURRENT IMPLEMENTATION (Works)
app.post('/upload', async (req, res) => {
  // ✅ JSON parsing works
  const jsonData = req.body; // Parsed JSON object

  // ✅ Form data parsing works
  const formData = req.body; // Parsed form fields

  // ❌ Multipart file parsing needs implementation
  const files = req.files; // Currently undefined
  const avatar = req.file('avatar'); // Method needs implementation
});
```

### Planned Multipart API (Coming Soon)

```typescript
app.post('/upload', async (req, res) => {
  // Multipart form with files
  const { files, fields } = req.body; // Auto-parsed multipart

  // Direct file access
  const avatar = req.file('avatar'); // Single file
  const documents = req.files('docs'); // Multiple files

  // File properties
  if (avatar) {
    console.log({
      filename: avatar.filename, // Original filename
      mimetype: avatar.mimetype, // MIME type
      size: avatar.size, // File size in bytes
      path: avatar.path, // Temporary file path
      buffer: avatar.buffer, // File buffer (optional)
    });
  }

  // Form fields from multipart
  const { title, description } = fields;

  res.json({
    message: 'Upload successful',
    filesReceived: Object.keys(files).length,
  });
});
```

### File Upload Configuration

```typescript
import { BodyParser } from 'nextrush';

const bodyParser = new BodyParser({
  maxSize: 50 * 1024 * 1024, // 50MB max
  allowedContentTypes: [
    'application/json',
    'application/x-www-form-urlencoded',
    'text/plain',
    'multipart/form-data', // Enable multipart
  ],
  // Multipart-specific options (planned)
  multipart: {
    maxFiles: 10, // Max number of files
    maxFileSize: 10 * 1024 * 1024, // 10MB per file
    allowedTypes: ['image/*', 'application/pdf'],
    uploadDir: './uploads', // Upload directory
    keepExtensions: true, // Keep original extensions
  },
});
```

## 🧪 **Advanced Request Methods**

### JSON Helper Methods

```typescript
// Parse and validate JSON
const userData = req.json(); // Throws if invalid JSON
const safeData = req.safeJson(); // Returns null if invalid

// Type-safe JSON parsing
interface User {
  name: string;
  email: string;
}
const user = req.json<User>(); // TypeScript validation
```

### Text Processing

```typescript
// Get raw text body
const rawText = req.text();

// Get text with encoding
const text = req.text('utf-8');
const text = req.text('base64');
```

### Advanced Query Processing

```typescript
// Parse complex query parameters
const filters = req.queryObject('filters'); // Parse JSON query param
const tags = req.queryArray('tags'); // Parse array query param
const bool = req.queryBool('active'); // Parse boolean query param
const num = req.queryNumber('page'); // Parse number query param

// Query parameter with defaults
const page = req.queryNumber('page', 1); // Default to 1
const limit = req.queryNumber('limit', 10); // Default to 10
```

### Request Body Size and Type Detection

```typescript
// Check request body size
const bodySize = req.getBodySize(); // Size in bytes
const isLarge = req.isLargeBody(1024); // > 1KB

// Content type detection
const contentType = req.getContentType(); // Get main content type
const charset = req.getCharset(); // Get charset
const boundary = req.getBoundary(); // Get multipart boundary
```

## 🔧 **Request Enhancement Methods**

### Request Metadata

```typescript
// Request identification
const requestId = req.getId(); // Unique request ID
const correlationId = req.getCorrelationId(); // For distributed tracing

// Request source
const referrer = req.getReferrer(); // HTTP referrer
const origin = req.getOrigin(); // Request origin
const forwarded = req.getForwardedFor(); // X-Forwarded-For chain
```

### Performance Monitoring

```typescript
// Request timing
const startTime = req.getStartTime(); // Request start timestamp
const duration = req.getDuration(); // Current duration
const isSlowRequest = req.isSlowRequest(1000); // > 1 second

// Memory usage for this request
const memoryUsage = req.getMemoryUsage(); // Memory footprint
```

### Geographic Information

```typescript
// Client location (if available)
const country = req.getCountry(); // Country code
const region = req.getRegion(); // Region/state
const city = req.getCity(); // City name
const timezone = req.getTimezone(); // Client timezone
```

## 🛡️ **Security & Validation Enhancements**

### Advanced Input Sanitization

```typescript
// Sanitize specific fields
const cleanEmail = req.sanitizeEmail(req.body.email);
const cleanHTML = req.sanitizeHTML(req.body.content);
const cleanSQL = req.sanitizeSQL(req.body.query);

// Bulk sanitization
const sanitized = req.sanitizeBody({
  email: 'email',
  content: 'html',
  age: 'number',
});
```

### Security Headers Analysis

```typescript
// Security header detection
const hasCSRF = req.hasCSRFToken(); // CSRF token present
const isSecure = req.isSecureConnection(); // HTTPS + secure headers
const trustLevel = req.getTrustLevel(); // Security assessment (1-10)
```

### Rate Limiting Integration

```typescript
// Rate limiting information
const rateInfo = req.getRateLimit();
console.log({
  limit: rateInfo.limit, // Requests per window
  remaining: rateInfo.remaining, // Remaining requests
  reset: rateInfo.reset, // Reset timestamp
  retryAfter: rateInfo.retryAfter, // Retry after seconds
});

// Check if rate limited
if (req.isRateLimited()) {
  return res.status(429).json({ error: 'Too many requests' });
}
```

## 📊 **Request Analytics & Monitoring**

### Request Classification

```typescript
// Request type detection
const isAPI = req.isAPIRequest(); // API request (JSON/XML)
const isPage = req.isPageRequest(); // HTML page request
const isAsset = req.isAssetRequest(); // Static asset request
const isBot = req.isBotRequest(); // Bot/crawler request
const isMobile = req.isMobileRequest(); // Mobile device request
```

### Performance Metrics

```typescript
// Request complexity metrics
const complexity = req.getComplexity(); // Request complexity score
const priority = req.getPriority(); // Request priority (1-10)
const category = req.getCategory(); // Request category
```
