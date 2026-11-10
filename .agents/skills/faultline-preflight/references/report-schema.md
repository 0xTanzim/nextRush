# Faultline Preflight Report Schema

The report is a durable engineering artifact. Keep headings and field labels
stable so people, follow-up agents and validators can compare runs.

## Required top-level sections

- `## Executive summary`
- `## Scope and success conditions`
- `## Reconnaissance and system map`
- `## Code-path and change-impact analysis`
- `## Evidence, assumptions, and unknowns`
- `## Coverage matrix`
- `## Risk register`
- `## Failure chains and pre-mortem`
- `## Break attempts and test results`
- `## Specialist review provenance`
- `## Proposed requirements and scenarios`
- `## Decisions required before specification`
- `## Limitations`

## Risk record

Each risk begins with a unique heading:

`### FL-001 — Short descriptive title`

Every record includes:

- `Status:` CONFIRMED / LIKELY / POSSIBLE / NOT_REPRODUCED
- `Evidence level:` OBSERVED / INFERRED / HYPOTHESIS
- `Priority:` Critical / High / Medium / Low
- `Severity:` Critical / High / Medium / Low
- `Likelihood:` Expected / Likely / Possible / Unlikely / Rare
- `Confidence:` High / Medium / Low
- `Disposition:` mitigate / accept / defer / investigate
- `Domain:` one or more failure-taxonomy domains
- `Components/paths:` exact entry points, modules, files and symbols
- `Evidence:` citations to code, tests, requirements, logs or explicit unknowns
- `Preconditions:` what must be true before failure can occur
- `Trigger:` event, input, timing or environment condition
- `Failure sequence:` ordered path including side effects/partial commits
- `Expected behavior:` observable invariant/contract
- `Observed behavior:` actual result, or `not executed`
- `Impact:` user/data/security/financial/operational consequence
- `Detection/recovery:` signals, rollback, compensation or manual response
- `Mitigation:` control or engineering decision
- `Reproduction/test:` exact recipe or proposed test, with execution status
- `Acceptance test:` Given / When / Then

Never leave a field blank. Use `Not applicable — <reason>` only when truly
irrelevant. A test gap is not itself a defect; record it separately.

## Coverage matrix

Use `covered`, `not-applicable` (with reason) or `not-assessed` (with reason).
Include repository/system layers as rows, not only generic failure categories.

## Acceptance scenario

```text
Given <specific initial state and relevant preconditions>
When <specific event, input, ordering or failure>
Then <observable and testable expected behavior>
```

Avoid vague outcomes such as "handles gracefully" or "is secure". Specify
status codes, persisted state, emitted events, invariants, alerts, rollback and
recovery results where applicable.
