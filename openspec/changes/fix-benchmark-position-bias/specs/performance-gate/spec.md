# Spec Delta — `performance-gate`

## ADDED Requirements

### Requirement: A publishable comparison controls for measurement-order position bias

A benchmark comparison whose profile is marked publishable SHALL counterbalance which framework
occupies each measurement position across its run repeats, rather than measuring every framework's
full workload in one fixed position for the entire comparison. A comparison that does not
counterbalance position SHALL NOT be presented as a cross-framework ranking.

This exists because the harness was shown to report an 11.7% throughput advantage to whichever
framework was measured in a later position, reversible by swapping which framework went first,
independent of any framework's actual behavior.

#### Scenario: Every framework occupies every position across a publishable run

- **WHEN** a publishable-profile comparison runs with more than one repeat
- **THEN** each framework is measured first, second, …, last an equal count (±1) across the full set
  of repeats, rather than always in the same position

#### Scenario: The report discloses the position-control scheme used

- **WHEN** a benchmark report is generated
- **THEN** it states whether framework measurement order was fixed, shuffled, or rotated for that
  run, so a reader can tell whether position bias was controlled for before trusting a ranking

#### Scenario: An unrotated comparison is not presented as a ranking

- **WHEN** a comparison ran with fixed (unrotated, unshuffled) order
- **THEN** its report does not present a cross-framework win/loss ranking as a framework-efficiency
  finding
