# Error Handling

Structured HTTP error hierarchy with typed error classes, error middleware, and
production-safe responses.

## Throw Built-in Errors

```typescript
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  ValidationError,
} from '@nextrush/errors';

router.get('/users/:id', (ctx) => {
  const user = findById(ctx.params.id);
  if (!user) throw new NotFoundError('User not found');
  return ctx.json(user);
});

router.post('/users', (ctx) => {
  const body = ctx.body as Record<string, unknown>;
  if (!body.email) throw new BadRequestError('Email is required');
  if (typeof body.email !== 'string' || !body.email.includes('@')) {
    throw new ValidationError('Valid email is required');
  }
  // ...
});
```

## Error Middleware

Register as the **first** middleware (outermost, wraps everything):

```typescript
import { HttpError } from '@nextrush/errors';
import type { Middleware } from '@nextrush/types';

const errorHandler: Middleware = async (ctx) => {
  try {
    await ctx.next();
  } catch (err) {
    if (err instanceof HttpError) {
      ctx.status = err.statusCode;
      ctx.json({
        error: { status: err.statusCode, message: err.message, code: err.name },
      });
    } else {
      ctx.status = 500;
      ctx.json({
        error: { status: 500, message: 'Internal Server Error', code: 'INTERNAL_ERROR' },
      });
    }
  }
};

app.use(errorHandler); // FIRST middleware registered
```

## Error Classes

| Class                      | Status | Use Case                    |
| -------------------------- | ------ | --------------------------- |
| `BadRequestError`          | 400    | Malformed input             |
| `ValidationError`          | 400    | Parameter validation failed |
| `UnauthorizedError`        | 401    | Missing auth credentials    |
| `ForbiddenError`           | 403    | Insufficient permissions    |
| `NotFoundError`            | 404    | Resource not found          |
| `MethodNotAllowedError`    | 405    | Wrong HTTP method           |
| `ConflictError`            | 409    | Duplicate resource          |
| `UnprocessableEntityError` | 422    | Semantic errors             |
| `TooManyRequestsError`     | 429    | Rate limited                |
| `InternalServerError`      | 500    | Server failure              |
| `NotImplementedError`      | 501    | Not implemented             |
| `BadGatewayError`          | 502    | Bad gateway                 |
| `ServiceUnavailableError`  | 503    | Service unavailable         |
| `GatewayTimeoutError`      | 504    | Gateway timeout             |

## Custom Error Classes

```typescript
import { HttpError } from '@nextrush/errors';

class InsufficientFundsError extends HttpError {
  constructor(balance: number, required: number) {
    super(422, `Insufficient funds: balance ${balance}, required ${required}`);
    this.name = 'InsufficientFundsError';
  }
}
```

## Rules

- Error middleware must be the FIRST registered middleware
- NEVER include `err.stack` or file paths in responses
- NEVER use empty catch blocks — always log or re-throw
- Always throw `Error`/`HttpError` instances, never plain strings
- All responses must include explicit status codes
- Custom errors must extend `HttpError` and set `this.name`

## Troubleshooting

| Problem                  | Cause                        | Solution                                                      |
| ------------------------ | ---------------------------- | ------------------------------------------------------------- |
| Stack traces in response | Using `err.stack` in handler | Only return `err.message` and `err.name`                      |
| Unhandled rejection      | Async error not caught       | Ensure error middleware wraps `await ctx.next()` in try/catch |
| Silent error swallowing  | Empty catch block            | Always log or re-throw in catch blocks                        |
| Wrong status code        | Throwing plain `Error`       | Use `HttpError` subclasses for correct status codes           |
| Error middleware skipped | Registered after routes      | Register error middleware FIRST                               |
