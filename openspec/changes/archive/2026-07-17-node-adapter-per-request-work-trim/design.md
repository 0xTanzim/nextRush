## Context

Following P0 (the single-middleware `compose()` fast path, archived), the hot-path review's P1
tier targets per-request work in the **Node adapter** that does not affect observable behavior:

- `packages/adapters/node/src/context.ts` — the `NodeContext` constructor calls
  `this.ip = this.getClientIp(req, trustProxy)`, and `getClientIp` allocates a
  `(name) => req.headers[name]…` closure and calls `resolveClientIp` **every request**. When
  `trustProxy` is false (`packages/runtime/src/headers.ts`), `resolveClientIp` short-circuits to
  `return directIp` — so the closure and the call are wasted for the common case, and `ctx.ip` is
  computed even though most handlers never read it.
- `packages/adapters/node/src/adapter.ts` — `createHandler`'s returned per-request function does
  `createNodeContext(req, res, { trustProxy })`, allocating a `{ trustProxy }` object per request
  though `trustProxy` is constant.
- `packages/adapters/node/src/context.ts` — `async next() { if (this._next) await this._next(); }`
  adds an extra async frame on top of the dispatch thunk the composer already built.

Each is small; all three fire on the universal request path. The constraint (as with P0) is that
`ctx.ip` and `ctx.next()` have observable contracts that must not change.

## Goals / Non-Goals

**Goals:**

- Remove the eager `ctx.ip` lookup closure for the common (`trustProxy: false`) case, the
  per-request options object, and the redundant `ctx.next()` async frame.
- Guarantee `ctx.ip` and `ctx.next()` observable behavior is **byte-for-byte identical** to today,
  under `trustProxy` on and off, and cross-adapter.
- Gate acceptance on an allocation micro-bench + `bench:validate` parity + a `--profile full` A/B.

**Non-Goals:**

- **Not** applying the same trims to the Bun/Deno/Edge adapters yet — they carry analogous shapes,
  but scoping this change to the benchmarked Node adapter keeps it measurable; the siblings are a
  tracked follow-up (their behavioral-parity suites must stay green in the meantime).
- **Not** the shared-empty-`query` object (HP-2, tier P3) — it depends on confirming `ctx.query` is
  read-only by contract; separate change.
- **Not** any other audit finding, no public API/type change, no `createNodeContext` signature
  change.

## Decisions

**D1 — HP-1: short-circuit `ctx.ip` when proxies are not trusted, over a lazy getter.**
When `trustProxy` is false, set `ctx.ip` directly from the eagerly-read socket address
(`req.socket.remoteAddress ?? ''`) — no closure, no `resolveClientIp` call. When `trustProxy` is
true, resolve via the shared `resolveClientIp` policy exactly as today. This yields the identical
`ctx.ip` value (today's `trustProxy:false` path already returns `directIp`) with zero laziness
complexity. Chosen over a lazy `get ip()` getter because a getter risks reading
`req.socket.remoteAddress` after socket close and adds accessor complexity for a value that is one
cheap string read; the socket address is captured eagerly so the value is always stable. The
proxy-trusting path is rarer and more likely to read `ctx.ip`, so keeping it eager is fine.

**D2 — HP-4: hoist the constant `{ trustProxy }` object into `createHandler`'s closure.**
Build it once and reuse it across requests. Verified safe: the `NodeContext` constructor only
reads `options.trustProxy ?? false` and neither retains nor mutates the object. Freeze the shared
object to make accidental mutation impossible. Chosen over changing `createNodeContext` to a
positional `trustProxy` argument, which would alter an exported factory signature covered by the
adapter-contract conformance guard (unnecessary churn for the same win).

**D3 — HP-7: forward the dispatch thunk from `ctx.next()` without an async frame.**
Replace `async next() { if (this._next) await this._next(); }` with a direct forward:
`next(): Promise<void> { return this._next ? this._next() : <resolved promise>; }`. `this._next`
is the composer's dispatch thunk, which **always returns a promise and never throws
synchronously** (the composer converts sync throws to `Promise.reject`) — so returning it directly
preserves ordering, rejection propagation, and timing without the extra wrapper frame. The
unwired case (`_next` null) returns a resolved promise, matching today's
`if (this._next) await …` no-op. Consider a cached resolved promise for the unwired branch
(mirroring the router's `NOOP_NEXT`) to avoid a `Promise.resolve()` allocation there; minor, left
to implementation.

**D4 — Cross-adapter behavior stays identical; siblings are a follow-up.**
`ctx.ip` and `ctx.next()` must behave identically on every adapter (a NextRush hard rule). This
change is Node-only, so the existing cross-adapter behavioral/conformance suites must still pass
unchanged; the Bun/Deno/Edge equivalents of these three trims are a separate follow-up so this
change stays scoped to the adapter the benchmark actually measures.

**D5 — Measurement-gated, with honest expectations.**
Each trim is individually sub-1% RPS; the combined effect is small and may sit within single-run
noise. Acceptance therefore leans on the **deterministic allocation micro-bench** (documenting the
removed closure/object/frame per request, low CV) plus `bench:validate` parity and a `--profile
full` A/B showing no regression. Unlike a risky rewrite, these are correctness-neutral cleanups
with a clear allocation reduction, so "no RPS movement beyond noise but a measured allocation drop
and zero regressions" is an acceptable outcome here — the allocation evidence is the primary gate,
RPS the confirmation. (This is a slightly softer bar than P0's D6, justified because the blast
radius and risk are lower and the change removes garbage even if RPS is flat.)

## Risks / Trade-offs

- **[Risk] HP-1 changes `ctx.ip` in a `trustProxy: false` edge case** (e.g. a request carrying
  `x-forwarded-for` that today is *ignored* because proxies aren't trusted). → **Mitigation:**
  today's `trustProxy:false` path returns the socket IP regardless of proxy headers; the
  short-circuit does exactly that. A parity test asserts `ctx.ip` equals the socket address even
  when untrusted proxy headers are present, and equals the resolved header value when
  `trustProxy` is true.
- **[Risk] `ctx.ip` read after socket close returns undefined** (only if made lazy). →
  **Mitigation:** D1 captures the socket address eagerly, so the value is stable; no laziness on
  the value itself.
- **[Risk] HP-7 non-async `next()` alters error or ordering semantics.** → **Mitigation:** D3
  relies on `_next` always returning a promise (composer-guaranteed); parity tests cover
  `await next()` ordering, rejection propagation from the thunk, the unwired no-op, and
  not-awaiting behavior.
- **[Risk] The hoisted options object is retained/mutated by the constructor.** →
  **Mitigation:** audited — constructor only reads `options.trustProxy`; the shared object is
  frozen; a concurrency test confirms two requests observe the same `trustProxy`.
- **[Risk / honest] Combined RPS gain is within single-run noise.** → **Mitigation:** D5's
  allocation micro-bench is the deterministic primary gate; the `--profile full` A/B confirms no
  regression; the change is accepted on the allocation evidence even if RPS is flat.
- **[Risk] Touching the universal request path regresses something.** → **Mitigation:** full
  `@nextrush/adapter-node` suite + adapter integration + coverage ≥90% with the changed branches
  covered.

## Migration Plan

No runtime migration and no consumer-facing change — behavior-preserving by construction, with the
capability scenarios as the regression contract. Ship as scoped edits to `context.ts` +
`adapter.ts` behind the test matrix and the benchmark gate; each of the three trims is
independently revertible.

## Open Questions

- Timing of the Bun/Deno/Edge sibling trims (same three shapes) — bundle into one follow-up change
  or per-adapter? Deferred; not gating this change.
- Whether to cache a shared resolved promise for the unwired `ctx.next()` branch — left to
  implementation; trivial either way.
