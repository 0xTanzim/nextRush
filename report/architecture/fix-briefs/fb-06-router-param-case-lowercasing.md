# FB-06 — `ctx.params` are lower-cased on every dispatched request

| Field | Value |
| --- | --- |
| **Severity / Priority** | **Critical** · P0 |
| **Area** | `@nextrush/router` (`canonicalize.ts`, `dispatch.ts`, `match-route.ts`, `router.ts`) |
| **Depends on** | — |
| **RFC-gated** | No — this is a regression of the documented behaviour |
| **Size** | S (≈ 40 lines + tests) |
| **Probe ids** | `param-case-preserved`, `wildcard-case-preserved` (`knownFailures: FB-06`) |

## Finding

- **Current situation:** With the default `caseSensitive: false`, `GET /users/ABC123` gives `ctx.params.id === "abc123"`; `GET /files/Foo/Bar.TXT` gives `params["*"] === "foo/bar.txt"`. Verified on Bun and Node.
- **Impact:** Every ID, slug, token, filename or base64/ULID/UUID-with-caps path parameter reaches the handler corrupted. Lookups silently miss, or hit the wrong record on case-sensitive stores. No error is raised.
- **Benefits of today's design:** RFC-029 wants one canonical path (case-folded for *matching*). That part is right.
- **Drawbacks:** The fold leaked from *matching* into *value extraction*.
- **Long-term risk:** Users work around it with `originalPath` parsing or `caseSensitive: true`, then hit the next surprise.
- **Recommendation:** Match on the folded path, extract values from the case-preserved path (the original design — HP-12 — already intended this).
- **Trade-offs:** One extra string only when a fold actually happened (path contains uppercase or non-ASCII) — the same condition HP-12 used.
- **Migration difficulty:** Trivial. Behaviour change is a bug fix; note it in the CHANGELOG.

## Reproduce

```bash
node apps/benchmark/scripts/dev-check/check.mjs probe --rt bun   # KNOWN probe.param-case-preserved  params.id="abc123"
```

## Root cause (file:line)

1. `packages/router/src/dispatch.ts:60-75` — `createRoutesMiddleware` calls `canonicalizePath(...)` (which **lower-cases** the path, `canonicalize.ts:122-129`) and then `match(ctx.method, canonical.path)` with the **folded** string.
2. `packages/router/src/router.ts:299` — passes `preNormalized = true`.
3. `packages/router/src/match-route.ts:89-91` — with `preNormalized`, `normalized = path; caseStable = true`, so `originalPath` stays `undefined` (`:125`) and `matchNodeIndexed` extracts values from the already-folded string. The comment "trust `path` as both the normalized AND original-case string" is false whenever the canonicalizer folded.
4. Why tests passed: router unit tests call `router.match()` (public, `preNormalized = false`), which re-derives original case correctly. Only the **dispatch** path is wrong.

## Fix — step by step

1. **`canonicalize.ts`**: extend `CanonicalPathResult` with `readonly valuePath: string` — the query-stripped, slash-collapsed, trailing-slash-stripped path **without case folding**. When no fold happened it is the same string as `path` (no extra allocation). Update the memo to store it.
2. **`match-route.ts`**: add an optional parameter (e.g. `preNormalizedOriginalPath?: string`). When `preNormalized` is true and it is supplied, set `originalPath = preNormalizedOriginalPath` (only if it `!== path`); otherwise keep today's behaviour. Keep `caseStable` logic: `caseStable = originalPath === undefined`.
3. **`router.ts` `routes()`**: the closure currently is `(method, path) => resolveMatch(..., path, true)`. Change `createRoutesMiddleware`'s `match` signature to `(method, path, valuePath)` and forward `valuePath`.
4. **`dispatch.ts`**: call `match(ctx.method, canonical.path, canonical.valuePath)`.
5. **`resolveMatch`**: accept and forward the new argument; do not change the public `Router.match(method, path)` signature.
6. Do **not** change what `ctx.path` publishes (still the folded canonical path; `ctx.originalPath` is the raw target). That is RFC-029 behaviour.
7. Check the other consumer of folded paths: `findAllowedMethods` (`dispatch.ts:119-129`) only needs the folded path — leave it.

## Tests first

- `packages/router/src/__tests__/dispatch-param-case.test.ts` (new): build a router, mount `router.routes()`, run a mock context for `/users/ABC123` and `/files/Foo/Bar.TXT`; expect `ctx.params.id === 'ABC123'`, `ctx.params['*'] === 'Foo/Bar.TXT'`, and `ctx.path === '/users/abc123'`.
- Cases: mixed-case static route + param route; `caseSensitive: true`; trailing slash + uppercase; double slashes + uppercase; percent-encoded uppercase (`%C4%B0`); non-ASCII that changes length when lower-cased (`İ`) — assert values are still correct (this is why positions must come from the same-structure string).
- Mounted router: `app.route('/API', router)` with `/API/Users/ABC` → params preserved.
- Add the scenario to `packages/adapters/conformance` so every adapter asserts it.

## Acceptance criteria

- [ ] New dispatch-level tests fail before the fix, pass after.
- [ ] `node …/check.mjs probe --rt bun` and `--rt node`: `param-case-preserved` and `wildcard-case-preserved` PASS.
- [ ] `FB-06` removed from `knownFailures` in `budgets.json`.
- [ ] `pnpm --filter @nextrush/router test`, conformance suite, `pnpm typecheck`, `pnpm lint` green.
- [ ] `node …/check.mjs inproc` shows no regression > 5 % (hello-world has no uppercase, so no extra work).
- [ ] `pnpm bench:alloc:router` and `bench:alloc:dispatch` (apps/benchmark) show no new allocation on the all-lowercase path.

## Do NOT

- Do not make routing case-sensitive by default.
- Do not change `ctx.path` to the case-preserved path (RFC-029).
- Do not re-fold inside `matchNodeIndexed`.
