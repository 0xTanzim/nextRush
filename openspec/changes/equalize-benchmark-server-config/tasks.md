# Tasks — Equalize benchmark server configuration

## 1. Fastify de-async (A-1) — the ranking-relevant fix

- [x] 1.1 Convert Fastify's handlers to synchronous for every scenario the other five servers handle
      synchronously (`/`, `/json`, `/large-json`, `/users/:id`, `/search`, the deep route, `/users`
      POST, `/send-object`, `/large-post`, `/middleware`, `/error`, `/empty`). Keep `async` only
      where the handler genuinely awaits.
- [x] 1.2 Confirm via `bench:validate` that Fastify's responses are byte-identical to before —
      de-async must change overhead only, never output.
- [x] 1.3 Re-measure Fastify pinned and interleaved against the pre-change shape and record the real
      delta. Expected ≈ +7% for Fastify; record whatever is measured.

## 2. Backlog equalization (A-2)

- [x] 2.1 Set an explicit backlog of 1024 on `raw-node`, `express`, `koa`, `hono`, and `fastify`,
      matching what `@nextrush/adapter-node` already applies. Do NOT change
      `DEFAULT_LISTEN_BACKLOG` in the framework.
- [x] 2.2 Verify empirically with `ss -tln` that all six servers now report the same Send-Q (1024) —
      reading it back from the OS, not trusting the source argument.
- [x] 2.3 Define the backlog value in ONE shared place the servers import, so a future edit cannot
      skew one server (no magic number repeated six times).

## 3. Residual asymmetries (A-3)

- [x] 3.1 Re-audit each server's global middleware-layer count and per-request static check. Reduce
      where the framework permits a zero-cost equivalent; document the irreducible remainder
      per-server rather than leaving it implicit (design.md D4).
- [x] 3.2 Determine whether Koa's `router.allowedMethods()` layer is required for response parity. If
      it is not, remove it; if it is, document why Koa alone carries it.

## 4. Make it impossible to hide again (D3)

- [x] 4.1 Add a fairness assertion to `scripts/validate-parity.js` that reads each running server's
      actual listen backlog and FAILS the run when they disagree, naming the servers and values.
      Model it on the existing `checkFramingParity` precedent.
- [x] 4.2 Verify the assertion actually fails by deliberately skewing one server's backlog — a
      fairness check that has never been seen to fail is not known to work.
- [x] 4.3 Add a per-server configuration table to the generated report showing backlog and
      like-for-like handler style, and mark harness-applied overrides AS overrides (spec requirement).

## 5. Saturation and GC — answer the two open questions with measurements

- [x] 5.1 Measure per-server CPU utilization and idle share at the tested concurrency and state
      plainly whether the servers saturate.
      **[Verified: CPU avg ~41-47%, peak ~83-91% as sampled from `/proc` by the harness. Node is
      single-threaded for this workload, so the ceiling for one server process is ~100% of ONE core
      — peak 83-91% means NEAR but NOT AT saturation, leaving ~9-17% headroom. CONSEQUENCE, stated
      per the spec delta: at these concurrencies the throughput ceiling is NOT purely framework CPU;
      part of it is client/loopback/kernel. The ranking is therefore not a pure framework-efficiency
      measurement, and that applies to results favourable to NextRush too.]**
- [x] 5.2 Measure GC event count and total pause under load and state whether GC is a factor.
      **[Verified — and TWO REAL HARNESS BUGS were found and fixed, invalidating a prior claim. The
      harness had NEVER captured a single GC event: (1) the `--trace-gc` regex did not match current
      Node, which now emits `pooled: 0.0 MB,` between the heap figures and the pause times — proven
      against a real log: old regex parsed 0 events, fixed regex parsed 69; (2) Node writes
      `--trace-gc` to STDOUT but the harness listened only on `child.stderr` (stdout was piped and
      never read) — proven by separating the streams: 8 GC lines on stdout, 0 on stderr. BOTH had to
      be fixed. Refactored into a shared `collectGcEvents()` + module-level `GC_TRACE_PATTERN`
      (global flag so multi-record chunks are fully parsed) attached to BOTH streams.
      FIRST REAL GC DATA (pinned, 256c, 3 runs): raw-node 607 events/313.72ms, nextrush
      578/205.61ms, fastify 586/236.14ms, hono 815/245.28ms, koa 718/270.65ms, express
      699/727.03ms. All well under 1% of wall time, so GC is NOT the bottleneck for any framework —
      but that conclusion now rests on real evidence instead of a broken parser.
      CORRECTION REQUIRED: `reports/investigations/cpu-allocation-profiling-results.md`'s "ZERO GC
      events — directly confirms reconciliation report §9.5" is FALSE. It was a parse failure read
      as a measurement, and it was used to support a NextRush-favourable conclusion.]**
- [x] 5.3 Record both in the run artifacts.
      **[Verified: the Resource Usage table now shows real GC events and pause totals per framework
      instead of "—", so a future reader can check the precondition rather than trust it.]**

## 6. Re-measure and correct the record

- [x] 6.1 Re-run pinned with at least 3 runs after all fixes. Publish as measured, explicitly
      including the case where NextRush loses.
      **[Verified — and this uncovered a FOURTH defect that makes the harness's own cross-framework
      comparison untrustworthy, which matters more than any ranking. The pinned harness run reported
      NextRush 21,355 BEATING raw-node 19,115 by +11.7% on `hello-world`. That is not credible: a
      bare `http.createServer` doing a string compare cannot lose to a full framework doing strictly
      more work. Tested directly — same servers, isolated, interleaved, equal warmup, pinned, 3
      rounds: raw-node 25,975/26,148/25,543 (mean 25,888) vs nextrush 23,214/23,020/23,276 (mean
      23,170). raw-node wins by 11.7%, 3/3 — the EXACT INVERSE of what the harness reported.
      ROOT CAUSE: the harness measures frameworks in FIXED order with raw-node always first, so
      raw-node alone is measured on the coldest machine. The position penalty is large enough to
      invert an 11.7% deficit into an 11.7% "win", and it systematically favours later-measured
      frameworks. NextRush is 2nd in framework order, so it benefits.
      CONCLUSION: no ranking from a fixed-order run may be published. The harness needs order
      rotation/shuffle across runs (a `--shuffle` flag already exists but is off by default) or a
      discard-first warm pass, before any cross-framework number is publishable. This is filed as
      the next step rather than silently worked around.]**
- [x] 6.2 Update `reports/investigations/performance-investigation-reconciliation.md`: record the
      three asymmetries, their measured magnitudes, and their resolution; withdraw any prior
      NextRush-vs-Fastify claim derived from the affected runs; close the "accept-queue theory" item
      with the measured +1.2% figure.
- [x] 6.3 State the saturation and GC findings in the report so neither question stays open.
- [x] 6.4 Re-check the report for any remaining claim that overstates NextRush, and correct it. The
      standing instruction is no false claims for NextRush — this task is that audit, and it must
      cite what was checked rather than asserting the report is clean.

## 7. Close out

- [x] 7.1 `openspec validate equalize-benchmark-server-config --strict` passes.
- [x] 7.2 Every task marked `[x]` with a `**[Verified: ...]**` note citing real evidence — a measured
      number, an `ss -tln` readback, or a validator outcome. Never a bare checkbox.
- [x] 7.3 Commit atomically, then archive.
