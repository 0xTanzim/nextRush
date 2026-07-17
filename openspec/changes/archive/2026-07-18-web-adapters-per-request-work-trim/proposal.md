## Why

The Node P1 change (`node-adapter-per-request-work-trim`, archived) trimmed per-request work in
`@nextrush/adapter-node`. The Bun, Deno, and Edge adapters carry the **same behavior-preserving
shapes** and must stay behaviorally identical to Node (a NextRush hard rule), so the same trims
belong on them — the follow-up flagged in `report/node-adapter-per-request-work-trim-followup.md`.

Verified against source (`packages/adapters/{bun,deno,edge}/src/context.ts`):

- **HP-7** — all three have `async next() { if (this._next) await this._next(); }`, adding an
  async frame on top of the composer's dispatch thunk on every `ctx.next()`.
- **HP-1** — all three resolve `ctx.ip` eagerly through a runtime helper (`getClientIp` /
  `getEdgeClientIp`) that builds a per-request `webHeaderLookup` closure, even when `trustProxy`
  is false (the default), where the policy just returns the platform address.
- **HP-4 does NOT apply to the siblings.** Their context factories take `trustProxy` as a
  positional argument (`createBunContext(request, clientIp, trustProxy)`), not an options object,
  so there is no per-request `{ trustProxy }` object to hoist. (This corrects the follow-up
  report's "HP-4 equivalent" note.)

## What Changes

- **HP-1 — short-circuit `ctx.ip` when `trustProxy` is false, per adapter**, skipping the
  per-request header-lookup closure, with byte-identical values:
  - **Bun** — `trustProxy` false → `clientIp ?? ''` (Bun's `server.requestIP`); true → resolve via
    the shared policy.
  - **Deno** — `trustProxy` false → `connInfo.remoteAddr.hostname ?? ''`; true → shared policy.
  - **Edge** — `trustProxy` false → `''` (no socket); true → `getEdgeClientIp`, which **preserves
    the `cf-connecting-ip` → `x-forwarded-for` → `x-real-ip` precedence**.
- **HP-7 — forward the composer dispatch thunk from `ctx.next()` without the extra async frame**
  on all three (`return this._next ? this._next() : <cached resolved>`), matching Node's trim.
- **NOT HP-4** — no per-request options object exists in the siblings to hoist.
- Cross-adapter parity is the acceptance gate: the `packages/adapters/conformance` suite pins
  `ctx.ip` (trustProxy on/off, proxy-headers-ignored, Edge `cf-connecting-ip`) and `ctx.next()`
  (ordering / rejection / no-op) identically across all four adapters. Add a per-adapter
  allocation micro-bench (mirroring Node's `context-alloc`) as the deterministic gate.
- **BREAKING**: None. No public API/type changes; `ctx.ip` and `ctx.next()` observable behavior
  are byte-identical, pinned by the conformance suite as a regression contract.

## Capabilities

### New Capabilities

- `web-adapters-per-request-work-trim`: The requirement that the Web-platform adapters
  (`@nextrush/adapter-bun`, `-deno`, `-edge`) avoid the per-request `ctx.ip` lookup closure when
  proxies are not trusted, and the redundant `async` frame in `ctx.next()`, while guaranteeing
  `ctx.ip` and `ctx.next()` behavior stay byte-for-byte identical to today and identical across all
  four adapters — including the Edge `cf-connecting-ip` precedence when `trustProxy` is true.

### Modified Capabilities

- None. These are implementation-level per-request optimizations mirroring the archived
  `node-adapter-per-request-work-trim`; the observable Context behavior they preserve is captured
  by this new capability's scenarios, which serve as the cross-adapter regression contract.

## Impact

- **Affected code:** `packages/adapters/bun/src/context.ts`, `packages/adapters/deno/src/context.ts`,
  `packages/adapters/edge/src/context.ts` (the `ip` resolution in each constructor and each
  `next()` method). Their `adapter.ts` files are **not** affected (no options object to hoist).
- **Affected tests:** `packages/adapters/conformance` (cross-adapter `ctx.ip` / `ctx.next()`
  parity, incl. Edge `cf-connecting-ip`) and each adapter's own suite.
- **Performance harness:** `apps/benchmark` — a per-adapter allocation micro-bench; note the `wrk`
  RPS suite only drives the Node server, so RPS confirmation for the siblings is not in that suite
  (allocation + conformance are the gates).
- **Public API / types / dependencies:** none.
