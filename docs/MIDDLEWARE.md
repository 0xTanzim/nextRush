# � NextRush Middleware Guide

**Making web development easy and fun!**

## 🤔 What is Middleware?

Think of middleware like **security guards** and **helpers** for your website:

- 🛡️ **Security Guard**: Checks if users are allowed to enter
- 📝 **Logger**: Writes down who visited and when
- 🧹 **Cleaner**: Organizes data before it reaches your app
- ⚡ **Speed Booster**: Makes your website faster

**Simple Example:**

```javascript
const app = createApp();

// Add a "security guard" to check API keys
app.use((req, res, next) => {
  if (req.headers['api-key'] === 'secret123') {
    next(); // ✅ Let them through
  } else {
    res.status(401).json({ error: 'Not allowed!' }); // ❌ Stop them
  }
});
```

---

## 🎯 Super Easy Setup (Presets)

**Don't want to think about middleware? Use presets!**

This is like choosing a ready-made outfit for your app: 😄
You get everything you need without worrying about details. Pre configured for common tasks! so you can focus on building your app.

### 🛠️ Development (Learning/Testing)

```javascript
app.usePreset('development');
// ✅ Perfect for learning NextRush
// ✅ Shows detailed logs
// ✅ No security overhead
```

### 🏭 Production (Real Apps)

```javascript
app.usePreset('production');
// ✅ Security headers
// ✅ Fast responses
// ✅ Request tracking
// ✅ Everything optimized
```

### 🚀 API (Building APIs)

```javascript
app.usePreset('api');
// ✅ Cross-origin requests
// ✅ JSON parsing
// ✅ Performance monitoring
```

### 🎯 Minimal (Just Basics)

```javascript
app.usePreset('minimal');
// ✅ Just request logging
// ✅ Smallest overhead
```

## (Use Groups) to apply multiple middleware at once

This is like putting on a jacket that has all the security features you need:

```javascript
app.useGroup([logger(), helmet(), cors()]);
// ✅ Applies multiple middleware at once
// ✅ Great for organizing your app
```

---

## 🧱 Individual Middleware (Custom Setup)

**Want more control? Add middleware one by one:**

### 📝 `logger()` - See What's Happening

**Shows requests in your console**

```javascript
app.use(logger());
// Output: GET /api/users - 200 - 45ms
```

**Why use it?**

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
