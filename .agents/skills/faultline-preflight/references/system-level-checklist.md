# System-Level Break Checklist

Use this to drive reconnaissance in an existing repository. It is not a demand
to report a defect in every row. Mark each item covered, not applicable with a
reason, or not assessed.

## Product and actors
- User roles, admin/support/operator roles, service accounts, tenants.
- Normal, mistaken, malicious, interrupted, and accessibility-constrained use.
- User-visible guarantees, data ownership, privacy and retention.

## Process/runtime
- Entrypoints, startup/shutdown, lifecycle hooks, signals, cancellation.
- Sync/async boundaries, event loop/thread/process/worker model.
- Exceptions, panic/crash behavior, unhandled rejection, timeouts.
- Memory, CPU, file descriptors, sockets, connection pools and disk quotas.
- Resource cleanup, leaks, backpressure, bounded queues and overload behavior.

## Architecture and dependencies
- Module/service boundaries, dependency direction, cycles and shared state.
- Network calls, DNS/TLS, retries, circuit breakers, rate limits and timeouts.
- Dependency version drift, optional dependency behavior and incompatible APIs.
- Provider outages, slow/partial/semantically invalid responses.
- Failure isolation, bulkheads, fallback behavior and cascading failures.

## Data and persistence
- Transactions, isolation level, locks, constraints and write ordering.
- Read-after-write behavior, stale reads, lost updates and duplicate writes.
- Serialization, schema compatibility, migrations, backfills and rollback.
- Cache invalidation, cache stampede, stale cache and cache loss.
- Queue delivery semantics, poison messages, replay and dead-letter handling.
- Backup restore correctness, retention, deletion, encryption and corruption.

## State, ordering and time
- State machine invariants and every legal/illegal transition.
- Duplicate, delayed, reordered, concurrent and replayed events.
- Clock skew, time zones, DST, expiry, leases, TTL and long-running operations.
- Cancellation and restart between each durable side effect.
- Idempotency key scope, retention, collision and replay window.

## Security and trust
- Authentication vs authorization, object-level authorization and tenant isolation.
- Trust boundary crossings, identity propagation and confused-deputy paths.
- Untrusted input, injection, path traversal, SSRF, deserialization and parser limits.
- Secrets in logs/errors/artifacts, token expiry/rotation and permission drift.
- Abuse controls, rate limits, enumeration, privilege escalation and auditability.

## Deployment and operations
- Config validation, missing/wrong env vars, secret availability and drift.
- Rolling deploy with old/new versions and mixed schema compatibility.
- Health/readiness/liveness, graceful shutdown and worker draining.
- Rollback after irreversible side effects or partial migration.
- Observability for failures, queue lag, saturation, retries and business invariants.
- Runbooks, backup restore drills, incident containment and recovery ordering.

## Existing project-specific checks
- Search TODO/FIXME/HACK, ignored/skipped tests, feature flags and deprecations.
- Inspect changelog, incident notes, ADRs, architecture docs and known issues.
- Inspect generated code, lockfiles, build scripts, CI workflows and deployment config.
- Locate tests that assert public behavior; locate critical behavior with no tests.
- Trace at least one realistic end-to-end path through each critical subsystem in scope.

## System-boundary stress questions
- What is the smallest unit that can fail independently?
- What is the largest unit that can fail together (blast radius)?
- Where does a request become durable or externally irreversible?
- Where can the caller lose knowledge of whether an operation committed?
- Which retry can multiply side effects?
- Which resource is unbounded or has no backpressure?
- Which dependency can cause a cascading failure?
- Which invariant is not monitored or tested?
- What happens when recovery, rollback, backup, or the operator makes a mistake?
