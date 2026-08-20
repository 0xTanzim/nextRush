# core-middleware

## Purpose

The `@nextrush/core` middleware-composition engine (`compose()`) and its execution contract:
Koa-style onion ordering, the guarded `next()` (single-call detection, error propagation,
double-response warning), per-invocation state isolation under concurrency, and the
allocation-lighter single-middleware fast path — all held byte-identical across the general,
empty, and single-entry paths and across every adapter, since `compose()` is runtime-agnostic core.
## Requirements
### Requirement: `compose()` provides an allocation-lighter path for a single-middleware stack

`@nextrush/core`'s `compose()` SHALL provide a dedicated execution path when the composed stack
contains exactly one middleware (`len === 1`) that avoids allocating the recursive `dispatch`
function closure and the per-call index-comparison used by the general path, while remaining a
valid `ComposedMiddleware` with the `(ctx, next?) => Promise<void>` signature. The `len === 0`
empty path and the `len >= 2` general path SHALL be unchanged.

#### Scenario: A single middleware executes and produces its response
- **WHEN** `compose([mw])` is invoked with a context and `mw` writes a response
- **THEN** the response is produced and the composed function resolves, identical to the general path

#### Scenario: The fast path does not allocate the recursive dispatch closure
- **WHEN** the `len === 1` path is exercised under allocation instrumentation / a micro-benchmark
- **THEN** no recursive `dispatch` function closure is allocated per invocation (only the single guarded `next` thunk)

#### Scenario: The empty stack still uses the existing zero-middleware path
- **WHEN** `compose([])` is invoked
- **THEN** it behaves exactly as before this change (calls the tail `next` or resolves)

#### Scenario: A two-middleware stack still uses the unchanged general path
- **WHEN** `compose([a, b])` is invoked
- **THEN** it runs the general `dispatch`-based path with behavior unchanged from before this change

#### Scenario: The single middleware need not be the router
- **WHEN** the one middleware is an arbitrary user middleware (e.g. a lone `app.use(fn)` with no routes)
- **THEN** the fast path runs it correctly, not only when the middleware is `router.routes()`

### Requirement: `next()` call-count semantics are preserved on the fast path

On the single-middleware fast path, calling the `next` function MORE THAN ONCE SHALL reject with an
`Error` whose message is exactly `next() called multiple times`, and calling it zero or one time
SHALL behave identically to the general path. The multiple-call guard SHALL be tracked with
per-invocation state.

#### Scenario: next() called exactly once advances the chain
- **WHEN** the middleware calls `next()` once
- **THEN** the tail `next` runs (or the call resolves if there is no tail), and control returns to the middleware after it (onion before/after ordering preserved)

#### Scenario: next() called zero times settles without invoking the tail
- **WHEN** the middleware responds and never calls `next()`
- **THEN** the composed function resolves and the tail `next` is never invoked

#### Scenario: next() called twice synchronously rejects the second call
- **WHEN** the middleware calls `next()` twice in the same tick
- **THEN** the second call rejects with `Error('next() called multiple times')`

#### Scenario: next() called three times rejects every call after the first
- **WHEN** the middleware calls `next()` three times
- **THEN** the first advances the chain and both the second and third calls reject with `next() called multiple times`

#### Scenario: next() called n times (n greater than 3) rejects every call after the first
- **WHEN** the middleware calls `next()` n times for an arbitrary n greater than 3
- **THEN** exactly the first call advances the chain and all n minus one subsequent calls reject with `next() called multiple times`

#### Scenario: next() called twice with an await in between rejects the second call
- **WHEN** the middleware calls `await next()`, then calls `next()` again afterward
- **THEN** the second call rejects with `next() called multiple times`

#### Scenario: The rejection message is byte-identical to the general path
- **WHEN** a double-`next()` rejection occurs on both the fast path and the general path
- **THEN** both reject with an `Error` whose message string is exactly `next() called multiple times`

### Requirement: `ctx.next()` and the `next` argument advance the same guarded chain

On the fast path, `ctx.next()` (via `ctx.setNext`) and the `next` function passed as the
middleware's second argument SHALL resolve to the SAME guarded thunk, so a multiple-call is
detected regardless of which surface each call came through. A context that does not implement
`setNext` SHALL still execute correctly via the `next` argument.

#### Scenario: ctx.next() advances the same chain as the argument
- **WHEN** the middleware calls `ctx.next()` instead of the `next` argument
- **THEN** the tail chain advances exactly as if the `next` argument had been called

#### Scenario: A call via the argument then via ctx.next() is detected as a double-call
- **WHEN** the middleware calls the `next` argument once, then calls `ctx.next()`
- **THEN** the second call (`ctx.next()`) rejects with `next() called multiple times`

#### Scenario: A call via ctx.next() then via the argument is detected as a double-call
- **WHEN** the middleware calls `ctx.next()` once, then calls the `next` argument
- **THEN** the second call (the argument) rejects with `next() called multiple times`

#### Scenario: A context without setNext still runs via the argument
- **WHEN** the context does not implement `setNext`
- **THEN** the fast path invokes the middleware with the `next` argument and does not throw for the missing `setNext`

### Requirement: Error propagation is preserved on the fast path

On the fast path, a synchronous throw from the middleware SHALL become a rejected promise (never an
uncaught synchronous throw out of `compose()`), a returned rejected promise SHALL propagate, and a
thrown non-`Error` value SHALL be wrapped in `new Error(String(value))` — identical to the general
path.

#### Scenario: A synchronous throw becomes a rejected promise
- **WHEN** the middleware throws synchronously
- **THEN** the composed function returns a rejected promise (it does not throw synchronously)

#### Scenario: A returned rejected promise propagates
- **WHEN** the middleware returns a rejected promise
- **THEN** the composed function rejects with that same reason

#### Scenario: A thrown non-Error value is wrapped as an Error
- **WHEN** the middleware throws a non-`Error` (string, number, null, undefined, or object)
- **THEN** the rejection is an `Error` whose message equals `String(thrownValue)`, matching the general path

#### Scenario: An error from the tail next propagates back through the middleware
- **WHEN** the middleware calls `await next()` and the tail rejects
- **THEN** that rejection propagates back through the awaiting middleware and out of the composed function

#### Scenario: The rejection reaches the application error handler
- **WHEN** the fast path is used via `Application.callback()` and the middleware throws
- **THEN** the error is routed to the configured/default error handler, not left unhandled — regardless of whether `callback()` implements this via a `try`/`catch` or a `.then()` rejection handler

### Requirement: The double-response warning is preserved on the fast path

When double-response warning is enabled (non-production), a middleware that has already committed a
response and then calls `next()` SHALL emit the same warning the general path emits (including the
index-0 reference). When disabled (production), no warning SHALL be emitted.

#### Scenario: Responding then calling next() warns in non-production
- **WHEN** `warnDoubleResponse` is enabled, the middleware sends a response, then calls `next()`
- **THEN** a warning is emitted whose text matches the general path's warning (referencing index 0)

#### Scenario: No warning is emitted in production
- **WHEN** `warnDoubleResponse` is disabled (production) and the middleware responds then calls `next()`
- **THEN** no warning is emitted

### Requirement: Per-request state is isolated across concurrent invocations

The fast path's multiple-`next()` guard SHALL be per-invocation state, never shared across
requests. Concurrent invocations of the same composed function SHALL not affect one another's
call-count tracking or response state.

#### Scenario: A double-caller does not corrupt a concurrent single-caller
- **WHEN** two invocations of the same composed function run concurrently, one calling `next()` twice and one calling it once
- **THEN** only the double-caller's second call rejects; the single-caller resolves normally, with no cross-talk

#### Scenario: High-concurrency mix keeps guards independent
- **WHEN** many invocations run interleaved, half of them calling `next()` twice and half once
- **THEN** exactly the double-callers reject and exactly the single-callers succeed, with per-invocation counts independent

#### Scenario: Interleaved async execution keeps state isolated
- **WHEN** invocation A calls `await next()` into a slow tail while invocation B runs to completion
- **THEN** A's and B's guard/response state remain independent and neither observes the other's state

### Requirement: The fast path is behaviorally identical to the general path

For every scenario expressible on both paths, the single-middleware fast path SHALL produce
observably identical results to the general path — the same resolution/ordering, the same rejection
messages, and the same warning text. This parity SHALL be asserted by a shared test matrix that
runs the same middleware behaviors through both paths.

#### Scenario: The same behavior yields identical results on both paths
- **WHEN** a given middleware behavior is run through the fast path (a one-entry stack) and through the general path (a forced multi-entry stack with a transparent passthrough)
- **THEN** the observable outcome — resolved value, execution ordering, any rejection message, any warning text — is identical

#### Scenario: The parity matrix covers call-count, error, and warning cases
- **WHEN** the parity matrix runs the next()-count, error-propagation, and double-response cases through both paths
- **THEN** each case produces identical observable results on both paths

### Requirement: Integration through the real adapter and router stack is unregressed

With the fast path active, an application whose stack is a single mounted router SHALL serve all
route outcomes correctly through the real Node adapter, and the router's own per-route
multiple-`next()` detection SHALL remain independent and intact. Behavior SHALL be identical across
all adapters, since `compose()` is runtime-agnostic core.

#### Scenario: The single-middleware app serves all route outcomes
- **WHEN** an app mounted as `app.route('/', router)` (single-middleware stack) receives requests for a static route, a param route, a POST route, and an unmatched path
- **THEN** it returns the correct 200 responses (with correct body/params) and a correct 404 for the unmatched path

#### Scenario: 404 fall-through works through the fast path
- **WHEN** the mounted router does not match and calls its tail `next()` once, setting status 404
- **THEN** the single `next()` call resolves (no tail present at the app root) and the adapter finalizes a 404 response

#### Scenario: The router's own multiple-next detection is unaffected
- **WHEN** a route registered with per-route middleware has a layer that calls `next()` twice
- **THEN** the router's own executor (`compileExecutor`) rejects that double-call independently of the app-level fast path

#### Scenario: Behavior is identical across adapters
- **WHEN** the same single-middleware app behavior is exercised on each supported adapter (Node/Bun/Deno/Edge)
- **THEN** the observable middleware behavior is identical, since `compose()` is shared core

### Requirement: The optimization is validated by benchmark and coverage gates

The change SHALL be accepted only when its performance claim is measured and its correctness is
covered. A no-measurable-gain result SHALL park or revert the change rather than merge it on
aesthetics.

#### Scenario: An allocation micro-benchmark documents the closure removal
- **WHEN** the allocation micro-benchmark runs against the `len === 1` path
- **THEN** it shows the recursive `dispatch` closure is no longer allocated per invocation

#### Scenario: Response parity is unaffected
- **WHEN** `pnpm bench:validate` runs across all benchmark servers
- **THEN** response bodies and Content-Type remain byte-identical (the fast path changes no output)

#### Scenario: The full-profile A/B shows no regression
- **WHEN** `pnpm bench:compare --profile full` (5 runs, CPU-pinned) is run before and after on Hello World and Route Params
- **THEN** there is no RPS regression beyond stddev; a regression fails the gate

#### Scenario: Coverage is maintained and the new branch is covered
- **WHEN** the test suite runs with coverage
- **THEN** per-package line coverage stays at or above 90% and the new `len === 1` branch is covered

### Requirement: Composed middleware never drops a thenable return

`compose()` MAY return a shared already-resolved promise instead of a freshly-allocated one when a
middleware returns `undefined`, but it SHALL NOT substitute a resolved promise for any other return
value. A return value that is a promise, a non-Promise thenable, or any defined non-thenable value
SHALL be adopted such that the composed promise settles only after that value has settled.

Testing a middleware's return with `instanceof Promise` (or any check that classifies a non-Promise
thenable as "not a promise") is forbidden, because it would discard that thenable's pending work and
resolve the request early.

#### Scenario: A non-Promise thenable's work is awaited

- **WHEN** a middleware returns a non-Promise thenable that settles asynchronously
- **THEN** the composed middleware's promise does not settle until that thenable has settled, and
  any side effect the thenable performs before settling has already happened

#### Scenario: A falsy-but-defined return is preserved, not collapsed

- **WHEN** a middleware returns `null`, `false`, `0`, or `''`
- **THEN** the composed promise resolves with that exact value — it is not treated as `undefined`
  and not replaced with a shared resolved promise

#### Scenario: An undefined return still yields a resolved promise

- **WHEN** a synchronous middleware returns `undefined`
- **THEN** the composed middleware returns an already-resolved promise whose resolved value is
  `undefined`, and awaiting it completes without an extra observable delay beyond one microtask

#### Scenario: Reusing a resolved sentinel across concurrent requests is safe

- **WHEN** many concurrent composed invocations each return the same shared resolved promise
- **THEN** each caller's continuation runs exactly once, and no caller observes another caller's
  continuation or ordering

### Requirement: `ctx.cookies` is a first-class, always-present Context capability

The `Context` contract SHALL expose `cookies` as a required (never optional, never `undefined`)
property typed as the cookie capability: `get`, `set`, `delete`, `all`, `has`, and a nested `signed`
sub-capability with `get`, `set`, `delete`. The property MUST exist on every context built by every
adapter (Node, Bun, Deno, Edge) before any cookie middleware runs, and merely reading or inspecting
the property MUST NOT throw. The capability is activated when the `cookies()` middleware runs; the
type system MUST require no cast for `ctx.cookies.get/set/delete/all/has`.

#### Scenario: The capability exists on every adapter before any middleware runs
- **WHEN** a request context is built by the Node, Bun, Deno, or Edge adapter and no cookie middleware has run
- **THEN** `ctx.cookies` is a defined object on all four adapters and reading the property does not throw

#### Scenario: The type is never optional
- **WHEN** application code accesses `ctx.cookies` under strict TypeScript
- **THEN** the type is non-optional, and `ctx.cookies.get('x')` typechecks without a cast or optional chaining

#### Scenario: Inspecting the uninitialized capability is safe
- **WHEN** application code logs or inspects `ctx.cookies` (e.g. `console.log(ctx.cookies)`) without the cookie middleware
- **THEN** no error is thrown; only invoking an operation (see the diagnostic requirement) throws

### Requirement: Uninitialized cookie operations throw an actionable diagnostic

When no `cookies()` middleware has run for the request, every operation on `ctx.cookies` —
`get`, `set`, `delete`, `all`, `has`, and every `signed` operation — SHALL throw a
`CapabilityNotInitializedError` (a `NextRushError`) whose `code` is `COOKIES_NOT_INITIALIZED`
and whose `message` answers four things: WHAT was called, WHY the capability is unavailable,
HOW to fix it (register `cookies()`), and WHERE to learn more (the cookies reference docs). The
error SHALL carry HTTP status `500` and `expose: false`, and MUST never serialize installation
instructions or internal paths to the client.

#### Scenario: get() throws the diagnostic when cookies() never ran
- **WHEN** a handler calls `ctx.cookies.get('session')` and no cookie middleware ran for the request
- **THEN** it throws `CapabilityNotInitializedError` with `code === 'COOKIES_NOT_INITIALIZED'`

#### Scenario: set() throws the diagnostic when cookies() never ran
- **WHEN** a handler calls `ctx.cookies.set('a', 'b')` and no cookie middleware ran for the request
- **THEN** it throws `CapabilityNotInitializedError` with `code === 'COOKIES_NOT_INITIALIZED'`

#### Scenario: delete(), all(), and has() throw the diagnostic when cookies() never ran
- **WHEN** a handler calls `ctx.cookies.delete('a')`, `ctx.cookies.all()`, or `ctx.cookies.has('a')` with no cookie middleware
- **THEN** each call throws `CapabilityNotInitializedError` with `code === 'COOKIES_NOT_INITIALIZED'`

#### Scenario: The diagnostic names the called operation and the fix
- **WHEN** `ctx.cookies.get('session')` throws the diagnostic
- **THEN** the message includes the operation that was called (e.g. `ctx.cookies.get("session")`), states that no cookie middleware ran, shows the fix (`import { cookies } from '@nextrush/cookies'; app.use(cookies());`), lists likely causes (not registered, registered after the route, conditionally skipped), and includes the docs URL

#### Scenario: The diagnostic is a developer error, never client-visible
- **WHEN** the diagnostic error propagates to the framework error handler
- **THEN** the client response is a generic 500 with `expose: false` and contains none of the diagnostic's message text

#### Scenario: The same diagnostic fires when the middleware was registered after the route
- **WHEN** the middleware chain for the request runs without the cookie middleware (e.g. it is registered after a route that already handled the request)
- **THEN** any cookie operation in that handler throws the same `COOKIES_NOT_INITIALIZED` diagnostic

### Requirement: The signed sub-capability has its own activation and diagnostic

The `signed` member of `ctx.cookies` SHALL start uninitialized and be activated only by the
`signedCookies()` middleware. Using a `signed` operation when `cookies()` ran but `signedCookies()`
did not SHALL throw `CapabilityNotInitializedError` with `code === 'SIGNED_COOKIES_NOT_INITIALIZED'`.
Running `signedCookies()` when `cookies()` never ran SHALL throw the `COOKIES_NOT_INITIALIZED`
diagnostic naming `cookies()` as the prerequisite.

#### Scenario: signed.get() throws when signedCookies() never ran
- **WHEN** `cookies()` is registered but `signedCookies()` is not, and a handler awaits `ctx.cookies.signed.get('user')`
- **THEN** it throws `CapabilityNotInitializedError` with `code === 'SIGNED_COOKIES_NOT_INITIALIZED'`

#### Scenario: signed.set() and signed.delete() throw when signedCookies() never ran
- **WHEN** a handler calls `ctx.cookies.signed.set('u', 'v')` or `ctx.cookies.signed.delete('u')` with only `cookies()` registered
- **THEN** each throws `CapabilityNotInitializedError` with `code === 'SIGNED_COOKIES_NOT_INITIALIZED'`

#### Scenario: signedCookies() without cookies() fails at request time with the prerequisite named
- **WHEN** `signedCookies()` is registered but `cookies()` is not, and a request arrives
- **THEN** the request throws `CapabilityNotInitializedError` with `code === 'COOKIES_NOT_INITIALIZED'` and a message stating that `signedCookies` requires `cookies()` to be registered first

### Requirement: `cookies()` activates the capability with unchanged parsing semantics

The `cookies()` middleware SHALL activate `ctx.cookies` with a per-request cookie store that
parses the incoming `Cookie` header exactly once, joins repeated Cookie headers with `; `,
applies RFC 6265 first-occurrence-wins for duplicate names, URL-decodes values (retaining the raw
value when decoding fails), strips CRLF/control characters, enforces the 50-cookie parse cap, and
distinguishes an empty value (`name=`) from a missing cookie. A custom `decode` option SHALL be
re-sanitized after decoding, and a decode failure SHALL be recorded in observable state rather
than throwing.

#### Scenario: get() returns the parsed value after activation
- **WHEN** a request carries `Cookie: session=abc; theme=dark` and `cookies()` is registered
- **THEN** `ctx.cookies.get('session')` returns `'abc'` and `ctx.cookies.get('theme')` returns `'dark'`

#### Scenario: The header is parsed once per request
- **WHEN** a handler calls `ctx.cookies.get('a')`, `get('b')`, and `get('c')` in sequence
- **THEN** the raw Cookie header is read and parsed exactly once for the request, and all three values are served from the same parse

#### Scenario: Repeated Cookie headers are joined before parsing
- **WHEN** the runtime surfaces the Cookie header as an array (e.g. `['a=1', 'b=2']`)
- **THEN** both `a` and `b` are parsed as if the header were `a=1; b=2`

#### Scenario: Duplicate names resolve first-occurrence-wins
- **WHEN** the header is `session=first; session=second`
- **THEN** `ctx.cookies.get('session')` returns `'first'`

#### Scenario: An empty value is distinguishable from a missing cookie
- **WHEN** the header is `empty=` (no `missing` cookie)
- **THEN** `ctx.cookies.get('empty')` returns `''`, `ctx.cookies.has('empty')` returns `true`, and `ctx.cookies.get('missing')` returns `undefined`

#### Scenario: The 50-cookie cap bounds parsing
- **WHEN** the header contains more than 50 distinct cookie names
- **THEN** only the first 50 distinct names are present in `ctx.cookies.all()`

#### Scenario: Read-after-write is visible within the same request
- **WHEN** a handler calls `ctx.cookies.set('a', '1')` and then `ctx.cookies.get('a')`
- **THEN** `get('a')` returns `'1'` without re-reading the request header

#### Scenario: delete() removes the value from the request's cookie set
- **WHEN** a handler parses `Cookie: a=1`, then calls `ctx.cookies.delete('a')` and `ctx.cookies.has('a')`
- **THEN** `has('a')` returns `false` and `get('a')` returns `undefined`

### Requirement: `set()`/`delete()` preserve eager Set-Cookie emission and security hardening

After activation, `set()` SHALL serialize and emit the `Set-Cookie` header immediately (in the same
call), and repeated `set()` calls SHALL accumulate multiple `Set-Cookie` headers without collapsing
into one comma-separated value. `delete()` SHALL emit an expiring cookie (epoch expiry, `Max-Age=0`).
All existing security semantics SHALL be preserved: `secure: 'auto'` resolution (emit `Secure`
except on plaintext loopback), `__Secure-`/`__Host-` prefix enforcement, CRLF/control-character
sanitization, a 4096-byte size limit that throws, `maxAge < 0` rejection, and `SameSite=None`
requiring `Secure`. A non-string value passed to `set()` SHALL be sanitized to an empty cookie
value without throwing (existing documented behavior, unchanged).

#### Scenario: set() emits the Set-Cookie header immediately
- **WHEN** a handler calls `ctx.cookies.set('a', '1', { httpOnly: true })` and then sends a response
- **THEN** the response carries exactly one `Set-Cookie` header for `a` with `HttpOnly`, emitted at set() time (not deferred)

#### Scenario: Multiple set() calls accumulate distinct Set-Cookie headers
- **WHEN** a handler calls `set('a', '1')` and `set('b', '2')`
- **THEN** the response carries two distinct `Set-Cookie` headers (one for `a`, one for `b`), not one comma-joined value

#### Scenario: delete() emits an expiring cookie with matching scope
- **WHEN** a handler calls `ctx.cookies.delete('session', { path: '/' })`
- **THEN** the response `Set-Cookie` for `session` has an epoch `Expires` and `Max-Age=0` with `Path=/`

#### Scenario: secure: 'auto' emits Secure except on plaintext loopback
- **WHEN** a cookie is set with no explicit `secure` option on a plaintext `127.0.0.1`/`localhost` request
- **THEN** the emitted cookie has no `Secure` attribute; on any other request (TLS, trusted forwarded https, non-loopback plaintext) `Secure` is emitted

#### Scenario: __Host- prefix constraints are enforced at set() time
- **WHEN** `set('__Host-a', '1', { domain: 'example.com' })` or with `path` other than `/` or without `secure` resolving true
- **THEN** a `SecurityError` is thrown naming the violated constraint

#### Scenario: An oversized cookie throws
- **WHEN** `set()` produces a serialized cookie longer than 4096 bytes
- **THEN** a `RangeError` is thrown and no `Set-Cookie` header is emitted for it

#### Scenario: SameSite=None without Secure is rejected
- **WHEN** `set('a', '1', { sameSite: 'none' })` resolves to a non-secure cookie
- **THEN** a `SecurityError` is thrown

#### Scenario: A negative maxAge is rejected
- **WHEN** `set('a', '1', { maxAge: -1 })` is called
- **THEN** a `RangeError` is thrown

#### Scenario: A non-string value becomes an empty cookie value without throwing
- **WHEN** `set('a', { token: 'x' })` (an object) or `set('a', undefined)` is called
- **THEN** the emitted cookie value is the empty string, no exception is thrown, and the behavior matches the pre-existing `ctx.state.cookies` semantics

### Requirement: `ctx.state.cookies` remains a working deprecated alias for one release

The deprecated `ctx.state.cookies` and `ctx.state.signedCookies` SHALL be attached alongside
`ctx.cookies` during the deprecation window, behave identically to the new property, and emit a
warning at most once per process. The warning MUST point to `ctx.cookies` as the replacement.

#### Scenario: The alias serves the same store
- **WHEN** `cookies()` is registered and a handler uses `ctx.state.cookies.get('a')` after `ctx.cookies.set('a', '1')`
- **THEN** `ctx.state.cookies.get('a')` returns `'1'` (same store, same read-after-write)

#### Scenario: The deprecation warning is emitted once per process
- **WHEN** multiple requests run through the cookie middleware
- **THEN** exactly one deprecation warning about `ctx.state.cookies` is emitted for the process lifetime

#### Scenario: The warning names the replacement
- **WHEN** the deprecation warning is emitted
- **THEN** the message points to `ctx.cookies` and the cookies reference docs

### Requirement: `signedCookies()` activation preserves signing, verification, and rotation semantics

The `signedCookies()` middleware SHALL activate `ctx.cookies.signed` with the existing signing
contract: `set()` signs the value (name-bound HMAC-SHA256 with issue time), `get()` verifies and
returns the original value or `undefined` — indistinguishably for missing, malformed, tampered,
name-mismatched, or expired signatures. Verification SHALL try the current secret first, then each
previous secret in order, with at most 10 previous secrets accepted (more SHALL throw at
configuration time). `acceptLegacySignatures` SHALL enable the legacy value-only format as a
fallback with a once-per-process warning.

#### Scenario: signed.set() then signed.get() round-trips within the request
- **WHEN** `await ctx.cookies.signed.set('user', 'u1')` is followed by `await ctx.cookies.signed.get('user')` in the same request
- **THEN** `get` returns `'u1'`

#### Scenario: A tampered signed cookie returns undefined
- **WHEN** a client sends a signed cookie whose value was modified after signing
- **THEN** `await ctx.cookies.signed.get('user')` returns `undefined`

#### Scenario: A value signed under one name does not verify under another
- **WHEN** a signature issued for cookie name `tier` is presented as the value of cookie `role`
- **THEN** `await ctx.cookies.signed.get('role')` returns `undefined`

#### Scenario: Rotation verifies current first, then previous keys in order
- **WHEN** a cookie was signed with an old secret and verification is configured with a new current secret plus `previousSecrets: [old]`
- **THEN** `get` verifies successfully using the previous key, and new `set()` calls sign with the current key

#### Scenario: More than 10 previous secrets are rejected at configuration time
- **WHEN** `signedCookies({ secret, previousSecrets: [ ...11 entries ] })` is constructed
- **THEN** a configuration-time error is thrown

#### Scenario: Legacy signatures are accepted only behind the explicit flag
- **WHEN** a value in the pre-RFC-031 format (`value.signature`) is presented
- **THEN** `get` returns `undefined` by default and returns the value only when `acceptLegacySignatures: true`, emitting a once-per-process warning

### Requirement: The cookie capability is identical across all adapters with no allocation regression

The activated and uninitialized cookie behaviors SHALL be observable-identical on Node, Bun, Deno,
and Edge, pinned by the conformance suite. The uninitialized capability SHALL be a process-shared
object so a request that never touches cookies allocates no per-request cookie object, and the
initialized path SHALL allocate the same single store object it allocates today.

#### Scenario: Uninitialized behavior is identical across adapters
- **WHEN** the conformance suite exercises a handler using `ctx.cookies` without the middleware on Node, Bun, Deno, and Edge
- **THEN** each adapter throws the same `COOKIES_NOT_INITIALIZED` error with the same code and message shape

#### Scenario: Activated behavior is identical across adapters
- **WHEN** the conformance suite exercises `set`/`get`/`delete`/`all`/`has` and `signed` operations with the middleware on all four adapters
- **THEN** observable responses (headers, multiple Set-Cookie accumulation, parsed values) are identical

#### Scenario: The uninitialized path allocates nothing per request
- **WHEN** requests that never access cookies run under allocation instrumentation
- **THEN** no per-request cookie-related object is allocated (the uninitialized capability is shared)

#### Scenario: The activated path allocates no more than before
- **WHEN** requests that use cookies run under allocation instrumentation
- **THEN** the per-request allocation count for the cookie store is unchanged from the pre-change baseline

