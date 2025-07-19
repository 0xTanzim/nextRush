# Configuration

## Introduction

The NextRush framework provides extensive configuration options for applications, plugins, middleware, and deployment environments. This guide covers all configuration aspects including application options, environment-specific settings, plugin configurations, and production deployment setups.

## Public APIs

### Application Configuration

| Interface            | Description                             |
| -------------------- | --------------------------------------- |
| `ApplicationOptions` | Core application configuration options. |

#### ApplicationOptions Properties

| Property          | Type           | Default     | Description                      |
| ----------------- | -------------- | ----------- | -------------------------------- |
| `router`          | `Router`       | `undefined` | Custom router instance.          |
| `errorHandler`    | `ErrorHandler` | `undefined` | Custom error handler.            |
| `timeout`         | `number`       | `30000`     | Request timeout in milliseconds. |
| `maxRequestSize`  | `number`       | `100mb`     | Maximum request body size.       |
| `enableEvents`    | `boolean`      | `true`      | Enable application event system. |
| `enableWebSocket` | `boolean`      | `false`     | Enable WebSocket support.        |
| `caseSensitive`   | `boolean`      | `false`     | Enable case-sensitive routing.   |
| `strict`          | `boolean`      | `false`     | Enable strict routing mode.      |

### Environment Configuration

| Method                 | Signature                                 | Description                   |
| ---------------------- | ----------------------------------------- | ----------------------------- |
| `process.env.NODE_ENV` | `'development' \| 'production' \| 'test'` | Application environment mode. |
| `process.env.PORT`     | `number`                                  | Server port number.           |
| `process.env.HOST`     | `string`                                  | Server host address.          |

### Preset Configuration

| Method                     | Signature                                                        | Description                           |
| -------------------------- | ---------------------------------------------------------------- | ------------------------------------- |
| `usePreset(name, options)` | `(name: PresetName, options?: PresetOptions) => Application`     | Apply middleware preset with options. |
| `getPreset(name, options)` | `(name: string, options?: PresetOptions) => ExpressMiddleware[]` | Get preset middleware array.          |

#### Available Presets

| Preset Name    | Description                                    |
| -------------- | ---------------------------------------------- |
| `development`  | Development-friendly settings.                 |
| `production`   | Production-optimized security and performance. |
| `api`          | REST API optimized middleware.                 |
| `fullFeatured` | Enterprise-grade full feature set.             |
| `security`     | Maximum security headers and protection.       |
| `minimal`      | Basic functionality only.                      |

### Plugin Configuration

| Interface       | Description                                   |
| --------------- | --------------------------------------------- |
| `PresetOptions` | Configuration options for middleware presets. |

#### PresetOptions Properties

| Property      | Type                            | Default | Description                     |
| ------------- | ------------------------------- | ------- | ------------------------------- |
| `cors`        | `boolean \| CorsOptions`        | `true`  | CORS configuration.             |
| `helmet`      | `boolean \| HelmetOptions`      | `true`  | Security headers configuration. |
| `compression` | `boolean \| CompressionOptions` | `true`  | Response compression settings.  |
| `rateLimit`   | `boolean \| RateLimitOptions`   | `false` | Rate limiting configuration.    |
| `bodyParser`  | `boolean \| BodyParserOptions`  | `true`  | Request body parsing options.   |
| `logger`      | `boolean \| LoggerOptions`      | `true`  | Request logging configuration.  |
| `metrics`     | `boolean \| MetricsOptions`     | `false` | Performance metrics collection. |

## Usage Examples

### Basic Application Configuration

```typescript
import { createApp } from 'nextrush';

// Basic configuration
const app = createApp({
  timeout: 30000,
  maxRequestSize: '10mb',
  enableEvents: true,
  enableWebSocket: false,
  caseSensitive: false,
  strict: false,
});

app.listen(3000);
```

### Environment-Based Configuration

```typescript
import { createApp } from 'nextrush';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Environment-specific application options
const appOptions = {
  timeout: isDevelopment ? 60000 : 30000,
  maxRequestSize: isDevelopment ? '50mb' : '10mb',
  enableEvents: true,
  enableWebSocket: isDevelopment,
  caseSensitive: isProduction,
  strict: isProduction,
};

const app = createApp(appOptions);

// Environment-specific middleware
if (isDevelopment) {
  app.usePreset('development');
} else {
  app.usePreset('production', {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
      credentials: true,
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 100,
    },
  });
}

const port = process.env.PORT || (isDevelopment ? 3000 : 8080);
app.listen(port);
```

### Production Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp({
  timeout: 30000,
  maxRequestSize: '10mb',
  enableEvents: true,
  enableWebSocket: false,
  caseSensitive: true,
  strict: true,
});

// Production preset with custom options
app.usePreset('production', {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || [],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },
  compression: {
    level: 6,
    threshold: 1024,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX
      ? parseInt(process.env.RATE_LIMIT_MAX)
      : 100,
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
  },
  metrics: {
    endpoint: '/metrics',
    authentication: (req) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      return token === process.env.METRICS_TOKEN;
    },
  },
});

app.listen(process.env.PORT || 8080);
```

### Development Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp({
  timeout: 60000, // Longer timeout for debugging
  maxRequestSize: '50mb', // Larger requests for testing
  enableEvents: true,
  enableWebSocket: true, // Enable for testing
  caseSensitive: false,
  strict: false,
});

// Development preset with custom options
app.usePreset('development', {
  cors: true, // Allow all origins
  logger: {
    format: 'detailed',
    includeHeaders: true,
    includeBody: true,
  },
});

// Development middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

app.listen(3000);
```

### API Server Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp({
  timeout: 30000,
  maxRequestSize: '5mb',
  enableEvents: true,
  enableWebSocket: false,
  caseSensitive: false,
  strict: true, // Strict routing for APIs
});

// API preset configuration
app.usePreset('api', {
  cors: {
    origin: process.env.API_CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Client-Version',
    ],
  },
  bodyParser: {
    json: {
      limit: '5mb',
      strict: true,
    },
    urlencoded: {
      extended: true,
      limit: '5mb',
    },
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 1000, // Higher limit for APIs
    keyGenerator: (req) => {
      // Rate limit by API key if present, otherwise by IP
      return req.headers['x-api-key'] || req.ip;
    },
  },
});

app.listen(process.env.API_PORT || 3001);
```

### Full-Featured Enterprise Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp({
  timeout: 30000,
  maxRequestSize: '10mb',
  enableEvents: true,
  enableWebSocket: true,
  caseSensitive: true,
  strict: true,
});

// Full-featured preset with comprehensive options
app.usePreset('fullFeatured', {
  cors: {
    origin: (origin, callback) => {
      // Dynamic origin validation
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Client-Version',
    ],
    exposedHeaders: ['X-Rate-Limit-Remaining', 'X-Response-Time'],
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", process.env.CDN_URL],
        styleSrc: ["'self'", "'unsafe-inline'", process.env.CDN_URL],
        imgSrc: ["'self'", 'data:', 'https:', process.env.CDN_URL],
        fontSrc: ["'self'", process.env.CDN_URL],
        connectSrc: ["'self'", process.env.API_URL],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },
  compression: {
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      // Don't compress if client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Use compression for all other requests
      return true;
    },
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: (req) => {
      // Dynamic rate limiting based on user type
      if (req.headers['x-api-key']) {
        return 10000; // Higher limit for API keys
      }
      if (req.user?.role === 'premium') {
        return 1000; // Higher limit for premium users
      }
      return 100; // Default limit
    },
    keyGenerator: (req) => {
      return req.headers['x-api-key'] || req.user?.id || req.ip;
    },
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.round(req.rateLimit.resetTime / 1000),
      });
    },
  },
  logger: {
    format: 'json',
    includeHeaders: false,
    includeBody: false,
    excludePaths: ['/health', '/metrics'],
  },
  metrics: {
    endpoint: '/internal/metrics',
    format: 'prometheus',
    collectDefaultMetrics: true,
    requestTracking: true,
    authentication: (req) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      return token === process.env.INTERNAL_METRICS_TOKEN;
    },
  },
});

app.listen(process.env.PORT || 8080);
```

### Static Files Configuration

```typescript
import { createApp } from 'nextrush';

const app = createApp();

if (process.env.NODE_ENV === 'development') {
  // Development static file configuration
  app.static('/assets', './src/assets', {
    maxAge: 0, // No caching
    etag: false,
    compress: false,
    memoryCache: false,

    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store');
    },
  });
} else {
  // Production static file configuration
  app.static('/assets', './dist/assets', {
    maxAge: '1y',
    immutable: true,
    compress: 'auto',
    precompress: true,
    memoryCache: true,
    acceptRanges: true,

    setHeaders: (res, path) => {
      // Long-term caching for assets
      if (path.match(/\\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  });
}

app.listen(3000);
```

### Template Engine Configuration

```typescript
import { createApp, createTemplateEngine } from 'nextrush';

const app = createApp();

// Environment-based template configuration
if (process.env.NODE_ENV === 'development') {
  // Development: no caching, simple engine
  app.setViews('./src/views');
  app.setTemplateEngine(createTemplateEngine('simple'));
} else {
  // Production: caching enabled, mustache engine
  app.setViews('./dist/views');

  // Custom cached template engine
  class CachedTemplateEngine {
    private cache = new Map<string, string>();
    private baseEngine = createTemplateEngine('mustache');

    render(template: string, data: Record<string, any> = {}): string {
      return this.baseEngine.render(template, data);
    }

    async renderFile(
      filePath: string,
      data: Record<string, any> = {}
    ): Promise<string> {
      if (this.cache.has(filePath)) {
        const template = this.cache.get(filePath)!;
        return this.render(template, data);
      }

      const fs = await import('fs/promises');
      const template = await fs.readFile(filePath, 'utf-8');
      this.cache.set(filePath, template);

      return this.render(template, data);
    }
  }

  app.setTemplateEngine(new CachedTemplateEngine());
}

app.listen(3000);
```

## Configuration Options

### Environment Variables

```bash
# .env file for development
NODE_ENV=development
PORT=3000
HOST=localhost

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mydb

# Security
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
SESSION_SECRET=your-session-secret-key

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_MAX=100

# Metrics
METRICS_TOKEN=your-internal-metrics-token
INTERNAL_METRICS_TOKEN=your-super-secret-internal-token

# CDN and External Services
CDN_URL=https://cdn.example.com
API_URL=https://api.example.com
```

### Production Environment Variables

```bash
# .env.production
NODE_ENV=production
PORT=8080
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://produser:prodpassword@db.example.com:5432/proddb

# Security
JWT_SECRET=production-super-secret-jwt-key-minimum-64-characters
SESSION_SECRET=production-session-secret-key

# CORS
CORS_ORIGIN=https://myapp.com,https://www.myapp.com
ALLOWED_ORIGINS=https://myapp.com,https://www.myapp.com

# Rate Limiting
RATE_LIMIT_MAX=100

# Metrics
METRICS_TOKEN=production-metrics-token
INTERNAL_METRICS_TOKEN=production-internal-token

# CDN and External Services
CDN_URL=https://cdn.myapp.com
API_URL=https://api.myapp.com

# SSL/TLS
SSL_CERT_PATH=/path/to/ssl/cert.pem
SSL_KEY_PATH=/path/to/ssl/key.pem
```

### Docker Configuration

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - '8080:8080'
    environment:
      - NODE_ENV=production
      - PORT=8080
      - DATABASE_URL=postgresql://user:password@db:5432/mydb
      - JWT_SECRET=${JWT_SECRET}
      - CORS_ORIGIN=https://myapp.com
    depends_on:
      - db

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=mydb
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Kubernetes Configuration

```yaml
# k8s-config.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nextrush-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nextrush-app
  template:
    metadata:
      labels:
        app: nextrush-app
    spec:
      containers:
        - name: app
          image: nextrush-app:latest
          ports:
            - containerPort: 8080
          env:
            - name: NODE_ENV
              value: 'production'
            - name: PORT
              value: '8080'
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: jwt-secret
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '500m'
---
apiVersion: v1
kind: Service
metadata:
  name: nextrush-service
spec:
  selector:
    app: nextrush-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
  type: LoadBalancer
```

## Notes

- **Environment Variables**: Always use environment variables for sensitive configuration like secrets, database URLs, and API keys.

- **Configuration Validation**: Validate configuration at application startup to catch errors early.

- **Default Values**: Provide sensible defaults for all configuration options to ensure the application works out of the box.

- **Environment Separation**: Keep development, staging, and production configurations completely separate.

- **Security**: Never commit sensitive configuration values to version control. Use environment variables or secure secret management.

- **Performance**: Production configurations should prioritize security and performance over developer convenience.

- **Monitoring**: Include configuration for metrics, logging, and health checks in production environments.

- **Scalability**: Design configuration to support horizontal scaling and load balancing.

- **Flexibility**: Allow configuration overrides at multiple levels (environment variables, config files, runtime options).

- **Documentation**: Document all configuration options and their effects on application behavior.
