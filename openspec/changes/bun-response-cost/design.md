# Design

## Context

See `proposal.md` — Why. Two facts from source shape the approach:

- `WebResponseBuilder` owns the whole Web response state in four fields
  (`packages/runtime/src/response-builder.ts`): `_headers` (a `Headers` instance, allocated in the
  field initializer), `_status`, `_body`, `_responded`. `json()`, `html()`, `redirect()` and
  `send()` all write `Content-Type` into that instance, so the instance is never empty in practice.
- `getResponse()` passes the instance to `new Response(body, { status, headers })`. The platform then
  reads every entry out of it. For a hello-world response that is one entry.

Every consumer of `_headers` is a small, enumerable set: `json`, `send`, `html`, `redirect`, `set`,
and the HEAD `Content-Length` branch in `getResponse`. That bounded surface is what makes a lazy
record tractable without touching the public API.

## Goals / Non-Goals

**Goals**

- Remove the per-request header-record allocation from the common response (JSON/text with default
  headers) while keeping the built `Response` byte-identical.
- Answer, with a reproducible measurement, whether the record is the cost the Bun profile attributes
  to `Response`, and whether the platform JSON fast path is cheaper than a pre-serialized body.
- Leave a recorded verdict either way, so the question is not re-opened from intuition.

**Non-Goals**

- Changing `Response.json` versus pre-serialized `JSON.stringify`. Measured here, adopted only in a
  separate change if it wins — it interacts with the resolve-before-commit guarantee (below).
- Changing the Node adapter's response path, routing, middleware composition, or any public type.
- Optimizing `Set-Cookie` accumulation, which already needs a `Headers` instance.
- Re-opening the `inproc.nextrush.vs_hono` budget. The gate is evidence, not a target to move.

## Decisions

### D1 — The spike is a standalone allocation/latency harness, not an edit

A new child-process harness under `apps/benchmark/scripts/alloc/` (sibling of
`web-context-microtrims-alloc.js`) measures the construction variants in isolation, under both Bun
and Node, each in its own process:

| Variant | Construction |
| --- | --- |
| `current` | `new Headers()` + `set('Content-Type', …)` + `new Response(body, { status, headers })` |
| `literal` | `new Response(body, { status, headers: { 'Content-Type': … } })` |
| `shared-frozen` | one frozen literal reused across ops, passed as `headers` |
| `json` | `Response.json(value)` |
| `pre-serialized` | `new Response(JSON.stringify(value), { … })` |

The harness reports bytes-per-op (heap delta ÷ N under `--expose-gc`, the method the existing
allocation harnesses use) and a timing figure per variant. Timing is the secondary signal: the
adoption gate is the real `dev-check` ratio, not the microbenchmark.

*Alternative considered:* skip the spike and implement the lazy record directly, gating only on
`dev-check`. Rejected — the profile names `Response` at 18.7 % self, which includes the constructor,
the header copy, and the body write. Without the isolated comparison there is no way to tell a
header-record win from a constructor floor, and a null result would be indistinguishable from a
mis-attributed profile.

### D2 — The default `Content-Type` lives in a field, not in the header record

`_headers: Headers` is replaced by two fields:

- `_contentType: string | null` — the default or handler-set content type.
- `_headers: Headers | null` — materialised only by `set()` for a non-cookie header, or by a cookie
  write, or by the HEAD `Content-Length` branch.

`getResponse()` builds `new Response(body, { status, headers })` where `headers` is a plain literal
when `_headers` is `null` (zero or one entry), and the `Headers` instance otherwise. The literal is
the small, monomorphic shape the JIT can inline; the instance is only paid when the response
actually carries headers beyond `Content-Type`.

*Alternative considered:* keep `Headers` but allocate it lazily on first `set`. Rejected — `json()`
and `html()` set `Content-Type`, so the instance would still be allocated on every hot response; the
allocation moves, it does not disappear.

*Alternative considered:* a `Map<string, string>` record. Rejected — it allocates a map plus its
entry table for one entry, and it loses the platform's own header normalisation that `Headers`
performs for caller-supplied values.

### D3 — `send()`'s content-type probe reads both stores

`send()` currently asks `this._headers.has('Content-Type')` to decide whether to auto-detect. With
the split it asks `this._contentType !== null || (this._headers?.has('Content-Type') ?? false)`. The
same predicate covers `ctx.set('Content-Type', …)` before `send()`, which is the existing
"handler wins" behaviour and must not change.

### D4 — The HEAD `Content-Length` branch materialises the record

`getResponse()`'s HEAD branch reads `_headers.has('Content-Length')` and may write one. HEAD is not
the hot path, so that branch materialises the record when it needs it. No behaviour change: a HEAD
response still carries the length the equivalent GET would, and an already-set `Content-Length` is
still preserved.

### D5 — The JSON fast path is measured but not adopted here

`Response.json(value)` would move serialization inside the platform constructor. That conflicts with
the builder's stated guarantee that a value which cannot be serialized throws **before** the response
looks committed (`serializeJson`, see the module header), and it removes the string the builder uses
for `Content-Length` on HEAD. The spike measures it so the number is on record; adopting it requires
its own change with its own before/after contract. A win here does not license a behaviour change in
a performance change.

### D6 — The adoption gate is the same-run Bun ratio, with the spread measured first

`dev-check` already computes `inproc.nextrush.vs_hono` from a single run of both frameworks, so
machine noise cancels within a run. The gate is:

1. Measure the current tree three times, CPU-pinned, and record the spread of the ratio.
2. Apply the change; measure three times the same way.
3. Adopt only if the best-of-three ratio improves by more than the observed spread, and the absolute
   `inproc.nextrush.us` moves in the same direction.

The Node ratio stays ungated for the reason the previous change recorded: the two arms use different
request models, so a Node ratio near 0.08 would be a false pass. A null result is written into
RFC-039 §3.9 and the change is parked.

### D7 — One revertible commit

The builder change, its tests, and the harness are separate commits; the builder change is one commit
that reverts cleanly. If the gate fails, the commit is reverted rather than patched.

## Risks / Trade-offs

- **Header order changes** → `Content-Type` may now be written by the constructor from a literal
  rather than last into a `Headers` instance. No consumer may rely on order over HTTP/2, and the spec
  records that explicitly; the conformance suite asserts the header set, not its order.
- **Value normalisation differs for the default header** → `Headers` normalises values it is given;
  a literal passes our own constant through unchanged. The constant is already a well-formed
  `type/subtype; charset=utf-8`, so the emitted bytes are identical. A conformance scenario pins the
  exact string.
- **A caller sets `Content-Type` and then a cookie** → both stores exist; `getResponse` must merge
  the literal's entry into the instance. The merge is written once, in `getResponse`, and covered by
  a scenario with both a handler content type and two cookies.
- **The record is materialised twice** → guarded by a null check on every write path; the record
  identity is asserted in a unit test.
- **The profile's 18.7 % is mostly constructor, not headers** → this is a real possibility. The spike
  is designed to detect it (the `literal` and `shared-frozen` variants isolate the record from the
  constructor), and the gate fails closed: no measured win, no merge.

## Migration Plan

None. The builder is internal to `@nextrush/runtime`; no export, no `.d.ts`, no adapter contract
changes. Rollback is `git revert` of the single builder commit.

## Open Questions

- Whether the Bun win, if any, also appears on Deno and Edge. Those runtimes are covered by
  conformance but not by `dev-check`; their allocation harness result is recorded as evidence, not as
  an adoption gate, because no comparable in-process ratio exists for them.
