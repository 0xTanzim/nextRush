# router

## Purpose

The `@nextrush/router` segment-trie router: how requests are matched (O(k) static and param/wildcard
lookup, static-over-trie precedence, percent-decoding, case-folding, degenerate-path safety),
how routes are registered (direct, `all()`/`@All` single any-method entries, prefix, mount, group),
how a match is materialized (single `RouteMatch`, fast-property params exposing no `Object.prototype`,
shared frozen
`EMPTY_PARAMS`, clean 404/405 dispatch), and the concurrency-safety, allocation, module-size
(≤300-line files), internal-dedup, documentation-accuracy, and future-radix-RFC discipline that
keep the package correct and honest. Behavior is pinned byte-identical to the pre-optimization
matcher by a differential harness, allocation micro-benchmarks, and CPU-pinned A/Bs.
## Requirements
### Requirement: Static route lookup drops the per-request key string

The static-route store SHALL be method-nested so lookup selects by method and probes by path,
without building a `` `${method} ${path}` `` key string per request. Method-miss, trailing-slash,
`all()`, and static-over-trie precedence SHALL be preserved.

#### Scenario: A static hit resolves without a per-request key string
- **WHEN** a request matches a registered static route
- **THEN** the handler and executor are returned with the shared `EMPTY_PARAMS`, and no `"METHOD path"` string is allocated for the lookup

#### Scenario: An unregistered method on a known path misses
- **WHEN** `GET /x` is registered and a `POST /x` request arrives
- **THEN** the match misses (returns null), so `allowedMethods()` can still respond 405

#### Scenario: A trailing slash on a static route still matches (non-strict)
- **WHEN** `/users` is registered (non-strict) and `/users/` is requested
- **THEN** it matches the same handler

#### Scenario: `all()` registers every method on the nested map
- **WHEN** a path is registered via `all()` and requested with any HTTP method
- **THEN** each method resolves to the handler

#### Scenario: A static hit is preferred over a param/trie match for the same path
- **WHEN** both `/users/me` (static) and `/users/:id` (param) are registered and `/users/me` is requested
- **THEN** the static `/users/me` handler matches, and the trie walk is not consulted for it

### Requirement: All registration flows populate the method-nested static map

Direct registration, `all()`, router `prefix`, sub-router `mount`/`use` (copied routes), and
`group()` SHALL all populate the method-nested static map correctly, and `reset()` SHALL clear it
fully (outer and inner maps), with no ghost entries.

#### Scenario: A prefixed static route resolves under its prefix
- **WHEN** a router with `prefix: '/api'` registers `/health` and `/api/health` is requested
- **THEN** it resolves to the handler

#### Scenario: A mounted sub-router's static routes resolve
- **WHEN** a sub-router with a static route is mounted at a prefix and a matching request arrives
- **THEN** the copied static route resolves through the nested map

#### Scenario: reset() clears the nested map fully
- **WHEN** `reset()` is called after routes were registered
- **THEN** all static entries (every method's inner map) are cleared and subsequent matches miss

### Requirement: A matched request allocates a single RouteMatch object

The match path SHALL produce the `RouteMatch` in one allocation per matched request rather than a
`matchRoute` result plus a separate `resolveMatch` wrapper. The `RouteMatch` shape
(`handler`, `params`, `middleware`, `executor`) SHALL be unchanged, and `middleware`
(`routerMiddleware`) SHALL be attached exactly once.

#### Scenario: One object is built per matched request
- **WHEN** any request matches a route
- **THEN** exactly one `RouteMatch` object is constructed (not a result object plus a wrapper), carrying the same fields as today

#### Scenario: The router middleware is attached to the single object
- **WHEN** a route matches on a router that has router-level middleware
- **THEN** the returned `RouteMatch.middleware` is that `routerMiddleware`, attached once

### Requirement: Parameter matching preserves all behavior after the tuple-array and backtrack rewrite

Rewriting the param walk to avoid per-segment tuple arrays and to materialize params once on the
successful terminal path (removing the backtrack `Reflect.deleteProperty`) SHALL preserve every
observable matching behavior.

#### Scenario: Static beats param beats wildcard at each node
- **WHEN** `/users/me` (static), `/users/:id` (param), and `/users/*` (wildcard) are all registered and `/users/me` is requested
- **THEN** the static `/users/me` handler matches (not the param or wildcard)

#### Scenario: Backtracking leaves no stale param bindings
- **WHEN** `/a/:x/c` and `/a/b/d` are registered and `/a/b/c` is requested
- **THEN** it matches `/a/:x/c` with `params.x === 'b'` (the static `b` branch is tried first, fails at `c`, and the walk backtracks to the param branch), with no stale/leftover params

#### Scenario: Nested parameters bind correctly
- **WHEN** `/a/:x/b/:y` is registered and `/a/1/b/2` is requested
- **THEN** `params.x === '1'` and `params.y === '2'`

#### Scenario: Param values keep original case when case-insensitive
- **WHEN** the router is case-insensitive (default) and `/users/:id` is requested as `/Users/AbC`
- **THEN** the route matches and `params.id === 'AbC'` (original case preserved; lookup used the lowercased path)

#### Scenario: Param values are percent-decoded, with a raw fallback
- **WHEN** `decode` is enabled and `/users/:id` is requested as `/users/a%20b`
- **THEN** `params.id === 'a b'`; and when the value is malformed (`%zz`, `%`, or a truncated `%2`) it falls back to the raw segment without throwing

#### Scenario: A wildcard captures the original-case remainder
- **WHEN** `/files/*` is registered and `/files/A/b/c` is requested
- **THEN** `params['*'] === 'A/b/c'`

#### Scenario: A wildcard can capture an empty remainder as today
- **WHEN** `/files/*` is registered and `/files` (or `/files/`) is requested
- **THEN** the match result equals the current matcher's (empty-capture behavior preserved, not changed by the rewrite)

#### Scenario: A param combined with a trailing wildcard binds both
- **WHEN** `/a/:x/*` is registered and `/a/1/b/c` is requested
- **THEN** `params.x === '1'` and `params['*'] === 'b/c'`

#### Scenario: An empty param segment behaves as today
- **WHEN** a request that would bind an empty `:param` segment is matched (e.g. `/users/` against `/users/:id`, non-strict)
- **THEN** the result is identical to the current matcher (no new match or miss introduced)

#### Scenario: A trailing slash on a param route (non-strict) behaves as today
- **WHEN** `/users/:id` is registered (non-strict) and `/users/42/` is requested
- **THEN** it matches with `params.id === '42'`, identical to today

#### Scenario: A param-less trie match returns the shared EMPTY_PARAMS
- **WHEN** a request matches a route through the trie that binds no `:param`/`*`
- **THEN** the returned `params` is the shared frozen `EMPTY_PARAMS` sentinel, not a fresh object

### Requirement: Bound params expose no `Object.prototype` members (prototype-pollution safety and consistency)

The per-request params object materialized by the walk SHALL have a prototype chain that excludes
`Object.prototype` (consistent with the frozen `EMPTY_PARAMS`), so a route param named `__proto__`,
`constructor`, or `prototype` binds as an OWN key and cannot mutate `Object.prototype`, and
non-bound keys do not resolve to inherited `Object.prototype` members.

The container SHALL additionally keep V8 fast (non-dictionary) properties, so that property reads
in application code remain inline-cacheable. `Object.create(null)` satisfies the safety half of this
requirement but violates the performance half — it yields a dictionary-mode object. Containers are
therefore derived from a shared null-prototype base object (`Object.create(NULL_PROTO)`), which
satisfies both. The immediate prototype is consequently NOT `null`; the chain terminates in `null`
one hop later, and `Object.prototype` is never in it.

#### Scenario: A param named __proto__ binds as an own key without polluting the prototype
- **WHEN** a route `/:__proto__` is registered and `/danger` is requested
- **THEN** `params.__proto__` is the own string value `'danger'`, `Object.prototype` is not mutated, and no other object gains a polluted property

#### Scenario: Non-bound keys are undefined on params
- **WHEN** a matched `params` object is inspected for a key that was not bound (e.g. `params.toString`)
- **THEN** it is `undefined` (no inherited `Object.prototype` member is reachable)

#### Scenario: The params container is not in V8 dictionary mode
- **WHEN** a matched `params` object with one or more bound params is inspected with `%HasFastProperties`
- **THEN** it reports `true`, and walking its prototype chain never encounters `Object.prototype`

### Requirement: Percent-decoded param and wildcard values never re-segment the path

Decoding SHALL apply to the extracted segment/remainder value only, never re-splitting the path;
an encoded slash (`%2F`) or encoded dot (`%2E`) in a value SHALL NOT create new path segments or
change which route matched (path-traversal / request-smuggling safety).

#### Scenario: An encoded slash stays within a single param value
- **WHEN** `/files/:name` is registered (decode enabled) and `/files/a%2Fb` is requested
- **THEN** the route matched is still `/files/:name`, `params.name === 'a/b'`, and NO `/files/a/b` structural match is produced

#### Scenario: Encoded dots do not enable traversal segments
- **WHEN** a request contains encoded dot sequences in a segment (e.g. `%2E%2E`)
- **THEN** they decode into the value only and never split into `..` path segments that alter routing

### Requirement: The post-match Object.keys loop is removed

`matchRoute` SHALL determine whether any params were bound via a walk-time count rather than an
`Object.keys(params)` post-loop, returning `EMPTY_PARAMS` when zero were bound.

#### Scenario: No post-match key scan is performed
- **WHEN** a param route is matched
- **THEN** the presence of params is known from the walk (no `Object.keys` array is allocated), and a zero-param match returns `EMPTY_PARAMS`

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

#### Scenario: The real dispatch path does not re-normalize an already-canonical string

- **WHEN** a request is dispatched through `createRoutesMiddleware` (the real HTTP path, which
  already calls `canonicalizePath()` before matching)
- **THEN** the router's internal match step does not independently re-run its own fold/collapse
  normalization on the already-canonical path — the "produced once per request" guarantee holds
  for the actual dispatch path, not only in principle for a caller that chooses to honor it

#### Scenario: Standalone matching still normalizes its own input

- **WHEN** `Router.match(method, path)` is called directly (not through `createRoutesMiddleware`)
  with a raw, non-canonical path — as a direct API caller or a test would
- **THEN** the match step still normalizes the input itself, exactly as it does today, since this
  caller never ran `canonicalizePath()` first

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

### Requirement: Case-normalization is fast-pathed byte-identically for all inputs, including non-ASCII

`normalizePathForMatch` SHALL skip `toLowerCase()` only when the result is provably identical, so
any character `toLowerCase()` would change — including non-ASCII / unicode uppercase — still folds.
Results SHALL be byte-identical to always calling `toLowerCase()`.

The default remains `caseSensitive: false` (case-insensitive matching) — flipping the default to
`true` per RFC-029 is deferred to a future major-release-lane change and has NOT shipped; RFC-029 is
pre-approved for that future flip (`docs/RFC/request-data/029-canonical-request-path.md` §15). When
case folding is enabled (the default), the folded value SHALL be the value published as `ctx.path`, so
no consumer ever compares against a differently-cased string than the router matched.

#### Scenario: An already-lowercase ASCII path is not re-allocated
- **WHEN** a lowercase request path is normalized for a case-insensitive router
- **THEN** the result equals today's and no new lowercased string is allocated

#### Scenario: A non-ASCII uppercase path still folds identically
- **WHEN** a case-insensitive route matches a path containing non-ASCII uppercase (e.g. `/Ürl`)
- **THEN** the normalized path equals `path.toLowerCase()` exactly (the fast-path does not wrongly skip folding), so unicode case-insensitive matching is unaffected

#### Scenario: Case-insensitive param matching needs no second normalize pass
- **WHEN** a case-insensitive param route is matched
- **THEN** the match resolves and param casing is correct without running `normalizePathForMatch` twice

#### Scenario: The hasParamRoutes gate still skips the walk for static-only routers
- **WHEN** a router has only static routes and a request misses the static map
- **THEN** the tree walk is skipped entirely (returns null immediately)

#### Scenario: An opted-in case-insensitive router publishes the folded path

- **WHEN** a router configured `caseSensitive: false` (the default) matches `/ADMIN/users` against a
  route registered at `/admin/users`
- **THEN** the route matches **AND** `ctx.path` is `/admin/users`, so a path-prefix guard for
  `/admin` sees the same value the router matched

### Requirement: Degenerate and pathological paths are handled safely (critical flow)

Root, empty, and repeated-slash paths SHALL match as today, and the rewrite SHALL NOT introduce new
unbounded stack growth relative to the current matcher for very deep paths. An iterative walk is
preferred so a pathological segment count cannot overflow the stack.

#### Scenario: Root and empty-segment paths match as today
- **WHEN** `/` is requested, or a path with repeated/empty segments (`//a//b`, `///`) is requested
- **THEN** the result is identical to the current matcher (double-slash collapse and root handling preserved)

#### Scenario: A very deep path does not crash differently than today
- **WHEN** a path with a very large number of segments is matched
- **THEN** it resolves or misses without a new failure mode (no newly-introduced stack overflow); the rewrite does not worsen worst-case depth and, where practical, walks iteratively

### Requirement: Matching is concurrency-safe with no shared mutable state

The match path SHALL NOT reuse a per-router mutable scratch/params object across matches; each
matched request gets its own params (or the shared frozen `EMPTY_PARAMS` for zero params), so
concurrent in-flight requests cannot observe or corrupt each other's params.

#### Scenario: Concurrent matches do not cross-contaminate params
- **WHEN** many requests with different param values match the same route concurrently
- **THEN** each request observes only its own param values; the only shared object is the frozen `EMPTY_PARAMS`

### Requirement: A miss returns null cleanly and preserves the 404/405 dispatch flow

On no match the match path SHALL return `null` (never a partial or throwing result), so
`createRoutesMiddleware` sets `ctx.status = 404` and calls `next()`, and `allowedMethods()` can
respond 405. A matched route's pre-compiled `executor` SHALL be invoked (not re-composed).

#### Scenario: An unmatched path yields a clean 404 flow
- **WHEN** no route matches a request
- **THEN** the match returns `null`, the router middleware sets 404 and calls `next()`, and nothing throws out of the match path

#### Scenario: A known path with an unregistered method reaches allowedMethods
- **WHEN** a path is registered for some methods and requested with a different one
- **THEN** the match returns `null` so the 404 is set and `allowedMethods()` can turn it into a 405 with an `Allow` header

#### Scenario: A matched route runs its compiled executor
- **WHEN** a route with a pre-compiled executor matches
- **THEN** that executor is invoked (the middleware chain is not re-composed per request), identical to today

### Requirement: The findNode walk used by findAllowedMethods is iterative

`findNode` SHALL walk the trie with an explicit stack rather than recursion, so a pathological
segment count on the 405/OPTIONS path cannot overflow the call stack, while producing byte-identical
results (same static > param > wildcard precedence, same first-matching node).

#### Scenario: findAllowedMethods results are unchanged
- **WHEN** `findAllowedMethods` is exercised across a corpus (static, param, wildcard, nested, trailing-slash, method-miss)
- **THEN** the returned method sets are identical to the recursive implementation for every input

#### Scenario: A deep path on the 405/OPTIONS path does not overflow the stack
- **WHEN** a request with a very large number of segments hits the allowed-methods walk (e.g. an OPTIONS or unregistered-method request to a deep path)
- **THEN** `findNode` resolves or returns null without a stack overflow (iterative walk), matching the DoS-safety the match path already has

#### Scenario: Precedence is preserved
- **WHEN** static, param, and wildcard branches could match at a node
- **THEN** the iterative `findNode` selects the same branch order (static > param > wildcard) as the recursive form

### Requirement: The router hot path stays free of the removed deopt patterns (HP-18 guard)

The router match path SHALL remain free of the backtrack `Reflect.deleteProperty` and the
`Object.keys` post-match loop that the P2 rewrite removed; a regression guard MUST fail if either is
reintroduced into the router match source.

#### Scenario: No Reflect.deleteProperty or Object.keys post-loop in the router match path
- **WHEN** the router match sources (`matching.ts` / `match-route.ts`) are checked by the guard
- **THEN** they contain no backtrack `Reflect.deleteProperty` and no `Object.keys`-based post-match param loop

### Requirement: `@All`/`app.all` registers a single any-method route entry
`@All()` (class decorator) and `app.all()` (functional API) SHALL register one route entry that
matches all HTTP methods, rather than one explicit registration per enumerated method.

#### Scenario: `@All` yields a single route-table row
- **WHEN** a route is registered via `@All('/x')` or `app.all('/x', handler)`
- **THEN** `getRoutes()` (or the equivalent route-introspection API) shows exactly one entry for
  that path, not one row per HTTP method

#### Scenario: All HTTP methods still match the registered route
- **WHEN** a request with any standard HTTP method (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`,
  `HEAD`, `OPTIONS`) is made against a path registered via `@All`/`app.all`
- **THEN** the request matches and is handled correctly, identical to before this change

#### Scenario: No existing route-table consumer breaks
- **WHEN** any in-repo consumer of route introspection (e.g. `@nextrush/openapi`'s route
  generation, or class-package diagnostics) processes a route table containing an `@All` route
- **THEN** it correctly handles the single-entry, any-method shape without producing incorrect
  output (this scenario governs the pre-implementation consumer search noted in design.md's Risk
  section)

### Requirement: Router source files stay within the 300-line ceiling
No shipping source file in `@nextrush/router` SHALL exceed 300 lines. Any split performed to
satisfy this SHALL preserve all existing observable behavior, verified by a passing test suite
and an unchanged public-surface snapshot.

#### Scenario: The router package has no over-cap file after the split
- **WHEN** every `.ts` file under `packages/router/src` (excluding test files) is measured
- **THEN** none exceeds 300 lines

#### Scenario: The public API surface is unchanged after the split
- **WHEN** the router package's public-surface snapshot test runs before and after the file
  reorganization
- **THEN** the exported symbol set is identical

#### Scenario: Existing router behavior is unchanged after the split
- **WHEN** the full router package test suite (plus any characterization tests added to cover
  gaps found during the refactor) runs after the split
- **THEN** all tests pass with no behavior change from before the split

### Requirement: Audit-identified internal duplications are resolved or explicitly justified
The internal duplications the router audit identified SHALL be resolved to single sources where
safe, or their retention explicitly justified in a comment, with all observable behavior
preserved.

#### Scenario: EMPTY_PARAMS has a single definition
- **WHEN** `EMPTY_PARAMS` usage across the router package is examined
- **THEN** it is defined once in a shared internal module and imported by both former sites, OR
  its duplication carries an explicit, verified justification (a genuine import cycle)

#### Scenario: Path normalization has a single definition
- **WHEN** the path-normalization logic used by route matching and by allowed-methods lookup is
  examined
- **THEN** it is defined once in a shared helper both call, rather than encoded twice

#### Scenario: A behavior-sensitive dedup is gated on tests
- **WHEN** a duplication whose removal could change observable behavior (e.g. the `hasParams`
  post-match cleanup loop) is considered for removal
- **THEN** it is only removed if the existing test suite — including param-backtracking edge
  cases — proves the removal behavior-preserving; otherwise it is retained with a documented reason

### Requirement: Router documentation and type docs accurately describe the segment-trie algorithm
All documentation and type-level doc comments across `@nextrush/router` and `@nextrush/types`
SHALL accurately describe the segment-trie algorithm the router actually implements, with no
residual "radix tree" claims and no stale structural descriptions that misrepresent the
implementation.

#### Scenario: No residual radix claim remains in router code or types
- **WHEN** `@nextrush/router`'s source and `@nextrush/types`' router types are searched for the
  term "radix" (case-insensitive)
- **THEN** no matches remain except an explicitly historical changelog reference

#### Scenario: The router README does not contradict itself
- **WHEN** `packages/router/README.md` is read end-to-end
- **THEN** it describes the algorithm as a segment trie consistently, with no "Radix Tree
  Algorithm" heading or "the radix tree router provides" claim contradicting its own opening

#### Scenario: The TrieNode.children doc matches the code
- **WHEN** `TrieNode.children`'s doc comment is compared to how the code keys that map
- **THEN** the comment accurately states children are keyed by whole path segment, not "by first
  character"

### Requirement: A published RFC specifies the future radix router package
A published RFC at `docs/RFC/RFC-NEXTRUSH-ROUTER-RADIX.md` SHALL specify the future
`@nextrush/router-radix` package before that package is implemented, following this repo's
RFC-before-implementation discipline for new packages.

#### Scenario: The RFC exists and follows the repo's RFC convention
- **WHEN** the RFC is authored
- **THEN** it exists at `docs/RFC/RFC-NEXTRUSH-ROUTER-RADIX.md`, matching the naming and
  structure of existing RFCs (e.g. `RFC-NEXTRUSH-ADAPTER-CONTRACT.md`)

#### Scenario: The RFC specifies the shared contract and conformance-parity model
- **WHEN** the RFC is reviewed for completeness
- **THEN** it defines the `Router` contract a conformant router must implement, and a
  router-conformance parity harness (modeled on `packages/adapters/conformance`) that runs
  against both the segment-trie and radix routers

#### Scenario: The RFC states honest costs and the default-router positioning
- **WHEN** the RFC's costs/risks section is read
- **THEN** it explicitly addresses the maintenance/bus-factor cost of a second router against a
  single-maintainer project, and states that the segment-trie router remains the default with
  radix opt-in for a stated reason — never a forced choice

#### Scenario: The RFC captures the deferred hot-path optimization as measurement-gated
- **WHEN** the RFC's design-considerations section is read
- **THEN** it records the `Reflect.deleteProperty`/param-materialization consideration as a
  measurement-gated item (settled by benchmark T017), not a committed change

### Requirement: The match-path rewrite is behaviorally identical to the pre-change matcher

A differential harness SHALL confirm the new match path returns results identical to the pre-change
matcher across a broad path corpus covering every edge case above.

#### Scenario: Old-vs-new results match across a broad corpus
- **WHEN** a corpus of paths (static, nested params, backtracking, wildcard incl. empty capture, param+wildcard, cased incl. non-ASCII, percent-encoded incl. `%2F` and malformed, empty/root/repeated-slash, trailing-slash, method-miss, `all()`, mounted/grouped/prefixed) is matched by both the pre-change and post-change matcher
- **THEN** the resolved handler, `params` contents (and their key ownership/prototype), and executor are identical for every input

### Requirement: The match-path optimization is validated by benchmark and coverage gates, with HP-11 park-able

Each trim SHALL ship with allocation evidence and a `--profile full` A/B on its target scenario.
The param-walk rewrite (HP-11) SHALL be reverted/parked if its CPU-pinned A/B does not move Route
Params beyond stddev, while the safer trims remain.

#### Scenario: An allocation micro-benchmark documents the removed garbage
- **WHEN** the router match-path allocation micro-benchmark runs on static and param routes
- **THEN** it shows the `staticKey` string, the duplicate result object, the per-segment tuple arrays, and the `Object.keys` array are no longer allocated

#### Scenario: Response parity is unaffected
- **WHEN** `pnpm bench:validate` runs across all benchmark servers
- **THEN** response bodies and Content-Type remain byte-identical

#### Scenario: The full-profile A/B gates each trim, and HP-11 specifically
- **WHEN** `pnpm bench:compare --profile full` (5 runs, CPU-pinned) is run before/after per trim on Hello World (static) and Route Params (param)
- **THEN** no trim regresses beyond stddev, and HP-11 is kept only if Route Params improves beyond stddev — otherwise it is parked while the other trims stay

#### Scenario: Coverage is maintained and rewritten branches are covered
- **WHEN** the router test suite runs with coverage
- **THEN** per-package line coverage stays at or above 90% and the rewritten match/normalize branches — including the new safety branches — are covered

### Requirement: The context/findNode cleanup is validated by allocation, parity, and coverage gates

Because both trims are cleanup (HP-5 <1%, HP-17 off the throughput path), the change SHALL be
accepted on deterministic allocation evidence, differential parity, and the deep-path safety test
rather than an RPS A/B, and coverage MUST NOT decrease.

#### Scenario: An allocation micro-benchmark confirms the lazy raw saving
- **WHEN** the allocation micro-bench runs on a raw-unread request
- **THEN** it shows the `{ req, res }` wrapper is no longer allocated

#### Scenario: Response parity is unaffected (cleanup)
- **WHEN** `pnpm bench:validate` runs across all benchmark servers
- **THEN** response bodies and Content-Type remain byte-identical

#### Scenario: Coverage is maintained and refactored branches are covered
- **WHEN** the adapter-node and router test suites run with coverage
- **THEN** per-package line coverage stays at or above 90% and the refactored `ctx.raw` and iterative `findNode` branches are covered

### Requirement: Route dispatch forwards route execution without adding an async frame

`createRoutesMiddleware` (the router's primary dispatch middleware) and the no-middleware
(`len === 0`) compiled executor (`compileExecutor`) SHALL forward the route's promise directly
rather than wrapping it in an additional `async` frame, while preserving every observable dispatch
semantic. Both SHALL remain valid `Middleware`/executor functions returning `Promise<void>`. The
`len >= 1` executor path (which is already non-`async`) SHALL be unchanged.

#### Scenario: A matched route runs the compiled executor without an extra async frame
- **WHEN** a request matches a route with a pre-compiled executor
- **THEN** `createRoutesMiddleware` returns the executor's promise directly (no wrapping `async` frame), the executor runs, and the response is produced identically to today

#### Scenario: A synchronous handler is wrapped without an extra await hop
- **WHEN** a matched no-middleware route's handler is synchronous (e.g. `ctx => ctx.json(...)` returning `undefined`)
- **THEN** the `len === 0` executor returns a resolved `Promise<void>` for the handler's result without the async form's internal `await` microtask hop, and the response is byte-identical to today

#### Scenario: A synchronous throw from a handler becomes a rejected promise
- **WHEN** a matched route's handler throws synchronously (e.g. the `/error` route)
- **THEN** the executor returns a rejected promise (it never throws synchronously out of dispatch), the rejection propagates through `createRoutesMiddleware` and the composer, and the application error handler produces its response (e.g. 500) — identical to today

#### Scenario: An async handler rejection or returned rejected promise propagates
- **WHEN** a matched route's handler is `async` and rejects, or returns a rejected promise
- **THEN** that rejection propagates unchanged out of the executor and `createRoutesMiddleware` to the error handler

#### Scenario: A thenable handler return is adopted, not dropped
- **WHEN** a handler returns a non-`Promise` thenable
- **THEN** the executor adopts it (the returned promise settles with the thenable), matching the previous `await handler(...)` behavior — the async work is not dropped

#### Scenario: A non-Error throw is wrapped as an Error
- **WHEN** a handler throws a non-`Error` value (string, number, null, undefined, object)
- **THEN** the rejection is an `Error` whose message equals `String(thrownValue)`, matching today

#### Scenario: A miss sets 404 and forwards next() for the allowedMethods fall-through
- **WHEN** no route matches
- **THEN** `createRoutesMiddleware` sets `ctx.status = 404` and returns `next()` (or a resolved promise if there is no `next`), so `allowedMethods()`/a 404 handler still runs and can turn a known-path/unregistered-method miss into a 405

#### Scenario: The load-bearing setNext(NOOP_NEXT) still terminates the chain at the handler
- **WHEN** a route handler on a no-middleware route calls `ctx.next()`, in an app whose stack has middleware mounted AFTER the router
- **THEN** `ctx.next()` is a safe no-op (the executor's `ctx.setNext(NOOP_NEXT)` is preserved) and does NOT advance into the app-level middleware after the router — identical to today

#### Scenario: The per-route middleware chain (len >= 1) is unchanged
- **WHEN** a route registered with per-route middleware (e.g. the 5-layer `/middleware` route) runs, each layer using `ctx.next()`
- **THEN** onion ordering, `ctx.next()` advancement, and multiple-`next()` detection are identical to today (the `len >= 1` executor is untouched), and `createRoutesMiddleware` forwards its promise unchanged

#### Scenario: Match behavior is byte-identical (differential golden)
- **WHEN** the router differential golden corpus is matched and dispatched before and after the change
- **THEN** the resolved handler, params, executor, and response bytes are identical for every input

#### Scenario: Behavior is identical across adapters
- **WHEN** the same dispatch behavior is exercised on each supported adapter (Node/Bun/Deno/Edge)
- **THEN** the observable behavior is identical, since the router (and its dispatch) is shared across adapters

### Requirement: The dispatch de-async is validated by allocation, parity, and coverage gates

Because the change is behavior-preserving and the end-to-end RPS effect is not measurable on
unpinned hardware, it SHALL be accepted on deterministic allocation reduction + byte-identical
parity + differential-golden equivalence + a quick-profile smoke showing no regression, with the
publishable CPU-pinned A/B deferred. Per-package coverage MUST NOT decrease.

#### Scenario: An allocation micro-benchmark documents the removed async frames
- **WHEN** the dispatch allocation micro-benchmark (`bench:alloc:dispatch`) runs the matched no-middleware path
- **THEN** it shows the two router-layer `async` state machines are no longer allocated per matched request (the flattened path allocates materially less than the pre-change 3-frame path)

#### Scenario: Response parity is unaffected
- **WHEN** `pnpm bench:validate` runs across all benchmark servers
- **THEN** response bodies, statuses, and Content-Type remain byte-identical (including the `/error` route's 500)

#### Scenario: The quick-profile smoke shows no regression
- **WHEN** `pnpm bench:compare:quick` is run before and after on Hello World and Route Params
- **THEN** there is no obvious regression; a clear regression parks the change pending the deferred CPU-pinned `--profile full` A/B

#### Scenario: Coverage is maintained and the changed branches are covered
- **WHEN** the router test suite runs with coverage
- **THEN** per-package line coverage stays at or above 90% and the de-async'd `createRoutesMiddleware` (match/miss/404) and `len === 0` executor (void/promise/thenable/throw) branches are covered

### Requirement: Reused internal walk state is never shared across concurrent in-flight matches

If `@nextrush/router`'s tree-walk match path reuses internal scratch state (a frame stack, binding
arrays) across calls to avoid per-call allocation, that reused state SHALL be scoped so that no two
concurrent in-flight `matchRoute()` calls on the same router instance can observe or corrupt each
other's walk progress. The walk SHALL remain fully synchronous end-to-end for this guarantee to
hold; introducing any `await` inside the walk without re-deriving this invariant is a breaking
change to this requirement, not a safe extension.

#### Scenario: Sequential matches reuse state safely

- **WHEN** the same router instance handles two requests one after another, and both use pooled
  internal walk state
- **THEN** the second match's result is unaffected by the first match's params, path, or outcome

#### Scenario: The walk never awaits mid-frame

- **WHEN** the tree-walk match path executes
- **THEN** no frame of the walk suspends on a promise before the match completes — the entire walk
  from entry to a matched or unmatched result runs in one synchronous pass

#### Scenario: A matched request's observable result is unchanged by internal reuse

- **WHEN** a request matches a parameterized route on a router using pooled internal walk state
- **THEN** the returned `RouteMatch`'s `params`, `handler`, `middleware`, and `executor` are
  identical to what an unpooled implementation would return for the same input

