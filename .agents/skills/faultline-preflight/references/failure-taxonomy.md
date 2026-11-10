# Failure Taxonomy

Classify relevant risks under one or more domains. A category is not a finding;
a finding needs a concrete causal path and evidence.

1. **Requirements and assumptions:** ambiguous contract, missing actor, wrong success definition, undocumented legacy behavior.
2. **User behavior:** wrong action, double submit, stale page, abandonment, resume, invalid ordering, accidental deletion.
3. **Input and parsing:** null, absent, empty, malformed, wrong type, boundary, unicode, encoding, oversized, deeply nested, duplicate fields.
4. **Control flow:** branch not handled, unexpected exception, swallowed error, incorrect fallback, cancellation, early return, cleanup skipped.
5. **State and concurrency:** race, lost update, stale read, deadlock, duplicate event, out-of-order message, invalid transition, non-idempotent retry.
6. **Persistence and consistency:** partial commit, transaction isolation, schema drift, migration compatibility, cache incoherence, queue poison/replay, corruption.
7. **Dependency and network:** timeout, DNS/TLS, provider outage, rate limit, credential expiry, partial response, semantic contract drift, retry storm.
8. **Security and abuse:** broken authn/authz, IDOR, tenant leakage, injection, SSRF, privilege escalation, replay, resource abuse, secret leakage.
9. **Performance and capacity:** CPU/memory/disk/socket exhaustion, N+1, hot key/partition, queue backlog, unbounded fan-out, thundering herd.
10. **Process and infrastructure:** crash, restart, signal handling, container/OS limit, clock skew, configuration drift, unavailable filesystem.
11. **Deployment and compatibility:** mixed versions, migration failure, rollback incompatibility, feature-flag inconsistency, client/server version skew.
12. **Observability and operations:** undetected invariant violation, missing correlation IDs, alert fatigue, bad runbook, unsafe manual repair.
13. **Recovery and reversibility:** retry after ambiguous commit, failed compensation, duplicate compensation, incomplete restore, unrecoverable side effect.
14. **Human/organizational base rates:** unclear ownership, support gap, undocumented operation, key maintainer unavailable, scope or schedule pressure.
15. **Cascades and common causes:** shared dependency, shared credentials, correlated failure, resource contention, control-plane/data-plane coupling.
