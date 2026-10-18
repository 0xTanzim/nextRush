# Spec Delta

## MODIFIED Requirements

### Requirement: A single canonicalization function owns request-path normalization

`@nextrush/router` SHALL export one `canonicalizePath()` function that is the only place request-path
normalization is defined: case handling, repeated-slash collapsing, trailing-slash policy, and
dot-segment handling. Every consumer that makes a decision from a request path — route matching,
mounted-router prefix matching, `app.use(prefix, …)` matching, and security middleware path
exemptions — SHALL derive that decision from this function's output. No consumer SHALL re-implement
any part of the normalization.

Its result SHALL additionally carry a `valuePath`: the same query-stripped, slash-collapsed,
trailing-slash-stripped path with the request's original casing preserved. `path` remains the
case-folded string used for matching, and `valuePath` is the string parameter and wildcard values
are extracted from. When no case folding occurred, the two SHALL be the same string value. Route
dispatch SHALL pass both to the matcher rather than re-deriving either, and SHALL NOT fold the
extraction string.

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

#### Scenario: The canonical result carries a structure-identical, case-preserved value path

- **WHEN** a request path containing uppercase is canonicalized for a case-insensitive router
- **THEN** `path` is the case-folded string used for matching, `valuePath` has the identical segment
  and separator structure with the original casing preserved, and neither is recomputed during
  dispatch

#### Scenario: The public match signature is unchanged

- **WHEN** `Router.match(method, path)` is called directly with the documented two arguments
- **THEN** it behaves exactly as before; the case-preserved value path is supplied only by the
  dispatch path, and a caller that does not supply one gets today's behaviour

### Requirement: Dot segments in a request path are rejected, not resolved

A request target whose path contains a `.` or `..` segment — literally or in any percent-encoded form
that decodes to one — SHALL be rejected with `400 Bad Request` before route matching and before any
middleware that makes a path-based decision runs. The framework SHALL NOT resolve dot segments into a
different path, because resolving creates a divergence between the path a front-end proxy authorized
and the path the application dispatched.

A segment counts as a dot segment when, after replacing every `%2e`/`%2E` occurrence with `.`, it
equals `.` or `..` — so mixed spellings such as `.%2e`, `%2e.` and `%2e%2e` are rejected too. Percent
decoding of a parameter *value* stays unaffected: only a whole segment is judged.

Where the runtime normalizes the request target before the framework can observe it, rejection is not
implementable at that layer. That platform limit SHALL be reported through the negotiated
request-target capability, documented per adapter, and reflected in the conformance expectation
(capability-driven) — it SHALL NOT be silently promised away as uniform behaviour.

#### Scenario: A literal parent-directory segment is rejected

- **WHEN** a request for `/api/webhooks/../admin` arrives
- **THEN** the response is 400 and no route handler or path-based middleware runs

#### Scenario: A percent-encoded dot segment is rejected

- **WHEN** a request for `/api/%2e%2e/admin` or `/api/%2E%2E%2Fadmin` arrives
- **THEN** the response is 400

#### Scenario: A double-encoded dot segment is rejected

- **WHEN** a request for `/api/%252e%252e/admin` arrives
- **THEN** the request is rejected or fails to match, and never resolves to `/admin`

#### Scenario: A mixed literal and encoded dot segment is rejected

- **WHEN** a request for `/api/.%2e/admin`, `/api/%2e./admin` or `/api/%2E%2e/admin` arrives
- **THEN** the response is 400

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

#### Scenario: A runtime that normalizes the target first reports the limitation

- **WHEN** a runtime normalizes the request target before the application observes it
- **THEN** its negotiated capabilities report that the raw request target is unavailable, the adapter
  documents the resulting limit, and the conformance suite asserts the documented outcome rather than
  a uniform 400

## ADDED Requirements

### Requirement: Path parameter and wildcard values preserve the request's original case

Values bound from the request path SHALL be extracted from the case-preserved request path, not from
the case-folded string used for matching. Matching SHALL remain case-insensitive by default, and
`ctx.path` SHALL remain the folded canonical matched path. Percent-decoding of a value SHALL NOT be
re-applied here, and a decoded value SHALL NOT be re-segmented.

#### Scenario: A case-sensitive identifier reaches the handler intact

- **WHEN** a case-insensitive router matches `/users/ABC123` against `/users/:id`
- **THEN** `ctx.params.id` is `ABC123` and `ctx.path` is `/users/abc123`

#### Scenario: A wildcard keeps its case and inner slashes

- **WHEN** a case-insensitive router matches `/files/Foo/Bar.TXT` against `/files/*`
- **THEN** `ctx.params['*']` is `Foo/Bar.TXT`

#### Scenario: Percent-encoded uppercase values decode without changing case

- **WHEN** a path parameter is percent-encoded and contains uppercase letters
- **THEN** the decoded value has the same letters and case the encoded form denoted

#### Scenario: Folding that changes a value's length does not shift later bindings

- **WHEN** a path contains a character whose lowercase form has a different length (for example `İ`)
- **THEN** every bound parameter and wildcard value is still correct, because positions and values come
  from the same structure

#### Scenario: A case-sensitive router is unaffected

- **WHEN** a router configured `caseSensitive: true` matches an uppercase path
- **THEN** parameters preserve their case exactly as before this change

#### Scenario: An all-lowercase path allocates no extra string

- **WHEN** a request path contains no uppercase and no non-ASCII uppercase character
- **THEN** the value path is the same string as the matched path, so no additional path string is
  allocated for the request

#### Scenario: A mounted router preserves case through the mount prefix

- **WHEN** a router is mounted at `/API` and a request for `/API/Users/ABC` matches `/Users/:name`
- **THEN** the bound value is `ABC`
