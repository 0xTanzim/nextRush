# 🚀 NextRush Enhanced Features Guide

## 🎯 Overview

NextRush has been significantly enhanced with professional-grade features that make it production-ready for modern web applications. This guide covers all the new enhanced features added to the framework.

## ✨ New Features

### 🛡️ Enhanced Request Validation & Sanitization

#### **Validation Plugin**

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Validation middleware
app.use(
  '/api/users',
  app.validate({
    name: { required: true, type: 'string', minLength: 2, maxLength: 50 },
    email: { required: true, type: 'email' },
    age: { type: 'number', min: 18, max: 120 },
    website: { type: 'url' },
    terms: { required: true, type: 'boolean' },
  })
);

app.post('/api/users', (req, res) => {
  // req.body is now validated and sanitized
  res.json({ message: 'User created', data: req.body });
});
```

#### **Sanitization Features**

```typescript
// Auto-sanitization
app.use(
  app.sanitize({
    removeHtml: true,
    escapeHtml: true,
    trim: true,
    removeSpecialChars: false,
  })
);

// XSS Protection
app.use(app.xssProtection());
```

#### **Enhanced Request Methods**

```typescript
app.get('/api/info', (req, res) => {
  // Enhanced request methods
  const clientInfo = {
    ip: req.ip(),
    secure: req.secure(),
    protocol: req.protocol(),
    hostname: req.hostname(),
    fullUrl: req.fullUrl(),
    userAgent: req.userAgent(),
    isBot: req.userAgent().isBot,
    isMobile: req.userAgent().isMobile,
  };

  // Cookie handling
  const cookies = req.parseCookies();

  // Validation helpers
  const isValidEmail = req.isValidEmail(req.body.email);
  const isValidUrl = req.isValidUrl(req.body.website);

  res.json(clientInfo);
});
```

### 🔄 Event-Driven Architecture

#### **Basic Event Usage**

```typescript
import { createApp, EventDrivenPlugin } from 'nextrush';

const app = createApp();

// Event listeners
app.on('user:created', (userData) => {
  console.log('New user created:', userData);
  // Send welcome email, update analytics, etc.
});

app.on('request:start', (requestData) => {
  console.log('Request started:', requestData.method, requestData.url);
});

// Emit custom events
app.post('/api/users', (req, res) => {
  const user = createUser(req.body);

  // Emit event
  app.emit('user:created', user);

  res.json(user);
});
```

#### **Event Pipelines**

```typescript
// Create event pipeline for user actions
app.pipeline('userActions', {
  events: ['user:created', 'user:updated', 'user:deleted'],
  handler: async (eventData) => {
    // Update search index
    await updateSearchIndex(eventData);
    // Update analytics
    await trackUserEvent(eventData);
    // Notify other services
    await notifyServices(eventData);
  },
  filters: [
    (data) => data.user.isActive, // Only process active users
    (data) => !data.user.isTestUser, // Skip test users
  ],
});

// Trigger specific pipeline
app.post('/api/bulk-import', async (req, res) => {
  const users = await importUsers(req.body);

  users.forEach((user) => {
    app.trigger('userActions', { user, action: 'created' });
  });

  res.json({ imported: users.length });
});
```

#### **Event Middleware**

```typescript
// Auto-emit events for requests
app.use(
  app.eventMiddleware({
    autoEmit: true,
    events: ['api:request'],
    includeRequest: true,
    includeResponse: true,
  })
);

// Get event statistics
app.get('/admin/events', (req, res) => {
  const stats = app.getEventStats();
  res.json(stats);
});
```

### 📁 Professional Static File Serving

#### **Enhanced Static Options**

```typescript
// Basic enhanced static serving
app.static('/assets', './public', {
  maxAge: '1y',
  immutable: true,
  compress: 'auto', // gzip, brotli, or auto
  etag: true,
  lastModified: true,
  acceptRanges: true,
  memoryCache: true,
  maxFileSize: 1024 * 1024, // 1MB
  serveHidden: false,
  caseSensitive: true,
});

// Advanced static serving with custom headers
app.static('/downloads', './files', {
  compress: 'brotli',
  maxAge: '1d',
  setHeaders: (res, path, stat) => {
    if (path.endsWith('.pdf')) {
      res.setHeader('Content-Disposition', 'attachment');
    }
    res.setHeader('X-Custom-Header', 'NextRush');
  },
});

// SPA support
app.static('/', './dist', {
  spa: true,
  index: 'index.html',
  maxAge: '1h',
});
```

#### **Range Requests & Streaming**

```typescript
// Large file streaming with range support
app.static('/videos', './media', {
  acceptRanges: true,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  memoryCache: false, // Stream large files
  compress: false, // Don't compress videos
});
```

### 🍪 Enhanced Cookie Support

#### **Setting Cookies**

```typescript
app.post('/login', (req, res) => {
  // Enhanced cookie options
  res.cookie('session', sessionId, {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
  });

  res.cookie('preferences', userPrefs, {
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
    secure: req.secure(),
  });

  res.json({ success: true });
});

app.post('/logout', (req, res) => {
  res.clearCookie('session');
  res.clearCookie('preferences');
  res.json({ success: true });
});
```

### 📤 Enhanced Response Methods

#### **New Response Types**

```typescript
app.get('/api/users.csv', (req, res) => {
  const users = getUsers();
  res.csv(users, 'users-export.csv');
});

app.get('/api/report.pdf', (req, res) => {
  res.download('./reports/monthly.pdf', 'report.pdf');
});

// Enhanced file serving
app.get('/files/:filename', (req, res) => {
  const filePath = path.join('./uploads', req.params.filename);

  res.sendFile(filePath, {
    root: __dirname,
    maxAge: '1d',
    etag: true,
    lastModified: true,
    dotfiles: 'deny',
  });
});
```

#### **Advanced Response Features**

```typescript
app.get('/api/data', (req, res) => {
  // Chain response methods
  res
    .status(200)
    .cors('https://mydomain.com')
    .security()
    .cache(3600)
    .time('api-response')
    .json({ data: getData() });
});

// Permanent redirects
app.get('/old-url', (req, res) => {
  res.redirectPermanent('/new-url');
});

// Streaming responses
app.get('/stream', (req, res) => {
  const stream = createDataStream();
  res.stream(stream, 'application/json', {
    enableCompression: true,
  });
});
```

## 🔧 Configuration Examples

### Complete Production Setup

```typescript
import { createApp } from 'nextrush';

const app = createApp({
  // Enable enhanced features
  enhancedValidation: true,
  eventDriven: true,
  enhancedStatic: true,
});

// Security middleware
app.use(app.xssProtection());
app.use(app.sanitize({ removeHtml: true, escapeHtml: true }));

// Enhanced static files
app.static('/assets', './public', {
  maxAge: '1y',
  immutable: true,
  compress: 'auto',
  memoryCache: true,
});

// API with validation
app.use(
  '/api',
  app.validate({
    // Global validation rules
  })
);

// Event-driven features
app.on('error', (error) => {
  console.error('Application error:', error);
  // Send to error tracking service
});

app.listen(3000, () => {
  console.log('🚀 NextRush server running with enhanced features');
});
```

## 📊 Performance Features

- **Memory Caching**: Intelligent file caching with automatic eviction
- **Compression**: Automatic gzip/brotli compression
- **Range Requests**: Support for partial content delivery
- **ETag Support**: Conditional requests for better caching
- **Streaming**: Large file streaming without memory overhead

## 🛡️ Security Features

- **Input Validation**: Comprehensive validation rules
- **XSS Protection**: Automatic HTML sanitization
- **Security Headers**: Standard security headers
- **Cookie Security**: Secure cookie handling
- **CORS Support**: Flexible CORS configuration

## 🎯 Best Practices

1. **Always validate input data** using the validation middleware
2. **Enable compression** for text-based assets
3. **Use appropriate cache headers** for static files
4. **Implement event-driven patterns** for decoupled architecture
5. **Sanitize user input** to prevent XSS attacks
6. **Use secure cookie options** in production

## 🚀 Getting Started

```bash
npm install nextrush
```

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Enable all enhanced features
app.use(app.validate(validationSchema));
app.use(app.sanitize());
app.use(app.eventMiddleware({ autoEmit: true }));

app.static('/assets', './public', { compress: 'auto' });

app.listen(3000);
```

This enhanced version of NextRush provides enterprise-grade features while maintaining the simplicity and developer experience you expect from a modern web framework.
