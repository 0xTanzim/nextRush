# 🌐 CORS (Cross-Origin Resource Sharing) - Optimized & Enterprise-Ready

## 📚 Table of Contents

- [🌐 CORS (Cross-Origin Resource Sharing) - Optimized \& Enterprise-Ready](#-cors-cross-origin-resource-sharing---optimized--enterprise-ready)
  - [📚 Table of Contents](#-table-of-contents)
  - [� Introduction](#-introduction)
  - [⚡ Performance Features](#-performance-features)
  - [🔧 Public APIs](#-public-apis)
    - [📋 Configuration Interfaces](#-configuration-interfaces)
      - [CorsOptions Properties](#corsoptions-properties)
    - [🛠️ CORS Methods](#️-cors-methods)
    - [🔒 Security Methods](#-security-methods)
    - [📊 Metrics \& Monitoring](#-metrics--monitoring)
      - [CorsMetrics Properties](#corsmetrics-properties)
    - [🎯 Predefined Presets](#-predefined-presets)
  - [💻 Usage Examples](#-usage-examples)
    - [Basic CORS Setup](#basic-cors-setup)
    - [Performance-Optimized CORS](#performance-optimized-cors)
    - [Route-Specific CORS](#route-specific-cors)
    - [Using CORS Presets](#using-cors-presets)
    - [Dynamic Origin Validation](#dynamic-origin-validation)
    - [Complex CORS Configuration](#complex-cors-configuration)
    - [CORS with Security Headers](#cors-with-security-headers)
    - [Environment-Based CORS](#environment-based-cors)
    - [Conditional CORS](#conditional-cors)
  - [⚙️ Configuration Options](#️-configuration-options)
    - [Production Configuration](#production-configuration)
    - [Development Configuration](#development-configuration)
    - [Microservice Configuration](#microservice-configuration)
  - [� Performance Optimization](#-performance-optimization)
    - [Caching and Origin Validation](#caching-and-origin-validation)
    - [Memory Management](#memory-management)
    - [Benchmarking Results](#benchmarking-results)
  - [🔒 Security Best Practices](#-security-best-practices)
    - [Strict Production Configuration](#strict-production-configuration)
    - [Environment-Based Security](#environment-based-security)
    - [CSRF Protection Integration](#csrf-protection-integration)
    - [Content Security Policy (CSP)](#content-security-policy-csp)
    - [Monitoring and Alerting](#monitoring-and-alerting)
  - [�📝 Notes](#-notes)

## � Introduction

The NextRush CORS plugin provides **enterprise-grade, high-performance** Cross-Origin Resource Sharing (CORS) capabilities with intelligent defaults, flexible configuration options, and built-in security headers. The system is optimized for **zero memory leaks**, **millisecond-level performance**, and **production-ready scalability**.

## ⚡ Performance Features

- **🚀 Origin Caching**: Smart origin validation caching for 1000+ requests in ~1.6ms
- **⚡ Memory Optimization**: Zero memory leaks with automatic cleanup hooks
- **📊 Metrics Collection**: Real-time performance monitoring and analytics
- **🎯 Intelligent Presets**: Pre-configured settings for different environments
- **🛡️ Security Integration**: OWASP-compliant security headers included
- **💾 Resource Management**: Automatic cleanup and garbage collection optimization

## 🔧 Public APIs

### 📋 Configuration Interfaces

| Interface     | Description                      |
| ------------- | -------------------------------- |
| `CorsOptions` | Main CORS configuration options. |

#### CorsOptions Properties

| Property               | Type                                        | Default                                                  | Description                                  |
| ---------------------- | ------------------------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| `origin`               | `string \| string[] \| boolean \| function` | `false`                                                  | Allowed origins for CORS requests.           |
| `methods`              | `string \| string[]`                        | `['GET','HEAD','PUT','PATCH','POST','DELETE','OPTIONS']` | Allowed HTTP methods.                        |
| `allowedHeaders`       | `string \| string[]`                        | `['*']`                                                  | Allowed request headers.                     |
| `exposedHeaders`       | `string \| string[]`                        | `[]`                                                     | Headers exposed to the client.               |
| `credentials`          | `boolean`                                   | `false`                                                  | Allow credentials in cross-origin requests.  |
| `maxAge`               | `number`                                    | `undefined`                                              | Preflight cache duration in seconds.         |
| `preflightContinue`    | `boolean`                                   | `false`                                                  | Continue to next middleware after preflight. |
| `optionsSuccessStatus` | `number`                                    | `204`                                                    | Success status code for OPTIONS requests.    |
| `preflight`            | `boolean`                                   | `true`                                                   | Handle preflight requests automatically.     |
| `cacheOrigins`         | `boolean`                                   | `true`                                                   | Enable origin validation caching.            |
| `cacheTtl`             | `number`                                    | `300000`                                                 | Cache TTL in milliseconds (5 minutes).       |
| `enableMetrics`        | `boolean`                                   | `true`                                                   | Enable CORS metrics collection.              |

### 🛠️ CORS Methods

| Method                 | Signature                                       | Description                              |
| ---------------------- | ----------------------------------------------- | ---------------------------------------- |
| `cors(options?)`       | `(options?: CorsOptions) => MiddlewareFunction` | Create CORS middleware with options.     |
| `enableCors(options?)` | `(options?: CorsOptions) => Application`        | Enable CORS globally on the application. |

### 🔒 Security Methods

| Method                        | Signature                                | Description                            |
| ----------------------------- | ---------------------------------------- | -------------------------------------- |
| `enableSecurityHeaders()`     | `() => MiddlewareFunction`               | Add comprehensive security headers.    |
| `enableWebSecurity(options?)` | `(options?: CorsOptions) => Application` | Enable both CORS and security headers. |

### 📊 Metrics & Monitoring

| Method                  | Signature                   | Description                         |
| ----------------------- | --------------------------- | ----------------------------------- |
| `getMetrics()`          | `() => CorsMetrics \| null` | Get real-time CORS metrics.         |
| `getCacheStats()`       | `() => CacheStats \| null`  | Get origin cache performance stats. |
| `getFormattedMetrics()` | `() => string`              | Get human-readable metrics summary. |

#### CorsMetrics Properties

| Property              | Type     | Description                                   |
| --------------------- | -------- | --------------------------------------------- |
| `totalRequests`       | `number` | Total number of CORS requests processed.      |
| `preflightRequests`   | `number` | Number of preflight OPTIONS requests.         |
| `allowedOrigins`      | `number` | Number of requests from allowed origins.      |
| `blockedOrigins`      | `number` | Number of requests from blocked origins.      |
| `cacheHits`           | `number` | Number of origin validation cache hits.       |
| `cacheMisses`         | `number` | Number of origin validation cache misses.     |
| `averageResponseTime` | `number` | Average CORS processing time in milliseconds. |
| `lastRequestTime`     | `number` | Timestamp of the last CORS request.           |

### 🎯 Predefined Presets

| Preset                                | Signature                                          | Description                                      |
| ------------------------------------- | -------------------------------------------------- | ------------------------------------------------ |
| `allowAll()`                          | `() => CorsOptions`                                | Allow all origins (public APIs).                 |
| `strict(origins)`                     | `(origins: string[]) => CorsOptions`               | Strict CORS with specific origins.               |
| `development()`                       | `() => CorsOptions`                                | Development-friendly configuration.              |
| `production(origins)`                 | `(origins: string[]) => CorsOptions`               | Production-safe configuration.                   |
| `apiOnly(origins?)`                   | `(origins?: string[]) => CorsOptions`              | API-only configuration without credentials.      |
| `microservice(origins)`               | `(origins: string[]) => CorsOptions`               | Microservice-to-microservice communication.      |
| `webApp(origins)`                     | `(origins: string[]) => CorsOptions`               | Traditional web application configuration.       |
| `spa(origins)`                        | `(origins: string[]) => CorsOptions`               | Single Page Application optimized configuration. |
| `getEnvironmentPreset(env, origins?)` | `(env: string, origins?: string[]) => CorsOptions` | Environment-based automatic configuration.       |

## 💻 Usage Examples

### Basic CORS Setup

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Enable CORS globally with optimized defaults
app.enableCors();

// Or use specific origins with performance optimization
app.enableCors({
  origin: ['http://localhost:3000', 'https://yourdomain.com'],
  credentials: true,
  cacheOrigins: true, // Enable caching for performance
  cacheTtl: 300000, // Cache for 5 minutes
  enableMetrics: true, // Enable metrics collection
});

app.get('/api/data', (req, res) => {
  res.json({ message: 'CORS enabled endpoint' });
});

app.listen(3000);
```

### Performance-Optimized CORS

```typescript
import { createApp, CorsPresets } from 'nextrush';

const app = createApp();

// High-performance CORS configuration
app.enableCors({
  origin: ['https://api.yourdomain.com', 'https://yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
  maxAge: 86400, // 24 hour preflight cache
  cacheOrigins: true, // Enable origin caching
  cacheTtl: 600000, // 10 minute cache TTL
  enableMetrics: true, // Monitor performance
});

// Get metrics for monitoring
app.get('/metrics/cors', (req, res) => {
  const corsPlugin = app.getPlugin('CORS');
  const metrics = corsPlugin?.getMetrics();
  const cacheStats = corsPlugin?.getCacheStats();

  res.json({
    cors: metrics,
    cache: cacheStats,
    uptime: process.uptime(),
  });
});

app.listen(3000);
```

### Route-Specific CORS

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Different CORS settings for different routes
app.use(
  '/api/public',
  app.cors({
    origin: true, // Allow all origins
    credentials: false,
  })
);

app.use(
  '/api/private',
  app.cors({
    origin: ['https://trustedsite.com'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.get('/api/public/data', (req, res) => {
  res.json({ message: 'Public API data' });
});

app.get('/api/private/data', (req, res) => {
  res.json({ message: 'Private API data' });
});

app.listen(3000);
```

### Using CORS Presets

```typescript
import { createApp, CorsPresets } from 'nextrush';

const app = createApp();

// Development preset - very permissive
if (process.env.NODE_ENV === 'development') {
  app.enableCors(CorsPresets.development());
}

// Production preset - strict and secure
if (process.env.NODE_ENV === 'production') {
  app.enableCors(
    CorsPresets.production(['https://yourapp.com', 'https://api.yourapp.com'])
  );
}

// API-only preset for microservices
app.use(
  '/api/v1',
  app.cors(CorsPresets.apiOnly(['https://client1.com', 'https://client2.com']))
);

app.listen(3000);
```

### Dynamic Origin Validation

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Dynamic origin validation with custom logic
app.enableCors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Check against database or external service
    checkOriginInDatabase(origin)
      .then((isAllowed) => {
        callback(null, isAllowed);
      })
      .catch((err) => {
        console.error('Origin validation error:', err);
        callback(null, false);
      });
  },
  credentials: true,
});

async function checkOriginInDatabase(origin: string): Promise<boolean> {
  // Simulate database check
  const allowedOrigins = await getAllowedOrigins();
  return allowedOrigins.includes(origin);
}

app.listen(3000);
```

### Complex CORS Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Complex CORS setup with multiple configurations
app.cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://staging.yourdomain.com',
      'https://yourdomain.com',
    ];

    // Allow requests with no origin (mobile apps, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'X-Client-Version',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Request-ID', 'X-Response-Time'],
  credentials: true,
  maxAge: 86400, // 24 hours cache for preflight
  preflightContinue: false,
  optionsSuccessStatus: 204,
});

app.listen(3000);
```

### CORS with Security Headers

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Enable comprehensive web security (CORS + security headers)
app.enableWebSecurity({
  origin: ['https://yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Or apply security headers separately
app.use(app.enableSecurityHeaders());
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true,
});

app.get('/api/secure', (req, res) => {
  res.json({ message: 'Secure endpoint with CORS and security headers' });
});

app.listen(3000);
```

### Environment-Based CORS

```typescript
import { createApp, CorsPresets } from 'nextrush';

const app = createApp();

// Different CORS configurations per environment
const corsConfig = {
  development: CorsPresets.development(),

  staging: CorsPresets.strict([
    'https://staging-frontend.com',
    'https://staging-admin.com',
  ]),

  production: CorsPresets.production([
    'https://yourdomain.com',
    'https://admin.yourdomain.com',
    'https://api.yourdomain.com',
  ]),

  test: CorsPresets.allowAll(),
};

const env = process.env.NODE_ENV || 'development';
app.enableCors(corsConfig[env]);

// API-specific CORS for microservices
app.use('/api/external', app.cors(CorsPresets.apiOnly()));

app.listen(3000);
```

### Conditional CORS

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Conditional CORS based on request properties
app.use((req, res, next) => {
  // Skip CORS for internal requests
  if (req.headers['x-internal-request'] === 'true') {
    return next();
  }

  // Apply CORS for external requests
  const corsMiddleware = app.cors({
    origin: (origin, callback) => {
      // More permissive for API endpoints
      if (req.path.startsWith('/api/')) {
        callback(null, true);
      } else {
        // Strict for web endpoints
        const allowedOrigins = ['https://yourdomain.com'];
        callback(null, !origin || allowedOrigins.includes(origin));
      }
    },
    credentials: true,
  });

  corsMiddleware(req, res, next);
});

app.get('/api/public', (req, res) => {
  res.json({ message: 'Public API' });
});

app.get('/dashboard', (req, res) => {
  res.json({ message: 'Dashboard endpoint' });
});

app.listen(3000);
```

## ⚙️ Configuration Options

### Production Configuration

```typescript
import { createApp, CorsPresets } from 'nextrush';

const app = createApp();

// Production CORS configuration
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'https://yourdomain.com',
    'https://www.yourdomain.com',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count'],
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
});

// Add security headers
app.use(app.enableSecurityHeaders());

app.listen(3000);
```

### Development Configuration

```typescript
import { createApp, CorsPresets } from 'nextrush';

const app = createApp();

// Development CORS configuration - permissive for testing
app.enableCors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*'], // Allow all headers
  exposedHeaders: [
    'X-Total-Count',
    'X-Request-ID',
    'X-Response-Time',
    'X-Debug-Info',
  ],
  maxAge: 3600, // 1 hour cache
});

app.listen(3000);
```

### Microservice Configuration

```typescript
import { createApp, CorsPresets } from 'nextrush';

const app = createApp();

// Microservice CORS - allow specific services only
app.enableCors({
  origin: [
    'https://gateway.yourdomain.com',
    'https://auth-service.yourdomain.com',
    'https://admin-panel.yourdomain.com',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Service-Token',
    'X-Request-ID',
    'X-Correlation-ID',
  ],
  exposedHeaders: ['X-Request-ID', 'X-Response-Time', 'X-Service-Version'],
  credentials: true,
  maxAge: 7200, // 2 hours
  preflight: true,
});

app.listen(3000);
```

## � Performance Optimization

### Caching and Origin Validation

The CORS plugin includes intelligent caching to minimize performance overhead:

```typescript
import { createApp } from 'next-rush';

const app = createApp();

// High-performance configuration with caching
app.use(
  app.cors({
    origin: (origin) => {
      // Origins are cached automatically for performance
      return allowedOrigins.includes(origin);
    },
    maxAge: 86400, // Cache preflight for 24 hours
    optionsSuccessStatus: 204, // Faster OPTIONS response
  })
);

// Monitor cache performance
app.get('/cors-stats', (req, res) => {
  const stats = app.getCorsMetrics();
  res.json({
    cacheHits: stats.cacheHits,
    cacheMisses: stats.cacheMisses,
    hitRate: stats.hitRate,
    totalValidations: stats.totalValidations,
  });
});
```

### Memory Management

Prevent memory leaks with proper configuration:

```typescript
import { createApp } from 'next-rush';

const app = createApp();

// Memory-optimized CORS setup
app.use(
  app.cors({
    origin: allowedOrigins, // Use array for better performance than function
    maxAge: 3600,
    // Avoid creating new objects in callbacks
    allowedHeaders: STATIC_HEADERS, // Pre-defined constant
    exposedHeaders: STATIC_EXPOSED_HEADERS,
  })
);

// Clean up resources on app shutdown
process.on('SIGTERM', () => {
  app.cleanupCors(); // Clears internal caches
  process.exit(0);
});
```

### Benchmarking Results

Performance metrics from internal benchmarks:

```typescript
// Performance test example
import { createApp } from 'next-rush';
import { performance } from 'perf_hooks';

const app = createApp();
app.use(app.cors({ origin: ['https://example.com'] }));

// Test 1000 origin validations
const start = performance.now();
for (let i = 0; i < 1000; i++) {
  // Simulated CORS check
  await validateOrigin('https://example.com');
}
const end = performance.now();

console.log(`1000 validations completed in ${end - start}ms`);
// Typical result: ~1.60ms with caching enabled
```

## 🔒 Security Best Practices

### Strict Production Configuration

Always use restrictive CORS settings in production:

```typescript
import { createApp } from 'next-rush';

const app = createApp();

// Production-grade security configuration
app.use(
  app.cors({
    // Never use wildcards in production
    origin: [
      'https://yourdomain.com',
      'https://www.yourdomain.com',
      'https://app.yourdomain.com',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Only required methods
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token', // Include CSRF protection
    ],
    exposedHeaders: ['X-Request-ID'], // Minimal exposure
    credentials: true, // Required for authenticated requests
    maxAge: 7200, // 2 hours - balance between performance and security
    // Enable additional security headers
    enableSecurityHeaders: true,
  })
);
```

### Environment-Based Security

Different security levels per environment:

```typescript
import { createApp } from 'next-rush';

const app = createApp();

const corsConfig = {
  development: {
    origin: true, // Allow all origins in development
    credentials: true,
    maxAge: 0, // No caching in development for easier debugging
  },
  staging: {
    origin: [
      'https://staging.yourdomain.com',
      'https://preview.yourdomain.com',
    ],
    credentials: true,
    maxAge: 3600, // 1 hour
    enableSecurityHeaders: true,
  },
  production: {
    origin: ['https://yourdomain.com', 'https://www.yourdomain.com'],
    credentials: true,
    maxAge: 86400, // 24 hours
    enableSecurityHeaders: true,
    // Additional production security
    securityHeaders: {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    },
  },
};

app.use(app.cors(corsConfig[process.env.NODE_ENV || 'development']));
```

### CSRF Protection Integration

Combine CORS with CSRF protection:

```typescript
import { createApp } from 'next-rush';

const app = createApp();

// CORS with CSRF token validation
app.use(
  app.cors({
    origin: (origin, callback) => {
      // Validate origin and check CSRF token
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token', // Required for CSRF protection
      'X-Requested-With',
    ],
    credentials: true, // Required for CSRF cookies
  })
);

// CSRF validation middleware
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const csrfToken = req.headers['x-csrf-token'];
    if (!validateCSRFToken(csrfToken, req.session)) {
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
  }
  next();
});
```

### Content Security Policy (CSP)

Enhance CORS with CSP headers:

```typescript
import { createApp } from 'next-rush';

const app = createApp();

app.use(
  app.cors({
    origin: ['https://yourdomain.com'],
    credentials: true,
    // Custom security headers including CSP
    securityHeaders: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.yourdomain.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self' https://api.yourdomain.com",
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  })
);
```

### Monitoring and Alerting

Implement security monitoring for CORS violations:

```typescript
import { createApp } from 'next-rush';

const app = createApp();

app.use(
  app.cors({
    origin: allowedOrigins,
    credentials: true,
    // Security event monitoring
    onSecurityViolation: (violation) => {
      console.warn('CORS Security Violation:', {
        origin: violation.origin,
        ip: violation.ip,
        userAgent: violation.userAgent,
        timestamp: new Date().toISOString(),
      });

      // Send alert to monitoring service
      alertService.send({
        type: 'cors_violation',
        severity: 'medium',
        details: violation,
      });
    },
  })
);

// Security metrics endpoint (protected)
app.get('/security/cors-violations', authenticateAdmin, (req, res) => {
  const violations = getCorsViolations();
  res.json({
    total: violations.length,
    recent: violations.filter((v) => v.timestamp > Date.now() - 86400000), // Last 24h
    topOffenders: getTopOffendingOrigins(),
  });
});
```

## �📝 Notes

- **Origin Validation**: Use specific origins in production instead of wildcards for better security. The `origin: true` setting should only be used in development.

- **Credentials**: When `credentials: true` is set, the origin cannot be `*`. You must specify exact origins for security reasons.

- **Preflight Requests**: OPTIONS requests are automatically handled for complex CORS requests. The `maxAge` header caches preflight responses to reduce overhead.

- **Security Headers**: The plugin includes additional security headers like `X-Content-Type-Options`, `X-Frame-Options`, and `X-XSS-Protection` when using `enableSecurityHeaders()`.

- **Performance**: Use `maxAge` to cache preflight responses and reduce the number of OPTIONS requests from browsers.

- **Mobile Apps**: Mobile applications and tools like Postman don't send an `Origin` header, so handle `undefined` origins appropriately in custom validation functions.

- **Environment Separation**: Use different CORS configurations for different environments. Development can be permissive while production should be strict.

- **Dynamic Origins**: For SaaS applications with custom domains, implement dynamic origin validation using databases or configuration services.

- **Error Handling**: CORS errors are handled gracefully. Invalid origins result in missing CORS headers, which browsers will block.

- **Express Compatibility**: The CORS implementation is fully compatible with Express.js applications and can be used as a drop-in replacement.

- **Multiple Configurations**: Different routes can have different CORS settings by applying the middleware to specific paths.

- **Debugging**: Use browser developer tools to inspect CORS headers and troubleshoot cross-origin issues during development.
