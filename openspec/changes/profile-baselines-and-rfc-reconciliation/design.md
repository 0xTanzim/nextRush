# Design

## Context

See `proposal.md` — Why. Three constraints shape the approach.

The prior session already established that this machine is noisy: run-to-run spread on
`inproc.nextrush.vs_hono` measured 8–12 %, and single runs were not evidence of anything. It also
established that sampled `heapUsed` is not a usable allocation metric (≈5 B/request on Bun
regardless of work; heap-growth summation on Node), so allocation claims need a deterministic
counter, not a sampler.

`dev-check` already owns the machinery this change needs: `profile` bundles any
`entries/<name>.ts` unminified and runs it under the runtime's own CPU profiler (Bun
`--cpu-prof-md`, Node `--cpu-prof` + `cpuprofile-top.mjs`). It has entries for hello-world,
cold-start, wire, and probes — but none for a request with a body or a middleware stack.

The RFC trackers are hand-maintained tables. They drifted because the last change updated code and
specs but not the trackers; nothing enforces them.

## Goals / Non-Goals

**Goals:**

- A Node baseline for the same shapes Bun already has, recorded before anything rewrites the Node
  response path.
- Attribution that separates framework work from platform work and from the harness, with enough
  provenance that a reader can reproduce or dismiss it.
- An explicit, small acceptance gate for "fix it now" versus "record it and escalate".

**Non-Goals:**

- Changing library behaviour. This change measures, documents, and at most removes work that
  produces no observable difference.
- Adding committed budget ratios for the new shapes. A ratio is an acceptance threshold; deciding
  one before measuring would invert the order this change exists to protect.
- Implementing RFC-041, deleting the `FB-03` exemption, or touching compression/timer.
- Claiming cache-line or branch-predictor effects. JavaScript gives no portable way to measure
  them; the design uses proxies and says so.

## Decisions

**D1 — Land before building.** Merge `feat/rfc-039-precompile-tax` to `main` first, then branch the
remaining work from `main`.
Why: the branch carries 25 commits of finished work. Stacking new commits on it makes the next
review a 30-commit diff and leaves `main` permanently behind. Alternative rejected: land at the end —
it keeps one branch but makes every intermediate commit unreviewable in isolation.

**D2 — This change declares `skip_specs: true`.** Its own work is tooling, measurement, and
documentation; the fixes it may accept are, by definition, not observable.
Why: specs describe behaviour. Inventing a requirement to satisfy the validator would make the spec
lie about its own purpose.
Reopen condition: the moment a candidate fix would change an observable output, status, header, or
timing guarantee the framework documents, it stops being in scope. Either a delta is added to this
change before the fix, or the fix moves to a change that owns that behaviour. There is no third path.

**D3 — Measurements carry provenance, not just a number.** Every recorded result states runtime and
exact version, entry, environment variables, iteration count, command, date, and whether the machine
was otherwise loaded. Timing claims use best-of-three and are reported with the observed spread.
Why: the previous session's most expensive lesson was that a plausible-looking single run was wrong.
Alternative rejected: recording medians only — hides bimodality and the spread that decides whether a
delta is real.

**D4 — Separate the parser from the request path.** Two POST entries: one with `bodyParser()`, one
that reads the body without it. The difference isolates parser cost from dispatch cost; hello-world
versus middleware-stack isolates middleware cost the same way.
Why: a single POST profile would leave "the parser is 40 %" and "the context is 40 %" indistinguishable.
Alternative rejected: one entry with a flag — the flag becomes a branch in the measured code.

**D5 — New entries are NextRush-only; no new committed ratios.** The profile stage answers "where does
time go", not "are we fast enough". Budgeted shapes need thresholds, and thresholds are a separate
decision with a separate failure mode.
Alternative rejected: add Hono counterparts and ratios now — it doubles the entry count and silently
commits acceptance numbers chosen before any measurement.

**D6 — Cache lines and CPU behaviour are reasoned about, never measured.** The change records:
per-request object counts from a deterministic counter, property-order/shape stability of the hot
request objects (a hidden-class transition is the observable proxy for layout churn), and CPU
self/total from the profiler. Any cache-line claim is labelled inference and carries its basis.
Why: V8/JSC expose no portable cache-miss counter to user code. Pretending otherwise produces
confident fiction.

**D7 — Fix gate: all four must hold.**
1. The behaviour is unchanged — same status, headers, body, ordering, and documented timing contract.
2. The win exceeds the measured run-to-run spread on best-of-three, on the affected scenario.
3. The diff stays inside one module and adds no public API.
4. A failing test (or a deterministic allocation assertion) exists before the fix, and the
   `dev-check` gate does not regress.
Anything that fails (1) or (3) is escalated with evidence, not fixed here.

**D8 — One status source of truth for RFCs.** A tracker row may only claim what a shipped commit or
a passing test demonstrates, and the RFC's own status line must equal its row in `docs/RFC/INDEX.md`.
Why: the current mismatch (RFC-029 file `Approved`, index `Draft`) is how a reader learns to stop
trusting the index.

**D9 — Findings are recorded whether or not they are fixed.** Each finding states: measured cost and
source anchor, impact, counter-evidence, trade-off, and a validation criterion. A finding with no
validation criterion is an opinion and does not enter the record.
Why: RFC-039 P2/P3 and RFC-041 all need to be decidable later from the record, without re-running
the session.

## Risks / Trade-offs

- **[Machine noise makes a real win invisible]** → best-of-three, pinned CPU where available, report
  the spread, and require the win to exceed it. If it does not, the answer is "not proven", not "no
  win" — and the finding says which.
- **[Profiler overhead distorts absolute times]** → compare self-time shares and call counts, not
  absolute microseconds, across profiled runs.
- **[POST entry measures JSON.parse more than the framework]** → the paired unparsed entry exists
  precisely to subtract it, and the record reports both.
- **[The middleware entry measures the middleware's own `ctx.set` cost]** → that is the point
  (middleware-stack cost), but the finding must name which middleware contributed, not just the total.
- **[Node `--cpu-prof` sampling is coarse for a ~10 µs request]** → increase N, state the sampling
  interval, and treat sub-1 % rows as noise rather than findings.
- **[Tracker edits are still manual]** → D8 plus a task that cross-checks every row against a commit
  or test reduces the chance of another drift; automation is deliberately out of scope.

## Migration Plan

No runtime migration. Landing order: merge the archived work → branch → tooling and tracker edits →
measurement → triage → accepted fixes → gates. Each group is independently revertible; the tracker
edits touch no code, and the harness entries are additive.

## Open Questions

None blocking. Two deferrable items are recorded rather than decided here: whether the new shapes
should ever become budgeted ratios, and whether `profile` should emit machine-readable output instead
of a table. Neither changes the artifacts or the task breakdown.
