# Benchmark — Engineering Audit Review

| Field            | Value                                                                       |
| ---------------- | --------------------------------------------------------------------------- |
| Subject          | `apps/benchmark` — harness, servers, orchestration, statistics, reports      |
| Authority        | `docs/playbooks/benchmark-review-playbook.md` (Parts 0–IV)                   |
| Repository       | `/home/tanzim/project/framework/nextrush`                                    |
| Branch / commit  | `feat/dev` @ `cefc92d089c7719dd9cadef392fe6d3304bb200d`                      |
| Date             | 2026-07-29                                                                  |
| Auditor role     | Independent reviewer (not a framework contributor)                          |
| Artifacts read   | 20 retained run directories; `results.json`, `scoreboard.json`, `results.csv`, `REPORT.md` |
| Verification run | `validate-parity.js` (executed), `node --test` (executed), independent recomputation of statistics / rankings / CSV |

---

## 1. Executive Summary

**Overall Trust Score: 6.5 / 10.**

**Verdict: the arithmetic can be trusted; the methodology gates and the generated report claims cannot yet be.**

Every number this harness computes from its raw measurements was independently reproduced with zero
mismatches — 336 statistical cells, both multi-scenario ranking tables, and 288 CSV rows. The
statistical implementation, the ranking implementation, and the artifact-to-artifact consistency are
in unusually good shape for a benchmark repository.

The failures are not in the mathematics. They are in three other places:

1. **One scenario cannot measure what it declares** under the default load tool, and no existing gate
   can detect it (P0-001).
2. **The publishability gate omits the one control the harness itself proved is required** for a
   cross-framework ranking, and two artifacts in the repository are consequently published as medal
   rankings from runs the harness classifies as unable to back a ranking (P1-001).
3. **Generated reports assert claims by construction rather than deriving them** from the run they
   describe — including a parity assertion that is printed whether or not the parity gate ran, and a
   scenario count that is demonstrably wrong in the current `latest` report (P1-005).

### Critical risks

| ID | Risk |
| -- | ---- |
| P0-001 | Under `wrk`, every POST scenario sends one hardcoded 46-byte body. `large-post` (declared ≥1 MiB) silently measures the small-body path and returns 200 — invisible to parity, error, and timeout gates. |

### Major risks

| ID | Risk |
| -- | ---- |
| P1-001 | `derivePublishable` ignores `positionControl`; two artifacts marked `publishable: true` render full rankings from fixed-order runs. |
| P1-002 | Raw `results.json` retains stale `publishable: true`; only derived artifacts self-correct — inverting the playbook's evidence hierarchy. |
| P1-003 | `countSocketTimeouts` reads `errors.timeout`; autocannon emits `errors.timeouts`. Saturated autocannon runs can never fail the timeout criterion. |
| P1-004 | `static-file` is declared `identicalWork: true` but measurably writes 163–292 header bytes depending on server (1.65× spread in total response bytes) and does unequal per-request work. |
| P1-005 | Reports assert parity unconditionally and hardcode "8 scenarios do byte-identical work" — false in the current `latest` report. |
| P1-006 | The `Efficiency` table divides one scenario's RPS by CPU/RSS sampled across the entire scenario sweep. |

### Key strengths (verified, not asserted)

- Statistics, rankings, and CSV artifacts independently reproduced — **zero** mismatches.
- Parity gate executed by the auditor: passes for 13 scenarios × 6 servers, with TCP accept-queue
  depth read back **from the OS** (`ss`) rather than trusted from source — and it is fail-closed.
- Invalid-run exclusion behaves exactly as documented: 29.3 M non-2xx responses in the largest
  artifact are correctly attributed entirely to the `error-handling` scenario, with zero cells
  wrongly invalidated.
- `derivePublishable` is computed from what a run actually did, never copied from a profile's
  declaration.
- 136 unit tests, 0 failures. Report generation is a pure derivation of `results.json`.

### Recommended priority

Fix P0-001 and P1-001 before any further measurement. Fix P1-002/003/005/006 before any number
leaves the repository. P2 items are prerequisites for a *publishable* campaign, not for a valid one.

---

## 2. Scope

- **Audited:** `apps/benchmark/**` — `config/`, `servers/`, `scripts/`, `scripts/lib/**`, `wrk/`,
  `results/**`, `README.md`, `package.json`; plus the two `README.md` files that publish claims about
  this benchmark.
- **Frameworks reviewed:** `raw-node`, `nextrush-v3`, `fastify`, `hono`, `koa`, `express`
  (`DEFAULT_FRAMEWORKS`). `nextrush-v3-class` is configured but absent from every retained run.
- **Profiles reviewed:** `quick`, `standard`, `full`, `stress`.
- **Artifacts inspected:** all 20 retained run directories under `results/`, plus `results/latest`.
- **Out of scope (playbook §0.4):** NextRush framework optimization, API design, unrelated security
  review. Framework source was read only where a harness claim depended on it
  (`packages/adapters/node/src/adapter.ts`).

---

## 3. Methodology

**Approach.** Playbook Parts 0 → IV, sequentially. Nothing in the repository — code, comment,
report, or prior audit reference — was treated as correct without independent verification.

**Evidence sources, in playbook §0.9 order.**

| Level | Used |
| ----- | ---- |
| 1 — raw artifacts, source, runtime observation, independent calculation | `results.json` per run; source of every harness module; live execution of `validate-parity.js` and `node --test`; a direct HTTP header probe against all six servers; independent reimplementation of the statistics, ranking, and CSV derivations |
| 2 — generated reports | `REPORT.md`, `scoreboard.json`, `results.csv`, `README-TABLES.md` (verified *against* Level 1, never trusted as source) |
| 3 — documentation | `apps/benchmark/README.md`, root `README.md`, in-source rationale comments |

**Verification methods actually executed.**

1. **Statistics** — reimplemented `mean`, sample stddev (N−1), CV, min, max from each cell's raw
   `runs[].rps` array and diffed against the stored `stats`/`summary` across 5 artifacts / 336 cells.
2. **Rankings** — reimplemented competition ranking, points, wins, average rank, and `maxPoints` from
   `results.json` and diffed against the published `scoreboard.json`.
3. **Artifact consistency** — cross-checked 288 CSV rows (`rps_mean`, `rps_stddev`, `cv_pct`,
   `identical_work`) against `results.json`.
4. **Error attribution** — summed `errors.nonOk` and both timeout key spellings per scenario per
   framework to test whether the invalid-run exclusion behaved as documented.
5. **Fairness gate** — executed `node scripts/validate-parity.js` (all 6 servers, all 13 scenarios).
6. **Direct measurement** — booted each server under the harness's own flags and env
   (`--expose-gc --max-old-space-size=512`, `NODE_ENV=production`) and captured the full response
   header set for the `static-file` scenario.
7. **Claim extraction** — every factual claim in the two READMEs and in the report generators was
   traced to a code or artifact source.

**Limitations and assumptions (stated explicitly).**

- **No new benchmark campaign was run.** Throughput/latency *magnitudes* are therefore taken as
  recorded; this audit verifies their derivation, attribution, and disclosure, not their physical
  accuracy on other hardware.
- **P1-003 and P0-001 impacts are latent, not observed.** No autocannon artifact exists, and no
  retained artifact contains `large-post`. Both were established from code, not from a corrupted
  number. This is stated in each finding rather than inflated into an observed corruption.
- **The magnitude of the static-registration asymmetry (P2-001 discussion) was not measured.** The
  mechanism is code-verified; the size of its effect on competitor throughput is unknown and is
  reported as unknown.
- The audit machine is the same class of environment the artifacts were produced on, which is itself
  a finding (P2-002), not a controlled condition.

---

## 4. Repository Assessment (Playbook Part I)

### 4.1 How the system works today

```
pnpm bench:compare --profile full
        │
        ▼
scripts/run.js ──── config/{profiles,scenarios,frameworks,constants}.js
        │
        ├─ 1. resolve tool (wrk | autocannon), profile, overrides, framework set
        ├─ 2. FAIRNESS PRE-FLIGHT ─── validate-parity.js
        │        boots each server in turn on :8080, fetches all 13 scenarios,
        │        compares status / body / content-type / framing / OS backlog
        │        └─ any mismatch ⇒ process.exit(1)   [fail-closed]
        ├─ 3. capture system info + git provenance + framework versions
        ├─ 4. measure
        │        ├─ rotated  → bench-rotation.js   (restart every framework per repeat,
        │        │                                  rotate who goes first)
        │        └─ fixed    → bench-exec-single.js (one process, N internal repeats)
        │              each pass: start → warm root → per-scenario warm → wrk/autocannon
        │                         → /proc RSS+CPU sampling → optional --trace-gc → stop
        ├─ 5. derivePublishable(recorded config, results)   ← computed, not declared
        ├─ 6. checkRunIdCollision  → refuse to overwrite a differing run id
        ├─ 7. persist results.json (+ one file per framework)
        └─ 8. generateArtifacts → REPORT.md · README-TABLES.md · results.csv · scoreboard.json
                 (pure derivation; re-runnable via generate-report.js without re-measuring)
```

This is a sound pipeline. Each stage has one responsibility, the measurement stage is the only
expensive one, and every view is regenerable from the persisted run. The separation of
`results.json` (truth) from every rendered view (derivation) is the single best architectural
decision in the repository and is what made this audit's independent recomputation possible at all.

### 4.2 Structure, modularity, dependency direction

`scripts/utils.js` is a pure barrel over `scripts/lib/**` with no logic of its own; `lib/` is
decomposed by concern (`logging`, `args`, `time`, `system`, `fsx`, `server`, `metrics`, `stats`,
`parity`, `publishable`, `provenance`, `tools/*`, `report/*`). Statistics, publishability, parity,
and report assembly are all pure and independently testable, and they are in fact tested. Dependency
direction is one-way (`run.js` → `bench-*` → `lib/*` → `config/*`); the one circular-import risk is
explicitly documented and avoided in `bench-exec.js`.

**File sizes** — one violation of the repository's own 300-line hard cap:

| File | Lines |
| ---- | ----- |
| `scripts/run.js` | **393** |
| `scripts/lib/report/scoreboard.js` | 273 |
| `scripts/lib/report/sections-detail.js` | 264 |
| `scripts/lib/report/charts.js` | 255 |

Three sibling modules carry comments stating they were split out specifically "to keep that file
under the repo's 300-line cap." The orchestrator that caused those splits is itself 31% over it.

### 4.3 Dead and deprecated components

- `scripts/report.js` (a legacy results *viewer*) is retained alongside `generate-report.js` (the
  current *generator*), with four `package.json` scripts still pointing at the legacy path.
- `wrk/mixed.lua` is reachable only via `pnpm bench:mixed`, which requires a manually pre-started
  server and feeds no artifact.
- `servers/nextrush-v3-timeout-diagnostic.js` and `servers/nextrush-v3-class.js` are configured but
  appear in no retained run.
- `scripts/results/cpuprof-server-c128/nextrush-c256.cpuprofile` is an untracked 20 KB profiling
  leftover in a `scripts/results/` directory that duplicates the top-level `results/` concept.

### 4.4 Testability, error handling, observability

136 tests across 21 files, 0 failures, covering statistics, publishability, parity helpers,
provenance, run-id collision, report metadata/scoreboard/markdown/charts/analysis, metrics, GC
summary, and option parsing. This is genuinely good coverage of the pure layer.

Two gaps: `rotate()` — the sole mechanism enforcing position counterbalancing, and therefore the
mechanism P1-001 is about — has **no test**; and `warmup-provenance.test.js` asserts regexes against
`run.js`'s *source text* rather than behavior, which locks in an implementation shape rather than a
contract.

Error handling is fail-closed where it matters (parity mismatch, unreadable backlog, run-id
collision, server start timeout all abort). One silent path: `warmupUrl` swallows every warmup error
as a non-fatal log line and records nothing in the artifact, so a run measured against a cold
framework is unrecoverable after the fact.

### 4.5 Resource management

Servers are spawned as child processes with `SIGTERM` → 5 s → `SIGKILL`, plus a 200 ms socket-drain
delay and a 300 ms inter-server sleep in the parity path. `/proc` sampling timers are cleared on
`stop()`. All servers share port 8080 sequentially, which is correct for isolation but makes the
suite non-parallelizable by construction.

---

## 5. Fairness Assessment (Playbook Part II)

### 5.1 What has genuinely been engineered

This harness has had real fairness work done on it, and the audit confirms most of it:

- **`servers/_shared/payloads.js`** makes every response body a single shared source, eliminating
  copy-drift across six servers. Non-deterministic fields (random id, ISO timestamp, dynamic
  `X-Timestamp`) are isolated and normalized by the validator.
- **Header-byte neutrality is deliberate**: `X-Framework` is the constant `'bench'` rather than the
  framework name; Express's `x-powered-by` is disabled; Hono's `application/json` is normalized to
  `application/json; charset=utf-8`; raw-node emits `charset=utf-8` to match.
- **Middleware layers are sync in every framework** (`return next()` / `done()`), with an explicit
  note that an `async` layer would allocate a promise per layer that the sync servers do not pay.
- **Body parsers are per-route**, not global, in every framework.
- **Error handlers are the zero-per-request-cost idiomatic form** in each framework.
- **Koa's `allowedMethods()` was removed** because it made Koa the only server paying a layer for a
  405 behavior no scenario exercises and no competitor provides.
- **Response framing parity is checked symmetrically**, not against the reference — because the bug
  it exists to catch was the reference itself omitting `Content-Length`.
- **TCP accept-queue depth is read back from the OS via `ss`**, not trusted from each server's
  source argument, and unreadability is a failure rather than a silent pass.

I executed the gate. It passes:

```
✓ Parity OK — 6 servers agree on bodies, content types, statuses, and middleware headers.
  Accept-queue backlog equal across all servers:
  raw-node=1024, nextrush-v3=1024, fastify=1024, hono=1024, koa=1024, express=1024
```

### 5.2 Where equivalence does not hold

**Measured, not inferred.** For `static-file` — declared `identicalWork: true` — I booted each server
under the harness's own flags and captured the real response headers:

| Server | Header bytes | Headers beyond the raw-node set |
| ------ | -----------: | ------------------------------- |
| `raw-node` | 163 | — (baseline: connection, content-length, content-type, date, keep-alive) |
| `hono` | 209 | `last-modified` |
| `koa` | 235 | `cache-control`, `last-modified` |
| `nextrush-v3` | 284 | `accept-ranges`, `etag`, `last-modified`, `x-content-type-options` |
| `express` | 291 | `accept-ranges`, `cache-control`, `etag`, `last-modified` |
| `fastify` | 292 | `accept-ranges`, `cache-control`, `etag`, `last-modified` |

With a 36-byte body, total response size ranges 199 → 328 bytes: a **1.65× spread** in a scenario the
configuration declares byte-identical. The per-request *work* differs too — `raw-node` performs a
bare `readFile` with no `stat`, while the others `stat` and format `Last-Modified`/`ETag` per
request. The parity gate passes it because it compares body, content-type, content-length, framing,
and backlog — never the full header set. See P1-004.

**Registration asymmetry for static serving.** `nextrush-v3.js` registers static as a *route* and
documents precisely why: an `app.use()` layer cost NextRush 2.1× on `hello-world` (23.7k → 11.2k RPS
@128c) and, even with a prefix short-circuit, pushed `compose()` off its `len === 1` fast path for
+725 B/req on every request. Koa's static is likewise a route (with its own documented rationale).
Express (`app.use('/static', …)`) and Hono (`app.use('/static/*', …)`) remain middleware layers, so
they retain a per-request path-match that NextRush and Koa avoid.

Each choice is idiomatic and each is documented in-source. But the direction of the residual
asymmetry favors the two servers that avoided a layer, the magnitude is unmeasured, and **no
generated report discloses any of it**. This is reported as a disclosure gap with an unquantified
effect — not as demonstrated unfairness, because it has not been measured.

**Declared-versus-actual work under `wrk`.** See P0-001: `large-post`'s measured body is not its
declared body.

**`raw-node` is a ceiling, not a peer.** Its router is an ordered `if`/`startsWith` chain over the
exact scenario paths, with no route table, no context object, and no parameter parsing infrastructure
— which is the correct definition of a zero-framework baseline, but means `identicalWork: true` is a
statement about *response bytes*, not about internal work. Every "overhead vs raw Node" percentage
should be read with that in mind; the reports label it "baseline" but never state this distinction.

**`error-handling` bodies differ by design and are disclosed.** Koa deliberately does not import
`ERROR_BODY` and returns its built-in plain-text 500, while the others return JSON. The scenario is
correctly flagged `identicalWork: false`, excluded from the headline score, and tagged idiomatic.
Verified correct.

### 5.3 Runtime configuration matrix

| Parameter | Value | Equal across servers? |
| --------- | ----- | --------------------- |
| Node.js | v26.4.0 | Yes (one process spawner) |
| V8 flags | `--expose-gc --max-old-space-size=512` | Yes — uniform value; **note** a uniform 512 MB cap is not a uniform *effect* across frameworks with different baseline heaps |
| `NODE_ENV` | `production` | Yes — verified in `lib/server.js` |
| Port / host | 8080 | Yes |
| TCP backlog | 1024 | **Effectively yes, verified from the OS.** 5 of 7 servers pass it explicitly; `nextrush-v3` and `nextrush-v3-class` inherit `adapter.ts:43 DEFAULT_LISTEN_BACKLOG = 1024` implicitly (see P2-001) |
| Logger | disabled everywhere (`logger: false`, `app.silent`) | Yes |
| Compression | none anywhere | Yes |
| Schema validation | none anywhere | Yes |
| Body limit | raised to 5 MB on `/large-post` in all six | Yes |
| Pipelining | 1 (disabled) | Yes |
| Keep-alive / timeout | NextRush's effective values are captured; competitors' are not | **No** — only NextRush's post-default values are recorded (`captureNextRushEffectiveOptions`) |
| CPU pinning | `off` in every retained run | Yes (equally absent) |

### 5.4 Experimental design, environment, cache, GC, hardware

**Design (on paper): strong.** Per-scenario warmup in addition to framework warmup; explicit
cooldowns and inter-test pauses; invalid-run exclusion from the mean rather than mere flagging;
latency aggregated as the median of each percentile across valid runs; and rotation that
counterbalances a *measured* position effect ("the framework measured FIRST in an invocation scores
materially lower … reversible by swapping which one goes first"). Rotation is chosen over random
reshuffling with a stated reason: exact position balance when `runs` is a multiple of the framework
count.

**Environment: the weak link.** Every retained artifact was produced on an Intel i5-8300H — a 4-core
/ 8-thread *mobile* CPU with aggressive turbo and thermal behavior — with `cpuPinning: "off"`, 39 h
host uptime, 6.64 of 15.46 GB free, and `wrk` running 4 threads on the same 8 logical cores as the
server. `getSystemInfo()` records no load average, no CPU governor, no turbo state, and no thermal
state. The harness's own source comment (`lib/tools/wrk.js`) states that exactly this unpinned
client/server contention is what made a prior routing investigation inconclusive. See P2-002. This
is partly mitigated: the root README already withdraws published figures pending re-measurement on a
"clean, CPU-pinned environment."

**Cache / JIT:** addressed via two-stage warmup. **GC:** opt-in `--trace-gc`, parsed from *both*
stdout and stderr after a documented incident where "GC events: —" was misread as "zero GC events"
rather than "GC never measured" — a good fix. **Hardware:** unaddressed beyond optional `taskset`.

### 5.5 Anti-cheating audit

I searched specifically for framework detection, benchmark-only branches, conditional execution,
hardcoded responses, cached responses, and skipped work. **None found.** There is no
`if (framework === …)` anywhere in the servers or harness; the diagnostic-only
`/__elu-sample` route is explicitly excluded from `scenarios.js` and from the parity probe; the
diagnostic server file is never referenced by a measured run. The only per-framework special-casing
that exists is the *equalizing* kind (Hono's charset normalization, Express's `x-powered-by`
disable), which reduces rather than creates bias.

The fairness problems in this benchmark are **omissions in the checkers and disclosures**, not
manipulations in the servers.

---

## 6. Measurement Verification (Playbook Part III)

### 6.1 Raw artifact validation

20 run directories; every one that contains `results.json` also contains `scoreboard.json`,
`results.csv`, `README-TABLES.md`, `REPORT.md`, and one JSON per framework. `results/latest` is a
byte copy of its source run. Two directories (`2026-07-29T03-36-30`, `2026-07-28T10-58-17`) are
empty — aborted runs, harmless but uncleaned. Run-id collision is actively defended
(`checkRunIdCollision`, tested), after a documented prior defect that produced two directories
embedding the same run id.

`results/` is entirely gitignored except a `results/baseline/` exception — and `results/baseline/`
does not exist (see P2-006). No artifact backing any published figure is committed.

### 6.2 Statistical validation — independently recomputed

| Artifact | Cells | Stat mismatches |
| -------- | ----: | --------------: |
| `2026-07-27T15-42-50` | 180 | **0** |
| `2026-07-28T11-05-40` | 60 | **0** |
| `2026-07-29T02-29-52` | 24 | **0** |
| `2026-07-29T04-40-36` | 24 | **0** |
| `latest` (`2026-07-29T06-45-12`) | 48 | **0** |

Recomputed independently: `mean`, sample stddev with the N−1 divisor (population N for N=1), CV as
`stddev/mean × 100` from *unrounded* inputs, `min`, `max`, and `summary.*` desync. Rounding is
applied only at the boundary. `computeStats` is correct.

**Not computed anywhere:** confidence intervals, margin of error, or any significance test — all
listed in playbook §3.5. `withinNoiseOfNext` (a stddev-overlap heuristic) is the only uncertainty
signal, and it never influences a score (P2-003).

### 6.3 Ranking and score verification — independently recomputed

| Artifact | Independent result | Published `scoreboard.json` | Match |
| -------- | ------------------ | --------------------------- | ----- |
| `2026-07-27T15-42-50` | raw-node 139p/19w/avg1.2 · fastify 112/0/2.3 · hono 91/0/3.2 · nextrush-v3 90/5/3.3 · koa 45/0/5.1 · express 27/0/5.9 · max 144 | identical | ✅ |
| `2026-07-28T11-05-40` | raw-node 46p/6w/avg1.3 · fastify 42/2/1.8 · hono 31/0/3.1 · nextrush-v3 25/0/3.9 · koa 15/0/5.1 · express 9/0/5.9 · max 48 | identical | ✅ |

Competition ranking, tie handling, `points = count − (rank − 1)`, wins, average rank, and
`maxPoints = scenarios × levels × frameworks` all reproduce exactly. Overhead-vs-baseline
(`(1 − rps/baseRps) × 100`) reproduces exactly. The scoring *implementation* is correct; its
*design* is critiqued in P2-003.

### 6.4 Error attribution

`2026-07-27T15-42-50` records 29,328,163 non-2xx responses and **zero** invalid cells. This is
correct, not a defect: every one of them is in `error-handling`, whose `expectStatus` is 500, and
`isInvalidRun` correctly exempts error scenarios. Verified by per-scenario attribution.

`2026-07-28T11-05-40` records 6,537 socket timeouts spread across all six frameworks, concentrated
entirely at c512 — a saturated run. Under the current gate it would be non-publishable; its raw
artifact still says `publishable: true` (P1-002).

### 6.5 Report and CSV verification

288 CSV rows cross-checked against `results.json` (`rps_mean`, `rps_stddev`, `cv_pct`,
`identical_work`): **0 mismatches**. The `identical_work` column correctly reflects scenario metadata
in every row.

`REPORT.md` faithfully renders the underlying data *where it renders data*. The defects are in what
it **asserts** rather than derives (P1-005), what it **omits** (P2-001, P2-005), and one derived
metric that combines mismatched measurement windows (P1-006).

### 6.6 Chart verification

Chart builders are pure string emitters, unit-tested, and correctly handle Mermaid's lack of a quote
escape. Axis ordering, `headroom()` scaling, sorting (RPS descending, latency ascending), and the
Okabe-Ito colorblind-safe palette are all sound. The quadrant chart explicitly documents that its
axes are run-relative. One fidelity defect: a missing cell is plotted as **0**, not as a gap
(P2-004).

### 6.7 Traceability and reproducibility

Traceability is strong *within* a run: `REPORT.md` → `scoreboard.json` → `results.json` →
per-framework JSON → recorded config → git commit + dirty flag + tool version + framework versions.
`generate-report.js` correctly refuses to substitute today's installed versions for a run that did
not record them, labeling the fallback instead.

Reproducibility *across* time is weak: no artifact is committed, no baseline exists, the machine is
uncontrolled, and — per this audit's own criteria — **no retained artifact simultaneously satisfies
`runs ≥ 3`, ≥ 2 concurrency levels, ≥ 10 s duration, zero socket timeouts, and rotated position
control.** Zero currently-publishable runs exist in the repository.

---

## 7. Findings

### P0-001 — Under `wrk`, every POST scenario sends one hardcoded 46-byte body; `large-post` cannot measure a ≥1 MiB body

- **Severity:** P0 · **Category:** Measurement / Scientific Methodology · **Confidence:** High
- **Description.** `bench-exec.js` selects the load-generator payload by method, not by scenario:
  `if (opts.scenario.method === 'POST') wrkOpts.script = 'post-json.lua'`. `wrk/post-json.lua`
  hardcodes `wrk.body = '{"name":"John Doe","email":"john@example.com"}'` (46 bytes). Both POST
  scenarios therefore receive that body under `wrk`. `config/scenarios.js` declares `large-post`'s
  body as `LARGE_POST_BODY` (built to a 1,572,864-byte target) and describes the scenario as "A
  request body at or above 1MB". The autocannon path (`runAutocannon`) *does* forward
  `opts.scenario.body`, so the two tools measure materially different workloads under one scenario id.
- **Evidence.**
  - `apps/benchmark/scripts/bench-exec.js` — `runBenchmark`, wrk branch.
  - `apps/benchmark/wrk/post-json.lua` — hardcoded `wrk.body`.
  - `apps/benchmark/config/scenarios.js` — `buildLargePostBody()`, `target = 1_572_864`.
  - `apps/benchmark/scripts/lib/tools/autocannon.js` — `if (body) opts.body = body`.
  - No retained artifact contains `large-post` (all 20 `configuration.scenarios` arrays checked).
- **Impact.** Every gate passes while the measurement is wrong: the servers parse the 46-byte body,
  find no `items` array, respond `200 {"received":true,"itemCount":0}` — so no non-2xx, no timeout,
  no parity failure, no visible anomaly. `wrk` is the default tool whenever installed and is the tool
  the README's publishable path uses. The first full-suite run will therefore publish a
  "Large POST Body" figure that measures the small-body path. Secondarily, `post-json`'s wrk body is
  a *duplicate literal* of the scenarios.js body rather than an import — the exact silent-drift
  failure mode `_shared/payloads.js` was created to eliminate.
- **Recommendation.** Generate the wrk script (or its body file) per scenario from
  `config/scenarios.js` at run time instead of shipping one static Lua file, and assert in the
  harness that the load generator's request body is byte-identical to the scenario's declared body
  before timing — the same class of check `validate-parity.js` already applies to responses. Extend
  the parity gate to compare the *response to the load generator's actual request*, so a
  request-side mismatch can never again be invisible.

### P1-001 — Publishability gate ignores position control; fixed-order runs are published as medal rankings

- **Severity:** P1 · **Category:** Scientific Methodology / Statistics · **Confidence:** High
- **Description.** Three code paths disagree about what makes a ranking valid.
  `run.js` computes `useRotation = frameworkIds.length > 1 && runs > 1 && (rotationRequested ||
  profile.publishable)` and prints `Position control: … fixed — NOT publishable as a ranking`.
  `publishable.js#derivePublishable` never inspects `positionControl` — it checks only runs,
  concurrency levels, duration, and timeouts. And `sections-scoreboard.js` suppresses the scoreboard
  **only** when `positionControl === 'fixed'`, while `sections-metadata.js` uses the wider
  `config.positionControl ?? config.order` fallback.
- **Evidence.**
  - `scripts/lib/publishable.js` — `derivePublishable` criteria list.
  - `scripts/run.js` — `useRotation` expression and the "fixed — NOT publishable as a ranking" log.
  - `scripts/lib/report/sections-scoreboard.js` — `if (positionControl === 'fixed')` guard.
  - `scripts/lib/report/sections-metadata.js` — `orNotRecorded(config.positionControl ?? config.order)`.
  - `2026-07-27T15-42-50/results.json` → `positionControl: null`, `order: "fixed"`,
    `publishable: true`; its `REPORT.md` contains **0** occurrences of "Not a ranking" and does
    contain `- **Overall (like-for-like): 🥇 Raw Node.js** — 139/144 pts, 19 scenario win(s)`; its
    metadata table nonetheless prints `| Framework order | fixed |`.
  - `2026-07-28T11-05-40` — same pattern.
- **Impact.** The harness has a *measured* position effect ("materially lower … reversible by
  swapping which one goes first"), documents that a fixed order cannot back a ranking, and then
  publishes two medal rankings from fixed-order runs — because the warning keys on a field those
  runs predate while the metadata table keys on a fallback the warning lacks. A consumer reading
  either report sees a ranked scoreboard with no caveat.
- **Recommendation.** (1) Add position control to `derivePublishable`: a multi-framework run is not
  publishable unless `positionControl === 'rotated'`. (2) Give the warning guard the same
  `positionControl ?? order` fallback the metadata table already uses, and treat a *missing* value as
  unverified rather than as passing. (3) Add unit tests for `rotate()` and for the
  publishable-requires-rotation rule.

### P1-002 — Raw `results.json` retains a stale `publishable: true`; only derived artifacts self-correct

- **Severity:** P1 · **Category:** Calculation / Repository · **Confidence:** High
- **Description.** `withRecomputedPublishable` is applied in `generate-report.js` only. It corrects
  `REPORT.md` and `scoreboard.json` at render time and is never written back to `results.json`.
- **Evidence.** `2026-07-28T11-05-40/results.json` → `publishable: true`, `publishableReason: null`,
  `configuration.runs: 1`, and 6,537 independently-counted socket timeouts — two independent grounds
  for rejection under the current gate. Same directory: `scoreboard.json` → `publishable: false`;
  `REPORT.md` → "(NOT publishable)". `scripts/lib/publishable.js` — `withRecomputedPublishable` has
  exactly one caller.
- **Impact.** Playbook §0.9 ranks raw artifacts *above* generated reports, so the highest-confidence
  artifact carries the wrong value while the lower-confidence one is right — the inverse of the
  intended hierarchy. This is not cosmetic: `check-regression.js` reads
  `results.json.publishable` directly, so the CI gate consumes the stale flag.
- **Recommendation.** Persist the recomputation: when `generate-report.js` corrects a flag, rewrite
  `results.json` (or emit an adjacent `publishable.json` verdict file) and log the correction. Have
  `check-regression.js` call `withRecomputedPublishable` rather than reading the stored field.

### P1-003 — Socket-timeout key mismatch: autocannon runs can never fail the timeout criterion

- **Severity:** P1 · **Category:** Calculation · **Confidence:** High
- **Description.** The two load-generator adapters emit different error shapes and the publishability
  gate reads only one of them.
- **Evidence.**
  - `scripts/lib/tools/autocannon.js` — `errors: { total, timeouts: result.timeouts || 0, nonOk }`.
  - `scripts/lib/tools/wrk.js` — `result.errors = { connect, read, write, timeout }`.
  - `scripts/lib/publishable.js` — `total += run.errors?.timeout ?? 0;` (singular only).
- **Impact.** "Zero socket timeouts" is one of four publishability criteria and is unreachable for
  autocannon runs: a fully saturated autocannon sweep is stamped `publishable: true`. `nonOk` happens
  to agree across both adapters, so the invalid-run path is unaffected. No autocannon artifact exists
  in the repository, so the impact is latent rather than observed.
- **Recommendation.** Normalize the error shape at the adapter boundary into one documented schema
  (`{ nonOk, timeouts, connect, read, write, total }`) and read only that schema downstream. Add a
  unit test asserting `derivePublishable` rejects a run with timeouts recorded under *either*
  historical spelling.

### P1-004 — `static-file` is declared `identicalWork: true` but performs unequal work and writes 1.65× different response bytes

- **Severity:** P1 · **Category:** Fairness · **Confidence:** High (mechanism code-verified and effect directly measured; throughput impact unquantified)
- **Description.** The parity gate compares status, body, content-type, `Content-Length`/framing, and
  OS backlog. It does **not** compare the full response header set on any scenario — only the five
  named middleware headers on `middleware-stack`. For `static-file`, each framework's own static
  middleware emits a different header set, and `raw-node` performs a bare `readFile` with no `stat`
  while the others `stat` and format `Last-Modified`/`ETag` per request.
- **Evidence.** Direct measurement (each server booted under the harness's own flags and env):
  `raw-node` 163 B · `hono` 209 B · `koa` 235 B · `nextrush-v3` 284 B · `express` 291 B ·
  `fastify` 292 B of response headers, against a 36-byte body — total 199 → 328 B. Header sets in
  §5.2. Checker scope: `scripts/validate-parity.js` (comparison loop) and
  `scripts/lib/parity.js#checkFramingParity` (reads only `content-length` / `transfer-encoding`).
  `config/scenarios.js` declares `static-file` `identicalWork: true`.
- **Impact.** A scenario in the *headline like-for-like score* is not like-for-like: servers write up
  to 65% more bytes per response and perform an extra filesystem `stat`. The bias direction favors
  `raw-node` (the baseline) and `hono`, which inflates the measured "overhead vs raw Node" for this
  scenario specifically. `nextrush-v3` is among the *disfavored* servers here, so this is not a
  self-serving asymmetry — it is a correctness gap in the fairness gate. No published number is
  affected yet because `static-file` has never been measured (P2-007).
- **Recommendation.** Either (a) reclassify `static-file` as `identicalWork: false` and score it
  separately, alongside `middleware-stack` and `error-handling`, with the header divergence
  documented; or (b) equalize the emitted header set explicitly (as was already done for
  `x-powered-by` and Hono's charset) and add a full-header-set parity check — comparing sorted header
  names and total header bytes — to `validate-parity.js` for every `identicalWork` scenario. Option
  (a) is the honest default; option (b) is the stronger fix if the scenario must stay in the
  headline.

### P1-005 — Reports assert parity unconditionally and hardcode a scenario count that contradicts the run

- **Severity:** P1 · **Category:** Documentation / Report Generation · **Confidence:** High
- **Description.** `methodologySection` emits two claims as static strings rather than deriving them
  from the run being reported.
- **Evidence.**
  - `scripts/lib/report/sections-detail.js:234` — the parity line is a literal, emitted with no
    reference to whether the gate ran. `run.js` skips parity when `--no-validate` is passed **or**
    when only one framework is selected, and records *nothing* about parity in `results.json` either
    way — so the claim is unfalsifiable from the artifact.
  - Same function — `'- **Scenario fairness:** 8 scenarios do byte-identical work. …'` hardcoded.
    `results/latest/REPORT.md:653` states this for a run whose `configuration.scenarios` is
    `["hello-world","route-params","post-json","middleware-stack"]` — 4 scenarios, of which 3 are
    like-for-like. `scoreboard.likeForLikeScenarioIds.length` is already available at that point.
  - The parity claim is also over-broad: bodies and content-types are compared only for
    `identicalWork` scenarios, never for `middleware-stack` or `error-handling`.
- **Impact.** Two claims in every generated report violate playbook §0.8 (falsifiability) and §3.10
  (claim verification). One of them is verifiably false in the current `latest` report. A reader
  cannot distinguish a parity-validated run from a `--no-validate` run by reading its report.
- **Recommendation.** Record the parity outcome in `results.json` (`{ validated: bool, skipped:
  reason, frameworks, failures }`) and render that field, stating "parity not validated for this run"
  when absent. Derive the scenario-fairness sentence from `likeForLikeScenarioIds.length` and name
  the excluded scenarios from the data rather than from a literal.

### P1-006 — The `Efficiency` table divides one scenario's RPS by CPU/RSS sampled across the whole sweep

- **Severity:** P1 · **Category:** Calculation · **Confidence:** High
- **Description.** `/proc` sampling starts once per framework *before* the scenario loop and stops
  *after* every scenario and concurrency level. `efficiencySection` then pairs a single cell's RPS —
  `cells[fw][scenarios[0]][primaryConnection].rps` — with `fw.cpu.cpuAvgPct` and `fw.memory.rssPeak`,
  under a heading that attributes both to that one scenario and level.
- **Evidence.** `scripts/bench-exec-single.js` and `scripts/bench-rotation.js` —
  `startMetricsSampling(...)` before `for (const scenario of scenarios)`, `metrics.stop()` after it.
  `scripts/lib/report/sections-detail.js#efficiencySection` — the `perCpu` / `perMb` computation.
  `results/latest/REPORT.md:530` — `## Efficiency — Hello World @ 128 connections`. Under rotation,
  `bench-rotation.js#averageMetric` additionally takes the arithmetic mean of per-pass `rssPeak`
  values — the mean of maxima, which is neither a mean nor a maximum.
- **Impact.** "RPS per CPU%" and "RPS per MB" combine a quantity measured over ~10–60 s of one
  scenario at one concurrency level with a quantity averaged over the entire multi-scenario,
  multi-concurrency sweep. The published caveat warns about `/proc` coarseness and RSS reclamation
  but never mentions the window mismatch, so the numbers read as scenario-specific cost.
- **Recommendation.** Either sample per scenario/concurrency cell and compute the ratio within one
  window, or relabel the section as a whole-sweep aggregate ("CPU and RSS are averaged across all
  scenarios and concurrency levels in this run") and remove the per-scenario heading. Replace
  `averageMetric`'s treatment of `rssPeak` with `max` across passes.

### P2-001 — Self-imposed backlog disclosure is unmet, and `constants.js` states a false invariant

- **Severity:** P2 · **Category:** Documentation / Configuration · **Confidence:** High
- **Evidence.** `config/constants.js` asserts "Every server now passes this same value explicitly"
  and "the generated report **must** disclose that rather than presenting 1024 as their native
  behavior." In fact `grep -ln LISTEN_BACKLOG servers/*.js` returns 5 of 7 —
  `nextrush-v3.js` and `nextrush-v3-class.js` call `listen(app, PORT)` and inherit
  `packages/adapters/node/src/adapter.ts:43`'s hardcoded `DEFAULT_LISTEN_BACKLOG = 1024`. No report
  generator mentions backlog at all (`grep -rn backlog scripts/lib/report/ scripts/report-md.js` →
  no matches).
- **Impact.** Three separate issues. (1) The stated invariant is false. (2) The value 1024 is
  duplicated across two packages with no compile-time or test-time linkage; a change to the adapter
  default would silently diverge NextRush from the five explicit servers, caught only by the runtime
  `ss` check — which is skipped entirely under `--no-validate`. (3) The harness raises the
  competitors above Node's native 511 and the disclosure it demands of itself appears in no report,
  so a reader sees no indication that competitor accept-queue behavior was overridden.
- **Recommendation.** Import the constant (or assert equality in a test) so the two values cannot
  drift; pass `LISTEN_BACKLOG` explicitly in the NextRush servers so the invariant becomes true; and
  render the effective backlog plus the "overrides framework defaults" note in the report's Load
  Configuration table.

### P2-002 — Measurement environment is thermally constrained and uncontrolled; client and server share 8 threads unpinned

- **Severity:** P2 · **Category:** Scientific Methodology · **Confidence:** High
- **Evidence.** `results/latest/results.json.system` → `cpuModel: "Intel(R) Core(TM) i5-8300H CPU @
  2.30GHz"` (4C/8T mobile), `cpuCores: 8`, `cpuPinning: "off"`, `uptime: "39h"`, `freeMemory: 6.64 GB`
  of `15.46 GB`. `profiles.js` — `threads: Math.min(cpuThreads, 4)` for the load generator, on the
  same machine. `grep -rn "loadavg\|governor\|thermal\|turbo" scripts/ config/` → no matches.
  `scripts/lib/tools/wrk.js` states in-source that unpinned client/server contention is what made a
  prior routing investigation inconclusive.
- **Impact.** Turbo/thermal drift and client/server CPU contention are first-order confounds on this
  hardware, and neither is recorded, so a reader cannot assess whether a 3% difference is a framework
  property or a thermal one. Partly mitigated by the root README already withdrawing published
  figures pending a "clean, CPU-pinned environment."
- **Recommendation.** Make `--pin` + `--client-pin` mandatory for a publishable run (fail rather than
  warn when `taskset` is unavailable), and extend `getSystemInfo()` to record `os.loadavg()`, the CPU
  governor, and turbo/thermal state at run start and end so drift within a run is visible after the
  fact.

### P2-003 — Rank-points aggregation discards magnitude, blends measurement regimes, and ignores its own noise flag

- **Severity:** P2 · **Category:** Statistics · **Confidence:** High
- **Evidence.** `scoreboard.js#rankEntries` → `points = count - (rank - 1)`; `withinNoiseOfNext` is
  computed and documented as "it never alters points"; `buildOverall(rankings,
  likeForLikeScenarioIds, connections, frameworks)` sums with equal weight across every scenario and
  every concurrency level — including c1, which `methodologySection` itself describes as measuring
  "per-request latency, not throughput".
- **Impact.** A 0.1% win and a 50% win are worth the same point. The headline ordering can therefore
  be decided by gaps the harness has already flagged as statistically meaningless, and a serial
  latency regime is folded into a throughput ranking. `pointsPerConnection` exists and would let a
  reader separate the regimes, but the headline does not use it.
- **Recommendation.** Exclude the lowest concurrency level from the aggregate (or publish
  `pointsPerConnection` as the headline and the blended total as secondary); and make
  `withinNoiseOfNext` consequential — award a shared rank when the gap is inside the combined stddev,
  so a statistical tie scores as a tie.

### P2-004 — Charts plot missing data as zero

- **Severity:** P2 · **Category:** Report Generation · **Confidence:** High
- **Evidence.** `charts.js#concurrencyScalingChart` → `const points = s.values.map((v) => (v === null
  ? 0 : Math.round(v)))`. `charts.js#scenarioProfileRadar` → `return rps && top ? Math.round(...) :
  0`.
- **Impact.** An absent measurement renders as 0 RPS / 0% of best — visually indistinguishable from a
  framework that collapsed under load. Playbook §3.9 requires charts faithfully represent the data.
- **Recommendation.** Omit the series or break the line at missing points rather than substituting 0,
  and annotate the chart when any cell is absent.

### P2-005 — `publishableReason` is computed and stored but never surfaced; the rendered reason may be wrong

- **Severity:** P2 · **Category:** Report Generation · **Confidence:** High
- **Evidence.** `grep -rn publishableReason scripts/` → written by `run.js:346`, recomputed in
  `publishable.js`, asserted in tests — and referenced by **no** report code; 0 occurrences in
  `results/latest/REPORT.md`. `sections-detail.js#headerSection` instead emits a fixed
  "Single-run or stress profiles carry no meaningful variance" for every non-publishable run,
  including one rejected for socket timeouts (`2026-07-29T04-40-36`, 94 timeouts).
- **Recommendation.** Render `publishableReason` verbatim in the header callout and the Load
  Configuration table; delete the hardcoded explanation.

### P2-006 — The regression gate ships with no baseline and cannot run

- **Severity:** P2 · **Category:** Repository / Automation · **Confidence:** High
- **Evidence.** `.gitignore` → `/results/*` with `!/results/baseline/`; `ls results/baseline` → does
  not exist. `check-regression.js` exits **2** with setup instructions. `bench:check` is a wired
  `package.json` script and `REGRESSION_TOLERANCE = 0.1` is a documented constant.
- **Impact.** The documented CI regression gate protects nothing as shipped, and its distinct exit
  code 2 means a CI job that only branches on non-zero will report a hard failure for a missing
  baseline, while one that only checks `=== 1` will silently treat "no baseline" as a pass.
- **Recommendation.** Commit a pinned, genuinely publishable baseline once P0-001/P1-001 are fixed
  and a clean-environment campaign has been run, and make CI fail explicitly and loudly on exit 2
  rather than treating it as either a regression or a pass.

### P2-007 — Three configured scenarios have never been measured; `rotate()` is untested

- **Severity:** P2 · **Category:** Testing / Repository · **Confidence:** High
- **Evidence.** No retained run's `configuration.scenarios` contains `send-object`, `static-file`, or
  `large-post` (all 20 checked); the two 10-scenario artifacts predate their addition. `grep -rln
  rotate scripts/lib/__tests__/` → no matches, while `rotate()` is the sole mechanism enforcing
  position counterbalancing.
- **Impact.** Three scenarios exist in configuration and pass parity but have zero measurement
  coverage — which is why P0-001 and P1-004 are latent rather than already published. The
  counterbalancing function that P1-001 concerns has no regression protection.
- **Recommendation.** Add `rotate()` unit tests (exact balance when `runs % frameworks === 0`, ±1
  otherwise) and treat "every configured scenario appears in the most recent publishable run" as a
  gate.

### P2-008 — README claim drift: scenario counts contradict the configuration

- **Severity:** P2 · **Category:** Documentation · **Confidence:** High
- **Evidence.** Root `README.md:70` "across 10 scenarios"; `:85` "8 scenarios do byte-identical
  work". `apps/benchmark/README.md:109` "All 10 scenarios are implemented identically across every
  server." `config/scenarios.js` defines **13** scenarios, of which **11** are `identicalWork: true`.
- **Impact.** Published documentation understates the suite and — via "implemented identically" —
  contradicts the two scenarios the harness itself correctly labels idiomatic.
- **Recommendation.** Derive these counts in docs from `SCENARIOS` (a generated table or a docs test
  asserting the numbers), rather than restating them.

### P3 findings

| ID | Finding | Evidence |
| -- | ------- | -------- |
| P3-001 | `scripts/run.js` is 393 lines against the repository's own 300-line hard cap, which three sibling modules cite as their reason for existing | `wc -l`; module doc comments in `bench-exec.js`, `bench-exec-single.js`, `bench-rotation.js` |
| P3-002 | Report states `/proc` is sampled "once per second"; the interval is 500 ms | `sections-detail.js#resourcesSection` vs `constants.js METRICS_INTERVAL_MS = 500`; rendered at `latest/REPORT.md:447` |
| P3-003 | `rankEntries` is documented as pure but mutates its inputs (`entry.__rank`) and leaks `__rank` into output; `POINTS_FOR_LAST_PLACE` is exported and unused | `scoreboard.js` |
| P3-004 | Legacy `scripts/report.js` viewer retained alongside `generate-report.js`, with 4 `package.json` scripts pointing at it | `package.json`, `scripts/report.js` header |
| P3-005 | A benchmark run cannot proceed without `ss` (iproute2) unless `--no-validate` — correctly fail-closed, but undocumented as a prerequisite | `parity.js#readListenBacklog`, `checkBacklogParity`; `README.md` prerequisites |
| P3-006 | `warmup-provenance.test.js` asserts regexes against `run.js` source text rather than behavior | the test file |
| P3-007 | `warmupUrl` swallows every warmup failure as non-fatal and records nothing in the artifact, so a cold-start measurement is undetectable afterwards | `bench-exec.js#warmupUrl` |
| P3-008 | `--max-old-space-size=512` is uniform in value but not in effect across frameworks with different baseline heaps; not disclosed as a caveat | `constants.js NODE_SERVER_FLAGS` |
| P3-009 | Two empty aborted run directories and an untracked 20 KB `.cpuprofile` under `scripts/results/` (a second results concept) remain in the tree | `results/2026-07-29T03-36-30`, `results/2026-07-28T10-58-17`, `scripts/results/cpuprof-server-c128/` |
| P3-010 | Only NextRush's effective timeout/keepAlive values are captured; competitors' are not, so the configuration matrix is asymmetric in what it can prove | `provenance.js#captureNextRushEffectiveOptions` |

---

## 8. Risk Assessment

| Risk | Likelihood | Consequence |
| ---- | ---------- | ----------- |
| A full-suite `wrk` run publishes a false `large-post` figure | **Certain** on the next run of the documented publishable path | A named scenario reports the opposite of what it claims to measure, with no error signal |
| A fixed-order or non-rotated run is published as a ranking | **Already occurred** — two artifacts in the tree | Cross-framework ordering reflects measurement position, which the harness has itself measured as material |
| A consumer or CI reads `results.json.publishable` and trusts it | High — `check-regression.js` already does | A saturated single-run sweep is treated as a publishable baseline |
| An autocannon campaign is published despite saturation | Medium (autocannon is a supported, documented tool) | The zero-timeout criterion is silently inoperative |
| `static-file` enters the headline like-for-like score as-is | High (it is configured and passes parity) | A non-equivalent scenario contributes to the headline ranking |
| Thermal/contention drift is misread as a framework difference | High on the current machine | Small deltas are not interpretable; already acknowledged by the README's withdrawal |

---

## 9. Trust Assessment

| Dimension | Score | Justification |
| --------- | ----: | ------------ |
| Scientific Rigor | 6 | Design is sound on paper — two-stage warmup, rotation with a stated reason, invalid-run exclusion, computed publishability. Undermined by an uncontrolled environment (P2-002) and by a publishability gate missing its own position-control criterion (P1-001). |
| Fairness | 7 | Genuinely engineered: shared payloads, header-byte neutrality, sync middleware everywhere, per-route parsers, OS-read backlog. No anti-cheating evidence found anywhere. Deductions for one demonstrated `identicalWork` violation (P1-004) and one undisclosed registration asymmetry (§5.2). |
| Correctness (calculations) | 9 | 336 statistical cells, 2 full ranking tables, 288 CSV rows independently reproduced with zero mismatches. Deductions only for the efficiency-ratio window mismatch (P1-006) and the timeout key mismatch (P1-003), not for the core mathematics. |
| Architecture | 8 | Clean `lib/` decomposition, pure testable modules, logic-free barrel, one-way dependencies, results-as-source-of-truth. One over-cap file, one legacy path. |
| Maintainability | 8 | Small focused modules, exact-pinned dependencies, unusually informative rationale comments. Loses points for claims hardcoded where the data was already available. |
| Reproducibility | 5 | Regeneration from `results.json` is excellent and was exercised. But no artifact is committed, no baseline exists, the machine is uncontrolled, and **zero** retained runs satisfy the current publishability criteria. |
| Documentation | 6 | Thorough in-source rationale, honest README withdrawal of prior figures. Loses points for a false invariant (P2-001) and stale counts in three places (P1-005, P2-008). |
| Automation | 7 | Parity pre-flight, run-id collision defense, computed publishability, 136 passing tests. The regression gate is inert (P2-006). |
| Evidence Quality | 8 | Raw artifacts, per-framework files, CSV, scoreboard, git provenance, tool and framework versions all present and mutually consistent. Missing: any recorded parity outcome (P1-005). |
| **Overall Trust** | **6.5** | The arithmetic is trustworthy and independently verified. The methodology gates and the report claim surface are not yet. |

---

## 10. Improvement Roadmap

**Immediate — before any further measurement**

1. Fix P0-001: derive the wrk request body per scenario from `config/scenarios.js`; assert the load
   generator's actual request body against the declared body before timing.
2. Fix P1-001: add `positionControl === 'rotated'` to `derivePublishable`; give the "Not a ranking"
   guard the `?? config.order` fallback; treat a missing value as unverified.
3. Add `rotate()` unit tests (P2-007) and a publishable-requires-rotation test.

**Short-term — before any number leaves the repository**

4. Fix P1-003 by normalizing the load-generator error schema at the adapter boundary.
5. Fix P1-002 by persisting the recomputed publishability verdict and having `check-regression.js`
   recompute rather than read.
6. Fix P1-005: record a parity outcome in `results.json` and render it; derive the scenario-fairness
   sentence from the data.
7. Fix P1-006: either sample per cell or relabel the Efficiency section as a whole-sweep aggregate;
   use `max`, not `mean`, for `rssPeak` across passes.
8. Resolve P1-004: reclassify `static-file` as not like-for-like, or equalize header sets and add a
   full-header-set parity check.
9. Render `publishableReason` (P2-005); correct the READMEs' scenario counts (P2-008); make the
   backlog invariant true and disclose it (P2-001).

**Medium-term — before a publishable campaign**

10. Require `--pin` + `--client-pin` for publishable runs and fail when `taskset` is unavailable;
    capture load average, governor, and turbo/thermal state at run start and end (P2-002).
11. Run one clean, pinned, `--profile full` campaign covering all 13 scenarios; commit it as
    `results/baseline/` and wire CI to fail loudly on exit 2 (P2-006).
12. Separate concurrency regimes in the headline score and make the noise flag consequential
    (P2-003); stop plotting missing data as zero (P2-004).

**Long-term**

13. Add confidence intervals / margin of error to `computeStats` (playbook §3.5) and surface them in
    the report alongside CV.
14. Retire the legacy `report.js` path, split `run.js` under the 300-line cap, prune the aborted run
    directories and the stray `.cpuprofile`, and capture effective timeout/keep-alive values for
    every framework, not only NextRush (P3 items).
15. Extend the parity gate from "identical responses" to "identical *requested* work" — a general
    version of the P0-001 fix, so a request-side divergence can never be invisible again.

---

## 11. Final Verdict — Mandatory Questions (Playbook §4.8)

**Can the benchmark be trusted?** Partially. Its arithmetic can be — independently reproduced with
zero mismatches. Its publishability gate, its scenario-declaration integrity, and its report claim
surface cannot yet be.

**Is the benchmark scientifically valid?** The design is largely valid; the *execution environment*
is not controlled, and one gate (position control) is designed but not enforced. Not valid for
publication in its current state.

**Is every framework treated fairly?** Close, and demonstrably by intent — no anti-cheating evidence
was found anywhere in the servers or harness. One scenario (`static-file`) is measurably not
equivalent despite being declared so, and one registration asymmetry is documented in source but
disclosed in no report.

**Are calculations correct?** Yes, for statistics, rankings, overhead, and CSV — verified across 336
cells, 2 ranking tables, and 288 rows. No, for the `Efficiency` ratios (mismatched measurement
windows) and the timeout tally (key mismatch).

**Are reports accurate?** Where they render data, yes. Where they *assert*, no — the parity claim is
printed unconditionally and the "8 scenarios" claim is false in the current `latest` report.

**Can results be reproduced?** Report artifacts, yes — trivially, and this audit did so. Benchmark
*results*, no: no committed artifact, no baseline, and an uncontrolled machine.

**Can this benchmark be publicly defended?** Not yet. P0-001 and P1-001 would each be
conversation-ending under hostile review. After the Immediate and Short-term roadmap items, the
fairness engineering here is strong enough to defend.

**Should benchmark results be published?** **No.** The root README's existing withdrawal of prior
figures is the correct posture and should hold until Immediate + Short-term are complete and one
clean, pinned campaign has been run.

**What must be fixed first?** P0-001 (wrk POST body), then P1-001 (rotation as a publishability
criterion). Nothing else should be measured until those two land.

---

## 12. Sections Not Completed

- **Independent verification of throughput/latency magnitudes** — _Not performed._ No new campaign
  was run; doing so on this machine would reproduce the P2-002 confound rather than resolve it. To
  obtain that evidence: fix Immediate + Short-term items, then run `--profile full --pin --client-pin`
  on an idle, pinned host and re-audit the resulting artifact.
- **Quantification of the static-registration asymmetry (§5.2)** — _Evidence insufficient._ The
  mechanism is code-verified; the effect size on Express and Hono throughput is unmeasured. To obtain
  it: measure each competitor with static registered as a route versus as `app.use()`, holding
  everything else fixed. Until then no unfairness claim is made — only a disclosure gap.
- **`nextrush-v3-class` fairness review** — _Not applicable to current artifacts._ The server exists
  and is configured but appears in no retained run, so there is nothing measured to audit.
- **Cross-run trend / history verification** — _Not performed._ `results/HISTORY.md` is not present
  in the tree; `buildHistory` was reviewed as code but has no artifact to verify against.
