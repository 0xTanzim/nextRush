# router-match-path-allocation-trim Specification

## Purpose
TBD - created by archiving change router-match-path-allocation-trim. Update Purpose after archive.
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

### Requirement: Bound params use a null-prototype object (prototype-pollution safety and consistency)

The per-request params object materialized by the walk SHALL be a null-prototype object
(consistent with the frozen `EMPTY_PARAMS`), so a route param named `__proto__`, `constructor`, or
`prototype` binds as an OWN key and cannot mutate `Object.prototype`, and non-bound keys do not
resolve to inherited `Object.prototype` members.

#### Scenario: A param named __proto__ binds as an own key without polluting the prototype
- **WHEN** a route `/:__proto__` is registered and `/danger` is requested
- **THEN** `params.__proto__` is the own string value `'danger'`, `Object.prototype` is not mutated, and no other object gains a polluted property

#### Scenario: Non-bound keys are undefined on params
- **WHEN** a matched `params` object is inspected for a key that was not bound (e.g. `params.toString`)
- **THEN** it is `undefined` (params has a null prototype, exposing no inherited members)

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

### Requirement: Case-normalization is fast-pathed byte-identically for all inputs, including non-ASCII

`normalizePathForMatch` SHALL skip `toLowerCase()` only when the result is provably identical, so
any character `toLowerCase()` would change — including non-ASCII / unicode uppercase — still folds.
Results SHALL be byte-identical to always calling `toLowerCase()`.

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

### Requirement: The rewrite is behaviorally identical to the pre-change matcher

A differential harness SHALL confirm the new match path returns results identical to the pre-change
matcher across a broad path corpus covering every edge case above.

#### Scenario: Old-vs-new results match across a broad corpus
- **WHEN** a corpus of paths (static, nested params, backtracking, wildcard incl. empty capture, param+wildcard, cased incl. non-ASCII, percent-encoded incl. `%2F` and malformed, empty/root/repeated-slash, trailing-slash, method-miss, `all()`, mounted/grouped/prefixed) is matched by both the pre-change and post-change matcher
- **THEN** the resolved handler, `params` contents (and their key ownership/prototype), and executor are identical for every input

### Requirement: The optimization is validated by benchmark and coverage gates, with HP-11 park-able

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

