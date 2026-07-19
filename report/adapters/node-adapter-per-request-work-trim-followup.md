# Follow-up: per-request-work trims for Bun / Deno / Edge adapters

**Source change:** `node-adapter-per-request-work-trim` (hot-path review P1, Node-only).
**Status:** ✅ **DONE** — shipped as `web-adapters-per-request-work-trim` (Bun/Deno/Edge).
Originally a **Non-Goal** of the source change, deliberately scoped out to keep that change
measurable against the one adapter the benchmark suite actually exercises.

## Resolution (web-adapters-per-request-work-trim)

- **HP-1 + HP-7 applied** to `packages/adapters/{bun,deno,edge}/src/context.ts`, byte-identical
  `ctx.ip` / `ctx.next()` behavior, pinned by new per-adapter
  `__tests__/per-request-work-trim.test.ts` and by extended `packages/adapters/conformance`
  (cross-adapter `ctx.ip` trust/precedence + `ctx.next()` ordering/rejection/no-op, plus the Edge
  `cf-connecting-ip` precedence gated on a new `honorsCloudflareIp` driver capability).
- **HP-4 does NOT apply to the siblings** (correction to the "HP-4 equivalent" note below): their
  context factories take `trustProxy` **positionally** (`createBunContext(request, clientIp,
  trustProxy)`, etc.), so there is no per-request `{ trustProxy }` options object to hoist.
- **`serverless` shares no independent shape** — it wraps the Edge fetch engine
  (`createEdgeFetchHandler`), so the Edge trim covers it transitively; no separate change or
  follow-up needed (the Open Question below is resolved).
- **Allocation gate (design D7):** `apps/benchmark/scripts/web-context-alloc.js`
  (`pnpm bench:alloc:web`) — legacy 56.1 B/req → trimmed 8.1 B/req on the isolated removed-work
  path, 48.0 B/req removed per request, CV ~0%, for each of bun/deno/edge. Reported as absolute
  before/after bytes, not overstated as a total-request-allocation percentage. No sibling RPS
  claim is made (the `wrk` suite drives only the Node server).

## What was done (Node)

Three behavior-preserving per-request-work trims landed in `@nextrush/adapter-node`:

- **HP-1** — `ctx.ip` short-circuits to the socket address when `trustProxy` is false (the
  default), skipping the per-request header-lookup closure and the `resolveClientIp` policy call.
- **HP-4** — the `{ trustProxy }` context-options object is hoisted into `createHandler`'s
  closure (frozen, reused) instead of being allocated per request.
- **HP-7** — `ctx.next()` forwards the composer's dispatch thunk directly instead of wrapping it
  in an extra `async` frame; the unwired branch returns a cached resolved promise.

Deterministic allocation micro-bench (`apps/benchmark/scripts/context-alloc.js`): **~85.6%**
per-request allocation reduction on the isolated trimmed vs. pre-trim path, CV 0%.

## What the siblings carry (analogous shapes)

The Bun, Deno, and Edge adapters carry the same three shapes and would benefit identically:

- `packages/adapters/bun/src/context.ts` — eager IP resolution + `async next()`.
- `packages/adapters/deno/src/context.ts` — eager IP resolution + `async next()`.
- `packages/adapters/edge/src/context.ts` — eager IP resolution (via `getEdgeClientIp`) +
  `async next()`; note the edge IP path also consults `cf-connecting-ip`, so the HP-1
  short-circuit there must preserve the Cloudflare precedence when `trustProxy` is true.
- The per-adapter `createHandler`/context-factory options object (HP-4 equivalent).

## Constraints for the follow-up

- `ctx.ip` and `ctx.next()` observable behavior must stay **identical across all adapters**
  (NextRush hard rule) — the `packages/adapters/conformance` suites must remain green.
- Same TDD treatment: characterization pins for behavior + optimization-assertion tests per trim.
- HP-1 on Edge must keep the `cf-connecting-ip` → `x-forwarded-for` → `x-real-ip` precedence for
  `trustProxy: true`; only the `trustProxy: false` fast path is a direct `directIp` return.

## Open question (from the source proposal) — RESOLVED

Bundle all three siblings into one follow-up change, or one change per adapter? **Resolved:**
bundled into one change (`web-adapters-per-request-work-trim`, design D6) — the trim is
mechanically identical across them and the conformance suite pins all four adapters together.
The separate serverless question is also resolved: it wraps Edge, so no independent work applies.
