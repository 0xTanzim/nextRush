# Design

## Context

See `proposal.md` for motivation and `specs/runtime-adapter-contract/spec.md` for the behavior
contract. Current shape that constrains the approach:

- `WebResponseBuilder.json/send/html(data, status)` already take a concrete status
  (`packages/runtime/src/response-builder.ts:91,106,130`); the context methods pass the carried
  `ctx.status` (`packages/runtime/src/web-context-base.ts:271-283`). All Web adapters (Bun, Deno,
  Edge, serverless) share this builder.
- `NodeContext` has its own `json/send/html` that write `this.status` into the recorded outgoing
  response (`packages/adapters/node/src/context.ts:376-455`). `send()` delegates non-stream objects
  to `this.json(data)`, so ordering matters.
- `redirect(url, status = 302)` is the existing precedent for an optional trailing status argument.
- Body suppression is one shared predicate, `isBodylessResponse(method, status)`
  (`packages/runtime/src/header-guards.ts:93`), used by both the Web flush and the Node flush.
- The Web builder already rejects 1xx at construction time with a `RangeError`
  (`response-builder.ts:230`); Node's `writeHead` does not, so carried out-of-range statuses are
  already adapter-divergent today. Only the new argument is validated by this change.
- `@nextrush/adapter-node` already depends on `@nextrush/runtime`, so a shared validator can live in
  `runtime` without inverting the package hierarchy.
- Cross-adapter response scenarios live in `defineResponseConformance`
  (`packages/adapters/conformance/src/suite.ts:321`) and run through `registerScenario`.

## Goals / Non-Goals

**Goals:**
- One call expresses "this body, this status" with no separate assignment.
- The status a client receives is the status post-handler middleware reads.
- Identical accept/reject behavior and identical bytes on every adapter.
- No new allocation and no new branch on the request path.

**Non-Goals:**
- `ctx.status(code)` method form, `statusCode` accessor, or any breaking Context change.
- Validating or changing the carried `ctx.status` property assignment path.
- Unifying the last-resort error envelope in `web-runner.ts`.
- Changing `redirect()` (it already has the shape).

## Decisions

### D1 — Optional trailing parameter, not an options object

`json(data, status?)`, `html(content, status?)`, `send(body, status?)`.

Alternatives rejected: `ctx.json(data, { status })` (allocates an object per call, verbose, and
inconsistent with `redirect(url, status)`); a chained builder (`ctx.status(201).json(data)`) — that is
the breaking redesign this change deliberately excludes.

### D2 — Precedence: argument, then carried status, then 200

An explicit argument wins for that call only insofar as it overrides the carried value; omitting it
leaves today's semantics untouched. No new default constant is introduced — the 200 default stays
where it already lives, on `ctx.status`'s initializer.

### D3 — The explicit status persists into `ctx.status`

The helper assigns `ctx.status` before delegating, rather than passing a local override.

Rationale: the existing `runtime-adapter-contract` requirement "The outgoing response has a defined
view for middleware that runs after the handler" makes post-handler middleware read `ctx.status`.
A local-only override would make a logger report `200` while the wire says `201` — a silent
correctness bug in the observability layer, which is worse than the ergonomics gap being fixed.

Alternative rejected: pass the value only to the builder, leaving `ctx.status` untouched.

### D4 — Accept integers 200-599; reject everything else with `RangeError`

200-599 is the intersection of what every shipped adapter can answer (Web `Response` allows 200-599;
`writeHead` and Fetch disagree outside it) and it excludes informational statuses that cannot be a
final response.

Alternatives rejected: clamp silently (client gets an unexpected status, no signal);
accept 100-999 (Node would answer what Bun cannot — a parity failure); no validation (a late
`RangeError` from `Response` turns into a 500 after the handler already "sent").

Validation runs **before** any serialization or commit, so the application error handler can still
answer — the same ordering the JSON serialization guarantee already relies on.

### D5 — One validator in `@nextrush/runtime`, called from both context implementations

A single `assertResponseStatus(status)` helper in `packages/runtime/src` keeps the accept/reject rule
byte-identical for the Web builder path and `NodeContext`. `adapter-node` already depends on
`runtime`, so the dependency direction holds and no duplication is introduced.

Alternative rejected: validating inside `WebResponseBuilder` only — `NodeContext` would silently
diverge on the exact inputs this change exists to make predictable.

### D6 — Commit check happens before the status is assigned

A helper call on an already-committed response must change nothing — including `ctx.status`, which
post-handler middleware may already have read. The context method returns early on the existing
commit predicate (`responded` on the Web context, `isCommitted()` on Node) before assigning.

### D7 — No performance claim without measurement

The change adds one `status !== undefined` branch per helper call on the response path, and no
allocation. That is a hypothesis, not a result: no benchmark number is claimed in docs, PR text, or
the changelog. If a reviewer suspects a regression, the existing benchmark gate is the authority.

## Risks / Trade-offs

- **Node and Web diverge** (two implementations, one contract) → conformance scenarios are written
  first and must pass on every adapter; `NodeContext.send(obj, status)` gets a dedicated test because
  it delegates to `json()` internally.
- **A stream plus a bodyless status** (`send(stream, 204)`) → covered by an explicit scenario; the
  flush already suppresses the body, but the stream must not be left undrained or double-consumed.
- **Persisting the status surprises callers who expect a local override** → documented in
  `context.mdx` and asserted by the post-handler middleware scenario.
- **Invalid status throws inside a handler** → acceptable and consistent with the existing
  serialization-failure contract: the response stays uncommitted and the error handler answers.
- **`ctx.status = 400` typed values still bypass validation** → deliberate: changing that path is a
  behavior change outside this scope, and the intersection rule now documents where the parity
  boundary is.

## Migration Plan

Additive only: existing single-argument calls compile and behave identically, so this ships as a
minor release. Docs and migration tables are updated in the same change. Rollback is a plain revert —
no persisted state, no schema, no protocol change.

## Open Questions

- Exact `RangeError` wording (`ctx.json(data, 201)` / accepted range phrasing) can be settled during
  implementation; it does not affect the contract or the task breakdown.
