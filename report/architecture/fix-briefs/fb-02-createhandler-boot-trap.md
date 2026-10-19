# FB-02 — `createHandler(app)` on Bun and Deno silently drops routes (router never mounted)

| Field | Value |
| --- | --- |
| **Severity / Priority** | **High** · P0 (documented happy path fails silently) |
| **Area** | `@nextrush/adapter-bun`, `@nextrush/adapter-deno`, `@nextrush/core` (`application.ts`), docs |
| **Depends on** | — |
| **RFC-gated** | No (behaviour fix; the lazy-boot pattern already exists in the Edge adapter) |
| **Size** | S |
| **Probe id** | `createhandler-without-ready` (Bun; `knownFailures: FB-02`) |

## Finding

- **Current situation:** `app.get('/', …)` registers on the **app-owned router**, which is only pushed onto the middleware stack inside `Application._boot()` (`application.ts:619-622`), i.e. on `await app.ready()`. `createHandler(app)` in the Bun adapter (and Deno) calls `app.callback()` immediately, which snapshots the stack **before** the router exists. Result: every route is unreachable.
- **Impact:** `Bun.serve({ fetch: createHandler(app) })` — the pattern shown in `packages/adapters/bun/README.md:135`, `apps/website/content/docs/reference/platforms/bun.mdx:185` and the `createHandler` JSDoc — returns **HTTP 200 with an empty body for every URL** (even unknown ones; no 404). The only warning (`callback()` before `ready()`) fires solely when extensions are registered.
- **Benefits of today's design:** Freezing configuration at `ready()` gives deterministic boot (extensions then router last).
- **Drawbacks:** `createHandler` is a public entry that bypasses `serve()`'s `await app.ready()` (`bun/adapter.ts:423`).
- **Long-term risk:** Every new adapter entry that forgets `ready()` repeats this. Edge already solved it (`edge/adapter.ts:176-209`: lazy `bootPromise ??= app.ready()`).
- **Recommendation:** Make every `createHandler` self-booting (lazy, once), and make `callback()` fail loudly when called before `ready()` with an app-owned router.
- **Trade-offs:** The first request awaits boot (microtask-level when there are no extensions).
- **Migration difficulty:** Trivial.

## Reproduce

```bash
node apps/benchmark/scripts/dev-check/check.mjs probe --rt bun   # KNOWN probe.createhandler-without-ready status=200 bytes=0
```

## Root cause (file:line)

- `packages/core/src/application.ts:696-712` — `callback()` snapshots `this.middlewareStack` at call time; router is appended only in `_boot()` (`:619`).
- `packages/adapters/bun/src/adapter.ts:196-246` (`createBunRequestRunner`) and `packages/adapters/deno/src/adapter.ts:~200` (`createHandler`) — no `ready()`.
- Reference implementation to copy: `packages/adapters/edge/src/adapter.ts:176-209` (`ensureBooted`).

## Fix — step by step

1. **Shared helper** in `@nextrush/runtime` (e.g. `createBootGate(app): () => Promise<(ctx) => Promise<void>>`) holding the `bootPromise ??= app.ready().then(() => { const h = app.callback(); app.start(); return h; })` logic currently inlined in Edge. Edge, Bun and Deno all use it (one implementation — this also removes drift).
2. **Bun / Deno runners:** `const handler = await boot();` as the first line of the per-request function. Optimise the hot path: keep a local `let ready: Handler | undefined` and only `await` when it is unset, so steady-state requests add no promise hop.
3. **`serve()`** keeps its eager `await app.ready()` (so startup errors surface at boot, not on the first request) and passes the same handler into the gate.
4. **`Application.callback()` guard:** if `!this._isReady && this.router` (app-owned router not yet mounted), throw a clear error: *"callback() was called before ready(); the app-owned router is not mounted. Use an adapter's createHandler()/serve() (they boot automatically) or `await app.ready()` first."* Keep the existing warning for extensions.
5. **Docs:** fix the three documentation locations only if behaviour is not self-booting; after this fix they are correct. Add one sentence to the Bun/Deno docs: "`createHandler` boots the app on the first request."
6. **Unknown route:** after the fix, `GET /unknown` must be a `404` JSON (not 200 empty). Add that assertion.

## Tests first

- `packages/adapters/bun/src/__tests__/create-handler-boot.test.ts` (new): `createHandler(app)` with `app.get('/')` and **no** `ready()` → 200 `{"ok":1}`; unknown path → 404; concurrent first requests share one boot.
- Same for Deno (`packages/adapters/deno/src/__tests__`).
- `packages/core/src/__tests__/application.test.ts`: `callback()` before `ready()` with an app-owned router throws the new error; with `app.route('/', router)` (explicit mount) it still works.
- Extension app: `createHandler` runs extension `setup()` exactly once.
- Conformance: scenario "handler created without explicit ready routes correctly" for node/bun/deno/edge.

## Acceptance criteria

- [ ] New tests fail before, pass after.
- [ ] `check.mjs probe --rt bun`: `createhandler-without-ready` PASS. `FB-02` removed from `knownFailures`.
- [ ] `check.mjs inproc`: no regression > 5 % (steady-state path has no extra await).
- [ ] Edge adapter now uses the shared helper (its tests unchanged and green).
- [ ] `pnpm --filter @nextrush/adapter-bun --filter @nextrush/adapter-deno --filter @nextrush/adapter-edge --filter @nextrush/core test`, conformance, typecheck, lint green.

## Do NOT

- Do not mount the router in the `Application` constructor (breaks the "router runs last, after all middleware" rule).
- Do not call `app.start()` before `ready()` resolves.
