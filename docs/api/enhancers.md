# Request/Response Enhancers API Reference

# Request and Response Enhancers

Request and Response Enhancers add **Express-inspired helper methods** to NextRush v2's **Koa-style context**, providing familiar APIs while maintaining Koa's async middleware architecture.

## What it is

Enhancers extend the basic Node.js `IncomingMessage` and `ServerResponse` objects with convenient methods and properties that make web development easier and more intuitive.

## When to use

Enhancers are used automatically by NextRush v2, but you can also use them directly when:

- Building custom middleware that needs Express-inspired helper methods
- Creating utilities that work with HTTP objects
- Extending the framework with additional functionality

## TypeScript signature

```typescript
// Request Enhancer
interface EnhancedRequest extends IncomingMessage {
  params: Record<string, string>;
  query: ParsedUrlQuery;
  body: unknown;
  pathname: string;
  originalUrl: string;
  ip: string;
  ips: string[];
  cookies: Record<string, string>;

  // Validation and sanitization
  validate(rules: Record<string, ValidationRule>): ValidationResult;
  sanitize(options?: SanitizeOptions): EnhancedRequest;
}

// Response Enhancer
interface EnhancedResponse extends ServerResponse {
  locals: Record<string, unknown>;

  // Status and basic responses
  status(code: number): EnhancedResponse;
  json(data: unknown): void;
  send(data: string | Buffer | object): void;
  html(data: string): void;
  text(data: string): void;

  // File operations
  sendFile(filePath: string, options?: FileOptions): void;
  download(filePath: string, filename?: string): void;

  // Redirects and cookies
  redirect(url: string, status?: number): void;
  cookie(name: string, value: string, options?: CookieOptions): void;
  clearCookie(name: string, options?: CookieOptions): void;
}
```

---

## Request Enhancer

The Request Enhancer adds Express-inspired helper properties and methods to incoming HTTP requests in the Koa-style context.

## Basic properties

**What it is**: Common request properties that are automatically parsed and available.

**Example**:

```typescript
import { RequestEnhancer } from 'nextrush';

app.get('/users/:id', async ctx => {
  // Route parameters (automatically parsed)
  const userId = ctx.req.params.id;

  // Query string (automatically parsed)
  const page = ctx.req.query.page || 1;
  const limit = ctx.req.query.limit || 10;

  // Request body (parsed by body parser middleware)
  const requestData = ctx.req.body;

  // URL information
  console.log('Path:', ctx.req.pathname); // '/users/123'
  console.log('Original URL:', ctx.req.originalUrl); // '/users/123?page=1'

  // Client information
  console.log('Client IP:', ctx.req.ip); // '192.168.1.100'
  console.log('All IPs:', ctx.req.ips); // ['192.168.1.100', '10.0.0.1']

  const users = await getUserList({ page, limit, userId });
  ctx.res.json(users);
});
```

## Cookies

**What it is**: Automatic cookie parsing and easy access to cookie values.

**Example**:

```typescript
app.get('/dashboard', async ctx => {
  // Cookies are automatically parsed
  const sessionId = ctx.req.cookies.sessionId;
  const theme = ctx.req.cookies.theme || 'light';
  const language = ctx.req.cookies.lang || 'en';

  if (!sessionId) {
    ctx.res.status(401).json({ error: 'Please log in' });
    return;
  }

  const user = await getUserBySession(sessionId);
  const dashboard = await getDashboard(user.id, { theme, language });

  ctx.res.json(dashboard);
});
```

## Validation

**What it is**: Built-in request validation with common validation rules.

**Example**:

```typescript
app.post('/users', async ctx => {
  // Define validation rules
  const validationResult = ctx.req.validate({
    name: {
      required: true,
      type: 'string',
      minLength: 2,
      maxLength: 50,
    },
    email: {
      required: true,
      type: 'email',
    },
    age: {
      required: false,
      type: 'number',
      min: 18,
      max: 120,
    },
  });

  if (!validationResult.isValid) {
    ctx.res.status(400).json({
      error: 'Validation failed',
      details: validationResult.errors,
    });
    return;
  }

  const user = await createUser(validationResult.data);
  ctx.res.status(201).json(user);
});
```

## Sanitization

**What it is**: Clean and sanitize request data to prevent security issues.

**Example**:

```typescript
app.post('/comments', async ctx => {
  // Sanitize the request data
  ctx.req.sanitize({
    trim: true, // Remove whitespace
    removeHtml: true, // Strip HTML tags
    escape: true, // Escape special characters
  });

  const comment = {
    text: ctx.req.body.text, // Now sanitized
    authorId: ctx.state.user.id,
  };

  const savedComment = await createComment(comment);
  ctx.res.status(201).json(savedComment);
});
```

---

## Response Enhancer

The Response Enhancer adds Express-inspired helper methods to HTTP responses in the Koa-style context.

## Basic responses

**What it is**: Simple methods to send different types of responses.

**Example**:

```typescript
app.get('/api/users', async ctx => {
  const users = await getUsers();

  // JSON response (most common)
  ctx.res.json(users);
});

app.get('/health', async ctx => {
  // Plain text response
  ctx.res.text('OK');
});

app.get('/welcome', async ctx => {
  // HTML response
  ctx.res.html('<h1>Welcome to NextRush!</h1>');
});

app.get('/data.xml', async ctx => {
  const xmlData = generateXML();

  // XML response
  ctx.res.xml(xmlData);
});

app.get('/report.csv', async ctx => {
  const data = await getReportData();

  // CSV response with automatic download
  ctx.res.csv(data, 'monthly-report.csv');
});
```

## Status codes

**What it is**: Set HTTP status codes with method chaining.

**Example**:

```typescript
app.post('/users', async ctx => {
  try {
    const user = await createUser(ctx.req.body);

    // Set status and send response
    ctx.res.status(201).json({
      success: true,
      user,
    });
  } catch (error) {
    if (error.code === 'EMAIL_EXISTS') {
      ctx.res.status(409).json({
        error: 'Email already exists',
      });
    } else {
      ctx.res.status(500).json({
        error: 'Failed to create user',
      });
    }
  }
});
```

## File operations

**What it is**: Send files, handle downloads, and serve static content.

**Example**:

```typescript
app.get('/download/:filename', async ctx => {
  const filename = ctx.req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  // Send file for download
  ctx.res.download(filePath, filename);
});

app.get('/images/:id', async ctx => {
  const imageId = ctx.req.params.id;
  const imagePath = await getImagePath(imageId);

  // Send file directly (will be displayed in browser)
  ctx.res.sendFile(imagePath);
});

app.get('/reports/:id/pdf', async ctx => {
  const reportId = ctx.req.params.id;
  const pdfBuffer = await generatePDF(reportId);

  // Send buffer as file
  ctx.res
    .status(200)
    .set('Content-Type', 'application/pdf')
    .set('Content-Disposition', 'attachment; filename=report.pdf')
    .send(pdfBuffer);
});
```

## Cookies

**What it is**: Set and clear cookies with security options.

**Example**:

```typescript
app.post('/auth/login', async ctx => {
  const { email, password } = ctx.req.body;
  const user = await authenticateUser(email, password);

  if (user) {
    const sessionId = generateSessionId();

    // Set secure session cookie
    ctx.res.cookie('sessionId', sessionId, {
      httpOnly: true, // Prevent XSS
      secure: true, // HTTPS only
      sameSite: 'strict', // CSRF protection
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Set user preferences
    ctx.res.cookie('theme', user.theme, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    ctx.res.json({ success: true, user });
  } else {
    ctx.res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/auth/logout', async ctx => {
  // Clear cookies
  ctx.res.clearCookie('sessionId');
  ctx.res.clearCookie('theme');

  ctx.res.json({ success: true });
});
```

## Redirects

**What it is**: Redirect users to different URLs with proper status codes.

**Example**:

```typescript
app.get('/old-page', async ctx => {
  // Permanent redirect (301)
  ctx.res.redirect('/new-page', 301);
});

app.post('/submit-form', async ctx => {
  await processForm(ctx.req.body);

  // Temporary redirect after POST (302)
  ctx.res.redirect('/success');
});

app.get('/admin', async ctx => {
  if (!ctx.state.user) {
    // Redirect to login
    ctx.res.redirect('/login');
    return;
  }

  if (!ctx.state.user.isAdmin) {
    // Redirect to home
    ctx.res.redirect('/dashboard');
    return;
  }

  const adminData = await getAdminData();
  ctx.res.json(adminData);
});
```

## Response locals

**What it is**: Store data that's available to templates and other response processing.

**Example**:

```typescript
// Middleware to set common template data
app.use(async (ctx, next) => {
  ctx.res.locals.siteName = 'My Website';
  ctx.res.locals.currentYear = new Date().getFullYear();

  if (ctx.state.user) {
    ctx.res.locals.user = ctx.state.user;
    ctx.res.locals.isLoggedIn = true;
  }

  await next();
});

app.get('/profile', async ctx => {
  // res.locals is automatically available to templates
  const profileData = await getUserProfile(ctx.state.user.id);

  ctx.res.locals.profileData = profileData;
  ctx.res.render('profile.html');
});
```

---

# 🔧 Direct Usage

You can use enhancers directly outside of the context object:

```typescript
import { RequestEnhancer, ResponseEnhancer } from 'nextrush';
import { createServer } from 'http';

const server = createServer((req, res) => {
  // Enhance raw Node.js objects
  const enhancedReq = RequestEnhancer.enhance(req);
  const enhancedRes = ResponseEnhancer.enhance(res);

  // Now you can use Express-inspired helper methods
  console.log('Path:', enhancedReq.pathname);
  console.log('Cookies:', enhancedReq.cookies);

  enhancedRes.json({ message: 'Hello World!' });
});

server.listen(3000);
```

---

# 🎯 Complete Example

```typescript
import { createApp } from 'nextrush';

const app = createApp();

// Middleware that uses request enhancement
app.use(async (ctx, next) => {
  // Log request details
  console.log(`${ctx.req.method} ${ctx.req.pathname}`);
  console.log('Query:', ctx.req.query);
  console.log('User Agent:', ctx.req.headers['user-agent']);
  console.log('Client IP:', ctx.req.ip);

  await next();
});

// API endpoint using both enhancers
app.post('/api/contact', async ctx => {
  // Validate request data
  const validation = ctx.req.validate({
    name: { required: true, minLength: 2 },
    email: { required: true, type: 'email' },
    message: { required: true, minLength: 10 },
  });

  if (!validation.isValid) {
    ctx.res.status(400).json({
      error: 'Validation failed',
      details: validation.errors,
    });
    return;
  }

  // Sanitize input
  ctx.req.sanitize({ trim: true, removeHtml: true });

  // Process contact form
  const contactData = {
    name: ctx.req.body.name,
    email: ctx.req.body.email,
    message: ctx.req.body.message,
    ip: ctx.req.ip,
    userAgent: ctx.req.headers['user-agent'],
  };

  const contact = await saveContact(contactData);

  // Send email notification
  await sendContactNotification(contact);

  // Set success cookie
  ctx.res.cookie('lastContact', Date.now(), {
    maxAge: 60 * 60 * 1000, // 1 hour
  });

  // Return success response
  ctx.res.status(201).json({
    success: true,
    message: 'Contact form submitted successfully',
    id: contact.id,
  });
});

app.listen(3000);
```

---

## Performance notes

- Request enhancement happens automatically during request processing
- Validation and sanitization are optional and only run when called
- Cookie parsing is lazy-loaded on first access
- File operations use streams for memory efficiency

## Security notes

- Always validate and sanitize user input
- Use `httpOnly` cookies for sensitive data
- Set appropriate `sameSite` and `secure` cookie options
- Validate file paths to prevent directory traversal attacks

## See also

- [Context API](./context.md) - How enhancers integrate with context
- [Middleware guide](./middleware.md) - Using enhancers in middleware
- [Cookies guide](../guides/cookies.md) - Advanced cookie handling
- [File operations guide](../guides/file-operations.md) - File upload/download patterns

---

_Added in v2.0.0-alpha.1_
