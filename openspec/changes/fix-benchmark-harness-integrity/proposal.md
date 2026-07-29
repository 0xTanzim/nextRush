## Why

`report/benchmark/benchmark-engineering-audit-review.md` (independent audit, 2026-07-29) found that
the benchmark harness's *arithmetic* is trustworthy (336 statistical cells, 2 ranking tables, and 288
CSV rows independently reproduced with zero mismatches) but its *methodology gates* and *generated
report claims* are not. Two defects are P0/P1-critical and already live in the codepath the
project's own documented publishable path uses:

- **P0-001**: under `wrk` (the default, documented tool), every POST scenario sends one hardcoded
  46-byte body — `large-post` (declared ≥1 MiB) silently measures the wrong workload with no gate
  catching it.
- **P1-001**: the publishability gate never checks position-control, so two committed artifacts
  render medal rankings from runs the harness's own log calls "NOT publishable as a ranking."

Five more P1s and eight P2s compound this: a stale `publishable: true` surviving in the
highest-confidence artifact, an error-key mismatch that makes the autocannon timeout check
inoperative, an `identicalWork: true` scenario that is measurably not equivalent (1.65× header-byte
spread), reports that assert claims (parity ran; "8 scenarios") instead of deriving them, and an
efficiency ratio that divides across mismatched measurement windows.

Fixing these now — before any further measurement — is required by this project's own audit
findings and by AGENTS.md §14 ("claims require verification") and §15 (compatibility is a
one-way ratchet, not an excuse to leave known-wrong gates in place).

## What Changes

- Derive the `wrk` POST request body per scenario from `config/scenarios.js` instead of one
  hardcoded Lua literal; assert the load generator's actual request body matches the scenario's
  declared body before timing (extends `validate-parity.js`'s existing request-side coverage).
- Add `positionControl === 'rotated'` as a required criterion in `derivePublishable`; align the
  "Not a ranking" scoreboard guard with the same `positionControl ?? order` fallback the metadata
  table already uses, so a missing value is treated as unverified rather than as passing.
- Persist the recomputed publishability verdict back into `results.json` (not only into derived
  artifacts), and point `check-regression.js` at the recomputed verdict instead of the stored field.
- Normalize the wrk/autocannon error shape at the tool-adapter boundary (`{ nonOk, timeouts,
  connect, read, write }`) so `derivePublishable`'s timeout check is tool-agnostic.
- Reclassify `static-file` as `identicalWork: false` (idiomatic, scored separately, like
  `middleware-stack`/`error-handling`) until full-response-header parity is added to
  `validate-parity.js`.
- Record the parity-gate outcome (validated / skipped-with-reason / failed) in `results.json` and
  render it verbatim in the generated report, replacing the current unconditional "Parity: response
  bodies … validated" literal.
- Derive the report's scenario-fairness sentence and its `/proc`-sampling-interval sentence from
  the run's own configuration instead of hardcoded literals ("8 scenarios," "once per second").
  Render `publishableReason` verbatim instead of a fixed explanation string.
- Fix the `Efficiency` section's ratio to use `max`, not `mean`, for `rssPeak` across rotation
  passes, and either compute CPU/RSS per scenario-cell or explicitly relabel the section as a
  whole-sweep aggregate.
- Add unit tests for `rotate()` (currently untested despite being the sole position-counterbalance
  mechanism) and for the publishable-requires-rotation rule.
- Add a scaled-down but methodologically complete verification profile (multi-run, ≥2 concurrency
  levels, ≥10s duration, rotated) that a dev/agentic session can run in minutes, not hours, to
  validate each fix — the existing `full` profile (5-10 hours) remains the release/publication gate
  and is never invoked by this change's own verification.
- No backwards-compatibility shim, deprecated flag, or dual codepath is introduced anywhere in this
  change: every fixed function replaces its prior (wrong) behavior outright. `derivePublishable`,
  `validate-parity.js`, and the report sections keep their existing public call signatures — only
  their internal correctness changes — so this is **not** a breaking change to the harness's own
  CLI or module surface.

## Capabilities

### New Capabilities

_None._ This is corrective work on an existing capability's own documented methodology
requirements, not a new durable capability.

### Modified Capabilities

- `performance-gate`: adds requirements for (a) load-generator request-body fidelity to the
  scenario declaration, (b) publishability requiring rotated position control, not merely recorded
  as a property of it, (c) tool-agnostic error/timeout accounting, (d) `static-file` scenario
  fairness classification, (e) generated-report claims being derived from the run's own recorded
  state rather than asserted as literals, and (f) a scaled-down, time-bounded verification profile
  distinct from the existing publishable `full` profile.

## Impact

- **Code**: `apps/benchmark/scripts/{bench-exec.js,lib/publishable.js,lib/parity.js,
  validate-parity.js,check-regression.js,lib/tools/{wrk.js,autocannon.js},lib/report/
  {sections-detail.js,sections-scoreboard.js},bench-rotation.js}`, `apps/benchmark/config/
  scenarios.js`, `apps/benchmark/wrk/post-json.lua` (removed as a static literal, replaced by
  generated-per-scenario body), `apps/benchmark/scripts/lib/__tests__/*` (new tests for `rotate()`
  and the affected pure modules).
- **Data**: `results.json`'s schema gains a `parity` field (validated/skipped/failed) and its
  `publishable`/`publishableReason` fields become self-correcting in place rather than only in
  derived artifacts. No existing consumer of `results.json` outside this repo is known; this is an
  additive field plus a correctness fix to existing fields' values, not a field removal.
- **Docs**: root `README.md` and `apps/benchmark/README.md` scenario-count claims are corrected to
  be derived-verifiable (8 vs 10 vs 13 scenario counts, per the audit's P2-008).
- **No RFC required**: this is a correctness fix to an existing internal tool's own documented
  methodology contract (already specified in `performance-gate`'s spec), not a new package, new
  capability, or public-API/routing/middleware/DI/adapter change.
