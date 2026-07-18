## Context

Post-P0–P3 state (verified current on `opt/core`):

- `packages/adapters/node/src/context.ts` — `readonly raw: NodeRawHttp` set in the constructor as
  `this.raw = { req, res }`. Internal response methods read `this.raw.res` (json/send/html/redirect/
  sendStream/signal) and `this.raw.req` (signal/getClientIp), so `raw` is touched on effectively
  every request from *inside* the Context — which is why a naive lazy getter would still allocate.
- `packages/router/src/matching.ts` — `findNode` is a **recursive** method-agnostic walker used only
  by `findAllowedMethods` (405/OPTIONS). `matchNodeIndexed` was already made iterative (P2), so the
  recursion (and its deep-path stack-overflow risk) survives only in `findNode`. No
  `Reflect.deleteProperty`/`Object.keys` remain anywhere in the router (HP-18 done).

## Goals / Non-Goals

**Goals:** allocate the `ctx.raw` wrapper only when read (HP-5); make the `findNode` walk iterative
so the 405/OPTIONS path can't stack-overflow and to cut traversal duplication (HP-17); guard the
HP-18 invariant. All behavior-preserving.

**Non-Goals:** the Web adapters' `raw`/`findNode` analogues (HP-5 is Node-specific; HP-17's DoS fix
already benefits all adapters since the router is shared); any public API/type change; forcing a
full `findNode`↔`matchNodeIndexed` merge (they differ — method-agnostic node lookup vs method-aware
handler match); the `caseSensitive` default.

## Decisions

**D1 — HP-5: private `_req`/`_res` fields + rewire internal uses + memoized lazy `raw`.** The only
way lazy `raw` actually saves an allocation is to stop the Context itself from reading `this.raw`.
So: add `private readonly _req` / `private readonly _res`, rewire **every** internal `this.raw.req`
/ `this.raw.res` to `this._req` / `this._res`, and replace the `raw` field with a memoized getter:
`get raw(): NodeRawHttp { return (this._raw ??= { req: this._req, res: this._res }); }`. The wrapper
is then built only if a caller reads `ctx.raw`, and memoized so repeated reads return the same
object (identity stable, matching today's single object). The touch surface is mechanical but
broad — every `this.raw.*` site must be found (grep + type-check) and converted; a single missed
site is the main risk.

**D2 — HP-5 is measurement-gated / park-able.** This is a P4 <1% trim with a broad touch surface.
It ships only if the allocation micro-bench confirms the wrapper is no longer allocated on a normal
(raw-unread) request AND the full adapter-node suite stays green. If the churn-to-benefit looks
poor in review, HP-5 is parked (the report already gated it "only if bundled into a Context
refactor") — HP-17 stands on its own regardless.

**D3 — HP-17: iterative `findNode`.** Rewrite `findNode` to walk with an explicit stack (same shape
as `matchNodeIndexed`'s frame walk) so a pathological deep path on the 405/OPTIONS path cannot
overflow the call stack — the same DoS class HP-11 closed for the match path. Preserve the exact
semantics: static > param > wildcard precedence, first-terminal-node wins, method-agnostic (returns
the node; `findAllowedMethods` then reads `node.handlers.keys()`). Reuse the existing scalar
segment-scan (`segmentAt`) to reduce duplication. A full merge with `matchNodeIndexed` is a
Non-Goal — they answer different questions (node vs method-specific handler); consolidation here is
"iterative + shared scan helper", not one function.

**D4 — HP-18: static regression guard, no code change.** Add a test asserting
`packages/router/src` contains no `Reflect.deleteProperty` and no `Object.keys(` in the match path,
so a future edit cannot silently reintroduce the deopt the P2 rewrite removed.

**D5 — Measurement.** HP-5 → allocation micro-bench (raw-unread request allocates no wrapper) +
`bench:validate` + adapter-node suite. HP-17 → a deep-path (many-segment) 405/OPTIONS test that
would stack-overflow the recursive form + a differential check that `findAllowedMethods` results
are identical across a corpus; it is off the throughput path, so no RPS A/B. No standalone RPS gain
claimed for either.

## Risks / Trade-offs

- **[Risk] HP-5 misses a `this.raw.*` reference**, leaving a broken response method or an
  unnecessary wrapper build. → **Mitigation:** grep every `this.raw.` site, convert all, and rely
  on the type-checker + the full adapter-node suite (response methods, streaming, ip) to catch a
  miss; ctx.raw identity/shape asserted by test.
- **[Risk] Memoized lazy `raw` changes `ctx.raw` identity semantics.** → **Mitigation:** memoize so
  repeated reads return the same object (as today's single wrapper); a test asserts `ctx.raw ===
  ctx.raw`.
- **[Risk] HP-17 iterative `findNode` drifts from the recursive semantics** (precedence /
  first-match). → **Mitigation:** a differential test runs a corpus through the old recursive and
  new iterative `findNode` (or asserts `findAllowedMethods` parity) and requires identical results;
  plus the deep-path no-overflow test.
- **[Risk / honest] Both are <1% / off-path — churn may exceed value, especially HP-5.** →
  **Mitigation:** D2 parks HP-5 on a poor churn/benefit read; HP-17's DoS-hardening justifies it on
  correctness grounds even with no RPS movement.

## Migration Plan

No runtime migration, no consumer-facing change — behavior-preserving, pinned by the scenarios.
Ship as two independent commits (HP-5 context refactor; HP-17 iterative `findNode`) plus the HP-18
guard test, each independently revertible. `ctx.raw`, `Router`, and matching public surfaces are
unchanged (snapshot-verified).

## Open Questions

- Is the `ctx.raw` allocation saving worth HP-5's touch surface? Decide from the micro-bench in
  review; park HP-5 if not.
- Worth a tiny sibling lazy-`raw` for the Web adapters later? Note, not gating this change.
