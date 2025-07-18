# 🌐 CORS (Cross-Origin Resource Sharing) Guide

NextRush provides built-in CORS support with smart defaults and comprehensive security features. This guide covers all CORS configuration options and best practices.

## Quick Start

```typescript
import { createApp, CorsPresets } from 'nextrush';

const app = createApp();

// Enable CORS with default settings
app.enableCors();

// Or use predefined presets
app.enableCors(CorsPresets.development());

// Enable CORS with security headers
app.enableWebSecurity();

app.listen(3000);
```

## Configuration Options

### Basic CORS Configuration

```typescript
app.cors({
  origin: 'https://example.com', // Single origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
```

### Multiple Origins

```typescript
app.cors({
  origin: [
    'https://app.example.com',
    'https://admin.example.com',
    'http://localhost:3000',
  ],
  credentials: true,
});
```

### Dynamic Origin Validation

```typescript
app.cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);

    // Check against allowed domains
    const allowedDomains = ['example.com', 'subdomain.example.com'];

    const hostname = new URL(origin).hostname;
    const isAllowed = allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );

    callback(null, isAllowed);
  },
});
```

## CORS Presets

### Development Preset

```typescript
// Permissive settings for development
app.enableCors(CorsPresets.development());

// Equivalent to:
app.cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*'],
  exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
});
```

### Production Preset

```typescript
// Secure settings for production
app.enableCors(
  CorsPresets.production(['https://myapp.com', 'https://admin.myapp.com'])
);

// Equivalent to:
app.cors({
  origin: ['https://myapp.com', 'https://admin.myapp.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400, // 24 hours
});
```

### API-Only Preset

```typescript
// For public APIs without credentials
app.enableCors(CorsPresets.apiOnly());

// With specific origins
app.enableCors(
  CorsPresets.apiOnly(['https://partner1.com', 'https://partner2.com'])
);
```

### Strict Preset

```typescript
// Very restrictive for sensitive applications
app.enableCors(CorsPresets.strict(['https://secure-app.com']));
```

## Advanced Features

### Route-Specific CORS

```typescript
// Different CORS policies for different routes
app.get(
  '/api/public/*',
  app.cors({ origin: true, credentials: false }),
  (req, res) => {
    res.json({ data: 'public' });
  }
);

app.get(
  '/api/private/*',
  app.cors({
    origin: ['https://secure.example.com'],
    credentials: true,
  }),
  (req, res) => {
    res.json({ data: 'private' });
  }
);
```

### Conditional CORS

```typescript
app.use((req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    app.cors({
      origin: ['https://myapp.com'],
      credentials: true,
    })(req, res, next);
  } else {
    app.cors({
      origin: true,
      credentials: true,
    })(req, res, next);
  }
});
```

### Custom Headers

```typescript
app.cors({
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Requested-With',
    'X-Custom-Header',
  ],
  exposedHeaders: [
    'X-Total-Count',
    'X-Page-Count',
    'X-Request-ID',
    'X-Response-Time',
  ],
});
```

## Security Headers

### Enable All Security Headers

```typescript
app.enableWebSecurity({
  origin: ['https://myapp.com'],
  credentials: true,
});

// This sets:
// - CORS headers
// - X-Content-Type-Options: nosniff
// - X-Frame-Options: DENY
// - X-XSS-Protection: 1; mode=block
// - Referrer-Policy: strict-origin-when-cross-origin
// - Permissions-Policy: geolocation=(), microphone=(), camera=()
// - Strict-Transport-Security (for HTTPS)
```

### Custom Security Headers

```typescript
app.use(app.enableSecurityHeaders());

// Add custom security headers
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'"
  );
  res.setHeader('X-Custom-Security', 'enabled');
  next();
});
```

## Preflight Requests

### Understanding Preflight

```typescript
// Preflight is automatically handled for:
// - Non-simple methods (PUT, DELETE, PATCH)
// - Custom headers
// - Content-Type other than application/x-www-form-urlencoded,
//   multipart/form-data, or text/plain

app.cors({
  // Control preflight caching
  maxAge: 86400, // 24 hours

  // Continue to next middleware after preflight
  preflightContinue: false,

  // Success status for preflight
  optionsSuccessStatus: 204,
});
```

### Custom Preflight Handling

```typescript
app.cors({
  preflightContinue: true,
});

// Custom preflight logic
app.options('*', (req, res) => {
  // Custom preflight validation
  const origin = req.headers.origin;
  const method = req.headers['access-control-request-method'];

  if (origin && method) {
    // Log preflight requests
    console.log(`Preflight: ${origin} wants to ${method}`);
  }

  res.end();
});
```

## Error Handling

### CORS Errors

```typescript
app.cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowed = ['https://example.com'];
    if (allowed.includes(origin)) {
      callback(null, true);
    } else {
      // Log rejected origins
      console.warn(`CORS rejected origin: ${origin}`);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
});

// Global error handler
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({
      error: 'CORS Error',
      message: 'Origin not allowed',
    });
  } else {
    next(err);
  }
});
```

## Best Practices

### 1. Environment-Specific Configuration

```typescript
const corsOptions = {
  development: CorsPresets.development(),
  production: CorsPresets.production([
    'https://myapp.com',
    'https://admin.myapp.com',
  ]),
  test: { origin: 'http://localhost:3000' },
};

app.enableCors(corsOptions[process.env.NODE_ENV] || corsOptions.development);
```

### 2. Whitelist Management

```typescript
// Centralized whitelist
const allowedOrigins = [
  'https://myapp.com',
  'https://admin.myapp.com',
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
];

app.cors({
  origin: allowedOrigins,
  credentials: true,
});
```

### 3. Credential Handling

```typescript
// Secure credential handling
app.cors({
  origin: (origin, callback) => {
    // Never allow credentials with wildcard origin
    if (!origin) {
      callback(null, false); // Reject requests without origin when using credentials
    } else {
      callback(null, allowedOrigins.includes(origin));
    }
  },
  credentials: true,
});
```

### 4. Mobile App Support

```typescript
app.cors({
  origin: (origin, callback) => {
    // Allow mobile apps (no origin header)
    if (!origin) return callback(null, true);

    // Check web origins
    callback(null, allowedOrigins.includes(origin));
  },
  credentials: false, // Usually not needed for mobile apps
});
```

## Integration Examples

### With Authentication

```typescript
// Public endpoints - permissive CORS
app.get(
  '/api/public/*',
  app.cors({ origin: true, credentials: false }),
  (req, res) => {
    res.json({ data: 'public' });
  }
);

// Protected endpoints - strict CORS
app.get(
  '/api/protected/*',
  app.cors({
    origin: allowedOrigins,
    credentials: true,
  }),
  app.requireAuth(),
  (req, res) => {
    res.json({ data: 'protected' });
  }
);
```

### With Rate Limiting

```typescript
// Apply CORS before rate limiting
app.use(app.cors({ origin: allowedOrigins }));
app.use(app.useRateLimit({ max: 100, windowMs: 60000 }));
```

### With API Documentation

```typescript
app.doc('/api/data', 'GET', {
  summary: 'Get data with CORS support',
  description: 'Supports cross-origin requests from allowed domains',
  responses: {
    '200': { description: 'Success' },
    '403': { description: 'CORS policy violation' },
  },
});
```

## Troubleshooting

### Common CORS Issues

1. **Credentials with wildcard origin**: Can't use `credentials: true` with `origin: "*"`
2. **Missing preflight headers**: Ensure `allowedHeaders` includes custom headers
3. **Browser caching**: Preflight responses are cached; check `maxAge` setting

### Debug CORS Issues

```typescript
app.cors({
  origin: (origin, callback) => {
    console.log(`CORS request from origin: ${origin}`);

    const allowed = allowedOrigins.includes(origin);
    console.log(`Origin ${origin} allowed: ${allowed}`);

    callback(null, allowed);
  },
});

// Log all CORS headers
app.use((req, res, next) => {
  console.log('CORS Headers:', {
    origin: req.headers.origin,
    method: req.headers['access-control-request-method'],
    headers: req.headers['access-control-request-headers'],
  });
  next();
});
```

### Testing CORS

```bash
# Test simple CORS request
curl -H "Origin: https://example.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://localhost:3000/api/data

# Test with credentials
curl -H "Origin: https://example.com" \
     -H "Cookie: session=abc123" \
     http://localhost:3000/api/data
```

This CORS implementation provides comprehensive cross-origin support while maintaining security best practices.
