---
name: faultline-spec-audit
description: Audit an OpenSpec proposal or change against a Faultline preflight report. Find risks that were omitted, weakened, made vague, or left without testable Given/When/Then scenarios; verify decisions and traceability before implementation.
license: MIT
compatibility: Requires an Agent Skills-compatible coding agent.
metadata:
  project: faultline
  version: "0.3.0"
---

# Faultline Spec Audit

## Mission

Check whether the OpenSpec proposal faithfully turns the preflight risk analysis into precise, testable requirements. This is a specification audit, not an implementation review.

## Inputs

Locate:

- The relevant Faultline report under `docs/engineering/pre-spec/`.
- The active OpenSpec change under `openspec/changes/`.
- Existing specs and project context where relevant.

If multiple candidate reports or changes exist, do not guess. Identify the candidates and choose the one clearly linked by name/content; otherwise ask one focused question.

## Audit procedure

### 1. Establish traceability

For each Critical and High risk in the report, locate the corresponding proposal requirement, scenario, explicit accepted-risk decision, or out-of-scope rationale.

### 2. Check scenario quality

For each relevant scenario, verify:

- Preconditions and initial state are specific.
- Trigger is reproducible.
- The failure condition is explicit.
- Expected behavior is observable and testable.
- Partial side effects and persistence are addressed.
- Retry, duplicate execution, concurrency, and recovery are addressed where applicable.
- Authorization and tenant boundaries are explicit where applicable.

Reject vague statements such as "handles errors gracefully" unless the observable behavior is defined elsewhere.

### 3. Check brownfield compatibility and regression impact

For an existing repository, compare the proposal against the observed system map
and code-path analysis. Check whether the proposal accounts for:
- Existing callers, API consumers, CLI users, events and public interfaces.
- Existing data and schema compatibility across old/new versions.
- Existing authorization, tenant isolation and trust boundaries.
- Existing retries, idempotency, queue delivery and transaction semantics.
- Existing operational contracts, alerts, runbooks and recovery behavior.
- Regression tests for behavior that must remain unchanged.

### 4. Check coverage gaps

Look for:

- Risk missing entirely.
- Risk present only in prose but absent from testable scenarios.
- Mitigation proposed without acceptance criteria.
- Accepted risk without rationale or owner.
- Requirement that contradicts an invariant or another scenario.
- Failure scenario that assumes impossible behavior or unsupported architecture.
- New risks introduced by the proposed solution.
- Migration, rollout, rollback, observability, and recovery gaps.

### 5. Check scope and consistency

Confirm that:

- The proposal's scope matches the preflight scope or explains the change.
- Assumptions are either validated or explicit.
- Open questions that block design are not silently treated as decisions.
- Non-functional requirements have measurable thresholds when possible.
- No implementation detail is prescribed without a reason when multiple designs remain viable.

### 6. Produce audit result

Write a concise report to `docs/engineering/spec-audits/<change-slug>.md` without modifying the OpenSpec proposal unless explicitly requested.

Use these statuses:

- `PASS`: no material traceability gap found in inspected artifacts.
- `PASS WITH NOTES`: acceptable, but non-blocking gaps remain.
- `NEEDS REVISION`: one or more Critical/High risks are missing, ambiguous, or untestable.
- `INCONCLUSIVE`: required preflight/spec artifacts or evidence are missing.

Include:

1. Audit scope and artifacts inspected.
2. Risk-to-spec traceability table.
3. Missing or weak scenarios with exact locations.
4. Contradictions and new risks.
5. Required revisions ranked by severity.
6. A final status and limitations.

Do not claim that the OpenSpec proposal is correct merely because all listed risks were copied. Judge whether each scenario actually specifies observable behavior.
