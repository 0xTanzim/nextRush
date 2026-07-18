# Implementation Notes — core-single-middleware-fastpath

Findings and measurements captured during implementation (tasks §1.1–§1.3, §7).

## §1.1 — `compose()` caller audit (code graph)

`trace_path` (inbound, `compose`) confirms the only **direct** caller is
`Application.callback()` (`packages/core/src/application.ts:538`), which calls
`compose(this.middlewareStack, { warnDoubleResponse: !this.isProduction })` and passes
**no tail `next`**. `createViewEngine` and the node adapter's `body-source` are hop-2 indirect
(they compose their own middleware, not the app stack). Consequence: in production the
`len === 1` fast path's tail `next` is `undefined`, so `next()` resolves via
`Promise.resolve()`. The `(ctx, next?)` contract is nonetheless preserved and tested for a
provided tail `next` (used by tests and any future caller).

## §1.2 / §7.3 — Benchmark environment constraint (honest scope)

`pnpm bench:compare --profile full` (5 runs, CPU-pinned) is the repo's only publishable-grade
profile. Per the root README, single-session numbers on a shared machine were withdrawn as
non-reproducible; publishable figures require a clean, CPU-pinned environment. This
implementation was done on a shared dev machine, so a **publishable** full-profile A/B is
deferred to that environment. What was run here instead:

- **`pnpm bench:validate` (§7.2): PASS** — 6 servers agree byte-for-byte on bodies, content
  types, statuses, and middleware headers. The fast path changes no output.
- **Quick compare (`bench:compare:quick`, single run, NON-publishable smoke check):** NextRush
  Hello World ≈ 28,057 RPS, Route Params ≈ 23,081 RPS, vs Raw Node 32,965 — competitive with
  Hono (28,061), approaching Fastify (32,635). **No regression observed.** Single-run only; not
  a merge gate and not a published number.

## §1.3 — Coverage baseline vs. after

| Scope           | Before (lines / branch) | After (lines / branch) |
| --------------- | ----------------------- | ---------------------- |
| `@nextrush/core` overall | 97.78% / 90.17%   | 98.77% / 92.06%        |
| `middleware.ts` | 97.36% / 85.71%         | 98.21% / 90.47%        |
| Test count      | 111                     | 148                    |

No coverage decrease; the new `len === 1` branch is covered.

## §7.1 — Allocation micro-benchmark (deterministic, primary perf evidence)

`pnpm bench:alloc` (new harness, `scripts/compose-alloc*.js`), 3 runs × 150k invocations,
`--expose-gc`, per-variant process isolation:

| Path                    | Bytes/op | Stddev | CV    |
| ----------------------- | -------- | ------ | ----- |
| `len === 1` (fast path) | 801.9    | 0.6    | 0.07% |
| `len === 2` (general)   | 1529.7   | 0.4    | 0.02% |

**47.6% per-invocation allocation reduction — PASS.** This directly confirms design D7: the
fast path does not allocate the recursive `dispatch` function closure the general path builds
per request. Deterministic (CV < 0.1%), reproducible on any machine.

## §7.4 — Decision gate outcome

Proceed. Merge is justified by the deterministic gates (byte-identical parity + 47.6%
allocation reduction) plus a no-regression RPS smoke check; the change is behavior-preserving
(148 tests, incl. the exhaustive edge-case/concurrency/parity matrix) and trivially revertible
(drop the `len === 1` branch → general path). Publishable full-profile RPS A/B is deferred to a
CPU-pinned environment before any RPS gain is claimed publicly — consistent with the repo's
"measure before optimizing" and withdrawn-numbers policy.
