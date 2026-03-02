# Errors Package Audit (`@nextrush/errors`)

## Package Overview

- **Files**: `base.ts`, `http-errors.ts`, `factory.ts`, `validation.ts`, `middleware.ts`, `index.ts`
- **Architecture Score**: 4/10
- **Security Score**: 6/10
- **Correctness Score**: 4/10
- **DX Score**: 4/10

---

## CRITICAL Issues

### 1. Error Class Triplication (Cross-Package)

See [01-CRITICAL-ISSUES.md → CRIT-01](01-CRITICAL-ISSUES.md) for full analysis.

**Key consequence in this package**: `errorHandler()` middleware uses `instanceof HttpError` from `@nextrush/errors`, but `ctx.throw()` creates adapter-local `HttpError`. Status codes silently degrade.

### 2. `RangeError` Shadows Built-In JavaScript `RangeError`

- **Location**: `packages/errors/src/validation.ts#L131-L147`
- **Evidence**: `export class RangeError extends ValidationError`
- **Impact**: `import { RangeError } from '@nextrush/errors'` silently shadows the global `RangeError`. IDE auto-imports can introduce subtle bugs.
- **Fix**: Rename to `RangeValidationError` or `ValueRangeError`.

### 3. `errorHandler()` is Not a Valid `Middleware` (Type Mismatch)

- **Location**: `packages/errors/src/middleware.ts#L13-L22`
- **Evidence**: Uses custom `ErrorContext` interface that's narrower than `Context`. Under `strictFunctionTypes`, `app.use(errorHandler())` fails type-checking.
- **Impact**: Error middleware can't legally access request metadata (headers, query, params) for logging/diagnostics.
- **Fix**: Define middleware using `Middleware` from `@nextrush/types` (dependency already exists).

### 4. Error Serialization Inconsistency

See [01-CRITICAL-ISSUES.md → CRIT-13](01-CRITICAL-ISSUES.md) for full analysis.

---

## HIGH Issues

### 5. `ValidationError` Has HTTP Status but Fails `isHttpError()` Check

- **Location**: Validation: `packages/errors/src/validation.ts#L30-L77`, Helper: `packages/errors/src/factory.ts#L151-L152`
- **Evidence**: `ValidationError extends NextRushError` (not `HttpError`), but has `status: 400`. `isHttpError()` checks `instanceof HttpError` only.
- **Impact**: `isHttpError(new ValidationError(...))` returns `false` even though it carries an HTTP status. User code using `isHttpError` for metrics/routing misclassifies validation failures.

### 6. Default Logger Uses `console.*`

- **Location**: `packages/errors/src/middleware.ts#L54-L56`
- **Impact**: Forbidden by project rules. Noisy in production, incompatible with structured logging.
- **Fix**: Default to no-op logger; encourage passing a custom logger function.

### 7. Response Always Exposes `err.name` (Internal Class Names)

- **Location**: `packages/errors/src/middleware.ts#L120`
- **Evidence**: Even when `expose: false`, response includes `error: err.name` (e.g., `TypeError`, `DomainSpecificError`).
- **Fix**: Use stable public value (e.g., `"InternalServerError"`) when not exposed.

---

## MEDIUM Issues

### 8. Stack Trace Can Leak Filesystem Paths

- **Location**: `packages/errors/src/middleware.ts#L130-L131`
- **Impact**: If misconfigured in production, leaks internal file paths and package structure.
- **Fix**: Gate on strong "dev mode" signal; require explicit `exposeStack: true`.

### 9. `notFoundHandler()` Infers "Response Not Sent" from Status Code

- **Location**: `packages/errors/src/middleware.ts#L152`
- **Evidence**: Only runs when `ctx.status === 200 || ctx.status === 404`. Status is not reliable proxy for "response sent."
- **Fix**: Use a standard `responded` concept from `@nextrush/types`, or have adapter own default 404 behavior.

### 10. `catchAsync()` is Redundant

- **Location**: `packages/errors/src/middleware.ts#L177-L186`
- **Evidence**: try/catch that rethrows unchanged. Adds overhead, no behavior change.
- **Fix**: Remove or repurpose (e.g., normalize non-Error throws).

---

## Factory Coverage Gaps

| Status | Class                     | In ERROR_MAP? | Factory? | Note                   |
| ------ | ------------------------- | :-----------: | :------: | ---------------------- |
| 400    | BadRequestError           |      ✅       |    ✅    |                        |
| 401    | UnauthorizedError         |      ✅       |    ✅    |                        |
| 402    | PaymentRequiredError      |      ❌       |    ❌    | Missing                |
| 403    | ForbiddenError            |      ✅       |    ✅    |                        |
| 404    | NotFoundError             |      ✅       |    ✅    |                        |
| 405    | MethodNotAllowedError     |      ❌       |    ✅    | Missing from ERROR_MAP |
| 406    | NotAcceptableError        |      ❌       |    ❌    | Missing                |
| 408    | RequestTimeoutError       |      ❌       |    ❌    | Missing                |
| 409    | ConflictError             |      ✅       |    ✅    |                        |
| 413    | PayloadTooLargeError      |      ❌       |    ❌    | Missing                |
| 415    | UnsupportedMediaTypeError |      ❌       |    ❌    | Missing                |
| 422    | UnprocessableEntityError  |      ✅       |    ✅    |                        |
| 429    | TooManyRequestsError      |      ❌       |    ✅    | Missing from ERROR_MAP |
| 500    | InternalServerError       |      ✅       |    ✅    |                        |
| 501    | NotImplementedError       |      ❌       |    ❌    | Missing                |
| 502    | BadGatewayError           |      ✅       |    ✅    |                        |
| 503    | ServiceUnavailableError   |      ❌       |    ✅    | Missing from ERROR_MAP |
| 504    | GatewayTimeoutError       |      ✅       |    ✅    |                        |

**Key gap**: `createError(429)` and `createError(503)` fall back to generic `HttpError` because their status codes aren't in `ERROR_MAP`, even though specialized classes and factory functions exist.

---

## Security Analysis

| Vector                | Status    | Notes                                               |
| --------------------- | --------- | --------------------------------------------------- |
| Error message masking | ✅ Good   | `expose ? err.message : 'Internal Server Error'`    |
| `err.name` leakage    | ❌ Bad    | Always returned, exposes internal taxonomy          |
| Stack trace exposure  | ⚠️ Opt-in | Good, but needs stronger dev-mode gating            |
| 404 path disclosure   | ⚠️ Common | Returns request path in 404 response body           |
| Status code accuracy  | ❌ Bad    | `instanceof` fragmentation causes misclassification |
