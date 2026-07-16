---
"@nextrush/health": minor
---

New package: `@nextrush/health`.

Liveness and readiness health check endpoints for orchestrator probes (Kubernetes, PM2, systemd,
Docker). `/livez` reflects process liveness only — it never depends on registered checks, so a
transient dependency outage doesn't trigger an unnecessary pod restart. `/readyz` reflects a
registrable check API (sync `() => boolean` or async `() => Promise<boolean>`); a failing,
throwing, or timed-out check flips `/readyz` to `503`. Every check runs under a configurable
timeout so a hung dependency ping can't hang the endpoint indefinitely.

Optionally integrates with `@nextrush/adapter-node`'s `gracefulShutdown` option via a
user-wired shared flag (no hard code dependency between the two packages) — see the package
README for the pattern.

Unauthenticated by default, matching the conventional cluster-internal probe pattern; the
package's README states this security posture explicitly, including the network-layer
mitigation for deployments that need to restrict access.
