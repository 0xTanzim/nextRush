## Context

Verified current source on `opt/core`:

- `packages/runtime/src/query.ts` — `parseQueryString` builds `Object.create(null)` and, for
  `!qs || qs.length > MAX_QUERY_LENGTH`, returns it immediately (before the parse loop). Bun/Deno/Edge
  contexts call it on every request; a query-less request gets a fresh throwaway object.
- `packages/runtime/src/response-builder.ts` — `WebResponseBuilder.set` runs `assertHeaderSafe`,
  then for a non-array value does `field.toLowerCase() === 'set-cookie'` unconditionally.
- `packages/adapters/{bun,deno,edge}/src/context.ts` — each constructor sets
  `this.raw = { req: request, res: undefined }`; `raw` is typed `readonly`; `this.raw.req` is read
  internally by the `signal` getter and `triggerTimeout`.
- `packages/runtime/src/body-source.ts` — `WebBodySource._buffer` already uses a `reader.read()`
  loop with incremental size enforcement + `arrayBuffer()` fast path (HP-16-web is a non-finding).

Cross-adapter behavior is enforced by `packages/adapters/conformance`.

## Goals / Non-Goals

**Goals:** remove the per-request empty-`query` allocation (HP-2-web), the unconditional
`toLowerCase()` in `WebResponseBuilder.set` (HP-15-web), and the eager `raw` wrapper in the three
Web contexts (HP-5-web) — byte-identical, cross-adapter-consistent.

**Non-Goals:** HP-16-web (already optimal); the Node adapter (shipped); the `assertHeaderSafe` guard
(stays, runs every set); any public API/type change; the Edge `cf-connecting-ip` IP precedence
(untouched — it lives in `getEdgeClientIp`, not on these paths).

## Decisions

**D1 — HP-2-web: shared frozen empty in `parseQueryString`.** Return a module-scope
`EMPTY_QUERY = Object.freeze(Object.create(null))` for both early-return branches (empty input and
over-limit reject), instead of the per-call object. **Safety:** the call graph shows the *only*
callers are the four adapter context constructors (Bun/Deno/Edge/Node), each assigning to `readonly
ctx.query`; none mutate the result (an over-limit reject also wants an empty map). A frozen shared
instance therefore changes no observable behavior and makes a would-be mutation fail loudly (a
correctness improvement, not a regression). The non-empty parse path still returns its own
`Object.create(null)` and is unchanged. No-op for Node (it short-circuits before calling).

**D2 — HP-15-web: cheap set-cookie pre-check.** Gate the cookie branch behind a constant-time
pre-check — `field.length === 10` and a case-insensitive first-char test
(`(field.charCodeAt(0) | 0x20) === 0x73 /* 's' */`) — before falling back to
`field.toLowerCase() === 'set-cookie'`. Preserves case-insensitive detection
(`Set-Cookie`/`set-cookie`/`SET-COOKIE`/mixed) and the append-accumulate behavior; the array-value
`delete`+`append` branch and `assertHeaderSafe` are untouched. Identical technique to Node HP-15, so
the two `set` implementations stay conceptually aligned.

**D3 — HP-5-web: per-adapter lazy memoized `raw`.** In each of Bun/Deno/Edge: add a private
`_req` field (set in the constructor), rewire the internal `this.raw.req` reads (the `signal` getter
and `triggerTimeout`) to `this._req`, and replace the `raw` field with
`get raw() { return (this._raw ??= { req: this._req, res: undefined }); }`. `res` is always
`undefined` on the Web adapters, so the shape is preserved exactly; memoization keeps `ctx.raw`
identity stable across reads. Applied identically to all three so conformance stays green. The touch
surface per adapter is small (constructor + two internal reads).

**D4 — HP-16-web: no change.** `WebBodySource._buffer` is already the fast reader-loop pattern;
documented as a non-finding so a future reader doesn't re-open it.

**D5 — Measurement.** Reuse `apps/benchmark/scripts/web-context-alloc.js` for the allocation deltas
(no empty-`query` object, no eager `raw` wrapper on a raw-unread request) + `bench:validate` parity
+ the conformance suite. Honest: each trim is <1%, so acceptance rests on deterministic allocation
reduction + byte-identical parity + cross-adapter conformance, not an RPS A/B.

## Risks / Trade-offs

- **[Risk] HP-2-web shared frozen object is mutated by some caller.** → **Mitigation:** call graph
  confirms only the four context constructors call it, all assigning to `readonly ctx.query`; a
  frozen instance turns any future mutation into a loud failure rather than silent shared-state
  corruption. If a mutating caller is ever introduced, it must use its own object — the contract is
  read-only.
- **[Risk] HP-15-web pre-check misses a set-cookie casing** → cookie stops accumulating. →
  **Mitigation:** scenarios assert `Set-Cookie`/`set-cookie`/`SET-COOKIE`/mixed all still detected
  and appended; a non-cookie header skips `toLowerCase`.
- **[Risk] HP-5-web misses a `this.raw.req` reference** in one adapter, or diverges between the
  three. → **Mitigation:** rewire every `this.raw.` site per adapter (type-checker + suite), assert
  `ctx.raw` shape/identity and that `ctx.signal`/timeout still work, and lean on the conformance
  suite to catch cross-adapter drift.
- **[Risk / honest] The batch's RPS effect is within noise (<1% each), and it's explicitly
  optional.** → **Mitigation:** gated on allocation reduction + parity + conformance, not RPS; it is
  a parity/polish pass. Any trim whose churn looks unjustified in review can be parked
  independently.

## Migration Plan

No runtime migration, no consumer-facing change — behavior-preserving, pinned by the scenarios and
the conformance suite. Ship as independent commits (HP-2-web runtime; HP-15-web runtime; HP-5-web
per adapter) so each is revertible.

## Open Questions

- None blocking. A later consolidation of the three near-identical Web-context `raw` refactors into
  a shared helper is possible but out of scope (the contexts are deliberately per-adapter classes).
