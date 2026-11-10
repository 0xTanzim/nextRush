# Faultline Spec Audit Checklist

Use this to challenge the proposal, not as a box-ticking exercise.

## Traceability

- Every Critical/High risk maps to one or more requirements/scenarios, or has an explicit accepted/deferred/out-of-scope decision.
- Risk IDs are preserved where practical.
- No mitigation was silently dropped.

## Testability

- Given/When/Then specifies state, trigger, and observable result.
- Error response, persisted data, side effects, events, and recovery are clear where applicable.
- Tests cover boundaries, duplicate requests, retries, partial success, and concurrency when relevant.
- Properties/invariants are stated where example-based scenarios are insufficient.

## Design integrity

- No contradiction between requirements or scenarios.
- Authorization, tenancy, and trust boundaries are clear.
- Data lifecycle, consistency, and migration behavior are covered.
- Timeout and ambiguous-commit semantics are explicit for external side effects.
- Operational observability, rollback, and recovery are considered.

## New-risk scan

- Does the proposed mitigation create a new single point of failure?
- Does it introduce a new dependency, permission, secret, queue, cache, or state transition?
- Does a retry/compensation mechanism create duplicate effects or retry loops?
- Does the design fail open or fail closed, and is that choice explicit?

## Audit discipline

- Cite exact artifact and section locations.
- Separate missing requirements from implementation suggestions.
- Avoid requesting tests for irrelevant scenarios.
- Allow `PASS` when evidence supports it; do not manufacture findings.
