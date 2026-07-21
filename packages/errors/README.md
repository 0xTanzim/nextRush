# @nextrush/errors

> A typed `HttpError` hierarchy and error-handling middleware that turn thrown errors into consistent, client-safe JSON responses — for NextRush application and middleware authors.

[![npm version](https://img.shields.io/npm/v/@nextrush/errors.svg)](https://www.npmjs.com/package/@nextrush/errors)
[![downloads](https://img.shields.io/npm/dm/@nextrush/errors.svg)](https://www.npmjs.com/package/@nextrush/errors)
[![bundle size](https://img.shields.io/bundlephobia/minzip/@nextrush/errors.svg)](https://bundlephobia.com/package/@nextrush/errors)
[![types](https://img.shields.io/npm/types/@nextrush/errors.svg)](https://www.npmjs.com/package/@nextrush/errors)
[![ESM only](https://img.shields.io/badge/module-ESM--only-blue.svg)](https://nodejs.org/api/esm.html)
[![license](https://img.shields.io/npm/l/@nextrush/errors.svg)](https://github.com/0xTanzim/nextRush/blob/main/LICENSE)

|  |  |
| --- | --- |
| **Purpose** | Typed HTTP errors + error-handling middleware for NextRush — throw an error, get a consistent JSON response |
| **Package type** | Core |
| **Status** | Stable ✅ |
| **Included in `nextrush`?** | ✅ Yes — the common error classes, `errorHandler`, `ValidationError`, `createError`, `ERROR_CODES` are re-exported. Install directly for the full catalog (every 4xx/5xx class, every factory helper, every validation subclass). |
| **Support tier** | Public — core (stable, semver-guarded) — see [ADR-0005](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md) |
| **Maintenance** | Active |
| **Runtime** | Universal — Node · Bun · Deno · Edge |
| **Requires** | Node `>=22` · ESM-only · TypeScript `>=5.x` |
| **Introduced** | `v3.0.0` |

## Highlights

- ✅ **No third-party dependencies** — depends only on `@nextrush/types` (types, erased at build)
- ✅ **ESM-only**, tree-shakable, side-effect-free — a thrown error pulls in only its own class
- ✅ **Fully typed** — strict TypeScript, zero `any`; every error carries `status`, `code`, and `expose`
- 🛡️ **Client-safe by default** — 5xx messages are hidden unless you opt in; internal detail never leaks

<details>
<summary><strong>Table of contents</strong></summary>

[The problem](#the-problem) · [When to use](#when-to-use) · [Installation](#installation) · [Quick start](#quick-start) · [Capabilities](#capabilities) · [Mental model](#mental-model) · [Common tasks](#common-tasks) · [API overview](#api-overview) · [Options](#options) · [Compatibility](#compatibility) · [Troubleshooting](#troubleshooting) · [FAQ](#faq) · [Package relationships](#package-relationships) · [Architecture](#architecture) · [Resources](#resources)

</details>

---

## The problem

Error handling is where consistency quietly erodes. One handler returns `{ error: "..." }`, the next returns `{ message: "..." }`, and a forgotten `try/catch` leaks a database stack trace straight to the client. Each handler re-decides the status code, the response shape, and what is safe to expose — and each one gets it slightly differently.

```ts
// TODAY, without a typed error layer — the shape drifts per handler,
// and the internal message goes straight to the client:
app.get('/users/:id', async (ctx) => {
  const user = await db.findUser(ctx.params.id);
  if (!user) {
    ctx.status = 404;
    return ctx.json({ error: 'not found' });        // one shape here…
  }
  // if db.findUser throws, the raw message ("ECONNREFUSED 10.0.0.5:5432")
  // reaches the client unless every handler remembers to catch it.
});
```

As the app grows, API consumers can't handle errors programmatically (no stable codes), and each new endpoint is another chance to leak infrastructure detail. `@nextrush/errors` makes the error *itself* carry its status, machine code, and exposure rule — so the response shape is decided once, not per handler.

## When to use

`@nextrush/errors` is the error layer built into NextRush. `throw new NotFoundError(...)` from any handler, add `errorHandler()` to the middleware chain, and every error serializes the same way.

**Use `@nextrush/errors` if:**

- ✓ You're building a NextRush app or middleware and want thrown errors to become consistent JSON automatically
- ✓ You need stable machine-readable `code`s (`NOT_FOUND`, `RATE_LIMIT`) that API clients can branch on
- ✓ You want 5xx internals hidden from clients by default, while still logging the full error server-side
- ✓ You need structured field-level validation errors (`ValidationError`) or to rebuild a typed error across a service boundary (`fromJSON`)

**Reach for something else if:**

- ✗ You're writing a reusable, transport-agnostic library — return a result value instead of throwing HTTP errors; throw at the HTTP boundary only
- ✗ You want request-body size limits or content negotiation — those live in [`@nextrush/body-parser`](../middleware/body-parser) and the handler, not here

---

## Installation

```bash
pnpm add @nextrush/errors
# npm i @nextrush/errors · yarn add @nextrush/errors · bun add @nextrush/errors
```

> [!NOTE]
> Already using `nextrush`? The common error classes plus `errorHandler`, `notFoundHandler`,
> `createError`, `ValidationError`, `ERROR_CODES`, and `codeForStatus` are re-exported from the
> meta package — `import { NotFoundError, errorHandler } from 'nextrush'` works without installing
> this directly. Install `@nextrush/errors` when you need the full catalog or want to depend on it
> explicitly.

## Quick start

```ts
import { createApp, listen } from 'nextrush';
import { errorHandler, NotFoundError, BadRequestError } from '@nextrush/errors';

const app = createApp();

// Register the handler BEFORE your routes — it wraps the chain in a try/catch.
app.use(errorHandler());

const users = new Map([['1', { id: '1', name: 'Ada' }]]);

app.get('/users/:id', (ctx) => {
  const user = users.get(ctx.params.id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  ctx.json(user);
});

app.post('/users', (ctx) => {
  const { email } = (ctx.body ?? {}) as { email?: string };
  if (!email) {
    throw new BadRequestError('Email is required', { code: 'EMAIL_REQUIRED' });
  }
  ctx.status = 201;
  ctx.json({ ok: true });
});

listen(app, 8080);

// GET /users/999  →  404
// { "error": "NotFoundError", "message": "User not found", "code": "NOT_FOUND", "status": 404 }
//
// POST /users (no email)  →  400
// { "error": "BadRequestError", "message": "Email is required", "code": "EMAIL_REQUIRED", "status": 400 }
```

You never write the response shape. You declare an error state by throwing a typed error, and `errorHandler()` catches it, sets the status, and serializes it through the error's own `toJSON()`.

## Capabilities

**Error types**
- **Full `HttpError` catalog** — 28 client (4xx) and 11 server (5xx) classes, each with the correct status and canonical `code`
- **`ValidationError` family** — structured, multi-issue validation errors with field-level helpers
- **Custom errors** — extend `HttpError` or `NextRushError` to add your own typed errors

**Safety**
- **`expose` privacy boundary** — 4xx messages are shown, 5xx messages hidden by default; internal detail and stack traces stay server-side
- **Bounded `cause` serialization** — nested `cause` chains are walked to a fixed depth with a cycle guard, and only on exposed errors
- **Immutable details** — `details` and validation `issues` are frozen at construction, so an error can't be mutated after it's thrown

**Integration**
- **`errorHandler()` middleware** — one Koa-style middleware catches, logs, and serializes every thrown error
- **Stable machine codes** — a central `ERROR_CODES` registry maps every status to one canonical code
- **Cross-service transport** — `toJSON()` / `fromJSON()` round-trips a typed error across an HTTP boundary

**Developer experience**
- **Factory helpers** — `notFound()`, `badRequest()`, `createError(status)` for terse construction
- **Fully typed** — strict TypeScript, zero `any`; contracts shared via `@nextrush/types`

## Mental model

An error is an **API response object**, not a crash. Throwing it declares a status, a machine code, and whether its message is safe to show — the framework does the rest.

```text
throw new XError(msg)
        │  status · code · expose · details
        ▼
errorHandler() catch ──▶ log (5xx→error, 4xx→warn) ──▶ err.toJSON() ──▶ ctx.json(body)
                                                            │
                                    expose === false ───────┴──▶ message becomes "Internal Server Error"
```

**Rule:** the `expose` flag is the privacy boundary — `true` for 4xx (client's fault, safe to explain), `false` for 5xx (your fault, don't leak). Override it deliberately, never by accident.

> [!TIP]
> The full error hierarchy, the throw→response sequence, and the state lifecycle (with Mermaid
> diagrams) are in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Common tasks

### Throw a typed HTTP error

```ts
import { NotFoundError, ForbiddenError } from '@nextrush/errors';

throw new NotFoundError('User not found');   // 404, code NOT_FOUND, expose true
throw new ForbiddenError();                  // 403, default message "Forbidden"
```

Every class defaults its message, status, and `code` — pass a message to override the default, and options to add more.

### Attach a machine code and details for API clients

```ts
import { UnprocessableEntityError } from '@nextrush/errors';

throw new UnprocessableEntityError('Validation failed', {
  code: 'VALIDATION_ERROR',
  details: { email: 'Invalid format', age: 'Must be positive' },
});
// → 422 { error, message, code: 'VALIDATION_ERROR', status: 422, details: { … } }
```

`details` is surfaced in the JSON only when the error is exposed (all 4xx are, by default), and it's frozen so the error owns an immutable snapshot.

### Report field-level validation failures

```ts
import { ValidationError, RequiredFieldError } from '@nextrush/errors';

// Multiple issues at once
throw new ValidationError([
  { path: 'email', message: 'Required', rule: 'required' },
  { path: 'age', message: 'Must be positive', rule: 'range' },
]);

// Or the terse factory forms
throw ValidationError.fromField('email', 'Invalid format', 'email');
throw ValidationError.fromFields({ email: 'Required', age: 'Must be a number' });
throw new RequiredFieldError('email');
```

`ValidationError` serializes an `issues` array and strips each issue's `received` value, so a rejected password or token is never echoed back.

### Install the error handler and a 404 fallback

```ts
import { errorHandler, notFoundHandler } from '@nextrush/errors';

app.use(errorHandler({ includeStack: process.env.NODE_ENV !== 'production' })); // first
// … your routes …
app.use(notFoundHandler('Route not found')); // last — turns an unhandled 404 into JSON
```

`errorHandler()` wraps the rest of the chain in a `try/catch`; `notFoundHandler()` responds only when nothing else did and the status is `404`.

### Create an error by status, or rebuild one across a service boundary

```ts
import { createError, codeForStatus, HttpError } from '@nextrush/errors';

throw createError(413, 'Upload too large'); // → PayloadTooLargeError, code PAYLOAD_TOO_LARGE
codeForStatus(429);                         // 'TOO_MANY_REQUESTS'

// Downstream service: rebuild a typed error from the JSON it received
const restored = HttpError.fromJSON(payload); // instanceof HttpError works again
```

`createError(status)` returns the correctly-typed class for any status that has one (falling back to a bare `HttpError` otherwise); `fromJSON()` reverses `toJSON()`.

## API overview

The sealed public surface (ADR-0005), grouped by role.

| Export | Signature | Since | Stability | Description |
| ------ | --------- | ----- | --------- | ----------- |
| `NextRushError` | `class (message, options?)` | `3.0.0` | Stable ✅ | Base error — owns `status`, `code`, `expose`, `details`, `cause`, `toJSON()`, `toResponse()`, `fromJSON()`. |
| `HttpError` | `class (status, message?, options?)` | `3.0.0` | Stable ✅ | Base for all HTTP status errors; resolves `code` via the registry and `expose` from the status. |
| `ValidationError` | `class (issues, message?)` | `3.0.0` | Stable ✅ | Multi-issue validation error (extends `NextRushError`, **not** `HttpError`); status `400`. |
| `createError` | `(status, message?, options?) => HttpError` | `3.0.0` | Stable ✅ | Build the correctly-typed error for a status code. |
| `errorHandler` | `(options?: ErrorHandlerOptions) => Middleware` | `3.0.0` | Stable ✅ | Catch, log, and serialize thrown errors as JSON. |
| `notFoundHandler` | `(message?: string) => Middleware` | `3.0.0` | Stable ✅ | JSON 404 fallback for unhandled requests. |
| `isHttpError` | `(error) => error is HttpError` | `3.0.0` | Stable ✅ | Type guard for `HttpError` (note: `false` for `ValidationError`). |
| `getErrorStatus` | `(error) => number` | `3.0.0` | Stable ✅ | Status from any error (any `NextRushError`, duck-typed `status`, else `500`). |
| `getSafeErrorMessage` | `(error) => string` | `3.0.0` | Stable ✅ | Message if the error is exposed, else `'Internal Server Error'`. |
| `getHttpStatusMessage` | `(status) => string` | `3.0.0` | Stable ✅ | Canonical reason phrase for a status. |
| `ERROR_CODES` | `Readonly<Record<number, string>>` | `3.1.0` | Stable ✅ | Frozen status→canonical-code registry. |
| `codeForStatus` | `(status) => string` | `3.1.0` | Stable ✅ | Canonical code for a status (`HTTP_<status>` if none). |
| `GENERIC_ERROR_CODE` · `VALIDATION_ERROR_CODE` | `string` | `3.1.0` | Stable ✅ | `'INTERNAL_ERROR'` · `'VALIDATION_ERROR'`. |
| `type HttpErrorOptions` · `ValidationIssue` · `ErrorHandlerOptions` | — | `3.0.0` | Stable ✅ | Public option/data contracts. |

### HTTP error classes

Each class sets its status and canonical `code`; the message defaults to the status reason phrase.

```ts
import {
  // 4xx client errors — expose: true by default
  BadRequestError,                    // 400  BAD_REQUEST
  UnauthorizedError,                  // 401  UNAUTHORIZED
  PaymentRequiredError,               // 402  PAYMENT_REQUIRED
  ForbiddenError,                     // 403  FORBIDDEN
  NotFoundError,                      // 404  NOT_FOUND
  MethodNotAllowedError,              // 405  METHOD_NOT_ALLOWED  (constructor: allowedMethods first)
  NotAcceptableError,                 // 406  NOT_ACCEPTABLE
  ProxyAuthRequiredError,             // 407  PROXY_AUTH_REQUIRED
  RequestTimeoutError,                // 408  REQUEST_TIMEOUT
  ConflictError,                      // 409  CONFLICT
  GoneError,                          // 410  GONE
  LengthRequiredError,                // 411  LENGTH_REQUIRED
  PreconditionFailedError,            // 412  PRECONDITION_FAILED
  PayloadTooLargeError,               // 413  PAYLOAD_TOO_LARGE
  UriTooLongError,                    // 414  URI_TOO_LONG
  UnsupportedMediaTypeError,          // 415  UNSUPPORTED_MEDIA_TYPE
  RangeNotSatisfiableError,           // 416  RANGE_NOT_SATISFIABLE
  ExpectationFailedError,             // 417  EXPECTATION_FAILED
  ImATeapotError,                     // 418  IM_A_TEAPOT
  UnprocessableEntityError,           // 422  UNPROCESSABLE_ENTITY
  LockedError,                        // 423  LOCKED
  FailedDependencyError,              // 424  FAILED_DEPENDENCY
  TooEarlyError,                      // 425  TOO_EARLY
  UpgradeRequiredError,               // 426  UPGRADE_REQUIRED
  PreconditionRequiredError,          // 428  PRECONDITION_REQUIRED
  TooManyRequestsError,               // 429  TOO_MANY_REQUESTS   (options.retryAfter)
  RequestHeaderFieldsTooLargeError,   // 431  REQUEST_HEADER_FIELDS_TOO_LARGE
  UnavailableForLegalReasonsError,    // 451  UNAVAILABLE_FOR_LEGAL_REASONS

  // 5xx server errors — expose: false by default
  InternalServerError,                // 500  INTERNAL_SERVER_ERROR
  NotImplementedError,                // 501  NOT_IMPLEMENTED
  BadGatewayError,                    // 502  BAD_GATEWAY
  ServiceUnavailableError,            // 503  SERVICE_UNAVAILABLE  (options.retryAfter)
  GatewayTimeoutError,                // 504  GATEWAY_TIMEOUT
  HttpVersionNotSupportedError,       // 505  HTTP_VERSION_NOT_SUPPORTED
  VariantAlsoNegotiatesError,         // 506  VARIANT_ALSO_NEGOTIATES
  InsufficientStorageError,           // 507  INSUFFICIENT_STORAGE
  LoopDetectedError,                  // 508  LOOP_DETECTED
  NotExtendedError,                   // 510  NOT_EXTENDED
  NetworkAuthRequiredError,           // 511  NETWORK_AUTH_REQUIRED
} from '@nextrush/errors';
```

### Validation error classes

```ts
import {
  ValidationError,        // base — issues[], fromField(), fromFields(), hasErrorFor(), toFlatObject()
  RequiredFieldError,     // "<field> is required"          rule: required
  TypeMismatchError,      // expected vs received type      rule: type
  RangeValidationError,   // numeric min/max                rule: range
  LengthError,            // string length min/max          rule: length
  PatternError,           // regex mismatch                 rule: pattern
  InvalidEmailError,      // email format                   rule: email
  InvalidUrlError,        // URL format                     rule: url
} from '@nextrush/errors';
```

### Factory functions

```ts
import {
  badRequest, unauthorized, forbidden, notFound, methodNotAllowed,
  conflict, unprocessableEntity, tooManyRequests,
  internalError, serviceUnavailable, badGateway, gatewayTimeout,
  createError,
} from '@nextrush/errors';

throw notFound('User not found');
throw tooManyRequests('Rate limit exceeded', { retryAfter: 60 });
```

## Options

`errorHandler(options?)` is the only configurable surface. Error classes take a plain `HttpErrorOptions` object (`code`, `expose`, `details`, `cause`, `requestId`, `traceId`, `timestamp`).

| Option | Type | Required | Default | Security-sensitive | Description |
| ------ | ---- | -------- | ------- | ------------------ | ----------- |
| `includeStack` | `boolean` | No | `false` | ⚠️ | Append the stack trace to the JSON body. Keep `false` in production — a stack trace leaks internal paths. |
| `logger` | `(error, ctx) => void` | No | logs 5xx as `error`, 4xx as `warn` | — | Custom sink for caught errors (route to your structured logger). |
| `transform` | `(error, ctx) => Record<string, unknown>` | No | the error's own `toJSON()` | — | Replace the serialized response body shape. |
| `handlers` | `Map<ErrorClass, (error, ctx) => void>` | No | `undefined` | — | Per-error-type handlers; the first `instanceof` match runs and short-circuits serialization. |

## Compatibility

**Requirements**

| Requirement | Version |
| ----------- | ------- |
| NextRush | `3.x` |
| Node.js | `>=22` |
| TypeScript | `>=5.x` |

**Runtimes**

| Runtime | Supported | Notes |
| ------- | --------- | ----- |
| Node.js `>=22` | ✅ | ESM-only |
| Bun / Deno / Edge | ✅ / ✅ / ✅ | Uses only the native `Error` and Web-standard JavaScript; `Error.captureStackTrace` is feature-detected and skipped where absent |

**Integration**
- **Peer dependencies:** none — depends only on `@nextrush/types` (types, erased at build).
- **Works with:** `@nextrush/core` (the middleware chain that runs `errorHandler()`), any `@nextrush/*` middleware that throws (`body-parser` → `413`, `rate-limit` → `429`).
- **Incompatible with:** none.

> [!IMPORTANT]
> NextRush is **ESM-only, permanently** — no CommonJS build. On Node `>=22`, CommonJS consumers
> can `require()` this ESM package natively. See the
> [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

---

## Troubleshooting

<details>
<summary><strong>A thrown error returns <code>500</code> instead of my status code</strong></summary>

**Cause:** you threw a generic `Error` (or `errorHandler()` isn't registered), so there's no `status` to read — the handler falls back to `500`. **Fix:** throw a typed error and register `errorHandler()` before your routes.

```ts
app.use(errorHandler());                    // ← register first
throw new NotFoundError('User not found');  // ← typed, not `new Error(...)`
```

</details>

<details>
<summary><strong>My 5xx response shows "Internal Server Error", not my message</strong></summary>

**Cause:** this is intended — 5xx errors default to `expose: false`, so `toJSON()` replaces the message to avoid leaking internals. The full error is still passed to the logger. **Fix:** only override `expose` for a message you've confirmed is client-safe.

```ts
throw new ServiceUnavailableError('Down for maintenance until 14:00 UTC', { expose: true });
```

</details>

<details>
<summary><strong><code>isHttpError(validationError)</code> returns <code>false</code></strong></summary>

**Cause:** `ValidationError` extends `NextRushError` directly, not `HttpError`, so the `HttpError` type guard rejects it. **Fix:** use `getErrorStatus()` / `getSafeErrorMessage()` (which handle any `NextRushError`), or check `instanceof ValidationError`. `errorHandler()` already serializes it correctly.

```ts
import { getErrorStatus, ValidationError } from '@nextrush/errors';
if (err instanceof ValidationError) { /* read err.issues */ }
const status = getErrorStatus(err); // 400 for a ValidationError
```

</details>

<details>
<summary><strong><code>details</code> or <code>cause</code> is missing from the JSON response</strong></summary>

**Cause:** both are serialized only when the error is exposed (`expose === true`) — a non-exposed 5xx hides them to prevent leaking internal detail. **Fix:** read `error.cause` server-side (never gated), or set a client-safe error with `expose: true` if the detail is meant for the client.

</details>

## FAQ

**Can I use `@nextrush/errors` without the rest of NextRush?**
Yes. The error classes depend on nothing but the native `Error`. `errorHandler()` needs the `Context` / `Middleware` type contracts from `@nextrush/types`, which are erased at build — there's no runtime dependency to install.

**Why ESM-only?**
See the [Module Format Policy](https://github.com/0xTanzim/nextRush#module-format-policy).

**Does it work on Bun, Deno, and Edge?**
Yes. The classes use only the native `Error` and standard JavaScript; the V8-specific `Error.captureStackTrace` is feature-detected and skipped where it isn't available, so behavior is identical across runtimes.

**Why doesn't `ValidationError` extend `HttpError`?**
By design — a validation failure is a `NextRushError` that carries structured `issues`, not a status alone. It still resolves to `400`, is serialized by `errorHandler()`, and is recognized by `getErrorStatus()`; only the `isHttpError()` guard (which is `HttpError`-specific) returns `false` for it.

---

## Package relationships

```text
                 depends on          @nextrush/types  (Context / Middleware / Next contracts, types only)
@nextrush/errors ─────────────▶
                 often used with     @nextrush/core   (runs errorHandler() in the middleware chain)
                 usually used next   @nextrush/validation · @nextrush/body-parser  (throw these errors)
```

- **Depends on:** [`@nextrush/types`](../types) — the shared `Context` / `Middleware` / `Next` contracts, used only by the middleware (types, erased at build).
- **Often used with:** [`@nextrush/core`](../core) — the `Application` whose middleware chain runs `errorHandler()`; every handler throws these classes.
- **Usually used next:** [`@nextrush/validation`](../middleware/validation) (surfaces `ValidationError`-shaped failures) · [`@nextrush/body-parser`](../middleware/body-parser) (throws `413`) · [`@nextrush/rate-limit`](../middleware/rate-limit) (throws `429`).
- **Alternative:** none — the `HttpError` hierarchy is the framework's error contract.

## Architecture

Maintaining or contributing to this package? The internal design — the `NextRushError` → `HttpError` /
`ValidationError` hierarchy, the `expose` privacy boundary, `cause`-chain serialization, the
throw→response lifecycle, the architectural invariants, and the decisions and trade-offs behind them
(with diagrams) — is in **[`ARCHITECTURE.md`](./ARCHITECTURE.md)**. Design history:
[ADR-0005 (package tiers & sealed surface)](https://github.com/0xTanzim/nextRush/blob/main/docs/adr/ADR-0005-package-tiers-sealed-surface-deprecation.md).

## Resources

- 📖 **Learn** — [Documentation](https://0xtanzim.github.io/nextRush/docs) · [Error handling guide](https://0xtanzim.github.io/nextRush/docs/guides/error-handling) · [Architecture](./ARCHITECTURE.md) · [RFCs](https://github.com/0xTanzim/nextRush/tree/main/docs/RFC)
- 📝 **Changelog** — [CHANGELOG.md](./CHANGELOG.md)
- 🐛 **Report an issue** — [GitHub Issues](https://github.com/0xTanzim/nextRush/issues)
- 🤝 **Contribute** — [CONTRIBUTING.md](https://github.com/0xTanzim/nextRush/blob/main/CONTRIBUTING.md)

---

MIT © [Tanzim Hossain](https://github.com/0xTanzim)
