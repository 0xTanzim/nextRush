# dev-check — request-path cost and correctness, in seconds

`check.mjs` costs the request path and checks its behaviour **from source**: no
`pnpm build`, no 30-minute benchmark profile, no `results/` files to read. Measured
on a dev box, `bundle cold inproc probe` finishes in about **5 s on Bun** and **25 s
on Node**.

It exists because a performance claim that is expensive to reproduce gets reproduced
rarely, and a behaviour claim that is expensive to check gets checked by hand once and
then trusted forever. Both are how a request path quietly regresses.

---

## Quick start

```bash
# every stage except `profile` and `edge` — the default
node apps/benchmark/scripts/dev-check/check.mjs

# only what changed
node apps/benchmark/scripts/dev-check/check.mjs probe
node apps/benchmark/scripts/dev-check/check.mjs cold inproc

# the runtime stages on Node instead of Bun
node apps/benchmark/scripts/dev-check/check.mjs all --rt node

# where the time actually goes (slow; opt-in)
node apps/benchmark/scripts/dev-check/check.mjs profile --entry inproc-nextrush

# also measure the published `dist/` next to the source graph
node apps/benchmark/scripts/dev-check/check.mjs bundle cold inproc --built

# opt-in: run the probe registry against the real workerd runtime
node apps/benchmark/scripts/dev-check/check.mjs edge
```

Prerequisites: `bun` (the bundler, and the default runtime), `node` >= 22, and `wrk`
only for the `wire` stage. `taskset` is used when present to keep `wrk` off the server's
cores.

The command exits **1** when the gate failed and **0** otherwise, so it is usable as a
CI step as-is. Every run writes `.out/last-run.<runtime>.json`, and the next run prints
the delta against it — so "before my change / after my change" is just running the same
command twice.

---

## Stages

Each stage answers one question and can run alone. `all` (and the default, no stage
arguments) means every stage except `profile` and `edge`.

| Stage | Question it answers | Cost (measured, Bun) |
| --- | --- | --- |
| `bundle` | How many bytes does an app ship? | 0.4 s |
| `cold` | How long before the first request is served, at 25 and 1,000 routes? | 0.7 s |
| `inproc` | What does one request cost with no socket involved? | 16 s |
| `wire` | How many requests/second over a real socket? | 65 s (needs `wrk`) |
| `edge` | Do the correctness probes pass on the real `workerd` runtime? | 3 s, opt-in (needs `workerd`) |
| `probe` | Does the request path still *behave* — errors answered, headers present, params faithful? | 0.6 s |
| `bookkeeping` | Is every known-failure exemption still backed by a probe? | 0.03 s |
| `hygiene` | Does a comment this change added explain the code, instead of pointing at a planning artifact? | 0.1 s |
| `profile` | Where does per-request time actually go? | minutes — opt-in only |

Two of them (`bookkeeping`, `hygiene`) never start a server or measure time, so they
answer identically every run and are safe as their own CI step. `profile` and `edge` are
deliberately excluded from the default set: one answers "what should I change next" and the
other needs a separate runtime, while the budgeted stages answer "is this change safe".

---

## Reading a run

Sample output:

```
NextRush dev-check  runtime=bun  (5 s)

PASS   bundle.hello-nextrush-root.kb          27.7 KB (+0.0% vs last run)
PASS   cold.n1000.vs_hono                     0.41 (-4.7% vs last run)
INFO   cold.n1000.nextrush                    11.3 ms, 29.4 MB RSS
WARN   inproc.nextrush.vs_hono                2.11 (-1.4% vs last run)      target 1.3
KNOWN  probe.compression-gzip                 content-encoding=undefined    FB-03 - GET /big + Accept-Encoding: gzip

PASS 11  WARN 1  KNOWN 10  FAIL 0  INFO 11
```

Read it in three passes:

1. **The last line.** `FAIL 0` and exit code 0: nothing is broken. A non-zero `FAIL`
   names the reason — a breached budget, a probe failing with no declared exemption, an
   exemption that no longer covers anything, or an added comment pointing at a planning
   artifact.
2. **The `WARN` row.** A `WARN` means the metric is inside its committed `max`/`min` but
   has not reached its `target`. It never fails the build. Here per-request cost is
   `2.11×` Hono against a `target 1.3` — legal, and visibly not done.
3. **The `KNOWN` rows.** These are *observations of real defects*, printed with what was
   seen (`content-encoding=undefined`) and the id that exempts them. A `KNOWN` row
   disappearing is the interesting event: it means the defect is fixed and the id must
   be deleted in the same change, or the gate starts failing on a stale exemption.

`INFO` rows are measurements with no committed rule — context, not verdicts.

### What a status means

```mermaid
flowchart TD
    ROW[one row in the run] --> KIND{which stage produced it?}
    KIND -->|measurement| RULE{inside its committed max or min?}
    RULE -->|no| FAIL[FAIL - the run exits 1]
    RULE -->|yes| TARGET{target declared and missed?}
    TARGET -->|yes| WARN[WARN - logged, never fails the build]
    TARGET -->|no| PASS[PASS]
    KIND -->|probe| EXEMPT{defect id exempt on this runtime?}
    EXEMPT -->|yes| KNOWN[KNOWN - observation printed, build stays green]
    EXEMPT -->|no| FAIL
    KIND -->|bookkeeping or hygiene| CLEAN{clean?}
    CLEAN -->|no| FAIL
    CLEAN -->|yes| PASS
```

---

## Budgets and the ratios

`budgets.json` is the committed truth for every verdict. Each entry may set `max` (hard
fail above), `min` (hard fail below), and `target` (warn until reached). Every entry also
declares `runtimes` (which runtimes it applies to) and `stage` (`bundle`, `cold`, or
`inproc`). A rule is inert if it silently stops being evaluated, so the gate refuses to
evaluate a rule on a runtime it does not list, and the `bookkeeping` finalizer fails a run
when an applicable rule's stage ran but the rule was never gated.

Ratios are **NextRush ÷ the comparable baseline, measured in the same run** — the
comparison runs in the same process and the same minutes, so machine noise cancels
instead of accumulating across two separate benchmark sessions. **Below 1.0 is faster.**

| Key | Meaning | Rule |
| --- | --- | --- |
| `bundle.<entry>.kb` | Bundled size of one entry point | `max` 40–70 KB |
| `cold.n25.vs_hono` | Startup ms ÷ Hono's, at 25 routes | `max` 1.6 |
| `cold.n1000.vs_hono` | Startup ms ÷ Hono's, at 1,000 routes — where registration work shows up | `max` 1.2 |
| `inproc.nextrush.vs_hono` | Per-request µs ÷ Hono's, in-process (**Bun only** — see below) | `max` 1.9, `target` 1.3 |
| `inproc.nextrush.vs_hono.h12` | The same ratio with 12 request headers instead of 4 | `max` 2.0, `target` 1.3 |
| `inproc.post.nextrush.vs_hono` | Parsed-JSON POST µs ÷ Hono's | `max` 3.5, `target` 3.0 |

The POST and 12-header rows are baselines, not endorsements: they make a regression
visible, and their `target` records the number the phase is trying to reach. The POST row
is currently dominated by body-source reading rather than JSON parsing (see the closure
report's finding F-1).

`wire` is deliberately **not** a budget row. It reports the median of three `wrk` runs and
the observed min–max range as `INFO`, because a slow socket result on a shared machine is
not evidence of a code regression. Use the in-process ratio for a gate and `wire` for
context.

The stage also drives a parsed 1 KB JSON POST for NextRush and Hono (`wire.post.*`) with the
same `wrk` settings. Each POST case first sends one request through a raw socket and requires
`200 {"ok":true}`; without that check an entry that 404s or throws would still produce a fast,
plausible request rate. The POST rows are `INFO` for the same reason as the GET rows. On Bun,
Elysia's POST rate is added as a reference point (`wire.post.elysia.rps`).

`inproc` takes the best of three runs per entry. Two samples left a ~40% spread on a loaded
machine, and this ratio is a gate — three halves it for a few seconds of runtime. The committed
`max` was ratcheted from 2.5 to 1.9 only after five consecutive runs landed in 1.02–1.56 across
both runtimes, so it guards a real regression instead of describing the machine it ran on.

**Which adapter an in-proc row measures.** A row must exercise the adapter for the runtime under
test, so each entry selects one and prints it: `inproc.nextrush.us` reports
`adapter-node on node` under `--rt node` and `adapter-bun on bun` under Bun. On Node, `adapter-node`
is driven through its real `createHandler` with a structural `IncomingMessage`/`ServerResponse`
stand-in — the adapter's per-request path (context, dispatch, body parsing, response building)
without `node:http`'s own object construction, which the `wire` stage measures over a real socket.
`inproc.nextrush.web.us` is the labelled control: the Web runner on whatever runtime executes it, so
the two adapters can be compared on one machine. Measured `2026-10-19` under `--rt node` on this box:
**11.40 µs** for the Web runner on Node against **0.81 µs** for the Node adapter — the difference is
the adapter and its request model, not the framework.

**The Node ratio is deliberately not gated.** The NextRush arm takes node:http objects while the raw
floor and Hono build a `Request` per iteration, and that platform cost dominates both of them. A
ratio between them would report the harness difference (`0.08`) as a framework result. Use the Bun
ratio for a gated cross-framework number; use `wire` for context on either runtime, and the Node
in-proc row for NextRush against itself over time.

The `INFO`-only numbers worth watching:

- **`inproc.raw.us`** — a bare fetch-style function that returns `Response.json(…)` with a
  real `Request` constructed per iteration. This is the floor: it is the cheapest a
  runtime-aware handler can be with no framework involved, so it is the number to compare
  a ratio against before declaring a framework cost "too high".
- **`inproc.nextrush.no-timeout.us`** and the printed difference — what the request
  timeout race costs per request. Useful when deciding whether a timeout design is
  affordable.
- **`cold.n*.nextrush` RSS** — startup memory, which grows with route count.
- **`inproc.nextrush.h12.us` / `inproc.hono.h12.us`** — the same GET with 12 headers, so a
  header-parsing regression is visible separately from the 4-header baseline.
- **`inproc.post.nextrush.us` / `inproc.post.hono.us`** — a parsed-JSON POST with the
  same request count on both arms. The pair attributes body-reading and parser cost; the
  ratio row is gated on Bun.

---

## Built output alongside source

The source graph is the gate. `--built` adds a second pass that resolves each
`nextrush` / `@nextrush/*` import to `packages/*/dist/index.js`, so the same stages report
what the published build does as well. Built rows are prefixed `built.`, are always `INFO`,
and keep separate keys in `.out/last-run.<runtime>.json`; they never satisfy or fail a source
budget.

The pass runs a preflight once: a missing `dist/index.js` stops the run with the path and
`pnpm build` in the message, and a package whose source is newer than its output is a
`WARN built.stale` row. A stale warning means the built number is still worth reading, but
it describes an older source graph. Run `pnpm build` first when the two passes should be
comparable. The built bundle is larger than the source bundle because `dist/` is tsdown
output, not a re-minified source graph — compare built rows across runs, not to source rows.

## Edge (opt-in)

`edge` is a probe-only leg against the actual `workerd` runtime, not a shim. It bundles
`edge-worker` with `@nextrush/adapter-edge` (the Cloudflare handler), writes a pinned
`workerd` config next to the bundle, starts it on `127.0.0.1:4400`, and runs the same probe
registry as the other runtimes. Passing rows are `INFO`, a failure is `FAIL` unless a
runtime-scoped exemption covers it (`KNOWN`), and a missing binary is a `WARN` with the reason
rather than a silent pass. The stage is not in the default set and has no budget or CI step;
it exists to prove the Edge adapter works on the runtime users actually deploy to.

`workerd` is an exact-pinned devDependency (Apache-2.0). The config's compatibility date is
pinned with the binary, so a runtime upgrade is a deliberate change. If the binary is absent,
run `pnpm install`.

## Elysia reference arm (Bun-only)

Elysia is a reference point, not a target: `bundle`, `cold` and `wire` add
`bundle.hello-elysia.kb`, `cold.n*.elysia` and `wire.elysia.rps` on Bun, each labelled
`Bun-only`, and none is gated. Elysia 1.4.30 is MIT-licensed and exact-pinned. The arm is not
run on Node or Deno because Elysia's server path is Bun-specific and a cross-runtime number
would describe the harness, not the framework.

## Deno

`--rt deno` runs the same stages against the Deno adapter. Entries are bundled once with
Bun's bundler (`ctx.target` stays `bun`; Bun has no Deno target and the entries are
runtime-neutral) and executed with `deno run --allow-all --quiet`. Every Deno row is
`INFO`: there are no Deno budgets yet, and the ratio rows would compare different request
models if they were gated. `bundle` measures the root, Deno-adapter and Hono entries and
reports Fastify as an explicit `WARN skipped`; `cold`, `inproc`, `wire` and `probe` run their
Deno-capable arms; `profile` refuses Deno with a `WARN` because the profiling stage is
Bun/Node only.

The probe registry is the same one Bun and Node run. `FB-03` is a Deno-only known failure for
`compression-gzip`: `@nextrush/compression` has no Web response path yet, which is the
runtime-parity gap tracked separately from the Bun/Node response-commit fix. The probe still
runs, reports what it observed, and shows as `KNOWN` instead of failing the Deno leg.

## Known failures

A real defect that is not fixed yet should stay *visible* without turning the build red:
the probe keeps running, keeps reporting what it observed, and is reported as `KNOWN`.

`knownFailures` maps a defect id to the runtimes it applies to — `"*"` for all, or a list
such as `["node"]` when the platform itself normalises the problem away on other
runtimes. That scoping is what keeps `KNOWN` honest: an exemption that cannot apply to a
runtime is not silently extended to it.

The mechanism rots in two ways, and the toolkit fails the run for both:

| Rot | Detected by | Why it matters |
| --- | --- | --- |
| An id no probe references | `bookkeeping` | The exemption outlives the probe that justified it, so nothing will ever turn red for it again |
| An id whose probes all **pass** on a runtime it applies to | `probe` (stale exemption) | The defect is fixed but the id stayed, so the probe silently stopped guarding anything |

The second is the important one, and it is why the rule is **delete the id in the same
change that fixes the defect**. A fixed defect's probe then becomes a permanent
regression guard instead of a permanent exemption.

---

## Adding a probe

Probes live in `lib/probe-registry.mjs`, one small object each: an `id`, the `bug` id it
is evidence for (or `null` if it guards behaviour rather than a specific defect), a
`desc` phrased as the expectation, and an async `run(ctx, port)` that returns
`[passed, note]`. Write the note as the observation (`status=500 timedOut=false`), not as
a restatement of the verdict.

Then serve whatever the probe needs from `entries/probe-server.ts`. A probe that
regresses a budget belongs in the stage that owns that measurement instead — probes are
for behaviour, not for cost.

Verified with `node apps/benchmark/scripts/dev-check/check.mjs probe`.

## Adding a profile entry

Profile entries are small apps under `entries/`, bundled from source by `lib/build.ts` and run
under the runtime's own CPU profiler. Pick the entry that isolates the shape you are asking about:

| Entry | Shape | Env |
| --- | --- | --- |
| `inproc-nextrush` | `GET /`, zero middleware, through the adapter for the runtime | `N`, `HEADERS`, `TIMEOUT` |
| `inproc-nextrush-post` | `POST /echo` through `bodyParser()` with a JSON body | `N`, `HEADERS`, `BODY_BYTES` |
| `inproc-nextrush-post-unparsed` | `POST /echo`, same body read as text, no parser | `N`, `HEADERS`, `BODY_BYTES` |
| `inproc-nextrush-mw` | `GET /` behind five state-writing middleware | `N`, `HEADERS` |
| `inproc-nextrush-web` | Control: the Web runner on any runtime | `N`, `HEADERS` |

Every entry resolves its adapter through `entries/_inproc-adapter.ts`: `adapter-bun` on Bun,
`adapter-node` on Node, with the Node arm driven through `createHandler` and a structural
`IncomingMessage`/`ServerResponse` pair (`entries/_inproc-node.ts`). Each prints
`ADAPTER=… RUNTIME=…` next to its `US=` line, so a number can never be read as belonging to an
adapter that did not produce it.

Run one with `node check.mjs profile --entry inproc-nextrush-post`. Compare
`post` against `post-unparsed` to attribute parser cost, and `mw` against `inproc-nextrush` to
attribute middleware-stack cost. Entries print `US=` (per-request microseconds) so a run is
self-describing; the POST pair and the middleware entry also print the response fingerprint and
middleware count, which `lib/__tests__/profile-entries.test.mjs` uses to prove they answer
identically before their numbers are compared.

The POST entries pre-build their requests before the timed loop: 2,000 warmup requests plus
up to 18,000 timed requests. Constructing a `Request` with a body is platform work (undici/Bun
stream machinery, measured at ~50 us/request) that otherwise swamps the framework cost the
entry exists to measure. A `Request` body is single-use, so the warmup requests are a separate
slice — reusing a consumed request would time an empty body and understate parser cost.

## Adding a stage

A stage gets its own module under `lib/stages/`, receives the context built by
`lib/harness.mjs` (reporting, bundling, and the child-process helpers), and is wired into
`check.mjs` behind a `want('<stage>')` check. Report a gated measurement through
`ctx.gate(name, value, rule)` so it appears in `budgets.json` and in the summary counts;
report context through `ctx.row('INFO', …)`.

Unit tests for the toolkit's own logic live in `lib/__tests__/` and run with
`pnpm --filter nextrush-benchmark test`.

---

## What this toolkit does not prove

Worth knowing before quoting a number from it.

- **In-process cost is not throughput.** `inproc` skips the socket, the HTTP parser, and
  the connection lifecycle. It measures framework tax cheaply and comparably; it does not
  predict requests/second. `wire` is the one that touches a real socket, and its client
  (`wrk`) can itself become the bottleneck — which is why the `raw` floor is printed next
  to it.
- **Allocation volume is not measured.** `inproc` reports time, not bytes. Both candidate counters were
  tested and rejected: sampled `heapUsed` reports ~5 B/request on Bun regardless of what the path
  allocates (JSC's reported heap does not move with transient allocation), and on Node the same sampling
  sums heap-growth events rather than allocations. A laziness claim is proven by counting the platform
  reads it avoids, in a test — not by a heap figure from here.
- **`probe` speaks raw HTTP on purpose.** Targets are sent exactly as written, because
  what a runtime does to a hostile path is part of what is being measured. A probe
  therefore sees platform behaviour (Bun normalises some dot segments before the
  application sees them) and has to state which runtimes it applies to.
- **It runs on Bun and Node only.** Deno, edge, and serverless adapters are covered by
  the cross-adapter conformance suite, not here.
- **Medians, not guarantees.** `cold` reports the median of 7 fresh processes; `inproc`
  and `wire` take the best of 2. A single run is evidence of direction, not a bound.
- **A committed `max` is a regression guard, not a goal.** `WARN` exists so that a number
  which is legal-but-unfinished stays visible without blocking unrelated work.

---

## Where things live

| Path | Role |
| --- | --- |
| `check.mjs` | Argument parsing, stage dispatch, summary, exit code |
| `budgets.json` | Every committed rule and exemption — the only place a verdict is defined |
| `lib/harness.mjs` | Reporting table, budget gate, bundler, child-process helpers |
| `lib/stages/` | One module per stage |
| `lib/probe-registry.mjs` | The probes, as data plus one predicate each |
| `lib/known-failures.mjs` | Exemption bookkeeping (orphans, stale exemptions) |
| `lib/hygiene.mjs` | Added-comment scanner |
| `entries/` | The tiny apps each stage bundles and runs |
| `lib/__tests__/` | Unit tests for the toolkit's own logic |
