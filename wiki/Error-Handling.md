# Error Handling

A handler can fail in a dozen ways. Node gives you `throw` and nothing else, so naive handlers grow their own `try/catch`, their own status code, and their own JSON shape — and the day one forgets, a raw stack trace goes out to the client.

NextRush inverts this: a handler signals failure by **throwing a typed error**, and the framework catches it at the edge of the middleware pipeline and serializes one consistent, safe JSON response. You declare *what went wrong*; the framework owns *turning it into an HTTP response*.

## The error hierarchy

Two branches over one base:

```
NextRushError (base)
├── HttpError (every HTTP status error)
│   ├── BadRequestError (400) · UnauthorizedError (401) · ForbiddenError (403)
│   ├── NotFoundError (404) · MethodNotAllowedError (405) · ConflictError (409)
│   ├── UnprocessableEntityError (422) · TooManyRequestsError (429)
│   └── InternalServerError (500) · BadGatewayError (502)
│       · ServiceUnavailableError (503) · GatewayTimeoutError (504) · …
└── ValidationError (400, structured issues)
```

Every `NextRushError` carries `status`, a machine-readable `code`, and an `expose` flag. **4xx errors default to `expose: true`** (the message is safe to send); **5xx errors default to `expose: false`** (the message is never sent — the client gets a generic `Internal Server Error`). Add structured data with `details`, and chain the original failure with `cause`.

## Throw, don't hand-build

```ts
import { createApp, createRouter, listen, NotFoundError } from 'nextrush';

const app = createApp();
const users = createRouter();

users.get('/:id', async (ctx) => {
  const user = await findUser(ctx.params.id);
  if (!user) {
    throw new NotFoundError('User not found'); // stop here — the framework responds
  }
  ctx.json(user);
});

app.route('/users', users);
await listen(app, 8080);

declare function findUser(id: string): Promise<unknown>;
```

The client receives `404` with `{ "error": "NotFoundError", "message": "User not found", "code": "NOT_FOUND", "status": 404 }`. No `ctx.status`, no error `ctx.json()`, no `catch`.

Three ways to express the same failure, all landing on an identical response:

```ts
import { NotFoundError, HttpError } from 'nextrush';
import type { Context } from 'nextrush';

function a(ctx: Context, user: unknown) {
  if (!user) throw new NotFoundError('User not found');
}

function b(ctx: Context, user: unknown) {
  if (!user) ctx.throw(404, 'User not found');          // shorthand — throws an HttpError
}

function c(ctx: Context, user: unknown) {
  ctx.assert(user, 404, 'User not found');              // throw when the condition is falsy
}
```

## In class-based controllers

Controllers throw the same typed errors, and the framework still owns the response. Attach an [Exception Filter](Exception-Filters) to localize the mapping to a controller or route:

```ts
import { Controller, Get, Param } from 'nextrush/class';
import { NotFoundError } from 'nextrush';

@Controller('/users')
class UsersController {
  @Get('/:id')
  show(@Param('id') id: string): never {
    throw new NotFoundError(`No user ${id}`); // → 404, same shape as the functional path
  }
}
```

## Factory functions

Create errors without `new`. `createError` is re-exported by `nextrush`; the per-status factories come from `@nextrush/errors`:

```ts
import { createError } from 'nextrush';
import { badRequest, notFound } from '@nextrush/errors';

throw notFound('User not found');
throw badRequest('Invalid input');
throw createError(429, 'Slow down', { code: 'RATE_LIMITED' });
```

## How errors flow

The pipeline runs your middleware and handler inside one `try/catch`. A throw unwinds to that single boundary, which:

1. Sets `ctx.status` from the error.
2. Writes `error.toJSON()` as the body.
3. Hides the message of any non-exposed (5xx) error — `{ "error": "Internal Server Error", "code": "INTERNAL_ERROR", "status": 500 }`.

A plain, untyped `throw` becomes a safe coded `500`, never a leaked stack. Async errors propagate the same way — **no wrapper needed** (`catchAsync()` was removed; it was a no-op).

## Custom error handling

**Middleware form** — `errorHandler()`, placed **first** so it wraps everything:

```ts
import { createApp, errorHandler, listen } from 'nextrush';

const app = createApp();

app.use(errorHandler({
  includeStack: process.env.NODE_ENV !== 'production', // dev-only stack in the body
  logger: (err, ctx) => myLogger.error(`${ctx.method} ${ctx.path}`, err),
  transform: (error, ctx) => ({                        // reshape the response body
    success: false,
    type: error.name,
    requestId: ctx.state.requestId,
  }),
}));

declare const myLogger: { error(msg: string, err: Error): void };

await listen(app, 8080);
```

`includeStack` gates stack traces in the body — never enable it unconditionally in production. `logger` routes errors into your observability stack. `transform` rewrites the body when your API needs a non-default shape.

**Application form** — `app.setErrorHandler()` for errors that escape the chain:

```ts
const app = createApp();

app.setErrorHandler((error, ctx) => {
  if (error instanceof HttpError) {
    ctx.status = error.status;
    ctx.json(error.toJSON());
    return;
  }
  ctx.status = 500;
  ctx.json({ error: 'Internal Server Error' });
});
```

`app.onError()` is deprecated — use `setErrorHandler()`. Preserve the safe default: never send `err.message` or `err.stack` to clients in production.

## 404 catch-all

`notFoundHandler()` catches requests that pass through all routes unresponded. Place it **last**:

```ts
import { createApp, notFoundHandler, listen } from 'nextrush';

const app = createApp();
// ...routes...
app.use(notFoundHandler()); // fires only if nothing above responded
await listen(app, 8080);
```

It checks `!ctx.responded && ctx.status === 404`.

## Validation errors

`ValidationError(issues)` carries structured issues (each with `path`, `message`, `rule`):

```ts
import { ValidationError } from 'nextrush';
import type { ValidationIssue } from 'nextrush';

const issues: ValidationIssue[] = [];

if (!data.name) {
  issues.push({ path: 'name', message: 'Name is required', rule: 'required' });
}

if (issues.length > 0) {
  throw new ValidationError(issues);
}
```

The response strips the `received` field from issues so sensitive input values never leak. See the docs [error-handling guide](https://0xtanzim.github.io/nextRush/docs/guides/api-development/error-handling) for the full option surface, or [Middleware](Middleware) for where the error handler sits in the pipeline.
