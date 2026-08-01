# gap-checklist-accuracy

## Purpose

The requirement that `docs/audits/03-gap-checklist.md`'s task statuses, dashboard, and readiness
metrics are independently verified against source/CI/docs rather than asserted, and that each
status carries a citable verification note.

## Requirements

### Requirement: Every task status is independently verified against source
Each task's status glyph (□ Not Started / ◐ In Progress / ☑ Completed) in
`docs/audits/03-gap-checklist.md` SHALL be set only after checking real repository evidence
(source files, CI workflow definitions, published docs/README text) — never carried forward from
the task's prior glyph or from another audit document without independent confirmation.

#### Scenario: A task claimed done is re-checked against source
- **WHEN** a task's existing glyph is ☑ or its description implies completion
- **THEN** the re-baseline confirms the claim against an actual file, grep result, or workflow
  before leaving the glyph unchanged

#### Scenario: A task closed by an archived change is detected
- **WHEN** an archived OpenSpec change's tasks map to one or more gap-checklist items
- **THEN** those gap-checklist items are checked against the archived change's actual delivered
  artifacts (not the change's proposal text) and updated accordingly

### Requirement: Status corrections carry a citable verification note
Every task whose status glyph changes SHALL include a one-line "Verified:" annotation identifying
what was checked (a file path, a grep/search result, a workflow file name, or an explicit "not
found in source") so the correction is auditable by a future reader without re-doing the check.

#### Scenario: A status change is auditable
- **WHEN** a task's glyph changes from □ to ☑ or ◐
- **THEN** the task entry includes a "Verified:" note citing the specific evidence checked

### Requirement: Partial completion is represented honestly, not forced binary
When a task is genuinely partially complete (some acceptance criteria met, others not), the
checklist SHALL use ◐ (In Progress) with an annotation describing exactly what is done and what
remains — never rounded up to ☑ or down to □.

#### Scenario: A partially-delivered task is marked accurately
- **WHEN** a task's acceptance criteria are met for one runtime/scope but not another (e.g. a
  bundle-size gate exists for the edge bundle but not a general "core" budget)
- **THEN** the task is marked ◐ with a note distinguishing the delivered scope from the remaining
  scope

### Requirement: Derived metrics are recomputed from corrected statuses
The Progress Dashboard's per-phase task counts and completion percentages, and the Engineering
Metrics section's readiness percentages, SHALL be recalculated directly from the corrected task
glyphs after every status update — never hand-adjusted independently of the task list they
summarize.

#### Scenario: Dashboard reflects corrected task counts
- **WHEN** task statuses in a phase are corrected
- **THEN** that phase's □/◐/☑ counts and completion percentage in the Progress Dashboard are
  recalculated to match the corrected task list exactly

### Requirement: Task scope is not silently rewritten during a status correction
A status-correction pass SHALL NOT change a task's description, priority, effort estimate, or
acceptance criteria. If a task's description text is factually contradicted by current source
state, the correction adds a footnote explaining the discrepancy rather than editing the original
task scope.

#### Scenario: A stale task description is footnoted, not rewritten
- **WHEN** a task's description asserts something no longer true about the current source (e.g.
  describing work as entirely unstarted when a related capability already partially covers it)
- **THEN** the task gains an explanatory note alongside its corrected status, and its original
  description text remains unchanged
