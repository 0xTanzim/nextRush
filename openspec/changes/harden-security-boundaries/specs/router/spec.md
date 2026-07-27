## ADDED Requirements

### Requirement: A single canonicalization function owns request-path normalization

`@nextrush/router` SHALL export one `canonicalizePath()` function that is the only place request-path
normalization is defined: case handling, repeated-slash collapsing, trailing-slash policy, and
dot-segment handling. Every consumer that makes a decision from a request path — route matching,
mounted-router prefix matching, `app.use(prefix, …)` matching, and security middleware path
exemptions — SHALL derive that decision from this function's output. No consumer SHALL re-implement
any part of the normalization.

#### Scenario: Matching and policy agree on one value

- **WHEN** a request path is normalized for route matching and the same path is tested by a
  path-prefix middleware
- **THEN** both operate on the identical canonical string, so a path that reaches a handler cannot
  bypass a guard registered for that prefix

#### Scenario: The function is deterministic and idempotent

- **WHEN** `canonicalizePath()` is applied twice to the same input
- **THEN** the second application returns its input unchanged

#### Scenario: A canonical path is produced once per request

- **WHEN** a request is dispatched
- **THEN** canonicalization runs once and its result is reused by every consumer, not recomputed per
  middleware

#### Scenario: Repeated slashes and trailing slashes normalize as before

- **WHEN** `//a//b`, `/a/b/`, or `///` is canonicalized under non-strict options
- **THEN** the result is identical to today's `collapseAndStrip` output for the same options

### Requirement: Dot segments in a request path are rejected, not resolved

A request target whose path contains a `.` or `..` segment — literally or in any percent-encoded form
that decodes to one — SHALL be rejected with `400 Bad Request` before route matching and before any
middleware that makes a path-based decision runs. The framework SHALL NOT resolve dot segments into a
different path, because resolving creates a divergence between the path a front-end proxy authorized
and the path the application dispatched.

#### Scenario: A literal parent-directory segment is rejected

- **WHEN** a request for `/api/webhooks/../admin` arrives
- **THEN** the response is 400 and no route handler or path-based middleware runs

#### Scenario: A percent-encoded dot segment is rejected

- **WHEN** a request for `/api/%2e%2e/admin` or `/api/%2E%2E%2Fadmin` arrives
- **THEN** the response is 400

#### Scenario: A double-encoded dot segment is rejected

- **WHEN** a request for `/api/%252e%252e/admin` arrives
- **THEN** the request is rejected or fails to match, and never resolves to `/admin`

#### Scenario: A single-dot segment is rejected

- **WHEN** a request for `/api/./users` arrives
- **THEN** the response is 400

#### Scenario: A filename containing dots is not affected

- **WHEN** a request for `/files/archive.tar.gz` or `/files/..hidden.txt` arrives
- **THEN** the path is accepted — only a whole segment equal to `.` or `..` is rejected

#### Scenario: Dots inside a percent-encoded parameter value are not affected

- **WHEN** a request for `/users/a%2Eb` arrives where `a.b` is a legitimate parameter value
- **THEN** the path is accepted and the parameter decodes to `a.b`

#### Scenario: Rejection precedes authentication and body parsing

- **WHEN** a request with a dot segment arrives carrying a body and credentials
- **THEN** the 400 is emitted without reading the body and without running authentication middleware

### Requirement: The canonical matched path is observable, and the raw target is preserved

The request Context SHALL expose the canonical path the router matched as `ctx.path`, and SHALL expose
the untouched request target path as `ctx.originalPath`. Both SHALL exclude the query string. This is
a **BREAKING** change to `ctx.path` semantics; the migration path is `ctx.originalPath` for any
consumer that requires the raw value.

#### Scenario: ctx.path equals what the router matched

- **WHEN** a request whose target differs from its canonical form (repeated slashes, trailing slash)
  is dispatched
- **THEN** `ctx.path` equals the canonical string the router matched, not the raw target

#### Scenario: ctx.originalPath preserves the raw target

- **WHEN** the same request is dispatched
- **THEN** `ctx.originalPath` equals the raw target path exactly, including original casing and
  repeated slashes

#### Scenario: Both exclude the query string

- **WHEN** a request for `/a//b?x=1` is dispatched
- **THEN** neither `ctx.path` nor `ctx.originalPath` contains `?x=1`

#### Scenario: An unmatched request still exposes both values

- **WHEN** a request does not match any route and reaches the 404 path
- **THEN** `ctx.path` and `ctx.originalPath` are both populated and consistent

### Requirement: Prefix and mount matching uses router normalization

`app.use(prefix, middleware)` and mounted-router prefix resolution SHALL determine whether a request
falls under a prefix using the router's own canonicalization and segment-boundary rules, so
application code never needs a hand-written `startsWith` comparison to gate a route group.

#### Scenario: A prefix guard fires for every form the router accepts

- **WHEN** middleware is mounted at `/admin` and requests arrive for `/admin/users`,
  `/admin/users/`, and `//admin//users`
- **THEN** the middleware runs for all of them

#### Scenario: A prefix matches only on a segment boundary

- **WHEN** middleware is mounted at `/admin` and a request arrives for `/administrator`
- **THEN** the middleware does not run

#### Scenario: The prefix itself matches

- **WHEN** middleware is mounted at `/admin` and a request arrives for `/admin`
- **THEN** the middleware runs

#### Scenario: Nested mounts compose without re-normalizing

- **WHEN** a router mounted at `/api` contains a router mounted at `/admin` and a request arrives for
  `/api/admin/x`
- **THEN** the inner middleware runs and the canonical path is computed once for the request

## MODIFIED Requirements

### Requirement: Case-normalization is fast-pathed byte-identically for all inputs, including non-ASCII

Case folding SHALL apply only when a router is explicitly configured `caseSensitive: false`. The
default SHALL be `caseSensitive: true`, matching RFC 3986 §6.2.2.1, which defines the path component
as case-sensitive. This is a **BREAKING** default change; the migration path is passing
`caseSensitive: false` explicitly to any router that relied on case-insensitive matching.

When folding is enabled, `canonicalizePath` SHALL skip `toLowerCase()` only when the result is
provably identical, so any character `toLowerCase()` would change — including non-ASCII / unicode
uppercase — still folds. Results SHALL be byte-identical to always calling `toLowerCase()`. When
folding is enabled, the folded value SHALL be the value published as `ctx.path`, so no consumer ever
compares against a differently-cased string than the router matched.

#### Scenario: The default router matches case-sensitively

- **WHEN** a route is registered at `/admin/users` on a default router and a request for
  `/ADMIN/users` arrives
- **THEN** the request does not match and returns 404

#### Scenario: An opted-in case-insensitive router still folds, and publishes the folded path

- **WHEN** a router configured `caseSensitive: false` matches `/ADMIN/users` against a route
  registered at `/admin/users`
- **THEN** the route matches **AND** `ctx.path` is `/admin/users`, so a path-prefix guard for
  `/admin` sees the same value the router matched

#### Scenario: An already-lowercase ASCII path is not re-allocated

- **WHEN** a lowercase request path is normalized for a case-insensitive router
- **THEN** the result equals today's and no new lowercased string is allocated

#### Scenario: A non-ASCII uppercase path still folds identically

- **WHEN** a case-insensitive route matches a path containing non-ASCII uppercase (e.g. `/Ürl`)
- **THEN** the normalized path equals `path.toLowerCase()` exactly (the fast-path does not wrongly
  skip folding), so unicode case-insensitive matching is unaffected

#### Scenario: Case-insensitive param matching needs no second normalize pass

- **WHEN** a case-insensitive param route is matched
- **THEN** the match resolves and param casing is correct without running the canonicalization twice

#### Scenario: The hasParamRoutes gate still skips the walk for static-only routers

- **WHEN** a router has only static routes and a request misses the static map
- **THEN** the tree walk is skipped entirely (returns null immediately)

### Requirement: Degenerate and pathological paths are handled safely (critical flow)

Root, empty, and repeated-slash paths SHALL match as today, and the matcher SHALL NOT introduce
unbounded stack growth for very deep paths. An iterative walk is preferred so a pathological segment
count cannot overflow the stack. Dot-segment rejection SHALL be applied before this walk and SHALL
itself be bounded — scanning a pathological path for dot segments MUST be linear in path length with
no backtracking regular expression.

#### Scenario: Root and empty-segment paths match as today

- **WHEN** `/` is requested, or a path with repeated/empty segments (`//a//b`, `///`) is requested
- **THEN** the result is identical to the current matcher (double-slash collapse and root handling
  preserved)

#### Scenario: A very deep path does not crash differently than today

- **WHEN** a path with a very large number of segments is matched
- **THEN** it resolves or misses without a new failure mode (no newly-introduced stack overflow); the
  matcher does not worsen worst-case depth and, where practical, walks iteratively

#### Scenario: A pathological path is scanned for dot segments in linear time

- **WHEN** a path of maximum accepted length consisting of many `.`-adjacent characters is received
- **THEN** the dot-segment check completes in time linear to the path length and rejects or accepts
  without catastrophic backtracking

#### Scenario: A path of only dot segments is rejected, not resolved to root

- **WHEN** `/../..` or `/./.` is requested
- **THEN** the response is 400 — it never resolves to `/`
