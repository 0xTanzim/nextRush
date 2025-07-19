# 🌐 CORS (Cross-Origin Resource Sharing)

## 📚 Table of Contents

- [🌐 CORS (Cross-Origin Resource Sharing)](#-cors-cross-origin-resource-sharing)
  - [📚 Table of Contents](#-table-of-contents)
  - [📖 Introduction](#-introduction)
  - [🔧 Public APIs](#-public-apis)
    - [📋 Configuration Interfaces](#-configuration-interfaces)
      - [CorsOptions Properties](#corsoptions-properties)
    - [🛠️ CORS Methods](#️-cors-methods)
    - [🔒 Security Methods](#-security-methods)
    - [🎯 Predefined Presets](#-predefined-presets)
  - [💻 Usage Examples](#-usage-examples)
    - [Basic CORS Setup](#basic-cors-setup)
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
  - [📝 Notes](#-notes)

## 📖 Introduction

The NextRush CORS plugin provides comprehensive Cross-Origin Resource Sharing (CORS) capabilities with intelligent defaults, flexible configuration options, and built-in security headers. It handles preflight requests, origin validation, credential management, and provides multiple preset configurations for common use cases.

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

### 🎯 Predefined Presets

| Preset                | Signature                             | Description                                 |
| --------------------- | ------------------------------------- | ------------------------------------------- |
| `allowAll()`          | `() => CorsOptions`                   | Allow all origins (public APIs).            |
| `strict(origins)`     | `(origins: string[]) => CorsOptions`  | Strict CORS with specific origins.          |
| `development()`       | `() => CorsOptions`                   | Development-friendly configuration.         |
| `production(origins)` | `(origins: string[]) => CorsOptions`  | Production-safe configuration.              |
| `apiOnly(origins?)`   | `(origins?: string[]) => CorsOptions` | API-only configuration without credentials. |

## 💻 Usage Examples

### Basic CORS Setup

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Enable CORS globally with default settings
app.enableCors();

// Or use specific origins
app.enableCors({
  origin: ['http://localhost:3000', 'https://yourdomain.com'],
  credentials: true,
});

app.get('/api/data', (req, res) => {
  res.json({ message: 'CORS enabled endpoint' });
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

## 📝 Notes

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
