# Week-1 Evidence Results — fix-benchmark-measurement-integrity Task Group 8

| Field | Value |
| --- | --- |
| Purpose | Record the diagnostic-only evidence produced by Task Group 8, for the separate later changes that address F-01, F-02, and F-04's ADR |
| Date | 2026-07-28 |
| Commit | `5f77df1fcedcf62923ce08361e45e07bc9e9772c` (working tree had uncommitted changes at capture time) |
| Status | Evidence only — no action taken on any result in this change (per design.md's Migration Plan step 8) |

All measurements below are dev-scale, single-run, unpinned diagnostics per §0 of `tasks.md` —
none are publishable figures and none should be cited as a benchmark table entry.

## 8.1 — Three-arm timeout experiment

Ran `apps/benchmark/servers/nextrush-v3-timeout-diagnostic.js` (built in Task Group 6) under
`wrk -t4 -c256 -d5s` against `hello-world`, twice, for each of the three arms:

| Arm | Run 1 RPS | Run 2 RPS |
| --- | --- | --- |
| `default` (both mechanisms active) | 20,691 | 19,634 |
| `race-disabled` (handler race off, `server.timeout` active) | 21,039 | 23,301 |
| `both-disabled` (equivalent to `timeout: 0`) | 21,856 | 23,233 |

**Directional finding**: `default` was the lowest-throughput arm in both runs.
`race-disabled` and `both-disabled` were close to each other in both runs (particularly run 2,
where they are statistically indistinguishable from one another but both clearly above
`default`). This is consistent with — but does not conclusively prove, given the single-run,
unpinned, dev-scale nature of this evidence — the handler-level `Promise.race` mechanism being
the dominant source of F-04's overhead, rather than the socket-level `server.timeout` guard.

**Attribution caveat**: this evidence isolates the two mechanisms for the first time (D4's whole
purpose), but two dev-scale runs are not a statistically rigorous A/B. A CPU-pinned, multi-run
version of this same experiment is the natural next step for whoever picks up F-04's deferred ADR
(recommendation 12) — this change does not act on the result, only produces it, per design.md's
Migration Plan step 8.

## 8.2 — OQ-1: payload byte-length comparison

Compared `apps/benchmark/servers/_shared/payloads.js`'s `userById()` (the shallow route-params
scenario) against `deepRoute()` (the deep-route scenario) at representative param values:

| Function | Example call | Response | Byte length |
| --- | --- | --- | --- |
| `userById('42')` | `/users/:id` | `{"id":"42","name":"User 42","email":"user42@example.com"}` | 57 |
| `deepRoute('acme','core','42')` | `/api/v1/orgs/:o/teams/:t/members/:m` | `{"orgId":"acme","teamId":"core","memberId":"42"}` | 48 |

**Finding**: `deepRoute`'s response is **9 bytes (≈16%) smaller** than `userById`'s. This is a
real, mechanical candidate explanation for OQ-1 (the "deep route 8.5% faster than shallow
route-params, NextRush-only, unexplained" observation from the reconciliation report) — less
JSON to serialize and transmit could plausibly account for some or all of the throughput
difference, independent of any router-matching cost difference between a 2-segment and an
8-segment param route. This does not rule out a matching-cost contribution (§8.3 below shows
depth-8 param matching does cost more than depth-2), but it means the prior investigations'
framing of the result as purely "NextRush-only, unexplained" understated an available, simple
explanation. Settling how much of the 8.5% is payload-size vs. matching-cost is out of this
change's scope — it requires a controlled experiment holding payload size constant across route
depths, which is a separate, later change's task.

## 8.3 — OQ-5: param-match allocation regression persistence check

Ran both existing allocation harnesses at current HEAD, 3 runs each:

| Harness | Method | Depth-2 param-match figure | Note |
| --- | --- | --- | --- |
| `router-match-alloc.js` | NET-RETAINED (small young gen, scavenges reclaim transient garbage) | 342.7 B/op ± 0.2 (cv 0.07%) | Directly comparable to the reconciliation report's originally-cited 339.87 B/op figure — same method |
| `param-match-alloc.js` | GROSS (enlarged young gen, no scavenge; transient garbage included) | 437.9 B/op ± 7.8 (cv 1.77%), retain mode | A different, stricter method — includes transient allocation the net-retained harness cannot see |

**Finding**: the regression **persists at current HEAD**. `router-match-alloc.js`'s net-retained
figure (342.7 B/op) is closely consistent with the reconciliation report's previously-flagged
regressed value (339.87 B/op) — not the original pre-regression baseline of 169.4 B/op. The two
harnesses measure genuinely different things (net-retained vs. gross-including-transient, per
each script's own documented method) and must not be compared against each other directly as if
they were the same metric — only each harness's own before/after trend is meaningful. This
confirms F-02 (the param-match allocation regression) is still live at this commit and remains
correctly gated as a separate, later change's scope — this change does not attempt to fix it, only
confirms it is still there for whoever picks up that work next.

## Summary for follow-on work

- **F-04's ADR** (recommendation 12, `server.timeout` public-API decision): §8.1's directional
  evidence — that the handler-level race, not the socket guard, appears to be the larger
  contributor — is a useful input but not a substitute for a rigorous, CPU-pinned version of the
  same three-arm experiment before that ADR is finalized.
- **OQ-1** (deep-route-faster-than-shallow-param-route): §8.2 gives a concrete, testable
  explanation (payload size) that a follow-on change should control for before treating the
  result as a router-matching anomaly.
- **F-02 / OQ-5** (param-match allocation regression): §8.3 confirms it is still present and
  measurable at current HEAD, using two independently-corroborating harnesses.
