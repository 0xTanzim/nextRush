# Faultline Preflight — <scope-or-change-slug>

- **Date:** YYYY-MM-DD
- **Repository revision:**
- **Working-tree state:**
- **Mode:** brownfield-preflight / greenfield-preflight / break-existing-system
- **Analyst:** AI-assisted; host/model if known

## Executive summary

- Overall risk posture:
- Confirmed defects:
- Critical/High risks:
- Key decisions before specification:
- Most important unknown:

## Scope and success conditions

### Intended outcome

### Affected actors

### In scope / out of scope

### Success conditions and invariants

## Reconnaissance and system map

### Repository structure and entry points

### Runtime/process model

### Components and dependencies

### Data stores, schemas and transactions

### State machines and invariants

### Trust boundaries and permissions

### Build, tests, CI/CD and deployment

### Observability, backup and recovery

### Unknown or uninspected areas

## Code-path and change-impact analysis

| Operation/entry point | Path traced | Side effects | Existing contract | Affected consumers | Test coverage |
|---|---|---|---|---|---|

## Evidence, assumptions, and unknowns

| ID | Statement | Type (Observed / Assumed / Hypothesis) | Evidence | Impact if wrong |
|---|---|---|---|---|

## Coverage matrix

| Layer/domain | Status (covered / not-applicable / not-assessed) | Inspected evidence or reason |
|---|---|---|
| Repository/runtime structure | | |
| User behavior and workflow | | |
| Input and boundaries | | |
| Control flow and error handling | | |
| State and lifecycle | | |
| Concurrency and distributed execution | | |
| Runtime and resource failures | | |
| External dependencies | | |
| Data and persistence | | |
| Security and abuse | | |
| Performance and scale | | |
| Deployment and operations | | |
| Recovery and reversibility | | |
| Existing contracts and compatibility | | |

## Risk register

### FL-001 — <short descriptive title>

- **Status:** CONFIRMED / LIKELY / POSSIBLE / NOT_REPRODUCED
- **Evidence level:** OBSERVED / INFERRED / HYPOTHESIS
- **Priority:** Critical / High / Medium / Low
- **Severity:** Critical / High / Medium / Low
- **Likelihood:** Expected / Likely / Possible / Unlikely / Rare
- **Confidence:** High / Medium / Low
- **Disposition:** mitigate / accept / defer / investigate
- **Domain:**
- **Components/paths:**
- **Evidence:**
- **Preconditions:**
- **Trigger:**
- **Failure sequence:**
  1.
  2.
  3.
- **Expected behavior:**
- **Observed behavior:**
- **Impact:**
- **Detection/recovery:**
- **Mitigation:**
- **Reproduction/test:** state whether executed or proposed
- **Acceptance test:**
  - **Given**
  - **When**
  - **Then**

## Failure chains and pre-mortem

### Failure chain 1

- **Unwanted outcome:**
- **Contributing events (AND/OR):**
- **Earliest preventable decision:**
- **Warning signal:**
- **Mitigation:**

## Break attempts and test results

| Check/test | Command or method | Safety class | Executed? | Result | Finding IDs |
|---|---|---|---|---|---|

## Specialist review provenance

| Role | Host subagent / sequential pass | Scope | Result | Limitations |
|---|---|---|---|---|

## Proposed requirements and scenarios

| Requirement ID | Requirement / invariant | Source risk IDs | Given/When/Then | Verification method |
|---|---|---|---|---|

## Decisions required before specification

| Decision | Options | Recommendation | Risk IDs | Owner / status |
|---|---|---|---|---|

## Limitations

- Files/subsystems not inspected:
- Missing evidence:
- Commands/tests not run and why:
- Scenarios not validated:
- Subagent limitations:
- Analysis limitations and next steps:
