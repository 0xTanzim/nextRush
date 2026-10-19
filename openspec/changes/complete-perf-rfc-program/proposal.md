# Proposal

## Why

RFC-039, RFC-040 and RFC-041 are adopted, but the programme is not closed. RFC-039's P2 (compiled
request validator), P3 (compiled response serializer) and P4 (scoped-middleware DX) have no measured
verdict; RFC-040's P3 (Deno/Edge/`--built` entries) is unstarted; RFC-040's P4 (AOT re-evaluation)
has no written decision. At the same time the gate those phases depend on has drifted: a
Node-inapplicable ratio is declared but never evaluated, RFC-039 names a `1.3` target while
`budgets.json` and RFC-040 say `1.4`, RFC-040 says wire is best-of-2 while the harness uses
best-of-3, and RFC-041 still describes the §14 gate as a future change.

Closing the phases without fixing the gate would mean either shipping optimizations the RFCs
explicitly forbid shipping without evidence, or recording verdicts the harness cannot actually
measure. Both are worse than leaving the phases open. This change makes each remaining phase
decidable, executes its gate, and records the resulting decision — implementation only where the
gate trips.

## What Changes

**Gate integrity**

- Make budget rules runtime-scoped. A budget declares the runtimes it applies to; an applicable
  budget that is never evaluated, or an inapplicable one that is evaluated, fails the
  `bookkeeping` stage.
- Ratchet `inproc.nextrush.vs_hono` `target` from `1.4` to `1.3` on Bun (RFC-039 §14), keeping
  `max` at `1.9`; reconcile RFC-039 §14, RFC-040 §15 P2 and `budgets.json` to the same numbers.
- Increase `wire` from best-of-2 to best-of-3 and report the median plus the observed spread;
  `wire` stays informational, never a CI gate.
- Add a 12-header `inproc` row for NextRush and Hono, gated by its own committed ratio rule
  (initial `max 2.0`, `target 1.3`), resolving RFC-040 open question Q4 ("4 or 12 headers in
  CI?").
- Add an opt-in `--built` mode that measures the packages' `dist/` output instead of the source
  alias, records source-vs-built deltas, and fails fast with an actionable message when `dist/` is
  missing. Source numbers remain the gate; built numbers are recorded until a baseline exists.
- Delete RFC-041's stale "Next change (not this one)" paragraph; the work it describes shipped.
- Add ADR-0028 (RFC-039 precompile tiers and gates), ADR-0029 (RFC-040 budgets and AOT deferral)
  and ADR-0030 (RFC-041 recorded response model), and register them in `docs/adr/INDEX.md`.
- Share the settle-turn constant between the Web runner and the Node adapter instead of two
  independent `const SETTLE_TURNS = 4` declarations.

**Runtime matrix (RFC-040 P3)**

- Add `--rt deno` to `dev-check`. Deno entries exercise `@nextrush/adapter-deno`; the full probe
  list runs on Deno through the same raw-HTTP client with per-runtime expectations.
- Add Deno `bundle`, `cold`, `inproc` and `wire` rows. Deno entries are built with the existing
  Bun bundler and executed with `deno run`; a bundle that is not runtime-neutral fails the stage
  rather than silently measuring Bun.
- Add a Deno leg to the `request-cost-gate` CI job alongside Bun and Node.
- Add an Edge entry driven by a pinned `workerd` dev dependency in `apps/benchmark`, with a
  `workerd` config that serves the Edge adapter. Edge rows are informational. If the binary cannot
  be installed in the working environment, the task records the blocker and the phase closes with
  the Deno and Node-on-Web legs green; the skip is explicit, never silent.
- Keep Node-on-Web as the existing `inproc-nextrush-web` control row (the Web runner on Node) and
  document that no Node-on-Web production server adapter exists, so no wire row is invented.
- Add the optional Elysia arm scoped to `bundle`, `cold` and `wire`, labelled Bun-only, pinned to
  an exact prerelease with the prerelease recorded in the report. If the package cannot be pinned,
  record the decision and leave the arm out.

**RFC-039 phase decisions**

- **P2 — schema-bearing POST.** Add a POST entry with a realistic Standard Schema (zod) plus an
  identity-schema control, profile both, and apply RFC-039's own gate: the validation wrapper (not
  the schema library) must reach ≈5 % of request CPU. If it does, implement the
  closure-composed validator with the generic `runSchema` fallback; if it does not, record the
  evidence-negative verdict and close P2 without code.
- **P3 — large-payload serialization.** Add a large-POST entry and a response-schema entry;
  profile both. If serialization reaches ≈5 % of request CPU, implement the closure-composed
  serializer with the generic `JSON.stringify` fallback; otherwise record the negative verdict and
  close P3 without code.
- **P4 — scoped middleware.** Per-route middleware already exists
  (`app.get(path, ...entries)` with `RouteEntry = Middleware | RouteMetaMarker`). Document it in
  the core README and a scaffold example, profile the five-middleware shape to confirm no
  framework-attributable hotspot, and record that no new API or Rust work is justified.
- Any fast path that ships under P2/P3 must be behaviourally identical to the generic path, tested
  differentially, fall back on missing/unsupported metadata, and use no `new Function`/`eval`.

**RFC-040 P4 decision**

- Evaluate the four §17 AOT re-open criteria against the numbers this change records, and write
  the "stay deferred" decision (or a new RFC if a criterion genuinely trips).

**Report**

- Produce `report/performance/perf-program-closure.md` with the measured matrix (Bun, Node and
  Deno; 4 and 12 headers; source and `--built`), every gate result, and the P2/P3/P4/P4 verdicts.
  No verdict may cite a number that is not in the report's own tables.

**Scope rule.** P2 and P3 are closed by executing their gate, not by unconditionally shipping the
optimization: implementation happens only when the RFC's stated threshold trips, and an
evidence-negative verdict is a successful close. P4 and RFC-040 P4 are documentation/decision
work. This is the RFCs' own completion condition, not a reduction of scope.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `performance-gate`: budget rules become runtime-scoped and coverage-checked; the gate must
  measure the body-bearing, header-heavy and build-output shapes the programme's metrics name; and
  any fast path added under the gate must be behaviourally equivalent, falling back to the generic
  path, with no runtime code generation.

## Impact

- `apps/benchmark/scripts/dev-check/**`: harness, stages, budget rules, new entries, Deno runtime
  support, `--built` mode, new schema/large-payload/Edge/Elysia entries.
- `apps/benchmark/package.json`: add `@nextrush/validation`, `zod`, `workerd` and optionally
  `elysia` as pinned dev-only dependencies. No published package gains a dependency.
- `packages/runtime/src/web-runner.ts` and `packages/adapters/node/src/adapter.ts`: one internal
  settle-turn constant replaces two copies.
- `packages/middleware/validation/**` and the response path only if the P2/P3 gates trip.
- `docs/RFC/runtime-adapters/039-precompile-per-request-tax.md`,
  `040-resource-budgets-and-request-path-footprint.md`,
  `041-recorded-response-model.md`; `docs/adr/0028-0030`; `docs/adr/INDEX.md`;
  `packages/core/README.md` (per-route middleware) and one scaffold example.
- `.github/workflows/ci.yml`: Deno leg in `request-cost-gate`.
- No documented public API, routing, middleware, DI, adapter-contract or published-dependency
  change. The only package-surface addition is an `@internal` settle-turn constant export, which
  removes a duplicated value; it is not part of the documented API. No breaking change. `--built`
  and the Deno/Edge rows are local/CI tooling only.
