# Design

## Context

See `proposal.md` — Why. The relevant current state:

- `check.mjs` dispatches stages (`bundle`, `cold`, `inproc`, `wire`, `probe`, `bookkeeping`,
  `hygiene`, `profile`). `lib/harness.mjs` owns the row table, the budget gate, the bundler call
  and the child-process helpers; each stage module owns one measurement.
- `budgets.json` holds flat rules plus `knownFailures`. `gate()` has no runtime parameter, so a
  rule applies to every runtime that happens to call it. `stageInproc` branches in code: it gates
  the ratio on Bun and prints it as INFO on Node, which leaves the declared rule inert on Node
  and outside the bookkeeping check.
- `stageWire` runs each case twice and takes `Math.max` (best-of-2). The RFC-040 §8.6 text and the
  harness disagree about repeat count, and the `wire.nextrush.vs_hono` rule is gated even though
  the RFC treats wire as informational.
- `lib/build.ts` always aliases `nextrush`/`@nextrush/*` to `packages/**/src/index.ts`. The
  packages' `dist/` exists after a build but no mode measures it.
- Entries select their adapter with `typeof globalThis.Bun`. On Deno that falls through to the
  Node arm, so a row labelled "Deno" would measure the Node adapter. `@nextrush/adapter-deno`
  exposes `createHandler(app)` taking a Web `Request`.
- No `workerd`, `wrangler` or `miniflare` is installed. CI's `request-cost-gate` job sets up Bun
  and runs Bun + Node; the conformance job already uses `denoland/setup-deno@v2`.
- `app.get/post(...)` already accepts `RouteEntry[]`, and `registration.ts` partitions middleware
  from the final handler. Route-scoped middleware exists; the core README documents only
  `app.use`.
- `validate()` contributes request schemas to route metadata; response metadata exists. Nothing
  compiles either. `SETTLE_TURNS = 4` is declared independently in `runtime/src/web-runner.ts`
  and `adapters/node/src/adapter.ts`.
- RFC-041 still contains a "Next change (not this one)" paragraph describing work that already
  shipped. No ADR exists for RFC-039, 040 or 041.

## Goals / Non-Goals

**Goals**

- Every remaining RFC phase ends with a verdict backed by a number the harness produced.
- A budget cannot be silently inapplicable to a runtime, and a runtime cannot silently skip a
  budget that applies to it.
- Deno is a real gate runtime, not a label on a Node measurement.
- The gate can answer "what does the built package cost" without giving up the fast source loop.
- The report can defend the Bun-vs-Hono comparison with repeatability and spread.

**Non-Goals**

- No public API, routing, middleware, DI, adapter-contract or published-dependency change.
- P2/P3 are not implemented unless their gate trips; P4 is not a new API.
- No AOT implementation, no Rust work, no Edge CI gate, no wire failure gate.
- No CPU profiling on Deno/Edge; the profile stage stays Bun/Node.
- No budget loosening to make a run green.

## Decisions

### D1 — Every budget declares its runtimes, and coverage is a finalizer

`budgets.json` rules gain a required `runtimes` array (`bun`, `node`, `deno`) and a `stage` name
(`bundle`, `cold`, `inproc`). `gate(name, value, rule)` fails when the current runtime is not in
`rule.runtimes`; that is a programming error in the stage, not a measurement failure.
`stageBookkeeping` registers a finalizer through `ctx.onFinalize()`. The finalizer receives the
set of selected stages, so a `probe`-only run does not demand inproc coverage, and checks:

1. every rule whose `stage` is selected and whose `runtimes` includes the current runtime was
   passed to `gate()` at least once;
2. every rule passed to `gate()` on this runtime lists this runtime.

`schema` validation of every rule (known runtime names, non-empty array, known stage) stays in the
early static part of `stageBookkeeping`; the coverage part runs at the end, before
`printSummary`. The row name stays `bookkeeping.budget-coverage`, matching the spec.

Alternative rejected: defaulting a missing `runtimes` to "all". Silence is exactly how the Node
inproc rule became inert; an explicit declaration is the point of the change.

Existing rules migrate as follows: `bundle.*` and `cold.*` → `["bun", "node"]`; `inproc.*` →
`["bun"]`; `wire.nextrush.vs_hono` is deleted (see D2). Deno rules are added only after a
baseline exists.

### D2 — Wire is best-of-three, median, and never a gate

`stageWire` runs each case three times, reports the median requests/second and the min–max spread
in the same note, and always calls `ctx.row('INFO', ...)`. The `wire.nextrush.vs_hono` rule is
removed from `budgets.json`. Rationale: the RFC defines wire as informational, the current gate
disagrees with the RFC, and the observed Bun run-to-run spread (0.82–0.93) makes a hard threshold
a coin flip. Three runs add roughly 12 s to a local run and nothing to CI (wire is not a CI
stage).

Alternative rejected: keep best-of-2 with `max`, which hides variance instead of reporting it.

### D3 — Body-bearing and 12-header shapes are part of the steady-state gate

`stageInproc` gains two shapes:

- a parsed JSON POST for NextRush and Hono, using the same prebuilt-request strategy on both
  arms so the ratio measures parsing and dispatch rather than `Request` construction. The pair is
  reported as `inproc.post.nextrush.us`, `inproc.post.hono.us` and a ratio row. The first run
  establishes the committed rule (`max` = measured ratio plus the observed spread, `target 1.3`);
  until that baseline exists the ratio is INFO.
- a 12-header pass for NextRush and Hono (`HEADERS=12`), gated as
  `inproc.nextrush.vs_hono.h12` on Bun. Initial rule: `max 2.0`, `target 1.3`. The first measured
  run is recorded; if the observed ratio is below 2.0 with margin, the task tightens `max` to the
  measured value plus the observed spread.

On Node both ratio rows are INFO for the same reason the 4-header ratio is INFO: the arms use
different request models. Rationale: RFC-039 §14 requires a post-json scenario, RFC-040 Q4 is
unresolved, header copy is a known attribution row, and a 4-header-only gate cannot see
header-count scaling.

### D4 — `--built` resolves the packages' published entry points

`check.mjs --built` sets `ctx.built`; `harness.build()` passes `--built` to `lib/build.ts`.
`build.ts` then skips the source alias and lets Bun resolve `nextrush`/`@nextrush/*` through the
workspace `node_modules` links to `dist/`. Before the first build, the harness calls
`assertBuiltOutputs(repoRoot)`: scan packages (same walk as `build.ts`), and for every package
whose entry point resolves to `dist`, fail with the missing paths and the `pnpm build` command if
any is absent. A WARN, not a failure, is reported when a package's newest `src/**/*.ts` is newer
than its `dist` entry point; clock skew must not block a run, but stale evidence is visible.

Built-mode metrics are recorded under a `built.` prefix, so `last-run.<runtime>.json` keeps both
series. Built rows are INFO: source-mode numbers remain the merge gate until a built baseline is
committed. The report states that the bundle is still Bun-minified and that built mode changes
the module graph, not the bundler.

### D5 — Deno is a runtime target with the same stage contract

- `--rt deno` is accepted. `ctx.target` maps to the bundler target `bun` (Bun's bundler has no
  Deno target; the entry is runtime-neutral, which the feasibility check confirmed by running a
  Bun-built bundle on Deno).
- `harness` exposes `runtimeArgs(file)`: `[file]` for Bun/Node, `['run', '--allow-all',
  '--quiet', file]` for Deno. `withServer` and the `spawnSync` calls in `measure.mjs` use it.
- Entries add a Deno branch before the Node branch: `_inproc-adapter` uses
  `createHandler` from `@nextrush/adapter-deno` with a `remoteAddr` info object; `probe-server`,
  `serve-nextrush`, `serve-raw`, `serve-hono` and `coldstart-nextrush` use `Deno.serve` or the
  Deno adapter. `serve-*` entries may import all adapters because their bundle size is not
  measured.
- `stageBundle` on Deno measures `hello-nextrush-root`, a new `hello-nextrush-deno`, and
  `hello-hono`; Fastify is reported as WARN "not supported on deno". `stageCold`, `stageInproc`
  and `stageWire` run their Deno-capable arms as INFO; `probe` runs the full registry and uses
  the existing per-runtime `knownFailures` lookup.
- `stageProfile` maps the bundler target through `ctx.target` and reports WARN "profile is
  Bun/Node only" on Deno rather than attempting an unsupported profiler.
- CI adds `denoland/setup-deno@v2` and one step:
  `check.mjs bundle cold inproc probe bookkeeping --rt deno`.

Alternative rejected: running Deno unbundled with an import map. It measures Deno's TypeScript
loader, not the framework graph, and would differ from every other row.

### D6 — Edge is a probe-only leg, explicitly optional

Add `workerd` as an exact-pinned devDependency of `apps/benchmark` (after verifying its license
against the repository policy), a worker entry using `@nextrush/adapter-edge`, and a pinned
`workerd` config. A new `edge` stage (not part of the default set) starts `workerd`, runs the
probe registry, and reports INFO/KNOWN. If the binary is unavailable or the config cannot start,
the stage reports WARN with the reason and returns; it never silently passes. No CI Edge step and
no Edge budget in this change. Rationale: the Edge runtime is the one leg that cannot run under
Bun/Node/Deno, `workerd` is the actual runtime rather than a shim, and a probe-only leg is
proportionate to the RFC's "entries" requirement.

### D7 — Elysia arm is Bun-only and coverage-scoped

Add `elysia` at an exact pinned version to `apps/benchmark` devDependencies, and `hello-elysia`,
`coldstart-elysia`, `serve-elysia` entries used by `bundle`, `cold` and `wire` on Bun only.
Rows are INFO and labelled `Bun-only`. If the pinned prerelease cannot be installed or its API
does not match, the arm is removed and the decision is recorded in the report; the rest of the
change does not depend on it.

### D8 — P2 is decided by the wrapper's profile share

New entries: `inproc-nextrush-schema-post` (`bodyParser()` + `validate({ body: zodSchema })` on a
POST) and `inproc-nextrush-schema-control` (the same middleware with an identity Standard Schema)
to separate wrapper cost from schema-library cost. The gate is RFC-039's: the validation wrapper
— the `validate` frame and its direct helpers, not the schema library's frames — must reach
≈5 % of sampled request CPU in a Bun CPU profile. The profile is run with the existing
`profile --entry ... --rt bun`; the report stores the table and the profile path.

If the gate trips, the implementation is a closure composed once per middleware:
`packages/middleware/validation/src/compiled.ts` handles the single-body case, calls
`~standard.validate` directly, allocates an issues array only on failure, and sends async or
multi-target schemas to the existing generic path. Differential tests cover pass, coercion,
failure aggregation, async schemas, multi-target and issue shape. No `eval`/`new Function`, no
public API change. If the gate does not trip, P2 closes evidence-negative with the measured
share.

### D9 — P3 is decided by the serializer's profile share

New entries: `inproc-nextrush-large-post` (`BODY_BYTES=102400`) and
`inproc-nextrush-large-response` (a fixed 400-object payload through `ctx.json`). The gate is
RFC-039's: serialization (`JSON.stringify` plus framework serializer frames) must reach ≈5 % of
sampled request CPU. If it does, only response metadata that yields a fixed-key object schema is
compiled; the serializer is built at registration from the existing JSON-Schema conversion,
produces byte-identical output to `JSON.stringify` for supported values, and falls back for
circular values, `BigInt`, `undefined`, `toJSON`, and unsupported schemas. A byte-equality
differential and a fallback test are mandatory. If byte-identical output cannot be guaranteed for
the narrow shape, the task stops and writes an RFC instead of shipping; a serializer that changes
bytes is not an optimization.

### D10 — P4 is documentation and evidence, not a new API

`app.get(path, ...entries)` already supports route middleware; `registration.ts` partitions
`Middleware` entries from the final handler. Add a "Route-scoped middleware" section to
`packages/core/README.md` with a body-parser/auth example, and use route-scoped middleware in one
scaffold template route. Profile `inproc-nextrush-mw`; record that the five-middleware cost is
handler work, with no framework-attributable hotspot that would justify Rust. No API change.

### D11 — One settle-turn constant

Export `SETTLE_TURNS` from `@nextrush/runtime` with an `@internal` doc tag, import it in
`adapters/node/src/adapter.ts`, delete the local copy, and add a unit test that the exported value
is `4` and both consumers import it. This removes a silent drift risk without changing behavior.

### D12 — ADRs and RFC edits record the decisions

- ADR-0028 — "Precompile tiers ship only on measured evidence" (RFC-039).
- ADR-0029 — "Runtime-scoped resource budgets and deferred AOT" (RFC-040).
- ADR-0030 — "Recorded response model" (RFC-041; Accepted · Shipped).
- RFC-039: progress and §14 updated with the P2/P3/P4 verdicts and the `1.3` target.
- RFC-040: P3/P4 verdicts, §8.6 corrected to best-of-three median, Q4 resolved, target `1.3`.
- RFC-041: delete the stale "Next change (not this one)" paragraph.

### D13 — One closure report

`report/performance/perf-program-closure.md` holds the environment, commands, source and built
tables, 4/12-header rows, Bun/Node/Deno matrix, wire medians and spreads, gate summary, and the
P2/P3/P4/RFC-040-P4 verdicts. Every verdict cites a table in the same report; no number is copied
from a prior audit.

## Risks / Trade-offs

- **A Bun-built bundle may not be faithful for every Deno entry** → entries are runtime-neutral or
  branch before touching a runtime global; a smoke request runs before timing; the report labels
  the bundle "bun-bundled, Deno-executed". If a specific entry cannot run, it is excluded with a
  WARN, not relabelled.
- **Deno cold/startup noise** → seven samples, median, and INFO-only rows until a baseline.
- **Coverage finalizer false failures on partial stage runs** → coverage is filtered by the
  selected stage set; only the static schema check is unconditional.
- **`workerd` install or config drift** → exact pin, license check first, probe-only stage, WARN
  with the reason when unavailable; no CI or gate depends on it.
- **Elysia prerelease API drift** → exact pin, isolated entries, removal path recorded.
- **A P2/P3 gate trip expands the change** → both implementations are pre-scoped to the narrow,
  byte-equivalent case with a generic fallback; if equivalence cannot be proven, the task stops
  at an RFC rather than shipping.
- **Removing the wire gate reduces one protection** → the RFC already classifies wire as
  informational; `inproc` and `cold` remain gated, and the report keeps wire visible with spread.
- **12-header max of 2.0 could hide a regression between 1.9 and 2.0** → the first measured run
  tightens `max` to the observed value plus spread; the value is recorded in the report.
- **Built mode can measure stale `dist/`** → missing output fails fast; stale output WARNs; the
  report records the build command and time.
- **Deno CI leg adds wall time** → the job timeout is 15 minutes; Deno runs the fast stages only
  (no wire, no profile).

## Migration Plan

1. Land gate integrity (D1–D4, D11) with Bun/Node baselines; run the full suite and capture the
   source numbers.
2. Add Deno support (D5) and the CI leg; keep Deno rows INFO until probes and baselines are green.
3. Add Edge and Elysia (D6–D7) as optional legs; record availability in the report.
4. Add P2/P3 entries and profiles (D8–D9); implement only on a tripped gate; otherwise record the
   negative verdict.
5. Ship P4 documentation (D10).
6. Write ADRs, RFC edits and the closure report (D12–D13); run `openspec validate --strict` and
   the full repository checks.

Rollback: `--built`, `--rt deno` and `edge` are opt-in; the CI Deno step is one block; budget
changes are data; the only runtime code change (D11) is a constant move; P2/P3, if implemented,
sit behind metadata checks with a generic fallback and can be removed without an API change.

## Open Questions

- Which exact Elysia prerelease is pinned? Resolved at implementation from `elysia@next`; the
  version is recorded in the report and the dependency is exact.
- Does the P2 or P3 gate trip? This is the measurement the change exists to make; both branches
  are specified above and neither changes the task breakdown.
