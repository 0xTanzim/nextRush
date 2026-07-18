## Why

The final P4 tier of the hot-path review (`report/core-hot-path-performance-review.md`) — cleanup,
closing out the roadmap. Two findings remain; the third is already resolved:

- **HP-18 — already done.** Its only targets were the backtrack `Reflect.deleteProperty` and the
  `Object.keys` post-match loop in the router matcher; the P2 rewrite
  (`router-match-path-allocation-trim`) replaced that with an iterative, deferred-bind walk, so
  there is **zero** `Reflect.deleteProperty`/`Object.keys` left in `packages/router/src`. This
  change documents that and adds a regression guard — no new work.
- **HP-5** — `NodeContext` still allocates a `this.raw = { req, res }` wrapper object on every
  request, even though almost no handler reads `ctx.raw` (handlers use `ctx.json`/`ctx.body`/etc.).
- **HP-17** — `findNode` (`packages/router/src/matching.ts`) is still **recursive** and is the
  walker used by `findAllowedMethods` (the 405/OPTIONS path). It duplicates traversal with the now
  iterative `matchNodeIndexed`, and — more importantly — it carries the **same deep-path
  stack-overflow risk** that HP-11 fixed for `matchNodeIndexed`, on the allowed-methods path. So
  HP-17 is not purely cosmetic: it closes a residual DoS the P2 rewrite left on the 405 path.

Both are low-impact on throughput (P4), landed as separate, independently-revertible commits.

## What Changes

- **HP-5 — lazy `ctx.raw`.** Store `req`/`res` as private fields and rewire every internal
  `this.raw.req` / `this.raw.res` reference (in `json`/`send`/`html`/`redirect`/`signal`/
  `sendStream`/`getClientIp`/etc.) to those fields; expose `raw` via a **memoized lazy getter** so
  the `{ req, res }` wrapper is built only if a caller actually reads `ctx.raw`. `ctx.raw` returns
  the identical `{ req, res }` shape. (Measurement-gated: if the allocation micro-bench shows the
  saving does not justify the touch-surface, HP-5 is parked — see design.)
- **HP-17 — iterative `findNode`.** Rewrite `findNode` to walk with an explicit stack (mirroring
  `matchNodeIndexed`) so a pathological segment count on the 405/OPTIONS path cannot overflow the
  call stack, and share the segment-scan helper to cut the traversal duplication.
  `findAllowedMethods` results stay byte-identical.
- **HP-18 — no code change**; add a regression guard asserting the router hot path contains no
  `Reflect.deleteProperty`/`Object.keys` post-match loop, so a future edit cannot silently
  reintroduce them.
- **BREAKING**: None. `ctx.raw`, `findAllowedMethods`, and all matching/response behavior are
  preserved and pinned by the spec's scenarios.

## Capabilities

### New Capabilities

- `router-context-final-cleanup`: The requirement that (a) `ctx.raw` be built lazily so the
  per-request `{ req, res }` wrapper is allocated only when read, with identical shape and identical
  behavior of every response method that used it; (b) the `findNode` walk used by
  `findAllowedMethods` be iterative so the 405/OPTIONS path cannot stack-overflow on deep paths,
  with byte-identical allowed-methods results; and (c) the router hot path remain free of the
  backtrack `Reflect.deleteProperty` / `Object.keys` post-loop (HP-18 regression guard).

### Modified Capabilities

- None. HP-5 is a Node-context implementation refactor; HP-17 is a router-traversal refactor; both
  preserve observable behavior, captured by the new capability's scenarios as the regression
  contract. The HP-18 guard defends the invariant `router-match-path-allocation-trim` already
  established.

## Impact

- **Affected code:** `packages/adapters/node/src/context.ts` (HP-5 — `_req`/`_res` fields, rewired
  internal `raw` uses, lazy `raw` getter) and `packages/router/src/matching.ts` (HP-17 — iterative
  `findNode`).
- **Affected tests:** `packages/adapters/node/src/__tests__/` (ctx.raw identity + lazy; every
  response method still works) and `packages/router/src/__tests__/` (findAllowedMethods parity +
  deep-path no-overflow; an HP-18 static guard test).
- **Cross-adapter note:** HP-5 is Node-specific (the Web adapters store `raw` as `{ req, res:
  undefined }` and differ); a sibling lazy-raw is an optional tiny follow-up, out of scope. HP-17
  is in shared `@nextrush/router`, so its DoS fix benefits every adapter's 405/OPTIONS path.
- **Performance harness:** `apps/benchmark` — an allocation micro-bench for the `ctx.raw` save
  (HP-5) + `bench:validate` parity; HP-17 is off the throughput path (405/OPTIONS), gated on tests
  + a deep-path no-overflow test rather than an RPS A/B. No standalone RPS gain claimed.
- **Public API / types / dependencies:** none.
