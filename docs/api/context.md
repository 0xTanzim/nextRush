# Context API Reference

The Context object is the heart of NextRush v2. It contains all request and response information with Express-like design and modern convenience methods.

## What it is

The Context object combines request and response data into a single, type-safe object that's passed to every middleware and route handler.

## When to use

Use the Context object in every middleware and route handler. It's your gateway to:

- Request data (body, headers, params, query)
- Response methods (JSON, redirects, files)
- Utility methods (validation, assertions)

## TypeScript signature

```typescript
interface Context {
  // Request data
  req: NextRushRequest;
  res: NextRushResponse;
  body: unknown;
  method: string;
  url: string;
  path: string;
  headers: IncomingMessage['headers'];
  query: ParsedUrlQuery;
  params: Record<string, string>;

  // Context utilities
  state: Record<string, unknown>;
  logger?: Logger;
  requestId?: string;
  startTime: number;

  // Convenience methods
  json(data: unknown): void;
  send(data: string | Buffer | object): void;
  redirect(url: string, status?: number): void;

  // Koa-style methods
  throw(status: number, message?: string): never;
  assert(condition: unknown, status: number, message?: string): void;

  // Express-like properties
  ip: string;
  secure: boolean;
  protocol: string;
  hostname: string;
  // ... more properties
}
```

## Request properties

### ctx.body

**Type**: `unknown`
**Description**: Request body data (like `req.body` in Express)

```typescript
app.post('/users', async ctx => {
  const userData = ctx.body as { name: string; email: string };
  console.log(userData.name); // Access request body
});
```

### ctx.params

**Type**: `Record<string, string>`
**Description**: Route parameters from URL patterns

```typescript
app.get('/users/:id/posts/:postId', async ctx => {
  const userId = ctx.params.id; // From :id
  const postId = ctx.params.postId; // From :postId
  ctx.json({ userId, postId });
});
```

### ctx.query

**Type**: `ParsedUrlQuery`
**Description**: Query string parameters

```typescript
app.get('/search', async ctx => {
  const query = ctx.query.q; // ?q=javascript
  const page = ctx.query.page || '1'; // ?page=2
  const tags = ctx.query.tags; // ?tags=js&tags=node (array)

  ctx.json({ query, page, tags });
});
```

### ctx.headers

**Type**: `IncomingMessage['headers']`
**Description**: Request headers

```typescript
app.get('/api/data', async ctx => {
  const auth = ctx.headers.authorization;
  const userAgent = ctx.headers['user-agent'];
  const contentType = ctx.headers['content-type'];

  if (!auth) {
    ctx.res.status(401).json({ error: 'No authorization header' });
    return;
  }
});
```

### ctx.method

**Type**: `string`
**Description**: HTTP method (GET, POST, PUT, DELETE, etc.)

```typescript
app.use(async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path}`); // "GET /users"
  await next();
});
```

### ctx.path

**Type**: `string`
**Description**: Request path without query string

```typescript
// Request: GET /users/123?include=posts
app.get('/users/:id', async ctx => {
  console.log(ctx.path); // "/users/123"
  console.log(ctx.url); // "/users/123?include=posts"
});
```

### ctx.ip

**Type**: `string`
**Description**: Client IP address

```typescript
app.get('/location', async ctx => {
  const clientIP = ctx.ip;
  ctx.json({ ip: clientIP });
});
```

### ctx.secure

**Type**: `boolean`
**Description**: True if request is over HTTPS

```typescript
app.use(async (ctx, next) => {
  if (!ctx.secure && process.env.NODE_ENV === 'production') {
    ctx.redirect(`https://${ctx.hostname}${ctx.url}`);
    return;
  }
  await next();
});
```

## Response methods

### ctx.json(data)

**Type**: `(data: unknown) => void`
**Description**: Send JSON response (convenience method)

```typescript
app.get('/users', async ctx => {
  const users = await getUsers();
  ctx.json(users); // Content-Type: application/json

  // With status code
  ctx.json({ error: 'Not found' }, 404);
});
```

### ctx.send(data)

**Type**: `(data: string | Buffer | object) => void`
**Description**: Smart send method that detects content type

```typescript
app.get('/data', async ctx => {
  ctx.send({ users: [] }); // → JSON response
  ctx.send('Hello World'); // → Text response
  ctx.send(Buffer.from('data')); // → Binary response
});
```

### ctx.redirect(url, status?)

**Type**: `(url: string, status?: number) => void`
**Description**: Redirect to another URL

```typescript
app.post('/login', async ctx => {
  const { username, password } = ctx.body as LoginData;

  if (await validateLogin(username, password)) {
    ctx.redirect('/dashboard'); // 302 redirect
  } else {
    ctx.redirect('/login?error=1', 302);
  }
});
```

## Express-style response (ctx.res)

All Express.js response methods are available via `ctx.res`:

### ctx.res.json(data)

```typescript
app.get('/users', async ctx => {
  ctx.res.json({ users: [] });
  ctx.res.status(201).json({ created: true });
});
```

### ctx.res.status(code)

```typescript
app.get('/users/:id', async ctx => {
  const user = await findUser(ctx.params.id);

  if (!user) {
    ctx.res.status(404).json({ error: 'User not found' });
    return;
  }

  ctx.res.status(200).json(user);
});
```

### ctx.res.set(header, value)

```typescript
app.get('/download', async ctx => {
  ctx.res.set('Content-Disposition', 'attachment; filename="data.json"');
  ctx.res.set('Content-Type', 'application/json');
  ctx.res.json({ data: 'export' });
});
```

### ctx.res.cookie(name, value, options)

```typescript
app.post('/login', async ctx => {
  const token = await generateToken(ctx.body);

  ctx.res.cookie('token', token, {
    httpOnly: true,
    secure: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  ctx.res.json({ success: true });
});
```

## Context utilities

### ctx.state

**Type**: `Record<string, unknown>`
**Description**: Object for sharing data between middleware

```typescript
// Authentication middleware
const auth = async (ctx, next) => {
  const user = await validateToken(ctx.headers.authorization);
  ctx.state.user = user; // Store user in state
  await next();
};

// Route handler
app.get('/profile', async ctx => {
  const user = ctx.state.user; // Access user from middleware
  ctx.json({ profile: user });
});
```

### ctx.throw(status, message)

**Type**: `(status: number, message?: string) => never`
**Description**: Throw an HTTP error

```typescript
app.get('/admin', async ctx => {
  const user = ctx.state.user;

  if (!user) {
    ctx.throw(401, 'Authentication required');
  }

  if (!user.isAdmin) {
    ctx.throw(403, 'Admin access required');
  }

  ctx.json({ adminData: 'secret' });
});
```

### ctx.assert(condition, status, message)

**Type**: `(condition: unknown, status: number, message?: string) => void`
**Description**: Assert a condition or throw HTTP error

```typescript
app.post('/users', async ctx => {
  const { name, email } = ctx.body as CreateUserData;

  ctx.assert(name, 400, 'Name is required');
  ctx.assert(email, 400, 'Email is required');
  ctx.assert(email.includes('@'), 400, 'Invalid email format');

  const user = await createUser({ name, email });
  ctx.json(user, 201);
});
```

### ctx.logger

**Type**: `Logger | undefined`
**Description**: Request-specific logger with request ID

```typescript
app.get('/users', async ctx => {
  ctx.logger?.info('Fetching users', { userId: ctx.state.user?.id });

  try {
    const users = await getUsers();
    ctx.json(users);
  } catch (error) {
    ctx.logger?.error('Failed to fetch users', { error: error.message });
    ctx.throw(500, 'Failed to fetch users');
  }
});
```

## Advanced response methods

### ctx.res.sendFile(path, options)

```typescript
app.get('/download/:filename', async ctx => {
  const filename = ctx.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  ctx.res.sendFile(filePath, {
    root: __dirname,
    etag: true,
  });
});
```

### ctx.res.render(template, data)

```typescript
app.get('/user/:id', async ctx => {
  const user = await getUser(ctx.params.id);

  await ctx.res.render('user-profile', {
    user,
    title: `${user.name}'s Profile`,
  });
});
```

### ctx.res.stream(stream, contentType)

```typescript
app.get('/logs', async ctx => {
  const logStream = fs.createReadStream('/var/log/app.log');
  ctx.res.stream(logStream, 'text/plain');
});
```

## Complete example

```typescript
import { createApp } from 'nextrush';
import type { Context, Middleware } from 'nextrush/types';

const app = createApp();

// Middleware that uses context
const requestLogger: Middleware = async (ctx, next) => {
  console.log(`${ctx.method} ${ctx.path} from ${ctx.ip}`);
  ctx.state.startTime = Date.now();
  await next();
  const duration = Date.now() - ctx.state.startTime;
  console.log(`Completed in ${duration}ms`);
};

app.use(requestLogger);

// Route using multiple context features
app.post('/api/users/:id/posts', async ctx => {
  // Request data
  const userId = ctx.params.id;
  const postData = ctx.body as { title: string; content: string };
  const authHeader = ctx.headers.authorization;

  // Validation using assertions
  ctx.assert(authHeader, 401, 'Authorization required');
  ctx.assert(postData.title, 400, 'Title is required');
  ctx.assert(postData.content, 400, 'Content is required');

  try {
    // Business logic
    const post = await createPost(userId, postData);

    // Response with convenience method
    ctx.json(
      {
        message: 'Post created successfully',
        post,
        timestamp: new Date().toISOString(),
      },
      201
    );
  } catch (error) {
    ctx.logger?.error('Failed to create post', {
      userId,
      error: error.message,
    });
    ctx.throw(500, 'Failed to create post');
  }
});

// Advanced response example
app.get('/export/users', async ctx => {
  const format = ctx.query.format || 'json';
  const users = await getUsers();

  if (format === 'csv') {
    ctx.res.set('Content-Type', 'text/csv');
    ctx.res.set('Content-Disposition', 'attachment; filename="users.csv"');
    ctx.res.csv(users);
  } else {
    ctx.json(users);
  }
});
```

## Performance notes

- Context creation is optimized with object pooling
- Convenience methods (`ctx.json`, `ctx.send`) have minimal overhead
- Request/response properties are computed lazily
- State object is shared efficiently between middleware

## Security notes

- Always validate `ctx.body` before use
- Use `ctx.assert()` for input validation
- Access headers through `ctx.headers` (automatically lowercased)
- Use `ctx.secure` to enforce HTTPS in production

## See also

- [Middleware guide](./middleware.md) - Working with middleware and context
- [Routing guide](./routing.md) - Route handlers and context
- [Error handling](./errors.md) - Error handling with context
- [Request enhancement](./request-enhancement.md) - Extended request features
- [Response enhancement](./response-enhancement.md) - Extended response features

---

_Added in v2.0.0-alpha.1_
