## Context

Node's P1 trims (archived `node-adapter-per-request-work-trim`) removed the eager `ctx.ip` lookup
closure (when `trustProxy` is false) and the redundant `async` frame in `ctx.next()`. The three
Web-platform adapters carry the same shapes, verified against source:

- **Bun** (`packages/adapters/bun/src/context.ts`) —
  `this.ip = clientIp ? (trustProxy ? getClientIp(request, clientIp, true) : clientIp) : getClientIp(request, '', trustProxy)`;
  `async next() { if (this._next) await this._next(); }`.
- **Deno** (`packages/adapters/deno/src/context.ts`) —
  `const directIp = connInfo?.remoteAddr?.hostname ?? ''; this.ip = getClientIp(request, directIp, trustProxy)`;
  same `async next()`.
- **Edge** (`packages/adapters/edge/src/context.ts`) — `this.ip = getEdgeClientIp(request, trustProxy)`
  (no socket; `directIp` is `''`, and `cf-connecting-ip` is consulted first when trusted);
  same `async next()`.

`getClientIp` / `getEdgeClientIp` (`packages/runtime/src/headers.ts`) build a per-request
`webHeaderLookup` closure and, when `trustProxy` is false, simply return the platform `directIp`.
So the closure is wasted for the untrusted-proxy default. The context factories take `trustProxy`
**positionally**, so — unlike Node — there is no per-request options object (HP-4 is N/A).

## Goals / Non-Goals

**Goals:**

- Apply HP-1 (ip short-circuit when `trustProxy` false) and HP-7 (non-async `ctx.next()`) to Bun,
  Deno, and Edge, with byte-identical `ctx.ip` / `ctx.next()` behavior.
- Preserve the Edge `cf-connecting-ip` → `x-forwarded-for` → `x-real-ip` precedence for
  `trustProxy: true`.
- Keep `ctx.ip` / `ctx.next()` behavior identical across all four adapters (Node + the three),
  pinned by `packages/adapters/conformance`.

**Non-Goals:**

- **Not HP-4** — the siblings have no per-request options object to hoist.
- **Not** other Web-adapter per-request costs surfaced during verification — `new URL(request.url)`
  and unconditional `parseQueryString(...)` per request are real but are **separate findings**, not
  part of this Node-parity trim; do not expand scope.
- **Not** the `serverless` adapter — verify separately whether it shares the shape (Open Question).
- No public API/type change; no change to the adapters' `adapter.ts`.

## Decisions

**D1 — HP-1 short-circuit, per-adapter `directIp`, byte-identical values.** When `trustProxy` is
false, set `ctx.ip` to the platform address directly (skipping `getClientIp`/`getEdgeClientIp` and
its `webHeaderLookup` closure); when true, resolve through the shared policy exactly as today:

- **Bun:** `trustProxy ? getClientIp(request, clientIp ?? '', true) : (clientIp ?? '')`. This
  preserves all four of today's `clientIp × trustProxy` combinations byte-identically (today's
  `trustProxy:false` path already returns `clientIp` when present, and `''` via `getClientIp(...,'',false)`
  when absent).
- **Deno:** `const directIp = connInfo?.remoteAddr?.hostname ?? ''; trustProxy ? getClientIp(request, directIp, true) : directIp`.
- **Edge:** `trustProxy ? getEdgeClientIp(request, true) : ''` — Edge has no socket, so the untrusted
  value is `''`, identical to `getEdgeClientIp(request, false)` (which returns `directIp: ''`).

**D2 — Edge `cf-connecting-ip` precedence is preserved and explicitly tested.** The Cloudflare
precedence is only reachable through the `trustProxy: true` branch, which still calls
`getEdgeClientIp` unchanged. The `trustProxy: false` short-circuit never consults headers (matching
today). A conformance test pins `cf-connecting-ip` → `x-forwarded-for` → `x-real-ip` for
`trustProxy: true` on Edge.

**D3 — HP-7 identical to Node's trim.** Replace `async next()` with
`next(): Promise<void> { return this._next ? this._next() : <cached resolved promise>; }` on all
three. The dispatch thunk always returns a promise and never throws synchronously (composer
guarantee), so ordering, rejection propagation, and the `Promise<void>` contract are preserved;
the unwired branch returns a cached resolved promise (reuse the runtime's shared resolved promise
if one exists, else a per-adapter constant).

**D4 — HP-4 excluded, deliberately.** The context factories pass `trustProxy` positionally; there
is no per-request options object in the siblings, so there is nothing to hoist. This corrects the
follow-up report's "HP-4 equivalent" note and is recorded so a reader does not go looking for a
non-existent allocation.

**D5 — Cross-adapter parity is the acceptance gate.** `packages/adapters/conformance` pins
`ctx.ip` (trustProxy on/off, proxy-headers-ignored-when-untrusted, Edge `cf-connecting-ip`) and
`ctx.next()` (ordering / rejection / unwired no-op) so all four adapters behave identically.
"Identical" means the same resolution *policy* — the literal `ctx.ip` value still differs by
platform where no trusted header applies (Node/Deno have a socket address; Edge is `''`), because
`directIp` is platform-supplied.

**D6 — Bundle all three in one change.** The trim is mechanically identical across them, the
conformance suite already exercises all adapters together (one parity test pins all four at once),
and Edge's `cf-connecting-ip` is the sole special case — best reasoned about in one place. Chosen
over per-adapter changes, which add review overhead with no correctness benefit.

**D7 — Measurement leans on allocation + conformance, honestly.** The `wrk` RPS suite only drives
the Node server, so there is no per-adapter RPS number to A/B here. Acceptance is: a per-adapter
allocation micro-bench (mirroring Node's `context-alloc`) showing the lookup closure is gone when
`trustProxy` is false, plus the full conformance + per-adapter suites green. RPS for the siblings
is out of the current harness's reach and is not claimed.

## Risks / Trade-offs

- **[Risk] The Edge trim drops `cf-connecting-ip` when `trustProxy` is true.** → **Mitigation:**
  only the `trustProxy: false` path short-circuits; `trustProxy: true` still calls
  `getEdgeClientIp` unchanged; D2's conformance test asserts the precedence.
- **[Risk] Bun's `clientIp × trustProxy` matrix is mis-simplified** (it has four combinations
  today). → **Mitigation:** D1 preserves all four byte-identically; a test covers each
  (clientIp present/absent × trustProxy on/off).
- **[Risk] Cross-adapter drift** — one adapter trimmed differently from another. →
  **Mitigation:** the shared conformance suite must be green for all four; the trims are applied
  in one change so they can't diverge in review.
- **[Risk] HP-7 relies on `_next` always returning a promise.** → **Mitigation:** same composer
  guarantee Node relies on; conformance/unit tests for ordering, rejection, and the unwired no-op.
- **[Risk / honest] No sibling RPS measurement.** → **Mitigation:** D7 — the allocation
  micro-bench is the deterministic gate; no RPS gain is claimed for the siblings.

## Migration Plan

No runtime migration and no consumer-facing change — behavior-preserving, pinned by the
conformance regression contract. Ship as scoped edits to the three `context.ts` files; each
adapter's trim is independently revertible.

## Open Questions

- Does the `serverless` adapter share the same eager-ip / `async next()` shape (or does it wrap
  Edge/Node)? Verify; if it does, extend this change or file a further follow-up.
- Whether to reuse a single shared resolved-promise constant from `@nextrush/runtime` for the
  unwired `next()` branch across all adapters (including Node's `RESOLVED_NEXT`) — a small
  consolidation, left to implementation.
