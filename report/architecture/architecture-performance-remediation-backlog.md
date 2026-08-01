# Architecture — Performance Remediation Backlog (Open Items)

| Field           | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| **Report type** | `Performance` |
| **Scope**       | `@nextrush/core`, `@nextrush/router`, `@nextrush/middleware/static`, `apps/benchmark`, `packages/adapters/conformance` |
| **Date**        | `2026-07-31`                                                       |
| **Reviewer(s)** | AI agent (performance-engineering session, PERF-001-governed)      |
| **Commit / ref**| `700549cbd89496c989e7ca342d353bc6907d3007` (branch `feat/dev`)      |
| **Status**      | `Draft`                                                             |
| **Related**     | `reports/investigations/post-audit-invariant-erosion-review.md`, `reports/investigations/2026-07-31-measured-floor-params-compliance/{00..06}.md`, `docs/adr/ADR-0021-fast-property-request-containers.md`, `docs/playbooks/PERF-001-performance-engineering-playbook.md` |

---

## Progress Tracker

**Remediation:** `[███████████░░░░░░░░░]` 55% — 6 / 11 backlog items resolved this session

| Rec | Addresses | Priority | Status  |
| --- | --------- | -------- | ------- |
| 1   | C-1 (HEAD 404)                      | P0 — correctness | ✅ Done |
| 2   | F-2/F-4/F-8/F-9 (params/query containers) | P0 | ✅ Done |
| 3   | F-1 (timeout race)                  | P1 | ✅ Done — throughput unverified |
| 4   | F-3 (drain wrapper)                 | P2 | ✅ Done |
| 5   | F-7 (prefix-mount O(mounts))        | P0 | ✅ Done — 68% slope removed, not O(1) |
| 6   | G-1 (HEAD probe, mount-scaling arm)  | measurement | ✅ Done |
| 7   | **The idle-host `standard` re-run** | measurement | ⬜ **Open — highest priority** |
| 8   | F-5 (static derived-metadata cache) | P1 | ⬜ Open |
| 9   | F-6 (dispatcher unification)        | P0, RFC-gated | ⬜ Open |
| 10  | G-2 (map-stability + lazy-field gates) | prevention | ⬜ Open |
| 11  | Container defect in body-parser/cookies/form-data | P3 | ⬜ Open |

---

## 1. Executive Summary

This session fixed all P0/Critical findings from the 2026-07-31 performance investigation
(`reports/investigations/`) that were reachable without an RFC: the RFC 9110 HEAD-on-GET compliance
gap, the dictionary-mode `ctx.params`/`ctx.query`/`ctx.headers` containers, the per-request timeout
race, the per-request drain-wrapper allocation, and the O(mounts) prefix-mount canonicalization cost.
Every fix is backed by a deterministic micro-benchmark (allocation, timer count, or timing slope, all
at cv ≤0.2%) and by 1,814 passing tests across seven packages.

**What is honestly still open, in priority order:**

1. **No end-to-end throughput number exists for any of the six shipped changes.** Every fix above is
   verified structurally, never against the pinned `standard` wrk profile this repo publishes numbers
   from. This is the single highest-value remaining action — see §12 F-1.
2. **F-5 — static file serving is the largest remaining single-scenario deficit** (+33.58 µs marginal
   @1 conn vs Fastify), caused by per-request metadata derivation (MIME lookup, `Date` formatting,
   ETag build) on a request that never needed I/O throughput. Self-contained, not RFC-gated.
3. **F-6 — two hand-synchronized middleware dispatchers** cost ≈+1.04 µs per layer and are a permanent
   2× maintenance tax on the framework's hottest abstraction. Architecturally the most valuable open
   item, but it is a public-behaviour-adjacent refactor and is **RFC-gated per AGENTS.md §21**.
4. **G-2 — two of three invariant gates are still missing** from `packages/adapters/conformance`: a
   `%HaveSameMap` shape-stability assertion and a lazy-field-unmaterialized assertion. These are the
   gates that would have caught two of the six issues fixed this session before they shipped.
5. **The same dictionary-mode container defect fixed in `router`/`runtime` this session still exists
   in three middleware packages** (`body-parser`, `cookies`, `form-data`) — same one-token fix, not
   yet applied, out of scope of the change that fixed the other four sites.

None of these block a release; all are documented-but-deferred (P1–P3) except item 1, which should
run before any further optimization work, because it is what validates or invalidates everything
already shipped.

---

## 2. System Understanding

NextRush's performance work this session was governed by
`docs/playbooks/PERF-001-performance-engineering-playbook.md`, which requires every optimization
claim to be measured (not asserted) and requires the CI-published benchmark suite
(`apps/benchmark`, profile `standard` or `full`, wrk, CPU-pinned) to be the ruler for any throughput
claim. Two things are true about that ruler that matter for what follows:

- It runs on a **shared, non-idle host** in this environment. Every attempt this session to re-run
  the pinned `standard`/factorial comparisons landed on a host at load average 1.4–2.6, which is high
  enough that a genuine ~1–5% effect cannot be distinguished from noise at the sample sizes (n=9–11
  rounds) that fit in a session. The original published baseline
  (`apps/benchmark/results/2026-07-31T05-36-51`) was captured at a lower, but still not zero, load.
- Because of that, this session's fixes were validated by **deterministic** microbenchmarks instead —
  allocation counted via `--expose-gc` heap deltas, timer counts via `vi.spyOn(globalThis,
  'setTimeout')`, and canonicalization slope via a purpose-built interleaved harness
  (`apps/benchmark/scripts/alloc/mount-scaling.js`). These are immune to scheduler noise (cv ≤0.2% is
  typical) and are honest evidence that the *mechanism* was removed, but they are not a substitute
  for the throughput number PERF-001 ultimately wants published.

Six items were fixed under this constraint; five items remain open, described below with the same
evidence and design work the investigation reports already did — this report does not re-derive
findings, it indexes what is still actionable and cites exactly where.

---

## 3. Architecture Overview

```mermaid
flowchart TD
  subgraph Fixed["Shipped this session"]
    C1[C-1 HEAD-on-GET]
    F2[F-2/F-4/F-8/F-9 containers]
    F1[F-1 timeout race]
    F3[F-3 drain wrapper]
    F7[F-7 prefix-mount O(mounts)]
    G1[G-1 measurement gaps]
  end
  subgraph Open["Open — this report"]
    Gate[Idle-host standard re-run]
    F5[F-5 static metadata cache]
    F6[F-6 dispatcher unification]
    G2[G-2 remaining invariant gates]
    Mw[Container defect: body-parser / cookies / form-data]
  end
  Fixed -->|"validates or invalidates all six"| Gate
  F6 -->|"RFC required — AGENTS.md §21"| RFC[docs/RFC/*]
  G2 -->|"would have caught"| F3
  G2 -->|"would have caught"| F5
```

---

## 4. Data Flow

Not applicable — this report is a backlog index, not a request-lifecycle review. Data-flow detail
for each open item is in its cited source report (§12).

---

## 5. Backend / Logic

See §12 for F-5 (static file serving logic) and F-6 (middleware dispatch logic).

## 6. Database / State

Not applicable — no database in scope.

## 7. Frontend / API Surface

Not applicable — no public API change is proposed by any open item in this report. F-6 touches an
internal abstraction (`compileExecutor`) but the recommended design (§12 F-6) preserves the observed
middleware contract; the RFC gate exists because AGENTS.md §21 classifies any middleware-pipeline
change as gated, not because a contract break is expected.

## 8. UX

Not applicable — no user-facing surface in scope.

## 9. Performance

Covered in full in §12 — every finding below carries a measured number, cited to its source
investigation report.

## 10. Security

No open item in this report changes a security boundary. F-5's rejected design option (dropping the
TOCTOU `fstat`) is a security regression and stays rejected — see §12 F-5.

## 11. Maintainability

F-6 is the maintainability finding: two hand-synchronized middleware dispatchers mean every future
middleware optimization must be implemented, tested, and kept in sync twice, and today one already
has a fast path (`compose`'s `len === 1`) the other lacks. This is the report's largest architectural
item — see §12 F-6.

---

## 12. Findings (detailed)

### F-1 — No end-to-end throughput number backs any of the six shipped fixes · Priority `P0`

- **Current situation:** C-1, F-2/F-4/F-8/F-9, F-1 (timeout race), F-3 (drain wrapper), and F-7
  (prefix-mount) were each validated with a deterministic microbenchmark — allocation at cv ≤0.2%,
  timer-arm counts, or a pinned interleaved timing slope — and with 1,814 passing tests. None was
  validated against `apps/benchmark`'s pinned `standard` profile, which is the artifact PERF-001
  publishes numbers from. Every attempt this session to re-run the original floor-attribution 2×2
  factorial on this host returned results too noisy to confirm or deny the original effect: a
  reference contrast that had originally measured `t=3.35, p<0.05` came back `t=-0.66, not
  significant` at host load ≈2.6 versus the original ≈1.4 (`02-floor-attribution.md`, "The throughput
  gate is INCONCLUSIVE" block).
- **Impact:** Every claim in `06-recommendations.md`'s priority matrix that a "✅ Done" item improves
  throughput is currently a prediction, not a measurement. The specific numbers still unverified:
  `empty-response` 30.48 → ~27.8 µs/req and `route-params` 39.88 → ~38 µs/req.
- **Benefits (of the current state):** The deterministic evidence is not worthless — it proves the
  *mechanism* (an allocation, a timer, a canonicalization call) was actually removed, which is real
  engineering progress independent of whether it moves a noisy wrk number this week.
- **Drawbacks:** Publishing or acting on the predicted percentages without confirming them risks
  exactly the failure mode PERF-001 exists to prevent — the corpus's own "+23%" phantom from an
  earlier unpinned single-batch run (`02-floor-attribution.md` §1).
- **Long-term risk:** If this re-run never happens, six changes accumulate in the codebase whose
  performance justification is permanently unconfirmed, weakening the credibility of every future
  measured claim in the same investigation lineage.
- **Recommendation:** Run the pinned `standard` profile comparison on an idle host (load average
  <0.5, ideally overnight or on unshared hardware):
  ```bash
  cd apps/benchmark
  node scripts/run.js --profile standard --compare --pin 2-7 --client-pin 0-1
  ```
  `--runs 6` was proposed in this session's chat but exceeds `standard`'s own definition of 3 runs
  (`config/profiles.js`) — either accept `standard`'s default run count, or explicitly use `--profile
  full` (5 runs), which is the actual publishable ceiling; do not silently override a profile's
  declared run count. Compare the six-scenario, six-framework result against
  `apps/benchmark/results/2026-07-31T05-36-51` (the baseline of record).
- **Trade-offs:** A `standard` run takes real wall-clock time (6 scenarios × 6 frameworks × 3
  concurrency levels × 3 runs, plus warmup) and needs the host to actually be idle — running it under
  load produces exactly the same noise problem this finding describes, wasting the time spent.
- **Priority:** **P0** — not because it blocks a release, but because every other performance claim
  in this backlog is downstream of it.
- **Migration difficulty:** Trivial to run; the difficulty is entirely in finding an idle window.

### F-2 — Static file serving pays per-request metadata derivation cost · Priority `P1`

- **Current situation:** `packages/middleware/static/src/send-file.ts`'s `sendFile()` derives MIME
  type, `Last-Modified` string, and `ETag` fresh on every request
  (`05-static-and-middleware.md` §A.2, steps 4–6), even though the file's `stat` result changes only
  when the file itself changes. Measured: `static-file` @256 conns is **111.76 µs/req** for NextRush
  vs **93.73 µs/req** for Fastify (**−16.1%**) and vs **95.34 µs/req** for Express — the only scenario
  in the whole comparison matrix where Express beats NextRush. Marginal cost above each framework's
  own empty-response floor is **+33.58 µs @1 conn**, the largest single-scenario excess measured in
  the entire investigation (`05` §A.1).
- **Impact:** The benchmark file is 36 bytes — there is no I/O throughput being measured, so every
  microsecond of the gap is framework overhead: syscalls, header construction, async boundaries.
- **Benefits (of today's design):** No cache means no staleness bug surface and no memory-bound
  configuration decision — the current design is the simplest one that is definitely correct.
- **Drawbacks:** Re-deriving `Date.prototype.toUTCString()`, an ETag, and a MIME lookup on every
  request for a file whose metadata is stable between requests is pure waste at this file size, and
  it is the reason Express — which does cache — wins this one scenario.
- **Long-term risk:** As more of the framework's request paths get measured, "the one place a
  competitor beats us" tends to accumulate scrutiny disproportionate to its actual traffic share; better
  to close it while the fix is simple than after it becomes a recurring talking point.
- **Recommendation:** Design A from `05` §A.4 — a bounded LRU keyed by absolute path →
  `{ stat, etag, lastModifiedString, mimeType, cacheControlString }`, revalidated by a single `stat`
  per request (correctness preserved: freshness is still checked every time, only the *derivation* of
  the cached fields is skipped on a hit). Fold in two free wins from the same section while touching
  the file: hoist the `Cache-Control` directive string to normalize-time (it depends only on options,
  never on the request) and memoize `getMimeType` per extension.
- **Trade-offs:** Design B (also cache the file bytes for small files) is the bigger win but
  introduces a memory-bound configuration surface that `05` §A.4 says deserves its own RFC — do A
  first, consider B later as a separate, opt-in decision. Design C (drop the TOCTOU `fstat`) is
  **rejected outright** — it reopens the SEC-13 race the second stat exists to close, and the security
  cost is not worth a few dozen nanoseconds. Design D (`sendfile(2)`/zero-copy) is "almost useless
  here" per `05` §A.4 — a reminder not to optimize the byte-copy path when the measured cost is
  metadata derivation, not bytes.
- **Priority:** P1 — second-largest measured deficit after the floor items already fixed, and the
  only scenario where a named competitor currently wins outright.
- **Migration difficulty:** Moderate — new LRU structure with invalidation and a bounded-memory
  config surface, but no security-relevant behavior change and no public API change.
- **Validation required (from `05` §A.5, restated so this item is actionable on its own):**
  `packages/middleware/static` full suite with attention to range requests, conditional requests
  (`If-None-Match`, `If-Modified-Since`), dotfile policy, symlink policy, and the 304 path — none of
  these may change behavior. New tests needed for cache invalidation on mtime/size change and bounded
  eviction. Also close the dead-code note from `04-http-compliance-head.md`: `send-file.ts`'s
  `ctx.method === 'HEAD'` branches were unreachable before C-1 shipped and should now be verified
  live. The predicted `static-file` 111.76 → ~95 µs/req is explicitly flagged `[D, weak]` in `05` — a
  projection, not a measurement; re-run F-1 (this report's own item 1) after shipping to get a real
  number.

### F-3 — Two hand-synchronized middleware dispatchers (architectural) · Priority `P0`

- **Current situation:** `compose()` (`packages/core/src/middleware.ts:99`) and `compileExecutor()`
  (`packages/router/src/segment-trie.ts:78`) are two independent implementations of guarded recursive
  middleware dispatch. Both allocate a `next` closure per layer, both write `ctx.setNext`, both wrap
  the call in `Promise.resolve`, both carry the "next() called multiple times" guard, and both have
  hand-maintained fast paths — but not the *same* fast paths: `compose` has `len === 0` and
  `len === 1` specializations, `compileExecutor` has only `len === 0`. Measured per-layer excess vs
  Fastify: **+1.04 µs @1 conn, +1.22 µs @64, +0.84 µs @256** — consistent across the whole
  concurrency ladder, i.e. load-independent (`05-static-and-middleware.md` §B.1, §B.3).
- **Impact:** Any middleware-dispatch optimization must be designed, implemented, and tested against
  two call sites instead of one, and the two are already out of sync (the `len === 1` fast path exists
  in only one of them) — which is itself evidence the sync tax is not being reliably paid today.
- **Benefits (of today's design):** The two dispatchers evolved independently because they serve
  different registration contexts (app-level `.use()` vs per-route middleware) and unifying them
  touches the framework's single hottest abstraction — the caution that kept them separate is not
  unreasonable, just costly.
- **Drawbacks:** A prior investigation (`performance-investigation-reconciliation.md` Rec 11b)
  concluded `compose`'s per-layer closure is not reducible without codegen, because a single shared
  `nextFn` breaks double-next detection — but **that conclusion was reached for `compose` only**, and
  `compileExecutor` (the implementation the benchmark actually exercises) was never part of it
  (`05` §B.3).
- **Long-term risk:** Every future middleware-hot-path optimization pays this 2× tax indefinitely if
  the dispatchers stay separate; the tax compounds with every unrelated change either one makes.
- **Recommendation:** Design A from `05` §B.4 — one dispatch implementation used by both `compose` and
  `compileExecutor`, so router-level middleware becomes a composed chain rather than a second
  recursive walk. This also gives per-route middleware the `len === 1` fast path it currently lacks,
  as a consequence of the refactor rather than a separately-engineered addition.
- **Trade-offs:** Design B (hand-unroll `len === 1..4` in `compileExecutor` only) is a legitimate
  tactical step that can be done *inside* design A rather than as an alternative to it — low-medium
  complexity, no codegen, preserves the double-next guard per specialization. Design C (one shared
  `next` closure reusing a mutable index) is **rejected** — it breaks double-next detection, the exact
  failure mode the prior investigation already ruled out.
- **Priority:** **P0 (architectural)** per PERF-001 §5.2, which ranks architectural improvements above
  micro-optimizations — the +1 µs/layer is the symptom, the duplicated dispatcher is the defect. It sits
  behind F-1/F-2 in this session's execution order only because it needs a design doc first, not
  because it matters less.
- **Migration difficulty:** Hard, and **gated**: this touches the middleware pipeline, which AGENTS.md
  §21 explicitly puts on the RFC-required list ("routing changes, middleware pipeline changes"). Do
  not implement before an approved RFC exists (`docs/RFC/TEMPLATE.md`) and, on acceptance, an ADR
  recording the decision (`docs/adr/TEMPLATE.md`) — see `.kiro/steering/tdd-workflow.md`'s "RFC
  before implementation" rule.
- **Validation required (from `05` §B.5):** `packages/core` + `packages/router` middleware suites in
  full, with special attention to the double-next tests
  (`middleware-single-fastpath.test.ts`'s "next() called n times" cases) — these are load-bearing for
  the guard the unification must preserve.

### F-4 — Two of three planned invariant gates are still missing from conformance · Priority `P2` (prevention)

- **Current situation:** `post-audit-invariant-erosion-review.md` §8.1 specifies three executable
  invariant gates for `packages/adapters/conformance`. Verified this session
  (`grep -rn "HaveSameMap|_state|_raw|_bodySource|lazy" packages/adapters/conformance` returned zero
  matches): none of the three exist yet, though the *problems* they would catch are now understood in
  detail because two of them are exactly what this session's fixes addressed.
  1. **Shape-stability assertion** — `%HaveSameMap` (or a property-name-set comparison) after a full
     dispatch, against a freshly-constructed context. This is precisely the gate that would have
     caught F-3 (`ctx.originalPath`, fixed this session) "the day RFC-029 landed," per the erosion
     review's own words.
  2. **Lazy-field assertion** — `_state`/`_raw`/`_bodySource` unmaterialized after a dispatch that
     doesn't touch them, **for both root and prefix mounts**. This would have caught the F-5 finding
     in the erosion review (prefix mount defeats the lazy-`ctx.state` optimization — not yet triaged
     in this backlog; see §14 note) before it shipped.
  3. **Mount-scaling benchmark arm** — **done this session** as
     `apps/benchmark/scripts/alloc/mount-scaling.js` (G-1), which is why this finding is only P2
     rather than reopening F-7's own gap.
- **Impact:** Two structural regressions (F-3's shape transition, and the still-open prefix-mount
  lazy-state defeat) currently have no automated gate and could recur silently.
- **Benefits (of the current state):** The fast-properties gate that *does* exist
  (`apps/benchmark/scripts/alloc/params-shape-gate.mjs`, shipped this session for F-2) proves the
  pattern works and is cheap to replicate for the other two.
- **Drawbacks:** Every future change to `NodeContext`/`WebContextBase` construction risks reintroducing
  a property-addition shape transition with no automated signal.
- **Long-term risk:** This converts "PERF-001 §5.5 as a recommendation" into "PERF-001 §5.5 as a gate"
  — without it, the pattern is a recommendation that erodes exactly as
  `post-audit-invariant-erosion-review.md` documents happened to the *previous* round of fixes.
- **Recommendation:** Add both remaining assertions to `packages/adapters/conformance`. The shape
  assertion needs `--allow-natives-syntax` for `%HaveSameMap`, which (per this session's own
  `ADR-0021` precedent for `%HasFastProperties`) cannot run inside vitest's `threads` pool — it needs
  a standalone script alongside `params-shape-gate.mjs`, not a `.test.ts` file. The lazy-field
  assertion has no such constraint and can be a normal conformance test.
- **Trade-offs:** None significant — both are read-only assertions with no runtime cost in
  production; the only cost is authoring time.
- **Priority:** P2 — prevention, not a live defect, but cheap and directly informed by two things
  that already went wrong.
- **Migration difficulty:** Trivial-to-low. The shape gate has a working template in
  `params-shape-gate.mjs`; the lazy-field gate is a straightforward dispatch-then-assert test.

### F-5 — The fast-property container fix was not applied to `body-parser`/`cookies`/`form-data` · Priority `P3`

- **Current situation:** This session's `ADR-0021` fixed `Object.create(null)` dictionary-mode
  containers in `ctx.params`, `ctx.query`, and `ctx.headers`. The identical pattern — same defect,
  same fix — still exists in three middleware packages, logged as Findings rather than fixed, to keep
  the ADR-0021 diff attributable to its own decision:
  | Package | Site |
  | ------- | ---- |
  | `@nextrush/body-parser` | `src/utils/url-decode.ts:101,150` |
  | `@nextrush/cookies` | `src/parser.ts:67` |
  | `@nextrush/form-data` | `src/parser.ts:90` |
- **Impact:** Any application using form-body parsing, cookie parsing, or multipart form-data pays
  the same dictionary-mode read/allocation penalty ADR-0021 measured for params/query — roughly 2.2–
  3.9× slower reads and ~3.3× the allocation, per the measurements in
  `03-params-query-containers.md`.
- **Benefits (of the current state):** Scoping this session's change to the two packages the
  investigation actually measured kept the diff small and clearly attributable to one ADR.
- **Drawbacks:** The same measured cost is left on the table in three packages that are exercised on
  every form-encoded, cookie-bearing, or multipart request — plausibly higher-traffic than the query
  string path in a typical application.
- **Long-term risk:** Low — this is a known, understood, low-risk fix; the only risk is it staying
  forgotten because it is not blocking anything.
- **Recommendation:** Apply the same `NULL_PROTO`/`Object.create(NULL_PROTO)` pattern
  (`packages/runtime/src/null-proto.ts`) to all three sites, and extend
  `apps/benchmark/scripts/alloc/params-shape-gate.mjs` to assert fast properties on their outputs too,
  closing the gap before it can quietly reopen.
- **Trade-offs:** None — this is a mechanical repeat of an already-proven, already-reviewed pattern.
  The only decision is whether each package can depend on `@nextrush/runtime` for `NULL_PROTO` or
  needs its own copy, following the same reasoning `query.ts`'s doc comment already gives for why
  `router` carries its own copy (sibling-package boundary, no shared runtime dependency).
- **Priority:** P3 — real but small, mechanical, and no user-facing urgency.
- **Migration difficulty:** Trivial. Each site is a one-token change plus a re-run of that package's
  existing test suite.

---

## 13. Risks

| Risk                                                                    | Likelihood | Impact | Mitigation |
| ------------------------------------------------------------------------ | ---------- | ------ | ---------- |
| Six shipped fixes have no confirmed end-to-end throughput improvement    | Medium     | Medium | Run F-1 (idle-host `standard` re-run) before further optimization work or any published claim |
| F-6 implemented without an RFC, violating AGENTS.md §21                 | Low        | High   | Treat the RFC gate as a hard stop, not a suggestion — no code before an approved `docs/RFC/` entry |
| F-2's static-file LRU cache introduced with a stale-invalidation bug     | Medium     | Medium | Revalidate by `stat` on every request (design A explicitly preserves this); test mtime/size-change invalidation before shipping |
| The container defect (F-5 in this report) recurs in a fourth package    | Low        | Low    | Extend the shape gate (F-4 in this report) to cover all four sites, not just the two fixed this session |

---

## 14. Recommendations (prioritised)

| # | Recommendation | Addresses | Priority | Effort | Status |
| - | --------------- | --------- | -------- | ------ | ------ |
| 1 | Run the pinned `standard` (or `full`) profile on an idle host and reconcile against the baseline of record | F-1 (this report) | P0 | S | ⬜ Open |
| 2 | Ship the static derived-metadata LRU cache (design A) + free wins (Cache-Control hoist, MIME memo) | F-2 (this report) | P1 | M | ⬜ Open |
| 3 | Write the middleware-dispatcher-unification RFC, then implement design A (unify `compose`/`compileExecutor`) | F-3 (this report) | P0, RFC-gated | L | ⬜ Open |
| 4 | Add the `%HaveSameMap` shape-stability gate and the lazy-field-unmaterialized gate to `packages/adapters/conformance` | F-4 (this report) | P2 | S–M | ⬜ Open |
| 5 | Apply the fast-property container fix to `body-parser`, `cookies`, `form-data` | F-5 (this report) | P3 | S | ⬜ Open |

Note: the erosion review's own F-5 ("prefix mount defeats the lazy-`ctx.state` optimization") is
**not yet triaged into this backlog as its own item** — it surfaced only as a side reference inside
F-4 above. It should get its own finding and priority the next time this backlog is revised; flagged
here rather than silently omitted.

---

## 15. Migration Strategy

Ordered by dependency, not just priority — items that gate others come first:

1. **Rec 1 (idle-host re-run)** — no dependency, should run first because its result may change how
   much further optimization effort is justified for the remaining items.
2. **Rec 4 (invariant gates)** — no dependency on the others; cheap; do it early so it can catch a
   regression in whatever ships next, including the items below it.
3. **Rec 2 (static cache)** — self-contained, no RFC, can ship independently of Rec 3.
4. **Rec 3 (dispatcher unification)** — blocked on an approved RFC (AGENTS.md §21); start the RFC
   in parallel with Rec 2, not after it, since the RFC review cycle is the long pole.
5. **Rec 5 (middleware container fix)** — fully independent, lowest risk, can land whenever convenient.

---

## 16. Conclusion

Six of the eleven items this backlog tracks were resolved in this session, each with deterministic
evidence and full test coverage, and each documented in its own investigation report with a
`✅ FIXED`/`✅ SHIPPED` annotation. What remains is not more triage — every open item already has a
cited measurement, a set of considered design alternatives, and a stated validation plan in an
existing report; this document exists to index that work so it is not lost between sessions, not to
re-derive it.

The single most valuable next step is **Rec 1**: run the pinned `standard` profile on an idle host.
Until that happens, "done" for the six shipped items means "mechanism removed and proven by
deterministic measurement," not "throughput improved" — an honest but incomplete claim that only
that one benchmark run can complete.

---

## Checklist

- [x] Filename is scope-first and in the right `report/<domain>/` folder (not generic).
- [x] System explained (§2) before any judgement.
- [x] Every significant finding uses all nine §12 fields and has an F-ID + priority.
- [x] Every finding cites concrete evidence (file:line, metric, trace) — sourced from prior
      investigation reports rather than re-measured, since this is a backlog index, not a new audit.
- [x] Performance findings use measured numbers from the prior investigation's `apps/benchmark` work.
- [x] UX findings section marked Not applicable with reason.
- [x] No dark pattern present — not applicable to this scope.
- [x] Every recommendation (§14) maps to an F-ID and a real, stated problem.
- [x] Progress Tracker (top) matches §14 Status column.
- [x] Sections that don't apply are "Not applicable — reason", not deleted.
- [x] Spawned decisions cross-linked to their source investigation reports and ADR-0021 (no
      duplication of their content).
- [x] All guidance blocks deleted.
