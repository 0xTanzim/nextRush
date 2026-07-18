## Context

After P0/P1/P2, the Node context's construction + response path still carries three small
per-request costs (verified current in `packages/adapters/node/src/context.ts`):

- Constructor: `if (questionIndex !== -1) { … } else { this.query = {}; }` — a fresh empty object
  per query-less request. `ctx.query` is declared `readonly query: QueryParams`.
- `json()`: `res.setHeader('Content-Type', …)` then `res.setHeader('Content-Length', …)` — two
  header-map writes.
- `set()`: `if (!Array.isArray(value) && field.toLowerCase() === 'set-cookie') { … }` — a
  `toLowerCase()` allocation on every header set, then the `assertHeaderSafe` CRLF guard.

All three are <1% individually; this is a polish batch, low risk, one cohesive Node-context change.

## Goals / Non-Goals

**Goals:** remove the empty-`query` allocation (HP-2), the double `setHeader` in `json()` (HP-14),
and the unconditional `toLowerCase()` in `set()` (HP-15), with byte-identical observable behavior.

**Non-Goals:** the Web adapters' `WebResponseBuilder`/`parseQueryString` analogues (optional small
follow-up — HP-14 is Node-specific anyway); any public API/type change; the `assertHeaderSafe`
guard (stays, runs every set); flipping any default.

## Decisions

**D1 — HP-2: shared frozen empty query, gated on the read-only contract.** Add a module-scope
`EMPTY_QUERY = Object.freeze(Object.create(null))` (mirroring `EMPTY_PARAMS`) and assign it for the
no-query branch. `ctx.query` is typed `readonly`, and query params are URL-parsed data, so the
read-only contract holds. **Caveat:** `readonly` prevents reassigning `ctx.query`, not mutating its
members — a frozen shared object also forbids `ctx.query.x = …`. If mutating `ctx.query` is a
supported/used pattern (checked against tests + usages before landing), **drop HP-2** or fall back
to a per-request `Object.create(null)` (cheaper than `{}`, still mutable). Default: shared frozen,
with `ctx.query` documented read-only.

**D2 — HP-14: single `writeHead` in `json()`, merge-safe.** Replace the two `setHeader` calls with
`res.writeHead(this.status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length':
String(byteLength) })` for the non-suppressed case, keeping the `_responded`/`headersSent` guard and
the `shouldSuppressBody()` (HEAD/204/304) branch. Node **merges** `writeHead` headers with any
already set via `setHeader()` (giving `writeHead` precedence), so:
- a middleware that set other headers via `ctx.set()` before `ctx.json()` keeps them;
- accumulated `Set-Cookie` (set via `ctx.set`) survives;
- a middleware-set `Content-Type` is overridden by `json()`'s — identical to today (today's
  `setHeader('Content-Type', …)` also overrides).
Measure carefully: `writeHead` vs `setHeader` behavior is Node-version-sensitive, so parity is
asserted against the harness before adopting. If any parity gap appears, revert HP-14 alone.

**D3 — HP-15: cheap set-cookie pre-check before `toLowerCase()`.** Gate the cookie branch behind a
constant-time pre-check — `field.length === 10` and a case-insensitive first-char test (e.g.
`(field.charCodeAt(0) | 0x20) === 0x73 /* 's' */`) — before falling back to the full
`field.toLowerCase() === 'set-cookie'`. This preserves case-insensitive detection of
`Set-Cookie`/`set-cookie`/`SET-COOKIE`/`sET-cOOKIE` while skipping the allocation for every
non-cookie header. `assertHeaderSafe(field, value)` is unchanged and still runs on every call.

**D4 — Measurement.** Each trim ships an allocation micro-bench delta + `bench:validate` parity +
a `bench:compare:quick` smoke. Honest: each is <1%, so no standalone RPS gain is claimed; the
deterministic allocation reduction + zero regression + byte-identical parity is the gate (the
per-change discipline established for this whole effort — quick + alloc-bench in the loop, the
publishable `standard`/`full` A/B is the one global deferred item).

## Risks / Trade-offs

- **[Risk] HP-2 breaks code that mutates `ctx.query`** (frozen shared object). → **Mitigation:**
  `readonly` typing + URL-parsed semantics support read-only; verify against tests/usages before
  landing; fall back to per-request `Object.create(null)` if a mutable query is supported. Drop
  HP-2 rather than change a real contract.
- **[Risk] HP-14 `writeHead` drops or reorders headers set earlier via `ctx.set()`** (incl.
  `Set-Cookie`). → **Mitigation:** Node's documented merge semantics keep them; explicit scenarios
  assert prior-`ctx.set` headers and accumulated `Set-Cookie` survive, plus 204/HEAD suppression;
  revert HP-14 alone on any parity gap.
- **[Risk] HP-15 pre-check misses a set-cookie casing** and breaks cookie accumulation. →
  **Mitigation:** scenarios for `Set-Cookie` / `set-cookie` / `SET-COOKIE` / mixed case all still
  detected; a non-cookie header (e.g. `Content-Type`) skips `toLowerCase`.
- **[Risk / honest] The batch's RPS effect is within noise (<1% each).** → **Mitigation:** gated
  on allocation reduction + parity + no regression, not on an RPS gain; it is explicitly a polish
  pass.

## Migration Plan

No runtime migration, no consumer-facing change — behavior-preserving, pinned by the scenarios.
Ship as scoped edits to `context.ts`; each trim is independently revertible (notably HP-2 and
HP-14, which carry the contract/Node-version caveats).

## Open Questions

- Is a mutable `ctx.query` a supported pattern anywhere in tests/usages? Resolve during
  implementation; decides whether HP-2 uses a shared frozen object or is dropped.
- Worth a small follow-up applying HP-15's pre-check to the shared `WebResponseBuilder.set()`
  (benefiting Bun/Deno/Edge)? Note, don't gate this change on it.
