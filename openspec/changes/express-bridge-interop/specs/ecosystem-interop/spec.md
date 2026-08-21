## Purpose

Optional, opt-in adapters that wrap a stable external execution contract into NextRush `Middleware`, without reversing the dependency arrow into core, without claiming Edge portability, and with a test-backed compatibility registry.

## ADDED Requirements

### Requirement: Wrapping Express/Connect middleware

The system SHALL provide a `compat` function that wraps a Connect/Express 3-arity middleware `(req, res, next)` as a NextRush `Middleware` suitable for `Application.use`.

#### Scenario: Wrap a 3-arity middleware

- **WHEN** an application registers `app.use(compat(fn))` where `fn` has length 3
- **THEN** `fn` is invoked per request with an Express-like `req`, `res`, and `next`, and its continuation/terminal behavior is translated into the NextRush middleware pipeline

#### Scenario: Reject 4-arity error middleware at wrap time

- **WHEN** `compat(fn)` is called with a function of length 4 or greater
- **THEN** it throws an arity error at registration time, before any request is served

#### Scenario: Reject arrays and non-functions at wrap time

- **WHEN** `compat` is called with an array or a non-function value
- **THEN** it throws at registration time and does not auto-flatten the array

### Requirement: Explicit opt-in with no auto-detection

The system SHALL require explicit `compat(...)` wrapping and MUST NOT auto-detect or auto-wrap foreign middleware.

#### Scenario: No implicit wrapping in `Application.use`

- **WHEN** an application passes a foreign `(req, res, next)` function directly to `app.use` without `compat`
- **THEN** the framework does not treat it as NextRush middleware, and does not silently bridge or fall back to it

### Requirement: Node-shaped raw HTTP gate

The system SHALL run bridged middleware only when the request's `ctx.raw` is Node-shaped (`req` with an EventEmitter `on`, and `res` with `setHeader`/`end`/`headersSent`), and SHALL refuse Web-shaped raw HTTP.

#### Scenario: Refuse Web-shaped raw HTTP

- **WHEN** a `compat`-wrapped middleware runs against a context whose `ctx.raw` is `{ req: Request, res: undefined }`
- **THEN** the bridge rejects with an actionable capability error before invoking the wrapped function

#### Scenario: Accept Node-shaped raw HTTP

- **WHEN** a `compat`-wrapped middleware runs against a context whose `ctx.raw` structurally matches Node's `IncomingMessage`/`ServerResponse`
- **THEN** the wrapped function is invoked

#### Scenario: Gate uses shape, not runtime identity

- **WHEN** the gate evaluates whether `ctx.raw` is Node-shaped
- **THEN** it decides purely from the structural shape and does not branch on `ctx.runtime`

### Requirement: Continuation semantics

The system SHALL translate `next()`, `next(err)`, terminal responses, thrown errors, thenables, and double-`next` into the NextRush continuation and error pipeline without forking `compose()` semantics.

#### Scenario: `next()` delegates downstream

- **WHEN** a wrapped middleware calls `next()` with no argument
- **THEN** the bridge awaits the downstream NextRush middleware and then fulfills, so outer NextRush after-hooks run

#### Scenario: `next(err)` rejects into the error pipeline

- **WHEN** a wrapped middleware calls `next(err)` with an error
- **THEN** the bridge rejects with that error, which enters `Application.handleError`, and does not also call the downstream NextRush `next()`

#### Scenario: Thrown error behaves like `next(err)`

- **WHEN** a wrapped middleware throws synchronously
- **THEN** the bridge rejects with the thrown error, entering the same error pipeline as `next(err)`

#### Scenario: Terminal response skips downstream

- **WHEN** a wrapped middleware sends a terminal response (`res.send`/`res.json`/`res.end`/`res.redirect`) without calling `next()`
- **THEN** the bridge fulfills without invoking downstream NextRush middleware

#### Scenario: Response wins over a later `next()`

- **WHEN** a wrapped middleware sends a terminal response and then calls `next()`
- **THEN** the response is not overwritten, downstream middleware is not run, and the late `next()` is a warned no-op in development rather than a rejection

#### Scenario: Double `next()` never double-settles

- **WHEN** a wrapped middleware calls `next()` more than once
- **THEN** the first continuation wins and the second is ignored (warned in development), without double-settling or re-running the pipeline

#### Scenario: Thenable that resolves while idle fails closed

- **WHEN** a wrapped middleware returns a thenable that fulfills without calling `next()` or committing a response
- **THEN** the bridge rejects with a protocol error rather than hanging

#### Scenario: Callback-style middleware is Express continuation

- **WHEN** a wrapped middleware returns a non-thenable and calls `next()` later from I/O or `setImmediate`
- **THEN** the bridge does not fail on a microtask and preserves the callback-style Express continuation

### Requirement: Shared request state

The system SHALL project ad-hoc `req.<key>` reads/writes onto `ctx.state` as a single shared namespace, without adding a `user` field to `Context`.

#### Scenario: `req.user` is visible as `ctx.state.user`

- **WHEN** a wrapped middleware writes `req.user = user`
- **THEN** downstream NextRush middleware reads the same value from `ctx.state.user`

#### Scenario: Collision is last-write-wins on the same key

- **WHEN** NextRush `ctx.state.foo` and a bridged `req.foo` target the same key
- **THEN** they share one reference and the most recent write wins, without creating a second namespace

### Requirement: Prototype-pollution protection

The system SHALL prevent ad-hoc `req`/`res` property access from polluting object prototypes.

#### Scenario: Denylisted keys cannot pollute

- **WHEN** a wrapped middleware writes `req['__proto__'] = { polluted: true }`
- **THEN** `({}).polluted` remains `undefined` and `ctx.state` does not gain the key

#### Scenario: Prototype mutation on the proxy is contained

- **WHEN** a wrapped middleware calls `Object.setPrototypeOf` or `Object.defineProperty` on the bridged `req` or `res` with a prototype key
- **THEN** the real Node request/response objects are not re-prototyped and the denylist still applies

### Requirement: Header safety

The system SHALL reject CRLF/header-injection in every bridged header write path.

#### Scenario: `res.setHeader` with CRLF is rejected

- **WHEN** a wrapped middleware sets a header value containing CRLF
- **THEN** the bridge throws or rejects rather than emitting a split header

#### Scenario: `res.writeHead` with an unsafe header is rejected

- **WHEN** a wrapped middleware (or a utility such as `on-headers`) writes headers through `res.writeHead` with a CRLF-bearing value
- **THEN** the unsafe header is rejected and the header is not emitted

### Requirement: Cookie serialization uses Express semantics

The system SHALL serialize `res.cookie` with Express defaults and millisecond `maxAge`, without leaking NextRush cookie defaults.

#### Scenario: Express `maxAge` is milliseconds

- **WHEN** a wrapped middleware calls `res.cookie('sid', 'x', { maxAge: 1000 })`
- **THEN** the emitted `Set-Cookie` header contains `Max-Age=1`

#### Scenario: Unsigned cookies omit NextRush secure defaults

- **WHEN** a wrapped middleware calls `res.cookie` without `httpOnly`/`secure`/`sameSite`
- **THEN** those attributes are omitted from the header rather than inheriting NextRush defaults

### Requirement: Actionable bridge errors

The system SHALL surface bridge failures as `NextRushError` subclasses with a WHAT/WHY/HOW message, never as `TypeError: Cannot read properties of undefined`.

#### Scenario: Unsupported Express API teaches

- **WHEN** a wrapped middleware reads a known-unsupported Express prototype API (for example `req.accepts`)
- **THEN** the bridge throws an error that names the API, explains why it is unsupported, and points to the fix

#### Scenario: Developer errors never serialize to clients

- **WHEN** a bridge error is produced
- **THEN** it is marked non-exposed (`expose: false`) so its install/fix text does not leak into a client response

### Requirement: Sealed public surface

The system SHALL export only `compat`, the bridge error classes, and the type-only signatures from the package root.

#### Scenario: Internal adapters are not exported

- **WHEN** a consumer inspects the package's runtime exports
- **THEN** request/response adapter and continuation helpers are absent from the public surface

### Requirement: Unused-path isolation

The system SHALL introduce no import edge and no runtime execution path into the bridge from core, router, types, runtime, adapters, or the meta-package.

#### Scenario: No reverse dependency into the bridge

- **WHEN** an application does not import `@nextrush/express-bridge`
- **THEN** the native request path does not load or execute any bridge code

### Requirement: Compatibility registry honesty

The system SHALL maintain a compatibility registry whose `Full` and `Partial` claims are backed by tests against installed package versions, and SHALL never advertise `Unknown` as supported.

#### Scenario: No untested `Full` claim

- **WHEN** the registry labels a middleware package `Full`
- **THEN** a corresponding real-package integration test exists and passes

#### Scenario: Native-overlap packages are not `Full`

- **WHEN** a registry row corresponds to an existing `@nextrush/*` package
- **THEN** it is labeled native-preferred, not `Full`, and the native package is the documented golden path

### Requirement: Compatibility is not transitive

The system SHALL evaluate compatibility at the package boundary only.

#### Scenario: A compatible function does not imply its dependencies are compatible

- **WHEN** a wrapped middleware depends transitively on unsupported Express framework behavior
- **THEN** the package is not reported `Full` merely because its own function matched the 3-arity contract
