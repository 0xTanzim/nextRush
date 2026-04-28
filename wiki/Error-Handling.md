# Error Handling

NextRush provides a structured HTTP error hierarchy in `@nextrush/errors` (re-exported from `nextrush`).

---

## The Error Hierarchy

```
Error
└── HttpError / NextRushError (base)
    ├── 4xx Client Errors
    │   ├── BadRequestError (400)
    │   ├── UnauthorizedError (401)
    │   ├── PaymentRequiredError (402)
    │   ├── ForbiddenError (403)
    │   ├── NotFoundError (404)
    │   ├── MethodNotAllowedError (405)
    │   ├── NotAcceptableError (406)
    │   ├── ProxyAuthRequiredError (407)
    │   ├── RequestTimeoutError (408)
    │   ├── ConflictError (409)
    │   ├── GoneError (410)
    │   ├── LengthRequiredError (411)
    │   ├── PreconditionFailedError (412)
    │   ├── PayloadTooLargeError (413)
    │   ├── UriTooLongError (414)
    │   ├── UnsupportedMediaTypeError (415)
    │   ├── RangeNotSatisfiableError (416)
    │   ├── ExpectationFailedError (417)
    │   ├── ImATeapotError (418)
    │   ├── UnprocessableEntityError (422)
    │   ├── LockedError (423)
    │   ├── FailedDependencyError (424)
    │   ├── TooEarlyError (425)
    │   ├── UpgradeRequiredError (426)
    │   ├── PreconditionRequiredError (428)
    │   ├── TooManyRequestsError (429)
    │   ├── RequestHeaderFieldsTooLargeError (431)
    │   └── UnavailableForLegalReasonsError (451)
    └── 5xx Server Errors
        ├── InternalServerError (500)
        ├── NotImplementedError (501)
        ├── BadGatewayError (502)
        ├── ServiceUnavailableError (503)
        ├── GatewayTimeoutError (504)
        ├── HttpVersionNotSupportedError (505)
        ├── VariantAlsoNegotiatesError (506)
        ├── InsufficientStorageError (507)
        ├── LoopDetectedError (508)
        ├── NotExtendedError (510)
        └── NetworkAuthRequiredError (511)
```

---

## Throwing Errors in Routes

```typescript
import { NotFoundError, BadRequestError, UnauthorizedError } from 'nextrush';

router.get('/users/:id', async (ctx) => {
  const user = await db.findUser(ctx.params.id);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  ctx.json(user);
});

router.post('/users', async (ctx) => {
  const { name, email } = ctx.body as { name?: string; email?: string };

  if (!name || !email) {
    throw new BadRequestError('name and email are required');
  }

  ctx.status = 201;
  ctx.json(await db.createUser({ name, email }));
});
```

---

## Error Options

All HTTP errors accept an `options` object:

```typescript
throw new BadRequestError('Validation failed', {
  code: 'VALIDATION_ERROR',          // machine-readable error code
  expose: true,                       // expose message to client (default for 4xx)
  details: { field: 'email', reason: 'invalid format' },
  cause: originalError,               // wraps the original error
});
```

### `expose` Flag

- **4xx errors**: `expose: true` by default — the message is sent to the client
- **5xx errors**: `expose: false` by default — message is replaced with `'Internal Server Error'`

This prevents leaking internal paths, SQL queries, or stack traces to clients.

---

## Factory Functions

Shorthand functions for common errors:

```typescript
import {
  notFound, badRequest, unauthorized, forbidden, conflict,
  unprocessableEntity, tooManyRequests, internalError,
  methodNotAllowed, badGateway, serviceUnavailable, gatewayTimeout,
  createError, isHttpError, getErrorStatus, getSafeErrorMessage
} from 'nextrush';

throw notFound('User not found');
throw badRequest('Invalid input');
throw unauthorized('Token expired');
throw forbidden('Insufficient permissions');

// Generic factory
throw createError(418, "I'm a teapot");

// Check if an error is an HttpError
if (isHttpError(err)) {
  console.log(err.status);  // 404, 400, etc.
}
```

---

## Validation Errors

```typescript
import { ValidationError } from '@nextrush/errors';

throw new ValidationError('Input validation failed', {
  issues: [
    { field: 'email', message: 'Invalid email format' },
    { field: 'age', message: 'Must be a number' },
  ]
});
```

Specific validation error classes:

```typescript
import {
  RequiredFieldError,
  TypeMismatchError,
  RangeValidationError,
  LengthError,
  PatternError,
  InvalidEmailError,
  InvalidUrlError,
} from '@nextrush/errors';
```

---

## Global Error Handler

### Using `setErrorHandler()`

```typescript
const app = createApp();

app.setErrorHandler((error, ctx) => {
  if (error instanceof ValidationError) {
    ctx.status = 400;
    ctx.json({ error: error.message, details: error.details });
    return;
  }

  if (error instanceof UnauthorizedError) {
    ctx.status = 401;
    ctx.json({ error: 'Please log in' });
    return;
  }

  ctx.status = 500;
  ctx.json({ error: 'Something went wrong' });
});
```

### Using `errorHandler()` Middleware

```typescript
import { errorHandler } from 'nextrush';

// Register before routes to catch all errors
app.use(errorHandler({
  includeStack: process.env.NODE_ENV !== 'production',
  logger: (err, ctx) => myLogger.error({ err, path: ctx.path }),
  handlers: new Map([
    [ValidationError, (err, ctx) => {
      ctx.status = 422;
      ctx.json({ errors: err.details });
    }],
  ]),
}));
```

---

## Not Found Handler

Register after all routes to handle unmatched requests:

```typescript
import { notFoundHandler } from 'nextrush';

// Routes ...
app.route('/api', router);

// Catch-all 404
app.use(notFoundHandler('The requested resource was not found'));
```

---

## Error Properties

Every `HttpError` instance has:

| Property | Type | Description |
|---|---|---|
| `status` | `number` | HTTP status code |
| `message` | `string` | Error message |
| `code` | `string` | Machine-readable error code |
| `expose` | `boolean` | Whether to send message to client |
| `details` | `Record<string, unknown> \| undefined` | Additional error details |
| `cause` | `unknown` | Original error that caused this one |
