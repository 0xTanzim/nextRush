## Context

After `body-parser-limit-and-hot-path-fixes`, a clean pinned run puts NextRush POST-JSON at
~19,070 rps — within ~2.6–2.9% of Fastify (19,634) / Hono (19,582), and ~23% behind raw Node
(24,888). Two residual items:

- **BP-K:** `NodeBodySource.buffer()`'s streaming-breach handler calls `req.destroy()`, which
  resets the socket before the framework's `413` can flush — clients see `ECONNRESET`. The
  synchronous `Content-Length` pre-check path is fine (rejects before reading). Small per-parser
  limits (enabled by BP-A) make the streaming path common, so this is now a real defect. Observed
  directly in the round-1 conformance test, which had to use the pre-check path to avoid it.
- **Structural POST overhead:** the ~23% gap to raw is per-request async layering on the read plus,
  dominantly, `JSON.stringify` response encoding. Fastify's edge on POST is `fast-json-stringify`
  (schema-compiled), not body parsing.

## Goals / Non-Goals

**Goals:**
- A chunked over-limit body returns a clean `413`, not a transport reset (T2/BP-K), with memory
  still bounded near the limit and cross-adapter parity.
- Remove one async frame from the POST read path *if measurably beneficial* (T3a).
- Produce RFC 018 defining an opt-in compiled response serializer (T3b) — the biggest remaining
  POST lever — without implementing it before the architecture is approved.

**Non-Goals:**
- Implementing the compiled serializer in this change (gated on RFC 018).
- Converting body parsing to streaming, or changing the buffering default.
- Chasing the raw-Node number on POST at the cost of API clarity.

## Decisions

### D1 — BP-K: stop consuming + close, don't reset (T2)
On a mid-stream breach, `NodeBodySource.buffer()` SHALL reject with `BodyTooLargeError` and stop
consuming the request (`req.pause()` + detach the `data` listener) rather than `req.destroy()`
immediately. The adapter's error-response path, when the request body was not fully consumed,
SHALL set `Connection: close` and `res.end()` the `413`; Node then flushes the response and closes
the socket, discarding the unread request remainder. This delivers a well-formed `413` while still
bounding memory (no further chunks are buffered after the breach).

*Alternatives rejected:* (a) keep `req.destroy()` but write the response first — `buffer()` has no
`res` handle, and coupling it to the response breaks the layer boundary; (b) fully drain the
oversized body before responding — wastes bandwidth/CPU on a request already known to be rejected.

### D2 — T3a: collapse `readBody` + `readBodyFromSource`, measurement-gated
Merge the two-function indirection in `reader.ts` into one async function so the POST read path
allocates one fewer async frame. Behavior-identical (same pre-check, `buffer(limit)`, post-check,
error mapping). **Accept only if an allocation micro-bench + a pinned POST-JSON A/B show a
measurable, non-noise improvement**; otherwise revert and keep the clearer two-function form. This
respects "never add complexity without measurable benefit."

### D3 — T3b: compiled response serialization behind RFC 018
The opt-in serializer is the real POST lever but is a new public API and cross-adapter, so it is
RFC-gated. RFC 018 must choose among: (a) a small in-house schema→serializer compiler (zero-dep,
most work); (b) reuse the existing Standard Schema integration (`@nextrush/validation`) to derive
a serializer; (c) an optional `@nextrush/serializer` package wrapping a vetted compiler (keeps
core zero-dep). The RFC also decides whether this is a new `response-serialization` capability or an
enhancement to `node-adapter`'s response emission. No serializer code lands before the RFC.

## Risks / Trade-offs

- **BP-K half-read socket handling** → Mitigation: set `Connection: close` on the error response so
  Node deterministically closes after flush; conformance test asserts `413` (not reset) on every
  adapter; a test also asserts memory stays bounded (no full-body buffering).
- **T3a may be within noise** → Mitigation: it is explicitly revert-if-neutral; the frame count is
  small, so no regret if dropped.
- **T3b scope creep** → Mitigation: hard RFC gate; this change ships T2 (+ maybe T3a) and the RFC
  document only.

## Migration Plan

Additive. The only behavior change is `ECONNRESET → 413` on chunked over-limit bodies (strictly an
improvement). No consumer migration. T3b, if it lands later, is opt-in per route.

## Open Questions

- Should `Connection: close` be set only for the unconsumed-body error case, or for all `413`s?
  (Lean: only when the request body was not fully read, to avoid needlessly closing keep-alive
  connections on pre-check rejections.)
- Does T3b belong in `node-adapter` (+ web parity) or a new `response-serialization` capability?
  Deferred to RFC 018.
