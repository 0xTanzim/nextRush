# Middleware

Koa-style async middleware for intercepting, transforming, and controlling the
HTTP request/response lifecycle.

## Middleware Signature

```typescript
import type { Middleware } from '@nextrush/types';

const myMiddleware: Middleware = async (ctx) => {
  // UPSTREAM — runs before route handler
  await ctx.next();
  // DOWNSTREAM — runs after route handler
};
```

## Register Middleware

```typescript
import { createApp } from '@nextrush/core';

const app = createApp();
app.use(myMiddleware);
```

Order matters. First registered = outermost (runs first on request, last on response).

## Patterns

### Logging & Timing

```typescript
const timer: Middleware = async (ctx) => {
  const start = Date.now();
  await ctx.next();
  ctx.set('X-Response-Time', `${Date.now() - start}ms`);
};
```

### Authentication (Short-Circuit)

```typescript
const auth: Middleware = async (ctx) => {
  const token = ctx.get('authorization');
  if (!token) {
    ctx.status = 401;
    return ctx.json({ error: 'Unauthorized' });
    // Does NOT call ctx.next() — request stops here
  }
  ctx.state.user = verifyToken(token);
  await ctx.next();
};
```

### Error Boundary

Register as the FIRST middleware so it wraps everything:

```typescript
import { HttpError } from '@nextrush/errors';

const errorHandler: Middleware = async (ctx) => {
  try {
    await ctx.next();
  } catch (err) {
    if (err instanceof HttpError) {
      ctx.status = err.statusCode;
      ctx.json({ error: { status: err.statusCode, message: err.message, code: err.name } });
    } else {
      ctx.status = 500;
      ctx.json({ error: { status: 500, message: 'Internal Server Error' } });
    }
  }
};
```

### Response Headers

```typescript
const security: Middleware = async (ctx) => {
  await ctx.next();
  ctx.set('X-Content-Type-Options', 'nosniff');
  ctx.set('X-Frame-Options', 'DENY');
};
```

### State Passing

```typescript
const loadUser: Middleware = async (ctx) => {
  ctx.state.user = await getUserFromToken(ctx.get('authorization'));
  await ctx.next();
};

// Later middleware or route handler:
const user = ctx.state.user;
```

## Rules

- MUST call `ctx.next()` OR send a response — never both, never neither
- Use `ctx.state` for passing data between middleware (not globals)
- Keep each middleware focused on one responsibility
- No blocking synchronous I/O
- Error handler must be the outermost middleware
- Never include stack traces or internal paths in error responses

## Troubleshooting

| Problem                    | Cause                                         | Solution                                        |
| -------------------------- | --------------------------------------------- | ----------------------------------------------- |
| Response never sent        | Missing `ctx.next()` and no explicit response | Add `await ctx.next()` or send a response       |
| Double response            | Calls `ctx.next()` AND sends response         | Choose one — next() or response, not both       |
| State undefined downstream | Set `ctx.state` after `ctx.next()`            | Set state BEFORE calling `await ctx.next()`     |
| Middleware skipped         | Registered after routes                       | Register middleware before mounting routes      |
| Error not caught           | Error middleware not first                    | Register error handler as the FIRST `app.use()` |
