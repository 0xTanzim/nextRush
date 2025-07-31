# 🔧 NextRush v2 Middleware System

## 📚 Overview

NextRush v2 provides a **high-performance, type-safe middleware system** built with zero dependencies and optimized for modern web applications.

## 🚀 Quick Start

```typescript
import { createApp } from '@/index';

const app = createApp();

// Security middleware
app.use(app.helmet());
app.use(app.cors());

// Body parsing
app.use(app.json({ limit: '10mb' }));
app.use(app.urlencoded({ extended: true }));

// Request tracking
app.use(app.requestId());
app.use(app.timer());

// Rate limiting
app.use(app.rateLimit({ max: 100, windowMs: 15 * 60 * 1000 }));

// Logging
app.use(app.logger());

app.listen(3000);
```

## 🔧 Usage Patterns - Both Supported!

### ✅ Pattern 1: `app.use(app.helmet())` (Recommended)

```typescript
import { createApp } from '@/index';

const app = createApp();

// Use app factory methods
app.use(app.helmet());
app.use(app.cors());
app.use(app.rateLimit({ max: 100 }));
app.use(app.json());
app.use(app.logger());
```

### ✅ Pattern 2: `app.use(helmet())` (Direct Import)

```typescript
import { createApp } from '@/index';
import { helmet, cors, rateLimit, json, logger } from '@/core/middleware';

const app = createApp();

// Use direct imports
app.use(helmet());
app.use(cors());
app.use(rateLimit({ max: 100 }));
app.use(json());
app.use(logger());
```

**🎯 Developer Preference**: Both patterns work identically! Choose based on your preference.

## 📦 Core Middleware

### 🛡️ Security Middleware

#### Helmet (Security Headers)

```typescript
// Basic security headers
app.use(app.helmet());

// Advanced configuration
app.use(
  app.helmet({
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
  })
);
```

#### CORS (Cross-Origin Resource Sharing)

```typescript
// Basic CORS
app.use(app.cors());

// Advanced CORS
app.use(
  app.cors({
    origin: ['https://app.example.com', 'https://admin.example.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400,
  })
);
```

### 📦 Body Parser Middleware

#### JSON Parser

```typescript
// Basic JSON parsing
app.use(app.json());

// Advanced JSON parsing
app.use(
  app.json({
    limit: '10mb',
    strict: true,
    reviver: (key, value) => {
      if (key === 'date') return new Date(value);
      return value;
    },
  })
);
```

#### URL-Encoded Parser

```typescript
// Basic URL-encoded parsing
app.use(app.urlencoded({ extended: true }));

// Advanced URL-encoded parsing
app.use(
  app.urlencoded({
    limit: '10mb',
    extended: true,
    parameterLimit: 1000,
  })
);
```

### 🚦 Rate Limiting

```typescript
// Basic rate limiting
app.use(
  app.rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
  })
);

// Route-specific rate limiting
app.use(
  '/api/auth/login',
  app.rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // 5 login attempts per 15 minutes
    skipSuccessfulRequests: true,
  })
);
```

### 📊 Logging & Monitoring

#### Logger

```typescript
// Basic logging
app.use(app.logger());

// Advanced logging
app.use(
  app.logger({
    format: 'detailed', // 'simple' | 'detailed' | 'json' | 'combined'
    level: 'info',
    colorize: true,
    timestamp: true,
    showHeaders: true,
    showBody: false,
    showQuery: true,
    showResponseTime: true,
    showUserAgent: true,
    showIP: true,
  })
);
```

#### Request ID

```typescript
// Basic request ID
app.use(app.requestId());

// Advanced request ID
app.use(
  app.requestId({
    headerName: 'X-Request-ID',
    generator: () =>
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    addResponseHeader: true,
    echoHeader: true,
    setInContext: true,
    includeInLogs: true,
  })
);
```

#### Timer

```typescript
// Basic response time tracking
app.use(app.timer());

// Advanced timer configuration
app.use(
  app.timer({
    header: 'X-Response-Time',
    digits: 3,
    format: 'milliseconds',
    includeStartTime: true,
    includeEndTime: true,
    includeDuration: true,
    logSlow: true,
    logSlowThreshold: 1000, // 1 second
  })
);
```

### 🗜️ Compression

```typescript
// Basic compression
app.use(app.compression());

// Advanced compression
app.use(
  app.compression({
    level: 6,
    threshold: 1024,
    contentType: ['text/html', 'text/css', 'application/javascript'],
    exclude: ['image/*', 'video/*'],
    gzip: true,
    deflate: true,
    brotli: true,
  })
);
```

## 🔧 Multiple Router Files (20-50 files, 200-300 routes)

### Pattern 1: Centralized Middleware (Recommended)

```typescript
// app.ts - Central middleware configuration
import { createApp } from '@/index';

const app = createApp();

// Global middleware applied to all routes
app.use(app.helmet());
app.use(app.cors());
app.use(app.json());
app.use(app.logger());
app.use(app.requestId());
app.use(app.timer());

// Import route files
import './routes/auth';
import './routes/users';
import './routes/products';
import './routes/orders';
// ... 20-50 more route files

app.listen(3000);
```

### Pattern 2: Route-Specific Middleware

```typescript
// routes/auth.ts
import { Router } from '@/core/router';

const authRouter = Router('/auth');

// Route-specific middleware
authRouter.use(app.rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }));
authRouter.use(app.json({ limit: '1mb' }));

authRouter.post('/login', ctx => {
  // Login logic
});

authRouter.post('/register', ctx => {
  // Registration logic
});

export default authRouter;
```

### Pattern 3: Middleware Groups

```typescript
// middleware/security.ts
import { helmet, cors, rateLimit } from '@/core/middleware';

export const securityMiddleware = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
      },
    },
  }),
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || false,
    credentials: true,
  }),
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  }),
];

// app.ts
import { securityMiddleware } from './middleware/security';

const app = createApp();

// Apply security middleware to all routes
securityMiddleware.forEach(middleware => app.use(middleware));

// Import route files
import './routes/auth';
import './routes/users';
// ... more routes
```

## 🔧 Simplified DX (Developer Experience)

### 1. Middleware Composition

```typescript
// Compose multiple middleware
const apiMiddleware = [
  app.cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') }),
  app.helmet(),
  app.json({ limit: '10mb' }),
  app.rateLimit({ max: 100 }),
  app.logger(),
];

// Apply to all API routes
apiMiddleware.forEach(middleware => app.use('/api', middleware));
```

### 2. Conditional Middleware

```typescript
// Apply middleware conditionally
if (process.env.NODE_ENV === 'development') {
  app.use(app.logger({ format: 'detailed' }));
}

if (process.env.ENABLE_COMPRESSION === 'true') {
  app.use(app.compression());
}
```

### 3. Custom Middleware Creation

```typescript
// Simple custom middleware
const customMiddleware = (ctx: Context, next: () => Promise<void>) => {
  ctx.state.startTime = Date.now();
  next();
};

app.use(customMiddleware);

// Configurable middleware factory
function createAuthMiddleware(options: { secret: string }) {
  return async (ctx: Context, next: () => Promise<void>) => {
    const token = ctx.req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      ctx.status = 401;
      ctx.res.json({ error: 'Token required' });
      return;
    }

    try {
      // Verify token logic here
      ctx.state.user = { id: 'user123', role: 'admin' };
      await next();
    } catch (error) {
      ctx.status = 401;
      ctx.res.json({ error: 'Invalid token' });
    }
  };
}

// Usage
app.use('/api/protected', createAuthMiddleware({ secret: 'secret-key' }));
```

## 📝 Best Practices

### 1. **Middleware Order**

```typescript
// Correct order for optimal performance and security
app.use(app.helmet()); // Security headers first
app.use(app.cors()); // CORS before parsing
app.use(app.json()); // Body parsing
app.use(app.requestId()); // Request tracking
app.use(app.timer()); // Performance monitoring
app.use(authMiddleware); // Authentication
app.use('/api', apiRoutes); // Routes last
```

### 2. **Error Handling**

```typescript
// Global error handler
app.use(async (error: Error, ctx: Context, next: () => Promise<void>) => {
  console.error('Global error:', error);

  if (ctx.res.headersSent) {
    return next();
  }

  ctx.status = error.statusCode || 500;
  ctx.res.json({
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message,
    requestId: ctx.id,
    timestamp: new Date().toISOString(),
  });
});
```

### 3. **Performance**

```typescript
// Monitor slow requests
app.use(
  app.timer({
    logSlow: true,
    logSlowThreshold: 1000,
  })
);

// Use conditional middleware
if (process.env.NODE_ENV === 'development') {
  app.use(app.logger({ format: 'detailed' }));
}
```

### 4. **Security**

```typescript
// Apply security middleware early
app.use(app.helmet());
app.use(
  app.cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || false,
    credentials: true,
  })
);
```

## 🎯 **Answers to Your Questions**

### **Q: Which pattern is better - `app.use(app.helmet())` or `app.use(helmet())`?**

**A: Both are supported!** Choose based on your preference:

- **`app.use(app.helmet())`**: More explicit, shows middleware is from the app
- **`app.use(helmet())`**: More concise, direct import style

### **Q: How to handle 20-50 router files with 200-300 routes?**

**A: Use centralized middleware configuration:**

```typescript
// app.ts - Central configuration
const app = createApp();

// Global middleware applied to all routes
app.use(app.helmet());
app.use(app.cors());
app.use(app.json());
app.use(app.logger());

// Import all route files
import './routes/auth';
import './routes/users';
// ... 20-50 more files

app.listen(3000);
```

### **Q: Is `usePreset` necessary?**

**A: Not necessary, but helpful for quick setup:**

```typescript
// Without preset (manual setup)
app.use(app.helmet());
app.use(app.cors());
app.use(app.json());
app.use(app.logger());

// With preset (simplified)
app.usePreset('production'); // Does the same thing
```

### **Q: How to improve DX (Developer Experience)?**

**A: Use middleware composition and conditional loading:**

```typescript
// Create reusable middleware groups
const apiMiddleware = [
  app.cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') }),
  app.helmet(),
  app.json({ limit: '10mb' }),
  app.rateLimit({ max: 100 }),
  app.logger(),
];

// Apply to all API routes
apiMiddleware.forEach(middleware => app.use('/api', middleware));
```

---

The NextRush v2 middleware system provides enterprise-grade features with zero dependencies, complete TypeScript support, and flexible usage patterns to accommodate any development style or project size.
