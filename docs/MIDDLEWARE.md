# 🎛️ NextRush Middleware Guide

**The Complete Guide to Express-Like Middleware with Zero Complexity!**

## 🚀 What Makes NextRush Middleware Special?

NextRush provides a **clean, Express-compatible middleware system** that works exactly like you'd expect - but with **zero dependencies**, **perfect TypeScript support**, and **no ugly type casting**!

### ✨ Key Features

- 🎯 **Express-Style DX**: Works exactly like Express.js - no learning curve
- 🔒 **Type-Safe**: Full IntelliSense support, no `(app as any)` casting needed
- 🛡️ **Security-First**: Built-in security middleware with sane defaults
- ⚡ **Zero Dependencies**: All middleware built from scratch for performance
- 🎛️ **Smart Presets**: Pre-configured stacks for instant setup
- � **Composable**: Advanced composition functions for complex scenarios

---

## 🎯 Quick Start with Presets

**Want middleware configured perfectly in one line? Use presets!**

### 🛠️ Development Preset - Perfect for Learning

```javascript
import { createApp } from 'nextrush';

const app = createApp();

// One line setup for development
app.usePreset('development');
// ✅ Detailed logging with timestamps and request IDs
// ✅ CORS enabled for all origins (great for frontend dev)
// ✅ Basic security headers
// ✅ Request timing and performance metrics
// ✅ No rate limiting (easier debugging)

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);
```

### 🏭 Production Preset - Enterprise Ready

```javascript
const app = createApp();

// One line production setup
app.usePreset('production');
// ✅ All security headers (XSS, CSRF, Clickjacking protection)
// ✅ CORS configured for specific origins
// ✅ Compression enabled
// ✅ Rate limiting (100 req/15min)
// ✅ Performance monitoring
// ✅ Structured logging

app.listen(3000);
```

### 📱 API Preset - Perfect for REST APIs

```javascript
const app = createApp();

// Optimized for API development
app.usePreset('api');
// ✅ JSON body parsing with size limits
// ✅ API-specific CORS headers
// ✅ Request ID tracking
// ✅ JSON-formatted logging
// ✅ Performance timing headers
// ✅ Security headers optimized for APIs

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

### 🏢 Full-Featured Preset - Enterprise Applications

```javascript
const app = createApp();

// Everything enabled for large-scale applications
app.usePreset('fullFeatured', {
  cors: {
    origin: ['https://yourdomain.com', 'https://admin.yourdomain.com'],
    credentials: true,
  },
  logger: {
    format: 'json', // Structured logging for monitoring
  },
});
// ✅ Comprehensive security (CSP, HSTS, Permissions Policy)
// ✅ Advanced CORS with credentials
// ✅ Request/response tracking with IDs
// ✅ Multiple logging formats (JSON, detailed, simple)
// ✅ Response compression
// ✅ Performance timing
// ✅ Rate limiting with IP tracking

app.listen(3000);
```

---

## 🛠️ Individual Middleware Functions

**Need fine-grained control? Use individual functions!**

### 🔒 Security Middleware

```javascript
import { createApp, cors, helmet, rateLimit } from 'nextrush';

const app = createApp();

// CORS - Handle cross-origin requests
app.use(
  cors({
    origin: 'https://yourdomain.com',
    credentials: true,
    maxAge: 86400,
  })
);

// Security Headers - Protect against common attacks
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

// Rate Limiting - Prevent abuse
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests, please try again later',
  })
);
```

### 📊 Monitoring & Logging

```javascript
import { logger, requestId, requestTimer } from 'nextrush';

// Request ID - Track requests across your system
app.use(requestId());

// Request Timing - Monitor performance
app.use(requestTimer());

// Rich Logging - Multiple formats available
app.use(
  logger({
    format: 'json', // 'simple', 'detailed', 'json'
    includeHeaders: ['user-agent', 'authorization'],
    excludePaths: ['/health', '/favicon.ico'],
  })
);

// Custom monitoring
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url} - Request ID: ${req.id}`);
  next();
});
```

### ⚡ Performance Middleware

```javascript
import { compression, caching } from 'nextrush';

// Response Compression - Reduce bandwidth
app.use(
  compression({
    level: 6, // Compression level (1-9)
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      // Custom compression logic
      return !req.headers['x-no-compression'];
    },
  })
);

// Response Caching - Speed up repeated requests
app.use(
  caching({
    maxAge: 3600, // 1 hour cache
    etag: true,
    lastModified: true,
  })
);
```

---

## 🎨 Advanced Composition

**Build complex middleware patterns with composition functions!**

### � Sequential Composition

```javascript
import { compose, when, unless, named, group } from 'nextrush';

// Combine multiple middleware into one
const securityStack = compose([
  helmet(),
  cors({ origin: 'https://yourdomain.com' }),
  rateLimit({ max: 100, windowMs: 15 * 60 * 1000 }),
]);

app.use(securityStack);
```

### 🎯 Conditional Middleware

```javascript
// Only apply middleware when condition is met
const apiAuth = when(
  (req) => req.url.startsWith('/api/'),
  (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Authorization required' });
    }
    next();
  }
);

// Apply middleware unless condition is met
const skipHealthCheck = unless(
  (req) => req.url === '/health',
  logger({ format: 'detailed' })
);

app.use(apiAuth);
app.use(skipHealthCheck);
```

### 🏷️ Named Middleware Groups

```javascript
// Create named middleware groups for organization
const authMiddleware = named('authentication', [
  requestId(),
  logger({ format: 'json' }),
  (req, res, next) => {
    // JWT verification logic
    const token = req.headers.authorization?.split(' ')[1];
    if (token && verifyJWT(token)) {
      req.user = decodeJWT(token);
      next();
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  },
]);

const adminMiddleware = named('admin-only', [
  authMiddleware,
  (req, res, next) => {
    if (req.user?.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Admin access required' });
    }
  },
]);

// Use named middleware
app.use('/admin', adminMiddleware);
```

### � Grouped Middleware

```javascript
// Group related middleware for reuse
const apiMiddlewareGroup = group({
  name: 'api-stack',
  middleware: [
    cors({ origin: ['https://app.com', 'https://admin.app.com'] }),
    helmet({ contentSecurityPolicy: false }), // Relaxed for API
    rateLimit({ max: 1000, windowMs: 60 * 1000 }), // Higher limits for API
    logger({ format: 'json' }),
    compression(),
  ],
  options: {
    skipOn: (req) => req.url === '/api/health',
    errorHandler: (err, req, res, next) => {
      console.error('API Middleware Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    },
  },
});

app.use('/api', apiMiddlewareGroup);
```

---

## 💡 Real-World Examples

### 🏪 E-commerce Application

````javascript
import { createApp, cors, helmet, rateLimit, logger, compression } from 'nextrush';

const app = createApp();

// Base security for all routes
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "https://cdn.yourdomain.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"] // Required for payment forms
    }
  }
}));

// CORS for frontend
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://yourdomain.com', 'https://admin.yourdomain.com']
    : true,
  credentials: true
}));

// Different rate limits for different endpoints
app.use('/api/auth', rateLimit({ max: 5, windowMs: 15 * 60 * 1000 })); // Strict auth limits
app.use('/api/products', rateLimit({ max: 100, windowMs: 60 * 1000 })); // Generous for browsing
app.use('/api/orders', rateLimit({ max: 20, windowMs: 60 * 1000 })); // Moderate for orders

// Performance optimizations
app.use(compression());
app.use(logger({
  format: 'json',
  includeHeaders: ['user-agent', 'referer'],
  excludePaths: ['/health', '/favicon.ico']
}));

// Custom middleware for user context
app.use('/api', (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    req.user = verifyToken(token);
  }
  next();
});


### 🔐 Multi-Service Architecture

```javascript
import { createApp, when, unless, group, named } from 'nextrush';

const app = createApp();

// Service identification middleware
const serviceIdentifier = (req, res, next) => {
  req.service = req.headers['x-service-name'] || 'unknown';
  req.version = req.headers['x-api-version'] || 'v1';
  next();
};

// Different middleware for different services
const userServiceMiddleware = when(
  req => req.service === 'user-service',
  group([
    rateLimit({ max: 500, windowMs: 60 * 1000 }),
    logger({ format: 'detailed' }),
    (req, res, next) => {
      req.context = { service: 'users', permissions: ['read', 'write'] };
      next();
    }
  ])
);

const paymentServiceMiddleware = when(
  req => req.service === 'payment-service',
  group([
    rateLimit({ max: 50, windowMs: 60 * 1000 }), // Stricter limits
    helmet({ hsts: { maxAge: 31536000 } }), // Extra security
    logger({ format: 'json', includeBody: true }), // Full audit trail
    (req, res, next) => {
      req.context = { service: 'payments', permissions: ['read'], auditRequired: true };
      next();
    }
  ])
);

app.use(serviceIdentifier);
app.use(userServiceMiddleware);
app.use(paymentServiceMiddleware);
````

### 🎮 Gaming Platform API

```javascript
const app = createApp();

// Base gaming middleware
app.usePreset('api', {
  logger: { format: 'json' },
  cors: {
    origin: ['https://game.com', 'https://mobile.game.com'],
    credentials: true,
  },
});

// Player authentication with session management
const playerAuth = named('player-auth', [
  (req, res, next) => {
    const sessionId = req.headers['x-session-id'];
    const playerId = req.headers['x-player-id'];

    if (validateSession(sessionId, playerId)) {
      req.player = getPlayer(playerId);
      next();
    } else {
      res.status(401).json({ error: 'Invalid session' });
    }
  },
  (req, res, next) => {
    // Update last activity
    updatePlayerActivity(req.player.id);
    next();
  },
]);

// Rate limiting for different game actions
const gameActionLimits = group([
  // Generous limits for reading game state
  when(
    (req) => req.method === 'GET',
    rateLimit({ max: 1000, windowMs: 60 * 1000 })
  ),

  // Moderate limits for game actions
  when(
    (req) => req.url.includes('/action/'),
    rateLimit({ max: 100, windowMs: 60 * 1000 })
  ),

  // Strict limits for purchases
  when(
    (req) => req.url.includes('/purchase/'),
    rateLimit({ max: 10, windowMs: 60 * 1000 })
  ),
]);

app.use('/api/game', playerAuth);
app.use('/api/game', gameActionLimits);
```

---

## 🎨 Custom Middleware Patterns

### 🔄 Circuit Breaker Pattern

```javascript
function circuitBreaker(options = {}) {
  const { threshold = 5, timeout = 60000 } = options;
  let failures = 0;
  let lastFailTime = 0;

  return (req, res, next) => {
    const now = Date.now();

    // Reset if timeout has passed
    if (now - lastFailTime > timeout) {
      failures = 0;
    }

    // Check if circuit is open
    if (failures >= threshold) {
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        retryAfter: Math.ceil((timeout - (now - lastFailTime)) / 1000),
      });
    }

    // Wrap the response to catch failures
    const originalSend = res.send;
    res.send = function (body) {
      if (res.statusCode >= 500) {
        failures++;
        lastFailTime = now;
      }
      return originalSend.call(this, body);
    };

    next();
  };
}

// Usage
app.use('/api/external', circuitBreaker({ threshold: 3, timeout: 30000 }));
```

### 📊 Request Analytics

```javascript
function analytics(options = {}) {
  const { trackHeaders = [], trackQuery = true } = options;

  return (req, res, next) => {
    const startTime = Date.now();

    // Capture request data
    const analyticsData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection?.remoteAddress,
      headers: trackHeaders.reduce((acc, header) => {
        if (req.headers[header]) acc[header] = req.headers[header];
        return acc;
      }, {}),
      query: trackQuery ? req.query : undefined,
    };

    // Capture response data when response finishes
    res.on('finish', () => {
      analyticsData.statusCode = res.statusCode;
      analyticsData.responseTime = Date.now() - startTime;
      analyticsData.contentLength = res.getHeader('content-length');

      // Send to analytics service (async)
      sendToAnalytics(analyticsData).catch((err) =>
        console.error('Analytics error:', err)
      );
    });

    next();
  };
}

// Usage
app.use(
  analytics({
    trackHeaders: ['referer', 'accept-language'],
    trackQuery: true,
  })
);
```

### 🔐 Advanced Authentication

```javascript
function flexibleAuth(options = {}) {
  const { strategies = ['jwt', 'apikey'], optional = false } = options;

  return (req, res, next) => {
    let authenticated = false;
    let user = null;

    // Try JWT authentication
    if (strategies.includes('jwt')) {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        try {
          user = verifyJWT(token);
          authenticated = true;
        } catch (err) {
          // JWT invalid, try next strategy
        }
      }
    }

    // Try API key authentication
    if (!authenticated && strategies.includes('apikey')) {
      const apiKey = req.headers['x-api-key'];
      if (apiKey) {
        user = validateApiKey(apiKey);
        if (user) authenticated = true;
      }
    }

    // Try session authentication
    if (!authenticated && strategies.includes('session')) {
      const sessionId = req.headers['x-session-id'];
      if (sessionId) {
        user = getSessionUser(sessionId);
        if (user) authenticated = true;
      }
    }

    if (authenticated || optional) {
      req.user = user;
      req.authenticated = authenticated;
      next();
    } else {
      res.status(401).json({
        error: 'Authentication required',
        acceptedMethods: strategies,
      });
    }
  };
}

// Usage examples
app.use('/api/public', flexibleAuth({ optional: true })); // User data if available
app.use('/api/protected', flexibleAuth({ strategies: ['jwt', 'apikey'] })); // Required auth
app.use('/api/admin', flexibleAuth({ strategies: ['jwt'] })); // JWT only
```

---

## 🛠️ Built-in Middleware Reference

### 🔒 Security Middleware

```javascript
// CORS - Cross-Origin Resource Sharing
app.use(
  cors({
    origin: ['https://yourdomain.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400, // Cache preflight for 24 hours
  })
);

// Helmet - Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
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

// Rate Limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable legacy X-RateLimit-* headers
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  })
);
```

### 📊 Monitoring Middleware

```javascript
// Request ID - Track requests across services
app.use(
  requestId({
    header: 'X-Request-ID',
    generator: () => crypto.randomUUID(),
    setHeader: true,
  })
);

// Request Timer - Performance monitoring
app.use(
  requestTimer({
    header: 'X-Response-Time',
    digits: 3, // Precision
    suffix: true, // Add 'ms' suffix
  })
);

// Logger - Comprehensive request logging
app.use(
  logger({
    format: 'combined', // 'simple', 'detailed', 'json', 'combined'
    level: 'info',
    includeHeaders: ['user-agent', 'authorization'],
    excludeHeaders: ['cookie'],
    includePaths: undefined, // Log all paths
    excludePaths: ['/health', '/favicon.ico'],
    colorize: process.env.NODE_ENV !== 'production',
  })
);
```

### ⚡ Performance Middleware

```javascript
// Compression - Reduce response size
app.use(
  compression({
    level: 6, // Compression level (1-9)
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  })
);

// Caching - HTTP caching headers
app.use(
  caching({
    maxAge: 3600, // 1 hour
    etag: true,
    lastModified: true,
    cacheControl: 'public',
    vary: ['Accept-Encoding', 'Authorization'],
  })
);
```

---

## 🎯 Error Handling Patterns

### 🚨 Global Error Handler

```javascript
// Error logging middleware
const errorLogger = (err, req, res, next) => {
  console.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    requestId: req.id,
  });
  next(err);
};

// Error response middleware
const errorResponder = (err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    error: err.message,
    ...(isDevelopment && { stack: err.stack }),
    requestId: req.id,
    timestamp: new Date().toISOString(),
  });
};

// Apply error handling
app.use(errorLogger);
app.use(errorResponder);
```

### ⚠️ Async Error Handling

```javascript
// Wrapper for async route handlers
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Usage
app.get(
  '/api/users',
  asyncHandler(async (req, res) => {
    const users = await getUsersFromDatabase();
    res.json(users);
  })
);
```

---

## 📚 Best Practices

### ✅ Do's

1. **Use presets for quick setup**: `app.usePreset('production')`
2. **Apply security middleware early**: CORS, Helmet, Rate limiting
3. **Use request IDs for tracing**: `app.use(requestId())`
4. **Log important events**: Authentication, errors, performance
5. **Compose middleware logically**: Security → Logging → Business logic
6. **Use conditional middleware**: `when()`, `unless()` for flexibility
7. **Group related middleware**: `group()` and `named()` for organization

### ❌ Don'ts

1. **Don't skip security middleware** in production
2. **Don't log sensitive data** (passwords, tokens)
3. **Don't apply heavy middleware** to health check endpoints
4. **Don't forget error handling** middleware
5. **Don't use blocking operations** in middleware
6. **Don't ignore rate limiting** for public APIs
7. **Don't mix async/sync patterns** inconsistently

### 🏗️ Architecture Tips

```javascript
// Good: Organized middleware stack
app.use(requestId());           // 1. Request tracking
app.use(logger());             // 2. Request logging
app.use(helmet());             // 3. Security headers
app.use(cors());               // 4. CORS handling
app.use(rateLimit());          // 5. Rate limiting
app.use(compression());        // 6. Response compression
app.use(bodyParser());         // 7. Body parsing

// Routes
app.get('/api/users', (req, res) => { ... });

// Error handling (always last)
app.use(errorLogger);
app.use(errorResponder);
```

---

## 🔧 Troubleshooting

### 🐛 Common Issues

**Issue: Middleware not executing**

```javascript
// Wrong - missing next()
app.use((req, res, next) => {
  console.log('Request received');
  // Missing next() call!
});

// Correct
app.use((req, res, next) => {
  console.log('Request received');
  next(); // ✅ Don't forget this!
});
```

**Issue: CORS errors**

```javascript
// Wrong - CORS after routes
app.get('/api/data', (req, res) => res.json({}));
app.use(cors()); // Too late!

// Correct - CORS before routes
app.use(cors()); // ✅ Apply early
app.get('/api/data', (req, res) => res.json({}));
```

**Issue: Rate limiting not working**

```javascript
// Make sure rate limiting is applied before routes
app.use(rateLimit({ max: 100, windowMs: 60000 }));
app.get('/api/data', handler); // Will be rate limited

// Or apply to specific paths
app.use('/api/', rateLimit({ max: 100, windowMs: 60000 }));
```

### 📈 Performance Monitoring

```javascript
// Monitor middleware performance
function performanceMonitor(name) {
  return (req, res, next) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to ms

      if (duration > 100) {
        // Log slow middleware
        console.warn(`Slow middleware ${name}: ${duration.toFixed(2)}ms`);
      }
    });

    next();
  };
}

// Usage
app.use(performanceMonitor('cors'), cors());
app.use(performanceMonitor('auth'), authMiddleware);
```

---

## 🎉 Conclusion

NextRush middleware provides:

- ✅ **Zero-dependency** security and performance middleware
- ✅ **Express-compatible** API with better TypeScript support
- ✅ **Smart presets** for instant setup
- ✅ **Advanced composition** for complex scenarios
- ✅ **Production-ready** defaults with enterprise features

**Start simple with presets, then customize as needed!**

```javascript
// Start here
const app = createApp();
app.usePreset('production');
app.listen(3000);

// Grow into this
const app = createApp();
app.use(requestId());
app.use(logger({ format: 'json' }));
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS.split(',') }));
app.use(rateLimit({ max: 1000, windowMs: 60000 }));
app.use(compression());
app.listen(3000);
```

Ready to build amazing web applications! 🚀

- ✅ See what users are requesting
- ✅ Find slow endpoints
- ✅ Debug problems
- ✅ Monitor your app

### 🛡️ `helmet()` - Basic Security

**Protects against common attacks**

```javascript
app.use(helmet());
// Adds security headers automatically
```

**Why use it?**

- ✅ Stops hackers from basic attacks
- ✅ Required for most production apps
- ✅ One line = much safer app

### 🌍 `cors()` - Allow Other Websites

**Lets browsers call your API from other domains**

```javascript
app.use(cors()); // Allow everyone (dev)
app.use(cors({ origin: 'https://myapp.com' })); // Allow only your app
```

**Why use it?**

- ✅ Your React/Vue app can call your API
- ✅ Mobile apps can access your API
- ✅ Required for most modern apps

### 📦 `json()` - Read JSON Data

**Automatically converts JSON to JavaScript objects**

```javascript
app.use(json());

app.post('/users', (req, res) => {
  console.log(req.body); // { name: "John", email: "john@example.com" }
});
```

**Why use it?**

- ✅ Required for POST/PUT endpoints
- ✅ Handles user form submissions
- ✅ Makes JSON data easy to use

### ⚡ `compression()` - Faster Responses

**Makes your API responses smaller and faster**

```javascript
app.use(compression());
// Responses are now 70% smaller = 70% faster!
```

**Why use it?**

- ✅ Users get faster responses
- ✅ Uses less bandwidth
- ✅ Better user experience

### 🏷️ `requestId()` - Track Requests

**Gives each request a unique ID**

```javascript
app.use(requestId());

app.get('/users', (req, res) => {
  console.log(req.id); // "abc-123-def-456"
});
```

**Why use it?**

- ✅ Track specific requests
- ✅ Better debugging
- ✅ Monitor your app

### ⏱️ `requestTimer()` - Measure Speed

**Shows how long each request takes**

```javascript
app.use(requestTimer());
// Adds X-Response-Time header: "45ms"
```

**Why use it?**

- ✅ Find slow endpoints
- ✅ Monitor performance
- ✅ Optimize your app

---

## 🎨 Smart Middleware (Advanced)

**Combine and control middleware like a pro:**

### 🔗 `compose()` - Bundle Middleware

**Combine multiple middleware into one**

```javascript
const authFlow = compose(checkApiKey, checkUser, rateLimit);

app.get('/protected', authFlow, handler);
// Same as: app.get('/protected', checkApiKey, checkUser, rateLimit, handler);
```

### ❓ `when()` - Conditional Middleware

**Only run middleware when needed**

```javascript
const mobileOptimization = when(
  (req) => req.headers['user-agent'].includes('Mobile'),
  optimizeForMobile
);

app.get('/api/data', mobileOptimization, handler);
// Only optimizes for mobile users!
```

### 🚫 `unless()` - Skip Middleware

**Run middleware except in certain cases**

```javascript
const authExceptPublic = unless(
  (req) => req.path.startsWith('/public'),
  requireAuth
);

app.use(authExceptPublic);
// Auth required everywhere except /public routes
```

### 🏷️ `named()` - Debug Middleware

**Give middleware names for easier debugging**

```javascript
app.use(named('rate-limiter', rateLimitMiddleware));
app.use(named('auth-check', authMiddleware));

// See middleware names in req.middlewareStack
```

---

## 💡 Common Patterns

### 🔒 Authentication Flow

```javascript
const authFlow = compose(
  named('api-key', checkApiKey),
  named('user-auth', checkUser),
  named('permissions', checkPermissions)
);

app.use('/api', authFlow);
```

### 🌍 Public API Setup

```javascript
app.usePreset('api', {
  cors: { origin: ['https://myapp.com', 'https://mobile.myapp.com'] },
});
```

### 🛠️ Development Setup

```javascript
if (process.env.NODE_ENV === 'development') {
  app.usePreset('development');
} else {
  app.usePreset('production');
}
```

### 📱 Mobile Optimization

```javascript
const mobileOnly = when(
  (req) => req.headers['user-agent']?.includes('Mobile'),
  mobileOptimizations
);

app.use(mobileOnly);
```

---

## 🚦 How to Use Middleware

### 1️⃣ **Global Middleware** (applies to ALL routes)

```javascript
app.use(logger()); // Log all requests
app.use(helmet()); // Secure all routes
```

### 2️⃣ **Path-Specific Middleware** (applies to specific paths)

```javascript
app.use('/api', checkApiKey); // Only /api/* routes need API key
app.use('/admin', requireAdmin); // Only /admin/* routes need admin
```

### 3️⃣ **Route-Specific Middleware** (applies to one route)

```javascript
app.get('/users', checkAuth, getUsers); // Only this route
app.post('/users', checkAuth, validateUser, createUser); // Multiple middleware
```

### 4️⃣ **Grouped Routes** (shared middleware for related routes)

```javascript
app.group('/api', [checkApiKey, rateLimit], (router) => {
  router.get('/users', getUsers);
  router.post('/users', createUser);
  // Both routes automatically get checkApiKey + rateLimit
});
```

---

## ❓ When to Use What?

### 🚀 **Just Getting Started?**

```javascript
app.usePreset('development'); // Perfect for learning!
```

### 🏗️ **Building an API?**

```javascript
app.usePreset('api'); // Everything you need for APIs
```

### 🏭 **Going to Production?**

```javascript
app.usePreset('production'); // Security + performance
```

### 🎯 **Need Custom Setup?**

```javascript
app.use(logger());
app.use(helmet());
app.use(cors());
app.use(json());
// Add exactly what you need
```

---

## 🎓 Quick Examples

### Simple Blog API

```javascript
const app = createApp();

app.usePreset('api'); // CORS + JSON + compression + logging

app.get('/posts', (req, res) => {
  res.json({ posts: [] });
});

app.post('/posts', (req, res) => {
  // req.body is automatically parsed JSON
  res.json({ message: 'Post created', post: req.body });
});
```

### E-commerce API with Auth

```javascript
const app = createApp();

app.usePreset('production'); // Security + performance

const authFlow = compose(
  named('api-key', checkApiKey),
  named('user-auth', checkUser)
);

app.group('/api', [authFlow], (router) => {
  router.get('/products', getProducts);
  router.post('/orders', createOrder);
});
```

### Simple Website

```javascript
const app = createApp();

app.usePreset('minimal'); // Just basic logging

app.get('/', (req, res) => {
  res.send('<h1>Welcome!</h1>');
});
```

---

## 🎉 That's It

NextRush middleware is designed to be:

- ✅ **Super easy** for beginners
- ✅ **Powerful** for experts
- ✅ **Flexible** for any use case
- ✅ **Fast** and lightweight

**Start with presets, customize when needed!** 🚀

- Content type sniffing
- And many more security issues

**✅ ALWAYS USE IN PRODUCTION!**

---

### ⚡ `compression(options?)` - Faster Responses

**What it does:** Makes your API responses smaller and faster by compressing them

**When to use:**

- Always in production (makes your app faster)
- When you want to save bandwidth
- When you have large JSON responses

**Examples:**

```javascript
compression(); // Enable compression for all responses
```

**Benefits:**

- Faster page loads (smaller files)
- Less bandwidth usage
- Better user experience
- Lower hosting costs

**✅ ALWAYS USE IN PRODUCTION!**

---

### 📦 `json(options?)` - Parse JSON Bodies

**What it does:** Automatically converts JSON in request body to `req.body` object

**When to use:**

- Building REST APIs that receive JSON data
- When users submit forms with JSON
- Any POST/PUT endpoint that needs data

**Examples:**

```javascript
json(); // Parse JSON with default settings
json({ limit: '10mb' }); // Allow larger JSON files
```

**Before/After:**

- WITHOUT: `req.body` is undefined
- WITH: `req.body = { name: "John", email: "john@example.com" }`

**⚠️ REQUIRED FOR:** POST, PUT, PATCH endpoints that receive data

---

### 📝 `logger(options?)` - Request Logging

**What it does:** Logs every request to your console so you can see what's happening

**When to use:**

- ALWAYS in development (see what requests are coming in)
- In production for monitoring
- When debugging issues

**Examples:**

```javascript
logger(); // Simple: "GET /api/users - 200 - 45ms"
logger({ format: 'detailed' }); // Detailed: includes timestamp, user agent
logger({ format: 'json' }); // JSON format for log analysis tools
```

**Formats:**

- `'simple'` - Basic: method, path, status, time
- `'detailed'` - Adds timestamp, user agent, IP
- `'json'` - Machine-readable for log tools
- `'combined'` - Apache-style format

**🔧 ESSENTIAL FOR:** Debugging, monitoring, understanding traffic

---

### 🏷️ `requestId(options?)` - Track Requests

**What it does:** Gives every request a unique ID for tracking and debugging

**When to use:**

- In production to track specific requests
- When debugging issues ("what happened to request ABC123?")
- For logging and monitoring
- When building microservices

**Examples:**

```javascript
requestId(); // Add unique ID to each request
```

**How to use the ID:**

- Check `req.id` in your handlers
- Look for `X-Request-ID` header in responses
- Use for correlating logs across services

**🔧 PERFECT FOR:** Production apps, debugging, monitoring

---

### ⏱️ `requestTimer()` - Performance Monitoring

**What it does:** Measures how long each request takes to process

**When to use:**

- To monitor API performance
- To find slow endpoints
- For performance optimization
- In development and production

**Examples:**

```javascript
requestTimer(); // Add timing to all requests
```

**What you get:**

- `X-Response-Time` header in all responses (e.g., "45ms")
- `req.startTime` available in your handlers
- Easy performance monitoring

**🔧 PERFECT FOR:** Performance monitoring, optimization, debugging slow APIs

---

## 🎨 Composition Functions

### 🔗 `compose(...middlewares)` - Combine Middleware

**What it does:** Combines several middleware functions into a single middleware

**When to use:**

- You have a common set of middleware used together
- Want to create reusable middleware "bundles"
- Need to simplify complex middleware chains

**Examples:**

```javascript
const authFlow = compose(apiKeyCheck, bearerAuth, rateLimit);
app.get('/protected', authFlow, handler);

// Instead of:
app.get('/protected', apiKeyCheck, bearerAuth, rateLimit, handler);
```

**🔧 PERFECT FOR:** Authentication flows, validation chains, security bundles

---

### ❓ `when(condition, middleware)` - Conditional Middleware

**What it does:** Only runs middleware if a condition is true

**When to use:**

- Different behavior for mobile vs desktop
- Optional features based on user type
- Environment-specific middleware
- Smart routing based on request data

**Examples:**

```javascript
when((req) => req.method === 'POST', validateBody); // Only validate POST requests
when((req) => req.user?.role === 'admin', adminFeatures); // Only for admins
when((req) => req.query.debug === 'true', debugMode); // Debug mode
```

**Smart patterns:**

```javascript
const mobileOnly = when(
  (req) => req.headers['user-agent']?.includes('Mobile'),
  mobileOptimization
);
const premiumFeatures = when(
  (req) => req.user?.plan === 'premium',
  premiumMiddleware
);
```

**🔧 PERFECT FOR:** Smart routing, optional features, conditional logic

---

### 🚫 `unless(condition, middleware)` - Exclusion Middleware

**What it does:** Runs middleware UNLESS a condition is true (opposite of when)

**When to use:**

- Skip authentication for public routes
- Disable features for certain users
- Skip middleware in specific conditions

**Examples:**

```javascript
unless((req) => req.path.startsWith('/public'), auth); // Auth everywhere except /public
unless((req) => req.user?.role === 'admin', rateLimit); // No rate limit for admins
unless((req) => req.headers['x-skip'] === 'true', log); // Skip logging when header present
```

**🔧 PERFECT FOR:** Exclusions, special cases, skip conditions

---

### 🏷️ `named(name, middleware)` - Debug Middleware

**What it does:** Gives middleware a name so you can track it during debugging

**When to use:**

- When debugging complex middleware chains
- To track which middleware ran
- For better error messages
- In development and testing

**Examples:**

```javascript
named('rate-limiter', rateLimitMiddleware);
named('user-auth', authMiddleware);
named('body-validator', validateMiddleware);
```

**Debugging benefits:**

- See `req.middlewareStack` in responses
- Track middleware execution order
- Better error messages
- Easier troubleshooting

**🔧 PERFECT FOR:** Development, debugging, production monitoring

---

## 🎯 Presets - One-Line Setup

### 🛡️ `usePreset('security', options?)` - Essential Security

**What it includes:**

- `helmet()` - Security headers protection
- `cors()` - Cross-origin request handling

**When to use:**

- ALWAYS in production
- When you need basic security
- Before adding other middleware

**Examples:**

```javascript
app.usePreset('security'); // Default security
app.usePreset('security', {
  cors: { origin: 'https://myapp.com' },
  helmet: { frameguard: false },
});
```

**✅ PERFECT FOR:** Production apps, security-first setup

---

### 🚀 `usePreset('api', options?)` - REST API Ready

**What it includes:**

- `cors()` - Cross-origin requests
- `json()` - JSON body parsing
- `compression()` - Faster responses
- `requestId()` - Request tracking
- `requestTimer()` - Performance monitoring

**When to use:**

- Building REST APIs
- Need JSON parsing and CORS
- Want performance monitoring
- Building microservices

**Examples:**

```javascript
app.usePreset('api'); // Perfect API setup
app.usePreset('api', {
  cors: { origin: ['https://app.com', 'https://mobile.app.com'] },
  json: { limit: '10mb' },
});
```

**✅ PERFECT FOR:** REST APIs, JSON APIs, microservices

---

### 🛠️ `usePreset('development', options?)` - Development Perfect

**What it includes:**

- `logger()` with detailed format - See everything that's happening
- `requestTimer()` - Monitor performance

**When to use:**

- During development
- When debugging issues
- When you want detailed request info
- Local development environment

**Examples:**

```javascript
app.usePreset('development'); // Perfect for dev
app.usePreset('development', {
  logger: { format: 'json' }, // JSON logs for tools
});
```

**What you'll see:**

```
[2025-07-14T10:30:45.123Z] GET /api/users - 200 - 45ms - Chrome/91.0
```

**✅ PERFECT FOR:** Local development, debugging, learning

---

### 🏭 `usePreset('production', options?)` - Production Optimized

**What it includes:**

- `helmet()` - Security headers
- `cors()` - Cross-origin handling
- `compression()` - Faster responses
- `json()` - JSON parsing
- `logger()` with JSON format - Machine-readable logs
- `requestId()` - Request tracking

**When to use:**

- Production servers
- When you need everything optimized
- For production APIs
- When security and performance matter

**Examples:**

```javascript
app.usePreset('production'); // Production ready!
app.usePreset('production', {
  cors: { origin: process.env.ALLOWED_ORIGINS },
  helmet: { contentSecurityPolicy: true },
});
```

**🔒 INCLUDES:** Security + Performance + Monitoring

**✅ PERFECT FOR:** Production servers, live APIs, enterprise apps

---

### 🎯 `usePreset('minimal', options?)` - Just Basics

**What it includes:**

- `logger()` with simple format - Basic request logging

**When to use:**

- Simple applications
- Learning NextRush
- Prototypes and demos
- When you want minimal overhead

**Examples:**

```javascript
app.usePreset('minimal'); // Just basic logging
```

**What you'll see:**

```
GET /api/users - 200 - 45ms
```

**✅ PERFECT FOR:** Learning, prototypes, simple apps

---

### 🎪 `usePreset('fullFeatured', options?)` - Everything

**What it includes:**

- `helmet()` - Security headers
- `cors()` - Cross-origin handling
- `compression()` - Response compression
- `json()` - JSON body parsing
- `logger()` with detailed format - Rich logging
- `requestId()` - Request tracking
- `requestTimer()` - Performance monitoring

**When to use:**

- When you want everything
- Complex applications
- Enterprise applications
- When you're not sure what you need

**Examples:**

```javascript
app.usePreset('fullFeatured'); // Everything enabled!
app.usePreset('fullFeatured', {
  logger: { format: 'json' },
  cors: { origin: '*' },
});
```

**🎁 INCLUDES:** Security + Performance + Monitoring + Debugging

**✅ PERFECT FOR:** Enterprise apps, complex APIs, feature-rich applications
