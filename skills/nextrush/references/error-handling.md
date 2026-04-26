# Error Handling

Structured HTTP error hierarchy with typed error classes, built-in error
middleware, factory functions, and production-safe responses.

## Throw Built-in Errors

```typescript
import { NotFoundError, BadRequestError, errorHandler, notFoundHandler } from 'nextrush';
import { ValidationError, RequiredFieldError } from '@nextrush/errors';

router.get('/users/:id', (ctx) => {
  const user = findById(ctx.params.id);
  if (!user) throw new NotFoundError('User not found');
  ctx.json(user);
});

router.post('/users', (ctx) => {
  const body = ctx.body as Record<string, unknown>;
  if (!body.email) throw new RequiredFieldError('email');
  if (typeof body.email !== 'string' || !body.email.includes('@'))
    throw new ValidationError([{ path: 'email', message: 'Invalid email', rule: 'email' }]);
  // ...
});
```

## Built-in Error Handler Middleware

`errorHandler()` from `nextrush`. Register as the **first** middleware:

```typescript
import { createApp, errorHandler, notFoundHandler, listen } from 'nextrush';

const app = createApp();

app.use(errorHandler()); // basic usage
app.use(
  errorHandler({
    // with options
    includeStack: process.env.NODE_ENV !== 'production',
    logger: (err, ctx) => console.error(`${ctx.method} ${ctx.path}:`, err),
    transform: (err, ctx) => ({ error: err.message, requestId: ctx.state.requestId }),
    handlers: new Map([
      [
        CustomError,
        (err, ctx) => {
          ctx.status = 418;
          ctx.json({ tea: true });
        },
      ],
    ]),
  })
);

app.use(notFoundHandler()); // LAST: catches unmatched routes
listen(app, 3000);
```

### ErrorHandlerOptions

| Option         | Type                                                      | Description                           |
| -------------- | --------------------------------------------------------- | ------------------------------------- |
| `includeStack` | `boolean`                                                 | Include stack trace in response (dev) |
| `logger`       | `(error: Error, ctx: Context) => void`                    | Custom error logger                   |
| `transform`    | `(error: Error, ctx: Context) => Record<string, unknown>` | Custom response body transformer      |
| `handlers`     | `Map<ErrorClass, (error: Error, ctx: Context) => void>`   | Handle specific error types           |

## Not Found Handler

`notFoundHandler()` returns 404 JSON when no route matched and no response was sent:

```typescript
app.use(notFoundHandler()); // default message: "Not Found"
app.use(notFoundHandler('No such resource')); // custom message
```

Register **after** routes — checks `ctx.responded` and `ctx.status === 404`.

## catchAsync

Wraps async handlers. **Deprecated** — async errors propagate naturally:

```typescript
import { catchAsync } from 'nextrush';

router.get(
  '/users/:id',
  catchAsync(async (ctx) => {
    const user = await db.users.findById(ctx.params.id);
    if (!user) throw new NotFoundError('User not found');
    ctx.json(user);
  })
);
```

## ctx.throw() and ctx.assert()

Context helpers for inline error throwing:

```typescript
router.get('/users/:id', (ctx) => {
  ctx.throw(404, 'User not found'); // throws HttpError(404), stops execution
  ctx.throw(401); // uses default "Unauthorized"
});

router.get('/admin', (ctx) => {
  const user = getUser(ctx);
  ctx.assert(user, 401, 'Must be logged in'); // throws if falsy
  ctx.assert(user.isAdmin, 403, 'Admin required'); // narrows type (asserts)
  ctx.json({ admin: true });
});
```

## Custom Error Middleware

Write your own instead of using the built-in:

```typescript
import { HttpError, isHttpError } from 'nextrush';
import type { Middleware } from 'nextrush';

const customErrorHandler: Middleware = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (isHttpError(err)) {
      ctx.status = err.status;
      ctx.json({ error: err.message, code: err.code, status: err.status });
    } else {
      console.error('Unexpected error:', err);
      ctx.status = 500;
      ctx.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR', status: 500 });
    }
  }
};

app.use(customErrorHandler); // register FIRST
```

## Error Class Table

### Common 4xx (from `nextrush`)

| Class                      | Status | Code                   | Use Case                 |
| -------------------------- | ------ | ---------------------- | ------------------------ |
| `BadRequestError`          | 400    | `BAD_REQUEST`          | Malformed input          |
| `UnauthorizedError`        | 401    | `UNAUTHORIZED`         | Missing auth credentials |
| `ForbiddenError`           | 403    | `FORBIDDEN`            | Insufficient permissions |
| `NotFoundError`            | 404    | `NOT_FOUND`            | Resource not found       |
| `MethodNotAllowedError`    | 405    | `METHOD_NOT_ALLOWED`   | Wrong HTTP method        |
| `ConflictError`            | 409    | `CONFLICT`             | Duplicate resource       |
| `UnprocessableEntityError` | 422    | `UNPROCESSABLE_ENTITY` | Semantic errors          |
| `TooManyRequestsError`     | 429    | `TOO_MANY_REQUESTS`    | Rate limited             |

### Extended 4xx (from `@nextrush/errors`)

| Class                              | Status | Code                              |
| ---------------------------------- | ------ | --------------------------------- |
| `PaymentRequiredError`             | 402    | `PAYMENT_REQUIRED`                |
| `NotAcceptableError`               | 406    | `NOT_ACCEPTABLE`                  |
| `RequestTimeoutError`              | 408    | `REQUEST_TIMEOUT`                 |
| `GoneError`                        | 410    | `GONE`                            |
| `PayloadTooLargeError`             | 413    | `PAYLOAD_TOO_LARGE`               |
| `UnsupportedMediaTypeError`        | 415    | `UNSUPPORTED_MEDIA_TYPE`          |
| `ImATeapotError`                   | 418    | `IM_A_TEAPOT`                     |
| `LockedError`                      | 423    | `LOCKED`                          |
| `TooEarlyError`                    | 425    | `TOO_EARLY`                       |
| `PreconditionRequiredError`        | 428    | `PRECONDITION_REQUIRED`           |
| `RequestHeaderFieldsTooLargeError` | 431    | `REQUEST_HEADER_FIELDS_TOO_LARGE` |
| `UnavailableForLegalReasonsError`  | 451    | `UNAVAILABLE_FOR_LEGAL_REASONS`   |

### 5xx Server Errors

| Class                          | Status | Source             |
| ------------------------------ | ------ | ------------------ |
| `InternalServerError`          | 500    | `nextrush`         |
| `NotImplementedError`          | 501    | `nextrush`         |
| `BadGatewayError`              | 502    | `nextrush`         |
| `ServiceUnavailableError`      | 503    | `nextrush`         |
| `GatewayTimeoutError`          | 504    | `nextrush`         |
| `HttpVersionNotSupportedError` | 505    | `@nextrush/errors` |
| `InsufficientStorageError`     | 507    | `@nextrush/errors` |
| `LoopDetectedError`            | 508    | `@nextrush/errors` |
| `NetworkAuthRequiredError`     | 511    | `@nextrush/errors` |

### Validation Errors (from `@nextrush/errors`, extend `NextRushError`, status 400)

| Class                  | Constructor                             | Use Case                |
| ---------------------- | --------------------------------------- | ----------------------- |
| `ValidationError`      | `(issues: ValidationIssue[], message?)` | Multiple field errors   |
| `RequiredFieldError`   | `(field: string)`                       | Missing required field  |
| `TypeMismatchError`    | `(field, expected, received)`           | Wrong field type        |
| `RangeValidationError` | `(field, min?, max?)`                   | Value out of range      |
| `PatternError`         | `(field, pattern, message?)`            | Regex pattern mismatch  |
| `LengthError`          | `(field, min?, max?)`                   | String length violation |
| `InvalidEmailError`    | `(field?)`                              | Invalid email format    |
| `InvalidUrlError`      | `(field?)`                              | Invalid URL format      |

Static helpers: `ValidationError.fromField(path, msg)`, `ValidationError.fromFields({ field: msg })`.

## Factory Functions

```typescript
import { createError, isHttpError } from 'nextrush'; // from nextrush
import { badRequest, notFound, unauthorized, forbidden } from '@nextrush/errors'; // from errors

throw createError(404, 'User not found');
throw badRequest('Missing name');
throw notFound('User not found');
```

| Function                | Status | From `nextrush` | From `@nextrush/errors` |
| ----------------------- | ------ | --------------- | ----------------------- |
| `createError(status)`   | any    | Yes             | Yes                     |
| `badRequest()`          | 400    | No              | Yes                     |
| `unauthorized()`        | 401    | No              | Yes                     |
| `forbidden()`           | 403    | No              | Yes                     |
| `notFound()`            | 404    | No              | Yes                     |
| `methodNotAllowed()`    | 405    | No              | Yes                     |
| `conflict()`            | 409    | No              | Yes                     |
| `unprocessableEntity()` | 422    | No              | Yes                     |
| `tooManyRequests()`     | 429    | No              | Yes                     |
| `internalError()`       | 500    | No              | Yes                     |
| `badGateway()`          | 502    | No              | Yes                     |
| `serviceUnavailable()`  | 503    | No              | Yes                     |
| `gatewayTimeout()`      | 504    | No              | Yes                     |

## Utility Functions

```typescript
import { isHttpError, createError } from 'nextrush';
import { getErrorStatus, getSafeErrorMessage } from '@nextrush/errors';

isHttpError(err); // type guard: error is HttpError
getErrorStatus(err); // returns status number (500 fallback)
getSafeErrorMessage(err); // client-safe message (respects expose flag)
```

## Custom Error Classes

```typescript
import { HttpError } from 'nextrush';

class InsufficientFundsError extends HttpError {
  constructor(balance: number, required: number) {
    super(422, `Insufficient funds: balance ${balance}, required ${required}`, {
      code: 'INSUFFICIENT_FUNDS',
      details: { balance, required },
    });
  }
}
```

`HttpError` constructor: `new HttpError(status, message?, { code?, expose?, details?, cause? })`.

## Rules

- `errorHandler()` must be the **first** registered middleware
- `notFoundHandler()` should be the **last** registered middleware
- NEVER include `err.stack` or file paths in production responses
- NEVER use empty catch blocks — always log or re-throw
- Always throw `HttpError` subclasses, never plain strings
- Custom errors extend `HttpError` — `this.name` is set automatically
- Common errors: import from `nextrush`; extended/validation: from `@nextrush/errors`
- `ValidationError` takes `ValidationIssue[]`, not a string

## Troubleshooting

| Problem                  | Cause                          | Solution                                            |
| ------------------------ | ------------------------------ | --------------------------------------------------- |
| Stack traces in response | `includeStack: true` in prod   | Set `includeStack: false` or omit (default)         |
| Unhandled rejection      | No `errorHandler()` middleware | Add `app.use(errorHandler())` as first middleware   |
| Silent error swallowing  | Empty catch block              | Always log or re-throw in catch blocks              |
| Wrong status code        | Throwing plain `Error`         | Use `HttpError` subclasses or `createError(status)` |
| Error middleware skipped | Registered after routes        | Register `errorHandler()` FIRST, before any routes  |
| ValidationError misuse   | Passing string to constructor  | Pass `ValidationIssue[]`: `[{ path, message }]`     |
| 404 not returned         | Missing `notFoundHandler()`    | Add `app.use(notFoundHandler())` after routes       |
