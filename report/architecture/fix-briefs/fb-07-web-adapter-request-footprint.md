# FB-07 — Bun/Deno/Edge request path costs ≈ 2× Hono per request (execution brief for RFC-039 P1)

| Field | Value |
| --- | --- |
| **Severity / Priority** | Performance · P1 |
| **Area** | `@nextrush/runtime` (`web-context-base.ts`, `headers.ts`), `@nextrush/adapter-{bun,deno,edge,serverless}` |
| **Depends on** | RFC-040 `dev-check` (gate); FB-02 (shared boot gate); FB-04 step 1 (raw path helper) pairs naturally |
| **RFC-gated** | No — RFC-039 Part A/B already covers it; this brief makes it executable |
| **Size** | M (4 independent, separately revertible changes) |
| **Gate** | `check.mjs inproc` and `wire`; ratio `inproc.nextrush.vs_hono` budget `max 2.5`, `target 1.3` |

## Finding

- **Current situation (Bun 1.4.3, `dev-check`, 4 request headers):** in-process 5.17 µs vs Hono 2.41 µs vs raw floor 1.76 µs; over the wire 42k vs 76k rps (0.56×). Node is not affected the same way (it has a settled-flag timeout fast path, reuses header objects by reference and computes `ip` from the socket).
- **Profile attribution** (`check.mjs profile`, self/total): `Headers.forEach` (`headersToRecord`) ≈ 18 % · `setTimeout`/`Promise.race`/`clearTimeout` ≈ 10 % · `new URL` ≈ 5 % · `JSON.stringify` ≈ 3.5 % · `Request`/`Response` are platform. Isolated: `headersToRecord` ≈ 1.05 µs at 4 headers vs ≈ 0.07 µs for a lazy `headers.get`; grows with header count. The eager `server.requestIP()` native call is the likely biggest wire-level item (≈ 15 % on raw `Bun.serve` — **A/B before claiming a number**).
- **Impact:** The target runtime for "Bun-native speed" pays ≈ 2× the framework tax on 100 % of requests.
- **Benefits of today's design:** Eager context is simple and predictable; `headersToRecord` yields a stable, security-checked, null-prototype bag.
- **Drawbacks:** Work done for data most handlers never read.
- **Long-term risk:** Four forked runners (Bun/Deno/Edge/Node) mean any fix lands once and is missed three times (the timeout fast path already did).
- **Recommendation:** Four changes in value order, each behind `dev-check`, plus one shared runner so they land once.
- **Trade-offs:** One branch on first read of a lazy field; hidden-class stability must be kept (declare slots, `??=` memo).
- **Migration difficulty:** Moderate; observable behaviour must not change.

## Changes (do in this order; one PR each; measure before and after)

Baseline first: `node apps/benchmark/scripts/dev-check/check.mjs inproc wire` (twice; it prints `% vs last run`).

1. **Lazy incoming-header record.** `WebContextBase`: replace the eager `this.headers = headersToRecord(request.headers)` (`web-context-base.ts:178`) with a memoized getter (keep a declared slot + `??=`, as `raw/state/bodySource` do on Node). Hot readers (`ctx.get(name)`) should call `request.headers.get(name)` directly — never materialise the record for single lookups. Keep header grammar/security behaviour identical.
2. **Lazy client IP.** Bun runner (`bun/src/adapter.ts:207`): do not call `server.requestIP(request)` eagerly. Pass a thunk (or `server` + `request`) to `createBunContext` and resolve inside the `ip` getter, memoized. Same for Deno (`info.remoteAddr`) if it allocates. Keep `proxy` trust-chain logic unchanged (RFC-030).
3. **Lazy-armed timeout (shared).** Implement the Node adapter's settled-flag approach once, in a shared Web runner in `@nextrush/runtime`: call the handler; if it already responded synchronously (`ctx.responded`) arm **no** timer; otherwise arm the timer and keep today's 504 body, `ctx.triggerTimeout()` and warning text. Bun, Deno, Edge/serverless call the runner (delete the three copies of the `Promise.race` + sentinel). Reuse the FB-02 boot gate.
4. **No `new URL` per request.** Use the raw-path helper from FB-04 step 1 (`path`, `search`, `originalPath`, query parse via the existing `parseQueryString`). Make query parsing lazy (RFC-039 C4) only after 1–3 are measured.

Stop condition: `inproc.nextrush.vs_hono` ≤ 1.6 (target 1.3) **and** no probe regression. Re-profile (`check.mjs profile`) and update RFC-039 §3.7 with the new numbers. Do not start RFC-039 Parts C/D (compiled validator/serializer) — they are gated on a POST profile.

## Tests first

- `packages/runtime/src/__tests__/web-context-lazy-headers.test.ts`: constructing a context does **not** read `request.headers` (spy on `Headers.prototype.forEach`/a proxy request); `ctx.headers` returns the same object on repeated reads; `ctx.get('x')` returns the right value without materialising the record.
- Bun adapter test: `server.requestIP` is **not** called for a handler that never reads `ctx.ip`; is called exactly once when read twice; `proxy: true` behaviour unchanged.
- Shared runner: no timer armed (`vi.spyOn(globalThis,'setTimeout')`) for a synchronous handler — mirror `adapters/node/src/__tests__/handler-timeout-fast-path.test.ts`; slow handler → 504 with the same body; `ctx.signal` aborts.
- Conformance suite green on node/bun/deno/edge/serverless (behaviour identical).
- Allocation guard: `pnpm bench:alloc:web` (apps/benchmark) — allocations per request drop, never rise.

## Acceptance criteria

- [ ] Each change: `dev-check inproc` shows a drop (record the `% vs last run` in the PR description).
- [ ] `check.mjs probe --rt bun` and `--rt node`: no new FAIL.
- [ ] `inproc.nextrush.vs_hono` ≤ 1.6 after all four; `budgets.json` `target`/`max` ratcheted down in the same PR.
- [ ] Three duplicated runners removed; one shared runner has the tests.
- [ ] Conformance + `pnpm typecheck` + `pnpm lint` green.

## Do NOT

- Do not remove header grammar validation, canonical-path rules or proxy trust to gain speed (RFC-039 §10).
- Do not introduce `new Function`/`eval` anywhere (RFC-040 invariant).
- Do not change the default 30 s timeout or the 504 response shape in this brief.
