# Tasks — router-param-path-profile-gate

Measurement + decision only — **no `packages/**` change**. Deliverables: a transient-allocation
profiler, allocation + CPU attribution, a defensible route-params number, and a decision report
that gates the follow-up (trim vs radix) and settles HP-11. Dev/agent-runnable (`quick`/`standard`
+ Node profiling flags); the 5-run CPU-pinned A/B stays deferred.

## 1. Preparation

- [x] 1.1 Ensure a current `@nextrush/router` + `@nextrush/adapter-node` build exists (the profiler child imports the workspace dist, like `router-match-alloc-child.js`).
- [x] 1.2 Record the current net-retained param figure (`bench:alloc:router` → ~340 B/op) as the "blind" reference the new gross profiler is replacing, and confirm the matcher differential golden is green (baseline for "no behavior change"). — measured **static 64.2 B/op, param 340.1 B/op (cv 1.66%)**; differential golden **37/37 green**.
- [x] 1.3 Capture the current single-run route-params numbers (NextRush/Fastify/raw) from the latest report as the noisy "before". — run `2026-07-18T13-14-58`: **NextRush 26,315 · Fastify 30,551 (−13.9%) · raw-node 28,211**, all single unpinned runs.

## 2. Build the gross-allocation profiler (the missing instrument)

- [x] 2.1 Add `apps/benchmark/scripts/param-match-alloc.js` (+ `param-match-alloc-child.js`) mirroring `router-match-alloc.js`, but measuring **gross** allocation: run the built matcher N times under `--max-semi-space-size=<large>` so no scavenge fires mid-loop; report `heapUsed`-delta ÷ N as total bytes/match. Add a `bench:alloc:param-match` script. — done; child has `retain` (escaping gross) + `discard` (escape-analysis floor) modes.
- [x] 2.2 Measure three cases — static hit, depth-2 (`/users/:id`), depth-8 (`/api/v1/orgs/:o/teams/:t/members/:m`) — 5 runs each, mean ± stddev. — **static 58.1, depth-2 442.3, depth-8 505.2 B/op (retain)**; discard floor ~3–9 B/op.
- [x] 2.3 Calibrate: run once with `--trace-gc` and assert **zero GC** during the measured window; if GC fired, enlarge the semi-space / reduce N and re-run. Reject any run with mid-loop GC (D1). — perf_hooks `gcCount=0` on all reported runs at `--semi 512 --n 200000`; parent rejects any `gcCount>0`.
- [x] 2.4 Confirm determinism (cv < 1%); record the per-depth gross bytes/match. — cv **0% / 0.1% / 0.05%** (static/depth-2/depth-8), all < 1%. Saved `results/param-match-alloc-2026-07-18T14-13-26`.

## 3. Allocation attribution (`--heap-prof`)

- [x] 3.1 Run the route-params path under sustained load with `node --heap-prof`; save the `.heapprofile`. — profiled the **real nextrush-v3 server** (route path defeats micro-loop scalar replacement) under `wrk -t4 -c64 -d12s /users/12345`, `--heap-prof-interval=16384`; saved `results/heapprof-server/nextrush-route-params.heapprofile`.
- [x] 3.2 Attribute per-match bytes to call sites: `WalkFrame` pushes + frame-stack array, `bindNames`/`bindValues`, the `Object.create(null)` params materialization, `decodeParam`/`segmentAt` slices. — only `matchRoute` shows sampled allocation (**0.34%** of total heap traffic); `matchNodeIndexed`/`WalkFrame`/bind-arrays/`decodeParam`/`segmentAt` produce **zero** sampled allocation. Server heap traffic dominated by HTTP internals (undici, http parser, `internal/encoding` decode 5.1%, writable streams) + one-time startup.
- [x] 3.3 Cross-check the dominant term against §2's gross-alloc result — the two methods MUST agree before naming a culprit (D2). If they disagree, record that escape analysis is in play (transient cost < 340 B/op suggests) and pivot the diagnosis to §4/CPU. — **They DISAGREE:** D1 gross = 442 B/op (retained) but discard floor ~3–9 B/op and D2 shows matcher allocation ≈ 0.34% of server heap. Escape analysis is in play; the ~100 B/op transient does not materialize as a dominant term under real load. **Diagnosis pivots to CPU (§4).**

## 4. CPU attribution (`--cpu-prof`)

- [x] 4.1 Run the route-params `wrk` scenario with `node --cpu-prof` on the NextRush server; save the `.cpuprofile`. — `wrk -t4 -c64 -d15s /users/12345`, `--cpu-prof-interval=100`, pinned; saved `results/cpuprof-server/nextrush-route-params.cpuprofile` (104,252 samples).
- [x] 4.2 Split the gap into (a) allocation/GC, (b) per-segment `Map.get`/walk CPU, (c) `decodeParam`/normalize; quantify each share. A CPU-dominated gap points at radix (D3). — **(a) GC ≈ 1.0%**, matcher allocation negligible (D2); **(b) trie walk `matchNodeIndexed` 1.44% + `matchRoute` orchestration/params 1.87%**; **(c) normalize `collapseAndStrip` 0.30% + `isProvablyLowerAscii` 0.29% + `decodeParam` 0.07%**. Whole matcher ≈ **4.03%** of total CPU; request dominated by response `writev` ~33% + `ctx.json` 4.82% + 24% idle. Largest *matcher* term is the per-segment `Map.get` walk — the term radix addresses — but small in absolute total.

## 5. Establish a defensible route-params RPS number

- [x] 5.1 Run `pnpm bench:standard` (3 runs, mean ± stddev) for route-params — or `taskset`-pinned `pnpm bench:compare:quick` on an idle machine — for NextRush/Fastify/raw; report the tighter with variance. — `taskset`-pinned A/B (server cores 0-1, wrk cores 2-5), `wrk -t4 -c64 -d10s`, **5 runs each**: NextRush **23,670 ± 481 (cv 2.0%)**, Fastify **25,567 ± 476 (cv 1.9%)**, raw-node **25,446 ± 828 (cv 3.3%)** → NextRush **−7.4%** vs Fastify, −7.0% vs raw. Saved `results/route-params-ab-2026-07-18T14-26-18/route-params-ab.json`.
- [x] 5.2 Label the number's confidence honestly (directional/defensible, NOT the publishable 5-run pinned figure). Note the full A/B remains the deferred global gate. — labeled directional/defensible; the single-run "−13.9%" was ~½ noise (pinned multi-run = −7.4%). Absolute RPS is depressed by 2-core pinning; only the delta is defensible. The publishable 5-run clean-host A/B remains the one deferred global gate.

## 6. Decision report (the gate — falsifiable done-condition, D5)

- [x] 6.1 Write `report/route-params-profile.md`: dominant cost term named with cited §2–§4 evidence; the §5 RPS delta; the trim-vs-radix recommendation with the decision rule applied; and the HP-11 keep/park verdict on real evidence. — written; all four D5 answers in §4.
- [x] 6.2 Ensure every claim cites a profile artifact (gross-alloc table, `.heapprofile`, `.cpuprofile`, RPS run) — no unsupported assertion (this is the anti-`WalkFrame`-guess discipline). — §2 artifact table + per-finding citations to the four result files/scripts.
- [x] 6.3 State the concrete next change the follow-up should be (e.g. "segment-trie bounded-backtrack + reused bind arrays" or "advance RFC 015 radix"), so it is directly actionable. — §6: (1) run the deferred publishable clean-host A/B first; (2) if a real gap remains, target per-request context/dispatch overhead, NOT routing; (3) keep radix RFC-015-deferred; (4) keep the gross profiler as the standing instrument. Both an allocation trim and a radix rewrite are recommended **against** on route-params grounds.

## 7. Record durable findings into the RFC

- [x] 7.1 Fold the dominant-cost finding, the HP-11 verdict, and the trim-vs-radix recommendation into `docs/RFC/runtime-adapters/015-router-radix.md` (§7 / the T017 note) — the durable home — so the decision does not live only in a prunable change. — added a "Update (2026-07 — T017 executed by `router-param-path-profile-gate`)" block to §7 with all four findings, HP-11 keep verdict, and both §7-optimization + radix deferred on evidence.
- [x] 7.2 Update `report/performance-review.md` NF-3 status: profiled → decided (link the profile report + the recommended follow-up). — NF-3 severity marked RESOLVED with the −7.4% figure + park-both decision; recommendation table row 4 updated to "decided (park both)".

## 8. Confirm no behavior change & validate

- [x] 8.1 Confirm no `packages/**` file changed (this is measurement-only); the matcher differential golden and router/adapter suites remain green (the profiler imports the dist read-only). — `git status` shows **no tracked `packages/**` modification**; full router suite **300/300 green** (incl. `match-differential` + `find-node-differential`).
- [x] 8.2 `pnpm bench:validate` still green (sanity — no server behavior touched). — **Parity OK — 6 servers agree** on bodies, content types, statuses, and middleware headers.
- [x] 8.3 `openspec validate router-param-path-profile-gate --strict` → valid; commit the profiler script + report + RFC update as one measurement-scoped change (no perf claim, evidence only). — `openspec validate --strict` → **valid**; committed as `e31cb8c` (no perf claim, evidence only).
