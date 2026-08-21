## Context

This change implements the first deliverable of RFC-035 (`docs/RFC/ecosystem-interop/035-express-bridge.md`): the `@nextrush/express-bridge` package. The RFC is the source of truth for architecture; this design records the *implementation-shaping* decisions and the package-local constraints, and points back to the RFC for the full rationale. See `proposal.md` for the "why".

Relevant existing contracts (verified against source):

- `Middleware = (ctx, next) => void | Promise<void>` and `Next = () => Promise<void>` (`packages/types/src/context.ts`).
- `compose()` adopts thenables, wraps non-`Error` throws, and rejects a second `next()` with `'next() called multiple times'` (`packages/core/src/middleware.ts`).
- Node adapter exposes `ctx.raw = { req: IncomingMessage, res: ServerResponse }`; Web adapters expose `ctx.raw = { req: Request, res: undefined }` (`packages/adapters/node/src/context.ts`, `packages/runtime/src/web-context-base.ts`).
- `ctx.state` is a plain lazily-allocated `{}` (not `Object.create(null)`), so ad-hoc key projection needs a proto denylist.
- `assertHeaderSafe` is a public `@nextrush/runtime` export (`packages/runtime/src/index.ts`).
- `markResponded()` exists on `NodeContext` but is **not** on the `Context` interface.

## Goals / Non-Goals

**Goals:**

- A `compat(fn)` that returns a `Middleware` and translates Express/Connect 3-arity continuation/terminal/error behavior into `compose()` without forking it.
- A four-bucket Proxy over the *real* Node `req`/`res` (no clones) so streams, abort, identity, and `on`/`writeHead`/`socket` keep working for packages like `morgan`.
- Fail-closed, actionable errors and a sealed one-function public surface.
- Zero unused-path cost (import-graph + no-execution-path), with the alloc harness as verification only.

**Non-Goals:**

- No Express/Connect/Nest framework emulation, no 4-arity error middleware, no `express-session`, no streaming/proxy claims, no Edge portability, no `@nextrush/compat-core` extraction.
- No `Context`/`RuntimeCapabilities`/`compose()`/`Application.use` changes.

## Decisions

### D1 — Four-bucket Proxy over the real Node pair (not an allow-list, not a clone)

The `req`/`res` handed to foreign middleware are per-request `Proxy` objects whose target is the real `IncomingMessage`/`ServerResponse`. Gets/sets route through four buckets in order:

1. **Express overlay** — the candidate surface tables (status/`set`/`json`/`send`/`body`/`query`/etc.).
2. **Known-unsupported Express prototypes** — throw `UnsupportedExpressApiError`.
3. **Node HTTP pass-through** — forward to the target (`on`/`pipe`/`socket`/`writeHead`).
4. **Ad-hoc app state** — `ctx.state` with a proto denylist.

*Why:* an allow-list would trap `res.writeHead`, `res.on`, `req.socket`, and `req.pipe`, which real packages (including `morgan` via `on-finished`) use. A clone loses streams, abort, `===` identity, and allocates per request.

*Alternatives rejected:* plain cloned objects (§10 of RFC); a frozen adapter object as the default (kept only as a spike-gated fallback if a named v1 package observably breaks on `Proxy`).

### D2 — `writeHead` uses a captured `origWriteHead`

At Proxy creation, capture `origWriteHead = target.writeHead`. `[[Get]]` of `writeHead` returns an own assigned function if present, else an assert-wrap that parses Node overloads, runs `assertHeaderSafe` on each non-`undefined` header, and calls `origWriteHead.apply(this, args)` — never `target.writeHead(...)` at call time. `[[Set]]`/`defineProperty` of `writeHead` passes through.

*Why:* `on-headers` does `const orig = res.writeHead; res.writeHead = function wrap(...) { ...; return orig.apply(res, arguments); }`. Looking up current `target.writeHead` at call time recurses (Node `end()` → own wrap → orig assert-wrap → current own wrap → …). Capturing at creation breaks the cycle.

### D3 — Continuation is a state machine, not a thin wrapper

A per-request `continuation.ts` owns `expressNext`. States: `idle` → `continued` / `terminated` / `error` / `protocolError`. The locked order: (1) if not idle, warn+no-op (never throw, never double-settle); (2) else if argument is `'route'`/`'router'`, throw `UnsupportedExpressApiError`; (3) else `next()`/`next(err)`.

*Why:* Express `next` is `void`; a second call must not produce a second rejection of an already-in-flight promise. `next('route')` after a first continuation must not throw (a throw would reject an in-flight promise). The normative continuation table in RFC-035 §8.6 is the contract.

### D4 — Thenable vs callback-style hang split

A thenable-returning middleware that fulfills while still `idle` with no committed response **fails closed** (`ExpressBridgeProtocolError`). A non-thenable return with no `next()`/response is **Express callback continuation** and is *not* microtask-failed.

*Why:* `async (req, res, next) => { await work; }` with no `next()` is the Express 5 footgun and should not hang silently. But the dominant Connect/Express pattern (Passport, `setImmediate`) returns `undefined` and calls `next()` later from I/O; failing that on a microtask would break the ecosystem we're trying to reach.

### D5 — Ad-hoc `req.<key>` is `ctx.state` with last-write-wins

`req.user = user` writes `ctx.state.user` (via `Object.defineProperty` after a denylist check); reads mirror it. Collision with a NextRush `ctx.state` key is a shared reference with last-write-wins. `__proto__`/`prototype`/`constructor` are denylisted. `res.locals` is a per-request `Object.create(null)`, not `ctx.state`.

*Why:* this is what makes Passport's `req.user` visible downstream without adding a `user` field to `Context`. Last-write-wins is documented, not accidental.

### D6 — Cookie serializer is bridge-local and Express-shaped

`res.cookie` uses an internal serializer (no `cookie` npm dep) with Express defaults, millisecond `maxAge` → second `Max-Age`, `signed: true` → trap, always `ctx.set('Set-Cookie', string)`. It never calls `ctx.cookies.set`.

*Why:* NextRush `CookieOptions.maxAge` is seconds and `httpOnly`/`secure`/`sameSite` default to `true`/`'auto'`/`'lax'`; passing Express options through would silently shorten cookies by 1000× and emit attributes the foreign middleware never asked for.

### D7 — Gate ducks `ctx.raw`, not `ctx.runtime`

`gate.ts` structurally checks `req.on`, `res.setHeader`, `res.end`, `typeof res.headersSent === 'boolean'`. It never reads `ctx.runtime`.

*Why:* AGENTS.md §7 requires behavior decided by negotiated capabilities, not runtime identity. A future Bun/Deno Node-compat `ctx.raw` would pass the same shape check.

### D8 — `markResponded` via duck-call, not a `Context` change

After an Express function settles, if `res.headersSent && !ctx.responded`, duck-call `markResponded()` when present on the concrete context. Do not add `markResponded` to the `Context` interface.

*Why:* a raw `res.end()` leaves `ctx.responded === false`, which would make `compose`'s double-response warning and after-hooks see the wrong state. Adding the method to `Context` is a core-type change this RFC explicitly forbids; the duck-call is a contained, documented coupling to `NodeContext`'s existing method.

### D9 — `assertHeaderSafe` stays in `@nextrush/runtime`

The bridge imports `assertHeaderSafe` from `@nextrush/runtime` (a downward dependency: `interop → runtime`). It does not relocate the primitive.

*Why:* `assertHeaderSafe` is already the canonical shared header-safety primitive consumed by `NodeContext.set` and the Web adapters, and `@nextrush/runtime` is a public export. Relocating it would be a breaking, cross-cutting move with no second consumer to justify it yet (RFC-035 §8.9).

## Risks / Trade-offs

- **`markResponded` duck-call is a hidden coupling to `NodeContext`** → Contained and documented; it is runtime-structural, so the P1 `gate.test.ts`/integration coverage must keep it under test (the import-graph oracle cannot see it).
- **Callback-style hang** (a strategy that never calls back) waits until adapter/server timeout → documented limitation, not a v1 timer; noted in docs-site limitations on day one.
- **Proxy traps break a popular package's `IncomingMessage` identity/enumerability** → P1 spike against the v1 matrix; fallback frozen adapter object without changing `compat()`.
- **Bridged parser + native parser consume the body twice** → documented `Unsupported`; development warning where `bodySource.consumed` and `req.body` are both observable.
- **Registry rot** (`Full` cell, red test) → a test fails the build if a `Full` claim has no integration test.
- **Security bugs in foreign packages attributed to NextRush** → registry + docs make clear the foreign package is the user's dependency; the bridge is a contract adapter, not a CVE scan.

## Open Questions

None that change the specs, the approach, or the task breakdown. The genuinely spike-gated items (exact overlay set, Proxy vs frozen object, streaming need, Bun/Deno probe, `res.locals` vs `ctx.state`) are already listed in RFC-035 §18 with defaults, and resolve within P0/P1 without changing this design's shape.
