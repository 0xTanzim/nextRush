## Why

The optional web-adapter (Bun/Deno/Edge) siblings of the shipped Node trims, from
`report/core-hot-path-performance-review.md` §7. Each was verified against real source before
scoping — one candidate turned out to already be optimal and is dropped:

- **HP-2-web** — the shared `parseQueryString` (`packages/runtime/src/query.ts`) returns a fresh
  `Object.create(null)` for the empty/over-limit early-return, and the three Web contexts call it on
  **every** request (`parseQueryString(urlObj.search.slice(1))`), so a query-less request allocates
  a throwaway object. (Node already short-circuits with a shared `EMPTY_QUERY`, HP-2 P3.)
- **HP-15-web** — the shared `WebResponseBuilder.set` (`packages/runtime/src/response-builder.ts`)
  calls `field.toLowerCase()` on **every** header set to detect `set-cookie`, allocating a
  lowercased string even for non-cookie headers (the Node sibling was HP-15 P3).
- **HP-5-web** — `BunContext` / `DenoContext` / `EdgeContext` each eagerly build
  `this.raw = { req: request, res: undefined }` per request, though almost no handler reads
  `ctx.raw` (the Node sibling was HP-5 P4).
- **HP-16-web — DROPPED (non-finding).** `WebBodySource._buffer`
  (`packages/runtime/src/body-source.ts`) already reads via a `reader.read()` loop with incremental
  size enforcement and an `arrayBuffer()` fast path — it is **not** the slow `for await…of` pattern
  HP-16 removed on Node. There is nothing to rewrite.

Each remaining trim is <1% (a polish/parity pass, not a throughput mover); grouped because HP-2/HP-15
are single shared-runtime edits benefiting all three Web adapters, and HP-5 is the matching
per-adapter refactor.

## What Changes

- **HP-2-web** — `parseQueryString` returns a module-scope shared frozen empty query object for its
  empty/over-limit early-returns instead of a fresh object. **Safe:** the only callers are the four
  adapter context constructors (Bun/Deno/Edge/Node), each assigning the result to `readonly
  ctx.query`; none mutate it (verified via call graph). No-op for Node (it never reaches
  `parseQueryString` on the empty path). The non-empty parse path is unchanged.
- **HP-15-web** — gate the `set-cookie` detection in `WebResponseBuilder.set` behind a cheap
  pre-check (length + case-insensitive first char) so `toLowerCase()` runs only when the field could
  be `set-cookie`. `assertHeaderSafe` (CRLF guard) and the array-value delete+append branch are
  unchanged; `Set-Cookie` still accumulates case-insensitively.
- **HP-5-web** — in each of Bun/Deno/Edge contexts, hold `req` in a private field and expose `raw`
  via a memoized lazy getter, rewiring the internal `this.raw.req` uses (the `signal` getter and
  `triggerTimeout`) to the field, so the `{ req, res: undefined }` wrapper is built only when a
  caller reads `ctx.raw`. Shape and identity of `ctx.raw` are preserved.
- **HP-16-web** — no change (documented non-finding above).
- **BREAKING**: None. `ctx.query`, `ctx.set`/`Set-Cookie` accumulation, the CRLF guard, and
  `ctx.raw` observable behavior are preserved across all three Web adapters, pinned by the spec's
  scenarios and the cross-adapter conformance suite.

## Capabilities

### New Capabilities

- `web-adapters-context-response-microtrims`: The requirement that the Web-adapter path avoid the
  per-request empty-`query` allocation (shared frozen object in `parseQueryString`), the
  unconditional `toLowerCase()` in `WebResponseBuilder.set` (gated behind a cheap pre-check), and
  the eager `{ req, res }` wrapper in the Bun/Deno/Edge contexts (lazy memoized `raw`), while
  keeping `ctx.query`, header/`Set-Cookie` behavior, the CRLF guard, and `ctx.raw` byte-identical
  and cross-adapter-consistent.

### Modified Capabilities

- None. These mirror, on the Web adapters, the behavior already preserved by the Node changes; the
  observable Context behavior is captured by the new capability's scenarios as the regression
  contract, and cross-adapter parity is enforced by `packages/adapters/conformance`.

## Impact

- **Affected code:** `packages/runtime/src/query.ts` (HP-2-web — shared frozen empty),
  `packages/runtime/src/response-builder.ts` (HP-15-web — set-cookie pre-check),
  `packages/adapters/{bun,deno,edge}/src/context.ts` (HP-5-web — lazy `raw` + rewired `this.raw.req`).
- **Affected tests:** `packages/runtime/src/__tests__/` (parseQueryString empty-identity + non-empty
  parity; WebResponseBuilder set-cookie casings + non-cookie skip + CRLF guard),
  `packages/adapters/{bun,deno,edge}/src/__tests__/` (ctx.raw identity/lazy; signal/timeout still
  work), and `packages/adapters/conformance` (cross-adapter parity unchanged).
- **Not in scope:** HP-16-web (non-finding); the Node adapter (its siblings already shipped); any
  public API/type change.
- **Performance harness:** `apps/benchmark` — the existing `scripts/web-context-alloc.js`
  allocation micro-bench (empty query + raw wrapper) + `bench:validate` parity. No standalone RPS
  gain claimed (each trim <1%).
- **Public API / types / dependencies:** none.
