## ADDED Requirements

### Requirement: The load generator sends each scenario's declared request body, not a hardcoded literal

For every scenario with a `body` field in `config/scenarios.js`, every supported load-generator tool
(`wrk`, `autocannon`) SHALL send that exact body when measuring the scenario. No tool integration
SHALL rely on a second, hand-maintained literal of a scenario's body that can drift from the
declared value.

#### Scenario: wrk sends the scenario's declared body, not a shared static literal

- **WHEN** a `POST` scenario with a `body` field is benchmarked with `wrk`
- **THEN** the request body wrk actually transmits is derived from that scenario's `body` field at
  run time, not from a static `.lua` file whose body literal was authored independently of
  `config/scenarios.js`

#### Scenario: A large-body scenario measures its declared size, not a smaller default

- **WHEN** the `large-post` scenario (declared body ≥ 1 MiB) is benchmarked with `wrk`
- **THEN** the server-side parsed item count in the response matches the item count the scenario's
  declared body actually contains, proving the full declared body was received and parsed — not a
  smaller placeholder body

#### Scenario: Request-body fidelity is checked before timing, like response-body fidelity already is

- **WHEN** the fairness pre-flight (`validate-parity.js`) runs
- **THEN** it asserts, for every scenario with a declared `body`, that the request actually sent to
  the server reflects that declared body — extending the existing response-side parity check to the
  request side, so a request-body divergence fails the same pre-flight a response-body divergence
  already does

### Requirement: A cross-framework ranking requires rotated measurement position, not merely recording what position was used

A benchmark run comparing more than one framework SHALL NOT be marked `publishable: true` unless its
recorded `positionControl` is `"rotated"`. A missing, null, or `"fixed"` position-control value
SHALL be treated as failing this criterion — never as passing by omission.

#### Scenario: A fixed-order multi-framework run is rejected as unpublishable

- **WHEN** `derivePublishable` evaluates a run comparing more than one framework whose recorded
  `positionControl` is `"fixed"`
- **THEN** it returns `publishable: false` with a reason naming position control as the cause

#### Scenario: A run with no recorded position control is rejected, not silently passed

- **WHEN** `derivePublishable` evaluates a run comparing more than one framework whose
  `positionControl` field is absent or `null`
- **THEN** it returns `publishable: false`, the same as an explicitly `"fixed"` run — an unrecorded
  value never satisfies the criterion

#### Scenario: A rotated multi-framework run is not rejected on this criterion

- **WHEN** `derivePublishable` evaluates a run comparing more than one framework whose recorded
  `positionControl` is `"rotated"`
- **THEN** this criterion does not cause rejection (the run may still be rejected by any of the
  other existing criteria — runs, concurrency levels, duration, timeouts)

#### Scenario: A single-framework run is exempt from this criterion

- **WHEN** `derivePublishable` evaluates a run measuring exactly one framework
- **THEN** the position-control criterion does not apply, since there is no cross-framework position
  to counterbalance

#### Scenario: The rendered scoreboard's "not a ranking" warning uses the same fallback logic as the run's own metadata table

- **WHEN** a report is generated for a run whose `positionControl` is missing, `null`, or `"fixed"`
- **THEN** the scoreboard section renders the "not a ranking" warning instead of a ranked table, using
  the same `positionControl ?? order` resolution the Load Configuration table already uses — so the
  two sections of one report can never disagree about whether the run backs a ranking

### Requirement: A run's publishability verdict is corrected in its own stored artifact, not only in artifacts derived from it

When a run's recorded configuration and results indicate it does not meet publishability criteria,
the correction SHALL be written into that run's own `results.json`, not only computed on the fly when
a report is later rendered from it.

#### Scenario: A freshly completed run's results.json already carries its correct verdict

- **WHEN** a benchmark run completes and `results.json` is written for the first time
- **THEN** its `publishable` and `publishableReason` fields already reflect the outcome of the full
  publishability evaluation (including the position-control criterion), not a value that a later,
  separate regeneration step must first correct

#### Scenario: The regression gate consumes the corrected verdict

- **WHEN** `check-regression.js` reads a baseline or latest run's publishability status
- **THEN** it evaluates that status through the same recomputation logic used elsewhere, rather than
  trusting a stored field that could be stale

### Requirement: Socket-timeout accounting is consistent across every supported load-generator tool

The publishability gate's timeout criterion SHALL count timeouts correctly regardless of which
supported load-generator tool (`wrk` or `autocannon`) produced a run's results. Each tool's adapter
SHALL normalize its own error/timeout shape at the point where it already normalizes its other
result fields (RPS, latency), rather than requiring a downstream reader to know each tool's
particular field-naming convention.

#### Scenario: An autocannon run with socket timeouts is rejected the same as a wrk run with equivalent timeouts

- **WHEN** a run produced by `autocannon` records one or more socket timeouts
- **THEN** the publishability gate's timeout criterion counts them and can reject the run on that
  basis, the same way it already does for a `wrk`-produced run with an equivalent timeout count

#### Scenario: A run with zero timeouts from either tool passes this criterion identically

- **WHEN** a run produced by either `wrk` or `autocannon` records zero socket timeouts
- **THEN** the publishability gate's timeout criterion does not reject the run, and the outcome does
  not depend on which tool produced the measurement

### Requirement: A scenario's `identicalWork` classification reflects what the harness's fairness check actually verifies for it

A scenario SHALL be classified `identicalWork: true` only while the fairness pre-flight
(`validate-parity.js`) verifies enough of that scenario's response to support the claim that every
compared framework performed equivalent work. A scenario whose response varies across frameworks in
ways the pre-flight does not check (e.g. its full response header set) SHALL be classified
`identicalWork: false` and scored as idiomatic, alongside any other scenario already excluded from
the headline like-for-like score, until the pre-flight check is extended to cover it.

#### Scenario: A scenario with unverified header divergence is excluded from the headline score

- **WHEN** a scenario's response headers are known to differ across compared frameworks in ways
  `validate-parity.js` does not check, and no fix to the pre-flight closes that gap in the same
  change
- **THEN** that scenario is classified `identicalWork: false` in `config/scenarios.js`, is excluded
  from the like-for-like headline ranking, and is reported in the "all scenarios" table with the
  same idiomatic labeling already used for `middleware-stack` and `error-handling`

#### Scenario: Reclassification does not change ranking behavior for any other scenario

- **WHEN** a scenario is reclassified from `identicalWork: true` to `identicalWork: false`
- **THEN** every other scenario's classification, ranking, and points are unaffected — only the
  reclassified scenario moves out of the like-for-like scoring set

### Requirement: A generated report's methodology and metadata claims are derived from the run's own recorded state, never asserted as fixed literals

Every factual claim a generated report makes about how the reported run was measured — whether
fairness parity was validated, how many scenarios are like-for-like, at what interval resource
metrics were sampled, and why a run is or is not publishable — SHALL be computed from that run's own
recorded configuration and results, not written as a string that is identical regardless of what the
run actually did.

#### Scenario: The parity claim reflects whether parity validation actually ran for this run

- **WHEN** a report is generated for a run where the fairness pre-flight was skipped (e.g.
  `--no-validate`, or a single-framework run where cross-framework parity does not apply)
- **THEN** the report states that parity was not validated for this run and why, rather than
  asserting unconditionally that response bodies and content types were validated byte-identical

#### Scenario: The parity claim reflects a validation failure if one occurred

- **WHEN** a report is generated for a run where the fairness pre-flight ran and recorded failures
- **THEN** the report states that parity validation failed for this run, rather than presenting the
  same success claim it would for a clean run

#### Scenario: The scenario-fairness count matches the run's actual scenario set

- **WHEN** a report is generated for a run whose configuration includes fewer scenarios than the
  full suite (e.g. the `quick` profile's four-scenario subset)
- **THEN** the report's scenario-fairness statement names the actual count of like-for-like scenarios
  in that run and the actual names of any excluded scenarios, rather than a fixed count describing
  the full suite

#### Scenario: The resource-sampling interval statement matches the harness's configured interval

- **WHEN** a report's Resource Usage section states the sampling interval used for CPU/RSS metrics
- **THEN** the stated interval is read from the harness's configured sampling interval constant,
  rather than a literal that can independently drift from that constant

#### Scenario: A non-publishable run's header states its actual reason

- **WHEN** a report is generated for a run marked non-publishable, and that run's recorded
  `publishableReason` is present
- **THEN** the report's header callout states that specific reason, rather than a single generic
  explanation used for every non-publishable run regardless of cause

### Requirement: A resource-efficiency ratio's numerator and denominator describe the same measurement scope

Where a report presents a ratio of throughput to a resource metric (e.g. requests-per-second per
percent CPU, requests-per-second per megabyte of RSS), the report SHALL either compute both sides of
the ratio over the same measurement window, or state plainly that the resource metric is a whole-run
aggregate distinct from the throughput figure's narrower scope — never present a whole-run aggregate
under a heading naming one specific scenario as if the ratio were scoped to it.

#### Scenario: A whole-run resource aggregate is labeled as such

- **WHEN** a report's Efficiency section pairs one scenario's throughput with CPU/RSS metrics sampled
  across the entire run's scenario sweep
- **THEN** the section's heading and accompanying text state that the resource metrics are a
  whole-run aggregate, not scoped to the named scenario alone

#### Scenario: A "peak" resource value reported across multiple measurement passes is a true maximum

- **WHEN** a run's memory metrics are combined across more than one internal measurement pass (e.g.
  rotation's repeated per-framework passes)
- **THEN** the reported peak RSS value is the maximum peak observed across those passes, not an
  average of the passes' individual peak values

### Requirement: Harness fixes can be verified within a dev/agentic session's time budget without sacrificing methodological honesty

A benchmark profile SHALL exist that is fast enough to run repeatedly within a single development or
agentic session (on the order of minutes, not the multi-hour duration of the publishable `full`
profile), while still satisfying enough of the publishability criteria (multiple runs, multiple
concurrency levels, rotated position control) to meaningfully exercise those same criteria and the
fixes that depend on them. This profile SHALL be clearly and permanently marked as not publishable,
independent of whether its measured values would otherwise satisfy the numeric publishability
thresholds.

#### Scenario: The verification profile completes within a session-scale time budget

- **WHEN** the verification profile is run against its default scenario subset and framework set
- **THEN** it completes in minutes, not hours, making it practical to run once per fix during
  iterative development

#### Scenario: The verification profile exercises rotation-dependent behavior

- **WHEN** the verification profile is run with more than one framework and rotation enabled
- **THEN** it performs more than one run per framework, satisfying the minimum run count that makes
  position-rotation logic exercisable — unlike a single-run profile, which cannot rotate at all

#### Scenario: The verification profile is never presented as a publishable measurement

- **WHEN** the verification profile's results are recorded or rendered into a report
- **THEN** they are marked non-publishable unconditionally, regardless of whether the run happens to
  satisfy the other numeric publishability criteria

#### Scenario: Existing profiles are unchanged by the addition of the verification profile

- **WHEN** the verification profile is added to the harness's set of profiles
- **THEN** the `quick`, `standard`, `full`, and `stress` profiles' definitions, names, and behavior
  remain exactly as they were before this profile was added
