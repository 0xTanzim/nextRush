## 1. Preparation & baseline

- [x] 1.1 Record runtime + bun/deno/edge coverage baselines; confirm `packages/adapters/conformance` and `bench:validate` passing.
- [x] 1.2 Enumerate every `this.raw.req` site in each of `bun`/`deno`/`edge` `context.ts` (type-check) — the HP-5-web conversion checklist per adapter (expected: the `signal` getter + `triggerTimeout`).

## 2. HP-2-web — shared frozen empty query (runtime)

- [x] 2.1 RED: `parseQueryString('')` returns the shared frozen empty object (identity-stable across calls); `parseQueryString(overLimit)` returns the same shared empty; a non-empty query returns its own parsed object (not the shared instance) with unchanged values.
- [x] 2.2 GREEN: add module-scope `EMPTY_QUERY = Object.freeze(Object.create(null))`; return it from both early-return branches. Leave the parse loop untouched.
- [x] 2.3 Bun/Deno/Edge query-less request → `ctx.query` is empty (via the shared object); Node unaffected (short-circuits before calling). Commit.

## 3. HP-15-web — set-cookie pre-check (runtime)

- [x] 3.1 RED: `Set-Cookie`/`set-cookie`/`SET-COOKIE`/mixed-case all detected and accumulate; a non-cookie header is set correctly with no cookie-detection `toLowerCase`; CR/LF still throws via `assertHeaderSafe`; an array value still delete+appends.
- [x] 3.2 GREEN: add the constant-time pre-check (length + case-insensitive first char) before `field.toLowerCase()` in `WebResponseBuilder.set`; leave `assertHeaderSafe` and the array branch unchanged.
- [x] 3.3 Runtime suite green. Commit.

## 4. HP-5-web — lazy `raw` (per adapter: bun, deno, edge)

- [x] 4.1 RED (per adapter): `ctx.raw` returns `{ req, res: undefined }` and is memoized (`ctx.raw === ctx.raw`); a raw-unread request allocates no wrapper (assert via 5.2 micro-bench); `ctx.signal` and `triggerTimeout` still combine the request signal + timeout controller.
- [x] 4.2 GREEN (per adapter): add `private readonly _req`; rewire the `this.raw.req` sites (from 1.2) to `this._req`; replace the `raw` field with `get raw() { return (this._raw ??= { req: this._req, res: undefined }); }`. Apply identically to bun, deno, edge.
- [x] 4.3 Each adapter suite green. Commit (one per adapter, or one cohesive HP-5-web commit).

## 5. Verification & finalize

- [x] 5.1 `packages/adapters/conformance` green across Node/Bun/Deno/Edge (cross-adapter parity); runtime + bun/deno/edge suites green; `bench:validate` byte-identical; typecheck + lint clean.
- [x] 5.2 `apps/benchmark/scripts/web-context-alloc.js`: a query-less, raw-unread request allocates neither the empty-`query` object nor the `{ req, res }` wrapper. Record absolute before/after; no overstated RPS claim (each trim <1%).
- [x] 5.3 Per-package coverage ≥90% with changed branches covered.
- [x] 5.4 Run `openspec validate web-adapters-context-response-microtrims --strict`. On archive, update the report §7/§9 follow-up notes: HP-2-web / HP-15-web / HP-5-web ✅, and record HP-16-web as a verified non-finding (WebBodySource already uses the reader loop).
