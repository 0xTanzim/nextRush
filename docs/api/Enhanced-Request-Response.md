# Enhanced Request & Response Features

NextRush v2 provides powerful enhanced request and response capabilities that extend the standard Node.js HTTP objects with Express-like functionality while maintaining Koa-style context design.

## Overview

The enhanced features provide:

- **Express-like API** with familiar methods and properties
- **Koa-style context** for clean middleware composition
- **Zero dependencies** using only Node.js built-in APIs
- **Performance optimized** with efficient algorithms
- **Type-safe** with full TypeScript support

## Request Enhancement

### Basic Properties

Enhanced requests include Express-like properties:

```typescript
import { createApp } from 'nextrush-v2';

const app = createApp();

app.get('/user/:id', async ctx => {
  // Express-like properties
  console.log(ctx.req.params); // Route parameters
  console.log(ctx.req.query); // Query string
  console.log(ctx.req.body); // Request body
  console.log(ctx.req.pathname); // URL pathname
  console.log(ctx.req.originalUrl); // Full original URL
  console.log(ctx.req.path); // URL path
  console.log(ctx.req.files); // Uploaded files
  console.log(ctx.req.cookies); // Parsed cookies
  console.log(ctx.req.session); // Session data
  console.log(ctx.req.locals); // Response locals
  console.log(ctx.req.startTime); // Request start time
});
```

### IP Detection

Smart IP detection with proxy support:

```typescript
app.get('/client-info', async ctx => {
  const ip = ctx.req.ip; // Client IP
  const secure = ctx.req.secure; // HTTPS check
  const protocol = ctx.req.protocol; // HTTP/HTTPS
  const hostname = ctx.req.hostname(); // Hostname
  const fullUrl = ctx.req.fullUrl(); // Complete URL

  ctx.res.json({
    ip,
    secure,
    protocol,
    hostname,
    fullUrl,
  });
});
```

### Content Type Checking

Check request content types:

```typescript
app.post('/api/data', async ctx => {
  if (ctx.req.is('application/json')) {
    // Handle JSON request
  }

  const accepted = ctx.req.accepts(['json', 'xml']);
  if (accepted === 'json') {
    ctx.res.json({ message: 'JSON response' });
  } else if (accepted === 'xml') {
    ctx.res.xml('<data><message>XML response</message></data>');
  }
});
```

### Cookie Parsing

Automatic cookie parsing:

```typescript
app.get('/profile', async ctx => {
  const sessionId = ctx.req.cookies['sessionId'];
  const theme = ctx.req.cookies['theme'];

  // Or parse manually
  const cookies = ctx.req.parseCookies();
  console.log(cookies);
});
```

### Validation Framework

Built-in request validation:

```typescript
app.post('/users', async ctx => {
  const result = ctx.req.validate({
    name: {
      required: true,
      minLength: 2,
      maxLength: 50,
    },
    email: {
      type: 'email',
      required: true,
    },
    age: {
      type: 'number',
      custom: value => value >= 18,
      message: 'Age must be 18 or older',
    },
  });

  if (!result.isValid) {
    ctx.res.status(400).json({ errors: result.errors });
    return;
  }

  // Use sanitized data
  const userData = result.sanitized;
  ctx.res.json({ success: true, data: userData });
});
```

### Data Sanitization

Sanitize input data:

```typescript
app.post('/comment', async ctx => {
  const sanitized = ctx.req.sanitize(ctx.req.body.content, {
    trim: true,
    removeHtml: true,
    escape: true,
  });

  ctx.res.json({ content: sanitized });
});
```

### User Agent Parsing

Parse user agent information:

```typescript
app.get('/device-info', async ctx => {
  const ua = ctx.req.userAgent();

  ctx.res.json({
    browser: ua.browser, // Chrome, Firefox, Safari, etc.
    os: ua.os, // Windows, macOS, Linux, etc.
    device: ua.device, // Desktop, Mobile, Tablet
    isMobile: ua.isMobile, // Boolean
    isBot: ua.isBot, // Boolean
  });
});
```

### Security Features

Request fingerprinting and timing:

```typescript
app.get('/security', async ctx => {
  const fingerprint = ctx.req.fingerprint(); // Unique request ID
  const timing = ctx.req.timing(); // Request timing
  const rateLimit = ctx.req.rateLimit(); // Rate limit info

  ctx.res.json({
    fingerprint,
    timing,
    rateLimit,
  });
});
```

## Response Enhancement

### Core Response Methods

Express-like response methods:

```typescript
app.get('/api/data', async ctx => {
  // JSON response
  ctx.res.json({ message: 'Hello World' });

  // HTML response
  ctx.res.html('<h1>Hello World</h1>');

  // Text response
  ctx.res.text('Plain text response');

  // XML response
  ctx.res.xml('<data><message>Hello World</message></data>');

  // CSV response
  ctx.res.csv(
    [
      { id: 1, name: 'John' },
      { id: 2, name: 'Jane' },
    ],
    'users.csv'
  );
});
```

### File Operations

Serve and download files:

```typescript
app.get('/download/:filename', async ctx => {
  const filename = ctx.req.params.filename;
  ctx.res.download(`/files/${filename}`);
});

app.get('/view/:filename', async ctx => {
  const filename = ctx.req.params.filename;
  ctx.res.sendFile(`/files/${filename}`);
});
```

### Redirects

Handle redirects:

```typescript
app.get('/old-page', async ctx => {
  ctx.res.redirect('/new-page');
});

app.get('/permanent-redirect', async ctx => {
  ctx.res.redirectPermanent('/new-location');
});

app.get('/temporary-redirect', async ctx => {
  ctx.res.redirectTemporary('/temp-location');
});
```

### Header Management

Manage response headers:

```typescript
app.get('/custom-headers', async ctx => {
  ctx.res
    .set('X-Custom-Header', 'value')
    .set({
      'X-Header-1': 'value1',
      'X-Header-2': 'value2',
    })
    .status(201)
    .json({ message: 'Created' });
});
```

### Cookie Management

Set and clear cookies:

```typescript
app.post('/login', async ctx => {
  // Set cookie
  ctx.res.cookie('sessionId', 'abc123', {
    httpOnly: true,
    secure: true,
    maxAge: 86400000,
  });

  ctx.res.json({ success: true });
});

app.post('/logout', async ctx => {
  // Clear cookie
  ctx.res.clearCookie('sessionId');
  ctx.res.json({ success: true });
});
```

### Template Rendering

Simple template rendering:

```typescript
app.get('/profile', async ctx => {
  const template = `
    <h1>{{name}}</h1>
    <p>Email: {{email}}</p>
    <p>Age: {{age}}</p>
  `;

  const data = {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
  };

  ctx.res.render(template, data);
});
```

### Cache Control

Manage caching:

```typescript
app.get('/static-data', async ctx => {
  ctx.res.cache(3600); // Cache for 1 hour
  ctx.res.json({ data: 'cached content' });
});

app.get('/dynamic-data', async ctx => {
  ctx.res.noCache(); // Prevent caching
  ctx.res.json({ data: 'fresh content' });
});
```

### CORS Support

Handle CORS:

```typescript
app.get('/api/data', async ctx => {
  ctx.res.cors('https://example.com');
  ctx.res.json({ data: 'CORS enabled' });
});
```

### Security Headers

Add security headers:

```typescript
app.get('/secure', async ctx => {
  ctx.res.security();
  ctx.res.json({ message: 'Secure response' });
});
```

### API Response Helpers

Standardized API responses:

```typescript
app.post('/users', async ctx => {
  const user = { id: 1, name: 'John' };

  // Success response
  ctx.res.success(user, 'User created successfully');
});

app.get('/users/:id', async ctx => {
  const user = await getUser(ctx.req.params.id);

  if (!user) {
    // Error response
    ctx.res.error('User not found', 404, { userId: ctx.req.params.id });
    return;
  }

  ctx.res.json(user);
});

app.get('/users', async ctx => {
  const users = await getUsers();
  const total = await getUserCount();

  // Paginated response
  ctx.res.paginate(users, 1, 10, total);
});
```

### Performance Features

Add performance headers:

```typescript
app.get('/api/slow-operation', async ctx => {
  ctx.res.time('slow-operation');

  // Perform slow operation
  await performSlowOperation();

  ctx.res.json({ result: 'done' });
});
```

## Complete Example

Here's a complete example showing all features:

```typescript
import { createApp } from 'next-rush';

const app = createApp();

// Middleware for logging
app.use(async (ctx, next) => {
  console.log(`${ctx.req.method} ${ctx.req.path} - ${ctx.req.ip()}`);
  ctx.res.set('X-Response-Time', `${Date.now() - ctx.req.startTime}ms`);
  await next();
});

// User registration with validation
app.post('/register', async ctx => {
  const result = ctx.req.validate({
    name: { required: true, minLength: 2 },
    email: { type: 'email', required: true },
    password: { required: true, minLength: 8 },
  });

  if (!result.isValid) {
    ctx.res.error('Validation failed', 400, result.errors);
    return;
  }

  const user = await createUser(result.sanitized);

  // Set session cookie
  ctx.res.cookie('sessionId', user.sessionId, {
    httpOnly: true,
    secure: ctx.req.secure(),
    maxAge: 86400000,
  });

  ctx.res.success(user, 'User registered successfully');
});

// User profile with device detection
app.get('/profile', async ctx => {
  const ua = ctx.req.userAgent();

  const template = `
    <h1>Welcome {{name}}</h1>
    <p>Browser: {{browser}}</p>
    <p>Device: {{device}}</p>
    <p>IP: {{ip}}</p>
  `;

  const data = {
    name: 'John Doe',
    browser: ua.browser,
    device: ua.device,
    ip: ctx.req.ip(),
  };

  ctx.res.render(template, data);
});

// API endpoint with pagination
app.get('/api/users', async ctx => {
  const page = parseInt(ctx.req.query.page as string) || 1;
  const limit = parseInt(ctx.req.query.limit as string) || 10;

  const users = await getUsers(page, limit);
  const total = await getUserCount();

  ctx.res.paginate(users, page, limit, total);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Best Practices

1. **Use validation** for all user input
2. **Sanitize data** before processing
3. **Set appropriate headers** for security and caching
4. **Use standardized responses** for consistent APIs
5. **Handle errors gracefully** with proper status codes
6. **Monitor performance** with timing headers
7. **Validate content types** before processing
8. **Use cookies securely** with proper options

## Performance Considerations

- All enhancements are lightweight and optimized
- Zero external dependencies
- Efficient algorithms for parsing and validation
- Minimal memory overhead
- Fast execution with Node.js built-in APIs

## Type Safety

All enhanced features are fully typed with TypeScript:

```typescript
interface EnhancedRequest extends IncomingMessage {
  // All properties and methods are properly typed
}

interface EnhancedResponse extends ServerResponse {
  // All properties and methods are properly typed
}
```

This ensures excellent developer experience with autocomplete and compile-time error checking.
