## ADDED Requirements

### Requirement: The generated report discloses when the load-generator's accept-queue backlog overrides a competitor framework's own default

When the fairness pre-flight reads back the effective TCP accept-queue backlog from the operating
system for every measured server, the generated report's Load Configuration table SHALL render
that value and SHALL state that it overrides each framework's own native default where that is the
case, so a reader is not left inferring the override from source code or a separate audit document.

#### Scenario: Backlog value rendered when parity was validated

- **WHEN** a report is generated for a run whose recorded configuration shows the parity gate ran
  and read back an OS-level accept-queue backlog value
- **THEN** the Load Configuration table includes a row stating that value and noting it overrides
  each framework's own default where the override is in effect

#### Scenario: No fabricated backlog value when parity was skipped

- **WHEN** a report is generated for a run whose recorded configuration shows the parity gate was
  skipped or never ran
- **THEN** the Load Configuration table states the backlog value was not verified for this run,
  rather than omitting the row or asserting an unverified value

### Requirement: The headline ranking excludes the single-connection level and treats a statistically insignificant gap as a tie

The headline like-for-like and all-scenarios point aggregates SHALL be computed over concurrency
levels greater than one connection, consistent with the methodology's own stated distinction
between the single-connection level (per-request latency) and higher levels (throughput). When two
adjacent-ranked entries' RPS gap is smaller than the sum of their standard deviations, the ranking
SHALL award both entries the same rank and split the combined points for those ranks evenly, rather
than treating the gap as a full-rank difference.

#### Scenario: Single-connection level excluded from the headline aggregate

- **WHEN** the headline like-for-like or all-scenarios point totals are computed for a run that
  includes a single-connection (c1) concurrency level alongside higher levels
- **THEN** the c1 level's rankings do not contribute to those totals, while `pointsPerConnection`
  still reports c1's own ranking separately

#### Scenario: A statistically insignificant gap produces a shared rank

- **WHEN** two frameworks' measured RPS for the same scenario and concurrency level differ by less
  than the sum of their standard deviations
- **THEN** both frameworks receive the same rank for that cell and each receives half of the
  combined points available to those two rank positions

### Requirement: Charts never render a missing measurement as zero

Every chart builder that plots a per-framework, per-scenario, or per-concurrency-level series SHALL
omit a data point for a cell with no valid measurement rather than substituting zero, and SHALL
note in the chart's caption which cell was omitted and why.

#### Scenario: A missing cell is omitted, not zeroed

- **WHEN** a chart is built from a scoreboard containing a scenario/connection cell with no valid
  measurement for one framework
- **THEN** that framework's series omits the point for that cell instead of rendering it as zero,
  and the chart's caption states which cell was omitted and why

## MODIFIED Requirements

### Requirement: A generated report's methodology and metadata claims are derived from the run's own recorded state, never asserted as fixed literals

Every factual claim a generated report makes about how the reported run was measured — whether
fairness parity was validated, how many scenarios are like-for-like, at what interval resource
metrics were sampled, and why a run is or is not publishable — SHALL be computed from that run's own
recorded configuration and results, not written as a string that is identical regardless of what the
run actually did. This requirement extends to both `apps/benchmark/README.md` and the root
`README.md`: any scenario-count or like-for-like-count claim they state SHALL match
`config/scenarios.js`'s actual scenario list and its `identicalWork` classification at the time the
document was last updated, so a report's derived counts and the project's own documentation cannot
silently drift apart the way a prior literal ("8 scenarios") already had.

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

#### Scenario: README scenario counts match the current scenario configuration

- **WHEN** either `apps/benchmark/README.md` or the root `README.md` states how many scenarios the
  harness exercises or how many are scored like-for-like, anywhere in the document including its
  Methodology section
- **THEN** both counts match `config/scenarios.js`'s actual scenario list and its `identicalWork`
  classification, with no location in either document stating a stale or superseded count
