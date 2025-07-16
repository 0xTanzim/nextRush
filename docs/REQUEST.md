# NextRush Request API

## 🚀 **Complete Request Object Documentation**

The NextRush Request object is an enhanced version of Node.js's `IncomingMessage` with powerful Express-style methods and additional utilities for modern web development.

## 📋 **Request Properties**

### Core Properties

```typescript
req.params; // Route parameters (e.g., /user/:id → req.params.id)
req.query; // Query string parameters (?name=value)
req.body; // Parsed request body (JSON, form data, etc.)
req.pathname; // URL pathname
req.originalUrl; // Complete original URL
req.path; // URL path
```

### Enhanced Properties

```typescript
req.files; // Uploaded files (multipart/form-data)
req.cookies; // Parsed cookies
req.session; // Session data
req.locals; // Request-local data
req.startTime; // Request start timestamp
req.middlewareStack; // Middleware execution stack (debugging)
```

## 🔧 **Request Methods**

### Basic Information

```typescript
// Get route parameter
const userId = req.param('id');

// Get header value
const userAgent = req.header('user-agent');
const userAgent = req.get('user-agent'); // Alias

// Get request IP (with proxy support)
const clientIp = req.ip();

// Check if request is secure (HTTPS)
const isSecure = req.secure();

// Get protocol
const protocol = req.protocol(); // 'http' or 'https'

// Get hostname
const host = req.hostname();

// Get full URL
const fullUrl = req.fullUrl();
```

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
```

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
