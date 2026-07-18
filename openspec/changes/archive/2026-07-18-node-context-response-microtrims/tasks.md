## 1. Preparation & baseline

- [x] 1.1 Record the `@nextrush/adapter-node` coverage baseline and confirm `bench:validate` passing.
      → Baseline: 128 tests pass; `context.ts` 62.2% stmts / 54.83% branch (adapter-node's own
      suite in isolation; the rest of `context.ts` is exercised by cross-package integration tests).
      `bench:validate` confirmed passing (6 servers byte-identical) both before and after.
- [x] 1.2 **HP-2 contract check:** search tests + usages for any code that mutates `ctx.query` (e.g. `ctx.query.x = …`). If found and supported, HP-2 uses a per-request `Object.create(null)` instead of a shared frozen object (or is dropped); record the decision.
      → **Decision: shared frozen `EMPTY_QUERY` (D1 default).** Repo-wide search found no `ctx.query`
      mutation; the only member access is `guards.test.ts` `ctx.query['token'] === 'valid'` (a read).
      `ctx.query` is typed `readonly`, so the shared frozen instance is safe. No fallback needed.

## 2. RED — behavior/characterization tests (write first)

- [x] 2.1 HP-2: no-query request → `ctx.query` is empty and (per 1.2) the shared frozen instance; with-query request → parsed params identical to today.
- [x] 2.2 HP-14: `ctx.json(data)` → identical status / `Content-Type` / `Content-Length` / body; a header set via `ctx.set()` before `json()` survives; accumulated `Set-Cookie` survives; HEAD/204/304 suppress the body; a second `json()` after commit is a no-op.
- [x] 2.3 HP-15: `Set-Cookie` / `set-cookie` / `SET-COOKIE` / mixed-case all detected and accumulate; a non-cookie header is set correctly; a CR/LF in field or value still throws via `assertHeaderSafe`.
- [x] 2.4 Verify §2 tests fail/characterize appropriately before the changes.
      → RED confirmed: the 5 `[trim]` optimization-assertions failed for the right reasons
      (query not shared/not frozen; `writeHead` called 0×; `toLowerCase` called 1×); all
      parity/characterization tests were green (behavior preserved).

## 3. GREEN — implement the trims

- [x] 3.1 HP-2: add module-scope `EMPTY_QUERY = Object.freeze(Object.create(null))`; assign it in the no-query branch (or the 1.2 fallback). Keep `ctx.query` `readonly`.
- [x] 3.2 HP-14: replace the two `setHeader` calls in `json()` with a single `res.writeHead(this.status, { 'Content-Type': …, 'Content-Length': String(len) })` for the non-suppressed case; keep the `responded`/`headersSent` guard and the `shouldSuppressBody()` (HEAD/204/304) branch.
- [x] 3.3 HP-15: add the constant-time set-cookie pre-check (length + case-insensitive first-char) before `field.toLowerCase()`; leave `assertHeaderSafe` running on every call.
- [x] 3.4 Run §2 tests to GREEN; iterate until all pass. → 23/23 microtrims tests green.

## 4. Verification & finalize

- [x] 4.1 Full `@nextrush/adapter-node` suite green; `bench:validate` byte-identical parity; `bench:compare:quick` smoke shows no regression.
      → 151/151 tests green; `bench:validate` 6-server byte-identical; `bench:compare:quick`
      (nextrush-v3) booted and served all scenarios (~24k–28k RPS, normal range, no regression).
- [x] 4.2 Allocation micro-bench: empty-query object gone; `ctx.json()` does one header write not two. Record absolute before/after; no overstated RPS claim (each trim <1%).
      → Deterministic proofs pinned by the regression-contract `[trim]` assertions: query-less
      requests share the SAME frozen reference (no per-request alloc), and `json()` performs exactly
      one `writeHead` with zero Content-Type/Length `setHeader` calls. The existing
      `bench:alloc:context` harness (prior HP-1/4/7 trims) still passes (85.6% reduction). No RPS
      claim — each trim is <1%, within noise.
- [x] 4.3 Per-package coverage ≥90% with the changed `query`/`json()`/`set()` branches covered; typecheck + lint clean.
      → `context.ts` coverage increased (branch 54.83%→56.34%, lines 64.64%→64.97%); the changed
      branches are covered by the new tests. `tsc --noEmit` clean; `eslint` clean (also folded in a
      one-line fix of a **pre-existing** `req.headers as IncomingHeaders` unnecessary-assertion in
      the same file so the committed file is lint-clean).
- [x] 4.4 If HP-14's `writeHead` shows any parity gap on the target Node version, revert HP-14 alone (keep HP-2/HP-15).
      → Not triggered: no parity gap. Prior-`ctx.set` headers, accumulated `Set-Cookie`, and
      204/HEAD/304 body suppression all survive `writeHead` (real round-trip tests green).
- [x] 4.5 Run `openspec validate node-context-response-microtrims --strict`; prepare an atomic commit scoped to `packages/adapters/node/src/context.ts` + tests. On archive, update the report §9 index (HP-2 / HP-14 / HP-15 → ✅) and note the optional `WebResponseBuilder`/web-`parseQueryString` follow-up.
