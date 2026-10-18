# Proposal

## Why

Several independently validated defects sit on the same path — canonicalize → dispatch → build
context → commit response — and they share one cause: nothing in the test apparatus exercises that
path the way a real adapter does. Router unit tests call the public `match()` and never the dispatch
path; the conformance suite builds `Request` objects in-process and never a socket; response-aware
middleware is tested against mock contexts whose `body` is a response body. So the framework ships
request parameters lower-cased on every dispatched request, a request left unanswered when
serialization throws, a documented entry point that silently drops every route, a path-security
control that holds on one adapter only, an error contract that differs per JavaScript engine, and a
response model under which post-handler middleware is reliable on one adapter and a no-op on another
— while the Web request path pays roughly twice Hono's framework tax on every request, with no
committed budget to notice.

Fixing these one file at a time will not hold: each fix needs the verification that is missing today
(a dispatch-level test, a real-socket conformance case, a real-adapter middleware test, a committed
cost budget), or the same class of defect returns silently. The failures are all observable and all
reproducible in seconds, so the repair can be verified rather than argued.

## What Changes

**Request-path correctness (observable behaviour fixes)**

- Request parameters and wildcards SHALL preserve the case of the incoming target while matching
  stays case-insensitive. The canonicalizer gains a case-preserving `valuePath` used only for value
  extraction; `ctx.path` stays the folded, matched path. **BREAKING** — parameters that were folded
  today arrive folded no longer. Migration: none needed for correct code; a consumer that relied on
  folded values must fold them itself.
- `ctx.json()` / `ctx.send()` / response builders SHALL serialize before marking the response
  committed, so a serialization failure reaches the application error handler instead of hanging the
  socket (Node) or answering `200` with an empty body (Web). **BREAKING** — `ctx.json()` may now
  throw `TypeError` for a value it previously accepted and then failed to write.
- A request SHALL never be left unanswered: if the error path itself declines to respond, the
  framework supplies a minimal 500 rather than an empty or hanging response.
- Every public adapter entry point SHALL boot the application before it dispatches, so
  `createHandler(app)` routes without a manual `ready()`. **BREAKING** — an application `callback()`
  invoked before `ready()` while owning a router now throws an actionable error instead of silently
  serving an empty body.
- Dot segments SHALL be rejected in every percent-encoded spelling the framework can observe, and
  the platform limit (a runtime that normalizes the target before the framework sees it) SHALL be
  reported as a negotiated capability and documented, never silently promised away. **BREAKING** —
  encoded dot segments that used to match now return 400 where the raw target is observable.
- Client-error responses SHALL carry a truthful `code` (the error's own string code, or the status's
  code) instead of always `INTERNAL_ERROR`, and 5xx bodies are unchanged.
- Parse-failure messages SHALL be runtime-independent constants; the JS engine's parse text is kept
  only as a non-enumerable `cause` and never serialized.
- An unparsed request content type SHALL be decided by an explicit policy option, defaulting to
  today's silent acceptance, with `'reject'` (415) available and recommended for JSON APIs.

**Response contract (the structural gap behind the middleware failures)**

- A middleware that runs after the handler SHALL have one defined way to read the outgoing
  response. Until the recorded-response model lands (deferred, see below), response-aware middleware
  MUST NOT read the parsed *request* body as if it were the response, and MUST report honestly that
  no outgoing body is available. Affected middleware packages document that limitation, and a
  conformance scenario pins post-handler header behaviour across adapters.

**Web request-path cost**

- The incoming-header record, the client IP, and the handler timeout on the Web adapters SHALL be
  materialised when read rather than on every request, and the request path SHALL be derived without
  constructing a `URL`. One shared Web runner replaces the three duplicated copies so these land
  once instead of three times. Observable behaviour, including proxy-trust resolution, is unchanged;
  the accepted change is proven by allocation evidence, conformance, and a committed cost ratio that
  ratchets down.

**Verification the above depends on**

- A committed request-cost budget gate, with bug ids that expire in the same pull request that fixes
  the probe they cover, so each fix becomes a permanent regression guard.
- Conformance scenarios for behaviour only a real socket can observe, plus scenarios for
  dispatch-level parameter casing, serialization failure, and post-handler header writes.

## Capabilities

### New Capabilities

None. Every behaviour here is a change to requirements an existing capability already owns; this
change is cross-cutting by nature (router → runtime → adapter → middleware), not a new domain.

### Modified Capabilities

- `router`: canonicalization also emits a case-preserving value path; parameters and wildcards keep
  request case; dot-segment rejection covers encoded spellings and is reported per capability.
- `node-adapter`: `ctx.json()` serializes before it commits, so `responded` is accurate and a
  serialization failure is recoverable.
- `web-adapters`: incoming headers, client IP and the handler timeout are lazy; the request path is
  derived without `URL`; canonical-path and dot-segment parity become capability-driven.
- `runtime-adapter-contract`: every public entry point boots before dispatching; a request is never
  left unanswered; the outgoing response has a defined view for post-handler middleware.
- `runtime-capability-negotiation`: request-target preservation becomes a negotiated capability.
- `body-parser`: parse-failure messages are runtime-independent; an unparsed content type is decided
  by an explicit policy.
- `security-boundaries`: client-error responses carry a truthful, non-disclosing error code.
- `performance-gate`: a committed request-cost ratio gate whose probe-verified ids expire when fixed.
- `runtime-proof-harness`: conformance covers behaviour observable only over a real socket.

## Impact

- **Packages**: `@nextrush/router`, `@nextrush/runtime`, `@nextrush/core`, `@nextrush/adapter-node`,
  `@nextrush/adapter-bun`, `@nextrush/adapter-deno`, `@nextrush/adapter-edge`,
  `@nextrush/adapter-serverless`, `@nextrush/body-parser`, `@nextrush/compression`, `@nextrush/timer`,
  `@nextrush/errors`, `@nextrush/types`, `packages/adapters/conformance`, `apps/benchmark`.
- **Adapters**: the Web adapters gain one shared runner; three duplicated timeout/boot copies are
  deleted. Node's response-commit behaviour is unchanged until the deferred model lands.
- **Public surface**: one new body-parser option; one new capability flag; new errors thrown on
  previously-silent failure paths. No package is removed and no export is renamed.
- **Docs**: adapter pages, the security guide, and the affected package READMEs (including the
  compression limitation) are updated in the same change.
- **Not in scope**: the recorded-response model that would unify Node's and the Web adapters'
  response handling. It is a core contract change with its own measured basis, and it is deferred
  rather than half-shipped; the durable decision for it must land in `docs/RFC/` before this change
  is archived, and the same is true for the deferred compilation/`register`-time work this change
  deliberately does not attempt.
