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

| Variant          | Construction                                                                           |
| ---------------- | -------------------------------------------------------------------------------------- |
| `current`        | `new Headers()` + `set('Content-Type', …)` + `new Response(body, { status, headers })` |
| `literal`        | `new Response(body, { status, headers: { 'Content-Type': … } })`                       |
| `shared-frozen`  | one frozen literal reused across ops, passed as `headers`                              |
| `pairs`          | a fresh `[name, value]` sequence per response                                          |
| `json`           | `Response.json(value)`                                                                 |
| `pre-serialized` | `new Response(JSON.stringify(value), { … })`                                           |

The harness reports bytes-per-op (heap delta ÷ N under `--expose-gc`, the method the existing
allocation harnesses use) and a timing figure per variant. Timing is the secondary signal: the
adoption gate is the real `dev-check` ratio, not the microbenchmark.

_Alternative considered:_ skip the spike and implement the lazy record directly, gating only on
`dev-check`. Rejected — the profile names `Response` at 18.7 % self, which includes the constructor,
the header copy, and the body write. Without the isolated comparison there is no way to tell a
header-record win from a constructor floor, and a null result would be indistinguishable from a
mis-attributed profile.

**`pairs` was added during the spike, not planned.** The `cookies` shape has two `Set-Cookie`
values, and both runtimes silently join a repeated field supplied through an object literal:
`{'Set-Cookie': ['a', 'b']}` becomes the single header `a,b`. That makes `literal`,
`shared-frozen` and `pre-serialized` output-*in*equivalent for any response with repeated fields,
so measuring them there would compare different bytes. The harness therefore skips those variants
for that shape, and the parent runs a `verify-output` child that compares status, `Content-Type`,
`Set-Cookie` values and body across every variant × shape. `pairs` exists because it is the only
non-`Headers` form that preserves repeated fields, which makes it the only candidate that could
replace `Headers` unconditionally. The equivalence check also caught that `Response.json` defaults
to a different `Content-Type` on each runtime (Node `application/json`, Bun
`application/json;charset=utf-8`, builder `application/json; charset=utf-8`), so the `json` variant
passes it explicitly.

### D2 — The default `Content-Type` lives in a field, not in the header record

`_headers: Headers` is replaced by two fields:

- `_contentType: string | null` — the default or handler-set content type.
- `_headers: Headers | null` — materialised only by `set()` for a non-cookie header, or by a cookie
  write, or by the HEAD `Content-Length` branch.

`getResponse()` builds `new Response(body, { status, headers })` where `headers` is a plain literal
when `_headers` is `null` (zero or one entry), and the `Headers` instance otherwise. The literal is
the small, monomorphic shape the JIT can inline; the instance is only paid when the response
actually carries headers beyond `Content-Type`.

_Alternative considered:_ keep `Headers` but allocate it lazily on first `set`. Rejected — `json()`
and `html()` set `Content-Type`, so the instance would still be allocated on every hot response; the
allocation moves, it does not disappear.

_Alternative considered:_ a `Map<string, string>` record. Rejected — it allocates a map plus its
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

### D8 — Spike verdict: the record is a Node win, a small Bun win, and D2's literal is a Bun regression

Measured 2026-10-19, `--runs 3 --n 20000`, both runtimes, all three shapes. Bytes allocated per
response, mean ± stddev. Full JSON in `apps/benchmark/results/response-construction-alloc-{bun,node}-*`.

| Runtime | Shape       | `current`     | `pairs`             | `literal`           | `shared-frozen`     | `json` |
| ------- | ----------- | ------------- | ------------------- | ------------------- | ------------------- | ------ |
| Bun     | `default`   | 355.1 ± 1.4   | **344.2 (−10.9)**   | 367.3 (+12.2)       | 391.5 (+36.4)       | 344.2  |
| Bun     | `one-extra` | 316.5 ± 1.2   | **291.9 (−24.6)**   | 325.8 (+9.3)        | 391.8 (+75.3)       | 288.1  |
| Bun     | `cookies`   | 309.8 ± 2.9   | **264.4 (−45.4)**   | skipped             | skipped             | 263.2  |
| Node    | `default`   | 2733.8 ± 8.4  | 2861.1 (+127.3)     | **2552.5 (−181.3)** | **2524.8 (−209.0)** | 3406.7 |
| Node    | `one-extra` | 2981.6 ± 14.8 | **2418.8 (−562.8)** | 2689.9 (−291.7)     | 2560.0 (−421.6)     | 3420.2 |
| Node    | `cookies`   | 3387.9 ± 1.8  | 3498.7 (+110.8)     | skipped             | skipped             | 4407.6 |

Four findings, and the fourth invalidates D2 as written:

1. **On Node the header record is a large, real cost** — 181–422 B per response, far more than a
   `Headers` instance should weigh, which suggests Node's `Headers` carries per-instance setup
   beyond its entries.
2. **On Bun the same change is worth only 11–45 B per response**, roughly 3–15 % of the ~310–355 B
   Bun spends per response. It clears the spread and the effect floor, so it is real, but small. The
   change is a Node optimisation that is merely non-negative on Bun — the opposite of what the Bun
   profile suggested, which is why the spike existed.
3. **No single construction wins on both runtimes.** `pairs` wins every Bun shape and Node
   `one-extra`, but loses Node `default` (+127 B) and Node `cookies` (+111 B). `literal` and
   `shared-frozen` win Node `default` and lose Bun `default`. Any implementation must therefore pick
   per-shape, not per-runtime — branching on runtime identity is forbidden by the portability rule.
4. **D2's chosen construction is wrong for Bun.** D2 proposes a plain object literal when only the
   default `Content-Type` is present. On Bun that literal allocates **more** than the `Headers`
   instance it replaces (+12 B, and +36 B for the frozen form), reproduced across three independent
   runs. Implementing D2 as written would make the hot Bun path slower while the gate watches Bun.

The spike therefore does not license a general "replace `Headers` with a literal" rewrite, and it
does not confirm D2's specific replacement. What the data supports is narrower: the only
construction that is non-negative on both runtimes for the default case is `pairs`
(−10.9 B Bun, +127 B Node) — which is not a win, only a smaller loss on one side. D2 needs revision
before task 3 is implemented.

The Node figures are also a reminder that this harness measures one response in isolation; the
`current` column includes the `Response` constructor, so the deltas are the header record's share of
it, not the whole `Response` cost the profile attributed. The 18.7 % `Response` self-time is
therefore mostly constructor and body write, not the header record.

### D9 — Bun gate baseline, and why the gate cannot resolve this change

Task 2.1's baseline, `dev-check inproc --rt bun`, pinned to one core, three consecutive runs on the
tree before any builder change:

| Run | `inproc.nextrush.us` | `inproc.hono.us` | `inproc.nextrush.vs_hono` |
| --- | -------------------- | ---------------- | ------------------------- |
| 1   | 3.298 µs             | 2.85 µs          | 1.16                      |
| 2   | 3.420 µs             | 2.85 µs          | 1.20                      |
| 3   | 3.480 µs             | 2.94 µs          | 1.18                      |

Median `nextrush.us` 3.420 µs (range 0.182 µs, 5.3 %). Median ratio 1.18, **spread 0.04**.

The gate's resolution is therefore ±0.04 on the ratio, i.e. about ±3.4 % of request time. The
effect the change could produce on Bun is far below that:

- The best Bun allocation delta measured in D8 is 10.9 B/response (`pairs`, `default`), against
  ~355 B of total allocation for the response — about 3 % of the response's own allocation.
- Response construction is 18.7 % of request self-time (the profile in the proposal), so 3 % of it
  is ≈0.56 % of the request.
- 0.56 % of a 1.18 ratio is ≈0.007.

The expected effect (0.007) is roughly **six times smaller** than the gate's spread (0.04). The gate
cannot distinguish this change from machine noise, so per task 2.2 it must not be used to justify
implementation.

The timing measurement agrees, and independently argues against the change. Re-running the
allocation child five times on Bun `default`, `pairs` allocates consistently less (345 B vs 355 B)
while being consistently **slower** (median 1295 ns vs 968 ns, slower in 4 of 5 runs). Saving ~11 B
of allocation did not save time on Bun; it cost time. Bun's allocator is fast enough that a smaller
transient allocation is not a win, and the `pairs` form trades the `Headers` constructor for a
JS-built array of arrays.

### D10 — Verdict: park the change without touching the builder

D8 and D9 together satisfy the spec's negative branch, not its positive one:

- The Bun win is real but small (11–45 B of ~310–355 B per response).
- It does not reach wall-clock time — the cheaper-allocation variant is slower.
- The Bun gate that would authorise adoption cannot resolve an effect this size (0.007 vs 0.04).
- No single construction wins on both runtimes, and D2's specific choice is a Bun _regression_.

The spec requires that "a null or negative result MUST be recorded and the change parked rather than
merged", so the response builder is left exactly as it is. No implementation task runs, and there is
no builder commit to revert. The harness and this analysis are the deliverable: they establish that
the last framework-attributable cost RFC-039 named is mostly the `Response` constructor and body
write, not the header record, and that the record is worth optimising on Node but not on Bun.

The Node finding is recorded as a lead, not a task: on Node the record costs 181–422 B per response,
but Node's `inproc` ratio stays ungated by design, so there is no gate to authorise that work either.
Reopening it would need its own measurement question — whether the Node allocation delta reaches Node
request time — which this change deliberately does not answer.

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
