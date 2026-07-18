## Why

The P3 tier of the hot-path review (`report/core-hot-path-performance-review.md`) — the small,
bankable leftovers on the Node context's construction + response path, after P0/P1/P2 shipped:

- **HP-2** — `NodeContext` allocates a fresh empty `query` object (`this.query = {}`) on every
  request that has no query string (the common case), where a shared frozen empty object would do
  (mirroring the existing `EMPTY_PARAMS` pattern). `ctx.query` is already typed `readonly`.
- **HP-14** — `ctx.json()` issues **two** separate `res.setHeader()` calls (Content-Type +
  Content-Length) where a single `res.writeHead(status, headers)` touches the outgoing-header map
  once.
- **HP-15** — `ctx.set()` calls `field.toLowerCase()` on **every** header set (to detect
  `set-cookie`), allocating a lowercased string even for the 99% of headers that are not cookies.

Each is individually **<1%** and the batch is honestly a polish pass, not a throughput mover — the
meaningful RPS opportunity was already captured by P0/P1/P2. Grouped into one cohesive, low-risk
Node-context change.

## What Changes

- **HP-2** — return a shared frozen empty query object for the no-query case instead of a fresh
  `{}`. Safe because `ctx.query` is `readonly` and holds URL-parsed data; the frozen shared
  instance matches the `EMPTY_PARAMS` precedent. (If a mutable `ctx.query` turns out to be a
  supported pattern, HP-2 is dropped — see design.)
- **HP-14** — set the Content-Type + Content-Length + status via a single `res.writeHead()` in
  `ctx.json()`, preserving byte-identical output. Node merges `writeHead` headers with any
  previously `setHeader()`-ed headers (giving `writeHead` precedence), so headers a middleware set
  via `ctx.set()` before `ctx.json()` — including accumulated `Set-Cookie` — still survive.
- **HP-15** — gate the `set-cookie` detection in `ctx.set()` behind a cheap pre-check (length +
  first-char / char-code) so `field.toLowerCase()` runs only when the field could be `set-cookie`;
  real `Set-Cookie`/`set-cookie`/`SET-COOKIE` are still detected case-insensitively.
- The security-relevant `assertHeaderSafe` CRLF guard in `ctx.set()` is **unchanged** (it must
  keep running on every set).
- **BREAKING**: None. `ctx.query`, `ctx.json()`, and `ctx.set()` observable behavior — response
  bytes, headers (incl. Content-Type/Length and Set-Cookie accumulation), and the CRLF guard — are
  preserved, pinned by the spec's scenarios.

## Capabilities

### New Capabilities

- `node-context-response-microtrims`: The requirement that `@nextrush/adapter-node` avoid the
  per-request empty-`query` allocation (shared frozen object), the double `setHeader` in
  `ctx.json()` (single `writeHead`), and the unconditional `toLowerCase()` in `ctx.set()` (gated
  behind a cheap pre-check) — while guaranteeing `ctx.query`, response output, header behavior
  (including `Set-Cookie` accumulation and prior-`ctx.set` headers surviving `writeHead`), and the
  CRLF safety guard stay byte-identical to today.

### Modified Capabilities

- None. These are implementation-level Node-context micro-optimizations; the observable Context
  behavior they preserve is captured by the new capability's scenarios as the regression contract.

## Impact

- **Affected code:** `packages/adapters/node/src/context.ts` — the `NodeContext` constructor
  (`query`), `json()` (writeHead), and `set()` (set-cookie pre-check). A shared frozen empty-query
  constant is added at module scope (like `EMPTY_PARAMS`).
- **Affected tests:** `packages/adapters/node/src/__tests__/` — query identity/read-only, `json()`
  header/body parity (incl. prior-`ctx.set` headers and `Set-Cookie` surviving `writeHead`,
  204/HEAD suppression), and `ctx.set()` set-cookie detection across casings + CRLF guard intact.
- **Cross-adapter note:** HP-14 is Node-specific (`writeHead` vs the Web adapters' `Response`
  object). HP-15's set-cookie pre-check has an analogue in the shared `WebResponseBuilder.set()`
  (`@nextrush/runtime`, used by Bun/Deno/Edge) and HP-2 has one in the Web adapters' always-called
  `parseQueryString` — both are small optional **follow-ups**, out of scope here to keep this
  change focused and low-risk.
- **Performance harness:** `apps/benchmark` — allocation micro-bench deltas (empty query, header
  writes) + `bench:validate` parity; `bench:compare:quick` smoke. No standalone RPS gain claimed
  (each trim is <1%).
- **Public API / types / dependencies:** none.
